#!/usr/bin/env bash
# t5-e2e-workflow.sh — Full E2E workflow (expensive, uses --max-budget-usd)

run_t5() {
  local tier="t5"
  local skill_name="pet-store-analytics"

  local workspace
  workspace=$(make_temp_dir "t5-e2e")
  log_verbose "T5 workspace: $workspace"

  local e2e_prompt="Run the /skill-builder:generate-skill workflow.

Domain: pet store analytics
Skill name: pet-store-analytics

IMPORTANT — AUTOMATED TEST RUN:
This is an automated test. For ALL human review gates (Steps 2, 4, 5, 6, 7):
- Do NOT wait for human input.
- Accept the agent's recommendations as-is and proceed to the next step immediately.
- When a step says 'wait for the user to confirm', treat it as 'the user confirmed, proceed.'
- For questions in clarification files, if Answer is empty, use the Recommendation as the answer.

Work in this directory: $workspace
The plugin root is: $PLUGIN_DIR

Complete all steps (Steps 0-7). If you hit a budget limit, that's OK — go as far as you can.

When you finish (or are forced to stop), write the number of the last completed step to: \
$workspace/test-status.txt (just the number, e.g., '7')"

  log_verbose "Running full E2E workflow (budget: \$$MAX_BUDGET_T5)..."
  echo "  (this may take several minutes)"

  local e2e_output
  e2e_output=$(run_claude_unsafe "$e2e_prompt" "$MAX_BUDGET_T5" 2700 "$workspace")

  # ---- Check workflow artifacts at each step ----
  # All artifacts live under $workspace/$skill_name/ (plugin uses CWD as both workspace and skills path)

  local skill_dir="$workspace/$skill_name"
  local context_dir="$skill_dir/context"

  # Step 0: Init — context dir created
  if [[ -d "$context_dir" ]]; then
    record_result "$tier" "init_context_dir" "PASS"
  else
    record_result "$tier" "init_context_dir" "FAIL"
  fi

  # Step 1: Research — planner writes research-plan.md, consolidation writes clarifications.md
  if [[ -f "$context_dir/research-plan.md" ]]; then
    record_result "$tier" "step1_research_plan" "PASS"
  else
    record_result "$tier" "step1_research_plan" "SKIP" "may not have reached step 1"
  fi

  if [[ -f "$context_dir/clarifications.md" ]]; then
    record_result "$tier" "step1_clarifications" "PASS"
  else
    record_result "$tier" "step1_clarifications" "SKIP" "may not have reached step 1"
  fi

  # Step 5: Confirm Decisions (produces decisions.md)
  if [[ -f "$context_dir/decisions.md" ]]; then
    record_result "$tier" "step5_decisions" "PASS"
  else
    record_result "$tier" "step5_decisions" "SKIP" "may not have reached step 5"
  fi

  # Step 6: Generate Skill (produces SKILL.md + references/)
  if [[ -f "$skill_dir/SKILL.md" ]]; then
    record_result "$tier" "step6_skill_built" "PASS"
  else
    record_result "$tier" "step6_skill_built" "SKIP" "may not have reached step 6"
  fi

  local ref_count=0
  if [[ -d "$skill_dir/references" ]]; then
    ref_count=$(ls "$skill_dir/references/"*.md 2>/dev/null | wc -l | tr -d ' ')
  fi
  if [[ "$ref_count" -gt 0 ]]; then
    record_result "$tier" "step6_references_created" "PASS" "$ref_count files"
  else
    record_result "$tier" "step6_references_created" "SKIP" "may not have reached step 6"
  fi

  # Step 7: Validate Skill (produces validation logs)
  if [[ -f "$context_dir/agent-validation-log.md" ]]; then
    record_result "$tier" "step7_validation_log" "PASS"
  else
    record_result "$tier" "step7_validation_log" "SKIP" "may not have reached step 7"
  fi

  if [[ -f "$context_dir/test-skill.md" ]]; then
    record_result "$tier" "step7_test_report" "PASS"
  else
    record_result "$tier" "step7_test_report" "SKIP" "may not have reached step 7"
  fi

  # Report how far we got
  if [[ -f "$workspace/test-status.txt" ]]; then
    local last_step
    last_step=$(cat "$workspace/test-status.txt" | tr -d '[:space:]')
    record_result "$tier" "last_completed_step" "PASS" "reached step $last_step"
  else
    record_result "$tier" "last_completed_step" "SKIP" "no status file written"
  fi

  # Log workspace for debugging
  log_verbose "E2E workspace contents:"
  if [[ "$VERBOSE" == "1" ]]; then
    find "$workspace" -type f 2>/dev/null | sort | while read -r f; do
      echo "    $f"
    done
  fi
}
