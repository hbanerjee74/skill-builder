use crate::agents::sidecar_pool::SidecarPool;

#[tauri::command]
pub async fn cleanup_skill_sidecar(
    skill_name: String,
    pool: tauri::State<'_, SidecarPool>,
) -> Result<(), String> {
    pool.shutdown_skill(&skill_name).await
}
