# Dynamic Research Dimensions

> Architecture for the Skill Builder's research step. An opus planner evaluates
> 18 research dimensions against the domain, selects relevant ones with tailored
> focus lines, sonnet dimension agents run in parallel, and opus consolidation
> produces the clarifications file.

---

## 1. Overview

The research step uses dynamic dimensions to produce targeted clarification questions
for each skill build. Instead of a fixed set of research agents per skill type, a
planner agent evaluates a catalog of 18 dimensions against the specific domain and
selects the relevant subset. Each selected dimension runs as an independent research
agent in parallel. A consolidation agent cross-references all dimension outputs and
produces a cohesive `clarifications.md` file.

Every dimension encodes the **delta principle**: research what Claude gets wrong or
misses when working without the skill. Claude already knows standard methodologies
(Kimball, SCD types, star schemas, standard object models). Dimensions surface the
customer-specific and domain-specific knowledge that produces silently wrong outputs
when absent.

---

## 2. Architecture

Three phases execute sequentially within the research orchestrator:

```
                    Research Orchestrator (sonnet)
 ┌─────────────────────────────────────────────────────────┐
 │                                                         │
 │  Phase 0: Planning (opus)                               │
 │      Receives: skill type, domain, user context,        │
 │                full 18-dimension catalog                 │
 │      Writes: context/research-plan.md                   │
 │      Returns: CHOSEN_DIMENSIONS with tailored focus     │
 │                                                         │
 │  Phase 1: Parallel Research (sonnet x N)                │
 │      ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
 │      │dim 1 │ │dim 2 │ │dim 3 │ │dim 4 │ │dim N │     │
 │      └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘     │
 │         └────────┴────────┴────────┴────────┘           │
 │                        │ all text                       │
 │                        ▼                                │
 │  Phase 2: Consolidation (opus, effort: high)            │
 │      Cross-references all dimension outputs             │
 │      → clarifications.md                                │
 │                                                         │
 └─────────────────────────────────────────────────────────┘
```

**Phase 0 — Planning.** The opus planner receives the skill type, domain name, user
context, and the full 18-dimension catalog. It evaluates every dimension, writes
`context/research-plan.md` for auditability, and returns `CHOSEN_DIMENSIONS:` with
a slug and tailored focus line for each selected dimension. If the planner fails, the
orchestrator falls back to launching `entities`, `metrics`, and `data-quality` with
default focus lines.

**Phase 1 — Parallel Research.** The orchestrator parses `CHOSEN_DIMENSIONS:` and
spawns all selected dimension agents in a single turn via the Task tool. Each agent
receives the domain name and its tailored focus line. Agents return clarification
questions as text -- they write no files.

**Phase 2 — Consolidation.** A fresh opus agent with extended thinking (`effort: high`)
receives all dimension outputs labeled by dimension name. It cross-references findings,
resolves overlapping questions, identifies cross-cutting concerns, and writes the
final `clarifications.md`.

---

## 3. Dimension Catalog

18 dimensions organized into five groups: cross-type (used by multiple skill types),
domain-specific, data-engineering-specific, platform-specific, and source-specific.

### Cross-Type Dimensions

| Slug | Name | Default Focus | Types |
|------|------|---------------|-------|
| `entities` | Entity & Relationship | Identify domain entities, relationships, cardinality constraints, and cross-entity analysis patterns. Focus on what differs from the standard model. | all 4 |
| `data-quality` | Data Quality | Identify pattern-specific quality checks (DE) and org-specific known quality issues (source) beyond generic data quality concepts. | DE, source |

Note: `data-quality` is called `quality-gates` in data-engineering context and
`data-quality` in source context. Same agent, different focus overrides.

### Domain-Specific Dimensions

| Slug | Name | Default Focus | Types |
|------|------|---------------|-------|
| `metrics` | Metrics & KPI | Identify key business metrics, exact calculation formulas, parameter definitions, and where "approximately correct" defaults produce wrong analysis. | domain |
| `business-rules` | Business Rules | Identify business rules affecting data modeling, industry-specific variations, regulatory constraints, and rules engineers commonly implement incorrectly. | domain |
| `segmentation-and-periods` | Segmentation & Periods | Identify specific segmentation breakpoints, fiscal calendar structure, snapshot timing, and cross-period rules constraining metric calculations. | domain |
| `modeling-patterns` | Modeling Patterns | Identify domain-specific modeling decisions: grain choices, field coverage, and interactions between grain choices and downstream query patterns. | domain |

### Data-Engineering-Specific Dimensions

| Slug | Name | Default Focus | Types |
|------|------|---------------|-------|
| `pattern-interactions` | Pattern Interaction & Selection | Identify constraint chains between patterns: how SCD type constrains merge strategy, how merge strategy constrains key design, how historization constrains materialization. | DE |
| `load-merge-patterns` | Load & Merge Strategy | Identify high-water mark column selection, change detection approaches, merge predicate design, idempotency guarantees, failure recovery, backfill strategies, and schema evolution. | DE |
| `historization` | Historization & Temporal Design | Identify when Type 2 breaks down at scale, when snapshots outperform row-versioning, when bitemporal modeling is required vs. overkill, and retention policies. | DE |
| `layer-design` | Silver/Gold Layer Design | Identify where to draw the silver/gold boundary, physical vs. logical dimension conformance, materialization trade-offs specific to pattern choices, and aggregate table design. | DE |

### Platform-Specific Dimensions

| Slug | Name | Default Focus | Types |
|------|------|---------------|-------|
| `platform-behavioral-overrides` | Platform Behavioral Overrides | Identify behavioral deviations from official documentation -- cases where following the docs produces wrong results. | platform |
| `config-patterns` | Configuration Patterns | Identify configuration combinations that fail in practice, version-dependent configuration requirements, adapter version pinning, and breaking changes across version boundaries. | platform |
| `integration-orchestration` | Integration & Orchestration | Identify CI/CD pipeline configuration, authentication handoffs between tools, and multi-tool orchestration workflows specific to the deployment. | platform |
| `operational-failure-modes` | Operational Failure Modes | Identify production failure patterns, undocumented timeout behaviors, concurrency issues, environment-specific error behaviors, and debugging procedures. | platform |

### Source-Specific Dimensions

| Slug | Name | Default Focus | Types |
|------|------|---------------|-------|
| `extraction` | Data Extraction | Identify platform-specific extraction traps, CDC field selection, soft delete detection mechanisms, and parent-child change propagation gaps. | source |
| `field-semantics` | Field Semantic Overrides | Identify fields whose standard meaning is overridden or misleading: managed package field overrides, independently editable field pairs, ISV field interactions. | source |
| `lifecycle-and-state` | Record Lifecycle & State | Identify state machine behaviors, custom stage progressions, lifecycle boundary conditions, record type-specific lifecycle variations. | source |
| `reconciliation` | Cross-System Reconciliation | Identify which numbers should agree between systems but don't, source-of-truth resolution for conflicting data, tolerance levels. | source |

---

## 4. Assignment Matrix

| Dimension | domain | data-eng | platform | source |
|-----------|:------:|:--------:|:--------:|:------:|
| **Cross-type** | | | | |
| `entities` | x | x | x | x |
| `data-quality` | - | x | - | x |
| **Domain** | | | | |
| `metrics` | x | - | - | - |
| `business-rules` | x | - | - | - |
| `segmentation-and-periods` | x | - | - | - |
| `modeling-patterns` | x | - | - | - |
| **Data-engineering** | | | | |
| `pattern-interactions` | - | x | - | - |
| `load-merge-patterns` | - | x | - | - |
| `historization` | - | x | - | - |
| `layer-design` | - | x | - | - |
| **Platform** | | | | |
| `platform-behavioral-overrides` | - | - | x | - |
| `config-patterns` | - | - | x | - |
| `integration-orchestration` | - | - | x | - |
| `operational-failure-modes` | - | - | x | - |
| **Source** | | | | |
| `extraction` | - | - | - | x |
| `field-semantics` | - | - | - | x |
| `lifecycle-and-state` | - | - | - | x |
| `reconciliation` | - | - | - | x |
| | | | | |
| **Dimension count** | **5** | **6** | **5** | **6** |

The matrix represents defaults. The planner can add cross-type dimensions when the
domain genuinely crosses type boundaries (e.g., a data-engineering skill about CDC
pipelines might benefit from `extraction`).

---

## 5. Agent Structure

All agents are flat `.md` files in a single `agents/` directory. No subdirectories,
no generated files, no build system. 25 files total:

```
agents/
├── research-planner.md                  # opus planner
├── research-orchestrator.md             # sonnet orchestrator
├── consolidate-research.md              # opus consolidation
├── research-entities.md                 # dimension: cross-type
├── research-data-quality.md             # dimension: cross-type
├── research-metrics.md                  # dimension: domain
├── research-business-rules.md           # dimension: domain
├── research-segmentation-and-periods.md # dimension: domain
├── research-modeling-patterns.md        # dimension: domain
├── research-pattern-interactions.md     # dimension: DE
├── research-load-merge-patterns.md      # dimension: DE
├── research-historization.md            # dimension: DE
├── research-layer-design.md             # dimension: DE
├── research-platform-behavioral-overrides.md  # dimension: platform
├── research-config-patterns.md          # dimension: platform
├── research-integration-orchestration.md      # dimension: platform
├── research-operational-failure-modes.md      # dimension: platform
├── research-extraction.md               # dimension: source
├── research-field-semantics.md          # dimension: source
├── research-lifecycle-and-state.md      # dimension: source
├── research-reconciliation.md           # dimension: source
├── confirm-decisions.md                 # step 5
├── detailed-research.md                 # step 3
├── generate-skill.md                    # step 6
└── validate-skill.md                    # step 7
```

Each dimension agent follows the same structure:
- **Frontmatter**: name, description, `model: sonnet`, standard tool set
- **Role**: one-sentence role statement with a domain persona (e.g., "Senior Business Analyst", "Senior Data Engineer")
- **Context**: receives domain name and planner's tailored focus line; writes no files
- **Instructions**: goal, default focus, delta principle, research approach, constraints (5-8 questions, choices with "Other", return text only)
- **Success criteria**: dimension-specific quality checks

---

## 6. Planner Design

The planner (`research-planner.md`) is an opus agent that decides which dimensions to
research and how to focus them for the specific domain.

### Inputs

The orchestrator passes:
- **Skill type** -- `domain`, `data-engineering`, `platform`, or `source`
- **Domain name** -- e.g., "sales pipeline", "Salesforce", "dbt on Fabric"
- **User context** -- any additional context provided during init (may be empty)
- **Dimension catalog** -- all 18 dimensions with names and default focus lines

### Process

The planner evaluates every dimension against the domain:

1. **Start with obvious fits.** Dimensions clearly relevant to this domain get included
   with tailored focus lines.
2. **Scan every remaining dimension.** For each, ask: "If an engineer uses Claude Code
   to build silver/gold tables for this domain without this knowledge, what will Claude
   get wrong?" Include any that surface genuine delta.
3. **Exclude with reasoning.** Each excluded dimension gets a specific explanation of
   what Claude already handles correctly without it.

### Outputs

1. **`context/research-plan.md`** -- decision table covering all 18 dimensions
   (included and excluded) with reasoning, for auditability.
2. **`CHOSEN_DIMENSIONS:` text** -- returned to the orchestrator with the slug and
   tailored focus line for each selected dimension.

### Focus Line Tailoring

Focus lines are the **sole source of domain context** for dimension agents. The planner
embeds entity examples, metric names, pattern types, and platform specifics directly
into each focus line. "Identify sales pipeline metrics like coverage ratio, win rate,
velocity, and where standard formulas diverge from company-specific definitions" is
better than "Identify key business metrics."

### Constraints

- `entities` is always included.
- The plan file covers all 18 dimensions -- no omissions.
- One sentence of reasoning per dimension.

---

## 7. Per-Type Focus Overrides

Two cross-type dimensions (`entities` and `data-quality`) receive different focus
lines depending on the skill type. Four expanded dimensions carry additional focus
content beyond their defaults.

### `entities` by Type

| Type | Focus Override |
|------|---------------|
| **domain** | Business entities, customer hierarchies, organizational relationships, and cross-entity analysis patterns |
| **data-engineering** | Entity classification (dimension vs. fact vs. bridge vs. reference), grain decisions per entity, surrogate key strategy, natural key composition, conformed dimension identification |
| **platform** | Platform resources, environment-specific resource distinctions, configuration objects, and dependency relationships |
| **source** | Custom objects, managed package objects, record type subdivisions, and non-standard relationships. Do NOT enumerate standard objects Claude already knows. Include installed managed packages, schema extensions, and standard field overrides. |

### `data-quality` by Type

| Type | Focus Override |
|------|---------------|
| **data-engineering** (as `quality-gates`) | Pattern-specific quality checks: per-layer validation rules, cross-layer reconciliation accounting for row multiplication, quality gate thresholds, pipeline failure response (halt vs. quarantine vs. continue) |
| **source** (as `data-quality`) | Known data quality issues in the source system: fields commonly null or unreliable, validation rules forcing incorrect data entry, data cleanup jobs, quality expectations for downstream consumers |

### Expanded Dimensions

| Dimension | Additional Focus |
|-----------|-----------------|
| **`extraction`** (source) | CDC field selection (which timestamp captures all changes including system-initiated), soft delete detection mechanisms, parent-child change propagation gaps |
| **`field-semantics`** (source) | Which managed packages modify which fields and on what schedule, ISV field interactions, package update impact on field semantics |
| **`config-patterns`** (platform) | Version-dependent configuration requirements, adapter version pinning, multi-axis compatibility (core x adapter x runtime), breaking changes across version boundaries |
| **`load-merge-patterns`** (DE) | Failure recovery patterns, backfill strategies for historized data (Type 2 backfill requires historical source snapshots), schema evolution in versioned tables, orchestration monitoring for drift |

---

## 8. Consolidation

A single opus agent with extended thinking (`effort: high`) consolidates all dimension
outputs into the final `clarifications.md`.

The consolidation agent receives the returned text from every dimension agent that ran,
each labeled with its dimension name (e.g., "Entities Research:", "Metrics Research:").
It performs deep reasoning to:

- **Cross-reference** findings across dimensions (e.g., entity decisions that affect
  pipeline pattern choices, metrics that constrain layer design)
- **Resolve overlaps** where multiple dimensions surface similar questions from
  different angles
- **Identify gaps** where template sections lack coverage from any dimension
- **Order questions** so earlier answers inform later choices
- **Produce a cohesive file** with logical section flow that a PM can answer efficiently

If the consolidation agent fails, the orchestrator performs consolidation directly as
a fallback.
