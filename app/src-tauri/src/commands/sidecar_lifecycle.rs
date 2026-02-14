use crate::agents::sidecar_pool::SidecarPool;

#[tauri::command]
pub async fn cleanup_skill_sidecar(
    skill_name: String,
    pool: tauri::State<'_, SidecarPool>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    pool.shutdown_skill(&skill_name, &app_handle).await
}
