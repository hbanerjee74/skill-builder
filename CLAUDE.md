# Skill Builder

Multi-agent workflow for creating domain-specific Claude skills. Two frontends (CLI plugin + Tauri desktop app) share the same agents and references.

@import CLAUDE-APP.md
@import CLAUDE-PLUGIN.md

**Companion files** (imported above, must be reviewed together with this file):
- `CLAUDE-APP.md` — Desktop app architecture, Rust/frontend conventions, logging rules, git/publishing workflow
- `CLAUDE-PLUGIN.md` — Plugin structure, agent management, validation hooks

**CLAUDE.md maintenance rule**: These files contain architecture, conventions, and guidelines — not product details. Do not add counts (agent counts, step counts, test counts), feature descriptions, or any fact the agent can discover by reading code. If it will go stale when the code changes, it doesn't belong here — point to the source file instead.

## Workflow

The coordinator (`skills/generate-skill/SKILL.md`) defines the full step sequence, resume logic, and human review gates. Read it for workflow details — don't hardcode step counts or names here.

## Model Tiers

Model tiers are defined per-agent in frontmatter (`agents/*.md`). Run `./scripts/validate.sh` to verify tiers match expectations.

The app overrides this with a global user preference in Settings. The plugin uses per-agent model tiers defined in agent frontmatter.

## Extended Thinking

Agent prompts are optimized for thinking mode using goal-oriented patterns (not step-by-step prescriptions). When Claude Code adds `thinking` or `effort` as frontmatter fields, update:
- confirm-decisions agent: `effort: max`
- generate-skill agents: `effort: high`
- research orchestrators: `effort: high`
- validate-skill agents: `effort: medium`
- consolidate-research agent: `effort: high`

## Dev Commands

```bash
# Desktop app (run from app/)
cd app && npm install && npm run sidecar:build
npm run dev                              # Dev mode (hot reload)
MOCK_AGENTS=true npm run dev             # Mock mode (no API calls, replays bundled templates)

# Testing — app (run from app/)
app/tests/run.sh                         # All levels (unit + integration + e2e + plugin + eval)
app/tests/run.sh unit                    # Level 1: stores, utils, hooks, rust, sidecar
app/tests/run.sh integration             # Level 2: component + page tests
app/tests/run.sh e2e                     # Level 3: Playwright
app/tests/run.sh e2e --tag @workflow     # Level 3, filtered by tag
cd app && npm run test:unit              # Unit tests only (frontend)
cd app && npm run test:integration       # Integration tests only (frontend)
cd app && npm run test:e2e               # All E2E tests
cd app/src-tauri && cargo test           # Rust tests

# Testing — plugin (run from repo root)
./scripts/build-plugin-skill.sh          # Package workspace CLAUDE.md into skill references
./scripts/build-plugin-skill.sh --check  # Check if reference files are stale (CI)
./scripts/validate.sh                    # Structural validation
./scripts/test-plugin.sh                 # Full test harness (T1-T5)
claude --plugin-dir .                    # Load plugin locally

# Skill evaluation (LLM-as-judge, run from repo root)
./scripts/eval/eval-skill-quality.sh --help                        # Usage and options
./scripts/eval/eval-skill-quality.sh --baseline path/to/SKILL.md \ # Skill vs no-skill
  --prompts scripts/eval/prompts/data-engineering.txt
./scripts/eval/eval-skill-quality.sh --compare v1/SKILL.md v2/SKILL.md \ # Skill vs skill
  --prompts scripts/eval/prompts/data-engineering.txt
```

## Testing

### When to write tests

**App:**
1. New state logic (store actions, derived state) → store unit tests
2. New Rust command with testable logic → `#[cfg(test)]` tests
3. New UI interaction (button states, form validation) → component test
4. New page or major flow → E2E test (happy path)
5. Bug fix → regression test

Purely cosmetic changes or simple wiring don't require tests. If unclear, ask the user.

**Plugin:** Agent prompts and coordinator changes are validated by the existing test tiers — don't write new tests, run the appropriate tier instead (see quick rules below).

### Test discipline

Before writing any test code, read existing tests for the files you changed:
1. Update tests that broke due to your changes
2. Remove tests that are now redundant
3. Add new tests only for genuinely new behavior
4. Never add tests just to increase count — every test must catch a real regression

### Choosing which tests to run

**Frontend (stores, hooks, components, pages):** Use `npm run test:changed` to auto-detect and run tests affected by your changes. This uses `vitest --changed` which traces module dependencies — no manual mapping needed. For targeted runs: `npm run test:unit`, `npm run test:integration`, or specific test files.

**Rust:** Run `cargo test --manifest-path app/src-tauri/Cargo.toml <module>` for the module you changed. If the command is UI-facing, also run the cross-layer E2E tag from `app/tests/TEST_MANIFEST.md`.

**Sidecar:** `cd app/sidecar && npx vitest run`

**Shared infrastructure** (`src/lib/tauri.ts`, test mocks, config files): Run `app/tests/run.sh` (all levels). See the manifest for the full list.

**App quick rules:**
- Changed a store/hook/component/page? → `npm run test:changed`
- Changed a Rust command? → `cargo test <module>` + E2E tag from `app/tests/TEST_MANIFEST.md`
- Changed `src/lib/tauri.ts` or test mocks? → `app/tests/run.sh` (all levels)
- Unsure? → `app/tests/run.sh` runs everything

**Plugin quick rules:**
- Changed an agent (`agents/`)? → `./scripts/test-plugin.sh t1`
- Changed the coordinator (`skills/generate-skill/SKILL.md`)? → `./scripts/test-plugin.sh t1 t2 t3`
- Changed `agent-sources/workspace/CLAUDE.md` (agent instructions)? → `./scripts/build-plugin-skill.sh && ./scripts/test-plugin.sh t1`
- Changed `.claude-plugin/plugin.json`? → `./scripts/test-plugin.sh t1 t2`
- Unsure? → `./scripts/test-plugin.sh` runs all tiers

**Eval quick rules:**
- Changed `scripts/eval/eval-skill-quality.sh` or `scripts/eval/test-eval-harness.sh`? → `app/tests/run.sh eval`
- Changed `scripts/eval/prompts/`? → no tests needed (prompts are data files)

**Cross-cutting** (shared files affect both app and plugin):
- Changed `agents/`, `references/`, or `.claude-plugin/`? → `./scripts/test-plugin.sh t1`

Plugin test tiers (T1-T5), environment variables, and tags are documented in `./scripts/test-plugin.sh --help`. E2E tags are in `app/tests/TEST_MANIFEST.md`.

### Updating the test manifest

Update `app/tests/TEST_MANIFEST.md` only when adding new Rust commands (add the cargo test filter + E2E tag), new E2E spec files, new plugin source patterns, or changing shared infrastructure files. Frontend test mappings are handled automatically by `vitest --changed` and naming conventions.

## Code Style

- Granular commits: one concern per commit, run tests before each

## Gotchas

- **SDK has NO team tools**: `@anthropic-ai/claude-agent-sdk` does NOT support TeamCreate, TaskCreate, SendMessage. Use the Task tool for sub-agents. Multiple Task calls in same turn run in parallel.
- **Parallel worktrees**: `npm run dev` auto-assigns a free port.

## Shared Components

Both frontends use the same files — no conversion needed:
- `agents/` — agent prompts (flat directory). Agent count is validated by `./scripts/validate.sh`.
- `agent-sources/workspace/CLAUDE.md` — agent instructions (protocols, content principles, best practices); the app deploys this to `.claude/CLAUDE.md` in workspace, the plugin packages it into `skills/generate-skill/references/` via `scripts/build-plugin-skill.sh`

## Issue Management

- **PR title format**: `VD-XXX: short description`
- **PR body link**: `Fixes VD-XXX`

## Custom Skills

### /create-linear-issue
When the user runs /create-linear-issue or asks to create a Linear issue, log a bug, file a ticket,
track a feature idea, break down a large issue, or decompose an issue into smaller ones
(e.g. "break down VD-123", "decompose VD-123", "split VD-123"),
read and follow the skill at `.claude/skills/create-linear-issue/SKILL.md`.

### /implement-linear-issue
When the user runs /implement-linear-issue, or mentions a Linear issue identifier (e.g. "VD-123", "implement VD-123",
"work on VD-452", "working on VD-100", "build VD-100", "fix VD-99"), or asks to implement, build, fix, or work on a Linear issue,
read and follow the skill at `.claude/skills/implement-linear-issue/SKILL.md`.

### /close-linear-issue
When the user runs /close-linear-issue, or asks to close, complete, merge, or ship a Linear issue (e.g. "close VD-123",
"merge VD-453", "ship VD-100", "complete VD-99"), read and follow the skill at
`.claude/skills/close-linear-issue/SKILL.md`.
