---
inclusion: always
---

# Git Workflow

## Parallel Development with Worktrees

Work is parallelized through **git worktrees** — multiple instances in parallel, each in its own worktree.

### Creating a Worktree

Branch from `main`:

```bash
git worktree add ../worktrees/<branch-name> -b <branch-name> main
cd ../worktrees/<branch-name>/app && npm install
cd sidecar && npm install && npm run build && cd ..
```

### Cleanup After Merge

```bash
git worktree remove ../worktrees/<branch-name>
git branch -D <branch-name>
git push origin --delete <branch-name>
git pull origin main
```

### Worktree Rules

- **Keep branches focused** — one feature, fix, or refactor per branch
- **Avoid overlapping file edits** to minimize merge conflicts
- **Frontend, backend, and sidecar are independent** — safe to work on in parallel
- **Verify before committing**: `npx tsc --noEmit` + `cargo check`

## Commits

**Make granular commits.** Each commit should be a single logical change that compiles and passes tests.

- **One concern per commit** — don't mix changes
- **Descriptive messages** — explain what and why, not how
- **Run tests before each commit**
- **Stage specific files** — use `git add <file>` not `git add .`
