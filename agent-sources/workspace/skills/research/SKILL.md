---
name: research
description: Research skill for the Skill Builder workflow. Selects relevant dimensions, scores them, runs parallel dimension research, and consolidates into clarifications.md format.
---

# Research Skill

## What This Skill Does

Given a `skill_type` and `domain`, this skill produces two outputs as inline text:

1. A scored dimension table (becomes `research-plan.md`)
2. Complete `clarifications.md` content in canonical format (becomes the clarifications file)

This is a **pure computation unit** — it takes inputs, returns inline text, and writes nothing to disk. It has no knowledge of context directories or file paths. The caller (orchestrator) handles all file I/O.

---

## Inputs

| Input | Values | Example |
|-------|--------|---------|
| `skill_type` | `domain` \| `platform` \| `source` \| `data-engineering` | `domain` |
| `domain` | Free text domain name | `"Sales Pipeline Analytics"` |

---

## Step 1 — Select Dimension Set

Read `references/dimension-sets.md`.

Based on `skill_type`, identify the 5–6 candidate dimensions for this skill type. The file contains four named sections (Domain Dimensions, Data-Engineering Dimensions, Platform Dimensions, Source Dimensions) each with a table of slugs and dimension names.

Note the dimension slugs — you will use them in Step 3 to locate dimension spec files at `references/dimensions/{slug}.md`.

---

## Step 2 — Score and Select (Inline, Extended Thinking)

Read `references/scoring-rubric.md`.

Use **extended thinking** for this step. Score each candidate dimension against the domain inline — do not spawn a sub-agent for this step.

### Pre-check: topic relevance

Before scoring, determine whether the domain is a legitimate topic for the skill type. If clearly not relevant (e.g., a non-data topic for any skill type), produce a `=== RESEARCH PLAN ===` section with `topic_relevance: not_relevant` and an empty selected list, then stop. Do not proceed to Steps 3 or 4.

### Scoring

For each of the 5–6 candidate dimensions, apply the rubric from `references/scoring-rubric.md`:

| Score | Meaning |
|-------|---------|
| 5 | Critical delta — engineer will produce wrong models without this |
| 4 | High value — non-obvious knowledge that saves significant rework |
| 3 | Moderate — useful but Claude's parametric knowledge covers 70%+ |
| 2 | Low — mostly standard knowledge, small delta |
| 1 | Redundant — Claude already knows this well |

Score on: **What would a data engineer need to know to build correct dbt silver/gold models for this domain that Claude can't already tell them?**

For each dimension:
- Assign a score (1–5)
- Write a one-sentence reason grounded in the domain
- Write a tailored focus line (1–2 sentences making the dimension specific to this domain — include entity names, metric names, pattern types, or platform specifics as relevant)
- For scores 2–3, note a companion skill candidate

### Selection

Select the top 3–5 dimensions by score. Prefer quality of coverage over meeting an exact count.

---

## Step 3 — Parallel Dimension Research

For each selected dimension, read the full content of `references/dimensions/{slug}.md` for that dimension.

Then spawn a Task sub-agent for that dimension. Construct the Task prompt as follows:

```
You are researching the {dimension_name} dimension for a {skill_type} skill about {domain}.

{full content of references/dimensions/{slug}.md}

Tailored focus: {tailored focus line from Step 2}

Return detailed research text covering the dimension's questions and decision points for this domain. 500–800 words. Return raw research text only — no headings, no JSON, no structured format. Write as if briefing a colleague who needs to understand the key questions and tradeoffs for this dimension in the context of {domain}.
```

**Launch ALL dimension Tasks in a single turn for parallelism.** Do not wait for one to finish before launching the next. Wait for all to return before proceeding to Step 4.

If a dimension Task fails, note the failure and continue with the available outputs from other Tasks. Do not re-try automatically.

---

## Step 4 — Consolidate

Read `references/consolidation-handoff.md`. This file contains:
- The full YAML frontmatter spec with required fields (`question_count`, `sections`, `duplicates_removed`, `refinement_count`) and optional fields (`priority_questions`, `scope_recommendation`, `status`)
- The complete heading hierarchy: `# Research Clarifications` → `## Section` → `### Required` / `### Optional` → `### Q{n}: Title` → (Step 3 adds `#### Refinements` → `##### R{n}.{m}:`)
- The question template with body, lettered choices (A–D + "Other"), `**Recommendation:**`, and `**Answer:**` fields
- The ID scheme: `Q{n}` for top-level questions (created here), `R{n}.{m}` for refinements (added in Step 3)
- All formatting rules including parser-compatibility requirements
- Step-by-step consolidation instructions

Using the full spec in that file, deduplicate and synthesize all dimension Task outputs into canonical `clarifications.md` content.

### Consolidation approach

For each cluster of related questions or decision points across dimension findings:
- Identify the underlying decision — two questions that look different may resolve the same design choice
- Pick the strongest framing — the version with the most specific choices and clearest implications
- Fold in unique value from weaker versions — additional choices, better rationale
- Rephrase if needed — the consolidated question should read naturally

Arrange into logical sections: broad scoping first, then detailed design decisions. Add a `## Cross-cutting` section for questions that span multiple dimensions.

Within each section, group questions under `### Required` (critical, skill cannot be built without answers) and `### Optional` (refines quality, reasonable defaults exist) sub-headings. Include only the sub-headings that have questions.

For consolidated questions that draw from multiple dimensions, add: `_Consolidated from: [Dimension Name Research, ...]_`

### Frontmatter accuracy

Count carefully before writing:
- `question_count` — count every `### Q{n}:` heading
- `sections` — count every `## ` section heading
- `duplicates_removed` — each collapsed group of N questions counts as (N-1) removed
- `refinement_count` — always 0 at this step
- `priority_questions` — list every question ID that appears under a `### Required` sub-heading

---

## Return Format

Return inline text with two clearly delimited sections. The delimiter lines must be exactly as shown:

```
=== RESEARCH PLAN ===
---
skill_type: [skill_type]
domain: [domain name]
topic_relevance: relevant
dimensions_evaluated: [count]
dimensions_selected: [count]
---
# Research Plan

## Skill: [domain name] ([skill_type])

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

**Topic not relevant**: Return `=== RESEARCH PLAN ===` with `topic_relevance: not_relevant` and an empty selected list. Return `=== CLARIFICATIONS ===` with a minimal frontmatter (`question_count: 0`, `sections: 0`, `duplicates_removed: 0`, `refinement_count: 0`, `scope_recommendation: true`) and a single section explaining the domain is not applicable for this skill type.

**Dimension Task failure**: Proceed with available outputs. Note any failed dimensions in the scored table with `score: 0` and reason `"Research task failed"`. Do not include them in selected dimensions.

**No dimensions selected**: If all dimensions score 2 or below, select the single highest-scoring dimension (score 2 at minimum) and run research for it. A clarifications file with at least some questions is better than an empty file.

---

## Success Criteria

- Extended thinking used for scoring (Step 2)
- All dimension Tasks launched in one turn (Step 3)
- `=== RESEARCH PLAN ===` section present with accurate frontmatter counts
- `=== CLARIFICATIONS ===` section present with accurate frontmatter counts
- All questions have 2–4 choices + "Other (please specify)"
- All questions have `**Recommendation:**` and `**Answer:**` fields
- `priority_questions` lists all Required question IDs
- `refinement_count: 0` (refinements are added in Step 3 by `detailed-research`)
- No inline tags (`[MUST ANSWER]`) in question headings
- Format passes the Rust parser patterns in `references/consolidation-handoff.md`
