```markdown
## Pipeline Metrics & KPIs

### Q1: How should the skill approach incremental loading?
Pipelines can load data in full each run or incrementally capture only changes. This affects pipeline cost, latency, and complexity.

**Choices:**
a) **Full refresh each run** — Simplest; replaces the target table entirely. No state management needed but expensive at scale.
b) **Timestamp-based incremental** — Loads records modified since the last run using a high-water mark. Simple but misses deletes and can miss updates if timestamps are unreliable.
c) **Change data capture (CDC)** — Captures inserts, updates, and deletes from source system logs. Most complete but requires source system support and adds operational complexity.
d) **Other (please specify)**

**Recommendation:** Option (b) — timestamp-based incremental is the best starting point for most pipelines. It handles the 80% case with minimal infrastructure. CDC can be recommended as an upgrade path for pipelines where delete detection or sub-minute latency matters.

**Answer:**
```
