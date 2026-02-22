# Scripts Directory

Automation scripts for the Skill Builder project.

## Directory Structure

```
scripts/
├── README.md                      # This file
├── build-plugin-skill.sh          # Package workspace CLAUDE.md into skill references
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
    ├── t3-mode-detection.sh       # T3: State detection + intent dispatch
    ├── t4-agent-smoke.sh          # T4: Agent smoke tests
    └── t5-e2e-workflow.sh         # T5: E2E workflow
```

## Plugin Test Harness

`test-plugin.sh` runs the full plugin test suite across five tiers, from free structural checks to a full paid E2E run. Each tier builds on the previous one.

### Tiers

| Tier | Name | Cost | What it checks |
|---|---|---|---|
| T1 | Structural Validation | Free | plugin.json, agent files, frontmatter, model tiers, coordinator content, bundled references |
| T2 | Plugin Loading | ~$0.30 | Claude loads the plugin, responds to queries, skill can be triggered |
| T3 | State Detection + Intent Dispatch | ~$0.40 | Coordinator identifies all 9 phases from filesystem artifacts; dispatches new_skill, start_fresh, and express intents correctly |
| T4 | Agent Smoke Tests | ~$0.50 | Individual agents (research-orchestrator, answer-evaluator, confirm-decisions) produce expected output |
| T5 | Full E2E Workflow | ~$5.00 | End-to-end run from scoping through validation; asserts artifacts exist at each phase |

### Running Tests

```bash
# Run all tiers
./scripts/test-plugin.sh

# Run specific tiers
./scripts/test-plugin.sh t1
./scripts/test-plugin.sh t1 t2 t3

# Run by tag (run tests related to what you changed)
./scripts/test-plugin.sh --tag @coordinator   # t1 t2 t3
./scripts/test-plugin.sh --tag @agents        # t1 t4
./scripts/test-plugin.sh --tag @workflow      # t3 t5
./scripts/test-plugin.sh --tag @structure     # t1
./scripts/test-plugin.sh --tag @all           # t1-t5

# List all tiers and tags
./scripts/test-plugin.sh --list
```

### What to run after a change

| What changed | Command |
|---|---|
| `agents/*.md` | `./scripts/test-plugin.sh t1` |
| `skills/building-skills/SKILL.md` | `./scripts/test-plugin.sh t1 t2 t3` |
| Agent instructions (`agent-sources/workspace/CLAUDE.md`) | `./scripts/build-plugin-skill.sh && ./scripts/test-plugin.sh t1` |
| Agent behavior (smoke test) | `./scripts/test-plugin.sh t4` |
| Full workflow | `./scripts/test-plugin.sh t5` |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for T2–T5 |
| `CLAUDE_BIN` | `claude` | Path to the Claude CLI binary |
| `PLUGIN_DIR` | repo root | Override the plugin directory |
| `MAX_BUDGET_T2` | `0.30` | Max spend (USD) for T2 |
| `MAX_BUDGET_T3` | `0.40` | Max spend (USD) for T3 |
| `MAX_BUDGET_T4` | `0.50` | Max spend (USD) for T4 |
| `MAX_BUDGET_T5` | `5.00` | Max spend (USD) for T5 |
| `KEEP_TEMP` | `0` | Set to `1` to preserve temp workspaces after the run |
| `VERBOSE` | `0` | Set to `1` for verbose output (fixture paths, raw LLM output on failure) |
| `FOREGROUND` | `0` | T5 only — set to `1` to stream Claude output live (see below) |

### T5: Watching a run in progress

T5 is the full E2E workflow and can run for 15–45 minutes. By default it runs in the background and prints artifact-based phase milestones and a heartbeat every 30s:

```
  [t5] started — budget=$5.00, timeout=45min
  [t5] 28s — reached: scoping
  [t5] 95s — reached: research
  [t5] 155s — running (last: research)
  [t5] 210s — reached: clarification
  ...
  [t5] 432s — done
```

**To watch Claude's actual output live** (tool calls, agent spawns, written files):

```bash
FOREGROUND=1 ./scripts/test-plugin.sh t5
```

In foreground mode, Claude's stdout streams directly to your terminal via `tee`. The output is still captured and the same test assertions run at the end. Use this when you need to see exactly where the coordinator is stuck.

**To keep the workspace after a run** (inspect files Claude wrote):

```bash
KEEP_TEMP=1 ./scripts/test-plugin.sh t5
# or combine both:
FOREGROUND=1 KEEP_TEMP=1 ./scripts/test-plugin.sh t5
```

The workspace path is printed at the start of the T5 run when `VERBOSE=1`.

---

## Scripts Overview

### Plugin Build & Validation

**`build-plugin-skill.sh`**
- Packages `agent-sources/workspace/CLAUDE.md` as `workspace-context.md` and copies `skill-builder-practices/` into `skills/building-skills/references/`
- Run after modifying workspace CLAUDE.md
- Use `--check` flag to verify references are fresh (for CI)
- Usage: `./scripts/build-plugin-skill.sh` or `./scripts/build-plugin-skill.sh --check`

**`validate.sh`**
- Structural validation (same checks as T1 in the test harness)
- Validates plugin manifest, agent frontmatter, model tiers, reference files, coordinator content
- Fast and free — no LLM calls
- Usage: `./scripts/validate.sh`

**`test-plugin.sh`**
- Full test harness (T1-T5)
- Requires Claude CLI and API key for T2+
- Usage: `./scripts/test-plugin.sh [tier...] [--tag TAG]`

### Skill Evaluation

**`eval/eval-skill-quality.sh`**
- Multi-perspective skill evaluation harness
- Measures quality, cost, and performance
- See `eval/README.md` for detailed documentation
- Usage: `./scripts/eval/eval-skill-quality.sh --help`

---

## CI/CD Integration

**Validation (runs on every PR — free):**
```bash
./scripts/build-plugin-skill.sh --check
./scripts/validate.sh
```

**Full Testing (runs on main branch):**
```bash
./scripts/test-plugin.sh
```

**Skill Evaluation (manual/scheduled):**
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline path/to/SKILL.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective all \
  --format json \
  --output results/evaluation-$(date +%Y%m%d).json
```

---

## Development Workflow

1. Modify agents in `agents/` or the coordinator in `skills/building-skills/SKILL.md`
2. If you modified `agent-sources/workspace/CLAUDE.md`, run `./scripts/build-plugin-skill.sh`
3. Validate: `./scripts/validate.sh`
4. Test: `./scripts/test-plugin.sh t1 t2 t3` (or the appropriate tier for what you changed)
5. Full E2E: `./scripts/test-plugin.sh t5` (optional, expensive)

## See Also

- `eval/README.md` — Comprehensive skill evaluation documentation
- `plugin-tests/lib.sh` — Test utilities and helpers
- `../CLAUDE.md` — Main development guide
- `../CLAUDE-PLUGIN.md` — Plugin-specific documentation
