use crate::bluetooth::{BluetoothDevice, ProximityStatus};
use crate::crypto;
use crate::state::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

// ── Auth Commands ──

#[tauri::command]
pub fn check_vault_exists(state: State<'_, AppState>) -> bool {
    state.db.exists()
}

#[tauri::command]
pub fn create_vault(state: State<'_, AppState>, password: String) -> Result<(), String> {
    let (key, salt) = crypto::derive_key(&password, None)?;
    state.db.create_new(&key)?;

    // Store salt in a sidecar file (not secret, needed to re-derive key on login)
    let salt_path = state.db.db_path.with_extension("salt");
    std::fs::write(&salt_path, &salt)
        .map_err(|e| format!("Failed to write salt file: {}", e))?;

    // Store derived key in memory for this session
    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(key);

    Ok(())
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, AppState>, password: String) -> Result<(), String> {
    // First, open DB with a temporary connection to read the salt
    let temp_conn = rusqlite::Connection::open(&state.db.db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // We need to try deriving the key — but we need the salt first.
    // The salt is stored inside the encrypted DB, so we need to try opening with the password.
    // Strategy: try common salt, or store salt alongside DB in a separate file.
    // Better approach: store salt in a plaintext sidecar file.
    let salt_path = state.db.db_path.with_extension("salt");
    let salt = std::fs::read_to_string(&salt_path)
        .map_err(|_| "Salt file not found — vault may be corrupted".to_string())?;

    let (key, _) = crypto::derive_key(&password, Some(&salt))?;
    state.db.open(&key)?;

    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(key);
    drop(temp_conn);

    Ok(())
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    // Clean up any decrypted temp files
    let app_data = state.db.db_path.parent().unwrap();
    let tmp_dir = app_data.join("tmp");
    if tmp_dir.exists() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    state.db.close()?;
    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = None;
    Ok(())
}

// ── Project Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub directory_path: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, name, icon, directory_path, sort_order, created_at, updated_at FROM projects ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                directory_path: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, name: String) -> Result<Project, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Get next sort order
    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM projects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO projects (id, name, icon, sort_order, created_at, updated_at) VALUES (?1, ?2, '', ?3, ?4, ?5)",
        params![id, name, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        icon: String::new(),
        directory_path: String::new(),
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn rename_project(state: State<'_, AppState>, id: String, name: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM secrets WHERE category_id IN (SELECT id FROM secret_categories WHERE project_id = ?1)", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM secret_categories WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Secret Category Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct SecretCategory {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub icon: String,
    pub is_builtin: bool,
    pub is_hidden: bool,
    pub sort_order: i32,
}

#[tauri::command]
pub fn get_secret_categories(state: State<'_, AppState>, project_id: String) -> Result<Vec<SecretCategory>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, project_id, name, icon, is_builtin, is_hidden, sort_order FROM secret_categories WHERE project_id = ?1 AND is_hidden = 0 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map(params![project_id], |row| {
            Ok(SecretCategory {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                icon: row.get(3)?,
                is_builtin: row.get(4)?,
                is_hidden: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}

#[tauri::command]
pub fn create_secret_category(state: State<'_, AppState>, project_id: String, name: String) -> Result<SecretCategory, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM secret_categories WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO secret_categories (id, project_id, name, is_builtin, sort_order) VALUES (?1, ?2, ?3, 0, ?4)",
        params![id, project_id, name, max_order + 1],
    ).map_err(|e| e.to_string())?;

    Ok(SecretCategory {
        id,
        project_id,
        name,
        icon: String::new(),
        is_builtin: false,
        is_hidden: false,
        sort_order: max_order + 1,
    })
}

pub const BUILTIN_CATEGORY_TEMPLATES: &[&str] = &[
    "API Keys",
    "Passwords",
    "Database",
    "OAuth Tokens",
    "SSH Keys",
    "Env Variables",
    "Certificates",
    "Webhooks",
    "License Keys",
    "Service Accounts",
    "Personal Access Tokens",
    "Encryption Keys",
];

#[tauri::command]
pub fn get_builtin_templates(state: State<'_, AppState>, project_id: String) -> Result<Vec<String>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Get categories already added to this project
    let mut stmt = conn
        .prepare("SELECT name FROM secret_categories WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let existing: Vec<String> = stmt
        .query_map(params![project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Return only templates not yet added
    let available: Vec<String> = BUILTIN_CATEGORY_TEMPLATES
        .iter()
        .filter(|name| !existing.contains(&name.to_string()))
        .map(|s| s.to_string())
        .collect();

    Ok(available)
}

#[tauri::command]
pub fn hide_secret_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute(
        "UPDATE secret_categories SET is_hidden = 1 WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_secret_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Only allow deleting non-builtin categories
    let is_builtin: bool = conn
        .query_row("SELECT is_builtin FROM secret_categories WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if is_builtin {
        return Err("Cannot delete builtin categories — use hide instead".to_string());
    }

    conn.execute("DELETE FROM secrets WHERE category_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM secret_categories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Secret Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Secret {
    pub id: String,
    pub category_id: String,
    pub name: String,
    pub masked_preview: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_secrets(state: State<'_, AppState>, category_id: String) -> Result<Vec<Secret>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, category_id, name, masked_preview, notes, created_at, updated_at FROM secrets WHERE category_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let secrets = stmt
        .query_map(params![category_id], |row| {
            Ok(Secret {
                id: row.get(0)?,
                category_id: row.get(1)?,
                name: row.get(2)?,
                masked_preview: row.get(3)?,
                notes: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(secrets)
}

#[tauri::command]
pub fn create_secret(
    state: State<'_, AppState>,
    category_id: String,
    name: String,
    value: String,
    notes: String,
) -> Result<Secret, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let encrypted = crypto::encrypt_value(key, &value)?;
    let masked = crypto::generate_masked_preview(&value);

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO secrets (id, category_id, name, encrypted_value, masked_preview, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, category_id, name, encrypted, masked, notes, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Secret {
        id,
        category_id,
        name,
        masked_preview: masked,
        notes,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn reveal_secret(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let encrypted: Vec<u8> = conn
        .query_row("SELECT encrypted_value FROM secrets WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    crypto::decrypt_value(key, &encrypted)
}

#[tauri::command]
pub fn update_secret(
    state: State<'_, AppState>,
    id: String,
    name: String,
    value: String,
    notes: String,
) -> Result<(), String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let encrypted = crypto::encrypt_value(key, &value)?;
    let masked = crypto::generate_masked_preview(&value);

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE secrets SET name = ?1, encrypted_value = ?2, masked_preview = ?3, notes = ?4, updated_at = ?5 WHERE id = ?6",
        params![name, encrypted, masked, notes, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_secret(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM secrets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Note Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_notes(state: State<'_, AppState>, project_id: String) -> Result<Vec<Note>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, project_id, title, content, category, sort_order, created_at, updated_at FROM notes WHERE project_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map(params![project_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                category: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(notes)
}

#[tauri::command]
pub fn create_note(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
    category: String,
) -> Result<Note, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM notes WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO notes (id, project_id, title, content, category, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, '{}', ?4, ?5, ?6, ?7)",
        params![id, project_id, title, category, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Note {
        id,
        project_id,
        title,
        content: "{}".to_string(),
        category,
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![title, content, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Favorites Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Favorite {
    pub id: String,
    pub project_id: String,
    pub item_id: String,
    pub item_type: String,
    pub item_name: String,
    pub sort_order: i32,
}

#[tauri::command]
pub fn get_favorites(state: State<'_, AppState>, project_id: String) -> Result<Vec<Favorite>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, project_id, item_id, item_type, item_name, sort_order FROM favorites WHERE project_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let favs = stmt
        .query_map(params![project_id], |row| {
            Ok(Favorite {
                id: row.get(0)?,
                project_id: row.get(1)?,
                item_id: row.get(2)?,
                item_type: row.get(3)?,
                item_name: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(favs)
}

#[tauri::command]
pub fn toggle_favorite(
    state: State<'_, AppState>,
    project_id: String,
    item_id: String,
    item_type: String,
    item_name: String,
) -> Result<bool, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Check if already favorited
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM favorites WHERE item_id = ?1 AND project_id = ?2",
            params![item_id, project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        conn.execute("DELETE FROM favorites WHERE item_id = ?1 AND project_id = ?2", params![item_id, project_id])
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        let max_order: i32 = conn
            .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM favorites WHERE project_id = ?1", params![project_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO favorites (id, project_id, item_id, item_type, item_name, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, item_id, item_type, item_name, max_order + 1],
        ).map_err(|e| e.to_string())?;
        Ok(true)
    }
}

// ── Tags Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn.prepare("SELECT id, name FROM tags ORDER BY name").map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)? }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[tauri::command]
pub fn get_item_tags(state: State<'_, AppState>, item_id: String) -> Result<Vec<Tag>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT t.id, t.name FROM tags t INNER JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = ?1 ORDER BY t.name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map(params![item_id], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)? }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[tauri::command]
pub fn add_tag_to_item(
    state: State<'_, AppState>,
    item_id: String,
    item_type: String,
    tag_name: String,
) -> Result<Tag, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Get or create tag
    let tag_id: String = match conn.query_row("SELECT id FROM tags WHERE name = ?1", params![tag_name], |row| row.get(0)) {
        Ok(id) => id,
        Err(_) => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute("INSERT INTO tags (id, name) VALUES (?1, ?2)", params![id, tag_name])
                .map_err(|e| e.to_string())?;
            id
        }
    };

    // Link tag to item (ignore if already linked)
    conn.execute(
        "INSERT OR IGNORE INTO item_tags (item_id, tag_id, item_type) VALUES (?1, ?2, ?3)",
        params![item_id, tag_id, item_type],
    ).map_err(|e| e.to_string())?;

    Ok(Tag { id: tag_id, name: tag_name })
}

#[tauri::command]
pub fn remove_tag_from_item(state: State<'_, AppState>, item_id: String, tag_id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2", params![item_id, tag_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn search_by_tag(state: State<'_, AppState>, tag_name: String) -> Result<Vec<(String, String, String)>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT it.item_id, it.item_type, \
             COALESCE(s.name, n.title, f.filename, '') as item_name \
             FROM item_tags it \
             INNER JOIN tags t ON t.id = it.tag_id \
             LEFT JOIN secrets s ON it.item_id = s.id AND it.item_type = 'secret' \
             LEFT JOIN notes n ON it.item_id = n.id AND it.item_type = 'note' \
             LEFT JOIN files f ON it.item_id = f.id AND it.item_type = 'file' \
             WHERE t.name = ?1"
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![tag_name], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

// ── Reorder Commands ──

#[tauri::command]
pub fn reorder_items(
    state: State<'_, AppState>,
    table: String,
    ids: Vec<String>,
) -> Result<(), String> {
    let allowed_tables = ["secret_categories", "file_folders", "notes", "favorites"];
    if !allowed_tables.contains(&table.as_str()) {
        return Err(format!("Invalid table: {}", table));
    }

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            &format!("UPDATE {} SET sort_order = ?1 WHERE id = ?2", table),
            params![i as i32, id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Bluetooth Commands ──

#[tauri::command]
pub async fn bluetooth_scan(state: State<'_, AppState>) -> Result<Vec<BluetoothDevice>, String> {
    state.bluetooth.scan_devices().await
}

#[tauri::command]
pub async fn bluetooth_pair(state: State<'_, AppState>, address: String) -> Result<(), String> {
    state.bluetooth.set_paired_device(Some(address)).await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_unpair(state: State<'_, AppState>) -> Result<(), String> {
    state.bluetooth.set_paired_device(None).await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_status(state: State<'_, AppState>) -> Result<ProximityStatus, String> {
    Ok(state.bluetooth.get_status().await)
}
