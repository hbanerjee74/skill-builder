# Canonical `clarifications.md` Format

Authoritative spec for the `clarifications.md` file produced by agents and consumed by the app's parser and UI. All agent prompts, mock templates, E2E fixtures, and design docs must conform to this format.

Tracked in VD-819. Referenced by VD-807 (agent redesign) and VD-817 (UI parser).

---

## YAML Frontmatter

```yaml
---
question_count: 26        # required — total Q-level questions
sections: 6               # required — number of ## sections
duplicates_removed: 17    # required — consolidation stat
refinement_count: 16      # required — total R-level items (0 for step 0)
status: pending           # optional — workflow status
priority_questions: [Q1, Q2, Q3]  # optional — MUST ANSWER question IDs
scope_recommendation: true        # optional — set by scope advisor, checked by downstream agents
---
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `question_count` | integer | Total number of top-level Q-questions |
| `sections` | integer | Number of `## ` section headings |
| `duplicates_removed` | integer | Number of duplicates eliminated during consolidation |
| `refinement_count` | integer | Total R-level refinement items (0 before Step 3) |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `status` | string | Workflow status (e.g. `pending`, `answered`) |
| `priority_questions` | list | IDs of `[MUST ANSWER]` questions |
| `scope_recommendation` | boolean | Set by scope advisor; checked by Scope Recommendation Guard |

---

## Heading Hierarchy

```
# Research Clarifications          ← document title (H1)
## Section Name                    ← topic section (H2)
### Q1: Short Title [MUST ANSWER]  ← question (H3), optional tag
#### Refinements                   ← refinement container (H4)
##### R1.1: Refinement Title       ← refinement question (H5)
##### R1.1a: Sub-refinement Title  ← sub-refinement (H5, letter suffix)
```

Each level nests under the previous. The `#### Refinements` heading appears only when a question has refinements.

---

## Question Template

```markdown
### Q1: MRR Definition by Service Type [MUST ANSWER]
How is MRR calculated across your three service categories?

A. Managed Services MRR = recurring monthly fee. PS <12mo = TCV / engagement months.
B. Managed Services MRR = monthly fee. PS <12mo treated as one-time (excluded).
C. MRR applies only to Managed Services. All PS deals tracked as TCV.
D. Other (please specify)

_Consolidated from: Metrics Q1, Segmentation Q2, Business Rules Q5_

**Recommendation:** A — Use recurring fee for MS; spread TCV for PS.

**Answer:**
```

### Field-by-field spec

| Field | Format | Required | Notes |
|---|---|---|---|
| Heading | `### Q{n}: Short Title` | yes | `[MUST ANSWER]` tag is optional, placed at end of heading |
| Body text | Plain text on next line(s) | yes | The full question; heading is just a short title |
| Choices | `A. Choice text` | yes | 2-4 choices + `D. Other (please specify)`. Lettered with period, no label needed |
| Consolidated from | `_Consolidated from: ..._` | optional | Italicized, only on first-round consolidated questions |
| Recommendation | `**Recommendation:** Full sentence.` | yes | Between choices and answer. Colon inside bold |
| Answer | `**Answer:**` | yes | Colon inside bold. Empty until user fills in. Followed by a blank line |

### Rules

- No `**Choices**:` label. The `A.` / `B.` / `C.` pattern is self-evident.
- No checkbox syntax (`- [ ]`, `- [x]`). Just `A. text`.
- No `**(recommended)**` inline markers on choices. Recommendations go in the `**Recommendation:**` field.
- No `**Question:**` label. The question body is plain text after the heading.
- Every question ends with `**Answer:**` followed by a blank line (even if unanswered).

---

## Refinement Template

Refinements appear under a `#### Refinements` heading within their parent question block.

```markdown
#### Refinements

##### R1.1: Why TCV/10 for PS Projects Under 12 Months
Rationale for why this matters given the answer above...

A. 10 is a fixed company-wide assumption for average PS engagement length
B. 10 approximates billable months after excluding ramp/close
C. It varies — divisor is negotiated or set at deal level
D. Other (please specify)

**Recommendation:** A — Fixed assumption simplifies the formula.

**Answer:**

##### R1.2: Definition of "Year 1 Value" for PS Projects Over 12 Months
For PS projects longer than 12 months, how is "Year 1 value" defined?

A. First 12 months of contracted revenue
B. Annual contract value (ACV) regardless of term length
C. Other (please specify)

**Recommendation:** A — First 12 months is the most common convention.

**Answer:**
```

### Refinement ID scheme

| Level | Format | Example | Who creates it |
|---|---|---|---|
| Top-level question | `Q{n}` | `Q1`, `Q12` | consolidate-research (Step 1) |
| Refinement | `R{n}.{m}` | `R1.1`, `R12.2` | detailed-research sub-agents (Step 3) |
| Sub-refinement | `R{n}.{m}{a}` | `R12.1a`, `R12.2b` | detailed-research consolidation (Step 3) |

The parent is always embedded in the ID:
- `R1.1` -> refinement 1 of **Q1**
- `R12.2b` -> sub-refinement (b) of **R12.2**, which itself refines **Q12**

---

## Sub-refinement Template

Sub-refinements use the same `#####` heading level and follow the same format. They are generated when a refinement answer opens another gap.

```markdown
##### R12.1: Stage Threshold for Committed Pipeline
What pipeline stage marks "committed"?

A. Specific named stage (e.g. Proposal Sent, Negotiation)
B. Any stage after qualification
C. Forecast flag, not stage-based
D. Other (please specify)

**Recommendation:** A — Named stage gives the clearest threshold.

**Answer:** A (specific named stage)

##### R12.1a: Which Named Stage Is the Committed Pipeline Threshold?
The PM confirmed named stage — but which one?

A. Proposal Sent
B. Negotiation
C. Verbal Commit
D. Other (please specify)

**Recommendation:** A — Proposal Sent is the most common threshold.

**Answer:**
```

---

## `## Needs Clarification` Section

Appears at the end of the file when contradictions or critical gaps are found.

```markdown
## Needs Clarification

### Contradiction: Pipeline Entry vs. Committed Stage
Q2 says stage beyond "Prospecting" enters pipeline. Q12 says "Proposal Sent" is the committed threshold. These may be compatible (entry != commitment) but the PM should confirm.

### Critical Gap: Win Rate Definition
Q17 is marked [MUST ANSWER] but has no answer. This is required for skill generation.
```

---

## Parser Notes

Regex patterns for key fields (used by the Rust autofill parser and the UI renderer):

| Field | Regex | Notes |
|---|---|---|
| Section heading | `^## (.+)` | Resets recommendation state |
| Question heading | `^### (Q\d+): (.+?)(\s+\[MUST ANSWER\])?$` | Groups: ID, title, optional tag |
| Refinement heading | `^##### (R\d+\.\d+[a-z]?): (.+)$` | Groups: ID, title |
| Refinement container | `^#### Refinements$` | Marks start of refinement block |
| Choice | `^([A-Z])\. (.+)$` | Groups: letter, text |
| Consolidated from | `^_Consolidated from: (.+)_$` | Group: source list |
| Recommendation | `^\*\*Recommendation:\*\*\s*(.+)$` | Group: recommendation text |
| Answer | `^\*\*Answer:\*\*\s*(.*)$` | Group: answer text (may be empty) |
| Frontmatter | `^---$` delimited YAML block | Standard YAML frontmatter |
