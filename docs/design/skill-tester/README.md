# Skill Tester

**Issue:** VD-603

---

## Purpose

The Skill Tester lets you run a single prompt against a coding agent twice — once with your skill loaded, once without — and see a side-by-side plan comparison with an automated evaluation of the delta.

Each run is stateless: fresh agent processes, no prior conversation, no accumulated context. This makes the skill's influence on agent behaviour visible in isolation.

---

## How it works

Two plan agents run in parallel, then an evaluator runs after both complete.

| Run | Workspace | Prompt |
|---|---|---|
| **With skill** | `.claude/skills/skill-test/` + `.claude/skills/{skill_name}/` | wrapped: "You are a data engineer and the user is trying to do the following task: …" |
| **Without skill** | `.claude/skills/skill-test/` only | same wrapped prompt |

Both plan agents receive the same wrapped prompt. The difference is entirely in what the SDK loads from each workspace. After both plans complete, a third evaluator agent compares them and scores the delta across the six rubric dimensions.

---

## What the evaluator sees

The evaluator runs in the **baseline** workspace (so it loads the `skill-test` Evaluation Rubric automatically). Its prompt embeds the raw user prompt (not the wrapped version) and the full output from both plan agents. It does **not** receive the skill content itself — it judges the output, not the intent. If the skill didn't guide the agent toward better plans, the evaluator will say so.

---

## What this is not

- **Not the full eval harness** — no 7-dimension scoring rubric, no multi-prompt batch runs, no JSON output. That's `scripts/eval/eval-skill-quality.sh`.
- **Not a chat interface** — no multi-turn, no session, no message history.
- **Not Refine** — no skill editing, no file diffs, no agent session persistence.

---

## Prompts

See [PROMPTS.md](PROMPTS.md) for the exact prompt strings sent to each agent — workspace context formats, plan agent prompt, and evaluator prompt.

## Visual reference

See `mockup.html` in this folder — open in any browser.
