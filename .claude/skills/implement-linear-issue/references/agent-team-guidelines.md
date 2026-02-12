# Agent Team Guidelines

## Team Leads

Each work stream gets a team lead (spawned via `Task`). Provide: worktree path, issue ID, the ACs this stream owns, task list, and dependencies.

Team leads coordinate within their stream — spawning sub-agents for parallel tasks, not writing code themselves.

### Rules
- Code + tests together (not separate phases)
- Commit + push before reporting (conventional format: `feat(scope): description`)
- Check off your ACs on Linear after tests pass
- Report back: what completed, tests added, ACs addressed, blockers. No exploration logs.
- Do NOT write to the Implementation Updates section (coordinator-only)

## Failure Handling

1. Assess: local issue (retry with guidance) or plan issue (re-plan)
2. Pause dependent streams if needed
3. Max 2 retries per team before escalating to user
