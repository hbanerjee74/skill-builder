# Skill Builder -- Claude Code Plugin

Claude Code plugin providing the multi-agent skill-building workflow. Entry point: `/skill-builder:start`.

## Plugin Structure

```
skill-builder/
├── .claude-plugin/
│   ├── plugin.json                  # Plugin manifest
│   └── marketplace.json             # Marketplace registry
├── .claude/
│   └── settings.json                # Dev hooks (runs validate.sh after Edit/Write)
├── scripts/
│   ├── validate.sh                  # Automated structural validation (T1 checks)
│   └── tests/                       # Test harness scripts (T1-T5)
├── skills/
│   └── start/
│       └── SKILL.md                 # Coordinator skill (entry point)
├── agents/                          # Agent prompts (see CLAUDE.md for layout)
└── references/
    └── shared-context.md            # Shared context read by all agents
```

## Architecture

Three layers:

1. **Coordinator skill** (`skills/start/SKILL.md`) -- invoked via `/skill-builder:start`. Contains the full 9-step + init workflow orchestration. Uses `` !`echo $CLAUDE_PLUGIN_ROOT` `` to resolve paths to plugin files at runtime.

2. **Subagents** (`agents/{type}/*.md` and `agents/shared/*.md`) -- each has YAML frontmatter (name, model, tools, permissions) and markdown instructions. Type-specific agents are spawned via `Task(subagent_type: "skill-builder:{type_prefix}-{agent}")`, shared agents via `Task(subagent_type: "skill-builder:{agent}")`.

3. **Shared reference** (`references/shared-context.md`) -- domain definitions, file formats, content principles. Read by agents at the path the coordinator passes in the Task prompt.

### Context Conservation Principle

The coordinator's context window is the scarcest resource. **All heavy work must be delegated to subagents via Task calls.**

Rules:
1. **Never read agent output files into the coordinator context.** Agents write to disk; coordinator relays summaries only.
2. **Prefer subagents over inline work.** If a step involves reading multiple files or producing output longer than a few lines, it belongs in a subagent.
3. **Summaries only flow up.** Each Task prompt must end with "Return a 5-10 bullet summary."
4. **Parallel where independent.** Steps that don't depend on each other must be dispatched as parallel Task calls.

### Path Resolution

- Plugin files: `${CLAUDE_PLUGIN_ROOT}/references/shared-context.md`
- Output files in the user's CWD (not the plugin directory):
  - `./workflow-state.md` -- session state
  - `./context/` -- working files
  - `./<skillname>/` -- deployable skill (SKILL.md + references/)

### Agent Orchestration

The coordinator uses **agent teams** (TeamCreate / Task with team_name / SendMessage / TeamDelete):

```
# 1. Create team at workflow start
TeamCreate(team_name: "skill-builder-<skillname>")

# 2. Create tasks for the shared task list
TaskCreate(subject: "Research domain concepts", description: "...")

# 3. Spawn agents as teammates
Task(
  subagent_type: "skill-builder:{type_prefix}-research-concepts",
  team_name: "skill-builder-<skillname>",
  name: "research-concepts",
  model: "sonnet",
  prompt: "Domain: <domain>. Shared context: <plugin_root>/references/shared-context.md..."
)

# 4. Coordinate via messages
SendMessage(type: "message", recipient: "research-concepts", content: "...")

# 5. Clean up
TeamDelete()
```

### Model Selection

| Agent | Model | Rationale |
|---|---|---|
| research-concepts | **sonnet** | Structured research, runs in parallel |
| research-patterns-and-merge | **sonnet** | Orchestrator: spawns sub-agents |
| reasoning | **opus** | Deep analytical reasoning |
| build | **sonnet** | Content generation |
| validate | **sonnet** | Checking against best practices |
| test | **sonnet** | Test generation and evaluation |

## Start Modes

The coordinator detects which mode to use based on the filesystem:

| Mode | Condition | Behavior |
|---|---|---|
| **A -- Resume** | `workflow-state.md` exists | Continue from last completed step |
| **B -- Modify existing** | `SKILL.md` exists but no `workflow-state.md` | Skip to Step 5 (reasoning) |
| **C -- Scratch** | No skill directory | Full workflow from Step 0 |

## Workflow (9 Steps + Init)

| Step | Agent | What Happens | Human Gate? |
|---|---|---|---|
| Init | -- | User provides domain, skill name, skill type | Yes |
| 1 | research-concepts | Research key entities, metrics, KPIs | No |
| 2 | -- | User answers domain concept questions | **Yes** |
| 3 | research-patterns-and-merge | Research patterns + data + merge | No |
| 4 | -- | User answers merged questions | **Yes** |
| 5 | reasoning | Analyze answers, find gaps, update decisions | **Yes** |
| 6 | build | Create SKILL.md + reference files | Yes |
| 7 | validate | Check against best practices | Yes |
| 8 | test | Generate + evaluate test prompts | Yes |
| 9 | -- | Package into .skill zip | No |

## Output Data Model (in user's CWD)

```
./
├── workflow-state.md                    # Session resume checkpoint
├── context/                             # Working files
│   ├── clarifications-concepts.md       # Step 1 output
│   ├── clarifications-patterns.md       # Step 3 internal
│   ├── clarifications-data.md           # Step 3 internal
│   ├── clarifications.md               # Step 3 merged
│   ├── decisions.md                     # Step 5 output
│   ├── agent-validation-log.md          # Step 7 output
│   └── test-skill.md                    # Step 8 output
└── <skillname>/                         # Deployable skill
    ├── SKILL.md                         # Entry point (<500 lines)
    └── references/                      # Deep-dive files
```

## Development Guide

### Adding/modifying an agent

1. Edit the agent file in `agents/` -- frontmatter controls model, tools, permissions
2. The markdown body IS the agent's system prompt
3. Agents receive runtime parameters (domain, paths) from the coordinator's Task prompt
4. Agents read `references/shared-context.md` at the path provided by the coordinator

### Modifying the workflow

Edit `skills/start/SKILL.md`. This contains the full coordinator logic: session resume, all 9 steps + init, human review gates, error recovery, and context conservation rules.

### Testing changes

**Automated validation** runs after every Edit/Write via a Claude Code hook (`.claude/settings.json`). It checks:
- Manifest validity (JSON, required fields)
- All 27 agent files exist with valid frontmatter
- Model tiers match the spec (sonnet/haiku/opus)
- Coordinator skill exists with required keywords

Run manually: `./scripts/validate.sh`

**Test harness** (`scripts/test-plugin.sh`):

```bash
./scripts/test-plugin.sh           # Run all tiers
./scripts/test-plugin.sh t1        # Run only T1 (free, no LLM)
./scripts/test-plugin.sh t1 t2     # Run T1 and T2
./scripts/test-plugin.sh --list    # List available tiers
```

| Tier | Name | What it tests | Cost |
|---|---|---|---|
| **T1** | Structural Validation | Plugin validate, agent count (27), frontmatter, model tiers | Free |
| **T2** | Plugin Loading | Plugin loads into `claude -p`, skill trigger responds | ~$0.05 |
| **T3** | Start Mode Detection | Modes A/B/C detected correctly using fixtures | ~$0.25 |
| **T4** | Agent Smoke Tests | Merge deduplicates, reasoning produces decisions, build creates SKILL.md | ~$0.50 |
| **T5** | Full E2E Workflow | End-to-end `/skill-builder:start` with auto-answered gates | ~$5.00 |

Environment variables: `PLUGIN_DIR`, `CLAUDE_BIN`, `MAX_BUDGET_T4`, `MAX_BUDGET_T5`, `KEEP_TEMP`, `VERBOSE`.

**Live testing** (interactive):
```bash
claude --plugin-dir .
/skill-builder:start
```

### Key constraints

- **`skills/start/SKILL.md`**: Must not read agent output files (context conservation). Only relays summaries.
- **Agent definitions**: Must specify `model` in frontmatter. The coordinator does NOT override models.
- **`references/shared-context.md`**: Read by every agent. Changes here affect all agents.
- **Plugin caching**: Plugins are copied to a cache dir on install. All references must be within the plugin directory or in the user's CWD.

## Reference Links

- [Claude Code Plugin docs](https://code.claude.com/docs/en/plugins)
- [Plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Subagent docs](https://code.claude.com/docs/en/sub-agents)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Skills docs](https://code.claude.com/docs/en/skills)
