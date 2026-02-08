use crate::types::*;
use chrono::{TimeZone, Utc};
use git2::{Cred, Delta, DiffOptions, FetchOptions, RemoteCallbacks, Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneResult {
    pub path: String,
    pub created_readme: bool,
    pub created_gitignore: bool,
}

const DEFAULT_README: &str = r#"# Skills

Built with [Skill Builder](https://github.com/hbanerjee/skill-builder).

## Structure

Each skill lives in its own directory under `skills/`:

```
skills/
  my-skill/
    SKILL.md          # Main skill prompt
    references/       # Supporting reference files
    context/          # Research & decision artifacts
```

## Usage

Import a `.skill` file into Skill Builder or copy a skill directory into your Claude Code project.
"#;

const DEFAULT_GITIGNORE: &str = r#"# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Skill Builder working files
*.skill
skills/*/context/
"#;

#[tauri::command]
pub async fn clone_repo(
    repo_url: String,
    dest_path: String,
    token: String,
) -> Result<CloneResult, String> {
    let dest = Path::new(&dest_path);

    // If dest already exists and has a .git dir, just pull instead
    if dest.join(".git").exists() {
        return Err("Directory already contains a git repository. Choose a different folder.".into());
    }

    // Create parent directory if needed
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Clone with token auth
    let token_clone = token.clone();
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token_clone)
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_opts);

    let repo = builder
        .clone(&repo_url, dest)
        .map_err(|e| format!("Clone failed: {}", e))?;

    // Seed README.md if missing
    let readme_path = dest.join("README.md");
    let created_readme = if !readme_path.exists() {
        fs::write(&readme_path, DEFAULT_README)
            .map_err(|e| format!("Failed to write README.md: {}", e))?;
        true
    } else {
        false
    };

    // Seed .gitignore if missing
    let gitignore_path = dest.join(".gitignore");
    let created_gitignore = if !gitignore_path.exists() {
        fs::write(&gitignore_path, DEFAULT_GITIGNORE)
            .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
        true
    } else {
        false
    };

    // Commit seeded files if any were created
    if created_readme || created_gitignore {
        let mut index = repo.index().map_err(|e| e.to_string())?;

        if created_readme {
            index
                .add_path(Path::new("README.md"))
                .map_err(|e| e.to_string())?;
        }
        if created_gitignore {
            index
                .add_path(Path::new(".gitignore"))
                .map_err(|e| e.to_string())?;
        }

        index.write().map_err(|e| e.to_string())?;
        let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

        let sig = repo
            .signature()
            .or_else(|_| git2::Signature::now("Skill Builder", "noreply@skill-builder.app"))
            .map_err(|e| e.to_string())?;

        let parent = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok());

        let parents: Vec<&git2::Commit> = parent.iter().collect();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initialize skill repo with README and .gitignore",
            &tree,
            &parents,
        )
        .map_err(|e| e.to_string())?;

        // Push the commit
        let token_push = token;
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |_url, _username, _allowed| {
            Cred::userpass_plaintext("x-access-token", &token_push)
        });

        let mut push_opts = git2::PushOptions::new();
        push_opts.remote_callbacks(callbacks);

        let mut remote = repo
            .find_remote("origin")
            .map_err(|e| e.to_string())?;

        // Determine the current branch name
        let head = repo.head().map_err(|e| e.to_string())?;
        let branch = head
            .shorthand()
            .unwrap_or("main");
        let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);

        remote
            .push(&[&refspec], Some(&mut push_opts))
            .map_err(|e| format!("Push failed: {}", e))?;
    }

    Ok(CloneResult {
        path: dest_path,
        created_readme,
        created_gitignore,
    })
}

#[tauri::command]
pub async fn commit_and_push(
    repo_path: String,
    message: String,
    token: String,
) -> Result<String, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut index = repo.index().map_err(|e| e.to_string())?;

    // Stage all changes (new, modified, deleted)
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    // Check if there's anything to commit
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let sig = repo
        .signature()
        .or_else(|_| git2::Signature::now("Skill Builder", "noreply@skill-builder.app"))
        .map_err(|e| e.to_string())?;

    let parent = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok());

    // If there's a parent, check if tree actually changed
    if let Some(ref p) = parent {
        if p.tree_id() == tree_oid {
            return Ok("No changes to commit".into());
        }
    }

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    // Push
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token)
    });

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| e.to_string())?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head.shorthand().unwrap_or("main");
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);

    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| format!("Push failed: {}", e))?;

    Ok("Committed and pushed".into())
}

#[tauri::command]
pub async fn git_pull(repo_path: String, token: String) -> Result<PullResult, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    // Get current HEAD oid before fetch
    let old_head_oid = repo
        .head()
        .ok()
        .and_then(|h| h.target());

    // Set up auth callbacks
    let token_clone = token.clone();
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token_clone)
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    // Determine current branch
    let head_ref = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let branch_name = head_ref
        .shorthand()
        .unwrap_or("main")
        .to_string();

    // Fetch from origin
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    remote
        .fetch(
            &[&branch_name],
            Some(&mut fetch_opts),
            None,
        )
        .map_err(|e| format!("Fetch failed: {}", e))?;

    // Get FETCH_HEAD
    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("Failed to get fetch commit: {}", e))?;

    // Merge analysis
    let (analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("Merge analysis failed: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok(PullResult {
            commits_pulled: 0,
            up_to_date: true,
        });
    }

    if analysis.is_fast_forward() {
        // Fast-forward merge
        let refname = format!("refs/heads/{}", branch_name);
        let mut reference = repo
            .find_reference(&refname)
            .map_err(|e| format!("Failed to find reference {}: {}", refname, e))?;

        reference
            .set_target(fetch_commit.id(), "fast-forward pull")
            .map_err(|e| format!("Failed to update reference: {}", e))?;

        repo.set_head(&refname)
            .map_err(|e| format!("Failed to set HEAD: {}", e))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| format!("Failed to checkout: {}", e))?;

        // Count commits pulled
        let new_head_oid = fetch_commit.id();
        let commits_pulled = if let Some(old_oid) = old_head_oid {
            let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
            revwalk.push(new_head_oid).map_err(|e| e.to_string())?;
            revwalk.hide(old_oid).map_err(|e| e.to_string())?;
            revwalk.count() as u32
        } else {
            1
        };

        Ok(PullResult {
            commits_pulled,
            up_to_date: false,
        })
    } else {
        Err("Local branch has diverged from remote. Please resolve manually.".into())
    }
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<CommitResult, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut index = repo.index().map_err(|e| e.to_string())?;

    // Stage all changes
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let sig = repo
        .signature()
        .or_else(|_| git2::Signature::now("Skill Builder", "noreply@skill-builder.app"))
        .map_err(|e| e.to_string())?;

    let parent = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok());

    // Check if tree actually changed
    if let Some(ref p) = parent {
        if p.tree_id() == tree_oid {
            return Err("No changes to commit".into());
        }
    }

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    // Count changed files by diffing parent tree vs new tree
    let changed_files = if let Some(ref p) = parent {
        let parent_tree = p.tree().map_err(|e| e.to_string())?;
        let diff = repo
            .diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)
            .map_err(|e| e.to_string())?;
        diff.deltas().count() as u32
    } else {
        // First commit — all files in the tree are new
        tree.len() as u32
    };

    Ok(CommitResult {
        oid: oid.to_string(),
        message,
        changed_files,
    })
}

#[tauri::command]
pub async fn git_diff(
    repo_path: String,
    file_path: Option<String>,
) -> Result<GitDiff, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    // Get HEAD tree, or None if no commits yet
    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let mut diff_opts = DiffOptions::new();
    diff_opts.include_untracked(true);
    if let Some(ref fp) = file_path {
        diff_opts.pathspec(fp);
    }

    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    let mut files: Vec<GitDiffEntry> = Vec::new();

    let include_hunks = file_path.is_some();

    // Collect diff deltas
    for delta_idx in 0..diff.deltas().len() {
        let delta = diff.deltas().nth(delta_idx).unwrap();
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            Delta::Added => "added",
            Delta::Deleted => "deleted",
            Delta::Modified => "modified",
            Delta::Renamed => "renamed",
            Delta::Copied => "copied",
            Delta::Untracked => "untracked",
            _ => "unknown",
        }
        .to_string();

        let hunks = if include_hunks {
            let mut hunk_list: Vec<DiffHunk> = Vec::new();
            let patch = git2::Patch::from_diff(&diff, delta_idx)
                .map_err(|e| format!("Failed to get patch: {}", e))?;

            if let Some(patch) = patch {
                for hunk_idx in 0..patch.num_hunks() {
                    let (hunk, _) = patch.hunk(hunk_idx).map_err(|e| e.to_string())?;
                    let mut content = String::new();

                    let num_lines = patch.num_lines_in_hunk(hunk_idx).map_err(|e| e.to_string())?;
                    for line_idx in 0..num_lines {
                        let line = patch
                            .line_in_hunk(hunk_idx, line_idx)
                            .map_err(|e| e.to_string())?;
                        let prefix = match line.origin() {
                            '+' => "+",
                            '-' => "-",
                            ' ' => " ",
                            _ => "",
                        };
                        let line_content =
                            std::str::from_utf8(line.content()).unwrap_or("<binary>");
                        content.push_str(prefix);
                        content.push_str(line_content);
                    }

                    hunk_list.push(DiffHunk {
                        old_start: hunk.old_start(),
                        old_lines: hunk.old_lines(),
                        new_start: hunk.new_start(),
                        new_lines: hunk.new_lines(),
                        content,
                    });
                }
            }
            Some(hunk_list)
        } else {
            None
        };

        files.push(GitDiffEntry {
            path,
            status,
            hunks,
        });
    }

    Ok(GitDiff { files })
}

#[tauri::command]
pub async fn git_log(
    repo_path: String,
    limit: Option<u32>,
    file_path: Option<String>,
) -> Result<Vec<GitLogEntry>, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    // If repo has no commits, return empty log
    if repo.head().is_err() {
        return Ok(Vec::new());
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)
        .map_err(|e| e.to_string())?;

    let max = limit.unwrap_or(50) as usize;
    let mut entries: Vec<GitLogEntry> = Vec::new();

    for oid_result in revwalk {
        if entries.len() >= max {
            break;
        }

        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        // If file_path filter is given, check if this commit touches that file
        if let Some(ref fp) = file_path {
            let commit_tree = commit.tree().map_err(|e| e.to_string())?;

            let parent_tree = if commit.parent_count() > 0 {
                commit
                    .parent(0)
                    .ok()
                    .and_then(|p| p.tree().ok())
            } else {
                None
            };

            let mut diff_opts = DiffOptions::new();
            diff_opts.pathspec(fp);

            let diff = repo
                .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts))
                .map_err(|e| e.to_string())?;

            if diff.deltas().count() == 0 {
                continue;
            }
        }

        let message = commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();

        let author = commit.author().name().unwrap_or("Unknown").to_string();

        let time = commit.time();
        let timestamp = Utc
            .timestamp_opt(time.seconds(), 0)
            .single()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| format!("{}", time.seconds()));

        entries.push(GitLogEntry {
            oid: oid.to_string(),
            message,
            author,
            timestamp,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub async fn git_file_status(repo_path: String) -> Result<Vec<GitFileStatusEntry>, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let mut entries: Vec<GitFileStatusEntry> = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        let status_str = if s.is_index_new() || s.is_wt_new() {
            "new"
        } else if s.is_index_modified() || s.is_wt_modified() {
            "modified"
        } else if s.is_index_deleted() || s.is_wt_deleted() {
            "deleted"
        } else if s.is_index_renamed() || s.is_wt_renamed() {
            "renamed"
        } else {
            "untracked"
        }
        .to_string();

        entries.push(GitFileStatusEntry {
            path,
            status: status_str,
        });
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use git2::{Repository, Signature};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_no_changes_detection() {
        let dir = tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        // Create a file and make an initial commit
        let file_path = dir.path().join("hello.txt");
        fs::write(&file_path, "hello world").unwrap();

        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("hello.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();

        let sig = Signature::now("Test", "test@example.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
            .unwrap();

        // Now re-stage the same content (no changes) and write a new tree
        let mut index = repo.index().unwrap();
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .unwrap();
        index.write().unwrap();
        let new_tree_oid = index.write_tree().unwrap();

        // Get the parent commit's tree id
        let head = repo.head().unwrap();
        let parent_commit = head.peel_to_commit().unwrap();
        let parent_tree_id = parent_commit.tree_id();

        // The tree OIDs should be equal, meaning "no changes to commit"
        assert_eq!(
            parent_tree_id, new_tree_oid,
            "Tree OIDs should match when there are no changes"
        );
    }

    #[tokio::test]
    async fn test_git_commit_no_changes() {
        let dir = tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        // Create a file and make an initial commit
        let file_path = dir.path().join("hello.txt");
        fs::write(&file_path, "hello world").unwrap();

        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("hello.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();

        let sig = Signature::now("Test", "test@example.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
            .unwrap();

        // Try to commit with no changes — should error
        let result = super::git_commit(
            dir.path().to_str().unwrap().to_string(),
            "empty commit".to_string(),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No changes to commit"));
    }

    #[tokio::test]
    async fn test_git_file_status_detects_changes() {
        let dir = tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        // Add a new file (untracked)
        let file_path = dir.path().join("new_file.txt");
        fs::write(&file_path, "new content").unwrap();

        let result = super::git_file_status(dir.path().to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "new_file.txt");
        assert_eq!(entries[0].status, "new");

        // Now commit it and modify
        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("new_file.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let sig = Signature::now("Test", "test@example.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "add file", &tree, &[])
            .unwrap();

        // Modify the file
        fs::write(&file_path, "modified content").unwrap();

        let result = super::git_file_status(dir.path().to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "new_file.txt");
        assert_eq!(entries[0].status, "modified");
    }

    #[tokio::test]
    async fn test_git_log_returns_commits() {
        let dir = tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let sig = Signature::now("Test", "test@example.com").unwrap();

        // Make 3 commits
        for i in 1..=3 {
            let file_path = dir.path().join(format!("file{}.txt", i));
            fs::write(&file_path, format!("content {}", i)).unwrap();

            let mut index = repo.index().unwrap();
            index
                .add_path(std::path::Path::new(&format!("file{}.txt", i)))
                .unwrap();
            index.write().unwrap();
            let tree_oid = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_oid).unwrap();

            let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
            let parents: Vec<&git2::Commit> = parent.iter().collect();

            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                &format!("commit {}", i),
                &tree,
                &parents,
            )
            .unwrap();
        }

        let result = super::git_log(
            dir.path().to_str().unwrap().to_string(),
            None,
            None,
        )
        .await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 3);
        // Most recent first
        assert_eq!(entries[0].message, "commit 3");
        assert_eq!(entries[1].message, "commit 2");
        assert_eq!(entries[2].message, "commit 1");
        assert_eq!(entries[0].author, "Test");
    }

    #[tokio::test]
    async fn test_git_diff_detects_additions() {
        let dir = tempdir().unwrap();
        Repository::init(dir.path()).unwrap();

        // Add a new file (don't commit)
        let file_path = dir.path().join("added.txt");
        fs::write(&file_path, "new file content").unwrap();

        let result = super::git_diff(
            dir.path().to_str().unwrap().to_string(),
            None,
        )
        .await;

        assert!(result.is_ok());
        let diff = result.unwrap();
        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "added.txt");
        // In an empty repo with no commits, untracked files show as "untracked"
        assert_eq!(diff.files[0].status, "untracked");
    }
}
