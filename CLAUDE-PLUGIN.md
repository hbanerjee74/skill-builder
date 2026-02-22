# Skill Builder -- Claude Code Plugin

Claude Code plugin providing the multi-agent skill-building workflow. Entry point: `/skill-builder:building-skills`.

## Architecture

Three layers:

1. **Coordinator skill** (`skills/building-skills/SKILL.md`) -- invoked via `/skill-builder:building-skills`. State-aware router: detects current phase from filesystem artifacts, classifies user intent, and dispatches to the right agent. Uses `` !`echo $CLAUDE_PLUGIN_ROOT` `` to resolve paths to plugin files at runtime.

2. **Subagents** (`agents/*.md`) -- each has YAML frontmatter (name, model, tools, permissions) and markdown instructions. Agents are spawned via `Task(subagent_type: "skill-builder:{agent}")`.

3. **Agent instructions** — see Shared Components in CLAUDE.md. The coordinator reads references and passes them inline to sub-agents via `<agent-instructions>` tags.

## Development Guide

### Adding/modifying an agent

Agent files live in `agents/` (flat directory). Edit them directly.

### Modifying the workflow

Edit `skills/building-skills/SKILL.md`. This contains the full coordinator logic: state detection, intent classification, dispatch matrix, phase implementations, and workflow modes (guided/express/iterative).

### Testing changes

**Automated validation** runs after every Edit/Write via a hook (`.claude/settings.json` → `scripts/validate.sh`). Run manually: `./scripts/validate.sh`. For test commands and quick rules, see the Testing section in CLAUDE.md.

### Key constraints

- **Plugin caching**: Plugins are copied to a cache dir on install. All file references must be within the plugin directory or in the user's CWD.
