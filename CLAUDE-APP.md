# Skill Builder -- Desktop App

Tauri v2 desktop application for building Claude skills. All code lives in `app/`.

## Architecture

```
┌──────────────────── Frontend (WebView) ──────────────────────┐
│  Dashboard │ Skills │ Workflow Wizard │ Prompts │ Settings    │
│                        │                                     │
│              Zustand Store (skills, workflow, agents,         │
│                          settings, imported-skills)           │
│                        │ Tauri IPC (invoke / events)         │
└────────────────────────┼─────────────────────────────────────┘
                         │
┌────────────────────────┼──── Backend (Rust) ─────────────────┐
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐               │
│  │ Agent       │ │ File System │ │ SQLite    │               │
│  │ Orchestrator│ │ Manager     │ │ (rusqlite)│               │
│  │ (spawns     │ │ (CRUD, MD   │ │ settings  │               │
│  │  Node.js    │ │  parsing,   │ │ storage   │               │
│  │  sidecar)   │ │  watching)  │ │           │               │
│  └──────┬──────┘ └─────────────┘ └───────────┘               │
│         │                                                    │
│  Workflow State Machine │ Settings │ Lifecycle               │
└─────────┼────────────────────────────────────────────────────┘
          │
┌─────────┼──── Node.js Sidecar ───────────────────────────────┐
│  Claude Agent SDK (@anthropic-ai/claude-agent-sdk)           │
│  - Gets all Claude Code tools (Read, Write, Glob, Grep, etc) │
│  - Sub-agent support (Task tool)                             │
│  - Tool execution loop handled by SDK                        │
│  - Streams JSON messages to Rust via stdout                  │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Router, react-markdown

**Backend:** Tauri 2, rusqlite, notify, pulldown-cmark, tauri-plugin-shell, tokio

**Agent Runtime:** Node.js + `@anthropic-ai/claude-agent-sdk` (sidecar process)

**Runtime Dependency:** Node.js 18-24 (checked on startup; Node 25+ causes SDK crashes)

## Project Structure

```
app/
├── src/                              # React frontend
│   ├── main.tsx                      # Entry (providers + router)
│   ├── router.tsx                    # TanStack Router routes
│   ├── pages/                        # Page components (5 pages)
│   │   ├── dashboard.tsx             # Skill cards grid
│   │   ├── skills.tsx                # Imported skills management
│   │   ├── prompts.tsx               # Agent prompts viewer
│   │   ├── settings.tsx              # API key + workspace config
│   │   └── workflow.tsx              # Workflow wizard (9-step)
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives (18 components)
│   │   ├── layout/                   # App shell (app-layout, sidebar, header)
│   │   ├── theme-provider.tsx        # Dark mode (next-themes)
│   │   ├── skill-card.tsx            # Dashboard skill card
│   │   ├── imported-skill-card.tsx   # Imported skill card
│   │   ├── new-skill-dialog.tsx      # Create skill dialog
│   │   ├── delete-skill-dialog.tsx   # Delete confirmation
│   │   ├── skill-preview-dialog.tsx  # Skill content preview
│   │   ├── orphan-resolution-dialog.tsx # Resolve orphaned skills
│   │   ├── close-guard.tsx           # Confirm-before-close when agents running
│   │   ├── agent-output-panel.tsx    # Streaming agent output with cancel button
│   │   ├── agent-status-header.tsx   # Agent run status indicator
│   │   ├── error-boundary.tsx        # React error boundary
│   │   ├── onboarding-dialog.tsx     # First-run onboarding
│   │   ├── splash-screen.tsx         # App splash screen
│   │   ├── tag-filter.tsx            # Skill tag filter bar
│   │   ├── tag-input.tsx             # Tag input component
│   │   ├── reasoning-chat.tsx        # Step 5 multi-turn reasoning chat
│   │   ├── refinement-chat.tsx       # Post-workflow skill refinement chat
│   │   ├── step-rerun-chat.tsx       # Chat for step rerun guidance
│   │   ├── workflow-sidebar.tsx      # Step progression sidebar
│   │   └── workflow-step-complete.tsx # Step completion indicator
│   ├── stores/                       # Zustand state (5 stores)
│   │   ├── agent-store.ts
│   │   ├── imported-skills-store.ts
│   │   ├── settings-store.ts
│   │   ├── skill-store.ts
│   │   └── workflow-store.ts
│   ├── hooks/
│   │   └── use-agent-stream.ts      # Subscribe to Tauri agent events
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper
│   │   ├── tauri.ts                 # Typed Tauri invoke wrappers
│   │   ├── types.ts                 # Shared TypeScript interfaces
│   │   └── reasoning-parser.ts      # Step 5 response classifier + extraction
│   └── styles/globals.css           # Tailwind + dark mode tokens + CSS color system
├── sidecar/                          # Node.js agent runner
│   ├── package.json                  # @anthropic-ai/claude-agent-sdk dep
│   ├── agent-runner.ts               # Entry -- reads config from CLI argument, streams JSON to stdout
│   ├── config.ts                     # Config types and validation
│   ├── options.ts                    # SDK option builders
│   ├── shutdown.ts                   # Graceful shutdown handling
│   ├── tsconfig.json
│   └── build.js                      # esbuild bundle -> single agent-runner.js
├── src-tauri/                        # Rust backend
│   ├── src/
│   │   ├── lib.rs                   # Plugin + command registration
│   │   ├── main.rs                  # Entry point
│   │   ├── types.rs                 # Shared types (AppSettings, etc.)
│   │   ├── db.rs                    # SQLite init, migrations, settings read/write
│   │   ├── commands/                # Tauri IPC handlers (12 modules)
│   │   │   ├── mod.rs               # Module declarations
│   │   │   ├── agent.rs             # start_agent (spawns sidecar)
│   │   │   ├── clarification.rs     # save_raw_file (persist clarification answers)
│   │   │   ├── files.rs             # list_skill_files, read_file (skill file tree + content)
│   │   │   ├── imported_skills.rs   # Import/manage external skills
│   │   │   ├── lifecycle.rs         # check_workspace_path, has_running_agents
│   │   │   ├── node.rs              # check_node (Node.js version check)
│   │   │   ├── settings.rs          # get_settings, save_settings, test_api_key
│   │   │   ├── skill.rs             # list_skills, create_skill, delete_skill
│   │   │   ├── test_utils.rs        # Test helpers (E2E mock support)
│   │   │   ├── workflow.rs          # run_review_step, run_workflow_step, package_skill
│   │   │   └── workspace.rs         # init_workspace, get_workspace_path, clear_workspace
│   │   ├── agents/                  # Sidecar management
│   │   │   ├── mod.rs
│   │   │   ├── sidecar.rs           # Spawn Node.js process, pass config as CLI arg
│   │   │   └── events.rs            # Parse JSON lines -> Tauri events
│   │   └── (markdown/ removed -- DB is single source of truth)
│   ├── Cargo.toml
│   └── tauri.conf.json              # bundles sidecar/dist/agent-runner.js
├── package.json
└── vite.config.ts
```

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

Debug with: `tail -f ~/.vibedata/my-skill/logs/step0-research-concepts-*.jsonl`

### Sidecar config (passed as CLI argument)

```json
{
  "prompt": "Read references/shared-context.md and agents/{type}/research-concepts.md...",
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

The app has a **global user preference** in Settings (Sonnet 4.5, Haiku 4.5, or Opus 4.6) that applies to all agent steps. This differs from the plugin, which uses per-agent model tiers defined in agent frontmatter. The Rust backend passes the user's selected model to every sidecar invocation.

## Workflow (9 steps)

0. **Research Concepts** -- research agent writes `clarifications-concepts.md`
1. **Concepts Review** -- user answers questions via form UI
2. **Research Patterns + Data + Merge** -- single orchestrator (spawns sub-agents internally)
3. **Human Review** -- user answers merged questions via form UI
4. **Reasoning** -- multi-turn conversation, produces `decisions.md`
5. **Build** -- creates SKILL.md + reference files
6. **Validate** -- checks against best practices
7. **Test** -- generates and evaluates test prompts
8. **Refine Skill** -- interactive chat to review, iterate, and polish the skill

## Data Model (repo structure)

```
<workspace>/
  <skill-name>/
    SKILL.md                       # Main skill file
    references/                    # Deep-dive reference files
    <skill-name>.skill             # Packaged zip
    logs/                          # Agent output logs ({step_label}-{timestamp}.jsonl)
    context/                       # Intermediate working files
      clarifications-concepts.md
      clarifications-patterns.md
      clarifications-data.md
      clarifications.md
      decisions.md
      agent-validation-log.md
      test-skill.md
```

## Development

```bash
cd app
npm install
cd sidecar && npm install && npm run build  # Bundle sidecar
cd .. && npm run dev                         # Dev mode (hot reload)
npm run tauri build                          # Production build
```

### Parallel Worktree Development

To run multiple worktrees simultaneously, set `DEV_PORT` to a unique port per worktree:

```bash
DEV_PORT=1417 npm run dev   # worktree for VD-417
DEV_PORT=1405 npm run dev   # worktree for VD-405
```

Convention: use `1000 + issue_number` for issues < 1000. Without `DEV_PORT`, the default port 1420 is used.

## Distribution

- `npm run tauri build` produces platform-specific installers (~10MB + bundled sidecar)
- macOS: `.dmg` + `.app` (needs Apple Developer ID for code signing)
- Windows: `.msi` or `.exe` (needs code signing cert for SmartScreen)
- Linux: `.deb`, `.AppImage`, `.rpm`
- CI: `tauri-apps/tauri-action` GitHub Action builds all platforms
- Auto-update: `tauri-plugin-updater` checks GitHub Releases

## Team Workflow (within a single Claude Code instance)

Use Claude Code agent teams when a single task has parallelizable sub-tasks (e.g., a feature needing both Rust commands and React components simultaneously).

1. `TeamCreate` with a descriptive name
2. `TaskCreate` for each independent work stream
3. Spawn teammates via `Task` tool (`subagent_type: "general-purpose"`, `mode: "bypassPermissions"`, `run_in_background: true`, `model: "sonnet"`)
4. Wait for all teammates to complete
5. Integrate: wire cross-cutting concerns (imports, registrations, type sharing)
6. Verify: `npx tsc --noEmit` + `cargo check`
7. Shut down teammates via `SendMessage` + `TeamDelete`

**Splitting rules:** Never split a single file across agents. Define shared types in one agent's scope; the integrator fixes imports after.

## Testing

Three tiers of automated tests.

```bash
cd app
npm test              # Tier 1: Frontend unit tests (Vitest)
cd src-tauri && cargo test    # Tier 2: Rust tests
npm run test:e2e      # Tier 3: E2E tests (Playwright)
npm run test:all      # Vitest + Playwright
```

### Mocking Tauri APIs

**Unit tests (Vitest):** `@tauri-apps/api/core` is globally mocked in `src/test/setup.ts`. Use `mockInvoke` from `src/test/mocks/tauri.ts` to configure return values per command.

**E2E tests (Playwright):** Vite aliases replace `@tauri-apps/api/core` with `src/test/mocks/tauri-e2e.ts` when `TAURI_E2E=true`. Override specific commands via `window.__TAURI_MOCK_OVERRIDES__` in tests.

### When to write tests

1. **New state logic** (store actions, derived state) -> store unit tests
2. **New Rust command** with testable logic -> `#[cfg(test)]` tests
3. **New UI interaction** (button states, form validation) -> component test
4. **New page or major flow** -> E2E test (happy path)
5. **Bug fix** -> regression test

Purely cosmetic changes or simple wiring don't require tests. If unclear, ask the user.

