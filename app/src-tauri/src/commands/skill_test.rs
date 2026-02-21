use std::path::Path;

/// Prepare a temp workspace for the "without skill" baseline agent.
///
/// Creates a temp directory with an empty `.claude/CLAUDE.md` so the agent
/// runs with no skill context. Returns the test_id (UUID) and the baseline
/// cwd path.
#[tauri::command]
pub fn prepare_skill_test(workspace_path: String, skill_name: String) -> Result<PrepareResult, String> {
    let test_id = uuid::Uuid::new_v4().to_string();
    let tmp_root = std::env::temp_dir().join(format!("skill-builder-test-{}", test_id));

    // Create empty .claude/CLAUDE.md in the temp workspace
    let claude_dir = tmp_root.join(".claude");
    std::fs::create_dir_all(&claude_dir).map_err(|e| {
        log::error!("[prepare_skill_test] Failed to create temp dir: {}", e);
        format!("Failed to create temp workspace: {}", e)
    })?;
    std::fs::write(claude_dir.join("CLAUDE.md"), "").map_err(|e| {
        log::error!("[prepare_skill_test] Failed to write empty CLAUDE.md: {}", e);
        format!("Failed to write CLAUDE.md: {}", e)
    })?;

    // Build the transcript log directory so callers can direct transcripts
    // to the skill's standard log location regardless of the agent's cwd.
    let transcript_log_dir = Path::new(&workspace_path)
        .join(&skill_name)
        .join("logs")
        .to_string_lossy()
        .to_string();

    let baseline_cwd = tmp_root.to_string_lossy().to_string();
    log::info!(
        "[prepare_skill_test] test_id={} skill={} baseline_cwd={}",
        test_id, skill_name, baseline_cwd
    );

    Ok(PrepareResult {
        test_id,
        baseline_cwd,
        transcript_log_dir,
    })
}

/// Clean up the temp workspace created by `prepare_skill_test`.
#[tauri::command]
pub fn cleanup_skill_test(test_id: String) -> Result<(), String> {
    let tmp_root = std::env::temp_dir().join(format!("skill-builder-test-{}", test_id));
    if tmp_root.exists() {
        std::fs::remove_dir_all(&tmp_root).map_err(|e| {
            log::warn!("[cleanup_skill_test] Failed to remove temp dir: {}", e);
            format!("Failed to clean up temp workspace: {}", e)
        })?;
        log::info!("[cleanup_skill_test] test_id={} cleaned up", test_id);
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct PrepareResult {
    pub test_id: String,
    pub baseline_cwd: String,
    pub transcript_log_dir: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prepare_and_cleanup() {
        let result = prepare_skill_test(
            "/tmp/test-workspace".to_string(),
            "my-skill".to_string(),
        )
        .unwrap();

        // Verify temp dir was created
        let tmp_root = std::env::temp_dir().join(format!("skill-builder-test-{}", result.test_id));
        assert!(tmp_root.exists());
        assert!(tmp_root.join(".claude").join("CLAUDE.md").exists());

        // Verify empty CLAUDE.md
        let content = std::fs::read_to_string(tmp_root.join(".claude").join("CLAUDE.md")).unwrap();
        assert!(content.is_empty());

        // Verify transcript_log_dir
        assert!(result.transcript_log_dir.contains("my-skill"));
        assert!(result.transcript_log_dir.ends_with("logs"));

        // Clean up
        cleanup_skill_test(result.test_id.clone()).unwrap();
        assert!(!tmp_root.exists());
    }

    #[test]
    fn test_cleanup_nonexistent_is_ok() {
        // Cleaning up a non-existent test should succeed silently
        cleanup_skill_test("nonexistent-id".to_string()).unwrap();
    }
}
