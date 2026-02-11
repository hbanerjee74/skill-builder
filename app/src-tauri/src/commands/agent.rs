use crate::agents::sidecar::{self, SidecarConfig};
use crate::agents::sidecar_pool::SidecarPool;
use crate::db::Db;

#[tauri::command]
pub async fn start_agent(
    app: tauri::AppHandle,
    pool: tauri::State<'_, SidecarPool>,
    db: tauri::State<'_, Db>,
    agent_id: String,
    prompt: String,
    model: String,
    cwd: String,
    allowed_tools: Option<Vec<String>>,
    max_turns: Option<u32>,
    session_id: Option<String>,
    skill_name: String,
    _step_label: String,
    agent_name: Option<String>,
) -> Result<String, String> {
    let (api_key, extended_context) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = crate::db::read_settings(&conn)?;
        let key = settings
            .anthropic_api_key
            .ok_or_else(|| "Anthropic API key not configured".to_string())?;
        (key, settings.extended_context)
    };

    let config = SidecarConfig {
        prompt,
        model: Some(model),
        api_key,
        cwd,
        allowed_tools,
        max_turns,
        permission_mode: None,
        session_id,
        betas: if extended_context {
            Some(vec!["context-1m-2025-08-07".to_string()])
        } else {
            None
        },
        path_to_claude_code_executable: None,
        agent_name,
    };

    sidecar::spawn_sidecar(
        agent_id.clone(),
        config,
        pool.inner().clone(),
        app,
        skill_name,
    )
    .await?;

    Ok(agent_id)
}
