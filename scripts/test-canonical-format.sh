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

# ---------- Structural checks on clarifications files ----------
# These validate that clarifications .md files use the canonical heading hierarchy,
# frontmatter, and numbering. Only applied to actual clarifications content files,
# not agent prompts (which describe the format but don't contain it).

CLARIFICATION_FILES=()
for f in app/sidecar/mock-templates/outputs/*/context/clarifications.md; do
  [[ -f "$f" ]] && CLARIFICATION_FILES+=("$f")
done
if [[ -f "app/e2e/fixtures/agent-responses/review-content.md" ]]; then
  CLARIFICATION_FILES+=("app/e2e/fixtures/agent-responses/review-content.md")
fi

check_present() {
  local description="$1"
  local pattern="$2"
  local found=0

  for f in "${CLARIFICATION_FILES[@]}"; do
    if grep -qE "$pattern" "$ROOT_DIR/$f" 2>/dev/null; then
      found=1
      break
    fi
  done

  if [[ $found -eq 1 ]]; then
    pass "$description"
  else
    fail "$description"
    if [[ $VERBOSE -eq 1 ]]; then
      echo -e "${DIM}    Pattern: $pattern${RESET}"
      echo -e "${DIM}    Files checked: ${CLARIFICATION_FILES[*]}${RESET}"
    fi
  fi
}

check_each_file() {
  local description="$1"
  local pattern="$2"
  local all_pass=1

  for f in "${CLARIFICATION_FILES[@]}"; do
    if ! grep -qE "$pattern" "$ROOT_DIR/$f" 2>/dev/null; then
      all_pass=0
      if [[ $VERBOSE -eq 1 ]]; then
        echo -e "${DIM}    Missing in: $f${RESET}"
      fi
    fi
  done

  if [[ $all_pass -eq 1 ]]; then
    pass "$description"
  else
    fail "$description"
  fi
}

if [[ ${#CLARIFICATION_FILES[@]} -gt 0 ]]; then
  echo ""
  echo "=== Structural Checks (clarifications files) ==="

  # Frontmatter: required fields
  check_each_file \
    "Frontmatter: \`question_count\` present" \
    '^question_count:'

  check_each_file \
    "Frontmatter: \`sections\` present" \
    '^sections:'

  check_each_file \
    "Frontmatter: \`refinement_count\` present" \
    '^refinement_count:'

  # Heading hierarchy: ## section headings
  check_present \
    "Has \`## Section\` headings (H2)" \
    '^## [A-Z]'

  # Heading hierarchy: ### Q{n}: question headings
  check_present \
    "Has \`### Q{n}: Title\` question headings (H3)" \
    '^### Q[0-9]+:'

  # Answer fields exist
  check_each_file \
    "Has \`**Answer:**\` fields (canonical format)" \
    '^\*\*Answer:\*\*'

  # Recommendation fields exist
  check_each_file \
    "Has \`**Recommendation:**\` fields" \
    '^\*\*Recommendation:\*\*'

  # Choices use lettered format
  check_present \
    "Choices use \`A.\` lettered format" \
    '^[A-D]\. '

  # Refinements use #### container + ##### heading (only check step2 which has refinements)
  step2_file="app/sidecar/mock-templates/outputs/step2/context/clarifications.md"
  if [[ -f "$ROOT_DIR/$step2_file" ]]; then
    if grep -qE '^#### Refinements' "$ROOT_DIR/$step2_file" 2>/dev/null; then
      pass "Step2: \`#### Refinements\` container heading (H4)"
    else
      fail "Step2: \`#### Refinements\` container heading (H4)"
    fi

    if grep -qE '^##### R[0-9]+\.[0-9]+' "$ROOT_DIR/$step2_file" 2>/dev/null; then
      pass "Step2: \`##### R{n}.{m}: Title\` refinement headings (H5)"
    else
      fail "Step2: \`##### R{n}.{m}: Title\` refinement headings (H5)"
    fi
  fi
fi

# ---------- Structural checks on decisions files ----------

DECISION_FILES=()
for f in app/sidecar/mock-templates/outputs/step4/context/decisions.md; do
  [[ -f "$f" ]] && DECISION_FILES+=("$f")
done

check_decision_file() {
  local description="$1"
  local pattern="$2"
  local all_pass=1

  for f in "${DECISION_FILES[@]}"; do
    if ! grep -qE "$pattern" "$ROOT_DIR/$f" 2>/dev/null; then
      all_pass=0
      if [[ $VERBOSE -eq 1 ]]; then
        echo -e "${DIM}    Missing in: $f${RESET}"
      fi
    fi
  done

  if [[ $all_pass -eq 1 ]]; then
    pass "$description"
  else
    fail "$description"
  fi
}

check_decision_anti() {
  local description="$1"
  local pattern="$2"
  local found=0

  for f in "${DECISION_FILES[@]}"; do
    if grep -qE "$pattern" "$ROOT_DIR/$f" 2>/dev/null; then
      found=1
      if [[ $VERBOSE -eq 1 ]]; then
        echo -e "${DIM}    Found in: $f${RESET}"
      fi
    fi
  done

  if [[ $found -eq 0 ]]; then
    pass "$description"
  else
    fail "$description"
  fi
}

if [[ ${#DECISION_FILES[@]} -gt 0 ]]; then
  echo ""
  echo "=== Structural Checks (decisions files) ==="

  # Frontmatter: required fields
  check_decision_file \
    "Frontmatter: \`decision_count\` present" \
    '^decision_count:'

  check_decision_file \
    "Frontmatter: \`conflicts_resolved\` present" \
    '^conflicts_resolved:'

  check_decision_file \
    "Frontmatter: \`round\` present" \
    '^round:'

  # Heading hierarchy: ### D{N}: (H3, not H2)
  check_decision_file \
    "Has \`### D{N}: Title\` decision headings (H3)" \
    '^### D[0-9]+:'

  # Anti-pattern: ## D{N}: (H2 headings — old mock format)
  check_decision_anti \
    "No \`## D{N}:\` headings (must be H3, not H2)" \
    '^## D[0-9]+:'

  # Structured fields present
  check_decision_file \
    "Has \`**Original question:**\` fields" \
    '\*\*Original question:\*\*'

  check_decision_file \
    "Has \`**Decision:**\` fields" \
    '\*\*Decision:\*\*'

  check_decision_file \
    "Has \`**Implication:**\` fields" \
    '\*\*Implication:\*\*'

  check_decision_file \
    "Has \`**Status:**\` fields" \
    '\*\*Status:\*\*'

  # Status values are canonical
  check_decision_file \
    "Has \`resolved\` status entries" \
    '\*\*Status:\*\* resolved'

  # Anti-pattern: colon outside bold in decision fields
  check_decision_anti \
    "No \`**Decision**:\` (colon must be inside bold)" \
    '\*\*Decision\*\*:'

  check_decision_anti \
    "No \`**Implication**:\` (colon must be inside bold)" \
    '\*\*Implication\*\*:'

  check_decision_anti \
    "No \`**Status**:\` (colon must be inside bold)" \
    '\*\*Status\*\*:'
fi

# ---------- Structural checks on research-plan ----------

research_plan="app/sidecar/mock-templates/outputs/step0/context/research-plan.md"
if [[ -f "$ROOT_DIR/$research_plan" ]]; then
  echo ""
  echo "=== Structural Checks (research-plan) ==="

  check_in_file() {
    local description="$1"
    local file="$2"
    local pattern="$3"
    if grep -qE "$pattern" "$ROOT_DIR/$file" 2>/dev/null; then
      pass "$description"
    else
      fail "$description"
      if [[ $VERBOSE -eq 1 ]]; then
        echo -e "${DIM}    Pattern: $pattern in $file${RESET}"
      fi
    fi
  }

  check_in_file "Frontmatter: \`skill_type\` present" "$research_plan" '^skill_type:'
  check_in_file "Frontmatter: \`domain\` present" "$research_plan" '^domain:'
  check_in_file "Frontmatter: \`dimensions_evaluated\` present" "$research_plan" '^dimensions_evaluated:'
  check_in_file "Frontmatter: \`dimensions_selected\` present" "$research_plan" '^dimensions_selected:'
  check_in_file "Has \`## Dimension Scores\` section" "$research_plan" '^## Dimension Scores'
  check_in_file "Has \`## Selected Dimensions\` section" "$research_plan" '^## Selected Dimensions'
fi

# ---------- Structural checks on validate-skill outputs ----------

test_skill="app/sidecar/mock-templates/outputs/step6/context/test-skill.md"
validation_log="app/sidecar/mock-templates/outputs/step6/context/agent-validation-log.md"
companion_skills="app/sidecar/mock-templates/outputs/step6/context/companion-skills.md"

has_step6=0
if [[ -f "$ROOT_DIR/$test_skill" || -f "$ROOT_DIR/$validation_log" || -f "$ROOT_DIR/$companion_skills" ]]; then
  has_step6=1
  echo ""
  echo "=== Structural Checks (validate-skill outputs) ==="
fi

if [[ -f "$ROOT_DIR/$test_skill" ]]; then
  check_in_file "test-skill: Frontmatter \`total_tests\` present" "$test_skill" '^total_tests:'
  check_in_file "test-skill: Frontmatter \`passed\` present" "$test_skill" '^passed:'
  check_in_file "test-skill: Frontmatter \`failed\` present" "$test_skill" '^failed:'
  check_in_file "test-skill: Has \`### Test\` entries" "$test_skill" '^### Test [0-9]+:'
  check_in_file "test-skill: Has Result with PASS/PARTIAL/FAIL" "$test_skill" '\*\*Result\*\*.*: (PASS|PARTIAL|FAIL)'
fi

if [[ -f "$ROOT_DIR/$validation_log" ]]; then
  check_in_file "validation-log: Has \`## Structural Checks\` section" "$validation_log" '^## Structural Checks'
  check_in_file "validation-log: Has \`## Decision Coverage\` section" "$validation_log" '^## Decision Coverage'
  check_in_file "validation-log: Has \`[PASS]\` or \`[FAIL]\` markers" "$validation_log" '\[(PASS|FAIL)\]'
fi

if [[ -f "$ROOT_DIR/$companion_skills" ]]; then
  check_in_file "companion-skills: Frontmatter \`skill_name\` present" "$companion_skills" '^skill_name:'
  check_in_file "companion-skills: Frontmatter \`skill_type\` present" "$companion_skills" '^skill_type:'
  check_in_file "companion-skills: Frontmatter \`companions\` array" "$companion_skills" '^companions:'
fi

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
