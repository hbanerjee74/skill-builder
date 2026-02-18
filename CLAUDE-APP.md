# Skill Builder -- Desktop App

Tauri v2 desktop application for building Claude skills. All code lives in `app/`.

## Architecture

React 19 (WebView) → Tauri IPC → Rust backend → spawns Node.js sidecar (`@anthropic-ai/claude-agent-sdk`)

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Router, react-markdown

**Backend:** Tauri 2, rusqlite, git2, reqwest, notify, pulldown-cmark, tauri-plugin-shell, tokio

**Agent Runtime:** Node.js + `@anthropic-ai/claude-agent-sdk` (sidecar process). **No hot-reload** — restart `npm run dev` after editing `app/sidecar/` files.

**Runtime Dependency:** Node.js 18-24 (checked on startup; Node 25+ causes SDK crashes)

## Agent Orchestration (Claude Agent SDK)

Agents run via the **Claude Agent SDK** in a Node.js sidecar process.

1. **Rust backend** spawns `node agent-runner.js` as a child process
2. Passes agent config as a CLI argument (JSON): prompt, model, API key, cwd, allowed tools
3. **Sidecar** uses SDK's `query()` function with the config
4. SDK handles the full tool execution loop (Read, Write, Glob, Grep, Bash, Task)
5. Sidecar streams `SDKMessage` objects as JSON lines to stdout
6. **Rust backend** reads stdout line by line, parses JSON, emits Tauri events
7. **Frontend** subscribes to Tauri events for real-time display
8. To cancel: frontend unmount triggers process cleanup; no IPC cancel command needed

### Agent logging

The sidecar creates log files under each skill's `logs/` directory: `{workspace}/{skill-name}/logs/{step_label}-{timestamp}.jsonl`. Each log file contains:
- First line: redacted config (API key replaced with `[REDACTED]`)
- Subsequent lines: raw JSON messages from stdout (same as Tauri events)
- stderr lines logged as `{"type":"stderr","content":"..."}`
- Final line: `{"type":"agent-exit","success":true|false}`

Debug with: `tail -f ~/.vibedata/my-skill/logs/step1-research-*.jsonl`

### Sidecar config (passed as CLI argument)

```json
{
  "prompt": "The domain is: X. The skill name is: Y. ...",
  "model": "sonnet",
  "apiKey": "sk-ant-...",
  "cwd": "/path/to/workspace",
  "allowedTools": ["Read", "Write", "Glob", "Grep"],
  "maxTurns": 50,
  "permissionMode": "bypassPermissions",
  "sessionId": "abc-123",
  "betas": ["interleaved-thinking"],
  "pathToClaudeCodeExecutable": "/path/to/sdk/cli.js"
}
```

Optional fields (`sessionId`, `betas`, `pathToClaudeCodeExecutable`) are omitted when not set. `sessionId` enables session resume (used by Step 4 reasoning). `pathToClaudeCodeExecutable` is auto-resolved by the Rust backend to the bundled SDK cli.js.

### Model selection

The app has a **global user preference** in Settings (Sonnet 4.5, Haiku 4.5, or Opus 4.6) that overrides the shared model tiers (see CLAUDE.md). The Rust backend passes the user's selected model to every sidecar invocation.

### Mock agent mode

Set `MOCK_AGENTS=true` to skip real SDK `query()` calls. The sidecar replays bundled JSONL templates and writes mock output files to disk so the workflow advances through all steps without API spend.

- **Activation:** `MOCK_AGENTS=true npm run dev` (env var, not a config setting)
- **Implementation:** `app/sidecar/mock-agent.ts` — checks `process.env.MOCK_AGENTS` at the top of `runAgentRequest()`, maps agent names to step templates, streams pre-recorded messages with short delays
- **Templates:** `app/sidecar/mock-templates/` — JSONL replay files (see directory for current set) plus `outputs/` with mock files per step (clarifications.md, decisions.md, SKILL.md, etc.)
- **Agent name mapping:** All research sub-agents and orchestrators map to `step0-research`; shared agents (`detailed-research`, `confirm-decisions`, `validate-skill`) and generate-skill agents map to their respective step templates. Same templates are used regardless of skill type.
- **Build:** `build.js` copies `mock-templates/` into `dist/` (with `rmSync` clean before copy to prevent stale files)

### GitHub OAuth

The app supports GitHub OAuth via the [device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow). Users authenticate in Settings; the token is stored in the app database and used for feedback submission (GitHub Issues) and push-to-remote.

### Git Version Control

The skills output directory (`skills_path`) is a local git repo managed by the `git2` crate (`src-tauri/src/git.rs`). Auto-commits happen on key skill events:
- Skill created/deleted
- Workflow step completed (with step label in commit message)
- Manifest reconciliation
- Push to remote

On first use or upgrade, the app initializes the repo and creates an initial snapshot. A `.gitignore` is auto-created to exclude OS/IDE artifacts.

The git module also provides history browsing (`get_history`), diff viewing (`get_diff`), and version restore (`restore_version`) for skills.

### Push to Remote

Users can push completed skills to a shared GitHub repository via branch + PR:

1. **Settings:** Configure a remote repo (owner/name) — only repos with push access are listed
2. **Dashboard:** Right-click a completed skill → "Push to remote"
3. **Backend flow:** Fetches the remote's default branch, builds a tree with only the skill's files, commits on top of the remote's history, force-pushes a `skill/{user}/{skill-name}` branch, and creates (or updates) a PR with an AI-generated changelog
4. **Manifests:** Each skill directory gets a `.skill-builder` JSON file (`version`, `creator`, `created_at`, `app_version`) — written on skill creation, reconciled on startup and after GitHub login

Key files: `commands/github_push.rs` (5 Tauri commands + helpers), `commands/github_auth.rs` (device flow), `git.rs` (local git operations).

## Directory Layout

**Workspace** (`~/.vibedata/` by default, configurable in Settings):
- `.claude/CLAUDE.md` — agent system prompt (auto-loaded by SDK)
- `.claude/agents/` — flattened agents for SDK discovery (bundled from repo at startup)
- `.claude/skills/` — skill triggers
- `<skill-name>/context/` — intermediate working files (clarifications, decisions, validation logs)
- `<skill-name>/logs/` — agent execution logs (JSONL)

**Skill output** (configurable `skills_path` in Settings, falls back to workspace):
- `.git/` — auto-managed by git2 (auto-commits on skill events)
- `<skill-name>/SKILL.md` — final skill entry point
- `<skill-name>/references/` — deep-dive reference files
- `<skill-name>/<skill-name>.skill` — packaged zip
- `<skill-name>/.skill-builder` — manifest JSON (version, creator, app_version)

**App database** (`~/.local/share/com.skillbuilder.app/skill-builder.db`):
- Workflow runs, steps, artifacts, agent runs, workflow sessions, chat sessions, settings, tags, imported skills
- DB is the source of truth for skill metadata; filesystem is secondary
- WAL mode enabled for concurrent access; skill locks prevent multiple agents on the same skill
- Instance UUID distinguishes parallel app instances sharing the same database

The plugin uses the same skill output layout (`SKILL.md` + `references/`) but writes everything to the user's CWD with no separate workspace.

## Logging

Every new feature must include logging. The app uses `log` crate (Rust) and `console.*` (frontend, bridged to Rust via `attachConsole()`). Sidecar has its own JSONL log system — no changes needed there.

### Log levels

| Level | When to use | Examples |
|---|---|---|
| **error** | Operation failed, user impact likely | DB write failed, API call returned 5xx, file not found when expected, deserialization error |
| **warn** | Unexpected but recoverable, or user did something questionable | Retrying after transient failure, config value missing (using default), skill already exists on import |
| **info** | Key lifecycle events and operations a developer would want in production logs | Command invoked with key params, skill created/deleted/imported, agent started/completed, settings changed, auth login/logout |
| **debug** | Internal details useful only when troubleshooting | Full request/response payloads, intermediate state, cache hits/misses, branch logic taken, SQL queries |

### Rules

- **Rust commands:** Every `#[tauri::command]` function logs `info!` on entry (with key params) and `error!` on failure. Use `debug!` for intermediate steps. Never log secrets (API keys, tokens).
- **Frontend:** Use `console.error()` for caught errors, `console.warn()` for unexpected states, `console.log()` for significant user actions (navigation, form submissions). Don't log render cycles or state reads.
- **Format:** Include context — `info!("import_github_skills: importing {} skills from {}", count, repo)` not just `info!("importing skills")`.

## Code Style

- TypeScript strict mode, no `any`
- Zustand stores: one file per store in `app/src/stores/`
- Rust commands: one module per concern in `app/src-tauri/src/commands/`
- Tailwind 4 + shadcn/ui for all UI components
- Verify before committing: `cd app && npx tsc --noEmit` (frontend) + `cargo check --manifest-path app/src-tauri/Cargo.toml` (backend)

## Testing

### Mocking Tauri APIs

**Unit tests (Vitest):** `@tauri-apps/api/core` is globally mocked in `src/test/setup.ts`. Use `mockInvoke` from `src/test/mocks/tauri.ts` to configure return values per command.

**E2E tests (Playwright):** Vite aliases replace `@tauri-apps/api/core`, `@tauri-apps/api/event`, and `@tauri-apps/api/window` with mocks in `src/test/mocks/tauri-e2e*.ts` when `TAURI_E2E=true`. Override specific commands via `window.__TAURI_MOCK_OVERRIDES__` in tests. Agent lifecycle events can be simulated using the helpers in `e2e/helpers/agent-simulator.ts`.

