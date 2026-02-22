# Scripts Directory

Automation scripts for the Skill Builder project.

## Directory Structure

```
scripts/
├── README.md                      # This file
├── build-plugin-skill.sh          # Package workspace CLAUDE.md into skill references
├── validate.sh                    # Structural validation
├── test-plugin.sh                 # Full E2E plugin test (~$5)
├── eval/                          # Skill evaluation harness
│   ├── README.md                  # Evaluation documentation
│   ├── eval-skill-quality.sh      # Main evaluation script
│   └── prompts/                   # Test prompts by skill type
└── plugin-tests/                  # Plugin test support
    ├── lib.sh                     # Shared test utilities
    ├── fixtures.sh                # Test fixtures (used by T5)
    └── t5-e2e-workflow.sh         # T5: Full E2E workflow
```

## Plugin Tests

Plugin tests are split between Vitest (fast, natively integrated) and a shell script for the expensive full E2E run.

### Vitest tests — structural + LLM (run from `app/`)

```bash
cd app

npm run test:plugin              # All plugin tests (free checks + LLM, skip LLM if no API key)
npm run test:plugin:structural   # Structural checks only — free, no API key needed
npm run test:plugin:loading      # Plugin loading tests (~$0.30)
npm run test:plugin:modes        # State detection + intent dispatch (~$0.40)
npm run test:plugin:agents       # Agent smoke tests (~$0.50)
```

Each `it()` block is a standalone Vitest test — filter by name:
```bash
npx vitest run --config vitest.config.plugin.ts -t "agent exists: answer-evaluator"
npx vitest run --config vitest.config.plugin.ts -t "detects: clarification"
```

LLM tests are skipped automatically when `ANTHROPIC_API_KEY` is not set.

### Full E2E Workflow — T5 (~$5, run from repo root)

```bash
./scripts/test-plugin.sh                 # Full E2E workflow (background + artifact polling)
FOREGROUND=1 ./scripts/test-plugin.sh   # Stream Claude output live
KEEP_TEMP=1 ./scripts/test-plugin.sh    # Keep workspace after run
```

### What to run after a change

| What changed | Command |
|---|---|
| `agents/*.md` | `cd app && npm run test:plugin:structural` |
| `skills/building-skills/SKILL.md` | `cd app && npm run test:plugin` |
| Agent instructions (`agent-sources/workspace/CLAUDE.md`) | `./scripts/build-plugin-skill.sh && cd app && npm run test:plugin:structural` |
| Agent behavior (smoke test) | `cd app && npm run test:plugin:agents` |
| Full workflow | `./scripts/test-plugin.sh` |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for LLM tests |
| `CLAUDE_BIN` | `claude` | Path to the Claude CLI binary |
| `PLUGIN_DIR` | repo root | Override the plugin directory |
| `MAX_BUDGET_T2` | `0.10` | Max spend (USD) for loading tests |
| `MAX_BUDGET_T3` | `0.25` | Max spend (USD) for mode detection tests |
| `MAX_BUDGET_T4` | `0.50` | Max spend (USD) for agent smoke tests |
| `MAX_BUDGET_T5` | `5.00` | Max spend (USD) for full E2E |
| `KEEP_TEMP` | `0` | Set to `1` to preserve temp workspaces |
| `VERBOSE` | `0` | Set to `1` for verbose output |
| `FOREGROUND` | `0` | T5 only — set to `1` to stream Claude output live |

### T5: Watching a run in progress

T5 runs in the background by default and prints artifact-based phase milestones:

```
  [t5] started — budget=$5.00, timeout=45min
  [t5] 28s — reached: scoping
  [t5] 95s — reached: research
  [t5] 210s — reached: clarification
  [t5] 432s — done
```

**To watch Claude's output live:**
```bash
FOREGROUND=1 ./scripts/test-plugin.sh
```

**To keep the workspace after a run:**
```bash
KEEP_TEMP=1 FOREGROUND=1 ./scripts/test-plugin.sh
```

---

## Scripts Overview

**`build-plugin-skill.sh`**
- Packages `agent-sources/workspace/CLAUDE.md` as `workspace-context.md` into `skills/building-skills/references/`
- Run after modifying workspace CLAUDE.md
- Use `--check` flag to verify references are fresh (for CI)

**`validate.sh`**
- Structural validation: plugin manifest, agent frontmatter, model tiers, reference files, coordinator content
- Fast and free — no LLM calls

**`test-plugin.sh`**
- Full E2E workflow test (~$5)
- Requires Claude CLI and API key

**`eval/eval-skill-quality.sh`**
- Multi-perspective skill evaluation harness
- See `eval/README.md` for documentation

---

## CI/CD Integration

**Validation (runs on every PR — free):**
```bash
./scripts/build-plugin-skill.sh --check
./scripts/validate.sh
cd app && npm run test:plugin:structural
```

**Full plugin testing:**
```bash
cd app && npm run test:plugin    # LLM tests (requires API key)
./scripts/test-plugin.sh        # Full E2E (~$5)
```

---

## Development Workflow

1. Modify agents in `agents/` or coordinator in `skills/building-skills/SKILL.md`
2. If you modified `agent-sources/workspace/CLAUDE.md`, run `./scripts/build-plugin-skill.sh`
3. Validate: `./scripts/validate.sh`
4. Test: `cd app && npm run test:plugin` (or individual suite for what you changed)
5. Full E2E: `./scripts/test-plugin.sh` (optional, expensive)

## See Also

- `eval/README.md` — Comprehensive skill evaluation documentation
- `plugin-tests/lib.sh` — Test utilities and helpers
- `../CLAUDE.md` — Main development guide
- `../CLAUDE-PLUGIN.md` — Plugin-specific documentation
