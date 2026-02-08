use crate::markdown::clarification::{
    self, ClarificationFile,
};
use std::fs;

#[tauri::command]
pub fn parse_clarifications(file_path: String) -> Result<ClarificationFile, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(clarification::parse_clarification_file(&content))
}

#[tauri::command]
pub fn save_clarification_answers(
    file_path: String,
    file: ClarificationFile,
) -> Result<(), String> {
    let content = clarification::serialize_clarification_file(&file);
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_raw_file(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}
