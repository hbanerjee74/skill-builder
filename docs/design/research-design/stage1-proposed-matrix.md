# Stage 1: Proposed Dimension Assignment Matrix

> Synthesis of all 4 divergent research outputs (domain, data-engineering, platform, source).
> Input for Stage 2 adversarial validation.

---

## 1. Full Dimension Catalog

Union of all dimensions identified across the 4 skill-type researchers. Dimensions are
grouped by scope: cross-type (used by 2+ types) and type-specific (used by 1 type).

### Cross-Type Dimensions

#### `entities` — Entity & Relationship Research

| Field | Value |
|-------|-------|
| Used by | **all 4 types** |
| Role | Surface core entities, relationships, cardinality patterns, and entity classification decisions |
| Delta justification | Claude knows standard entity models (Salesforce objects, Kimball star schema, dbt resources). The delta is the *customer's specific* entity landscape: custom objects, managed package extensions, entity classifications (dimension vs. fact), grain decisions, and non-obvious relationships that don't exist in textbook models. |

**Per-type focus overrides:**

| Type | Focus |
|------|-------|
| **domain** | Business entities, customer hierarchies, organizational relationships, and cross-entity analysis patterns |
| **data-engineering** | Entity classification (dimension vs. fact vs. bridge vs. reference), grain decisions per entity, surrogate key strategy, natural key composition, conformed dimension identification |
| **platform** | Platform resources, environment-specific resource distinctions (e.g., Lakehouse vs. warehouse tables), configuration objects, and dependency relationships |
| **source** | Custom objects, managed package objects, record type subdivisions, and non-standard relationships that depart from the platform's standard object model. Do NOT enumerate standard objects Claude already knows. |

#### `data-quality` / `quality-gates` — Data Quality Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** (as `quality-gates`), **source** (as `data-quality`) |
| Role | Surface quality checks, validation patterns, and known quality issues specific to the skill's domain |
| Delta justification | Claude knows generic data quality concepts (null checks, uniqueness, referential integrity). The delta is pattern-specific quality checks (DE) and org-specific known quality issues (source). |
| Design question | Should this remain a single shared agent with type-specific focus overrides, or split into two agents? The DE researcher's renaming to `quality-gates` reflects a meaningful scope difference from source `data-quality`. |

**Per-type focus overrides:**

| Type | Focus |
|------|-------|
| **data-engineering** (as `quality-gates`) | Pattern-specific quality checks (not generic data quality): per-layer validation rules, cross-layer reconciliation accounting for pattern-specific row multiplication, quality gate thresholds, pipeline failure response (halt vs. quarantine vs. continue) |
| **source** (as `data-quality`) | Known data quality issues in the customer's source system: fields that are commonly null or unreliable, validation rules that force incorrect data entry, data cleanup jobs or compensating controls, quality expectations for downstream consumers |

---

### Domain-Specific Dimensions

#### `metrics` — Metrics & KPI Research

| Field | Value |
|-------|-------|
| Used by | **domain** only |
| Role | Surface specific metrics and KPIs with emphasis on where calculation definitions diverge from industry standards — exact formula parameters, inclusion/exclusion rules, calculation nuances |
| Delta justification | Claude knows textbook formulas (coverage = open/quota, win rate = won/(won+lost)). The delta is every parameter: coverage denominator (quota vs. forecast vs. target), segmented targets (4.5x/2x), win rate exclusions ($25K floor, 14-day minimum), custom modifiers (discount impact factor). The synthesis showed "approximately correct" metric defaults are the worst failure mode. |
| Template sections | Metric Definitions, Materiality Thresholds, Output Standards |

**Note:** The existing catalog assigned `metrics` to both domain and data-engineering. The DE researcher removed it from data-engineering, arguing pipeline health metrics are better surfaced through `quality-gates` and `operational-patterns`. Domain skills need business KPIs; data-engineering skills need quality gates and operational monitors.

#### `business-rules` — Business Rules Research

| Field | Value |
|-------|-------|
| Used by | **domain** only |
| Role | Surface business rules that constrain data modeling — conditional logic ("if X then Y, unless Z"), regulatory requirements, organizational policies that override textbook logic |
| Delta justification | Claude knows standard business rules at textbook level. The delta is the customer's actual rule logic: pushed deals treated differently by deal type, maverick spend with a $5K threshold plus sole-source exception, co-sold deal attribution models. These are organizational decisions encoded in tribal knowledge. |
| Template sections | Business Logic Decisions, Materiality Thresholds, Segmentation Standards |

#### `segmentation-and-periods` — Segmentation & Period Handling Research

| Field | Value |
|-------|-------|
| Used by | **domain** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface how the organization segments business data for analysis and handles time-based logic: segmentation breakpoints, fiscal calendars, snapshot cadence, cross-period rules |
| Delta justification | Claude knows generic segmentation patterns and standard fiscal calendars. The delta is specific breakpoints (enterprise = 500+ employees AND $1M+ ACV), the customer's fiscal calendar (4-4-5? non-January fiscal year?), snapshot timing, and cross-period rules. The synthesis showed coverage targets are segmented — without knowing the segmentation, even correct formulas produce wrong answers. |
| Template sections | Segmentation Standards, Period Handling, Materiality Thresholds, Output Standards |

**Why new:** The existing catalog has no dimension explicitly surfacing segmentation breakpoints and period-handling rules. Currently implicit in `metrics` and `business-rules`, but the synthesis showed these are the *most variable* aspects of domain skills. A dedicated dimension ensures these questions are asked directly. Also critical for the bundle interaction contract's Refresh and Timing Alignment.

#### `modeling-patterns` — Modeling Patterns Research

| Field | Value |
|-------|-------|
| Used by | **domain** only |
| Role | Surface silver/gold layer modeling patterns for the business domain: snapshot strategies, fact table granularity, dimension historization choices, source field coverage decisions |
| Delta justification | Claude knows Kimball methodology and star schemas. The delta is domain-specific modeling decisions: stage-transition grain vs. daily-snapshot grain for pipeline, field coverage (which source fields to silver, which to gold), and the interaction between grain choices and downstream query patterns. |
| Template sections | Metric Definitions, Business Logic Decisions, Output Standards |

#### `output-standards` — Output & Presentation Standards Research

| Field | Value |
|-------|-------|
| Used by | **domain** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface organizational requirements for how domain data should be formatted, labeled, and presented: reporting currency, number formatting, drill-down hierarchies, standard report layouts, terminology standards |
| Delta justification | Claude produces generic output formatting guidance. The delta is organization-specific standards: specific QBR waterfall chart categories, FX conversion at first-of-month spot rate vs. transaction-date rate, region-first drill-down hierarchy. These are arbitrary but mandatory organizational decisions. |
| Template sections | Output Standards, Segmentation Standards |

**Why new:** Output Standards is one of the 6 domain template sections but no existing dimension populates it. Without a dedicated dimension, the Output Standards section remains generic.

---

### Data-Engineering-Specific Dimensions

#### `pattern-interactions` — Pattern Interaction & Selection Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** only |
| Status | **NEW** — split from `pipeline-patterns` |
| Role | Surface non-obvious interactions between pattern choices (load strategy, merge approach, historization type, materialization) that constrain each other. Decision trees for pattern selection based on entity characteristics. |
| Delta justification | Claude knows each pattern individually (SCD types, merge strategies, incremental loading). The delta is the *interactions*: SCD Type 2 forces hash-based surrogate keys, which forces MERGE INTO, which requires reliable change timestamps. Late-arriving fact handling depends on whether the joined dimension uses Type 1 (safe) or Type 2 (requires point-in-time lookup). These interaction rules are the highest-value delta. |
| Template sections | Pattern Selection & Interaction Rules (primary), Load & Merge Patterns (secondary) |

**Why split from `pipeline-patterns`:** The existing dimension conflated strategic interaction knowledge (highest delta) with tactical implementation details (medium delta). Splitting produces more focused clarification questions.

#### `load-merge-patterns` — Load & Merge Strategy Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** only |
| Status | **NEW** — split from `pipeline-patterns` |
| Role | Surface specific load strategy and merge implementation decisions: high-water mark column selection, change detection approaches, merge predicate design, idempotency guarantees, failure recovery, platform-specific merge limitations |
| Delta justification | Claude knows generic MERGE INTO syntax and high-water marks. The delta is: watermark boundary duplicate handling (overlap window + dedup), hash-based vs. timestamp-based change detection trade-offs, MERGE failure recovery for Type 2 (duplicate current records), platform-specific merge characteristics (Fabric vs. Snowflake vs. Databricks). |
| Template sections | Load & Merge Patterns (primary) |

#### `historization` — Historization & Temporal Design Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** only |
| Role | Surface SCD type selection rationale per entity, effective date conventions, snapshot vs. row-versioning trade-offs, bitemporal modeling triggers, history retention policies |
| Delta justification | Claude knows SCD Types 1/2/3/4/6. The delta is when Type 2 breaks down (>10M rows with 10% daily changes), when snapshots outperform row-versioning (wide tables with many changing columns), and when bitemporal modeling is required vs. overkill. |
| Template sections | Historization & Temporal Design (primary), Pattern Selection & Interaction Rules (secondary) |

#### `layer-design` — Silver/Gold Layer Design Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** only |
| Status | Renamed from `silver-gold-design` |
| Role | Surface layer boundary decisions, conformed dimension governance, fact table granularity, materialization strategy, aggregate table design |
| Delta justification | Claude knows medallion architecture and star schema. The delta is where to draw the silver/gold boundary (source-conformed vs. business-conformed silver), physical vs. logical dimension conformance, and materialization trade-offs specific to pattern choices (Type 2 dimensions make views expensive). |
| Template sections | Layer Design & Materialization (primary) |

#### `operational-patterns` — Operational & Recovery Research

| Field | Value |
|-------|-------|
| Used by | **data-engineering** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface day-2 operational concerns: backfill strategies for historized data, schema evolution in versioned tables, orchestration dependencies for cross-entity patterns, monitoring for pattern-specific drift |
| Delta justification | Claude knows generic pipeline orchestration. The delta is that backfilling a Type 2 dimension requires historical source snapshots (can't just re-run), adding a column to a Type 2 table forces decisions about historical records, and version rate monitoring is Type-2-specific. |
| Template sections | Load & Merge Patterns (recovery subsection), Quality Gates & Testing (monitoring subsection) |

**Why new:** The existing catalog covers initial implementation but not day-2 operations. A skill covering SCD Type 2 without covering backfill is incomplete in a way that causes real production incidents.

---

### Platform-Specific Dimensions

#### `platform-behavioral-overrides` — Platform Behavioral Override Research

| Field | Value |
|-------|-------|
| Used by | **platform** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface cases where the platform behaves differently than its documentation states or than Claude would predict — specific to the customer's environment. The "docs say X, reality is Y" items. |
| Delta justification | Claude's parametric knowledge comes from official documentation. For dbt, this means Snowflake/BigQuery-centric knowledge. Claude does not know that `merge` strategy silently degrades on Fabric Lakehouse, that datetime2 precision causes snapshot failures, or that warehouse vs. Lakehouse endpoints change available SQL features. These are experiential findings from operating in the specific environment. |
| Template sections | Platform Behavioral Overrides (primary), Environment-Specific Constraints (secondary) |

**Why new:** This is the single highest-delta dimension for platform skills. Claude's training data IS the docs — when reality diverges from docs, Claude is confidently wrong. No existing dimension covers this.

#### `config-patterns` — Configuration Pattern Research

| Field | Value |
|-------|-------|
| Used by | **platform** only |
| Status | **NEW** — replaces `api-patterns` and `deployment` configuration aspects |
| Role | Surface configuration schemas, project structure patterns, and dangerous configuration combinations: valid configs that produce unexpected results, required settings with non-obvious defaults, interacting configuration options |
| Delta justification | Claude generates syntactically valid configurations from documentation. It cannot reason about which configurations produce unexpected runtime behavior — `threads: 16` causing Fabric throttling, specific ODBC driver versions required, mandatory `dispatch` overrides for `dbt_utils` on Fabric. |
| Template sections | Configuration Patterns and Anti-Patterns (primary), Version Compatibility (secondary) |

#### `version-compat` — Version Compatibility Research

| Field | Value |
|-------|-------|
| Used by | **platform** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface version-specific behavioral changes, version pinning requirements, breaking changes, and the interaction between multiple version axes (platform core × adapter × runtime environment) |
| Delta justification | Claude's training data contains documentation for multiple versions without version boundaries. It may mix advice from dbt-core 1.5 and 1.7, or recommend features requiring a specific minimum adapter version. The multi-axis version interaction space is poorly documented. |
| Template sections | Version Compatibility and Migration (primary) |

#### `integration-orchestration` — Integration and Orchestration Research

| Field | Value |
|-------|-------|
| Used by | **platform** only |
| Status | Replaced `integration` with broader scope |
| Role | Surface how the platform connects to other tools, CI/CD pipeline patterns, authentication handoffs between tools, orchestration workflows |
| Delta justification | Claude knows individual tool documentation but not how tools interact in real deployments. The integration layer (CI/CD pipelines, auth flows across tool boundaries, artifact passing) is where most production complexity lives — in team-specific runbooks, not in documentation. |
| Template sections | Integration and Orchestration Patterns (primary) |

#### `operational-failure-modes` — Operational Failure Mode Research

| Field | Value |
|-------|-------|
| Used by | **platform** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface production failure patterns, debugging procedures, performance pitfalls, and operational tribal knowledge — the "things that break at 2am" items |
| Delta justification | Claude describes happy paths; this dimension surfaces failure paths. Claude does not know that Fabric's SQL endpoint has an unconfigurable 30-minute query timeout, that concurrent dbt runs cause metadata lock contention, or that `dbt test` error formats differ by environment. This knowledge comes exclusively from production incidents. |
| Template sections | Operational Gotchas and Failure Modes (primary), Environment-Specific Constraints (secondary) |

---

### Source-Specific Dimensions

#### `extraction` — Data Extraction Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Role | Surface platform-specific extraction traps that produce silently wrong data: multi-tenant filtering, API pagination edge cases, governor limits at scale, permission/scope affecting data completeness |
| Delta justification | The synthesis identified multiple failure modes: ORG_ID filtering (~4/10 Claude responses miss), interface tables containing uncommitted transactions. The delta is platform-specific traps within each extraction pattern, not the pattern selection itself. |
| Template sections | Data Extraction Gotchas (primary), API/Integration Behaviors (secondary) |

**Note:** Focus refined from "bulk vs incremental vs streaming" (which Claude knows) to platform-specific traps.

#### `field-semantics` — Field Semantic Override Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Status | Restructured from `schema-mapping` |
| Role | Surface fields whose standard meaning is overridden or misleading: managed package field overrides, independently editable field pairs, multi-valued fields with org-specific meanings |
| Delta justification | High-delta content (CPQ overriding Amount, ForecastCategory/StageName independence) separated from low-delta content (type coercion, schema evolution that Claude knows). |
| Template sections | Field Semantics and Overrides (primary), Reconciliation Rules (secondary) |

#### `change-detection` — Change Detection Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface correct CDC/change detection mechanisms and platform-specific gotchas where the obvious approach silently misses changes: CDC field selection, soft delete detection, parent-child change propagation gaps |
| Delta justification | The synthesis identified this as a primary failure mode: SystemModstamp vs. LastModifiedDate, queryAll() for soft deletes, WHO column CDC limitation. These are NOT generic CDC concepts — they are platform-specific gotchas. |
| Template sections | Data Extraction Gotchas (primary), API/Integration Behaviors (secondary) |

**Why new:** `extraction` covers HOW to pull data (API method, rate limits); `change-detection` covers WHAT to pull (which records changed). The wrong answer to "what changed?" produces silently incomplete data.

#### `lifecycle-and-state` — Record Lifecycle & State Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface record lifecycle patterns: state machines, custom stage progressions, lifecycle boundary behaviors, record type-specific lifecycle variations |
| Delta justification | Template section 4 ("State Machine and Lifecycle") previously had no researching dimension. RecordTypeId filtering, ForecastCategory/StageName independence, custom stage progressions are all lifecycle issues Claude doesn't reliably flag. |
| Template sections | State Machine and Lifecycle (primary), Field Semantics and Overrides (secondary) |

#### `customizations` — Managed Packages & Customizations Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface installed managed packages, ISV integrations, and org-specific customizations that extend or override the standard platform schema |
| Delta justification | The synthesis repeatedly flags "managed package entropy" as the primary source of schema unpredictability: Steelbrick CPQ overrides Amount, Clari overwrites ForecastCategory nightly, Gong injects activity objects. Claude knows customizations exist but cannot know which specific ones a customer has. |
| Template sections | Field Semantics and Overrides, System Workarounds, Data Extraction Gotchas |

#### `reconciliation` — Cross-System Reconciliation Research

| Field | Value |
|-------|-------|
| Used by | **source** only |
| Status | **NEW** — not in existing catalog |
| Role | Surface cross-table, cross-module, and cross-system reconciliation points where data should agree but often doesn't |
| Delta justification | Template section 3 ("Reconciliation Rules") previously had no researching dimension. Claude knows reconciliation as a concept but cannot know which specific tables/objects in a customer's system should agree but don't, or which system is the source of truth. Critical for the bundle contract's Data Quality Contract. |
| Template sections | Reconciliation Rules (primary), Data Extraction Gotchas (secondary) |

---

## 2. Proposed Assignment Matrix

| Dimension | domain | data-engineering | platform | source |
|-----------|:------:|:----------------:|:--------:|:------:|
| **Cross-type** | | | | |
| `entities` | ✓ | ✓ | ✓ | ✓ |
| `quality-gates` / `data-quality` | - | ✓ (as quality-gates) | - | ✓ (as data-quality) |
| **Domain-specific** | | | | |
| `metrics` | ✓ | - | - | - |
| `business-rules` | ✓ | - | - | - |
| `segmentation-and-periods` | ✓ | - | - | - |
| `modeling-patterns` | ✓ | - | - | - |
| `output-standards` | ✓ | - | - | - |
| **Data-engineering-specific** | | | | |
| `pattern-interactions` | - | ✓ | - | - |
| `load-merge-patterns` | - | ✓ | - | - |
| `historization` | - | ✓ | - | - |
| `layer-design` | - | ✓ | - | - |
| `operational-patterns` | - | ✓ | - | - |
| **Platform-specific** | | | | |
| `platform-behavioral-overrides` | - | - | ✓ | - |
| `config-patterns` | - | - | ✓ | - |
| `version-compat` | - | - | ✓ | - |
| `integration-orchestration` | - | - | ✓ | - |
| `operational-failure-modes` | - | - | ✓ | - |
| **Source-specific** | | | | |
| `extraction` | - | - | - | ✓ |
| `field-semantics` | - | - | - | ✓ |
| `change-detection` | - | - | - | ✓ |
| `lifecycle-and-state` | - | - | - | ✓ |
| `customizations` | - | - | - | ✓ |
| `reconciliation` | - | - | - | ✓ |
| | | | | |
| **Dimension count** | **6** | **7** | **6** | **8** |

**Total unique dimensions: 23** (1 cross-type universal + 1 cross-type shared + 5 domain + 5 DE + 5 platform + 6 source)

---

## 3. Template Section Mapping

### Domain Skills (6 template sections from synthesis)

| Dimension | Metric Definitions | Materiality Thresholds | Segmentation Standards | Period Handling | Business Logic Decisions | Output Standards |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| `entities` | | | ✓ | | ✓ | ✓ |
| `metrics` | **P** | ✓ | | | | ✓ |
| `business-rules` | | ✓ | ✓ | | **P** | |
| `segmentation-and-periods` | | ✓ | **P** | **P** | | ✓ |
| `modeling-patterns` | ✓ | | | | ✓ | ✓ |
| `output-standards` | | | ✓ | | | **P** |

**Coverage**: Every section informed by 2+ dimensions. No orphaned sections.

### Data Engineering Skills (6 proposed template sections)

| Dimension | Pattern Selection | Entity & Grain | Load & Merge | Historization | Layer Design | Quality Gates |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| `pattern-interactions` | **P** | | S | | | |
| `entities` | S | **P** | | | | |
| `load-merge-patterns` | | | **P** | | | |
| `historization` | S | | | **P** | | |
| `layer-design` | | | | | **P** | |
| `quality-gates` | | | | | | **P** |
| `operational-patterns` | | | S | | | S |

**Coverage**: Every section has a primary dimension. `operational-patterns` is cross-cutting.

### Platform Skills (6 proposed template sections)

| Dimension | Behavioral Overrides | Config Patterns | Version Compat | Integration | Operational Gotchas | Environment Constraints |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| `platform-behavioral-overrides` | **P** | | | | | S |
| `config-patterns` | | **P** | S | | | |
| `version-compat` | | | **P** | | | |
| `integration-orchestration` | | | | **P** | | |
| `operational-failure-modes` | | | | | **P** | S |
| `entities` | | S | | | | S |

**Coverage**: Every section has a primary dimension.

### Source Skills (6 template sections from synthesis)

| Dimension | Field Semantics | Extraction Gotchas | Reconciliation | State Machine | System Workarounds | API/Integration |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| `entities` | P | | | S | | |
| `extraction` | | **P** | | | | S |
| `field-semantics` | **P** | | S | | | |
| `change-detection` | | **P** | | | | S |
| `lifecycle-and-state` | S | | | **P** | | |
| `customizations` | P | S | | | S | |
| `reconciliation` | | S | **P** | | | |
| `data-quality` | | S | | | S | |

**Coverage**: Every section has at least one primary dimension.

---

## 4. Cross-Type Dimensions

### `entities` — Universal (all 4 types)

The only dimension used by all skill types. The focus override per type is critical for avoiding generic questions:

| Type | Focus emphasis | What changes |
|------|---------------|-------------|
| domain | Business entities, hierarchies, organizational relationships | Which business objects matter for analysis |
| data-engineering | Entity classification, grain decisions, surrogate keys, conformed dimensions | Which entities are dimensions vs. facts, at what grain |
| platform | Platform resources, environment-specific distinctions | Which platform objects exist and their dependencies |
| source | Departures from standard model: custom objects, managed packages, record type subdivisions | What differs from the standard object model |

**Observation**: All 4 agents independently validated `entities` as necessary but all also noted the need for sharper focus overrides to avoid restating standard models Claude already knows.

### `data-quality` / `quality-gates` — Shared (DE + source)

Used by data-engineering (as `quality-gates`) and source (as `data-quality`). The DE researcher proposed renaming to signal a different scope:

| Type | Slug | Focus |
|------|------|-------|
| data-engineering | `quality-gates` | Pattern-specific quality checks, cross-layer reconciliation with row multiplication accounting, quality gate thresholds, pipeline failure response |
| source | `data-quality` | Known org-specific quality issues, unreliable fields, validation rule workarounds, compensating controls |

**Design decision needed**: Keep as one shared agent with type-specific focus overrides, or split into two separate agents? The content difference is significant — DE quality is about pattern-specific *checks*, source quality is about org-specific *issues*.

### Parallel concepts (not shared, but related)

| Concept | Data Engineering | Platform |
|---------|-----------------|----------|
| Operational concerns | `operational-patterns` (backfill, schema evolution, monitoring) | `operational-failure-modes` (production failures, debugging, performance) |

These are conceptually related but produce fundamentally different questions. Not candidates for sharing.

---

## 5. Bundle Considerations

When source + domain skills operate together, the bundle interaction contract has 4 dimensions.
Multiple research dimensions across both types contribute:

### Field-to-Metric Mapping

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `metrics` | domain | Exact metric formulas identify which source fields are needed |
| `field-semantics` | source | Which source field actually contains the value the domain metric needs |
| `customizations` | source | Managed package fields that override standard ones |
| `entities` | both | Which entities are modeled (domain) maps to which objects to extract (source) |

### Semantic Translation Rules

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `field-semantics` | source | Where field meaning diverges from domain expectations |
| `output-standards` | domain | Currency conversion and formatting rules for source values |
| `entities` | source | Custom objects with different semantics than standard ones |

### Data Quality Contract

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `data-quality` | source | Known quality issues, unreliable fields |
| `reconciliation` | source | Which numbers to trust, tolerance levels |
| `change-detection` | source | Data completeness guarantees (CDC coverage) |
| `metrics` | domain | Materiality thresholds — acceptable null/error rates per metric |
| `business-rules` | domain | What constitutes "valid" data for rule evaluation |

### Refresh and Timing Alignment

| Contributing Dimension | Type | What it surfaces |
|-----------------------|------|-----------------|
| `segmentation-and-periods` | domain | Snapshot cadence, fiscal calendar, reporting period alignment |
| `extraction` | source | Extraction cadence and freshness |
| `change-detection` | source | CDC lag and propagation timing |

**Key insight**: `segmentation-and-periods` (domain) and `change-detection`/`extraction` (source) are the primary contributors to timing alignment. Without explicit period-handling research in the domain skill and CDC-specific research in the source skill, timing misalignment is invisible until production.

---

## 6. Comparison to Current

### Current Matrix (from `dynamic-research-dimensions.md` Section 2)

| Dimension | domain | data-eng | platform | source | Count |
|-----------|:------:|:--------:|:--------:|:------:|:-----:|
| `entities` | ✓ | ✓ | ✓ | ✓ | 4 |
| `metrics` | ✓ | ✓ | | | 2 |
| `pipeline-patterns` | | ✓ | | | 1 |
| `data-quality` | | ✓ | | ✓ | 2 |
| `historization` | | ✓ | | | 1 |
| `silver-gold-design` | | ✓ | | | 1 |
| `business-rules` | ✓ | | | | 1 |
| `modeling-patterns` | ✓ | | | | 1 |
| `api-patterns` | | | ✓ | | 1 |
| `integration` | | | ✓ | | 1 |
| `deployment` | | | ✓ | | 1 |
| `extraction` | | | | ✓ | 1 |
| `authentication` | | | | ✓ | 1 |
| `schema-mapping` | | | | ✓ | 1 |
| **Total** | 4 | 6 | 4 | 5 | **14** |

### Proposed Matrix (this document)

| Dimension | domain | data-eng | platform | source | Count |
|-----------|:------:|:--------:|:--------:|:------:|:-----:|
| `entities` | ✓ | ✓ | ✓ | ✓ | 4 |
| `quality-gates`/`data-quality` | | ✓ | | ✓ | 2 |
| `metrics` | ✓ | | | | 1 |
| `business-rules` | ✓ | | | | 1 |
| `segmentation-and-periods` | ✓ | | | | 1 |
| `modeling-patterns` | ✓ | | | | 1 |
| `output-standards` | ✓ | | | | 1 |
| `pattern-interactions` | | ✓ | | | 1 |
| `load-merge-patterns` | | ✓ | | | 1 |
| `historization` | | ✓ | | | 1 |
| `layer-design` | | ✓ | | | 1 |
| `operational-patterns` | | ✓ | | | 1 |
| `platform-behavioral-overrides` | | | ✓ | | 1 |
| `config-patterns` | | | ✓ | | 1 |
| `version-compat` | | | ✓ | | 1 |
| `integration-orchestration` | | | ✓ | | 1 |
| `operational-failure-modes` | | | ✓ | | 1 |
| `extraction` | | | | ✓ | 1 |
| `field-semantics` | | | | ✓ | 1 |
| `change-detection` | | | | ✓ | 1 |
| `lifecycle-and-state` | | | | ✓ | 1 |
| `customizations` | | | | ✓ | 1 |
| `reconciliation` | | | | ✓ | 1 |
| **Total** | 6 | 7 | 6 | 8 | **23** |

### Summary of Changes

| Change Type | Count | Details |
|------------|-------|---------|
| **Retained as-is** | 4 | `entities`, `business-rules`, `modeling-patterns`, `historization` |
| **Retained with sharpened focus** | 2 | `extraction` (platform traps, not generic patterns), `data-quality` (org-specific issues, not generic quality) |
| **Renamed** | 2 | `silver-gold-design` → `layer-design`, `integration` → `integration-orchestration` |
| **Restructured** | 1 | `schema-mapping` → `field-semantics` (high-delta content separated from low-delta) |
| **Split** | 1 | `pipeline-patterns` → `pattern-interactions` + `load-merge-patterns` |
| **Removed** | 3 | `authentication` (fails delta test), `api-patterns` (too broad), `deployment` (not standalone) |
| **Added (domain)** | 2 | `segmentation-and-periods`, `output-standards` |
| **Added (DE)** | 1 | `operational-patterns` |
| **Added (platform)** | 4 | `platform-behavioral-overrides`, `config-patterns`, `version-compat`, `operational-failure-modes` |
| **Added (source)** | 4 | `change-detection`, `lifecycle-and-state`, `customizations`, `reconciliation` |
| **Scope change** | 1 | `metrics` removed from data-engineering (absorbed into quality-gates + operational-patterns) |

### Why the count increased from 14 to 23

The increase is driven by three factors:

1. **Template section coverage**: The existing catalog had template sections with no researching dimension (domain Output Standards, source Reconciliation Rules, source State Machine and Lifecycle). New dimensions fill these gaps.

2. **Delta principle enforcement**: Broad existing dimensions (api-patterns, deployment, schema-mapping) mixed high-delta and low-delta content. Splitting and refocusing produces dimensions where every question surfaces genuine delta.

3. **Synthesis failure mode coverage**: Concrete failure modes from the synthesis (managed package entropy, CDC gotchas, lifecycle state issues) were not covered by dedicated dimensions. New dimensions ensure these failure modes are systematically researched.

**Impact on shared agent count**: Current = 14 shared agents. Proposed = 23 dimensions, but some may share an agent (e.g., `data-quality` and `quality-gates` could be one agent with type-specific focus). Estimated: 20-23 shared agents.

### Open Design Questions for Stage 2 Debate

1. **`data-quality` vs. `quality-gates`**: One shared agent with focus overrides, or two separate agents?

2. **Dimension count**: 23 total dimensions means 7-8 parallel agents per type (up from 4-6). Is the quality gain worth the additional wall time and token cost?

3. **`segmentation-and-periods`**: Should this be merged back into `metrics` and `business-rules`, or is the standalone dimension justified?

4. **`output-standards`**: Is this a genuine research dimension, or is it better handled as a section of the consolidation agent's output?

5. **Platform dimension count**: 6 dimensions for platform (up from 4) — the platform researcher added the most new dimensions. Is each justified, or are `config-patterns` and `platform-behavioral-overrides` overlapping?

6. **Source dimension count**: 8 dimensions for source (up from 5) — the highest count. Source skills run 8 parallel agents. Is this warranted by the synthesis evidence, or should some dimensions be merged?

7. **Cross-type sharing**: `entities` is universal. Should `operational-patterns` (DE) and `operational-failure-modes` (platform) be unified into a single shared agent with type-specific focus overrides?
