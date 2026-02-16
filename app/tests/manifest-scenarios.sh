#!/usr/bin/env bash
# Scenario-based validation of TEST_MANIFEST.md.
# Verifies the manifest produces correct test selections for app-only,
# plugin-only, and cross-cutting file changes.
#
# Usage: ./tests/manifest-scenarios.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/TEST_MANIFEST.md"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo -e "  ${GREEN}PASS${RESET} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "  ${RED}FAIL${RESET} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# Check that the manifest file exists
if [[ ! -f "$MANIFEST" ]]; then
  echo -e "${RED}FATAL: Manifest not found at $MANIFEST${RESET}"
  exit 1
fi

# Assert that a source file's manifest row contains an expected value
assert_row_contains() {
  local desc="$1" source_file="$2" expected="$3"
  local row
  row=$(grep -F "$source_file" "$MANIFEST" || true)
  if [[ -z "$row" ]]; then
    fail "$desc (source '$source_file' not in manifest)"
    return
  fi
  if echo "$row" | grep -qF "$expected"; then
    pass "$desc"
  else
    fail "$desc (row for '$source_file' missing '$expected')"
  fi
}

# Assert that a pattern exists anywhere in the manifest
assert_in_manifest() {
  local desc="$1" pattern="$2"
  if grep -qF "$pattern" "$MANIFEST"; then
    pass "$desc"
  else
    fail "$desc (pattern not found: '$pattern')"
  fi
}

echo ""
echo "============================================"
echo " Manifest Scenario Validation"
echo "============================================"
echo ""

# ===== App-only: Store Changes =====

echo -e "${CYAN}${BOLD}━━━ App: Store Change ━━━${RESET}"
assert_row_contains "agent-store → unit test"         "agent-store.ts"    "agent-store.test.ts"
assert_row_contains "agent-store → E2E tag"           "agent-store.ts"    "@workflow-agent"
assert_row_contains "workflow-store → unit test"      "workflow-store.ts"  "workflow-store.test.ts"
assert_row_contains "workflow-store → E2E tag"        "workflow-store.ts"  "@workflow"
assert_row_contains "settings-store → unit test"      "settings-store.ts"  "settings-store.test.ts"
assert_row_contains "settings-store → E2E tag"        "settings-store.ts"  "@settings"
assert_row_contains "skill-store → unit test"         "skill-store.ts"     "skill-store.test.ts"
assert_row_contains "imported-skills-store → unit"    "imported-skills-store.ts" "imported-skills-store.test.ts"

# ===== App-only: Component Changes =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Component Change ━━━${RESET}"
assert_row_contains "skill-card → integration"        "skill-card.tsx"          "skill-card.test.tsx"
assert_row_contains "skill-card → E2E tag"            "skill-card.tsx"          "@dashboard"
assert_row_contains "agent-output-panel → integration" "agent-output-panel.tsx" "agent-output-panel.test.tsx"
assert_row_contains "agent-output-panel → E2E tag"    "agent-output-panel.tsx"  "@workflow-agent"
assert_row_contains "reasoning-review → integration"    "reasoning-review.tsx"      "reasoning-review.test.tsx"
assert_row_contains "reasoning-review → E2E tag"        "reasoning-review.tsx"      "@workflow"
assert_row_contains "feedback-dialog → integration"   "feedback-dialog.tsx"     "feedback-dialog.test.tsx"

# ===== App-only: Page Changes =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Page Change ━━━${RESET}"
assert_row_contains "dashboard → integration"         "pages/dashboard.tsx"     "dashboard.test.tsx"
assert_row_contains "dashboard → E2E tag"             "pages/dashboard.tsx"     "@dashboard"
assert_row_contains "workflow → integration"          "pages/workflow.tsx"      "workflow.test.tsx"
assert_row_contains "workflow → E2E tag"              "pages/workflow.tsx"      "@workflow"
assert_row_contains "settings → integration"          "pages/settings.tsx"      "settings.test.tsx"
assert_row_contains "settings → E2E tag"              "pages/settings.tsx"      "@settings"

# ===== App-only: Rust Commands =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Rust Command Change ━━━${RESET}"
assert_row_contains "workflow.rs → cargo test"        "commands/workflow.rs"    "commands::workflow"
assert_row_contains "workflow.rs → E2E tag"           "commands/workflow.rs"    "@workflow"
assert_row_contains "workspace.rs → cargo test"       "commands/workspace.rs"   "commands::workspace"
assert_row_contains "workspace.rs → E2E tag"          "commands/workspace.rs"   "@dashboard"
assert_row_contains "settings.rs → cargo test"        "commands/settings.rs"    "commands::settings"
assert_row_contains "settings.rs → E2E tag"           "commands/settings.rs"    "@settings"
assert_row_contains "skill.rs → cargo test"           "commands/skill.rs"       "commands::skill"
assert_row_contains "files.rs → cargo test"           "commands/files.rs"       "commands::files"

# ===== App-only: Hooks =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Hook Change ━━━${RESET}"
assert_row_contains "use-agent-stream → unit test"    "use-agent-stream.ts"     "use-agent-stream.test.ts"
assert_row_contains "use-agent-stream → E2E tag"      "use-agent-stream.ts"     "@workflow-agent"

# ===== App-only: Libraries =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Library Change ━━━${RESET}"
assert_row_contains "reasoning-parser → unit test"    "reasoning-parser.ts"     "reasoning-parser.test.ts"
assert_row_contains "reasoning-parser → integration"  "reasoning-parser.ts"     "reasoning-review.test.tsx"
assert_row_contains "chat-storage → unit test"        "chat-storage.ts"         "chat-storage.test.ts"
assert_row_contains "utils → unit test"               "src/lib/utils.ts"        "utils.test.ts"

# ===== App-only: Sidecar =====

echo ""
echo -e "${CYAN}${BOLD}━━━ App: Sidecar Change ━━━${RESET}"
assert_row_contains "run-agent → unit test"           "sidecar/run-agent.ts"    "run-agent.test.ts"
assert_row_contains "agent-runner → unit test"        "sidecar/agent-runner.ts" "agent-runner.test.ts"
assert_row_contains "config → unit test"              "sidecar/config.ts"       "config.test.ts"
assert_row_contains "persistent-mode → unit test"     "sidecar/persistent-mode.ts" "persistent-mode.test.ts"
assert_row_contains "options → unit test"             "sidecar/options.ts"      "options.test.ts"
assert_row_contains "shutdown → unit test"            "sidecar/shutdown.ts"     "shutdown.test.ts"

# ===== Plugin-only: Agent Prompts =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Plugin: Agent Prompt Change ━━━${RESET}"
assert_in_manifest  "CLI Plugin section exists"       "CLI Plugin"
assert_row_contains "agent files → plugin tag"        "agents/{type}/*.md"      "@agents"
assert_row_contains "agent files → tier t1"           "agents/{type}/*.md"      "t1"
assert_row_contains "agent files → tier t4"           "agents/{type}/*.md"      "t4"

# ===== Plugin-only: Shared Agents =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Plugin: Shared Agent Change ━━━${RESET}"
assert_row_contains "shared agents → plugin tag"      "agents/shared/*.md"      "@agents"
assert_row_contains "shared agents → tier t1"         "agents/shared/*.md"      "t1"
assert_row_contains "shared agents → tier t4"         "agents/shared/*.md"      "t4"

# ===== Plugin-only: Coordinator =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Plugin: Coordinator Change ━━━${RESET}"
assert_row_contains "SKILL.md → plugin tag"           "skills/generate-skill/SKILL.md"   "@coordinator"
assert_row_contains "SKILL.md → tier t1"              "skills/generate-skill/SKILL.md"   "t1"
assert_row_contains "SKILL.md → tier t2"              "skills/generate-skill/SKILL.md"   "t2"
assert_row_contains "SKILL.md → tier t3"              "skills/generate-skill/SKILL.md"   "t3"

# ===== Cross-cutting: Agent Instructions =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Cross-cutting: Agent Instructions ━━━${RESET}"
assert_row_contains "agent-sources/workspace/CLAUDE.md → plugin tag"     "agent-sources/workspace/CLAUDE.md" "@agents"
assert_row_contains "agent-sources/workspace/CLAUDE.md → tier t1"        "agent-sources/workspace/CLAUDE.md" "t1"
assert_row_contains "agent-sources/workspace/CLAUDE.md → tier t4"        "agent-sources/workspace/CLAUDE.md" "t4"

# ===== Cross-cutting: Plugin Manifest =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Cross-cutting: Plugin Manifest ━━━${RESET}"
assert_row_contains "plugin.json → plugin tag"        "plugin.json"             "@structure"
assert_row_contains "plugin.json → tier t1"           "plugin.json"             "t1"

# ===== Infrastructure: Shared Test Mocks =====

echo ""
echo -e "${CYAN}${BOLD}━━━ Infrastructure: Shared Files ━━━${RESET}"
assert_in_manifest  "tauri.ts in shared infrastructure"     "src/lib/tauri.ts"
assert_in_manifest  "tauri mock in shared infrastructure"   "src/test/mocks/tauri.ts"
assert_in_manifest  "e2e mock in shared infrastructure"     "src/test/mocks/tauri-e2e.ts"
assert_in_manifest  "e2e event mock in shared infra"        "src/test/mocks/tauri-e2e-event.ts"
assert_in_manifest  "full suite instruction present"        "run the full test suite"

# ===== E2E Coverage =====

echo ""
echo -e "${CYAN}${BOLD}━━━ E2E Test Files ━━━${RESET}"
assert_in_manifest  "dashboard spec listed"           "dashboard.spec.ts"
assert_in_manifest  "dashboard-states spec listed"    "dashboard-states.spec.ts"
assert_in_manifest  "skill-crud spec listed"          "skill-crud.spec.ts"
assert_in_manifest  "settings spec listed"            "settings.spec.ts"
assert_in_manifest  "workflow-agent spec listed"      "workflow-agent.spec.ts"
assert_in_manifest  "navigation spec listed"          "navigation.spec.ts"

# ===== Summary =====

echo ""
echo "--------------------------------------------"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All $TOTAL manifest scenarios passed.${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}$FAIL_COUNT/$TOTAL manifest scenarios failed.${RESET}"
  exit 1
fi
