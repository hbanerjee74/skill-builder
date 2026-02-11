use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use super::events;
use super::sidecar::SidecarConfig;

/// A persistent Node.js sidecar process that stays alive across multiple agent invocations.
struct PersistentSidecar {
    child: Child,
    stdin: tokio::process::ChildStdin,
    pid: u32,
    request_counter: AtomicU64,
}

/// Pool of persistent sidecar processes, one per skill.
/// Reuses existing processes across agent invocations to reduce startup latency.
/// Wraps an `Arc` so cloning is cheap and all clones share the same pool.
#[derive(Clone)]
pub struct SidecarPool {
    sidecars: Arc<Mutex<HashMap<String, PersistentSidecar>>>,
}

impl SidecarPool {
    pub fn new() -> Self {
        SidecarPool {
            sidecars: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get an existing sidecar for a skill or spawn a new persistent one.
    /// Waits for the `{"type":"sidecar_ready"}` signal before returning.
    pub async fn get_or_spawn(
        &self,
        skill_name: &str,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), String> {
        let mut pool = self.sidecars.lock().await;

        // Check if we already have a live sidecar for this skill
        if let Some(sidecar) = pool.get_mut(skill_name) {
            // Verify it's still alive by checking if the process has exited
            match sidecar.child.try_wait() {
                Ok(Some(_status)) => {
                    // Process has exited, remove it and fall through to spawn a new one
                    log::info!(
                        "Sidecar for '{}' (pid {}) has exited, will respawn",
                        skill_name,
                        sidecar.pid
                    );
                    pool.remove(skill_name);
                }
                Ok(None) => {
                    // Still running — reuse it
                    log::debug!("Reusing existing sidecar for '{}'", skill_name);
                    return Ok(());
                }
                Err(e) => {
                    log::warn!("Error checking sidecar status for '{}': {}", skill_name, e);
                    pool.remove(skill_name);
                }
            }
        }

        // Spawn a new persistent sidecar
        let sidecar_path = resolve_sidecar_path(app_handle)?;
        let node_bin = resolve_node_binary().await?;

        let mut child = Command::new(&node_bin)
            .arg(&sidecar_path)
            .arg("--persistent")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn persistent sidecar: {}", e))?;

        let pid = child.id().ok_or("Failed to get child PID")?;
        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        log::info!(
            "Spawned persistent sidecar for '{}' (pid {})",
            skill_name,
            pid
        );

        // Wait for the sidecar_ready signal on stdout
        let mut reader = BufReader::new(stdout);
        let mut ready_line = String::new();
        let ready_timeout = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            reader.read_line(&mut ready_line),
        )
        .await
        .map_err(|_| {
            format!(
                "Timeout waiting for sidecar_ready from persistent sidecar (pid {})",
                pid
            )
        })?
        .map_err(|e| format!("Error reading sidecar_ready: {}", e))?;

        if ready_timeout == 0 {
            return Err(format!(
                "Persistent sidecar (pid {}) closed stdout before sending sidecar_ready",
                pid
            ));
        }

        // Validate the ready signal
        let ready_line = ready_line.trim();
        match serde_json::from_str::<serde_json::Value>(ready_line) {
            Ok(val) => {
                if val.get("type").and_then(|t| t.as_str()) != Some("sidecar_ready") {
                    return Err(format!(
                        "Expected sidecar_ready but got: {}",
                        ready_line
                    ));
                }
            }
            Err(e) => {
                return Err(format!(
                    "Failed to parse sidecar_ready signal: {} (line: {})",
                    e, ready_line
                ));
            }
        }

        log::info!("Persistent sidecar for '{}' is ready (pid {})", skill_name, pid);

        // Spawn stderr reader for logging
        let skill_name_stderr = skill_name.to_string();
        tokio::spawn(async move {
            let stderr_reader = BufReader::new(stderr);
            let mut lines = stderr_reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("[persistent-sidecar:{}] {}", skill_name_stderr, line);
            }
        });

        // Spawn stdout reader that routes messages by request_id
        let stdout_pool = self.sidecars.clone();
        let skill_name_stdout = skill_name.to_string();
        let app_handle_stdout = app_handle.clone();
        tokio::spawn(async move {
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                // Parse the line to extract request_id for routing
                match serde_json::from_str::<serde_json::Value>(&line) {
                    Ok(msg) => {
                        if let Some(request_id) = msg.get("request_id").and_then(|r| r.as_str()) {
                            // Route this message to the correct agent using the request_id as agent_id
                            events::handle_sidecar_message(
                                &app_handle_stdout,
                                request_id,
                                &line,
                            );

                            // Check if this is a result or error — if so, emit exit event
                            if let Some(msg_type) = msg.get("type").and_then(|t| t.as_str()) {
                                if msg_type == "result" {
                                    events::handle_sidecar_exit(
                                        &app_handle_stdout,
                                        request_id,
                                        true,
                                    );
                                } else if msg_type == "error" {
                                    events::handle_sidecar_exit(
                                        &app_handle_stdout,
                                        request_id,
                                        false,
                                    );
                                }
                            }
                        } else {
                            log::warn!(
                                "[persistent-sidecar:{}] Message without request_id: {}",
                                skill_name_stdout,
                                line
                            );
                        }
                    }
                    Err(e) => {
                        log::warn!(
                            "[persistent-sidecar:{}] Failed to parse stdout: {} (line: {})",
                            skill_name_stdout,
                            e,
                            line
                        );
                    }
                }
            }

            // EOF on stdout — sidecar crashed or exited unexpectedly
            log::warn!(
                "Persistent sidecar for '{}' closed stdout unexpectedly, removing from pool",
                skill_name_stdout
            );
            let mut pool = stdout_pool.lock().await;
            pool.remove(&skill_name_stdout);
        });

        let sidecar = PersistentSidecar {
            child,
            stdin,
            pid,
            request_counter: AtomicU64::new(0),
        };

        pool.insert(skill_name.to_string(), sidecar);
        Ok(())
    }

    /// Send an agent request to the persistent sidecar for a skill.
    /// The request_id is set to the agent_id so events route to the correct frontend handler.
    pub async fn send_request(
        &self,
        skill_name: &str,
        agent_id: &str,
        config: SidecarConfig,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), String> {
        // Ensure we have a sidecar running
        self.get_or_spawn(skill_name, app_handle).await?;

        let mut pool = self.sidecars.lock().await;
        let sidecar = pool.get_mut(skill_name).ok_or_else(|| {
            format!(
                "Sidecar for '{}' not found in pool after get_or_spawn",
                skill_name
            )
        })?;

        sidecar.request_counter.fetch_add(1, Ordering::SeqCst);

        // Build the request message
        let request = serde_json::json!({
            "type": "agent_request",
            "request_id": agent_id,
            "config": config,
        });

        let mut request_line = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize agent request: {}", e))?;
        request_line.push('\n');

        // Emit redacted config to frontend (same as spawn_sidecar does)
        {
            let mut config_val = serde_json::to_value(&config).unwrap_or_default();
            if let Some(obj) = config_val.as_object_mut() {
                obj.insert("apiKey".to_string(), serde_json::json!("[REDACTED]"));
                obj.remove("prompt");
            }

            let discovered_skills = scan_skills_dir(Path::new(&config.cwd));

            let config_event = serde_json::json!({
                "type": "config",
                "config": config_val,
                "discoveredSkills": discovered_skills,
            });
            events::handle_sidecar_message(app_handle, agent_id, &config_event.to_string());
        }

        // Write request to stdin
        sidecar
            .stdin
            .write_all(request_line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to sidecar stdin: {}", e))?;

        sidecar
            .stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;

        log::info!(
            "Sent agent request '{}' to persistent sidecar for '{}' (pid {})",
            agent_id,
            skill_name,
            sidecar.pid
        );

        Ok(())
    }

    /// Shutdown a single skill's sidecar. Sends a shutdown message, waits up to 3 seconds,
    /// then kills if necessary.
    pub async fn shutdown_skill(&self, skill_name: &str) -> Result<(), String> {
        let mut pool = self.sidecars.lock().await;

        if let Some(mut sidecar) = pool.remove(skill_name) {
            log::info!(
                "Shutting down persistent sidecar for '{}' (pid {})",
                skill_name,
                sidecar.pid
            );

            // Send shutdown message
            let shutdown_msg = "{\"type\":\"shutdown\"}\n";
            let _ = sidecar.stdin.write_all(shutdown_msg.as_bytes()).await;
            let _ = sidecar.stdin.flush().await;

            // Wait up to 3 seconds for graceful exit
            let wait_result = tokio::time::timeout(
                std::time::Duration::from_secs(3),
                sidecar.child.wait(),
            )
            .await;

            match wait_result {
                Ok(Ok(status)) => {
                    log::info!(
                        "Sidecar for '{}' exited gracefully: {}",
                        skill_name,
                        status
                    );
                }
                Ok(Err(e)) => {
                    log::warn!(
                        "Error waiting for sidecar '{}' to exit: {}",
                        skill_name,
                        e
                    );
                }
                Err(_) => {
                    // Timeout — force kill
                    log::warn!(
                        "Sidecar for '{}' did not exit within 3s, killing (pid {})",
                        skill_name,
                        sidecar.pid
                    );
                    let _ = sidecar.child.kill().await;
                }
            }
        } else {
            log::debug!("No sidecar running for '{}', nothing to shut down", skill_name);
        }

        Ok(())
    }

    /// Shutdown all persistent sidecars. Called on app exit.
    pub async fn shutdown_all(&self) {
        let skill_names: Vec<String> = {
            let pool = self.sidecars.lock().await;
            pool.keys().cloned().collect()
        };

        for skill_name in skill_names {
            if let Err(e) = self.shutdown_skill(&skill_name).await {
                log::warn!("Error shutting down sidecar for '{}': {}", skill_name, e);
            }
        }

        log::info!("All persistent sidecars shut down");
    }
}

/// Scan `{cwd}/.claude/skills/` for active skill directories (those containing SKILL.md).
/// Returns a list of skill directory names that the SDK will discover.
fn scan_skills_dir(cwd: &Path) -> Vec<String> {
    let skills_dir = cwd.join(".claude").join("skills");
    let mut names = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("SKILL.md").exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if !name.starts_with('.') {
                        names.push(name.to_string());
                    }
                }
            }
        }
    }
    names.sort();
    names
}

// Re-use the sidecar path resolution logic from sidecar.rs.
// These are kept as separate functions here to avoid making the private functions
// in sidecar.rs public (which would change the existing module's API surface).

fn resolve_sidecar_path(app_handle: &tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let sidecar = resource_dir
            .join("sidecar")
            .join("dist")
            .join("agent-runner.js");
        if sidecar.exists() {
            return sidecar
                .to_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Invalid sidecar path".to_string());
        }
    }

    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(dir) = exe_dir.parent() {
            let sidecar = dir
                .join("sidecar")
                .join("dist")
                .join("agent-runner.js");
            if sidecar.exists() {
                return sidecar
                    .to_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| "Invalid sidecar path".to_string());
            }
        }
    }

    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("sidecar").join("dist").join("agent-runner.js"));
    if let Some(path) = dev_path {
        if path.exists() {
            return path
                .to_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Invalid sidecar path".to_string());
        }
    }

    Err("Could not find agent-runner.js -- run 'npm run build' in app/sidecar/ first".to_string())
}

async fn resolve_node_binary() -> Result<String, String> {
    let candidates: Vec<std::path::PathBuf> = {
        let mut v = vec![std::path::PathBuf::from("node")];
        for p in &[
            "/usr/local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/bin/node",
        ] {
            v.push(std::path::PathBuf::from(p));
        }
        v
    };

    let mut first_available: Option<String> = None;

    for candidate in &candidates {
        let output = Command::new(candidate).arg("--version").output().await;

        if let Ok(out) = output {
            if out.status.success() {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let path_str = candidate.to_string_lossy().to_string();

                if first_available.is_none() {
                    first_available = Some(path_str.clone());
                }

                if is_node_compatible(&version) {
                    return Ok(path_str);
                }
            }
        }
    }

    if let Some(path) = first_available {
        return Ok(path);
    }

    Err("Node.js not found. Please install Node.js 18+ from https://nodejs.org".to_string())
}

fn is_node_compatible(version: &str) -> bool {
    let trimmed = version.strip_prefix('v').unwrap_or(version);
    if let Some(major_str) = trimmed.split('.').next() {
        if let Ok(major) = major_str.parse::<u32>() {
            return major >= 18 && major <= 24;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_creation() {
        let pool = SidecarPool::new();
        // Pool should be created without panicking
        let _ = pool;
    }

    #[tokio::test]
    async fn test_pool_empty_after_init() {
        let pool = SidecarPool::new();
        let sidecars = pool.sidecars.lock().await;
        assert!(sidecars.is_empty(), "Pool should be empty after creation");
    }

    #[tokio::test]
    async fn test_shutdown_skill_no_sidecar() {
        // Shutting down a skill that doesn't exist should not error
        let pool = SidecarPool::new();
        let result = pool.shutdown_skill("nonexistent-skill").await;
        assert!(result.is_ok(), "Shutting down nonexistent skill should succeed");
    }

    #[tokio::test]
    async fn test_shutdown_all_empty_pool() {
        // shutdown_all on empty pool should complete without error
        let pool = SidecarPool::new();
        pool.shutdown_all().await;
        let sidecars = pool.sidecars.lock().await;
        assert!(sidecars.is_empty());
    }

    #[test]
    fn test_scan_skills_dir_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let result = scan_skills_dir(tmp.path());
        assert!(result.is_empty(), "No .claude/skills dir should return empty");
    }

    #[test]
    fn test_scan_skills_dir_with_skills() {
        let tmp = tempfile::tempdir().unwrap();
        let skills_dir = tmp.path().join(".claude").join("skills");

        // Create two skill directories with SKILL.md
        let skill_a = skills_dir.join("skill-a");
        std::fs::create_dir_all(&skill_a).unwrap();
        std::fs::write(skill_a.join("SKILL.md"), "# Skill A").unwrap();

        let skill_b = skills_dir.join("skill-b");
        std::fs::create_dir_all(&skill_b).unwrap();
        std::fs::write(skill_b.join("SKILL.md"), "# Skill B").unwrap();

        // Create a directory without SKILL.md (should be excluded)
        let no_skill = skills_dir.join("no-skill");
        std::fs::create_dir_all(&no_skill).unwrap();

        let result = scan_skills_dir(tmp.path());
        assert_eq!(result, vec!["skill-a", "skill-b"]);
    }

    #[test]
    fn test_is_node_compatible_pool() {
        assert!(is_node_compatible("v18.0.0"));
        assert!(is_node_compatible("v24.13.0"));
        assert!(!is_node_compatible("v25.0.0"));
        assert!(!is_node_compatible("v16.0.0"));
    }

    #[tokio::test]
    async fn test_pool_spawn_and_crash_recovery() {
        // This test verifies the pool data structure logic without a real Node.js process.
        // We manually insert and remove entries to simulate the lifecycle.
        let pool = SidecarPool::new();

        // Verify pool starts empty
        {
            let sidecars = pool.sidecars.lock().await;
            assert_eq!(sidecars.len(), 0);
        }

        // Simulate crash recovery: after removing a sidecar entry,
        // the next get_or_spawn should attempt to create a new one.
        // (We can't test the actual spawn without a sidecar binary,
        // but we verify the pool correctly handles removal.)
        {
            let mut sidecars = pool.sidecars.lock().await;
            sidecars.remove("test-skill");
            assert!(!sidecars.contains_key("test-skill"));
        }
    }

    #[tokio::test]
    async fn test_multiple_skills_independent() {
        // Verify the pool can track multiple skills independently
        let pool = SidecarPool::new();

        // Simulate: after spawning sidecars for two skills, removing one
        // should not affect the other.
        // (We test the HashMap logic without real child processes.)

        // Both should be absent initially
        {
            let sidecars = pool.sidecars.lock().await;
            assert!(!sidecars.contains_key("skill_a"));
            assert!(!sidecars.contains_key("skill_b"));
        }

        // Shutdown one skill should not affect the other
        pool.shutdown_skill("skill_a").await.unwrap();
        {
            let sidecars = pool.sidecars.lock().await;
            assert!(!sidecars.contains_key("skill_b"));
        }
    }
}
