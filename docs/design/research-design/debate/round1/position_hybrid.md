# Position Paper: Selective Expansion to 16-18 Dimensions

## Core Argument

The proposed matrix gets the delta analysis right on individual dimensions but gets the architecture wrong on count. Going from 14 to 23 dimensions is not an incremental improvement -- it is a 64% increase in parallel agents per research run, with at least 5 of the new dimensions failing their own delta justifications or duplicating content that the consolidation agent already handles. The correct target is 16-18 unique dimensions: keep every high-delta addition (platform-behavioral-overrides, operational-failure-modes, change-detection, lifecycle-and-state), merge 4 dimensions that overlap their neighbors, and drop 1 that belongs to consolidation, not research. This produces 4-6 dimensions per type instead of 6-8, preserving the quality gain while halving the marginal agent cost.

---

## The Structural Diagnosis: Which Dimensions Earned Their Seat

Not all 9 new dimensions in the proposed matrix carry equal delta weight. The Stage 1 researchers themselves provide the evidence to sort them.

### High-delta additions (keep all 4)

**`platform-behavioral-overrides`**: The platform researcher calls this "the single highest-delta dimension for platform skills" (stage1-platform.md). For dbt on Fabric, Claude's training data IS the dbt documentation, which is Snowflake-centric. The `merge` strategy silently degrading on Fabric Lakehouse, datetime2 precision breaking snapshots, warehouse vs. Lakehouse endpoint differences -- none of this exists in docs Claude trained on. No other dimension covers behavioral deviations. This is irreducible.

**`operational-failure-modes`**: "Claude describes happy paths; this dimension surfaces failure paths" (stage1-platform.md). The 30-minute unconfigurable query timeout on Fabric SQL endpoint, metadata lock contention from concurrent dbt runs, environment-specific `dbt test` error formats -- all production-incident knowledge absent from documentation. The platform researcher explicitly distinguishes this from behavioral overrides (docs-vs-reality) and config anti-patterns (valid-but-wrong YAML). Three distinct failure categories, three distinct dimensions.

**`change-detection`**: The source researcher separates this from extraction with a clean functional boundary: "extraction covers HOW to pull data; change-detection covers WHAT to pull" (stage1-source.md). The synthesis identified SystemModstamp vs. LastModifiedDate, queryAll() for soft deletes, and WHO column CDC limitations as primary failure modes (synthesis Section 6.1). These are platform-specific correctness questions where the wrong answer produces silently incomplete data -- qualitatively different from extraction method selection.

**`lifecycle-and-state`**: Template section 4 (State Machine and Lifecycle) previously had zero researching dimensions (stage1-source.md). RecordTypeId filtering, ForecastCategory/StageName independence, custom stage progressions -- these are lifecycle behaviors Claude does not reliably flag. The source researcher shows concrete failure modes: "pipeline stage analysis that assumes a linear progression when the customer allows skipping or regression." This fills a genuine template gap.

### Merge candidates (4 dimensions that overlap neighbors)

**`customizations` should merge into `entities`**. The source researcher's own overlap analysis acknowledges: "`entities` focuses on object relationships and record type subdivisions; `customizations` focuses on managed package impact and schema surface" (stage1-source.md). But for Customer Beta's Salesforce, the managed packages (Steelbrick CPQ, Clari, Gong) ARE the entity landscape. SBQQ__Quote__c is an entity. Clari's custom forecast fields are entity attributes. The distinction between "what objects exist beyond standard" and "which packages created those objects" produces the same questions asked from slightly different angles. The entities dimension with the source-specific focus override ("custom objects, managed package objects, record type subdivisions") already covers this. Adding a separate customizations agent means the consolidation agent receives two overlapping output streams about the same schema surface.

*Worked example -- Customer Beta (Salesforce)*: The entities agent asks "Which managed packages are installed and which standard objects do they override?" The customizations agent asks "For your CPQ/quoting tool: which field contains the authoritative deal value?" These are the same discovery conversation. Merge customizations concerns into the entities focus override, adding: "including managed package schema extensions, ISV field overrides, and package update impact."

*Worked example -- dbt on Fabric*: Not applicable (platform type does not use customizations). No cross-type impact.

**`change-detection` should stay separate from `extraction`** (no merge). I considered merging these but the source researcher's functional boundary holds: HOW vs. WHAT. The synthesis failure modes (SystemModstamp, queryAll, WHO columns) all map to "what changed" not "how to pull." Keep both.

**`output-standards` should be dropped as a research dimension**. The domain researcher's own justification is weak: "the CFO expects pipeline in the QBR to show a specific waterfall chart format with exact category labels" (stage1-domain.md). This is true, but it is consolidation-agent territory, not research-agent territory. Output standards are organizational formatting decisions that surface naturally through metrics questions ("How do you display coverage?"), segmentation questions ("What drill-down hierarchy?"), and business-rules questions ("What does the QBR format look like?"). The proposed matrix itself shows output-standards informing only Output Standards and Segmentation Standards -- the two sections already covered by other dimensions. The consolidation agent with extended thinking (effort: high) cross-references dimension outputs specifically to produce cohesive output formatting guidance (dynamic-research-dimensions.md, Section 1). A dedicated research agent asking "What is your reporting currency?" and "What number formatting do you use?" produces the same generic questions regardless of domain, failing the granularity test.

*Worked example -- Customer Beta (Pipeline Forecasting)*: The metrics dimension already asks about coverage target segmentation. The segmentation-and-periods dimension asks about fiscal calendar and snapshot cadence. The business-rules dimension asks about QBR format requirements. What does a standalone output-standards agent add? "What drill-down hierarchy does your organization expect?" -- a question the segmentation dimension already surfaces. "FX conversion at first-of-month spot rate" -- a question the metrics dimension handles when probing materiality thresholds. The agent produces 5-8 questions already covered elsewhere.

*Worked example -- dbt on Fabric*: Not applicable (domain-only dimension).

**`quality-gates` and `data-quality` should remain one shared agent with type-specific focus overrides, not two agents**. The proposed matrix flags this as an open design question (stage1-proposed-matrix.md, Section 6, Question 1). I argue for one agent. The DE focus ("pattern-specific quality checks, cross-layer reconciliation") and source focus ("known org-specific quality issues, unreliable fields") are different focus lines on the same research competency -- data quality practices applied to a specific context. The shared agent model with focus overrides is exactly how `entities` works across all 4 types, and nobody proposes splitting entities into 4 type-specific agents.

**`reconciliation` should merge into `data-quality` for source skills**. The source researcher's overlap analysis states: "`data-quality` covers individual field reliability; `reconciliation` covers cross-table/cross-system consistency" (stage1-source.md). But reconciliation IS a data quality concern. "Where do SFDC pipeline numbers disagree with finance?" and "Which fields are commonly null?" are both quality-of-data questions with the same template section overlap (Data Extraction Gotchas, System Workarounds). Merge reconciliation into the data-quality focus override for source: "known quality issues including cross-system reconciliation points, tolerance levels, and source-of-truth resolution."

*Worked example -- Customer Beta (Salesforce)*: The data-quality agent asks "Which standard fields are unreliable in your org?" The reconciliation agent asks "Where do Salesforce pipeline numbers disagree with your finance system?" Both contribute to the same skill section (Reconciliation Rules). A single agent with the prompt "Surface known data quality issues AND cross-system reconciliation points" produces a coherent output stream that the consolidation agent can process without deduplication.

---

## The Resulting Matrix: 17 Dimensions

| Dimension | domain | data-eng | platform | source |
|-----------|:------:|:--------:|:--------:|:------:|
| `entities` | x | x | x | x |
| `data-quality` | - | x (as quality-gates) | - | x |
| `metrics` | x | - | - | - |
| `business-rules` | x | - | - | - |
| `segmentation-and-periods` | x | - | - | - |
| `modeling-patterns` | x | - | - | - |
| `pattern-interactions` | - | x | - | - |
| `load-merge-patterns` | - | x | - | - |
| `historization` | - | x | - | - |
| `layer-design` | - | x | - | - |
| `operational-patterns` | - | x | - | - |
| `platform-behavioral-overrides` | - | - | x | - |
| `config-patterns` | - | - | x | - |
| `version-compat` | - | - | x | - |
| `integration-orchestration` | - | - | x | - |
| `operational-failure-modes` | - | - | x | - |
| `extraction` | - | - | - | x |
| `field-semantics` | - | - | - | x |
| `change-detection` | - | - | - | x |
| `lifecycle-and-state` | - | - | - | x |
| **Per-type count** | **5** | **7** | **6** | **6** |

Total unique dimensions: **17**. Changes from proposed 23: merged `customizations` into `entities`, merged `reconciliation` into `data-quality`, dropped `output-standards`. Net: -3 dimensions for source (8 to 6 is a meaningful reduction -- from highest to tied-for-second), -1 for domain (6 to 5).

---

## Worked Examples Across All Three Reference Cases

### Customer Beta -- Pipeline Forecasting Domain Skill

Under my matrix (5 dimensions): `entities`, `metrics`, `business-rules`, `segmentation-and-periods`, `modeling-patterns`.

The 4.5x/2x segmented coverage, win rate excluding sub-$25K and sub-14-day deals, and custom velocity discount impact factor are all surfaced by `metrics`. The segmentation breakpoints (500+ employees AND $1M+ ACV for enterprise) and fiscal calendar are surfaced by `segmentation-and-periods`. The non-linear stage-to-forecast-category mapping and pushed-deal handling are surfaced by `business-rules`. Stage-transition vs. daily-snapshot grain decisions are surfaced by `modeling-patterns`.

What about output standards (QBR waterfall format, FX conversion rates, drill-down hierarchy)? These surface through existing dimensions: the waterfall categories are a segmentation question, FX conversion is a metric parameter, and drill-down hierarchy is segmentation structure. The consolidation agent synthesizes these into the Output Standards template section.

**Risk assessment**: Low. Every metric parameter, business rule, and segmentation decision has a dedicated dimension. The only content not directly researched is presentation formatting, which the consolidation agent handles.

### Customer Beta -- Salesforce Source Skill

Under my matrix (6 dimensions): `entities`, `extraction`, `field-semantics`, `change-detection`, `lifecycle-and-state`, `data-quality`.

Steelbrick CPQ, Clari, and Gong are surfaced by `entities` (which custom objects exist, including managed packages). The Amount override by SBQQ__Quote__c.SBQQ__NetTotal__c is surfaced by `field-semantics`. SystemModstamp vs. LastModifiedDate and queryAll() for soft deletes are surfaced by `change-detection`. ForecastCategory/StageName independence and RecordTypeId filtering are surfaced by `lifecycle-and-state`. Territory2 with Named_Account_Tier__c is an entity question.

What about reconciliation (where SFDC numbers disagree with finance)? This is handled by `data-quality` with the expanded focus: "known quality issues including cross-system reconciliation points, tolerance levels, and source-of-truth resolution." What about managed package update impact? The `entities` focus override includes "managed package schema extensions and update impact."

**Risk assessment**: Low-to-medium. The merge of customizations into entities means managed package discovery happens through entity questions rather than dedicated package-focused questions. The risk is that the entities agent asks about custom objects in general terms and misses the specific "which standard fields does this package override?" probe. Mitigation: the entities focus override for source explicitly includes "managed package field overrides." The field-semantics agent independently asks "Is Opportunity.Amount the authoritative deal value, or does a CPQ tool write the real amount elsewhere?" -- double-covering the highest-risk failure mode.

### dbt on Fabric -- Platform Skill

Under my matrix (6 dimensions): `entities`, `platform-behavioral-overrides`, `config-patterns`, `version-compat`, `integration-orchestration`, `operational-failure-modes`.

This is identical to the proposed 23-dimension matrix for platform skills. I made no changes to platform dimensions because every platform addition carries high delta and the platform researcher already merged `api-patterns` and `deployment` into more focused dimensions. The merge strategy silently degrading on Fabric Lakehouse (`platform-behavioral-overrides`), ODBC Driver 18 requirement and threads throttling (`config-patterns`), adapter version pinning requirements (`version-compat`), Azure DevOps Service Principal permissions (`integration-orchestration`), and the 30-minute query timeout (`operational-failure-modes`) are all preserved.

**Risk assessment**: None. Platform is unchanged from the proposed matrix.

---

## Preemptive Defense: "Merging Loses Resolution"

The strongest argument against my position is that merging `customizations` into `entities` and `reconciliation` into `data-quality` loses research resolution -- a dedicated agent asks more targeted questions than a shared agent with a broader mandate.

I concede this is a real trade-off. A dedicated customizations agent would ask 5-8 questions exclusively about managed packages. An entities agent with customizations folded in asks 5-8 questions about entities, relationships, AND managed packages -- meaning 2-3 questions specifically about packages instead of 5-8.

But the consolidation agent compensates. The opus consolidation agent with extended thinking cross-references ALL dimension outputs (dynamic-research-dimensions.md, Section 1). When the entities agent mentions "Steelbrick CPQ creates SBQQ__Quote__c" and the field-semantics agent mentions "Amount is overridden by CPQ," the consolidation agent connects these and generates follow-up questions about package impact. This is exactly what extended thinking is for -- reasoning across incomplete information from multiple sources.

The counter-counter-argument: "If the consolidation agent can synthesize this, why not also drop field-semantics and lifecycle-and-state?" Because those dimensions have zero overlap with any neighbor. Field semantics (what does this field actually mean?) is functionally distinct from entities (what objects exist?). Lifecycle (how do records move through states?) is functionally distinct from both. The merge candidates I identified have demonstrable overlap acknowledged by the Stage 1 researchers themselves.

---

## Concrete Recommendations

1. **Adopt the 17-dimension matrix above.** Per-type counts: domain 5, data-engineering 7, platform 6, source 6.

2. **Merge `customizations` into `entities` for source type** by adding to the source focus override: "including installed managed packages, their schema extensions, standard field overrides, and package update impact on extraction pipelines."

3. **Merge `reconciliation` into `data-quality` for source type** by adding to the source focus override: "including cross-system reconciliation points where data should agree but doesn't, source-of-truth resolution, and tolerance levels for discrepancies."

4. **Drop `output-standards` as a research dimension.** Add a directive to the consolidation agent's prompt: "When synthesizing dimension outputs, explicitly extract and consolidate any output formatting, presentation standards, currency conventions, and drill-down hierarchy requirements mentioned across dimensions into the Output Standards template section."

5. **Keep `data-quality`/`quality-gates` as one shared agent** with type-specific focus overrides, matching the established pattern of `entities`.

6. **Do not touch platform dimensions.** The platform researcher's 6-dimension proposal is well-justified, with clean separation between behavioral overrides, config anti-patterns, version issues, integration, operational failures, and environment constraints.

7. **Validate the 17-dimension matrix against the template section coverage check.** Every template section must still have at least one primary dimension. The merges above preserve this: Reconciliation Rules is covered by data-quality (primary for source); Output Standards is covered by metrics, segmentation-and-periods, and modeling-patterns (secondary coverage, consolidation-synthesized).
