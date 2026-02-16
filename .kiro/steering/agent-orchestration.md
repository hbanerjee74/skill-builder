---
inclusion: always
---

# Agent Orchestration

All authoritative details are in `CLAUDE.md` (workflow, model tiers) and `CLAUDE-APP.md` (SDK integration, sidecar config, agent logging). This file provides a Kiro-friendly summary.

## Claude Agent SDK (Node.js Sidecar)

Agents run via the **Claude Agent SDK** in a Node.js sidecar process.

1. **Rust backend** spawns `node agent-runner.js` as child process
2. Passes agent config as CLI argument (JSON): prompt, model, API key, cwd, allowed tools
3. **Sidecar** uses SDK's `query()` function
4. SDK handles full tool execution loop (Read, Write, Glob, Grep, Bash, Task)
5. Sidecar streams `SDKMessage` objects as JSON lines to stdout
6. **Rust backend** reads stdout, parses JSON, emits Tauri events
7. **Frontend** subscribes to Tauri events for real-time display
8. To cancel: Rust kills the child process

## Workflow & Model Tiers

See `CLAUDE.md` — 7-step workflow (Steps 0-7) with model tiers per agent role.

## Data Model (Skill Output)

```
<skill-name>/
  SKILL.md                       # Main skill file
  references/                    # Deep-dive reference files
  <skill-name>.skill             # Packaged zip
  context/                       # Working files
    clarifications.md
    clarifications-detailed.md
    decisions.md
    agent-validation-log.md
    test-skill.md
```
