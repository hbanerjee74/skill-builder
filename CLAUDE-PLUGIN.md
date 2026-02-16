# Skill Builder -- Claude Code Plugin

Claude Code plugin providing the multi-agent skill-building workflow. Entry point: `/skill-builder:generate-skill`.

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
│   ├── eval/                        # Skill evaluation harness
│   │   ├── eval-skill-quality.sh    # LLM-as-judge evaluation script
│   │   ├── prompts/                 # Test prompts for eval harness (per skill type)
│   │   └── results/                 # Evaluation outputs (gitignored)
│   └── tests/                       # Test harness scripts (T1-T5)
├── skills/
│   └── generate-skill/
│       └── SKILL.md                 # Coordinator skill (entry point, self-contained)
├── agents/                          # Agent prompts (see CLAUDE.md for layout)
└── agent-sources/
    ├── templates/                   # 5 phase templates (source of truth for generated agents)
    ├── types/                       # 4 type configs with output examples
    └── workspace/
        └── CLAUDE.md                # Agent instructions (app: auto-loaded; plugin: embedded in SKILL.md)
```

## Architecture

Three layers:

1. **Coordinator skill** (`skills/generate-skill/SKILL.md`) -- invoked via `/skill-builder:generate-skill`. Contains the 7-step workflow (Steps 0-7). Uses `` !`echo $CLAUDE_PLUGIN_ROOT` `` to resolve paths to plugin files at runtime.

2. **Subagents** (`agents/{type}/*.md` and `agents/shared/*.md`) -- each has YAML frontmatter (name, model, tools, permissions) and markdown instructions. Type-specific agents are spawned via `Task(subagent_type: "skill-builder:{type_prefix}-{agent}")`, shared agents via `Task(subagent_type: "skill-builder:{agent}")`.

3. **Agent instructions** (`agent-sources/workspace/CLAUDE.md`) -- protocols, file formats, content principles, skill best practices. In the app, auto-loaded into every agent's system prompt. In the plugin, embedded directly in `skills/generate-skill/SKILL.md` so the coordinator skill is self-contained.

## Development Guide

### Adding/modifying an agent

Agent files in `agents/{type}/` are **generated** — do not edit them directly.

1. Edit the template in `agent-sources/templates/` (5 templates: research-concepts, research-practices, research-implementation, research, generate-skill) or the config in `agent-sources/types/{type}/` (type-specific content)
2. Run `./scripts/build-agents.sh` to regenerate all 20 type-specific agent files
3. Use `./scripts/build-agents.sh --check` to verify generated files match templates (used in CI)
4. Shared agents (`agents/shared/`: consolidate-research, confirm-decisions, validate-skill, detailed-research) are edited directly — they are not generated

### Modifying the workflow

Edit `skills/generate-skill/SKILL.md`. This contains the full coordinator logic: all 7 steps (0-7), session resume, human review gates, error recovery, and context conservation rules.

### Testing changes

**Automated validation** runs after every Edit/Write via a Claude Code hook (`.claude/settings.json`). It checks:
- Manifest validity (JSON, required fields)
- All 24 agent files exist with valid frontmatter
- Model tiers match the spec (sonnet/opus)
- Coordinator skill exists with required keywords

Run manually: `./scripts/validate.sh`

For test commands, tiers, and quick rules, see the Testing section in CLAUDE.md.

### Key constraints

- **`agent-sources/workspace/CLAUDE.md`**: In the app, auto-loaded into every agent's system prompt. In the plugin, embedded in SKILL.md. Changes here affect all agents — remember to update SKILL.md when modifying this file.
- **Plugin caching**: Plugins are copied to a cache dir on install. All file references must be within the plugin directory or in the user's CWD.
