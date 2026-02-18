## File Formats

All output files use YAML frontmatter (`---` delimited, first thing in file). Always include frontmatter with updated counts when rewriting.

### Clarifications (`clarifications.md`)

Single file across both research rounds. The detailed-research step inserts `#### Refinements` subsections in-place.

```
---
question_count: 12
sections: ["Entity Model", "Metrics & KPIs"]
duplicates_removed: 3
---
## [Section]
### Q1: [Title]
**Question**: [text]
**Choices**:
  a) [Choice] — [rationale]
  b) [Choice] — [rationale]
  c) Other (please specify)
**Recommendation**: [letter] — [why]

**Answer**:

```

Every question MUST end with a blank `**Answer**:` line followed by an empty line. Never omit it, never pre-fill it.

**Auto-fill rule:** Empty `**Answer**:` fields → use the `**Recommendation**:` as the answer. Do not ask for clarification.

#### Refinements

Inserted under answered questions that warrant follow-up. Refinement IDs use the parent question number as prefix (R3.1 = first refinement under Q3).

```
### Q1: [Original question]
**Answer**: [User's first-round answer]

#### Refinements

**R1.1: Follow-up topic**
Rationale for why this matters given the answer above...
- [ ] Choice a
- [ ] Choice b
- [ ] Other (please specify)

**Answer**:

```

#### Scope Recommendation mode

When the research planner selects too many dimensions, the scope-advisor writes a scope recommendation instead of normal clarifications. The file has `scope_recommendation: true` in frontmatter. Downstream agents detect this and no-op (see Scope Recommendation Guard).

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
