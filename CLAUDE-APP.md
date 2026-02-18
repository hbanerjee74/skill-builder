# Skill Builder -- Desktop App

Tauri v2 desktop application for building Claude skills. All code lives in `app/`.

## Architecture

React 19 (WebView) → Tauri IPC → Rust backend → spawns Node.js sidecar (`@anthropic-ai/claude-agent-sdk`)

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Router, react-markdown

**Backend:** Tauri 2, rusqlite, git2, reqwest, notify, pulldown-cmark, tauri-plugin-shell, tokio

**Agent Runtime:** Node.js + `@anthropic-ai/claude-agent-sdk` (sidecar process). **No hot-reload** — restart `npm run dev` after editing `app/sidecar/` files.

**Runtime Dependency:** Node.js 18-24 (checked on startup; Node 25+ causes SDK crashes)

## Agent Orchestration

Agents run via the **Claude Agent SDK** in a Node.js sidecar. Key files:
- **Sidecar entry:** `app/sidecar/agent-runner.ts` — receives config JSON, calls SDK `query()`, streams JSON lines to stdout
- **Rust spawner:** `app/src-tauri/src/commands/agent.rs` — spawns sidecar, reads stdout, emits Tauri events
- **Mock mode:** `app/sidecar/mock-agent.ts` + `mock-templates/` — set `MOCK_AGENTS=true` to replay without API calls
- **Agent logs:** `{workspace}/{skill-name}/logs/{step_label}-{timestamp}.jsonl` — debug with `tail -f`

## Key Directories

- **Workspace** (`~/.vibedata/` default, configurable): agent prompts, skill context, logs
- **Skill output** (`skills_path` in Settings, falls back to workspace): SKILL.md, references, git-managed
- **App database:** `~/.local/share/com.skillbuilder.app/skill-builder.db` — source of truth for skill metadata
- **GitHub integration:** `commands/github_push.rs` (push-to-remote), `commands/github_auth.rs` (OAuth device flow), `git.rs` (local git)

## Code Style

- TypeScript strict mode, no `any`
- Zustand stores: one file per store in `app/src/stores/`
- Rust commands: one module per concern in `app/src-tauri/src/commands/`
- Tailwind 4 + shadcn/ui for all UI components
- Verify before committing: `cd app && npx tsc --noEmit` (frontend) + `cargo check --manifest-path app/src-tauri/Cargo.toml` (backend)

## Testing

### Mocking Tauri APIs

- **Unit tests (Vitest):** Tauri is globally mocked in `src/test/setup.ts`. Use `mockInvoke` from `src/test/mocks/tauri.ts` to configure per-command return values.
- **E2E tests (Playwright):** Set `TAURI_E2E=true`. Mocks live in `src/test/mocks/tauri-e2e*.ts`. Override commands via `window.__TAURI_MOCK_OVERRIDES__`. Agent events: `e2e/helpers/agent-simulator.ts`.

