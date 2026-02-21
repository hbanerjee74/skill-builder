use crate::cleanup::cleanup_future_steps;
use crate::fs_validation::{detect_furthest_step, has_skill_output};
use crate::types::ReconciliationResult;
use std::collections::HashSet;
use std::path::Path;

/// Core reconciliation logic. Compares DB state with filesystem state and resolves
/// discrepancies. Called on startup before the dashboard loads.
///
/// Design principles:
/// - The DB is the source of truth for skill existence.
/// - `workspace/skill-name/` is transient scratch space. If it is missing for a
///   created skill, recreate it — never auto-delete a DB record because the
///   workspace dir is absent.
/// - Marketplace skills (`source='marketplace'`) live in `skills_path` (not the workspace
///   scratch dir). The DB is authoritative for them — skip file reconciliation entirely.
///
/// Scenarios:
/// 1. Disk dir exists, no DB record  -> create DB record conservatively
/// 2. DB step ahead of disk          -> reset to latest safe step + notification
/// 3. DB record, workspace missing   -> recreate workspace dir (transient)
/// 4. Normal case                    -> reconcile step state
pub fn reconcile_on_startup(
    conn: &rusqlite::Connection,
    workspace_path: &str,
    skills_path: Option<&str>,
) -> Result<ReconciliationResult, String> {
    let mut notifications = Vec::new();
    let auto_cleaned: u32 = 0;

    // Collect all DB workflow runs
    let db_runs = crate::db::list_all_workflow_runs(conn)?;
    let mut db_names: HashSet<String> = db_runs.iter().map(|r| r.skill_name.clone()).collect();

    log::info!(
        "[reconcile_on_startup] starting: {} DB runs, workspace={}",
        db_runs.len(),
        workspace_path
    );

    // Collect skill directories on disk (for scenario 1 — disk-only discovery)
    let workspace = Path::new(workspace_path);
    let mut disk_dirs: HashSet<String> = HashSet::new();
    if workspace.exists() {
        if let Ok(entries) = std::fs::read_dir(workspace) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip dotfiles/infrastructure directories (.claude, etc.)
                if name.starts_with('.') {
                    continue;
                }
                disk_dirs.insert(name);
            }
        }
    }

    log::debug!(
        "[reconcile_on_startup] disk dirs found: {:?}",
        disk_dirs
    );

    // Process each DB record
    for run in &db_runs {
        // Skip skills that have an active session with a live PID — another
        // instance owns this skill's workflow state. Dead PIDs were already
        // cleaned up by reconcile_orphaned_sessions() which runs before us.
        if crate::db::has_active_session_with_live_pid(conn, &run.skill_name) {
            log::debug!(
                "[reconcile] '{}': skipping — active session with live PID",
                run.skill_name
            );
            notifications.push(format!(
                "'{}' skipped — active session running in another instance",
                run.skill_name
            ));
            continue;
        }

        // Marketplace skills live in skills_path (permanent output dir), not in
        // the workspace scratch dir. The DB record is authoritative — skip file reconciliation.
        if run.source == "marketplace" {
            log::debug!(
                "[reconcile] '{}': marketplace skill, skipping file reconciliation",
                run.skill_name
            );
            continue;
        }

        // For created skills, workspace/skill-name is transient scratch space.
        // If it is missing, recreate it — do not treat absence as a reason to
        // delete the DB record.
        let skill_dir = Path::new(workspace_path).join(&run.skill_name);
        if !skill_dir.exists() {
            let context_dir = skill_dir.join("context");
            match std::fs::create_dir_all(&context_dir) {
                Ok(()) => log::info!(
                    "[reconcile] '{}': recreated missing workspace dir (transient scratch space)",
                    run.skill_name
                ),
                Err(e) => log::warn!(
                    "[reconcile] '{}': failed to recreate workspace dir '{}': {}",
                    run.skill_name,
                    skill_dir.display(),
                    e
                ),
            }
        }

        log::debug!(
            "[reconcile] '{}': db_step={}, db_status={}",
            run.skill_name, run.current_step, run.status
        );

        // Reconcile DB step state against disk evidence
        let maybe_disk_step = detect_furthest_step(workspace_path, &run.skill_name, skills_path);

        log::debug!(
            "[reconcile] '{}': disk furthest step = {:?}",
            run.skill_name, maybe_disk_step
        );

        if let Some(disk_step) = maybe_disk_step.map(|s| s as i32) {
            // current_step semantics: "the step you're on / about to run".
            // After step N completes, current_step = N+1. detect_furthest_step
            // returns N (the last step with output files). So current_step being
            // disk_step + 1 is the normal state after step N completes.
            //
            // Additionally, current_step can be disk_step + 2 when the step after
            // the last agent step is a human review (1, 3) that
            // auto-advances without producing files.
            //
            // Count how many non-detectable (file-less) steps sit between disk_step
            // and current_step. If the gap is fully explained by normal progression
            // plus non-detectable steps, the DB state is valid.
            let mut did_reset = false;
            if run.current_step > disk_step {
                let gap = run.current_step - disk_step;
                // Step 2 (detailed research) edits clarifications.md in-place,
                // producing no unique artifact — treat it as non-detectable.
                let non_detectable_in_gap = ((disk_step + 1)..run.current_step)
                    .filter(|s| matches!(s, 1 | 2 | 3 | 7))
                    .count() as i32;
                // gap of 1 is always normal (step completed -> advanced to next).
                // Each non-detectable step in the range accounts for one more.
                let should_reset = gap > 1 + non_detectable_in_gap;

                log::debug!(
                    "[reconcile] '{}': db_step={} > disk_step={}, gap={}, non_detectable_in_gap={}, should_reset={}",
                    run.skill_name, run.current_step, disk_step, gap, non_detectable_in_gap, should_reset
                );

                if should_reset {
                    // DB genuinely ahead of disk — reset
                    log::info!(
                        "[reconcile] '{}': resetting from step {} to {} (disk gap {} > 1+{} non-detectable)",
                        run.skill_name, run.current_step, disk_step, gap, non_detectable_in_gap
                    );
                    crate::db::save_workflow_run(
                        conn,
                        &run.skill_name,
                        &run.domain,
                        disk_step,
                        "pending",
                        &run.skill_type,
                    )?;
                    crate::db::reset_workflow_steps_from(conn, &run.skill_name, disk_step)?;
                    did_reset = true;
                    notifications.push(format!(
                        "'{}' was reset from step {} to step {} (disk state behind DB)",
                        run.skill_name, run.current_step, disk_step
                    ));
                }
            } else if disk_step > run.current_step {
                // Disk is ahead of DB — advance current_step to match.
                // The reset dialog always deletes both files and DB step
                // records when navigating back, so disk ahead always means
                // the DB is stale (never intentional navigation).
                log::info!(
                    "[reconcile] '{}': advancing from step {} to {} (disk ahead of DB)",
                    run.skill_name, run.current_step, disk_step
                );
                crate::db::save_workflow_run(
                    conn,
                    &run.skill_name,
                    &run.domain,
                    disk_step,
                    "pending",
                    &run.skill_type,
                )?;
                notifications.push(format!(
                    "'{}' was advanced from step {} to step {} (disk state ahead of DB)",
                    run.skill_name, run.current_step, disk_step
                ));
            }

            // Mark steps with output on disk as completed.
            for s in 0..=disk_step {
                crate::db::save_workflow_step(conn, &run.skill_name, s, "completed")?;
            }
            // If we didn't reset and current_step > disk_step, the steps between
            // disk_step+1 and current_step-1 are non-detectable — mark them too.
            // After a reset, these steps are no longer valid so we skip this.
            if !did_reset && run.current_step > disk_step + 1 {
                for s in (disk_step + 1)..run.current_step {
                    if matches!(s, 1 | 2 | 3 | 7) {
                        crate::db::save_workflow_step(conn, &run.skill_name, s, "completed")?;
                    }
                }
            }

            // If disk evidence shows the full workflow completed (step 5 =
            // generate has output), mark the run as "completed". This fixes a
            // race where the frontend debounced save fires before the final
            // step status is computed, leaving status = "pending" despite all
            // steps being done.
            const LAST_WORKFLOW_STEP: i32 = 5;
            if disk_step >= LAST_WORKFLOW_STEP && run.status != "completed" {
                log::info!(
                    "[reconcile] '{}': disk step {} >= last step, updating run status to 'completed'",
                    run.skill_name, disk_step
                );
                let effective_step = std::cmp::max(disk_step, run.current_step);
                crate::db::save_workflow_run(
                    conn,
                    &run.skill_name,
                    &run.domain,
                    effective_step,
                    "completed",
                    &run.skill_type,
                )?;
            }

            // Defensive: clean up any files from steps beyond the reconciled point.
            cleanup_future_steps(workspace_path, &run.skill_name, disk_step, skills_path);
        } else if run.current_step > 0 {
            // No output files on disk but DB thinks we're past step 0.
            // Reset to step 0 pending — all work was lost.
            log::info!(
                "[reconcile] '{}': resetting from step {} to 0 (workspace dir exists but no output files found)",
                run.skill_name, run.current_step
            );
            crate::db::save_workflow_run(
                conn,
                &run.skill_name,
                &run.domain,
                0,
                "pending",
                &run.skill_type,
            )?;
            crate::db::reset_workflow_steps_from(conn, &run.skill_name, 0)?;
            // Defensive: clean up any lingering files from all steps
            cleanup_future_steps(workspace_path, &run.skill_name, -1, skills_path);
            notifications.push(format!(
                "'{}' was reset from step {} to step 0 (no output files found)",
                run.skill_name, run.current_step
            ));
        }
        // else: no output files and DB at step 0 — fresh skill, no action needed

        // Warn if a completed skill is missing its skills_path output
        if run.status == "completed" {
            if !has_skill_output(&run.skill_name, skills_path) {
                if skills_path.is_some() {
                    log::warn!(
                        "[reconcile] '{}': completed skill has no output in skills_path — may have been moved or deleted",
                        run.skill_name
                    );
                }
            }
        }
    }

    // Scenario 1: Disk dirs with no DB record — create records conservatively
    for name in &disk_dirs {
        if !db_names.contains(name) {
            let disk_step_opt = detect_furthest_step(workspace_path, name, skills_path);
            let disk_step = disk_step_opt.map(|s| s as i32).unwrap_or(0);
            log::info!(
                "[reconcile] '{}': discovered on disk with no DB record, furthest step={:?}",
                name, disk_step_opt
            );
            let domain = read_domain_from_disk(workspace_path, name);
            crate::db::save_workflow_run(
                conn,
                name,
                &domain,
                disk_step,
                "pending",
                "domain", // conservative default
            )?;
            // Mark completed steps only if output files were detected
            if let Some(furthest) = disk_step_opt {
                for step_id in 0..=(furthest as i32) {
                    crate::db::save_workflow_step(conn, name, step_id, "completed")?;
                }
            }
            notifications.push(format!(
                "'{}' was discovered on disk at step {} and added to the database",
                name, disk_step
            ));
            db_names.insert(name.clone());
        }
    }

    log::info!(
        "[reconcile_on_startup] done: {} auto-cleaned, {} notifications",
        auto_cleaned, notifications.len()
    );

    Ok(ReconciliationResult {
        orphans: Vec::new(),
        notifications,
        auto_cleaned,
    })
}

/// Return a default domain for disk-only skills that have no DB record.
/// Previously this read from workflow.md, but that file no longer exists —
/// the DB is the single source of truth for domain metadata.
pub fn read_domain_from_disk(_workspace_path: &str, _skill_name: &str) -> String {
    "unknown".to_string()
}

/// Resolve an orphan skill. Called from the frontend after the user makes a decision.
///
/// - "delete": Removes DB record and deletes skill output files from disk.
/// - "keep": Resets the DB workflow to step 0, status "pending", preserves output files.
pub fn resolve_orphan(
    conn: &rusqlite::Connection,
    skill_name: &str,
    action: &str,
    skills_path: Option<&str>,
) -> Result<(), String> {
    match action {
        "delete" => {
            // Delete DB record (handles missing records gracefully)
            crate::db::delete_workflow_run(conn, skill_name)?;

            // Delete skill output directory on disk if it exists
            if let Some(sp) = skills_path {
                let output_dir = Path::new(sp).join(skill_name);
                if output_dir.exists() {
                    std::fs::remove_dir_all(&output_dir)
                        .map_err(|e| format!("Failed to delete skill output for '{}': {}", skill_name, e))?;
                }
            }
            Ok(())
        }
        "keep" => {
            // Reset workflow to step 0, pending — preserve skill output files
            if let Some(run) = crate::db::get_workflow_run(conn, skill_name)? {
                crate::db::save_workflow_run(
                    conn,
                    skill_name,
                    &run.domain,
                    0,
                    "pending",
                    &run.skill_type,
                )?;
                crate::db::reset_workflow_steps_from(conn, skill_name, 0)?;
            }
            Ok(())
        }
        _ => Err(format!("Invalid orphan resolution action: '{}'. Expected 'delete' or 'keep'.", action)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::test_utils::create_test_db;
    use crate::commands::workflow::get_step_output_files;
    use std::path::Path;

    /// Create a skill working directory on disk with a context/ dir.
    fn create_skill_dir(workspace: &Path, name: &str, _domain: &str) {
        let skill_dir = workspace.join(name);
        std::fs::create_dir_all(skill_dir.join("context")).unwrap();
    }

    /// Create step output files on disk for the given step.
    fn create_step_output(workspace: &Path, name: &str, step_id: u32) {
        let skill_dir = workspace.join(name);
        std::fs::create_dir_all(skill_dir.join("context")).unwrap();
        for file in get_step_output_files(step_id) {
            let path = skill_dir.join(file);
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }
            std::fs::write(&path, format!("# Step {} output", step_id)).unwrap();
        }
    }

    // --- Scenario 1: Working dir exists, no DB record ---

    #[test]
    fn test_scenario_1_disk_only_no_db_record() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // Create a skill on disk with step 0 output
        // (Step 2 is non-detectable — it edits clarifications.md in-place)
        create_skill_dir(tmp.path(), "orphan-skill", "e-commerce");
        create_step_output(tmp.path(), "orphan-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("orphan-skill"));
        assert!(result.notifications[0].contains("step 0"));

        // Verify DB record was created (domain defaults to "unknown" for disk-only discoveries)
        let run = crate::db::get_workflow_run(&conn, "orphan-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 0);
        assert_eq!(run.status, "pending");
        assert_eq!(run.domain, "unknown");
    }

    // --- Scenario 2: DB step ahead of disk ---

    #[test]
    fn test_scenario_2_db_ahead_of_disk() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // DB says step 5, but disk only has step 0 output
        // (Step 2 is non-detectable — it edits clarifications.md in-place)
        crate::db::save_workflow_run(&conn, "my-skill", "sales", 5, "in_progress", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "my-skill", "sales");
        create_step_output(tmp.path(), "my-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("reset from step 5 to step 0"));

        // Verify DB was corrected
        let run = crate::db::get_workflow_run(&conn, "my-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 0);
        assert_eq!(run.status, "pending");
    }

    // --- Status completion fix: all steps done but status stuck on "pending" ---

    #[test]
    fn test_reconcile_sets_completed_when_all_steps_done() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // DB says step 5 (last step), status "pending" — simulates the race where
        // the frontend debounced save never sent "completed"
        crate::db::save_workflow_run(&conn, "done-skill", "sales", 5, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "done-skill", "sales");
        // Create output for all detectable steps (0, 4, 5)
        for step in [0, 4, 5] {
            create_step_output(tmp.path(), "done-skill", step);
        }

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert!(result.notifications.is_empty());

        // Status should now be "completed"
        let run = crate::db::get_workflow_run(&conn, "done-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.status, "completed");
    }

    #[test]
    fn test_reconcile_leaves_pending_when_not_all_steps_done() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // DB at step 4, status "pending" — not yet at the last step
        crate::db::save_workflow_run(&conn, "mid-skill", "sales", 4, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "mid-skill", "sales");
        create_step_output(tmp.path(), "mid-skill", 0);
        create_step_output(tmp.path(), "mid-skill", 4);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        let run = crate::db::get_workflow_run(&conn, "mid-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.status, "pending");
    }

    // --- Marketplace skills are never touched by file reconciliation ---

    #[test]
    fn test_marketplace_skill_preserved_with_no_workspace_dir() {
        // Marketplace skills have no workspace dir — previously this triggered
        // auto-clean (scenario 4). Now they must be left untouched.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_marketplace_skill_run(&conn, "my-skill", "sales", "platform").unwrap();

        // No workspace dir, no skills_path output — simulates the normal state
        // for a marketplace-imported skill.
        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert!(result.notifications.is_empty());

        // DB record must still exist unchanged
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.source, "marketplace");
        assert_eq!(run.current_step, 5);
        assert_eq!(run.status, "completed");
    }

    // --- Missing workspace dir is recreated, not treated as stale ---

    #[test]
    fn test_missing_workspace_dir_is_recreated() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // DB record exists at step 0 but workspace dir was deleted
        crate::db::save_workflow_run(&conn, "my-skill", "sales", 0, "pending", "domain").unwrap();
        // No workspace dir on disk

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        // No notification — just silently recreated the transient dir

        // DB record must still exist
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 0);

        // Workspace dir should have been recreated
        assert!(tmp.path().join("my-skill").join("context").exists());
    }

    // --- Normal case ---

    #[test]
    fn test_scenario_5_normal_db_and_disk_agree() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // DB at step 2, disk has step 0 and 2 output
        crate::db::save_workflow_run(
            &conn,
            "healthy-skill",
            "analytics",
            2,
            "in_progress",
            "domain",
        )
        .unwrap();
        create_skill_dir(tmp.path(), "healthy-skill", "analytics");
        create_step_output(tmp.path(), "healthy-skill", 0);
        create_step_output(tmp.path(), "healthy-skill", 2);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert!(result.notifications.is_empty());

        // DB should be unchanged
        let run = crate::db::get_workflow_run(&conn, "healthy-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 2);
    }

    #[test]
    fn test_fresh_skill_step_0_not_falsely_completed() {
        // Fresh skill: working dir exists but no output files.
        // Step 0 must NOT be marked as completed.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "fresh-skill", "sales", 0, "pending", "domain")
            .unwrap();
        // Only create the working directory — no output files
        std::fs::create_dir_all(tmp.path().join("fresh-skill")).unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // No notifications — fresh skill, no action needed
        assert!(result.notifications.is_empty());

        // Step 0 should still be absent from steps table (not falsely completed)
        let steps = crate::db::get_workflow_steps(&conn, "fresh-skill").unwrap();
        assert!(
            steps.is_empty() || steps.iter().all(|s| s.status != "completed"),
            "Step 0 should not be marked completed for a fresh skill with no output"
        );
    }

    #[test]
    fn test_db_ahead_no_output_resets_to_zero() {
        // DB says step 4 but no output files exist at all.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "lost-skill", "sales", 4, "pending", "domain")
            .unwrap();
        std::fs::create_dir_all(tmp.path().join("lost-skill")).unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("reset from step 4 to step 0"));

        let run = crate::db::get_workflow_run(&conn, "lost-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 0);

        // No steps should be marked completed
        let steps = crate::db::get_workflow_steps(&conn, "lost-skill").unwrap();
        assert!(
            steps.is_empty() || steps.iter().all(|s| s.status != "completed"),
            "No steps should be completed when there are no output files"
        );
    }

    #[test]
    fn test_reset_does_not_mark_non_detectable_steps_completed() {
        // Bug: DB at step 5, disk at step 0. After reset to step 0, the
        // non-detectable step loop was still marking steps 1,2,3 as completed
        // using the original current_step (5) instead of the reset target (0).
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "sales", 5, "pending", "domain").unwrap();
        // Mark steps 0-4 as completed in DB (pre-existing state)
        for s in 0..=4 {
            crate::db::save_workflow_step(&conn, "my-skill", s, "completed").unwrap();
        }
        create_skill_dir(tmp.path(), "my-skill", "sales");
        // Only step 0 has output on disk
        create_step_output(tmp.path(), "my-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.notifications[0].contains("reset from step 5 to step 0"));
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 0);

        // Only step 0 should be completed — steps 1,2,3 must NOT be re-marked
        let steps = crate::db::get_workflow_steps(&conn, "my-skill").unwrap();
        for step in &steps {
            if step.step_id == 0 {
                assert_eq!(step.status, "completed", "Step 0 should be completed (has output)");
            } else {
                assert_ne!(
                    step.status, "completed",
                    "Step {} should NOT be completed after reset",
                    step.step_id
                );
            }
        }
    }

    // --- Non-detectable step tests ---

    #[test]
    fn test_step_6_not_reset_when_step_5_output_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "done-skill", "analytics", 6, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "done-skill", "analytics");
        for step in [0, 2, 4, 5] {
            create_step_output(tmp.path(), "done-skill", step);
        }

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // Should NOT reset — step 6 is non-detectable but step 5 output exists
        assert!(result.notifications.is_empty());
        let run = crate::db::get_workflow_run(&conn, "done-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 6);
    }

    #[test]
    fn test_step_6_reset_when_step_5_output_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "bad-skill", "analytics", 6, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "bad-skill", "analytics");
        // Only steps 0-4 have output, step 5 is missing
        for step in [0, 2, 4] {
            create_step_output(tmp.path(), "bad-skill", step);
        }

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // Should reset — disk is genuinely behind
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("reset from step 6 to step 4"));
        let run = crate::db::get_workflow_run(&conn, "bad-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 4);
    }

    #[test]
    fn test_step_1_not_reset_when_step_0_output_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "review-skill", "sales", 1, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "review-skill", "sales");
        create_step_output(tmp.path(), "review-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.notifications.is_empty());
        let run = crate::db::get_workflow_run(&conn, "review-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 1);
    }

    #[test]
    fn test_step_3_not_reset_when_step_2_output_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "review-skill", "sales", 3, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "review-skill", "sales");
        create_step_output(tmp.path(), "review-skill", 0);
        create_step_output(tmp.path(), "review-skill", 2);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.notifications.is_empty());
        let run = crate::db::get_workflow_run(&conn, "review-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 3);
    }

    // --- Normal progression tests (current_step = disk_step + 1) ---

    #[test]
    fn test_step_completed_advances_to_next_not_reset() {
        for (db_step, disk_steps) in [
            (1, vec![0]),             // step 0 completed -> on step 1
            (3, vec![0, 2]),          // step 2 completed -> on step 3
            (5, vec![0, 2, 4]),       // step 4 completed -> on step 5
            (6, vec![0, 2, 4, 5]),    // step 5 completed -> on step 6 (beyond last step)
        ] {
            let tmp = tempfile::tempdir().unwrap();
            let workspace = tmp.path().to_str().unwrap();
            let conn = create_test_db();

            crate::db::save_workflow_run(&conn, "my-skill", "sales", db_step, "pending", "domain")
                .unwrap();
            create_skill_dir(tmp.path(), "my-skill", "sales");
            for step in &disk_steps {
                create_step_output(tmp.path(), "my-skill", *step);
            }

            let result = reconcile_on_startup(&conn, workspace, None).unwrap();

            assert!(
                result.notifications.is_empty(),
                "DB at step {}, disk through step {:?}: should NOT reset but got: {:?}",
                db_step, disk_steps.last(), result.notifications
            );
            let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
            assert_eq!(run.current_step, db_step, "current_step should remain {}", db_step);
        }
    }

    #[test]
    fn test_step_2_on_db_but_step_0_on_disk_with_human_review() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "sales", 2, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "my-skill", "sales");
        create_step_output(tmp.path(), "my-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.notifications.is_empty());
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 2);
    }

    #[test]
    fn test_step_4_on_db_but_step_2_on_disk_with_human_review() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "sales", 4, "pending", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "my-skill", "sales");
        create_step_output(tmp.path(), "my-skill", 0);
        create_step_output(tmp.path(), "my-skill", 2);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.notifications.is_empty());
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 4);
    }

    // --- Disk ahead ---

    #[test]
    fn test_disk_ahead_stale_db_advances_current_step() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "sales", 0, "pending", "domain").unwrap();
        create_skill_dir(tmp.path(), "my-skill", "sales");
        for step in [0, 2, 4, 5] {
            create_step_output(tmp.path(), "my-skill", step);
        }

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("advanced from step 0 to step 5"));
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 5);
    }

    // --- Edge cases ---

    #[test]
    fn test_reconcile_empty_workspace() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert!(result.notifications.is_empty());
        assert_eq!(result.auto_cleaned, 0);
    }

    #[test]
    fn test_reconcile_mixed_scenarios() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let skills_tmp = tempfile::tempdir().unwrap();
        let skills_path = skills_tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // Scenario 1: Skill exists in skills_path but no DB record
        create_skill_dir(skills_tmp.path(), "disk-only", "domain-a");
        create_step_output(skills_tmp.path(), "disk-only", 0);

        // Previously scenario 4 (stale): now the workspace dir is simply
        // recreated because DB is source of truth. auto_cleaned stays 0.
        crate::db::save_workflow_run(&conn, "db-only", "domain-b", 0, "pending", "domain")
            .unwrap();

        // Scenario 5: Normal — skill in skills_path with matching DB record
        crate::db::save_workflow_run(&conn, "normal", "domain-c", 0, "pending", "domain").unwrap();
        create_skill_dir(skills_tmp.path(), "normal", "domain-c");
        create_step_output(skills_tmp.path(), "normal", 0);

        let result = reconcile_on_startup(&conn, workspace, Some(skills_path)).unwrap();

        // db-only skill is NOT auto-cleaned; auto_cleaned stays 0
        assert_eq!(result.auto_cleaned, 0);
        assert_eq!(result.notifications.len(), 1); // disk-only discovery
        assert!(result.notifications[0].contains("disk-only"));
        assert!(result.orphans.is_empty());

        // db-only skill's workspace dir should have been recreated
        assert!(tmp.path().join("db-only").join("context").exists());

        // DB record for db-only should still be present
        assert!(crate::db::get_workflow_run(&conn, "db-only").unwrap().is_some());
    }

    #[test]
    fn test_reconcile_skips_infrastructure_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // Create dotfile/infrastructure directories that should be skipped
        std::fs::create_dir_all(tmp.path().join(".claude")).unwrap();
        std::fs::create_dir_all(tmp.path().join(".hidden")).unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert!(result.notifications.is_empty());
        assert_eq!(result.auto_cleaned, 0);
    }

    // --- active session guard tests ---

    #[test]
    fn test_reconcile_skips_skill_with_active_session_from_current_pid() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        create_skill_dir(tmp.path(), "active-skill", "test");
        crate::db::save_workflow_run(&conn, "active-skill", "test", 5, "pending", "domain")
            .unwrap();
        create_step_output(tmp.path(), "active-skill", 0);

        let current_pid = std::process::id();
        crate::db::create_workflow_session(&conn, "sess-active", "active-skill", current_pid)
            .unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("skipped"));
        assert!(result.notifications[0].contains("active session"));
        let run = crate::db::get_workflow_run(&conn, "active-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 5, "Step should remain at 5 (untouched)");
    }

    #[test]
    fn test_reconcile_processes_skill_with_dead_session() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        create_skill_dir(tmp.path(), "crashed-skill", "test");
        crate::db::save_workflow_run(&conn, "crashed-skill", "test", 5, "pending", "domain")
            .unwrap();
        create_step_output(tmp.path(), "crashed-skill", 0);

        crate::db::create_workflow_session(&conn, "sess-dead", "crashed-skill", 999999).unwrap();
        crate::db::reconcile_orphaned_sessions(&conn).unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("reset from step 5 to step 0"));
        let run = crate::db::get_workflow_run(&conn, "crashed-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 0);
    }

    #[test]
    fn test_reconcile_cleans_future_step_files() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        create_skill_dir(tmp.path(), "my-skill", "test");
        create_step_output(tmp.path(), "my-skill", 0);
        crate::db::save_workflow_run(&conn, "my-skill", "test", 5, "pending", "domain").unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 0, "should reconcile to step 0");
        assert!(!result.notifications.is_empty());
    }

    // --- read_domain_from_disk tests ---

    #[test]
    fn test_read_domain_from_disk_always_returns_unknown() {
        let tmp = tempfile::tempdir().unwrap();
        create_skill_dir(tmp.path(), "my-skill", "e-commerce analytics");
        let domain = read_domain_from_disk(tmp.path().to_str().unwrap(), "my-skill");
        assert_eq!(domain, "unknown");
    }

    #[test]
    fn test_read_domain_from_disk_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let domain = read_domain_from_disk(tmp.path().to_str().unwrap(), "nonexistent");
        assert_eq!(domain, "unknown");
    }

    // --- resolve_orphan tests ---

    #[test]
    fn test_resolve_orphan_delete() {
        let tmp = tempfile::tempdir().unwrap();
        let skills_path = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "orphan", "test", 7, "completed", "domain").unwrap();
        let output_dir = tmp.path().join("orphan");
        std::fs::create_dir_all(output_dir.join("references")).unwrap();
        std::fs::write(output_dir.join("SKILL.md"), "# Skill").unwrap();

        resolve_orphan(&conn, "orphan", "delete", Some(skills_path)).unwrap();

        assert!(crate::db::get_workflow_run(&conn, "orphan")
            .unwrap()
            .is_none());
        assert!(!output_dir.exists());
    }

    #[test]
    fn test_resolve_orphan_keep() {
        let tmp = tempfile::tempdir().unwrap();
        let skills_path = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "orphan", "test", 7, "completed", "domain").unwrap();
        let output_dir = tmp.path().join("orphan");
        std::fs::create_dir_all(&output_dir).unwrap();
        std::fs::write(output_dir.join("SKILL.md"), "# Skill").unwrap();

        resolve_orphan(&conn, "orphan", "keep", Some(skills_path)).unwrap();

        let run = crate::db::get_workflow_run(&conn, "orphan")
            .unwrap()
            .unwrap();
        assert_eq!(run.current_step, 0);
        assert_eq!(run.status, "pending");
        assert!(output_dir.join("SKILL.md").exists());
    }

    #[test]
    fn test_resolve_orphan_delete_already_gone() {
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "orphan", "test", 5, "completed", "domain").unwrap();

        resolve_orphan(&conn, "orphan", "delete", Some("/nonexistent/path")).unwrap();
        assert!(crate::db::get_workflow_run(&conn, "orphan")
            .unwrap()
            .is_none());
    }

    #[test]
    fn test_resolve_orphan_invalid_action() {
        let conn = create_test_db();
        crate::db::save_workflow_run(&conn, "orphan", "test", 5, "completed", "domain").unwrap();

        let result = resolve_orphan(&conn, "orphan", "invalid", None);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Invalid orphan resolution action"));
    }

    #[test]
    fn test_resolve_orphan_delete_no_skills_path() {
        let conn = create_test_db();
        crate::db::save_workflow_run(&conn, "orphan", "test", 5, "completed", "domain").unwrap();

        resolve_orphan(&conn, "orphan", "delete", None).unwrap();
        assert!(crate::db::get_workflow_run(&conn, "orphan")
            .unwrap()
            .is_none());
    }

    // --- skills_path drives discovery ---

    #[test]
    fn test_workspace_only_folder_not_adopted_when_skills_path_set() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let skills = tmp.path().join("skills");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&skills).unwrap();

        let workspace_str = workspace.to_str().unwrap();
        let skills_str = skills.to_str().unwrap();
        let conn = create_test_db();

        // Create a folder in workspace (.vibedata) but NOT in skills_path
        std::fs::create_dir_all(workspace.join("stale-skill").join("context")).unwrap();

        // Reconcile with skills_path set — should NOT adopt the workspace-only folder
        let result = reconcile_on_startup(&conn, workspace_str, Some(skills_str)).unwrap();

        assert!(result.orphans.is_empty());
        assert!(result.notifications.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        // No DB record should have been created
        assert!(crate::db::get_workflow_run(&conn, "stale-skill")
            .unwrap()
            .is_none());
    }

    #[test]
    fn test_skills_path_folder_adopted_even_without_workspace_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let skills = tmp.path().join("skills");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&skills).unwrap();

        let workspace_str = workspace.to_str().unwrap();
        let skills_str = skills.to_str().unwrap();
        let conn = create_test_db();

        // Create a folder in skills_path but NOT in workspace
        std::fs::create_dir_all(skills.join("real-skill").join("context")).unwrap();
        // Create step 0 output in skills_path
        create_step_output(&skills, "real-skill", 0);

        // Reconcile — should adopt the skills_path folder
        let result = reconcile_on_startup(&conn, workspace_str, Some(skills_str)).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("real-skill"));

        // DB record should have been created
        let run = crate::db::get_workflow_run(&conn, "real-skill")
            .unwrap()
            .unwrap();
        assert_eq!(run.status, "pending");
    }

    // =========================================================================
    // HIGH PRIORITY — data integrity and UI correctness
    // =========================================================================

    #[test]
    fn test_disk_ahead_advances_db_with_old_steps() {
        // DB is at step 0, but disk has output through step 5 → DB should advance.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "sales", 0, "pending", "domain").unwrap();
        crate::db::save_workflow_step(&conn, "my-skill", 0, "completed").unwrap();

        create_skill_dir(tmp.path(), "my-skill", "sales");
        create_step_output(tmp.path(), "my-skill", 0);
        create_step_output(tmp.path(), "my-skill", 4);
        create_step_output(tmp.path(), "my-skill", 5);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("advanced from step 0 to step 5"));

        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 5);
        assert_eq!(run.status, "completed"); // step 5 = last step → completed
    }

    #[test]
    fn test_partial_output_stops_detection_and_cleans_up() {
        // Step 0 has partial output (only 1 of 2 files) → detection returns None.
        // Step 0 expects: context/research-plan.md + context/clarifications.md
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "test", 5, "in_progress", "domain")
            .unwrap();

        create_skill_dir(tmp.path(), "my-skill", "test");

        // Create only ONE of step 0's two expected files (partial output)
        let partial_file = tmp.path().join("my-skill").join("context").join("research-plan.md");
        std::fs::write(&partial_file, "# Partial step 0").unwrap();

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // detect_furthest_step sees partial step 0 → cleans up → returns None
        // DB had step 5 → reset to step 0 (no output found)
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.current_step, 0);
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("reset from step 5 to step 0"));

        // Partial step 0 file should have been cleaned up
        assert!(!partial_file.exists(), "partial output should be cleaned up");
    }

    #[test]
    fn test_reconcile_full_with_fallback_to_workspace_path() {
        // skills_path is None → entire system falls back to workspace_path.
        // Skill folder in workspace with step 0+4 output → should reconcile correctly.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "test", 3, "in_progress", "domain")
            .unwrap();

        create_skill_dir(tmp.path(), "my-skill", "test");
        create_step_output(tmp.path(), "my-skill", 0);
        create_step_output(tmp.path(), "my-skill", 4);

        // skills_path = None → fallback to workspace
        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);

        // DB should be reconciled: disk has step 4, DB had step 3.
        // Step 3 is non-detectable, gap of 1 between disk_step=4 and current_step=3
        // is actually disk ahead → advance to step 4.
        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert!(run.current_step >= 3);
    }

    #[test]
    fn test_reconcile_when_workspace_and_skills_paths_identical() {
        // Common config where workspace_path == skills_path (same directory).
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        crate::db::save_workflow_run(&conn, "my-skill", "test", 5, "completed", "domain")
            .unwrap();

        create_skill_dir(tmp.path(), "my-skill", "test");
        create_step_output(tmp.path(), "my-skill", 0);
        create_step_output(tmp.path(), "my-skill", 4);
        create_step_output(tmp.path(), "my-skill", 5);

        // workspace = skills_path = same directory
        let result = reconcile_on_startup(&conn, path, Some(path)).unwrap();

        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);

        let run = crate::db::get_workflow_run(&conn, "my-skill").unwrap().unwrap();
        assert_eq!(run.status, "completed");
    }

    #[test]
    fn test_cleanup_future_steps_with_negative_step() {
        // cleanup_future_steps called with after_step=-1 should clean ALL step files.
        // This is the code path taken when no output files are found (line 195).
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();

        create_skill_dir(tmp.path(), "my-skill", "test");
        create_step_output(tmp.path(), "my-skill", 0);
        create_step_output(tmp.path(), "my-skill", 4);
        create_step_output(tmp.path(), "my-skill", 5);

        crate::cleanup::cleanup_future_steps(workspace, "my-skill", -1, None);

        // All step output should be deleted
        let skill_dir = tmp.path().join("my-skill");
        // Step 0 files (research-plan.md, clarifications.md in context/)
        let step0_file = skill_dir.join("context").join("research-plan.md");
        assert!(!step0_file.exists(), "step 0 output should be cleaned");
        // Step 5 file
        let skill_md = skill_dir.join("SKILL.md");
        assert!(!skill_md.exists(), "step 5 output should be cleaned");
    }

    #[test]
    fn test_stale_db_auto_cleaned_when_skills_path_has_no_match() {
        // DB record exists but skill folder is only in workspace, not skills_path.
        // With skills_path as driver, the skill is not found in disk_dirs →
        // has_skill_output also false → auto-clean (Scenario 4).
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let skills = tmp.path().join("skills");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&skills).unwrap();

        let workspace_str = workspace.to_str().unwrap();
        let skills_str = skills.to_str().unwrap();
        let conn = create_test_db();

        // DB record + workspace folder, but nothing in skills_path
        crate::db::save_workflow_run(&conn, "old-skill", "test", 2, "in_progress", "domain")
            .unwrap();
        create_skill_dir(&workspace, "old-skill", "test");

        let result = reconcile_on_startup(&conn, workspace_str, Some(skills_str)).unwrap();

        assert_eq!(result.auto_cleaned, 1);
        assert!(result.orphans.is_empty());
        assert!(crate::db::get_workflow_run(&conn, "old-skill")
            .unwrap()
            .is_none());
    }

    // =========================================================================
    // MEDIUM PRIORITY — edge cases that could confuse users
    // =========================================================================

    #[test]
    fn test_reconcile_detects_multiple_orphans() {
        // Three skills with output in skills_path but no working dir.
        // After the driver change, these skills ARE in disk_dirs (from skills_path)
        // and have skill output → they reconcile normally, not as orphans.
        // (Orphans only happen when a skill is NOT in disk_dirs but HAS output.)
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let skills = tmp.path().join("skills");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&skills).unwrap();

        let workspace_str = workspace.to_str().unwrap();
        let skills_str = skills.to_str().unwrap();
        let conn = create_test_db();

        for name in &["skill-a", "skill-b", "skill-c"] {
            crate::db::save_workflow_run(&conn, name, "test", 5, "completed", "domain")
                .unwrap();
            let output_dir = skills.join(name);
            std::fs::create_dir_all(output_dir.join("references")).unwrap();
            std::fs::write(output_dir.join("SKILL.md"), "# Skill").unwrap();
        }

        let result = reconcile_on_startup(&conn, workspace_str, Some(skills_str)).unwrap();

        // All three are in skills_path (the driver) → they're in disk_dirs → normal reconciliation
        assert!(result.orphans.is_empty());
        assert_eq!(result.auto_cleaned, 0);

        // All DB records should still exist
        for name in &["skill-a", "skill-b", "skill-c"] {
            assert!(crate::db::get_workflow_run(&conn, name).unwrap().is_some());
        }
    }

    #[test]
    fn test_disk_discovery_uses_unknown_domain() {
        // Disk-only skill gets domain="unknown" as the conservative default.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        create_skill_dir(tmp.path(), "new-skill", "anything");
        // No step output — just a directory

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("new-skill"));

        let run = crate::db::get_workflow_run(&conn, "new-skill").unwrap().unwrap();
        assert_eq!(run.domain, "unknown");
        assert_eq!(run.skill_type, "domain"); // conservative default
        assert_eq!(run.current_step, 0);
        assert_eq!(run.status, "pending");
    }

    #[test]
    fn test_reconcile_skips_only_protected_skill() {
        // Skill A has an active session (protected). Skill B needs a reset.
        // Reconciliation should skip A but still process B.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // Skill A: active session with current PID
        crate::db::save_workflow_run(&conn, "protected", "test", 3, "in_progress", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "protected", "test");
        let pid = std::process::id();
        let session_id = uuid::Uuid::new_v4().to_string();
        crate::db::create_workflow_session(&conn, &session_id, "protected", pid).unwrap();

        // Skill B: DB at step 5, disk at step 0 → needs reset
        crate::db::save_workflow_run(&conn, "reset-me", "test", 5, "in_progress", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "reset-me", "test");
        create_step_output(tmp.path(), "reset-me", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // A was skipped (notification says so), B was reset
        assert!(result.notifications.iter().any(|n| n.contains("protected") && n.contains("skipped")));
        assert!(result.notifications.iter().any(|n| n.contains("reset-me") && n.contains("reset from step 5")));

        // A's DB state should be unchanged
        let run_a = crate::db::get_workflow_run(&conn, "protected").unwrap().unwrap();
        assert_eq!(run_a.current_step, 3);
        assert_eq!(run_a.status, "in_progress");

        // B should be reset
        let run_b = crate::db::get_workflow_run(&conn, "reset-me").unwrap().unwrap();
        assert_eq!(run_b.current_step, 0);
    }

    #[test]
    fn test_notification_messages_exact_text() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().to_str().unwrap();
        let conn = create_test_db();

        // Case 1: DB ahead of disk → reset notification
        crate::db::save_workflow_run(&conn, "ahead-skill", "test", 5, "in_progress", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "ahead-skill", "test");
        create_step_output(tmp.path(), "ahead-skill", 0);

        // Case 2: No output but DB past step 0 → reset to step 0
        crate::db::save_workflow_run(&conn, "empty-skill", "test", 3, "in_progress", "domain")
            .unwrap();
        create_skill_dir(tmp.path(), "empty-skill", "test");

        // Case 3: Disk-only discovery
        create_skill_dir(tmp.path(), "found-skill", "test");
        create_step_output(tmp.path(), "found-skill", 0);

        let result = reconcile_on_startup(&conn, workspace, None).unwrap();

        // Verify exact message formats
        assert!(result.notifications.iter().any(|n|
            n == "'ahead-skill' was reset from step 5 to step 0 (disk state behind DB)"));
        assert!(result.notifications.iter().any(|n|
            n == "'empty-skill' was reset from step 3 to step 0 (no output files found)"));
        assert!(result.notifications.iter().any(|n|
            n == "'found-skill' was discovered on disk at step 0 and added to the database"));
    }

    // =========================================================================
    // LOW PRIORITY — defensive, locking down current behavior
    // =========================================================================

    #[test]
    fn test_reconcile_ignores_dot_dirs_in_skills_path() {
        // Ensure .git, .github, .DS_Store etc. in skills_path are not adopted.
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let skills = tmp.path().join("skills");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::create_dir_all(&skills).unwrap();

        let workspace_str = workspace.to_str().unwrap();
        let skills_str = skills.to_str().unwrap();
        let conn = create_test_db();

        // Infrastructure dirs in skills_path
        std::fs::create_dir_all(skills.join(".git")).unwrap();
        std::fs::create_dir_all(skills.join(".github")).unwrap();
        std::fs::create_dir_all(skills.join(".skill-builder")).unwrap();
        // One real skill
        create_skill_dir(&skills, "real-skill", "test");
        create_step_output(&skills, "real-skill", 0);

        let result = reconcile_on_startup(&conn, workspace_str, Some(skills_str)).unwrap();

        // Only real-skill should be discovered
        assert_eq!(result.notifications.len(), 1);
        assert!(result.notifications[0].contains("real-skill"));
        assert!(crate::db::get_workflow_run(&conn, ".git").unwrap().is_none());
        assert!(crate::db::get_workflow_run(&conn, ".github").unwrap().is_none());
    }
}
