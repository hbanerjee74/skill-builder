use crate::agents::sidecar_pool;
use crate::types::NodeStatus;

#[tauri::command]
pub async fn check_node(app: tauri::AppHandle) -> Result<NodeStatus, String> {
    match sidecar_pool::resolve_node_binary(&app).await {
        Ok(resolution) => {
            let meets_minimum = resolution.meets_minimum;
            let error = if !meets_minimum {
                resolution.version.as_ref().map(|v| {
                    format!(
                        "Node.js {} found ({}) but version 18-24 is required",
                        v, resolution.source
                    )
                })
            } else {
                None
            };

            Ok(NodeStatus {
                available: true,
                version: resolution.version,
                meets_minimum,
                error,
                source: resolution.source,
            })
        }
        Err(e) => Ok(NodeStatus {
            available: false,
            version: None,
            meets_minimum: false,
            error: Some(e),
            source: String::new(),
        }),
    }
}

/// Parse a version string like "v20.11.0" and check if major >= min_major.
#[cfg(test)]
fn parse_meets_minimum(version: &str, min_major: u32) -> bool {
    let trimmed = version.strip_prefix('v').unwrap_or(version);
    let parts: Vec<&str> = trimmed.split('.').collect();
    if let Some(major_str) = parts.first() {
        if let Ok(major) = major_str.parse::<u32>() {
            return major >= min_major;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_v20_meets_min_18() {
        assert!(parse_meets_minimum("v20.11.0", 18));
    }

    #[test]
    fn test_v18_meets_min_18() {
        assert!(parse_meets_minimum("v18.0.0", 18));
    }

    #[test]
    fn test_v16_does_not_meet_min_18() {
        assert!(!parse_meets_minimum("v16.0.0", 18));
    }

    #[test]
    fn test_no_v_prefix_meets_min() {
        assert!(parse_meets_minimum("20.11.0", 18));
    }

    #[test]
    fn test_empty_string() {
        assert!(!parse_meets_minimum("", 18));
    }

    #[test]
    fn test_garbage_string() {
        assert!(!parse_meets_minimum("abc", 18));
    }
}
