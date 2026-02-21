#!/usr/bin/env bash
# t3-mode-detection.sh — State detection and intent dispatch tests

run_t3() {
  local tier="t3"
  source "$TESTS_DIR/fixtures.sh"

  local skill_name="pet-store-analytics"
  local budget="${MAX_BUDGET_T3:-0.25}"

  # ---- T3.1–T3.7: State detection ----
  # Ask the coordinator to identify its current phase via process_question intent.
  # "what" triggers process_question → coordinator answers inline without spawning agents.

  _t3_detect_state() {
    local test_name="$1" dir="$2" expected_phase="$3"
    local output
    output=$(run_claude_unsafe \
      "What is the current phase of this skill session? Answer with just the phase name." \
      "$budget" 60 "$dir")
    if [[ -z "$output" ]]; then
      record_result "$tier" "$test_name" "FAIL" "empty output"
    elif echo "$output" | grep -qi "$expected_phase"; then
      record_result "$tier" "$test_name" "PASS"
    else
      record_result "$tier" "$test_name" "FAIL" "expected phase '$expected_phase' not found"
      log_verbose "$test_name output: ${output:0:300}"
    fi
  }

  # Phase detection tests: fixture_func | test_name | log_label | expected_phase
  local phases="fresh scoping research clarification refinement_pending refinement decisions generation validation"
  for phase in $phases; do
    local dir
    dir=$(make_temp_dir "t3-${phase}")
    "create_fixture_${phase}" "$dir" "$skill_name"
    log_verbose "T3 ${phase} workspace: $dir"
    _t3_detect_state "state_${phase}_detected" "$dir" "$phase"
  done

  # ---- T3.8–T3.10: Intent dispatch tests ----
  # Each test creates a fixture, sends a prompt, and checks output for expected keywords.

  _t3_dispatch_test() {
    local test_name="$1" dir="$2" prompt="$3" pattern="$4" label="$5"
    local output
    output=$(run_claude_unsafe "$prompt" "$budget" 60 "$dir")
    if [[ -z "$output" ]]; then
      record_result "$tier" "$test_name" "FAIL" "empty output"
    elif echo "$output" | grep -qiE "$pattern"; then
      record_result "$tier" "$test_name" "PASS"
    else
      record_result "$tier" "$test_name" "FAIL" "output lacks $label keywords"
      log_verbose "$test_name output: ${output:0:300}"
    fi
  }

  # T3.8: fresh + new_skill → enters scoping
  # "build" / "create" / "I need a skill" triggers new_skill intent → scoping phase
  local dir_new
  dir_new=$(make_temp_dir "t3-new-skill")
  create_fixture_fresh "$dir_new"
  log_verbose "T3.8 new_skill dispatch workspace: $dir_new"
  _t3_dispatch_test "dispatch_new_skill_enters_scoping" "$dir_new" \
    "I want to build a domain skill for pet store analytics." \
    "skill.type|domain|confirm|scoping|great|pet.store|analytics" \
    "scoping"

  # T3.9: any + start_fresh → offers reset
  # "start over" triggers start_fresh intent → coordinator offers to clear session
  local dir_sf
  dir_sf=$(make_temp_dir "t3-start-fresh")
  create_fixture_clarification "$dir_sf" "$skill_name"
  log_verbose "T3.9 start_fresh dispatch workspace: $dir_sf"
  _t3_dispatch_test "dispatch_start_fresh_resets" "$dir_sf" \
    "start over" \
    "start.fresh|reset|start.over|fresh.start|new.session|clear|scoping|confirm" \
    "reset"

  # T3.10: fresh + express → skips research
  # "express" triggers express intent → no clarification questions asked
  local dir_express
  dir_express=$(make_temp_dir "t3-express")
  create_fixture_fresh "$dir_express"
  log_verbose "T3.10 express dispatch workspace: $dir_express"
  _t3_dispatch_test "dispatch_express_skips_research" "$dir_express" \
    "express mode: build a skill for pet store analytics" \
    "express|skip|decision|generat|straight|fast" \
    "express/skip"
}
