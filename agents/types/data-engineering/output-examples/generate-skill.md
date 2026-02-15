Example SKILL.md metadata block and pointer section:

```markdown
---
name: SCD Type 2 Implementation Patterns
description: Data engineering knowledge for implementing slowly changing dimension Type 2 patterns, covering surrogate key design, effective date management, merge strategies, and downstream join patterns.
author: octocat
created: 2025-06-15
modified: 2025-06-15
---

# SCD Type 2 Implementation Patterns

## Overview
This skill covers SCD Type 2 implementation patterns for engineers building historized dimensions in data warehouses and lakehouses. Key concepts: surrogate key generation, effective date ranges, merge/upsert logic, and impact on downstream fact table joins.

## When to Use This Skill
- Engineer asks about tracking historical changes in dimension tables
- Questions about surrogate key strategies or natural key vs. surrogate key trade-offs
- Designing merge logic for incremental dimension updates
- Handling late-arriving dimension changes or retroactive corrections

## Quick Reference
- Surrogate keys should be deterministic (hash-based) rather than sequential for idempotent loads...
- Effective date ranges use closed-open intervals [effective_from, effective_to) with a sentinel value for current records...

## Reference Files
- **references/surrogate-key-design.md** — Surrogate key generation strategies (hash vs. sequence), deterministic key benefits, and collision handling. Read when designing dimension key architecture.
- **references/merge-strategies.md** — MERGE/UPSERT patterns for detecting changes, closing old records, and inserting new versions. Read when implementing the load process.
- **references/downstream-joins.md** — How SCD Type 2 dimensions affect fact table joins, point-in-time lookups, and query performance. Read when designing or debugging downstream models.
```
