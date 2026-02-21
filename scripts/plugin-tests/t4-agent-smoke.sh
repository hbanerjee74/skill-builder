#!/usr/bin/env bash
# t4-agent-smoke.sh — Spawn individual agents and verify output files

run_t4() {
  local tier="t4"
  local skill_name="pet-store-analytics"
  local budget="${MAX_BUDGET_T4:-0.50}"
  source "$TESTS_DIR/fixtures.sh"

  local workspace_context
  workspace_context=$(< "$PLUGIN_DIR/skills/generate-skill/references/workspace-context.md")

  # ---- T4.1: research-orchestrator → creates clarifications.md ----
  local research_dir
  research_dir=$(make_temp_dir "t4-research-orch")
  create_fixture_t4_research "$research_dir" "$skill_name"
  log_verbose "T4.1 research-orchestrator workspace: $research_dir"

  local research_prompt
  research_prompt="You are the research-orchestrator agent for the skill-builder plugin.

Skill type: domain
Domain: Pet Store Analytics
Skill name: $skill_name
Context directory: $research_dir/$skill_name/context
Workspace directory: $research_dir/.vibedata/$skill_name

<agent-instructions>
$workspace_context
</agent-instructions>

Research the pet store analytics domain and generate clarification questions for a skill builder.
Write the consolidated clarification questions to: $research_dir/$skill_name/context/clarifications.md

The file must contain 5-10 questions grouped by dimension (e.g. Core Entities, Business Patterns, Data Modeling).
Each question must follow this format:
### Q<n>: <title>
<question text>
A. <option>
B. <option>
**Recommendation:** <letter>
**Answer:**

Return: path to clarifications.md and question count."

  log_verbose "Running research-orchestrator smoke test..."
  local research_output
  research_output=$(run_claude_unsafe "$research_prompt" "$budget" 180 "$research_dir")

  assert_file_exists "$tier" "research_orch_creates_clarifications" \
    "$research_dir/$skill_name/context/clarifications.md" || true

  if [[ -f "$research_dir/$skill_name/context/clarifications.md" ]]; then
    local q_count
    q_count=$(grep -c "^### Q[0-9]" "$research_dir/$skill_name/context/clarifications.md" || true)
    if [[ "$q_count" -ge 5 ]]; then
      record_result "$tier" "research_orch_min_5_questions" "PASS" "$q_count questions"
    else
      record_result "$tier" "research_orch_min_5_questions" "FAIL" "only $q_count questions (expected ≥5)"
    fi

    if grep -q "^\*\*Answer:\*\*" "$research_dir/$skill_name/context/clarifications.md"; then
      record_result "$tier" "research_orch_answer_fields_present" "PASS"
    else
      record_result "$tier" "research_orch_answer_fields_present" "FAIL" "no **Answer:** fields found"
    fi
  fi

  # ---- T4.2: answer-evaluator → creates answer-evaluation.json ----
  local eval_dir
  eval_dir=$(make_temp_dir "t4-answer-eval")
  create_fixture_t4_answer_evaluator "$eval_dir" "$skill_name"
  log_verbose "T4.2 answer-evaluator workspace: $eval_dir"

  local eval_prompt
  eval_prompt="You are the answer-evaluator agent for the skill-builder plugin.

Context directory: $eval_dir/$skill_name/context
Workspace directory: $eval_dir/.vibedata/$skill_name

<agent-instructions>
$workspace_context
</agent-instructions>

Read the clarification file at: $eval_dir/$skill_name/context/clarifications.md

Count answered vs unanswered questions (answered = **Answer:** has non-empty content after the colon).
Evaluate whether the answers are sufficient to proceed to skill generation without more research.

Write your evaluation to: $eval_dir/.vibedata/$skill_name/answer-evaluation.json

The JSON must contain exactly these fields:
{
  \"total_questions\": <number>,
  \"answered_count\": <number>,
  \"empty_count\": <number>,
  \"verdict\": \"sufficient\" | \"needs_more_research\" | \"insufficient\",
  \"reasoning\": \"<brief explanation>\"
}

Return: the evaluation JSON contents."

  log_verbose "Running answer-evaluator smoke test..."
  local eval_output
  eval_output=$(run_claude_unsafe "$eval_prompt" "$budget" 120 "$eval_dir")

  assert_file_exists "$tier" "answer_eval_creates_json" \
    "$eval_dir/.vibedata/$skill_name/answer-evaluation.json" || true

  if [[ -f "$eval_dir/.vibedata/$skill_name/answer-evaluation.json" ]]; then
    if python3 - << PYEOF 2>/dev/null
import json, sys
with open("$eval_dir/.vibedata/$skill_name/answer-evaluation.json") as f:
    d = json.load(f)
required = ["total_questions", "answered_count", "empty_count", "verdict", "reasoning"]
missing = [k for k in required if k not in d]
valid_verdicts = {"sufficient", "needs_more_research", "insufficient"}
if missing:
    sys.exit(1)
if d["verdict"] not in valid_verdicts:
    sys.exit(1)
sys.exit(0)
PYEOF
    then
      record_result "$tier" "answer_eval_json_valid" "PASS"
    else
      record_result "$tier" "answer_eval_json_valid" "FAIL" "JSON missing fields or invalid verdict"
    fi
  fi

  # ---- T4.3: confirm-decisions → creates decisions.md ----
  # Runs only if T4.2 produced answer-evaluation.json (realistic pipeline dependency)
  if [[ -f "$eval_dir/.vibedata/$skill_name/answer-evaluation.json" ]]; then
    local decisions_dir
    decisions_dir=$(make_temp_dir "t4-decisions")
    create_fixture_t4_workspace "$decisions_dir" "$skill_name"
    cp "$eval_dir/.vibedata/$skill_name/answer-evaluation.json" \
       "$decisions_dir/.vibedata/$skill_name/"
    log_verbose "T4.3 confirm-decisions workspace: $decisions_dir"

    local decisions_prompt
    decisions_prompt="You are the confirm-decisions agent for the skill-builder plugin.

Skill type: domain
Domain: Pet Store Analytics
Skill name: $skill_name
Context directory: $decisions_dir/$skill_name/context
Skill directory: $decisions_dir/$skill_name
Workspace directory: $decisions_dir/.vibedata/$skill_name

<agent-instructions>
$workspace_context
</agent-instructions>

Read the answered clarifications at: $decisions_dir/$skill_name/context/clarifications.md

Synthesize the answers into concrete design decisions for the skill.
Write your decisions to: $decisions_dir/$skill_name/context/decisions.md

Each decision must follow this format:
### D<n>: <title>
- **Question**: <the original clarification question>
- **Decision**: <the chosen answer>
- **Implication**: <what this means for the skill design>

Return: path to decisions.md and a one-line summary of key decisions."

    log_verbose "Running confirm-decisions smoke test..."
    local decisions_output
    decisions_output=$(run_claude_unsafe "$decisions_prompt" "$budget" 120 "$decisions_dir")

    assert_file_exists "$tier" "confirm_decisions_creates_decisions_md" \
      "$decisions_dir/$skill_name/context/decisions.md" || true

    if [[ -f "$decisions_dir/$skill_name/context/decisions.md" ]]; then
      local d_count
      d_count=$(grep -c "^### D[0-9]" "$decisions_dir/$skill_name/context/decisions.md" || true)
      if [[ "$d_count" -ge 3 ]]; then
        record_result "$tier" "confirm_decisions_min_3_decisions" "PASS" "$d_count decisions"
      else
        record_result "$tier" "confirm_decisions_min_3_decisions" "FAIL" "only $d_count decisions (expected ≥3)"
      fi
    fi
  else
    record_result "$tier" "confirm_decisions_creates_decisions_md" "SKIP" "depends on T4.2 answer-evaluator output"
    record_result "$tier" "confirm_decisions_min_3_decisions" "SKIP" "depends on T4.2 answer-evaluator output"
  fi
}
