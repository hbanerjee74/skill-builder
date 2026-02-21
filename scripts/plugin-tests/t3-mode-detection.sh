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
      "What phase is this skill session currently in? Answer with just the phase name." \
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

  local dir_fresh
  dir_fresh=$(make_temp_dir "t3-fresh")
  create_fixture_fresh "$dir_fresh"
  log_verbose "T3.1 fresh workspace: $dir_fresh"
  _t3_detect_state "state_fresh_detected" "$dir_fresh" "fresh"

  local dir_scoping
  dir_scoping=$(make_temp_dir "t3-scoping")
  create_fixture_scoping "$dir_scoping" "$skill_name"
  log_verbose "T3.2 scoping workspace: $dir_scoping"
  _t3_detect_state "state_scoping_detected" "$dir_scoping" "scoping"

  local dir_research
  dir_research=$(make_temp_dir "t3-research")
  create_fixture_research "$dir_research" "$skill_name"
  log_verbose "T3.3 research workspace: $dir_research"
  _t3_detect_state "state_research_detected" "$dir_research" "research"

  local dir_clarification
  dir_clarification=$(make_temp_dir "t3-clarification")
  create_fixture_clarification "$dir_clarification" "$skill_name"
  log_verbose "T3.4 clarification workspace: $dir_clarification"
  _t3_detect_state "state_clarification_detected" "$dir_clarification" "clarification"

  local dir_decisions
  dir_decisions=$(make_temp_dir "t3-decisions")
  create_fixture_decisions "$dir_decisions" "$skill_name"
  log_verbose "T3.5 decisions workspace: $dir_decisions"
  _t3_detect_state "state_decisions_detected" "$dir_decisions" "decisions"

  local dir_generation
  dir_generation=$(make_temp_dir "t3-generation")
  create_fixture_generation "$dir_generation" "$skill_name"
  log_verbose "T3.6 generation workspace: $dir_generation"
  _t3_detect_state "state_generation_detected" "$dir_generation" "generation"

  local dir_validation
  dir_validation=$(make_temp_dir "t3-validation")
  create_fixture_validation "$dir_validation" "$skill_name"
  log_verbose "T3.7 validation workspace: $dir_validation"
  _t3_detect_state "state_validation_detected" "$dir_validation" "validation"

  # ---- T3.8: fresh + new_skill → enters scoping ----
  # "build" / "create" / "I need a skill" triggers new_skill intent → scoping phase
  local dir_new
  dir_new=$(make_temp_dir "t3-new-skill")
  create_fixture_fresh "$dir_new"
  log_verbose "T3.8 new_skill dispatch workspace: $dir_new"

  local output_new
  output_new=$(run_claude_unsafe \
    "I want to build a domain skill for pet store analytics." \
    "$budget" 60 "$dir_new")

  if [[ -z "$output_new" ]]; then
    record_result "$tier" "dispatch_new_skill_enters_scoping" "FAIL" "empty output"
  elif echo "$output_new" | grep -qiE "skill.type|domain|confirm|scoping|great|pet.store|analytics"; then
    record_result "$tier" "dispatch_new_skill_enters_scoping" "PASS"
  else
    record_result "$tier" "dispatch_new_skill_enters_scoping" "FAIL" "output lacks scoping keywords"
    log_verbose "T3.8 output: ${output_new:0:300}"
  fi

  # ---- T3.9: any + start_fresh → offers reset ----
  # "start over" triggers start_fresh intent → coordinator offers to clear session
  local dir_sf
  dir_sf=$(make_temp_dir "t3-start-fresh")
  create_fixture_clarification "$dir_sf" "$skill_name"
  log_verbose "T3.9 start_fresh dispatch workspace: $dir_sf"

  local output_sf
  output_sf=$(run_claude_unsafe \
    "start over" \
    "$budget" 60 "$dir_sf")

  if [[ -z "$output_sf" ]]; then
    record_result "$tier" "dispatch_start_fresh_resets" "FAIL" "empty output"
  elif echo "$output_sf" | grep -qiE "start.fresh|reset|start.over|fresh.start|new.session|clear|scoping|confirm"; then
    record_result "$tier" "dispatch_start_fresh_resets" "PASS"
  else
    record_result "$tier" "dispatch_start_fresh_resets" "FAIL" "output lacks reset keywords"
    log_verbose "T3.9 output: ${output_sf:0:300}"
  fi

  # ---- T3.10: fresh + express → skips research ----
  # "express" triggers express intent → no clarification questions asked
  local dir_express
  dir_express=$(make_temp_dir "t3-express")
  create_fixture_fresh "$dir_express"
  log_verbose "T3.10 express dispatch workspace: $dir_express"

  local output_express
  output_express=$(run_claude_unsafe \
    "express mode: build a skill for pet store analytics" \
    "$budget" 60 "$dir_express")

  if [[ -z "$output_express" ]]; then
    record_result "$tier" "dispatch_express_skips_research" "FAIL" "empty output"
  elif echo "$output_express" | grep -qiE "express|skip|decision|generat|straight|fast"; then
    record_result "$tier" "dispatch_express_skips_research" "PASS"
  else
    record_result "$tier" "dispatch_express_skips_research" "FAIL" "output lacks express/skip keywords"
    log_verbose "T3.10 output: ${output_express:0:300}"
  fi
}
