---
skill_type: data-engineering
domain: Dimensional Data Pipelines
dimensions_chosen: 4
dimensions_excluded: 14
---
# Research Plan

## Skill: Dimensional Data Pipelines (data-engineering)

## Chosen Dimensions

| Dimension | Focus |
|-----------|-------|
| entities | Pipeline components, dimension/fact tables, SCD structures, surrogate key strategies, and data lineage relationships specific to dimensional modeling. |
| metrics | Fact table metrics, aggregation hierarchies, data quality SLAs, and pipeline throughput measurements for dimensional loads. |
| historization | SCD Type 1/2/3 strategies, effective dating, snapshot vs. versioned rows, and temporal join patterns for dimensional queries. |
| load-merge-patterns | Dimension load strategies (full vs. incremental), fact table merge patterns, late-arriving dimension handling, and deduplication approaches. |

## Reasoning

### Included
- **entities**: Core dimension — every data engineering skill needs entity/relationship modeling for pipeline components, table structures, and data lineage.
- **metrics**: Dimensional pipelines require clear KPI definitions, aggregation rules, and quality measurements tied to fact table grain.
- **historization**: Central to dimensional modeling — SCD strategies, temporal design, and point-in-time query patterns define how dimensions track change.
- **load-merge-patterns**: Dimensional pipelines need specific load strategies (full refresh vs. incremental, merge vs. append) that interact with historization choices.

### Excluded
- **data-quality**: Covered implicitly by metrics dimension
- **business-rules**: More relevant to domain skills than pipeline skills
- **segmentation-and-periods**: Domain-level concern, not pipeline architecture
- **modeling-patterns**: Overlaps with entities + historization for this domain
- **pattern-interactions**: Relevant for complex multi-pattern pipelines, not core dimensional
- **layer-design**: Silver/gold layer design is secondary to core dimensional patterns
- **platform-behavioral-overrides**: Platform-specific, not relevant to dimensional modeling concepts
- **config-patterns**: Platform-specific concern
- **integration-orchestration**: Orchestration is orthogonal to dimensional modeling
- **operational-failure-modes**: Operational concern, not modeling concern
- **extraction**: Source-specific concern
- **field-semantics**: Source-specific concern
- **lifecycle-and-state**: Source-specific concern
- **reconciliation**: Cross-system concern, not core to dimensional pipelines
