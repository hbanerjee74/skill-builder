#!/usr/bin/env bash
set -euo pipefail

# Unified test runner for the Skill Builder desktop app.
#
# Usage: ./tests/run.sh [level] [tiers...] [--tag TAG]
# Levels: unit, integration, e2e, plugin, eval, all (default: all)
# Tiers (plugin): t1 t2 t3 t4  (default: t1 t2 t3 t4; t5 is opt-in — expensive)
# Tags (E2E): @dashboard, @settings, @workflow, @workflow-agent, @navigation
# Tags (plugin): @structure, @agents, @coordinator, @workflow, @all

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
LEVEL="all"
TAG=""
PLUGIN_TIERS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    unit|integration|e2e|eval|all)
      LEVEL="$1"
      shift
      ;;
    plugin)
      LEVEL="plugin"
      shift
      # Consume optional tier arguments that follow (t1..t5)
      while [[ $# -gt 0 ]] && [[ "$1" =~ ^t[1-5]$ ]]; do
        PLUGIN_TIERS+=("$1")
        shift
      done
      ;;
    --tag)
      TAG="${2:-}"
      if [[ -z "$TAG" ]]; then
        echo -e "${RED}Error: --tag requires a value${RESET}" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./tests/run.sh [level] [tiers...] [--tag TAG]"
      echo ""
      echo "Levels:"
      echo "  unit              Pure logic: stores, utils, hooks, Rust, sidecar"
      echo "  integration       Component rendering with mocked APIs"
      echo "  e2e               Full browser tests (Playwright)"
      echo "  plugin [t1..t4]   Plugin tests — T1-T4 by default (T5 is opt-in, expensive)"
      echo "  eval              Eval harness tests (API tests run if ANTHROPIC_API_KEY set)"
      echo "  all               Run all levels sequentially (default; plugin runs T1-T4)"
      echo ""
      echo "Plugin tiers:"
      echo "  t1  Structural validation (free — no API key needed)"
      echo "  t2  Plugin loading (~\$0.30)"
      echo "  t3  State detection + intent dispatch (~\$0.40)"
      echo "  t4  Agent smoke tests (~\$0.50)"
      echo "  t5  Full E2E workflow (~\$5.00) — opt-in only, not run by default"
      echo ""
      echo "Options:"
      echo "  --tag TAG     Filter tests by tag"
      echo "    E2E tags:    @dashboard, @settings, @workflow, @workflow-agent, @navigation"
      echo "    Plugin tags: @structure, @agents, @coordinator, @workflow, @all"
      echo ""
      echo "Examples:"
      echo "  ./tests/run.sh                           # Run everything (plugin: T1-T4)"
      echo "  ./tests/run.sh unit                      # Unit tests only"
      echo "  ./tests/run.sh plugin                    # Plugin T1-T4"
      echo "  ./tests/run.sh plugin t1                 # Structural checks only (free)"
      echo "  ./tests/run.sh plugin t1 t2 t3           # T1-T3 (coordinator changes)"
      echo "  ./tests/run.sh plugin t5                 # Full E2E (explicit opt-in)"
      echo "  ./tests/run.sh plugin --tag @agents      # Plugin agent tests"
      echo "  ./tests/run.sh e2e --tag @dashboard      # Dashboard E2E tests"
      echo "  FOREGROUND=1 ./tests/run.sh plugin t5    # T5 with live output"
      exit 0
      ;;
    *)
      echo -e "${RED}Error: unknown argument '$1'${RESET}" >&2
      echo "Run './tests/run.sh --help' for usage." >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Track failures
# ---------------------------------------------------------------------------
FAILURES=()

header() {
  echo ""
  echo -e "${CYAN}${BOLD}━━━ $1 ━━━${RESET}"
  echo ""
}

pass() {
  echo -e "${GREEN}PASS${RESET} $1"
}

fail() {
  echo -e "${RED}FAIL${RESET} $1"
  FAILURES+=("$1")
}

# ---------------------------------------------------------------------------
# Level: unit
# ---------------------------------------------------------------------------
run_unit() {
  header "Unit Tests: Frontend (Vitest)"
  if (cd "$APP_DIR" && npx vitest run src/__tests__/stores/ src/__tests__/lib/ src/__tests__/hooks/); then
    pass "Frontend unit tests"
  else
    fail "Frontend unit tests"
  fi

  header "Unit Tests: Rust (cargo test)"
  if (cd "$APP_DIR" && cargo test --manifest-path src-tauri/Cargo.toml); then
    pass "Rust unit tests"
  else
    fail "Rust unit tests"
  fi

  header "Unit Tests: Sidecar (Vitest)"
  if (cd "$APP_DIR/sidecar" && npx vitest run); then
    pass "Sidecar unit tests"
  else
    fail "Sidecar unit tests"
  fi

  # Canonical format compliance is now covered by:
  # - Agent prompts: ./scripts/test-plugin.sh t1 (T1.11)
  # - Mock templates / fixtures: vitest canonical-format.test.ts (included in unit tests above)
}

# ---------------------------------------------------------------------------
# Level: integration
# ---------------------------------------------------------------------------
run_integration() {
  header "Integration Tests: Components + Pages (Vitest)"
  if (cd "$APP_DIR" && npx vitest run src/__tests__/components/ src/__tests__/pages/); then
    pass "Integration tests"
  else
    fail "Integration tests"
  fi
}

# ---------------------------------------------------------------------------
# Level: e2e
# ---------------------------------------------------------------------------
run_e2e() {
  local tag_args=()
  if [[ -n "$TAG" ]]; then
    tag_args=(--grep "$TAG")
  fi

  header "E2E Tests: Playwright${TAG:+ (tag: $TAG)}"
  if (cd "$APP_DIR" && npx playwright test "${tag_args[@]+"${tag_args[@]}"}"); then
    pass "E2E tests${TAG:+ ($TAG)}"
  else
    fail "E2E tests${TAG:+ ($TAG)}"
  fi
}

# ---------------------------------------------------------------------------
# Level: plugin
# ---------------------------------------------------------------------------
run_plugin() {
  # Default to T1-T4. T5 (full E2E, ~$5) must be requested explicitly.
  local tiers=("${PLUGIN_TIERS[@]+"${PLUGIN_TIERS[@]}"}")
  if [[ ${#tiers[@]} -eq 0 ]]; then
    tiers=(t1 t2 t3 t4)
  fi

  local tag_args=()
  if [[ -n "$TAG" ]]; then
    tag_args=(--tag "$TAG")
  fi

  local tier_label
  tier_label=$(IFS=' '; echo "${tiers[*]}")
  header "Plugin Tests (${tier_label})${TAG:+ (tag: $TAG)}"

  PLUGIN_SCRIPT="$APP_DIR/../scripts/test-plugin.sh"
  if [[ ! -x "$PLUGIN_SCRIPT" ]]; then
    fail "Plugin tests (scripts/test-plugin.sh not found)"
    return
  fi
  if ("$PLUGIN_SCRIPT" "${tiers[@]}" "${tag_args[@]+"${tag_args[@]}"}"); then
    pass "Plugin tests (${tier_label})${TAG:+ ($TAG)}"
  else
    fail "Plugin tests (${tier_label})${TAG:+ ($TAG)}"
  fi
}

# ---------------------------------------------------------------------------
# Level: eval
# ---------------------------------------------------------------------------
run_eval() {
  header "Eval Harness Tests"
  EVAL_SCRIPT="$APP_DIR/../scripts/eval/test-eval-harness.sh"
  if [[ ! -x "$EVAL_SCRIPT" ]]; then
    fail "Eval harness tests (scripts/eval/test-eval-harness.sh not found)"
    return
  fi
  if ("$EVAL_SCRIPT"); then
    pass "Eval harness tests"
  else
    fail "Eval harness tests"
  fi
}

# ---------------------------------------------------------------------------
# Run the requested level(s)
# ---------------------------------------------------------------------------
case "$LEVEL" in
  unit)
    run_unit
    ;;
  integration)
    run_integration
    ;;
  e2e)
    run_e2e
    ;;
  plugin)
    run_plugin
    ;;
  eval)
    run_eval
    ;;
  all)
    run_unit
    run_integration
    run_e2e
    run_plugin
    run_eval
    ;;
esac

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
if [[ ${#FAILURES[@]} -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All tests passed.${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}${#FAILURES[@]} test suite(s) failed:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}- $f${RESET}"
  done
  exit 1
fi
