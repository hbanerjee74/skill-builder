```markdown
## Source Metrics & KPIs

### Q1: How should data extraction success be measured?
Source extractions can fail partially or fully. How should the skill define extraction success metrics?

**Choices:**
a) **Binary success/failure per run** — Simple but hides partial failures where most records succeed.
b) **Record-level success rate** — Tracks percentage of records successfully extracted per run.
c) **Multi-dimensional quality score** — Combines completeness, freshness, and schema conformance into a composite metric.
d) **Other (please specify)**

**Recommendation:** Option (b) — record-level success rate catches partial failures that binary metrics miss, without the complexity of composite scoring.

**Answer:**
```
