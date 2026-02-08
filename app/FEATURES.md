# Features

## Phase 1: Foundation

- [x] Tauri v2 scaffold with React 19 + TypeScript + Vite 7
- [x] shadcn/ui component library (16 components)
- [x] Tailwind CSS 4 with light/dark mode tokens
- [x] TanStack Router with login, dashboard, settings, workflow routes
- [x] Zustand stores (auth, skills, settings)
- [x] App layout with sidebar navigation + header with user menu
- [x] Dark mode toggle (next-themes)
- [x] Typed Tauri invoke wrappers for all backend commands
- [x] Login page — GitHub Device Flow UI (code display, polling, error states)
- [x] Dashboard — skill cards grid with progress, status badges, actions
- [x] New Skill dialog — domain input with auto-derived kebab-case name
- [x] Delete Skill dialog — confirmation with invoke
- [x] Settings page — API key (with test), repo config, auto-commit/push toggles
- [x] Rust: GitHub Device Flow (start, poll, fetch user)
- [x] Rust: Token storage via tauri-plugin-store
- [x] Rust: Settings CRUD (get/save/test API key)
- [x] Rust: Skill CRUD (list/create/delete from filesystem)
- [x] Rust: Workflow state markdown parser

## Phase 2: Core Agent Loop (SDK Sidecar)

### Node.js Dependency Check
- [ ] Rust: `check_node` command — run `node --version`, parse version, return status
- [ ] Frontend: Node.js status indicator on Settings page
- [ ] Frontend: Startup dialog if Node.js missing — install instructions + link to nodejs.org

### Sidecar (Node.js)
- [ ] `sidecar/` directory with package.json, tsconfig.json
- [ ] `@anthropic-ai/claude-agent-sdk` installed as dependency
- [ ] `agent-runner.ts` — reads JSON config from stdin, runs `query()`, streams JSON lines to stdout
- [ ] Handles all SDK message types (system, assistant, result)
- [ ] Forwards tool activity (file reads/writes) as status events
- [ ] Graceful shutdown on stdin close or SIGTERM
- [ ] `build.ts` — esbuild bundles into single `dist/agent-runner.js`
- [ ] Bundled JS file included as Tauri resource

### Rust: Agent Management
- [ ] `commands/agent.rs` — `start_agent` and `cancel_agent` Tauri commands
- [ ] `agents/sidecar.rs` — spawn `node agent-runner.js`, write config to stdin, read stdout
- [ ] `agents/events.rs` — parse JSON lines from stdout → emit Tauri events
- [ ] Pass API key, model, prompt, cwd, allowedTools, maxTurns, permissionMode to sidecar
- [ ] Track running agent processes (HashMap of agent_id → child process)
- [ ] Cancel: kill child process on `cancel_agent`

### Frontend: Streaming UI
- [ ] Agent output streaming panel (real-time text display from Tauri events)
- [ ] Agent status display (model, elapsed time, token usage from result message)
- [ ] Workflow store (workflow state, step transitions)
- [ ] Agent store (run state, streaming events)
- [ ] `use-agent-stream` hook (subscribe to Tauri agent events)
- [ ] Workflow wizard page — step progression sidebar

### End-to-End
- [ ] Step 1: create skill → run research agent via sidecar → streaming output in UI → `clarifications-concepts.md` written
- [ ] Existing `prompts/*.md` used as-is (no modification needed)

## Phase 3: Q&A Forms

- [ ] Rust: Clarification markdown parser (Q&A format → structured data)
- [ ] Rust: Clarification serializer (structured data → markdown)
- [ ] Rust: Parse command (parse_clarifications) returning structured questions
- [ ] Rust: Save command (save_clarification_answers) writing markdown back
- [ ] Frontend: Q&A form component (radio buttons from choices, text answer field)
- [ ] Frontend: Question list renderer (parsed from markdown, with recommendations)
- [ ] Frontend: Raw markdown fallback for unparseable questions
- [ ] Frontend: Form submission → serialize back to exact markdown format
- [ ] Step 2 end-to-end: view questions as form → answer → save to file
- [ ] Step 5 end-to-end: view merged questions as form → answer → save

## Phase 4: Full Workflow

- [ ] Rust: Workflow state machine (step ordering, transitions, gates)
- [ ] Rust: Step 3 — parallel agents (spawn two sidecar processes concurrently)
- [ ] Rust: Step 4 — merge agent execution
- [ ] Rust: Step 6 — reasoning agent (multi-turn conversation loop)
- [ ] Rust: Step 6 — follow-up question detection + append to clarifications
- [ ] Rust: Step 7 — build agent execution
- [ ] Rust: Step 8 — validator agent execution
- [ ] Rust: Step 9 — tester agent execution
- [ ] Rust: Step 10 — package skill as .skill zip archive
- [ ] Frontend: Step 3 — dual streaming panels (parallel agent output)
- [ ] Frontend: Step 6 — chat-like view for multi-turn reasoning
- [ ] Frontend: Step 6 — follow-up question prompt + re-run
- [ ] Frontend: Step 7-9 — agent output + summary display
- [ ] Frontend: Step 10 — package confirmation
- [ ] Frontend: Workflow resume (load state, skip completed steps)
- [ ] Full 10-step workflow end-to-end

## Phase 5: Git Integration

- [ ] Rust: git2 — clone repo (HTTPS + GitHub token)
- [ ] Rust: git2 — init empty repo
- [ ] Rust: git2 — commit with message
- [ ] Rust: git2 — push to remote
- [ ] Rust: git2 — pull from remote
- [ ] Rust: git2 — diff (file-level + line-level)
- [ ] Rust: git2 — log (commit history)
- [ ] Rust: git2 — file status (modified, untracked)
- [ ] Rust: Auto-commit after each workflow step (configurable)
- [ ] Rust: Auto-push after commit (optional)
- [ ] Rust: Clone/init on first setup after repo selection
- [ ] Frontend: Push/pull toolbar buttons
- [ ] Frontend: Diff viewer for file history (react-diff-viewer-continued)
- [ ] Frontend: Git status indicators per file
- [ ] Frontend: `use-git-status` hook

## Phase 6: Editor

- [ ] Install CodeMirror 6 (@codemirror/lang-markdown)
- [ ] Frontend: Three-pane layout (file tree | editor | preview)
- [ ] Frontend: File tree showing skill files (editable) + context files (read-only)
- [ ] Frontend: CodeMirror source editor with markdown syntax highlighting
- [ ] Frontend: Live markdown preview (react-markdown)
- [ ] Frontend: Auto-save with debounce
- [ ] Frontend: Git status indicators in file tree
- [ ] Frontend: `use-skill-files` hook

## Phase 7: Chat Interface

- [ ] Rust: Chat session management (create, list, messages)
- [ ] Sidecar: Chat agent mode — SDK query with skill file tools + conversational context
- [ ] Rust: Inline diff generation for file changes
- [ ] Frontend: Conversational editing mode — free-form chat, Claude modifies files
- [ ] Frontend: Review + suggest mode — numbered suggestions with diff previews
- [ ] Frontend: Accept/Reject/Discuss buttons per suggestion
- [ ] Frontend: Mode toggle switch (conversational vs review)
- [ ] Frontend: Chat store (sessions, messages, streaming)

## Phase 8: Polish

- [ ] Error boundaries + error state components
- [ ] Retry UX for failed operations
- [ ] Loading states / skeleton components
- [ ] Keyboard shortcuts
- [ ] Toast notifications for all async operations
- [ ] Empty states with guidance
- [ ] Responsive layout adjustments
- [ ] App icon and branding
- [ ] First-run onboarding flow
- [ ] GitHub OAuth App registration documentation
