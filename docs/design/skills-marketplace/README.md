# Skills Marketplace — Design Note

---

## Overview

The marketplace is a one-way import layer — skills flow in from a GitHub repo, never out. Two distinct populations of skills exist in the app, and the marketplace feeds both:

| | **Settings → Skills** | **Skill Library** |
|---|---|---|
| **Purpose** | App infrastructure — powers the workflow agents | Domain knowledge — skills users create, import, and refine |
| **Examples** | `research`, `validate-skill`, `skill-builder-practices` | Sales Pipeline Analytics, dbt Incremental Silver |
| **Storage** | `workspace_path/.claude/skills/` (agent workspace) | `skills_path/` (user-configured output directory) |
| **DB tables** | `workspace_skills` | `skills` (master) + `imported_skills` (disk metadata) |
| **After import** | Wired into workspace CLAUDE.md — Claude Code loads the skill on every agent run. Active/inactive toggle moves the skill in and out of CLAUDE.md. | Appears in the dashboard as a completed skill. Immediately refinable — user can open it in the Refine page and tailor it to their context. |

The `skill_type` frontmatter field drives routing: `skill-builder` type skills belong in Settings → Skills; `domain`, `platform`, `source`, and `data-engineering` skills belong in the Skill Library.

---

## Registry Model

The marketplace is a GitHub repository with a required `.claude-plugin/marketplace.json` catalog at the repo root. There is no folder-scan fallback: if the file is absent or fails schema validation, the operation returns a descriptive error.

**`marketplace.json` structure** (`MarketplaceJson` → `Vec<MarketplacePlugin>`):

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

`source` is either a path string (relative, e.g. `"./skills/dbt-fabric-patterns"`) or an external object (unsupported — skipped with a log warning). Each path-type entry must contain a `SKILL.md` in the repo; entries without one are silently excluded.

**`parse_github_url`** — pure parse, no network. Accepts:
- `owner/repo`
- `github.com/owner/repo`
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch/optional/subpath`

Returns `GitHubRepoInfo { owner, repo, branch, subpath: Option<String> }`. Validates against path traversal (`..`, `\`). Defaults `branch` to `"main"` if not present in the URL.

**`list_github_skills_inner`** — the core discovery function used by all marketplace operations:

1. Calls `get_default_branch()` via GitHub repos API to resolve the actual default branch (avoids 404s on repos where it is `master` or a custom name).
2. Fetches `marketplace.json` from `raw.githubusercontent.com` at `{resolved_branch}/.claude-plugin/marketplace.json` (or `{subpath}/.claude-plugin/marketplace.json` when a subpath is set). Returns an error if the file is absent or fails to parse.
3. Extracts path-type entries from the plugins array, strips the leading `./`.
4. Fetches the full recursive repo tree to validate that each plugin path contains a `SKILL.md`.
5. Concurrently fetches each `SKILL.md`, parses YAML frontmatter to extract `version`, `skill_type`, and optional fields.
6. Returns `Vec<AvailableSkill>`.

`AvailableSkill` fields:

| Field | Source |
|---|---|
| `path` | Plugin path from marketplace.json (stripped `./`) |
| `name` | `plugin.name` from marketplace.json |
| `description` | `plugin.description` from marketplace.json |
| `domain` | `plugin.category` from marketplace.json |
| `skill_type` | SKILL.md frontmatter |
| `version` | SKILL.md frontmatter |
| `model`, `argument_hint`, `user_invocable`, `disable_model_invocation` | SKILL.md frontmatter (all optional) |

**`check_marketplace_url`** — called by the "Test" button in Settings → GitHub. Confirms the repo is accessible (via repos API) and that `marketplace.json` exists and deserializes correctly. Returns a clear error string on any failure so bad URLs are caught at configuration time, not at import time.

---

## Settings → Skills

Skills in this layer are loaded into the agent workspace and wired into CLAUDE.md as custom skills. Claude Code reads them during agent runs.

**Three ways skills enter this layer:**

1. **Bundled** — shipped with the app, seeded by `seed_bundled_skills` on startup. Always overwrite on seed; `is_active` state is preserved across re-seeds. Cannot be deleted — only deactivated.

2. **Marketplace import** (Settings → Skills browse dialog) — opens `GitHubImportDialog` in `settings-skills` mode. Shows all skills from the marketplace. After the user confirms, calls `import_github_skills`.

3. **Zip upload** — extracts to `workspace_path/.claude/skills/`. Mandatory frontmatter: `name`, `domain`, `description`, `version`. Forced `skill_type='skill-builder'` regardless of frontmatter.

**`import_github_skills`** — for each skill in the request:
- Downloads the full skill directory to `workspace_path/.claude/skills/{skill_name}/`.
- If the skill already exists: skips unless the marketplace version is semver-greater; if upgrading, merges metadata (new value wins if present, existing value preserved otherwise).
- Upserts into `workspace_skills` (preserves `skill_id`, `is_active`, `is_bundled`, `imported_at` on update).
- Computes a SHA-256 hash of SKILL.md and stores it as `content_hash` (the baseline for customization detection).
- Rebuilds workspace CLAUDE.md after all imports complete.

**`workspace_skills` table** — key columns:

| Column | Notes |
|---|---|
| `skill_id TEXT PRIMARY KEY` | UUID |
| `skill_name TEXT UNIQUE NOT NULL` | Display name |
| `domain, description, skill_type, version, model, argument_hint TEXT` | From frontmatter |
| `user_invocable, disable_model_invocation INTEGER` | Boolean flags |
| `is_active INTEGER` | 1 = wired into CLAUDE.md |
| `is_bundled INTEGER` | 1 = shipped with app, cannot be deleted |
| `disk_path TEXT` | Absolute path to skill directory |
| `purpose TEXT` | Optional agent role (e.g. `"research"`, `"validate"`) |
| `content_hash TEXT` | SHA-256 of SKILL.md at import time |

**Active/inactive toggle** — deactivating moves the skill directory from `skills/` to `skills/.inactive/`. The DB is updated first; if the file move fails, the DB update is rolled back. CLAUDE.md is rebuilt after every toggle.

**Purpose field** — an optional string identifying the skill's role for agents. Only one active skill per purpose is allowed; the UI enforces this with a conflict check before saving.

---

## Skill Library

Skills in this layer are the product of Skill Builder — domain knowledge packages that live in the dashboard and are immediately refinable.

**Two ways skills enter this layer:**

1. **Built** — created via the full workflow (Research → Decisions → Generation → Validation). Tracked in `workflow_runs`.

2. **Marketplace import** (dashboard browse dialog or skill creation prompt) — calls `import_marketplace_to_library`.

**`import_marketplace_to_library`** — for each skill path in the request:
- Reads the configured marketplace URL from settings to derive `owner`, `repo`, `branch`.
- Downloads the full skill directory to `skills_path/{skill_name}/`.
- Applies any `metadata_overrides` before writing to disk and DB.
- Inserts/updates the `skills` master table (`skill_source='marketplace'`).
- Upserts `imported_skills` (preserves existing `skill_id`, `is_active`, `imported_at` on conflict).
- Computes and stores `content_hash`.
- Returns `Vec<MarketplaceImportResult>` with a success flag and optional error per skill (partial failures are allowed — one bad skill does not abort the batch).

A marketplace-imported skill is "already completed" — it skips the generation workflow entirely but is otherwise identical to a built skill for refinement.

**DB tables:**

`skills` (master catalog):

| Column | Notes |
|---|---|
| `id INTEGER PRIMARY KEY` | Internal auto-increment |
| `name TEXT UNIQUE NOT NULL` | Canonical skill name |
| `skill_source TEXT` | `'skill-builder'`, `'marketplace'`, or `'imported'` |
| `domain, skill_type, description, version, model, argument_hint TEXT` | Frontmatter |
| `user_invocable, disable_model_invocation INTEGER` | Boolean flags |

`imported_skills` (disk and runtime metadata):

| Column | Notes |
|---|---|
| `skill_id TEXT PRIMARY KEY` | UUID |
| `skill_name TEXT UNIQUE NOT NULL` | Matches skills.name |
| `skill_master_id INTEGER FK → skills(id)` | Link to master catalog |
| `domain, skill_type, version, model, argument_hint TEXT` | Frontmatter |
| `user_invocable, disable_model_invocation INTEGER` | Boolean flags |
| `is_active, is_bundled INTEGER` | Status flags |
| `disk_path TEXT` | Absolute path to skill directory |
| `content_hash TEXT` | SHA-256 of SKILL.md at import time |

---

## Version Tracking and Update Detection

### Semver comparison

`semver_gt(marketplace: &str, installed: &str) -> bool` — parses both strings with the `semver` crate. If both parse successfully, returns `marketplace > installed`. If either fails to parse (malformed version string), falls back to string inequality (`marketplace != installed`).

### Detecting available updates

`check_marketplace_updates` runs at app startup (in the background, after settings load). It:
1. Calls `list_github_skills_inner` to get all available skills with versions.
2. Skips any skill where the marketplace version is empty.
3. For each available skill, independently checks both tables:
   - `workspace_skills` by name — if `semver_gt(marketplace_ver, installed_ver)`, adds to `workspace` list.
   - `imported_skills` by name — if `semver_gt(marketplace_ver, installed_ver)`, adds to `library` list.
4. Returns `MarketplaceUpdateResult { library: Vec<SkillUpdateInfo>, workspace: Vec<SkillUpdateInfo> }`.

### Detecting customization

`check_skill_customized(skill_name)` — looks up the skill in `workspace_skills` or `imported_skills` to find `disk_path` and `content_hash`. Computes the current SHA-256 of the SKILL.md on disk and compares to the stored baseline. Returns `true` if the file has changed since import. Returns `false` if no baseline is stored (new skills are treated as unmodified). Validates `disk_path` is within the expected root (security check against path traversal).

---

## Delivering Updates to the User

The `auto_update` setting (Settings → GitHub) controls whether updates are applied silently or surfaced for manual action.

### Auto-update mode (`auto_update: true`)

On startup, after `checkMarketplaceUpdates` returns:

1. For each skill in `library` and `workspace` lists, call `checkSkillCustomized`. Exclude customized skills from the update batch (preserving local changes).
2. Import non-customized library skills via `importMarketplaceToLibrary`.
3. Import non-customized workspace skills via `importGitHubSkills`.
4. If any skills were updated, show a single persistent success toast (must be dismissed):

```
Auto-updated 2 skills
• Skills Library: dbt-fabric-patterns
• Workspace: my-research-skill
```

Only sections with actual updates are shown. A skill that was customized is silently skipped — no mention in the toast.

### Manual update mode (`auto_update: false`)

On startup, if updates are available, show persistent info toasts (one per destination with updates, `duration: Infinity`):

- `"Skills Library: update available for N skill(s): name1, name2"` — with an **Upgrade** action button that navigates to the dashboard and opens the marketplace dialog in `skill-library` mode.
- `"Settings → Skills: update available for N skill(s): name1, name2"` — with an **Upgrade** action button that navigates to Settings and opens the marketplace dialog in `settings-skills` mode.

The navigation is coordinated via `pendingUpgradeOpen` in the settings store (`{ mode: 'skill-library' | 'settings-skills', skills: string[] } | null`). The target component reads this state on mount and opens the dialog immediately.

### Error handling

If `checkMarketplaceUpdates` fails (network error, missing `marketplace.json`, schema error), a persistent error toast is shown (`duration: Infinity`) with the full error message. No silent swallowing.

---

## Browse Dialog (GitHubImportDialog)

A shared dialog used for both import destinations. Controlled by the `mode` prop.

**Props:**

| Prop | Notes |
|---|---|
| `open` | Controlled open state |
| `url` | Marketplace URL string |
| `mode` | `'skill-library'` (default for dashboard) or `'settings-skills'` |
| `workspacePath` | Required for skill-library mode — passed to `listSkills` for version comparison |
| `typeFilter` | Optional skill_type filter (skill-library mode only) |
| `onImported` | Callback after successful import |

**Pre-marking states** — determined by `browse()` when the dialog opens:

| State | Meaning | Display |
|---|---|---|
| `"idle"` | Not installed, can import | Edit/import button |
| `"same-version"` | Installed, same version | "Up to date" badge (muted) |
| `"upgrade"` | Installed, newer version available | "Update available" badge (amber) |
| `"imported"` | Just imported in this session | "Imported" badge (green) |
| `"exists"` | Already installed (settings-skills mode) | "Already installed" badge (disabled) |
| `"importing"` | Import in progress | Spinner |

For `skill-library` mode, `browse()` calls `listSkills(workspacePath)` regardless of whether `workspacePath` is populated — the Rust backend ignores the parameter and reads from DB. This is intentional: the dialog can open before async settings load completes, and the `workspacePath = ""` race condition must not produce false "upgrade" states.

**Edit form** — clicking the pencil icon on any skill opens an inline edit form for metadata review before import. Mandatory fields for both modes: `name`, `description`, `domain`, `version`. Additionally mandatory for skill-library mode: `skill_type`. Optional for both: `model`, `argument_hint`, `user_invocable`, `disable_model_invocation`. Optional for settings-skills mode only: `purpose`. Version defaults to the skill's frontmatter version, fallback to the installed version (upgrade case), fallback to `"1.0.0"`.

**Metadata overrides** — edit form values are collected into a `metadata_overrides: { [skill.path]: SkillMetadataOverride }` map and passed to the backend import functions. Any field set in the override replaces the value from SKILL.md before the DB insert and disk write.

**Customization warning (settings-skills mode)** — when upgrading a skill that `checkSkillCustomized` returns `true` for, an alert dialog asks the user to confirm before proceeding. Proceeding discards local changes.

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
| `name` | Yes | Kebab-case identifier. Primary key — two skills with the same name conflict. |
| `description` | Yes | Shown in browse dialog and wired into CLAUDE.md so Claude knows when to invoke the skill. |
| `domain` | Yes | Business or technical domain (e.g. `dbt`, `sales`, `fabric`). Shown as a badge. |
| `skill_type` | Yes (import forms) | Routes to the right layer. `domain`, `platform`, `source`, `data-engineering` → Skill Library. `skill-builder` → Settings → Skills. |
| `version` | Yes (import forms) | Semantic version string. Stored as the baseline for update detection. Import forms default to `"1.0.0"` if absent from frontmatter. |
| `model` | No | Preferred Claude model (`opus`, `sonnet`, `haiku`). Overrides the app default when the skill is invoked. |
| `argument-hint` | No | Short hint shown to the user when invoking the skill as a slash command. |
| `user-invocable` | No | `true` if the skill can be invoked directly as a slash command. |
| `disable-model-invocation` | No | `true` to suppress model selection UI for this skill. |

**Mandatory validation** — `import_single_skill` enforces `name`, `description`, and `domain` on every import path. `skill_type` is enforced at the UI level in skill-library mode (the edit form blocks submission until set). `version` is enforced by the import form UI (not the backend) — the form marks it mandatory and defaults to `"1.0.0"`.

**Zip upload** — always imports into Settings → Skills regardless of `skill_type` in frontmatter. Mandatory fields: `name`, `domain`, `description`, `version`. Missing any returns an error listing the missing field names.
