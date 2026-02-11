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

- **`references/shared-context.md`**: Read by every agent. Changes here affect all agents.
- **Plugin caching**: Plugins are copied to a cache dir on install. All file references must be within the plugin directory or in the user's CWD.

### Extended Thinking

Claude Code subagent frontmatter does not currently support per-agent thinking configuration. The reasoning and build agent prompts are optimized for thinking mode using goal-oriented patterns (not step-by-step prescriptions). When Claude Code adds `thinking` or `effort` as frontmatter fields, update:
- reasoning agents: `effort: max`
- build agents: `effort: high`
- research orchestrators: `effort: high`
- validate/test agents: `effort: medium`
- merge agent: thinking disabled (haiku)

