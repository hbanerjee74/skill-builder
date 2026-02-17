```markdown
## Pipeline Entities & Relationships

### Q1: What historization strategy should the skill recommend?
Data pipelines need to track how data changes over time. The historization approach affects dimension design, storage costs, and downstream query patterns.

**Choices:**
a) **SCD Type 1 (overwrite)** — Simplest; replaces old values with new. No history preserved.
b) **SCD Type 2 (versioned rows)** — Adds new rows with effective date ranges. Full history but increases table size and join complexity.
c) **Snapshot-based** — Periodic full snapshots of the dimension. Easy to query at a point in time but storage-intensive.
d) **Other (please specify)**

**Recommendation:** Option (b) — SCD Type 2 is the most versatile historization strategy and the industry default for dimensions where tracking changes matters. Storage and join complexity are manageable with proper surrogate key design.

**Answer:**
```
