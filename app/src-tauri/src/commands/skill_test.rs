use std::path::Path;

use crate::commands::imported_skills::validate_skill_name;

#[derive(serde::Serialize)]
pub struct PrepareResult {
    pub test_id: String,
    pub baseline_cwd: String,
    pub with_skill_cwd: String,
    pub transcript_log_dir: String,
}

/// Strip YAML frontmatter from skill content.
/// Removes everything between the first and second `---` markers (inclusive).
fn strip_frontmatter(content: &str) -> String {
    let mut lines = content.lines();
    // Check if file starts with ---
    if lines.next().map(|l| l.trim()) != Some("---") {
        return content.to_string();
    }
    // Skip until the closing ---
    let mut after_frontmatter = false;
    let mut body_lines: Vec<&str> = Vec::new();
    for line in lines {
        if !after_frontmatter {
            if line.trim() == "---" {
                after_frontmatter = true;
            }
        } else {
            body_lines.push(line);
        }
    }
    body_lines.join("\n").trim_start_matches('\n').to_string()
}

/// Prepare isolated temp workspaces for a skill test run.
///
/// Creates TWO temp dirs:
/// - `baseline_cwd`: skill-test context only (no user skill)
/// - `with_skill_cwd`: skill-test context + user skill
///
/// Both contain a `.claude/CLAUDE.md` pre-populated with the appropriate context
/// so agents pick it up automatically via the SDK's workspace CLAUDE.md loading.
#[tauri::command]
pub fn prepare_skill_test(
    app: tauri::AppHandle,
    workspace_path: String,
    skill_name: String,
) -> Result<PrepareResult, String> {
    log::info!(
        "[prepare_skill_test] skill={} workspace_path={}",
        skill_name,
        workspace_path
    );

    validate_skill_name(&skill_name)?;

    let test_id = uuid::Uuid::new_v4().to_string();
    let tmp_parent = std::env::temp_dir().join(format!("skill-builder-test-{}", test_id));

    // Read skill-test bundled skill
    let bundled_skills_dir = super::workflow::resolve_bundled_skills_dir(&app);
    let skill_test_path = bundled_skills_dir.join("skill-test").join("SKILL.md");
    let skill_test_raw = std::fs::read_to_string(&skill_test_path).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to read skill-test SKILL.md at {:?}: {}",
            skill_test_path,
            e
        );
        format!("Failed to read skill-test content: {}", e)
    })?;
    let skill_test_body = strip_frontmatter(&skill_test_raw);

    // Read user skill SKILL.md from workspace
    let user_skill_path = Path::new(&workspace_path)
        .join(&skill_name)
        .join("SKILL.md");
    let user_skill_raw = std::fs::read_to_string(&user_skill_path).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to read user skill SKILL.md at {:?}: {}",
            user_skill_path,
            e
        );
        format!("Failed to read skill '{}' content: {}", skill_name, e)
    })?;
    let user_skill_body = strip_frontmatter(&user_skill_raw);

    // Build CLAUDE.md content for baseline (skill-test only)
    let baseline_claude_md = format!(
        "# Test Workspace\n\n## Skill Context\n\n{}",
        skill_test_body
    );

    // Build CLAUDE.md content for with-skill (skill-test + user skill)
    let with_skill_claude_md = format!(
        "# Test Workspace\n\n## Skill Context\n\n{}\n\n---\n\n## Active Skill: {}\n\n{}",
        skill_test_body, skill_name, user_skill_body
    );

    // Create baseline_cwd
    let baseline_dir = tmp_parent.join("baseline");
    let baseline_claude_dir = baseline_dir.join(".claude");
    std::fs::create_dir_all(&baseline_claude_dir).map_err(|e| {
        log::error!("[prepare_skill_test] Failed to create baseline dir: {}", e);
        format!("Failed to create baseline workspace: {}", e)
    })?;
    std::fs::write(baseline_claude_dir.join("CLAUDE.md"), &baseline_claude_md).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to write baseline CLAUDE.md: {}",
            e
        );
        format!("Failed to write baseline CLAUDE.md: {}", e)
    })?;

    // Create with_skill_cwd
    let with_skill_dir = tmp_parent.join("with-skill");
    let with_skill_claude_dir = with_skill_dir.join(".claude");
    std::fs::create_dir_all(&with_skill_claude_dir).map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to create with-skill dir: {}",
            e
        );
        format!("Failed to create with-skill workspace: {}", e)
    })?;
    std::fs::write(
        with_skill_claude_dir.join("CLAUDE.md"),
        &with_skill_claude_md,
    )
    .map_err(|e| {
        log::error!(
            "[prepare_skill_test] Failed to write with-skill CLAUDE.md: {}",
            e
        );
        format!("Failed to write with-skill CLAUDE.md: {}", e)
    })?;

    // Build transcript log dir in the skill's standard log location
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
    fn test_strip_frontmatter_with_frontmatter() {
        let content = "---\nname: test\ndescription: foo\n---\n\n## Body\n\nHello world";
        let result = strip_frontmatter(content);
        assert!(!result.contains("name: test"));
        assert!(result.contains("## Body"));
        assert!(result.contains("Hello world"));
    }

    #[test]
    fn test_strip_frontmatter_no_frontmatter() {
        let content = "## Body\n\nHello world";
        let result = strip_frontmatter(content);
        assert_eq!(result, content);
    }

    #[test]
    fn test_cleanup_nonexistent_is_ok() {
        // Cleaning up a non-existent test should succeed silently
        cleanup_skill_test("nonexistent-id".to_string()).unwrap();
    }
}
