# Position Paper: Prune the Matrix Back Toward 14

The dimension explosion from 14 to 23 is a design smell that will degrade research quality, overwhelm the consolidation agent, and exhaust users with question volume. Nine of the proposed "new" dimensions are sub-questions of existing dimensions dressed up with their own agent slots. The consolidation agent -- opus with extended thinking -- exists precisely to perform the cross-referencing that fine-grained dimension splitting pre-empts. The right fix is deeper focus lines per dimension and a stronger consolidation pass, not more parallel agents producing thinner outputs.

---

## The Core Problem: Splitting Is Not the Same as Discovering Delta

The proposed matrix justifies new dimensions with two recurring arguments: (1) a template section previously had no dedicated researching dimension, and (2) the synthesis identified a failure mode not covered by an existing dimension. Both arguments confuse *coverage gaps in the existing dimension's focus lines* with *the need for new dimensions*.

Consider the source type. The proposal adds `change-detection` because "extraction covers HOW to pull data; change-detection covers WHAT to pull" (stage1-source.md). But the extraction dimension's refined focus already covers "CDC field selection (which timestamp field captures all changes), soft delete detection, parent-child change propagation gaps" (stage1-proposed-matrix.md, extraction entry). The proposed `change-detection` dimension researches the exact same failure modes: "SystemModstamp vs. LastModifiedDate, queryAll for soft deletes, WHO column CDC limitation" (stage1-proposed-matrix.md, change-detection entry). The justification for splitting rests on a semantic distinction -- HOW vs. WHAT -- that produces overlapping questions, not distinct delta.

The same pattern repeats across every type. The matrix document itself acknowledges significant overlaps in its "Overlap and Interaction Analysis" table (stage1-source.md): `entities` + `customizations` both ask about custom objects; `field-semantics` + `customizations` both surface field overrides; `extraction` + `change-detection` both relate to data extraction; `data-quality` + `reconciliation` both surface data issues. When 4 out of 6 new source dimensions have documented overlaps with existing ones, the dimension boundaries are wrong.

---

## Worked Example: Customer Beta -- Salesforce Source Skill (8 Dimensions)

Under the proposed matrix, the Salesforce source skill runs 8 parallel agents. Walk through what each produces for Customer Beta:

- **`entities`**: "Which managed packages inject custom objects? How do record types subdivide Opportunity?" Surfaces CPQ, Clari, Gong objects.
- **`customizations`**: "Which managed packages are installed? Which fields do they override?" Surfaces CPQ, Clari, Gong objects and their field overrides.
- **`field-semantics`**: "Does Amount mean ACV? Is ForecastCategory independently editable?" Surfaces Amount override by CPQ, ForecastCategory/StageName independence.
- **`lifecycle-and-state`**: "What are your stages? Can deals regress? Do record types have different progressions?" Surfaces ForecastCategory/StageName independence (again), RecordTypeId filtering.

Four agents independently surface overlapping facts about Customer Beta's CPQ and ForecastCategory behavior. The consolidation agent must deduplicate and cross-reference 4 agents' worth of overlapping content to produce questions that are already implicit in a well-focused `entities` agent (custom objects and departures from standard) and a well-focused `extraction` agent (CDC traps and field semantic gotchas).

With a pruned matrix of 5 dimensions -- `entities` (with customizations folded in), `extraction` (with change-detection folded in), `field-semantics`, `data-quality`, and `lifecycle-and-state` -- each agent covers more ground but produces less redundancy. The consolidation agent receives 5 coherent outputs instead of 8 overlapping ones. The user sees 18-22 questions instead of 30+.

---

## Worked Example: Customer Beta -- Pipeline Forecasting Domain Skill (6 Dimensions)

The domain type grows from 4 to 6 dimensions. The two additions are `segmentation-and-periods` and `output-standards`.

**`segmentation-and-periods`** researches "how the organization segments business data and handles time-based logic" (stage1-domain.md). The domain researcher's own justification says this content is "currently implicit in `metrics` and `business-rules`" but "the synthesis showed these are the most variable aspects of domain skills." Being the most variable is an argument for deeper focus lines in `metrics`, not for a standalone agent.

For Customer Beta: the coverage target is 4.5x New Business / 2x Renewal against forecast. The segmentation (New Business vs. Renewal) and the denominator (forecast vs. quota) are metric parameters -- they define what the coverage formula means. The `metrics` agent asking "What is your coverage target? Is it segmented by deal type? What is the denominator?" produces the same clarification question as a standalone `segmentation-and-periods` agent. The synthesis itself treats these as metric definition questions (synthesis Section 5.2: "Pipeline coverage formula: YOUR target ratio? By segment? Denominator = quota, target, or weighted forecast?").

**`output-standards`** researches "QBR waterfall chart categories, FX conversion timing, drill-down hierarchies" (stage1-domain.md). Apply the delta filter: would Claude produce correct clarification questions about output formatting without a dedicated research agent? Yes -- any competent research agent asking about the domain will naturally surface "How should outputs be formatted?" as part of its output. The `output-standards` dimension's example questions are generic across skill instances: "What standard report formats exist? What currency formatting rules apply? What drill-down hierarchy?" These questions do not change meaningfully from one domain skill to another, violating the granularity constraint. A procurement domain skill and a pipeline forecasting domain skill get effectively identical output-standards questions.

---

## Worked Example: dbt on Fabric -- Platform Skill (6 Dimensions)

The platform type grows from 4 to 6 dimensions. The platform researcher (stage1-platform.md) makes the strongest case for new dimensions because `platform-behavioral-overrides` and `operational-failure-modes` target genuine, high-delta content -- "docs say X, reality is Y" and "things that break at 2am."

But even here, the boundaries are porous. The platform researcher acknowledges: `config-patterns` and `platform-behavioral-overrides` overlap -- a configuration that "looks valid but fails in practice" is simultaneously a behavioral override (the platform behaves differently than expected) and a configuration anti-pattern. The proposed matrix document itself lists this as Open Question 5: "Are `config-patterns` and `platform-behavioral-overrides` overlapping?" (stage1-proposed-matrix.md, Section 6).

For dbt on Fabric: `threads: 16` causing throttling is listed as both a `config-patterns` example (stage1-platform.md, Section 2) and relates to behavioral overrides (Fabric behaves differently than Snowflake for the same config). The `dispatch` override for `dbt_utils` is listed under `config-patterns` but is also a behavioral override (default macro implementations silently produce wrong SQL on Fabric). The two dimensions produce overlapping content about the same Fabric-specific gotchas.

A single `platform-delta` dimension with a focus line covering "behavioral deviations, dangerous configurations, and undocumented failure modes" would surface the same content without the overlap. The current `api-patterns` + `integration` + `deployment` trio from the existing catalog was correctly diagnosed as too broad and unfocused -- but the fix is to replace them with 2 focused dimensions (platform-delta + integration-orchestration), not 5 (behavioral-overrides + config-patterns + version-compat + integration-orchestration + operational-failure-modes).

---

## The Consolidation Agent Bottleneck

The architecture document (dynamic-research-dimensions.md, Section 1) states: "All dimensions run in parallel. The opus consolidation agent with extended thinking handles cross-referencing and reasoning across dimension outputs." The consolidation agent's job is to "cross-reference findings across dimensions, identify contradictions or gaps between dimension outputs, reason about question ordering and dependencies."

At 8 parallel agents (source type), each producing 5-8 questions, the consolidation agent receives 40-64 raw questions. The synthesis (Section 6.1) showed that even with 8 procedural annotations, the "right" number of clarification questions per skill is roughly 15-25 -- meaning the consolidation agent must collapse 40-64 questions down to 15-25. When half the inputs are overlapping (as demonstrated above), the consolidation agent spends its extended thinking budget on deduplication rather than on the cross-referencing and synthesis that is its actual value-add.

The DE researcher (stage1-data-engineering.md) anticipated this: "the consolidation agent (opus with extended thinking) is critical for data-engineering skills because the pattern interaction dimension's output must be cross-referenced with every other dimension." At 7 dimensions with dense cross-references (pattern-interactions constrains load-merge-patterns, entities drives historization, historization affects layer-design, quality-gates reflects load-merge-patterns AND historization), the consolidation agent is doing the heavy lifting regardless. Adding more dimensions doesn't help the consolidation agent -- it buries it under more inputs to reconcile.

---

## The User Burden

The synthesis (Section 5.2) proposed that domain discovery sessions take "30-45 min guided extraction using templates" with 6 template sections. At 6 dimensions producing 5-8 questions each, the consolidation agent must produce a clarifications file that the user reviews and answers. More dimensions means more questions, which means longer review cycles and higher abandonment risk.

The architecture (vibedata-architecture.md, Section 6.2.4) positions skills as "domain memory" with a continuous improvement flywheel via the Retro Agent. Skills are not built once -- they iterate. Capturing 80% of the delta in the first research pass with a tighter dimension set, then iterating via the Retro Agent, is better than attempting 100% coverage in a single exhausting research pass.

---

## Preemptive Defense: Template Section Coverage

The strongest argument for expansion is template section coverage: "Output Standards is one of the 6 domain template sections but no existing dimension populates it" (stage1-proposed-matrix.md). This is a real gap. But the fix need not be a new dimension.

The consolidation agent can explicitly check template section coverage as part of its consolidation pass. If the `metrics` and `business-rules` agents produce no questions about output formatting, the consolidation agent -- which knows the template sections -- can inject a synthesized question. This is a 3-line prompt addition to the consolidation agent, not a new parallel research agent.

Similarly, for source skills: the `State Machine and Lifecycle` template section had no researching dimension. But `lifecycle-and-state` content (stage progressions, RecordTypeId filtering, ForecastCategory independence) overlaps heavily with `entities` (record type subdivisions) and `field-semantics` (independently editable field pairs). A focus line addition to `entities` ("Include record type lifecycle variations and state machine behaviors") plus a consolidation-agent template section check achieves the same coverage without a new agent.

---

## Concrete Recommendations

### 1. Hold the domain type at 5 dimensions (one net addition)

Retain `entities`, `metrics`, `business-rules`, `modeling-patterns`. Add `segmentation-and-periods` only if the planner cannot inject segmentation-specific focus lines into `metrics` -- test this empirically before committing to a new dimension. Remove `output-standards` -- add a template-section coverage check to the consolidation agent instead.

### 2. Hold the data-engineering type at 7 dimensions (status quo from DE researcher)

The DE researcher's proposal (stage1-data-engineering.md) is the best-justified expansion: splitting `pipeline-patterns` into `pattern-interactions` + `load-merge-patterns` is warranted because the interaction knowledge is genuinely different from implementation knowledge. The `operational-patterns` addition covers day-2 concerns that are genuinely distinct. Accept the DE researcher's proposal as-is.

### 3. Prune the platform type to 4 dimensions (net zero)

Merge `platform-behavioral-overrides` + `config-patterns` + `operational-failure-modes` into a single `platform-delta` dimension with a comprehensive focus line: "behavioral deviations from documentation, dangerous configuration combinations, and production failure modes." Retain `version-compat` (genuinely distinct version-interaction knowledge). Retain `integration-orchestration`. Retain `entities`. This gives 4 dimensions: `entities`, `platform-delta`, `version-compat`, `integration-orchestration`.

### 4. Prune the source type to 6 dimensions (one net addition)

Merge `change-detection` back into `extraction` (the refined extraction focus already covers CDC traps). Merge `customizations` into `entities` (both ask about custom objects; `entities` with a "managed package impact" focus line covers this). Retain `field-semantics` (genuine restructuring from `schema-mapping`). Retain `lifecycle-and-state` (fills a real template section gap). Retain `reconciliation` (fills a real template section gap). Retain `data-quality`. This gives 6 dimensions: `entities`, `extraction`, `field-semantics`, `lifecycle-and-state`, `reconciliation`, `data-quality`.

### 5. Add template-section coverage checking to the consolidation agent

Add a prompt section to the consolidation agent: "Before finalizing, verify that every template section for this skill type has at least one clarification question. If any section is uncovered, synthesize a question from adjacent dimension outputs." This costs 0 additional agents, 0 additional wall time, and closes coverage gaps without dimension proliferation.

### Result: 22 total dimensions reduced to ~17

| Type | Proposed | Pruned | Change |
|------|----------|--------|--------|
| domain | 6 | 5 | -1 |
| data-engineering | 7 | 7 | 0 |
| platform | 6 | 4 | -2 |
| source | 8 | 6 | -2 |
| **Total unique** | **23** | **~17** | **-6** |

This preserves the genuine delta discoveries (pattern-interactions for DE, lifecycle-and-state for source, version-compat for platform) while eliminating dimensions whose content is better produced by focused existing agents plus a stronger consolidation pass. Quality comes from depth per dimension, not breadth of dimensions.
