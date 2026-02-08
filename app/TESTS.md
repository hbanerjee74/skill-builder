# Test Plan

## Phase 1: Foundation

### Login Flow
- [ ] Launch app → login page shown (not dashboard)
- [ ] Click "Sign in with GitHub" → device code displayed
- [ ] User code is large, monospace, copyable
- [ ] "Open GitHub" button opens browser to github.com/login/device
- [ ] Polling indicator shows "Waiting for authorization..."
- [ ] Cancel button returns to initial login state
- [ ] After authorization → redirected to dashboard
- [ ] App header shows GitHub avatar + username
- [ ] Logout → returns to login page
- [ ] Relaunch app → session persisted (auto-login if token valid)

### Dashboard
- [ ] Empty state shown when no skills exist
- [ ] "New Skill" button opens creation dialog
- [ ] Create skill → card appears in grid
- [ ] Skill card shows: name, domain badge, progress bar, status badge
- [ ] "Continue" button navigates to workflow page
- [ ] "Delete" button shows confirmation dialog
- [ ] Delete confirmed → skill removed from grid
- [ ] Multiple skills render in responsive grid (1/2/3 columns)

### Settings
- [ ] API key field is password-masked with show/hide toggle
- [ ] "Test" button validates API key (success/failure toast)
- [ ] Repo field accepts `owner/repo` format
- [ ] Auto-commit toggle switches on/off
- [ ] Auto-push toggle switches on/off
- [ ] Save → settings persisted (survive app restart)
- [ ] Load existing settings on page mount

### Navigation & Layout
- [ ] Sidebar shows Dashboard + Settings links
- [ ] Active route highlighted in sidebar
- [ ] Dark mode toggle works (light → dark → light)
- [ ] Theme persists across page navigation
- [ ] Header shows user info + logout dropdown
- [ ] Unauthenticated user cannot access dashboard/settings (redirected to login)

### Rust Backend
- [ ] `start_login` returns valid device flow response
- [ ] `poll_login` returns "pending" then "complete" with token
- [ ] `get_current_user` returns GitHub user info from token
- [ ] `logout` clears stored token
- [ ] `get_settings` returns default settings on first run
- [ ] `save_settings` persists and `get_settings` retrieves them
- [ ] `test_api_key` returns true for valid key, false for invalid
- [ ] `list_skills` returns empty array when no skills
- [ ] `create_skill` creates directory structure on disk
- [ ] `list_skills` returns created skill with parsed state
- [ ] `delete_skill` removes directory from disk
- [ ] `list_skills` no longer shows deleted skill

## Phase 2: Core Agent Loop (SDK Sidecar)

### Node.js Dependency Check
- [ ] App startup with Node.js installed → proceeds normally
- [ ] App startup without Node.js → shows install dialog with link
- [ ] App startup with Node.js < 18 → shows upgrade dialog
- [ ] Settings page shows Node.js version status (green/red indicator)
- [ ] `check_node` command returns correct version or error

### Sidecar
- [ ] `agent-runner.js` bundled as Tauri resource (exists in app bundle)
- [ ] Sidecar reads JSON config from stdin correctly
- [ ] Sidecar calls SDK `query()` with correct options (model, cwd, tools, API key)
- [ ] Sidecar streams system init message as first JSON line
- [ ] Sidecar streams assistant messages as JSON lines during execution
- [ ] Sidecar streams result message as final JSON line (with cost + usage)
- [ ] Sidecar exits cleanly after query completes
- [ ] Sidecar exits on stdin close (cancellation)
- [ ] SDK tools work: agent can Read, Write, Glob, Grep files in workspace

### Rust Agent Management
- [ ] `start_agent` spawns Node.js sidecar process
- [ ] Config (API key, model, prompt, cwd) passed correctly to sidecar stdin
- [ ] JSON lines from sidecar stdout parsed into typed structs
- [ ] Each parsed message emitted as Tauri event to frontend
- [ ] `cancel_agent` kills the sidecar process
- [ ] Multiple agents can run concurrently (different agent IDs)
- [ ] Agent process cleanup on app exit (no orphan Node processes)

### Streaming UI
- [ ] Text from assistant messages renders in real-time in output panel
- [ ] Tool use activity shown (e.g., "Reading file...", "Writing file...")
- [ ] Agent status shows model name + elapsed time
- [ ] On completion: token usage + cost displayed from result message
- [ ] Cancel button stops the agent (sidecar killed)

### Step 1 End-to-End
- [ ] Create skill → navigate to workflow → Step 1 starts
- [ ] Sidecar spawned with research prompt + correct workspace cwd
- [ ] Streaming text appears in output panel
- [ ] Agent reads `prompts/shared-context.md` and `prompts/01-research-domain-concepts.md` via SDK tools
- [ ] `clarifications-concepts.md` written to correct path by agent
- [ ] File contains properly formatted Q&A sections
- [ ] Result message received → step marked complete, workflow advances
- [ ] Existing prompts work without modification

## Phase 3: Q&A Forms

### Markdown Parsing
- [ ] Valid clarification markdown → structured ClarificationQuestion objects
- [ ] All fields parsed: id, title, question, choices (with rationale), recommendation, answer
- [ ] Malformed questions → raw markdown fallback (not crash)
- [ ] Serialize answers back → exact original markdown format preserved
- [ ] Round-trip: parse → modify answer → serialize → parse again = consistent

### Form UI
- [ ] Questions rendered as radio-button groups (one per choice)
- [ ] Recommendation highlighted/noted
- [ ] Text input for custom answer ("Other")
- [ ] Submit → answers written back to markdown file on disk
- [ ] Re-open → previously answered questions show saved answers

### Step 2 + 5 End-to-End
- [ ] Step 2: `clarifications-concepts.md` rendered as form
- [ ] Answer all questions → submit → file updated on disk
- [ ] Step 5: `clarifications.md` rendered as form
- [ ] Answer all questions → submit → file updated on disk

## Phase 4: Full Workflow

### Step 3 (Parallel Agents)
- [ ] Two agents start simultaneously
- [ ] Each streams to its own panel
- [ ] Both complete before Step 4 begins
- [ ] `clarifications-patterns.md` and `clarifications-data.md` both written

### Step 6 (Reasoning)
- [ ] Multi-turn conversation displayed in chat-like view
- [ ] Reasoning summary shown to user
- [ ] Follow-up questions detected and prompted
- [ ] User answers follow-ups → reasoning re-runs
- [ ] `decisions.md` written as clean snapshot (not cumulative)
- [ ] Loop ends when all clarifications resolved

### Steps 7-9 (Build/Validate/Test)
- [ ] Step 7: SKILL.md + reference files created in skill directory
- [ ] Step 8: Validation log written, pass/fail summary shown
- [ ] Step 9: Test results written, pass/partial/fail summary shown
- [ ] If Step 9 finds issues → option to loop back to Step 7

### Step 10 (Package)
- [ ] `.skill` zip archive created in skill folder
- [ ] Archive contains SKILL.md + references/
- [ ] Workflow state marked "completed"

### Resume
- [ ] Close app mid-workflow → relaunch → resume from correct step
- [ ] Completed steps skipped on resume
- [ ] In-progress step re-runs from beginning
- [ ] Review steps (2, 5) show form with previous answers on resume

## Phase 5: Git Integration

- [ ] Select empty repo → cloned + initialized with README
- [ ] Select repo with skills → skills appear in dashboard
- [ ] Auto-commit after Step 1 → `git log` shows commit
- [ ] Commit message format: `skill-builder: [name] step description`
- [ ] Auto-push enabled → commits pushed to GitHub
- [ ] Push button → changes appear on GitHub
- [ ] Pull button → remote changes appear locally
- [ ] Diff viewer shows file changes between commits
- [ ] Git status shows modified/untracked per file

## Phase 6: Editor

- [ ] File tree shows skill files + context files
- [ ] Click file → opens in CodeMirror editor
- [ ] Markdown syntax highlighting works
- [ ] Live preview updates as you type
- [ ] Auto-save triggers after typing pause (debounce)
- [ ] Context files are read-only in editor
- [ ] Git status indicators show in file tree

## Phase 7: Chat Interface

### Conversational Editing
- [ ] Send message → Claude responds
- [ ] Claude modifies skill file → inline diff shown
- [ ] Changes saved to disk automatically
- [ ] Conversation history maintained in session

### Review + Suggest
- [ ] Claude returns numbered suggestions
- [ ] Each suggestion shows diff preview
- [ ] Accept → change applied to file
- [ ] Reject → change discarded
- [ ] Discuss → follow-up conversation about that suggestion

## Phase 8: Polish

- [ ] API error → user-friendly error message (not raw error)
- [ ] Network failure → retry button offered
- [ ] Long operations → loading spinners/skeletons shown
- [ ] All async operations show toast on success/failure
- [ ] Empty states have helpful guidance text
- [ ] App works at minimum window size (900x600)
- [ ] Keyboard shortcuts functional (if implemented)
