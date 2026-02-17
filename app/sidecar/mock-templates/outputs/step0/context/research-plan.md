# Research Plan

**Skill Type:** data-engineering
**Domain:** Dimensional Data Pipelines

## Chosen Dimensions (4)

### 1. entities
**Rationale:** Core dimension — every data engineering skill needs entity/relationship modeling for pipeline components, table structures, and data lineage.
**Tailored focus:** Pipeline components, dimension/fact tables, SCD structures, surrogate key strategies, and data lineage relationships specific to dimensional modeling.

### 2. metrics
**Rationale:** Dimensional pipelines require clear KPI definitions, aggregation rules, and quality measurements tied to fact table grain.
**Tailored focus:** Fact table metrics, aggregation hierarchies, data quality SLAs, and pipeline throughput measurements for dimensional loads.

### 3. historization
**Rationale:** Central to dimensional modeling — SCD strategies, temporal design, and point-in-time query patterns define how dimensions track change.
**Tailored focus:** SCD Type 1/2/3 strategies, effective dating, snapshot vs. versioned rows, and temporal join patterns for dimensional queries.

### 4. load-merge-patterns
**Rationale:** Dimensional pipelines need specific load strategies (full refresh vs. incremental, merge vs. append) that interact with historization choices.
**Tailored focus:** Dimension load strategies (full vs. incremental), fact table merge patterns, late-arriving dimension handling, and deduplication approaches.

## Excluded Dimensions (14)

| Dimension | Reason |
|---|---|
| data-quality | Covered implicitly by metrics dimension |
| business-rules | More relevant to domain skills than pipeline skills |
| segmentation-and-periods | Domain-level concern, not pipeline architecture |
| modeling-patterns | Overlaps with entities + historization for this domain |
| pattern-interactions | Relevant for complex multi-pattern pipelines, not core dimensional |
| layer-design | Silver/gold layer design is secondary to core dimensional patterns |
| platform-behavioral-overrides | Platform-specific, not relevant to dimensional modeling concepts |
| config-patterns | Platform-specific concern |
| integration-orchestration | Orchestration is orthogonal to dimensional modeling |
| operational-failure-modes | Operational concern, not modeling concern |
| extraction | Source-specific concern |
| field-semantics | Source-specific concern |
| lifecycle-and-state | Source-specific concern |
| reconciliation | Cross-system concern, not core to dimensional pipelines |
