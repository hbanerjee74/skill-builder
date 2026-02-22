# Consolidation Handoff — Canonical `clarifications.md` Format

This file contains the full specification for the `clarifications.md` output format and the consolidation logic the skill coordinator follows in Step 4. It is the authoritative reference for producing correctly-formatted clarifications that the downstream app parsers and UI renderer can consume.

---

## Your Role in Consolidation

Synthesize raw research text from multiple parallel dimension Tasks into a single, cohesive `clarifications.md` as inline text. This is not mechanical deduplication -- reason about the full findings to consolidate overlapping concerns, rephrase for clarity, and organize into a logical flow a PM can answer efficiently.

Use extended thinking to reason about the question set before writing. Consider how questions from different Tasks interact, identify hidden dependencies, and minimize cognitive load for the PM.

---

## Step-by-Step Consolidation Instructions

### Step 1: Understand all inputs

Each dimension Task returns 500–800 words of raw research text. Read all of it before organizing.

### Step 2: Deduplicate and organize

For each cluster of related questions or decision points across dimension findings:

- **Identify the underlying decision** — two questions that look different may resolve the same design choice
- **Pick the strongest framing** — the version with the most specific choices and clearest implications
- **Fold in unique value** from weaker versions — additional choices, better rationale, broader context
- **Rephrase if needed** — the consolidated question should read naturally, not like a patchwork

Arrange into logical sections: broad scoping first, then detailed design decisions. Add a `## Cross-cutting` section for questions that span multiple research dimensions.

Within each `##` section, group questions under two sub-headings:
- `### Required` — questions critical to producing a correct skill (core metric definitions, entity identifiers, must-have business rules). The skill cannot be generated without answers to these.
- `### Optional` — questions that refine quality but where a reasonable default exists.

If a section has only required or only optional questions, include only the relevant sub-heading.

### Step 3: Handle contradictions and flags

Put contradictions in a `## Needs Clarification` section with clear explanations. Do not silently resolve contradictions.

### Step 4: Build the complete file

Number questions sequentially (Q1, Q2, ...). Follow the format spec below exactly. For consolidated questions that draw from multiple dimensions, note the sources: `_Consolidated from: [dimension names]_`.

**Always:**
- Every question must have 2–4 lettered choices plus a final "Other (please specify)" choice
- Include a `**Recommendation:**` field between choices and answer
- Every question must end with `**Answer:**` followed by a blank line
- YAML frontmatter must include accurate counts for all required fields
- YAML frontmatter must include `priority_questions` listing all Required question IDs
- Do NOT use `[MUST ANSWER]` inline tags in question headings
- Produce the complete file content in a single pass as inline text

---

## Canonical `clarifications.md` Format

### YAML Frontmatter

```yaml
---
question_count: 26        # required — total Q-level questions
sections: 6               # required — number of ## sections
duplicates_removed: 17    # required — number of duplicate questions eliminated during consolidation
refinement_count: 16      # required — total R-level items (0 for step 0, which this is)
status: pending           # optional — workflow status
priority_questions: [Q1, Q2, Q3]  # optional — IDs of questions under ### Required sub-headings
scope_recommendation: true        # optional — set by scope advisor, checked by downstream agents
---
```

#### Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| `question_count` | integer | Total number of top-level Q-questions (count every `### Q{n}:` heading) |
| `sections` | integer | Number of `## ` section headings in the document |
| `duplicates_removed` | integer | Number of duplicate questions eliminated during consolidation. Count each collapsed group as (n-1) duplicates removed |
| `refinement_count` | integer | Total R-level refinement items. Always 0 at Step 0 — refinements are added by `detailed-research` in Step 3 |

#### Optional frontmatter fields

| Field | Type | Description |
|---|---|---|
| `status` | string | Workflow status (e.g. `pending`, `answered`) |
| `priority_questions` | list | IDs of all questions that appear under `### Required` sub-headings. Omit only when there are no Required questions — otherwise it must be populated so downstream agents can enforce required-answer gating. |
| `scope_recommendation` | boolean | Set by scope advisor when scope is too broad; checked by downstream agents |

---

### Heading Hierarchy

```
# Research Clarifications          ← document title (H1, always this exact text)
## Section Name                    ← topic section (H2)
### Required                       ← required question group (H3, conditional)
### Q1: Short Title                ← question (H3)
### Optional                       ← optional question group (H3, conditional)
### Q3: Short Title                ← question (H3)
#### Refinements                   ← refinement container (H4, added in Step 3 — not Step 0)
##### R3.1: Refinement Title       ← refinement question (H5, added in Step 3)
##### R3.1a: Sub-refinement Title  ← sub-refinement (H5, letter suffix, added in Step 3)
```

- Each section may have only `### Required`, only `### Optional`, or both sub-headings — conditional on content
- Each level nests under the previous
- The `#### Refinements` heading and `##### R{n}.{m}:` headings are added by `detailed-research` in Step 3. Do not create them in Step 0
- The document title is always exactly `# Research Clarifications`

---

### Question Template

```markdown
### Q1: MRR Definition by Service Type
How is MRR calculated across service categories?

A. Recurring fee (MS); TCV spread over engagement months (PS)
B. Recurring fee (MS); PS short-term treated as one-time
C. MRR for Managed Services only; PS as TCV
D. Other (please specify)

_Consolidated from: Metrics Research, Segmentation Research_

**Recommendation:** A — Use recurring fee for MS; spread TCV for PS.

**Answer:**
```

#### Field-by-field spec

| Field | Format | Required | Notes |
|---|---|---|---|
| Heading | `### Q{n}: Short Title` | yes | Sequential Q numbering. No inline tags. Required vs optional indicated by preceding `### Required` / `### Optional` sub-heading |
| Body text | Plain text on next line(s) | yes | One crisp sentence or short phrase. Avoid multi-clause sentences with subclauses ("given that", "in scenarios where", "because"). The heading is just a short title |
| Choices | `A. Choice text` | yes | 2–4 choices + final "Other (please specify)". Each choice is a short label — a few words, not a full sentence. Reasoning belongs in `**Recommendation:**` |
| Consolidated from | `_Consolidated from: ..._` | optional | Italicized, only when question draws from multiple dimension sources |
| Recommendation | `**Recommendation:** Full sentence.` | yes | Between choices and answer. Colon inside bold. Keep the reasoning explanation at full length here |
| Answer | `**Answer:**` | yes | Colon inside bold. Empty until user fills in. Followed by a blank line |

#### Rules

- No `**Choices**:` label. The `A.` / `B.` / `C.` pattern is self-evident
- No checkbox syntax (`- [ ]`, `- [x]`). Just `A. text`
- No `**(recommended)**` inline markers on choices. Recommendations go in the `**Recommendation:**` field
- No `**Question:**` label. The question body is plain text after the heading
- Every question ends with `**Answer:**` followed by a blank line (even if unanswered)
- **Question body is one concise sentence or short phrase** — not a multi-clause explanation. "Cross-area cost center hierarchies?" is better than "How should the skill handle scenarios where cost center hierarchies span multiple controlling areas, given that this affects how allocation chains are modeled?"
- **Choice labels are short (a few words each)** — do not write full sentences or embed rationale in the label. "Independent per controlling area" is better than "Model each controlling area independently with no cross-area allocation support". The reasoning belongs in `**Recommendation:**`

---

### Refinement Template (Step 3 reference — do not create in Step 0)

Refinements are added by `detailed-research` in Step 3. They appear under a `#### Refinements` heading within their parent question block. Shown here for reference so the Step 0 output is compatible.

```markdown
#### Refinements

##### R1.1: Why TCV/10 for PS Projects Under 12 Months
Rationale for why this matters given the answer above...

A. Fixed company-wide assumption
B. Approximates billable months after ramp/close
C. Varies — negotiated or set at deal level
D. Other (please specify)

**Recommendation:** A — Fixed assumption simplifies the formula and avoids per-deal configuration.

**Answer:**
```

#### Refinement ID scheme

| Level | Format | Example | Who creates it |
|---|---|---|---|
| Top-level question | `Q{n}` | `Q1`, `Q12` | Step 0 consolidation (this step) |
| Refinement | `R{n}.{m}` | `R1.1`, `R12.2` | `detailed-research` in Step 3 |
| Sub-refinement | `R{n}.{m}{a}` | `R12.1a`, `R12.2b` | `detailed-research` consolidation in Step 3 |

The parent is always embedded in the ID:
- `R1.1` → refinement 1 of **Q1**
- `R12.2b` → sub-refinement (b) of **R12.2**, which itself refines **Q12**

---

### `## Needs Clarification` Section

Appears at the end of the file when contradictions or critical gaps are found.

```markdown
## Needs Clarification

### Contradiction: Pipeline Entry vs. Committed Stage
Q2 says stage beyond "Prospecting" enters pipeline. Q12 says "Proposal Sent" is the committed threshold. These may be compatible (entry != commitment) but the PM should confirm.

### Critical Gap: Win Rate Definition
Q17 is a required question (listed in priority_questions) but has no answer. This is required for skill generation.
```

---

## Complete Example (abbreviated)

```markdown
---
question_count: 8
sections: 3
duplicates_removed: 4
refinement_count: 0
priority_questions: [Q1, Q3, Q5]
---
# Research Clarifications

## Entity Model

### Required

### Q1: Customer Hierarchy Depth
How many hierarchy levels do you support?

A. Single level — all accounts are peers
B. Two levels — parent and subsidiaries
C. Three or more levels — full corporate tree
D. Other (please specify)

**Recommendation:** B — Two levels covers most enterprise use cases without excessive complexity.

**Answer:**

### Optional

### Q2: Account Type Classification
How are accounts classified by type?

A. Industry vertical only
B. Account tier (Enterprise, Mid-Market, SMB)
C. Both industry and tier
D. Other (please specify)

**Recommendation:** C — Dual classification enables richer segmentation.

**Answer:**

## Metrics

### Required

### Q3: Win Rate Definition
How is win rate calculated?

A. Closed-won / all closed opportunities
B. Closed-won / all opportunities in period
C. Closed-won / qualified-stage opportunities
D. Other (please specify)

**Recommendation:** C — Qualification-stage denominator removes noise from unqualified leads.

**Answer:**
```

---

## Parser Compatibility

The Rust autofill parser and UI renderer depend on these exact patterns. Do not deviate.

| Field | Regex | Notes |
|---|---|---|
| Section heading | `^## (.+)` | Resets recommendation state |
| Question heading | `^### (Q\d+): (.+)$` | Groups: ID, title |
| Required group | `^### Required$` | Marks start of required questions within a section |
| Optional group | `^### Optional$` | Marks start of optional questions within a section |
| Refinement heading | `^##### (R\d+\.\d+[a-z]?): (.+)$` | Groups: ID, title |
| Refinement container | `^#### Refinements$` | Marks start of refinement block |
| Choice | `^([A-Z])\. (.+)$` | Groups: letter, text |
| Consolidated from | `^_Consolidated from: (.+)_$` | Group: source list |
| Recommendation | `^\*\*Recommendation:\*\*\s*(.+)$` | Group: recommendation text |
| Answer | `^\*\*Answer:\*\*\s*(.*)$` | Group: answer text (may be empty) |
| Frontmatter | `^---$` delimited YAML block | Standard YAML frontmatter |
