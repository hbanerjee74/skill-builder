# Dynamic Research Dimensions — Design Document

> Definitive architecture for making the Skill Builder's research step dynamic.
> Each skill type declares which research dimensions it needs, and an optional planner
> agent adjusts the plan based on the specific domain.

---

## Table of Contents

1. [Recommended Architecture](#1-recommended-architecture)
2. [Research Dimension Catalog](#2-research-dimension-catalog)
3. [Planner Agent Design](#3-planner-agent-design)
4. [Config Format](#4-config-format)
5. [Template Changes](#5-template-changes)
6. [Impact on Steps 3 and Beyond](#6-impact-on-steps-3-and-beyond)
7. [Migration Path](#7-migration-path)
8. [Data Engineering Deep Dive](#8-data-engineering-deep-dive)

---

## 1. Recommended Architecture

### Decision: Approach C — Config-Driven Defaults + Planner Phase

The research orchestrator becomes dimension-aware. Each skill type declares default research
dimensions in its `config.conf`. A planner agent (opus) runs as Phase 0 of the research
orchestrator to adjust the dimension plan for the specific domain. The orchestrator then
spawns **all** dimension agents in parallel, collects outputs, and hands them to a
consolidation agent (opus with extended thinking) that reasons across all dimensions to
produce the final clarifications file.

### Why Approach C over A or B

| Criterion | A (Config Only) | B (Planner Only) | **C (Hybrid)** |
|-----------|----------------|-------------------|----------------|
| **Reliability** | High — deterministic | Medium — LLM may hallucinate dimensions | **High — config defaults as safety net** |
| **Extensibility** | Medium — new types need config work | High — planner adapts | **High — config for known, planner for novel** |
| **Quality** | Fixed — no domain adaptation | Variable — planner may over/under-fit | **Best of both — good defaults + smart adjustment** |
| **Complexity** | Low — just config parsing | Medium — new agent + plan format | **Medium — incremental over A** |
| **Testing** | Easy — deterministic | Hard — non-deterministic output | **Easy — test defaults, test planner as override** |

**Key reasoning:**

1. **Config defaults are the primary path.** For the 4 existing skill types, the right
   dimensions are known in advance. Config declares them, and most runs will use defaults
   with minor focus adjustments from the planner.

2. **The planner adds adaptive value without risk.** It reads defaults and the domain
   name, then outputs adjustments. If it fails, the orchestrator falls back to defaults.
   The planner's primary value is adjusting *focus lines* — telling the entities agent
   "focus on SCD surrogate keys" vs. "focus on customer hierarchies" — rather than
   adding/removing dimensions wholesale.

3. **LangGraph's Plan-and-Execute pattern validates this.** The planner produces a
   structured plan and launches agents itself, with fallback to defaults providing
   the reliability LangGraph achieves through replanning.

4. **DSPy's module composition pattern validates dimension reuse.** Dimensions are
   composable research modules with typed outputs. Type configs select which modules
   to compose, like DSPy pipeline configuration.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│              Research Orchestrator (per-type)              │
│                                                            │
│  Phase 0: Planner (opus)                                   │
│      │         │                                           │
│      │         └──► writes context/research-plan.md        │
│      │              (decision table — all 14 dimensions)   │
│      │                                                     │
│      └──► launches chosen dimension agents in parallel     │
│           (entities, metrics, pipeline-patterns, etc.)     │
│               │                                            │
│               ▼                                            │
│  Phase 1: Consolidation (opus + extended thinking)         │
│           reasons across all outputs, cross-references     │
│           → clarifications.md                              │
└──────────────────────────────────────────────────────────┘
```

The planner writes the decision file and launches agents **simultaneously** — it doesn't
wait for the file write before spawning agents. If the planner fails, the orchestrator
falls back to defaults and launches agents itself.

**Why flat parallel, not phased?** The original design split dimensions into "foundational"
(entities, metrics) and "exploratory" (everything else), with Phase 2 receiving Phase 1 output
as context. This was over-engineered:
- The dependency is weak — exploratory agents can research their domain independently
- Opus consolidation with extended thinking is where cross-referencing actually happens
- Two sequential phases double wall time for minimal quality gain
- The planner already injects domain-specific focus lines, so agents don't need prior context

### What Changes vs. What Stays

| Component | Change? | Details |
|-----------|---------|---------|
| Research orchestrator template | **Rewrite** | Dimension-aware, planner phase |
| research-concepts template | **Already removed** | Split into entities + metrics templates by VD-599; VD-608 converts these to shared agents |
| research-practices template | **Remove** | Still a generated template after VD-599; replaced by shared dimension agents |
| research-implementation template | **Remove** | Still a generated template after VD-599; replaced by shared dimension agents |
| generate-skill template | No change | Works from decisions.md as before |
| Dimension agents (new) | **Create** | 12 shared agents in `agents/shared/` |
| Research planner (new) | **Create** | 1 shared agent in `agents/shared/` |
| consolidate-research | **Upgrade** | Add `effort: high` for extended thinking; cross-references all dimension outputs |
| detailed-research | No change | Already dynamic — reads sections from clarifications.md |
| confirm-decisions | No change | Works from clarifications.md + clarifications-detailed.md |
| validate-skill | No change | Works from SKILL.md + decisions.md |
| build-agents.sh | **Modify** | Generates orchestrator + generate-skill per type (not 5 per type) |
| config.conf per type | **Extend** | New dimension declarations alongside existing fields |
| Plugin SKILL.md coordinator | No change | Calls `{type_prefix}-research` orchestrator as before |
| App sidecar | No change | Spawns orchestrator by name as before |
| Workflow store | No change | Step structure unchanged |

### Agent File Layout (New)

```
agents/
├── shared/
│   ├── consolidate-research.md          # unchanged
│   ├── confirm-decisions.md             # unchanged
│   ├── detailed-research.md             # unchanged
│   ├── validate-skill.md                # unchanged
│   ├── research-planner.md              # NEW
│   ├── research-entities.md             # NEW (dimension)
│   ├── research-metrics.md              # NEW (dimension)
│   ├── research-pipeline-patterns.md    # NEW (dimension)
│   ├── research-data-quality.md         # NEW (dimension)
│   ├── research-historization.md        # NEW (dimension)
│   ├── research-silver-gold-design.md   # NEW (dimension)
│   ├── research-business-rules.md       # NEW (dimension)
│   ├── research-modeling-patterns.md    # NEW (dimension)
│   ├── research-api-patterns.md         # NEW (dimension)
│   ├── research-integration.md          # NEW (dimension)
│   ├── research-deployment.md           # NEW (dimension)
│   ├── research-extraction.md           # NEW (dimension)
│   ├── research-authentication.md       # NEW (dimension)
│   └── research-schema-mapping.md       # NEW (dimension)
├── data-engineering/
│   ├── research.md                      # GENERATED (orchestrator)
│   └── generate-skill.md               # GENERATED (unchanged template)
├── domain/
│   ├── research.md                      # GENERATED (orchestrator)
│   └── generate-skill.md               # GENERATED
├── platform/
│   ├── research.md                      # GENERATED (orchestrator)
│   └── generate-skill.md               # GENERATED
└── source/
    ├── research.md                      # GENERATED (orchestrator)
    └── generate-skill.md               # GENERATED
```

**Agent count: 22** (14 shared + 8 generated) — down from 28 after VD-599 (4 shared + 24 generated), originally 24 on main.

---

## 2. Research Dimension Catalog

### Dimension Model

Each dimension is a focused research area that produces clarification questions about one
aspect of the skill domain. Dimensions are **shared agents** — the same `research-entities`
agent is used for domain, data-engineering, platform, and source skills. Type-specific
focus is injected via the orchestrator's prompt.

Every dimension has:
- **Name & slug** — human-readable name and agent file name suffix
- **Role** — what this dimension researches
- **Default focus** — generic focus line (type configs can override)
- **Output** — what kind of clarification questions it produces
- **Used by** — which skill types include this dimension by default

All dimensions run in parallel. The opus consolidation agent with extended thinking
handles cross-referencing and reasoning across dimension outputs.

### Dimensions

#### `entities` — Entity & Relationship Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-entities.md` |
| Role | Surface the core entities, relationships, cardinality patterns, and analysis patterns for the domain |
| Default focus | Identify domain entities, their relationships, cardinality constraints, and cross-entity analysis patterns |
| Output | Questions about which entities to model, relationship depth, key cardinality decisions |
| Used by | **all types** (domain, data-engineering, platform, source) |

Type-specific focus overrides:
- **domain**: "Focus on business entities, customer hierarchies, and organizational relationships"
- **data-engineering**: "Focus on dimensional entities (dimensions, fact tables, SCD history, surrogate keys), incremental load entities (watermarks, merge targets, change logs), and streaming entities (sources, sinks, windows)"
- **platform**: "Focus on platform resources, configuration objects, and their dependency relationships"
- **source**: "Focus on source system objects, API resource hierarchies, and data extraction entities"

#### `metrics` — Metrics & KPI Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-metrics.md` |
| Role | Surface metrics, KPIs, calculation nuances, and aggregation patterns that differentiate a naive implementation from a correct one |
| Default focus | Identify key metrics, calculation rules, aggregation patterns, and business rules that engineers commonly get wrong |
| Output | Questions about which metrics to support, calculation approaches, aggregation granularity |
| Used by | domain, data-engineering |

Type-specific focus overrides:
- **domain**: "Focus on business KPIs, revenue calculations, and industry-standard metric definitions"
- **data-engineering**: "Focus on pipeline health metrics, data quality scores, freshness SLAs, and reconciliation patterns"

#### `pipeline-patterns` — Pipeline Pattern Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-pipeline-patterns.md` |
| Role | Research load strategies, merge approaches, transformation patterns, and data movement architectures |
| Default focus | Focus on load patterns (full refresh, incremental, CDC, streaming), merge strategies (SCD types, upsert), and transformation approaches (T vs ELT, materialization) |
| Output | Questions about which load patterns to recommend, merge strategies, transformation sequencing |
| Used by | **data-engineering** |

#### `data-quality` — Data Quality Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-data-quality.md` |
| Role | Research validation frameworks, quality rule patterns, anomaly detection, and testing strategies |
| Default focus | Focus on validation rule patterns, data quality frameworks, anomaly detection approaches, and pipeline testing strategies |
| Output | Questions about quality rule severity, validation timing, testing approaches |
| Used by | data-engineering, source |

Type-specific focus overrides:
- **data-engineering**: "Focus on cross-layer validation, reconciliation patterns, and quality gates between silver and gold"
- **source**: "Focus on source data quality assessment, extraction validation, and schema conformance checks"

#### `historization` — Historization Strategy Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-historization.md` |
| Role | Research temporal data management strategies for tracking how data changes over time |
| Default focus | Focus on SCD type selection (Type 1/2/3), snapshot strategies, event sourcing patterns, and bitemporal modeling approaches |
| Output | Questions about which historization strategies to recommend per entity type, retention policies |
| Used by | **data-engineering** |

#### `silver-gold-design` — Silver/Gold Layer Design Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-silver-gold-design.md` |
| Role | Research lakehouse layer separation patterns, conformed dimensions, fact table granularity, and materialization strategies |
| Default focus | Focus on silver-to-gold promotion criteria, conformed dimension design, fact table granularity choices, and materialization/view strategies |
| Output | Questions about layer boundaries, dimension conformance, aggregation granularity, materialization approach |
| Used by | **data-engineering** |

#### `business-rules` — Business Rules Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-business-rules.md` |
| Role | Research industry-specific business rules, regulatory requirements, and common encoding mistakes |
| Default focus | Focus on business rules that affect data modeling, industry-specific variations, regulatory constraints, and rules that engineers without domain expertise commonly implement incorrectly |
| Output | Questions about which business rules the skill should encode, regulatory requirements, common mistakes |
| Used by | **domain** |

#### `modeling-patterns` — Modeling Patterns Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-modeling-patterns.md` |
| Role | Research silver/gold layer modeling patterns, snapshot strategies, and common modeling mistakes |
| Default focus | Focus on dimensional modeling patterns, snapshot strategies for the domain, source field coverage decisions, and modeling mistakes specific to this business area |
| Output | Questions about modeling approach, snapshot frequency, field coverage |
| Used by | **domain** |

#### `api-patterns` — API & Tool Pattern Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-api-patterns.md` |
| Role | Research tool capabilities, API structures, integration constraints, and platform-specific configuration |
| Default focus | Focus on API design patterns, rate limiting, pagination, webhook support, and platform-specific configuration options |
| Output | Questions about API usage patterns, configuration approaches, capability boundaries |
| Used by | **platform** |

#### `integration` — Integration Pattern Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-integration.md` |
| Role | Research integration patterns, version compatibility, and multi-tool orchestration |
| Default focus | Focus on integration patterns between tools, version compatibility constraints, configuration management, and multi-tool orchestration edge cases |
| Output | Questions about integration approach, compatibility handling, orchestration patterns |
| Used by | **platform** |

#### `deployment` — Deployment & Configuration Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-deployment.md` |
| Role | Research deployment patterns, state management, and migration strategies |
| Default focus | Focus on configuration schemas, deployment patterns, state management approaches, and version migration strategies |
| Output | Questions about deployment approach, state management, migration handling |
| Used by | **platform** |

#### `extraction` — Data Extraction Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-extraction.md` |
| Role | Research extraction patterns, API rate limit strategies, and data delivery edge cases |
| Default focus | Focus on extraction patterns (bulk vs incremental vs streaming), API rate limit handling, webhook vs polling trade-offs, and data delivery edge cases (ordering, exactly-once, late arrival) |
| Output | Questions about extraction approach, rate limit handling, delivery guarantees |
| Used by | **source** |

#### `authentication` — Authentication & Access Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-authentication.md` |
| Role | Research authentication flows, token management, and credential handling patterns |
| Default focus | Focus on authentication mechanisms (OAuth 2.0, API keys, SAML), token refresh strategies, credential rotation, and permission/scope management |
| Output | Questions about auth approach, token management, credential handling |
| Used by | **source** |

#### `schema-mapping` — Schema Mapping Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-schema-mapping.md` |
| Role | Research API-to-warehouse schema mapping, type coercion, and schema evolution handling |
| Default focus | Focus on source-to-target field mapping, data type coercion rules, schema evolution handling, and source-specific data quality gotchas |
| Output | Questions about mapping approach, type handling, evolution strategy |
| Used by | **source** |

### Dimension Assignment Matrix

| Dimension | domain | data-engineering | platform | source |
|-----------|--------|-----------------|----------|--------|
| `entities` | ✓ | ✓ | ✓ | ✓ |
| `metrics` | ✓ | ✓ | - | - |
| `pipeline-patterns` | - | ✓ | - | - |
| `data-quality` | - | ✓ | - | ✓ |
| `historization` | - | ✓ | - | - |
| `silver-gold-design` | - | ✓ | - | - |
| `business-rules` | ✓ | - | - | - |
| `modeling-patterns` | ✓ | - | - | - |
| `api-patterns` | - | - | ✓ | - |
| `integration` | - | - | ✓ | - |
| `deployment` | - | - | ✓ | - |
| `extraction` | - | - | - | ✓ |
| `authentication` | - | - | - | ✓ |
| `schema-mapping` | - | - | - | ✓ |

✓ = included, - = not used. All included dimensions run in parallel.

**Agent counts per type:**
- domain: 4 dimension agents
- data-engineering: 6 dimension agents
- platform: 4 dimension agents
- source: 4 dimension agents

---

## 3. Planner Agent Design

### Agent Specification

```yaml
---
name: research-planner
description: >
  Analyzes skill type, domain, and user context to produce a customized
  research dimension plan. Called as Phase 0 of the research orchestrator.
model: opus
tools: Read, Glob, Grep
---
```

### Inputs (via prompt from orchestrator)

The orchestrator passes these in the Task tool prompt:

1. **Skill type** — `domain`, `data-engineering`, `platform`, or `source`
2. **Domain name** — e.g., "sales pipeline", "Salesforce", "dbt"
3. **User context** — any additional context the user provided during init (may be empty)
4. **Default plan** — the type's default dimension list from config, formatted as:
   ```
   Dimensions: entities (focus: ...), metrics (focus: ...), pipeline-patterns (focus: ...), ...
   ```
5. **Available dimensions** — full catalog of all dimensions with descriptions

### Dual Output: Decision File + Agent Launch

The planner does two things **in parallel**:

1. **Writes `context/research-plan.md`** — a decision table covering all 14 dimensions
   for transparency and auditability. This file is a record of what was decided and why.

2. **Launches chosen dimension agents** — the planner itself spawns the dimension agents
   via Task tool calls based on its decisions. It doesn't wait for the file write to
   complete before launching agents — both happen simultaneously.

This means the orchestrator does **not** parse the plan file. The planner is both the
decision-maker and the executor. The orchestrator spawns the planner, and the planner
spawns the dimension agents directly.

### Decision File Format (`context/research-plan.md`)

The file contains a decision table covering **all 14 available dimensions** — not just
the chosen ones. This makes the planner's reasoning transparent and auditable.

```markdown
# Research Plan

## Skill: [domain] ([skill_type])

## Dimension Decisions

| Dimension | Chosen | Focus | Reasoning |
|-----------|--------|-------|-----------|
| entities | Yes | [adjusted focus or "Default"] | [why this dimension is relevant] |
| metrics | Yes | [adjusted focus or "Default"] | [why this dimension is relevant] |
| pipeline-patterns | No | — | [why this dimension was excluded] |
| data-quality | No | — | [why this dimension was excluded] |
| historization | No | — | [why this dimension was excluded] |
| silver-gold-design | No | — | [why this dimension was excluded] |
| business-rules | Yes | [adjusted focus or "Default"] | [why this dimension is relevant] |
| modeling-patterns | Yes | [adjusted focus or "Default"] | [why this dimension is relevant] |
| api-patterns | No | — | [why this dimension was excluded] |
| integration | No | — | [why this dimension was excluded] |
| deployment | No | — | [why this dimension was excluded] |
| extraction | No | — | [why this dimension was excluded] |
| authentication | No | — | [why this dimension was excluded] |
| schema-mapping | No | — | [why this dimension was excluded] |

## Entity Examples
[adjusted entity examples or "Use defaults from config"]
```

**Table rules:**
- **Chosen** column: "Yes" or "No"
- **Focus** column: the focus line for chosen dimensions (or "Default" to keep the type config's focus), "—" for excluded dimensions
- **Reasoning** column: brief justification for inclusion or exclusion
- **Entity Examples** section: only present if the planner adjusts entity examples from the config defaults

### Fallback

If the planner fails or produces no output, the orchestrator falls back to the
baked-in defaults from the generated template and launches those dimension agents itself.

### Planner Behavior Guidelines

The planner prompt instructs it to:

1. **Prefer defaults.** Most domains fit their type's default dimensions well.
   The planner should adjust focus lines more often than adding/removing dimensions.

2. **Adjust focus for domain specificity.** "pipeline-patterns" for a "real-time fraud detection"
   skill should focus on streaming and CDC, while for a "financial reporting" skill it should
   focus on batch and SCD patterns.

3. **Add dimensions sparingly.** Only add a dimension from another type when the domain
   genuinely crosses type boundaries (e.g., a "Salesforce analytics" domain skill might
   add `extraction` from the source type).

4. **Never remove `entities`.** It is always required. `metrics` can be removed
   only for platform/source types that don't have business metrics.

5. **Cover all 14 dimensions.** The table must list every dimension — no omissions.
   Reasoning for exclusion is just as important as reasoning for inclusion.

6. **Keep reasoning concise.** One sentence per dimension. The table is a decision
   artifact, not an essay.

### Cost and Latency

- **Model:** opus (needs reasoning about domain-dimension fit)
- **Expected tokens:** ~500 input, ~500 output (table is larger than old list format)
- **Latency:** ~5-8 seconds
- **Cost:** ~$0.03 per call
- **Impact on total research step:** +5% wall time (current step is ~90-120s)

---

## 4. Config Format

### Current Format (`config.conf`)

```conf
# After VD-599 (current baseline)
NAME_PREFIX=de
FOCUS_LINE__research_entities=Focus on historization strategies...
FOCUS_LINE__research_metrics=Focus on pipeline health metrics...
FOCUS_LINE__research_practices=Focus on transformation patterns...
FOCUS_LINE__research_implementation=Focus on historization strategies...
ENTITY_EXAMPLES=e.g., for dimensional pipelines: dimensions...
```

### New Format (`config.conf`)

```conf
# Type configuration for data-engineering agents
NAME_PREFIX=de

# Entity examples (passed to the entities dimension agent)
ENTITY_EXAMPLES=e.g., for dimensional pipelines: dimensions, fact tables, SCD history, surrogate keys; for incremental loads: watermarks, merge targets, change logs; for streaming: sources, sinks, windows, state stores

# Research dimensions — all spawn in parallel
DIMENSIONS=entities,metrics,pipeline-patterns,data-quality,historization,silver-gold-design

# Per-dimension focus overrides (optional — omit to use dimension's default focus)
# Format: DIMENSION_FOCUS__<slug_with_underscores>=<focus line>
DIMENSION_FOCUS__entities=Focus on dimensional entities (dimensions, fact tables, SCD history, surrogate keys), incremental load entities (watermarks, merge targets, change logs), and streaming entities (sources, sinks, windows, state stores)
DIMENSION_FOCUS__metrics=Focus on pipeline health metrics, data quality scores, freshness SLAs, and reconciliation patterns that drive the data model design
DIMENSION_FOCUS__pipeline_patterns=Focus on load patterns (SCD types, incremental, CDC, streaming), merge strategies (MERGE INTO, upsert), and transformation approaches (T vs ELT, materialization)
DIMENSION_FOCUS__data_quality=Focus on cross-layer validation rules, reconciliation patterns, quality gates between silver and gold, and pipeline testing strategies
DIMENSION_FOCUS__historization=Focus on SCD type selection per entity (Type 1 for reference data, Type 2 for dimensions), snapshot vs event log strategies, and bitemporal modeling for audit-critical data
DIMENSION_FOCUS__silver_gold_design=Focus on silver-to-gold promotion criteria, conformed dimension design, fact table granularity choices, aggregate table patterns, and materialization vs view strategies
```

### All Four Type Configs

**domain/config.conf:**
```conf
NAME_PREFIX=domain
ENTITY_EXAMPLES=e.g., for sales: accounts, opportunities, contacts; for supply chain: suppliers, purchase orders, inventory
DIMENSIONS=entities,metrics,business-rules,modeling-patterns
DIMENSION_FOCUS__entities=Focus on business entities, customer hierarchies, organizational relationships, and cross-entity analysis patterns
DIMENSION_FOCUS__metrics=Focus on business KPIs, revenue calculations, industry-standard metric definitions, and calculation nuances that differentiate naive implementations from correct ones
DIMENSION_FOCUS__business_rules=Focus on business rules that affect data modeling, industry-specific variations, regulatory constraints, and rules engineers commonly implement incorrectly
DIMENSION_FOCUS__modeling_patterns=Focus on silver/gold layer modeling patterns for this business domain, snapshot strategies, source field coverage decisions, and common modeling mistakes
```

**platform/config.conf:**
```conf
NAME_PREFIX=platform
ENTITY_EXAMPLES=e.g., for Terraform: providers, modules, resources; for Kubernetes: deployments, services, ingress
DIMENSIONS=entities,api-patterns,integration,deployment
DIMENSION_FOCUS__entities=Focus on platform resources, configuration objects, state representations, and their dependency relationships
DIMENSION_FOCUS__api_patterns=Focus on tool capabilities, API design patterns, rate limiting, pagination, and platform-specific configuration options
DIMENSION_FOCUS__integration=Focus on integration patterns between tools, version compatibility constraints, configuration management, and multi-tool orchestration edge cases
DIMENSION_FOCUS__deployment=Focus on configuration schemas, deployment patterns, state management approaches, and version migration strategies
```

**source/config.conf:**
```conf
NAME_PREFIX=source
ENTITY_EXAMPLES=e.g., for Stripe: charges, subscriptions, events; for Salesforce: accounts, opportunities, custom objects
DIMENSIONS=entities,extraction,authentication,schema-mapping,data-quality
DIMENSION_FOCUS__entities=Focus on source system objects, API resource hierarchies, data extraction entities, and relationship mapping to warehouse targets
DIMENSION_FOCUS__extraction=Focus on extraction patterns (bulk vs incremental vs streaming), API rate limit handling, webhook vs polling trade-offs, and data delivery edge cases
DIMENSION_FOCUS__authentication=Focus on authentication mechanisms (OAuth 2.0, API keys, SAML), token refresh strategies, credential rotation, and permission/scope management
DIMENSION_FOCUS__schema_mapping=Focus on source-to-target field mapping, data type coercion rules, schema evolution handling, and source-specific data quality gotchas
DIMENSION_FOCUS__data_quality=Focus on source data quality assessment, extraction validation, schema conformance checks, and handling missing or inconsistent source data
```

### Backward Compatibility

The old `FOCUS_LINE__research_concepts`, `FOCUS_LINE__research_practices`, and
`FOCUS_LINE__research_implementation` keys are ignored by the new build system.
They can be left in config for a transition period and removed in a follow-up cleanup.

---

## 5. Template Changes

### Templates Removed

| File | Reason |
|------|--------|
| `agent-sources/templates/research-concepts.md` | **Already removed** by VD-599 (split into entities + metrics templates) |
| `agent-sources/templates/research-entities.md` | Added by VD-599; replaced by shared `research-entities` dimension agent |
| `agent-sources/templates/research-metrics.md` | Added by VD-599; replaced by shared `research-metrics` dimension agent |
| `agent-sources/templates/research-practices.md` | Replaced by shared dimension agents |
| `agent-sources/templates/research-implementation.md` | Replaced by shared dimension agents |

### Templates Modified

#### `agent-sources/templates/research.md` (Research Orchestrator)

**Complete rewrite.** The new orchestrator template:

```markdown
---
name: {{NAME_PREFIX}}-research
description: Orchestrates dynamic research by running a planner, then spawning
  all dimension agents in parallel, and consolidating results with extended
  thinking. Called during Step 1.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# Research Orchestrator

<role>
## Your Role
Orchestrate parallel research by running a planner to finalize the research plan,
spawning all dimension agents in parallel, and consolidating results into a
cohesive clarifications file using opus with extended thinking.
</role>

<context>
## Context
- The coordinator tells you:
  - The **domain** name
  - The **skill name**
  - The **skill type** ({{SKILL_TYPE}})
  - The **context directory** path (write `clarifications.md` here)

## Default Research Plan

If the planner agent fails or returns no output, use these defaults:

### Dimensions (spawn all in parallel)
{{DIMENSION_INSTRUCTIONS}}
</context>

---

<instructions>

## Phase 0: Plan

Spawn the research planner agent (`name: "research-planner"`, `model: "opus"`).
Pass it:
- Skill type: {{SKILL_TYPE}}
- Domain name (from coordinator)
- The default research plan listed above
- Available dimension catalog:
{{DIMENSION_CATALOG_SUMMARY}}

If the planner returns a valid research plan, use it for Phase 1.
If the planner fails or returns invalid output, use the defaults above.

## Phase 1: Research All Dimensions

Follow the Sub-agent Spawning protocol. Spawn **all** dimension agents in parallel.
Each agent **returns text** — it does not write files.

For each dimension from the plan:
- Agent name: `"research-<dimension-slug>"`
- Pass: the domain name and the dimension's focus line
- For the entities dimension, also pass: entity examples

Wait for all dimension agents to complete. Collect their returned text.

## Phase 2: Consolidate with Extended Thinking

After all dimension agents return, spawn a fresh **consolidate-research**
sub-agent (`name: "consolidate-research"`, `model: "opus"`). Pass it:
- The returned text from ALL dimension agents
- The context directory path and target filename `clarifications.md`

The consolidation agent uses extended thinking (`effort: high`) to:
- Cross-reference findings across dimensions (e.g., entity decisions that
  affect pipeline pattern choices)
- Identify contradictions or gaps between dimension outputs
- Reason about question ordering and dependencies
- Produce a cohesive, well-structured clarifications file

## Error Handling

If a dimension agent fails, re-spawn once. If it fails again, proceed with
available output. If the consolidation agent fails, perform consolidation yourself.

</instructions>

## Success Criteria
- Planner runs and produces a valid plan (or graceful fallback to defaults)
- All dimension agents return research text with 5+ questions each
- Consolidation agent produces a cohesive `clarifications.md` with logical
  section flow and cross-referenced questions
```

The `{{DIMENSION_INSTRUCTIONS}}`, `{{DIMENSION_CATALOG_SUMMARY}}`, and `{{SKILL_TYPE}}`
placeholders are filled by the build system from the type's config.conf.

### Templates Unchanged

| File | Reason |
|------|--------|
| `agent-sources/templates/generate-skill.md` | Works from decisions.md — unaffected by research changes |

### New: Shared Dimension Agents

Each dimension agent is a handwritten shared agent in `agents/shared/`. They follow
a common structure:

```markdown
---
name: research-<slug>
description: Researches <dimension name> for the skill domain. Called during
  Step 1 by the research orchestrator.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash
---

# Research Agent: <Dimension Name>

<role>
## Your Role
You are a research agent. <Dimension-specific role description>.
</role>

<context>
## Context
- The orchestrator passes you:
  - **Which domain** to research
  - **Focus areas** for your research
- This agent writes no files — it returns clarification text to the orchestrator
</context>

<instructions>
## Instructions

**Goal**: Produce clarification questions about <dimension name> where different
answers produce meaningfully different skill content.

**Research approach**: <Dimension-specific research instructions>

**Constraints**:
- Follow the Clarifications file format from your system prompt
- Always include "Other (please specify)" as a choice
- Return the clarification text (do not write files)
- Every question must present choices where different answers change the skill's design
- Target 5-8 questions
</instructions>

## Success Criteria
- <Dimension-specific success criteria>
- Each question has 2-4 specific, differentiated choices
- Recommendations include clear reasoning
- Output contains 5-8 questions focused on decisions that change skill content
```

The dimension-specific sections are handwritten for each of the 14 dimensions.
They do NOT use the build system — they are committed directly to `agents/shared/`.

### Build System Changes (`scripts/build-agents.sh`)

The build system changes from generating 5 files per type to generating 2 files per type:

1. **Research orchestrator** (`research.md`) — from the new `research.md` template
2. **Generate skill** (`generate-skill.md`) — from the existing `generate-skill.md` template

New config variables the build system parses:
- `DIMENSIONS` — comma-separated dimension slugs (all spawn in parallel)
- `DIMENSION_FOCUS__*` — per-dimension focus overrides
- `SKILL_TYPE` — new variable (value: the type name, e.g., `data-engineering`)

New placeholders the build system fills:
- `{{SKILL_TYPE}}` — the skill type name
- `{{DIMENSION_INSTRUCTIONS}}` — generated from `DIMENSIONS` + focus overrides
- `{{DIMENSION_CATALOG_SUMMARY}}` — generated from all dimension agent files (name + description)

The build system reads each dimension's default focus from the dimension agent file
(parsed from the agent's markdown) and uses the type's focus override if present.

Example generated instruction block for data-engineering:
```markdown
1. **research-entities** — Pass this focus: "Focus on dimensional entities
   (dimensions, fact tables, SCD history, surrogate keys)..."
   Entity examples: "e.g., for dimensional pipelines: dimensions, fact tables..."
2. **research-metrics** — Pass this focus: "Focus on pipeline health metrics,
   data quality scores, freshness SLAs..."
3. **research-pipeline-patterns** — Pass this focus: "Focus on load patterns
   (SCD types, incremental, CDC, streaming)..."
4. **research-data-quality** — Pass this focus: "Focus on cross-layer validation
   rules, reconciliation patterns..."
5. **research-historization** — Pass this focus: "Focus on SCD type selection
   per entity..."
6. **research-silver-gold-design** — Pass this focus: "Focus on silver-to-gold
   promotion criteria..."
```

---

## 6. Impact on Steps 3 and Beyond

### Step 3: Detailed Research — No Changes

The `detailed-research` agent already works dynamically:
1. Reads `clarifications.md` (produced by consolidation in Step 1)
2. Identifies topic sections from the YAML frontmatter `sections` field
3. Spawns one sub-agent per section
4. Consolidates into `clarifications-detailed.md`

With dynamic dimensions, the sections in `clarifications.md` will reflect dimension
names (e.g., "Pipeline Patterns", "Historization") instead of the old generic names
("Domain Concepts & Metrics", "Practices & Edge Cases"). The detailed-research agent
is section-agnostic — it reads whatever sections exist and drills deeper. No changes needed.

### Step 5: Confirm Decisions — No Changes

The `confirm-decisions` agent reads `clarifications.md` and `clarifications-detailed.md`,
analyzing answers holistically. It's content-agnostic — it works with whatever questions
are present. The output (`decisions.md`) format is unchanged. No changes needed.

### Step 6: Generate Skill — No Changes

The `generate-skill` agent reads `decisions.md` and creates SKILL.md + reference files.
It's decision-driven, not research-structure-driven. No changes needed.

### Step 7: Validate Skill — No Changes

The `validate-skill` agent reads SKILL.md, reference files, `decisions.md`, and
`clarifications.md`. It validates content quality and decision coverage. No changes needed.

### Plugin Coordinator (SKILL.md) — No Changes

The coordinator invokes `skill-builder:{type_prefix}-research` for Step 1.
The orchestrator's internal dimension machinery is invisible to the coordinator.
No changes needed.

### App Workflow Store — No Changes

The workflow step definitions in `workflow-store.ts` are unchanged.
Step 0 (Research) still runs a single orchestrator agent.

---

## 7. Migration Path

> **Prerequisite:** VD-599 must be merged first. VD-599 establishes the flat parallel
> execution pattern, opus planner (inline), and opus consolidation with extended thinking.
> It also splits `research-concepts` into `research-entities` + `research-metrics` templates
> and makes practices/implementation agents independent. The migration phases below start
> from VD-599's state (28 agents, 6 per type).

### Phase 1: Create Dimension Agents (Low Risk)

**Goal:** Add all 14 shared dimension agents without changing any existing code.

1. Convert VD-599's `research-entities` template to shared `agents/shared/research-entities.md`
2. Convert VD-599's `research-metrics` template to shared `agents/shared/research-metrics.md`
3. Create the remaining 12 dimension agents with appropriate role descriptions,
   research instructions, and success criteria
4. Extract VD-599's inline planner into `agents/shared/research-planner.md`

**Verification:** `./scripts/validate.sh` still passes. No existing agents are modified.

### Phase 2: Update Config Format (Low Risk)

**Goal:** Extend config.conf files with dimension declarations.

1. Add `DIMENSIONS`, `DIMENSION_FOCUS__*`, and `SKILL_TYPE` to each type's `config.conf`
2. Keep old `FOCUS_LINE__*` keys for backward compatibility during transition

**Verification:** Old `build-agents.sh` still works (ignores new keys).

### Phase 3: Update Build System (Medium Risk)

**Goal:** Modify `build-agents.sh` to generate dimension-aware orchestrators.

1. Update `research.md` template to the new dimension-aware version
2. Remove `research-concepts.md`, `research-practices.md`, `research-implementation.md` templates
3. Update `build-agents.sh` to:
   - Parse new config variables (`DIMENSIONS`, `DIMENSION_FOCUS__*`, `SKILL_TYPE`)
   - Generate dimension instruction blocks for the orchestrator
   - Generate the dimension catalog summary
   - Only process `research.md` and `generate-skill.md` templates (skip removed ones)
4. Run `./scripts/build-agents.sh` to regenerate
5. Delete old generated files: `agents/{type}/research-entities.md`,
   `agents/{type}/research-metrics.md`, `agents/{type}/research-practices.md`,
   `agents/{type}/research-implementation.md`

**Verification:**
- `./scripts/build-agents.sh --check` passes
- Generated orchestrators contain correct dimension instructions
- `./scripts/validate.sh` passes

### Phase 4: Update Tests (Medium Risk)

**Goal:** Update test expectations for new agent count and structure.

1. Update T1 structural validation: agent count changes from 28 (VD-599) to 22
2. Update agent name expectations (new dimension agent names, removed old names)
3. Add dimension agent validation (verify all declared dimensions have corresponding files)
4. Run `./scripts/test-plugin.sh t1`

**Verification:** T1 passes with new expectations.

### Phase 5: Integration Test (High Value)

**Goal:** Verify the new research step produces quality output.

1. Run a full research step for each skill type in mock or dev mode
2. Compare `clarifications.md` output quality against the old fixed approach
3. Verify the planner produces sensible plans for various domains
4. Verify fallback to defaults when planner is disabled/fails
5. Run `./scripts/test-plugin.sh t2 t3` for plugin integration

**Verification:**
- Each type produces a well-structured `clarifications.md`
- Planner adjustments are sensible (not hallucinated dimensions)
- Fallback path works

### Phase 6: Cleanup (Low Risk)

1. Remove old `FOCUS_LINE__*` keys from config.conf files
2. Remove any transitional compatibility code
3. Update CLAUDE.md documentation for new architecture
4. Update test manifest

### Rollback Plan

At any phase, if issues are found:
- **Phase 1-2:** Simply delete new files. No existing code was modified.
- **Phase 3:** Restore old templates from git. Run `build-agents.sh` to regenerate old agents.
- **Phase 4-6:** Revert test changes. The architecture changes are in Phase 3.

---

## 8. Data Engineering Deep Dive

### Why Data Engineering Benefits Most

Data engineering skills for lakehouse silver/gold table modeling need research depth in
areas that the generic concepts/practices/implementation split doesn't cover well:

| Current Agent | What it covers | What it misses |
|---------------|---------------|----------------|
| research-concepts (entity + metrics) | Entities and KPIs | Pipeline load patterns, layer design |
| research-practices | Generic patterns and edge cases | SCD-specific trade-offs, quality gates |
| research-implementation | Technical decisions broadly | Historization depth, silver/gold boundaries |

The new 6-dimension structure for data-engineering covers each area with focused depth:

### Data Engineering Dimension Breakdown

#### `entities`
**Focus:** Dimensional entities (dimensions, fact tables, SCD history, surrogate keys),
incremental load entities (watermarks, merge targets, change logs), streaming entities
(sources, sinks, windows, state stores).

**Key questions this dimension surfaces:**
- Which entities are dimensions vs. facts? (affects historization strategy downstream)
- What's the grain of each fact table? (affects aggregation in gold layer)
- Which entities need surrogate keys vs. natural keys? (affects merge strategies)
- What are the cardinality relationships? (affects join performance)

#### `metrics`
**Focus:** Pipeline health metrics, data quality scores, freshness SLAs, reconciliation
patterns, and business metrics that drive aggregation design.

**Key questions:**
- What freshness SLAs exist per table? (affects materialization strategy)
- Which reconciliation patterns are needed? (affects quality gate design)
- What business metrics drive gold table design? (affects aggregation granularity)

#### `pipeline-patterns`
**Focus:** Load patterns (SCD types, incremental, CDC, streaming), merge strategies
(MERGE INTO, upsert, append-only), and transformation approaches.

**Key questions this surfaces:**
- For each dimension entity: which SCD type? (Type 1 for reference,
  Type 2 for tracking, Type 3 for both old/new)
- For each fact entity: full refresh or incremental? What's the high-water mark column?
- Merge strategy for upserts: MERGE INTO vs delete+insert vs append-only with dedup?
- How to handle late-arriving facts? (affects merge window sizing)

**Example clarification question:**
```markdown
### Q: What load pattern should the skill recommend for fact tables?
The load pattern affects pipeline cost, complexity, and data freshness.

**Choices:**
a) **Full refresh** — Simplest; replaces target entirely. Best for small tables
   or where the source doesn't provide reliable change timestamps.
b) **Timestamp-based incremental** — Loads records modified since last run.
   Handles 80% of cases but misses hard deletes.
c) **CDC (change data capture)** — Captures all operations from source logs.
   Most complete but requires source system support.
d) **Other (please specify)**

**Recommendation:** Option (b) — timestamp-based incremental is the best
default for most fact tables. The skill should recommend CDC as an upgrade
path for tables where delete detection matters.

**Answer:**
```

#### `data-quality`
**Focus:** Cross-layer validation rules, reconciliation patterns, quality gates
between silver and gold, and pipeline testing strategies.

**Key questions:**
- What validation rules at silver layer ingestion? (schema, null checks, range checks)
- What reconciliation between source counts and silver counts?
- What quality gates before silver→gold promotion? (completeness thresholds, anomaly checks)
- What testing approach? (dbt tests, Great Expectations, custom assertions)

#### `historization`
**Focus:** SCD type selection per entity, snapshot strategies, event sourcing patterns,
bitemporal modeling for audit-critical data.

**Key questions:**
- For each dimension entity: which SCD type and why?
- Snapshot strategy: daily full snapshot vs. change-only rows?
- Bitemporal modeling: needed for any entities? (regulatory/audit requirements)
- History retention: how long? Archival strategy?

#### `silver-gold-design`
**Focus:** Layer separation, conformed dimensions, fact table granularity,
materialization, and aggregate patterns.

**Key questions:**
- Silver layer: cleansed source-conformed or business-conformed?
- Gold layer: star schema, one big table, or wide denormalized?
- Conformed dimensions: which entities span multiple fact tables?
- Materialization: physical tables vs. views vs. materialized views?
- Aggregate tables: pre-computed aggregates for key business metrics?

### Expected Output Quality Improvement

With the current 3-agent approach, a data-engineering skill for "sales pipeline lakehouse"
produces ~15-20 questions across concepts, practices, and implementation. Many questions
are generic ("How should you handle incremental loads?") because the agents don't have
enough context about the specific pipeline pattern.

With the 6-dimension approach, all agents research in parallel with domain-specific
focus lines from the planner. Each produces targeted questions for its dimension:
- `entities` surfaces core entities, relationships, and cardinality
- `metrics` surfaces KPIs, calculation nuances, and aggregation patterns
- `pipeline-patterns` surfaces load strategies and merge approaches
- `historization` surfaces SCD types and temporal patterns
- `silver-gold-design` surfaces layer design and materialization choices
- `data-quality` surfaces validation rules and quality gates

This produces ~25-30 questions across 6 focused dimensions. The consolidation
agent (opus with extended thinking, `effort: high`) then reasons across all outputs —
cross-referencing entity decisions with pipeline patterns, metrics with layer design,
etc. — to produce ~18-22 high-quality questions where each question's choices reflect
the cross-dimensional implications. Extended thinking is where the real quality gain
happens: the consolidator spots contradictions, identifies gaps between dimensions,
and ensures questions are ordered so that earlier answers inform later choices.

### Example Planner Output for "Sales Pipeline Lakehouse"

Written to `context/research-plan.md`:

```markdown
# Research Plan

## Skill: Sales Pipeline Lakehouse (data-engineering)

## Dimension Decisions

| Dimension | Chosen | Focus | Reasoning |
|-----------|--------|-------|-----------|
| entities | Yes | Sales pipeline entities (opportunities, pipeline stages, accounts, contacts, products), their grain, and cardinality relationships. Emphasize opportunity-to-account and opportunity-to-stage relationships. | Core to any data engineering skill — must model domain entities and relationships |
| metrics | Yes | Sales pipeline metrics (conversion rates by stage, pipeline velocity, win rates, average deal size, forecast accuracy) and calculation nuances that drive gold layer aggregation. | Sales pipeline has rich KPIs; forecast accuracy is critical and commonly miscalculated |
| pipeline-patterns | Yes | Incremental loading for high-volume opportunity updates, CDC for stage transition tracking, and merge strategies for slowly-changing account hierarchies. | Default for DE — sales has high-volume opportunity updates requiring careful load strategy |
| data-quality | Yes | Pipeline stage transition validation (no backward jumps without reason), amount consistency checks, and duplicate opportunity detection. | Default for DE — CRM data has known quality issues (duplicate opps, stale amounts) |
| historization | Yes | SCD Type 2 for accounts (territory changes, ownership changes) and pipeline stage snapshots for funnel analysis over time. | Default for DE — stage history is essential for pipeline velocity and funnel analysis |
| silver-gold-design | Yes | Star schema with opportunity fact table at stage-transition grain, conformed account/contact/product dimensions, and pre-computed pipeline progression aggregates. | Default for DE — sales dashboards need pre-computed aggregates for responsive reporting |
| business-rules | No | — | Domain type dimension — not relevant for a data engineering lakehouse skill |
| modeling-patterns | No | — | Domain type dimension — silver-gold-design already covers modeling for DE skills |
| api-patterns | No | — | Platform type dimension — no API design involved in lakehouse modeling |
| integration | No | — | Platform type dimension — no multi-tool orchestration involved |
| deployment | No | — | Platform type dimension — deployment patterns are out of scope for this skill |
| extraction | No | — | Source type dimension — lakehouse skill focuses on transformation, not extraction |
| authentication | No | — | Source type dimension — no auth flows in the skill scope |
| schema-mapping | No | — | Source type dimension — mapping handled upstream of the lakehouse |

## Entity Examples
opportunities, pipeline stages, accounts, contacts, products, forecast categories, sales territories
```

---

## Appendix: Open Questions

1. **Output examples per dimension?** Currently, output examples live in
   `agent-sources/types/{type}/output-examples/research-concepts.md`. With shared
   dimension agents, should output examples be:
   - (a) Per-dimension in `agent-sources/dimensions/{slug}/output-example.md`
   - (b) Per-type-per-dimension in `agent-sources/types/{type}/output-examples/research-{slug}.md`
   - (c) Removed — the dimension agent's instructions are sufficient

   **Recommendation:** Option (a). Each dimension has one output example showing
   the question format. Type-specific entity names are injected via the prompt, not the example.

2. **Extended thinking for planner?** The planner is an opus agent making a relatively
   simple decision. Should it use extended thinking (`effort: medium`)?

   **Recommendation:** Yes, `effort: medium`. The planner benefits from reasoning about
   domain-dimension fit, but it's not a deep analysis task.

3. **Planner for the plugin?** The plugin coordinator currently doesn't have a separate
   planner step. Should the plugin's research orchestrator also include the planner?

   **Recommendation:** Yes. The orchestrator template is shared between app and plugin.
   The planner runs as Phase 0 of the orchestrator in both contexts.

4. **Consolidation effort level?** The consolidation agent now has the critical job of
   cross-referencing all dimension outputs and reasoning about their implications.

   **Recommendation:** `effort: high`. This is where cross-dimensional reasoning happens —
   the consolidator must identify how entity decisions affect pipeline patterns, how metrics
   choices constrain layer design, etc. Extended thinking with high effort is essential
   for this reasoning to produce cohesive output.
