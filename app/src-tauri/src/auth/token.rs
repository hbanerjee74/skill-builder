use tauri_plugin_store::StoreExt;
use thiserror::Error;

const STORE_FILE: &str = "settings.json";
const TOKEN_KEY: &str = "github_token";

#[derive(Debug, Error)]
pub enum TokenError {
    #[error("Store error: {0}")]
    Store(String),
}

pub fn save_token(app: &tauri::AppHandle, token: &str) -> Result<(), TokenError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| TokenError::Store(e.to_string()))?;
    store.set(TOKEN_KEY, serde_json::json!(token));
    store.save().map_err(|e| TokenError::Store(e.to_string()))?;
    Ok(())
}

pub fn get_token(app: &tauri::AppHandle) -> Result<Option<String>, TokenError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| TokenError::Store(e.to_string()))?;
    let value = store.get(TOKEN_KEY);
    match value {
        Some(v) => Ok(v.as_str().map(|s| s.to_string())),
        None => Ok(None),
    }
}

pub fn clear_token(app: &tauri::AppHandle) -> Result<(), TokenError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| TokenError::Store(e.to_string()))?;
    store.delete(TOKEN_KEY);
    store.save().map_err(|e| TokenError::Store(e.to_string()))?;
    Ok(())
}
