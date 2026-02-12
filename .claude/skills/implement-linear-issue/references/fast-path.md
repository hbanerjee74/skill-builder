# Fast Path — Small Issues

## When to Use

Use when ALL are true:
- Estimate is XS or S (1-2 points)
- Changes are isolated to one area of the codebase
- User can override in either direction

## How It Works

Skip team orchestration. Spawn a **single `general-purpose` sub-agent** that implements, tests, commits, pushes, and checks off ACs on Linear.

Proceed directly to **Phase 5 (Code Review)**. Code review and PR creation are never skipped.

Phase 9 Linear updates still apply — write what was done, tests, and PR link.
