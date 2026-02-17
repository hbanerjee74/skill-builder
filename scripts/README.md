# Scripts Directory

Automation scripts for the Skill Builder project.

## Directory Structure

```
scripts/
├── README.md                      # This file
├── validate.sh                    # Structural validation (T1 checks)
├── test-plugin.sh                 # Full plugin test harness (T1-T5)
├── eval/                          # Skill evaluation harness
│   ├── README.md                  # Evaluation documentation
│   ├── eval-skill-quality.sh      # Main evaluation script
│   ├── prompts/                   # Test prompts by skill type
│   │   ├── data-engineering.txt
│   │   ├── domain.txt
│   │   ├── platform.txt
│   │   └── source.txt
│   └── results/                   # Evaluation outputs (gitignored)
└── plugin-tests/                  # Plugin test harness
    ├── lib.sh                     # Shared test utilities
    ├── fixtures.sh                # Test fixtures
    ├── t1-structural.sh           # T1: Structural validation
    ├── t2-plugin-loading.sh       # T2: Plugin loading
    ├── t3-mode-detection.sh       # T3: Mode detection
    ├── t4-agent-smoke.sh          # T4: Agent smoke tests
    └── t5-e2e-workflow.sh         # T5: E2E workflow

```

## Scripts Overview

### Plugin Validation

**`validate.sh`**
- Structural validation (T1 checks)
- Validates plugin manifest, agent frontmatter, model tiers
- Fast, runs in CI/CD
- Usage: `./scripts/validate.sh`

**`test-plugin.sh`**
- Full test harness (T1-T5)
- Runs all plugin tests including E2E workflows
- Requires Claude CLI and API key
- Usage: `./scripts/test-plugin.sh`

### Skill Evaluation

**`eval/eval-skill-quality.sh`**
- Multi-perspective skill evaluation harness
- Measures quality, cost, and performance
- See `eval/README.md` for detailed documentation
- Usage: `./scripts/eval/eval-skill-quality.sh --help`

## Quick Commands

```bash
# Plugin validation
./scripts/validate.sh                        # Structural validation (free)
./scripts/test-plugin.sh                     # Full test harness (requires API key)

# Skill evaluation
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt

# See eval/README.md for comprehensive evaluation documentation
```

## Environment Variables

**Plugin Testing:**
- `ANTHROPIC_API_KEY` - Required for test harness
- `CLAUDE_BIN` - Path to claude binary (default: `claude`)
- `VERBOSE` - Set to `1` for verbose output

**Skill Evaluation:**
- `ANTHROPIC_API_KEY` - Required for evaluation
- `CLAUDE_BIN` - Path to claude binary (default: `claude`)
- `JUDGE_MODEL` - Model for judge LLM (default: `sonnet`)
- `RESPONSE_MODEL` - Model for responses (default: `sonnet`)
- `VERBOSE` - Set to `1` for verbose output

## CI/CD Integration

**Validation (runs on every PR):**
```bash
./scripts/validate.sh
```

**Full Testing (runs on main branch):**
```bash
./scripts/test-plugin.sh
```

**Skill Evaluation (manual/scheduled):**
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective all \
  --format json \
  --output results/evaluation-$(date +%Y%m%d).json
```

## Development Workflow

1. **Modify agents** in `agents/`
2. **Validate changes**: `./scripts/validate.sh`
3. **Test locally**: `./scripts/test-plugin.sh`
4. **Evaluate skills**: `./scripts/eval/eval-skill-quality.sh` (see eval/README.md)

## See Also

- `eval/README.md` - Comprehensive skill evaluation documentation
- `plugin-tests/lib.sh` - Test utilities and helpers
- `../CLAUDE.md` - Main development guide
- `../CLAUDE-PLUGIN.md` - Plugin-specific documentation
