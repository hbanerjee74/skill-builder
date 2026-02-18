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
