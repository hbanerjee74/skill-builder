---
inclusion: always
---

# Skill Builder Architecture

All authoritative details are in `CLAUDE.md`, `CLAUDE-APP.md`, and `CLAUDE-PLUGIN.md`. This file provides a Kiro-friendly summary.

## Project Overview

A multi-agent workflow for creating domain-specific Claude skills. Two frontends:
- **CLI** (Claude Code plugin) — entry point: `/skill-builder:generate-skill`
- **Desktop App** (Tauri) — all code in `app/`

## Tech Stack

See `CLAUDE-APP.md` for full details.

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Router, react-markdown

**Backend:** Tauri 2, rusqlite, notify, pulldown-cmark, tokio

**Agent Runtime:** Node.js 18-24 sidecar + `@anthropic-ai/claude-agent-sdk`

## Architecture

```
Frontend (WebView) → Zustand Store → Tauri IPC
                                        ↓
Backend (Rust) → Agent Orchestrator → Node.js Sidecar
                → File System Manager    (Claude SDK)
                → SQLite (settings)
```

## Key Directories

- `app/src/` — React frontend
- `app/src-tauri/` — Rust backend
- `app/sidecar/` — Node.js agent runner
- `agent-sources/templates/` — 5 agent templates (source of truth for generated agents)
- `agent-sources/types/` — 4 type configs with output examples
- `agent-sources/workspace/CLAUDE.md` — agent instructions (app: auto-loaded; plugin: embedded in SKILL.md)
- `agents/shared/` — 4 shared agents (consolidate-research, confirm-decisions, validate-skill, detailed-research)
- `agents/{type}/` — 20 generated agents (5 templates × 4 types) — do not edit directly
