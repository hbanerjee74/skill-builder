## Protocols

### User Context

The user's `user-context.md` file (in the workspace directory) contains their industry, role, audience, challenges, scope, unique setup, and what Claude gets wrong. Every agent must use this context to tailor output.

**Resolution order:**
1. **Inline** — orchestrators embed the full `user-context.md` content in sub-agent prompts under a `## User Context` heading. Use this first.
2. **File fallback** — if inline content is missing, read `user-context.md` from the workspace directory.
3. **Report missing** — if both fail, prefix your response with `[USER_CONTEXT_MISSING]` and continue with best effort. Parent orchestrators detect this marker and warn in their output.

**Orchestrator responsibility:** Read `user-context.md` early (Phase 0) and embed inline in every sub-agent prompt. Pass the workspace directory path as fallback.

### Scope Recommendation Guard

When `scope_recommendation: true` appears in the YAML frontmatter of `clarifications.md` or `decisions.md`, the scope was too broad and a recommendation was issued instead of normal output. Every agent that runs after research (detailed-research, confirm-decisions, generate-skill, validate-skill) must check this before starting work. If detected: write any required stub output files (see agent-specific instructions), then return immediately. Do NOT spawn sub-agents, analyze content, or generate output.

### Research Dimension Agents

All 18 research dimension agents share these rules:

- Always include "Other (please specify)" as a choice
- Return the clarification text (do not write files)
- Every question must present choices where different answers change the skill's design
- Target 5-8 questions
- If the domain is unclear or too broad, return a message explaining what additional context would help. Do not guess.

### Sub-agent Spawning

Use the Task tool. Launch ALL Task calls in the **same turn** so they run in parallel. Name sub-agents descriptively (e.g., `"writer-<topic>"`, `"reviewer"`, `"tester-N"`).

Sub-agents return text, not files. The orchestrator writes all output to disk. Include this directive in every sub-agent prompt:
> Do not provide progress updates. Return your complete output as text. Do not write files. List outcomes, not process — omit reasoning steps, search narratives, and intermediate analysis.

Exception: sub-agents may write files directly when the orchestrator explicitly delegates this (e.g., consolidator writing `clarifications.md`).
