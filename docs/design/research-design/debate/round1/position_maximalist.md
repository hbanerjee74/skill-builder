# Position Paper: The 23-Dimension Matrix Is Correct and Possibly Incomplete

## Core Argument

The proposed 23-dimension matrix is the minimum viable set required to produce clarification questions that surface genuine delta knowledge. The evidence is straightforward: the synthesis document identifies concrete failure modes -- CPQ overriding Amount, SystemModstamp/LastModifiedDate inconsistency, managed package entropy, ForecastCategory/StageName independence -- that the 14-dimension matrix structurally cannot catch because no dimension is responsible for researching them. Each new dimension maps to at least one template section, passes the delta filter ("Would Claude produce correct clarification questions for this dimension's topic without any research agent?"), and produces meaningfully different questions across skill instances. The consolidation agent benefits from sharper, more focused inputs: 8 research agents each producing 5-8 tightly scoped questions give opus more material to cross-reference than 5 agents producing 8-12 unfocused questions that mix high-delta and low-delta content.

---

## Section 1: Every Dimension Surfaces Genuine Delta -- Worked Through Both Cases

### The Template Section Gap Problem

The proposed matrix document (Section 6, "Comparison to Current") identifies three template sections with no researching dimension in the 14-dimension catalog:

1. **Domain: Output Standards** -- No dimension populates it. Customer Beta's QBR waterfall chart categories, FX conversion at first-of-month spot rate, and region-first drill-down hierarchy are organizational decisions Claude cannot derive. The `output-standards` dimension fills this gap.

2. **Source: Reconciliation Rules** -- No dimension populates it. The synthesis (Section 5.2) documents that Beta's SFDC pipeline numbers disagree with finance, and the source of truth for bookings is unresolvable without asking. The `reconciliation` dimension fills this gap.

3. **Source: State Machine and Lifecycle** -- No dimension populates it. Beta's ForecastCategory/StageName independence, custom stage progressions, and RecordTypeId-specific lifecycle variations are lifecycle issues the synthesis flags repeatedly (synthesis Section 6.1, annotations 7-8). The `lifecycle-and-state` dimension fills this gap.

These are not theoretical gaps. They are template sections that would ship empty or with generic filler under the 14-dimension matrix. The proposed matrix achieves full template section coverage (proposed matrix Section 3: "Every section informed by 2+ dimensions. No orphaned sections.").

### Delta Filter Applied to Each New Dimension

For each new dimension, I apply the constraint: "Would Claude produce correct clarification questions for this dimension's topic without any research agent?"

**Domain new dimensions:**

- `segmentation-and-periods`: Claude knows "segmentation exists" generically. Claude does not know that Beta's coverage targets are segmented by deal type (4.5x New Business, 2x Renewal against forecast, not quota -- synthesis Section 5.2). Without this dimension, the research agent asks about coverage as a single number. With it, the agent asks "Are targets segmented? By what dimensions? Against what denominator per segment?" -- questions whose answers produce structurally different skill content. For the dbt-on-Fabric case, this dimension surfaces fiscal calendar alignment for snapshot timing, which interacts with Fabric's 30-minute query timeout for large historical queries.

- `output-standards`: Claude produces generic formatting guidance. Claude does not know Beta requires QBR waterfall charts with specific pipeline movement categories, or that FX conversion uses first-of-month spot rates. These are arbitrary but mandatory organizational decisions (proposed matrix Section 1, output-standards entry). Without a researching dimension, the Output Standards template section remains generic.

**Data Engineering new dimensions:**

- `pattern-interactions`: The proposed matrix (Section 1) documents that SCD Type 2 forces hash-based surrogate keys, which forces MERGE INTO, which requires reliable change timestamps. Claude knows each pattern individually but not the constraint chain. For the dbt-on-Fabric case, the interaction is even more critical: `merge` strategy silently degrades on Fabric Lakehouse (synthesis Section 5.2, platform behavioral override), which means the pattern interaction between SCD Type 2 and merge strategy produces different guidance on Fabric than on Snowflake. A single `pipeline-patterns` dimension conflates this interaction knowledge with tactical merge syntax.

- `operational-patterns`: The proposed matrix documents that backfilling a Type 2 dimension requires historical source snapshots (you cannot just re-run). For dbt-on-Fabric, adding a column to a Type 2 table in Fabric requires decisions about historical records that differ from Snowflake due to Fabric's lakehouse file format constraints. No existing dimension covers day-2 operations.

**Platform new dimensions:**

- `platform-behavioral-overrides`: This is the single highest-delta dimension for platform skills (proposed matrix Section 1). Claude's training data IS the documentation. For dbt-on-Fabric: `merge` silently degrades on Lakehouse, datetime2 precision causes snapshot failures, warehouse vs. Lakehouse endpoints change available SQL features. None of these appear in dbt documentation -- they are experiential findings. Claude is confidently wrong about all three.

- `config-patterns`: Claude generates syntactically valid dbt configurations. It cannot reason about `threads: 16` causing Fabric throttling, or that `dispatch` overrides are mandatory for `dbt_utils` on Fabric (proposed matrix Section 1). These are valid-but-dangerous configurations -- syntactically correct, semantically wrong on this specific platform.

- `version-compat`: Claude's training data mixes dbt-core 1.5 and 1.7 advice without version boundaries. The dbt-fabric adapter version requirements for incremental materialization support are a multi-axis version interaction (dbt-core x adapter x Fabric runtime) that is poorly documented (proposed matrix Section 1).

- `operational-failure-modes`: Fabric's unconfigurable 30-minute query timeout, concurrent dbt runs causing metadata lock contention, and `dbt test` error format differences by environment are production failure patterns Claude does not know (proposed matrix Section 1). These are the "2am" items.

**Source new dimensions:**

- `change-detection`: The synthesis (Section 6.1, annotation 5) identifies SystemModstamp vs. LastModifiedDate as a primary failure mode. Standard extraction tutorials produce wrong data. `extraction` covers HOW to pull data (API method, rate limits); `change-detection` covers WHAT to pull (which records changed). The wrong answer to "what changed?" produces silently incomplete data. For Customer Beta, this is the difference between a functioning CDC pipeline and one that silently misses system-initiated changes (Clari writing forecast values nightly).

- `lifecycle-and-state`: RecordTypeId filtering, ForecastCategory/StageName independence, custom stage progressions -- all lifecycle issues. For Beta, Stage 4 = Upside for New Business but Commit for Renewal (synthesis Section 5.2). The 14-dimension matrix has no dimension responsible for surfacing this.

- `customizations`: Managed package entropy is the synthesis's primary source of schema unpredictability (synthesis Section 5.2): Steelbrick CPQ overrides Amount, Clari overwrites ForecastCategory nightly, Gong injects activity objects. Claude knows customizations exist abstractly. Claude cannot know which specific packages Beta has installed or how they interact.

- `reconciliation`: Template section 3 ("Reconciliation Rules") previously had no researching dimension. Beta's pipeline numbers disagree between SFDC, Clari, and finance. Which system is the source of truth? The `reconciliation` dimension asks this directly.

---

## Section 2: The 23 Dimensions Produce Measurably Better Clarification Questions

The quality improvement comes from two mechanisms:

**Mechanism 1: Focused agents produce non-overlapping questions.** Under the 14-dimension matrix, the source skill runs 5 agents: `entities`, `extraction`, `authentication`, `schema-mapping`, `data-quality`. When researching Salesforce for Customer Beta, `extraction` must cover both HOW to extract (Bulk API patterns) and WHAT changed (CDC field selection). The result is broad questions like "How should incremental extraction work?" Under the 23-dimension matrix, `extraction` focuses on extraction traps (multi-tenant filtering, governor limits), while `change-detection` focuses on CDC mechanisms (SystemModstamp vs. LastModifiedDate, queryAll for soft deletes). The questions are sharper: "Which timestamp field drives CDC?" vs. "How do you detect soft deletes?"

The dynamic research design document (Section 8, "Expected Output Quality Improvement") confirms this: with the old 3-agent approach, data-engineering skills produce "~15-20 questions across concepts, practices, and implementation. Many questions are generic because the agents don't have enough context." With focused dimensions, "all agents research in parallel with domain-specific focus lines. Each produces targeted questions for its dimension."

**Mechanism 2: The consolidation agent benefits from sharper inputs.** The consolidation agent (opus with extended thinking) cross-references all dimension outputs. When inputs are sharply scoped, cross-referencing produces genuine insights: "The `change-detection` agent flagged SystemModstamp for CDC, and the `customizations` agent flagged that Clari writes to forecast fields nightly -- the interaction means Clari-initiated changes are only visible via SystemModstamp, not LastModifiedDate." This cross-reference is impossible when both findings are buried in a single broad agent's output, because the consolidation agent never sees them as distinct signals to combine.

---

## Section 3: Both Reference Cases Under the 23-Dimension Matrix

### Customer Beta: Pipeline Forecasting Domain + Salesforce Source

**Domain skill (6 dimensions):** `entities` surfaces the Opportunity-Account-Territory2 relationships including custom Named_Account_Tier__c. `metrics` surfaces the exact formula parameters: coverage denominator is forecast (not quota), targets are 4.5x/2x by segment, win rate excludes sub-$25K and sub-14-day deals, velocity includes discount impact factor. `segmentation-and-periods` surfaces the segmentation breakpoints (New Business vs. Renewal) and fiscal calendar alignment. `business-rules` surfaces stage-to-forecast-category mapping that is non-linear and varies by record type. `modeling-patterns` surfaces stage-transition grain vs. daily-snapshot grain choice. `output-standards` surfaces QBR waterfall categories and FX conversion rules.

Under the 14-dimension matrix, `segmentation-and-periods` and `output-standards` do not exist. The segmentation knowledge gets partially captured in `metrics` but as a secondary concern, not a primary research target. The Output Standards template section ships generic.

**Source skill (8 dimensions):** `entities` surfaces custom objects (SBQQ__Quote__c, Clari fields, Named_Account_Tier__c). `extraction` surfaces Bulk API governor limit concerns at Beta's volume. `field-semantics` surfaces the CPQ override: real value is SBQQ__Quote__c.SBQQ__NetTotal__c, not Opportunity.Amount. `change-detection` surfaces SystemModstamp vs. LastModifiedDate and queryAll for soft deletes. `lifecycle-and-state` surfaces ForecastCategory/StageName independence and record-type-specific stage mappings. `customizations` surfaces Steelbrick CPQ, Clari, Gong, and Territory2. `reconciliation` surfaces SFDC-vs-Clari-vs-finance discrepancies. `data-quality` surfaces known quality issues in Beta's org.

Under the 14-dimension matrix, the source skill runs 5 agents. `schema-mapping` must cover both field semantic overrides (CPQ Amount) and type coercion rules. `extraction` must cover both API patterns and CDC mechanisms. No dimension covers lifecycle, customizations, or reconciliation -- three template sections go unfilled.

The synthesis failure mode analysis (Section 5.2) is explicit: "Standard extraction tutorials produce wrong data (LastModifiedDate misses system changes, query() misses soft deletes)." These are exactly the findings `change-detection` surfaces.

### dbt on Fabric Platform Skill

**Platform skill (6 dimensions):** `entities` surfaces Lakehouse vs. Warehouse resource types and their dependencies. `platform-behavioral-overrides` surfaces merge degradation on Lakehouse, datetime2 precision failures, and endpoint-dependent SQL features. `config-patterns` surfaces `threads: 16` throttling, ODBC Driver 18 requirement, and mandatory `dispatch` overrides for dbt_utils. `version-compat` surfaces dbt-fabric adapter version requirements for incremental materialization. `integration-orchestration` surfaces CI/CD patterns and concurrent run coordination. `operational-failure-modes` surfaces 30-minute query timeout, metadata lock contention, and environment-specific test error formats.

Under the 14-dimension matrix (4 agents: `entities`, `api-patterns`, `integration`, `deployment`), the platform skill has no dimension covering behavioral overrides, version compatibility, or operational failure modes. `api-patterns` is too broad -- it covers "API structures and integration constraints" generically, which for dbt means dbt's CLI interface, not Fabric-specific behavioral quirks. The three highest-delta items for dbt-on-Fabric (merge degradation, datetime2 precision, query timeout) have no researching dimension.

---

## Section 4: Preemptive Defense Against "Dimension Proliferation"

### "8 dimensions for source skills is too many"

Each of the 8 source dimensions maps to a distinct template section (proposed matrix Section 3, Source Skills mapping). The mapping is not one-to-one -- some dimensions inform multiple sections, and some sections are informed by multiple dimensions -- but every dimension has at least one primary template section it is responsible for populating.

The alternative is fewer dimensions that each cover broader scope. The synthesis shows what happens: `schema-mapping` in the 14-dimension matrix must cover field semantic overrides (high delta: CPQ overriding Amount), type coercion rules (low delta: Claude knows these), and schema evolution (medium delta). The agent produces questions at the average delta level of its scope -- the high-delta CPQ override gets diluted by generic type coercion questions. The `field-semantics` dimension in the 23-dimension matrix produces only high-delta questions because its scope is restricted to fields whose standard meaning is overridden or misleading.

The cost of 8 parallel agents vs. 5 is marginal. The dynamic research design document (Section 1) chose flat parallel execution specifically because "two sequential phases double wall time for minimal quality gain." All dimension agents run in parallel regardless of count. The additional cost is 3 more sonnet calls of ~500 tokens each -- roughly $0.01-0.02. The consolidation agent processes slightly more input, adding perhaps 5 seconds to its extended thinking. This is trivial against the quality gain.

### "The consolidation agent will be overwhelmed by 8 inputs"

The consolidation agent benefits from more inputs when those inputs are sharply scoped. Consider the alternative: 5 broad agents each producing 8-12 questions that mix concerns. The consolidation agent must first decompose these into thematic clusters, then cross-reference. With 8 focused agents, the decomposition is already done. The consolidation agent's job is strictly cross-referencing -- "the `customizations` agent says CPQ overrides Amount, and the `field-semantics` agent says Amount is the wrong field; these are the same finding from different angles, surface it once with full context." This is easier with focused inputs, not harder.

### "Some dimensions will produce the same questions regardless of the specific source"

The proposed matrix addresses this through per-type focus overrides (proposed matrix Section 1, each dimension entry). The `change-detection` dimension for Salesforce asks about SystemModstamp vs. LastModifiedDate and queryAll. For Oracle ERP, it would ask about WHO columns and LAST_UPDATE_DATE limitations on child entities. For Stripe, it would ask about webhook event ordering and idempotency keys. The questions are platform-specific because the dimension's focus override is platform-specific.

---

## Concrete Recommendations

1. **Adopt the full 23-dimension matrix as proposed.** Every dimension passes the delta filter, maps to template sections, and produces instance-specific questions.

2. **Split `data-quality` / `quality-gates` into two separate agents** rather than one shared agent with focus overrides. The content difference is significant: DE quality is about pattern-specific checks, source quality is about org-specific issues (proposed matrix Section 4, design question). The consolidation agent benefits from receiving these as distinct signals.

3. **Implement the `pipeline-patterns` split** (`pattern-interactions` + `load-merge-patterns`) as proposed. The synthesis evidence for pattern interaction knowledge as the highest-delta content for DE skills is strong -- SCD Type 2 forcing hash-based surrogates forcing MERGE INTO is a constraint chain Claude knows in pieces but not as a chain.

4. **Keep `segmentation-and-periods` as a standalone dimension** rather than merging back into `metrics` and `business-rules`. Customer Beta's evidence is conclusive: without knowing the segmentation (4.5x/2x by deal type), even correct formulas produce wrong answers. This is the most variable aspect of domain skills (proposed matrix Section 1).

5. **Consider adding a `bundle-interactions` cross-type dimension** for the bundle case. The proposed matrix Section 5 documents four bundle interaction dimensions (Field-to-Metric Mapping, Semantic Translation, Data Quality Contract, Refresh and Timing Alignment) that are currently not researched by any dimension agent. This is a potential gap even in the 23-dimension matrix -- making the matrix possibly still incomplete. The synthesis Section 6.2 template structure for bundles confirms this as a real concern: "The Agent Skills spec does not define how source and domain skills reference each other."

6. **Validate through the dbt-on-Fabric case first.** The platform skill's 6 dimensions represent the cleanest test: the 14-dimension matrix's 4 platform dimensions (`entities`, `api-patterns`, `integration`, `deployment`) miss the three highest-delta items (merge degradation, datetime2 precision, query timeout). A side-by-side comparison of clarification questions produced by 4 vs. 6 dimensions for dbt-on-Fabric will provide empirical evidence of the quality delta.
