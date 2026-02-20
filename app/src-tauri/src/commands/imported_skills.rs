use crate::db::Db;
use crate::types::ImportedSkill;
use std::fs;
use std::io::Read;
use std::path::Path;

/// Validate that a skill name is safe for use in file paths.
/// Rejects names containing path traversal characters or empty strings.
pub(crate) fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Skill name cannot be empty".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!(
            "Invalid skill name '{}': must not contain '/', '\\', or '..'",
            name
        ));
    }
    Ok(())
}

/// Parsed YAML frontmatter fields from a SKILL.md file.
pub(crate) struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub domain: Option<String>,
    pub skill_type: Option<String>,
    pub trigger: Option<String>,
}

/// Parse YAML frontmatter from SKILL.md content.
/// Extracts `name`, `description`, `domain`, `skill_type`, and `trigger` fields from YAML between `---` markers.
/// Multi-line YAML values (using `>` folded scalar) are joined into a single line.
pub(crate) fn parse_frontmatter(
    content: &str,
) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
    let fm = parse_frontmatter_full(content);
    (fm.name, fm.description, fm.domain, fm.skill_type)
}

/// Parse YAML frontmatter returning all fields including `trigger`.
pub(crate) fn parse_frontmatter_full(content: &str) -> Frontmatter {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return Frontmatter {
            name: None,
            description: None,
            domain: None,
            skill_type: None,
            trigger: None,
        };
    }

    // Find the closing ---
    let after_first = &trimmed[3..];
    let end = match after_first.find("\n---") {
        Some(pos) => pos,
        None => {
            return Frontmatter {
                name: None,
                description: None,
                domain: None,
                skill_type: None,
                trigger: None,
            }
        }
    };

    let yaml_block = &after_first[..end];

    let mut name = None;
    let mut description = None;
    let mut domain = None;
    let mut skill_type = None;
    let mut trigger = None;

    // Track which multi-line field we're accumulating (for `>` folded scalars)
    let mut current_multiline: Option<&str> = None;
    let mut multiline_buf = String::new();

    for line in yaml_block.lines() {
        let trimmed_line = line.trim();

        // Check if this is a continuation line (indented, part of a multi-line value)
        if current_multiline.is_some() && (line.starts_with(' ') || line.starts_with('\t')) && !trimmed_line.is_empty() {
            if !multiline_buf.is_empty() {
                multiline_buf.push(' ');
            }
            multiline_buf.push_str(trimmed_line);
            continue;
        }

        // Flush any accumulated multi-line value
        if let Some(field) = current_multiline.take() {
            let val = multiline_buf.trim().to_string();
            if !val.is_empty() {
                match field {
                    "description" => description = Some(val),
                    "trigger" => trigger = Some(val),
                    _ => {}
                }
            }
            multiline_buf.clear();
        }

        // Parse new field
        if let Some(val) = trimmed_line.strip_prefix("name:") {
            name = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
        } else if let Some(val) = trimmed_line.strip_prefix("description:") {
            let val = val.trim();
            if val == ">" || val == "|" {
                current_multiline = Some("description");
            } else {
                description = Some(val.trim_matches('"').trim_matches('\'').to_string());
            }
        } else if let Some(val) = trimmed_line.strip_prefix("domain:") {
            domain = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
        } else if let Some(val) = trimmed_line.strip_prefix("type:") {
            skill_type = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
        } else if let Some(val) = trimmed_line.strip_prefix("trigger:") {
            let val = val.trim();
            if val == ">" || val == "|" {
                current_multiline = Some("trigger");
            } else {
                trigger = Some(val.trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }

    // Flush any trailing multi-line value
    if let Some(field) = current_multiline {
        let val = multiline_buf.trim().to_string();
        if !val.is_empty() {
            match field {
                "description" => description = Some(val),
                "trigger" => trigger = Some(val),
                _ => {}
            }
        }
    }

    Frontmatter {
        name,
        description,
        domain,
        skill_type,
        trigger,
    }
}

/// Derive a skill name from a zip filename by removing the extension
/// and replacing non-alphanumeric characters with hyphens.
fn derive_name_from_filename(file_path: &str) -> String {
    let path = Path::new(file_path);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imported-skill");

    // Clean up: replace spaces and underscores with hyphens, lowercase
    stem.to_lowercase()
        .replace(['_', ' '], "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect()
}

/// Find SKILL.md in the zip archive, either at the root or one level deep.
/// Returns the path within the archive and the content.
fn find_skill_md(archive: &mut zip::ZipArchive<std::fs::File>) -> Result<(String, String), String> {
    // First pass: collect all file names to find SKILL.md index
    let mut target_index: Option<(usize, String)> = None;

    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        drop(file);

        // Check root level first
        if name == "SKILL.md" || name == "./SKILL.md" {
            target_index = Some((i, name));
            break;
        }
    }

    // If not found at root, check one level deep
    if target_index.is_none() {
        for i in 0..archive.len() {
            let file = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = file.name().to_string();
            drop(file);

            let parts: Vec<&str> = name.split('/').filter(|p| !p.is_empty()).collect();
            if parts.len() == 2 && parts[1] == "SKILL.md" {
                target_index = Some((i, name));
                break;
            }
        }
    }

    match target_index {
        Some((idx, name)) => {
            let mut content = String::new();
            let mut file = archive.by_index(idx).map_err(|e| e.to_string())?;
            file.read_to_string(&mut content).map_err(|e| e.to_string())?;
            Ok((name, content))
        }
        None => Err("Invalid skill package: SKILL.md not found at root or one level deep".to_string()),
    }
}

/// Determine the prefix to strip when extracting files.
/// If SKILL.md is at "dirname/SKILL.md", the prefix is "dirname/".
/// If at root, the prefix is empty.
fn get_archive_prefix(skill_md_path: &str) -> String {
    let parts: Vec<&str> = skill_md_path.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() == 2 {
        format!("{}/", parts[0])
    } else {
        String::new()
    }
}

#[tauri::command]
pub fn upload_skill(
    file_path: String,
    db: tauri::State<'_, Db>,
) -> Result<ImportedSkill, String> {
    log::info!("[upload_skill] file_path={}", file_path);
    let conn = db.0.lock().map_err(|e| {
        log::error!("[upload_skill] Failed to acquire DB lock: {}", e);
        e.to_string()
    })?;
    let settings = crate::db::read_settings(&conn)?;
    let workspace_path = settings
        .workspace_path
        .ok_or_else(|| "Workspace path not initialized".to_string())?;

    let result = upload_skill_inner(&file_path, &workspace_path, &conn)?;

    // Regenerate CLAUDE.md with updated imported skills
    if let Err(e) = super::workflow::update_skills_section(&workspace_path, &conn) {
        log::warn!("Failed to update CLAUDE.md after skill upload: {}", e);
    }

    Ok(result)
}

fn upload_skill_inner(
    file_path: &str,
    workspace_path: &str,
    conn: &rusqlite::Connection,
) -> Result<ImportedSkill, String> {
    // Open and validate zip
    let zip_file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file '{}': {}", file_path, e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Invalid zip file '{}': {}", file_path, e))?;

    // Find and read SKILL.md
    let (skill_md_path, skill_md_content) = find_skill_md(&mut archive)?;
    let prefix = get_archive_prefix(&skill_md_path);

    // Parse frontmatter for metadata
    let fm = parse_frontmatter_full(&skill_md_content);

    // Determine skill name: frontmatter name > filename
    let skill_name = fm.name
        .unwrap_or_else(|| derive_name_from_filename(file_path));

    if skill_name.is_empty() {
        return Err("Could not determine skill name from file".to_string());
    }

    // Set up destination directory
    let skills_dir = Path::new(workspace_path).join(".claude").join("skills");
    let dest_dir = skills_dir.join(&skill_name);

    if dest_dir.exists() {
        return Err(format!(
            "Skill '{}' already exists at '{}'",
            skill_name,
            dest_dir.display()
        ));
    }

    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;

    // Extract files
    extract_archive(&mut archive, &prefix, &dest_dir)?;

    // Generate skill ID and timestamp
    let skill_id = generate_skill_id(&skill_name);
    let imported_at = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let skill = ImportedSkill {
        skill_id,
        skill_name: skill_name.clone(),
        domain: fm.domain,
        description: fm.description,
        is_active: true,
        disk_path: dest_dir.to_string_lossy().to_string(),
        trigger_text: fm.trigger,
        imported_at,
        is_bundled: false,
    };

    // Insert into DB
    crate::db::insert_imported_skill(conn, &skill)?;

    Ok(skill)
}

/// Helper to generate a simple unique ID from inputs
pub(crate) fn generate_skill_id(skill_name: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("imp-{}-{}", skill_name, timestamp)
}

/// Extract archive contents to destination, stripping the prefix.
fn extract_archive(
    archive: &mut zip::ZipArchive<std::fs::File>,
    prefix: &str,
    dest_dir: &Path,
) -> Result<(), String> {
    // Ensure dest_dir exists and canonicalize it for reliable containment checks
    fs::create_dir_all(dest_dir)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    let canonical_dest = dest_dir.canonicalize()
        .map_err(|e| format!("Failed to canonicalize destination: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        // Skip symlink entries — skill packages should never contain symlinks
        if file.is_symlink() {
            continue;
        }

        let raw_name = file.name().to_string();

        // Strip prefix
        let relative = if !prefix.is_empty() {
            match raw_name.strip_prefix(prefix) {
                Some(rel) => rel.to_string(),
                None => continue, // Skip files outside the prefix
            }
        } else {
            raw_name.clone()
        };

        if relative.is_empty() {
            continue;
        }

        let out_path = dest_dir.join(&relative);

        // Prevent directory traversal (lexical check first)
        if !out_path.starts_with(dest_dir) {
            continue;
        }

        if file.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
            // Verify canonicalized path is still inside dest_dir (catches symlink tricks)
            let canonical_out = out_path.canonicalize()
                .map_err(|e| format!("Failed to canonicalize directory: {}", e))?;
            if !canonical_out.starts_with(&canonical_dest) {
                return Err(format!(
                    "Path traversal detected: '{}' escapes destination",
                    relative
                ));
            }
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                // Verify parent is still inside dest_dir after canonicalization
                let canonical_parent = parent.canonicalize()
                    .map_err(|e| format!("Failed to canonicalize parent: {}", e))?;
                if !canonical_parent.starts_with(&canonical_dest) {
                    return Err(format!(
                        "Path traversal detected: '{}' escapes destination",
                        relative
                    ));
                }
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file '{}': {}", out_path.display(), e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to write file '{}': {}", out_path.display(), e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_imported_skills(
    db: tauri::State<'_, Db>,
) -> Result<Vec<ImportedSkill>, String> {
    log::info!("[list_imported_skills]");
    let conn = db.0.lock().map_err(|e| {
        log::error!("[list_imported_skills] Failed to acquire DB lock: {}", e);
        e.to_string()
    })?;
    crate::db::list_imported_skills(&conn)
}

#[tauri::command]
pub fn toggle_skill_active(
    skill_name: String,
    active: bool,
    db: tauri::State<'_, Db>,
) -> Result<(), String> {
    log::info!("[toggle_skill_active] skill_name={} active={}", skill_name, active);
    let conn = db.0.lock().map_err(|e| {
        log::error!("[toggle_skill_active] Failed to acquire DB lock: {}", e);
        e.to_string()
    })?;
    let settings = crate::db::read_settings(&conn)?;
    let workspace_path = settings
        .workspace_path
        .ok_or_else(|| "Workspace path not initialized".to_string())?;

    toggle_skill_active_inner(&skill_name, active, &workspace_path, &conn)?;

    // Regenerate CLAUDE.md with updated active skills
    if let Err(e) = super::workflow::update_skills_section(&workspace_path, &conn) {
        log::warn!("Failed to update CLAUDE.md after toggling skill: {}", e);
    }

    Ok(())
}

fn toggle_skill_active_inner(
    skill_name: &str,
    active: bool,
    workspace_path: &str,
    conn: &rusqlite::Connection,
) -> Result<(), String> {
    validate_skill_name(skill_name)?;

    let skills_dir = Path::new(workspace_path).join(".claude").join("skills");
    let active_path = skills_dir.join(skill_name);
    let inactive_dir = skills_dir.join(".inactive");
    let inactive_path = inactive_dir.join(skill_name);

    let (src, dst) = if active {
        (&inactive_path, &active_path)
    } else {
        (&active_path, &inactive_path)
    };

    let new_disk_path = dst.to_string_lossy().to_string();
    let old_disk_path = src.to_string_lossy().to_string();

    // Step 1: Update DB first (clean failure — no side effects if this fails)
    crate::db::update_imported_skill_active(conn, skill_name, active, &new_disk_path)?;

    // Step 2: Move files on disk. If this fails, revert the DB update.
    if src.exists() {
        // Ensure destination parent directory exists
        if active {
            fs::create_dir_all(&skills_dir)
                .map_err(|e| format!("Failed to create skills directory: {}", e))?;
        } else {
            fs::create_dir_all(&inactive_dir)
                .map_err(|e| format!("Failed to create .inactive directory: {}", e))?;
        }

        if let Err(move_err) = fs::rename(src, dst) {
            // Revert the DB update
            let _ = crate::db::update_imported_skill_active(
                conn, skill_name, !active, &old_disk_path,
            );
            return Err(format!(
                "Failed to {} skill '{}': {}",
                if active { "activate" } else { "deactivate" },
                skill_name,
                move_err
            ));
        }
    }

    Ok(())
}

#[tauri::command]
pub fn delete_imported_skill(
    skill_name: String,
    db: tauri::State<'_, Db>,
) -> Result<(), String> {
    log::info!("[delete_imported_skill] skill_name={}", skill_name);
    let conn = db.0.lock().map_err(|e| {
        log::error!("[delete_imported_skill] Failed to acquire DB lock: {}", e);
        e.to_string()
    })?;
    let settings = crate::db::read_settings(&conn)?;
    let workspace_path = settings
        .workspace_path
        .ok_or_else(|| "Workspace path not initialized".to_string())?;

    delete_imported_skill_inner(&skill_name, &workspace_path, &conn)?;

    // Regenerate CLAUDE.md without the deleted skill
    if let Err(e) = super::workflow::update_skills_section(&workspace_path, &conn) {
        log::warn!("Failed to update CLAUDE.md after deleting skill: {}", e);
    }

    Ok(())
}

fn delete_imported_skill_inner(
    skill_name: &str,
    workspace_path: &str,
    conn: &rusqlite::Connection,
) -> Result<(), String> {
    validate_skill_name(skill_name)?;

    // Guard: prevent deletion of bundled skills
    if let Some(existing) = crate::db::get_imported_skill(conn, skill_name)? {
        if existing.is_bundled {
            return Err(format!(
                "Cannot delete bundled skill '{}'. Deactivate it instead.",
                skill_name
            ));
        }
    }

    let skills_dir = Path::new(workspace_path).join(".claude").join("skills");
    let active_path = skills_dir.join(skill_name);
    let inactive_path = skills_dir.join(".inactive").join(skill_name);

    // Remove from disk (check both locations)
    if active_path.exists() {
        fs::remove_dir_all(&active_path)
            .map_err(|e| format!("Failed to delete skill directory: {}", e))?;
    }
    if inactive_path.exists() {
        fs::remove_dir_all(&inactive_path)
            .map_err(|e| format!("Failed to delete inactive skill directory: {}", e))?;
    }

    // Remove from DB
    crate::db::delete_imported_skill(conn, skill_name)?;

    Ok(())
}

#[tauri::command]
pub fn get_skill_content(
    skill_name: String,
    db: tauri::State<'_, Db>,
) -> Result<String, String> {
    log::info!("[get_skill_content] skill_name={}", skill_name);
    let conn = db.0.lock().map_err(|e| {
        log::error!("[get_skill_content] Failed to acquire DB lock: {}", e);
        e.to_string()
    })?;
    let skill = crate::db::get_imported_skill(&conn, &skill_name)?
        .ok_or_else(|| format!("Imported skill '{}' not found", skill_name))?;

    get_skill_content_inner(&skill)
}

fn get_skill_content_inner(skill: &ImportedSkill) -> Result<String, String> {
    let skill_md_path = Path::new(&skill.disk_path).join("SKILL.md");
    fs::read_to_string(&skill_md_path)
        .map_err(|e| format!("Failed to read SKILL.md: {}", e))
}

/// Seed bundled skills from the app's bundled-skills directory into the workspace.
/// For each subdirectory containing SKILL.md:
/// 1. Copies the directory to `{workspace}/.claude/skills/{name}/` (always overwrite)
/// 2. Upserts into DB with `is_bundled: true` (preserves `is_active` if already exists)
pub(crate) fn seed_bundled_skills(
    workspace_path: &str,
    conn: &rusqlite::Connection,
    bundled_skills_dir: &std::path::Path,
) -> Result<(), String> {
    log::info!(
        "seed_bundled_skills: scanning {}",
        bundled_skills_dir.display()
    );

    if !bundled_skills_dir.is_dir() {
        log::debug!(
            "seed_bundled_skills: bundled skills dir not found at {}",
            bundled_skills_dir.display()
        );
        return Ok(());
    }

    let entries = fs::read_dir(bundled_skills_dir)
        .map_err(|e| format!("Failed to read bundled skills dir: {}", e))?;

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }

        let skill_md_path = entry_path.join("SKILL.md");
        if !skill_md_path.is_file() {
            continue;
        }

        let dir_name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        log::debug!("seed_bundled_skills: processing {}", dir_name);

        // Read and parse SKILL.md frontmatter
        let content = fs::read_to_string(&skill_md_path)
            .map_err(|e| format!("Failed to read {}: {}", skill_md_path.display(), e))?;
        let fm = parse_frontmatter_full(&content);

        let skill_name = fm.name.unwrap_or_else(|| dir_name.clone());

        // Check if the skill already exists to preserve is_active
        let existing = crate::db::get_imported_skill(conn, &skill_name)?;
        let is_active = existing.as_ref().map_or(true, |s| s.is_active);

        // Copy directory to the correct workspace location based on toggle state:
        //   active  → {workspace}/.claude/skills/{name}/
        //   inactive → {workspace}/.claude/skills/.inactive/{name}/
        let skills_base = Path::new(workspace_path).join(".claude").join("skills");
        let dest_dir = if is_active {
            skills_base.join(&skill_name)
        } else {
            skills_base.join(".inactive").join(&skill_name)
        };

        // Clean up both possible locations to avoid stale copies
        let active_path = skills_base.join(&skill_name);
        let inactive_path = skills_base.join(".inactive").join(&skill_name);
        if active_path.exists() {
            fs::remove_dir_all(&active_path)
                .map_err(|e| format!("Failed to remove existing bundled skill dir: {}", e))?;
        }
        if inactive_path.exists() {
            fs::remove_dir_all(&inactive_path)
                .map_err(|e| format!("Failed to remove existing inactive bundled skill dir: {}", e))?;
        }

        fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Failed to create bundled skill dir: {}", e))?;

        copy_dir_recursive(&entry_path, &dest_dir)
            .map_err(|e| format!("Failed to copy bundled skill '{}': {}", skill_name, e))?;

        let skill = crate::types::ImportedSkill {
            skill_id: format!("bundled-{}", skill_name),
            skill_name: skill_name.clone(),
            domain: fm.domain,
            description: fm.description,
            is_active,
            disk_path: dest_dir.to_string_lossy().to_string(),
            trigger_text: fm.trigger.or_else(|| Some(format!(
                "Read and follow the skill at `.claude/skills/{}/SKILL.md`.",
                skill_name
            ))),
            imported_at: "2000-01-01T00:00:00Z".to_string(),
            is_bundled: true,
        };

        crate::db::upsert_bundled_skill(conn, &skill)?;
        log::info!(
            "seed_bundled_skills: seeded '{}' (is_active={})",
            skill_name,
            is_active
        );
    }

    Ok(())
}

/// Recursively copy a directory's contents from src to dst.
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            fs::create_dir_all(&dst_path).map_err(|e| e.to_string())?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::test_utils::create_test_db;
    use std::io::Write;
    use tempfile::tempdir;

    fn make_test_skill() -> ImportedSkill {
        ImportedSkill {
            skill_id: "test-id-123".to_string(),
            skill_name: "my-test-skill".to_string(),
            domain: Some("analytics".to_string()),
            description: Some("A test skill".to_string()),
            is_active: true,
            disk_path: "/tmp/test-skill".to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        }
    }

    // --- DB CRUD tests ---

    #[test]
    fn test_insert_and_list_imported_skill() {
        let conn = create_test_db();
        let skill = make_test_skill();
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        let skills = crate::db::list_imported_skills(&conn).unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].skill_name, "my-test-skill");
        assert_eq!(skills[0].domain.as_deref(), Some("analytics"));
        assert!(skills[0].is_active);
    }

    #[test]
    fn test_insert_duplicate_skill_name_errors() {
        let conn = create_test_db();
        let skill = make_test_skill();
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        let mut dup = make_test_skill();
        dup.skill_id = "different-id".to_string();
        let result = crate::db::insert_imported_skill(&conn, &dup);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already been imported"));
    }

    #[test]
    fn test_update_imported_skill_active() {
        let conn = create_test_db();
        let skill = make_test_skill();
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        crate::db::update_imported_skill_active(&conn, "my-test-skill", false, "/tmp/inactive/my-test-skill").unwrap();
        let found = crate::db::get_imported_skill(&conn, "my-test-skill").unwrap().unwrap();
        assert!(!found.is_active);
        assert_eq!(found.disk_path, "/tmp/inactive/my-test-skill");

        crate::db::update_imported_skill_active(&conn, "my-test-skill", true, "/tmp/active/my-test-skill").unwrap();
        let found = crate::db::get_imported_skill(&conn, "my-test-skill").unwrap().unwrap();
        assert!(found.is_active);
        assert_eq!(found.disk_path, "/tmp/active/my-test-skill");
    }

    #[test]
    fn test_update_nonexistent_skill_errors() {
        let conn = create_test_db();
        let result = crate::db::update_imported_skill_active(&conn, "no-such-skill", true, "/tmp/path");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_delete_imported_skill_db() {
        let conn = create_test_db();
        let skill = make_test_skill();
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        crate::db::delete_imported_skill(&conn, "my-test-skill").unwrap();
        let found = crate::db::get_imported_skill(&conn, "my-test-skill").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_get_imported_skill_not_found() {
        let conn = create_test_db();
        let found = crate::db::get_imported_skill(&conn, "nonexistent").unwrap();
        assert!(found.is_none());
    }

    // --- Frontmatter parsing tests ---

    #[test]
    fn test_parse_frontmatter_all_fields() {
        let content = r#"---
name: my-skill
description: A great skill for analytics
domain: e-commerce
---

# My Skill
"#;
        let (name, desc, domain, skill_type) = parse_frontmatter(content);
        assert_eq!(name.as_deref(), Some("my-skill"));
        assert_eq!(desc.as_deref(), Some("A great skill for analytics"));
        assert_eq!(domain.as_deref(), Some("e-commerce"));
        assert!(skill_type.is_none());
    }

    #[test]
    fn test_parse_frontmatter_quoted_values() {
        let content = r#"---
name: "quoted-name"
description: 'single quoted'
---
"#;
        let (name, desc, _, _) = parse_frontmatter(content);
        assert_eq!(name.as_deref(), Some("quoted-name"));
        assert_eq!(desc.as_deref(), Some("single quoted"));
    }

    #[test]
    fn test_parse_frontmatter_no_frontmatter() {
        let content = "# Just a heading\nSome content";
        let (name, desc, domain, skill_type) = parse_frontmatter(content);
        assert!(name.is_none());
        assert!(desc.is_none());
        assert!(domain.is_none());
        assert!(skill_type.is_none());
    }

    #[test]
    fn test_parse_frontmatter_partial() {
        let content = r#"---
name: only-name
---
# Content
"#;
        let (name, desc, domain, skill_type) = parse_frontmatter(content);
        assert_eq!(name.as_deref(), Some("only-name"));
        assert!(desc.is_none());
        assert!(domain.is_none());
        assert!(skill_type.is_none());
    }

    #[test]
    fn test_parse_frontmatter_with_type() {
        let content = r#"---
name: my-platform-skill
description: A platform skill
domain: aws
type: platform
---
# My Skill
"#;
        let (name, desc, domain, skill_type) = parse_frontmatter(content);
        assert_eq!(name.as_deref(), Some("my-platform-skill"));
        assert_eq!(desc.as_deref(), Some("A platform skill"));
        assert_eq!(domain.as_deref(), Some("aws"));
        assert_eq!(skill_type.as_deref(), Some("platform"));
    }

    // --- Filename derivation tests ---

    #[test]
    fn test_derive_name_from_filename() {
        assert_eq!(derive_name_from_filename("/path/to/My Skill.skill"), "my-skill");
        assert_eq!(derive_name_from_filename("analytics_v2.zip"), "analytics-v2");
        assert_eq!(derive_name_from_filename("simple.skill"), "simple");
    }

    // --- Zip validation tests ---

    fn create_test_zip(files: &[(&str, &str)]) -> tempfile::NamedTempFile {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let mut writer = zip::ZipWriter::new(tmp.as_file().try_clone().unwrap());
        let options = zip::write::SimpleFileOptions::default();

        for (name, content) in files {
            writer.start_file(name.to_string(), options).unwrap();
            writer.write_all(content.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
        tmp
    }

    #[test]
    fn test_find_skill_md_at_root() {
        let zip_file = create_test_zip(&[
            ("SKILL.md", "---\nname: test\n---\n# Test"),
            ("references/ref.md", "# Ref"),
        ]);

        let file = fs::File::open(zip_file.path()).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let (path, content) = find_skill_md(&mut archive).unwrap();
        assert_eq!(path, "SKILL.md");
        assert!(content.contains("# Test"));
    }

    #[test]
    fn test_find_skill_md_one_level_deep() {
        let zip_file = create_test_zip(&[
            ("my-skill/SKILL.md", "---\nname: nested\n---\n# Nested"),
            ("my-skill/references/ref.md", "# Ref"),
        ]);

        let file = fs::File::open(zip_file.path()).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let (path, content) = find_skill_md(&mut archive).unwrap();
        assert_eq!(path, "my-skill/SKILL.md");
        assert!(content.contains("# Nested"));
    }

    #[test]
    fn test_find_skill_md_missing() {
        let zip_file = create_test_zip(&[
            ("README.md", "# No skill here"),
        ]);

        let file = fs::File::open(zip_file.path()).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let result = find_skill_md(&mut archive);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SKILL.md not found"));
    }

    #[test]
    fn test_invalid_zip() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::io::Write::write_all(&mut tmp.as_file().try_clone().unwrap(), b"not a zip").unwrap();

        let file = fs::File::open(tmp.path()).unwrap();
        let result = zip::ZipArchive::new(file);
        assert!(result.is_err());
    }

    // --- Upload integration tests ---

    #[test]
    fn test_upload_skill_with_frontmatter() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        let zip_file = create_test_zip(&[
            ("SKILL.md", "---\nname: analytics-skill\ndescription: Analytics domain skill\ndomain: e-commerce\n---\n# Analytics Skill"),
            ("references/concepts.md", "# Concepts"),
        ]);

        let result = upload_skill_inner(
            zip_file.path().to_str().unwrap(),
            workspace_path,
            &conn,
        );
        assert!(result.is_ok(), "upload_skill_inner failed: {:?}", result.err());

        let skill = result.unwrap();
        assert_eq!(skill.skill_name, "analytics-skill");
        assert_eq!(skill.domain.as_deref(), Some("e-commerce"));
        assert_eq!(skill.description.as_deref(), Some("Analytics domain skill"));
        assert!(skill.is_active);

        // Verify files were extracted
        let skill_dir = workspace.path().join(".claude").join("skills").join("analytics-skill");
        assert!(skill_dir.join("SKILL.md").exists());
        assert!(skill_dir.join("references").join("concepts.md").exists());

        // Verify DB record
        let db_skill = crate::db::get_imported_skill(&conn, "analytics-skill").unwrap().unwrap();
        assert_eq!(db_skill.skill_name, "analytics-skill");
    }

    #[test]
    fn test_upload_skill_no_frontmatter_uses_filename() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        let zip_file = create_test_zip(&[
            ("SKILL.md", "# A Skill Without Frontmatter"),
        ]);

        let result = upload_skill_inner(
            zip_file.path().to_str().unwrap(),
            workspace_path,
            &conn,
        );
        assert!(result.is_ok());
        // Name derived from temp file name - just verify it's non-empty
        let skill = result.unwrap();
        assert!(!skill.skill_name.is_empty());
    }

    #[test]
    fn test_upload_skill_nested_zip() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        let zip_file = create_test_zip(&[
            ("nested-skill/SKILL.md", "---\nname: nested-test\n---\n# Nested"),
            ("nested-skill/references/data.md", "# Data"),
        ]);

        let result = upload_skill_inner(
            zip_file.path().to_str().unwrap(),
            workspace_path,
            &conn,
        );
        assert!(result.is_ok());
        let skill = result.unwrap();
        assert_eq!(skill.skill_name, "nested-test");

        // Verify files extracted correctly (prefix stripped)
        let skill_dir = workspace.path().join(".claude").join("skills").join("nested-test");
        assert!(skill_dir.join("SKILL.md").exists());
        assert!(skill_dir.join("references").join("data.md").exists());
    }

    #[test]
    fn test_upload_duplicate_skill_errors() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        let zip_file = create_test_zip(&[
            ("SKILL.md", "---\nname: dup-skill\n---\n# Dup"),
        ]);

        // First upload succeeds
        upload_skill_inner(zip_file.path().to_str().unwrap(), workspace_path, &conn).unwrap();

        // Second upload with same name should fail
        let zip_file2 = create_test_zip(&[
            ("SKILL.md", "---\nname: dup-skill\n---\n# Dup 2"),
        ]);
        let result = upload_skill_inner(zip_file2.path().to_str().unwrap(), workspace_path, &conn);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    // --- Toggle active/inactive tests ---

    #[test]
    fn test_toggle_skill_deactivate() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create skill directory structure
        let skills_dir = workspace.path().join(".claude").join("skills");
        let skill_dir = skills_dir.join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();

        // Insert DB record
        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "my-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: skill_dir.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Deactivate
        toggle_skill_active_inner("my-skill", false, workspace_path, &conn).unwrap();

        // Verify directory moved
        assert!(!skill_dir.exists());
        let inactive_path = skills_dir.join(".inactive").join("my-skill");
        assert!(inactive_path.exists());
        assert!(inactive_path.join("SKILL.md").exists());

        // Verify DB updated
        let db_skill = crate::db::get_imported_skill(&conn, "my-skill").unwrap().unwrap();
        assert!(!db_skill.is_active);
    }

    #[test]
    fn test_toggle_skill_activate() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create inactive skill directory
        let skills_dir = workspace.path().join(".claude").join("skills");
        let inactive_path = skills_dir.join(".inactive").join("my-skill");
        fs::create_dir_all(&inactive_path).unwrap();
        fs::write(inactive_path.join("SKILL.md"), "# Skill").unwrap();

        // Insert DB record as inactive
        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "my-skill".to_string(),
            domain: None,
            description: None,
            is_active: false,
            disk_path: inactive_path.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Activate
        toggle_skill_active_inner("my-skill", true, workspace_path, &conn).unwrap();

        // Verify directory moved back
        assert!(!inactive_path.exists());
        let active_path = skills_dir.join("my-skill");
        assert!(active_path.exists());
        assert!(active_path.join("SKILL.md").exists());

        // Verify DB updated
        let db_skill = crate::db::get_imported_skill(&conn, "my-skill").unwrap().unwrap();
        assert!(db_skill.is_active);
    }

    // --- Delete tests ---

    #[test]
    fn test_delete_imported_skill_active() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create skill directory
        let skills_dir = workspace.path().join(".claude").join("skills");
        let skill_dir = skills_dir.join("del-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Skill").unwrap();

        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "del-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: skill_dir.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        delete_imported_skill_inner("del-skill", workspace_path, &conn).unwrap();

        // Directory gone
        assert!(!skill_dir.exists());
        // DB record gone
        assert!(crate::db::get_imported_skill(&conn, "del-skill").unwrap().is_none());
    }

    #[test]
    fn test_delete_imported_skill_inactive() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create inactive skill directory
        let skills_dir = workspace.path().join(".claude").join("skills");
        let inactive_path = skills_dir.join(".inactive").join("del-skill");
        fs::create_dir_all(&inactive_path).unwrap();
        fs::write(inactive_path.join("SKILL.md"), "# Skill").unwrap();

        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "del-skill".to_string(),
            domain: None,
            description: None,
            is_active: false,
            disk_path: inactive_path.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        delete_imported_skill_inner("del-skill", workspace_path, &conn).unwrap();

        assert!(!inactive_path.exists());
        assert!(crate::db::get_imported_skill(&conn, "del-skill").unwrap().is_none());
    }

    // --- Get skill content test ---

    #[test]
    fn test_get_skill_content() {
        let workspace = tempdir().unwrap();
        let skill_dir = workspace.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let content = "---\nname: my-skill\n---\n# My Skill\nContent here";
        fs::write(skill_dir.join("SKILL.md"), content).unwrap();

        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "my-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: skill_dir.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };

        let result = get_skill_content_inner(&skill).unwrap();
        assert_eq!(result, content);
    }

    #[test]
    fn test_get_skill_content_missing_file() {
        let skill = ImportedSkill {
            skill_id: "id1".to_string(),
            skill_name: "missing".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: "/nonexistent/path".to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };

        let result = get_skill_content_inner(&skill);
        assert!(result.is_err());
    }

    // --- CLAUDE.md generation tests ---

    #[test]
    fn test_update_skills_section_creates_section() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a base CLAUDE.md with customization marker
        let claude_dir = workspace.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(claude_dir.join("CLAUDE.md"), "# Base Content\n\nSome instructions.\n\n## Customization\n\nUser notes.\n").unwrap();

        // Insert an active skill with trigger text
        let skill = ImportedSkill {
            skill_id: "imp-1".to_string(),
            skill_name: "my-analytics".to_string(),
            domain: Some("analytics".to_string()),
            description: None,
            is_active: true,
            disk_path: "/tmp/s1".to_string(),
            trigger_text: Some("When the user asks about analytics, use this skill.".to_string()),
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        crate::commands::workflow::update_skills_section(workspace_path, &conn).unwrap();

        let content = fs::read_to_string(claude_dir.join("CLAUDE.md")).unwrap();
        assert!(content.contains("# Base Content"));
        assert!(content.contains("## Custom Skills"));
        assert!(content.contains("### /my-analytics"));
        assert!(content.contains("When the user asks about analytics, use this skill."));
        // Customization preserved
        assert!(content.contains("## Customization"));
        assert!(content.contains("User notes."));
    }

    #[test]
    fn test_update_skills_section_no_active_skills() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a base CLAUDE.md with customization marker
        let claude_dir = workspace.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(claude_dir.join("CLAUDE.md"), "# Base Content\n\n## Customization\n\nMy rules.\n").unwrap();

        // No skills inserted — section should not be present
        crate::commands::workflow::update_skills_section(workspace_path, &conn).unwrap();

        let content = fs::read_to_string(claude_dir.join("CLAUDE.md")).unwrap();
        assert!(content.contains("# Base Content"));
        assert!(!content.contains("## Custom Skills"));
        // Customization preserved
        assert!(content.contains("## Customization"));
        assert!(content.contains("My rules."));
    }

    #[test]
    fn test_update_skills_section_replaces_existing() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create CLAUDE.md with an existing imported skills section + customization
        let claude_dir = workspace.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(
            claude_dir.join("CLAUDE.md"),
            "# Base\n\n## Custom Skills\n\n### /old-skill\nOld trigger text.\n\n## Customization\n\nKeep me.\n",
        ).unwrap();

        // Insert a new active skill with trigger text
        let skill = ImportedSkill {
            skill_id: "imp-new".to_string(),
            skill_name: "new-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: "/tmp/new".to_string(),
            trigger_text: Some("New trigger.".to_string()),
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        crate::commands::workflow::update_skills_section(workspace_path, &conn).unwrap();

        let content = fs::read_to_string(claude_dir.join("CLAUDE.md")).unwrap();
        assert!(content.contains("# Base"));
        assert!(content.contains("### /new-skill"));
        assert!(content.contains("New trigger."));
        // Old section should be replaced
        assert!(!content.contains("### /old-skill"));
        assert!(!content.contains("Old trigger text."));
        // Customization preserved
        assert!(content.contains("## Customization"));
        assert!(content.contains("Keep me."));
    }

    #[test]
    fn test_update_skills_section_preserves_customization() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // CLAUDE.md with imported skills in the middle and customization after
        let claude_dir = workspace.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(
            claude_dir.join("CLAUDE.md"),
            "# Base Content\n\nSome text.\n\n## Custom Skills\n\n### /old-skill\nOld trigger.\n\n## Customization\n\nMy workspace rules.\n",
        ).unwrap();

        // Insert a new active skill with trigger text
        let skill = ImportedSkill {
            skill_id: "imp-new".to_string(),
            skill_name: "new-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: "/tmp/new".to_string(),
            trigger_text: Some("New trigger.".to_string()),
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        crate::commands::workflow::update_skills_section(workspace_path, &conn).unwrap();

        let content = fs::read_to_string(claude_dir.join("CLAUDE.md")).unwrap();
        // Base content preserved
        assert!(content.contains("# Base Content"));
        assert!(content.contains("Some text."));
        // New imported skills section present
        assert!(content.contains("### /new-skill"));
        assert!(content.contains("New trigger."));
        // Old skill removed
        assert!(!content.contains("### /old-skill"));
        // Customization section preserved with user content
        assert!(content.contains("## Customization"));
        assert!(content.contains("My workspace rules."));
    }

    #[test]
    fn test_rebuild_claude_md_preserves_customization() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a bundled base template with customization marker
        let base_dir = tempdir().unwrap();
        let base_path = base_dir.path().join("CLAUDE.md");
        fs::write(&base_path, "# Agent Instructions\n\nBase content.\n\n## Customization\n\nDefault instructions.\n").unwrap();

        // Create an existing workspace CLAUDE.md with user customization
        let claude_dir = workspace.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(
            claude_dir.join("CLAUDE.md"),
            "# Old Base\n\n## Custom Skills\n\n### /stale-skill\nStale.\n\n## Customization\n\nMy custom instructions.\nDo not lose this.\n",
        ).unwrap();

        // Insert an active skill
        let skill = ImportedSkill {
            skill_id: "imp-1".to_string(),
            skill_name: "analytics".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: "/tmp/a".to_string(),
            trigger_text: Some("Use for analytics.".to_string()),
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Simulate startup: rebuild from bundled base
        crate::commands::workflow::rebuild_claude_md(&base_path, workspace_path, &conn).unwrap();

        let content = fs::read_to_string(claude_dir.join("CLAUDE.md")).unwrap();
        // Base content from bundled template (not old base)
        assert!(content.contains("# Agent Instructions"));
        assert!(content.contains("Base content."));
        assert!(!content.contains("# Old Base"));
        // Skills regenerated from DB
        assert!(content.contains("## Custom Skills"));
        assert!(content.contains("### /analytics"));
        assert!(content.contains("Use for analytics."));
        // Stale skill gone
        assert!(!content.contains("### /stale-skill"));
        // User customization preserved (not replaced with default)
        assert!(content.contains("## Customization"));
        assert!(content.contains("My custom instructions."));
        assert!(content.contains("Do not lose this."));
        assert!(!content.contains("Default instructions."));
    }

    // --- Bundled skill tests ---

    #[test]
    fn test_delete_bundled_skill_returns_error() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create bundled skill directory
        let skills_dir = workspace.path().join(".claude").join("skills");
        let skill_dir = skills_dir.join("bundled-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Bundled").unwrap();

        let skill = ImportedSkill {
            skill_id: "bundled-test-id".to_string(),
            skill_name: "bundled-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: skill_dir.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2000-01-01T00:00:00Z".to_string(),
            is_bundled: true,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Attempt to delete — should fail
        let result = delete_imported_skill_inner("bundled-skill", workspace_path, &conn);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Cannot delete bundled skill"), "Expected bundled guard error, got: {}", err);

        // Verify skill still exists
        assert!(skill_dir.exists());
        assert!(crate::db::get_imported_skill(&conn, "bundled-skill").unwrap().is_some());
    }

    #[test]
    fn test_delete_non_bundled_skill_succeeds() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create non-bundled skill directory
        let skills_dir = workspace.path().join(".claude").join("skills");
        let skill_dir = skills_dir.join("regular-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Regular").unwrap();

        let skill = ImportedSkill {
            skill_id: "regular-test-id".to_string(),
            skill_name: "regular-skill".to_string(),
            domain: None,
            description: None,
            is_active: true,
            disk_path: skill_dir.to_string_lossy().to_string(),
            trigger_text: None,
            imported_at: "2025-01-01 00:00:00".to_string(),
            is_bundled: false,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Delete should succeed
        let result = delete_imported_skill_inner("regular-skill", workspace_path, &conn);
        assert!(result.is_ok());
        assert!(!skill_dir.exists());
        assert!(crate::db::get_imported_skill(&conn, "regular-skill").unwrap().is_none());
    }

    #[test]
    fn test_seed_bundled_skills() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Create a mock bundled-skills directory
        let bundled_dir = tempdir().unwrap();
        let skill_src = bundled_dir.path().join("test-bundled");
        fs::create_dir_all(skill_src.join("references")).unwrap();
        fs::write(
            skill_src.join("SKILL.md"),
            "---\nname: test-bundled\ndescription: A test bundled skill\ndomain: testing\n---\n# Test",
        ).unwrap();
        fs::write(skill_src.join("references").join("ref.md"), "# Ref").unwrap();

        // Seed
        seed_bundled_skills(workspace_path, &conn, bundled_dir.path()).unwrap();

        // Verify files copied
        let dest = workspace.path().join(".claude").join("skills").join("test-bundled");
        assert!(dest.join("SKILL.md").exists());
        assert!(dest.join("references").join("ref.md").exists());

        // Verify DB record
        let skill = crate::db::get_imported_skill(&conn, "test-bundled").unwrap().unwrap();
        assert!(skill.is_bundled);
        assert!(skill.is_active);
        assert_eq!(skill.imported_at, "2000-01-01T00:00:00Z");
        assert!(skill.trigger_text.is_some());
    }

    #[test]
    fn test_seed_bundled_skills_preserves_is_active() {
        let conn = create_test_db();
        let workspace = tempdir().unwrap();
        let workspace_path = workspace.path().to_str().unwrap();

        // Pre-insert the skill as deactivated
        let skill = ImportedSkill {
            skill_id: "bundled-test-bundled".to_string(),
            skill_name: "test-bundled".to_string(),
            domain: None,
            description: None,
            is_active: false,
            disk_path: "/old/path".to_string(),
            trigger_text: Some("old trigger".to_string()),
            imported_at: "2000-01-01T00:00:00Z".to_string(),
            is_bundled: true,
        };
        crate::db::insert_imported_skill(&conn, &skill).unwrap();

        // Create bundled source
        let bundled_dir = tempdir().unwrap();
        let skill_src = bundled_dir.path().join("test-bundled");
        fs::create_dir_all(&skill_src).unwrap();
        fs::write(
            skill_src.join("SKILL.md"),
            "---\nname: test-bundled\ndescription: Updated\n---\n# Test",
        ).unwrap();

        // Re-seed
        seed_bundled_skills(workspace_path, &conn, bundled_dir.path()).unwrap();

        // Verify is_active was preserved as false
        let updated = crate::db::get_imported_skill(&conn, "test-bundled").unwrap().unwrap();
        assert!(!updated.is_active, "is_active should be preserved as false");
        assert!(updated.is_bundled);
        // Description should be updated
        assert_eq!(updated.description.as_deref(), Some("Updated"));

        // Verify files copied to .inactive/ (not active path)
        let active_dest = workspace.path().join(".claude").join("skills").join("test-bundled");
        let inactive_dest = workspace.path().join(".claude").join("skills").join(".inactive").join("test-bundled");
        assert!(!active_dest.exists(), "inactive skill should not be in active path");
        assert!(inactive_dest.join("SKILL.md").exists(), "inactive skill should be in .inactive/ path");
    }

    #[test]
    fn test_upsert_bundled_skill_preserves_is_active() {
        let conn = create_test_db();

        // First insert with is_active = true
        let skill = ImportedSkill {
            skill_id: "bundled-1".to_string(),
            skill_name: "upsert-test".to_string(),
            domain: Some("test".to_string()),
            description: Some("Original".to_string()),
            is_active: true,
            disk_path: "/tmp/upsert".to_string(),
            trigger_text: Some("Original trigger".to_string()),
            imported_at: "2000-01-01T00:00:00Z".to_string(),
            is_bundled: true,
        };
        crate::db::upsert_bundled_skill(&conn, &skill).unwrap();

        let saved = crate::db::get_imported_skill(&conn, "upsert-test").unwrap().unwrap();
        assert!(saved.is_active);

        // Deactivate via DB
        crate::db::update_imported_skill_active(&conn, "upsert-test", false, "/tmp/inactive").unwrap();

        // Re-upsert with is_active = true in the struct
        let skill2 = ImportedSkill {
            skill_id: "bundled-1".to_string(),
            skill_name: "upsert-test".to_string(),
            domain: Some("test".to_string()),
            description: Some("Updated".to_string()),
            is_active: true,
            disk_path: "/tmp/upsert2".to_string(),
            trigger_text: Some("Updated trigger".to_string()),
            imported_at: "2000-01-01T00:00:00Z".to_string(),
            is_bundled: true,
        };
        crate::db::upsert_bundled_skill(&conn, &skill2).unwrap();

        // The upsert should NOT override is_active (ON CONFLICT doesn't touch it)
        let updated = crate::db::get_imported_skill(&conn, "upsert-test").unwrap().unwrap();
        assert!(!updated.is_active, "upsert should preserve is_active from existing row");
        // But other fields should be updated
        assert_eq!(updated.description.as_deref(), Some("Updated"));
        assert_eq!(updated.disk_path, "/tmp/upsert2");
        assert_eq!(updated.trigger_text.as_deref(), Some("Updated trigger"));
    }
}
