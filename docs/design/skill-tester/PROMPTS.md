# Skill Tester — Prompts

Three agents run per test: two plan agents in parallel, then one evaluator after both complete.

---

## Plan agents

Both agents receive the same user-supplied prompt verbatim. What differs is the context each agent loads from its workspace.

### Without-skill workspace context

```
# Test Workspace

## Skill Context

{skill-test body — see below}
```

### With-skill workspace context

```
# Test Workspace

## Skill Context

{skill-test body — see below}

---

## Active Skill: {skill_name}

{user's skill body}
```

### Skill-test context (injected into both workspaces)

The skill-test body contains two sections:

- **Test Context** — orients both plan agents as analytics engineers working in a dbt lakehouse, with five focus areas: silver vs gold layer, dbt project structure, dbt tests, dbt contracts, and semantic model
- **Evaluation Rubric** — six scoring dimensions and scoring rules used by the evaluator to compare the two plans

See the [Skill-Test Skill in the skills design doc](../skills/README.md#skill-test-skill) for the full content of both sections.

Both plan agents see the Evaluation Rubric in their workspace context but are only asked to respond to the user prompt — it is there for the evaluator.

### Plan agent prompt

```
{user input}
```

---

## Evaluator

Starts after both plan agents complete. Runs with the without-skill workspace context — sees the skill-test context only, not the user's skill body.

### Evaluator prompt

```
Task prompt:
"""
{user input}
"""

Plan A (with skill "{skill_name}" loaded):
"""
{with-skill plan output}
"""

Plan B (no skill loaded):
"""
{without-skill plan output}
"""

Use the Evaluation Rubric from your context to compare the two plans.

First, output bullet points (one per line) using:
- ↑ if Plan A (with skill) is meaningfully better on this dimension
- ↓ if Plan B (no skill) is meaningfully better on this dimension
- → if both plans are similar, weak, or neither is clearly better

Then output a "## Recommendations" section with 2-4 specific, actionable suggestions for how to improve the skill based on the evaluation. Focus on gaps where Plan A underperformed or where the skill could have provided more guidance.
```

---

## What each agent sees

| Agent | Context | Prompt |
|---|---|---|
| Plan agent (with skill) | skill-test context + user's skill body | user input |
| Plan agent (without skill) | skill-test context only | user input (identical) |
| Evaluator | skill-test context only | both plans + user input embedded |
