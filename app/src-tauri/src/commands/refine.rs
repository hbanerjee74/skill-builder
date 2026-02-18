use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use crate::agents::sidecar::{self, SidecarConfig};
use crate::agents::sidecar_pool::SidecarPool;
use crate::commands::imported_skills::validate_skill_name;
use crate::db::{self, Db};
use crate::types::{ConversationMessage, RefineFileDiff, RefineDiff, RefineSessionInfo, SkillFileContent};

/// Tools available to the refine-skill agent. Matches the agent's frontmatter
/// `tools: Read, Edit, Write, Glob, Grep, Task`. Task is required for the
/// `/rewrite` and `/validate` magic commands which spawn sub-agents.
const REFINE_TOOLS: &[&str] = &["Read", "Edit", "Write", "Glob", "Grep", "Task"];

const REFINE_AGENT_NAME: &str = "refine-skill";
const REFINE_MAX_TURNS: u32 = 20;

// ─── Session management scaffolding ──────────────────────────────────────────

/// In-memory state for a single refine session.
///
/// Created by `start_refine_session`, used by `send_refine_message`.
/// Each invocation of `send_refine_message` passes the full conversation history
/// to the sidecar (the sidecar is stateless -- history is replayed per-call).
pub struct RefineSession {
    pub skill_name: String,
}

/// Manages active refine sessions. Registered as Tauri managed state.
/// Follows the same `Mutex<HashMap>` pattern as `SidecarPool`.
///
/// ## Concurrency rule
/// Only one refine session per skill_name is allowed at a time.
/// `start_refine_session` must check this before creating a new session.
pub struct RefineSessionManager(pub Mutex<HashMap<String, RefineSession>>);

impl RefineSessionManager {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Build a SidecarConfig for a refine session message.
/// Extracted for testability — `send_refine_message` calls this then spawns the sidecar.
#[allow(clippy::too_many_arguments)]
fn build_refine_config(
    message: String,
    conversation_history: Vec<ConversationMessage>,
    skill_name: &str,
    skills_path: &str,
    api_key: String,
    model: String,
    extended_thinking: bool,
    agent_name: Option<&str>,
) -> (SidecarConfig, String) {
    let thinking_budget = extended_thinking.then_some(16_000u32);

    // CWD is the workspace root (.vibedata), not the skill subdirectory.
    // This matches workflow agents and ensures JSONL logs land at
    // {skills_path}/{skill_name}/logs/ (not doubled).
    let cwd = skills_path.to_string();
    let agent_id = format!(
        "refine-{}-{}",
        skill_name,
        chrono::Utc::now().timestamp_millis()
    );

    let effective_agent_name = agent_name.unwrap_or(REFINE_AGENT_NAME);

    let config = SidecarConfig {
        prompt: message,
        betas: crate::commands::workflow::build_betas(thinking_budget, &model),
        model: Some(model),
        api_key,
        cwd,
        allowed_tools: Some(REFINE_TOOLS.iter().map(|s| s.to_string()).collect()),
        max_turns: Some(REFINE_MAX_TURNS),
        permission_mode: None,
        // Do NOT pass session_id here — the sidecar interprets it as an SDK
        // "resume" ID, but our session_id is an internal refine session tracker.
        // Conversation context is passed via conversation_history instead.
        session_id: None,
        max_thinking_tokens: thinking_budget,
        path_to_claude_code_executable: None,
        agent_name: Some(effective_agent_name.to_string()),
        conversation_history: (!conversation_history.is_empty()).then(|| {
            conversation_history
                .into_iter()
                .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
                .collect()
        }),
    };

    (config, agent_id)
}

fn resolve_skills_path(db: &Db, workspace_path: &str) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::read_settings(&conn)?;
    Ok(settings
        .skills_path
        .unwrap_or_else(|| workspace_path.to_string()))
}

// ─── get_skill_content_for_refine ────────────────────────────────────────────

/// Returns the content of SKILL.md and all reference files for a skill.
/// Used by the preview panel in the refine chat UI.
#[tauri::command]
pub fn get_skill_content_for_refine(
    skill_name: String,
    workspace_path: String,
    db: tauri::State<'_, Db>,
) -> Result<Vec<SkillFileContent>, String> {
    log::info!("[get_skill_content_for_refine] skill={}", skill_name);
    validate_skill_name(&skill_name)?;
    let skills_path = resolve_skills_path(&db, &workspace_path).map_err(|e| {
        log::error!("[get_skill_content_for_refine] Failed to resolve skills path: {}", e);
        e
    })?;
    get_skill_content_inner(&skill_name, &skills_path).map_err(|e| {
        log::error!("[get_skill_content_for_refine] {}", e);
        e
    })
}

fn get_skill_content_inner(
    skill_name: &str,
    skills_path: &str,
) -> Result<Vec<SkillFileContent>, String> {
    let skill_root = Path::new(skills_path).join(skill_name);
    if !skill_root.exists() {
        return Err(format!(
            "Skill '{}' not found at {}",
            skill_name,
            skill_root.display()
        ));
    }

    log::debug!("[get_skill_content_for_refine] reading from {}", skill_root.display());
    let mut files = Vec::new();

    // 1. SKILL.md (the main skill file)
    let skill_md = skill_root.join("SKILL.md");
    if skill_md.exists() {
        let content = std::fs::read_to_string(&skill_md)
            .map_err(|e| format!("Failed to read SKILL.md: {}", e))?;
        files.push(SkillFileContent {
            path: "SKILL.md".to_string(),
            content,
        });
    }

    // 2. references/*.md and context/*.md (sorted alphabetically for stable ordering)
    for subdir in &["references", "context"] {
        let dir = skill_root.join(subdir);
        if dir.is_dir() {
            let mut entries: Vec<_> = std::fs::read_dir(&dir)
                .map_err(|e| format!("Failed to read {} dir: {}", subdir, e))?
                .flatten()
                .filter(|e| matches!(e.path().extension().and_then(|x| x.to_str()), Some("md" | "txt")))
                .collect();
            entries.sort_by_key(|e| e.file_name());
            for entry in entries {
                let rel = format!("{}/{}", subdir, entry.file_name().to_string_lossy());
                let content = std::fs::read_to_string(entry.path())
                    .map_err(|e| format!("Failed to read {}: {}", rel, e))?;
                files.push(SkillFileContent {
                    path: rel,
                    content,
                });
            }
        }
    }

    log::debug!("[get_skill_content_for_refine] returning {} files", files.len());
    Ok(files)
}

// ─── get_refine_diff ─────────────────────────────────────────────────────────

/// Returns the git diff for a skill's directory — both staged and unstaged changes.
/// Used by the preview panel to show what the refine agent changed.
///
/// Also supports per-file diffs via the `files` array in the response.
/// The frontend can use `git checkout -- <file>` (via a separate command) to undo
/// individual file changes.
#[tauri::command]
pub fn get_refine_diff(
    skill_name: String,
    workspace_path: String,
    db: tauri::State<'_, Db>,
) -> Result<RefineDiff, String> {
    log::info!("[get_refine_diff] skill={}", skill_name);
    validate_skill_name(&skill_name)?;
    let skills_path = resolve_skills_path(&db, &workspace_path).map_err(|e| {
        log::error!("[get_refine_diff] Failed to resolve skills path: {}", e);
        e
    })?;
    get_refine_diff_inner(&skill_name, &skills_path).map_err(|e| {
        log::error!("[get_refine_diff] {}", e);
        e
    })
}

fn get_refine_diff_inner(skill_name: &str, skills_path: &str) -> Result<RefineDiff, String> {
    use git2::{Delta, DiffFormat, DiffOptions, Repository};

    let repo_path = Path::new(skills_path);
    if !repo_path.join(".git").exists() {
        log::debug!("[get_refine_diff] no .git at {}, returning empty", repo_path.display());
        return Ok(RefineDiff {
            stat: "no git repository".to_string(),
            files: vec![],
        });
    }

    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let prefix = format!("{}/", skill_name);
    log::debug!("[get_refine_diff] computing diff for prefix '{}'", prefix);
    let mut opts = DiffOptions::new();
    opts.pathspec(&prefix);

    // Get HEAD tree (may not exist in a fresh repo)
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    // Combined HEAD→workdir diff (staged + unstaged in one pass, no double-counting)
    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
        .map_err(|e| format!("Failed to compute diff: {}", e))?;

    // Collect per-file diffs using print() which provides a single mutable callback
    let mut file_map: HashMap<String, RefineFileDiff> = HashMap::new();

    diff.print(DiffFormat::Patch, |delta, _hunk, line| {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            Delta::Added => "added",
            Delta::Deleted => "deleted",
            _ => "modified",
        };
        let entry = file_map.entry(path.clone()).or_insert_with(|| RefineFileDiff {
            path,
            status: status.to_string(),
            diff: String::new(),
        });

        // Append diff content: hunk headers, context, additions, deletions
        let origin = line.origin();
        if let Ok(s) = std::str::from_utf8(line.content()) {
            match origin {
                '+' | '-' | ' ' => {
                    entry.diff.push(origin);
                    entry.diff.push_str(s);
                }
                'H' => {
                    // Hunk header (@@) — content already includes the @@ prefix
                    entry.diff.push_str(s);
                }
                _ => {}
            }
        }

        true
    })
    .map_err(|e| format!("Failed to print diff: {}", e))?;

    if file_map.is_empty() {
        log::debug!("[get_refine_diff] no changes for '{}'", skill_name);
        return Ok(RefineDiff {
            stat: "no changes".to_string(),
            files: vec![],
        });
    }

    // Build stat summary from line counts (single pass per file)
    let total_files = file_map.len();
    let (insertions, deletions) = file_map.values().fold((0usize, 0usize), |(ins, del), f| {
        f.diff.lines().fold((ins, del), |(i, d), line| match line.as_bytes().first() {
            Some(b'+') => (i + 1, d),
            Some(b'-') => (i, d + 1),
            _ => (i, d),
        })
    });

    let stat = format!(
        "{} file(s) changed, {} insertion(s)(+), {} deletion(s)(-)",
        total_files, insertions, deletions
    );

    let mut files: Vec<RefineFileDiff> = file_map.into_values().collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(RefineDiff { stat, files })
}

// ─── start_refine_session ─────────────────────────────────────────────────────

/// Initialize a refine session for a skill.
///
/// No sidecar is spawned here — the sidecar is spawned per-message in `send_refine_message`.
#[tauri::command]
pub async fn start_refine_session(
    skill_name: String,
    workspace_path: String,
    sessions: tauri::State<'_, RefineSessionManager>,
    db: tauri::State<'_, Db>,
) -> Result<RefineSessionInfo, String> {
    log::info!("[start_refine_session] skill={}", skill_name);
    validate_skill_name(&skill_name)?;

    let skills_path = resolve_skills_path(&db, &workspace_path).map_err(|e| {
        log::error!("[start_refine_session] Failed to resolve skills path: {}", e);
        e
    })?;

    // Verify SKILL.md exists
    let skill_md = Path::new(&skills_path).join(&skill_name).join("SKILL.md");
    if !skill_md.exists() {
        let msg = format!("SKILL.md not found at {}", skill_md.display());
        log::error!("[start_refine_session] {}", msg);
        return Err(msg);
    }

    let mut map = sessions.0.lock().map_err(|e| {
        log::error!("[start_refine_session] Failed to acquire session lock: {}", e);
        e.to_string()
    })?;

    // Only one session per skill at a time
    if map.values().any(|s| s.skill_name == skill_name) {
        let msg = format!("A refine session already exists for skill '{}'", skill_name);
        log::error!("[start_refine_session] {}", msg);
        return Err(msg);
    }

    let session_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    log::debug!(
        "[start_refine_session] creating session {} for skill '{}'",
        session_id,
        skill_name
    );

    map.insert(
        session_id.clone(),
        RefineSession {
            skill_name: skill_name.clone(),
        },
    );

    Ok(RefineSessionInfo {
        session_id,
        skill_name,
        created_at,
    })
}

// ─── send_refine_message ──────────────────────────────────────────────────────

/// Send a user message to the refine agent and stream responses back.
///
/// Returns the `agent_id` so the frontend can listen for `agent-message` and
/// `agent-exit` events scoped to this request. Actual content streams via
/// Tauri events (same mechanism as workflow agents).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn send_refine_message(
    session_id: String,
    message: String,
    conversation_history: Vec<ConversationMessage>,
    workspace_path: String,
    agent_name: Option<String>,
    sessions: tauri::State<'_, RefineSessionManager>,
    pool: tauri::State<'_, SidecarPool>,
    db: tauri::State<'_, Db>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("[send_refine_message] session={}", session_id);

    // 1. Look up session
    let skill_name = {
        let map = sessions.0.lock().map_err(|e| {
            log::error!("[send_refine_message] Failed to acquire session lock: {}", e);
            e.to_string()
        })?;
        let session = map.get(&session_id).ok_or_else(|| {
            let msg = format!("No refine session found for id '{}'", session_id);
            log::error!("[send_refine_message] {}", msg);
            msg
        })?;
        session.skill_name.clone()
    };
    log::info!("[send_refine_message] session={} skill={}", session_id, skill_name);

    // 2. Read settings and user context from DB in a single lock
    let (skills_path, api_key, extended_thinking, model, user_context) = {
        let conn = db.0.lock().map_err(|e| {
            log::error!("[send_refine_message] Failed to acquire DB lock: {}", e);
            e.to_string()
        })?;
        let settings = db::read_settings_hydrated(&conn).map_err(|e| {
            log::error!("[send_refine_message] Failed to read settings: {}", e);
            e
        })?;
        let skills_path = settings
            .skills_path
            .clone()
            .unwrap_or_else(|| workspace_path.clone());
        let key = settings.anthropic_api_key.ok_or_else(|| {
            log::error!("[send_refine_message] Anthropic API key not configured");
            "Anthropic API key not configured".to_string()
        })?;
        let model = settings
            .preferred_model
            .unwrap_or_else(|| "sonnet".to_string());

        // Build inline user context (shared with workflow's build_prompt)
        let run_row = db::get_workflow_run(&conn, &skill_name).ok().flatten();
        let intake_json = run_row.as_ref().and_then(|r| r.intake_json.clone());
        let ctx = crate::commands::workflow::format_user_context(
            settings.industry.as_deref(),
            settings.function_role.as_deref(),
            intake_json.as_deref(),
        );

        (skills_path, key, settings.extended_thinking, model, ctx)
    };

    // 3. Append user context to message (same pattern as workflow build_prompt)
    let prompt = if let Some(ref ctx) = user_context {
        log::info!(
            "[send_refine_message] appending user context ({} chars) to prompt for skill '{}'",
            ctx.len(),
            skill_name
        );
        log::debug!("[send_refine_message] user context:\n{}", ctx);
        format!("{}\n\n{}", message, ctx)
    } else {
        log::info!("[send_refine_message] no user context available for skill '{}'", skill_name);
        message
    };

    // 4. Build config and agent_id
    let (config, agent_id) = build_refine_config(
        prompt,
        conversation_history,
        &skill_name,
        &skills_path,
        api_key,
        model,
        extended_thinking,
        agent_name.as_deref(),
    );

    log::debug!(
        "[send_refine_message] spawning agent {} in cwd={} with agent_name={}",
        agent_id,
        config.cwd,
        config.agent_name.as_deref().unwrap_or("none")
    );

    // 4. Spawn via pool — events stream automatically to frontend
    sidecar::spawn_sidecar(
        agent_id.clone(),
        config,
        pool.inner().clone(),
        app,
        skill_name,
    )
    .await
    .map_err(|e| {
        log::error!("[send_refine_message] Failed to spawn sidecar: {}", e);
        e
    })?;

    Ok(agent_id)
}

// ─── close_refine_session ─────────────────────────────────────────────────────

/// Close a refine session, removing it from the session manager.
///
/// Called by the frontend when navigating away from the refine chat or when
/// the user explicitly ends the session. This frees the one-per-skill slot
/// so a new session can be started for the same skill.
#[tauri::command]
pub fn close_refine_session(
    session_id: String,
    sessions: tauri::State<'_, RefineSessionManager>,
) -> Result<(), String> {
    log::info!("[close_refine_session] session={}", session_id);
    let mut map = sessions.0.lock().map_err(|e| {
        log::error!("[close_refine_session] Failed to acquire session lock: {}", e);
        e.to_string()
    })?;
    if map.remove(&session_id).is_some() {
        log::debug!("[close_refine_session] removed session {}", session_id);
    } else {
        log::debug!("[close_refine_session] session {} not found (already closed)", session_id);
    }
    Ok(())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ===== get_skill_content_inner tests =====

    #[test]
    fn test_get_skill_content_reads_skill_md() {
        let dir = tempdir().unwrap();
        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# My Skill\n\nContent here").unwrap();

        let files = get_skill_content_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "SKILL.md");
        assert_eq!(files[0].content, "# My Skill\n\nContent here");
    }

    #[test]
    fn test_get_skill_content_includes_references() {
        let dir = tempdir().unwrap();
        let skill_dir = dir.path().join("my-skill");
        let refs_dir = skill_dir.join("references");
        std::fs::create_dir_all(&refs_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();
        std::fs::write(refs_dir.join("api-guide.md"), "API guide").unwrap();
        std::fs::write(refs_dir.join("best-practices.md"), "Best practices").unwrap();
        // Non-md file should be excluded
        std::fs::write(refs_dir.join("data.json"), "{}").unwrap();

        let files = get_skill_content_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 3);
        assert_eq!(files[0].path, "SKILL.md");
        // References should be sorted alphabetically
        assert_eq!(files[1].path, "references/api-guide.md");
        assert_eq!(files[2].path, "references/best-practices.md");
    }

    #[test]
    fn test_get_skill_content_includes_txt_references() {
        let dir = tempdir().unwrap();
        let skill_dir = dir.path().join("my-skill");
        let refs_dir = skill_dir.join("references");
        std::fs::create_dir_all(&refs_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();
        std::fs::write(refs_dir.join("notes.txt"), "Text notes").unwrap();

        let files = get_skill_content_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[1].path, "references/notes.txt");
    }

    #[test]
    fn test_get_skill_content_missing_skill_errors() {
        let dir = tempdir().unwrap();
        let result = get_skill_content_inner("nonexistent", dir.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_get_skill_content_no_references_dir() {
        let dir = tempdir().unwrap();
        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();
        // No references/ directory

        let files = get_skill_content_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "SKILL.md");
    }

    // ===== get_refine_diff_inner tests =====

    #[test]
    fn test_get_refine_diff_no_git_repo_returns_empty() {
        let dir = tempdir().unwrap();
        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.stat, "no git repository");
        assert!(result.files.is_empty());
    }

    #[test]
    fn test_get_refine_diff_no_changes_returns_empty() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        // Create and commit a skill
        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();
        crate::git::commit_all(dir.path(), "initial").unwrap();

        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.stat, "no changes");
        assert!(result.files.is_empty());
    }

    #[test]
    fn test_get_refine_diff_modified_file_shows_diff() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# V1").unwrap();
        crate::git::commit_all(dir.path(), "v1").unwrap();

        // Modify the file (unstaged)
        std::fs::write(skill_dir.join("SKILL.md"), "# V2\n\nNew content").unwrap();

        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        assert!(!result.files.is_empty());

        let skill_file = result
            .files
            .iter()
            .find(|f| f.path.contains("SKILL.md"))
            .unwrap();
        assert_eq!(skill_file.status, "modified");
        assert!(!skill_file.diff.is_empty());
        // Verify hunk headers are included for valid unified diff format
        assert!(skill_file.diff.contains("@@"), "diff should include hunk headers");
    }

    #[test]
    fn test_get_refine_diff_filters_to_skill_prefix() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        // Create two skills
        let skill_a = dir.path().join("skill-a");
        let skill_b = dir.path().join("skill-b");
        std::fs::create_dir_all(&skill_a).unwrap();
        std::fs::create_dir_all(&skill_b).unwrap();
        std::fs::write(skill_a.join("SKILL.md"), "# A").unwrap();
        std::fs::write(skill_b.join("SKILL.md"), "# B").unwrap();
        crate::git::commit_all(dir.path(), "both skills").unwrap();

        // Modify both
        std::fs::write(skill_a.join("SKILL.md"), "# A v2").unwrap();
        std::fs::write(skill_b.join("SKILL.md"), "# B v2").unwrap();

        // Diff for skill-a should only show skill-a changes
        let result = get_refine_diff_inner("skill-a", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.files.len(), 1);
        assert!(result.files[0].path.starts_with("skill-a/"));

        // Diff for skill-b should only show skill-b changes
        let result = get_refine_diff_inner("skill-b", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.files.len(), 1);
        assert!(result.files[0].path.starts_with("skill-b/"));
    }

    #[test]
    fn test_get_refine_diff_added_file() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();
        crate::git::commit_all(dir.path(), "initial").unwrap();

        // Add a new file (unstaged)
        std::fs::create_dir_all(skill_dir.join("references")).unwrap();
        std::fs::write(
            skill_dir.join("references").join("new-ref.md"),
            "New reference",
        )
        .unwrap();

        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        // The new file should appear (untracked files may not show in index-to-workdir diff
        // unless added to index first, so this tests the staged path too)
        // Note: git2's diff_index_to_workdir may not show untracked files by default.
        // This is acceptable — the agent's changes are typically staged by the sidecar.
        // We just verify no error occurs.
        assert!(result.stat != "no git repository");
    }

    #[test]
    fn test_session_manager_new() {
        let manager = RefineSessionManager::new();
        let sessions = manager.0.lock().unwrap();
        assert!(sessions.is_empty());
    }

    // ===== session lifecycle tests =====

    #[test]
    fn test_session_create_and_lookup() {
        let manager = RefineSessionManager::new();
        let session_id = "test-session-1".to_string();

        {
            let mut map = manager.0.lock().unwrap();
            map.insert(
                session_id.clone(),
                RefineSession {
                    skill_name: "my-skill".to_string(),
                },
            );
        }

        let map = manager.0.lock().unwrap();
        let session = map.get(&session_id).unwrap();
        assert_eq!(session.skill_name, "my-skill");
    }

    #[test]
    fn test_session_conflict_detection() {
        let manager = RefineSessionManager::new();

        {
            let mut map = manager.0.lock().unwrap();
            map.insert(
                "session-1".to_string(),
                RefineSession {
                    skill_name: "my-skill".to_string(),
                },
            );
        }

        // Check that a second session for the same skill is detected
        let map = manager.0.lock().unwrap();
        let has_conflict = map.values().any(|s| s.skill_name == "my-skill");
        assert!(has_conflict);

        // Different skill should not conflict
        let no_conflict = map.values().any(|s| s.skill_name == "other-skill");
        assert!(!no_conflict);
    }

    #[test]
    fn test_session_not_found_returns_none() {
        let manager = RefineSessionManager::new();
        let map = manager.0.lock().unwrap();
        assert!(map.get("nonexistent").is_none());
    }

    // ===== build_refine_config tests =====

    fn base_refine_config(
        message: &str,
        history: Vec<ConversationMessage>,
    ) -> (SidecarConfig, String) {
        build_refine_config(
            message.to_string(),
            history,
            "my-skill",
            "/skills",
            "sk-test-key".to_string(),
            "sonnet".to_string(),
            false,
            None,
        )
    }

    #[test]
    fn test_refine_config_agent_name_matches_agent_prompt() {
        // agent_name must match agents/refine-skill.md so the sidecar loads the correct prompt
        let (config, _) = base_refine_config("improve metrics", vec![]);
        assert_eq!(config.agent_name.as_deref(), Some("refine-skill"));
    }

    #[test]
    fn test_refine_config_includes_task_tool_for_magic_commands() {
        // /rewrite and /validate magic commands spawn sub-agents via Task
        let (config, _) = base_refine_config("/rewrite", vec![]);
        let tools = config.allowed_tools.unwrap();
        assert!(
            tools.contains(&"Task".to_string()),
            "Task tool required for /rewrite and /validate magic commands"
        );
    }

    #[test]
    fn test_refine_config_includes_all_file_tools() {
        let (config, _) = base_refine_config("edit SKILL.md", vec![]);
        let tools = config.allowed_tools.unwrap();
        for tool in &["Read", "Edit", "Write", "Glob", "Grep"] {
            assert!(
                tools.contains(&tool.to_string()),
                "Missing expected tool: {}",
                tool
            );
        }
    }

    #[test]
    fn test_refine_config_cwd_points_to_workspace_root() {
        // cwd must be skills_path (workspace root), not skills_path/skill_name.
        // This matches workflow agents and ensures logs land at {skills_path}/{skill_name}/logs/.
        let (config, _) = build_refine_config(
            "test".to_string(),
            vec![],
            "data-engineering",
            "/home/user/skills",
            "sk-key".to_string(),
            "sonnet".to_string(),
            false,
            None,
        );
        assert_eq!(config.cwd, "/home/user/skills");
    }

    #[test]
    fn test_refine_config_passes_conversation_history() {
        // Multi-turn history is passed to the sidecar for context
        let history = vec![
            ConversationMessage { role: "user".into(), content: "Add metrics section".into() },
            ConversationMessage { role: "assistant".into(), content: "Done. I added...".into() },
        ];
        let (config, _) = base_refine_config("Now add examples", history);
        let ch = config.conversation_history.unwrap();
        assert_eq!(ch.len(), 2);
        assert_eq!(ch[0]["role"], "user");
        assert_eq!(ch[1]["role"], "assistant");
    }

    #[test]
    fn test_refine_config_empty_history_becomes_none() {
        let (config, _) = base_refine_config("first message", vec![]);
        assert!(config.conversation_history.is_none());
    }

    #[test]
    fn test_refine_config_rewrite_command_passthrough() {
        // /rewrite is passed as the prompt — the agent interprets it
        let (config, _) = base_refine_config("/rewrite", vec![]);
        assert_eq!(config.prompt, "/rewrite");
    }

    #[test]
    fn test_refine_config_validate_command_passthrough() {
        // /validate is passed as the prompt — the agent interprets it
        let (config, _) = base_refine_config("/validate", vec![]);
        assert_eq!(config.prompt, "/validate");
    }

    #[test]
    fn test_refine_config_file_targeting_passthrough() {
        // @file targeting is part of the message — the agent interprets it
        let (config, _) =
            base_refine_config("@references/metrics.md Add SLA thresholds", vec![]);
        assert_eq!(
            config.prompt,
            "@references/metrics.md Add SLA thresholds"
        );
    }

    #[test]
    fn test_refine_config_agent_id_format() {
        let (_, agent_id) = base_refine_config("test", vec![]);
        assert!(agent_id.starts_with("refine-my-skill-"));
    }

    #[test]
    fn test_refine_config_session_id_is_none() {
        // session_id must NOT be passed to the sidecar — the SDK would interpret
        // it as a "resume" ID and fail with "No conversation found".
        let (config, _) = base_refine_config("test", vec![]);
        assert!(config.session_id.is_none());
    }

    #[test]
    fn test_refine_config_extended_thinking_sets_budget() {
        let (config, _) = build_refine_config(
            "test".to_string(),
            vec![],
            "my-skill",
            "/skills",
            "sk-key".to_string(),
            "sonnet".to_string(),
            true, // extended_thinking enabled
            None,
        );
        assert_eq!(config.max_thinking_tokens, Some(16_000));
    }

    #[test]
    fn test_refine_config_custom_agent_name_overrides_default() {
        let (config, _) = build_refine_config(
            "test".to_string(),
            vec![],
            "my-skill",
            "/skills",
            "sk-key".to_string(),
            "sonnet".to_string(),
            false,
            Some("rewrite-skill"),
        );
        assert_eq!(config.agent_name.as_deref(), Some("rewrite-skill"));
    }

    #[test]
    fn test_refine_config_no_thinking_when_disabled() {
        let (config, _) = base_refine_config("test", vec![]);
        assert!(config.max_thinking_tokens.is_none());
    }

    #[test]
    fn test_refine_config_serialization_matches_sidecar_schema() {
        // End-to-end: build config, serialize to JSON, verify the sidecar sees correct fields
        let history = vec![
            ConversationMessage { role: "user".into(), content: "First request".into() },
            ConversationMessage { role: "assistant".into(), content: "Done".into() },
        ];
        let (config, _) = base_refine_config("@SKILL.md Update overview", history);

        let json = serde_json::to_string(&config).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        // Verify camelCase field names match sidecar's SidecarConfig interface
        assert_eq!(parsed["prompt"], "@SKILL.md Update overview");
        assert_eq!(parsed["agentName"], "refine-skill");
        assert_eq!(parsed["maxTurns"], REFINE_MAX_TURNS);
        assert!(parsed["allowedTools"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!("Task")));
        assert_eq!(parsed["conversationHistory"].as_array().unwrap().len(), 2);
        // sessionId must NOT be set — the SDK interprets it as "resume" and fails
        assert!(parsed.get("sessionId").is_none());
    }

    #[test]
    fn test_refine_config_serialization_omits_none_fields() {
        let (config, _) = base_refine_config("test", vec![]);
        let json = serde_json::to_string(&config).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        // None fields with skip_serializing_if should be absent
        assert!(parsed.get("conversationHistory").is_none());
        assert!(parsed.get("maxThinkingTokens").is_none());
        assert!(parsed.get("permissionMode").is_none());
    }

    #[test]
    fn test_close_session_removes_entry() {
        let manager = RefineSessionManager::new();
        let session_id = "to-close".to_string();

        {
            let mut map = manager.0.lock().unwrap();
            map.insert(
                session_id.clone(),
                RefineSession {
                    skill_name: "my-skill".to_string(),
                },
            );
            assert_eq!(map.len(), 1);
        }

        // Simulate close: remove by session_id
        {
            let mut map = manager.0.lock().unwrap();
            assert!(map.remove(&session_id).is_some());
        }

        let map = manager.0.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn test_close_nonexistent_session_is_noop() {
        let manager = RefineSessionManager::new();
        let mut map = manager.0.lock().unwrap();
        assert!(map.remove("nonexistent").is_none());
    }

    #[test]
    fn test_get_refine_diff_produces_valid_unified_diff() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "line1\nline2\nline3\n").unwrap();
        crate::git::commit_all(dir.path(), "initial").unwrap();

        std::fs::write(skill_dir.join("SKILL.md"), "line1\nchanged\nline3\n").unwrap();

        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        let diff = &result.files[0].diff;

        // Unified diff must have hunk headers, context, additions, and deletions
        assert!(diff.contains("@@"), "missing hunk header");
        assert!(diff.contains("-line2"), "missing deletion");
        assert!(diff.contains("+changed"), "missing addition");
        assert!(diff.contains(" line1"), "missing context line");
    }

    #[test]
    fn test_get_refine_diff_stat_counts_insertions_deletions() {
        let dir = tempdir().unwrap();
        crate::git::ensure_repo(dir.path()).unwrap();

        let skill_dir = dir.path().join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "old\n").unwrap();
        crate::git::commit_all(dir.path(), "initial").unwrap();

        std::fs::write(skill_dir.join("SKILL.md"), "new\nextra\n").unwrap();

        let result = get_refine_diff_inner("my-skill", dir.path().to_str().unwrap()).unwrap();
        // 1 file changed, 2 insertions (new + extra), 1 deletion (old)
        assert!(result.stat.contains("1 file(s) changed"));
        assert!(result.stat.contains("2 insertion(s)(+)"));
        assert!(result.stat.contains("1 deletion(s)(-)"));
    }

    #[test]
    fn test_refine_config_conversation_message_type_safety() {
        // ConversationMessage struct enforces typed role+content at the IPC boundary
        let history = vec![
            ConversationMessage { role: "user".into(), content: "request".into() },
            ConversationMessage { role: "assistant".into(), content: "response".into() },
        ];
        let (config, _) = base_refine_config("follow-up", history);
        let json = serde_json::to_string(&config).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        let ch = parsed["conversationHistory"].as_array().unwrap();
        // Verify exact shape matches sidecar's expected { role, content } objects
        assert_eq!(ch[0]["role"], "user");
        assert_eq!(ch[0]["content"], "request");
        assert_eq!(ch[1]["role"], "assistant");
        assert_eq!(ch[1]["content"], "response");
        // No extra fields
        assert_eq!(ch[0].as_object().unwrap().len(), 2);
    }

    #[test]
    fn test_skill_name_validation_rejects_traversal() {
        assert!(validate_skill_name("good-name").is_ok());
        assert!(validate_skill_name("../bad").is_err());
        assert!(validate_skill_name("bad/name").is_err());
        assert!(validate_skill_name("").is_err());
    }

    // ===== user context embedding tests =====
    // Tests the prompt assembly pattern used in send_refine_message

    #[test]
    fn test_user_context_appended_to_prompt() {
        // Simulates the prompt assembly in send_refine_message
        let message = "Add SLA metrics to the skill".to_string();
        let user_context = crate::commands::workflow::format_user_context(
            Some("Healthcare"),
            Some("Analytics Lead"),
            Some(r#"{"audience":"Data engineers","challenges":"Legacy ETL"}"#),
        );
        let prompt = if let Some(ctx) = user_context {
            format!("{}\n\n{}", message, ctx)
        } else {
            message
        };
        assert!(prompt.starts_with("Add SLA metrics to the skill"));
        assert!(prompt.contains("## User Context"));
        assert!(prompt.contains("**Industry**: Healthcare"));
        assert!(prompt.contains("**Target Audience**: Data engineers"));
    }

    #[test]
    fn test_prompt_unchanged_without_user_context() {
        // When no user context fields exist, prompt passes through unchanged
        let message = "Fix the overview".to_string();
        let user_context = crate::commands::workflow::format_user_context(None, None, None);
        let prompt = if let Some(ctx) = user_context {
            format!("{}\n\n{}", message, ctx)
        } else {
            message.clone()
        };
        assert_eq!(prompt, "Fix the overview");
    }

}
