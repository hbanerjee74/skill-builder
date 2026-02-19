# Plugin v2: Shared Agent and Content Changes

Changes to shared agents, research dimensions, reference files, and content
guidelines that impact both the plugin and the desktop app.

---

## 1. Dimension Scoring in the Research Planner ✅

> Implemented: VD-693 (71c57cf)

The orchestrator pre-filters dimensions by skill type (5-6 per type), then the
planner scores only those and selects the top 3-5. Replaces the old binary
yes/no dimension selection.

### Type-scoped dimension sets

| Type | Dimensions | Count |
|------|-----------|-------|
| domain | entities, data-quality, metrics, business-rules, segmentation-and-periods, modeling-patterns | 6 |
| data-engineering | entities, data-quality, pattern-interactions, load-merge-patterns, historization, layer-design | 6 |
| platform | entities, platform-behavioral-overrides, config-patterns, integration-orchestration, operational-failure-modes | 5 |
| source | entities, data-quality, extraction, field-semantics, lifecycle-and-state, reconciliation | 6 |

No cross-type dimension picks — the skill type determines which dimensions
the planner evaluates.

### Scoring rubric

| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Critical delta — engineer will produce wrong models without this | Always include |
| 4 | High value — non-obvious knowledge that saves significant rework | Include if in top 5 |
| 3 | Moderate — useful but Claude's parametric knowledge covers 70%+ | Skip — note as companion candidate |
| 2 | Low — mostly standard knowledge, small delta | Skip |
| 1 | Redundant — Claude already knows this well | Skip |

The planner picks the **top 3-5 dimensions by score** from the type-scoped
set. Dimensions scored 2-3 are flagged with companion notes that feed the
companion-recommender agent (Section 7).

### Planner output format

```yaml
dimensions:
  - slug: metrics
    score: 5
    reason: "Customer-specific KPI formulas — Claude defaults to industry standard"
  - slug: entities
    score: 5
    reason: "Custom object model with managed package overrides"
  - slug: business-rules
    score: 4
    reason: "Segmentation-dependent thresholds not in any docs"
  - slug: field-semantics
    score: 3
    reason: "Some overrides but mostly standard Salesforce fields"
    companion_note: "Consider a source skill for Salesforce extraction"
  ...
selected: [metrics, entities, business-rules]  # top 3-5
```

**Scope-advisor as exception**: If the selected count exceeds the configured
max_dimensions threshold, scope-advisor kicks in. With type-scoped sets of
5-6, this only triggers when nearly all dimensions are critical.

---

## 2. Adaptive Research Depth

> Status: **Pending** (VD-681 skip refinement, VD-692 adaptive depth)

| Signal | Action |
|--------|--------|
| User provides detailed domain spec | Skip research entirely |
| First-round answers are specific and complete | Skip refinement (Step 3) |
| User says "proceed with defaults" | Auto-fill, skip to decisions |
| Planner scoring selects ≤3 dimensions | Faster research, lower cost |

### Skip-refinement heuristic

Refinement is skipped when all first-round clarification answers are:
- Non-blank
- More than one sentence
- No vague keywords ("it depends", "not sure", "varies")

---

## 3. Model Tier Optimization ✅

> Implemented: VD-682 (via agent frontmatter updates across multiple commits)

| Agent Group | Model | Notes |
|-------------|-------|-------|
| Research planner, consolidation, confirm-decisions, scope-advisor | opus | Unchanged |
| Research orchestrator, detailed-research, generate-skill, validate-skill, validate-quality, companion-recommender, refine-skill, most dimension agents | sonnet | Unchanged |
| test-skill, research-config-patterns, research-reconciliation, research-field-semantics, research-lifecycle-and-state | haiku | Downgraded from sonnet |

Actual model assignments live in agent frontmatter (`agents/*.md`).

---

## 4. Validation Consolidation ✅

> Implemented: VD-683 + VD-697 (d86b34d)

The original validation phase spawned ~15 sub-agents. Consolidated to **3
sub-agents spawned in parallel** by the `validate-skill` orchestrator:

### New structure

| Agent | Model | Purpose |
|-------|-------|---------|
| `validate-quality.md` | sonnet | 4-pass evaluation: coverage & structure, content quality, boundary check, prescriptiveness check |
| `test-skill.md` | haiku | Generate 5 test prompts (covering all 6 categories), evaluate each as PASS/PARTIAL/FAIL |
| `companion-recommender.md` | sonnet | Analyze skipped dimensions (scored 2-3), recommend 2-4 companion skills |

### What was merged

| Original | Consolidated Into |
|----------|-------------------|
| Sub-agent A (coverage) + B (SKILL.md quality) + D (boundary) + F (prescriptiveness) + C1..CN (per-reference reviewers) | `validate-quality` — single 4-pass agent |
| T1..T10 (10 test evaluators) | `test-skill` — 5 prompts, still covers all 6 categories |
| E (companion recommender) | `companion-recommender` — extracted as standalone agent |
| Reporter sub-agent | Eliminated — orchestrator handles Phase 3 directly |

### Output artifacts (3 files)

| File | Location |
|------|----------|
| `agent-validation-log.md` | `<skill-dir>/context/` |
| `test-skill.md` | `<skill-dir>/context/` |
| `companion-skills.md` | `<skill-dir>/context/` |

---

## 5. dbt Silver/Gold Specialization

> Status: **Pending** (VD-685 silver/gold guidance, VD-686 dbt sub-concerns)

### Silver/gold boundary guidance per skill type

| Skill Type | Silver Layer | Gold Layer |
|------------|-------------|------------|
| Domain | Cleaned, typed, deduplicated entities | Business metrics, aggregations, denormalized for BI |
| Platform | Platform-specific extraction handling | Platform-agnostic business layer |
| Source | Source-specific field mapping, type coercion, relationship resolution | Source-agnostic entity models |
| Data Engineering | Pattern implementation (SCD, CDC) | Pattern consumption (query patterns, materialization) |

### dbt-specific research sub-concerns

Enhance existing dimensions with dbt focus:

| Dimension | dbt Sub-concern |
|-----------|-----------------|
| `layer-design` | Staging vs intermediate vs marts; `ref()` dependency chains; naming conventions (`stg_`, `int_`, no prefix for marts); materialization per layer (view → table → incremental). With semantic layer: keep marts normalized (star schema), let MetricFlow denormalize dynamically |
| `modeling-patterns` | Model types (view, table, incremental, snapshot, ephemeral). Semantic models: entities, dimensions, measures. Metrics: simple, ratio, derived, cumulative, conversion. Decision tree: when does a model need a semantic model vs a denormalized mart? |
| `config-patterns` | `dbt_project.yml`, custom materializations, meta fields. Model contracts, access modifiers, versioning |
| `load-merge-patterns` | `is_incremental()` macros, merge predicates, `unique_key`; SCD2 via snapshots |
| `data-quality` | Testing pyramid: generic → singular → unit → Elementary anomaly detection. Layer-specific strategy. Contract + test interaction |
| `reconciliation` | `dbt_utils.equal_rowcount`, `dbt_utils.equality`; Elementary `volume_anomalies`; `edr monitor` → alert chain |

### Activation trigger for generated skills

Generated SKILL.md descriptions should include:

```
Use when building dbt silver or gold layer models for [domain].
Also use when the user mentions "[domain] models", "silver layer",
"gold layer", "marts", "staging", or "[domain]-specific dbt".
```

---

## 6. Skill Templates

> Status: **Pending** (VD-696)

Pre-built starter skills hosted on a public GitHub repo, imported using the
existing `github_import.rs` infrastructure.

### Template repository structure

```
skill-builder-templates/              # Public GitHub repo
├── dbt-incremental-silver/
│   ├── SKILL.md
│   └── references/
├── dbt-snapshot-scd2/
├── dbt-semantic-layer/
├── dlt-rest-api-connector/
├── elementary-data-quality/
├── salesforce-extraction/
└── revenue-domain/
```

### Matching

After the user answers scoping questions, match templates using a **haiku
call** (~$0.01). Pass all scoping inputs (name, type, domain description,
intake answers if provided) plus the template index. Haiku returns ranked
matches with reasoning.

### Flow (same for app and plugin)

1. User completes scoping
2. System fetches template repo index, matches via haiku
3. If matches: present 0-3 options ("Import as starting point, or build from scratch?")
4. If user picks a template: import files, pre-populate context, skip to clarification
5. If "from scratch" or no matches: full research flow

---

## 7. Companion Skill Report ✅

> Implemented: VD-697 (d86b34d)

The validate-skill step produces `<skill-dir>/context/companion-skills.md` as
a first-class artifact with YAML frontmatter for UI parsing.

The `companion-recommender` agent reads:
- The planner's dimension scores (skipped dimensions scored 2-3)
- The generated skill's scope
- The user's scoping answers (domain, skill type)

And produces a structured report:

```yaml
---
skill_name: sales-pipeline
skill_type: domain
companions:
  - slug: salesforce-extraction
    priority: High
    dimension: field-semantics
    score: 3
    composability: "Source skill for Salesforce ingestion layer"
    trigger: "Use when building dbt staging models from Salesforce data"
    template_match: null
  ...
---
```

Each companion includes: slug, priority (High/Medium/Low), source dimension
and score, composability rationale, and suggested trigger description.

### Skill composition (semantic triggering)

Generated skills reference each other via the SKILL.md description field:

```yaml
name: managing-sales-pipeline
description: >
  Build dbt silver and gold models for sales pipeline analytics.
  Use this skill in conjunction with "extracting-salesforce-data" when
  building the ingestion layer, and with "dbt-on-fabric" when deploying
  to Microsoft Fabric.
```

No runtime dependency resolution — the user decides which skills to load.
Claude Code matches descriptions naturally.

---

## 8. Standalone Convention Skills

> Status: **Pending** (VD-694)

Tool best practices are standalone, publishable skills — not bundled reference
files. Each tool gets its own skill, independently versioned and deployable.
Generated skills declare dependencies via `conventions` frontmatter.

### Convention skill catalog

| Skill | Content | References |
|-------|---------|------------|
| `dbt-conventions` | Project structure, naming, materialization, SQL style, contracts, access, versioning | `project-structure.md`, `testing-contracts.md` |
| `dbt-semantic-layer` | Semantic model YAML, entity/dimension/measure types, MetricFlow, Fabric export limitations | `semantic-models.md` |
| `dlt-conventions` | `RESTAPIConfig`, write dispositions, merge strategies, incremental, schema contracts | `connector-patterns.md` |
| `fabric-conventions` | OneLake destination, ABFSS, auth patterns, delta format, notebook setup, deployment | `platform-patterns.md` |
| `elementary-conventions` | Anomaly test types, config parameters, priority order, alerts, dbt integration | `test-catalog.md` |
| `pipeline-integration` | dlt → dbt → Elementary flow, naming alignment, timestamp alignment, orchestration | `cross-tool-patterns.md` |

### Generated skill frontmatter

```yaml
---
description: Sales pipeline silver/gold layer design for dbt on Fabric
conventions:
  - dbt-conventions
  - fabric-conventions
  - elementary-conventions
---
```

The `conventions` field is deployment documentation — the deployer installs
convention skills alongside the generated skill.

---

## 9. Refine-Skill Agent ✅

> Implemented: VD-700, VD-701 (d42976b)

New agent (`agents/refine-skill.md`, sonnet) that handles iterative skill
improvement. Used by both the app's refine page and the plugin's targeted
regeneration flow.

### Behavior by command

| Command | Behavior |
|---------|----------|
| Free-form request (default) | Minimal, targeted edits only. Preserves untouched sections. Updates `modified` frontmatter date |
| `/rewrite @file1 @file2` | Rewrites only targeted files from scratch. Does NOT spawn generate-skill |
| `/rewrite` (no targets) | Spawns `generate-skill` via Task for full regeneration, then `validate-skill` for verification |
| `/validate` | Spawns `validate-skill` via Task only |

### Tools

Read, Edit, Write, Glob, Grep, Task (for spawning generate-skill / validate-skill)

### Context provided

- Skill directory, context directory, workspace directory paths
- Skill type + domain name
- User context (industry, function, audience, challenges)
- Conversation history (maintained by SDK streaming mode in the app, or by
  coordinator in the plugin)

---

## 10. Reference File Updates

> Status: **Partially done**

| File | Changes | Status |
|------|---------|--------|
| `protocols.md` | Added `workspace_dir` parameter documentation | ✅ Done (f094aa0) |
| `content-guidelines.md` | Simplified, minor updates | ✅ Done (dcfb0f7) |
| `best-practices.md` | Simplified, added composition guidance | ✅ Done (dcfb0f7) |
| `file-formats.md` | Removed (content moved elsewhere) | ✅ Done (dcfb0f7) |
| `content-guidelines.md` | Add dbt silver/gold boundary guidance, layer naming, activation triggers, dlt/Elementary/Fabric context | Pending (VD-685, VD-686) |

---

## Related Linear Issues

| Issue | Title | Size | Status |
|-------|-------|------|--------|
| [VD-693](https://linear.app/acceleratedata/issue/VD-693) | Add dimension scoring to research planner with companion gap coverage | M | ✅ Done |
| [VD-683](https://linear.app/acceleratedata/issue/VD-683) | Consolidate validation sub-agents | M | ✅ Done |
| [VD-697](https://linear.app/acceleratedata/issue/VD-697) | Add companion skill report artifact | M | ✅ Done (agent) |
| [VD-700](https://linear.app/acceleratedata/issue/VD-700) | Add refine-skill agent | M | ✅ Done |
| [VD-701](https://linear.app/acceleratedata/issue/VD-701) | Add sidecar refine support | M | ✅ Done |
| [VD-682](https://linear.app/acceleratedata/issue/VD-682) | Add haiku tier for simple research dimensions | S | ✅ Done |
| [VD-681](https://linear.app/acceleratedata/issue/VD-681) | Make refinement phase optional (adaptive depth) | S | Pending |
| [VD-692](https://linear.app/acceleratedata/issue/VD-692) | Add adaptive depth: skip detailed research when answers sufficient | M | Pending |
| [VD-685](https://linear.app/acceleratedata/issue/VD-685) | Add silver/gold boundary guidance and dbt activation triggers | S | Pending |
| [VD-686](https://linear.app/acceleratedata/issue/VD-686) | Add dbt-specific research sub-concerns to dimensions | M | Pending |
| [VD-694](https://linear.app/acceleratedata/issue/VD-694) | Add standalone convention skills for dbt, dlt, Elementary, Fabric | L | Pending |
| [VD-696](https://linear.app/acceleratedata/issue/VD-696) | Add skill templates via GitHub import | L | Pending |

### Dependency order

```
VD-693 (dimension scoring) ✅
   │
   ├──→ VD-692 (adaptive depth) ⏳
   └──→ companion gap → VD-697 (companion artifact) ✅

VD-694 (convention skills) ⏳ ─── independent
VD-696 (skill templates) ⏳ ──── independent

VD-681 (skip refinement) ⏳ ┐
VD-682 (haiku tiers) ✅     ├── independent, parallel
VD-683 (consolidate) ✅     ┘

VD-685 (silver/gold) ⏳ ┐
VD-686 (dbt sub) ⏳     ┘── parallel content changes
```
