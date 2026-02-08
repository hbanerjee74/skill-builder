use crate::auth::{device_flow, token};
use crate::types::{DeviceFlowPollResult, DeviceFlowResponse, GitHubUser};

#[tauri::command]
pub async fn start_login() -> Result<DeviceFlowResponse, String> {
    let client_id = device_flow::get_client_id();
    device_flow::start_device_flow(client_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poll_login(device_code: String) -> Result<DeviceFlowPollResult, String> {
    let client_id = device_flow::get_client_id();
    device_flow::poll_for_token(client_id, &device_code)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_user(token: String) -> Result<GitHubUser, String> {
    device_flow::fetch_github_user(&token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout(app: tauri::AppHandle) -> Result<(), String> {
    token::clear_token(&app).map_err(|e| e.to_string())
}
