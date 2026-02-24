---
name: research
description: >
  Runs the research phase for a skill. Use when researching dimensions and producing
  clarifications for a purpose and domain. Returns a scored dimension table and
  complete clarifications.md content as inline text with === RESEARCH PLAN === and
  === CLARIFICATIONS === delimiters.
---

# Research Skill

## What This Skill Does

Given a `purpose` and `domain`, this skill produces two outputs as inline text:

1. A scored dimension table (becomes `research-plan.md`)
2. Complete `clarifications.md` content in canonical format (becomes the clarifications file)

This is a **pure computation unit** — it takes inputs, returns inline text, and writes nothing to disk. It has no knowledge of context directories or file paths. The caller (orchestrator) handles all file I/O.

---

## Inputs

| Input | Values | Example |
|-------|--------|---------|
| `purpose` | The purpose label or token from user context (the orchestrator may pass either; use the mapping table below to resolve) | `"Business process knowledge"` |

## Purpose → Dimension Set Mapping

Translate the purpose label to determine which dimension set to use:

| Purpose (label or token) | Dimension set |
|---|---|
| Business process knowledge (`domain`) | Domain Dimensions |
| Source system customizations (`source`) | Source Dimensions |
| Organization specific data engineering standards (`data-engineering`) | Data-Engineering Dimensions |
| Organization specific Azure or Fabric standards (`platform`) | Platform Dimensions |

---

## Step 1 — Select Dimension Set

Read `references/dimension-sets.md`.

Using the mapping table above, identify the dimension set section for the given purpose. Each section contains a table of slugs and dimension names (5–6 candidate dimensions).

Note the dimension slugs — you will use them in Step 3 to locate dimension spec files at `references/dimensions/{slug}.md`.

---

## Step 2 — Score and Select (Inline, Extended Thinking)

Read `references/scoring-rubric.md`.

Use **extended thinking** for this step. Score each candidate dimension against the domain inline — do not spawn a sub-agent for this step.

### Pre-check: topic relevance

Before scoring, determine whether the domain is a legitimate topic for the purpose. If clearly not relevant (e.g., a non-data topic for any purpose), produce a `=== RESEARCH PLAN ===` section with `topic_relevance: not_relevant` and an empty selected list, then stop. Do not proceed to Steps 3 or 4.

### Scoring

For each of the 5–6 candidate dimensions, apply the rubric and follow the step-by-step instructions in `references/scoring-rubric.md`. The rubric defines scores 1–5, the scoring frame, tailored focus line guidelines, and selection criteria.

### Selection

Select the top 3–5 dimensions by score. Prefer quality of coverage over meeting an exact count.

---

## Step 3 — Parallel Dimension Research

For each selected dimension, read the full content of `references/dimensions/{slug}.md` for that dimension.

Then spawn a Task sub-agent for that dimension. Pass the full user context so the research is grounded in the user's specific environment. Construct the Task prompt as follows:

```
You are researching the {dimension_name} dimension for a {purpose} skill about {skill_name}.

{full content of references/dimensions/{slug}.md}

Tailored focus: {tailored focus line from Step 2}

## User Context
{paste the full user context received from the orchestrator — purpose, description, what Claude needs to know, industry, function, etc.}

Return detailed research text covering the dimension's questions and decision points for this skill. 500–800 words. Return raw research text only — no headings, no JSON, no structured format. Write as if briefing a colleague who needs to understand the key questions and tradeoffs for this dimension in the context of {skill_name}. Use the user context above to tailor the research to their specific environment.
```

Wait for all Tasks to return before proceeding to Step 4.

---

## Step 4 — Consolidate

Read `references/consolidation-handoff.md`. This file contains the full `clarifications.md` format spec (frontmatter, heading hierarchy, question template, ID scheme, parser-compatibility regex patterns) and step-by-step consolidation instructions.

Follow the consolidation instructions in that file to deduplicate and synthesize all dimension Task outputs into canonical `clarifications.md` content.

---

## Return Format

Return inline text with two clearly delimited sections. The delimiter lines must be exactly as shown:

```
=== RESEARCH PLAN ===
---
purpose: [purpose]
domain: [domain name]
topic_relevance: relevant
dimensions_evaluated: [count]
dimensions_selected: [count]
---
# Research Plan

## Skill: [domain name] ([purpose])

## Dimension Scores

| Dimension | Score | Reason | Companion Note |
|-----------|-------|--------|----------------|
| [slug] | [score] | [one-sentence reason] | [optional] |

## Selected Dimensions

| Dimension | Focus |
|-----------|-------|
| [slug] | [tailored focus line] |

=== CLARIFICATIONS ===
---
question_count: [n]
sections: [n]
duplicates_removed: [n]
refinement_count: 0
priority_questions: [Q1, Q3, ...]
---
# Research Clarifications

[full clarifications content]
```

The `=== RESEARCH PLAN ===` section is extracted by the orchestrator and written to `context/research-plan.md`.

The `=== CLARIFICATIONS ===` section is extracted by the orchestrator and written to `context/clarifications.md`.

Both sections must be present. Both must be well-formed per their respective canonical formats.

---

## Error Handling

**Topic not relevant**: Return `=== RESEARCH PLAN ===` with `topic_relevance: not_relevant` and an empty selected list. Return `=== CLARIFICATIONS ===` with a minimal frontmatter (`question_count: 0`, `sections: 0`, `duplicates_removed: 0`, `refinement_count: 0`, `scope_recommendation: true`) and a single section explaining the domain is not applicable for this purpose.

**Dimension Task failure**: Proceed with available outputs. Note any failed dimensions in the scored table with `score: 0` and reason `"Research task failed"`. Do not include them in selected dimensions.

**No dimensions selected**: If all dimensions score 2 or below, select the single highest-scoring dimension (score 2 at minimum) and run research for it. A clarifications file with at least some questions is better than an empty file.

---

## Output Checklist

Before returning, verify:

- Both `=== RESEARCH PLAN ===` and `=== CLARIFICATIONS ===` sections present
- Frontmatter counts accurate in both sections
- Every question has 2–4 choices + "Other (please specify)", a `**Recommendation:**`, and an `**Answer:**` field
- `priority_questions` lists all Required question IDs
- `refinement_count: 0` (refinements are added in Step 3 by `detailed-research`)
- No inline tags (`[MUST ANSWER]`) in question headings
- Format passes the Rust parser patterns in `references/consolidation-handoff.md`
