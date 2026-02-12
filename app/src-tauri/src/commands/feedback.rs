use serde::Deserialize;

/// Team and project IDs for the Vibedata / Skill Builder Linear project.
const TEAM_ID: &str = "e761b07f-f73e-4787-9c8f-93b2f341c27a";
const PROJECT_ID: &str = "4712b3e4-9833-472c-8c34-b3e88189805a";

/// Linear API key embedded at build time.  Uses `option_env!` so the crate
/// compiles even when the variable is absent; the command returns a clear
/// error at runtime instead.
const LINEAR_API_KEY: Option<&str> = option_env!("LINEAR_API_KEY");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeedbackType {
    Bug,
    Feature,
}

/// Submit a feedback item (bug report or feature request) to Linear.
///
/// The command creates a new issue in the Vibedata team with the Skill Builder
/// project and an appropriate label.  The Linear API key is baked into the
/// binary at compile time so end-users never need to supply one.
#[tauri::command]
pub async fn submit_feedback(
    feedback_type: FeedbackType,
    title: String,
    description: String,
) -> Result<String, String> {
    let api_key = LINEAR_API_KEY
        .ok_or_else(|| "Feedback submission is not configured (missing build-time API key)".to_string())?;

    if title.trim().is_empty() {
        return Err("Title is required".to_string());
    }

    // Resolve the label ID for the chosen feedback type.
    let label_name = match feedback_type {
        FeedbackType::Bug => "Bug",
        FeedbackType::Feature => "Feature",
    };

    let label_id = fetch_label_id(api_key, TEAM_ID, label_name).await?;

    // Build the issueCreate mutation.
    let mutation = serde_json::json!({
        "query": r#"
            mutation CreateIssue($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                    success
                    issue {
                        id
                        identifier
                        url
                    }
                }
            }
        "#,
        "variables": {
            "input": {
                "teamId": TEAM_ID,
                "projectId": PROJECT_ID,
                "title": title.trim(),
                "description": description.trim(),
                "labelIds": [label_id],
            }
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&mutation)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Linear response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Linear API returned {status}: {body}"));
    }

    // Check for GraphQL-level errors.
    if let Some(errors) = body.get("errors") {
        return Err(format!("Linear API error: {errors}"));
    }

    let success = body
        .pointer("/data/issueCreate/success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        return Err("Linear returned success=false".to_string());
    }

    let identifier = body
        .pointer("/data/issueCreate/issue/identifier")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    Ok(identifier.to_string())
}

/// Look up a label by name within a team and return its ID.
async fn fetch_label_id(api_key: &str, team_id: &str, label_name: &str) -> Result<String, String> {
    let query = serde_json::json!({
        "query": r#"
            query TeamLabels($teamId: String!) {
                team(id: $teamId) {
                    labels {
                        nodes {
                            id
                            name
                        }
                    }
                }
            }
        "#,
        "variables": {
            "teamId": team_id,
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&query)
        .send()
        .await
        .map_err(|e| format!("Network error fetching labels: {e}"))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse labels response: {e}"))?;

    let nodes = body
        .pointer("/data/team/labels/nodes")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Could not read team labels from Linear".to_string())?;

    for node in nodes {
        let name = node.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name == label_name {
            let id = node
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("Label '{label_name}' has no id"))?;
            return Ok(id.to_string());
        }
    }

    Err(format!("Label '{label_name}' not found in team"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feedback_type_deserializes_from_snake_case() {
        let bug: FeedbackType = serde_json::from_str(r#""bug""#).unwrap();
        assert!(matches!(bug, FeedbackType::Bug));

        let feature: FeedbackType = serde_json::from_str(r#""feature""#).unwrap();
        assert!(matches!(feature, FeedbackType::Feature));
    }
}
