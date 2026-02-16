use std::path::Path;

use log::{debug, error, info};

use crate::db::Db;
use crate::types::{PushResult, SkillBuilderManifest, SkillDiff};

// --- Tauri Commands ---

/// Validate that the authenticated user has push access to the remote repo.
#[tauri::command]
pub async fn validate_remote_repo(
    db: tauri::State<'_, Db>,
    owner: String,
    repo: String,
) -> Result<(), String> {
    info!("validate_remote_repo: checking {}/{}", owner, repo);

    let token = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = crate::db::read_settings(&conn)?;
        settings
            .github_oauth_token
            .ok_or_else(|| "Not authenticated with GitHub. Please sign in first.".to_string())?
    };

    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "SkillBuilder")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("validate_remote_repo: failed to reach GitHub: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("validate_remote_repo: failed to parse response: {e}"))?;

    if status.as_u16() == 404 {
        error!("validate_remote_repo: repo not found: {}/{}", owner, repo);
        return Err(format!(
            "Repository '{}/{}' not found. Check the owner and repo name.",
            owner, repo
        ));
    }

    if !status.is_success() {
        let message = body["message"].as_str().unwrap_or("Unknown error");
        error!(
            "validate_remote_repo: GitHub API error ({}): {}",
            status, message
        );
        return Err(format!(
            "GitHub API error ({}): {}",
            status, message
        ));
    }

    // Check push permission
    let has_push = body["permissions"]["push"].as_bool().unwrap_or(false);
    if !has_push {
        error!(
            "validate_remote_repo: no push access to {}/{}",
            owner, repo
        );
        return Err(format!(
            "You don't have push access to '{}/{}'. Ask the repository owner to grant you write access.",
            owner, repo
        ));
    }

    info!("validate_remote_repo: push access confirmed for {}/{}", owner, repo);
    Ok(())
}

/// Push a skill to the configured remote repo via branch + PR.
#[tauri::command]
pub async fn push_skill_to_remote(
    _app: tauri::AppHandle,
    db: tauri::State<'_, Db>,
    skill_name: String,
) -> Result<PushResult, String> {
    info!("push_skill_to_remote: starting push for '{}'", skill_name);

    // 1. Load settings
    let (token, owner, repo_name, github_login, workspace_path, skills_path, api_key) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = crate::db::read_settings(&conn)?;
        let token = settings
            .github_oauth_token
            .ok_or_else(|| "Not authenticated with GitHub. Please sign in first.".to_string())?;
        let owner = settings.remote_repo_owner.ok_or_else(|| {
            "Remote repository not configured. Set the repo owner in Settings.".to_string()
        })?;
        let repo_name = settings.remote_repo_name.ok_or_else(|| {
            "Remote repository not configured. Set the repo name in Settings.".to_string()
        })?;
        let github_login = settings.github_user_login.ok_or_else(|| {
            "GitHub user login not available. Please sign in again.".to_string()
        })?;
        let workspace_path = settings
            .workspace_path
            .ok_or_else(|| "Workspace path not initialized.".to_string())?;
        let skills_path = settings.skills_path;
        let api_key = settings.anthropic_api_key;
        (
            token,
            owner,
            repo_name,
            github_login,
            workspace_path,
            skills_path,
            api_key,
        )
    };

    // 2. Resolve output root
    let output_root = skills_path.unwrap_or(workspace_path);
    let output_path = Path::new(&output_root);
    let skill_dir = output_path.join(&skill_name);

    if !skill_dir.exists() {
        error!(
            "push_skill_to_remote: skill directory not found: {}",
            skill_dir.display()
        );
        return Err(format!(
            "Skill directory not found at '{}'. Build the skill first.",
            skill_dir.display()
        ));
    }

    // 3. Ensure git repo exists
    let repo = crate::git::ensure_repo(output_path)?;

    // 4. Get the next push version from tags
    let version = get_next_push_version(&repo, &skill_name)?;
    let is_first_push = version == 1;
    debug!(
        "push_skill_to_remote: version={} is_first_push={}",
        version, is_first_push
    );

    // 5. Compute diff / content for changelog
    let diff_text = if is_first_push {
        // First push: read all files in the skill directory
        collect_skill_files(&skill_dir)?
    } else {
        // Subsequent push: get diff between last tag and HEAD
        let tag_name = format!("pushed/{}/v{}", skill_name, version - 1);
        match get_diff_from_tag(&repo, &tag_name, &skill_name) {
            Ok(diff) => format_diff_for_changelog(&diff),
            Err(e) => {
                info!(
                    "push_skill_to_remote: could not compute diff from tag '{}': {}. Falling back to full content.",
                    tag_name, e
                );
                collect_skill_files(&skill_dir)?
            }
        }
    };

    // 6. Generate changelog via Anthropic API
    let changelog = if let Some(ref key) = api_key {
        match generate_changelog(key, &skill_name, &diff_text, is_first_push).await {
            Ok(text) => text,
            Err(e) => {
                info!(
                    "push_skill_to_remote: changelog generation failed: {}. Using fallback.",
                    e
                );
                if is_first_push {
                    format!("Initial push of skill `{}`.", skill_name)
                } else {
                    format!("Updated skill `{}` to v{}.", skill_name, version)
                }
            }
        }
    } else {
        if is_first_push {
            format!("Initial push of skill `{}`.", skill_name)
        } else {
            format!("Updated skill `{}` to v{}.", skill_name, version)
        }
    };

    // 7. Write/update .skill-builder manifest
    write_manifest_file(&skill_dir, Some(github_login.as_str()))?;

    // 8. Commit all changes
    let commit_msg = if is_first_push {
        format!("{}: initial push", skill_name)
    } else {
        format!("{}: push v{}", skill_name, version)
    };
    if let Err(e) = crate::git::commit_all(output_path, &commit_msg) {
        info!(
            "push_skill_to_remote: commit returned error (may mean no changes): {}",
            e
        );
    }

    // 9. Create branch and push to remote
    let branch_name = format!("skill/{}/{}", github_login, skill_name);
    push_branch_to_remote(
        &repo,
        &branch_name,
        &owner,
        &repo_name,
        &github_login,
        &token,
    )?;

    // 10. Create or update PR
    let client = reqwest::Client::new();
    let (pr_url, pr_number, is_new_pr) = create_or_update_pr(
        &client,
        &token,
        &owner,
        &repo_name,
        &branch_name,
        &skill_name,
        &changelog,
        is_first_push,
    )
    .await?;

    // 11. Create local tag
    create_push_tag(&repo, &skill_name, version)?;

    let result = PushResult {
        pr_url,
        pr_number,
        branch: branch_name,
        version,
        is_new_pr,
    };

    info!(
        "push_skill_to_remote: completed push for '{}' v{} — PR #{} (new={})",
        skill_name, version, result.pr_number, result.is_new_pr
    );
    Ok(result)
}

/// Reconcile .skill-builder manifests for all skills in the output root.
/// Updates creator field if it differs from the current GitHub user.
/// Returns the count of updated manifests.
#[tauri::command]
pub fn reconcile_manifests(
    db: tauri::State<'_, Db>,
) -> Result<u32, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    reconcile_manifests_inner(&conn)
}

/// Inner implementation of manifest reconciliation. Takes a raw Connection
/// so it can be called from both the Tauri command and startup reconciliation.
pub fn reconcile_manifests_inner(
    conn: &rusqlite::Connection,
) -> Result<u32, String> {
    info!("reconcile_manifests: starting");

    let settings = crate::db::read_settings(conn)?;
    let github_login = settings.github_user_login;
    let output_root = settings
        .skills_path
        .or(settings.workspace_path)
        .ok_or_else(|| "No output root configured.".to_string())?;

    let output_path = Path::new(&output_root);
    if !output_path.exists() {
        info!("reconcile_manifests: output root does not exist, nothing to reconcile");
        return Ok(0);
    }

    let mut updated_count = 0u32;

    let entries = std::fs::read_dir(output_path)
        .map_err(|e| format!("reconcile_manifests: failed to read output root: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        let manifest_path = path.join(".skill-builder");
        if !manifest_path.exists() {
            continue;
        }

        let content = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("reconcile_manifests: failed to read manifest for '{}': {e}", name))?;
        let mut manifest: SkillBuilderManifest = serde_json::from_str(&content)
            .map_err(|e| format!("reconcile_manifests: failed to parse manifest for '{}': {e}", name))?;

        if manifest.creator.as_deref() != github_login.as_deref() {
            manifest.creator = github_login.clone();
            let json = serde_json::to_string_pretty(&manifest)
                .map_err(|e| format!("reconcile_manifests: failed to serialize manifest: {e}"))?;
            std::fs::write(&manifest_path, json)
                .map_err(|e| format!("reconcile_manifests: failed to write manifest for '{}': {e}", name))?;
            updated_count += 1;
            debug!("reconcile_manifests: updated creator for '{}'", name);
        }
    }

    if updated_count > 0 {
        let msg = format!("reconcile .skill-builder manifests ({})", updated_count);
        if let Err(e) = crate::git::commit_all(output_path, &msg) {
            info!(
                "reconcile_manifests: commit failed (may mean no changes): {}",
                e
            );
        }
    }

    info!("reconcile_manifests: updated {} manifests", updated_count);
    Ok(updated_count)
}

/// Write a .skill-builder manifest for a skill. Does NOT commit.
#[tauri::command]
pub fn write_skill_manifest(
    db: tauri::State<'_, Db>,
    skill_name: String,
) -> Result<(), String> {
    info!("write_skill_manifest: writing manifest for '{}'", skill_name);

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = crate::db::read_settings(&conn)?;
    let github_login = settings.github_user_login;
    let output_root = settings
        .skills_path
        .or(settings.workspace_path)
        .ok_or_else(|| "No output root configured.".to_string())?;

    let skill_dir = Path::new(&output_root).join(&skill_name);
    if !skill_dir.exists() {
        return Err(format!(
            "Skill directory not found at '{}'.",
            skill_dir.display()
        ));
    }

    write_manifest_file(&skill_dir, github_login.as_deref())?;

    info!("write_skill_manifest: manifest written for '{}'", skill_name);
    Ok(())
}

// --- Public Helpers (used by other commands) ---

/// Write the .skill-builder manifest JSON file into a skill directory.
/// Public wrapper for use by `skill.rs` during skill creation.
pub fn write_manifest_to_dir(
    skill_dir: &Path,
    creator: Option<&str>,
) -> Result<(), String> {
    write_manifest_file(skill_dir, creator)
}

// --- Internal Helpers ---

/// Write the .skill-builder manifest JSON file into a skill directory.
fn write_manifest_file(
    skill_dir: &Path,
    creator: Option<&str>,
) -> Result<(), String> {
    let manifest = SkillBuilderManifest {
        version: "1.0".to_string(),
        creator: creator.map(|s| s.to_string()),
        created_at: chrono::Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };

    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {e}"))?;
    let manifest_path = skill_dir.join(".skill-builder");
    std::fs::write(&manifest_path, json)
        .map_err(|e| format!("Failed to write manifest at {}: {e}", manifest_path.display()))?;

    debug!("write_manifest_file: wrote {}", manifest_path.display());
    Ok(())
}

/// Get the next push version by counting local tags matching `pushed/{skill_name}/v*`.
fn get_next_push_version(repo: &git2::Repository, skill_name: &str) -> Result<u32, String> {
    let tag_prefix = format!("pushed/{}/v", skill_name);
    let mut max_version = 0u32;

    repo.tag_foreach(|_oid, name| {
        if let Ok(name_str) = std::str::from_utf8(name) {
            let short = name_str.strip_prefix("refs/tags/").unwrap_or(name_str);
            if let Some(version_str) = short.strip_prefix(&tag_prefix) {
                if let Ok(v) = version_str.parse::<u32>() {
                    if v > max_version {
                        max_version = v;
                    }
                }
            }
        }
        true // continue iteration
    })
    .map_err(|e| format!("Failed to iterate tags: {e}"))?;

    Ok(max_version + 1)
}

/// Collect all file contents from a skill directory for the initial push changelog.
fn collect_skill_files(skill_dir: &Path) -> Result<String, String> {
    let mut output = String::new();
    collect_files_recursive(skill_dir, skill_dir, &mut output)?;
    Ok(output)
}

fn collect_files_recursive(
    base: &Path,
    dir: &Path,
    output: &mut String,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {e}", dir.display()))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_files_recursive(base, &path, output)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            if let Ok(content) = std::fs::read_to_string(&path) {
                output.push_str(&format!("--- {} ---\n", rel));
                let lines: Vec<&str> = content.lines().collect();
                let preview: String = if lines.len() > 50 {
                    format!(
                        "{}\n... ({} more lines)",
                        lines[..50].join("\n"),
                        lines.len() - 50
                    )
                } else {
                    lines.join("\n")
                };
                output.push_str(&preview);
                output.push_str("\n\n");
            }
        }
    }
    Ok(())
}

/// Format a SkillDiff for use as changelog input.
fn format_diff_for_changelog(diff: &SkillDiff) -> String {
    let mut output = String::new();
    for file in &diff.files {
        output.push_str(&format!("--- {} ({}) ---\n", file.path, file.status));
        if let Some(content) = &file.new_content {
            let lines: Vec<&str> = content.lines().collect();
            let preview: String = if lines.len() > 50 {
                format!(
                    "{}\n... ({} more lines)",
                    lines[..50].join("\n"),
                    lines.len() - 50
                )
            } else {
                lines.join("\n")
            };
            output.push_str(&preview);
            output.push('\n');
        }
        output.push('\n');
    }
    output
}

/// Get the diff between a tag and HEAD for a specific skill.
fn get_diff_from_tag(
    repo: &git2::Repository,
    tag_name: &str,
    skill_name: &str,
) -> Result<SkillDiff, String> {
    // Find the tag
    let tag_ref = repo
        .find_reference(&format!("refs/tags/{}", tag_name))
        .map_err(|e| format!("Tag '{}' not found: {e}", tag_name))?;
    let tag_commit = tag_ref
        .peel_to_commit()
        .map_err(|e| format!("Failed to resolve tag '{}' to commit: {e}", tag_name))?;
    let tag_sha = tag_commit.id().to_string();

    // Get HEAD commit SHA
    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {e}"))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to resolve HEAD to commit: {e}"))?;
    let head_sha = head_commit.id().to_string();

    let repo_path = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;

    crate::git::get_diff(repo_path, &tag_sha, &head_sha, skill_name)
}

/// Generate a changelog/PR description using the Anthropic API (Haiku).
async fn generate_changelog(
    api_key: &str,
    skill_name: &str,
    diff_text: &str,
    is_first_push: bool,
) -> Result<String, String> {
    let prompt = if is_first_push {
        format!(
            "You are writing a PR description for a new Claude skill called '{}'.\n\n\
            Here are the skill files:\n\n{}\n\n\
            Write a concise summary (2-4 sentences) of what this skill does and who it's for. \
            Use markdown formatting. Do not include a title.",
            skill_name, diff_text
        )
    } else {
        format!(
            "You are writing a changelog entry for an update to a Claude skill called '{}'.\n\n\
            Here is the diff since the last push:\n\n{}\n\n\
            Write a concise changelog (bulleted list) of what changed. \
            Use markdown formatting. Do not include a title.",
            skill_name, diff_text
        )
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}]
        }))
        .send()
        .await
        .map_err(|e| format!("Changelog generation failed: {e}"))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse changelog response: {e}"))?;

    body["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No text in changelog response".to_string())
}

/// Create or update a local branch and force-push it to the remote.
fn push_branch_to_remote(
    repo: &git2::Repository,
    branch_name: &str,
    owner: &str,
    repo_name: &str,
    github_login: &str,
    token: &str,
) -> Result<(), String> {
    let remote_url = format!("https://github.com/{}/{}.git", owner, repo_name);

    // Find or create a remote. Use "push-target" to avoid conflicts with existing "origin".
    let remote_name = "push-target";
    let mut remote = match repo.find_remote(remote_name) {
        Ok(r) => {
            // Verify URL matches; if not, delete and recreate
            if r.url() != Some(&remote_url) {
                drop(r);
                repo.remote_delete(remote_name)
                    .map_err(|e| format!("Failed to delete stale remote '{}': {e}", remote_name))?;
                repo.remote(remote_name, &remote_url)
                    .map_err(|e| format!("Failed to create remote '{}': {e}", remote_name))?
            } else {
                r
            }
        }
        Err(_) => repo
            .remote(remote_name, &remote_url)
            .map_err(|e| format!("Failed to create remote '{}': {e}", remote_name))?,
    };

    // Create (or update) a local branch pointing at HEAD
    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {e}"))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to resolve HEAD: {e}"))?;
    repo.branch(branch_name, &head_commit, true)
        .map_err(|e| format!("Failed to create branch '{}': {e}", branch_name))?;

    // Push with force (we own the branch)
    let login = github_login.to_string();
    let tok = token.to_string();
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        git2::Cred::userpass_plaintext(&login, &tok)
    });

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let refspec = format!(
        "+refs/heads/{}:refs/heads/{}",
        branch_name, branch_name
    );
    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| format!("Failed to push branch '{}': {e}", branch_name))?;

    info!(
        "push_branch_to_remote: pushed {} to {}/{}",
        branch_name, owner, repo_name
    );
    Ok(())
}

/// Create or update a GitHub PR for the pushed branch.
/// Returns (pr_url, pr_number, is_new_pr).
async fn create_or_update_pr(
    client: &reqwest::Client,
    token: &str,
    owner: &str,
    repo_name: &str,
    branch_name: &str,
    skill_name: &str,
    changelog: &str,
    _is_first_push: bool,
) -> Result<(String, u64, bool), String> {
    // Check for existing open PR
    let search_url = format!(
        "https://api.github.com/repos/{}/{}/pulls?head={}:{}&state=open",
        owner, repo_name, owner, branch_name
    );
    let search_response = client
        .get(&search_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "SkillBuilder")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("Failed to search for existing PRs: {e}"))?;

    let search_body: serde_json::Value = search_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse PR search response: {e}"))?;

    let existing_prs = search_body
        .as_array()
        .ok_or_else(|| "Unexpected PR search response format".to_string())?;

    if let Some(existing_pr) = existing_prs.first() {
        // Existing PR found — add a comment with the changelog and update title
        let pr_number = existing_pr["number"]
            .as_u64()
            .ok_or_else(|| "Missing PR number in response".to_string())?;
        let pr_url = existing_pr["html_url"]
            .as_str()
            .ok_or_else(|| "Missing PR URL in response".to_string())?
            .to_string();

        // Add comment with changelog
        let comment_url = format!(
            "https://api.github.com/repos/{}/{}/issues/{}/comments",
            owner, repo_name, pr_number
        );
        let comment_body = format!("## Update\n\n{}", changelog);
        client
            .post(&comment_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "SkillBuilder")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&serde_json::json!({ "body": comment_body }))
            .send()
            .await
            .map_err(|e| format!("Failed to add comment to PR #{}: {e}", pr_number))?;

        // Update PR title
        let pr_update_url = format!(
            "https://api.github.com/repos/{}/{}/pulls/{}",
            owner, repo_name, pr_number
        );
        let new_title = format!("Update `{}`", skill_name);
        client
            .patch(&pr_update_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "SkillBuilder")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&serde_json::json!({ "title": new_title }))
            .send()
            .await
            .map_err(|e| format!("Failed to update PR #{} title: {e}", pr_number))?;

        info!(
            "create_or_update_pr: updated existing PR #{} for '{}'",
            pr_number, skill_name
        );
        Ok((pr_url, pr_number, false))
    } else {
        // No existing PR — create a new one
        let create_url = format!(
            "https://api.github.com/repos/{}/{}/pulls",
            owner, repo_name
        );
        let title = format!("Add `{}`", skill_name);
        let response = client
            .post(&create_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "SkillBuilder")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&serde_json::json!({
                "title": title,
                "body": changelog,
                "head": branch_name,
                "base": "main"
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to create PR: {e}"))?;

        let status = response.status();
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse PR creation response: {e}"))?;

        if !status.is_success() {
            let message = body["message"].as_str().unwrap_or("Unknown error");
            let errors = body["errors"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|e| e["message"].as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default();
            error!(
                "create_or_update_pr: PR creation failed ({}): {} — {}",
                status, message, errors
            );
            return Err(format!(
                "Failed to create PR ({}): {}. {}",
                status, message, errors
            ));
        }

        let pr_number = body["number"]
            .as_u64()
            .ok_or_else(|| "Missing PR number in creation response".to_string())?;
        let pr_url = body["html_url"]
            .as_str()
            .ok_or_else(|| "Missing PR URL in creation response".to_string())?
            .to_string();

        info!(
            "create_or_update_pr: created PR #{} for '{}'",
            pr_number, skill_name
        );
        Ok((pr_url, pr_number, true))
    }
}

/// Create a local lightweight tag marking this push version.
fn create_push_tag(
    repo: &git2::Repository,
    skill_name: &str,
    version: u32,
) -> Result<(), String> {
    let tag_name = format!("pushed/{}/v{}", skill_name, version);
    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD for tag: {e}"))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to resolve HEAD for tag: {e}"))?;
    let object = head_commit
        .as_object();

    // Create lightweight tag (just a reference, not an annotated tag)
    repo.reference(
        &format!("refs/tags/{}", tag_name),
        object.id(),
        true, // force: overwrite if exists
        &format!("push v{}", version),
    )
    .map_err(|e| format!("Failed to create tag '{}': {e}", tag_name))?;

    debug!("create_push_tag: created tag '{}'", tag_name);
    Ok(())
}
