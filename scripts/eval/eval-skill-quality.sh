#!/usr/bin/env bash
# eval-skill-quality.sh — Evaluate whether a skill improves Claude's output
#
# Compares responses with skill vs without skill (baseline mode), or
# compares two skill versions against each other (compare mode).
#
# Uses Claude Code's --plugin-dir mechanism to load skills, testing the actual
# skill loading behavior rather than appending to system prompt.
#
# Usage:
#   ./scripts/eval-skill-quality.sh --baseline path/to/SKILL.md --prompts prompts.txt
#   ./scripts/eval-skill-quality.sh --compare path/to/v1/SKILL.md path/to/v2/SKILL.md --prompts prompts.txt
#
# Environment variables:
#   CLAUDE_BIN           Path to claude binary (default: claude)
#   JUDGE_MODEL          Model for the judge LLM (default: sonnet)
#   RESPONSE_MODEL       Model for generating responses (default: sonnet)
#   MAX_TOKENS           Max tokens per response (default: 4096)
#   VERBOSE              Set to 1 for verbose output
#   INPUT_COST_PER_MTOK  Input cost per million tokens (default: 3.00 for Sonnet)
#   OUTPUT_COST_PER_MTOK Output cost per million tokens (default: 15.00 for Sonnet)
#
# Cost estimate (based on actual runs with sonnet):
#   ~$0.70-1.40 per prompt (2 response generations + 2 judge calls)
#   Full 5-prompt evaluation: ~$4-7
#
# JSON Output Schema (--format json):
# {
#   "metadata": {
#     "mode": "baseline|compare",
#     "perspective": "quality|cost|performance|all",
#     "timestamp": "ISO-8601 timestamp",
#     "judge_model": "model name",
#     "response_model": "model name",
#     "skill_a": "path to skill A",
#     "skill_b": "path to skill B or null",
#     "prompts_file": "path to prompts file",
#     "total_prompts": int,
#     "evaluated": int,
#     "failed": int,
#     "pricing": {"input_cost_per_mtok": float, "output_cost_per_mtok": float},
#     "skill_tokens_a": int,
#     "skill_tokens_b": int|null
#   },
#   "prompts": [
#     {
#       "index": int,
#       "label": "prompt preview text",
#       "variant_a": {
#         "actionability": int, "specificity": int, "domain_depth": int,
#         "self_containment": int, "progressive_disclosure": int,
#         "structure_organization": int, "claude_centric_design": int,
#         "quality_total": int, "practices_total": int, "total": int,
#         "performance": {"latency_ms": int, "ttft_ms": int, "success": bool, "retries": int,
#                        "tokens_per_second": float, "skill_discovery_ms": int,
#                        "progressive_levels": int},
#         "cost": {
#           "input_tokens": int, "output_tokens": int, "total_tokens": int,
#           "skill_tokens": int, "estimated_cost_usd": float,
#           "cost_per_quality_point": float|null, "token_source": str
#         }
#       },
#       "variant_b": {
#         "actionability": int, "specificity": int, "domain_depth": int,
#         "self_containment": int, "total": int,
#         "performance": {"latency_ms": int, "ttft_ms": int, "success": bool, "retries": int,
#                        "tokens_per_second": float, "skill_discovery_ms": int,
#                        "progressive_levels": int},
#         "cost": {
#           "input_tokens": int, "output_tokens": int, "total_tokens": int,
#           "skill_tokens": int, "estimated_cost_usd": float,
#           "cost_per_quality_point": float|null, "token_source": str
#         }
#       },
#       "explanation": "quality judge explanation text",
#       "claude_practices_explanation": "best practices judge explanation text"
#     }
#   ],
#   "averages": {
#     "variant_a": {
#       "actionability": float, "specificity": float, "domain_depth": float,
#       "self_containment": float, "progressive_disclosure": float,
#       "structure_organization": float, "claude_centric_design": float,
#       "quality_total": float, "practices_total": float, "total": float,
#       "performance": {"latency_ms": float, "ttft_ms": float, "success_rate": float,
#                      "tokens_per_second": float, "skill_discovery_ms": int,
#                      "progressive_levels": int},
#       "cost": {"avg_input_tokens": float, "avg_output_tokens": float,
#                "avg_total_tokens": float, "avg_cost_usd": float, "total_cost_usd": float}
#     },
#     "variant_b": {
#       "actionability": float, "specificity": float, "domain_depth": float,
#       "self_containment": float, "total": float,
#       "performance": {"latency_ms": float, "ttft_ms": float, "success_rate": float,
#                      "tokens_per_second": float, "skill_discovery_ms": int,
#                      "progressive_levels": int},
#       "cost": {"avg_input_tokens": float, "avg_output_tokens": float,
#                "avg_total_tokens": float, "avg_cost_usd": float, "total_cost_usd": float}
#     },
#     "quality_delta": float,
#     "delta": float,
#     "cost": {"token_delta_pct": float, "cost_delta_pct": float,
#              "total_eval_cost_usd": float, "winner": "A|B|TIE"}
#   },
#   "verdict": {
#     "winner": "A|B|TIE",
#     "message": "verdict message"
#   }
# }

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
INPUT_COST_PER_MTOK="${INPUT_COST_PER_MTOK:-3.00}"    # $3/MTok for Sonnet
OUTPUT_COST_PER_MTOK="${OUTPUT_COST_PER_MTOK:-15.00}"  # $15/MTok for Sonnet
OUTPUT_FILE=""
OUTPUT_FORMAT="md"
DRY_RUN=0
MAX_RETRIES=3
RESPONSE_TIMEOUT=120
PERSPECTIVE="quality"  # quality, cost, performance, or all

# ---------- Temp directory ----------
TMPDIR_BASE=$(mktemp -d "${TMPDIR:-/tmp}/eval-skill-XXXXXX")
cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT

# ---------- Helpers ----------
log()     { echo "${CYAN}[eval]${RESET} $*" >&2; }
warn()    { echo "${YELLOW}[warn]${RESET} $*" >&2; }
err()     { echo "${RED}[error]${RESET} $*" >&2; }
verbose() { [ "$VERBOSE" = "1" ] && echo "${BOLD}[debug]${RESET} $*" >&2; }

usage() {
  cat <<'USAGE'
Usage:
  eval-skill-quality.sh --baseline <skill-path> --prompts <prompts-file> [options]
  eval-skill-quality.sh --compare <skill-a> <skill-b> --prompts <prompts-file> [options]

Modes:
  --baseline <skill-path>         Compare skill-loaded vs no-skill responses
  --compare <skill-a> <skill-b>   Compare two skill versions

Options:
  --prompts <file>       Path to test prompts file (blocks separated by ---)
  --output <file>        Save report to file instead of stdout
  --format <md|json>     Output format: markdown (default) or JSON
  --perspective <mode>   Evaluation perspective: quality (default), cost, performance, or all
  --dry-run              Validate inputs without running evaluation
  --help                 Show this help message

Environment:
  CLAUDE_BIN             Path to claude binary (default: claude)
  JUDGE_MODEL            Model for the judge LLM (default: sonnet)
  RESPONSE_MODEL         Model for generating responses (default: sonnet)
  VERBOSE                Set to 1 for verbose output
  INPUT_COST_PER_MTOK    Input cost per million tokens (default: 3.00)
  OUTPUT_COST_PER_MTOK   Output cost per million tokens (default: 15.00)

Examples:
  # Baseline: does the skill help vs no skill?
  ./scripts/eval/eval-skill-quality.sh \
    --baseline agents/data-engineering/generate-skill.md \
    --prompts scripts/eval/prompts/data-engineering.txt

  # Compare with JSON output saved to file
  ./scripts/eval/eval-skill-quality.sh \
    --compare skills/v1/SKILL.md skills/v2/SKILL.md \
    --prompts scripts/eval/prompts/data-engineering.txt \
    --format json --output results.json

  # Dry run to validate inputs
  ./scripts/eval-skill-quality.sh --baseline skill.md --prompts prompts.txt --dry-run
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
    --output)
      OUTPUT_FILE="${2:-}"
      if [ -z "$OUTPUT_FILE" ]; then
        err "--output requires a file path"
        exit 1
      fi
      shift 2
      ;;
    --format)
      OUTPUT_FORMAT="${2:-}"
      if [ "$OUTPUT_FORMAT" != "md" ] && [ "$OUTPUT_FORMAT" != "json" ]; then
        err "--format must be 'md' or 'json'"
        exit 1
      fi
      shift 2
      ;;
    --perspective)
      PERSPECTIVE="${2:-}"
      if [ "$PERSPECTIVE" != "quality" ] && [ "$PERSPECTIVE" != "cost" ] && [ "$PERSPECTIVE" != "performance" ] && [ "$PERSPECTIVE" != "all" ]; then
        err "--perspective must be 'quality', 'cost', 'performance', or 'all'"
        exit 1
      fi
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
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

# ---------- Dry run mode ----------
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

# ---------- Dry run mode ----------
if [ "$DRY_RUN" = "1" ]; then
  log "Dry run mode - validating inputs only"
  echo ""
  echo "${GREEN}✓${RESET} Mode: $MODE"
  echo "${GREEN}✓${RESET} Prompts file: $PROMPTS_FILE"
  echo "${GREEN}✓${RESET} Skill A: $SKILL_A"
  [ "$MODE" = "compare" ] && echo "${GREEN}✓${RESET} Skill B: $SKILL_B"
  echo "${GREEN}✓${RESET} Claude CLI: $CLAUDE_BIN"
  echo "${GREEN}✓${RESET} Output format: $OUTPUT_FORMAT"
  [ -n "$OUTPUT_FILE" ] && echo "${GREEN}✓${RESET} Output file: $OUTPUT_FILE"
  echo ""
  
  # Parse and count prompts
  NUM_PROMPTS=$(parse_prompts "$PROMPTS_FILE")
  echo "${GREEN}✓${RESET} Found $NUM_PROMPTS prompts in $PROMPTS_FILE"
  echo ""
  echo "${BOLD}All validations passed. Ready to run evaluation.${RESET}"
  exit 0
fi

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
echo "" >&2
echo "${BOLD}============================================${RESET}" >&2
echo "${BOLD} Skill Quality Evaluation${RESET}" >&2
echo "============================================" >&2
echo "  Mode:        $MODE" >&2
echo "  Prompts:     $PROMPTS_FILE ($NUM_PROMPTS prompts)" >&2
if [ "$MODE" = "baseline" ]; then
  echo "  Skill:       $SKILL_A" >&2
else
  echo "  Skill A:     $SKILL_A" >&2
  echo "  Skill B:     $SKILL_B" >&2
fi
echo "  Perspective: $PERSPECTIVE" >&2
echo "  Judge model: $JUDGE_MODEL" >&2
echo "  Resp model:  $RESPONSE_MODEL" >&2
echo "  Pricing:     \$${INPUT_COST_PER_MTOK}/MTok in, \$${OUTPUT_COST_PER_MTOK}/MTok out" >&2
echo "  Timestamp:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >&2
echo "============================================" >&2
echo "" >&2

# ---------- Generate a response via claude CLI ----------
# Args: prompt_text skill_path(or "none") output_file perf_file cost_file
generate_response() {
  local prompt="$1"
  local skill_path="$2"
  local output_file="$3"
  local perf_file="$4"
  local cost_file="$5"

  local cmd_args=(-p --model "$RESPONSE_MODEL" --allowedTools "" --no-session-persistence --output-format json)

  # Use --plugin-dir to load skills via Claude Code's skill loading mechanism
  # This tests the actual skill loading behavior instead of appending to system prompt
  if [ "$skill_path" != "none" ]; then
    # Create a temporary plugin directory with the skill
    local temp_plugin_dir="$TMPDIR_BASE/plugin_$(basename "$skill_path" .md)_$$_$(date +%s%N)"
    mkdir -p "$temp_plugin_dir/.claude-plugin"
    mkdir -p "$temp_plugin_dir/skills/test-skill"

    # Copy the skill file to the temp plugin directory
    cp "$skill_path" "$temp_plugin_dir/skills/test-skill/SKILL.md"

    # Create a minimal plugin.json manifest
    cat > "$temp_plugin_dir/.claude-plugin/plugin.json" <<EOF
{
  "name": "eval-test-skill",
  "version": "0.1.0",
  "description": "Temporary plugin for skill evaluation",
  "skills": "./skills/"
}
EOF

    # Add --plugin-dir to load the skill
    cmd_args+=(--plugin-dir "$temp_plugin_dir")
  fi

  # Retry loop with exponential backoff
  local attempt=1
  local backoff=2
  local total_retries=0
  local raw_json_file="$output_file.raw_json"

  while [ $attempt -le "$MAX_RETRIES" ]; do
    verbose "Running: $CLAUDE_BIN ${cmd_args[*]} \"<prompt>\" (attempt $attempt/$MAX_RETRIES)"

    # Measure latency
    local start_time=$(date +%s%3N)

    # Use timeout command to enforce response timeout
    # --output-format json returns {"type":"result","result":"text","usage":{"input_tokens":N,"output_tokens":N},...}
    if echo "$prompt" | timeout "${RESPONSE_TIMEOUT}s" env CLAUDECODE= "$CLAUDE_BIN" "${cmd_args[@]}" > "$raw_json_file" 2>"$output_file.stderr"; then
      # Success - measure end time
      local end_time=$(date +%s%3N)
      local latency_ms=$((end_time - start_time))

      # Estimate TTFT as 25% of total latency (since streaming not available)
      local ttft_ms=$((latency_ms / 4))

      # Parse JSON output: extract response text and token usage
      python3 -c "
import json, sys, math
try:
    data = json.loads(sys.stdin.read())
    # Extract response text
    result_text = data.get('result', '')
    with open('$output_file', 'w') as f:
        f.write(result_text)
    # Extract token usage (best effort)
    usage = data.get('usage', {})
    input_tokens = usage.get('input_tokens', 0)
    output_tokens = usage.get('output_tokens', 0)
    if input_tokens == 0 and output_tokens == 0:
        # Fallback: approximate from word count
        word_count = len(result_text.split())
        output_tokens = math.ceil(word_count * 1.33)
        input_tokens = 0  # Cannot estimate input from output alone
    with open('$cost_file', 'w') as f:
        f.write(f'input_tokens={input_tokens}\n')
        f.write(f'output_tokens={output_tokens}\n')
        f.write(f'token_source=api\n')
except Exception as e:
    # Fallback: treat raw output as plain text
    print(f'Warning: JSON parse failed ({e}), falling back to word count', file=sys.stderr)
    with open('$raw_json_file') as rf:
        raw = rf.read()
    with open('$output_file', 'w') as f:
        f.write(raw)
    word_count = len(raw.split())
    import math
    output_tokens = math.ceil(word_count * 1.33)
    with open('$cost_file', 'w') as f:
        f.write(f'input_tokens=0\n')
        f.write(f'output_tokens={output_tokens}\n')
        f.write(f'token_source=approximation\n')
" < "$raw_json_file"

      # Write performance metrics
      echo "latency_ms=$latency_ms" > "$perf_file"
      echo "ttft_ms=$ttft_ms" >> "$perf_file"
      echo "success=true" >> "$perf_file"
      echo "retries=$total_retries" >> "$perf_file"

      return 0
    fi

    local exit_code=$?
    total_retries=$((total_retries + 1))

    # Check if timeout occurred (exit code 124)
    if [ $exit_code -eq 124 ]; then
      warn "Response generation timed out after ${RESPONSE_TIMEOUT}s (attempt $attempt/$MAX_RETRIES)"
    else
      warn "claude CLI returned non-zero (exit code: $exit_code, attempt $attempt/$MAX_RETRIES)"
    fi

    # If this was the last attempt, fail
    if [ $attempt -eq "$MAX_RETRIES" ]; then
      err "Failed after $MAX_RETRIES attempts"
      if [ ! -s "$output_file" ]; then
        echo "(No response generated after $MAX_RETRIES attempts)" > "$output_file"
      fi

      # Write failure metrics
      echo "latency_ms=0" > "$perf_file"
      echo "ttft_ms=0" >> "$perf_file"
      echo "success=false" >> "$perf_file"
      echo "retries=$total_retries" >> "$perf_file"

      # Write zero cost metrics
      echo "input_tokens=0" > "$cost_file"
      echo "output_tokens=0" >> "$cost_file"
      echo "token_source=none" >> "$cost_file"

      return 1
    fi

    # Exponential backoff before retry
    verbose "Waiting ${backoff}s before retry..."
    sleep $backoff
    backoff=$((backoff * 2))
    attempt=$((attempt + 1))
  done

  return 1
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

Score each variant on these dimensions (1-5 scale). These are the same quality dimensions used by the Skill Builder's validate agents:

- **Actionability** (1-5): Could an engineer follow this response to implement the pattern in a real system? 1=too abstract to act on, 5=ready to implement with clear steps and decisions.
- **Specificity** (1-5): Are the instructions concrete with specific implementation details (SQL/code examples, exact patterns, named strategies), or generic boilerplate? 1=vague/generic, 5=highly specific.
- **Domain Depth** (1-5): Does the response demonstrate deep domain knowledge — hard-to-find rules, edge cases, non-obvious entity relationships, industry-specific pitfalls? Or does it only cover what an LLM would already know without the skill? 1=surface-level/common knowledge, 5=expert-level domain insight.
- **Self-Containment** (1-5): Does the response provide enough context to be useful standalone — WHAT and WHY (entities, metrics, business rules, trade-offs), not just HOW (tool syntax, standard SQL)? 1=requires significant external context, 5=fully self-contained guidance.

## Required Output Format

Return ONLY a JSON object with this exact structure (no markdown fences, no commentary outside the JSON):
{
  "variant_a": {"actionability": <int>, "specificity": <int>, "domain_depth": <int>, "self_containment": <int>},
  "variant_b": {"actionability": <int>, "specificity": <int>, "domain_depth": <int>, "self_containment": <int>},
  "explanation": "<2-3 sentence explanation of the key differences>"
}
JUDGE
}

# ---------- Claude Best Practices Judge Prompt ----------
build_claude_practices_judge_prompt() {
  local skill_content="$1"
  local response="$2"
  local prompt_text="$3"

  cat <<JUDGE_EOF
You are an expert evaluator assessing Claude Agent Skills against Anthropic's official best practices.

## Original Task
${prompt_text}

## Skill Content
${skill_content}

## Response Generated Using This Skill
${response}

## Evaluation Rubric

Score on these dimensions (1-5 scale):

1. **Progressive Disclosure** (1-5):
   - Clear name/description for discovery?
   - Core content in SKILL.md with details in references?
   - Content organized for efficient loading?
   - 1=monolithic blob, 5=perfectly layered

2. **Structure & Organization** (1-5):
   - Organized like an onboarding guide?
   - Clear flow from overview to specifics?
   - Appropriate separation of concerns?
   - 1=chaotic, 5=exemplary structure

3. **Claude-Centric Design** (1-5):
   - Clear when to trigger the skill?
   - Unambiguous instructions?
   - Handles common failure modes?
   - Written from Claude's perspective?
   - 1=confusing, 5=perfectly clear

## Required Output Format

Return ONLY a JSON object (no markdown fences, no commentary outside the JSON):
{
  "progressive_disclosure": <int 1-5>,
  "structure_organization": <int 1-5>,
  "claude_centric_design": <int 1-5>,
  "explanation": "<2-3 sentences on compliance with Claude best practices>"
}
JUDGE_EOF
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

# Extract a numeric score from flat JSON. Args: json_string key (e.g., "progressive_disclosure")
extract_flat_score() {
  local json="$1"
  local key="$2"
  python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d['${key}'])
except Exception as e:
    print('-1', file=sys.stderr)
    print('0')
" <<< "$json"
}

# ---------- Run evaluation ----------
# Accumulators for averages (quality judge — 4 dimensions)
TOTAL_A_ACTION=0; TOTAL_A_SPECIFIC=0; TOTAL_A_DEPTH=0; TOTAL_A_SELF=0
TOTAL_B_ACTION=0; TOTAL_B_SPECIFIC=0; TOTAL_B_DEPTH=0; TOTAL_B_SELF=0

# Accumulators for Claude best practices judge — 3 dimensions (skill A only)
TOTAL_A_PROGRESSIVE=0; TOTAL_A_STRUCTURE=0; TOTAL_A_CLAUDE_CENTRIC=0

EVALUATED=0
FAILED=0

# Performance accumulators
TOTAL_A_LATENCY=0; TOTAL_A_TTFT=0; TOTAL_A_RETRIES=0; TOTAL_A_SUCCESS=0
TOTAL_B_LATENCY=0; TOTAL_B_TTFT=0; TOTAL_B_RETRIES=0; TOTAL_B_SUCCESS=0
TOTAL_A_TPS="0.0"; TOTAL_B_TPS="0.0"

# Cost accumulators
TOTAL_INPUT_TOKENS_A=0; TOTAL_OUTPUT_TOKENS_A=0
TOTAL_INPUT_TOKENS_B=0; TOTAL_OUTPUT_TOKENS_B=0
TOTAL_COST_A="0.0"; TOTAL_COST_B="0.0"

# Skill token counts (approximate: words * 1.33)
skill_a_words=$(wc -w < "$SKILL_A" | tr -d ' ')
SKILL_TOKENS_A=$(python3 -c "import math; print(math.ceil(${skill_a_words} * 1.33))")
if [ "$MODE" = "compare" ]; then
  skill_b_words=$(wc -w < "$SKILL_B" | tr -d ' ')
  SKILL_TOKENS_B=$(python3 -c "import math; print(math.ceil(${skill_b_words} * 1.33))")
else
  SKILL_TOKENS_B=0
fi

# Skill discovery time estimate: 50ms base + proportional to skill size
SKILL_DISCOVERY_MS_A=$(python3 -c "print(50 + ${SKILL_TOKENS_A} // 10)")
if [ "$MODE" = "compare" ]; then
  SKILL_DISCOVERY_MS_B=$(python3 -c "print(50 + ${SKILL_TOKENS_B} // 10)")
else
  SKILL_DISCOVERY_MS_B=0
fi

# Progressive disclosure levels: count reference files in skill directory
# Level 1: SKILL.md only; Level 2: SKILL.md + reference files
count_progressive_levels() {
  local skill_path="$1"
  local skill_dir
  skill_dir=$(dirname "$skill_path")
  local ref_count=0
  if [ -d "$skill_dir/references" ]; then
    ref_count=$(ls "$skill_dir/references/" 2>/dev/null | wc -l | tr -d ' ')
  fi
  if [ "$ref_count" -gt 0 ]; then
    echo 2
  else
    echo 1
  fi
}

PROGRESSIVE_LEVELS_A=$(count_progressive_levels "$SKILL_A")
if [ "$MODE" = "compare" ]; then
  PROGRESSIVE_LEVELS_B=$(count_progressive_levels "$SKILL_B")
else
  PROGRESSIVE_LEVELS_B=0
fi

# Store per-prompt results for the report
declare -a PROMPT_LABELS
declare -a PROMPT_SCORES_A
declare -a PROMPT_SCORES_B
declare -a PROMPT_EXPLANATIONS
declare -a PROMPT_PERF_A
declare -a PROMPT_PERF_B
declare -a PROMPT_PRACTICES_SCORES
declare -a PROMPT_PRACTICES_EXPLANATIONS
declare -a PROMPT_COST_A
declare -a PROMPT_COST_B

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  prompt_file="$TMPDIR_BASE/prompt_${i}.txt"
  prompt_text=$(cat "$prompt_file")
  prompt_short=$(echo "$prompt_text" | head -1 | cut -c1-70)

  echo "${BOLD}--- Prompt $((i + 1))/$NUM_PROMPTS ---${RESET}" >&2
  echo "  ${prompt_short}..." >&2
  echo "" >&2

  # Generate response A (with skill)
  resp_a_file="$TMPDIR_BASE/response_a_${i}.txt"
  perf_a_file="$TMPDIR_BASE/perf_a_${i}.txt"
  cost_a_file="$TMPDIR_BASE/cost_a_${i}.txt"
  log "Generating ${LABEL_A} response..."
  if ! generate_response "$prompt_text" "$SKILL_A" "$resp_a_file" "$perf_a_file" "$cost_a_file"; then
    warn "Failed to generate ${LABEL_A} response for prompt $((i + 1)), skipping"
    FAILED=$((FAILED + 1))
    continue
  fi
  verbose "Response A: $(wc -c < "$resp_a_file") bytes"

  # Generate response B (without skill or with skill B)
  resp_b_file="$TMPDIR_BASE/response_b_${i}.txt"
  perf_b_file="$TMPDIR_BASE/perf_b_${i}.txt"
  cost_b_file="$TMPDIR_BASE/cost_b_${i}.txt"
  if [ "$MODE" = "baseline" ]; then
    skill_b_path="none"
  else
    skill_b_path="$SKILL_B"
  fi
  log "Generating ${LABEL_B} response..."
  if ! generate_response "$prompt_text" "$skill_b_path" "$resp_b_file" "$perf_b_file" "$cost_b_file"; then
    warn "Failed to generate ${LABEL_B} response for prompt $((i + 1)), skipping"
    FAILED=$((FAILED + 1))
    continue
  fi
  verbose "Response B: $(wc -c < "$resp_b_file") bytes"

  # Read performance metrics
  source "$perf_a_file"
  a_latency=$latency_ms
  a_ttft=$ttft_ms
  a_success=$success
  a_retries=$retries

  source "$perf_b_file"
  b_latency=$latency_ms
  b_ttft=$ttft_ms
  b_success=$success
  b_retries=$retries

  # Read cost metrics
  source "$cost_a_file"
  a_input_tokens=$input_tokens
  a_output_tokens=$output_tokens
  a_token_source=$token_source

  source "$cost_b_file"
  b_input_tokens=$input_tokens
  b_output_tokens=$output_tokens
  b_token_source=$token_source

  # Calculate per-prompt costs using Python for floating-point
  a_prompt_cost=$(python3 -c "print(f'{($a_input_tokens * $INPUT_COST_PER_MTOK / 1000000) + ($a_output_tokens * $OUTPUT_COST_PER_MTOK / 1000000):.6f}')")
  b_prompt_cost=$(python3 -c "print(f'{($b_input_tokens * $INPUT_COST_PER_MTOK / 1000000) + ($b_output_tokens * $OUTPUT_COST_PER_MTOK / 1000000):.6f}')")

  # Calculate tokens per second: output_tokens / (latency_ms / 1000)
  a_tokens_per_second=$(python3 -c "
lat = $a_latency
out = $a_output_tokens
if lat > 0:
    print(f'{out / (lat / 1000.0):.1f}')
else:
    print('0.0')
")
  b_tokens_per_second=$(python3 -c "
lat = $b_latency
out = $b_output_tokens
if lat > 0:
    print(f'{out / (lat / 1000.0):.1f}')
else:
    print('0.0')
")

  # Accumulate performance metrics
  TOTAL_A_LATENCY=$((TOTAL_A_LATENCY + a_latency))
  TOTAL_A_TTFT=$((TOTAL_A_TTFT + a_ttft))
  TOTAL_A_RETRIES=$((TOTAL_A_RETRIES + a_retries))
  [ "$a_success" = "true" ] && TOTAL_A_SUCCESS=$((TOTAL_A_SUCCESS + 1))

  TOTAL_B_LATENCY=$((TOTAL_B_LATENCY + b_latency))
  TOTAL_B_TTFT=$((TOTAL_B_TTFT + b_ttft))
  TOTAL_B_RETRIES=$((TOTAL_B_RETRIES + b_retries))
  [ "$b_success" = "true" ] && TOTAL_B_SUCCESS=$((TOTAL_B_SUCCESS + 1))
  TOTAL_A_TPS=$(python3 -c "print(f'{$TOTAL_A_TPS + $a_tokens_per_second:.1f}')")
  TOTAL_B_TPS=$(python3 -c "print(f'{$TOTAL_B_TPS + $b_tokens_per_second:.1f}')")

  # Accumulate cost metrics
  TOTAL_INPUT_TOKENS_A=$((TOTAL_INPUT_TOKENS_A + a_input_tokens))
  TOTAL_OUTPUT_TOKENS_A=$((TOTAL_OUTPUT_TOKENS_A + a_output_tokens))
  TOTAL_INPUT_TOKENS_B=$((TOTAL_INPUT_TOKENS_B + b_input_tokens))
  TOTAL_OUTPUT_TOKENS_B=$((TOTAL_OUTPUT_TOKENS_B + b_output_tokens))
  TOTAL_COST_A=$(python3 -c "print(f'{$TOTAL_COST_A + $a_prompt_cost:.6f}')")
  TOTAL_COST_B=$(python3 -c "print(f'{$TOTAL_COST_B + $b_prompt_cost:.6f}')")

  # Judge
  response_a=$(cat "$resp_a_file")
  response_b=$(cat "$resp_b_file")
  
  # Skip judges if perspective is performance-only or cost-only
  if [ "$PERSPECTIVE" = "performance" ] || [ "$PERSPECTIVE" = "cost" ]; then
    # Use dummy scores for non-quality modes
    a_action=0; a_specific=0; a_depth=0; a_self=0
    b_action=0; b_specific=0; b_depth=0; b_self=0
    explanation="(Quality scoring skipped for ${PERSPECTIVE}-only evaluation)"
    a_progressive=0; a_structure=0; a_claude_centric=0
    practices_explanation="(Quality scoring skipped for ${PERSPECTIVE}-only evaluation)"
  else
    judge_prompt=$(build_judge_prompt "$prompt_text" "$response_a" "$response_b" "$LABEL_A" "$LABEL_B")
    judge_file="$TMPDIR_BASE/judge_${i}.txt"

    log "Judging responses..."
    if ! echo "$judge_prompt" | CLAUDECODE= "$CLAUDE_BIN" -p --model "$JUDGE_MODEL" --allowedTools "" --no-session-persistence > "$judge_file" 2>"$judge_file.stderr"; then
      warn "Judge failed for prompt $((i + 1)), skipping"
      FAILED=$((FAILED + 1))
      continue
    fi

    # Extract JSON from judge output (handles markdown fences, nested objects, surrounding text)
    judge_raw=$(cat "$judge_file")
    judge_json=$(python3 -c "
import sys, re, json

def extract_json(text):
    \"\"\"Extract valid JSON with variant_a and variant_b using multiple strategies.\"\"\"
    
    # Strategy 1: Strip markdown code fences
    cleaned = re.sub(r'\`\`\`(?:json)?\s*\n?', '', text)
    
    # Strategy 2: Find first valid JSON object using brace counting
    brace_count = 0
    start_idx = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if start_idx == -1:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx != -1:
                candidate = cleaned[start_idx:i+1]
                try:
                    obj = json.loads(candidate)
                    if 'variant_a' in obj and 'variant_b' in obj:
                        # Validate structure
                        if isinstance(obj['variant_a'], dict) and isinstance(obj['variant_b'], dict):
                            return obj
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
                start_idx = -1
    
    # Strategy 3: Try the whole text stripped
    try:
        obj = json.loads(cleaned.strip())
        if 'variant_a' in obj and 'variant_b' in obj:
            if isinstance(obj['variant_a'], dict) and isinstance(obj['variant_b'], dict):
                return obj
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    
    # Strategy 4: Look for JSON between common delimiters
    patterns = [
        r'```json\s*(\{.*?\})\s*```',
        r'```\s*(\{.*?\})\s*```',
        r'(\{[^{}]*\"variant_a\"[^{}]*\"variant_b\"[^{}]*\})',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                obj = json.loads(match)
                if 'variant_a' in obj and 'variant_b' in obj:
                    if isinstance(obj['variant_a'], dict) and isinstance(obj['variant_b'], dict):
                        return obj
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
    
    return None

try:
    text = sys.stdin.read()
    result = extract_json(text)
    if result:
        print(json.dumps(result))
        sys.exit(0)
    else:
        print('ERROR: Could not find valid JSON with variant_a and variant_b', file=sys.stderr)
        print('{}', file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f'ERROR: {str(e)}', file=sys.stderr)
    print('{}', file=sys.stderr)
    sys.exit(1)
" <<< "$judge_raw" 2>"$judge_file.parse_error")

    if [ $? -ne 0 ] || [ -z "$judge_json" ] || [ "$judge_json" = "{}" ]; then
      warn "Failed to parse judge output for prompt $((i + 1)), skipping"
      if [ "$VERBOSE" = "1" ]; then
        verbose "Parse error: $(cat "$judge_file.parse_error" 2>/dev/null || echo 'unknown')"
        verbose "Raw judge output (first 500 chars): $(echo "$judge_raw" | head -c 500)"
      fi
      FAILED=$((FAILED + 1))
      continue
    fi

    # Extract scores
    a_action=$(extract_score "$judge_json" "variant_a.actionability")
    a_specific=$(extract_score "$judge_json" "variant_a.specificity")
    a_depth=$(extract_score "$judge_json" "variant_a.domain_depth")
    a_self=$(extract_score "$judge_json" "variant_a.self_containment")

    b_action=$(extract_score "$judge_json" "variant_b.actionability")
    b_specific=$(extract_score "$judge_json" "variant_b.specificity")
    b_depth=$(extract_score "$judge_json" "variant_b.domain_depth")
    b_self=$(extract_score "$judge_json" "variant_b.self_containment")

    explanation=$(extract_explanation "$judge_json")

    # ---------- Claude Best Practices Judge (second judge call) ----------
    # Read skill content for the practices judge
    skill_content=$(cat "$SKILL_A")
    practices_judge_prompt=$(build_claude_practices_judge_prompt "$skill_content" "$response_a" "$prompt_text")
    practices_judge_file="$TMPDIR_BASE/practices_judge_${i}.txt"

    a_progressive=0; a_structure=0; a_claude_centric=0
    practices_explanation="(Claude practices judge did not run)"

    log "Judging Claude best practices compliance..."
    if echo "$practices_judge_prompt" | CLAUDECODE= "$CLAUDE_BIN" -p --model "$JUDGE_MODEL" --allowedTools "" --no-session-persistence > "$practices_judge_file" 2>"$practices_judge_file.stderr"; then
      # Extract JSON from practices judge output
      practices_raw=$(cat "$practices_judge_file")
      practices_json=$(python3 -c "
import sys, re, json

def extract_flat_json(text):
    \"\"\"Extract valid JSON with progressive_disclosure key using multiple strategies.\"\"\"
    # Strategy 1: Strip markdown code fences
    cleaned = re.sub(r'\`\`\`(?:json)?\s*\n?', '', text)
    # Strategy 2: Find first valid JSON object using brace counting
    brace_count = 0
    start_idx = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if start_idx == -1:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx != -1:
                candidate = cleaned[start_idx:i+1]
                try:
                    obj = json.loads(candidate)
                    if 'progressive_disclosure' in obj:
                        return obj
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
                start_idx = -1
    # Strategy 3: Try the whole text stripped
    try:
        obj = json.loads(cleaned.strip())
        if 'progressive_disclosure' in obj:
            return obj
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    return None

try:
    text = sys.stdin.read()
    result = extract_flat_json(text)
    if result:
        print(json.dumps(result))
        sys.exit(0)
    else:
        print('ERROR: Could not find valid JSON with progressive_disclosure', file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f'ERROR: {str(e)}', file=sys.stderr)
    sys.exit(1)
" <<< "$practices_raw" 2>"$practices_judge_file.parse_error")

      if [ $? -eq 0 ] && [ -n "$practices_json" ]; then
        a_progressive=$(extract_flat_score "$practices_json" "progressive_disclosure")
        a_structure=$(extract_flat_score "$practices_json" "structure_organization")
        a_claude_centric=$(extract_flat_score "$practices_json" "claude_centric_design")
        practices_explanation=$(extract_explanation "$practices_json")
      else
        warn "Failed to parse Claude practices judge output for prompt $((i + 1)), using zeros"
        if [ "$VERBOSE" = "1" ]; then
          verbose "Practices parse error: $(cat "$practices_judge_file.parse_error" 2>/dev/null || echo 'unknown')"
          verbose "Raw practices judge output (first 500 chars): $(echo "$practices_raw" | head -c 500)"
        fi
      fi
    else
      warn "Claude practices judge failed for prompt $((i + 1)), using zeros"
    fi
  fi

  # Accumulate quality scores
  TOTAL_A_ACTION=$((TOTAL_A_ACTION + a_action))
  TOTAL_A_SPECIFIC=$((TOTAL_A_SPECIFIC + a_specific))
  TOTAL_A_DEPTH=$((TOTAL_A_DEPTH + a_depth))
  TOTAL_A_SELF=$((TOTAL_A_SELF + a_self))

  TOTAL_B_ACTION=$((TOTAL_B_ACTION + b_action))
  TOTAL_B_SPECIFIC=$((TOTAL_B_SPECIFIC + b_specific))
  TOTAL_B_DEPTH=$((TOTAL_B_DEPTH + b_depth))
  TOTAL_B_SELF=$((TOTAL_B_SELF + b_self))

  # Accumulate Claude best practices scores
  TOTAL_A_PROGRESSIVE=$((TOTAL_A_PROGRESSIVE + a_progressive))
  TOTAL_A_STRUCTURE=$((TOTAL_A_STRUCTURE + a_structure))
  TOTAL_A_CLAUDE_CENTRIC=$((TOTAL_A_CLAUDE_CENTRIC + a_claude_centric))

  EVALUATED=$((EVALUATED + 1))

  # Store for report
  PROMPT_LABELS[$i]="$prompt_short"
  PROMPT_SCORES_A[$i]="${a_action}|${a_specific}|${a_depth}|${a_self}"
  PROMPT_SCORES_B[$i]="${b_action}|${b_specific}|${b_depth}|${b_self}"
  PROMPT_EXPLANATIONS[$i]="$explanation"
  PROMPT_PERF_A[$i]="${a_latency}|${a_ttft}|${a_success}|${a_retries}|${a_tokens_per_second}"
  PROMPT_PERF_B[$i]="${b_latency}|${b_ttft}|${b_success}|${b_retries}|${b_tokens_per_second}"
  PROMPT_PRACTICES_SCORES[$i]="${a_progressive}|${a_structure}|${a_claude_centric}"
  PROMPT_PRACTICES_EXPLANATIONS[$i]="$practices_explanation"
  PROMPT_COST_A[$i]="${a_input_tokens}|${a_output_tokens}|${a_prompt_cost}|${a_token_source}"
  PROMPT_COST_B[$i]="${b_input_tokens}|${b_output_tokens}|${b_prompt_cost}|${b_token_source}"

  # Print inline result
  a_quality=$((a_action + a_specific + a_depth + a_self))
  b_quality=$((b_action + b_specific + b_depth + b_self))
  a_practices=$((a_progressive + a_structure + a_claude_centric))
  a_total=$((a_quality + a_practices))
  b_total=$((b_quality))

  if [ "$PERSPECTIVE" = "cost" ]; then
    # Cost-focused output
    a_total_tokens=$((a_input_tokens + a_output_tokens))
    b_total_tokens=$((b_input_tokens + b_output_tokens))
    echo "  ${LABEL_A}: ${a_input_tokens} in / ${a_output_tokens} out = ${a_total_tokens} tokens (\$${a_prompt_cost})" >&2
    echo "  ${LABEL_B}: ${b_input_tokens} in / ${b_output_tokens} out = ${b_total_tokens} tokens (\$${b_prompt_cost})" >&2
    cost_winner=$(python3 -c "
a = $a_prompt_cost
b = $b_prompt_cost
if abs(a - b) < 0.0001:
    print('TIE')
elif a < b:
    print('A')
else:
    print('B')
")
    if [ "$cost_winner" = "A" ]; then
      winner="${GREEN}${LABEL_A} cheaper${RESET}"
    elif [ "$cost_winner" = "B" ]; then
      winner="${GREEN}${LABEL_B} cheaper${RESET}"
    else
      winner="${YELLOW}Tie${RESET}"
    fi
  elif [ "$PERSPECTIVE" = "performance" ]; then
    # Performance-focused output
    echo "  ${LABEL_A}: ${a_latency}ms latency, ${a_ttft}ms TTFT, ${a_tokens_per_second} tok/s, ${a_retries} retries" >&2
    echo "  ${LABEL_B}: ${b_latency}ms latency, ${b_ttft}ms TTFT, ${b_tokens_per_second} tok/s, ${b_retries} retries" >&2
    if [ "$a_latency" -lt "$b_latency" ]; then
      winner="${GREEN}${LABEL_A} faster${RESET}"
    elif [ "$b_latency" -lt "$a_latency" ]; then
      winner="${GREEN}${LABEL_B} faster${RESET}"
    else
      winner="${YELLOW}Tie${RESET}"
    fi
  else
    # Quality-focused output (quality or all)
    if [ "$a_quality" -gt "$b_quality" ]; then
      winner="${GREEN}${LABEL_A} wins${RESET}"
    elif [ "$b_quality" -gt "$a_quality" ]; then
      winner="${GREEN}${LABEL_B} wins${RESET}"
    else
      winner="${YELLOW}Tie${RESET}"
    fi
    echo "  ${LABEL_A} quality: ${a_action}/${a_specific}/${a_depth}/${a_self} = ${a_quality}/20" >&2
    echo "  ${LABEL_B} quality: ${b_action}/${b_specific}/${b_depth}/${b_self} = ${b_quality}/20" >&2
    echo "  ${LABEL_A} practices: ${a_progressive}/${a_structure}/${a_claude_centric} = ${a_practices}/15" >&2
    echo "  ${LABEL_A} combined: ${a_total}/35" >&2
    # Also show cost summary for "all" perspective
    if [ "$PERSPECTIVE" = "all" ]; then
      echo "  ${LABEL_A} cost: \$${a_prompt_cost} (${a_input_tokens} in / ${a_output_tokens} out)" >&2
      echo "  ${LABEL_B} cost: \$${b_prompt_cost} (${b_input_tokens} in / ${b_output_tokens} out)" >&2
    fi
  fi
  echo "  Result: ${winner}" >&2
  echo "" >&2
done

# ---------- Report ----------
if [ "$EVALUATED" -eq 0 ]; then
  err "No prompts were successfully evaluated"
  exit 1
fi

# Compute averages using python for floating point
compute_avg() { python3 -c "print(f'{$1 / $2:.1f}')"; }

# Quality dimension averages
avg_a_action=$(compute_avg $TOTAL_A_ACTION $EVALUATED)
avg_a_specific=$(compute_avg $TOTAL_A_SPECIFIC $EVALUATED)
avg_a_depth=$(compute_avg $TOTAL_A_DEPTH $EVALUATED)
avg_a_self=$(compute_avg $TOTAL_A_SELF $EVALUATED)

avg_b_action=$(compute_avg $TOTAL_B_ACTION $EVALUATED)
avg_b_specific=$(compute_avg $TOTAL_B_SPECIFIC $EVALUATED)
avg_b_depth=$(compute_avg $TOTAL_B_DEPTH $EVALUATED)
avg_b_self=$(compute_avg $TOTAL_B_SELF $EVALUATED)

# Claude best practices dimension averages (skill A only)
avg_a_progressive=$(compute_avg $TOTAL_A_PROGRESSIVE $EVALUATED)
avg_a_structure=$(compute_avg $TOTAL_A_STRUCTURE $EVALUATED)
avg_a_claude_centric=$(compute_avg $TOTAL_A_CLAUDE_CENTRIC $EVALUATED)

# Quality subtotal (4 dims, max 20)
quality_a=$(python3 -c "print(f'{($TOTAL_A_ACTION + $TOTAL_A_SPECIFIC + $TOTAL_A_DEPTH + $TOTAL_A_SELF) / $EVALUATED:.1f}')")
quality_b=$(python3 -c "print(f'{($TOTAL_B_ACTION + $TOTAL_B_SPECIFIC + $TOTAL_B_DEPTH + $TOTAL_B_SELF) / $EVALUATED:.1f}')")

# Practices subtotal (3 dims, max 15, skill A only)
practices_a=$(python3 -c "print(f'{($TOTAL_A_PROGRESSIVE + $TOTAL_A_STRUCTURE + $TOTAL_A_CLAUDE_CENTRIC) / $EVALUATED:.1f}')")

# Combined total (7 dims, max 35)
total_a=$(python3 -c "print(f'{($TOTAL_A_ACTION + $TOTAL_A_SPECIFIC + $TOTAL_A_DEPTH + $TOTAL_A_SELF + $TOTAL_A_PROGRESSIVE + $TOTAL_A_STRUCTURE + $TOTAL_A_CLAUDE_CENTRIC) / $EVALUATED:.1f}')")
total_b=$(python3 -c "print(f'{($TOTAL_B_ACTION + $TOTAL_B_SPECIFIC + $TOTAL_B_DEPTH + $TOTAL_B_SELF) / $EVALUATED:.1f}')")

# Quality delta (comparing 4 shared dims between A and B)
quality_delta=$(python3 -c "
a = ($TOTAL_A_ACTION + $TOTAL_A_SPECIFIC + $TOTAL_A_DEPTH + $TOTAL_A_SELF) / $EVALUATED
b = ($TOTAL_B_ACTION + $TOTAL_B_SPECIFIC + $TOTAL_B_DEPTH + $TOTAL_B_SELF) / $EVALUATED
print(f'{a - b:+.1f}')
")

# Overall delta (A has 7 dims / 35 max, B has 4 dims / 20 max — use quality delta for comparison)
delta="$quality_delta"

# Compute performance averages
avg_a_latency=$(compute_avg $TOTAL_A_LATENCY $EVALUATED)
avg_a_ttft=$(compute_avg $TOTAL_A_TTFT $EVALUATED)
avg_a_success_rate=$(python3 -c "print(f'{($TOTAL_A_SUCCESS * 100.0) / $EVALUATED:.1f}')")

avg_b_latency=$(compute_avg $TOTAL_B_LATENCY $EVALUATED)
avg_b_ttft=$(compute_avg $TOTAL_B_TTFT $EVALUATED)
avg_b_success_rate=$(python3 -c "print(f'{($TOTAL_B_SUCCESS * 100.0) / $EVALUATED:.1f}')")
avg_a_tps=$(python3 -c "print(f'{$TOTAL_A_TPS / $EVALUATED:.1f}')")
avg_b_tps=$(python3 -c "print(f'{$TOTAL_B_TPS / $EVALUATED:.1f}')")

# Compute cost averages
avg_input_tokens_a=$(compute_avg $TOTAL_INPUT_TOKENS_A $EVALUATED)
avg_output_tokens_a=$(compute_avg $TOTAL_OUTPUT_TOKENS_A $EVALUATED)
avg_cost_a=$(python3 -c "print(f'{$TOTAL_COST_A / $EVALUATED:.6f}')")
total_tokens_a=$((TOTAL_INPUT_TOKENS_A + TOTAL_OUTPUT_TOKENS_A))
avg_total_tokens_a=$(compute_avg $total_tokens_a $EVALUATED)

avg_input_tokens_b=$(compute_avg $TOTAL_INPUT_TOKENS_B $EVALUATED)
avg_output_tokens_b=$(compute_avg $TOTAL_OUTPUT_TOKENS_B $EVALUATED)
avg_cost_b=$(python3 -c "print(f'{$TOTAL_COST_B / $EVALUATED:.6f}')")
total_tokens_b=$((TOTAL_INPUT_TOKENS_B + TOTAL_OUTPUT_TOKENS_B))
avg_total_tokens_b=$(compute_avg $total_tokens_b $EVALUATED)

# Cost deltas (percentage difference)
cost_delta_pct=$(python3 -c "
a = $TOTAL_COST_A
b = $TOTAL_COST_B
if b > 0:
    print(f'{((a - b) / b) * 100:+.1f}')
elif a > 0:
    print('+100.0')
else:
    print('+0.0')
")
token_delta_pct=$(python3 -c "
a = $total_tokens_a
b = $total_tokens_b
if b > 0:
    print(f'{((a - b) / b) * 100:+.1f}')
elif a > 0:
    print('+100.0')
else:
    print('+0.0')
")

# Total evaluation cost (both variants combined)
total_eval_cost=$(python3 -c "print(f'{$TOTAL_COST_A + $TOTAL_COST_B:.6f}')")

# ---------- Generate JSON report ----------
generate_json_report() {
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # Use Python to generate valid JSON (handles escaping, no line wrapping issues)
  python3 << 'PYTHON_EOF'
import json
import sys
import os

# Read environment variables and arrays from bash
mode = os.environ.get('MODE', '')
perspective = os.environ.get('PERSPECTIVE', 'quality')
timestamp = os.environ.get('JSON_TIMESTAMP', '')
judge_model = os.environ.get('JUDGE_MODEL', '')
response_model = os.environ.get('RESPONSE_MODEL', '')
skill_a = os.environ.get('SKILL_A', '')
skill_b = os.environ.get('SKILL_B', '')
prompts_file = os.environ.get('PROMPTS_FILE', '')
num_prompts = int(os.environ.get('NUM_PROMPTS', '0'))
evaluated = int(os.environ.get('EVALUATED', '0'))
failed = int(os.environ.get('FAILED', '0'))

# Quality averages
avg_a_action = float(os.environ.get('avg_a_action', '0'))
avg_a_specific = float(os.environ.get('avg_a_specific', '0'))
avg_a_depth = float(os.environ.get('avg_a_depth', '0'))
avg_a_self = float(os.environ.get('avg_a_self', '0'))
total_a = float(os.environ.get('total_a', '0'))

avg_b_action = float(os.environ.get('avg_b_action', '0'))
avg_b_specific = float(os.environ.get('avg_b_specific', '0'))
avg_b_depth = float(os.environ.get('avg_b_depth', '0'))
avg_b_self = float(os.environ.get('avg_b_self', '0'))
total_b = float(os.environ.get('total_b', '0'))

# Claude best practices averages (skill A only)
avg_a_progressive = float(os.environ.get('avg_a_progressive', '0'))
avg_a_structure = float(os.environ.get('avg_a_structure', '0'))
avg_a_claude_centric = float(os.environ.get('avg_a_claude_centric', '0'))

# Subtotals
quality_a = float(os.environ.get('quality_a', '0'))
quality_b = float(os.environ.get('quality_b', '0'))
practices_a = float(os.environ.get('practices_a', '0'))

quality_delta_str = os.environ.get('quality_delta', '0')
quality_delta = float(quality_delta_str.replace('+', ''))

delta_str = os.environ.get('delta', '0')
delta = float(delta_str.replace('+', ''))

# Performance averages
avg_a_latency = float(os.environ.get('avg_a_latency', '0'))
avg_a_ttft = float(os.environ.get('avg_a_ttft', '0'))
avg_a_success_rate = float(os.environ.get('avg_a_success_rate', '0'))

avg_b_latency = float(os.environ.get('avg_b_latency', '0'))
avg_b_ttft = float(os.environ.get('avg_b_ttft', '0'))
avg_b_success_rate = float(os.environ.get('avg_b_success_rate', '0'))
avg_a_tps = float(os.environ.get('avg_a_tps', '0'))
avg_b_tps = float(os.environ.get('avg_b_tps', '0'))
skill_discovery_ms_a = int(os.environ.get('SKILL_DISCOVERY_MS_A', '0'))
skill_discovery_ms_b = int(os.environ.get('SKILL_DISCOVERY_MS_B', '0'))
progressive_levels_a = int(os.environ.get('PROGRESSIVE_LEVELS_A', '0'))
progressive_levels_b = int(os.environ.get('PROGRESSIVE_LEVELS_B', '0'))

# Cost data
skill_tokens_a = int(os.environ.get('SKILL_TOKENS_A', '0'))
skill_tokens_b = int(os.environ.get('SKILL_TOKENS_B', '0'))
input_cost_per_mtok = float(os.environ.get('INPUT_COST_PER_MTOK', '3.0'))
output_cost_per_mtok = float(os.environ.get('OUTPUT_COST_PER_MTOK', '15.0'))
total_cost_a = float(os.environ.get('TOTAL_COST_A', '0'))
total_cost_b = float(os.environ.get('TOTAL_COST_B', '0'))
total_eval_cost = float(os.environ.get('total_eval_cost', '0'))
avg_cost_a = float(os.environ.get('avg_cost_a', '0'))
avg_cost_b = float(os.environ.get('avg_cost_b', '0'))
avg_input_tokens_a = float(os.environ.get('avg_input_tokens_a', '0'))
avg_output_tokens_a = float(os.environ.get('avg_output_tokens_a', '0'))
avg_total_tokens_a = float(os.environ.get('avg_total_tokens_a', '0'))
avg_input_tokens_b = float(os.environ.get('avg_input_tokens_b', '0'))
avg_output_tokens_b = float(os.environ.get('avg_output_tokens_b', '0'))
avg_total_tokens_b = float(os.environ.get('avg_total_tokens_b', '0'))
token_delta_pct_str = os.environ.get('token_delta_pct', '0')
token_delta_pct = float(token_delta_pct_str.replace('+', ''))
cost_delta_pct_str = os.environ.get('cost_delta_pct', '0')
cost_delta_pct = float(cost_delta_pct_str.replace('+', ''))

# Winner
winner_result = os.environ.get('winner_result', '')
verdict_message = os.environ.get('verdict_message', '')

# Build prompts array
prompts = []
for i in range(num_prompts):
    label = os.environ.get(f'PROMPT_LABEL_{i}', '')
    scores_a = os.environ.get(f'PROMPT_SCORES_A_{i}', '')
    scores_b = os.environ.get(f'PROMPT_SCORES_B_{i}', '')
    explanation = os.environ.get(f'PROMPT_EXPLANATION_{i}', '')
    perf_a = os.environ.get(f'PROMPT_PERF_A_{i}', '')
    perf_b = os.environ.get(f'PROMPT_PERF_B_{i}', '')
    practices = os.environ.get(f'PROMPT_PRACTICES_{i}', '')
    practices_expl = os.environ.get(f'PROMPT_PRACTICES_EXPL_{i}', '')
    cost_a_str = os.environ.get(f'PROMPT_COST_A_{i}', '')
    cost_b_str = os.environ.get(f'PROMPT_COST_B_{i}', '')

    if not scores_a:
        continue

    # Parse quality scores
    aa, as_, ad, asc = map(int, scores_a.split('|'))
    ba, bs, bd, bsc = map(int, scores_b.split('|'))

    # Parse Claude best practices scores
    if practices:
        ap, ast, acc = map(int, practices.split('|'))
    else:
        ap, ast, acc = 0, 0, 0

    # Parse performance metrics
    perf_a_parts = perf_a.split('|')
    a_lat, a_ttft, a_succ, a_ret = perf_a_parts[0], perf_a_parts[1], perf_a_parts[2], perf_a_parts[3]
    a_tps = perf_a_parts[4] if len(perf_a_parts) > 4 else '0.0'
    perf_b_parts = perf_b.split('|')
    b_lat, b_ttft, b_succ, b_ret = perf_b_parts[0], perf_b_parts[1], perf_b_parts[2], perf_b_parts[3]
    b_tps = perf_b_parts[4] if len(perf_b_parts) > 4 else '0.0'

    # Parse cost metrics
    if cost_a_str:
        ca_parts = cost_a_str.split('|')
        ca_in, ca_out = int(ca_parts[0]), int(ca_parts[1])
        ca_cost = float(ca_parts[2])
        ca_src = ca_parts[3] if len(ca_parts) > 3 else 'unknown'
    else:
        ca_in, ca_out, ca_cost, ca_src = 0, 0, 0.0, 'none'

    if cost_b_str:
        cb_parts = cost_b_str.split('|')
        cb_in, cb_out = int(cb_parts[0]), int(cb_parts[1])
        cb_cost = float(cb_parts[2])
        cb_src = cb_parts[3] if len(cb_parts) > 3 else 'unknown'
    else:
        cb_in, cb_out, cb_cost, cb_src = 0, 0, 0.0, 'none'

    a_quality_total = aa + as_ + ad + asc
    a_practices_total = ap + ast + acc
    a_combined_total = a_quality_total + a_practices_total

    # Cost per quality point
    a_cost_per_qp = ca_cost / a_quality_total if a_quality_total > 0 else None
    b_cost_per_qp = cb_cost / (ba + bs + bd + bsc) if (ba + bs + bd + bsc) > 0 else None

    prompt_data = {
        "index": i + 1,
        "label": label,
        "variant_a": {
            "actionability": aa,
            "specificity": as_,
            "domain_depth": ad,
            "self_containment": asc,
            "progressive_disclosure": ap,
            "structure_organization": ast,
            "claude_centric_design": acc,
            "quality_total": a_quality_total,
            "practices_total": a_practices_total,
            "total": a_combined_total,
            "performance": {
                "latency_ms": int(a_lat),
                "ttft_ms": int(a_ttft),
                "success": a_succ == "true",
                "retries": int(a_ret),
                "tokens_per_second": float(a_tps),
                "skill_discovery_ms": skill_discovery_ms_a,
                "progressive_levels": progressive_levels_a
            },
            "cost": {
                "input_tokens": ca_in,
                "output_tokens": ca_out,
                "total_tokens": ca_in + ca_out,
                "skill_tokens": skill_tokens_a,
                "estimated_cost_usd": round(ca_cost, 6),
                "cost_per_quality_point": round(a_cost_per_qp, 6) if a_cost_per_qp is not None else None,
                "token_source": ca_src
            }
        },
        "variant_b": {
            "actionability": ba,
            "specificity": bs,
            "domain_depth": bd,
            "self_containment": bsc,
            "total": ba + bs + bd + bsc,
            "performance": {
                "latency_ms": int(b_lat),
                "ttft_ms": int(b_ttft),
                "success": b_succ == "true",
                "retries": int(b_ret),
                "tokens_per_second": float(b_tps),
                "skill_discovery_ms": skill_discovery_ms_b if mode == "compare" else 0,
                "progressive_levels": progressive_levels_b if mode == "compare" else 0
            },
            "cost": {
                "input_tokens": cb_in,
                "output_tokens": cb_out,
                "total_tokens": cb_in + cb_out,
                "skill_tokens": skill_tokens_b if mode == "compare" else 0,
                "estimated_cost_usd": round(cb_cost, 6),
                "cost_per_quality_point": round(b_cost_per_qp, 6) if b_cost_per_qp is not None else None,
                "token_source": cb_src
            }
        },
        "explanation": explanation,
        "claude_practices_explanation": practices_expl
    }

    prompts.append(prompt_data)

# Determine cost winner
if total_cost_b > 0:
    cost_diff_pct = abs(total_cost_a - total_cost_b) / max(total_cost_a, total_cost_b, 0.0001) * 100
    if cost_diff_pct < 5:
        cost_winner = "TIE"
    elif total_cost_a < total_cost_b:
        cost_winner = "A"
    else:
        cost_winner = "B"
elif total_cost_a > 0:
    cost_winner = "B"
else:
    cost_winner = "TIE"

# Build final JSON structure
result = {
    "metadata": {
        "mode": mode,
        "perspective": perspective,
        "timestamp": timestamp,
        "judge_model": judge_model,
        "response_model": response_model,
        "skill_a": skill_a,
        "skill_b": skill_b if mode != "baseline" else None,
        "prompts_file": prompts_file,
        "total_prompts": num_prompts,
        "evaluated": evaluated,
        "failed": failed,
        "pricing": {
            "input_cost_per_mtok": input_cost_per_mtok,
            "output_cost_per_mtok": output_cost_per_mtok
        },
        "skill_tokens_a": skill_tokens_a,
        "skill_tokens_b": skill_tokens_b if mode == "compare" else None
    },
    "prompts": prompts,
    "averages": {
        "variant_a": {
            "actionability": avg_a_action,
            "specificity": avg_a_specific,
            "domain_depth": avg_a_depth,
            "self_containment": avg_a_self,
            "progressive_disclosure": avg_a_progressive,
            "structure_organization": avg_a_structure,
            "claude_centric_design": avg_a_claude_centric,
            "quality_total": quality_a,
            "practices_total": practices_a,
            "total": total_a,
            "performance": {
                "latency_ms": avg_a_latency,
                "ttft_ms": avg_a_ttft,
                "success_rate": avg_a_success_rate,
                "tokens_per_second": avg_a_tps,
                "skill_discovery_ms": skill_discovery_ms_a,
                "progressive_levels": progressive_levels_a
            },
            "cost": {
                "avg_input_tokens": avg_input_tokens_a,
                "avg_output_tokens": avg_output_tokens_a,
                "avg_total_tokens": avg_total_tokens_a,
                "avg_cost_usd": round(avg_cost_a, 6),
                "total_cost_usd": round(total_cost_a, 6)
            }
        },
        "variant_b": {
            "actionability": avg_b_action,
            "specificity": avg_b_specific,
            "domain_depth": avg_b_depth,
            "self_containment": avg_b_self,
            "total": total_b,
            "performance": {
                "latency_ms": avg_b_latency,
                "ttft_ms": avg_b_ttft,
                "success_rate": avg_b_success_rate,
                "tokens_per_second": avg_b_tps,
                "skill_discovery_ms": skill_discovery_ms_b if mode == "compare" else 0,
                "progressive_levels": progressive_levels_b if mode == "compare" else 0
            },
            "cost": {
                "avg_input_tokens": avg_input_tokens_b,
                "avg_output_tokens": avg_output_tokens_b,
                "avg_total_tokens": avg_total_tokens_b,
                "avg_cost_usd": round(avg_cost_b, 6),
                "total_cost_usd": round(total_cost_b, 6)
            }
        },
        "quality_delta": quality_delta,
        "delta": delta,
        "cost": {
            "token_delta_pct": token_delta_pct,
            "cost_delta_pct": cost_delta_pct,
            "total_eval_cost_usd": round(total_eval_cost, 6),
            "winner": cost_winner
        }
    },
    "verdict": {
        "winner": winner_result,
        "message": verdict_message
    }
}

# Output formatted JSON
print(json.dumps(result, indent=2))
PYTHON_EOF
}

# ---------- Print markdown report ----------
print_markdown_report() {
echo ""
echo "${BOLD}============================================${RESET}"
echo "${BOLD} Evaluation Report${RESET}"
echo "${BOLD}============================================${RESET}"
echo ""

echo "## Configuration"
echo ""
echo "- **Mode:** $MODE"
echo "- **Perspective:** $PERSPECTIVE"
echo "- **Prompts:** $PROMPTS_FILE ($NUM_PROMPTS total, $EVALUATED evaluated, $FAILED failed)"
if [ "$MODE" = "baseline" ]; then
  echo "- **Skill:** \`$SKILL_A\` (~${SKILL_TOKENS_A} tokens)"
else
  echo "- **Skill A:** \`$SKILL_A\` (~${SKILL_TOKENS_A} tokens)"
  echo "- **Skill B:** \`$SKILL_B\` (~${SKILL_TOKENS_B} tokens)"
fi
echo "- **Judge model:** $JUDGE_MODEL"
echo "- **Response model:** $RESPONSE_MODEL"
echo "- **Pricing:** \$${INPUT_COST_PER_MTOK}/MTok input, \$${OUTPUT_COST_PER_MTOK}/MTok output"
echo ""

# Per-Prompt Results (skip for cost-only perspective)
if [ "$PERSPECTIVE" != "cost" ]; then
echo "## Per-Prompt Results"
echo ""

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  if [ -z "${PROMPT_SCORES_A[$i]:-}" ]; then
    continue
  fi

  echo "### Prompt $((i + 1)): ${PROMPT_LABELS[$i]}..."
  echo ""

  # Quality dimensions (both variants)
  echo "#### Quality Scores"
  echo ""
  echo "| Dimension | ${LABEL_A} | ${LABEL_B} |"
  echo "|---|---|---|"

  IFS='|' read -r aa as ad asc <<< "${PROMPT_SCORES_A[$i]}"
  IFS='|' read -r ba bs bd bsc <<< "${PROMPT_SCORES_B[$i]}"

  echo "| Actionability | $aa | $ba |"
  echo "| Specificity | $as | $bs |"
  echo "| Domain Depth | $ad | $bd |"
  echo "| Self-Containment | $asc | $bsc |"

  a_qsum=$((aa + as + ad + asc))
  b_qsum=$((ba + bs + bd + bsc))
  echo "| **Quality Subtotal** | **$a_qsum/20** | **$b_qsum/20** |"
  echo ""

  # Claude best practices dimensions (skill A only)
  echo "#### Claude Best Practices (${LABEL_A} only)"
  echo ""
  echo "| Dimension | Score |"
  echo "|---|---|"

  IFS='|' read -r ap ast acc <<< "${PROMPT_PRACTICES_SCORES[$i]}"

  echo "| Progressive Disclosure | $ap |"
  echo "| Structure & Organization | $ast |"
  echo "| Claude-Centric Design | $acc |"

  a_psum=$((ap + ast + acc))
  echo "| **Practices Subtotal** | **$a_psum/15** |"
  echo ""

  a_combined=$((a_qsum + a_psum))
  echo "**${LABEL_A} Combined Total: $a_combined/35**"
  echo ""

  echo "> **Quality:** ${PROMPT_EXPLANATIONS[$i]}"
  echo ""
  echo "> **Best Practices:** ${PROMPT_PRACTICES_EXPLANATIONS[$i]}"
  echo ""
done

echo "## Dimension Averages"
echo ""

echo "### Quality Dimensions"
echo ""
echo "| Dimension | ${LABEL_A} | ${LABEL_B} | Delta |"
echo "|---|---|---|---|"

for dim in actionability specificity domain_depth self_containment; do
  case "$dim" in
    actionability)     a_val=$avg_a_action;   b_val=$avg_b_action;   label="Actionability" ;;
    specificity)       a_val=$avg_a_specific; b_val=$avg_b_specific; label="Specificity" ;;
    domain_depth)      a_val=$avg_a_depth;    b_val=$avg_b_depth;    label="Domain Depth" ;;
    self_containment)  a_val=$avg_a_self;     b_val=$avg_b_self;     label="Self-Containment" ;;
  esac
  dim_delta=$(python3 -c "print(f'{$a_val - $b_val:+.1f}')")
  echo "| $label | $a_val | $b_val | $dim_delta |"
done

echo "| **Quality Subtotal** | **$quality_a/20** | **$quality_b/20** | **$quality_delta** |"
echo ""

echo "### Claude Best Practices (${LABEL_A} only)"
echo ""
echo "| Dimension | ${LABEL_A} |"
echo "|---|---|"
echo "| Progressive Disclosure | $avg_a_progressive |"
echo "| Structure & Organization | $avg_a_structure |"
echo "| Claude-Centric Design | $avg_a_claude_centric |"
echo "| **Practices Subtotal** | **$practices_a/15** |"
echo ""

echo "### Overall"
echo ""
echo "| Metric | ${LABEL_A} | ${LABEL_B} |"
echo "|---|---|---|"
echo "| Quality (4 dims) | $quality_a/20 | $quality_b/20 |"
echo "| Practices (3 dims) | $practices_a/15 | N/A |"
echo "| **Combined** | **$total_a/35** | **$total_b/20** |"
echo ""
fi  # end skip for cost-only

# Cost Analysis section (shown for cost, quality, all)
if [ "$PERSPECTIVE" = "cost" ] || [ "$PERSPECTIVE" = "all" ] || [ "$PERSPECTIVE" = "quality" ]; then
echo "## Cost Analysis"
echo ""

echo "### Skill Size"
echo ""
echo "| Skill | Approx. Tokens |"
echo "|---|---|"
echo "| ${LABEL_A} | ~${SKILL_TOKENS_A} |"
if [ "$MODE" = "compare" ]; then
  echo "| ${LABEL_B} | ~${SKILL_TOKENS_B} |"
fi
echo ""

echo "### Per-Prompt Token Usage"
echo ""
echo "| Prompt | ${LABEL_A} In | ${LABEL_A} Out | ${LABEL_A} Total | ${LABEL_A} Cost | ${LABEL_B} In | ${LABEL_B} Out | ${LABEL_B} Total | ${LABEL_B} Cost |"
echo "|---|---|---|---|---|---|---|---|---|"

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  if [ -z "${PROMPT_COST_A[$i]:-}" ]; then
    continue
  fi

  IFS='|' read -r ca_in ca_out ca_cost ca_src <<< "${PROMPT_COST_A[$i]}"
  IFS='|' read -r cb_in cb_out cb_cost cb_src <<< "${PROMPT_COST_B[$i]}"
  ca_total=$((ca_in + ca_out))
  cb_total=$((cb_in + cb_out))

  echo "| $((i + 1)) | ${ca_in} | ${ca_out} | ${ca_total} | \$${ca_cost} | ${cb_in} | ${cb_out} | ${cb_total} | \$${cb_cost} |"
done

echo ""

echo "### Cost Summary"
echo ""
echo "| Metric | ${LABEL_A} | ${LABEL_B} | Delta |"
echo "|---|---|---|---|"
echo "| Avg input tokens | ${avg_input_tokens_a} | ${avg_input_tokens_b} | - |"
echo "| Avg output tokens | ${avg_output_tokens_a} | ${avg_output_tokens_b} | - |"
echo "| Avg total tokens | ${avg_total_tokens_a} | ${avg_total_tokens_b} | ${token_delta_pct}% |"
echo "| Avg cost per prompt | \$${avg_cost_a} | \$${avg_cost_b} | ${cost_delta_pct}% |"
echo "| **Total cost** | **\$${TOTAL_COST_A}** | **\$${TOTAL_COST_B}** | - |"
echo "| **Total eval cost** | **\$${total_eval_cost}** | - | - |"
echo ""

# Cost-per-quality-point (only if quality scores available)
if [ "$PERSPECTIVE" != "cost" ]; then
  cost_per_quality_a=$(python3 -c "
q = $quality_a
c = float('$avg_cost_a')
if q > 0:
    print(f'{c / q:.6f}')
else:
    print('N/A')
")
  cost_per_quality_b=$(python3 -c "
q = $quality_b
c = float('$avg_cost_b')
if q > 0:
    print(f'{c / q:.6f}')
else:
    print('N/A')
")
  echo "### Cost Efficiency"
  echo ""
  echo "| Metric | ${LABEL_A} | ${LABEL_B} |"
  echo "|---|---|---|"
  echo "| Cost per quality point | \$${cost_per_quality_a} | \$${cost_per_quality_b} |"
  echo ""
fi
fi  # end cost analysis

# Performance Analysis section (shown for performance or all)
if [ "$PERSPECTIVE" = "performance" ] || [ "$PERSPECTIVE" = "all" ]; then
echo "## Performance Analysis"
echo ""

echo "### Per-Prompt Performance"
echo ""
echo "| Prompt | ${LABEL_A} Latency | ${LABEL_A} TTFT | ${LABEL_A} Tok/s | ${LABEL_B} Latency | ${LABEL_B} TTFT | ${LABEL_B} Tok/s |"
echo "|---|---|---|---|---|---|---|"

for i in $(seq 0 $((NUM_PROMPTS - 1))); do
  if [ -z "${PROMPT_PERF_A[$i]:-}" ]; then
    continue
  fi

  IFS='|' read -r pa_lat pa_ttft pa_succ pa_ret pa_tps <<< "${PROMPT_PERF_A[$i]}"
  IFS='|' read -r pb_lat pb_ttft pb_succ pb_ret pb_tps <<< "${PROMPT_PERF_B[$i]}"

  echo "| $((i + 1)) | ${pa_lat}ms | ${pa_ttft}ms | ${pa_tps} | ${pb_lat}ms | ${pb_ttft}ms | ${pb_tps} |"
done

echo ""

echo "### Performance Summary"
echo ""
echo "| Metric | ${LABEL_A} | ${LABEL_B} |"
echo "|---|---|---|"
echo "| Avg latency | ${avg_a_latency}ms | ${avg_b_latency}ms |"
echo "| Avg TTFT | ${avg_a_ttft}ms | ${avg_b_ttft}ms |"
echo "| Avg tokens/s | ${avg_a_tps} | ${avg_b_tps} |"
echo "| Success rate | ${avg_a_success_rate}% | ${avg_b_success_rate}% |"
echo ""

echo "### Skill Loading"
echo ""
echo "| Metric | ${LABEL_A} |"
echo "|---|---|"
echo "| Skill discovery time (est.) | ${SKILL_DISCOVERY_MS_A}ms |"
echo "| Progressive disclosure levels | ${PROGRESSIVE_LEVELS_A} |"
echo "| Skill tokens | ~${SKILL_TOKENS_A} |"
if [ "$MODE" = "compare" ]; then
  echo ""
  echo "| Metric | ${LABEL_B} |"
  echo "|---|---|"
  echo "| Skill discovery time (est.) | ${SKILL_DISCOVERY_MS_B}ms |"
  echo "| Progressive disclosure levels | ${PROGRESSIVE_LEVELS_B} |"
  echo "| Skill tokens | ~${SKILL_TOKENS_B} |"
fi
echo ""
fi  # end performance analysis

echo "## Verdict"
echo ""

# Determine winner
if [ "$PERSPECTIVE" = "cost" ]; then
  # Cost-based verdict
  winner_result=$(python3 -c "
a = float('$TOTAL_COST_A')
b = float('$TOTAL_COST_B')
diff_pct = abs(a - b) / max(a, b, 0.0001) * 100
if diff_pct < 5:
    print('TIE')
elif a < b:
    print('A')
else:
    print('B')
")
  case "$winner_result" in
    A)
      if [ "$MODE" = "baseline" ]; then
        echo "${GREEN}${BOLD}The skill-loaded variant is ${cost_delta_pct}% cheaper.${RESET}"
      else
        echo "${GREEN}${BOLD}Skill A is cheaper by ${cost_delta_pct}%.${RESET}"
      fi
      ;;
    B)
      if [ "$MODE" = "baseline" ]; then
        echo "${GREEN}${BOLD}The baseline (no skill) is cheaper by ${cost_delta_pct}%.${RESET}"
      else
        echo "${GREEN}${BOLD}Skill B is cheaper by ${cost_delta_pct}%.${RESET}"
      fi
      ;;
    TIE)
      echo "${YELLOW}${BOLD}No significant cost difference between variants (${cost_delta_pct}%).${RESET}"
      ;;
  esac
else
  # Quality-based verdict
  winner_result=$(python3 -c "
a = ($TOTAL_A_ACTION + $TOTAL_A_SPECIFIC + $TOTAL_A_DEPTH + $TOTAL_A_SELF) / $EVALUATED
b = ($TOTAL_B_ACTION + $TOTAL_B_SPECIFIC + $TOTAL_B_DEPTH + $TOTAL_B_SELF) / $EVALUATED
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
fi

echo ""
echo "---"
echo "Generated by eval-skill-quality.sh at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
}

# ---------- Generate and output report ----------
if [ -n "$OUTPUT_FILE" ]; then
  # Redirect stdout to file for report generation
  exec > "$OUTPUT_FILE"
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
  # Export variables for Python JSON generation
  export MODE JUDGE_MODEL RESPONSE_MODEL SKILL_A SKILL_B PROMPTS_FILE NUM_PROMPTS EVALUATED FAILED PERSPECTIVE
  export JSON_TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  export avg_a_action avg_a_specific avg_a_depth avg_a_self total_a
  export avg_b_action avg_b_specific avg_b_depth avg_b_self total_b delta
  export avg_a_progressive avg_a_structure avg_a_claude_centric
  export quality_a quality_b quality_delta practices_a
  export avg_a_latency avg_a_ttft avg_a_success_rate avg_a_tps
  export avg_b_latency avg_b_ttft avg_b_success_rate avg_b_tps
  export SKILL_DISCOVERY_MS_A SKILL_DISCOVERY_MS_B PROGRESSIVE_LEVELS_A PROGRESSIVE_LEVELS_B
  # Cost variables
  export SKILL_TOKENS_A SKILL_TOKENS_B INPUT_COST_PER_MTOK OUTPUT_COST_PER_MTOK
  export TOTAL_COST_A TOTAL_COST_B total_eval_cost
  export avg_cost_a avg_cost_b
  export avg_input_tokens_a avg_output_tokens_a avg_total_tokens_a
  export avg_input_tokens_b avg_output_tokens_b avg_total_tokens_b
  export token_delta_pct cost_delta_pct

  # Determine winner (quality-based for non-cost, cost-based for cost perspective)
  if [ "$PERSPECTIVE" = "cost" ]; then
    winner_result=$(python3 -c "
a = float('$TOTAL_COST_A')
b = float('$TOTAL_COST_B')
diff_pct = abs(a - b) / max(a, b, 0.0001) * 100
if diff_pct < 5:
    print('TIE')
elif a < b:
    print('A')
else:
    print('B')
")
  else
    winner_result=$(python3 -c "
a = ($TOTAL_A_ACTION + $TOTAL_A_SPECIFIC + $TOTAL_A_DEPTH + $TOTAL_A_SELF) / $EVALUATED
b = ($TOTAL_B_ACTION + $TOTAL_B_SPECIFIC + $TOTAL_B_DEPTH + $TOTAL_B_SELF) / $EVALUATED
diff = a - b
if abs(diff) < 0.5:
    print('TIE')
elif diff > 0:
    print('A')
else:
    print('B')
")
  fi
  export winner_result

  # Generate verdict message
  if [ "$PERSPECTIVE" = "cost" ]; then
    case "$winner_result" in
      A)
        if [ "$MODE" = "baseline" ]; then
          verdict_message="The skill-loaded variant is ${cost_delta_pct}% cheaper."
        else
          verdict_message="Skill A is cheaper by ${cost_delta_pct}%."
        fi
        ;;
      B)
        if [ "$MODE" = "baseline" ]; then
          verdict_message="The baseline (no skill) is cheaper by ${cost_delta_pct}%."
        else
          verdict_message="Skill B is cheaper by ${cost_delta_pct}%."
        fi
        ;;
      TIE)
        verdict_message="No significant cost difference between variants (${cost_delta_pct}%)."
        ;;
    esac
  else
    case "$winner_result" in
      A)
        if [ "$MODE" = "baseline" ]; then
          verdict_message="The skill improves output quality by $delta points on average."
        else
          verdict_message="Skill A wins by $delta points on average."
        fi
        ;;
      B)
        if [ "$MODE" = "baseline" ]; then
          verdict_message="The skill does NOT improve output quality ($delta points). Consider revising the skill content."
        else
          verdict_message="Skill B wins by $delta points on average."
        fi
        ;;
      TIE)
        verdict_message="No significant difference between variants (delta: $delta)."
        ;;
    esac
  fi
  export verdict_message

  # Export prompt data
  for i in $(seq 0 $((NUM_PROMPTS - 1))); do
    if [ -n "${PROMPT_SCORES_A[$i]:-}" ]; then
      export "PROMPT_LABEL_${i}=${PROMPT_LABELS[$i]}"
      export "PROMPT_SCORES_A_${i}=${PROMPT_SCORES_A[$i]}"
      export "PROMPT_SCORES_B_${i}=${PROMPT_SCORES_B[$i]}"
      export "PROMPT_EXPLANATION_${i}=${PROMPT_EXPLANATIONS[$i]}"
      export "PROMPT_PERF_A_${i}=${PROMPT_PERF_A[$i]}"
      export "PROMPT_PERF_B_${i}=${PROMPT_PERF_B[$i]}"
      export "PROMPT_PRACTICES_${i}=${PROMPT_PRACTICES_SCORES[$i]}"
      export "PROMPT_PRACTICES_EXPL_${i}=${PROMPT_PRACTICES_EXPLANATIONS[$i]}"
      export "PROMPT_COST_A_${i}=${PROMPT_COST_A[$i]}"
      export "PROMPT_COST_B_${i}=${PROMPT_COST_B[$i]}"
    fi
  done

  generate_json_report
else
  print_markdown_report
fi

if [ -n "$OUTPUT_FILE" ]; then
  echo "Report saved to: $OUTPUT_FILE" >&2
fi
