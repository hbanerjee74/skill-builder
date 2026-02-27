# Skill Builder

Instructions for non-Claude agents (Codex, etc.). All authoritative details are in `CLAUDE.md`. This file provides a minimal onramp — refer to that doc for dev commands, testing, architecture, and code style.

## Project Scope

Multi-agent workflow for creating domain-specific skills. A Tauri desktop app orchestrates agents via a Node.js sidecar.

See `CLAUDE.md` for model tiers, dev commands, testing strategy, shared components, and gotchas.

## Quick Start

```bash
cd app && npm install && npm run sidecar:build && npm run dev
```

## Skills

Use these repo-local skills when requests match:

- `.claude/skills/create-linear-issue/SKILL.md`
  - Trigger: create/log/file Linear issue, bug, feature, ticket decomposition.
- `.claude/skills/implement-linear-issue/SKILL.md`
  - Trigger: implement/fix/work on Linear issue IDs like `VD-123`.
- `.claude/skills/close-linear-issue/SKILL.md`
  - Trigger: close/complete/ship/merge a Linear issue.
- `.claude/skills/tauri/SKILL.md`
  - Trigger: Tauri-specific implementation or debugging tasks.
- `.claude/skills/shadcn-ui/SKILL.md`
  - Trigger: shadcn/ui component work.

## Reference Docs

- `CLAUDE.md` (primary dev guide — workflow, testing, shared components)
