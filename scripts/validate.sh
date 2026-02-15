#!/usr/bin/env bash
# Plugin structure validation — runs automatically via hook after Edit/Write
# Also callable manually: ./scripts/validate.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed

set -euo pipefail

PLUGIN_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$PLUGIN_DIR"

ERRORS=0
WARNINGS=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  WARN: $1"; WARNINGS=$((WARNINGS + 1)); }

# ---------- T1.1: Manifest ----------
echo "=== Manifest ==="
if [ -f ".claude-plugin/plugin.json" ]; then
  if python3 -m json.tool .claude-plugin/plugin.json > /dev/null 2>&1; then
    pass "plugin.json is valid JSON"
  else
    fail "plugin.json is not valid JSON"
  fi

  for field in name version description; do
    if python3 -c "import json; d=json.load(open('.claude-plugin/plugin.json')); assert '$field' in d" 2>/dev/null; then
      pass "plugin.json has '$field'"
    else
      fail "plugin.json missing '$field'"
    fi
  done
else
  fail ".claude-plugin/plugin.json not found"
fi

# ---------- T1.2 + T1.3: Agent files + frontmatter ----------
echo "=== Agents ==="

# Shared agents (no type prefix)
SHARED_AGENTS="shared/consolidate-research:consolidate-research:opus shared/confirm-decisions:confirm-decisions:opus shared/validate-skill:validate-skill:sonnet shared/detailed-research:detailed-research:sonnet"

# Type-specific agents: each type dir has 5 agents
TYPE_DIRS="domain platform source data-engineering"
TYPE_AGENTS="research-concepts:sonnet research-practices:sonnet research-implementation:sonnet research:sonnet generate-skill:sonnet"

# Build full list: path:expected_name:expected_model
ALL_AGENTS="$SHARED_AGENTS"
for dir in $TYPE_DIRS; do
  case "$dir" in
    data-engineering) prefix="de" ;;
    *) prefix="$dir" ;;
  esac
  for entry in $TYPE_AGENTS; do
    agent="${entry%%:*}"
    model="${entry##*:}"
    ALL_AGENTS="$ALL_AGENTS ${dir}/${agent}:${prefix}-${agent}:${model}"
  done
done

for entry in $ALL_AGENTS; do
  path=$(echo "$entry" | cut -d: -f1)
  expected_name=$(echo "$entry" | cut -d: -f2)
  expected_model=$(echo "$entry" | cut -d: -f3)
  file="agents/${path}.md"

  if [ ! -f "$file" ]; then
    fail "$file missing"
    continue
  fi

  # Check frontmatter delimiters
  if ! head -1 "$file" | grep -q "^---"; then
    fail "$path — no YAML frontmatter"
    continue
  fi

  # Extract frontmatter (between first and second ---)
  fm=$(awk 'BEGIN{n=0} /^---$/{n++; next} n==1{print}' "$file")

  # Required fields
  for field in name description model; do
    if echo "$fm" | grep -q "^${field}:"; then
      :
    else
      fail "$path — missing '$field' in frontmatter"
    fi
  done

  # Check name matches expected prefix
  actual_name=$(echo "$fm" | grep "^name:" | sed 's/name: *//')
  if [ "$actual_name" = "$expected_name" ]; then
    pass "$path — name=$actual_name"
  else
    fail "$path — name=$actual_name, expected=$expected_name"
  fi

  # Tools must be comma-separated string, not YAML list
  tools_line=$(echo "$fm" | grep "^tools:" || true)
  if [ -z "$tools_line" ]; then
    fail "$path — missing 'tools' in frontmatter"
  elif echo "$fm" | grep -q "^  - "; then
    fail "$path — tools must be comma-separated string, not YAML list"
  else
    pass "$path — frontmatter valid"
  fi

  # Model check
  actual_model=$(echo "$fm" | grep "^model:" | sed 's/model: *//')
  if [ "$actual_model" = "$expected_model" ]; then
    pass "$path — model=$actual_model"
  else
    fail "$path — model=$actual_model, expected=$expected_model"
  fi
done

# Check for unique names across all agents (frontmatter only)
echo "=== Name Uniqueness ==="
all_names=$(find agents/ -name "*.md" ! -path "agents/templates/*" ! -path "agents/types/*" -exec \
  awk 'BEGIN{n=0} /^---$/{n++; next} n==1 && /^name:/{sub(/^name: */, ""); print}' {} \; | sort)
dupes=$(echo "$all_names" | uniq -d)
if [ -z "$dupes" ]; then
  pass "all $(echo "$all_names" | wc -l | tr -d ' ') agent names are unique"
else
  fail "duplicate agent names found: $dupes"
fi

# ---------- T1.4: Skill file ----------
echo "=== Coordinator Skill ==="
if [ -f "skills/generate-skill/SKILL.md" ]; then
  if head -1 "skills/generate-skill/SKILL.md" | grep -q "^---"; then
    pass "skills/generate-skill/SKILL.md exists with frontmatter"
  else
    fail "skills/generate-skill/SKILL.md has no YAML frontmatter"
  fi
else
  fail "skills/generate-skill/SKILL.md not found"
fi

# ---------- T1.5: Workspace CLAUDE.md ----------
echo "=== Workspace CLAUDE.md ==="
if [ -f "workspace/CLAUDE.md" ]; then
  pass "workspace/CLAUDE.md exists"
else
  fail "workspace/CLAUDE.md not found"
fi

# ---------- T1.6: Old files removed ----------
echo "=== Cleanup ==="
if [ -d "prompts" ]; then
  fail "prompts/ directory still exists (should be removed)"
else
  pass "prompts/ removed"
fi
if [ -d "cowork" ]; then
  fail "cowork/ directory still exists (should be removed)"
else
  pass "cowork/ removed"
fi

# ---------- T1.7: .gitignore ----------
echo "=== .gitignore ==="
if [ -f ".gitignore" ]; then
  if grep -q "^skills/" .gitignore; then
    fail "skills/ is in .gitignore (plugin skills/ must be tracked)"
  else
    pass "skills/ is NOT in .gitignore"
  fi
  if grep -q "\.claude/" .gitignore; then
    pass ".claude/ is in .gitignore"
  else
    warn ".claude/ not in .gitignore"
  fi
  if grep -q "\*\.skill" .gitignore; then
    pass "*.skill is in .gitignore"
  else
    warn "*.skill not in .gitignore"
  fi
else
  warn ".gitignore not found"
fi

# ---------- T3.4: Coordinator content checks ----------
echo "=== Coordinator Content ==="
if [ -f "skills/generate-skill/SKILL.md" ]; then
  content=$(cat "skills/generate-skill/SKILL.md")
  for keyword in "TeamCreate" "TeamDelete" "CLAUDE_PLUGIN_ROOT" "research-entities.md" "skill-builder:"; do
    if echo "$content" | grep -q "$keyword"; then
      pass "coordinator references $keyword"
    else
      fail "coordinator missing reference to $keyword"
    fi
  done
  # Start modes
  for mode in "Mode A" "Mode B" "Mode C"; do
    if echo "$content" | grep -q "$mode"; then
      pass "coordinator has $mode"
    else
      fail "coordinator missing $mode (start modes)"
    fi
  done
fi

# ---------- Generate-skill agent: best practices in shared context + references/ in generate-skill agents ----------
echo "=== Generate-Skill Agent ==="
# Progressive disclosure and output structure are in workspace/CLAUDE.md (auto-loaded into all agents)
if [ -f "workspace/CLAUDE.md" ]; then
  ws_content=$(cat "workspace/CLAUDE.md")
  if echo "$ws_content" | grep -q "progressive disclosure"; then
    pass "workspace/CLAUDE.md contains progressive disclosure guidance"
  else
    fail "workspace/CLAUDE.md missing progressive disclosure guidance"
  fi
fi
build_checked=0
for dir in $TYPE_DIRS; do
  if [ -f "agents/${dir}/generate-skill.md" ]; then
    build_content=$(cat "agents/${dir}/generate-skill.md")
    if echo "$build_content" | grep -q "references/"; then
      pass "${dir}/generate-skill agent references references/ subfolder"
    else
      fail "${dir}/generate-skill agent missing references/ subfolder structure"
    fi
    build_checked=$((build_checked + 1))
  fi
done
if [ $build_checked -eq 0 ]; then
  fail "no generate-skill agent files found in any type directory"
fi

# ---------- Summary ----------
echo ""
echo "=============================="
if [ $ERRORS -eq 0 ]; then
  echo "ALL CHECKS PASSED ($WARNINGS warnings)"
  exit 0
else
  echo "FAILED: $ERRORS errors, $WARNINGS warnings"
  exit 1
fi
