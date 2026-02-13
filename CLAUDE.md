# Skill Builder

Multi-agent workflow for creating domain-specific Claude skills. Two frontends (CLI plugin + Tauri desktop app) share the same agents and references.

@import CLAUDE-APP.md
@import CLAUDE-PLUGIN.md

## Dev Commands

```bash
# Desktop app
cd app && npm install && npm run sidecar:build
npm run dev                              # Dev mode (hot reload)

# Testing (all from app/)
./tests/run.sh                           # All levels (unit + integration + e2e)
./tests/run.sh unit                      # Level 1: stores, utils, hooks, rust, sidecar
./tests/run.sh integration               # Level 2: component + page tests
./tests/run.sh e2e                       # Level 3: Playwright
./tests/run.sh e2e --tag @workflow       # Level 3, filtered by tag
npm run test:unit                        # Unit tests only (frontend)
npm run test:integration                 # Integration tests only (frontend)
npm run test:e2e                         # All E2E tests
cd src-tauri && cargo test               # Rust tests

# Plugin
./scripts/validate.sh                    # Structural validation
./scripts/test-plugin.sh                 # Full test harness (T1-T5)
claude --plugin-dir .                    # Load plugin locally
```

## Testing

### When to write tests

1. **New state logic** (store actions, derived state) -> store unit tests
2. **New Rust command** with testable logic -> `#[cfg(test)]` tests
3. **New UI interaction** (button states, form validation) -> component test
4. **New page or major flow** -> E2E test (happy path)
5. **Bug fix** -> regression test

Purely cosmetic changes or simple wiring don't require tests. If unclear, ask the user.

### Test discipline

Before writing any test code, read existing tests for the files you changed:
1. Update tests that broke due to your changes
2. Remove tests that are now redundant
3. Add new tests only for genuinely new behavior
4. Never add tests just to increase count — every test must catch a real regression

### Choosing which tests to run

Before committing, consult `app/tests/TEST_MANIFEST.md` to determine which tests cover the files you changed. The manifest maps every source file to its unit tests, integration tests, and E2E tags.

**Quick rules:**
- Changed a store? → `./tests/run.sh unit` + E2E tag from manifest
- Changed a component? → `./tests/run.sh integration` + E2E tag from manifest
- Changed a Rust command? → `cargo test` + E2E tag if UI-facing
- Changed `src/lib/tauri.ts` or test mocks? → `./tests/run.sh` (all levels)
- Changed shared files (`agents/`, `references/`, `.claude-plugin/`)? → `./tests/run.sh plugin --tag <tag>`
- Unsure? → `./tests/run.sh` runs everything

**E2E tags:** `@dashboard`, `@settings`, `@workflow`, `@workflow-agent`, `@navigation`

**Plugin tags:** `@structure`, `@agents`, `@coordinator`, `@workflow`, `@all`

### Updating the test manifest

When you add, remove, or rename test files, update `app/tests/TEST_MANIFEST.md` to keep the source-to-test mapping current. The manifest has tables per source category (stores, hooks, components, pages, Rust, sidecar, plugin). Each row maps a source file to its unit tests, integration tests, and E2E tag.

## Code Style

- TypeScript strict mode, no `any`
- Zustand stores: one file per store in `app/src/stores/`
- Rust commands: one module per concern in `app/src-tauri/src/commands/`
- Tailwind 4 + shadcn/ui for all UI components
- Granular commits: one concern per commit, run tests before each

## Gotchas

- **SDK has NO team tools**: `@anthropic-ai/claude-agent-sdk` does NOT support TeamCreate, TaskCreate, SendMessage. Use the Task tool for sub-agents. Multiple Task calls in same turn run in parallel.
- **Node.js 18-24 only**: Node 25+ causes SDK crashes. Checked at app startup.
- **Parallel worktrees**: Set `DEV_PORT=<port>` to avoid conflicts (convention: `1000 + issue_number`).
- **Verify before committing**: `cd app && npx tsc --noEmit` (frontend) + `cargo check --manifest-path app/src-tauri/Cargo.toml` (backend)

## Shared Components

Both frontends use the same files -- no conversion needed:
- `agents/{type}/` -- 6 agents per type (domain, platform, source, data-engineering)
- `agents/shared/` -- 3 shared sub-agents (merge, research-patterns, research-data)
- `references/shared-context.md` -- domain definitions, file formats, content principles

## Skill Configuration

### Issue Management
- **PR title format**: `VD-XXX: short description`
- **PR body link**: `Fixes VD-XXX`

## Custom Skills

### /create-issue
When the user runs /create-issue or asks to create a Linear issue, log a bug, file a ticket,
track a feature idea, break down a large issue, or decompose an issue into smaller ones
(e.g. "break down VD-123", "decompose VD-123", "split VD-123"),
read and follow the skill at `.claude/skills/create-linear-issue/SKILL.md`.

### /implement-issue
When the user runs /implement-issue, or mentions a Linear issue identifier (e.g. "VD-123", "implement VD-123",
"work on VD-452", "build VD-100", "fix VD-99"), or asks to implement, build, fix, or work on a Linear issue,
read and follow the skill at `.claude/skills/implement-linear-issue/SKILL.md`.

### /close-issue
When the user runs /close-issue, or asks to close, complete, merge, or ship a Linear issue (e.g. "close VD-123",
"merge VD-453", "ship VD-100", "complete VD-99"), read and follow the skill at
`.claude/skills/close-linear-issue/SKILL.md`.
