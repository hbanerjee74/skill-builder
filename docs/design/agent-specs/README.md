# Agent Layer Architecture

Reference docs for the agent execution layer: workflow, artifact contracts, and storage layout.

| Doc | What it covers |
|---|---|
| [canonical-format.md](canonical-format.md) | Every artifact the agents write and the app reads — the agent ↔ app contract |
| [storage.md](storage.md) | Two-path storage system: workspace vs skills path, file ownership, startup sequence, reconciliation |

---

## Two-Layer Model

The workflow runs on two layers:

**App-bundled agents** (`agents/`) — one agent per workflow step. Each owns file I/O: it reads context files from disk, does its work, and writes output files. Tied to the app release cycle.

**Bundled skills** (`agent-sources/workspace/skills/`) — pure computation units. No file I/O, no path knowledge. Each skill receives inputs inline, runs its logic (including spawning sub-agents via `Task`), and returns results as delimited inline text:

```
=== SECTION NAME ===
[full content]
=== NEXT SECTION ===
[full content]
```

The calling agent extracts each section and writes the files to disk. Skills are marketplace-updatable — teams can replace them without an app release.

Two agents delegate to skills:
- `research-orchestrator` → `skills/research/` (dimension scoring, parallel research, consolidation)
- `validate-skill` → `skills/validate-skill/` (quality check, test evaluation, companion recommendations)

---

## Workflow

Step IDs are the internal IDs used by the app. Steps 1 and 3 are human review steps (the user fills in answers) — no agent runs for those.

| Step ID | Agent | Reads | Writes |
|---|---|---|---|
| 0 | `research-orchestrator` (→ research skill) | [user-context.md](canonical-format.md#canonical-user-contextmd-format) | [research-plan.md](canonical-format.md#canonical-research-planmd-format), [clarifications.md](canonical-format.md#canonical-clarificationsmd-format) |
| 1 | — human review — | clarifications.md | clarifications.md (user fills **Answer:** fields) |
| 2 | `detailed-research` | [clarifications.md](canonical-format.md#canonical-clarificationsmd-format), [answer-evaluation.json](canonical-format.md#canonical-answer-evaluationjson-format) | [clarifications.md](canonical-format.md#canonical-clarificationsmd-format) (adds refinements in-place) |
| 3 | — human review — | clarifications.md | clarifications.md (user fills refinement **Answer:** fields) |
| 4 | `confirm-decisions` | [clarifications.md](canonical-format.md#canonical-clarificationsmd-format) | [decisions.md](canonical-format.md#canonical-decisionsmd-format) |
| 5 | `generate-skill` | [decisions.md](canonical-format.md#canonical-decisionsmd-format) | `SKILL.md`, `references/` |
| 6 | `validate-skill` (→ validate-skill skill) | [decisions.md](canonical-format.md#canonical-decisionsmd-format), `SKILL.md`, `references/` | [agent-validation-log.md](canonical-format.md#canonical-agent-validation-logmd-format), [test-skill.md](canonical-format.md#canonical-test-skillmd-format), [companion-skills.md](canonical-format.md#canonical-companion-skillsmd-format) |

`answer-evaluator` is invoked as a gate between steps — after step 1 (Q-level answers) and after step 3 (refinement answers). It produces [answer-evaluation.json](canonical-format.md#canonical-answer-evaluationjson-format), which `detailed-research` reads to decide which questions need refinements.

---

## App-Layer vs Agent-Layer

The app (Rust) writes infrastructure files; agents write workflow artifacts. See [storage.md](storage.md) for the full breakdown.

**Rust writes:**
- `{workspace}/.claude/CLAUDE.md` — rebuilt on startup
- `{workspace}/.claude/agents/` — copied from bundle on startup
- `{workspace}/{skill}/user-context.md` — written before each step
- `{workspace}/{skill}/logs/*.jsonl` — JSONL transcripts per agent run

**Agents write** (all under `{skills_path}/{skill-name}/`):
- `context/clarifications.md`, `context/research-plan.md` (step 0)
- `context/answer-evaluation.json` (steps 1 gate and 3 gate)
- `context/decisions.md` (step 4)
- `SKILL.md`, `references/` (step 5)
- `context/agent-validation-log.md`, `context/test-skill.md`, `context/companion-skills.md` (step 6)
