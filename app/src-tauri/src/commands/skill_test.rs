use std::path::Path;

use crate::commands::imported_skills::validate_skill_name;
use crate::db::{self, Db};

#[derive(serde::Serialize)]
pub struct PrepareResult {
    pub test_id: String,
    pub baseline_cwd: String,
    pub with_skill_cwd: String,
    pub transcript_log_dir: String,
}

/// Create a `.claude/CLAUDE.md` file inside `parent_dir` with the given content.
fn write_workspace_claude_md(parent_dir: &Path, content: &str, label: &str) -> Result<(), String> {
    let claude_dir = parent_dir.join(".claude");
    std::fs::create_dir_all(&claude_dir).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to create {} dir: {}",
            label,
            e
        );
        format!("Failed to create {} workspace: {}", label, e)
    })?;
    std::fs::write(claude_dir.join("CLAUDE.md"), content).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to write {} CLAUDE.md: {}",
            label,
            e
        );
        format!("Failed to write {} CLAUDE.md: {}", label, e)
    })
}

/// Recursively copy a skill directory into `dest_skills_dir/{skill_name}/`.
/// Creates `dest_skills_dir` if it doesn't exist.
fn copy_skill_dir(src_skills_dir: &Path, dest_skills_dir: &Path, skill_name: &str) -> Result<(), String> {
    let src = src_skills_dir.join(skill_name);
    let dest = dest_skills_dir.join(skill_name);
    std::fs::create_dir_all(dest_skills_dir).map_err(|e| format!("Failed to create skills dir: {}", e))?;
    copy_dir_recursive(&src, &dest)
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| format!("Failed to create dir {:?}: {}", dest, e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("Failed to read dir {:?}: {}", src, e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy {:?}: {}", src_path, e))?;
        }
    }
    Ok(())
}

/// Prepare isolated temp workspaces for a skill test run.
///
/// Creates TWO temp dirs:
/// - `baseline_cwd`: skill-test context only (no user skill)
/// - `with_skill_cwd`: skill-test context + user skill
///
/// Both contain a `.claude/CLAUDE.md` and `.claude/skills/skill-test/` so agents
/// pick up skill context automatically via the SDK's workspace loading.
#[tauri::command]
pub fn prepare_skill_test(
    workspace_path: String,
    skill_name: String,
    db: tauri::State<'_, Db>,
) -> Result<PrepareResult, String> {
    log::info!(
        "[prepare_skill_test] skill={} workspace_path={}",
        skill_name,
        workspace_path
    );

    validate_skill_name(&skill_name)?;

    // Resolve skills_path from DB (falls back to workspace_path if not configured)
    let skills_path = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::read_settings(&conn)?;
        settings.skills_path.unwrap_or_else(|| workspace_path.clone())
    };

    let test_id = uuid::Uuid::new_v4().to_string();
    let tmp_parent = std::env::temp_dir().join(format!("skill-builder-test-{}", test_id));

    let baseline_dir = tmp_parent.join("baseline");
    let with_skill_dir = tmp_parent.join("with-skill");

    // Write minimal CLAUDE.md to both workspaces
    write_workspace_claude_md(&baseline_dir, "# Test Workspace", "baseline")?;
    write_workspace_claude_md(&with_skill_dir, "# Test Workspace", "with-skill")?;

    // Copy skill-test dir into both workspaces
    let workspace_skills_dir = Path::new(&workspace_path).join(".claude").join("skills");
    let baseline_skills_dir = baseline_dir.join(".claude").join("skills");
    let with_skill_skills_dir = with_skill_dir.join(".claude").join("skills");

    log::info!(
        "[prepare_skill_test] copying skill-test into baseline workspace"
    );
    copy_skill_dir(&workspace_skills_dir, &baseline_skills_dir, "skill-test")?;

    log::info!(
        "[prepare_skill_test] copying skill-test into with-skill workspace"
    );
    copy_skill_dir(&workspace_skills_dir, &with_skill_skills_dir, "skill-test")?;

    // Copy user skill into with-skill workspace only
    log::info!(
        "[prepare_skill_test] copying skill '{}' into with-skill workspace",
        skill_name
    );
    copy_skill_dir(
        &Path::new(&skills_path),
        &with_skill_skills_dir,
        &skill_name,
    )?;

    let transcript_log_dir = Path::new(&workspace_path)
        .join(&skill_name)
        .join("logs")
        .to_string_lossy()
        .to_string();
    let baseline_cwd = baseline_dir.to_string_lossy().to_string();
    let with_skill_cwd = with_skill_dir.to_string_lossy().to_string();

    log::info!(
        "[prepare_skill_test] test_id={} skill={} baseline_cwd={} with_skill_cwd={}",
        test_id,
        skill_name,
        baseline_cwd,
        with_skill_cwd
    );

    Ok(PrepareResult {
        test_id,
        baseline_cwd,
        with_skill_cwd,
        transcript_log_dir,
    })
}

/// Clean up the temp workspaces created by `prepare_skill_test`.
/// Both baseline and with-skill dirs share a common parent, so we remove the parent.
#[tauri::command]
pub fn cleanup_skill_test(test_id: String) -> Result<(), String> {
    let tmp_parent = std::env::temp_dir().join(format!("skill-builder-test-{}", test_id));
    if tmp_parent.exists() {
        std::fs::remove_dir_all(&tmp_parent).map_err(|e| {
            log::warn!("[cleanup_skill_test] Failed to remove temp dir: {}", e);
            format!("Failed to clean up temp workspace: {}", e)
        })?;
        log::info!("[cleanup_skill_test] test_id={} cleaned up", test_id);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cleanup_nonexistent_is_ok() {
        // Cleaning up a non-existent test should succeed silently
        cleanup_skill_test("nonexistent-id".to_string()).unwrap();
    }

    #[test]
    fn test_copy_skill_dir_copies_files() {
        let tmp = std::env::temp_dir().join(format!("skill-test-copy-{}", uuid::Uuid::new_v4()));
        let src_skills = tmp.join("src");
        let skill_dir = src_skills.join("my-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "# My Skill").unwrap();

        let dest_skills = tmp.join("dest");
        copy_skill_dir(&src_skills, &dest_skills, "my-skill").unwrap();

        assert!(dest_skills.join("my-skill").join("SKILL.md").exists());
        let content = std::fs::read_to_string(dest_skills.join("my-skill").join("SKILL.md")).unwrap();
        assert_eq!(content, "# My Skill");

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_copy_skill_dir_missing_source() {
        let tmp = std::env::temp_dir().join(format!("skill-test-missing-{}", uuid::Uuid::new_v4()));
        let result = copy_skill_dir(&tmp.join("nonexistent"), &tmp.join("dest"), "my-skill");
        assert!(result.is_err());
    }
}
