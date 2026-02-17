# Stage 1: Domain Skill Research Dimensions

> Divergent research output for domain skill type.
> Identifies all research dimensions needed when building a domain skill in the Skill Builder system.

---

## Context

**Skill type**: Domain (functional business domains -- e.g., sales pipeline analysis, supply chain, financial reporting)

**What domain skills contain**: Business entities and relationships, industry KPIs and metrics, business rules and regulatory constraints, modeling patterns for silver/gold layers.

**Known template sections** (from synthesis Section 6.2):
1. Metric Definitions
2. Materiality Thresholds
3. Segmentation Standards
4. Period Handling
5. Business Logic Decisions
6. Output Standards

**Bundle interaction contract** (source + domain pairs):
1. Field-to-Metric Mapping
2. Semantic Translation Rules
3. Data Quality Contract
4. Refresh and Timing Alignment

---

## Dimension Analysis

### 1. `entities` -- Entity & Relationship Research

| Field | Value |
|-------|-------|
| **Name** | Entity & Relationship Research |
| **Slug** | `entities` |
| **What it researches** | Surfaces the core business entities in the domain, their hierarchical and lateral relationships, cardinality patterns, and cross-entity analysis patterns. For domain skills specifically, this means understanding which business objects are modeled, how customer hierarchies work, what organizational relationships exist, and how entities interact in business processes. |
| **Template sections it informs** | Segmentation Standards, Business Logic Decisions, Output Standards |
| **Delta justification** | Claude knows generic entity models for common domains (e.g., Salesforce Opportunity-Account-Contact, or standard procurement PO-Invoice-Receipt). The delta is the *customer's specific* entity landscape: which entities matter for their analysis, non-obvious relationships (e.g., a territory hierarchy overlaid on account hierarchy), custom entities that don't exist in textbook models (e.g., Named_Account_Tier), and cardinality assumptions that drive join strategies. A senior data engineer joining the team needs to understand which entities to model and how they connect *in this organization*, not in theory. |
| **What goes wrong if skipped** | Without entity research, the skill assumes textbook entity relationships. For pipeline forecasting, this means missing that the customer has a territory-overlay model where opportunities roll up through both account hierarchy AND territory hierarchy, producing double-counted pipeline totals. Or missing that "Account" in their CRM is actually a billing entity while "Customer" (a custom object) is the commercial entity -- building models on the wrong grain. |
| **Example questions (sales pipeline analysis)** | |

1. "Which entities are central to your pipeline analysis? Standard opportunities, custom deal objects, or both? Do you track pipeline at the opportunity level, line-item level, or product-level?"
2. "How does your account hierarchy work for pipeline roll-ups? Single hierarchy, or overlapping hierarchies (e.g., account + territory + industry vertical)? Which hierarchy is primary for executive reporting?"
3. "Are there custom entities beyond the standard CRM model that affect pipeline analysis (e.g., named account tiers, customer segments, deal teams, partner objects)?"

---

### 2. `metrics` -- Metrics & KPI Research

| Field | Value |
|-------|-------|
| **Name** | Metrics & KPI Research |
| **Slug** | `metrics` |
| **What it researches** | Surfaces the specific metrics and KPIs the organization tracks, with emphasis on where calculation definitions diverge from industry standards. This dimension probes the exact formula parameters, inclusion/exclusion rules, and calculation nuances that differentiate a naive implementation from one matching the customer's actual definitions. |
| **Template sections it informs** | Metric Definitions, Materiality Thresholds, Output Standards |
| **Delta justification** | Claude knows textbook metric definitions (coverage = open pipeline / quota, win rate = won / (won + lost), velocity = deals x win rate x ACV / cycle time). The delta is every parameter within those formulas: Customer Beta targets 4.5x New Business / 2x Renewal against *forecast* not quota; their win rate excludes sub-$25K and sub-14-day deals; their velocity formula includes a custom discount impact factor. These customer-specific parameters cannot exist in training data. The synthesis showed that "approximately correct" metric defaults (like "3x coverage") are the *worst* failure mode because they survive review unchallenged but make every pipeline assessment wrong for every segment. |
| **What goes wrong if skipped** | Without metrics research, the skill encodes standard formulas with default parameters. Customer Beta's pipeline coverage analysis would use 3x as the target, which is wrong for both their New Business (4.5x) and Renewal (2x) segments. Win rate calculations would include deals that the customer explicitly excludes, producing a systematically higher number that gives false confidence. Every downstream analysis referencing these metrics inherits the error -- pipeline gap analysis, forecast accuracy, sales productivity -- compounding silently across all gold-layer outputs. |
| **Example questions (sales pipeline analysis)** | |

1. "What is your pipeline coverage target ratio? Is it a single number, or segmented by deal type (new business, expansion, renewal)? And what is the denominator -- quota, target, weighted forecast, or something else?"
2. "How do you calculate win rate? On count or deal value? Are there minimum thresholds for inclusion (minimum deal size, minimum days in pipeline)? Over what time period?"
3. "What other pipeline metrics do you track that have non-standard calculations? (e.g., velocity with custom modifiers, forecast accuracy with specific snapshot timing, ASP with product-line weighting)"

---

### 3. `business-rules` -- Business Rules Research

| Field | Value |
|-------|-------|
| **Name** | Business Rules Research |
| **Slug** | `business-rules` |
| **What it researches** | Surfaces the business rules that constrain how data should be modeled, transformed, and presented in the domain. This includes industry-specific regulatory requirements, organizational policies that override textbook logic, and judgment-laden rules that engineers without domain expertise commonly implement incorrectly. Unlike metrics (which are calculation formulas), business rules are conditional logic: "if X then Y, unless Z." |
| **Template sections it informs** | Business Logic Decisions, Materiality Thresholds, Segmentation Standards |
| **Delta justification** | Claude knows standard business rules at the textbook level (e.g., "deals that push past quarter close are flagged"). The delta is the customer's *actual* rule logic, which is always more nuanced: Customer Beta flags pushed deals but treats them differently by deal type (New Business deals get two pushes before removal; Renewal deals are never removed, just re-forecast). Customer Alpha's maverick spend has a $5K threshold *plus* a sole-source exception for safety-critical components -- a rule that no standard procurement framework includes. These rules are organizational decisions, often documented only in tribal knowledge or board presentations, not in any system Claude could have trained on. |
| **What goes wrong if skipped** | Without business rules research, the skill either omits conditional logic (producing incomplete models) or encodes textbook rules that contradict organizational policy. For pipeline forecasting: if the skill says "pushed deals are flagged and excluded after one slip" when the customer allows two slips for new business and never excludes renewals, every pipeline snapshot miscounts both segments. For procurement: if the skill applies a universal maverick-spend threshold without the sole-source exception, safety-critical procurement gets flagged as non-compliant in every report, generating noise that undermines trust in the entire compliance framework. |
| **Example questions (sales pipeline analysis)** | |

1. "How do you handle deals that slip past their expected close date? Are pushed deals flagged, excluded, or treated differently? Does this vary by deal type or size?"
2. "What rules govern co-sold or partner-influenced deals? Split credit, double-count, or some other attribution model? Does the rule differ for pipeline vs. bookings?"
3. "Are there regulatory or compliance rules that affect how pipeline data can be reported? (e.g., SOX requirements on forecast methodology, public company revenue recognition constraints on pipeline classification)"

---

### 4. `segmentation-and-periods` -- Segmentation & Period Handling Research

| Field | Value |
|-------|-------|
| **Name** | Segmentation & Period Handling Research |
| **Slug** | `segmentation-and-periods` |
| **What it researches** | Surfaces how the organization segments its business data for analysis and how it handles time-based logic. Segmentation includes customer tiers, deal types, geographic/vertical splits, and materiality thresholds for when segments matter. Period handling includes fiscal calendar definitions, snapshot cadence, point-in-time rules, and cross-period logic (what happens when deals slip across quarter boundaries). These two concerns are merged into a single dimension because they interact tightly: segmentation breakpoints often differ by reporting period (monthly vs. quarterly views), and period-handling rules vary by segment. |
| **Template sections it informs** | Segmentation Standards, Period Handling, Materiality Thresholds, Output Standards |
| **Delta justification** | Claude knows generic segmentation patterns (enterprise/mid-market/SMB, new/expansion/renewal) and standard fiscal calendars. The delta is: (a) the specific breakpoints for each segment dimension (Customer Beta's enterprise threshold: 500+ employees AND $1M+ ACV, not just one criterion), (b) which segments are primary vs. secondary for different reports, (c) the customer's fiscal calendar (4-4-5? Standard quarters? Non-January fiscal year start?), (d) snapshot timing relative to reporting cadence, and (e) cross-period rules that are always organizational decisions. The synthesis's pipeline forecasting case showed that the coverage target itself is segmented (4.5x/2x) -- without knowing the segmentation, even correct metric formulas produce wrong answers because they're applied at the wrong level. |
| **What goes wrong if skipped** | Without segmentation and period research, the skill applies flat analysis to data that the organization views in segments. Pipeline coverage at 3.2x looks healthy against a 3x target -- but split by segment, New Business is at 2.8x (well below their 4.5x target) while Renewal is at 4.1x (above their 2x target). The aggregate number hides a critical pipeline gap in the segment the organization cares most about. Period-handling errors are equally dangerous: if the skill counts pipeline using calendar quarters but the customer uses a 4-4-5 fiscal calendar, "Q1 pipeline" includes deals from weeks that the organization considers Q4 and misses deals from weeks they consider Q1. |
| **Example questions (sales pipeline analysis)** | |

1. "What are your primary segmentation dimensions for pipeline analysis? Deal type (new/expansion/renewal)? Customer size? Geographic region? Product line? Which combinations matter for executive reporting?"
2. "What is your fiscal calendar structure? Standard calendar quarters, or a different pattern (e.g., 4-4-5, non-January fiscal year)? How do pipeline snapshots align with fiscal periods?"
3. "How do you handle pipeline that crosses period boundaries? If a deal slips from Q1 to Q2, does it leave the Q1 pipeline view, or remain as a historical data point? Do you maintain point-in-time snapshots, and at what cadence?"

---

### 5. `modeling-patterns` -- Modeling Patterns Research

| Field | Value |
|-------|-------|
| **Name** | Modeling Patterns Research |
| **Slug** | `modeling-patterns` |
| **What it researches** | Surfaces the silver/gold layer modeling patterns appropriate for the business domain, including snapshot strategies, fact table granularity, dimension historization choices, and common modeling mistakes specific to this domain. This dimension focuses on *how* the domain's data should be structured in a lakehouse, not *what* the business metrics are (that's the metrics dimension) or *what* the business rules are (that's the business-rules dimension). |
| **Template sections it informs** | Business Logic Decisions, Output Standards, Metric Definitions |
| **Delta justification** | Claude knows Kimball methodology, star schemas, SCD types, and snapshot patterns from training data. The delta is domain-specific modeling decisions: for pipeline forecasting, should the fact table capture stage transitions (one row per stage change) or daily snapshots (one row per opportunity per day)? The answer depends on whether the customer does funnel-flow analysis (needs transitions) or point-in-time pipeline reporting (needs snapshots). Customer Beta needs both, which requires two fact tables at different grains with a shared dimension bus -- a design decision Claude cannot derive from generic modeling knowledge alone. The synthesis showed that "source field coverage decisions" are a key delta: which source fields should flow to silver, which should be promoted to gold, and which should be excluded entirely. |
| **What goes wrong if skipped** | Without modeling patterns research, the skill recommends generic star schemas without domain-specific grain decisions. For pipeline: building a single opportunity fact at daily-snapshot grain when the customer needs stage-transition analysis forces expensive self-joins to derive funnel flow metrics. Building at transition grain when they need point-in-time snapshots forces expensive window functions to reconstruct pipeline state. The wrong grain choice cascades through every downstream query, degrading performance and complexity. Incorrect field coverage decisions are equally harmful: omitting discount fields from the silver layer when the customer's velocity formula needs them requires re-extraction; including 200 custom fields when only 30 matter inflates storage and confuses consumers. |
| **Example questions (sales pipeline analysis)** | |

1. "What is the primary analytical use case for your pipeline data: point-in-time snapshot reporting (what did pipeline look like on date X?), funnel-flow analysis (how do deals move through stages?), or both? This determines the grain of your fact table(s)."
2. "Which source fields from your CRM should be included in the silver layer for pipeline analysis? All opportunity fields, or a curated subset? Are there custom fields that are critical for analysis but might not be obvious (e.g., discount fields, partner fields, territory assignments)?"
3. "How should your pipeline gold layer be structured: star schema with separate dimension tables, one-big-table for analyst self-service, or wide denormalized views? What consumption tools and patterns drive this choice (SQL analysts, BI tool, embedded analytics)?"

---

### 6. `output-standards` -- Output & Presentation Standards Research

| Field | Value |
|-------|-------|
| **Name** | Output & Presentation Standards Research |
| **Slug** | `output-standards` |
| **What it researches** | Surfaces the organization's requirements for how domain data should be formatted, labeled, and presented. This includes reporting currency conventions, number formatting rules, drill-down hierarchies, standard report layouts, chart conventions, and terminology standards. These decisions seem superficial but have modeling implications: a drill-down hierarchy requirement dictates dimension table design; a specific QBR format dictates which aggregate tables to pre-compute. |
| **Template sections it informs** | Output Standards, Segmentation Standards |
| **Delta justification** | Claude can produce generic output formatting guidance (use consistent currency, label axes, etc.). The delta is organization-specific standards that are arbitrary but mandatory: the CFO expects pipeline in the QBR to show a specific waterfall chart format with exact category labels ("Created," "Pulled In," "Pushed Out," "Won," "Lost," "Net Change"); the VP Sales expects pipeline coverage displayed as a heatmap by region x segment; finance requires all dollar amounts in USD with FX conversion at the first-of-month spot rate, not the transaction-date rate. These are organizational decisions encoded nowhere in public documentation. |
| **What goes wrong if skipped** | Without output standards research, the skill produces technically correct but organizationally unrecognizable outputs. The pipeline waterfall uses different category labels than the QBR template; currency conversion uses transaction-date rates instead of first-of-month rates, producing numbers that don't reconcile with finance's reports; drill-down dimensions are organized by product line when leadership expects region-first. The result is a technically sound pipeline model that nobody trusts because its outputs look different from the existing reports everyone is accustomed to. Engineers spend weeks reverse-engineering the "right" output format through trial and error. |
| **Example questions (sales pipeline analysis)** | |

1. "What standard report formats exist for pipeline analysis at your organization? (e.g., QBR deck format, weekly pipeline review, board-level summary) What are the expected visualizations and their exact category labels?"
2. "What currency and number formatting rules apply? Reporting currency? FX conversion timing (transaction date, period end, first of month)? Rounding rules for executive summaries vs. detail reports?"
3. "What drill-down hierarchy does your organization expect for pipeline analysis? Region -> Team -> Rep, or Product -> Segment -> Rep, or something else? Does this hierarchy change for different audiences?"

---

## Evaluation Against Existing Catalog

The existing dimension catalog in `dynamic-research-dimensions.md` assigns 4 dimensions to domain skills:

| Existing Dimension | Disposition in This Analysis | Rationale |
|-------------------|------------------------------|-----------|
| `entities` | **Retained as-is** | Universally needed. Business entity landscape is always customer-specific. |
| `metrics` | **Retained as-is** | Critical delta. Every metric parameter is customer-specific. Synthesis failure modes (coverage 3x vs 4.5x/2x, win rate exclusions) validate this dimension's necessity. |
| `business-rules` | **Retained as-is** | Conditional business logic is distinct from metric formulas and always requires customer input. |
| `modeling-patterns` | **Retained as-is** | Silver/gold modeling decisions are domain-specific and cannot be derived from generic Kimball knowledge. |

### New dimensions proposed:

| New Dimension | Rationale for Addition |
|--------------|----------------------|
| `segmentation-and-periods` | The existing catalog has no dimension that explicitly surfaces segmentation breakpoints and period-handling rules. These are currently implicit in `metrics` (the denominator question is a segmentation question) and `business-rules` (cross-period rules). But the synthesis showed these are the *most variable* aspects of domain skills: coverage targets are segmented, win rate exclusions are segmented, fiscal calendars are organizational, snapshot cadence is a distinct decision. Merging segmentation into metrics dilutes both dimensions. A dedicated dimension ensures these questions are asked directly. |
| `output-standards` | The existing catalog has no dimension researching how outputs should be formatted and presented. Output Standards is one of the 6 template sections, but no dimension is explicitly tasked with populating it. The modeling-patterns dimension touches on output indirectly (what gold tables to build), but doesn't probe organizational formatting conventions, report layouts, or terminology. Without a dedicated dimension, the consolidation agent must infer output requirements from other dimensions' outputs -- or the Output Standards template section remains generic. |

### Dimensions considered but rejected:

| Candidate | Reason for Rejection |
|-----------|---------------------|
| `regulatory-compliance` | Regulatory constraints are business rules. A separate dimension would always produce the same generic questions ("are you in a regulated industry?") regardless of the domain. The business-rules dimension already probes regulatory constraints within its scope. Splitting it out fails the "meaningfully different questions for different skill instances" test. |
| `data-quality-thresholds` | Materiality thresholds are embedded in metrics (what's the acceptable error rate for each KPI?) and business rules (what tolerance triggers investigation?). A standalone data-quality dimension for domain skills would overlap heavily with the source-type `data-quality` dimension and produce questions about data validation that belong in the source skill, not the domain skill. The domain skill's role is to specify what quality *means* for business metrics; the source skill ensures the data meets that standard. |
| `industry-benchmarks` | The synthesis explicitly concluded that "industry benchmark numbers should not be seeded" because they vary too much and create false anchoring. A dimension that researches industry benchmarks violates the delta principle: it surfaces knowledge Claude already has (standard benchmarks) while the customer-specific targets (which are the actual delta) are surfaced by the metrics dimension. |
| `cross-domain-interactions` | Some domains interact (e.g., pipeline forecasting affects revenue recognition). But this is handled by the bundle interaction contract when source + domain skills pair up, not by a standalone domain research dimension. The interactions are always specific to the skill pair, so a generic "cross-domain" dimension would produce the same questions every time. |
| `historical-context` | "How has this domain evolved at your organization?" -- surfaces context about past metric changes, organizational restructuring, etc. Rejected because the answers don't change the skill's design. A skill encodes current rules, not historical ones. Historical context that matters (e.g., "we changed our win rate definition 6 months ago and need both versions") surfaces naturally through the metrics and business-rules dimensions. |

---

## Bundle Interaction Considerations

Several domain dimensions produce knowledge directly relevant to the bundle interaction contract:

| Bundle Dimension | Domain Dimensions That Inform It |
|-----------------|--------------------------------|
| **Field-to-Metric Mapping** | `metrics` -- knowing the exact metric formula identifies which source fields are needed. `entities` -- knowing which entities are modeled identifies which source objects must be extracted. |
| **Semantic Translation Rules** | `metrics` -- "Amount means TCV in the source but the domain needs ARR" is a metric-definition question. `output-standards` -- currency conversion and formatting rules define how source values translate to domain outputs. |
| **Data Quality Contract** | `metrics` -- materiality thresholds define acceptable null rates and error tolerances per metric. `business-rules` -- business rules define what constitutes "valid" data for rule evaluation. |
| **Refresh and Timing Alignment** | `segmentation-and-periods` -- snapshot cadence and fiscal calendar rules determine when domain data must be refreshed relative to source extraction. |

The `segmentation-and-periods` dimension is particularly important for bundle interactions: if the domain skill specifies weekly pipeline snapshots but the source skill only extracts daily, the timing alignment section of the bundle contract needs to reconcile this. Without explicit period-handling research in the domain skill, this misalignment is invisible until production.

---

## Summary: Dimension-to-Template-Section Mapping

| Dimension | Metric Definitions | Materiality Thresholds | Segmentation Standards | Period Handling | Business Logic Decisions | Output Standards |
|-----------|--------------------|----------------------|----------------------|----------------|------------------------|-----------------|
| `entities` | | | X | | X | X |
| `metrics` | X | X | | | | X |
| `business-rules` | | X | X | | X | |
| `segmentation-and-periods` | | X | X | X | | X |
| `modeling-patterns` | X | | | | X | X |
| `output-standards` | | | X | | | X |

**Coverage check**: Every template section is informed by at least 2 dimensions. No template section is orphaned.

**Total: 6 dimensions** (up from 4 in the existing catalog).

---

## Final Dimension List

| # | Slug | Name | Template Sections |
|---|------|------|-------------------|
| 1 | `entities` | Entity & Relationship Research | Segmentation Standards, Business Logic Decisions, Output Standards |
| 2 | `metrics` | Metrics & KPI Research | Metric Definitions, Materiality Thresholds, Output Standards |
| 3 | `business-rules` | Business Rules Research | Business Logic Decisions, Materiality Thresholds, Segmentation Standards |
| 4 | `segmentation-and-periods` | Segmentation & Period Handling Research | Segmentation Standards, Period Handling, Materiality Thresholds, Output Standards |
| 5 | `modeling-patterns` | Modeling Patterns Research | Metric Definitions, Business Logic Decisions, Output Standards |
| 6 | `output-standards` | Output & Presentation Standards Research | Output Standards, Segmentation Standards |
