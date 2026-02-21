# Skills Marketplace — Design Note

---

## Overview

The marketplace is a one-way import layer — skills flow in from a GitHub repo, never out. Two distinct populations of skills exist in the app, and the marketplace feeds both:

| | **Settings → Skills** | **Skill Library** |
|---|---|---|
| **Purpose** | App infrastructure — powers the workflow agents | Domain knowledge — skills users create, import, and refine |
| **Examples** | `research`, `validate-skill`, `skill-builder-practices` | Sales Pipeline Analytics, dbt Incremental Silver |
| **Storage** | `workspace_path/.claude/skills/` (agent workspace) | `skills_path/` (user-configured output directory) |
| **Wired into** | Agent workspace CLAUDE.md | Dashboard + Refine page |
| **DB tables** | `imported_skills` only | `imported_skills` + `workflow_runs` |

A data engineer installing a custom `research` skill in Settings→Skills is changing how the workflow itself runs. A data engineer importing a domain skill into the Skill Library is acquiring a finished knowledge package to deploy to their own Claude Code projects.

The `skill_type` frontmatter field drives the routing: `skill-builder` type skills belong in Settings→Skills; `domain`, `platform`, `source`, and `data-engineering` skills belong in the Skill Library.

---

## Settings → Skills

Skills in this layer are loaded into the agent workspace and wired into CLAUDE.md as custom skills. Claude Code reads them during agent runs. Changing what's here changes how the workflow behaves.

**Three ways skills enter this layer:**

1. **Bundled** — shipped with the app, seeded by `seed_bundled_skills` on startup. Always overwrite on seed; `is_active` state is preserved across re-seeds. Cannot be deleted — only deactivated.

2. **Marketplace import** (Settings→Skills browse dialog) — scans the configured marketplace repo, filtered to `skill_type='skill-builder'`. Downloads to `workspace_path/.claude/skills/`, inserts into `imported_skills` only. No dashboard entry.

3. **Zip upload** — extracts to `workspace_path/.claude/skills/`. Mandatory frontmatter: `name`, `domain`, `description`. Always forces `skill_type='skill-builder'` regardless of frontmatter.

**Active/inactive toggle** — deactivating moves the skill directory from `skills/` to `skills/.inactive/`. The DB is updated first; if the file move fails, the DB update is rolled back. CLAUDE.md is rebuilt after every toggle.

---

## Skill Library

Skills in this layer are the product of Skill Builder — domain knowledge packages that live alongside built skills in the dashboard and are immediately refinable.

**Two ways skills enter this layer:**

1. **Built** — created via the full workflow (Research → Decisions → Generation → Validation). Tracked in `workflow_runs` with `source='created'`.

2. **Marketplace import** (dashboard browse dialog or skill creation prompt) — scans the configured marketplace repo, filtered to domain-type skills. Downloads to `skills_path/`, inserts into both `imported_skills` and `workflow_runs` with `source='marketplace'`, `status='completed'`. Appears in the dashboard immediately and qualifies for refinement.

A marketplace-imported skill is "already completed" — it skips the generation workflow entirely but is otherwise identical to a built skill for refinement purposes.

---

## Registry Model

The marketplace is a GitHub repository — any repo where each subdirectory contains a `SKILL.md`. No catalog file is needed.

**Configuration**: A single `marketplace_url` setting in Settings → GitHub. Accepts:
- `owner/repo`
- `github.com/owner/repo`
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch/subpath`

**Default branch resolution**: `parse_github_url` defaults to `"main"` for URLs without an explicit branch. All three import functions (`list_github_skills`, `import_github_skills`, `import_marketplace_to_library`) call `get_default_branch` via the repos API after parsing to resolve the actual default — avoiding 404s on repos where the default branch is `"master"` or a custom name.

**Discovery**: `list_github_skills` fetches the full recursive git tree, finds all `SKILL.md` blob entries, downloads each one, parses frontmatter, and returns `AvailableSkill` records. If a `subpath` is configured, only entries under that path are included.

**Pre-marking**: Before showing the browse dialog, `get_all_installed_skill_names` queries a UNION of `workflow_runs` and `imported_skills` by skill name. Skills already in either table are shown as "In library" (greyed out) in the browse UI.

---

## Import Flow

```
User clicks Install on a skill card
  ↓
import_marketplace_to_library called with skill_paths[]
  1. Read settings: marketplace_url, workspace_path, skills_path, OAuth token
  2. Parse marketplace URL → owner/repo
  3. Resolve actual default branch via repos API
  4. Fetch full recursive tree (one call for all selected skills)
  5. For each skill_path:
     a. Find all blob files under the skill directory in the tree
     b. Verify SKILL.md exists
     c. Download SKILL.md → parse full frontmatter
     d. Validate skill name (no path traversal characters)
     e. Remove existing directory if present (idempotent re-import)
     f. Create destination directory, canonicalize for traversal protection
     g. Download all files (10 MB per-file limit; path traversal check per file)
     h. Upsert into imported_skills
     i. Upsert into workflow_runs (source='marketplace', status='completed')
  6. Rebuild workspace CLAUDE.md if any succeeded
  ↓
Returns MarketplaceImportResult[] (success/error per skill)
```

**Idempotency**: Re-importing always removes the existing directory before downloading, ensuring stale files are cleaned up. Both DB writes use upsert semantics.

**Security**: Lexical path prefix check before canonicalization; canonicalized parent check after directory creation catches symlink-based traversal attempts.

---

## Data Model

### `imported_skills` table

Tracks every non-built skill: bundled, zip-uploaded, and marketplace-imported. Drives the Settings→Skills tab (toggle active/inactive, delete, view all imports).

Key columns: `skill_id` (PK), `skill_name` (UNIQUE), `domain`, `is_active`, `disk_path`, `imported_at`, `is_bundled`, `skill_type`, `version`, `model`, `argument_hint`, `user_invocable`, `disable_model_invocation`.

### `workflow_runs` table

Drives the dashboard and refine page. Marketplace imports are added here with `source='marketplace'`, `status='completed'` — equivalent to a built skill that completed its generation workflow.

Built skills have `source='created'`. The `source` column is the only structural difference between a built and marketplace-imported skill in this table.

### Bundled skills

`is_bundled=true` in `imported_skills`. Seeded by `seed_bundled_skills` on startup (always overwrites files; preserves `is_active` from existing DB row). Delete is blocked — returns error with instructions to deactivate instead. Skills currently deactivated are written to `skills/.inactive/` on re-seed.

---

## SKILL.md Frontmatter

Full set parsed by `parse_frontmatter_full`:

```yaml
---
name: sales-pipeline-analytics     # skill identity (falls back to directory name)
description: >                      # shown in library, browse UI, CLAUDE.md entry
  ...
domain: sales                       # badge in skill list
skill_type: domain                  # routes to Skill Library vs Settings→Skills
version: 1.2.0                      # stored; future update detection
model: sonnet                       # optional preferred model
argument-hint: "pipeline stage"     # shown when invoking the skill
user-invocable: true                # whether skill can be directly invoked
disable-model-invocation: false     # disables model selection UI for this skill
---
```

**Mandatory on zip upload**: `name`, `domain`, `description`. Missing fields return `missing_mandatory_fields:<field1>,<field2>` error.

**Zip upload always forces** `skill_type='skill-builder'` regardless of frontmatter — zip uploads are always Settings→Skills.

---

## Skill Lifecycle

### CLAUDE.md integration

`update_skills_section` regenerates the `## Custom Skills` section of the agent workspace CLAUDE.md on every import, toggle, or delete. Each active skill gets a `### /{name}` entry with its `description` read from SKILL.md on disk (not from DB). The `## Customization` section content is preserved across rebuilds.

### Refine integration

Marketplace skills qualify for `list_refinable_skills` (status='completed', SKILL.md exists on disk). On first refine use, the skill's scratch workspace directory is created (marketplace imports don't have one until then, so transcript logs can be written). The refine page auto-select tracks by skill name — navigating from the dashboard to a specific skill correctly selects it even if a different skill was previously active.

### Skill creation wizard

Skills built via the workflow go through a 4-step intake wizard:

1. **Basic info** — name (required) + description (required)
2. **Skill type** — `skill_type` field
3. **Behaviour** — `argument_hint`, `user_invocable`, `disable_model_invocation`
4. **Options** — model preference (skippable)

The extended frontmatter fields from the wizard are stored on the `workflow_runs` row and written into the generated SKILL.md — unifying the metadata schema between built and marketplace skills.

**Marketplace check**: when a marketplace URL is configured and the user starts creating a new skill, the wizard checks for matching skills in the marketplace (by name/domain) and offers "Import and refine" before starting the research workflow.
