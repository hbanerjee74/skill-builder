# Skill Builder — Agent Instructions

This file is auto-loaded into every agent's system prompt via `settingSources: ['project']`. Do not read it manually — its content is already in your context.

## Agent Orchestration Protocols

### Rerun / Resume Mode

If the coordinator's prompt contains `[RERUN MODE]`:

1. Read the existing output file (the path provided by the coordinator) using the Read tool.
2. Present a concise summary (3-5 bullets) of what was previously produced — key entities researched, metrics identified, number of clarification questions, and any notable findings or gaps.
3. **STOP here.** Do NOT spawn sub-agents, do NOT re-run research, do NOT proceed with normal execution.
4. Wait for the user to provide direction on what to improve or change.
5. After receiving user feedback, proceed with targeted changes incorporating that feedback — you may re-run specific sub-agents or edit the output directly as needed.

If the coordinator's prompt does NOT contain `[RERUN MODE]`, ignore this section and proceed normally.

### Before You Start

**Check for existing output file:**
- Use the Glob or Read tool to check if the output file (the path provided by the coordinator) already exists.
- **If it exists:** Read it first. Your goal is to UPDATE and IMPROVE the existing file rather than rewriting from scratch. Preserve any existing questions that are still relevant, refine wording where needed, and add new questions discovered during your research. Remove questions that are no longer applicable.
- **If it doesn't exist:** Proceed normally with fresh research.

This same pattern applies to sub-agents — instruct them to check for their output files and update rather than overwrite if they exist.

### Sub-agent Communication Protocol

All sub-agents spawned via the Task tool must follow this protocol:

**Sub-agent communication:** Do not provide progress updates, status messages, or explanations during your work. When finished, respond with only a single line: `Done — wrote [filename] ([N] items)`. Do not echo file contents or summarize what you wrote.

Include this directive verbatim in every sub-agent prompt you construct.

---

## Shared Context

### Domain
Provided by the user at workflow start. The coordinator asks the user which functional domain the skill covers (e.g., sales pipeline, supply chain, HR analytics, financial planning) and passes it to all agents.

### Skill Users
Data engineers and analytics engineers who need functional domain context to:
- Understand the key entities, metrics, and business rules in the domain
- Determine what silver layer models to build (cleaned, conformed entities)
- Determine what gold layer models to build (business-level aggregates, dimensions, facts, metrics)
- Know which source system fields matter and why
- Avoid common domain-specific modeling mistakes

They already know HOW to build tables technically (SQL, dbt, etc.) — the skill provides the WHAT and WHY: which domain concepts to model, what business logic to encode, and what pitfalls to avoid.

### Content Principles

1. **Omit what LLMs already know well:**
   - Standard API/object structures (e.g., Salesforce standard objects, ERP schemas)
   - Common tool documentation (dbt, SQL syntax, warehouse platforms)
   - Well-documented systems with extensive training data
   - **Test**: "Would Claude know this without the skill?" If yes, omit it.

2. **Focus on domain knowledge that's hard to find:**
   - Industry-specific business rules and edge cases
   - Metrics definitions that vary by company or vertical
   - Common modeling mistakes specific to this domain
   - Relationships between entities that aren't obvious from source schemas
   - Business context that affects how data should be interpreted

3. **Guide WHAT and WHY, not exact HOW:**
   - Prefer: "Your customer dimension needs these attributes because..."
   - Avoid: "Create table `dim_account` with columns..."
   - Rationale: Skills should work across different data platforms, naming conventions, team preferences, and implementation patterns.
   - Exception: Be prescriptive only when exactness matters (e.g., specific metric formulas, business rule logic).

### Folder Structure

Each skill has two directories — a **context directory** for working files and a **skill output directory** for the deployable skill:

```
context/                             # All intermediate/working files
├── clarifications-concepts.md       # Research: domain concepts agent
├── clarifications-patterns.md       # Research: business patterns agent
├── clarifications-data.md           # Research: data modeling agent
├── clarifications.md                # Merged questions + PM answers
├── decisions.md                     # Confirmed decisions (clean snapshot)
├── agent-validation-log.md          # Validate: best practices results
└── test-skill.md                    # Test: test prompts + results

<skillname>/                         # Deployable skill files (skill output directory)
├── SKILL.md                         # Entry point (<500 lines)
└── references/                      # Deep-dive content loaded on demand
    ├── <topic-a>.md
    ├── <topic-b>.md
    └── ...
```

Additionally:
- `<skillname>.skill` — final deployable zip archive (created after successful build)

**Important:** The coordinator provides the full **context directory** and **skill output directory** paths to each agent when spawning it. Agents write files to the directories they are given — no extra subdirectories should be created.

### File Formats

All agent output files use YAML frontmatter for structured metadata. The frontmatter block is delimited by `---` and must be the first thing in the file. When rewriting an existing file, always include the frontmatter block with updated counts — add it if the file you are rewriting does not already have one.

#### `clarifications-*.md` (written by research agents to context directory)

```
---
question_count: 8
sections:
  - "Entity Model"
  - "Metrics & KPIs"
  - "Business Rules"
---

## [Section Heading]

### Q1: [Short question title]
**Question**: [Full question text]
**Choices**:
  a) [Choice] — [brief rationale]
  b) [Choice] — [brief rationale]
  c) Other (please specify)
**Recommendation**: [letter] — [why]
**Answer**:
```

#### `clarifications.md` (merged file, PM answers inline)

```
---
question_count: 12
sections:
  - "Entity Model"
  - "Metrics & KPIs"
  - "Business Rules"
duplicates_removed: 3
---

## [Section Heading]

### Q1: [Short question title]
**Question**: [Full question text]
**Choices**:
  a) [Choice] — [brief rationale]
  b) [Choice] — [brief rationale]
  c) Other (please specify)
**Recommendation**: [letter] — [why]
**Answer**: [PM writes chosen letter and any notes here]
```

**Auto-fill rule:** If a question's `**Answer**:` field is empty or missing, treat the `**Recommendation**:` choice as the answer. Do not ask for clarification on unanswered questions — use the recommendation and proceed.

#### `decisions.md` (in context directory)

This file is a **clean snapshot**, not a cumulative log. Each time the reasoning agent updates it, it rewrites the entire file by merging existing decisions with new ones. If a new decision supersedes or refines an earlier one, the earlier entry is replaced — not kept alongside.

```
---
decision_count: 5
round: 2
---

## Decisions

### D1: [Decision title]
- **Question**: [The original question]
- **Decision**: [The chosen answer]
- **Implication**: [What this means for the skill's design]

### D2: [Decision title]
- **Question**: [The original question]
- **Decision**: [The chosen answer]
- **Implication**: [What this means for the skill's design]
```

**Rules for updating:**
- Number decisions sequentially (D1, D2, D3...)
- If a new decision contradicts or refines an existing one, **replace** the old entry (keep the same D-number)
- If a new decision is entirely new, **add** it at the end with the next number
- The file should always read as a coherent, self-contained set of current decisions — no history, no "superseded by" notes
