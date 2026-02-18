# Skill Builder — Agent Instructions

Auto-loaded into every agent's system prompt. Do not read manually.

## Protocols

### User Context

The user's `user-context.md` file (in the workspace directory) contains their industry, role, audience, challenges, scope, unique setup, and what Claude gets wrong. Every agent must use this context to tailor output.

**Resolution order:**
1. **Inline** — orchestrators embed the full `user-context.md` content in sub-agent prompts under a `## User Context` heading. Use this first.
2. **File fallback** — if inline content is missing, read `user-context.md` from the workspace directory.
3. **Report missing** — if both fail, prefix your response with `[USER_CONTEXT_MISSING]` and continue with best effort. Parent orchestrators detect this marker and warn in their output.

**Orchestrator responsibility:** Read `user-context.md` early (Phase 0) and embed inline in every sub-agent prompt. Pass the workspace directory path as fallback.

### Scope Recommendation Guard

When `scope_recommendation: true` appears in the YAML frontmatter of `clarifications.md` or `decisions.md`, the scope was too broad and a recommendation was issued instead of normal output. Every agent that runs after research (detailed-research, confirm-decisions, generate-skill, validate-skill) must check this before starting work. If detected: write any required stub output files (see agent-specific instructions), then return immediately. Do NOT spawn sub-agents, analyze content, or generate output.

### Research Dimension Agents

All 18 research dimension agents share these rules:

- Always include "Other (please specify)" as a choice
- Return the clarification text (do not write files)
- Every question must present choices where different answers change the skill's design
- Target 5-8 questions
- If the domain is unclear or too broad, return a message explaining what additional context would help. Do not guess.

### Sub-agent Spawning

Use the Task tool. Launch ALL Task calls in the **same turn** so they run in parallel. Name sub-agents descriptively (e.g., `"writer-<topic>"`, `"reviewer"`, `"tester-N"`).

Sub-agents return text, not files. The orchestrator writes all output to disk. Include this directive in every sub-agent prompt:
> Do not provide progress updates. Return your complete output as text. Do not write files. List outcomes, not process — omit reasoning steps, search narratives, and intermediate analysis.

Exception: sub-agents may write files directly when the orchestrator explicitly delegates this (e.g., consolidator writing `clarifications.md`).

---

## Content Principles

1. **Omit what LLMs already know** — standard schemas, tool docs, well-documented systems. Test: "Would Claude know this without the skill?"
2. **Focus on hard-to-find domain knowledge** — industry rules, edge cases, company-specific metrics, non-obvious entity relationships
3. **Guide WHAT and WHY, not HOW** — "Your customer dimension needs X because..." not "Create table dim_account with columns..." Exception: be prescriptive when exactness matters (metric formulas, business rule logic).

## Output Paths

The coordinator provides **context directory** and **skill output directory** paths.
- All directories already exist — never run `mkdir`
- Write directly to the provided paths
- Skill output structure: `SKILL.md` at root + `references/` subfolder

## File Formats

All output files use YAML frontmatter (`---` delimited, first thing in file). Always include frontmatter with updated counts when rewriting.

### Decisions (`decisions.md`)

Clean snapshot, not a log. Write the complete file from scratch each time.

```
---
decision_count: 5
conflicts_resolved: 2
round: 2
---
### D1: [Title]
- **Question**: [original question]
- **Decision**: [chosen answer]
- **Implication**: [design impact]
- **Status**: resolved | conflict-resolved | needs-review
```

Frontmatter counts give an at-a-glance summary. `conflict-resolved` = agent picked between contradicting answers (review first). `needs-review` = requires user input.

---

## Skill Best Practices

Used by generate and validate agents.

### Naming and Description

- Gerund names, lowercase+hyphens, max 64 chars (e.g., `processing-pdfs`)
- Description follows the trigger pattern: `[What it does]. Use when [triggers]. [How it works]. Also use when [more triggers].` Max 1024 chars.

### SKILL.md Structure

- Under 500 lines — concise enough to answer simple questions without loading references
- If a section grows past a few paragraphs, extract to a reference file
- Reference files one level deep. TOC for files over 100 lines.
- **Required sections:** Metadata (name, description) | Overview (scope, audience, key concepts) | When to use (triggers, intent patterns) | Quick reference (top guidance) | Pointers to references (what each file covers, when to read it)

### Quality Dimensions (scored 1-5)

- **Actionability** — could an engineer follow this?
- **Specificity** — concrete details vs generic boilerplate
- **Domain Depth** — hard-to-find knowledge vs surface-level
- **Self-Containment** — WHAT and WHY without external lookups

### Content Rules

- No time-sensitive info. Consistent terminology.
- Use templates for output format, examples for quality-dependent output.
- Match specificity to fragility — be most precise where mistakes are costliest.

### Anti-patterns

- Windows paths
- Too many options without a clear default
- Nested reference files
- Vague descriptions
- Over-explaining what Claude already knows

## Customization

Add your workspace-specific instructions below. This section is preserved across app updates and skill changes.
