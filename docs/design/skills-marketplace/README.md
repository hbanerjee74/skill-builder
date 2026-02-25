# Skills Marketplace — Design Note

The marketplace is a **one-way import layer**: skills flow in from GitHub repositories, never out. This doc walks through how it works — starting with the structure of a marketplace repo, then how the app discovers and imports skills from it.

---

## What Gets Imported and Where It Goes

The app has two separate places skills can live, and the marketplace feeds both:

| | **Settings → Skills** | **Skill Library** |
|---|---|---|
| **Purpose** | Skills used by Skill Builder agents to build, refine, and test skills | Domain knowledge — skills users create, import, and refine |
| **Examples** | `research`, `validate-skill`, `skill-builder-practices` | Sales Pipeline Analytics, dbt Incremental Silver |
| **After import** | Wired into the agent workspace — active skills are available to Claude Code on every agent run | Appears in the dashboard as a completed skill, ready to refine |

The destination is chosen by the user at import time (the same browse dialog is used for both). Once imported, a skill's `purpose` field in the database records which destination it belongs to — this is **not** read from the `SKILL.md` file; it's set by where the user imported it.

---

## The Structure of a Marketplace Repo

The app expects a specific three-level structure inside any GitHub repo registered as a marketplace: **registry → plugins → skills**.

- A **registry** is the GitHub repo itself. It contains a catalog file at `.claude-plugin/marketplace.json` that lists everything it publishes.
- A **plugin** is a directory (listed in the catalog) that groups related skills. It has its own `.claude-plugin/plugin.json` declaring its name, and a `skills/` subdirectory.
- A **skill** is a leaf directory inside `skills/` containing a `SKILL.md`.

The canonical layout looks like this:

```
{repo-root}/
  .claude-plugin/
    marketplace.json        ← catalog: lists all plugins this registry publishes
  {plugin-dir}/
    .claude-plugin/
      plugin.json           ← { "name": "my-plugin" }
    skills/
      {skill-name}/
        SKILL.md            ← the skill itself
      {skill-name}/
        SKILL.md
```

There is no folder-scan fallback. If `.claude-plugin/marketplace.json` is missing or malformed, the registry fails to load — it is never silently empty.

---

## Concrete Example: The Default Registry

The default registry is `https://github.com/hbanerjee74/skills`. It's a good reference because it uses two different layout patterns: plugins in a subdirectory, and a plugin rooted at the repo root itself.

```
hbanerjee74/skills/
  .claude-plugin/
    marketplace.json          ← catalog listing 5 plugins
    plugin.json               ← { "name": "vibedata" }  ← name for the root plugin
  plugins/
    skill-builder/
      .claude-plugin/
        plugin.json           ← { "name": "skill-builder" }
      skills/
        building-skills/
          SKILL.md
    skill-builder-practices/
      .claude-plugin/
        plugin.json           ← { "name": "skill-builder-practices" }
      skills/
        ...
    skill-builder-research/
      .claude-plugin/
        plugin.json           ← { "name": "skill-builder-research" }
      skills/
        ...
    skill-builder-validate/
      .claude-plugin/
        plugin.json           ← { "name": "skill-builder-validate" }
      skills/
        ...
  skills/                     ← skills for the root plugin (vibedata)
    dbt-fabric-patterns/
      SKILL.md
    dbt-semantic-layer/
      SKILL.md
    dbt-snapshot-scd2/
      SKILL.md
    dlt-rest-api-connector/
      SKILL.md
    elementary-data-quality/
      SKILL.md
    revenue-domain/
      SKILL.md
    salesforce-extraction/
      SKILL.md
```

And here is the `marketplace.json` that describes it. The format conforms to the [official Claude Code plugin marketplace schema](https://code.claude.com/docs/en/plugin-marketplaces#marketplace-schema):

```json
{
  "name": "vibedata-skills",
  "owner": { "name": "hbanerjee74" },
  "metadata": {
    "description": "Vibedata Skills Marketplace — practitioner-level data and analytics engineering skills for Claude",
    "version": "1.0.0"
  },
  "plugins": [
    { "name": "skill-builder",           "source": "./plugins/skill-builder",           "description": "Multi-agent workflow for creating domain-specific Claude skills" },
    { "name": "skill-builder-practices", "source": "./plugins/skill-builder-practices", "description": "Content guidelines and patterns for skill structure" },
    { "name": "skill-builder-research",  "source": "./plugins/skill-builder-research",  "description": "Research skill for dimension scoring and parallel research" },
    { "name": "skill-builder-validate",  "source": "./plugins/skill-builder-validate",  "description": "Validate skill for quality checking and companion recommendations" },
    { "name": "vibedata",                "source": "./",                                "description": "Practitioner-level data and analytics engineering skills for Claude" }
  ]
}
```

The `name` at the top (`"vibedata-skills"`) becomes the registry's display name — shown as the tab label in the browse dialog. The `plugins` array is what the app uses for discovery; everything else is informational.

> **Note on `metadata`:** The app only recognizes one `metadata` field: `pluginRoot` (explained below). All other metadata fields — like `description` and `version` in the example above — are silently ignored.

---

## How the App Discovers Skills

Given the catalog above, the app runs the following steps for each plugin entry:

**Step 1 — Resolve `plugin_path` from `source`:**

The `source` field is a path relative to the repo root pointing to the plugin directory. Two formats are supported:

- Starts with `./` → strip `./` and any trailing `/` to get `plugin_path`
  - `"./plugins/skill-builder"` → `plugin_path = "plugins/skill-builder"`
  - `"./"` → `plugin_path = ""` (the repo root — see below)
- Bare name (no `./`) → prepend `metadata.pluginRoot` if set, otherwise use as-is
  - With `pluginRoot = "plugins"`: `"skill-builder"` → `plugin_path = "plugins/skill-builder"`

The default registry uses `./`-prefixed paths for all five entries, so `pluginRoot` is not needed there.

**Step 2 — Enumerate skills:**

The app fetches the full git tree of the repo and finds every path matching `{plugin_path}/skills/{skill_name}/SKILL.md`. Only one level inside `skills/` is scanned — subdirectories of a skill are not treated as more skills.

For the default registry, this resolves as:

| Catalog `source` | `plugin_path` | Skills found at |
|---|---|---|
| `"./plugins/skill-builder"` | `plugins/skill-builder` | `plugins/skill-builder/skills/*/SKILL.md` |
| `"./plugins/skill-builder-practices"` | `plugins/skill-builder-practices` | `plugins/skill-builder-practices/skills/*/SKILL.md` |
| `"./plugins/skill-builder-research"` | `plugins/skill-builder-research` | `plugins/skill-builder-research/skills/*/SKILL.md` |
| `"./plugins/skill-builder-validate"` | `plugins/skill-builder-validate` | `plugins/skill-builder-validate/skills/*/SKILL.md` |
| `"./"` | `""` (root) | `skills/*/SKILL.md` |

**Step 3 — Fetch and validate each `SKILL.md`:**

Each discovered `SKILL.md` is fetched and its YAML frontmatter parsed. If the `name:` field is absent, the skill is **excluded** — directory names are never used as a fallback.

**Step 4 — Fetch `plugin.json` for the plugin name:**

The app fetches `{plugin_path}/.claude-plugin/plugin.json` and reads its `name` field. For the root case (`plugin_path = ""`), this is `.claude-plugin/plugin.json` — the same directory as `marketplace.json`. If `plugin.json` is absent or has no `name`, the plugin name is `null`.

Plugin entries that yield no valid skills are silently skipped (logged at `debug` level). External source types (`github`, `npm`, `pip`, `url`) are skipped with a warning — only string paths are supported.

---

## Skill Naming: Display vs. Storage

Two different names matter for each skill, and they are deliberately kept separate.

**Display name** (browse dialog only): `{plugin_name}:{skill_name}` when a plugin name is available, plain `{skill_name}` when it isn't. This mirrors the Claude Code runtime namespace model so users see the same qualified name they'd use in Claude Code (e.g. `vibedata:dbt-fabric-patterns`, `skill-builder:building-skills`).

**Storage name** (on disk and in the database): the plain `skill_name` from `SKILL.md` frontmatter, with no plugin prefix. This avoids `:` separator issues on Windows and keeps the local identifier simple.

The consequence: two skills from different plugins with the same `name:` frontmatter value will collide on local storage. The user sees both in the browse dialog with their qualified names, but importing the second will overwrite the first. Users with conflicting skill names must rename one before importing.

---

## Registry Configuration

**Multiple named registries** — Settings → Marketplace lets users configure one or more registries. Each has a name, a GitHub URL, and an enabled/disabled toggle. The default registry (`https://github.com/hbanerjee74/skills`, display name `vibedata-skills`) is seeded on first launch and cannot be removed.

**Adding a registry** — the user pastes a GitHub URL. The app fetches the repo's `marketplace.json`, validates it, and stores the registry with the `name` field from the catalog as its display name. If `name` is absent, the name falls back to `"{owner}/{repo}"`. No manual name entry is required.

**Enabled registries only** — only enabled registries are fetched. Disabling one removes it from the browse dialog without deleting the configuration. Each enabled registry appears as its own tab in the browse dialog.

**Single nesting level** — the registry → plugins → skills hierarchy is fixed at three levels. Nested registries inside sub-folders are not supported. If a repo has sub-collections that should behave as independent registries, add each as a separate registry URL.

---

## Version Tracking and Updates

Every skill has a `version` semver field. At import time the app stores a SHA-256 content hash of `SKILL.md` as a baseline snapshot alongside the installed version.

On app startup, the app compares each installed skill's version against the current marketplace catalog. The Skill Library and Settings → Skills are checked independently — a skill installed in both is evaluated separately in each.

**Customization detection** — if the current `SKILL.md` hash differs from the stored baseline, the skill is considered customized. Customized skills are excluded from auto-update to avoid overwriting local edits.

**Auto-update mode** — non-customized skills are updated silently on startup. The user sees a summary toast of what was updated, grouped by destination.

**Manual update mode** — the user is notified of available updates on startup. Each notification links to the import dialog where they can review and apply updates.

**As built:** Two gaps exist relative to the design above. The startup check failure path currently logs the error and continues silently — a persistent error notification is not yet shown. The customization warning confirmation dialog (shown before overwriting a locally-modified Settings → Skills skill) has its state variable wired up but the AlertDialog component is not rendered.

---

## The Browse Dialog

The same dialog is used when importing to either destination. It fetches all enabled registries in parallel, showing one tab per registry. Within each tab, skills are listed with their qualified display name and a state badge:

- **No badge** — not yet installed
- **Up to date** — installed at the same version
- **Update available** — a newer version exists in the catalog
- **Already installed** — installed with no version metadata to compare

Before confirming an import the user can edit the skill's metadata (name, description, version, model, argument hint, etc.). The form pre-populates from the remote `SKILL.md` frontmatter, falling back to the locally-installed version's fields when upgrading.

---

## SKILL.md Frontmatter Reference

Every importable skill must have a `SKILL.md` with valid YAML frontmatter. Without it the skill is excluded from the catalog entirely.

Example (the `dbt-fabric-patterns` skill from the default registry):

```yaml
---
name: dbt-fabric-patterns
description: >
  Teaches Claude how to write dbt models for Microsoft Fabric.
  Use when building incremental or snapshot models on Fabric.
version: 1.2.0
model: sonnet
argument-hint: "dbt model name or pattern"
user-invocable: true
disable-model-invocation: false
---
```

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Kebab-case identifier. **Authoritative skill name** — directory name is never used as a fallback. Skills missing this field are excluded from listing and import. |
| `description` | Yes | Shown in the browse dialog and wired into `CLAUDE.md` so agents know when to invoke the skill. |
| `version` | Yes | Semver string. Required for update detection. Defaults to `"1.0.0"` if absent at import time. |
| `model` | No | Preferred Claude model. Overrides the app default when the skill is invoked. |
| `argument-hint` | No | Short hint shown when invoking the skill as a slash command. |
| `user-invocable` | No | Whether the skill can be invoked directly as a slash command. |
| `disable-model-invocation` | No | Suppresses model selection UI for this skill. |

All other keys (`domain:`, `type:`, `purpose:`, `tools:`, `trigger:`, etc.) are silently ignored. The `purpose` field in particular is **not read from the file** — it is a database field set at import time based on which destination the user chose.
