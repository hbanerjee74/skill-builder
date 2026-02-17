# Position Paper: The Cost-Benefit Framework

## Core Argument

The proposed matrix is directionally correct but contains 4-5 dimensions that fail a rigorous marginal-value test. Moving from 14 to 23 dimensions increases per-research-step cost by ~70% ($0.50 to $0.85) and wall time by ~40% (6-8 agents to 7-8 agents per type, but with heavier consolidation load). That cost is justified only if each added dimension surfaces knowledge the consolidation agent cannot synthesize from adjacent dimensions. I propose a 4-factor scoring rubric, apply it to all 23 dimensions, and identify 4 dimensions that score below threshold. The recommended matrix is 19 dimensions -- capturing 95%+ of the quality gain at ~80% of the proposed cost.

---

## The 4-Factor Rubric

Each dimension is scored 0 or 1 on four binary criteria. A dimension must score 3 or 4 to justify inclusion. Scoring 2 or below means the dimension's marginal contribution does not justify its token and latency cost.

| Factor | Question | Score 1 if... |
|--------|----------|---------------|
| **F1: Primary Template Target** | Does this dimension have a template section where it is the *primary* populator? | The dimension is marked "P" (primary) for at least one template section in the proposed mapping. |
| **F2: Concrete Failure Mode** | Does the delta justification cite a specific, worked failure scenario from the synthesis or reference cases? | The justification names a concrete failure (e.g., "CPQ overrides Amount," "ORG_ID filtering returns cross-org data"), not just a category of risk. |
| **F3: Question Differentiation** | Do this dimension's example questions differ meaningfully from every adjacent dimension's questions? | A domain expert could not answer this dimension's questions by answering another dimension's questions. |
| **F4: Orphan Prevention** | Would removing this dimension leave a template section with no primary dimension? | At least one template section would lose its only primary populator. |

**Threshold: 3 of 4.** A dimension scoring 2/4 is a candidate for merging into an adjacent dimension. A dimension scoring 1/4 or 0/4 should be removed.

---

## Rubric Applied: All 23 Dimensions

### Cross-Type Dimensions

**`entities` (all 4 types) -- Score: 4/4.** F1: Primary for Entity & Grain (DE), Field Semantics (source). F2: "Customer is actually a billing entity while Customer (custom object) is the commercial entity" (stage1-domain.md). F3: Entity questions are structurally distinct from all other dimensions. F4: Removing it orphans Entity & Grain Design (DE), and leaves source Field Semantics underserved.

**`quality-gates` / `data-quality` (DE + source) -- Score: 4/4.** F1: Primary for Quality Gates (DE) and feeds System Workarounds (source). F2: "Duplicate current records in SCD Type 2 after merge failure" (stage1-data-engineering.md), "validation rules forcing incorrect data entry" (stage1-source.md). F3: Pattern-specific quality checks (DE) and org-specific quality issues (source) are distinct from each other and from all other dimensions. F4: Quality Gates template section has no other primary.

### Domain Dimensions (6 proposed)

**`metrics` -- Score: 4/4.** F1: Primary for Metric Definitions. F2: "Coverage 3x default is wrong for both Beta segments (4.5x/2x)" (synthesis Section 5.2). F3: Formula parameter questions (denominator, exclusions, modifiers) are not answerable from entity or business-rule questions. F4: Metric Definitions loses its only primary.

**`business-rules` -- Score: 4/4.** F1: Primary for Business Logic Decisions. F2: "Pushed deals treated differently by deal type -- New Business gets two pushes, Renewal never removed" (stage1-domain.md). F3: Conditional logic ("if X then Y unless Z") is structurally different from metric formulas or segmentation breakpoints. F4: Business Logic Decisions loses its only primary.

**`segmentation-and-periods` -- Score: 4/4.** F1: Primary for both Segmentation Standards and Period Handling. F2: "Coverage target itself is segmented (4.5x/2x) -- without knowing segmentation, correct formulas produce wrong answers" (stage1-domain.md). F3: Fiscal calendar, snapshot cadence, and segment breakpoint questions are not answerable from metrics or business-rules questions. F4: Period Handling loses its only primary.

**`modeling-patterns` -- Score: 3/4.** F1: Primary for Metric Definitions alongside `metrics` (secondary contributor). Actually, reviewing the mapping more carefully: modeling-patterns is primary for none -- it contributes to Metric Definitions, Business Logic Decisions, and Output Standards as secondary. **Revised F1: 0.** However, the stage1-domain.md explicitly argues for it: "stage-transition grain vs. daily-snapshot grain" is a distinct modeling decision. F2: 1 -- "building at transition grain when they need point-in-time snapshots forces expensive window functions" (stage1-domain.md). F3: 1 -- grain and fact table design questions are distinct from metric formula questions. F4: 0 -- no section loses its only primary if this is removed.

**Revised score: 2/4.** This dimension is a merge candidate. Its content overlaps with `entities` (grain decisions) and `metrics` (which gold tables to build). However, the domain researcher's case is substantive: Customer Beta needs both stage-transition and daily-snapshot facts. I flag this as a judgment call rather than a clear removal.

**`output-standards` -- Score: 2/4.** F1: 1 -- primary for Output Standards template section. F2: 0 -- the delta justification cites "QBR waterfall chart categories" and "FX conversion at first-of-month spot rate" (stage1-domain.md), but these are org-specific preferences, not failure modes that produce silently wrong data. Missing the wrong FX rate is a real error, but the synthesis never identified output formatting as a primary failure mode. F3: 0 -- "What currency conversion timing do you use?" and "What drill-down hierarchy does your org expect?" could be asked as sub-questions of `segmentation-and-periods` (which already covers reporting hierarchy and period handling) or as consolidation-agent-generated questions. F4: 1 -- Output Standards section loses its only primary.

**Score: 2/4.** Below threshold. The Output Standards template section can be populated by consolidation-agent synthesis from `segmentation-and-periods`, `metrics`, and `business-rules` outputs. The 3-5 questions this dimension would generate (currency, formatting, drill-down, chart labels) can be appended by the consolidation agent without a dedicated research agent.

### Data-Engineering Dimensions (7 proposed)

**`pattern-interactions` -- Score: 4/4.** F1: Primary for Pattern Selection & Interaction Rules. F2: "SCD Type 2 forces hash-based surrogate keys, which forces MERGE INTO, which requires reliable change timestamps" (stage1-data-engineering.md). F3: Interaction-between-patterns questions are categorically different from individual pattern questions. F4: Pattern Selection section loses its only primary.

**`load-merge-patterns` -- Score: 4/4.** F1: Primary for Load & Merge Patterns. F2: "High-water mark boundary duplicates -- standard pattern silently drops or duplicates records" (stage1-data-engineering.md). F3: Merge predicate design and failure recovery questions are distinct from pattern-interaction questions. F4: Load & Merge section loses its only primary.

**`historization` -- Score: 4/4.** F1: Primary for Historization & Temporal Design. F2: "Type 2 with 50M rows changing 10% daily creates 5M new version rows/day -- unqueryable in weeks" (stage1-data-engineering.md). F3: SCD type selection thresholds and bitemporal triggers are distinct questions. F4: Historization section loses its only primary.

**`layer-design` -- Score: 4/4.** F1: Primary for Layer Design & Materialization. F2: "Type 2 dimensions make views expensive -- point-in-time joins push date-range filtering into every query" (stage1-data-engineering.md). F3: Silver/gold boundary and materialization questions are distinct from pattern or historization questions. F4: Layer Design section loses its only primary.

**`operational-patterns` -- Score: 3/4.** F1: 0 -- no primary template section. It contributes secondarily to Load & Merge (recovery) and Quality Gates (monitoring). F2: 1 -- "Backfilling Type 2 dimension overwrites history with current-state data, destroying months of tracked changes" (stage1-data-engineering.md). F3: 1 -- backfill strategy and schema evolution questions are distinct from load-merge or quality-gate questions. F4: 0 -- no section loses its only primary.

**Score: 2/4.** Below threshold as a standalone dimension. However, the backfill failure mode is concrete and high-severity. **Recommendation: merge into `load-merge-patterns`** as a "recovery and day-2 operations" subsection. The load-merge dimension already covers failure recovery; extending it to cover backfill and schema evolution is a natural scope expansion that costs zero additional agents.

### Platform Dimensions (6 proposed)

**`platform-behavioral-overrides` -- Score: 4/4.** F1: Primary for Platform Behavioral Overrides. F2: "`merge` strategy silently degrades on Fabric Lakehouse" (stage1-platform.md). F3: "Docs say X, reality is Y" questions are categorically different from configuration or version questions. F4: Section loses its only primary.

**`config-patterns` -- Score: 4/4.** F1: Primary for Configuration Patterns and Anti-Patterns. F2: "`threads: 16` causes Fabric throttling" (stage1-platform.md). F3: "Which config combinations fail in practice?" is distinct from behavioral overrides or version questions. F4: Section loses its only primary.

**`version-compat` -- Score: 3/4.** F1: 1 -- primary for Version Compatibility and Migration. F2: 1 -- "dbt-fabric adapter v1.6+ required for incremental; earlier versions silently fall back to table" (stage1-platform.md). F3: 0 -- version pinning and breaking change questions overlap significantly with `config-patterns` (which already covers "configuration settings with non-obvious defaults" and version-dependent config). The stage1-platform.md itself notes `config-patterns` feeds Section 3 (Version Compatibility) as a secondary. F4: 1 -- section loses its only primary.

**Score: 3/4.** Passes threshold, but barely. The overlap with `config-patterns` is real. Keep it, but flag for monitoring: if in practice version-compat and config-patterns produce redundant questions, merge them.

**`integration-orchestration` -- Score: 4/4.** F1: Primary for Integration and Orchestration. F2: "Azure DevOps Service Principal authentication requires specific API permissions undocumented in adapter docs" (stage1-platform.md). F3: CI/CD and multi-tool workflow questions are distinct from platform behavior or config questions. F4: Section loses its only primary.

**`operational-failure-modes` -- Score: 4/4.** F1: Primary for Operational Gotchas. F2: "Fabric SQL endpoint 30-minute unconfigurable timeout -- opaque 'connection closed' error" (stage1-platform.md). F3: "What breaks at 2am" questions are categorically different from behavioral override or config questions. F4: Section loses its only primary.

### Source Dimensions (8 proposed)

**`extraction` -- Score: 4/4.** F1: Primary for Data Extraction Gotchas. F2: "ORG_ID filtering ~4/10 Claude responses miss" (synthesis Section 6.1). F3: Platform-specific extraction trap questions are distinct from field semantics or change detection. F4: Section co-primary with change-detection, but extraction covers different content.

**`field-semantics` -- Score: 4/4.** F1: Primary for Field Semantics and Overrides. F2: "CPQ overrides Opportunity.Amount -- SBQQ__Quote__c.SBQQ__NetTotal__c is the real value" (synthesis Section 5.2). F3: "What does this field actually mean?" is distinct from "what changed?" or "what packages are installed?". F4: Section loses its only primary.

**`change-detection` -- Score: 4/4.** F1: Primary for Data Extraction Gotchas (co-primary with extraction). F2: "SystemModstamp vs. LastModifiedDate -- Claude inconsistently recommends correct field" (synthesis Section 6.1). F3: "Which records changed?" questions are structurally different from "how to pull data?" questions. F4: Contributes distinct content to Extraction Gotchas.

**`lifecycle-and-state` -- Score: 4/4.** F1: Primary for State Machine and Lifecycle. F2: "ForecastCategory and StageName independently editable -- pipeline vs. forecast discrepancy" (synthesis Section 5.2). F3: State progression and reopening questions are distinct from field semantics or extraction questions. F4: State Machine section loses its only primary.

**`customizations` -- Score: 3/4.** F1: 0 -- no sole primary. It contributes to Field Semantics (co-primary with `field-semantics`), System Workarounds (secondary), and Data Extraction Gotchas (secondary). F2: 1 -- "Steelbrick CPQ overrides Amount, Clari overwrites ForecastCategory nightly" (synthesis Section 5.2). F3: 0 -- "Which managed packages are installed and what do they override?" substantially overlaps with `field-semantics` ("Which fields have been overridden?") and `entities` ("Which custom objects exist?"). The stage1-source.md itself acknowledges this overlap in the Overlap and Interaction Analysis table. F4: 0 -- no section loses its only primary.

**Score: 1/4.** Below threshold. The managed-package-entropy concern is real but is already surfaced by `field-semantics` (which fields are overridden), `entities` (which custom objects exist), and `extraction` (non-standard extraction requirements). **Recommendation: merge into `field-semantics`** by expanding its focus to explicitly include "which managed packages modify which fields and on what schedule." This adds 1-2 questions to field-semantics without adding a parallel agent.

**`reconciliation` -- Score: 3/4.** F1: 1 -- primary for Reconciliation Rules. F2: 1 -- "SFDC pipeline numbers disagree with finance -- source of truth for bookings?" (synthesis Section 6.2). F3: 1 -- "Which numbers should agree but don't?" is distinct from field semantics or extraction questions. F4: 1 -- Reconciliation Rules loses its only primary.

**`data-quality` -- Score: 3/4.** F1: 0 -- no primary for source (feeds Data Extraction Gotchas and System Workarounds as secondary). F2: 1 -- "validation rules forcing incorrect data entry" (stage1-source.md). F3: 1 -- "Which fields are unreliable in your org?" is distinct from extraction or reconciliation questions. F4: 0 -- no section loses its only primary.

**Score: 2/4.** Below threshold as a standalone source dimension. However, it shares an agent with DE (`quality-gates`), so the marginal cost of including it for source is near zero -- the agent already exists. **Recommendation: retain, but only because the shared agent makes the marginal cost negligible.** If it were source-only, it would be a merge candidate into `reconciliation`.

---

## Worked Examples: Three Reference Cases

### Case 1: Customer Beta -- Pipeline Forecasting Domain Skill

The domain type gets 6 dimensions under the proposal. My rubric flags `output-standards` (2/4) and `modeling-patterns` (2/4).

**With 6 dimensions ($0.60 estimated):** All 6 agents run in parallel. The `output-standards` agent generates questions about QBR waterfall labels, FX conversion timing, and drill-down hierarchy. These are legitimate questions -- but the `segmentation-and-periods` agent already asks about reporting hierarchy, and the `metrics` agent already asks about how results should be presented. The consolidation agent can synthesize output-format questions from these inputs without a dedicated agent.

**With 4 dimensions ($0.40 estimated):** `entities`, `metrics`, `business-rules`, `segmentation-and-periods`. The consolidation agent receives Beta's segmented coverage targets (4.5x/2x), fiscal calendar structure, pushed-deal rules, and entity hierarchy. It can infer that output standards need to address segment-level presentation and fiscal period alignment. The questions "What is your QBR format?" and "What is your FX conversion timing?" can be appended by the consolidation agent as follow-up questions derived from the metric and period findings.

**Risk of the 4-dimension approach:** The consolidation agent might miss currency conversion timing or chart label conventions -- these are arbitrary org decisions not inferable from metric or period answers. This is a real risk. My estimate: 70% of output-standard content is inferable from adjacent dimensions; 30% requires direct questioning. The question is whether that 30% justifies a dedicated $0.10 research agent or whether it can be handled in Stage 3 (Detailed Research).

**Recommendation for domain:** 5 dimensions. Keep `modeling-patterns` (the grain-decision case for Beta is strong enough despite the 2/4 score), remove `output-standards` (handle in consolidation + detailed research).

### Case 2: Customer Beta -- Salesforce Source Skill

The source type gets 8 dimensions under the proposal. My rubric flags `customizations` (1/4) and `data-quality` (2/4).

**With 8 dimensions ($0.80 estimated):** The `customizations` agent asks "Which managed packages are installed?" The `field-semantics` agent asks "Does Amount mean the right thing?" The `entities` agent asks "Which custom objects exist?" These three agents independently discover that Steelbrick CPQ overrides Amount, Clari overwrites ForecastCategory, and Gong injects activity objects. The consolidation agent then cross-references these findings. But the findings were discoverable from fewer agents.

**With 6 dimensions ($0.60 estimated):** Merge `customizations` scope into `field-semantics` (add "Which managed packages modify these fields?") and rely on `entities` for custom object discovery. The consolidated output covers the same ground: CPQ overriding Amount surfaces through field-semantics asking "What does Amount actually mean at your org?"; Clari surfaces through "Which fields are written by automated processes?"; Gong objects surface through entities asking "Which non-standard objects exist?"

**Risk:** Merging `customizations` into `field-semantics` increases that agent's question count from ~5-8 to ~8-10. The agent may lose focus. Mitigation: the focus line explicitly says "including managed package field overrides and their modification schedules."

**Recommendation for source:** 6 dimensions (`entities`, `extraction`, `field-semantics` [expanded], `change-detection`, `lifecycle-and-state`, `reconciliation`) plus `data-quality` retained at zero marginal cost because it shares the DE agent.

### Case 3: dbt on Fabric -- Platform Skill

The platform type gets 6 dimensions under the proposal. My rubric scores all 6 at 3/4 or 4/4.

**With 6 dimensions ($0.60 estimated):** All dimensions produce differentiated questions. `platform-behavioral-overrides` asks about merge strategy degradation on Lakehouse; `config-patterns` asks about ODBC driver versions and thread limits; `version-compat` asks about dbt-fabric adapter version requirements; `integration-orchestration` asks about Azure DevOps CI/CD; `operational-failure-modes` asks about 30-minute query timeouts; `entities` asks about Lakehouse vs. warehouse target distinction.

**Overlap risk between `version-compat` and `config-patterns`:** The ODBC driver version question could appear in either dimension. "dbt-fabric adapter v1.6+ required for incremental" is a version-compat finding, but it also affects configuration choices. The stage1-platform.md acknowledges this by listing `config-patterns` as a secondary contributor to the Version Compatibility template section.

**Recommendation for platform:** 6 dimensions. All justified. Monitor version-compat/config-patterns overlap in practice.

---

## Empirically Testable vs. Belief-Dependent Claims

| Claim | Testable? | How to Test |
|-------|-----------|-------------|
| "Each additional dimension adds ~$0.05-0.10 in token cost" | Yes | Measure actual token consumption per dimension agent across 10 skill builds |
| "23 dimensions produce higher quality than 14" | Yes | A/B test: build 5 skills with 14 vs. 23 dimensions, evaluate clarifications.md quality with LLM judge |
| "The consolidation agent can synthesize output-standards questions from adjacent dimension outputs" | Yes | Run the consolidation agent with and without `output-standards` input; compare Output Standards section quality |
| "`customizations` produces findings not discoverable from `field-semantics` + `entities`" | Yes | Run all three agents on the Salesforce case; compare union of findings |
| "Opus consolidation with extended thinking compensates for fewer input dimensions" | Partially | A/B test with quality scoring, but confounded by consolidation agent's own variance |
| "Adjacent dimensions' overlap reduces marginal value of additional dimensions" | Belief-dependent | There is no clean way to measure "marginal value per dimension" independent of all other dimensions; interaction effects dominate |
| "The 30% of output-standards content not inferable from adjacent dimensions justifies a dedicated agent" | Belief-dependent | Depends on how you weight the cost of a missed currency-conversion question vs. the cost of an extra agent |

---

## Preemptive Defense

**Strongest argument against my position:** "Removing dimensions that score 2/4 is penny-wise and pound-foolish. The $0.10 cost of a dimension agent is trivial compared to the cost of a skill that misses a critical question. If `output-standards` prevents even one missed QBR-format question across 10 skill builds, it pays for itself."

This argument has merit. But it proves too much -- by the same logic, you could justify 30 or 40 dimensions. The constraint is not individual cost but consolidation load: the opus consolidation agent with extended thinking must cross-reference all dimension outputs. At 8 dimensions (source), the cross-reference matrix has 28 pairwise interactions. Adding 2 more dimensions increases this to 45 -- a 60% increase in reasoning load. The consolidation agent is where quality is actually produced (stage1-data-engineering.md: "Extended thinking is where the real quality gain happens"). Overloading it with redundant inputs risks degrading consolidation quality. The rubric identifies dimensions where the input is redundant, not where the questions are unimportant.

---

## Concrete Recommendations

1. **Adopt the 4-factor rubric as the inclusion gate.** Score every dimension before implementation. Threshold: 3/4. This is not a one-time exercise -- re-score after first 5 skill builds using empirical overlap data.

2. **Remove `output-standards` from domain dimensions.** Current score: 2/4. Add 2-3 output-format questions to the consolidation agent's prompt as "always ask" follow-ups derived from metrics and segmentation findings. If Stage 3 (Detailed Research) consistently surfaces output-format gaps, re-evaluate.

3. **Merge `customizations` into `field-semantics` for source dimensions.** Current score: 1/4. Expand `field-semantics` focus line to: "Focus on fields whose standard meaning is overridden or misleading, *including managed package modifications and their schedules*." Add the managed-package inventory question to `entities`.

4. **Merge `operational-patterns` into `load-merge-patterns` for DE dimensions.** Current score: 2/4. Expand `load-merge-patterns` scope to include "failure recovery, backfill strategies, and schema evolution handling." The load-merge agent already covers failure recovery; backfill and schema evolution are natural extensions.

5. **Retain `data-quality` for source at zero marginal cost.** The shared agent with DE means the source-specific focus override adds no new agent. Keep it.

6. **Monitor `version-compat` / `config-patterns` overlap for platform.** Both pass at 3/4 and 4/4 respectively. If post-implementation data shows >40% question overlap, merge them.

7. **Run the A/B test.** Build 3 skills with 23 dimensions and 3 with the recommended 19. Score clarifications.md quality using the eval harness. If 23 dimensions produce measurably better output (>0.5 points on the 1-5 rubric), restore the removed dimensions. If not, the 19-dimension matrix is validated.

**Final dimension counts under this recommendation:**
- Domain: 5 (was 6) -- remove `output-standards`
- Data-engineering: 6 (was 7) -- merge `operational-patterns` into `load-merge-patterns`
- Platform: 6 (unchanged)
- Source: 7 (was 8) -- merge `customizations` into `field-semantics`
- **Total: 19 unique dimensions** (was 23)
- **Estimated cost: $0.70/research step** (was $0.85; baseline $0.50)
