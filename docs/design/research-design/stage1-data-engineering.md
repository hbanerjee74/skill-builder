# Stage 1: Data Engineering Skill Research Dimensions

> Divergent research output for data-engineering skill type.
> Identifies all research dimensions, proposes a template structure,
> and maps dimensions to template sections.

---

## Proposed Template Structure for Data-Engineering Skills

Data-engineering skills guide engineers through building pipelines using specific technical
patterns (SCD implementation, accumulating snapshots, incremental loading, CDC pipelines).
The template must capture the *decisions* that change how a pattern is implemented -- not
the pattern itself (which Claude knows).

### Template Sections (6 Sections)

#### Section 1: Pattern Selection & Interaction Rules

**What it covers:** Which load/historization/merge patterns to use for which entity types,
and how those pattern choices constrain each other. Decision trees for pattern selection.
Interaction rules (e.g., "SCD Type 2 on this dimension requires hash-based surrogate keys
which requires deterministic merge, not append-then-dedup").

**Why it's needed (distinct from other sections):** This is the *strategic* section -- it
captures the non-obvious interactions between pattern choices that Claude cannot derive
from knowing each pattern independently. Claude knows what SCD Type 2 is. Claude does not
reliably know that choosing SCD Type 2 for a high-cardinality dimension on a platform
without native MERGE support forces you into a delete-and-insert pattern that changes
your entire pipeline's idempotency model. These interaction rules are the highest-value
delta in a data-engineering skill.

**Example content:** "For customer dimensions: SCD Type 2 with hash-based surrogate keys.
This choice requires MERGE INTO for the load pattern (not append-then-dedup) because
surrogate key stability depends on deterministic matching. Late-arriving updates must
use the same hash function to locate the correct current record."

#### Section 2: Entity & Grain Design

**What it covers:** Which entities are dimensions vs. facts, grain of each table,
surrogate key strategy, natural key composition, and relationship cardinality. Conformed
dimension identification. Degenerate dimensions.

**Why it's needed:** Grain and entity classification decisions upstream determine every
downstream pattern choice. A fact table at transaction grain requires different load
patterns than one at daily snapshot grain. An entity classified as a Type 2 dimension
needs different merge logic than a Type 1 reference table. This section is the foundation
the rest of the skill builds on.

**Example content:** "Order fact table at line-item grain (order_id + line_number).
Customer dimension is conformed across order and support fact tables. Product dimension
is SCD Type 2 (price changes tracked). Ship-to address is degenerate dimension on the
order fact."

#### Section 3: Load & Merge Patterns

**What it covers:** Per-entity load strategy (full refresh, timestamp incremental, CDC,
streaming), merge implementation (MERGE INTO, delete+insert, append-only with dedup),
high-water mark column selection, late-arriving data handling, and idempotency guarantees.

**Why it's needed (distinct from Pattern Selection):** Section 1 says *which* pattern;
this section says *how* to implement it with platform-specific detail. Claude knows the
generic MERGE INTO pattern. The delta is: which columns to use for change detection, how
to handle the gap between "last successful run" and "current run" when the pipeline fails
mid-batch, what happens when the high-water mark column has duplicates at the boundary,
and how late-arriving facts affect merge window sizing.

**Example content:** "Customer dimension load: MERGE INTO using hash of
(customer_id, name, address, segment) for change detection. High-water mark:
system_modified_at with 15-minute overlap window to catch in-flight transactions.
Late-arriving updates: re-process current partition plus previous partition."

#### Section 4: Historization & Temporal Design

**What it covers:** SCD type selection per entity with justification, effective date
conventions (closed-open intervals, sentinel values), snapshot strategies (daily full
vs. change-only), bitemporal modeling for audit requirements, history retention and
archival policies.

**Why it's needed (distinct from Load & Merge):** Load patterns describe *how data arrives*.
Historization describes *how history is structured in the target*. The delta is not
"what is SCD Type 2" but rather: when Type 2's storage cost makes it impractical (>10M rows
with daily changes), when snapshot-based historization outperforms row-versioning (wide
tables with many changing columns), and when bitemporal modeling is required vs. overkill.
These are judgment calls that vary by skill instance.

**Example content:** "Customer dimension: SCD Type 2 with closed-open date ranges
[effective_from, effective_to). Current record sentinel: '9999-12-31'. Product dimension:
SCD Type 2 for price and category changes only; other attributes Type 1. Daily snapshot
for inventory fact (too many changes for row-versioning)."

#### Section 5: Layer Design & Materialization

**What it covers:** Silver layer definition (source-conformed vs. business-conformed),
gold layer design (star schema, one-big-table, wide denormalized), silver-to-gold
promotion criteria, conformed dimension governance, materialization strategy (tables vs.
views vs. materialized views), and aggregate table patterns.

**Why it's needed:** Layer boundaries are organizational decisions that Claude cannot
derive from pattern knowledge alone. The delta is: where does cleansing end and
business transformation begin? Which dimensions must be conformed across fact tables
(and what "conformed" means operationally -- shared physical table vs. shared logic)?
When to pre-compute aggregates vs. rely on query engine performance? These decisions
have massive downstream impact on query patterns and maintenance burden.

**Example content:** "Silver: source-conformed (column names match source, types
standardized, nulls handled). Gold: star schema with 3 conformed dimensions
(customer, product, date). Aggregates: monthly revenue summary materialized table
refreshed daily; all other aggregations via views over the fact table."

#### Section 6: Quality Gates & Testing

**What it covers:** Per-layer validation rules, cross-layer reconciliation patterns,
quality gate thresholds for silver-to-gold promotion, pipeline testing strategy
(unit tests, integration tests, data tests), anomaly detection patterns, and
freshness SLA enforcement.

**Why it's needed:** Quality patterns are deeply coupled to the specific pattern
choices in sections 1-5. A pipeline using CDC needs different quality checks than one
using timestamp-based incremental (CDC needs operation-type validation; incremental
needs duplicate detection at the watermark boundary). The delta is: which quality
checks are critical for *this specific combination* of patterns, what thresholds
indicate a problem vs. normal variance, and what the pipeline should do when a
quality gate fails (halt, alert, quarantine).

**Example content:** "Silver ingestion: row count reconciliation within 1% of source;
null check on all surrogate key columns; schema drift detection. Silver-to-gold gate:
referential integrity (all fact foreign keys resolve to dimension records); completeness
threshold 99.5%. On gate failure: halt gold refresh, alert, serve stale gold data."

---

## Research Dimensions

### Dimension 1: `pattern-interactions` -- Pattern Interaction & Selection Research

| Field | Value |
|-------|-------|
| Slug | `pattern-interactions` |
| What it researches | Surfaces the non-obvious interactions between pattern choices (load strategy, merge approach, historization type, materialization) that constrain each other. Identifies decision trees for pattern selection based on entity characteristics. Researches what goes wrong when patterns are chosen independently without considering their downstream effects. |
| Template section(s) | **Section 1: Pattern Selection & Interaction Rules** (primary), Section 3: Load & Merge Patterns (secondary) |

**Delta justification:**

*What Claude knows:* Claude knows each pattern individually -- SCD types, merge strategies,
incremental loading, CDC, materialization options. Claude can describe any pattern in
isolation correctly.

*What this dimension surfaces beyond parametric knowledge:* The *interactions* between
pattern choices. Claude does not reliably surface that:
- Choosing SCD Type 2 on a high-cardinality dimension forces hash-based surrogate keys,
  which forces MERGE INTO (not append-then-dedup), which requires the source to provide
  reliable change timestamps for the merge predicate.
- Choosing append-only ingestion at silver means gold-layer deduplication becomes mandatory,
  which changes the materialization strategy (views become expensive; tables become necessary).
- Choosing CDC for one entity but timestamp-incremental for another creates a consistency
  gap at query time unless you add a reconciliation step.
- Late-arriving fact handling depends on whether the dimension it joins to uses Type 1
  (safe -- current record is correct) or Type 2 (dangerous -- must do point-in-time lookup
  to find the *correct version* of the dimension record).

These interactions are the core delta. A senior data engineer who just joined the team
would need exactly this: "given that we chose X for entity A, what does that force for
entity B?"

**What goes wrong if skipped:**

The skill recommends patterns in isolation. An engineer follows the skill's SCD Type 2
guidance for dimensions and its incremental loading guidance for facts, but the skill
never explains that late-arriving facts must use point-in-time dimension lookups (not
current-record joins). Result: fact records silently join to the wrong dimension version,
producing incorrect historical analyses. This is the most dangerous failure mode for
data-engineering skills because it produces *plausible but wrong* query results.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "When an SCD Type 2 dimension is joined by a fact table, should the skill recommend
   point-in-time lookups (match on effective date range) or current-record joins (match
   on natural key, latest version)? How does this choice change for late-arriving facts?"

2. "If the target platform lacks native MERGE support, should the skill recommend
   delete-and-insert (simpler, but breaks if the pipeline fails mid-batch) or
   staging-table-then-swap (more complex, but atomic)? What interaction does this have
   with the surrogate key strategy?"

3. "When combining SCD Type 2 dimensions with snapshot-based fact tables, should the
   snapshot capture the dimension's surrogate key at snapshot time (denormalized, query-fast)
   or the natural key (normalized, requires point-in-time join at query time)?"

---

### Dimension 2: `entities` -- Entity & Grain Design Research

| Field | Value |
|-------|-------|
| Slug | `entities` |
| What it researches | Surfaces which entities the pattern applies to, their classification (dimension vs. fact vs. bridge vs. reference), grain decisions per entity, natural key composition, and cardinality relationships. Identifies conformed dimensions that span multiple fact tables. |
| Template section(s) | **Section 2: Entity & Grain Design** (primary), Section 1: Pattern Selection & Interaction Rules (secondary -- entity classification drives pattern selection) |

**Delta justification:**

*What Claude knows:* Claude knows dimensional modeling concepts (Kimball methodology),
the difference between dimensions and facts, and standard grain patterns.

*What this dimension surfaces beyond parametric knowledge:* The *specific entity
classification and grain decisions* for this skill's domain. Claude cannot determine
from training data that:
- For a particular pipeline, the "order" entity should be at line-item grain (not order
  header grain) because downstream metrics require line-level attribution.
- A "customer" entity that appears simple is actually two entities: the billing customer
  (changes rarely, Type 1) and the customer profile (changes often, Type 2).
- A "product" entity is conformed across three fact tables but with different attributes
  needed at each join point.
- Natural key composition matters: is a product uniquely identified by `product_id` alone,
  or by `product_id + effective_date` (which changes the merge predicate entirely)?

These are decisions specific to the skill instance, not derivable from pattern knowledge.

**What goes wrong if skipped:**

The skill provides pattern guidance without specifying which entities the pattern applies
to or their grain. An engineer applies SCD Type 2 to every dimension (wasteful for
reference data that never changes) or applies it at the wrong grain (header-level when
line-level is needed). The result is either storage explosion (unnecessary Type 2 on
static entities) or incorrect analysis (wrong grain means aggregations double-count or
miss records).

**Example questions (for "SCD Implementation Patterns" skill):**

1. "Which entity categories should the skill cover? Choices: (a) only customer/product
   dimensions (the classic SCD use case), (b) dimensions plus reference tables (adding
   Type 1 guidance for static lookups), (c) dimensions plus slowly-changing fact attributes
   (e.g., contract terms that change mid-period), (d) other."

2. "What grain should the skill recommend for SCD Type 2 tables? Choices: (a) one row per
   change (version grain -- standard), (b) one row per day per entity (daily snapshot --
   simpler queries but higher storage), (c) both with guidance on when to choose each."

3. "Should the skill address surrogate key generation? Choices: (a) hash-based (deterministic,
   idempotent), (b) sequence-based (simpler, but not idempotent across re-runs), (c) both
   with a decision framework."

---

### Dimension 3: `load-merge-patterns` -- Load & Merge Strategy Research

| Field | Value |
|-------|-------|
| Slug | `load-merge-patterns` |
| What it researches | Surfaces the specific load strategy and merge implementation decisions for the pattern this skill covers. Researches high-water mark column selection, change detection approaches, merge predicate design, idempotency guarantees, and failure recovery. Identifies platform-specific merge limitations and workarounds. |
| Template section(s) | **Section 3: Load & Merge Patterns** (primary) |

**Delta justification:**

*What Claude knows:* Claude knows generic MERGE INTO syntax, the concept of high-water
marks, and standard incremental loading patterns.

*What this dimension surfaces beyond parametric knowledge:*
- **High-water mark edge cases**: What happens when multiple records share the same
  timestamp at the watermark boundary? The standard pattern silently drops or duplicates
  records. The fix (overlap window + deduplication) is not part of Claude's default
  MERGE INTO generation.
- **Change detection nuance**: Hash-based change detection (hash all columns, compare)
  vs. timestamp-based (trust the source's modified timestamp) vs. column-specific
  (only track changes to business-relevant columns). Claude defaults to timestamp-based,
  which misses changes when source timestamps are unreliable.
- **Failure recovery**: What happens when a MERGE fails mid-batch? For SCD Type 2, a
  failed merge can leave records with open effective dates and no corresponding closed
  predecessor -- producing duplicate "current" records. The skill must specify recovery
  procedures.
- **Platform-specific limitations**: Fabric's MERGE implementation has different performance
  characteristics than Snowflake's. Databricks Delta's merge-on-read vs. merge-on-write
  affects whether you need an OPTIMIZE step after merge.

**What goes wrong if skipped:**

The skill provides generic MERGE INTO templates that work for simple cases but fail at
scale or under failure conditions. An engineer implements the skill's merge pattern,
the pipeline fails mid-batch, and re-running creates duplicate "current" records in a
Type 2 dimension. The quality checks don't catch it because the skill didn't specify
that duplicate current-record detection is a critical quality gate for this pattern.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "How should the skill handle the merge predicate for change detection? Choices:
   (a) hash all non-key columns (catches all changes, but expensive for wide tables),
   (b) hash only tracked columns (misses untracked changes, but cheaper),
   (c) use source timestamp (simplest, but misses changes with stale timestamps),
   (d) other."

2. "What failure recovery pattern should the skill recommend? Choices: (a) re-run the
   entire merge (idempotent if designed correctly), (b) checkpoint-based resume
   (complex but avoids re-processing), (c) staging table with atomic swap (safest but
   requires more storage), (d) other."

3. "Should the skill address platform-specific merge behavior? Choices: (a) generic SQL
   MERGE only, (b) generic plus Databricks Delta-specific guidance (merge-on-read
   implications), (c) generic plus Fabric-specific guidance, (d) multi-platform with
   decision framework."

---

### Dimension 4: `historization` -- Historization & Temporal Design Research

| Field | Value |
|-------|-------|
| Slug | `historization` |
| What it researches | Surfaces the specific temporal data management decisions for this pattern: SCD type selection rationale per entity category, effective date conventions, snapshot vs. row-versioning trade-offs, bitemporal modeling triggers, and history retention policies. Researches when each historization approach breaks down and what the fallback should be. |
| Template section(s) | **Section 4: Historization & Temporal Design** (primary), Section 1: Pattern Selection & Interaction Rules (secondary -- historization choice constrains pattern selection) |

**Delta justification:**

*What Claude knows:* Claude knows SCD Types 1, 2, 3, 4, 6 and can describe each
accurately. Claude knows bitemporal modeling concepts.

*What this dimension surfaces beyond parametric knowledge:*
- **When Type 2 breaks down**: Claude recommends SCD Type 2 as the default for tracking
  changes, but does not reliably flag when it becomes impractical -- e.g., a dimension
  with 50M rows that changes 10% daily creates 5M new version rows per day, making the
  table unqueryable within weeks. The skill must specify the thresholds where Type 2
  should be replaced with daily snapshots.
- **Effective date edge cases**: Closed-open vs. closed-closed intervals, sentinel values
  for current records, what happens when two changes arrive in the same batch (same
  effective_from timestamp), backdated changes that should have an effective_from in the
  past.
- **Snapshot vs. row-versioning decision**: Not "what are they" but "when to choose which."
  Wide tables with many independently changing columns favor snapshots (one row per
  snapshot period, all columns captured). Narrow tables with rare changes favor row-versioning
  (one row per change, effective dates). The crossover point depends on change frequency,
  column count, and query patterns.
- **Bitemporal triggers**: Claude knows bitemporal modeling but does not reliably identify
  *when it's required*. The skill must specify: audit requirements, regulatory reporting
  that requires "as-of" and "as-known-at" views, correction workflows where you need to
  distinguish "what we knew then" from "what we know now."

**What goes wrong if skipped:**

The skill defaults to "use SCD Type 2 for everything," which is correct in theory but
impractical for high-change-frequency entities. An engineer implements Type 2 for an
inventory position table that changes millions of rows daily. Within a week, the dimension
table has hundreds of millions of rows, queries time out, and the engineer must redesign
to snapshots -- but the skill provided no guidance on when to make that choice.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "At what change frequency should the skill recommend switching from SCD Type 2 to
   daily snapshots? Choices: (a) when >5% of rows change daily, (b) when >20% change
   daily, (c) never -- always use Type 2 with partitioning, (d) provide a decision
   framework based on row count x change rate x query patterns."

2. "How should the skill handle backdated changes (changes with an effective date in the
   past)? Choices: (a) re-open and re-close affected version records (correct but complex),
   (b) insert a new version with the backdated effective date (simpler but creates
   overlapping ranges if not handled carefully), (c) treat as current change (simplest
   but loses temporal accuracy), (d) other."

3. "Should the skill cover bitemporal modeling? Choices: (a) always include (adds complexity
   but future-proofs for audit), (b) only mention as an advanced topic, (c) include a
   decision framework (when regulatory/audit requirements exist, recommend bitemporal;
   otherwise, recommend standard temporal), (d) other."

---

### Dimension 5: `layer-design` -- Silver/Gold Layer Design Research

| Field | Value |
|-------|-------|
| Slug | `layer-design` |
| What it researches | Surfaces the layer boundary decisions, conformed dimension governance patterns, fact table granularity choices, materialization strategy, and aggregate table design. Researches how the silver-to-gold boundary affects query patterns, maintenance burden, and data freshness. |
| Template section(s) | **Section 5: Layer Design & Materialization** (primary) |

**Delta justification:**

*What Claude knows:* Claude knows the medallion architecture concept (bronze/silver/gold),
star schema design, and materialization options (tables, views, materialized views).

*What this dimension surfaces beyond parametric knowledge:*
- **Where to draw the silver-to-gold boundary**: Claude describes silver as "cleansed" and
  gold as "business-ready," but the actual boundary is a design decision with consequences.
  If silver is source-conformed (column names match source), transformations concentrate
  in gold, making silver reusable but gold complex. If silver is business-conformed
  (renamed, type-cast, denormalized), gold is simpler but silver is source-specific and
  harder to reuse across different gold models.
- **Conformed dimension governance**: Which dimensions must be physically shared (single
  table referenced by multiple fact tables) vs. logically shared (same transformation
  logic, separate physical tables)? Physical sharing creates coupling -- changing the
  customer dimension for one fact table's needs may break another. Logical sharing creates
  drift risk.
- **Materialization trade-offs specific to pattern choices**: A Type 2 dimension that
  requires point-in-time joins makes views expensive (the join pushes date-range filtering
  into every query). This is a non-obvious interaction between historization choice and
  materialization choice that Claude does not surface unprompted.
- **Aggregate table decision framework**: When to pre-compute aggregates vs. rely on the
  query engine. This depends on the specific combination of fact table size, query frequency,
  and freshness requirements -- not on generic advice.

**What goes wrong if skipped:**

The skill provides pattern guidance without addressing where the pattern fits in the
layer architecture. An engineer implements SCD Type 2 at the silver layer (wrong -- Type 2
is a gold-layer concern; silver should preserve source grain). Or the engineer puts all
Type 2 logic in gold but doesn't materialize the dimension table, forcing expensive
point-in-time joins on every query. The skill needs to specify where in the layer
architecture each pattern component lives.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "Where should SCD Type 2 processing occur? Choices: (a) silver layer (cleanse + historize
   in one step -- simpler pipeline, but silver becomes pattern-specific), (b) gold layer
   (silver preserves source structure, gold applies historization -- more flexible but
   adds a transformation step), (c) depend on entity type (high-change entities at silver,
   low-change at gold), (d) other."

2. "Should SCD Type 2 dimension tables be materialized or views? Choices: (a) always
   materialized (required for performant point-in-time joins), (b) views for small
   dimensions, tables for large (>1M rows), (c) depend on whether downstream joins use
   point-in-time lookup, (d) other."

3. "How should the skill handle conformed dimensions that are SCD Type 2? Choices:
   (a) single physical table with version history (all fact tables join to the same
   dimension), (b) per-fact-table dimension views filtered to relevant versions,
   (c) decision framework based on version volume and query patterns."

---

### Dimension 6: `quality-gates` -- Quality Gates & Testing Research

| Field | Value |
|-------|-------|
| Slug | `quality-gates` |
| What it researches | Surfaces the specific quality checks, reconciliation patterns, and testing strategies required for this pipeline pattern. Researches which quality failures are pattern-specific (not generic data quality), what thresholds indicate a genuine problem vs. normal variance, and what the pipeline should do when a quality gate fails. |
| Template section(s) | **Section 6: Quality Gates & Testing** (primary) |

**Delta justification:**

*What Claude knows:* Claude knows generic data quality concepts (null checks, uniqueness,
referential integrity) and testing frameworks (dbt tests, Great Expectations).

*What this dimension surfaces beyond parametric knowledge:*
- **Pattern-specific quality checks**: SCD Type 2 pipelines need specific checks that
  generic quality frameworks miss: (1) no overlapping effective date ranges for the same
  natural key, (2) exactly one "current" record per natural key, (3) version sequence
  continuity (no gaps in effective dates). Claude does not reliably generate these
  pattern-specific checks.
- **Cross-layer reconciliation**: Row count reconciliation for incremental pipelines is
  not straightforward -- source row count != target row count if the pipeline applies
  deduplication or Type 2 versioning. The reconciliation rule must account for the
  pattern's expected row multiplication factor.
- **Threshold calibration**: What percentage of failed quality checks should halt the
  pipeline vs. log a warning? This depends on the pattern's failure mode severity.
  A Type 2 dimension with overlapping date ranges is *always* a critical failure
  (produces wrong point-in-time joins). A fact table with 0.1% null foreign keys might
  be acceptable (quarantine and continue).
- **Pipeline failure response**: Halt vs. quarantine vs. continue with warning. For
  SCD Type 2, a merge failure that creates duplicate current records must halt -- not
  continue with a warning -- because downstream queries will silently return wrong
  results.

**What goes wrong if skipped:**

The skill provides quality guidance that is generic (null checks, uniqueness) but misses
the pattern-specific checks that matter most. An engineer implements SCD Type 2 with
standard dbt tests (not_null, unique on surrogate key) but misses the critical check:
"exactly one current record per natural key." A merge failure creates two current records
for the same customer. The not_null and unique tests pass (each record has a valid
surrogate key). But every downstream join to this dimension returns duplicate rows,
inflating all metrics by the duplication factor. This persists until someone manually
notices the doubled numbers.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "Which pattern-specific quality checks should the skill mandate? Choices: (a) only the
   essentials (one current record per natural key, no overlapping date ranges), (b) essentials
   plus version sequence checks (no gaps in effective dates), (c) comprehensive including
   hash verification (re-hash source to verify change detection correctness), (d) other."

2. "What should happen when a quality gate fails during the merge step? Choices: (a) halt
   the entire pipeline and alert (safest, but blocks all downstream), (b) quarantine the
   failing records and continue with clean data (complex but keeps pipeline flowing),
   (c) rollback the merge and serve stale data (requires atomic merge capability),
   (d) other."

3. "How should cross-layer reconciliation account for SCD Type 2's row multiplication?
   Choices: (a) reconcile on natural key count (source distinct keys = target distinct
   current keys), (b) reconcile on total rows with expected multiplication factor,
   (c) reconcile on hash of current-state attributes, (d) other."

---

### Dimension 7: `operational-patterns` -- Operational & Recovery Research

| Field | Value |
|-------|-------|
| Slug | `operational-patterns` |
| What it researches | Surfaces the operational concerns that arise once the pipeline is running in production: failure recovery procedures, backfill strategies, schema evolution handling, orchestration dependencies, and monitoring patterns. Researches what breaks during day-2 operations that the initial pipeline design didn't anticipate. |
| Template section(s) | Section 3: Load & Merge Patterns (recovery subsection), Section 6: Quality Gates & Testing (monitoring subsection) -- cross-cutting operational concerns |

**Delta justification:**

*What Claude knows:* Claude knows generic pipeline orchestration concepts (DAGs,
dependencies, retries) and schema evolution concepts (adding columns, type changes).

*What this dimension surfaces beyond parametric knowledge:*
- **Backfill complexity for historized data**: Backfilling a Type 2 dimension is fundamentally
  different from backfilling a Type 1 table. You can't just re-run the pipeline for a
  date range -- you need to reconstruct the version history, which requires access to
  historical source snapshots or change logs. If those don't exist, the backfill can only
  create "current state" records with an artificial effective_from date.
- **Schema evolution in historized tables**: Adding a column to an SCD Type 2 table creates
  a decision: do existing version records get NULL for the new column (which breaks queries
  that expect it), or do you backfill the column value for historical versions (which may
  be impossible if the source didn't previously capture that attribute)?
- **Orchestration dependencies for cross-entity patterns**: When a fact table's merge depends
  on a dimension's merge completing first (because the fact needs the dimension's surrogate
  key), the orchestration DAG must encode this dependency. Claude generates DAGs but doesn't
  reliably surface *why* the dependency exists or what happens if the dimension load fails
  and the fact load runs anyway (orphaned foreign keys).
- **Monitoring for pattern-specific drift**: A Type 2 dimension's version rate should be
  roughly stable. A sudden spike in new versions (e.g., 10x normal) indicates either a
  source data quality issue or a bug in change detection. This monitoring pattern is
  specific to Type 2 and not generated by generic pipeline monitoring.

**What goes wrong if skipped:**

The skill covers the initial implementation but not day-2 operations. The pipeline runs
successfully for weeks, then needs a backfill due to a source system migration. The
engineer attempts to re-run the pipeline for the backfill date range, but this overwrites
the Type 2 history with "current state" data, destroying months of carefully tracked
dimension changes. The skill didn't explain that Type 2 backfills require a fundamentally
different approach than Type 1 backfills.

**Example questions (for "SCD Implementation Patterns" skill):**

1. "How should the skill address backfill for SCD Type 2 tables? Choices: (a) require
   historical source snapshots be available for reconstruction, (b) provide a
   'best-effort' backfill pattern that creates version records from available data
   with artificial dates, (c) recommend maintaining source snapshots as a prerequisite
   for Type 2 implementation, (d) other."

2. "Should the skill cover schema evolution procedures? Choices: (a) yes, including
   how to handle new columns in historical version records, (b) yes, but only for
   additive changes (new columns), (c) no -- schema evolution is too platform-specific,
   (d) other."

3. "What monitoring patterns should the skill recommend? Choices: (a) version rate
   monitoring (alert on sudden spikes), (b) current-record count stability (alert if
   count changes more than expected), (c) both plus hash-based change verification
   (periodically re-hash source to verify no missed changes), (d) other."

---

## Departures from the Existing Catalog

### Dimensions Renamed or Restructured

| Existing Catalog | This Proposal | Rationale |
|-----------------|---------------|-----------|
| `pipeline-patterns` | Split into `pattern-interactions` + `load-merge-patterns` | The existing dimension conflates two distinct research areas: (1) how pattern choices interact with each other (strategic, high-delta), and (2) the implementation details of each load/merge pattern (tactical, medium-delta). Splitting them produces more focused clarification questions. The interaction research is the highest-value delta for data-engineering skills -- it's what Claude genuinely cannot produce from individual pattern knowledge. |
| `silver-gold-design` | Renamed to `layer-design` | Broader and more accurate. Not all data-engineering patterns involve silver/gold specifically (e.g., streaming pipelines may use landing/staging/serving). The layer boundary question applies regardless of naming convention. |
| `data-quality` | Renamed to `quality-gates` | Narrowed focus from generic "data quality" (which Claude knows well) to pattern-specific quality gates (the genuine delta). The existing dimension's focus on "cross-layer validation rules, reconciliation patterns, quality gates" is correct but the name "data-quality" invites generic quality content. "quality-gates" signals that the dimension should surface pattern-specific checks. |
| `metrics` | **Removed for data-engineering** | The existing catalog assigns `metrics` to data-engineering with focus "pipeline health metrics, data quality scores, freshness SLAs, and reconciliation patterns." This overlaps heavily with `quality-gates` (reconciliation, quality scores) and `operational-patterns` (freshness SLAs, health metrics). The metrics that matter for data-engineering skills are better surfaced as part of quality gates and operational monitoring than as a standalone dimension. Domain skills need metrics (business KPIs); data-engineering skills need quality gates and operational monitors. |
| `entities` | Retained as `entities` | The focus needs sharpening: "dimensional entities (dimensions, fact tables, SCD history, surrogate keys)" is good but should emphasize grain decisions and entity classification more explicitly. |
| `historization` | Retained as `historization` | The existing focus is good. Added emphasis on breakdown thresholds (when Type 2 becomes impractical) and bitemporal modeling triggers. |

### New Dimension Added

| Dimension | Rationale |
|-----------|-----------|
| `operational-patterns` | Not in the existing catalog. Covers day-2 operational concerns (backfill, schema evolution, monitoring) that are critical for production pipelines but absent from pattern-focused research. The synthesis's emphasis on "what goes wrong with naive implementations" extends beyond initial implementation to ongoing operations. A skill that covers SCD Type 2 implementation but not SCD Type 2 backfill is incomplete in a way that causes real production incidents. |

### Dimension Count: 7 (vs. 6 in existing catalog)

The net change is +1 dimension:
- Split `pipeline-patterns` into 2 (`pattern-interactions` + `load-merge-patterns`)
- Removed `metrics` (absorbed into `quality-gates` and `operational-patterns`)
- Added `operational-patterns` (new)
- Retained `entities`, `historization` (with sharpened focus)
- Renamed `silver-gold-design` to `layer-design`, `data-quality` to `quality-gates`

---

## Dimension-to-Template Section Mapping

| Dimension | Sec 1: Pattern Selection | Sec 2: Entity & Grain | Sec 3: Load & Merge | Sec 4: Historization | Sec 5: Layer Design | Sec 6: Quality Gates |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| `pattern-interactions` | **P** | | S | | | |
| `entities` | S | **P** | | | | |
| `load-merge-patterns` | | | **P** | | | |
| `historization` | S | | | **P** | | |
| `layer-design` | | | | | **P** | |
| `quality-gates` | | | | | | **P** |
| `operational-patterns` | | | S | | | S |

**P** = primary (dimension output directly populates this section)
**S** = secondary (dimension output informs this section through cross-referencing)

### Cross-Referencing Notes

The consolidation agent (opus with extended thinking) is critical for data-engineering
skills because the pattern interaction dimension's output must be cross-referenced with
every other dimension. Specifically:

- `pattern-interactions` findings constrain `load-merge-patterns` choices (e.g., "SCD Type 2
  requires MERGE INTO" limits the merge pattern options)
- `entities` findings drive `historization` choices (entity classification determines
  which SCD type to apply)
- `historization` findings affect `layer-design` choices (Type 2 dimensions may need
  materialization for performant point-in-time joins)
- `quality-gates` findings must reflect pattern-specific checks from `load-merge-patterns`
  and `historization`
- `operational-patterns` findings provide the day-2 context for `load-merge-patterns`
  (recovery) and `quality-gates` (monitoring)

---

## Summary Table

| # | Dimension | Slug | Template Section(s) | Delta Type | Existing Catalog Status |
|---|-----------|------|---------------------|------------|------------------------|
| 1 | Pattern Interaction & Selection | `pattern-interactions` | Sec 1 (primary), Sec 3 (secondary) | Interaction knowledge between known patterns | **New** (split from `pipeline-patterns`) |
| 2 | Entity & Grain Design | `entities` | Sec 2 (primary), Sec 1 (secondary) | Instance-specific entity classification and grain | Retained, focus sharpened |
| 3 | Load & Merge Strategy | `load-merge-patterns` | Sec 3 (primary) | Implementation edge cases for load/merge patterns | **New** (split from `pipeline-patterns`) |
| 4 | Historization & Temporal Design | `historization` | Sec 4 (primary), Sec 1 (secondary) | Breakdown thresholds and temporal edge cases | Retained, focus expanded |
| 5 | Silver/Gold Layer Design | `layer-design` | Sec 5 (primary) | Layer boundary decisions and materialization interactions | Renamed from `silver-gold-design` |
| 6 | Quality Gates & Testing | `quality-gates` | Sec 6 (primary) | Pattern-specific quality checks (not generic data quality) | Renamed from `data-quality`, absorbs `metrics` quality focus |
| 7 | Operational & Recovery | `operational-patterns` | Sec 3 (secondary), Sec 6 (secondary) | Day-2 operational patterns (backfill, schema evolution, monitoring) | **New** |
