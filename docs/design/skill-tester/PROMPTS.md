# Skill Tester — Exact Prompts & Process

This document captures the exact prompt content sent to each agent in a skill test run.
Source files are listed next to each component — read those when this diverges.

---

## Overview: Three Agents Per Run

| Agent | Label | Prompt source |
|---|---|---|
| Plan agent A | "with skill" | User's textarea text (`s.prompt`) |
| Plan agent B | "without skill" | Same user textarea text (`s.prompt`) |
| Evaluator | "eval" | `buildEvalPrompt()` in `test.tsx` |

The **user prompt is identical** for both plan agents. What differs is the working directory
each agent is given — which controls what `.claude/CLAUDE.md` it loads automatically via the SDK.

---

## Step 1: Workspace Preparation (Rust)

Source: `app/src-tauri/src/commands/skill_test.rs:69–142`

Two temp dirs are created under `$TMPDIR/skill-builder-test-{uuid}/`:

```
skill-builder-test-{uuid}/
  baseline/
    .claude/CLAUDE.md    ← skill-test context only
  with-skill/
    .claude/CLAUDE.md    ← skill-test context + user's skill
```

### Baseline `.claude/CLAUDE.md`

```
# Test Workspace

## Skill Context

{skill_test_body}
```

### With-Skill `.claude/CLAUDE.md`

```
# Test Workspace

## Skill Context

{skill_test_body}

---

## Active Skill: {skill_name}

{user_skill_body}
```

`{skill_test_body}` = body of `skills/skill-test/SKILL.md` with frontmatter stripped.
`{user_skill_body}` = body of the user's `{skill_name}/SKILL.md` with frontmatter stripped.

---

## Step 2: `skills/skill-test/SKILL.md` Body (injected into both workspaces)

Source: `skills/skill-test/SKILL.md`

This is injected verbatim (frontmatter stripped) as the `## Skill Context` block in both
workspace CLAUDE.md files. Both plan agents see it.

```
## Test Context

You are assisting an **analytics engineer** answering a business question using dbt. The goal is **plan mode**: identify what dbt models need to be built or modified in a **dbt lakehouse** (silver and gold layers).

When asking clarifying questions or forming a plan, orient toward:

| Area | What to uncover |
| -- | -- |
| **Silver vs gold** | Which lakehouse layer does this model belong to? |
| **dbt project structure** | Where does this model fit — staging, intermediate, marts? |
| **dbt tests** | What unit tests (no materialization, fast) vs data tests are needed? |
| **dbt contracts** | What contract changes are required for this model? |
| **Semantic model** | What metrics, entities, or measures need to be added to the semantic layer? |

Do not respond as a generic coding assistant. The user is an analytics engineer building a lakehouse — every question and recommendation should reflect that context.

---

## Evaluation Rubric

You are comparing two plans produced for the same analytics engineering task:

- **Plan A** — produced with a skill loaded
- **Plan B** — produced with no skill loaded

Score each dimension **comparatively (A vs B)** only if it is **relevant to the test prompt**. Skip dimensions the prompt does not touch.

### Dimensions

| Dimension | What to score |
| -- | -- |
| **Silver vs gold** | Does the response correctly identify which lakehouse layer the model belongs to? |
| **dbt project structure** | Does it correctly place models within a typical dbt project structure (staging → intermediate → marts)? |
| **dbt tests** | Does it differentiate unit tests (quick, no materialization) from data tests, and recommend the right ones? |
| **Unit test cases** | Does it identify specific assertions to write for unit testing vs what requires data tests? |
| **dbt contracts** | Does it identify the impact on dbt model contracts? |
| **Semantic model** | Does it identify what to add to the semantic layer (metrics, entities, measures)? |

### Scoring rules

- **Always A vs B** — never evaluate either plan in isolation
- **Never score**: "B didn't use the skill" — that is the test setup, not an insight
- **Never score surface observations**: generic intros, formatting, length, response structure
- Prefix with ↑ if the skill improved the plan on this dimension
- Prefix with ↓ if there is a gap or regression
- Output ONLY bullet points, one per line, no other text
```

Note: the Evaluation Rubric block is only meaningful to the **evaluator** agent. The plan agents
see it in their context but are not asked to use it.

---

## Step 3: Plan Agent Prompts (with-skill and without-skill)

Source: `app/src/pages/test.tsx:671–698`

Both agents receive the **exact same prompt**: the raw text the user typed into the textarea.
There is no wrapping, prefix, or system text added to it in the frontend.

```
{user's textarea text}
```

The agents are invoked with `startAgent(..., s.prompt, ...)`. The skill context difference
comes entirely from their respective working directories (Step 1).

---

## Step 4: Evaluator Prompt

Source: `app/src/pages/test.tsx:103–133` (`buildEvalPrompt`)

After both plan agents complete, the evaluator is started with this prompt (verbatim, with
values substituted at runtime):

```
Task prompt:
"""
{userPrompt}
"""

Plan A (with skill "{skillName}" loaded):
"""
{withPlanText}
"""

Plan B (no skill loaded):
"""
{withoutPlanText}
"""

Use the Evaluation Rubric from your context to compare the two plans.

First, output bullet points (one per line) using:
- ↑ if Plan A (with skill) is meaningfully better on this dimension
- ↓ if Plan B (no skill) is meaningfully better on this dimension
- → if both plans are similar, weak, or neither is clearly better

Then output a "## Recommendations" section with 2-4 specific, actionable suggestions for how to improve the skill based on the evaluation. Focus on gaps where Plan A underperformed or where the skill could have provided more guidance.
```

The evaluator runs in the **baseline working directory** (not with-skill), so it only has the
skill-test context — it does not see the user's skill. This is intentional: it judges output,
not intent (see README.md).

---

## Summary: What Each Agent Sees

| | CLAUDE.md context | Prompt |
|---|---|---|
| Plan agent (with skill) | skill-test body + user's skill body | user textarea text |
| Plan agent (without skill) | skill-test body only | user textarea text (identical) |
| Evaluator | skill-test body only | `buildEvalPrompt()` with both plans embedded |
