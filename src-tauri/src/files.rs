use crate::crypto;
use crate::state::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB
const THUMB_WIDTH: u32 = 200;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileFolder {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub sort_order: i32,
    pub file_count: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FileRecord {
    pub id: String,
    pub folder_id: String,
    pub project_id: String,
    pub filename: String,
    pub file_path: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub is_encrypted: bool,
    pub thumbnail_path: String,
    pub note_id: String,
    pub created_at: String,
    pub updated_at: String,
}

pub const SUGGESTED_FOLDERS: &[&str] = &[
    "Screenshots",
    "Documents",
    "Configs",
    "Design",
    "Keys",
];

// ── File Folder Commands ──

#[tauri::command]
pub fn get_suggested_file_folders(state: State<'_, AppState>, project_id: String) -> Result<Vec<String>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT name FROM file_folders WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let existing: Vec<String> = stmt
        .query_map(params![project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let available: Vec<String> = SUGGESTED_FOLDERS
        .iter()
        .filter(|name| !existing.contains(&name.to_string()))
        .map(|s| s.to_string())
        .collect();

    Ok(available)
}

#[tauri::command]
pub fn create_file_folder(state: State<'_, AppState>, project_id: String, name: String) -> Result<FileFolder, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM file_folders WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO file_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
        params![id, project_id, name, max_order + 1],
    ).map_err(|e| e.to_string())?;

    Ok(FileFolder {
        id,
        project_id,
        name,
        sort_order: max_order + 1,
        file_count: 0,
    })
}

#[tauri::command]
pub fn get_file_folders(state: State<'_, AppState>, project_id: String) -> Result<Vec<FileFolder>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT ff.id, ff.project_id, ff.name, ff.sort_order, \
             (SELECT COUNT(*) FROM files WHERE folder_id = ff.id) as file_count \
             FROM file_folders ff WHERE ff.project_id = ?1 ORDER BY ff.sort_order"
        )
        .map_err(|e| e.to_string())?;

    let folders = stmt
        .query_map(params![project_id], |row| {
            Ok(FileFolder {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                file_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(folders)
}

#[tauri::command]
pub fn delete_file_folder(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (name, project_id): (String, String) = conn
        .query_row("SELECT name, project_id FROM file_folders WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": id, "name": name, "project_id": project_id }).to_string();
    crate::commands::move_to_trash(conn, "file_folder", &name, &data, &project_id)?;

    // Delete files from disk
    let mut stmt = conn
        .prepare("SELECT file_path, thumbnail_path FROM files WHERE folder_id = ?1")
        .map_err(|e| e.to_string())?;
    let paths: Vec<(String, String)> = stmt
        .query_map(params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    for (file_path, thumb_path) in &paths {
        let _ = std::fs::remove_file(app_data.join(file_path));
        if !thumb_path.is_empty() {
            let _ = std::fs::remove_file(app_data.join(thumb_path));
        }
    }

    conn.execute("DELETE FROM files WHERE folder_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM file_folders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── File Commands ──

#[tauri::command]
pub fn add_file(
    state: State<'_, AppState>,
    project_id: String,
    folder_id: String,
    source_path: String,
    encrypt: bool,
) -> Result<FileRecord, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("Source file not found".to_string());
    }

    let metadata = std::fs::metadata(source).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!("File exceeds maximum size of 50MB (file is {}MB)", metadata.len() / 1024 / 1024));
    }

    let filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mime_type = mime_guess::from_path(source)
        .first_or_octet_stream()
        .to_string();

    let file_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let files_dir = app_data.join("files").join(&project_id);
    std::fs::create_dir_all(&files_dir).map_err(|e| e.to_string())?;

    let dest_filename = format!("{}-{}", file_id, filename);
    let dest_path = files_dir.join(&dest_filename);
    let relative_path = format!("files/{}/{}", project_id, dest_filename);

    // Read source file
    let file_data = std::fs::read(source).map_err(|e| e.to_string())?;

    // Write file (encrypted or plain)
    if encrypt {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;
        let encrypted = crypto::encrypt_value(key, &base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &file_data))?;
        std::fs::write(&dest_path, &encrypted).map_err(|e| e.to_string())?;
    } else {
        std::fs::write(&dest_path, &file_data).map_err(|e| e.to_string())?;
    }

    // Generate thumbnail for images
    let thumbnail_path = if is_image(&mime_type) {
        generate_thumbnail(app_data, &project_id, &file_id, &file_data, encrypt, state.inner())?
    } else {
        String::new()
    };

    // Insert into DB
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute(
        "INSERT INTO files (id, folder_id, project_id, filename, file_path, mime_type, size_bytes, is_encrypted, thumbnail_path, note_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, '', ?10, ?11)",
        params![file_id, folder_id, project_id, filename, relative_path, mime_type, metadata.len() as i64, encrypt, thumbnail_path, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(FileRecord {
        id: file_id,
        folder_id,
        project_id,
        filename,
        file_path: relative_path,
        mime_type,
        size_bytes: metadata.len() as i64,
        is_encrypted: encrypt,
        thumbnail_path,
        note_id: String::new(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_files(state: State<'_, AppState>, folder_id: String) -> Result<Vec<FileRecord>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, folder_id, project_id, filename, file_path, mime_type, size_bytes, \
             is_encrypted, thumbnail_path, note_id, created_at, updated_at \
             FROM files WHERE folder_id = ?1 ORDER BY created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let files = stmt
        .query_map(params![folder_id], |row| {
            Ok(FileRecord {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                project_id: row.get(2)?,
                filename: row.get(3)?,
                file_path: row.get(4)?,
                mime_type: row.get(5)?,
                size_bytes: row.get(6)?,
                is_encrypted: row.get(7)?,
                thumbnail_path: row.get(8)?,
                note_id: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(files)
}

#[tauri::command]
pub fn get_file_path(state: State<'_, AppState>, file_id: String) -> Result<String, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (file_path, is_encrypted): (String, bool) = conn
        .query_row(
            "SELECT file_path, is_encrypted FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&file_path);

    if is_encrypted {
        // Decrypt to temp directory
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;

        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        let tmp_dir = app_data.join("tmp");
        std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

        let tmp_path = tmp_dir.join(full_path.file_name().unwrap_or_default());
        std::fs::write(&tmp_path, &decrypted).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600)).ok();
        }

        Ok(tmp_path.to_string_lossy().to_string())
    } else {
        Ok(full_path.to_string_lossy().to_string())
    }
}

#[tauri::command]
pub fn get_thumbnail_path(state: State<'_, AppState>, file_id: String) -> Result<String, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (thumb_path, is_encrypted): (String, bool) = conn
        .query_row(
            "SELECT thumbnail_path, is_encrypted FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    if thumb_path.is_empty() {
        return Err("No thumbnail available".to_string());
    }

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&thumb_path);

    if is_encrypted {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;

        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        let tmp_dir = app_data.join("tmp");
        std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

        let tmp_path = tmp_dir.join(full_path.file_name().unwrap_or_default());
        std::fs::write(&tmp_path, &decrypted).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600)).ok();
        }

        Ok(tmp_path.to_string_lossy().to_string())
    } else {
        Ok(full_path.to_string_lossy().to_string())
    }
}

#[tauri::command]
pub fn delete_file(state: State<'_, AppState>, file_id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (filename, file_path, thumb_path, project_id): (String, String, String, String) = conn
        .query_row(
            "SELECT filename, file_path, thumbnail_path, project_id FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": file_id, "filename": filename, "project_id": project_id }).to_string();
    crate::commands::move_to_trash(conn, "file", &filename, &data, &project_id)?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let _ = std::fs::remove_file(app_data.join(&file_path));
    if !thumb_path.is_empty() {
        let _ = std::fs::remove_file(app_data.join(&thumb_path));
    }

    conn.execute("DELETE FROM files WHERE id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn toggle_file_encryption(state: State<'_, AppState>, file_id: String) -> Result<bool, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (file_path, is_encrypted): (String, bool) = conn
        .query_row(
            "SELECT file_path, is_encrypted FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&file_path);

    if is_encrypted {
        // Decrypt in place
        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;
        std::fs::write(&full_path, &decrypted).map_err(|e| e.to_string())?;
    } else {
        // Encrypt in place
        let plain_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &plain_data);
        let encrypted = crypto::encrypt_value(key, &b64)?;
        std::fs::write(&full_path, &encrypted).map_err(|e| e.to_string())?;
    }

    let new_encrypted = !is_encrypted;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE files SET is_encrypted = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_encrypted, now, file_id],
    ).map_err(|e| e.to_string())?;

    Ok(new_encrypted)
}

/// Open file in the default OS application
#[tauri::command]
pub fn open_file(state: State<'_, AppState>, file_id: String) -> Result<(), String> {
    // Get the file path (decrypts to temp if needed)
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (file_path, is_encrypted, filename): (String, bool, String) = conn
        .query_row(
            "SELECT file_path, is_encrypted, filename FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&file_path);

    let open_path = if is_encrypted {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;

        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        let tmp_dir = app_data.join("tmp");
        std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

        // Use the original filename so the OS opens it with the right app
        let tmp_path = tmp_dir.join(&filename);
        std::fs::write(&tmp_path, &decrypted).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600)).ok();
        }
        tmp_path
    } else {
        full_path
    };

    // Use macOS `open` command / Windows `start`
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&open_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &open_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

/// Export/download file to a user-chosen location
#[tauri::command]
pub fn export_file(state: State<'_, AppState>, file_id: String, destination: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (file_path, is_encrypted): (String, bool) = conn
        .query_row(
            "SELECT file_path, is_encrypted FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Path traversal protection
    if destination.contains("..") {
        return Err("Invalid export path".to_string());
    }

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&file_path);

    if is_encrypted {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;

        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        std::fs::write(&destination, &decrypted).map_err(|e| e.to_string())?;
    } else {
        std::fs::copy(&full_path, &destination).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Share file using native macOS share sheet
#[tauri::command]
pub fn share_file(state: State<'_, AppState>, file_id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (file_path, is_encrypted, filename): (String, bool, String) = conn
        .query_row(
            "SELECT file_path, is_encrypted, filename FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let full_path = app_data.join(&file_path);

    let share_path = if is_encrypted {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;

        let encrypted_data = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let decrypted_b64 = crypto::decrypt_value(key, &encrypted_data)?;
        let decrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &decrypted_b64)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        let tmp_dir = app_data.join("tmp");
        std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

        let tmp_path = tmp_dir.join(&filename);
        std::fs::write(&tmp_path, &decrypted).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600)).ok();
        }
        tmp_path
    } else {
        full_path
    };

    #[cfg(target_os = "macos")]
    {
        // Try to open Finder and trigger the share menu via keyboard shortcut
        let result = std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(
                    r#"tell application "Finder"
                        activate
                        reveal POSIX file "{}"
                    end tell
                    tell application "System Events"
                        keystroke "n" using {{option down, command down}}
                    end tell"#,
                    share_path.to_string_lossy()
                ),
            ])
            .output();

        match result {
            Ok(output) if output.status.success() => {}
            _ => {
                // Fallback: just reveal in Finder
                std::process::Command::new("open")
                    .args(["-R", &share_path.to_string_lossy()])
                    .spawn()
                    .map_err(|e| format!("Failed to reveal file: {}", e))?;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, reveal in Explorer as share fallback
        std::process::Command::new("explorer")
            .args(["/select,", &share_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn cleanup_temp_files(state: State<'_, AppState>) -> Result<(), String> {
    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let tmp_dir = app_data.join("tmp");
    if tmp_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&tmp_dir) {
            log::error!("Failed to clean up temp directory {:?}: {}", tmp_dir, e);
        }
    }
    Ok(())
}

// ── Helpers ──

fn is_image(mime_type: &str) -> bool {
    mime_type.starts_with("image/")
        && !mime_type.contains("svg") // skip SVG thumbnailing
}

fn generate_thumbnail(
    app_data: &Path,
    project_id: &str,
    file_id: &str,
    file_data: &[u8],
    encrypt: bool,
    state: &AppState,
) -> Result<String, String> {
    let img = image::load_from_memory(file_data)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let thumb = img.thumbnail(THUMB_WIDTH, THUMB_WIDTH * 2); // maintain aspect ratio

    let thumbs_dir = app_data.join("files").join(project_id).join("thumbs");
    std::fs::create_dir_all(&thumbs_dir).map_err(|e| e.to_string())?;

    let thumb_filename = format!("{}.png", file_id);
    let thumb_full_path = thumbs_dir.join(&thumb_filename);
    let relative_path = format!("files/{}/thumbs/{}", project_id, thumb_filename);

    // Save thumbnail to a buffer first
    let mut thumb_data = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut thumb_data);
    thumb.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to write thumbnail: {}", e))?;

    if encrypt {
        let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
        let key = key_guard.as_ref().ok_or("Vault is locked")?;
        let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &thumb_data);
        let encrypted = crypto::encrypt_value(key, &b64)?;
        std::fs::write(&thumb_full_path, &encrypted).map_err(|e| e.to_string())?;
    } else {
        std::fs::write(&thumb_full_path, &thumb_data).map_err(|e| e.to_string())?;
    }

    Ok(relative_path)
}
