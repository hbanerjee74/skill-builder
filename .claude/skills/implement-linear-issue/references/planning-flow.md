# Planning Flow

## Spawn a Planning Sub-agent

Use `subagent_type: "feature-dev:code-architect"` with `model: "sonnet"`.

Provide: worktree path, issue title, requirements, acceptance criteria.

The planner does a structural scan — understanding what areas are involved and dependencies, not implementation details.

## Required Outputs

The plan must cover:
1. **Work streams** — what can run in parallel vs. what has dependencies
2. **AC mapping** — which stream/task addresses each acceptance criterion. Flag any uncovered ACs.
3. **Risk notes** — shared files, potential conflicts between streams

Format is flexible — clarity matters more than structure.

## Present Plan to User

Show work streams, dependency chain, AC mapping, and risks. User may approve, adjust, or reorder.

## Parallelization Principles

1. Independent tasks run simultaneously
2. Sequential if touching same files
3. Front-load risky/uncertain work
