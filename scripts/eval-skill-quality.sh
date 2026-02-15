#!/usr/bin/env bash
# eval-skill-quality.sh — Evaluate whether a skill improves Claude's output
#
# Compares responses with skill vs without skill (baseline mode), or
# compares two skill versions against each other (compare mode).
#
# Usage:
#   ./scripts/eval-skill-quality.sh --baseline path/to/SKILL.md --prompts prompts.txt
#   ./scripts/eval-skill-quality.sh --compare path/to/v1/SKILL.md path/to/v2/SKILL.md --prompts prompts.txt
#
# Environment variables:
#   CLAUDE_BIN     Path to claude binary (default: claude)
#   JUDGE_MODEL    Model for the judge LLM (default: sonnet)
#   RESPONSE_MODEL Model for generating responses (default: sonnet)
#   MAX_TOKENS     Max tokens per response (default: 4096)
#   VERBOSE        Set to 1 for verbose output

set -o pipefail

# ---------- Color support ----------
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  BOLD=$(tput bold)
  RED=$(tput setaf 1)
  GREEN=$(tput setaf 2)
  YELLOW=$(tput setaf 3)
  CYAN=$(tput setaf 6)
  RESET=$(tput sgr0)
else
  BOLD="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
fi

# ---------- Configuration ----------
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
JUDGE_MODEL="${JUDGE_MODEL:-sonnet}"
RESPONSE_MODEL="${RESPONSE_MODEL:-sonnet}"
MAX_TOKENS="${MAX_TOKENS:-4096}"
VERBOSE="${VERBOSE:-0}"

# ---------- Temp directory ----------
TMPDIR_BASE=$(mktemp -d "${TMPDIR:-/tmp}/eval-skill-XXXXXX")
cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT

# ---------- Helpers ----------
log()     { echo "${CYAN}[eval]${RESET} $*"; }
warn()    { echo "${YELLOW}[warn]${RESET} $*" >&2; }
err()     { echo "${RED}[error]${RESET} $*" >&2; }
verbose() { [ "$VERBOSE" = "1" ] && echo "${BOLD}[debug]${RESET} $*" >&2; }

usage() {
  cat <<'USAGE'
Usage:
  eval-skill-quality.sh --baseline <skill-path> --prompts <prompts-file>
  eval-skill-quality.sh --compare <skill-a> <skill-b> --prompts <prompts-file>

Modes:
  --baseline <skill-path>         Compare skill-loaded vs no-skill responses
  --compare <skill-a> <skill-b>   Compare two skill versions

Options:
  --prompts <file>   Path to test prompts file (blocks separated by ---)
  --help             Show this help message

Environment:
  CLAUDE_BIN         Path to claude binary (default: claude)
  JUDGE_MODEL        Model for the judge LLM (default: sonnet)
  RESPONSE_MODEL     Model for generating responses (default: sonnet)
  VERBOSE            Set to 1 for verbose output

Examples:
  # Baseline: does the skill help vs no skill?
  ./scripts/eval-skill-quality.sh \
    --baseline agents/data-engineering/build.md \
    --prompts scripts/eval-prompts/data-engineering.txt

  # Compare: is v2 better than v1?
  ./scripts/eval-skill-quality.sh \
    --compare skills/v1/SKILL.md skills/v2/SKILL.md \
    --prompts scripts/eval-prompts/data-engineering.txt
USAGE
  exit 0
}

# ---------- Parse arguments ----------
MODE=""
SKILL_A=""
SKILL_B=""
PROMPTS_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      ;;
    --baseline)
      MODE="baseline"
      SKILL_A="${2:-}"
      if [ -z "$SKILL_A" ]; then
        err "--baseline requires a skill path"
        exit 1
      fi
      shift 2
      ;;
    --compare)
      MODE="compare"
      SKILL_A="${2:-}"
      SKILL_B="${3:-}"
      if [ -z "$SKILL_A" ] || [ -z "$SKILL_B" ]; then
        err "--compare requires two skill paths"
        exit 1
      fi
      shift 3
      ;;
    --prompts)
      PROMPTS_FILE="${2:-}"
      if [ -z "$PROMPTS_FILE" ]; then
        err "--prompts requires a file path"
        exit 1
      fi
      shift 2
      ;;
    *)
      err "Unknown argument: $1"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

# ---------- Validate inputs ----------
if [ -z "$MODE" ]; then
  err "Must specify --baseline or --compare"
  echo "Run with --help for usage."
  exit 1
fi

if [ -z "$PROMPTS_FILE" ]; then
  err "Must specify --prompts <file>"
  exit 1
fi

if [ ! -f "$PROMPTS_FILE" ]; then
  err "Prompts file not found: $PROMPTS_FILE"
  exit 1
fi

if [ ! -f "$SKILL_A" ]; then
  err "Skill file not found: $SKILL_A"
  exit 1
fi

if [ "$MODE" = "compare" ] && [ ! -f "$SKILL_B" ]; then
  err "Skill file not found: $SKILL_B"
  exit 1
fi

if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  err "'$CLAUDE_BIN' not found. Install Claude Code or set CLAUDE_BIN."
  exit 1
fi

# ---------- Parse prompts ----------
# Split prompts file by --- delimiter, trim whitespace
parse_prompts() {
  local file="$1"
  local idx=0
  local current=""

  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$line" = "---" ]; then
      # Trim leading/trailing whitespace
      current=$(echo "$current" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      if [ -n "$current" ]; then
        echo "$current" > "$TMPDIR_BASE/prompt_${idx}.txt"
        idx=$((idx + 1))
      fi
      current=""
    else
      if [ -n "$current" ]; then
        current="$current
$line"
      else
        current="$line"
      fi
    fi
  done < "$file"

  # Last block (no trailing ---)
  current=$(echo "$current" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [ -n "$current" ]; then
    echo "$current" > "$TMPDIR_BASE/prompt_${idx}.txt"
    idx=$((idx + 1))
  fi

  echo "$idx"
}

NUM_PROMPTS=$(parse_prompts "$PROMPTS_FILE")

if [ "$NUM_PROMPTS" -eq 0 ]; then
  err "No prompts found in $PROMPTS_FILE"
  exit 1
fi

# ---------- Label variants ----------
if [ "$MODE" = "baseline" ]; then
  LABEL_A="With Skill"
  LABEL_B="Without Skill (Baseline)"
else
  LABEL_A="Skill A"
  LABEL_B="Skill B"
fi

# ---------- Banner ----------
echo ""
echo "${BOLD}============================================${RESET}"
echo "${BOLD} Skill Quality Evaluation${RESET}"
echo "============================================"
echo "  Mode:        $MODE"
echo "  Prompts:     $PROMPTS_FILE ($NUM_PROMPTS prompts)"
if [ "$MODE" = "baseline" ]; then
  echo "  Skill:       $SKILL_A"
else
  echo "  Skill A:     $SKILL_A"
  echo "  Skill B:     $SKILL_B"
fi
echo "  Judge model: $JUDGE_MODEL"
echo "  Resp model:  $RESPONSE_MODEL"
echo "  Timestamp:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

# ---------- Generate a response via claude CLI ----------
# Args: prompt_text skill_path(or "none") output_file
generate_response() {
  local prompt="$1"
  local skill_path="$2"
  local output_file="$3"

  local cmd_args=(-p --model "$RESPONSE_MODEL" --allowedTools "" --no-session-persistence)

  if [ "$skill_path" != "none" ]; then
    local skill_content
    skill_content=$(cat "$skill_path")
    cmd_args+=(--append-system-prompt "$skill_content")
  fi

  verbose "Running: $CLAUDE_BIN ${cmd_args[*]} \"<prompt>\""

  if ! echo "$prompt" | CLAUDECODE= "$CLAUDE_BIN" "${cmd_args[@]}" > "$output_file" 2>"$output_file.stderr"; then
    warn "claude CLI returned non-zero for prompt (see $output_file.stderr)"
    # Still continue — partial output may be usable
    if [ ! -s "$output_file" ]; then
      echo "(No response generated)" > "$output_file"
      return 1
    fi
  fi
  return 0
}

# ---------- Judge prompt ----------
build_judge_prompt() {
  local prompt="$1"
  local response_a="$2"
  local response_b="$3"
  local label_a="$4"
  local label_b="$5"

  cat <<JUDGE
You are an expert evaluator comparing two AI-generated responses to a data engineering prompt.

## Original Prompt
${prompt}

## Variant A (${label_a})
${response_a}

## Variant B (${label_b})
${response_b}

## Evaluation Rubric

Score each variant on these dimensions (1-5 scale):

- **Pattern Coverage** (1-5): Does the response cover the key patterns, techniques, and architectural considerations for this domain? 1=misses most patterns, 5=comprehensive coverage.
- **Specificity** (1-5): Are the instructions concrete and actionable with specific implementation details, or generic boilerplate? 1=vague/generic, 5=highly specific with code/SQL examples.
- **Correctness** (1-5): Are the technical details accurate? No misleading advice or anti-patterns? 1=significant errors, 5=fully correct.
- **Actionability** (1-5): Could an engineer follow this response to implement the pattern in a real system? 1=too abstract to act on, 5=ready to implement.

## Required Output Format

Return ONLY a JSON object with this exact structure (no markdown fences, no commentary outside the JSON):
{
  "variant_a": {"pattern_coverage": <int>, "specificity": <int>, "correctness": <int>, "actionability": <int>},
  "variant_b": {"pattern_coverage": <int>, "specificity": <int>, "correctness": <int>, "actionability": <int>},
  "explanation": "<2-3 sentence explanation of the key differences>"
}
JUDGE
}

# ---------- Parse judge JSON ----------
# Extract a numeric score from JSON. Args: json_string path (e.g., "variant_a.specificity")
extract_score() {
  local json="$1"
  local path="$2"
  local variant="${path%%.*}"
  local dimension="${path##*.}"

  # Use python3 for reliable JSON parsing
  python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d['${variant}']['${dimension}'])
except Exception as e:
    print('-1', file=sys.stderr)
    print('0')
" <<< "$json"
}

extract_explanation() {
  local json="$1"
  python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('explanation', '(no explanation)'))
except:
    print('(failed to parse explanation)')
" <<< "$json"
}

# ---------- Run evaluation ----------
# Accumulators for averages
TOTAL_A_PATTERN=0; TOTAL_A_SPECIFIC=0; TOTAL_A_CORRECT=0; TOTAL_A_ACTION=0
TOTAL_B_PATTERN=0; TOTAL_B_SPECIFIC=0; TOTAL_B_CORRECT=0; TOTAL_B_ACTION=0
EVALUATED=0
FAILED=0

# Store per-prompt results for the report
declare -a PROMPT_LABELS
declare -a PROMPT_SCORES_A
declare -a PROMPT_SCORES_B
declare -a PROMPT_EXPLANATIONS

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  prompt_file="$TMPDIR_BASE/prompt_${i}.txt"
  prompt_text=$(cat "$prompt_file")
  prompt_short=$(echo "$prompt_text" | head -1 | cut -c1-70)

  echo "${BOLD}--- Prompt $((i + 1))/$NUM_PROMPTS ---${RESET}"
  echo "  ${prompt_short}..."
  echo ""

  # Generate response A (with skill)
  resp_a_file="$TMPDIR_BASE/response_a_${i}.txt"
  log "Generating ${LABEL_A} response..."
  if ! generate_response "$prompt_text" "$SKILL_A" "$resp_a_file"; then
    warn "Failed to generate ${LABEL_A} response for prompt $((i + 1)), skipping"
    FAILED=$((FAILED + 1))
    continue
  fi
  verbose "Response A: $(wc -c < "$resp_a_file") bytes"

  # Generate response B (without skill or with skill B)
  resp_b_file="$TMPDIR_BASE/response_b_${i}.txt"
  if [ "$MODE" = "baseline" ]; then
    skill_b_path="none"
  else
    skill_b_path="$SKILL_B"
  fi
  log "Generating ${LABEL_B} response..."
  if ! generate_response "$prompt_text" "$skill_b_path" "$resp_b_file"; then
    warn "Failed to generate ${LABEL_B} response for prompt $((i + 1)), skipping"
    FAILED=$((FAILED + 1))
    continue
  fi
  verbose "Response B: $(wc -c < "$resp_b_file") bytes"

  # Judge
  response_a=$(cat "$resp_a_file")
  response_b=$(cat "$resp_b_file")
  judge_prompt=$(build_judge_prompt "$prompt_text" "$response_a" "$response_b" "$LABEL_A" "$LABEL_B")
  judge_file="$TMPDIR_BASE/judge_${i}.txt"

  log "Judging responses..."
  if ! echo "$judge_prompt" | CLAUDECODE= "$CLAUDE_BIN" -p --model "$JUDGE_MODEL" --allowedTools "" --no-session-persistence > "$judge_file" 2>"$judge_file.stderr"; then
    warn "Judge failed for prompt $((i + 1)), skipping"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Extract JSON from judge output (strip any markdown fences or surrounding text)
  judge_raw=$(cat "$judge_file")
  judge_json=$(python3 -c "
import sys, re, json
text = sys.stdin.read()
# Try to find JSON object in the text
match = re.search(r'\{[^{}]*\"variant_a\"[^{}]*\{[^}]*\}[^{}]*\"variant_b\"[^{}]*\{[^}]*\}[^{}]*\}', text, re.DOTALL)
if match:
    # Validate it's parseable
    try:
        obj = json.loads(match.group())
        print(json.dumps(obj))
        sys.exit(0)
    except:
        pass
# Fallback: try the whole text
try:
    obj = json.loads(text)
    print(json.dumps(obj))
except:
    print('{}', file=sys.stderr)
    sys.exit(1)
" <<< "$judge_raw" 2>/dev/null)

  if [ $? -ne 0 ] || [ -z "$judge_json" ] || [ "$judge_json" = "{}" ]; then
    warn "Failed to parse judge output for prompt $((i + 1)), skipping"
    verbose "Raw judge output: $judge_raw"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Extract scores
  a_pattern=$(extract_score "$judge_json" "variant_a.pattern_coverage")
  a_specific=$(extract_score "$judge_json" "variant_a.specificity")
  a_correct=$(extract_score "$judge_json" "variant_a.correctness")
  a_action=$(extract_score "$judge_json" "variant_a.actionability")

  b_pattern=$(extract_score "$judge_json" "variant_b.pattern_coverage")
  b_specific=$(extract_score "$judge_json" "variant_b.specificity")
  b_correct=$(extract_score "$judge_json" "variant_b.correctness")
  b_action=$(extract_score "$judge_json" "variant_b.actionability")

  explanation=$(extract_explanation "$judge_json")

  # Accumulate
  TOTAL_A_PATTERN=$((TOTAL_A_PATTERN + a_pattern))
  TOTAL_A_SPECIFIC=$((TOTAL_A_SPECIFIC + a_specific))
  TOTAL_A_CORRECT=$((TOTAL_A_CORRECT + a_correct))
  TOTAL_A_ACTION=$((TOTAL_A_ACTION + a_action))

  TOTAL_B_PATTERN=$((TOTAL_B_PATTERN + b_pattern))
  TOTAL_B_SPECIFIC=$((TOTAL_B_SPECIFIC + b_specific))
  TOTAL_B_CORRECT=$((TOTAL_B_CORRECT + b_correct))
  TOTAL_B_ACTION=$((TOTAL_B_ACTION + b_action))

  EVALUATED=$((EVALUATED + 1))

  # Store for report
  PROMPT_LABELS[$i]="$prompt_short"
  PROMPT_SCORES_A[$i]="${a_pattern}|${a_specific}|${a_correct}|${a_action}"
  PROMPT_SCORES_B[$i]="${b_pattern}|${b_specific}|${b_correct}|${b_action}"
  PROMPT_EXPLANATIONS[$i]="$explanation"

  # Print inline result
  a_total=$((a_pattern + a_specific + a_correct + a_action))
  b_total=$((b_pattern + b_specific + b_correct + b_action))
  if [ "$a_total" -gt "$b_total" ]; then
    winner="${GREEN}${LABEL_A} wins${RESET}"
  elif [ "$b_total" -gt "$a_total" ]; then
    winner="${GREEN}${LABEL_B} wins${RESET}"
  else
    winner="${YELLOW}Tie${RESET}"
  fi
  echo "  ${LABEL_A}: ${a_pattern}/${a_specific}/${a_correct}/${a_action} = ${a_total}/20"
  echo "  ${LABEL_B}: ${b_pattern}/${b_specific}/${b_correct}/${b_action} = ${b_total}/20"
  echo "  Result: ${winner}"
  echo ""
done

# ---------- Report ----------
if [ "$EVALUATED" -eq 0 ]; then
  err "No prompts were successfully evaluated"
  exit 1
fi

# Compute averages using python for floating point
compute_avg() { python3 -c "print(f'{$1 / $2:.1f}')"; }

avg_a_pattern=$(compute_avg $TOTAL_A_PATTERN $EVALUATED)
avg_a_specific=$(compute_avg $TOTAL_A_SPECIFIC $EVALUATED)
avg_a_correct=$(compute_avg $TOTAL_A_CORRECT $EVALUATED)
avg_a_action=$(compute_avg $TOTAL_A_ACTION $EVALUATED)

avg_b_pattern=$(compute_avg $TOTAL_B_PATTERN $EVALUATED)
avg_b_specific=$(compute_avg $TOTAL_B_SPECIFIC $EVALUATED)
avg_b_correct=$(compute_avg $TOTAL_B_CORRECT $EVALUATED)
avg_b_action=$(compute_avg $TOTAL_B_ACTION $EVALUATED)

total_a=$(python3 -c "print(f'{($TOTAL_A_PATTERN + $TOTAL_A_SPECIFIC + $TOTAL_A_CORRECT + $TOTAL_A_ACTION) / $EVALUATED:.1f}')")
total_b=$(python3 -c "print(f'{($TOTAL_B_PATTERN + $TOTAL_B_SPECIFIC + $TOTAL_B_CORRECT + $TOTAL_B_ACTION) / $EVALUATED:.1f}')")
delta=$(python3 -c "
a = ($TOTAL_A_PATTERN + $TOTAL_A_SPECIFIC + $TOTAL_A_CORRECT + $TOTAL_A_ACTION) / $EVALUATED
b = ($TOTAL_B_PATTERN + $TOTAL_B_SPECIFIC + $TOTAL_B_CORRECT + $TOTAL_B_ACTION) / $EVALUATED
print(f'{a - b:+.1f}')
")

# ---------- Print markdown report ----------
echo ""
echo "${BOLD}============================================${RESET}"
echo "${BOLD} Evaluation Report${RESET}"
echo "${BOLD}============================================${RESET}"
echo ""

echo "## Configuration"
echo ""
echo "- **Mode:** $MODE"
echo "- **Prompts:** $PROMPTS_FILE ($NUM_PROMPTS total, $EVALUATED evaluated, $FAILED failed)"
if [ "$MODE" = "baseline" ]; then
  echo "- **Skill:** \`$SKILL_A\`"
else
  echo "- **Skill A:** \`$SKILL_A\`"
  echo "- **Skill B:** \`$SKILL_B\`"
fi
echo "- **Judge model:** $JUDGE_MODEL"
echo "- **Response model:** $RESPONSE_MODEL"
echo ""

echo "## Per-Prompt Results"
echo ""

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  if [ -z "${PROMPT_SCORES_A[$i]:-}" ]; then
    continue
  fi

  echo "### Prompt $((i + 1)): ${PROMPT_LABELS[$i]}..."
  echo ""
  echo "| Dimension | ${LABEL_A} | ${LABEL_B} |"
  echo "|---|---|---|"

  IFS='|' read -r ap as ac aa <<< "${PROMPT_SCORES_A[$i]}"
  IFS='|' read -r bp bs bc ba <<< "${PROMPT_SCORES_B[$i]}"

  echo "| Pattern Coverage | $ap | $bp |"
  echo "| Specificity | $as | $bs |"
  echo "| Correctness | $ac | $bc |"
  echo "| Actionability | $aa | $ba |"

  a_sum=$((ap + as + ac + aa))
  b_sum=$((bp + bs + bc + ba))
  echo "| **Total** | **$a_sum/20** | **$b_sum/20** |"
  echo ""
  echo "> ${PROMPT_EXPLANATIONS[$i]}"
  echo ""
done

echo "## Dimension Averages"
echo ""
echo "| Dimension | ${LABEL_A} | ${LABEL_B} | Delta |"
echo "|---|---|---|---|"

for dim in pattern_coverage specificity correctness actionability; do
  case "$dim" in
    pattern_coverage) a_val=$avg_a_pattern; b_val=$avg_b_pattern; label="Pattern Coverage" ;;
    specificity)      a_val=$avg_a_specific; b_val=$avg_b_specific; label="Specificity" ;;
    correctness)      a_val=$avg_a_correct;  b_val=$avg_b_correct;  label="Correctness" ;;
    actionability)    a_val=$avg_a_action;   b_val=$avg_b_action;   label="Actionability" ;;
  esac
  dim_delta=$(python3 -c "print(f'{$a_val - $b_val:+.1f}')")
  echo "| $label | $a_val | $b_val | $dim_delta |"
done

echo "| **Overall** | **$total_a** | **$total_b** | **$delta** |"
echo ""

echo "## Verdict"
echo ""

# Determine winner
winner_result=$(python3 -c "
a = ($TOTAL_A_PATTERN + $TOTAL_A_SPECIFIC + $TOTAL_A_CORRECT + $TOTAL_A_ACTION) / $EVALUATED
b = ($TOTAL_B_PATTERN + $TOTAL_B_SPECIFIC + $TOTAL_B_CORRECT + $TOTAL_B_ACTION) / $EVALUATED
diff = a - b
if abs(diff) < 0.5:
    print('TIE')
elif diff > 0:
    print('A')
else:
    print('B')
")

case "$winner_result" in
  A)
    if [ "$MODE" = "baseline" ]; then
      echo "${GREEN}${BOLD}The skill improves output quality by $delta points on average.${RESET}"
    else
      echo "${GREEN}${BOLD}Skill A wins by $delta points on average.${RESET}"
    fi
    ;;
  B)
    if [ "$MODE" = "baseline" ]; then
      echo "${RED}${BOLD}The skill does NOT improve output quality ($delta points).${RESET}"
      echo "Consider revising the skill content."
    else
      echo "${GREEN}${BOLD}Skill B wins by $delta points on average.${RESET}"
    fi
    ;;
  TIE)
    echo "${YELLOW}${BOLD}No significant difference between variants (delta: $delta).${RESET}"
    ;;
esac

echo ""
echo "---"
echo "Generated by eval-skill-quality.sh at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
