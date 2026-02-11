use crate::agents::sidecar_pool::SidecarPool;

#[tauri::command]
pub async fn has_running_agents(
    pool: tauri::State<'_, SidecarPool>,
) -> Result<bool, String> {
    Ok(pool.has_running().await)
}
