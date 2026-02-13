---
name: close-linear-issue
description: |
  Closes a completed Linear issue after manual testing. Rebases the feature branch onto main,
  merges the PR, moves the issue to Done, and cleans up the worktree and remote branch.
  Triggers on "close VD-123", "complete VD-123", "merge VD-123", "ship VD-123", or "/close-issue".
---

# Close Linear Issue

You are a **coordinator**. You do NOT write code or resolve conflicts yourself. You orchestrate sub-agents via `Task` and relay results.

## Autonomy

Proceed autonomously through each phase. Only confirm with the user:
- Manual testing status (Phase 2)
- Merge conflicts that require human decisions (Phase 3)

## Progress Checklist

Copy and track:
```
- [ ] Phase 1: Identify issue, PR, and worktree
- [ ] Phase 2: Confirm manual testing
- [ ] Phase 3: Rebase onto main
- [ ] Phase 4: Merge PR
- [ ] Phase 5: Close Linear issue + clean up
```

## Workflow

### Phase 1: Identify

Gather all information in **parallel** using multiple `Task` calls in a single turn:

**Sub-agent A** — Fetch the Linear issue via `linear-server:get_issue`. Return: ID, title, status, and the `gitBranchName` field (this is the branch name used for the PR and worktree).

**Sub-agent B** — Run `git worktree list` and return the list of active worktrees.

Once both return, use the `gitBranchName` from the Linear issue to:
1. Find the PR: `gh pr list --head <gitBranchName> --json number,url,title,state`
2. Find the worktree path: match `gitBranchName` against the worktree list (expected at `../worktrees/<gitBranchName>`)

Verify the issue is in **In Review** or **In Progress**. If already **Done**, skip to Phase 5 (cleanup only). If no PR exists, stop.

Report to the user: issue status, PR URL, worktree path.

### Phase 2: Confirm Manual Testing

Ask the user: "Has manual testing passed?" If they report issues, stop — they should fix via the implement skill first.

### Phase 3: Rebase onto Main

Spawn a **single `general-purpose` sub-agent** with the worktree path and branch name. It must:

1. Run in the **worktree directory**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. **If conflicts occur**: list conflicting files, attempt to resolve, `git add` + `git rebase --continue`. If a conflict requires human judgment, report back with the conflicting files and hunks — the coordinator will ask the user.
3. After successful rebase:
   ```bash
   git push --force-with-lease
   ```
4. Wait for CI: `gh pr checks <number> --watch`. Report pass/fail.

If CI fails, report to user and stop.

### Phase 4: Merge PR

Spawn a **`general-purpose` sub-agent** (model: `haiku`) that:

1. Checks the repo's merge strategy:
   ```bash
   gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed
   ```
2. Merges using the first allowed strategy (prefer squash > merge > rebase):
   ```bash
   gh pr merge <number> --squash --delete-branch
   ```
   The `--delete-branch` flag removes the remote branch automatically.
3. Returns: merge commit SHA and confirmation.

### Phase 5: Close Linear Issue + Clean Up

These two operations are **independent** — run them in **parallel** as two `Task` calls in a single turn:

**Sub-agent A** (model: `haiku`) — Close the Linear issue:
1. Move to **Done**: `linear-server:update_issue` with `state: "Done"`
2. Add a closing comment with `linear-server:create_comment`: PR URL, merge commit, brief summary of what was delivered

**Sub-agent B** — Clean up git (run from the **main repo directory**, not the worktree):
1. Remove the worktree:
   ```bash
   git worktree remove ../worktrees/<gitBranchName>
   ```
   If it fails due to uncommitted changes, use `--force` after confirming with the user.
2. Delete the local branch:
   ```bash
   git branch -d <gitBranchName>
   ```
   Use `-D` only if `-d` fails (unmerged warning) and the PR was already merged.
3. Update local main:
   ```bash
   git checkout main && git pull
   ```

Once both return, report to user: issue closed, PR merged, worktree and branches removed.

## Sub-agent Type Selection

| Task | subagent_type | model |
|---|---|---|
| Fetch Linear issue | general-purpose | haiku |
| List worktrees | Bash | default |
| Rebase + push | general-purpose | default |
| Merge PR | general-purpose | haiku |
| Close Linear issue | general-purpose | haiku |
| Git cleanup | general-purpose | default |

## Error Recovery

| Situation | Action |
|---|---|
| No PR found | Stop, tell user to create one via implement skill |
| No worktree found | Skip worktree cleanup, continue with PR and Linear |
| CI fails after rebase | Stop, report failing checks, let user decide |
| Merge conflicts during rebase | Sub-agent attempts resolution; escalates to user if needed |
| Issue already Done | Skip Linear update, proceed with cleanup only |
| Worktree has uncommitted changes | Ask user before `--force` removing |
