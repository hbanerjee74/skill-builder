#!/usr/bin/env bash
# test-eval-harness.sh — Test suite for eval-skill-quality.sh
#
# Tests the skill evaluation harness without requiring API keys for most tests.
# Some tests require ANTHROPIC_API_KEY for full validation.

set -euo pipefail

# ============================================
# Configuration
# ============================================
# Set your Anthropic API key here for API-dependent tests
# Or set ANTHROPIC_API_KEY environment variable before running
: "${ANTHROPIC_API_KEY:=${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY environment variable before running}}"
export ANTHROPIC_API_KEY

# Colors
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  GREEN=$(tput setaf 2)
  RED=$(tput setaf 1)
  YELLOW=$(tput setaf 3)
  RESET=$(tput sgr0)
else
  GREEN="" RED="" YELLOW="" RESET=""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_SCRIPT="$SCRIPT_DIR/eval-skill-quality.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test result tracking
pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo "${GREEN}✓${RESET} $1"
}

fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo "${RED}✗${RESET} $1"
  [ -n "${2:-}" ] && echo "  ${RED}Error:${RESET} $2"
}

test_start() {
  TESTS_RUN=$((TESTS_RUN + 1))
  echo ""
  echo "${YELLOW}Test $TESTS_RUN:${RESET} $1"
}

# Temp directory for test files
TMPDIR_TEST=$(mktemp -d "${TMPDIR:-/tmp}/eval-test-XXXXXX")
cleanup() { rm -rf "$TMPDIR_TEST"; }
trap cleanup EXIT

# ============================================
# Test 1: Script syntax validation
# ============================================
test_start "Script syntax validation"
if bash -n "$EVAL_SCRIPT" 2>/dev/null; then
  pass "Script has valid bash syntax"
else
  fail "Script has syntax errors"
fi

# ============================================
# Test 2: Help message
# ============================================
test_start "Help message displays"
if "$EVAL_SCRIPT" --help >/dev/null 2>&1; then
  pass "Help message displays without errors"
else
  fail "Help message failed"
fi

# ============================================
# Test 3: Empty prompts file detection
# ============================================
test_start "Empty prompts file detection"
# Create file with only whitespace
echo "   " > "$TMPDIR_TEST/empty-prompts.txt"
touch "$TMPDIR_TEST/dummy-skill.md"

# Script parses prompts then checks count, so error happens after parsing
# Capture output and check for error (script will exit with error code)
output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/dummy-skill.md" \
   --prompts "$TMPDIR_TEST/empty-prompts.txt" 2>&1 || true)

if echo "$output" | grep -q "No prompts found"; then
  pass "Empty prompts file correctly detected"
else
  fail "Empty prompts file not detected" "$output"
fi

# ============================================
# Test 4: Missing skill file detection
# ============================================
test_start "Missing skill file detection"
echo "test prompt" > "$TMPDIR_TEST/prompts.txt"

output=$("$EVAL_SCRIPT" --baseline "/nonexistent/skill.md" \
   --prompts "$TMPDIR_TEST/prompts.txt" 2>&1 || true)

if echo "$output" | grep -q "Skill file not found"; then
  pass "Missing skill file correctly detected"
else
  fail "Missing skill file not detected" "$output"
fi

# ============================================
# Test 5: Missing prompts file detection
# ============================================
test_start "Missing prompts file detection"
touch "$TMPDIR_TEST/skill.md"

output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
   --prompts "/nonexistent/prompts.txt" 2>&1 || true)

if echo "$output" | grep -q "Prompts file not found"; then
  pass "Missing prompts file correctly detected"
else
  fail "Missing prompts file not detected" "$output"
fi

# ============================================
# Test 6: Missing Claude CLI detection
# ============================================
test_start "Missing Claude CLI detection"
echo "test prompt" > "$TMPDIR_TEST/prompts.txt"
touch "$TMPDIR_TEST/skill.md"

output=$(CLAUDE_BIN="/nonexistent/claude" "$EVAL_SCRIPT" \
   --baseline "$TMPDIR_TEST/skill.md" \
   --prompts "$TMPDIR_TEST/prompts.txt" 2>&1 || true)

if echo "$output" | grep -q "not found"; then
  pass "Missing Claude CLI correctly detected"
else
  fail "Missing Claude CLI not detected" "$output"
fi

# ============================================
# Test 7: Dry-run mode validation
# ============================================
test_start "Dry-run mode validation"
cat > "$TMPDIR_TEST/test-prompts.txt" <<'EOF'
Prompt 1
---
Prompt 2
---
Prompt 3
EOF

touch "$TMPDIR_TEST/skill.md"

output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
         --prompts "$TMPDIR_TEST/test-prompts.txt" \
         --dry-run 2>&1)

if echo "$output" | grep -q "Found 3 prompts" && \
   echo "$output" | grep -q "All validations passed"; then
  pass "Dry-run mode validates inputs correctly"
else
  fail "Dry-run mode validation failed" "$output"
fi

# ============================================
# Test 8: Perspective flag validation
# ============================================
test_start "Perspective flag validation"
touch "$TMPDIR_TEST/skill.md"
echo "test" > "$TMPDIR_TEST/prompts.txt"

# Valid perspectives
for perspective in quality cost performance all; do
  if "$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
     --prompts "$TMPDIR_TEST/prompts.txt" \
     --perspective "$perspective" --dry-run >/dev/null 2>&1; then
    pass "Perspective '$perspective' accepted"
  else
    fail "Perspective '$perspective' rejected"
  fi
done

# Invalid perspective
output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
   --prompts "$TMPDIR_TEST/prompts.txt" \
   --perspective "invalid" 2>&1 || true)

if echo "$output" | grep -q "must be"; then
  pass "Invalid perspective correctly rejected"
else
  fail "Invalid perspective not rejected" "$output"
fi

# ============================================
# Test 9: Format flag validation
# ============================================
test_start "Format flag validation"

# Valid formats
for format in md json; do
  if "$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
     --prompts "$TMPDIR_TEST/prompts.txt" \
     --format "$format" --dry-run >/dev/null 2>&1; then
    pass "Format '$format' accepted"
  else
    fail "Format '$format' rejected"
  fi
done

# Invalid format
output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
   --prompts "$TMPDIR_TEST/prompts.txt" \
   --format "xml" 2>&1 || true)

if echo "$output" | grep -q "must be"; then
  pass "Invalid format correctly rejected"
else
  fail "Invalid format not rejected" "$output"
fi

# ============================================
# Test 10: Compare mode validation
# ============================================
test_start "Compare mode validation"
touch "$TMPDIR_TEST/skill-a.md"
touch "$TMPDIR_TEST/skill-b.md"
echo "test" > "$TMPDIR_TEST/prompts.txt"

output=$("$EVAL_SCRIPT" --compare "$TMPDIR_TEST/skill-a.md" "$TMPDIR_TEST/skill-b.md" \
   --prompts "$TMPDIR_TEST/prompts.txt" --dry-run 2>&1)

if echo "$output" | grep -q "Mode: compare" && echo "$output" | grep -q "Skill A:"; then
  pass "Compare mode validates correctly"
else
  fail "Compare mode validation failed" "$output"
fi

# ============================================
# Test 11: Prompt parsing with delimiters
# ============================================
test_start "Prompt parsing with --- delimiters"
cat > "$TMPDIR_TEST/multi-prompts.txt" <<'EOF'
First prompt
with multiple lines
---
Second prompt
---
Third prompt
also multiline
EOF

touch "$TMPDIR_TEST/skill.md"

output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/skill.md" \
         --prompts "$TMPDIR_TEST/multi-prompts.txt" \
         --dry-run 2>&1)

if echo "$output" | grep -q "Found 3 prompts"; then
  pass "Multi-line prompts parsed correctly"
else
  fail "Prompt parsing failed" "$output"
fi

# ============================================
# API-dependent tests (require ANTHROPIC_API_KEY and claude CLI)
# ============================================
if [ -n "${ANTHROPIC_API_KEY:-}" ] && command -v claude >/dev/null 2>&1; then
  echo ""
  echo "${YELLOW}Running API-dependent tests...${RESET}"
  
  # Test 12: Baseline mode with real skill
  test_start "Baseline mode with real skill (requires API)"
  
  # Use a minimal test skill
  cat > "$TMPDIR_TEST/test-skill.md" <<'EOF'
# Test Skill

This is a minimal test skill for evaluation.

## When to Use
Use this skill when testing the evaluation harness.

## Guidelines
- Keep responses concise
- Focus on clarity
EOF

  cat > "$TMPDIR_TEST/api-prompts.txt" <<'EOF'
Explain how to set up a simple data pipeline
EOF

  output=$("$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/test-skill.md" \
     --prompts "$TMPDIR_TEST/api-prompts.txt" \
     --output "$TMPDIR_TEST/baseline-result.md" 2>&1 || true)

  if echo "$output" | grep -q "Evaluation Report"; then
    pass "Baseline mode completes successfully"
    
    # Check output file exists
    if [ -f "$TMPDIR_TEST/baseline-result.md" ]; then
      pass "Output file created"
    else
      fail "Output file not created"
    fi
  else
    # Check if it's a Claude CLI issue
    if echo "$output" | grep -q "claude CLI returned non-zero" || echo "$output" | grep -q "Failed after"; then
      fail "Baseline mode failed (Claude CLI issue - may need valid API key or CLI configuration)" "$output"
    else
      fail "Baseline mode failed" "$output"
    fi
  fi
  
  # Test 13: JSON output format
  test_start "JSON output format (requires API)"
  
  if "$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/test-skill.md" \
     --prompts "$TMPDIR_TEST/api-prompts.txt" \
     --format json \
     --output "$TMPDIR_TEST/result.json" >/dev/null 2>&1; then
    
    # Validate JSON
    if python3 -c "import json; json.load(open('$TMPDIR_TEST/result.json'))" 2>/dev/null; then
      pass "JSON output is valid"
      
      # Check for required fields
      if python3 -c "
import json
data = json.load(open('$TMPDIR_TEST/result.json'))
assert 'metadata' in data
assert 'prompts' in data
assert 'averages' in data
assert 'verdict' in data
assert 'perspective' in data['metadata']
print('OK')
" 2>/dev/null | grep -q "OK"; then
        pass "JSON schema is correct"
      else
        fail "JSON schema is incomplete"
      fi
    else
      fail "JSON output is invalid"
    fi
  else
    fail "JSON output generation failed"
  fi
  
  # Test 14: Performance perspective
  test_start "Performance perspective (requires API)"
  
  if "$EVAL_SCRIPT" --baseline "$TMPDIR_TEST/test-skill.md" \
     --prompts "$TMPDIR_TEST/api-prompts.txt" \
     --perspective performance \
     --format json \
     --output "$TMPDIR_TEST/perf-result.json" >/dev/null 2>&1; then
    
    # Check for performance metrics
    if python3 -c "
import json
data = json.load(open('$TMPDIR_TEST/perf-result.json'))
prompt = data['prompts'][0]
assert 'performance' in prompt['variant_a']
assert 'latency_ms' in prompt['variant_a']['performance']
assert 'success' in prompt['variant_a']['performance']
print('OK')
" 2>/dev/null | grep -q "OK"; then
      pass "Performance metrics present in output"
    else
      fail "Performance metrics missing"
    fi
  else
    fail "Performance perspective failed"
  fi
  
else
  echo ""
  echo "${YELLOW}Skipping API-dependent tests${RESET}"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ANTHROPIC_API_KEY not set"
  fi
  if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found in PATH"
  fi
  echo "Set ANTHROPIC_API_KEY and install claude CLI to run full test suite"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "============================================"
echo "Test Summary"
echo "============================================"
echo "Total tests:  $TESTS_RUN"
echo "Passed:       ${GREEN}$TESTS_PASSED${RESET}"
echo "Failed:       ${RED}$TESTS_FAILED${RESET}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo "${GREEN}All tests passed!${RESET}"
  exit 0
else
  echo "${RED}Some tests failed${RESET}"
  exit 1
fi
