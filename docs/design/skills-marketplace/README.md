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

A marketplace is a GitHub repository. The repo must contain a `.claude-plugin/marketplace.json` at its root (or at the configured subpath). This file is the catalog — it lists the skills the marketplace publishes. There is no folder-scan fallback: a missing or malformed catalog is an error surfaced to the user, not a silent empty result.

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

The `source` field is a repo-relative path to the skill directory. The app reads name, description, category, and version from this file, then fetches each skill's `SKILL.md` to fill in any fields not present in the catalog. Skills listed in the catalog but missing a `SKILL.md` in the repo are excluded.

**Configuration** — a single `marketplace_url` in Settings → GitHub. Accepts `owner/repo`, `github.com/owner/repo`, `https://github.com/owner/repo`, or a full tree URL with branch and subpath. The "Test" button validates the URL immediately — it confirms the repo is reachable and the catalog is present and valid. Bad URLs are caught at configuration time, not during import.

**Branch resolution** — the configured branch is a hint. On every operation, the app resolves the repo's actual default branch. This avoids failures on repos where the default is `master` or a custom name rather than `main`.

**Subpath** — when the marketplace URL includes a subpath (e.g. `.../tree/main/skills`), the catalog is expected within that subpath and all skill paths are resolved relative to it.

---

## Settings → Skills

Skills in this layer are used by Skill Builder agents to build, refine, and test skills. They are loaded into the agent workspace and wired into CLAUDE.md so Claude Code picks them up on every agent run. Changing what's here changes how the skill-building workflow behaves.

**Three ways skills enter this layer:**

1. **Bundled** — shipped with the app, seeded on startup. Active/inactive state is preserved across app updates. Cannot be deleted — only deactivated.

2. **Marketplace import** (Settings → Skills browse dialog) — shows all skills from the marketplace. User reviews and edits metadata before confirming.

3. **Zip upload** — mandatory frontmatter: `name`, `domain`, `description`, `version`. Always treated as `skill-builder` type regardless of frontmatter.

**On import** — the skill is downloaded to the agent workspace. If the skill already exists, it is only overwritten when the incoming version is strictly newer. A snapshot of the skill's content is stored to enable customization detection later. The workspace CLAUDE.md is rebuilt after every import.

**Active/inactive toggle** — deactivating a skill removes it from the agent workspace and from CLAUDE.md so agents no longer see it. Reactivating restores it. The state change and file move are atomic — a failure rolls back cleanly.

**Purpose field** — an optional label identifying what role a skill plays for agents (e.g. `"research"`, `"validate"`). Only one active skill per purpose is allowed; the UI enforces this before saving.

---

## Skill Library

Skills in this layer are domain knowledge packages — the output of Skill Builder. They live in the dashboard and are immediately available for refinement.

**Two ways skills enter this layer:**

1. **Built** — created via the full workflow (Research → Decisions → Generation → Validation).

2. **Marketplace import** (dashboard browse dialog or skill creation prompt) — downloads the skill to the configured skills directory. Any metadata edits made in the import dialog are applied before saving. If one skill in a batch fails, the rest still import.

A marketplace-imported skill is "already completed" — it skips the generation workflow entirely but is otherwise identical to a built skill for refinement.

---

## Version Tracking and Update Detection

Every skill has a `version` field (semver string). At import time, a snapshot of the skill's `SKILL.md` content is stored as a baseline.

**On startup**, the app checks the configured marketplace for newer versions. For each skill in the catalog, the marketplace version is compared against the installed version in both destinations independently. A skill is flagged for update only when the marketplace version is strictly greater.

**Customization detection** — before auto-updating, the app checks whether the skill has been modified since it was imported by comparing the current file content against the stored baseline. Skills that have been locally edited are excluded from auto-update to preserve those changes.

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

On startup, a persistent notification appears for each destination that has updates. Each notification names the affected skills and has an **Upgrade** button that navigates directly to the right dialog. The notifications stay until dismissed.

### Error handling

If the startup update check fails for any reason (network error, missing catalog, malformed file), a persistent error notification is shown with the full error message.

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
| Already installed | Duplicate (Settings → Skills only) | Disabled |

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
