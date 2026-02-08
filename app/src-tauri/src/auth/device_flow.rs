use crate::types::{DeviceFlowPollResult, DeviceFlowResponse, GitHubUser};
use thiserror::Error;

const GITHUB_CLIENT_ID: &str = "REPLACE_WITH_OAUTH_APP_CLIENT_ID";

#[derive(Debug, Error)]
pub enum DeviceFlowError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("GitHub API error: {0}")]
    Api(String),
}

pub async fn start_device_flow(client_id: &str) -> Result<DeviceFlowResponse, DeviceFlowError> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id), ("scope", "repo")])
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(DeviceFlowError::Api(text));
    }

    let flow: DeviceFlowResponse = resp.json().await?;
    Ok(flow)
}

pub async fn poll_for_token(
    client_id: &str,
    device_code: &str,
) -> Result<DeviceFlowPollResult, DeviceFlowError> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(DeviceFlowError::Api(text));
    }

    let body: serde_json::Value = resp.json().await?;

    if let Some(token) = body.get("access_token").and_then(|v| v.as_str()) {
        return Ok(DeviceFlowPollResult {
            status: "complete".to_string(),
            token: Some(token.to_string()),
            error: None,
        });
    }

    if let Some(err) = body.get("error").and_then(|v| v.as_str()) {
        match err {
            "authorization_pending" | "slow_down" => {
                return Ok(DeviceFlowPollResult {
                    status: "pending".to_string(),
                    token: None,
                    error: None,
                });
            }
            "expired_token" => {
                return Ok(DeviceFlowPollResult {
                    status: "expired".to_string(),
                    token: None,
                    error: Some("Device code expired".to_string()),
                });
            }
            _ => {
                let desc = body
                    .get("error_description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(err);
                return Ok(DeviceFlowPollResult {
                    status: "error".to_string(),
                    token: None,
                    error: Some(desc.to_string()),
                });
            }
        }
    }

    Ok(DeviceFlowPollResult {
        status: "error".to_string(),
        token: None,
        error: Some("Unexpected response format".to_string()),
    })
}

pub async fn fetch_github_user(token: &str) -> Result<GitHubUser, DeviceFlowError> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "skill-builder-desktop")
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(DeviceFlowError::Api(text));
    }

    let user: GitHubUser = resp.json().await?;
    Ok(user)
}

pub fn get_client_id() -> &'static str {
    GITHUB_CLIENT_ID
}
