#!/usr/bin/env bash
# test-plugin.sh — Full E2E workflow test for the skill-builder plugin (T5)
#
# T1-T4 are Vitest tests in app/plugin-tests/ — run with:
#   cd app && npm run test:plugin         # all T1-T4
#   cd app && npm run test:plugin:t1      # structural only (free)
#
# Usage:
#   ./scripts/test-plugin.sh              # Run T5 full E2E workflow
#   ./scripts/test-plugin.sh --list       # List available options
#
# Environment variables:
#   PLUGIN_DIR          Override plugin directory (default: script's parent)
#   MAX_BUDGET_T5       Max USD for T5 E2E test (default: 5.00)
#   CLAUDE_BIN          Path to claude binary (default: claude)
#   KEEP_TEMP           Set to 1 to keep temp directories after run
#   VERBOSE             Set to 1 for verbose output
#   FOREGROUND          Set to 1 to stream T5 Claude output live (default: background + polling)

set -o pipefail

# ---------- Resolve paths ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="${PLUGIN_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
TESTS_DIR="$SCRIPT_DIR/plugin-tests"

# ---------- Source shared library ----------
source "$TESTS_DIR/lib.sh"

# ---------- Configuration ----------
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
MAX_BUDGET_T5="${MAX_BUDGET_T5:-5.00}"
KEEP_TEMP="${KEEP_TEMP:-0}"
VERBOSE="${VERBOSE:-0}"

export PLUGIN_DIR CLAUDE_BIN TESTS_DIR
export MAX_BUDGET_T5 KEEP_TEMP VERBOSE

# ---------- Parse arguments ----------
if [ "${1:-}" = "--list" ]; then
  echo "T5: Full E2E Workflow (~\$5.00)"
  echo ""
  echo "Usage: $0 [--list]"
  echo ""
  echo "Environment variables:"
  echo "  MAX_BUDGET_T5   Spending cap in USD (default: 5.00)"
  echo "  FOREGROUND=1    Stream Claude output live instead of polling"
  echo "  KEEP_TEMP=1     Keep temp workspace after run"
  echo "  VERBOSE=1       Verbose output"
  echo ""
  echo "T1-T4 are Vitest tests — run with: cd app && npm run test:plugin"
  exit 0
fi

# ---------- Preflight checks ----------
echo "============================================"
echo " Skill Builder Plugin Test — T5 Full E2E"
echo "============================================"
echo "  Plugin dir:  $PLUGIN_DIR"
echo "  Claude bin:  $CLAUDE_BIN"
echo "  Budget:      \$$MAX_BUDGET_T5"
echo "  Timestamp:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  echo "FATAL: '$CLAUDE_BIN' not found in PATH"
  exit 1
fi

if [ ! -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ]; then
  echo "FATAL: No plugin.json at $PLUGIN_DIR/.claude-plugin/plugin.json"
  exit 1
fi

# ---------- Run T5 ----------
init_results

echo ""
echo "--------------------------------------------"
echo " t5: Full E2E Workflow"
echo "--------------------------------------------"

source "$TESTS_DIR/t5-e2e-workflow.sh"
run_t5

# ---------- Summary ----------
print_summary
exit "$(get_exit_code)"
