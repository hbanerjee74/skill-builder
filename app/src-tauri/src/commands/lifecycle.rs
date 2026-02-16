use crate::db::Db;

/// Check if any agents are currently running for the given workflow session.
/// If no session ID is provided (app closed from outside a workflow), returns false.
#[tauri::command]
pub async fn has_running_agents(
    workflow_session_id: Option<String>,
    db: tauri::State<'_, Db>,
) -> Result<bool, String> {
    let session_id = match workflow_session_id {
        Some(id) => id,
        None => {
            log::debug!("close-guard: has_running_agents called with no session, returning false");
            return Ok(false);
        }
    };

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agent_runs
             WHERE status = 'running'
               AND workflow_session_id = ?1",
            rusqlite::params![session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let running = count > 0;
    log::debug!("close-guard: has_running_agents = {} ({} running for session {})", running, count, session_id);
    Ok(running)
}
