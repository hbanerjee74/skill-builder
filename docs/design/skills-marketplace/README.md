# Skills Marketplace — Design Note

---

## Overview

The marketplace is a one-way import layer — skills flow in from a GitHub repo, never out. Two distinct populations of skills exist in the app, and the marketplace feeds both:

| | **Settings → Skills** | **Skill Library** |
|---|---|---|
| **Purpose** | Skills used by Skill Builder agents to build, refine, and test skills | Domain knowledge — skills users create, import, and refine |
| **Examples** | `research`, `validate-skill`, `skill-builder-practices` | Sales Pipeline Analytics, dbt Incremental Silver |
| **Storage** | `workspace_path/.claude/skills/` (agent workspace) | `skills_path/` (user-configured output directory) |
| **After import** | Wired into workspace CLAUDE.md — Claude Code loads the skill on every agent run. Active/inactive toggle moves the skill in and out of CLAUDE.md. | Appears in the dashboard as a completed skill. Immediately refinable — user can open it in the Refine page and tailor it to their context. |

The `skill_type` frontmatter field drives routing: `skill-builder` type skills belong in Settings → Skills; `domain`, `platform`, `source`, and `data-engineering` skills belong in the Skill Library.

---

## Registry Model

A marketplace is a GitHub repository. The repo must contain a `.claude-plugin/marketplace.json` at its root (or at the configured subpath). This file is the catalog — it lists the skills the marketplace publishes. There is no folder-scan fallback: a missing or malformed file is an error surfaced to the user, not a silent empty result.

**`marketplace.json`** is a `plugins` array. Each entry names a skill and points to its directory in the repo:

```json
{
  "plugins": [
    {
      "name": "dbt-fabric-patterns",
      "source": "./skills/dbt-fabric-patterns",
      "description": "...",
      "version": "1.0.2",
      "author": "...",
      "category": "dbt",
      "tags": ["dbt", "fabric"]
    }
  ]
}
```

The `source` field is a repo-relative path to the skill directory. The app reads name, description, category, and version from this file, then fetches each skill's `SKILL.md` to read `skill_type` and any frontmatter fields not present in the catalog. Skills listed in the catalog but missing a `SKILL.md` in the repo are excluded.

**Configuration** — a single `marketplace_url` in Settings → GitHub. Accepts `owner/repo`, `github.com/owner/repo`, `https://github.com/owner/repo`, or a full tree URL with branch and subpath. The "Test" button validates the URL immediately — it confirms the repo is reachable and the `marketplace.json` is present and valid. Bad URLs are caught at configuration time, not during import.

**Branch resolution** — the configured branch is a hint. On every operation, the app resolves the repo's actual default branch via the GitHub API. This avoids 404s on repos where the default is `master` or a custom name rather than `main`.

**Subpath** — when the marketplace URL includes a subpath (e.g. `.../tree/main/skills`), the catalog is expected at `{subpath}/.claude-plugin/marketplace.json` and all plugin paths are resolved relative to that subpath.

---

## Settings → Skills

Skills in this layer are used by Skill Builder agents to build, refine, and test skills. They are loaded into the agent workspace and wired into CLAUDE.md so Claude Code picks them up on every agent run. Changing what's here changes how the skill-building workflow behaves.

**Three ways skills enter this layer:**

1. **Bundled** — shipped with the app, seeded on startup. `is_active` state is preserved across re-seeds. Cannot be deleted — only deactivated.

2. **Marketplace import** (Settings → Skills browse dialog) — shows all skills from the marketplace. User reviews and confirms metadata before import.

3. **Zip upload** — mandatory frontmatter: `name`, `domain`, `description`, `version`. Always imports as `skill_type='skill-builder'` regardless of frontmatter.

**On import** — the skill directory is downloaded to `workspace_path/.claude/skills/{skill_name}/`. If the skill already exists, it is only overwritten when the marketplace version is semver-greater. A SHA-256 hash of SKILL.md is stored as the customization baseline. Workspace CLAUDE.md is rebuilt after every import.

**Active/inactive toggle** — deactivating moves the skill directory from `skills/` to `skills/.inactive/`. The state change and file move are transactional — a failed file move rolls back the state change. CLAUDE.md is rebuilt after every toggle.

**Purpose field** — an optional string identifying the skill's role for agents (e.g. `"research"`, `"validate"`). Only one active skill per purpose is allowed; the UI enforces this with a conflict check before saving.

---

## Skill Library

Skills in this layer are the product of Skill Builder — domain knowledge packages that live in the dashboard and are immediately refinable.

**Two ways skills enter this layer:**

1. **Built** — created via the full workflow (Research → Decisions → Generation → Validation).

2. **Marketplace import** (dashboard browse dialog or skill creation prompt) — downloads the skill directory to `skills_path/{skill_name}/`. Any metadata edits made in the import dialog are applied before writing to disk. Partial failures are allowed — one bad skill in a batch does not abort the rest.

A marketplace-imported skill is "already completed" — it skips the generation workflow entirely but is otherwise identical to a built skill for refinement.

---

## Version Tracking and Update Detection

Every skill has a `version` field (semver string). At import time, a SHA-256 hash of the skill's `SKILL.md` is stored as the customization baseline.

**On startup**, the app checks the configured marketplace for newer versions. For each skill in the catalog, it compares the marketplace version against the installed version in both destinations independently. A skill shows as having an update only when the marketplace version is strictly greater.

**Customization detection** — before auto-updating, the app checks whether a skill's `SKILL.md` has been modified since import by comparing the current file hash against the stored baseline. Customized skills are excluded from auto-update to preserve local changes.

---

## Delivering Updates to the User

The `auto_update` setting (Settings → GitHub) controls whether updates are applied silently or surfaced for manual action.

### Auto-update mode

On startup, updates are applied automatically for all non-customized skills. A single persistent success toast (must be dismissed) summarises what changed, grouped by destination:

```
Auto-updated 2 skills
• Skills Library: dbt-fabric-patterns
• Workspace: my-research-skill
```

Customized skills are silently skipped — no mention in the toast.

### Manual update mode

On startup, a persistent info toast appears for each destination that has updates. Each toast names the affected skills and has an **Upgrade** button that navigates directly to the right dialog with the update pre-selected. The toasts stay until dismissed.

### Error handling

If the startup update check fails for any reason (network error, missing catalog, schema error), a persistent error toast is shown with the full error message.

---

## Browse Dialog

A shared dialog used for both import destinations, opened from the dashboard (Skill Library) and from Settings → Skills.

When the dialog opens, each skill in the catalog is pre-marked with its current state:

| State | Meaning | Display |
|---|---|---|
| Not installed | Can be imported | Import button |
| Same version | Installed, up to date | "Up to date" badge |
| Newer version available | Can be upgraded | "Update available" badge (amber) |
| Just imported | Imported in this session | "Imported" badge (green) |
| Already installed | Duplicate (settings-skills mode) | Disabled |

**Edit form** — before confirming an import, the user can review and edit the skill's metadata. Mandatory for both modes: `name`, `description`, `domain`, `version`. Additionally mandatory for Skill Library imports: `skill_type`. Version defaults to the frontmatter value, or the installed version for upgrades, or `"1.0.0"` as a last resort.

**Customization warning** — when upgrading a Settings → Skills skill that has been locally modified, the user is asked to confirm before proceeding. Proceeding discards local changes.

---

## SKILL.md Frontmatter

Every skill must have a `SKILL.md` with YAML frontmatter. Without it, the import is rejected.

```yaml
---
name: dbt-fabric-patterns
description: >
  Teaches Claude how to write dbt models for Microsoft Fabric.
  Use when building incremental or snapshot models on Fabric.
domain: dbt
skill_type: domain
version: 1.2.0
model: sonnet
argument-hint: "dbt model name or pattern"
user-invocable: true
disable-model-invocation: false
---
```

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Kebab-case identifier. Two skills with the same name conflict. |
| `description` | Yes | Shown in the browse dialog and wired into CLAUDE.md so Claude knows when to invoke the skill. |
| `domain` | Yes | Business or technical domain (e.g. `dbt`, `sales`, `fabric`). Shown as a badge. |
| `skill_type` | Yes (import forms) | Routes to the right layer. `domain`, `platform`, `source`, `data-engineering` → Skill Library. `skill-builder` → Settings → Skills. |
| `version` | Yes (import forms) | Semver string. Used for update detection. Import forms default to `"1.0.0"` if absent. |
| `model` | No | Preferred Claude model (`opus`, `sonnet`, `haiku`). Overrides the app default when the skill is invoked. |
| `argument-hint` | No | Short hint shown when invoking the skill as a slash command. |
| `user-invocable` | No | `true` if the skill can be invoked directly as a slash command. |
| `disable-model-invocation` | No | `true` to suppress model selection UI for this skill. |

**Zip upload** — always imports into Settings → Skills regardless of `skill_type` in frontmatter. Missing a mandatory field returns an error listing the missing field names.
