# Release Pipeline

Covers the CI/CD workflows, what gets published where, and how the plugin marketplace is updated on every release.

---

## Workflows

Four GitHub Actions workflows run on this repo:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci` | Every push | Unit, integration, Rust, and sidecar tests |
| `plugin` | Push touching agents, skills, or agent-sources | Structural validation + LLM plugin tests |
| `release` | Manual (`workflow_dispatch`) with a version input | Builds desktop app + publishes plugin packages |
| `test-plugin-publish` | Manual (`workflow_dispatch`) | One-shot test to verify marketplace publish credentials |

---

## Release Workflow (`release.yml`)

Triggered manually by entering a version string (e.g. `0.3.0`). Three jobs run:

### `build` (macOS + Windows, in parallel)

Builds the Tauri desktop app for each platform. Stamps the version into the app config files, bundles a Node.js 22 LTS binary so the app works on machines without Node installed, then packages everything into a ZIP:

- **macOS**: `SkillBuilder-v{VERSION}-macos.zip` — contains the `.app` bundle and a `run.sh` helper that strips quarantine before launching
- **Windows**: `SkillBuilder-v{VERSION}-windows.zip` — contains the `.exe`, the sidecar JS files, the bundled Node binary, and the agents directory

### `publish-plugins` (ubuntu, after `build`)

Assembles and pushes the four Claude Code plugin packages to the marketplace repo (`hbanerjee74/skills`). Does not depend on any build artifact — it works directly from the source repo. Steps:

1. Runs `scripts/build-plugin-skill.sh` to ensure all skill directories under `skills/` are current
2. Checks out `hbanerjee74/skills` using `MARKETPLACE_GITHUB_TOKEN`
3. Assembles each plugin package under `plugins/<name>/` — each gets its own `.claude-plugin/plugin.json` stamped with the release version, plus the skill files copied from the source repo
4. Updates `.claude-plugin/marketplace.json` with the canonical plugin list
5. Commits and pushes directly to `master` on `hbanerjee74/skills`

No PR, no review — fully automatic.

### `release` (ubuntu, after `build`)

1. Downloads the macOS and Windows ZIPs from the `build` job
2. Generates release notes — calls Claude Haiku via the Anthropic API to summarise commits into user-facing notes; falls back to a plain commit list if the API key is unavailable
3. Creates a GitHub Release tagged `v{VERSION}` with the release notes and both platform ZIPs attached

---

## Marketplace Repo (`hbanerjee74/skills`)

Structure after publish:

```
hbanerjee74/skills/
├── .claude-plugin/
│   └── marketplace.json          ← lists all 4 plugins
└── plugins/
    ├── skill-builder/            ← coordinator + 7 agents
    ├── skill-builder-research/   ← research skill
    ├── skill-builder-validate/   ← validate skill
    └── skill-builder-practices/  ← content guidelines skill
```

Users install from this marketplace:

```bash
claude plugin marketplace add hbanerjee74/skills
claude plugin install skill-builder
```

---

## Credentials

| Secret | Repo | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | `hbanerjee74/skill-builder` | Release notes generation (optional — falls back gracefully) |
| `MARKETPLACE_GITHUB_TOKEN` | `hbanerjee74/skill-builder` | Write access to `hbanerjee74/skills` for `publish-plugins` |

`MARKETPLACE_GITHUB_TOKEN` is a fine-grained PAT scoped to `hbanerjee74/skills` with Contents read/write. Branch protection must be off on `hbanerjee74/skills/master` for direct push to work.

---

## Source of Truth

All plugin content originates from this repo:

| Source | Published as |
|---|---|
| `agent-sources/workspace/CLAUDE.md` | `skill-builder/references/workspace-context.md` (injected into every agent call) |
| `agent-sources/workspace/skills/research/` | `skill-builder-research` plugin |
| `agent-sources/workspace/skills/validate-skill/` | `skill-builder-validate` plugin |
| `agent-sources/workspace/skills/skill-builder-practices/` | `skill-builder-practices` plugin |
| `skills/building-skills/` + `agents/` | `skill-builder` plugin |

`scripts/build-plugin-skill.sh` materialises the three inner skill packages into `skills/` before publishing. Run it locally after editing anything in `agent-sources/workspace/skills/`. CI uses `--check` mode to catch stale builds.

---

## Test Workflow (`test-plugin-publish.yml`)

A one-shot manual workflow for verifying that `MARKETPLACE_GITHUB_TOKEN` has correct write access to `hbanerjee74/skills` without triggering a full release build. Runs the same assemble-and-push steps as `publish-plugins` using a test version label. Run it once after rotating the PAT or changing marketplace repo settings.
