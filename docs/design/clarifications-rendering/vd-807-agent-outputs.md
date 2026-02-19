# VD-807 — Agent Output Design: Numbering, Artifacts, and Responsibilities

## Clarifications Numbering Scheme

`clarifications.md` uses a hierarchical ID system that ties every item back to its origin:

### Three levels

| Level | Format | Example | Who creates it |
|---|---|---|---|
| Top-level question | `Q{n}` | `Q1`, `Q12` | **consolidate-research** (Step 1) |
| Refinement | `R{n}.{m}` | `R1.1`, `R12.2` | **detailed-research** sub-agents (Step 3) |
| Sub-refinement | `R{n}.{m}{a}` | `R12.1a`, `R12.2b` | **detailed-research** consolidation (Step 3) |

The parent is always embedded in the ID:
- `R1.1` → refinement 1 of **Q1**
- `R12.2b` → sub-refinement (b) of **R12.2**, which itself refines **Q12**

### Markdown structure

```markdown
### Q1: MRR Definition by Service Type [MUST ANSWER]
How is MRR calculated...?

A. Option A...
B. Option B...
D. Other (please specify)

_Consolidated from: Metrics Q1, Segmentation Q2, Business Rules Q5_

**Answer**: Managed services is already MRR, PS projects < 12 months are total value / 10...

#### Refinements

##### R1.1: Why TCV/10 for PS Projects Under 12 Months
Rationale for why this matters given the answer above...

A. 10 is a fixed company-wide assumption...
B. 10 approximates billable months...
D. Other (please specify)

**Answer**: A

##### R1.2: Definition of "Year 1 Value" for PS Projects Over 12 Months
...

**Answer**: B
```

Sub-refinements follow the same pattern but are generated when a refinement answer opens another gap:

```markdown
##### R12.1: Stage Threshold for Committed Pipeline
...
**Answer**: A (specific named stage)

##### R12.1a: Which Named Stage Is the Committed Pipeline Threshold?
The PM confirmed named stage — but which one?
...
**Answer**: Proposal Sent
```

---

## Current Flow (Pre-VD-807)

```
Step 1: research-orchestrator
  └─ consolidate-research (opus) → writes clarifications.md with Q1..Qn

Step 2: Human gate — user answers questions

  ┌─ answer-evaluator (haiku) → writes answer-evaluation.json
  │   { verdict, answered_count, empty_count, vague_count, total_count }
  │   Verdict: sufficient → skip to Step 5
  │            mixed → user chooses: auto-fill & skip, or continue to Step 3
  │            insufficient → user chooses: auto-fill & skip, or answer more
  └─

Step 3: detailed-research (sonnet)
  ├─ Phase 1: Triage ALL answers from scratch (SOLID/CONTRADICTION/VAGUE/COMPLETE)
  ├─ Phase 2: Spawn sub-agents for sections with SOLID answers
  └─ Phase 3: Spawn consolidate-research (opus) → updates clarifications.md with R{n}.{m}

Step 4: Human gate — user answers refinements

Step 5: confirm-decisions (opus) → writes decisions.md from scratch
```

### Problem

When answer-evaluator returns `mixed` and the user continues to Step 3, detailed-research **re-triages everything from scratch**. The evaluator already knows which answers are clear vs unclear — detailed-research ignores that assessment and redoes the work.

---

## VD-807 Design: What Changes

### 1. answer-evaluator (Haiku) — enhanced output

**Current output** (`answer-evaluation.json`):
```json
{
  "verdict": "mixed",
  "answered_count": 15,
  "empty_count": 8,
  "vague_count": 3,
  "total_count": 26,
  "reasoning": "15 of 26 questions answered; 8 empty, 3 vague."
}
```

**New output** — adds `per_question` array using the same IDs from `clarifications.md`:
```json
{
  "verdict": "mixed",
  "answered_count": 15,
  "empty_count": 8,
  "vague_count": 3,
  "total_count": 26,
  "reasoning": "15 of 26 questions answered; 8 empty, 3 vague.",
  "per_question": [
    { "question_id": "Q1", "verdict": "clear" },
    { "question_id": "Q2", "verdict": "clear" },
    { "question_id": "Q3", "verdict": "clear" },
    { "question_id": "Q4", "verdict": "clear" },
    { "question_id": "Q5", "verdict": "clear" },
    { "question_id": "Q6", "verdict": "vague" },
    { "question_id": "Q7", "verdict": "not_answered" },
    { "question_id": "Q8", "verdict": "clear" },
    { "question_id": "Q9", "verdict": "not_answered" },
    { "question_id": "Q10", "verdict": "clear" },
    { "question_id": "Q11", "verdict": "clear" },
    { "question_id": "Q12", "verdict": "clear" },
    { "question_id": "Q13", "verdict": "not_answered" },
    { "question_id": "Q14", "verdict": "not_answered" }
  ]
}
```

**Rules** (mechanical, same as aggregate counting):
- `clear` — substantive, specific text (same as current "answered" classification)
- `not_answered` — empty or only whitespace / `(accepted recommendation)`
- `vague` — fewer than 5 words, or contains only "not sure", "default is fine", "TBD", "N/A", etc.

**No recommendations.** Haiku classifies; Sonnet interprets.

The `question_id` values match the heading IDs in `clarifications.md` (`Q1`, `Q2`, ... `Q23`). First-round evaluation runs before Step 3, so only top-level Q-numbers exist at this point — refinements (R{n}.{m}) don't exist yet.

### 2. detailed-research (Sonnet) — redesigned

Reads `answer-evaluation.json` instead of re-triaging.

#### Phase 1: Draft `decisions.md` from clear answers

For every question where `per_question[].verdict == "clear"`, write a structured draft entry:

```markdown
---
status: draft
decision_count: 12
---

### D1: MRR Calculation Formula
- **Source**: Q1
- **Section**: Core Concepts and Definitions
- **Answer**: Managed services is already MRR, PS < 12mo = TCV/10, PS > 12mo = Year 1 ACV / 12
- **Status**: draft

### D2: Committed Pipeline Signal
- **Source**: Q2
- **Section**: Core Concepts and Definitions
- **Answer**: Stage governs pipeline metrics, forecast flag governs commit calls, both tracked separately
- **Status**: draft
```

Draft entries are **structured, not reasoned** — no implications, no trade-off analysis. That's confirm-decisions' (Opus) job. Each entry records:
- The source `question_id` (e.g. `Q1`) — ties back to clarifications
- The section name
- The user's answer (verbatim or lightly summarized)
- `status: draft`

Also in Phase 1, detailed-research performs **cross-answer analysis** (which Haiku can't do):
- **Contradictions**: Two clear answers that conflict → flagged with both sides
- **Critical gaps**: `[MUST ANSWER]` questions that are `not_answered` → flagged as blocking

#### Phase 2: Spawn refinement sub-agents for non-clear items only

Group non-clear questions (`not_answered` + `vague`) by section. Spawn one sub-agent per section that has at least one non-clear item. Sections where all questions are `clear` get **no sub-agent**.

Each sub-agent receives:
- The full `clarifications.md` (for context)
- The per-question verdicts for their section (which items need refinement)
- The user's answers to clear questions in the same section (for cross-reference)

Sub-agents produce refinement questions using the standard format:
```
Refinements for Q6:

##### R6.1: Follow-up topic
Rationale...

A. Choice a
B. Choice b
C. Other (please specify)

**Answer**:

```

#### Phase 3: Inline consolidation into `clarifications.md`

**No separate consolidate-research agent.** With only non-clear items getting refinements, the sub-agent count is small — detailed-research does the consolidation itself:

1. Read existing `clarifications.md`
2. Insert `#### Refinements` blocks under each parent question
3. Deduplicate across sub-agents (same logic consolidate-research uses, but inline)
4. Add `## Needs Clarification` section for contradictions and critical gaps
5. Write updated `clarifications.md` in one pass

consolidate-research (Opus) is still used in **Step 1** where volume justifies a dedicated agent. Step 3 skips it.

### 3. confirm-decisions (Opus) — merge protocol

Currently writes `decisions.md` from scratch. With VD-807, it may find a draft already exists.

**On entry**, check if `decisions.md` exists:

| Scenario | Action |
|---|---|
| Draft decision **supported** by new refinement answers | Re-evaluate with full reasoning, add implications. Status → `resolved` |
| Draft decision **contradicted** by new answers | Rewrite decision based on new answer. Document the contradiction. Status → `conflict-resolved` |
| Draft decision with **no new information** | Keep item, add reasoning and implications. Status → `resolved` |
| New refinement answers **without** a corresponding draft | Create new decision entries as usual |

The draft is input, not output — confirm-decisions always produces the authoritative final file. All draft entries are re-evaluated; none are passed through unchanged.

### 4. Coordinator (SKILL.md) — minimal change

Add `answer-evaluation.json` path to the Step 3 prompt:

```
prompt: "...
  Context directory: ./<skillname>/context/
  Answer evaluation: ./<skillname>/context/answer-evaluation.json
  ..."
```

No other coordinator changes.

---

## ID Flow Across the Workflow

```
Step 1:  consolidate-research creates    Q1, Q2, ... Q23
Step 2:  user fills in                   **Answer**: fields
Gate:    answer-evaluator emits          per_question: [{ question_id: "Q1", verdict: "clear" }, ...]
Step 3:  detailed-research reads         per_question verdicts keyed by Q-numbers
         Phase 1: drafts                 D1 (source: Q1), D2 (source: Q2), ...
         Phase 2: sub-agents create      R6.1, R7.1, R9.1, ... (only for non-clear Q's)
         Phase 3: writes                 refinements into clarifications.md
Step 4:  user fills in                   **Answer**: fields for R{n}.{m}
Step 5:  confirm-decisions reads         draft decisions.md + answered refinements
         merges into final               D1 (resolved), D2 (resolved), ...
```

Every ID traces back to the original question. The `Source` field in decisions ties D-numbers to Q-numbers. Refinement R-numbers embed their parent Q-number. Sub-refinement R-numbers embed their parent R-number.

---

## Prerequisite: Canonicalize `clarifications.md` Format

Both VD-807 (agent redesign) and VD-817 (UI parser) depend on a single, consistent `clarifications.md` format. A format audit found **8 inconsistencies** between agent prompts, mock templates, E2E fixtures, and the Rust parser. These must be resolved before either issue starts.

### What's inconsistent

#### 1. Answer field: `**Answer**:` vs `**Answer:**`

Agent prompts (`consolidate-research.md`, `detailed-research.md`) specify `**Answer**:` (bold closes before colon). The Rust `autofill_answers` parser only matches `**Answer:**` (colon inside bold). Mock templates and E2E fixtures use `**Answer:**`.

**This is a live bug** — agents may write a format the app can't parse.

**Resolution:** `**Answer:**` is canonical (colon inside bold). Fix agent prompts and all examples in this design doc.

#### 2. Choices: three different formats

| Source | Format |
|---|---|
| This design doc | `A. Choice text` |
| Mock templates | `- [ ] a) Choice text` |
| E2E fixture | `- a) Choice text` |
| detailed-research agent spec | `- [ ] Choice a` |

**Resolution:** Pick one. The mock templates' `- [ ] a) Choice text` is the most testable (checkboxes give answer-marking capability), but `A. Choice text` is cleaner for the accordion UI. Either works — but all sources must agree.

#### 3. Refinement heading: ATX `#####` vs bold `**R1.1:**`

| Source | Format |
|---|---|
| This design doc | `##### R1.1: Title` (ATX heading) |
| Mock templates + detailed-research agent | `**R1.1: Title**` (bold text) |

**Resolution:** Pick one. ATX headings are easier to parse (regex on `^#####`). Bold text is what the agents currently produce. If we pick ATX, update agent prompts. If bold, update this design doc.

#### 4. Missing `**Recommendation:**` field

Mock templates include `**Recommendation:** Full sentence.` between choices and answer. This design doc and the design mockup omit it. The Rust autofill parser specifically looks for this field to auto-fill empty answers.

**Resolution:** Include `**Recommendation:**` in the canonical format. It's required for auto-fill (VD-782) to work.

#### 5. Question body format — three conventions

| Source | Pattern |
|---|---|
| This design doc | Short heading + body text: `### Q1: Title` then question below |
| Mock templates | Question IS the heading: `### Q1: What is the primary use case...?` |
| E2E fixture | Short heading + label: `### Q1: Title` then `**Question:** text` |

**Resolution:** Pick one. Short heading + body text is cleanest for the accordion (heading = card title, body = expandable detail).

#### 6. Missing `**Choices**:` label

Mock templates use `**Choices**:` as an explicit label before the list. This design doc omits it. An explicit label makes parser detection unambiguous.

**Resolution:** Include `**Choices**:` label if the format uses checkbox/bullet lists. Omit if using `A. B. C.` lettered format (letters are self-evident).

#### 7. Frontmatter fields

`status` and `priority_questions` appear only in the design mockup — not in agent specs. `scope_recommendation` is checked by downstream agents but not listed in `consolidate-research.md`'s spec.

**Resolution:** Document all valid frontmatter fields in the canonical format spec.

#### 8. Draft decisions.md — contradiction and critical gap format

Phase 1 flags contradictions and critical gaps but the format for these entries isn't specified in the draft `decisions.md` structure.

**Resolution:** Add format examples:

```markdown
### D13: [Critical Gap] Win Rate Definition
- **Source**: Q17
- **Section**: Metrics and Calculations
- **Answer**: (not answered)
- **Status**: critical-gap
- **Note**: This is a [MUST ANSWER] question required for skill generation.

### D14: [Contradiction] Pipeline Entry vs. Committed Stage
- **Source**: Q2, Q12
- **Section**: Cross-cutting
- **Answer (Q2)**: Stage beyond "Prospecting" enters pipeline
- **Answer (Q12)**: "Proposal Sent" is the committed threshold
- **Status**: contradiction
- **Note**: Q2 implies early-stage entry; Q12 implies late-stage commitment. These may be compatible (entry ≠ commitment) but the PM should confirm the distinction.
```

### Prep work (before VD-807 and VD-817)

1. **Define canonical format** — write a `docs/design/clarifications-rendering/canonical-format.md` with the authoritative spec: heading hierarchy, numbering, choices format, answer/recommendation fields, frontmatter fields, refinement headings. All examples in this doc and the README should reference it.

2. **Fix agent prompts** — update `agents/consolidate-research.md` and `agents/detailed-research.md` to match the canonical format (especially `**Answer:**` colon placement).

3. **Update mock templates** — align `app/sidecar/mock-templates/outputs/step0/` and `step2/` to canonical format.

4. **Update E2E fixture** — align `app/e2e/fixtures/agent-responses/review-content.md` to canonical format.

5. **Update this design doc** — replace all markdown examples with canonical format.

6. **Fix Rust parser scope bug** — `autofill_answers` resets recommendation tracking at `##` but not `###`, allowing recommendation bleed between questions in the same section. Add `###` reset.

This prep can be a single commit or a small XS issue. It's a prerequisite for both VD-807 and VD-817 — without it, the parser targets a moving format.
