use serde::{Deserialize, Serialize};

const GITHUB_REPO: &str = "hbanerjee74/skill-builder";

#[derive(Debug, Deserialize)]
pub struct CreateGithubIssueRequest {
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
    pub attachments: Vec<FeedbackAttachment>,
}

#[derive(Debug, Deserialize)]
pub struct FeedbackAttachment {
    pub name: String,
    #[serde(rename = "base64Content")]
    pub base64_content: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct CreateGithubIssueResponse {
    pub url: String,
    pub number: u64,
}

/// Create a GitHub issue with optional attachments.
/// Images are uploaded via GitHub Gist API and linked in the body.
/// Small text files are included inline as code blocks.
#[tauri::command]
pub async fn create_github_issue(
    db: tauri::State<'_, crate::db::Db>,
    request: CreateGithubIssueRequest,
) -> Result<CreateGithubIssueResponse, String> {
    // 1. Get GitHub PAT from settings
    let github_pat = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = crate::db::read_settings(&conn).map_err(|e| e.to_string())?;
        settings.github_pat.ok_or_else(|| {
            "GitHub personal access token not configured. Add it in Settings.".to_string()
        })?
    };

    let client = reqwest::Client::new();

    // 2. Process attachments into markdown
    let mut attachment_markdown = String::new();
    let mut has_attachments = false;

    for att in &request.attachments {
        if att.mime_type.starts_with("image/") {
            // Upload image to a gist and link it
            match upload_to_gist(&client, &github_pat, &att.name, &att.base64_content).await {
                Ok(gist_url) => {
                    if !has_attachments {
                        attachment_markdown.push_str("\n\n## Attachments\n\n");
                        has_attachments = true;
                    }
                    attachment_markdown.push_str(&format!(
                        "**{}**: [View on Gist]({})\n\n",
                        att.name, gist_url
                    ));
                }
                Err(e) => {
                    log::warn!("Failed to upload image {}: {}", att.name, e);
                    if !has_attachments {
                        attachment_markdown.push_str("\n\n## Attachments\n\n");
                        has_attachments = true;
                    }
                    attachment_markdown
                        .push_str(&format!("- {} (upload failed: {})\n", att.name, e));
                }
            }
        } else if is_text_type(&att.mime_type) && att.size < 10240 {
            // Inline small text files as code blocks
            use base64::Engine;
            if let Ok(bytes) =
                base64::engine::general_purpose::STANDARD.decode(&att.base64_content)
            {
                if let Ok(text) = String::from_utf8(bytes) {
                    if !has_attachments {
                        attachment_markdown.push_str("\n\n## Attachments\n\n");
                        has_attachments = true;
                    }
                    attachment_markdown.push_str(&format!(
                        "<details>\n<summary>{} ({} bytes)</summary>\n\n```\n{}\n```\n\n</details>\n\n",
                        att.name, att.size, text
                    ));
                }
            }
        } else {
            // Large or binary files: mention by name
            if !has_attachments {
                attachment_markdown.push_str("\n\n## Attachments\n\n");
                has_attachments = true;
            }
            attachment_markdown.push_str(&format!("- {} ({} bytes)\n", att.name, att.size));
        }
    }

    // 3. Build full body
    let full_body = format!("{}{}", request.body, attachment_markdown);

    // 4. Ensure labels exist (create if needed, best-effort)
    for label in &request.labels {
        ensure_label(&client, &github_pat, label).await.ok();
    }

    // 5. Create the issue
    let response = client
        .post(format!(
            "https://api.github.com/repos/{}/issues",
            GITHUB_REPO
        ))
        .header("Authorization", format!("Bearer {}", github_pat))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "SkillBuilder")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({
            "title": request.title,
            "body": full_body,
            "labels": request.labels,
        }))
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {e}"))?;

    if !status.is_success() {
        let message = body["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("GitHub API error ({}): {}", status, message));
    }

    let url = body["html_url"]
        .as_str()
        .ok_or("Missing html_url in response")?
        .to_string();
    let number = body["number"]
        .as_u64()
        .ok_or("Missing number in response")?;

    Ok(CreateGithubIssueResponse { url, number })
}

/// Upload content to a GitHub Gist and return the gist HTML URL.
/// The base64 content is stored as text in the gist file.
async fn upload_to_gist(
    client: &reqwest::Client,
    pat: &str,
    filename: &str,
    base64_content: &str,
) -> Result<String, String> {
    let response = client
        .post("https://api.github.com/gists")
        .header("Authorization", format!("Bearer {}", pat))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "SkillBuilder")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({
            "description": format!("Skill Builder feedback attachment: {}", filename),
            "public": false,
            "files": {
                filename: {
                    "content": base64_content
                }
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Gist upload failed: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gist response: {e}"))?;

    if !status.is_success() {
        let msg = body["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("Gist API error ({}): {}", status, msg));
    }

    let html_url = body["html_url"]
        .as_str()
        .ok_or("Missing html_url in gist response")?
        .to_string();

    Ok(html_url)
}

/// Ensure a label exists on the repo (best-effort, 422 = already exists).
async fn ensure_label(
    client: &reqwest::Client,
    pat: &str,
    label: &str,
) -> Result<(), String> {
    let response = client
        .post(format!(
            "https://api.github.com/repos/{}/labels",
            GITHUB_REPO
        ))
        .header("Authorization", format!("Bearer {}", pat))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "SkillBuilder")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({
            "name": label,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    // 422 means label already exists — that's fine
    if status.is_success() || status == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
        Ok(())
    } else {
        Err(format!("Failed to create label: {}", status))
    }
}

fn is_text_type(mime: &str) -> bool {
    mime.starts_with("text/") || mime == "application/json"
}
