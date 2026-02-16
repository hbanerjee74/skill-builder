```markdown
## Domain Concepts & Metrics

### Q1: What historization strategy should the skill recommend?
Data pipelines need to track how data changes over time. The historization approach affects dimension design, storage costs, and downstream query patterns.

**Choices:**
a) **SCD Type 1 (overwrite)** — Simplest; replaces old values with new. No history preserved.
b) **SCD Type 2 (versioned rows)** — Adds new rows with effective date ranges. Full history but increases table size and join complexity.
c) **Snapshot-based** — Periodic full snapshots of the dimension. Easy to query at a point in time but storage-intensive.
d) **Other (please specify)**

**Recommendation:** Option (b) — SCD Type 2 is the most versatile historization strategy and the industry default for dimensions where tracking changes matters. Storage and join complexity are manageable with proper surrogate key design.

**Answer:**

### Q2: How should the skill approach incremental loading?
Pipelines can load data in full each run or incrementally capture only changes. This affects pipeline cost, latency, and complexity.

**Choices:**
a) **Full refresh each run** — Simplest; replaces the target table entirely. No state management needed but expensive at scale.
b) **Timestamp-based incremental** — Loads records modified since the last run using a high-water mark. Simple but misses deletes and can miss updates if timestamps are unreliable.
c) **Change data capture (CDC)** — Captures inserts, updates, and deletes from source system logs. Most complete but requires source system support and adds operational complexity.
d) **Other (please specify)**

**Recommendation:** Option (b) — timestamp-based incremental is the best starting point for most pipelines. It handles the 80% case with minimal infrastructure. CDC can be recommended as an upgrade path for pipelines where delete detection or sub-minute latency matters.

**Answer:**
```
