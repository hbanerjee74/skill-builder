# Skill Builder — Agent Instructions

Auto-loaded into every agent's system prompt. Do not read manually.

## Domain Focus

This workspace generates skills for **data engineering** on the following stack:

| Layer | Tool | Role |
|---|---|---|
| Ingestion (bronze) | **dlt** (dlthub) | EL pipelines → ADLS Gen2 / OneLake |
| Transformation (silver/gold) | **dbt** (dbt-fabric) | SQL models in medallion architecture |
| Observability | **elementary** | Anomaly detection, schema monitoring |
| Platform | **Microsoft Fabric** on Azure | Lakehouse, Delta tables, SQL analytics |
| CI/CD | **GitHub Actions** | Slim CI, OIDC auth, SQLFluff |

**Documentation source**: [Context7](https://context7.com) provides up-to-date docs and code examples for all libraries in this stack. Agents should use Context7 (via `resolve-library-id` → `query-docs`) to look up current API docs, configuration references, and code patterns. Skills should NOT rehash what Context7 already provides — focus on what's missing from official docs.

All agents should calibrate content depth, examples, and anti-patterns to this stack. Skills outside it still work but won't receive specialized guidance.

## Protocols

### User Context

The user's `user-context.md` file (in the workspace directory) contains their industry, role, audience, challenges, scope, unique setup, and what Claude gets wrong. Every agent must use this context to tailor output.

**Resolution order:**
1. **Inline** — orchestrators embed the full `user-context.md` content in sub-agent prompts under a `## User Context` heading. Use this first.
2. **File fallback** — if inline content is missing, read `user-context.md` from the workspace directory.
3. **Report missing** — if both fail, prefix your response with `[USER_CONTEXT_MISSING]` and continue with best effort. Parent orchestrators detect this marker and warn in their output.

**Orchestrator responsibility:** Read `user-context.md` early (Phase 0) and embed inline in every sub-agent prompt. Pass the workspace directory path as fallback.

**Workspace directory contents:** The workspace directory only contains `user-context.md`. Do not read or list any other files or subdirectories (e.g. `logs/`).

### Scope Recommendation Guard

When `scope_recommendation: true` appears in the YAML frontmatter of `clarifications.md` or `decisions.md`, the scope was too broad and a recommendation was issued instead of normal output. Every agent that runs after research (detailed-research, confirm-decisions, generate-skill, validate-skill) must check this before starting work. If detected: write any required stub output files (see agent-specific instructions), then return immediately. Do NOT spawn sub-agents, analyze content, or generate output.

### Sub-agent Spawning

Use the Task tool. Launch ALL Task calls in the **same turn** so they run in parallel. Name sub-agents descriptively (e.g., `"writer-<topic>"`, `"reviewer"`, `"tester-N"`).

Sub-agents return text, not files. The orchestrator writes all output to disk. Include this directive in every sub-agent prompt:
> Do not provide progress updates. Return your complete output as text. Do not write files. List outcomes, not process — omit reasoning steps, search narratives, and intermediate analysis.

Exception: sub-agents may write files directly when the orchestrator explicitly delegates this (e.g., consolidator writing `clarifications.md`).

---

## Output Paths

The coordinator provides **context directory** and **skill output directory** paths.
- All directories already exist — never run `mkdir`
- Write directly to the provided paths
- Skill output structure: `SKILL.md` at root + `references/` subfolder

## Skill Generation Guidance

Content principles, skill structure rules, quality dimensions, stack conventions, and anti-patterns are maintained in an imported skill. Check the Imported Skills section below for the active skill providing this guidance. Agents generating, validating, or refining skills should read that skill's SKILL.md and reference files.

## Customization

Add your workspace-specific instructions below. This section is preserved across app updates and skill changes.
