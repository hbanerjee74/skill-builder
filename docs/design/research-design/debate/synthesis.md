# Synthesis: Research Dimension Matrix Debate

---

## 1. Debate Arc

**Maximalist: 23 dimensions → 18 dimensions.**
Started as the strongest defender of the full proposed matrix, arguing every dimension passes the delta filter and the consolidation agent benefits from sharper inputs. By Round 2, conceded the largest revision of any agent: operational-failure-modes has "porous boundaries" with its three neighbors and should be distributed across them, and single-pass consolidation "struggles with deduplication at 6-8 dimension inputs." The Economist's pairwise interaction math and the Purist's deduplication observation were the primary catalysts. The movement is genuine -- the Maximalist abandoned their signature claim that "the consolidation agent benefits from more inputs" in favor of "the consolidation architecture should change."

**Purist: ~17 dimensions → ~18 dimensions.**
Started with the most aggressive pruning (platform-delta mega-dimension at 4 platform dims, prune source from 8 to 6). By Round 2, reversed on the platform-delta proposal -- conceding operational-failure-modes is "categorically distinct" after the Maximalist's dbt-on-Fabric walkthrough proved that "2am failure" knowledge is functionally different from docs-vs-reality deviations. Also reversed on consolidation: moved from "fewer dimensions to protect the consolidation agent" to "two-stage consolidation to protect the consolidation agent." The movement shows genuine engagement -- the Purist acknowledged that their core claim ("more inputs overwhelm consolidation") confused input count with input overlap.

**Hybrid: 17 dimensions → 16 dimensions.**
Started as the most balanced position, accepting high-delta additions while merging overlapping ones. By Round 2, refined rather than reversed: dropped modeling-patterns from the matrix (Economist's rubric exposed it as weaker than argued), and proposed merging version-compat into config-patterns as a new T4 resolution. Introduced the most concrete architectural proposal: two-pass consolidation with semantic clustering (schema cluster + pipeline cluster for source skills). The Hybrid's movement was the smallest because their Round 1 position was closest to the emerging consensus.

**Economist: 19 dimensions → 18 dimensions.**
Started with the most rigorous analytical framework (4-factor binary rubric) applied to all 23 dimensions. By Round 2, added a fifth factor (F5: Consolidation Separability) after the user's T3 decision revealed a rubric gap -- the rubric measured research-side value but not consolidation-side cost. Used the expanded rubric to justify merging version-compat into config-patterns (version-compat scores 3/5 under the revised rubric). Uniquely among the four agents, argued that two-stage consolidation is NOT needed at 5-6 dimensions per type. The Economist's movement was analytically driven: every position change traces to a rubric score update.

---

## 2. Convergence Map

**Convergence 1: The matrix should contain 18 unique dimensions, not 23 or 14.**
All agents converged within the 16-18 range by Round 2. Maximalist landed at 18 (down from 23), Purist at ~18 (up from ~17), Hybrid at 16, Economist at 18. The Purist's Round 2 acceptance of post-resolution counts ("accept post-resolution counts: domain 5, DE 6, source 6, platform 5 = ~18 unique") brought them into alignment. The remaining 2-dimension gap between Hybrid (16) and the others (18) stems from dimension-counting differences across types, not fundamental disagreement.

**Convergence 2: Platform skills need exactly 5 dimensions.**
All four agents independently arrived at 5 platform dimensions in Round 2, despite starting at 4 (Purist), 6 (Maximalist, Hybrid, Economist). The convergence is on count, not composition -- see Residual Disagreement 1 for which merge.

**Convergence 3: output-standards should be dropped as a research dimension.**
Unanimous after the user's T1 decision. Economist scored it 2/4 in Round 1. Purist argued it belongs to consolidation. Hybrid and Maximalist accepted. The consolidation agent handles output-format questions as a synthesis task. No agent contested this in Round 2.

**Convergence 4: customizations merges into field-semantics, not entities.**
User's T2 decision overrode both the Purist (who proposed merging into entities) and the Hybrid (who also proposed entities). By Round 2, all four agents accepted the field-semantics merge. The Economist had originally recommended this exact merge (score 1/4, merge into field-semantics). The rationale: field-semantics already asks "What does this field actually mean?" -- adding "Which managed packages modify these fields?" is a natural scope expansion.

**Convergence 5: change-detection merges into extraction.**
User's T3 decision overrode the Maximalist, Hybrid, and Economist, all of whom scored change-detection at 4/4. The Purist's Round 1 argument proved decisive: "extraction covers HOW to pull data; change-detection covers WHAT to pull -- but both produce overlapping questions about CDC mechanisms." The Economist's Round 2 analysis added F5 justification: "extraction and change-detection produce overlapping content about data extraction gotchas that the consolidation agent must reconcile." All agents accepted.

**Convergence 6: operational-patterns merges into load-merge-patterns.**
Unanimous. The Economist scored operational-patterns at 2/4 in Round 1 and recommended this exact merge. The load-merge dimension expands to include "failure recovery, backfill strategies, and schema evolution handling."

**Convergence 7: reconciliation stays standalone.**
User's T6 decision confirmed the Maximalist and Economist positions (both scored reconciliation at 3/4 or higher). The Hybrid conceded in Round 2: "I accept reconciliation as standalone (T6 resolved against me)." Template section coverage drives this -- Reconciliation Rules loses its only primary dimension if reconciliation merges into data-quality.

**Convergence 8: Per-type counts are domain 5, DE 6, source 6.**
All four agents agree on these three type counts by Round 2. Domain: entities, metrics, business-rules, segmentation-and-periods, modeling-patterns. DE: entities, pattern-interactions, load-merge-patterns (expanded), historization, layer-design, quality-gates. Source: entities, extraction (expanded), field-semantics (expanded), lifecycle-and-state, reconciliation, data-quality.

**Convergence 9: The consolidation agent is the quality bottleneck, not the research agents.**
All four agents explicitly state this. Maximalist: "The problem is not the number of dimensions -- it is the consolidation architecture." Purist: "A single consolidation agent has a scaling ceiling." Hybrid: "The consolidation architecture is the actual quality bottleneck." Economist: "Protect the consolidation agent's reasoning budget by giving it focused, non-overlapping inputs." The debate's central insight is that dimension count is a lever on consolidation quality, not research quality.

---

## 3. Residual Disagreements

### Disagreement 1: Which platform merge achieves 5 dimensions

**The disagreement:** All four agents agree on 5 platform dimensions but propose three different merges to get there.

- **Hybrid + Economist (majority):** Merge version-compat into config-patterns. Result: entities, platform-behavioral-overrides, config-patterns (expanded to include version-dependent configuration constraints), integration-orchestration, operational-failure-modes.

- **Purist:** Merge behavioral-overrides + config-patterns into platform-behavioral-delta. Result: entities, platform-behavioral-delta, version-compat, integration-orchestration, operational-failure-modes.

- **Maximalist:** Distribute operational-failure-modes across its neighbors. Result: entities, platform-behavioral-overrides (expanded), config-patterns (expanded), version-compat, integration-orchestration.

**Evidence favoring the Hybrid/Economist merge:**
1. The Economist's F5 (Consolidation Separability) analysis: version-compat scores 3/5 because "the dbt-fabric adapter version requirement for incremental materialization is simultaneously a version-compat finding AND a config-patterns finding." This is the strongest analytical case.
2. The Economist's reference case attack: all three version-compat dbt-on-Fabric items (adapter v1.6+ for incremental, ODBC Driver 18 requirement, dbt-core 1.5 vs. 1.7 advice mixing) "surface naturally through an expanded config-patterns agent."
3. version-compat was the Economist's original 3/4 score with overlap flagged -- the weakest of the 6 platform dimensions.

**Evidence favoring the Purist's merge:**
1. The Purist's dbt-on-Fabric walkthrough: `threads: 16` throttling "is simultaneously a config anti-pattern AND a behavioral override." The boundary between docs-vs-reality and valid-but-wrong is genuinely porous.
2. "A senior engineer asking 'What does Fabric do differently?' and 'Which configs are dangerous on Fabric?' is conducting one investigation, not two."

**Evidence against the Maximalist's merge:**
1. The Purist conceded in Round 2 that operational-failure-modes is "categorically distinct" -- reversing their Round 1 position that it should merge. Three of four agents now defend its independence.
2. The Maximalist's proposal distributes operational-failure-modes items across three different dimensions, losing the coherent "what breaks at 2am" research question.

**Type:** Empirical. Testable by running both platform configurations (Hybrid/Economist vs. Purist) on the dbt-on-Fabric case and comparing question overlap between behavioral-overrides and config-patterns (Purist's concern) against overlap between version-compat and config-patterns (Hybrid/Economist's concern).

**Weight of evidence:** Hybrid/Economist merge is better supported. 2 of 4 agents, strongest rubric analysis, and the weakest dimension (version-compat at 3/4) is the merge target rather than two dimensions that both scored 4/4.

### Disagreement 2: Whether two-stage consolidation is needed at current dimension counts

**The disagreement:** Three agents (Maximalist, Purist, Hybrid) propose two-stage consolidation (sonnet cluster dedup → opus synthesis). One agent (Economist) argues single-agent consolidation remains optimal at 5-6 dimensions per type.

- **Pro two-stage** (Maximalist, Purist, Hybrid): Even at 6 dimensions, within-cluster deduplication (entities/field-semantics overlap, data-quality/reconciliation adjacency) is "real work that the opus agent should not waste thinking budget on" (Purist). The sonnet pre-pass costs ~$0.05 and ~4 seconds. The opus agent's extended thinking concentrates on cross-cluster synthesis instead of deduplication.

- **Anti two-stage** (Economist): "The bottleneck is not pairwise interactions, it is context coherence." Splitting consolidation splits the mental model. "At 5-6 dims per type, single-agent consolidation is well within capacity." The threshold for split consolidation is ~8+ dims per type. "The dimension count should be set by research quality (rubric), not consolidation architecture."

**Evidence favoring two-stage:**
1. All agents observe that deduplication and synthesis are distinct cognitive tasks. The Hybrid's cluster proposal (schema cluster + pipeline cluster for source) is concrete and well-reasoned.
2. Cost is negligible: $0.04-0.06 and ~4 seconds of added latency.
3. The Maximalist's concession is notable -- the agent most committed to "more dimensions = better consolidation input" concluded the architecture needs fixing.

**Evidence favoring single-agent:**
1. The Economist's coherence argument: "Two consolidators each see half the picture and must reconstruct cross-cluster insights during merge." The merge pass becomes the new bottleneck.
2. At 5-6 dimensions, 15 pairwise interactions is well within opus extended-thinking capacity.
3. Introducing architectural complexity (cluster definitions, merge-pass coordination) for a problem that may not exist at current dimension counts adds maintenance burden.

**Type:** Empirical. Directly testable by running both architectures on the same skill build and comparing clarifications.md quality scores.

**Resolution path:** The Economist's position is the pragmatic default -- don't fix what isn't broken. Two-stage consolidation is a validated fallback if single-agent consolidation degrades as dimension count or skill complexity increases. Build the single-agent path first, instrument it for quality measurement, and trigger the two-stage path based on empirical consolidation quality data.

### Disagreement 3: Whether modeling-patterns justifies its seat for domain skills

**The disagreement:** Not surfaced as a debate thread, but visible in the scores. The Economist scored modeling-patterns at 2/4 (no primary template section, no orphan prevention). The Hybrid's Round 2 matrix drops it to arrive at 16 dimensions. The Maximalist, Purist, and Economist retain it.

- **Keep** (Maximalist, Purist, Economist): The domain researcher's "stage-transition grain vs. daily-snapshot grain" decision is substantive for Customer Beta. The Economist flagged it as a "judgment call" and retained it despite the 2/4 score.

- **Drop** (Hybrid): Implicitly dropped in the Hybrid's 16-dimension Round 2 matrix (domain stays at 5 but the Hybrid's Round 2 shows domain: 5 with modeling-patterns included, so actually this may be retained). On closer reading, the Hybrid's Round 2 matrix at line 105 includes `modeling-patterns` under domain. So this disagreement may be smaller than initially apparent.

**Type:** Values-based. Depends on how heavily you weight the Economist's rubric (F1/F4 failures) against the domain researcher's grain-decision case.

**Resolution:** Retain. Three of four agents keep it. The grain-decision content is genuinely distinct from metrics and business-rules. The 2/4 rubric score reflects the rubric's limitations (no primary template section for modeling patterns) more than the dimension's value.

---

## 4. Decision Framework

The Economist's 5-factor rubric, as revised in Round 2, survived the debate as the strongest analytical tool. The Purist's consolidation concerns are addressed by F5 (Consolidation Separability), added specifically because the user's T3 decision exposed the rubric's original blind spot.

### Revised 5-Factor Rubric (post-debate)

| Factor | Question | Score 1 if... | Debate Validation |
|--------|----------|---------------|-------------------|
| **F1: Primary Template Target** | Is this dimension the primary populator of at least one template section? | Yes | Validated by T1 (output-standards failed F1 defense), T6 (reconciliation passed due to Reconciliation Rules section) |
| **F2: Concrete Failure Mode** | Does the delta justification cite a specific, worked failure scenario? | Yes | Validated across all reference cases. The Maximalist's dimension-by-dimension walkthrough and the Economist's rubric application both rely on concrete failures, not abstract risk categories |
| **F3: Question Differentiation** | Do this dimension's questions differ meaningfully from every adjacent dimension? | Yes | The most contested factor. T3 resolution showed that semantic distinction (HOW vs. WHAT) does not guarantee operational separability. The Economist's Round 2 revision: "semantic distinction does not guarantee operational separability" |
| **F4: Orphan Prevention** | Would removing this dimension leave a template section with no primary? | Yes | Validated by T6 (reconciliation keeps its seat because Reconciliation Rules needs a primary) |
| **F5: Consolidation Separability** | Can the consolidation agent process this dimension's output without deduplicating against an adjacent dimension? | Yes | Added in Round 2. Validated by T3 (change-detection/extraction overlap) and T4 (version-compat/config-patterns overlap). This factor captures the consolidation-side cost the original 4-factor rubric missed |

**Threshold: 4 of 5.** Scoring 3/5 triggers merge candidacy. Scoring 2/5 triggers drop consideration.

**Limitations acknowledged by debate:**
- F1 depends on template section definitions. Platform and DE template structures are newly proposed and unvalidated.
- F4 is binary and can be gamed by defining template sections to match dimensions. The Purist flagged this: "If you define a template section for every dimension, every dimension passes F4."
- F5 requires judgment about what constitutes "significant deduplication." The Economist's application to change-detection (F5=0 due to extraction overlap) was validated by the user's T3 decision, but the threshold is subjective.

### Rubric Application Summary (all 18 surviving dimensions)

| Dimension | F1 | F2 | F3 | F4 | F5 | Total | Status |
|-----------|:--:|:--:|:--:|:--:|:--:|:-----:|--------|
| entities | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| metrics | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| business-rules | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| segmentation-and-periods | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| modeling-patterns | 0 | 1 | 1 | 0 | 1 | 3/5 | Keep (judgment) |
| pattern-interactions | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| load-merge-patterns | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| historization | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| layer-design | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| quality-gates / data-quality | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| platform-behavioral-overrides | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| config-patterns (expanded) | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| integration-orchestration | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| operational-failure-modes | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| extraction (expanded) | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| field-semantics (expanded) | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| lifecycle-and-state | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |
| reconciliation | 1 | 1 | 1 | 1 | 1 | 5/5 | Keep |

---

## 5. Reference Case Application

### Case 1: Customer Beta -- Pipeline Forecasting Domain Skill (5 dimensions)

| Dimension | Score | Reasoning |
|-----------|-------|-----------|
| entities | 5/5 | Opportunity-Account-Territory2 relationships including custom Named_Account_Tier__c. Surfaces Clari, CPQ entity landscape |
| metrics | 5/5 | Coverage denominator is forecast not quota, 4.5x/2x by segment, win rate excludes sub-$25K and sub-14-day, velocity includes discount impact factor |
| business-rules | 5/5 | Non-linear stage-to-forecast-category mapping varies by record type, pushed-deal handling differs by deal type |
| segmentation-and-periods | 5/5 | New Business vs. Renewal segmentation breakpoints, fiscal calendar alignment, snapshot cadence |
| modeling-patterns | 3/5 | Stage-transition grain vs. daily-snapshot grain choice. Genuine but less critical than metrics or segmentation |

**Assessment:** 5 dimensions produce strong coverage. The dropped output-standards content (QBR waterfall, FX conversion) surfaces through metrics ("How do you present coverage?"), segmentation ("What reporting hierarchy?"), and consolidation-agent synthesis. Risk is low -- the Economist estimated 70% of output-standard content is inferable from adjacent dimensions, with the remaining 30% addressable in Detailed Research (Step 3).

### Case 2: Customer Beta -- Salesforce Source Skill (6 dimensions)

| Dimension | Score | Reasoning |
|-----------|-------|-----------|
| entities | 5/5 | SBQQ__Quote__c, Clari forecast fields, Gong activity objects, Territory2. The expanded focus ("including managed packages") covers what customizations would have surfaced |
| extraction (expanded) | 5/5 | Bulk API governor limits + CDC mechanisms (SystemModstamp vs. LastModifiedDate, queryAll for soft deletes). The merged change-detection content fits naturally |
| field-semantics (expanded) | 5/5 | Amount override by CPQ, ForecastCategory/StageName independence. The merged customizations content ("Which managed packages modify which fields?") adds 1-2 questions |
| lifecycle-and-state | 5/5 | RecordTypeId filtering, stage progressions varying by record type, deal regression rules |
| reconciliation | 5/5 | SFDC-vs-Clari-vs-finance discrepancies, source-of-truth resolution. Standalone per T6 |
| data-quality | 4/5 | Known org-specific quality issues, unreliable fields. Retained at zero marginal cost (shared agent with DE) |

**Assessment:** 6 dimensions achieve full template section coverage. The two merges (customizations → field-semantics, change-detection → extraction) work because both receiving dimensions had natural scope to absorb the content. The Hybrid's Round 2 Salesforce walkthrough demonstrates this concretely: the schema cluster (entities, field-semantics, lifecycle-and-state) catches CPQ/ForecastCategory overlaps, the pipeline cluster (extraction, data-quality, reconciliation) distinguishes unreliable fields from disagreeing systems.

**Risk:** The Maximalist's original concern -- that merging customizations into field-semantics loses the dedicated "managed package inventory" question -- is mitigated by the entities dimension asking "Which managed packages are installed?" and field-semantics asking "Which fields have been overridden by packages?" The highest-risk failure mode (CPQ overriding Amount) is double-covered.

### Case 3: dbt on Fabric Platform Skill (5 dimensions)

| Dimension | Score | Reasoning |
|-----------|-------|-----------|
| entities | 5/5 | Lakehouse vs. Warehouse resource types, endpoint dependencies, environment distinctions |
| platform-behavioral-overrides | 5/5 | merge degradation on Lakehouse, datetime2 precision failures, endpoint-dependent SQL features. "Docs say X, reality is Y" |
| config-patterns (expanded) | 5/5 | threads throttling, ODBC Driver 18 requirement, dispatch overrides + version-dependent configuration constraints (adapter v1.6+ for incremental, dbt-core 1.5 vs. 1.7 advice mixing) |
| integration-orchestration | 5/5 | Azure DevOps Service Principal authentication, CI/CD patterns, concurrent run coordination |
| operational-failure-modes | 5/5 | 30-minute unconfigurable query timeout, metadata lock contention, environment-specific test error formats. "What breaks at 2am" |

**Assessment:** The version-compat merge into config-patterns works cleanly for this case. The Economist's analysis is confirmed: all three version-compat items surface naturally when config-patterns asks "Which adapter version are you running, and which materialization strategies does it support?" The remaining 4 standalone dimensions each have distinct, non-overlapping research questions with clean boundaries.

**Risk:** The Purist's concern about behavioral-overrides/config-patterns porosity (threads: 16 is both a config anti-pattern AND a behavioral override) is real but manageable. The F5 test: can the consolidation agent process behavioral-overrides output and config-patterns output without significant deduplication? Yes -- "docs say X, reality is Y" findings (merge degradation, datetime2 precision) are categorically different from "valid YAML, wrong semantics" findings (threads throttling, dispatch overrides). The threads: 16 edge case appears in both but from different research angles. One overlap case does not justify merging two dimensions that otherwise produce differentiated content.

---

## 6. Concrete Recommendations

### Do fully

**Adopt the 18-dimension matrix with per-type counts: domain 5, DE 6, platform 5, source 6.**
All four agents converge within this range. The 5 resolved thread decisions (T1, T2, T3, T5, T6) are unanimous. The Economist's cost estimate: $0.65/research step (down from $0.85 at 23 dimensions, up from $0.50 at 14). Maximalist agrees (18 dims). Purist agrees (~18 dims). Hybrid arrives at 16 (2 fewer due to dimension-counting differences). Economist agrees (18 dims).

**Merge version-compat into config-patterns for platform skills.**
Hybrid and Economist both propose this; it has the strongest analytical backing (F5 failure, 3/5 rubric score, all version-compat items surface through expanded config-patterns). The Purist's alternative (merging behavioral-overrides + config-patterns) sacrifices two 4/4-scoring dimensions to save a 3/4-scoring one. The Maximalist's alternative (dissolving operational-failure-modes) was rejected by 3 of 4 agents.

**Adopt the Economist's 5-factor rubric as the dimension inclusion gate.**
The rubric predicted or explained every resolved thread outcome. F5 (added in Round 2) closes the original rubric's blind spot. Re-score after the first 5 skill builds with empirical overlap data.

### Do partially / conditionally

**Implement two-stage consolidation as an optional architecture, not the default.**
Three agents propose it, one opposes it, and the cost is negligible ($0.05, 4 seconds). The Economist's coherence argument -- splitting consolidation splits the mental model -- is valid at current dimension counts (5-6 per type). The two-stage architecture should be built and benchmarked but activated based on empirical consolidation quality data, not adopted by default.

Conditions for activation: if single-agent consolidation produces measurable deduplication artifacts (questions that restate the same finding from different dimensions) in >30% of skill builds, switch to two-stage. The Hybrid's cluster proposal (schema cluster + pipeline cluster for source) provides the concrete implementation pattern.

**Retain modeling-patterns for domain skills despite the 3/5 rubric score.**
Three of four agents keep it. The grain-decision content (stage-transition vs. daily-snapshot) is genuinely distinct from metrics and business-rules. But if empirical data shows modeling-patterns questions consistently overlap with metrics questions, merge it. The Economist correctly flags this as "a judgment call."

### Avoid

**Avoid the Purist's platform-behavioral-delta mega-merge (behavioral-overrides + config-patterns).**
The dbt-on-Fabric case demonstrates that "docs say X, reality is Y" and "valid YAML, wrong semantics" are two distinct research questions. The threads: 16 edge case creates porosity but does not justify merging two dimensions that both scored 4/4 individually.

**Avoid dissolving operational-failure-modes across its neighbors (Maximalist's Round 2 proposal).**
Three agents (Purist, Hybrid, Economist) explicitly defend operational-failure-modes as standalone. The Purist's Round 2 concession is the strongest evidence: the agent most committed to merging platform dimensions reversed because "the 30-minute unconfigurable query timeout, metadata lock contention, and test error format differences are production-incident knowledge" categorically distinct from behavioral deviations or config anti-patterns.

**Avoid single-consolidation-agent as the permanent architecture.**
Even the Economist, who argues single-agent is sufficient now, acknowledges "the threshold where split consolidation becomes cost-effective is approximately 8+ dims per type." Building only the single-agent path creates technical debt. The two-stage architecture should be built alongside, even if not activated by default.

### Needs more data

**Whether the extraction (expanded) dimension produces focused enough questions after absorbing change-detection.**
The user's T3 decision was the most contentious -- three of four agents scored change-detection at 4/4. The merge is directionally correct (F5 overlap with extraction), but the expanded extraction dimension now covers both HOW to pull data and WHAT changed. If extraction agents in practice produce unfocused questions that mix API method selection with CDC field selection, the merge should be revisited.

Test: Run 5 source skill builds. Score extraction questions for focus (1-5). If average focus score drops below 3.5, re-split change-detection.

**Whether the consolidation agent can synthesize output-standards content from adjacent dimensions.**
The Economist estimates 70% is inferable, 30% is not. The Purist proposed adding template-section coverage checking to the consolidation agent. This is testable: run 5 domain skill builds without output-standards, score the Output Standards template section for completeness. If completeness drops below 80%, add output-standards back.

**Optimal cluster definitions for two-stage consolidation.**
The Hybrid proposes source clusters: {entities, field-semantics, lifecycle-and-state} + {extraction, data-quality, reconciliation}. The Purist proposes: {entities, field-semantics, lifecycle-and-state} + {extraction, change-detection} + {data-quality, reconciliation}. With change-detection merged into extraction, both converge. But the cluster boundaries need empirical validation -- are the cross-cluster interactions (e.g., entities finding interacting with extraction finding) low enough that the merge pass handles them without quality loss?

---

## 7. Prioritized Action List

### Phase 1: Implement the validated matrix

1. **Finalize the 18-dimension matrix in `final-dimensions.md`.**
   Why: All debate outputs converge on this count. No further debate needed.
   Dependencies: None.
   Decision point: If downstream implementation reveals a dimension that consistently produces zero useful questions, remove it.

2. **Define expanded focus lines for the 4 merged dimensions.**
   - `extraction` (expanded): Add CDC mechanism selection, timestamp field correctness, soft delete detection, parent-child change propagation
   - `field-semantics` (expanded): Add managed package field overrides, modification schedules, ISV field interactions
   - `config-patterns` (expanded): Add version-dependent configuration constraints, adapter version pinning, multi-axis compatibility requirements
   - `load-merge-patterns` (expanded): Add failure recovery, backfill strategies, schema evolution handling
   Why: The merges are only as good as the expanded focus lines. Vague focus lines reproduce the broad-agent problem.
   Dependencies: Item 1.
   Decision point: If expanded focus lines exceed 3 sentences, the merge may be too broad.

3. **Add template-section coverage checking to the consolidation agent prompt.**
   Why: Compensates for dropped output-standards and absorbed customizations content. The Purist proposed this as a zero-cost safety net.
   Dependencies: Item 1.
   Decision point: None -- this is strictly additive.

### Phase 2: Validate empirically

4. **Run A/B test: 18 dimensions vs. 14 (current baseline).**
   Why: The Economist's strongest recommendation. Build 3 skills at each count, score with eval harness. If 18 doesn't beat 14 by >0.5 on the 1-5 rubric, the expansion is not justified.
   Dependencies: Items 1-3.
   Decision point: A/B results determine whether to proceed with 18 or fall back to 14.

5. **Instrument consolidation quality metrics.**
   Why: The entire debate converges on "consolidation is the bottleneck." Instrument deduplication rate (how many questions appear in >1 dimension output), cross-reference rate (how many synthesized insights appear in final output), and focus score (per-question specificity).
   Dependencies: Item 4 (run alongside A/B test).
   Decision point: If deduplication rate >30%, activate two-stage consolidation.

6. **Build two-stage consolidation as an optional path.**
   Why: Three of four agents recommend it. The Economist acknowledges it may be needed at higher dimension counts. Building it now (while the architecture is fresh) costs less than retrofitting later.
   Dependencies: Item 5 (activation criteria).
   Decision point: Activate based on consolidation quality metrics from item 5.

### Phase 3: Iterate based on data

7. **Re-score all dimensions with the 5-factor rubric after 5 skill builds.**
   Why: The Economist's rubric is the strongest analytical tool from the debate, but it was applied to hypothetical cases. Real skill builds will reveal whether F3 (Question Differentiation) and F5 (Consolidation Separability) scores hold in practice.
   Dependencies: Item 4.
   Decision point: Any dimension scoring below 3/5 on empirical data is a merge or drop candidate.

8. **Evaluate extraction (expanded) focus for quality degradation.**
   Why: The T3 merge was the most contentious decision. Monitor whether the expanded extraction dimension produces focused questions or dilutes across HOW and WHAT.
   Dependencies: Item 4.
   Decision point: If extraction focus score <3.5 across 5 builds, re-split change-detection.
