# Validate Skill — Design Note

---

## Overview

`validate-skill` is the orchestrator agent responsible for validating a completed skill. It is invoked in two contexts:

1. **Plugin workflow** — the coordinator (`skills/generate-skill/SKILL.md`) spawns it via `Task(subagent_type: "skill-builder:validate-skill")` after the Generation phase.
2. **Refine workflow** — `refine-skill.md` spawns it when the user runs `/validate` or when a `/rewrite` (no targets) triggers a full regeneration + revalidation cycle.

In both cases the agent is identical; only the caller differs.

---

## Skill Structure

```
agent-sources/workspace/skills/validate-skill/
  SKILL.md                              ← coordinator with full instructions
  references/
    validate-quality-spec.md            ← quality checker: 4-pass assessment
    test-skill-spec.md                  ← test evaluator: 5 test prompts + scoring
    companion-recommender-spec.md       ← companion recommender: gap analysis + recommendations
```

The bundled skill is seeded into the workspace on startup by `seed_bundled_skills` alongside `research` and `skill-builder-practices`.

---

## How It Works

The validate-skill skill is a **read-only computation unit** — it reads skill files, runs three parallel evaluations, and returns findings as inline text. It does not modify any files. The orchestrator handles all file I/O.

**Step 1 — File inventory.** Glob `references/` in the skill output directory to collect all reference file paths.

**Step 2 — Parallel evaluation.** Read the full content of each spec file. Spawn one sub-agent per spec, passing the spec content as instructions plus the paths to the skill files. All three launch in the same turn:

- **Quality checker** (`validate-quality-spec.md`) — 4-pass assessment: coverage & structure, content quality, boundary check, prescriptiveness check. Reads `decisions.md`, `clarifications.md`, `SKILL.md`, all reference files, and `user-context.md`.
- **Test evaluator** (`test-skill-spec.md`) — generates 5 realistic test prompts covering 6 categories, then evaluates each against the skill content (PASS/PARTIAL/FAIL). Reads same files.
- **Companion recommender** (`companion-recommender-spec.md`) — analyzes skipped dimensions (score 2–3 from `research-plan.md`) to identify knowledge gaps, then recommends complementary skills. Reads `SKILL.md`, reference files, `decisions.md`, `research-plan.md`, and `user-context.md`.

**Step 3 — Consolidate.** Synthesize all sub-agent findings into three output sections. No skill files are modified — findings only.

**Return format** — inline text with three delimited sections:

```
=== VALIDATION LOG ===
[full agent-validation-log.md content]
=== TEST RESULTS ===
[full test-skill.md content]
=== COMPANION SKILLS ===
[full companion-skills.md content including YAML frontmatter]
```

**Orchestrator writes:** extracts each section and writes to disk:
- `=== VALIDATION LOG ===` → `{context_dir}/agent-validation-log.md`
- `=== TEST RESULTS ===` → `{context_dir}/test-skill.md`
- `=== COMPANION SKILLS ===` → `{context_dir}/companion-skills.md`

Output file formats are defined in [`../agent-specs/canonical-format.md`](../agent-specs/canonical-format.md).

---

## Scope Recommendation Guard

The orchestrator checks for `scope_recommendation: true` in both `decisions.md` and `clarifications.md` before invoking the skill. If detected, it writes three stub files with `scope_recommendation: true` frontmatter and returns immediately — no skill invocation, no sub-agents. The bundled skill has no awareness of scope recommendation state.

---

## Customization Model

When a team imports a replacement validate-skill skill from the marketplace:

1. `upload_skill_inner` extracts the zip to `.claude/skills/validate-skill/`
2. The orchestrator invokes `.claude/skills/validate-skill/SKILL.md` — the custom skill's coordinator drives validation
3. The custom skill's reference specs control quality criteria, test categories, and companion recommendation logic
4. The team can deactivate to revert to the bundled defaults

Teams can customise: quality check criteria, test prompt categories and scoring rubric, companion recommendation scoring. The output file names and YAML frontmatter schemas are app-controlled contracts defined in the canonical format spec.
