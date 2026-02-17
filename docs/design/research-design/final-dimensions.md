# Final Research Dimension Matrix

> Validated dimension catalog and assignment matrix for the Skill Builder's dynamic
> research step. Produced by 3-stage design research: divergent identification (Stage 1),
> adversarial debate (Stage 2), convergence (Stage 3).

---

## Table of Contents

1. [Final Dimension Catalog](#1-final-dimension-catalog)
2. [Final Assignment Matrix](#2-final-assignment-matrix)
3. [Per-Type Template Structures](#3-per-type-template-structures)
4. [Per-Type Focus Overrides](#4-per-type-focus-overrides)
5. [Bundle Dimension Mapping](#5-bundle-dimension-mapping)
6. [Rationale](#6-rationale)
7. [Comparison to Current](#7-comparison-to-current)

---

## 1. Final Dimension Catalog

18 unique dimensions. Each dimension has been validated through a 5-factor rubric
(Primary Template Target, Concrete Failure Mode, Question Differentiation, Orphan
Prevention, Consolidation Separability) and stress-tested against three reference cases.

### Cross-Type Dimensions

#### `entities` — Entity & Relationship Research

| Field | Value |
|-------|-------|
| Slug | `entities` |
| Used by | **all 4 types** (domain, data-engineering, platform, source) |
| Role | Surface core entities, relationships, cardinality patterns, and entity classification decisions specific to the customer's environment |
| Default focus | Identify domain entities, their relationships, cardinality constraints, and cross-entity analysis patterns. Focus on what differs from the standard model Claude already knows. |
| Output | Questions about which entities to model, relationship depth, key cardinality decisions, and departures from textbook models |
| Delta justification | Claude knows standard entity models (Salesforce objects, Kimball star schema, dbt resources). The delta is the customer's specific entity landscape: custom objects, managed package extensions, entity classifications (dimension vs. fact), grain decisions, and non-obvious relationships. |
| Template sections | Varies by type — see per-type mapping |
| Rubric score | 5/5 |

#### `quality-gates` / `data-quality` — Data Quality Research

| Field | Value |
|-------|-------|
| Slug | `quality-gates` (DE) / `data-quality` (source) |
| Used by | **data-engineering**, **source** |
| Role | Surface quality checks, validation patterns, and known quality issues specific to the skill's domain |
| Default focus | Identify pattern-specific quality checks (DE) and org-specific known quality issues (source) that go beyond generic data quality concepts |
| Output | Questions about validation rules, quality gate thresholds, known quality issues, pipeline failure response |
| Delta justification | Claude knows generic data quality concepts (null checks, uniqueness, referential integrity). The delta is pattern-specific checks (e.g., row multiplication accounting after MERGE into Type 2) and org-specific issues (e.g., fields commonly null due to validation rule workarounds). |
| Template sections | DE: Quality Gates & Testing. Source: Data Extraction Gotchas, System Workarounds |
| Rubric score | 5/5 |
| Design note | Single shared agent with type-specific focus overrides, matching the `entities` pattern |

---

### Domain-Specific Dimensions

#### `metrics` — Metrics & KPI Research

| Field | Value |
|-------|-------|
| Slug | `metrics` |
| Used by | **domain** only |
| Role | Surface specific metrics and KPIs with emphasis on where calculation definitions diverge from industry standards — exact formula parameters, inclusion/exclusion rules, calculation nuances |
| Default focus | Identify key business metrics, their exact calculation formulas, parameter definitions (denominators, exclusions, modifiers), and where "approximately correct" defaults would produce wrong analysis |
| Output | Questions about which metrics to support, formula parameters, aggregation granularity, and metric presentation |
| Delta justification | Claude knows textbook formulas (coverage = open/quota, win rate = won/(won+lost)). The delta is every parameter: coverage denominator (quota vs. forecast vs. target), segmented targets (4.5x/2x), win rate exclusions ($25K floor, 14-day minimum), custom modifiers (discount impact factor). |
| Template sections | Metric Definitions (primary), Materiality Thresholds, Output Standards |
| Rubric score | 5/5 |

#### `business-rules` — Business Rules Research

| Field | Value |
|-------|-------|
| Slug | `business-rules` |
| Used by | **domain** only |
| Role | Surface business rules that constrain data modeling — conditional logic, regulatory requirements, organizational policies that override textbook logic |
| Default focus | Identify business rules that affect data modeling, industry-specific variations, regulatory constraints, and rules that engineers without domain expertise commonly implement incorrectly |
| Output | Questions about conditional business logic, regulatory requirements, exception handling rules |
| Delta justification | Claude knows standard business rules at textbook level. The delta is the customer's actual rule logic: pushed deals treated differently by deal type, maverick spend with a $5K threshold plus sole-source exception, co-sold deal attribution models. |
| Template sections | Business Logic Decisions (primary), Materiality Thresholds, Segmentation Standards |
| Rubric score | 5/5 |

#### `segmentation-and-periods` — Segmentation & Period Handling Research

| Field | Value |
|-------|-------|
| Slug | `segmentation-and-periods` |
| Used by | **domain** only |
| Role | Surface how the organization segments business data for analysis and handles time-based logic: segmentation breakpoints, fiscal calendars, snapshot cadence, cross-period rules |
| Default focus | Identify specific segmentation breakpoints (not just "segmentation exists"), fiscal calendar structure, snapshot timing, and cross-period rules that constrain metric calculations |
| Output | Questions about segment definitions, fiscal calendar, period handling, snapshot cadence |
| Delta justification | Claude knows generic segmentation patterns and standard fiscal calendars. The delta is specific breakpoints (enterprise = 500+ employees AND $1M+ ACV), the customer's fiscal calendar (4-4-5? non-January fiscal year?), snapshot timing, and cross-period rules. Without knowing the segmentation, even correct formulas produce wrong answers. |
| Template sections | Segmentation Standards (primary), Period Handling (primary), Materiality Thresholds |
| Rubric score | 5/5 |

#### `modeling-patterns` — Modeling Patterns Research

| Field | Value |
|-------|-------|
| Slug | `modeling-patterns` |
| Used by | **domain** only |
| Role | Surface silver/gold layer modeling patterns for the business domain: fact table granularity, snapshot strategies, source field coverage decisions |
| Default focus | Identify domain-specific modeling decisions: grain choices (stage-transition vs. daily-snapshot), field coverage (which source fields to silver vs. gold), and interactions between grain choices and downstream query patterns |
| Output | Questions about modeling approach, grain decisions, snapshot strategy, field coverage |
| Delta justification | Claude knows Kimball methodology and star schemas. The delta is domain-specific modeling decisions: stage-transition grain vs. daily-snapshot grain for pipeline, field coverage (which source fields to silver, which to gold), and the interaction between grain choices and downstream query patterns. |
| Template sections | Metric Definitions (secondary), Business Logic Decisions (secondary) |
| Rubric score | 3/5 (retained by judgment — grain-decision content is genuinely distinct) |
| Note | F1 (no primary template section) and F4 (no orphan prevention) both fail. Retained because 3 of 4 debate agents defended the grain-decision content as irreducible. Monitor: if questions consistently overlap with metrics, merge. |

---

### Data-Engineering-Specific Dimensions

#### `pattern-interactions` — Pattern Interaction & Selection Research

| Field | Value |
|-------|-------|
| Slug | `pattern-interactions` |
| Used by | **data-engineering** only |
| Role | Surface non-obvious interactions between pattern choices (load strategy, merge approach, historization type, materialization) that constrain each other. Decision trees for pattern selection based on entity characteristics. |
| Default focus | Identify constraint chains between patterns: how SCD type selection constrains merge strategy, how merge strategy constrains key design, how historization choice constrains materialization. Focus on where choosing pattern A forces or precludes pattern B. |
| Output | Questions about pattern interactions, constraint chains, selection criteria |
| Delta justification | Claude knows each pattern individually. The delta is the interactions: SCD Type 2 forces hash-based surrogate keys, which forces MERGE INTO, which requires reliable change timestamps. Late-arriving fact handling depends on whether the joined dimension uses Type 1 (safe) or Type 2 (requires point-in-time lookup). |
| Template sections | Pattern Selection & Interaction Rules (primary), Load & Merge Patterns (secondary) |
| Rubric score | 5/5 |

#### `load-merge-patterns` — Load & Merge Strategy Research (expanded)

| Field | Value |
|-------|-------|
| Slug | `load-merge-patterns` |
| Used by | **data-engineering** only |
| Role | Surface specific load strategy and merge implementation decisions, including failure recovery, backfill strategies, and schema evolution handling |
| Default focus | Identify high-water mark column selection, change detection approaches, merge predicate design, idempotency guarantees, failure recovery patterns, backfill strategies for historized data, schema evolution in versioned tables, and orchestration monitoring for pattern-specific drift |
| Output | Questions about merge predicates, watermark handling, failure recovery, backfill approach, schema evolution |
| Delta justification | Claude knows generic MERGE INTO syntax and high-water marks. The delta is: watermark boundary duplicate handling (overlap window + dedup), MERGE failure recovery for Type 2 (duplicate current records), platform-specific merge characteristics, and day-2 operational concerns (backfilling Type 2 requires historical source snapshots). |
| Template sections | Load & Merge Patterns (primary), Quality Gates & Testing (secondary — monitoring) |
| Rubric score | 5/5 |
| Expansion note | Absorbs former `operational-patterns` content: backfill strategies, schema evolution, version rate monitoring. These are natural scope extensions of the load-merge concern. |

#### `historization` — Historization & Temporal Design Research

| Field | Value |
|-------|-------|
| Slug | `historization` |
| Used by | **data-engineering** only |
| Role | Surface SCD type selection rationale per entity, effective date conventions, snapshot vs. row-versioning trade-offs, bitemporal modeling triggers, history retention policies |
| Default focus | Identify when Type 2 breaks down (>10M rows with 10% daily changes), when snapshots outperform row-versioning (wide tables with many changing columns), when bitemporal modeling is required vs. overkill, and retention policies |
| Output | Questions about SCD type selection per entity, snapshot strategy, bitemporal triggers, retention |
| Delta justification | Claude knows SCD Types 1/2/3/4/6. The delta is threshold decisions: when Type 2 breaks down at scale, when snapshots outperform row-versioning, when bitemporal modeling is required. |
| Template sections | Historization & Temporal Design (primary), Pattern Selection & Interaction Rules (secondary) |
| Rubric score | 5/5 |

#### `layer-design` — Silver/Gold Layer Design Research

| Field | Value |
|-------|-------|
| Slug | `layer-design` |
| Used by | **data-engineering** only |
| Role | Surface layer boundary decisions, conformed dimension governance, fact table granularity, materialization strategy, aggregate table design |
| Default focus | Identify where to draw the silver/gold boundary (source-conformed vs. business-conformed silver), physical vs. logical dimension conformance, materialization trade-offs specific to pattern choices (Type 2 dimensions make views expensive), and aggregate table design |
| Output | Questions about layer boundaries, conformed dimensions, materialization approach, aggregate patterns |
| Delta justification | Claude knows medallion architecture and star schema. The delta is where to draw the silver/gold boundary, physical vs. logical conformance, and materialization trade-offs specific to pattern choices. |
| Template sections | Layer Design & Materialization (primary) |
| Rubric score | 5/5 |

---

### Platform-Specific Dimensions

#### `platform-behavioral-overrides` — Platform Behavioral Override Research

| Field | Value |
|-------|-------|
| Slug | `platform-behavioral-overrides` |
| Used by | **platform** only |
| Role | Surface cases where the platform behaves differently than its documentation states — the "docs say X, reality is Y" items |
| Default focus | Identify behavioral deviations from official documentation in the customer's specific environment. Focus on cases where following the docs produces wrong results. |
| Output | Questions about known behavioral deviations, undocumented limitations, environment-specific behaviors |
| Delta justification | Claude's parametric knowledge comes from official documentation. When reality diverges from docs, Claude is confidently wrong. For dbt on Fabric: `merge` silently degrades on Lakehouse, datetime2 precision causes snapshot failures, warehouse vs. Lakehouse endpoints change available SQL features. |
| Template sections | Platform Behavioral Overrides (primary), Environment-Specific Constraints (secondary) |
| Rubric score | 5/5 |

#### `config-patterns` — Configuration Pattern Research (expanded)

| Field | Value |
|-------|-------|
| Slug | `config-patterns` |
| Used by | **platform** only |
| Role | Surface dangerous configuration combinations (valid syntax, wrong semantics), required settings with non-obvious defaults, version-dependent configuration constraints, and multi-axis compatibility requirements |
| Default focus | Identify configuration combinations that fail in practice, including version-dependent configuration requirements (which adapter/runtime versions change which configurations are valid), adapter version pinning, and breaking changes across version boundaries. Focus on configurations that look correct but produce unexpected behavior. |
| Output | Questions about dangerous configs, version-dependent configuration constraints, multi-axis compatibility |
| Delta justification | Claude generates syntactically valid configurations from documentation. It cannot reason about which configurations produce unexpected runtime behavior. The expanded scope includes version-dependent configuration interactions (e.g., adapter v1.6+ required for incremental materialization, which changes available config options). |
| Template sections | Configuration Patterns and Anti-Patterns (primary), Version Compatibility (co-primary) |
| Rubric score | 5/5 |
| Expansion note | Absorbs former `version-compat` content. The Economist's 5-factor rubric scored version-compat at 3/5 (F5 Consolidation Separability fails because version-dependent config findings overlap with config-patterns findings). All version-compat items from the dbt-on-Fabric case surface naturally when config-patterns asks "Which adapter version are you running, and which configurations does it support?" |

#### `integration-orchestration` — Integration and Orchestration Research

| Field | Value |
|-------|-------|
| Slug | `integration-orchestration` |
| Used by | **platform** only |
| Role | Surface how the platform connects to other tools, CI/CD pipeline patterns, authentication handoffs between tools, orchestration workflows |
| Default focus | Identify integration patterns, CI/CD pipeline configuration, authentication handoffs between tools, and multi-tool orchestration workflows specific to the customer's deployment |
| Output | Questions about CI/CD patterns, cross-tool integration, orchestration workflows |
| Delta justification | Claude knows individual tool documentation but not how tools interact in real deployments. The integration layer (CI/CD pipelines, auth flows across tool boundaries, artifact passing) lives in team-specific runbooks, not documentation. |
| Template sections | Integration and Orchestration Patterns (primary) |
| Rubric score | 5/5 |

#### `operational-failure-modes` — Operational Failure Mode Research

| Field | Value |
|-------|-------|
| Slug | `operational-failure-modes` |
| Used by | **platform** only |
| Role | Surface production failure patterns, debugging procedures, performance pitfalls — the "things that break at 2am" items |
| Default focus | Identify production failure patterns, undocumented timeout behaviors, concurrency issues, environment-specific error behaviors, and debugging procedures that come exclusively from operational experience |
| Output | Questions about production failure patterns, timeout behaviors, concurrency issues, debugging procedures |
| Delta justification | Claude describes happy paths; this dimension surfaces failure paths. Production-incident knowledge (Fabric's unconfigurable 30-minute query timeout, metadata lock contention from concurrent dbt runs, environment-specific test error format differences) comes exclusively from operational experience. |
| Template sections | Operational Gotchas and Failure Modes (primary), Environment-Specific Constraints (secondary) |
| Rubric score | 5/5 |

---

### Source-Specific Dimensions

#### `extraction` — Data Extraction Research (expanded)

| Field | Value |
|-------|-------|
| Slug | `extraction` |
| Used by | **source** only |
| Role | Surface platform-specific extraction traps that produce silently wrong data, including CDC mechanism selection and change detection gotchas |
| Default focus | Identify platform-specific extraction traps (multi-tenant filtering, governor limits at scale, permission/scope affecting completeness), CDC field selection (which timestamp field captures all changes), soft delete detection mechanisms, and parent-child change propagation gaps. Focus on where the obvious approach silently misses data. |
| Output | Questions about extraction traps, CDC mechanisms, soft delete handling, completeness guarantees |
| Delta justification | The synthesis identified multiple failure modes: ORG_ID filtering (~4/10 Claude responses miss), SystemModstamp vs. LastModifiedDate (Claude inconsistently recommends the correct one), queryAll() for soft deletes, WHO column CDC limitation. These are platform-specific traps within each extraction pattern. |
| Template sections | Data Extraction Gotchas (primary), API/Integration Behaviors (secondary) |
| Rubric score | 5/5 |
| Expansion note | Absorbs former `change-detection` content. The user's T3 decision merged these based on the Purist's argument: extraction's refined focus already covered CDC traps, and the two dimensions produced overlapping content about "data extraction gotchas" that the consolidation agent must reconcile. The expanded focus explicitly includes CDC mechanism selection, timestamp field correctness, soft delete detection, and parent-child change propagation — all formerly change-detection scope. |
| Monitor | If extraction agents produce unfocused questions mixing API method selection with CDC field selection, re-evaluate the merge. Test: score extraction questions for focus across 5 source skill builds. |

#### `field-semantics` — Field Semantic Override Research (expanded)

| Field | Value |
|-------|-------|
| Slug | `field-semantics` |
| Used by | **source** only |
| Role | Surface fields whose standard meaning is overridden or misleading, including managed package field overrides and their modification schedules |
| Default focus | Identify fields whose standard meaning is overridden or misleading: managed package field overrides (which packages modify which fields and on what schedule), independently editable field pairs, multi-valued fields with org-specific meanings, ISV field interactions |
| Output | Questions about field semantic overrides, managed package modifications, field independence |
| Delta justification | High-delta content (CPQ overriding Amount, ForecastCategory/StageName independence, Clari overwriting forecast fields nightly) requires explicit research. Claude knows standard field semantics but cannot know which fields have been overridden in the customer's org. |
| Template sections | Field Semantics and Overrides (primary), Reconciliation Rules (secondary) |
| Rubric score | 5/5 |
| Expansion note | Absorbs former `customizations` content. The user's T2 decision merged customizations into field-semantics (not entities, as the Purist/Hybrid proposed) based on the Economist's recommendation. The managed-package-entropy concern is real but surfaces naturally when field-semantics asks "Which managed packages modify which fields and on what schedule?" The highest-risk failure mode (CPQ overriding Amount) is double-covered: entities asks "Which managed packages are installed?", field-semantics asks "Is Amount the authoritative deal value?" |

#### `lifecycle-and-state` — Record Lifecycle & State Research

| Field | Value |
|-------|-------|
| Slug | `lifecycle-and-state` |
| Used by | **source** only |
| Role | Surface record lifecycle patterns: state machines, custom stage progressions, lifecycle boundary behaviors, record type-specific lifecycle variations |
| Default focus | Identify state machine behaviors, custom stage progressions, lifecycle boundary conditions (can records regress? skip stages?), record type-specific lifecycle variations, and independently editable state fields |
| Output | Questions about state progressions, lifecycle variations, record type behaviors |
| Delta justification | Template section "State Machine and Lifecycle" previously had zero researching dimensions. RecordTypeId filtering, ForecastCategory/StageName independence, custom stage progressions are lifecycle behaviors Claude doesn't reliably flag. |
| Template sections | State Machine and Lifecycle (primary), Field Semantics and Overrides (secondary) |
| Rubric score | 5/5 |

#### `reconciliation` — Cross-System Reconciliation Research

| Field | Value |
|-------|-------|
| Slug | `reconciliation` |
| Used by | **source** only |
| Role | Surface cross-table, cross-module, and cross-system reconciliation points where data should agree but often doesn't |
| Default focus | Identify which numbers should agree between systems but don't, source-of-truth resolution for conflicting data, tolerance levels for discrepancies, and reconciliation procedures |
| Output | Questions about reconciliation points, source-of-truth resolution, tolerance levels |
| Delta justification | Claude knows reconciliation as a concept but cannot know which specific tables/objects in a customer's system should agree but don't, or which system is the source of truth. For Customer Beta: SFDC pipeline numbers disagree with Clari and finance. |
| Template sections | Reconciliation Rules (primary), Data Extraction Gotchas (secondary) |
| Rubric score | 5/5 |
| Note | Retained as standalone per user decision (T6), despite the Hybrid's proposal to merge into data-quality. Reconciliation Rules template section loses its only primary dimension if merged. |

---

## 2. Final Assignment Matrix

| Dimension | domain | data-eng | platform | source |
|-----------|:------:|:--------:|:--------:|:------:|
| **Cross-type** | | | | |
| `entities` | x | x | x | x |
| `quality-gates` / `data-quality` | - | x | - | x |
| **Domain** | | | | |
| `metrics` | x | - | - | - |
| `business-rules` | x | - | - | - |
| `segmentation-and-periods` | x | - | - | - |
| `modeling-patterns` | x | - | - | - |
| **Data-engineering** | | | | |
| `pattern-interactions` | - | x | - | - |
| `load-merge-patterns` (expanded) | - | x | - | - |
| `historization` | - | x | - | - |
| `layer-design` | - | x | - | - |
| **Platform** | | | | |
| `platform-behavioral-overrides` | - | - | x | - |
| `config-patterns` (expanded) | - | - | x | - |
| `integration-orchestration` | - | - | x | - |
| `operational-failure-modes` | - | - | x | - |
| **Source** | | | | |
| `extraction` (expanded) | - | - | - | x |
| `field-semantics` (expanded) | - | - | - | x |
| `lifecycle-and-state` | - | - | - | x |
| `reconciliation` | - | - | - | x |
| | | | | |
| **Dimension count** | **5** | **6** | **5** | **6** |

**Total unique dimensions: 18** (1 cross-type universal + 1 cross-type shared + 4 domain + 4 DE + 4 platform + 4 source)

**Agent counts per type:**
- domain: 5 dimension agents
- data-engineering: 6 dimension agents
- platform: 5 dimension agents
- source: 6 dimension agents

**Estimated cost per research step:** ~$0.65 (down from $0.85 proposed at 23 dimensions, up from $0.50 at 14)

---

## 3. Per-Type Template Structures

### Domain Skills (6 sections — validated from synthesis Section 6.2)

| # | Section | Primary Dimension(s) | Secondary |
|---|---------|---------------------|-----------|
| 1 | Metric Definitions | `metrics` | `modeling-patterns` |
| 2 | Materiality Thresholds | `metrics`, `business-rules` | `segmentation-and-periods` |
| 3 | Segmentation Standards | `segmentation-and-periods` | `business-rules`, `entities` |
| 4 | Period Handling | `segmentation-and-periods` | — |
| 5 | Business Logic Decisions | `business-rules` | `entities`, `modeling-patterns` |
| 6 | Output Standards | *consolidation-synthesized* | `metrics`, `segmentation-and-periods`, `modeling-patterns` |

**Note on Output Standards:** No dedicated dimension populates this section (output-standards was dropped per T1). The consolidation agent synthesizes output-format questions from adjacent dimension outputs. A template-section coverage check in the consolidation prompt ensures this section is not left empty.

### Data-Engineering Skills (6 sections — proposed in Stage 1, validated by debate)

| # | Section | Primary Dimension(s) | Secondary |
|---|---------|---------------------|-----------|
| 1 | Pattern Selection & Interaction Rules | `pattern-interactions` | `historization` |
| 2 | Entity & Grain Design | `entities` | `pattern-interactions` |
| 3 | Load & Merge Patterns | `load-merge-patterns` | `pattern-interactions` |
| 4 | Historization & Temporal Design | `historization` | `pattern-interactions` |
| 5 | Layer Design & Materialization | `layer-design` | — |
| 6 | Quality Gates & Testing | `quality-gates` | `load-merge-patterns` (monitoring) |

### Platform Skills (5 sections — proposed in Stage 1, revised by debate)

| # | Section | Primary Dimension(s) | Secondary |
|---|---------|---------------------|-----------|
| 1 | Platform Behavioral Overrides | `platform-behavioral-overrides` | `entities` |
| 2 | Configuration Patterns, Anti-Patterns & Version Compatibility | `config-patterns` (expanded) | `entities` |
| 3 | Integration and Orchestration | `integration-orchestration` | — |
| 4 | Operational Gotchas and Failure Modes | `operational-failure-modes` | — |
| 5 | Environment-Specific Constraints | `platform-behavioral-overrides`, `operational-failure-modes` | `entities` |

**Note:** The original Stage 1 proposed 6 sections including a standalone "Version Compatibility and Migration" section. With version-compat merged into config-patterns (T4 resolution), Section 2 absorbs version compatibility content. Environment-Specific Constraints is cross-cutting rather than dimension-primary.

### Source Skills (6 sections — validated from synthesis Section 6.2)

| # | Section | Primary Dimension(s) | Secondary |
|---|---------|---------------------|-----------|
| 1 | Field Semantics and Overrides | `field-semantics` | `entities`, `lifecycle-and-state` |
| 2 | Data Extraction Gotchas | `extraction` | `data-quality`, `reconciliation` |
| 3 | Reconciliation Rules | `reconciliation` | `field-semantics` |
| 4 | State Machine and Lifecycle | `lifecycle-and-state` | — |
| 5 | System Workarounds | `data-quality` | `field-semantics` |
| 6 | API/Integration Behaviors | `extraction` | — |

---

## 4. Per-Type Focus Overrides

### `entities` — Focus varies by type

| Type | Focus Override |
|------|---------------|
| **domain** | Business entities, customer hierarchies, organizational relationships, and cross-entity analysis patterns |
| **data-engineering** | Entity classification (dimension vs. fact vs. bridge vs. reference), grain decisions per entity, surrogate key strategy, natural key composition, conformed dimension identification |
| **platform** | Platform resources, environment-specific resource distinctions (e.g., Lakehouse vs. warehouse tables), configuration objects, and dependency relationships |
| **source** | Custom objects, managed package objects, record type subdivisions, and non-standard relationships that depart from the platform's standard object model. Do NOT enumerate standard objects Claude already knows. Include installed managed packages, their schema extensions, standard field overrides, and package update impact. |

### `quality-gates` / `data-quality` — Focus varies by type

| Type | Focus Override |
|------|---------------|
| **data-engineering** (as `quality-gates`) | Pattern-specific quality checks (not generic data quality): per-layer validation rules, cross-layer reconciliation accounting for pattern-specific row multiplication, quality gate thresholds, pipeline failure response (halt vs. quarantine vs. continue) |
| **source** (as `data-quality`) | Known data quality issues in the customer's source system: fields that are commonly null or unreliable, validation rules that force incorrect data entry, data cleanup jobs or compensating controls, quality expectations for downstream consumers |

### Expanded dimensions — Additional focus content

| Dimension | Expansion Focus |
|-----------|----------------|
| **`extraction`** (source) | In addition to extraction traps, explicitly cover: CDC field selection (which timestamp field captures all changes including system-initiated changes), soft delete detection mechanisms (queryAll equivalents), and parent-child change propagation gaps (WHO column limitations) |
| **`field-semantics`** (source) | In addition to field overrides, explicitly cover: which managed packages modify which fields and on what schedule, ISV field interactions, and package update impact on field semantics |
| **`config-patterns`** (platform) | In addition to dangerous configurations, explicitly cover: version-dependent configuration requirements, adapter version pinning, multi-axis compatibility requirements (core × adapter × runtime), and breaking changes across version boundaries |
| **`load-merge-patterns`** (DE) | In addition to merge strategies, explicitly cover: failure recovery patterns, backfill strategies for historized data (Type 2 backfill requires historical source snapshots), schema evolution in versioned tables, and orchestration monitoring for pattern-specific drift |

---

## 5. Bundle Dimension Mapping

When source + domain skills operate together, the bundle interaction contract has 4 areas.
These dimensions contribute:

### Field-to-Metric Mapping

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `metrics` | domain | Exact metric formulas identify which source fields are needed |
| `field-semantics` | source | Which source field actually contains the value the domain metric needs (e.g., SBQQ__NetTotal__c, not Amount) |
| `entities` | both | Domain entities map to source objects to extract |

### Semantic Translation Rules

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `field-semantics` | source | Where field meaning diverges from domain expectations |
| `entities` | source | Custom objects with different semantics than standard ones |
| `segmentation-and-periods` | domain | Reporting hierarchy and period boundaries that source data must align to |

### Data Quality Contract

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `data-quality` | source | Known quality issues, unreliable fields |
| `reconciliation` | source | Which numbers to trust, tolerance levels |
| `extraction` | source | Data completeness guarantees (CDC coverage) |
| `metrics` | domain | Materiality thresholds — acceptable null/error rates per metric |
| `business-rules` | domain | What constitutes "valid" data for rule evaluation |

### Refresh and Timing Alignment

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `segmentation-and-periods` | domain | Snapshot cadence, fiscal calendar, reporting period alignment |
| `extraction` | source | Extraction cadence, freshness, CDC lag and propagation timing |

---

## 6. Rationale

### Key decisions from the debate

#### Decisions that shaped the final matrix

1. **output-standards dropped (T1).** Unanimous. The Economist scored it 2/4. The Purist argued output-format questions surface through metrics, segmentation, and business-rules dimensions. The consolidation agent synthesizes the Output Standards template section as a cross-dimensional concern. A template-section coverage check in the consolidation prompt ensures the section is populated.

2. **customizations merged into field-semantics, not entities (T2).** User decision. The Economist recommended this merge (customizations scored 1/4). field-semantics already asks "What does this field actually mean?" — adding "Which managed packages modify these fields?" is a natural scope expansion. The Purist and Hybrid had proposed merging into entities, but the user chose field-semantics because the highest-value customization findings (CPQ overriding Amount, Clari overwriting ForecastCategory) are field-semantic issues, not entity-discovery issues.

3. **change-detection merged into extraction (T3).** User decision, aligning with the Purist's Round 1 position. Three of four agents scored change-detection at 4/4. The merge is justified by F5 (Consolidation Separability): extraction and change-detection both produce content about "data extraction gotchas" that the consolidation agent must reconcile. The expanded extraction focus explicitly includes CDC mechanism selection and timestamp field correctness. Monitor for focus degradation.

4. **version-compat merged into config-patterns for platform (T4).** Hybrid/Economist majority position. All four agents converged on 5 platform dimensions but disagreed on which merge. The Economist's 5-factor rubric settled it: version-compat scored 3/5 (F5 fails — version-dependent config findings are simultaneously config-patterns findings). All three version-compat items from the dbt-on-Fabric case surface naturally through an expanded config-patterns agent.

5. **operational-patterns merged into load-merge-patterns (T5).** Unanimous. The Economist scored operational-patterns at 2/4. Backfill strategies and schema evolution are natural extensions of the load-merge concern.

6. **reconciliation stays standalone (T6).** User decision, confirming the Maximalist and Economist positions. Reconciliation Rules template section loses its only primary dimension if reconciliation merges into data-quality.

7. **operational-failure-modes stays standalone (T4 sub-decision).** Three of four agents (Purist, Hybrid, Economist) explicitly defend it. The Purist's Round 2 reversal was decisive: "the 2am failure category is categorically distinct." The Maximalist proposed dissolving it, but the other three rejected this.

#### How the delta principle affected dimension selection

The delta principle was the primary filter for removing dimensions. `output-standards` failed because its questions ("What is your reporting currency?") are generic across domains — any competent research agent surfaces them. `customizations` failed because its highest-value content (managed package field overrides) is better surfaced through field-semantics, which directly asks about field meaning overrides. The delta principle also drove the original expansion from 14 to 23 — platform-behavioral-overrides, for example, exists specifically because Claude's training data IS the documentation, and when reality diverges from docs, Claude is confidently wrong.

#### How template section mapping affected dimension boundaries

Template section coverage was the strongest argument for keeping standalone dimensions. reconciliation (T6) survived specifically because Reconciliation Rules loses its only primary dimension if merged. lifecycle-and-state exists because State Machine and Lifecycle had zero researching dimensions in the 14-dimension catalog. The dropped output-standards was the one case where the template section argument lost to the delta argument — the consolidation agent can populate Output Standards from adjacent dimension outputs.

#### Consolidation architecture

The debate surfaced a strong consensus (3/4 agents) that two-stage consolidation (sonnet cluster dedup → opus synthesis) improves quality regardless of dimension count. The Economist dissented, arguing single-agent consolidation handles 5-6 dimensions per type comfortably.

**Decision: Single-agent consolidation as default, two-stage as an available option.** The Economist's pragmatic argument is correct at current counts. Two-stage consolidation should be built and benchmarked but activated based on empirical data (if single-agent produces deduplication artifacts in >30% of builds, switch to two-stage).

Proposed cluster definitions for when two-stage is activated:

| Type | Cluster 1 | Cluster 2 |
|------|-----------|-----------|
| **Domain** | entities, metrics, segmentation-and-periods | business-rules, modeling-patterns |
| **Data-engineering** | entities, pattern-interactions, historization | load-merge-patterns, layer-design, quality-gates |
| **Platform** | entities, platform-behavioral-overrides | config-patterns, integration-orchestration, operational-failure-modes |
| **Source** | entities, field-semantics, lifecycle-and-state | extraction, data-quality, reconciliation |

---

## 7. Comparison to Current

### Current Matrix (from `dynamic-research-dimensions.md` Section 2)

| Dimension | domain | data-eng | platform | source |
|-----------|:------:|:--------:|:--------:|:------:|
| `entities` | x | x | x | x |
| `metrics` | x | x | - | - |
| `pipeline-patterns` | - | x | - | - |
| `data-quality` | - | x | - | x |
| `historization` | - | x | - | - |
| `silver-gold-design` | - | x | - | - |
| `business-rules` | x | - | - | - |
| `modeling-patterns` | x | - | - | - |
| `api-patterns` | - | - | x | - |
| `integration` | - | - | x | - |
| `deployment` | - | - | x | - |
| `extraction` | - | - | - | x |
| `authentication` | - | - | - | x |
| `schema-mapping` | - | - | - | x |
| **Total** | **4** | **6** | **4** | **5** |

**Total unique dimensions: 14**

### Final Matrix (this document)

| Dimension | domain | data-eng | platform | source |
|-----------|:------:|:--------:|:--------:|:------:|
| `entities` | x | x | x | x |
| `quality-gates` / `data-quality` | - | x | - | x |
| `metrics` | x | - | - | - |
| `business-rules` | x | - | - | - |
| `segmentation-and-periods` | x | - | - | - |
| `modeling-patterns` | x | - | - | - |
| `pattern-interactions` | - | x | - | - |
| `load-merge-patterns` (expanded) | - | x | - | - |
| `historization` | - | x | - | - |
| `layer-design` | - | x | - | - |
| `platform-behavioral-overrides` | - | - | x | - |
| `config-patterns` (expanded) | - | - | x | - |
| `integration-orchestration` | - | - | x | - |
| `operational-failure-modes` | - | - | x | - |
| `extraction` (expanded) | - | - | - | x |
| `field-semantics` (expanded) | - | - | - | x |
| `lifecycle-and-state` | - | - | - | x |
| `reconciliation` | - | - | - | x |
| **Total** | **5** | **6** | **5** | **6** |

**Total unique dimensions: 18**

### Change Summary

| Change Type | Count | Details |
|-------------|-------|---------|
| **Retained as-is** | 3 | `entities`, `business-rules`, `historization` |
| **Retained with sharpened focus** | 1 | `data-quality` / `quality-gates` (org-specific issues, not generic quality) |
| **Renamed** | 1 | `silver-gold-design` → `layer-design` |
| **Restructured** | 1 | `schema-mapping` → `field-semantics` (expanded to include customizations content) |
| **Split** | 1 | `pipeline-patterns` → `pattern-interactions` + `load-merge-patterns` (expanded with operational-patterns) |
| **Removed** | 3 | `authentication` (fails delta test), `api-patterns` (replaced by platform-behavioral-overrides + config-patterns), `deployment` (replaced by operational-failure-modes + integration-orchestration) |
| **Removed (new, debated out)** | 2 | `output-standards` (consolidation handles it), `version-compat` (merged into config-patterns) |
| **Merged into expanded dimensions** | 3 | `customizations` → `field-semantics`, `change-detection` → `extraction`, `operational-patterns` → `load-merge-patterns` |
| **Added (domain)** | 1 | `segmentation-and-periods` |
| **Added (platform)** | 4 | `platform-behavioral-overrides`, `config-patterns`, `integration-orchestration`, `operational-failure-modes` |
| **Added (source)** | 2 | `lifecycle-and-state`, `reconciliation` |
| **Scope change** | 2 | `metrics` removed from data-engineering, `modeling-patterns` retained at 3/5 score |

### Net change per type

| Type | Current | Final | Net | Key changes |
|------|---------|-------|-----|-------------|
| domain | 4 | 5 | +1 | Added `segmentation-and-periods`. Dropped `output-standards` (proposed then debated out). |
| data-engineering | 6 | 6 | 0 | `pipeline-patterns` split into `pattern-interactions` + `load-merge-patterns` (which absorbed `operational-patterns`). `metrics` removed. `silver-gold-design` → `layer-design`. |
| platform | 4 | 5 | +1 | Complete overhaul. `api-patterns`, `integration`, `deployment` → `platform-behavioral-overrides`, `config-patterns` (expanded), `integration-orchestration`, `operational-failure-modes`. |
| source | 5 | 6 | +1 | `authentication` removed. `schema-mapping` → `field-semantics` (expanded). `extraction` expanded. Added `lifecycle-and-state`, `reconciliation`. |
| **Total** | **14** | **18** | **+4** | |

### Why 18 instead of 14 or 23

The 14-dimension catalog had three structural gaps:
1. **Template sections with no researching dimension:** Domain Output Standards, Source Reconciliation Rules, Source State Machine and Lifecycle — all now covered.
2. **Platform dimensions too broad:** `api-patterns`, `integration`, `deployment` mixed high-delta and low-delta content. Replaced with 4 focused dimensions covering behavioral deviations, dangerous configs, integration, and production failures.
3. **Source skills missed critical failure modes:** SystemModstamp vs. LastModifiedDate, managed package entropy, cross-system reconciliation — all identified by the synthesis as primary failure modes, now systematically researched.

The 23-dimension proposed matrix had 5 dimensions that failed rigorous analysis:
1. `output-standards` (2/4 rubric) — consolidation-agent territory, not research
2. `customizations` (1/4 rubric) — overlaps field-semantics and entities
3. `operational-patterns` (2/4 rubric) — natural extension of load-merge-patterns
4. `change-detection` (4/4 rubric but F5 fails) — overlaps extraction in consolidation output
5. `version-compat` (3/5 rubric) — overlaps config-patterns in consolidation output

The debate validated 18 as the sweet spot: every surviving dimension passes the 5-factor rubric at 4/5 or higher (except modeling-patterns at 3/5, retained by judgment), produces differentiated questions from its neighbors, and can be processed by the consolidation agent without significant deduplication.

### Inclusion gate for future changes

Use the 5-factor rubric to evaluate any proposed dimension additions or removals:

| Factor | Question | Score 1 if... |
|--------|----------|---------------|
| F1: Primary Template Target | Is this dimension the primary populator of at least one template section? | Yes |
| F2: Concrete Failure Mode | Does the delta justification cite a specific, worked failure scenario? | Yes |
| F3: Question Differentiation | Do this dimension's questions differ meaningfully from every adjacent dimension? | Yes |
| F4: Orphan Prevention | Would removing it leave a template section with no primary? | Yes |
| F5: Consolidation Separability | Can the consolidation agent process this dimension's output without deduplicating against an adjacent dimension? | Yes |

**Threshold: 4 of 5.** Re-score after the first 5 skill builds with empirical overlap data.
