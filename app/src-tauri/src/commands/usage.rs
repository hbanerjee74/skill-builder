use crate::db::Db;
use crate::types::{AgentRunRecord, UsageByModel, UsageByStep, UsageSummary, WorkflowSessionRecord};

#[tauri::command]
pub fn persist_agent_run(
    db: tauri::State<'_, Db>,
    agent_id: String,
    skill_name: String,
    step_id: i32,
    model: String,
    status: String,
    input_tokens: i32,
    output_tokens: i32,
    cache_read_tokens: i32,
    cache_write_tokens: i32,
    total_cost: f64,
    duration_ms: i64,
    session_id: Option<String>,
    workflow_session_id: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::persist_agent_run(
        &conn, &agent_id, &skill_name, step_id, &model, &status,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_cost, duration_ms, session_id.as_deref(), workflow_session_id.as_deref(),
    )
}

#[tauri::command]
pub fn get_usage_summary(db: tauri::State<'_, Db>) -> Result<UsageSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_usage_summary(&conn)
}

#[tauri::command]
pub fn get_recent_runs(
    db: tauri::State<'_, Db>,
    limit: usize,
) -> Result<Vec<AgentRunRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_recent_runs(&conn, limit)
}

#[tauri::command]
pub fn get_usage_by_step(db: tauri::State<'_, Db>) -> Result<Vec<UsageByStep>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_usage_by_step(&conn)
}

#[tauri::command]
pub fn get_usage_by_model(db: tauri::State<'_, Db>) -> Result<Vec<UsageByModel>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_usage_by_model(&conn)
}

#[tauri::command]
pub fn reset_usage(db: tauri::State<'_, Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::reset_usage(&conn)
}

#[tauri::command]
pub fn get_recent_workflow_sessions(
    db: tauri::State<'_, Db>,
    limit: usize,
) -> Result<Vec<WorkflowSessionRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_recent_workflow_sessions(&conn, limit)
}

#[tauri::command]
pub fn get_session_agent_runs(
    db: tauri::State<'_, Db>,
    session_id: String,
) -> Result<Vec<AgentRunRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_session_agent_runs(&conn, &session_id)
}
