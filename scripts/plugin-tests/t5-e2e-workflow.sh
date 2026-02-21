#!/usr/bin/env bash
# t5-e2e-workflow.sh — Full E2E workflow (expensive, uses --max-budget-usd)

run_t5() {
  local tier="t5"
  local skill_name="pet-store-analytics"

  local workspace
  workspace=$(make_temp_dir "t5-e2e")
  log_verbose "T5 workspace: $workspace"

  local e2e_prompt="Run the generate-skill workflow (the skill-builder plugin's main skill).

Domain: pet store analytics
Skill name: pet-store-analytics

IMPORTANT — AUTOMATED TEST RUN:
This is an automated test. At every confirmation gate or human review point,
treat the user as having confirmed and proceed immediately. Do not wait for input.
For any unanswered clarification questions, use the **Recommendation:** value as
the answer. Auto-advance through all phases.

Work in this directory: $workspace
The plugin root is: $PLUGIN_DIR

Complete all phases in order:
  Scoping → Research → Clarification → Decisions → Generation → Validation

If you hit a budget limit that's OK — go as far as you can.

When you finish (or are forced to stop), write the name of the last completed
phase to: $workspace/test-status.txt
(e.g., 'scoping', 'research', 'clarification', 'decisions', 'generation', or 'validation')"

  local log_file
  log_file=$(mktemp)
  local start_secs
  start_secs=$(date +%s)

  _t5_elapsed() { echo "$(( $(date +%s) - start_secs ))s"; }

  local claude_cmd="$CLAUDE_BIN -p --plugin-dir $PLUGIN_DIR --dangerously-skip-permissions --max-budget-usd $MAX_BUDGET_T5"

  if [[ "${FOREGROUND:-0}" == "1" ]]; then
    # Foreground mode: Claude output streams live to the terminal.
    # tee captures to log_file while writing to stdout simultaneously.
    echo "  [t5] foreground mode — budget=\$$MAX_BUDGET_T5, timeout=45min"
    (cd "$workspace" && echo "$e2e_prompt" | _timeout_cmd 2700 $claude_cmd 2>&1 | tee "$log_file") || true
    echo "  [t5] $(_t5_elapsed) — done"
  else
    # Background mode: artifact polling prints phase milestones + heartbeat every 30s.
    (cd "$workspace" && echo "$e2e_prompt" | _timeout_cmd 2700 $claude_cmd > "$log_file" 2>&1) &
    local claude_pid=$!

    echo "  [t5] started — budget=\$$MAX_BUDGET_T5, timeout=45min"

    local last_phase_shown="" last_print_secs=0
    while kill -0 "$claude_pid" 2>/dev/null; do
      sleep 5
      local now_elapsed
      now_elapsed=$(( $(date +%s) - start_secs ))

      local current_phase=""
      if   [[ -f "$context_dir/agent-validation-log.md" ]]; then current_phase="validation"
      elif [[ -f "$skill_dir/SKILL.md"                  ]]; then current_phase="generation"
      elif [[ -f "$context_dir/decisions.md"            ]]; then current_phase="decisions"
      elif [[ -f "$context_dir/clarifications.md"       ]]; then
        local answered
        answered=$(grep -c "^\*\*Answer:\*\* [A-Z]" "$context_dir/clarifications.md" 2>/dev/null || echo 0)
        [[ "$answered" -gt 0 ]] && current_phase="clarification" || current_phase="research"
      elif [[ -f "$workspace_dir/session.json"          ]]; then current_phase="scoping"
      fi

      if [[ -n "$current_phase" && "$current_phase" != "$last_phase_shown" ]]; then
        echo "  [t5] ${now_elapsed}s — reached: $current_phase"
        last_phase_shown="$current_phase"
        last_print_secs=$now_elapsed
      elif (( now_elapsed - last_print_secs >= 30 )); then
        echo "  [t5] ${now_elapsed}s — running (last: ${last_phase_shown:-waiting for scoping})"
        last_print_secs=$now_elapsed
      fi
    done

    wait "$claude_pid" || true
    echo "  [t5] $(_t5_elapsed) — done"
  fi

  local e2e_output
  e2e_output=$(cat "$log_file")
  rm -f "$log_file"

  local skill_dir="$workspace/$skill_name"
  local context_dir="$skill_dir/context"
  local workspace_dir="$workspace/.vibedata/$skill_name"

  # Records PASS if file exists, SKIP (not FAIL) if missing — E2E may not reach all phases
  _t5_assert_or_skip() {
    local name="$1" filepath="$2" skip_msg="$3"
    if [[ -f "$filepath" ]]; then
      record_result "$tier" "$name" "PASS"
      return 0
    else
      record_result "$tier" "$name" "SKIP" "$skip_msg"
      return 1
    fi
  }

  # ---- Scoping: session.json created ----
  if _t5_assert_or_skip "scoping_session_json" "$workspace_dir/session.json" "may not have reached scoping"; then
    if python3 -c "
import json, sys
d = json.load(open('$workspace_dir/session.json'))
required = ['skill_name', 'skill_type', 'domain', 'skill_dir', 'current_phase', 'mode']
missing = [k for k in required if k not in d]
sys.exit(0 if not missing else 1)
" 2>/dev/null; then
      record_result "$tier" "scoping_session_json_valid" "PASS"
    else
      record_result "$tier" "scoping_session_json_valid" "FAIL" "missing required fields"
    fi
  else
    record_result "$tier" "scoping_session_json_valid" "SKIP" "depends on scoping"
  fi

  # ---- Research: clarifications.md written ----
  if _t5_assert_or_skip "research_clarifications_md" "$context_dir/clarifications.md" "may not have reached research"; then
    local q_count
    q_count=$(grep -c "^### Q[0-9]" "$context_dir/clarifications.md" 2>/dev/null || true)
    if [[ "$q_count" -ge 5 ]]; then
      record_result "$tier" "research_min_5_questions" "PASS" "$q_count questions"
    else
      record_result "$tier" "research_min_5_questions" "FAIL" "only $q_count questions"
    fi
  else
    record_result "$tier" "research_min_5_questions" "SKIP" "depends on research"
  fi

  # ---- Decisions: decisions.md written ----
  if _t5_assert_or_skip "decisions_md" "$context_dir/decisions.md" "may not have reached decisions"; then
    local d_count
    d_count=$(grep -c "^### D[0-9]" "$context_dir/decisions.md" 2>/dev/null || true)
    if [[ "$d_count" -ge 3 ]]; then
      record_result "$tier" "decisions_min_3" "PASS" "$d_count decisions"
    else
      record_result "$tier" "decisions_min_3" "FAIL" "only $d_count decisions"
    fi
  else
    record_result "$tier" "decisions_min_3" "SKIP" "depends on decisions"
  fi

  # ---- Generation: SKILL.md + references/ written ----
  _t5_assert_or_skip "generation_skill_md" "$skill_dir/SKILL.md" "may not have reached generation"

  local ref_count=0
  if [[ -d "$skill_dir/references" ]]; then
    ref_count=$(find "$skill_dir/references" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi
  if [[ "$ref_count" -gt 0 ]]; then
    record_result "$tier" "generation_references" "PASS" "$ref_count files"
  else
    record_result "$tier" "generation_references" "SKIP" "may not have reached generation"
  fi

  # ---- Validation: validation logs written ----
  _t5_assert_or_skip "validation_log" "$context_dir/agent-validation-log.md" "may not have reached validation"
  _t5_assert_or_skip "validation_test_report" "$context_dir/test-skill.md" "may not have reached validation"
  if _t5_assert_or_skip "validation_companion_skills" "$context_dir/companion-skills.md" "may not have reached validation"; then
    if python3 -c "
import sys
content = open('$context_dir/companion-skills.md').read()
# Extract YAML frontmatter between --- delimiters
import re
m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not m:
    sys.exit(1)
import yaml
fm = yaml.safe_load(m.group(1))
required = ['skill_name', 'skill_type', 'companions']
missing = [k for k in required if k not in fm]
if missing or not isinstance(fm.get('companions'), list):
    sys.exit(1)
" 2>/dev/null; then
      record_result "$tier" "validation_companion_skills_valid" "PASS"
    else
      record_result "$tier" "validation_companion_skills_valid" "FAIL" "missing required frontmatter fields"
    fi
  else
    record_result "$tier" "validation_companion_skills_valid" "SKIP" "depends on companion-skills.md"
  fi

  # ---- Report last completed phase ----
  if [[ -f "$workspace/test-status.txt" ]]; then
    local last_phase
    last_phase=$(tr -d '[:space:]' < "$workspace/test-status.txt")
    record_result "$tier" "last_completed_phase" "PASS" "reached: $last_phase"
  else
    record_result "$tier" "last_completed_phase" "SKIP" "no status file written"
  fi

  # Log workspace for debugging
  if [[ "$VERBOSE" == "1" ]]; then
    log_verbose "E2E workspace contents:"
    find "$workspace" -type f 2>/dev/null | sort | while read -r f; do
      echo "    $f"
    done
  fi
}
