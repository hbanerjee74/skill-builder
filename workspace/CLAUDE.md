# Skill Builder — Agent Instructions

Auto-loaded into every agent's system prompt. Do not read manually.

## Protocols

### Rerun / Resume Mode
If the coordinator's prompt contains `[RERUN MODE]`:
1. Read the existing output file and summarize (3-5 bullets)
2. STOP — do not spawn sub-agents or re-run research
3. Wait for user direction, then make targeted changes

### Before You Start
Check if your output file already exists. If so, UPDATE rather than rewrite from scratch. Instruct sub-agents to do the same.

### Sub-agent Communication
Include this directive verbatim in every sub-agent prompt:
> Do not provide progress updates. When finished, respond with only: `Done — wrote [filename] ([N] items)`.

---

## Skill Users
Data/analytics engineers who need domain context to model silver and gold layer tables. They know SQL/dbt — the skill provides WHAT and WHY (entities, metrics, business rules, pitfalls), not HOW.

## Content Principles
1. **Omit what LLMs already know** — standard schemas, tool docs, well-documented systems. Test: "Would Claude know this without the skill?"
2. **Focus on hard-to-find domain knowledge** — industry rules, edge cases, company-specific metrics, non-obvious entity relationships
3. **Guide WHAT and WHY, not HOW** — "Your customer dimension needs X because..." not "Create table dim_account with columns..." Exception: be prescriptive when exactness matters (metric formulas, business rule logic).

## Output Paths
The coordinator provides **context directory** and **skill output directory** paths. Write files only to these directories — no extra subdirectories. The skill output structure is `SKILL.md` at root + `references/` subfolder.

## File Formats

IMPORTANT: All output files use YAML frontmatter (`---` delimited, first thing in file). Always include frontmatter with updated counts when rewriting.

### Clarifications (`clarifications-*.md` and `clarifications.md`)
```
---
question_count: 12
sections: ["Entity Model", "Metrics & KPIs"]
duplicates_removed: 3  # merged file only
---
## [Section]
### Q1: [Title]
**Question**: [text]
**Choices**:
  a) [Choice] — [rationale]
  b) [Choice] — [rationale]
  c) Other (please specify)
**Recommendation**: [letter] — [why]
**Answer**: [PM's choice, or empty for unanswered]
```
**Auto-fill rule:** Empty `**Answer**:` fields → use the `**Recommendation**:` as the answer. Do not ask for clarification — use the recommendation and proceed.

### Decisions (`decisions.md`)
Clean snapshot, not a log. Each update rewrites the file, merging existing + new decisions. Superseded entries are replaced (keep D-number), new entries added at end.
```
---
decision_count: 5
round: 2
---
### D1: [Title]
- **Question**: [original question]
- **Decision**: [chosen answer]
- **Implication**: [design impact]
```

---

## Skill Best Practices

Used by validate agents to check skill quality.

**Core:** Concise (only add context Claude doesn't have). Match specificity to fragility. Test with all target models.

**Structure:** Gerund names (`processing-pdfs`, lowercase+hyphens, max 64 chars). Third-person descriptions (what + when, max 1024 chars). SKILL.md body under 500 lines. Reference files one level deep from SKILL.md. TOC for files over 100 lines.

**Content:** No time-sensitive info. Consistent terminology. Use templates for output format, examples for quality-dependent output. Feedback loops: validate, fix, repeat.

**Checklist:** Specific description with key terms | under 500 lines | separate reference files if needed | no stale info | consistent terms | concrete examples | one-level refs | progressive disclosure | clear workflow steps | 3+ evaluations | tested with target models and real scenarios

**Anti-patterns:** Windows paths | too many options (default + escape hatch) | nested refs | vague descriptions | over-explaining what Claude knows
