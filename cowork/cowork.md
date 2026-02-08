# Skill Builder — Cowork Mode Adaptation

This adapts the Skill Builder workflow for **Cowork mode** (Claude desktop app). Read `../CLAUDE.md` for the full workflow, steps, rules, and error recovery. Everything in that file applies here **except** the team management mechanics, which are replaced as described below.

## What to read

- **Full workflow**: `../CLAUDE.md` (the primary instructions — follow them)
- **Prompt files**: `../prompts/` (same prompts, no changes needed)
- **Shared context**: `../prompts/shared-context.md`

All `prompts/` references in `../CLAUDE.md` resolve to `../prompts/` from this folder. All `skills/` references resolve to `../skills/` at the project root. When spawning subagents, always pass **absolute paths**.

## Substitutions

Follow `../CLAUDE.md` exactly, but replace the following mechanics:

### Agent spawning (replaces Team Setup)

| CLAUDE.md says | Do this instead |
|---|---|
| `TeamCreate(team_name: "skill-<name>")` | Skip — not needed |
| Spawn teammate with `team_name` | Use **Task tool**: `subagent_type: "general-purpose"`, `model: <per table>` |
| `SendMessage(type: "shutdown_request")` | Skip — Task subagents complete and return automatically |
| `TeamDelete` | Skip — not needed |

Spawning syntax:
```
Task(
  description: "Research domain concepts",
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: "Read <abs-path>/prompts/shared-context.md and <abs-path>/prompts/01-research-domain-concepts.md and follow the instructions. Domain: <domain>. Write output to <abs-path>/skills/<name>/context/clarifications-concepts.md. Return a 5-10 bullet summary."
)
```

For **parallel agents** (Step 3): include both Task calls in a single message.

### Progress tracking (replaces TaskCreate / TaskUpdate / TaskList)

| CLAUDE.md says | Do this instead |
|---|---|
| `TaskCreate` + `TaskUpdate(owner: ...)` | Use **TodoWrite** — create a todo item per step |
| `TaskList` to check progress | TodoWrite status is visible to the user automatically |

### Model selection

No change. Use the same model table from `../CLAUDE.md`:

| Agent | Model |
|---|---|
| researcher | sonnet |
| merger | haiku |
| reasoner | opus |
| builder | sonnet |
| validator | sonnet |
| tester | sonnet |

### Session resume

No change. `workflow-state.md` works identically — same file, same format, same logic.

### Context conservation

No change. Same rules: don't read subagent output files into coordinator context. Relay summaries only.

## Everything else

All workflow steps (Initialization through Step 10), human review gates, error recovery, coordinator role, and rules from `../CLAUDE.md` apply without modification. The only difference is **how** agents are spawned and tracked, not **what** they do.
