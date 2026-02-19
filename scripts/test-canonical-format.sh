#!/usr/bin/env bash
# test-canonical-format.sh — Validate clarifications-related files conform to
# the canonical format spec (docs/design/clarifications-rendering/canonical-format.md).
#
# Usage:
#   ./scripts/test-canonical-format.sh        # Run all checks
#   ./scripts/test-canonical-format.sh -v     # Verbose — show matching lines
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more anti-patterns found

set -euo pipefail

# ---------- Resolve paths ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------- Options ----------
VERBOSE=0
if [[ "${1:-}" == "-v" || "${1:-}" == "--verbose" ]]; then
  VERBOSE=1
fi

# ---------- Colors ----------
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ---------- Counters ----------
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

# ---------- Build file list ----------
# Files to scan (relative to ROOT_DIR). We resolve globs and skip missing paths.
FILES_TO_SCAN=()

cd "$ROOT_DIR"

# Agent prompts
for f in agents/*.md; do
  [[ -f "$f" ]] && FILES_TO_SCAN+=("$f")
done

# Mock template clarifications
for f in app/sidecar/mock-templates/outputs/*/context/clarifications.md; do
  [[ -f "$f" ]] && FILES_TO_SCAN+=("$f")
done

# E2E fixture
if [[ -f "app/e2e/fixtures/agent-responses/review-content.md" ]]; then
  FILES_TO_SCAN+=("app/e2e/fixtures/agent-responses/review-content.md")
fi

# Plugin test fixtures
if [[ -f "scripts/plugin-tests/fixtures.sh" ]]; then
  FILES_TO_SCAN+=("scripts/plugin-tests/fixtures.sh")
fi

# ---------- Excluded files (the spec itself, JSONL replays, Rust parser) ----------
EXCLUDE_PATTERNS=(
  "docs/design/clarifications-rendering/canonical-format.md"
  "app/sidecar/mock-templates/*.jsonl"
  "app/src-tauri/src/commands/workflow.rs"
)

is_excluded() {
  local file="$1"
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    # Exact match
    if [[ "$file" == "$pattern" ]]; then
      return 0
    fi
    # Glob match (bash pattern matching)
    # shellcheck disable=SC2254
    case "$file" in
      $pattern) return 0 ;;
    esac
  done
  return 1
}

# Filter out excluded files
FILTERED_FILES=()
for f in "${FILES_TO_SCAN[@]}"; do
  if ! is_excluded "$f"; then
    FILTERED_FILES+=("$f")
  fi
done

echo -e "${CYAN}${BOLD}Canonical Format Compliance Test${RESET}"
echo -e "${DIM}Spec: docs/design/clarifications-rendering/canonical-format.md${RESET}"
echo -e "${DIM}Scanning ${#FILTERED_FILES[@]} files${RESET}"
echo ""

if [[ ${#FILTERED_FILES[@]} -eq 0 ]]; then
  echo -e "${RED}No files to scan — check file paths.${RESET}"
  exit 1
fi

# ---------- Anti-pattern checks ----------
# Each check: description, grep pattern (extended regex)
#
# We use grep -nE so we get line numbers for verbose output.
# grep exits 0 if match found (BAD — anti-pattern present), 1 if no match (GOOD).

check_anti_pattern() {
  local description="$1"
  local pattern="$2"
  local found=0
  local matches=""

  for f in "${FILTERED_FILES[@]}"; do
    result=$(grep -nE "$pattern" "$ROOT_DIR/$f" 2>/dev/null || true)
    if [[ -n "$result" ]]; then
      found=1
      matches+="    $f:"$'\n'
      while IFS= read -r line; do
        matches+="      $line"$'\n'
      done <<< "$result"
    fi
  done

  if [[ $found -eq 0 ]]; then
    pass "$description"
  else
    fail "$description"
    if [[ $VERBOSE -eq 1 && -n "$matches" ]]; then
      echo -e "${DIM}${matches}${RESET}"
    fi
  fi
}

echo "=== Anti-Pattern Checks ==="

# 1. **Answer**: (colon outside bold) — canonical is **Answer:**
check_anti_pattern \
  "No \`**Answer**:\` (colon must be inside bold: \`**Answer:**\`)" \
  '\*\*Answer\*\*:'

# 2. **Recommendation**: (colon outside bold) — canonical is **Recommendation:**
check_anti_pattern \
  "No \`**Recommendation**:\` (colon must be inside bold: \`**Recommendation:**\`)" \
  '\*\*Recommendation\*\*:'

# 3. - [ ] checkbox choice format — canonical is A. Choice text
check_anti_pattern \
  "No checkbox choices (\`- [ ]\` / \`- [x]\`) — use \`A. Choice text\`" \
  '^[[:space:]]*- \[([ x])\]'

# 4. **Choices**: label — canonical has no label
check_anti_pattern \
  "No \`**Choices**:\` label — lettered choices are self-evident" \
  '\*\*Choices\*\*[:\*]'

# 5. **Question**: label — canonical uses body text after heading
check_anti_pattern \
  "No \`**Question**:\` label — body text follows heading directly" \
  '\*\*Question\*\*[:\*]'

# ---------- Summary ----------
echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All $TOTAL checks passed.${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}$FAIL_COUNT of $TOTAL checks failed.${RESET}"
  if [[ $VERBOSE -eq 0 ]]; then
    echo -e "${DIM}Re-run with -v to see matching lines.${RESET}"
  fi
  exit 1
fi
