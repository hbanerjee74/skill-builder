use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkflowState {
    pub skill_name: Option<String>,
    pub domain: Option<String>,
    pub current_step: Option<String>,
    pub status: Option<String>,
    pub completed_steps: Option<String>,
    pub timestamp: Option<String>,
    pub notes: Option<String>,
}

pub fn parse_workflow_state(content: &str) -> WorkflowState {
    let mut state = WorkflowState::default();

    let re = Regex::new(r"\*\*([^*]+)\*\*:\s*(.+)").unwrap();

    for cap in re.captures_iter(content) {
        let key = cap[1].trim().to_lowercase();
        let value = cap[2].trim().to_string();

        match key.as_str() {
            "skill name" => state.skill_name = Some(value),
            "domain" => state.domain = Some(value),
            "current step" => state.current_step = Some(value),
            "status" => state.status = Some(value),
            "completed steps" => state.completed_steps = Some(value),
            "timestamp" => state.timestamp = Some(value),
            "notes" => state.notes = Some(value),
            _ => {}
        }
    }

    state
}
