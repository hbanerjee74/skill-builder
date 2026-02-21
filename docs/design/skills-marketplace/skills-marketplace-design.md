# Skills Marketplace — Feature Design

> Documents the skills marketplace as built in VD-696 (browse, install, manage) and the remaining roadmap (publish, companion matching, community signals).

---

## 1. Core Concepts

### What IS the Skills Marketplace?

The skills marketplace is a **discovery and distribution layer** for domain-specific Claude skills built with skill-builder. It connects skill authors (who build skills using the multi-agent workflow) with skill consumers (who want pre-built domain knowledge for their Claude Code projects).

A skill is a structured knowledge package (SKILL.md + references/) that teaches Claude domain-specific patterns, rules, and conventions. The marketplace catalogs and distributes these packages via a configured GitHub repository.

### Two Populations of Skills

The app manages two types of skills that differ in lifecycle and storage:

| | **Built skills** | **Marketplace skills** |
|---|---|---|
| **Origin** | Created locally using the workflow | Imported from a marketplace GitHub repo |
| **Status** | pending → in_progress → completed | Always 'completed' from the start |
| **Location** | skills output directory | Same skills output directory |
| **Refinable?** | Yes, after workflow completes | Yes, immediately after import |
| **CLAUDE.md wired** | Yes, by workflow | Yes, by import pipeline |

Both types live in the same skills directory and are fully interchangeable for refinement and use. Marketplace skills are "already completed" — they skip the generation workflow entirely.

---

## 2. Architecture: GitHub-Repo-as-Registry (Built)

### The Registry Model

The marketplace is a **GitHub repository** — any repo with skill directories (each containing SKILL.md) and a configured URL. No separate catalog file, no dedicated backend, no central index.

**Configuration**: A single `marketplace_url` setting in Settings → GitHub stores the repo URL (supports GitHub shorthand `owner/repo`, full GitHub URL, and subpath `owner/repo/tree/branch/path`).

**Discovery**: The app fetches the repo's recursive git tree from the GitHub API, finds all `SKILL.md` files, parses frontmatter, and returns a skill list. This is the "browse" operation — no pre-downloaded catalog needed.

**Authentication**: Uses the configured GitHub OAuth token (or none for public repos). The default branch is auto-detected via the GitHub repos API before fetching the tree, avoiding 404s on repos where the default branch isn't `main`.

### Why This Works

The existing GitHub import infrastructure already did exactly this — it's marketplace discovery without the "marketplace" label. Adding `marketplace_url` as a dedicated setting and routing imports through a marketplace-specific path (which registers skills in the runs table) is the only new infrastructure needed.

### What a Marketplace Repo Looks Like

Any GitHub repo where each subdirectory (or subdirectory within a subpath) contains a `SKILL.md`:

```
skill-builder-marketplace/
├── dbt-incremental-silver/
│   ├── SKILL.md               ← required; frontmatter drives discovery
│   └── references/
│       └── ...
├── management-accounting/
│   ├── SKILL.md
│   └── references/
└── salesforce-extraction/
    ├── SKILL.md
    └── references/
```

No `marketplace.json` catalog is needed for Phase 1. Skills are discovered by scanning the tree. A future `marketplace.json` catalog (for richer metadata: descriptions, featured status, install counts) is a Phase 3 consideration.

### Filtering by Type

The browse dialog accepts a `typeFilter` that limits the skill list to only skills whose `skill_type` frontmatter field is in a specified set. The dashboard uses this to show only domain-type skills (`platform`, `domain`, `source`, `data-engineering`), keeping convention skills separate.

---

## 3. Data Model (Built)

### Two Storage Records Per Marketplace Import

Every marketplace import creates records in two places:

1. **Imported skills registry** — drives the skills library tab (toggle active/inactive, delete, view all imports)
2. **Skill runs table** — makes marketplace skills first-class citizens: they appear in the dashboard, are eligible for refinement, and share the same lifecycle model as built skills

**Marketplace rows in the runs table** have `source='marketplace'` and `status='completed'` — equivalent to a built skill that has finished its generation workflow.

### What Data Is Tracked

Both records store the skill's identity (name, domain, version) and its behavioral metadata (skill type, invocability, model preference, author). The runs table adds a `source` column (`'created'` vs `'marketplace'`) to distinguish the origin.

### Extended Schema for Built Skills

The same extended frontmatter fields added for marketplace skills are also stored for built skills — both tables were extended together in VD-696, unifying the metadata schema.

### Pre-marking: "Already Installed" Detection

The browse dialog checks which skills from the marketplace repo are already installed by querying both tables together (a union of all installed skill names). This lets the UI grey out and label skills that are "In library" before the user sees the list.

---

## 4. Skill Metadata (Built)

### What's Parsed from SKILL.md Frontmatter

The full frontmatter spec parsed during import:

```yaml
---
name: building-dbt-incremental-silver    # → skill identity (or dir name if absent)
description: >                            # → shown in library and browse UI
  ...
domain: dbt                              # → badge in skill list
skill_type: data-engineering             # → drives typeFilter and taxonomy
version: 1.2.0                           # → stored; future update detection
model: sonnet                            # → optional; preferred model for this skill
argument_hint: "dbt model name"          # → shown to user when invoking the skill
user_invocable: true                     # → whether skill can be directly invoked
disable_model_invocation: false          # → disables model selection UI for this skill
tools: Read, Write, Edit, Glob, Grep, Bash
---
```

Fields not in frontmatter use defaults. Author identity (login, avatar) is set separately after import when an OAuth profile is available.

### What's NOT Yet Parsed

- `tags` — not stored per-skill (only via skill tags table for built skills)
- `license` — not parsed
- `conventions` — not parsed or acted upon
- `dimensions_covered` — not parsed (future companion matching)

---

## 5. Browse & Discovery (Built)

### UI Entry Points

**Skills Library tab**:
- Shows imported skills filtered to `skill_type='skill-builder'` (convention/tooling skills)
- "Marketplace" button — disabled when `marketplaceUrl` is not configured (tooltip directs to Settings → GitHub)
- Opens the browse dialog for skill-builder type imports

**Dashboard marketplace dialog**:
- "Browse Marketplace" button — same disabled logic
- Opens browse dialog filtered to domain-type skills (`platform`, `domain`, `source`, `data-engineering`)
- This is the main path for importing marketplace skills that appear in the skill list and become refinable

**Skill creation prompt**:
- When creating a new skill and a marketplace match is found, shows "Import and refine" option
- Opens the browse dialog

### Browse Dialog Behaviour

1. Opens → immediately fetches the marketplace repo (browse mode, no URL entry step)
2. Scans repo tree, parses frontmatter for each SKILL.md found
3. If a type filter is set, filters results by `skill_type`
4. Checks installed skill names → marks already-installed skills as "In library" (greyed out)
5. Shows skill list: name, domain badge, description; each with Install button (or "In library" / "Imported" state)
6. User clicks Install → import begins

### Import vs. Browse Modes

The browse dialog supports two import modes:

| Mode | Creates runs entry? | Shows in dashboard? | Refinable? |
|---|---|---|---|
| **Skill-library** | Yes (`source='marketplace'`) | Yes | Yes |
| **Settings-skills** | No | No | No (only in skills-library tab) |

Use skill-library mode when you want the skill to behave like a first-class skill (dashboard + refinement). Use settings-skills mode when you just want to add a skill to the workspace `.claude/skills/` directory (legacy behaviour).

---

## 6. Import/Install Flow (Built)

### Full Flow for Skill-Library Mode

```
User clicks Install on a skill card
  ↓
Skill card shows "importing..." state
  ↓
Marketplace import command runs:
  1. Read settings: marketplace_url, workspace_path, skills_path
  2. Parse marketplace URL → owner/repo/branch
  3. Auto-detect default branch via GitHub repos API
  4. Fetch repo tree from GitHub API
  5. For each selected skill:
     a. Download all files under the skill directory → local skills_path
        - Validates SKILL.md exists
        - Parses full frontmatter
        - 10 MB per-file limit; path traversal protection
        - Overwrites existing directory (idempotent re-import)
     b. Upsert record in imported skills registry
     c. Upsert record in skill runs table
        (source='marketplace', status='completed')
  6. Rebuild workspace CLAUDE.md with all active skills
  ↓
Returns success/error per skill
  ↓
Frontend: card shows "Imported" state + toast notification
Parent skill list reloads
```

### Idempotency

Re-importing a skill that was previously installed always succeeds:
- The existing directory is removed before downloading (ensuring stale files are cleaned up)
- Both DB records use upsert semantics — updating metadata if changed
- Frontend distinguishes "already installed" from errors and shows "In library" state

### Conflict with Built Skills

If a built skill and a marketplace import have the same `skill_name`, the marketplace import wins — it overwrites the runs table row (source → 'marketplace', status → 'completed'). **No automatic conflict detection is currently implemented** — this is a gap to address in a future ticket.

---

## 7. Refinement Integration (Built)

Marketplace skills are fully integrated into the refine workflow:

1. The "list refinable skills" query returns all completed skills — marketplace skills qualify
2. A SKILL.md existence check confirms the file is on disk — it is, after import
3. Marketplace skills appear in the refine page's skill picker
4. Selecting a marketplace skill navigates to the refine page (same route as built skills)
5. The refine session verifies SKILL.md exists and initializes
6. On first message: creates the skill's scratch workspace directory if missing (marketplace skills don't have one until first refine use), ensuring transcript logs can be written

### Auto-select Fix

The refine page's auto-select tracks which skill was last auto-selected by name (not a boolean flag), so navigating from the skill library to a specific skill in the refine page correctly auto-selects it even if the user was previously refining a different skill.

---

## 8. Skills Intake Wizard (Built)

The skill creation wizard was expanded from 2 steps to 4 steps (VD-845):

1. **Basic info**: name, domain
2. **Skill type**: skill_type field (domain / platform / source / data-engineering / skill-builder)
3. **Behaviour**: argument_hint, user_invocable, disable_model_invocation
4. **Options**: model preference, other settings

This extended frontmatter (`skill_type`, `version`, `model`, `argument_hint`, etc.) unifies the metadata schema between built skills and marketplace skills — both can now carry the same set of fields.

Some fields are **locked** for marketplace-imported skills (cannot be edited in the UI) since they're authored externally.

---

## 9. Publishing Flow (Not Built — Phase 3)

The publish path (Skill Builder app → marketplace GitHub repo via PR) is not yet implemented. Current state:
- Built skills can be pushed to a **team repo** via the existing push feature
- No dedicated "publish to marketplace" action exists
- The existing push pipeline (auth, versioning via git tags, haiku changelog, PR creation) provides the foundation

**Planned work**:
- "Publish to Marketplace" button targeting the `marketplace_url` repo instead of the team repo
- Auto-generate `category`/`tags` metadata via haiku
- PR body includes validation results
- Human review + merge workflow (Phase 3 uses manual review; Phase 4 adds trusted-author fast-path)

---

## 10. Companion-to-Marketplace Bridge (Not Built — Phase 2)

The companion recommender already produces structured YAML with `slug`, `dimension`, `type`, `priority`, and `trigger_description`. A marketplace match would let each companion recommendation resolve to "Install from marketplace" vs "Build this skill."

**Matching algorithm** (planned):
1. **Exact slug match**: `skill_name` in marketplace == companion `slug`
2. **Dimension match**: marketplace `dimensions_covered` contains companion `dimension` AND `skill_type` matches
3. **Semantic fallback** (haiku): match `trigger_description` against marketplace skill descriptions

**Requires**:
- Companion UI component (VD-697, not yet built)
- `dimensions_covered` and `conventions` fields parsed from SKILL.md frontmatter

---

## 11. Roadmap

### Phase 1 (Built — VD-696)
- `marketplace_url` setting (single GitHub repo as registry)
- Browse: live scan of repo for SKILL.md files
- Install: download + dual DB record (imported skills registry + skill runs table)
- Skills library tab with marketplace browse button
- Pre-marking of installed skills in browse dialog
- Type filter support in browse dialog
- Refinement for marketplace skills (full integration)
- Extended skill frontmatter + 4-step intake wizard

### Phase 2: Companion Matching & Recommendations
- Companion UI panel (VD-697)
- Companion-to-marketplace slug/dimension/semantic matching
- "Recommended for You" section on marketplace browse page
- Convention skills auto-suggestion based on `conventions` frontmatter

### Phase 3: Publishing, Version Tracking, Community Signals
- "Publish to Marketplace" from skill builder → PR to marketplace repo
- Version comparison: detect when imported skill has a newer upstream version
- `marketplace.json` catalog for richer metadata (featured, install counts)
- Author profiles

### Phase 4: Multi-Registry, Private Marketplaces
- Multiple marketplace repos (public + team + private)
- Registry management UI
- Private repo support via existing GitHub OAuth

---

## 12. Key Design Decisions

### Decision 1: No Catalog File in Phase 1

**Considered**: `marketplace.json` static catalog (as originally designed) vs. live GitHub API scanning.

**Implemented**: Live scanning. The existing infrastructure already fetches the repo tree and parses frontmatter — adding a catalog file would require keeping it in sync with actual skill directories. For Phase 1, scan-on-open is simpler and always current. Performance (API call per dialog open) is acceptable for the current scale.

**Phase 3**: A `marketplace.json` catalog makes sense once we need richer metadata (install counts, featured status, author info) that can't come from SKILL.md alone.

### Decision 2: Dual DB Write

**Implemented**: Every marketplace import creates records in both the imported skills registry AND the skill runs table. This was a deliberate design choice:
- The imported skills registry drives the skills library tab (toggle active/inactive, delete, settings-skills view)
- The runs table makes marketplace skills first-class citizens: they appear in the dashboard, are refinable, have domain/type, and share the same lifecycle model as built skills

**Trade-off**: Two records per marketplace skill, with the risk of drift. The upsert pattern ensures both stay in sync on re-import.

### Decision 3: Overwrite on Re-import

**Implemented**: Marketplace imports always remove the existing directory before downloading. This ensures re-imports are always idempotent and clean — stale files removed from the upstream repo are cleaned up locally.

**Contrast**: The settings-skills import mode fails if the skill already exists on disk — those imports are deliberate one-time operations, not managed updates.

### Decision 4: Single Marketplace URL

**Implemented**: One `marketplace_url` setting. This is the simplest path: the app has one "official" marketplace the user configures.

**Phase 4**: Multiple marketplace URLs (team + private + public) require a registry of marketplaces, a UI for managing them, and disambiguation when the same skill name exists in multiple registries. Not needed for Phase 1-2.

### Decision 5: skill_type as the Taxonomy

**Implemented**: `skill_type` (domain / platform / source / data-engineering / skill-builder) is the primary browse taxonomy. Each call site decides which types to show via the type filter.

**Note**: `category` field (a more granular sub-taxonomy) was designed but not implemented. `skill_type` + free-form tags provide sufficient filtering for Phase 1.

---

## 13. Open Questions

1. **Conflict with built skills**: If a built skill and a marketplace import share the same `skill_name`, the import silently overwrites. Should we detect this and prompt the user before proceeding?

2. **Version tracking**: Marketplace skills have no update detection. When is the right time to implement "version available" checks, and where should they show in the UI?

3. **Offline mode**: The browse dialog requires a network call. Should we cache the last fetched skill list locally for offline/slow-network resilience?

4. **Skills library type filter**: The skills library tab shows only `skill_type='skill-builder'` imported skills. Is this the right filter, or should it show all imported skills regardless of type?

5. **Convention skills**: Skills with `conventions` frontmatter declare tool dependencies. When should we auto-suggest installing them, and how do we link convention installs to the importing skill?

6. **Multi-org marketplaces**: Should `marketplace_url` support a list of URLs (team + official), or should Phase 4 introduce a formal multi-registry model?
