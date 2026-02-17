# Stage 1: Platform Skill Research Dimensions

**Skill type**: Platform (tool-specific -- e.g., dbt, dlt, Fabric, Terraform, Kubernetes)

**Reasoning anchor**: dbt on Microsoft Fabric

---

## Proposed Template Structure for Platform Skills

Platform skills encode the delta between "reading the official docs" and having battle-tested expertise deploying and operating the platform in a specific environment. Claude has extensive parametric knowledge of popular platforms -- their APIs, configuration syntax, and documented behaviors. The genuine delta falls into these categories: environment-specific behavioral deviations, undocumented feature interactions, configuration patterns that look correct but fail, version-specific breaking changes, and operational patterns learned only through production incidents.

### Section 1: Platform Behavioral Overrides

**What it covers**: Cases where the platform's actual behavior deviates from its documentation or from Claude's parametric knowledge, specific to the target environment. These are the "dbt docs say X, but on Fabric X actually behaves as Y" items.

**Why it's needed (distinct from other sections)**: This is the highest-value section in a platform skill. Claude confidently produces answers based on official documentation. When the platform behaves differently in a specific environment (e.g., dbt materializations on Fabric vs. Snowflake), Claude's confident-but-wrong answers are worse than no answer because they bypass the engineer's natural caution. No other section captures behavioral deviations -- other sections cover configuration, integration, or deployment, not "the docs are wrong here."

**Example content (dbt on Fabric)**:
- `incremental` materialization with `merge` strategy silently falls back to `delete+insert` on Fabric Lakehouse because T-SQL MERGE has restrictions on Lakehouse tables
- `dbt snapshot` timestamp strategy fails when Fabric's datetime2 precision differs from the source
- Fabric warehouse vs. Lakehouse endpoints affect which SQL features are available -- dbt model SQL that works against the warehouse endpoint fails against the Lakehouse endpoint without clear error messages

### Section 2: Configuration Patterns and Anti-Patterns

**What it covers**: Configuration schemas, project structure patterns, and common configuration mistakes. Includes valid configurations that produce unexpected results, required settings that have non-obvious defaults, and configuration combinations that interact poorly.

**Why it's needed (distinct from other sections)**: Claude can generate syntactically valid configuration files from documentation. It cannot surface which configurations look correct but fail in practice, which defaults are dangerous, or which configuration combinations produce unexpected interactions. This section captures operational configuration knowledge -- the "this YAML is valid but will bite you" patterns.

**Example content (dbt on Fabric)**:
- `profiles.yml` connection settings: `driver` must be `ODBC Driver 18 for SQL Server` on Fabric, not the `ODBC Driver 17` shown in many dbt tutorials
- `threads` setting above 8 causes throttling on Fabric SQL endpoint -- unlike Snowflake where 16-32 threads is common
- `dispatch` config for cross-database macros: Fabric requires explicit dispatch overrides for `dbt_utils` because the default implementations use Snowflake/Postgres SQL syntax

### Section 3: Version Compatibility and Migration

**What it covers**: Version-specific behavioral changes, adapter version pinning requirements, breaking changes between versions, and migration procedures. Includes the interaction between platform version, adapter/plugin version, and runtime environment version.

**Why it's needed (distinct from other sections)**: Claude's training data contains documentation for multiple versions without clear version boundaries. It may produce advice valid for dbt-core 1.5 when the customer runs 1.7, or recommend dbt-fabric adapter features that require a specific minimum version. Version interactions (dbt-core version x dbt-fabric adapter version x Fabric runtime version) create a combinatorial space that documentation covers poorly and Claude's parametric knowledge conflates.

**Example content (dbt on Fabric)**:
- dbt-fabric adapter v1.6+ required for `incremental` materialization support; earlier versions silently fall back to `table`
- dbt-core 1.7 changed the `--select` syntax for indirect selection, breaking CI scripts that worked on 1.6
- Fabric runtime updates (monthly) can change available T-SQL functions without dbt adapter changes -- models that worked last month may fail after a Fabric update

### Section 4: Integration and Orchestration Patterns

**What it covers**: How the platform integrates with other tools in the stack, orchestration patterns, CI/CD pipelines, and multi-tool workflows. Includes authentication handoffs, state passing between tools, and the operational patterns for running the platform in production.

**Why it's needed (distinct from other sections)**: Claude knows individual tool documentation but lacks knowledge of how tools interact in real deployments. Integration patterns are learned through production experience -- which CI/CD patterns work with Fabric's deployment model, how dbt's artifacts are consumed by downstream tools, and how authentication flows work across tool boundaries. This section captures the "glue" knowledge that lives in team wikis, not documentation.

**Example content (dbt on Fabric)**:
- Azure DevOps pipelines for dbt on Fabric: Service Principal authentication requires specific API permissions not documented in the dbt-fabric adapter docs
- dbt artifacts (`manifest.json`, `run_results.json`) must be uploaded to a specific Fabric Lakehouse path for downstream Fabric notebooks to consume them
- Fabric Data Factory pipelines can trigger dbt runs but timeout handling requires custom retry logic -- Fabric's default timeout behavior differs from Azure Data Factory

### Section 5: Operational Gotchas and Failure Modes

**What it covers**: Production failure patterns, debugging procedures, performance pitfalls, and operational knowledge that prevents or resolves incidents. These are the "things that break at 2am" items -- knowledge accumulated from operating the platform under real conditions.

**Why it's needed (distinct from other sections)**: This captures operational tribal knowledge that doesn't exist in documentation. Claude can explain how a feature works; it cannot predict how a feature fails. Platform skills without this section produce engineers who can set up the platform but cannot diagnose or prevent production failures. This is distinct from behavioral overrides (Section 1: the platform works differently than documented) and configuration anti-patterns (Section 2: the config looks valid but isn't) -- this section covers runtime operational failure modes.

**Example content (dbt on Fabric)**:
- Fabric SQL endpoint has a 30-minute query timeout that is not configurable -- long-running dbt models fail with an opaque "connection closed" error, not a timeout message
- Concurrent dbt runs against the same Fabric Lakehouse can cause metadata lock contention, producing intermittent "table not found" errors on models that exist
- `dbt test` failures on Fabric produce different error formats than Snowflake/BigQuery -- custom CI parsing scripts need environment-specific regex patterns

### Section 6: Environment-Specific Constraints

**What it covers**: Constraints, limitations, and capabilities specific to the deployment environment that affect how the platform should be configured and used. This includes compute limits, storage semantics, security model differences, and cost optimization patterns.

**Why it's needed (distinct from other sections)**: Many platforms run on multiple environments (dbt on Snowflake vs. BigQuery vs. Fabric; Terraform with AWS vs. Azure vs. GCP; Kubernetes on EKS vs. AKS vs. GKE). Claude's parametric knowledge typically favors the most popular environment (Snowflake for dbt, AWS for Terraform). Environment-specific constraints fundamentally change correct answers -- materializations, performance tuning, cost patterns, and security models all vary by environment. Without this section, the skill produces advice optimized for the wrong environment.

**Example content (dbt on Fabric)**:
- Fabric Lakehouse tables are Delta Lake format -- this affects MERGE behavior, schema evolution, and partition strategies differently from Snowflake's micro-partitions
- Fabric capacity units (CU) billing means query cost optimization differs fundamentally from Snowflake's credit model -- what's cheap on Snowflake may be expensive on Fabric
- Fabric's OneLake security model uses workspace-level RBAC, not table-level grants -- dbt's `grant` configurations have no effect

---

## Research Dimensions

### Dimension 1: `platform-behavioral-overrides` -- Platform Behavioral Override Research

**What it researches**: Surfaces cases where the platform behaves differently than its documentation states or than Claude would predict from parametric knowledge, specific to the customer's environment. Asks: where does official documentation diverge from actual behavior? Where does Claude confidently produce wrong answers because its training data reflects a different environment (e.g., Snowflake-centric dbt knowledge applied to Fabric)?

**Proposed template section(s) it informs**: Section 1 (Platform Behavioral Overrides), Section 6 (Environment-Specific Constraints)

**Delta justification**: Claude's parametric knowledge of platforms comes primarily from official documentation and popular-environment usage. For dbt, this means Snowflake/BigQuery-centric knowledge. Claude does not know that `merge` strategy silently degrades on Fabric Lakehouse, that datetime2 precision causes snapshot failures, or that warehouse vs. Lakehouse endpoints change available SQL features. These are experiential findings that accumulate only through operating the platform in the specific environment. Claude can describe dbt materializations accurately from docs; it cannot surface where those descriptions are wrong for Fabric.

**What goes wrong if skipped**: The skill produces advice that is correct-per-documentation but wrong-in-practice. Engineers follow skill guidance, write models using `merge` strategy for incremental materializations, and discover at deploy time that the strategy silently degrades. Worse, some behavioral overrides produce silently wrong data rather than errors -- the engineer doesn't discover the problem until a downstream consumer notices discrepancies. This is the platform equivalent of the source-system "silently wrong data" failure mode.

**Example questions (dbt on Fabric)**:
- "Which dbt materializations behave differently on Fabric compared to the dbt documentation? Specifically, do `incremental`, `snapshot`, and `ephemeral` materializations work as documented, or are there Fabric-specific behavioral differences?"
- "Are there T-SQL dialect limitations in Fabric that affect dbt-generated SQL? For example, window functions, CTEs, or MERGE statements that work on Snowflake but fail or behave differently on Fabric?"
- "Does the Fabric SQL endpoint vs. Lakehouse endpoint distinction affect which dbt features are available? If so, which endpoint does your team target and what limitations have you encountered?"

---

### Dimension 2: `config-patterns` -- Configuration Pattern Research

**What it researches**: Surfaces configuration schemas, project structure patterns, and dangerous configuration combinations. Asks: which configurations look valid but fail in practice? Which defaults are dangerous? Which configuration settings interact in non-obvious ways?

**Proposed template section(s) it informs**: Section 2 (Configuration Patterns and Anti-Patterns), Section 3 (Version Compatibility and Migration)

**Delta justification**: Claude can generate syntactically valid configuration files by assembling documented options. It cannot reason about which configurations produce unexpected runtime behavior because that knowledge comes from production experience, not documentation. The combinatorial space of configuration options is too large for documentation to cover exhaustively -- a `profiles.yml` with 15 settings has thousands of valid combinations, but only a subset work well in a specific environment. Claude does not know that `threads: 16` causes Fabric throttling, that specific ODBC driver versions are required, or that `dispatch` overrides are mandatory for `dbt_utils` on Fabric.

**What goes wrong if skipped**: Engineers use Claude-generated configurations that pass syntax validation but fail at runtime or produce poor performance. Debugging configuration issues is particularly costly because the configuration is "correct" -- the engineer looks for bugs in model SQL rather than questioning the project configuration. Configuration anti-patterns can also cause intermittent failures that are hard to reproduce, leading to extended debugging sessions.

**Example questions (dbt on Fabric)**:
- "What `profiles.yml` settings are Fabric-specific? Are there connection settings, driver versions, or authentication parameters that differ from the dbt documentation defaults?"
- "What `dbt_project.yml` settings have you found need Fabric-specific values? For example, `threads`, `dispatch` config for macros, or `on_run_start`/`on_run_end` hooks?"
- "Are there dbt package configurations (e.g., `dbt_utils`, `dbt_expectations`) that require Fabric-specific dispatch or adapter overrides to work correctly?"

---

### Dimension 3: `version-compat` -- Version Compatibility Research

**What it researches**: Surfaces version-specific behavioral changes, version pinning requirements, breaking changes across versions, and the interaction between multiple version axes (platform core version, adapter/plugin version, runtime environment version). Asks: which version combinations work? Which version upgrades break existing setups? What migration procedures are needed?

**Proposed template section(s) it informs**: Section 3 (Version Compatibility and Migration)

**Delta justification**: Claude's training data contains documentation for multiple versions without version boundaries. When asked "how do I configure incremental materialization in dbt?", Claude may mix advice from dbt-core 1.5 and 1.7, or from dbt-fabric adapter v1.4 and v1.6. The version interaction space (dbt-core x dbt-fabric adapter x Fabric runtime) is poorly documented because each project documents its own version changes without cross-referencing the others. Engineers and platform teams accumulate this knowledge through painful upgrades. Claude cannot reliably produce "this feature requires adapter v1.6+ AND dbt-core 1.7+" because that information exists in GitHub issues and changelog cross-references, not in coherent documentation.

**What goes wrong if skipped**: The skill recommends features or patterns that don't work with the customer's pinned versions. Engineers attempt to use an incremental materialization pattern that requires a newer adapter version, encounter cryptic errors, and spend hours debugging before discovering the version mismatch. Worse, version upgrade guidance that doesn't account for cross-version interactions can break a working setup -- upgrading dbt-core without upgrading the adapter may silently change behavior.

**Example questions (dbt on Fabric)**:
- "Which versions of dbt-core and dbt-fabric adapter does your team currently use? Are these pinned, and what is your upgrade cadence?"
- "Have you encountered breaking changes when upgrading the dbt-fabric adapter or when Fabric runtime updates rolled out? What were the symptoms and how did you resolve them?"
- "Are there features you'd like to use but can't due to version constraints (e.g., incremental materializations requiring a minimum adapter version)?"

---

### Dimension 4: `integration-orchestration` -- Integration and Orchestration Research

**What it researches**: Surfaces how the platform connects to other tools in the customer's stack, CI/CD pipeline patterns, authentication handoffs between tools, and orchestration workflows. Asks: how does this platform fit into the broader toolchain? What are the integration points and failure modes?

**Proposed template section(s) it informs**: Section 4 (Integration and Orchestration Patterns)

**Delta justification**: Claude knows individual tool documentation but not how tools interact in real deployments. The integration layer (CI/CD pipelines, authentication flows across tool boundaries, artifact passing between tools) is where most production complexity lives. This knowledge exists in team-specific runbooks and CI/CD configurations, not in platform documentation. Claude cannot predict that Azure DevOps Service Principal authentication for dbt on Fabric requires specific API permissions undocumented in the adapter docs, or that Fabric Data Factory pipeline timeout behavior differs from Azure Data Factory's documented behavior.

**What goes wrong if skipped**: The skill treats the platform in isolation. Engineers can configure and run the platform locally but struggle to integrate it into CI/CD, orchestration, and production workflows. Integration failures are the most common cause of "works on my machine, fails in production" -- the platform itself works fine but authentication, artifact passing, or orchestration timing fails at the boundaries. Without integration patterns, every team rediscovers these issues independently.

**Example questions (dbt on Fabric)**:
- "How does your team orchestrate dbt runs in production? (e.g., Azure DevOps, Fabric Data Factory, Airflow, manual). What authentication method is used for automated runs?"
- "Does your dbt deployment integrate with other Fabric components (Notebooks, Data Factory, Power BI)? If so, how are artifacts (manifest.json, run results) passed between tools?"
- "What is your CI/CD pipeline for dbt changes? Does it include automated testing, and how does it handle Fabric-specific deployment steps (e.g., workspace deployment, capacity management)?"

---

### Dimension 5: `operational-failure-modes` -- Operational Failure Mode Research

**What it researches**: Surfaces production failure patterns, debugging procedures, performance pitfalls, and operational tribal knowledge. Asks: what breaks in production? How do you debug it? What performance gotchas have you learned the hard way?

**Proposed template section(s) it informs**: Section 5 (Operational Gotchas and Failure Modes), Section 6 (Environment-Specific Constraints)

**Delta justification**: This is perhaps the highest-delta dimension for platform skills. Claude can explain how platform features work; it categorically cannot predict how they fail. Operational failure modes are learned exclusively from production experience -- from incident postmortems, from debugging sessions, from monitoring alerts. Documentation describes happy paths; operational knowledge encodes failure paths. Claude does not know that Fabric's SQL endpoint has an unconfigurable 30-minute query timeout, that concurrent dbt runs cause metadata lock contention on Lakehouse tables, or that `dbt test` error formats differ between target environments and break CI parsing scripts.

**What goes wrong if skipped**: The skill produces engineers who can set up and run the platform but cannot diagnose or prevent production failures. They learn failure modes through incidents rather than through the skill, negating much of the skill's value. Platform skills without operational knowledge are equivalent to handing someone a user manual without a troubleshooting guide -- adequate for initial setup, useless when things go wrong.

**Example questions (dbt on Fabric)**:
- "What are the most common production failures you've encountered running dbt on Fabric? (e.g., query timeouts, metadata lock contention, connection drops). What were the root causes and resolutions?"
- "Are there Fabric-specific resource limits (query timeout, concurrent query limits, capacity throttling) that affect dbt model design or scheduling decisions?"
- "What monitoring or alerting do you have for dbt runs on Fabric? What signals indicate a problem before it becomes an incident?"

---

### Dimension 6: `entities` -- Entity and Resource Research

**What it researches**: Surfaces the core platform resources, configuration objects, state representations, and their dependency relationships. For platform skills, entities are the objects the platform manages -- not business entities, but technical resources with lifecycle, state, and dependency semantics.

**Proposed template section(s) it informs**: Section 2 (Configuration Patterns and Anti-Patterns), Section 6 (Environment-Specific Constraints)

**Delta justification**: This dimension is retained from the existing catalog. Claude knows standard platform entities from documentation (dbt: models, sources, seeds, snapshots; Terraform: resources, modules, providers). The delta is in the customer-specific entity taxonomy -- which entities they actually use, which they've extended or customized, and which dependency relationships they've established. For dbt on Fabric, the interesting entities are environment-specific: Lakehouse tables vs. warehouse tables, workspace-scoped objects, OneLake artifacts. These entity distinctions affect materialization choices, access patterns, and deployment strategies.

**What goes wrong if skipped**: The skill uses generic platform entity terminology that doesn't match the customer's actual resource model. For dbt on Fabric, treating all target tables as equivalent misses the Lakehouse/warehouse distinction that fundamentally affects materialization strategy, query performance, and data access patterns. Entity research grounds the other dimensions in the customer's specific resource topology.

**Example questions (dbt on Fabric)**:
- "Does your dbt project target Fabric Lakehouse tables, warehouse tables, or both? If both, what determines which models go to which target?"
- "What Fabric resources does your dbt project interact with beyond tables? (e.g., Lakehouse files, Notebooks, Power BI semantic models, Data Factory pipelines)"
- "How is your dbt project structured? (e.g., single project vs. monorepo, number of models, use of packages, source definitions)"

---

## Dimensions Evaluated but NOT Recommended

### `api-patterns` (from existing catalog) -- Recommend REMOVAL or MERGE

**Current definition**: Research tool capabilities, API structures, integration constraints, and platform-specific configuration.

**Why it should be removed or merged**: For platform skills, "API patterns" is too broad and overlaps heavily with multiple proposed dimensions. API rate limiting and pagination are relevant for source skills (calling external APIs to extract data), but platform skills are about using a tool, not calling its API. The relevant API knowledge for platforms is captured by:
- Configuration patterns (Section 2) -- how to configure the tool
- Integration patterns (Section 4) -- how the tool integrates with other tools via APIs
- Operational failure modes (Section 5) -- API errors and debugging

A standalone "API patterns" dimension for platforms would produce generic questions about REST endpoints and rate limits that Claude can already answer. The genuine delta is split across the more specific dimensions above.

**If retained**: Merge into `integration-orchestration` with a platform-specific focus override: "Focus on how the platform's CLI, API, and SDK are used in automation, CI/CD, and multi-tool orchestration -- not on API structure itself, which Claude knows from documentation."

### `deployment` (from existing catalog) -- Recommend MERGE into `integration-orchestration` and `config-patterns`

**Current definition**: Research deployment patterns, state management, and migration strategies.

**Why it should be merged**: "Deployment" for platforms is not a standalone research area -- it's the intersection of configuration (how to configure for deployment), integration (CI/CD pipelines that perform deployment), and version management (what changes during deployment). A standalone deployment dimension produces questions like "How do you deploy?" and "How do you manage state?" which are too broad to produce actionable skill content.

The deployment knowledge splits naturally:
- Deployment *configuration* --> `config-patterns` (Section 2)
- Deployment *pipelines and automation* --> `integration-orchestration` (Section 4)
- Deployment *version management* --> `version-compat` (Section 3)

### `authentication` -- Not applicable to platform skills

Authentication for platform skills is a sub-concern of integration (how the platform authenticates in CI/CD and multi-tool workflows), not a standalone dimension. It's correctly assigned to source skills where auth flows are a primary concern.

---

## Summary: Dimension-to-Template Section Mapping

| Dimension | Slug | Template Sections Informed |
|-----------|------|---------------------------|
| Platform Behavioral Override Research | `platform-behavioral-overrides` | S1: Platform Behavioral Overrides, S6: Environment-Specific Constraints |
| Configuration Pattern Research | `config-patterns` | S2: Configuration Patterns and Anti-Patterns, S3: Version Compatibility |
| Version Compatibility Research | `version-compat` | S3: Version Compatibility and Migration |
| Integration and Orchestration Research | `integration-orchestration` | S4: Integration and Orchestration Patterns |
| Operational Failure Mode Research | `operational-failure-modes` | S5: Operational Gotchas and Failure Modes, S6: Environment-Specific Constraints |
| Entity and Resource Research | `entities` | S2: Configuration Patterns, S6: Environment-Specific Constraints |

### Template Section Coverage Check

| Template Section | Dimensions Feeding It |
|-----------------|----------------------|
| S1: Platform Behavioral Overrides | `platform-behavioral-overrides` |
| S2: Configuration Patterns and Anti-Patterns | `config-patterns`, `entities` |
| S3: Version Compatibility and Migration | `version-compat`, `config-patterns` |
| S4: Integration and Orchestration Patterns | `integration-orchestration` |
| S5: Operational Gotchas and Failure Modes | `operational-failure-modes` |
| S6: Environment-Specific Constraints | `platform-behavioral-overrides`, `operational-failure-modes`, `entities` |

Every template section has at least one dimension feeding it. Every dimension feeds at least one template section. No orphaned dimensions or sections.

---

## Comparison to Existing Catalog

### Current Platform Dimensions (from `dynamic-research-dimensions.md`)

| Current Dimension | Disposition | Rationale |
|-------------------|------------|-----------|
| `entities` | **Retained** (as dimension 6) | Still needed to ground other dimensions in the customer's resource model. Focus override adjusted from "platform resources, configuration objects, state representations" to emphasize environment-specific resource distinctions. |
| `api-patterns` | **Removed / Merged** | Too broad for platforms; overlaps with `config-patterns` and `integration-orchestration`. API structure is parametric knowledge; the delta is in how APIs are used in automation. |
| `integration` | **Replaced** by `integration-orchestration` | Broadened to explicitly include CI/CD and orchestration, which is where most platform integration complexity lives. The old focus on "multi-tool orchestration edge cases" is retained but contextualized within deployment workflows. |
| `deployment` | **Removed / Merged** | Not a standalone research area for platforms. Deployment knowledge splits naturally into configuration, integration/CI-CD, and version management. |

### New Dimensions (not in existing catalog)

| New Dimension | Why It's Needed |
|---------------|-----------------|
| `platform-behavioral-overrides` | The single highest-delta dimension for platform skills. Captures "docs say X, reality is Y" -- knowledge Claude cannot produce from training data because its training data IS the docs. No existing dimension covers this. |
| `config-patterns` | Replaces the configuration aspect of `api-patterns` and `deployment`. More focused: specifically about configuration schemas and anti-patterns, not APIs or deployment procedures. |
| `version-compat` | No existing dimension covers version interaction spaces. Claude's version-conflated training data makes this a genuine parametric gap. |
| `operational-failure-modes` | No existing dimension covers production failure patterns. Claude describes happy paths; this dimension surfaces failure paths. Highest-delta dimension after behavioral overrides. |

### Net Change

- **Current**: 4 dimensions (entities, api-patterns, integration, deployment)
- **Proposed**: 6 dimensions (entities, platform-behavioral-overrides, config-patterns, version-compat, integration-orchestration, operational-failure-modes)
- **Net**: +2 dimensions, with 2 existing dimensions removed and 4 new dimensions added

The increase from 4 to 6 is justified because the current dimensions are too broad (e.g., `api-patterns` covers everything from rate limiting to configuration) and miss the highest-delta areas (behavioral overrides and operational failure modes). The proposed dimensions are more focused and each maps cleanly to template sections.
