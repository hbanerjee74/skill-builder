# Skills Marketplace — Design Note

---

## Overview

The marketplace is a one-way import layer — skills flow in from a GitHub repo, never out. Two distinct populations of skills exist in the app, and the marketplace feeds both:

| | **Settings → Skills** | **Skill Library** |
|---|---|---|
| **Purpose** | Skills used by Skill Builder agents to build, refine, and test skills | Domain knowledge — skills users create, import, and refine |
| **Examples** | `research`, `validate-skill`, `skill-builder-practices` | Sales Pipeline Analytics, dbt Incremental Silver |
| **After import** | Wired into the agent workspace — active skills are available to Claude Code on every agent run | Appears in the dashboard as a completed skill, ready to refine |

The `purpose` frontmatter field drives routing: `skill-builder` purpose skills belong in Settings → Skills; `domain`, `platform`, `source`, and `data-engineering` skills belong in the Skill Library.

---

## Registry Model

A marketplace is a GitHub repository with a catalog file (`.claude-plugin/marketplace.json`) that lists the skills it publishes. There is no folder-scan fallback — a missing or malformed catalog is an error, not a silent empty result.

The catalog lists each skill with its name, description, category, version, and a path to its directory in the repo. The app also reads each skill's `SKILL.md` to pick up fields not in the catalog (`purpose` and extended frontmatter). Skills in the catalog without a `SKILL.md` are excluded.

**Configuration** — one or more named registries in Settings → Marketplace. Each registry has a name, a GitHub source URL, and an enabled/disabled toggle. The default registry (`https://github.com/hbanerjee74/skills`) is seeded on first launch and cannot be removed. Additional registries can be added and removed freely.

**Enabled registries only** — only enabled registries are fetched. Disabling a registry removes it from the browse dialog without deleting it from the list.

**Subpath support** — the URL can point to a subdirectory within the repo (e.g. `.../tree/main/skills`). The catalog and all skill paths are resolved relative to that subpath.

---

## Settings → Skills

Skills here are used by Skill Builder agents to build, refine, and test skills. What's installed in this layer determines how the workflow behaves.

Skills can enter this layer three ways: bundled with the app (cannot be deleted), imported from the marketplace, or uploaded as a zip file. Zip uploads are always treated as `skill-builder` type regardless of frontmatter.

Skills can be toggled active or inactive. Inactive skills remain installed but are not available to agents. Only one active skill per purpose slot (e.g. `"research"`, `"validate"`) is allowed — purpose is an optional label that identifies a skill's role in the workflow.

---

## Skill Library

Skills here are domain knowledge packages — the output of Skill Builder. They can be built from scratch through the full workflow, or imported from the marketplace and used as a starting point for refinement.

A marketplace-imported skill skips the generation workflow entirely but is otherwise identical to a built skill — it appears in the dashboard and can be opened for refinement immediately.

---

## Version Tracking and Updates

Every skill has a `version` field (semver). At import time, a content snapshot of the skill is stored as a baseline.

On startup, the app compares installed versions against the marketplace catalog. Each destination (Skill Library and Settings → Skills) is checked independently — a skill can be installed in both and will be evaluated separately in each.

**Customization detection** — a skill is considered customized if its content has changed since it was imported. Customized skills are excluded from auto-update to avoid overwriting local edits.

**Auto-update mode** — updates are applied automatically on startup for all non-customized skills. The user is notified of what was updated, grouped by destination.

**Manual update mode** — the user is notified of available updates on startup. Each notification links directly to the relevant import dialog where the user can review and apply updates.

If the startup check fails for any reason, a persistent error notification is shown.

---

## Browse Dialog

The same import dialog is used for both destinations. It shows the full marketplace catalog across all enabled registries, with one tab per registry. Each tab pre-marks skills based on their install state: not installed, up to date, update available, or already installed. The user can edit a skill's metadata before confirming the import.

When upgrading a Settings → Skills skill that has been locally modified, the user must confirm before proceeding — the upgrade will overwrite their local changes.

---

## SKILL.md Frontmatter

Every skill must have a `SKILL.md` with YAML frontmatter. Without it the import is rejected.

```yaml
---
name: dbt-fabric-patterns
description: >
  Teaches Claude how to write dbt models for Microsoft Fabric.
  Use when building incremental or snapshot models on Fabric.
purpose: domain
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
| `description` | Yes | Shown in the browse dialog and wired into CLAUDE.md so agents know when to invoke the skill. |
| `version` | Yes | Semver string. Required for update detection. Defaults to `"1.0.0"` if absent at import time. |
| `model` | No | Preferred Claude model. Overrides the app default when the skill is invoked. |
| `argument-hint` | No | Short hint shown when invoking the skill as a slash command. |
| `user-invocable` | No | Whether the skill can be invoked directly as a slash command. |
| `disable-model-invocation` | No | Suppresses model selection UI for this skill. |
