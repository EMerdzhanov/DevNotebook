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
    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    let tmp_dir = app_data.join("tmp");
    if tmp_dir.exists() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    state.db.close()?;
    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = None;
    Ok(())
}

pub fn move_to_trash(conn: &rusqlite::Connection, item_type: &str, item_name: &str, item_data: &str, project_id: &str) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO trash (id, item_type, item_name, item_data, project_id, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![uuid::Uuid::new_v4().to_string(), item_type, item_name, item_data, project_id, now],
    ).map_err(|e| format!("Failed to move to trash: {}", e))?;
    Ok(())
}

// ── Project Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub directory_path: String,
    pub platform: String,
    pub environment: String,
    pub repo_url: String,
    pub prod_url: String,
    pub dashboard_url: String,
    pub docs_url: String,
    pub ai_provider: String,
    pub ai_model: String,
    pub agent_framework: String,
    pub frontend_stack: String,
    pub backend_stack: String,
    pub database_stack: String,
    pub is_open: bool,
    pub is_archived: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn query_projects(conn: &rusqlite::Connection, where_clause: &str) -> Result<Vec<Project>, String> {
    let sql = format!(
        "SELECT id, name, description, icon, directory_path, platform, environment, \
         repo_url, prod_url, dashboard_url, docs_url, \
         ai_provider, ai_model, agent_framework, \
         frontend_stack, backend_stack, database_stack, \
         is_open, is_archived, sort_order, created_at, updated_at \
         FROM projects {} ORDER BY sort_order",
        where_clause
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                icon: row.get(3)?,
                directory_path: row.get(4)?,
                platform: row.get(5)?,
                environment: row.get(6)?,
                repo_url: row.get(7)?,
                prod_url: row.get(8)?,
                dashboard_url: row.get(9)?,
                docs_url: row.get(10)?,
                ai_provider: row.get(11)?,
                ai_model: row.get(12)?,
                agent_framework: row.get(13)?,
                frontend_stack: row.get(14)?,
                backend_stack: row.get(15)?,
                database_stack: row.get(16)?,
                is_open: row.get(17)?,
                is_archived: row.get(18)?,
                sort_order: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(projects)
}

#[tauri::command]
pub fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    query_projects(conn, "WHERE is_open = 1")
}

#[tauri::command]
pub fn get_all_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    query_projects(conn, "WHERE is_archived = 0")
}

#[derive(Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    #[serde(default)] pub description: String,
    #[serde(default)] pub platform: String,
    #[serde(default)] pub environment: String,
    #[serde(default)] pub repo_url: String,
    #[serde(default)] pub prod_url: String,
    #[serde(default)] pub dashboard_url: String,
    #[serde(default)] pub docs_url: String,
    #[serde(default)] pub ai_provider: String,
    #[serde(default)] pub ai_model: String,
    #[serde(default)] pub agent_framework: String,
    #[serde(default)] pub frontend_stack: String,
    #[serde(default)] pub backend_stack: String,
    #[serde(default)] pub database_stack: String,
}

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, input: CreateProjectInput) -> Result<Project, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM projects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO projects (id, name, description, platform, environment, repo_url, prod_url, dashboard_url, docs_url, ai_provider, ai_model, agent_framework, frontend_stack, backend_stack, database_stack, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![id, input.name, input.description, input.platform, input.environment, input.repo_url, input.prod_url, input.dashboard_url, input.docs_url, input.ai_provider, input.ai_model, input.agent_framework, input.frontend_stack, input.backend_stack, input.database_stack, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name: input.name,
        description: input.description,
        icon: String::new(),
        directory_path: String::new(),
        platform: input.platform,
        environment: input.environment,
        repo_url: input.repo_url,
        prod_url: input.prod_url,
        dashboard_url: input.dashboard_url,
        docs_url: input.docs_url,
        ai_provider: input.ai_provider,
        ai_model: input.ai_model,
        agent_framework: input.agent_framework,
        frontend_stack: input.frontend_stack,
        backend_stack: input.backend_stack,
        database_stack: input.database_stack,
        is_open: true,
        is_archived: false,
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
pub fn update_project(state: State<'_, AppState>, id: String, input: CreateProjectInput) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE projects SET name=?1, description=?2, platform=?3, environment=?4, \
         repo_url=?5, prod_url=?6, dashboard_url=?7, docs_url=?8, \
         ai_provider=?9, ai_model=?10, agent_framework=?11, \
         frontend_stack=?12, backend_stack=?13, database_stack=?14, \
         updated_at=?15 WHERE id=?16",
        params![input.name, input.description, input.platform, input.environment,
                input.repo_url, input.prod_url, input.dashboard_url, input.docs_url,
                input.ai_provider, input.ai_model, input.agent_framework,
                input.frontend_stack, input.backend_stack, input.database_stack,
                now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Close a project tab (hide from tab bar, keep data)
#[tauri::command]
pub fn close_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("UPDATE projects SET is_open = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reopen a closed project in the tab bar
#[tauri::command]
pub fn open_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("UPDATE projects SET is_open = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Archive a project (hidden from dashboard, can be restored)
#[tauri::command]
pub fn archive_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("UPDATE projects SET is_archived = 1, is_open = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Soft-delete a project — move to trash, keep all data
#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let name: String = conn
        .query_row("SELECT name FROM projects WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let data = serde_json::json!({ "id": id, "name": name }).to_string();

    conn.execute(
        "INSERT INTO trash (id, item_type, item_name, item_data, project_id, deleted_at) VALUES (?1, 'project', ?2, ?3, ?4, ?5)",
        params![uuid::Uuid::new_v4().to_string(), name, data, id, now],
    ).map_err(|e| e.to_string())?;

    // Hide the project instead of deleting data
    conn.execute("UPDATE projects SET is_open = 0, is_archived = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Permanently delete a project and all its data (from trash)
#[tauri::command]
pub fn permanently_delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM secrets WHERE category_id IN (SELECT id FROM secret_categories WHERE project_id = ?1)", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM secret_categories WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM note_folders WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM file_folders WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM todos WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM favorites WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM journal_entries WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM time_sessions WHERE project_id = ?1", params![id])
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

    let is_builtin: bool = conn
        .query_row("SELECT is_builtin FROM secret_categories WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if is_builtin {
        return Err("Cannot delete builtin categories — use hide instead".to_string());
    }

    let (name, project_id): (String, String) = conn
        .query_row("SELECT name, project_id FROM secret_categories WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": id, "name": name, "project_id": project_id }).to_string();
    move_to_trash(conn, "secret_category", &name, &data, &project_id)?;

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
    pub url: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_secrets(state: State<'_, AppState>, category_id: String) -> Result<Vec<Secret>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, category_id, name, masked_preview, notes, url, created_at, updated_at FROM secrets WHERE category_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let secrets = stmt
        .query_map(params![category_id], |row| {
            Ok(Secret {
                id: row.get(0)?,
                category_id: row.get(1)?,
                name: row.get(2)?,
                masked_preview: row.get(3)?,
                notes: row.get(4)?,
                url: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
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
    url: String,
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
        "INSERT INTO secrets (id, category_id, name, encrypted_value, masked_preview, notes, url, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, category_id, name, encrypted, masked, notes, url, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Secret {
        id,
        category_id,
        name,
        masked_preview: masked,
        notes,
        url,
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
    url: String,
) -> Result<(), String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let encrypted = crypto::encrypt_value(key, &value)?;
    let masked = crypto::generate_masked_preview(&value);

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE secrets SET name = ?1, encrypted_value = ?2, masked_preview = ?3, notes = ?4, url = ?5, updated_at = ?6 WHERE id = ?7",
        params![name, encrypted, masked, notes, url, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_secret(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Move to trash
    let (name, category_id, masked_preview, notes, url): (String, String, String, String, String) = conn
        .query_row(
            "SELECT name, category_id, masked_preview, notes, url FROM secrets WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    let project_id: String = conn
        .query_row("SELECT project_id FROM secret_categories WHERE id = ?1", params![category_id], |row| row.get(0))
        .unwrap_or_default();

    let data = serde_json::json!({
        "id": id, "category_id": category_id, "name": name,
        "masked_preview": masked_preview, "notes": notes, "url": url
    }).to_string();

    move_to_trash(conn, "secret", &name, &data, &project_id)?;

    conn.execute("DELETE FROM secrets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Note Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub folder_id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

// ── Note Folder Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteFolder {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub sort_order: i32,
    pub note_count: i32,
}

pub const NOTE_FOLDER_TEMPLATES: &[&str] = &[
    "Architecture",
    "Improvements",
    "Ideas",
    "Meeting Notes",
    "API Docs",
    "Decisions",
];


#[tauri::command]
pub fn get_suggested_note_folders(state: State<'_, AppState>, project_id: String) -> Result<Vec<String>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT name FROM note_folders WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let existing: Vec<String> = stmt
        .query_map(params![project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let available: Vec<String> = NOTE_FOLDER_TEMPLATES
        .iter()
        .filter(|name| !existing.contains(&name.to_string()))
        .map(|s| s.to_string())
        .collect();

    Ok(available)
}

#[tauri::command]
pub fn create_note_folder(state: State<'_, AppState>, project_id: String, name: String) -> Result<NoteFolder, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM note_folders WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO note_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
        params![id, project_id, name, max_order + 1],
    ).map_err(|e| e.to_string())?;

    Ok(NoteFolder {
        id,
        project_id,
        name,
        sort_order: max_order + 1,
        note_count: 0,
    })
}

#[tauri::command]
pub fn get_note_folders(state: State<'_, AppState>, project_id: String) -> Result<Vec<NoteFolder>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT nf.id, nf.project_id, nf.name, nf.sort_order, \
             (SELECT COUNT(*) FROM notes WHERE folder_id = nf.id) as note_count \
             FROM note_folders nf WHERE nf.project_id = ?1 ORDER BY nf.sort_order"
        )
        .map_err(|e| e.to_string())?;

    let folders = stmt
        .query_map(params![project_id], |row| {
            Ok(NoteFolder {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                note_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(folders)
}

#[tauri::command]
pub fn delete_note_folder(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (name, project_id): (String, String) = conn
        .query_row("SELECT name, project_id FROM note_folders WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": id, "name": name, "project_id": project_id }).to_string();
    move_to_trash(conn, "note_folder", &name, &data, &project_id)?;

    conn.execute("DELETE FROM notes WHERE folder_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM note_folders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_notes(state: State<'_, AppState>, folder_id: String) -> Result<Vec<Note>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, folder_id, project_id, title, content, category, sort_order, created_at, updated_at FROM notes WHERE folder_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map(params![folder_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                content: row.get(4)?,
                category: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
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
    folder_id: String,
    project_id: String,
    title: String,
) -> Result<Note, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM notes WHERE folder_id = ?1",
            params![folder_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO notes (id, folder_id, project_id, title, content, category, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, '{}', '', ?5, ?6, ?7)",
        params![id, folder_id, project_id, title, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Note {
        id,
        folder_id,
        project_id,
        title,
        content: "{}".to_string(),
        category: String::new(),
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

    // Move to trash
    let (title, folder_id, project_id): (String, String, String) = conn
        .query_row(
            "SELECT title, folder_id, project_id FROM notes WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let data = serde_json::json!({
        "id": id, "folder_id": folder_id, "project_id": project_id, "title": title
    }).to_string();

    conn.execute(
        "INSERT INTO trash (id, item_type, item_name, item_data, project_id, deleted_at) VALUES (?1, 'note', ?2, ?3, ?4, ?5)",
        params![uuid::Uuid::new_v4().to_string(), title, data, project_id, now],
    ).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── File Reading Commands ──

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
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

// ── Trash Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct TrashItem {
    pub id: String,
    pub item_type: String,
    pub item_name: String,
    pub item_data: String,
    pub project_id: String,
    pub deleted_at: String,
}

#[tauri::command]
pub fn get_trash(state: State<'_, AppState>) -> Result<Vec<TrashItem>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare("SELECT id, item_type, item_name, item_data, project_id, deleted_at FROM trash ORDER BY deleted_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(TrashItem {
                id: row.get(0)?,
                item_type: row.get(1)?,
                item_name: row.get(2)?,
                item_data: row.get(3)?,
                project_id: row.get(4)?,
                deleted_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn restore_from_trash(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (item_type, item_data): (String, String) = conn
        .query_row("SELECT item_type, item_data FROM trash WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = serde_json::from_str(&item_data)
        .map_err(|e| format!("Failed to parse trash data: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    match item_type.as_str() {
        "secret" => {
            let _orig_id = data["id"].as_str().unwrap_or("");
            let category_id = data["category_id"].as_str().unwrap_or("");
            let name = data["name"].as_str().unwrap_or("");
            let masked = data["masked_preview"].as_str().unwrap_or("");
            let notes = data["notes"].as_str().unwrap_or("");
            let url = data["url"].as_str().unwrap_or("");

            // Re-insert with a new encrypted_value placeholder (original was deleted)
            let new_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO secrets (id, category_id, name, encrypted_value, masked_preview, notes, url, created_at, updated_at) VALUES (?1, ?2, ?3, X'', ?4, ?5, ?6, ?7, ?8)",
                params![new_id, category_id, name, masked, notes, url, now, now],
            ).map_err(|e| format!("Failed to restore secret: {}", e))?;
        }
        "note" => {
            let folder_id = data["folder_id"].as_str().unwrap_or("");
            let project_id = data["project_id"].as_str().unwrap_or("");
            let title = data["title"].as_str().unwrap_or("");

            let new_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO notes (id, folder_id, project_id, title, content, category, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, '{}', '', 0, ?5, ?6)",
                params![new_id, folder_id, project_id, title, now, now],
            ).map_err(|e| format!("Failed to restore note: {}", e))?;
        }
        "project" => {
            let project_id = data["id"].as_str().unwrap_or("");
            // Un-archive the project — data is still there
            conn.execute(
                "UPDATE projects SET is_archived = 0, is_open = 1 WHERE id = ?1",
                params![project_id],
            ).map_err(|e| format!("Failed to restore project: {}", e))?;
        }
        _ => {}
    }

    // Remove from trash
    conn.execute("DELETE FROM trash WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(item_type)
}

#[tauri::command]
pub fn permanently_delete_from_trash(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Check if it's a project — if so, permanently delete all its data
    let item = conn.query_row(
        "SELECT item_type, item_data FROM trash WHERE id = ?1",
        params![id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    );

    if let Ok((item_type, item_data)) = item {
        if item_type == "project" {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&item_data) {
                let project_id = data["id"].as_str().unwrap_or("");
                if !project_id.is_empty() {
                    let _ = conn.execute("DELETE FROM secrets WHERE category_id IN (SELECT id FROM secret_categories WHERE project_id = ?1)", params![project_id]);
                    let _ = conn.execute("DELETE FROM secret_categories WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM notes WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM note_folders WHERE project_id = ?1", params![project_id]);
                    // Clean up actual files from disk
                    if let Ok(app_data) = state.db.db_path.parent().ok_or("Invalid path") {
                        if let Ok(mut stmt) = conn.prepare("SELECT file_path, thumbnail_path FROM files WHERE project_id = ?1") {
                            if let Ok(paths) = stmt.query_map(params![project_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                                .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>()) {
                                for (fp, tp) in paths {
                                    let _ = std::fs::remove_file(app_data.join(&fp));
                                    if !tp.is_empty() { let _ = std::fs::remove_file(app_data.join(&tp)); }
                                }
                            }
                        }
                    }
                    let _ = conn.execute("DELETE FROM files WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM file_folders WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM todos WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM favorites WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM journal_entries WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM time_sessions WHERE project_id = ?1", params![project_id]);
                    let _ = conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id]);
                }
            }
        }
    }

    conn.execute("DELETE FROM trash WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn batch_delete_from_trash(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    for id in &ids {
        // Reuse project cleanup logic
        let item = conn.query_row(
            "SELECT item_type, item_data FROM trash WHERE id = ?1",
            params![id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );

        if let Ok((item_type, item_data)) = item {
            if item_type == "project" {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&item_data) {
                    let project_id = data["id"].as_str().unwrap_or("");
                    if !project_id.is_empty() {
                        let _ = conn.execute("DELETE FROM secrets WHERE category_id IN (SELECT id FROM secret_categories WHERE project_id = ?1)", params![project_id]);
                        let _ = conn.execute("DELETE FROM secret_categories WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM notes WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM note_folders WHERE project_id = ?1", params![project_id]);
                        if let Ok(app_data) = state.db.db_path.parent().ok_or("Invalid path") {
                            if let Ok(mut stmt) = conn.prepare("SELECT file_path, thumbnail_path FROM files WHERE project_id = ?1") {
                                if let Ok(paths) = stmt.query_map(params![project_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                                    .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>()) {
                                    for (fp, tp) in paths {
                                        let _ = std::fs::remove_file(app_data.join(&fp));
                                        if !tp.is_empty() { let _ = std::fs::remove_file(app_data.join(&tp)); }
                                    }
                                }
                            }
                        }
                        let _ = conn.execute("DELETE FROM files WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM file_folders WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM todos WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM favorites WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM journal_entries WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM time_sessions WHERE project_id = ?1", params![project_id]);
                        let _ = conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id]);
                    }
                }
            }
        }

        conn.execute("DELETE FROM trash WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn empty_trash(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Clean up project data for trashed projects before emptying
    let app_data = state.db.db_path.parent().ok_or("Invalid database path".to_string())?;
    if let Ok(mut stmt) = conn.prepare("SELECT item_type, item_data FROM trash") {
        if let Ok(items) = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>()) {
            for (item_type, item_data) in items {
                if item_type == "project" {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&item_data) {
                        let pid = data["id"].as_str().unwrap_or("");
                        if !pid.is_empty() {
                            // Clean up files on disk
                            if let Ok(mut fstmt) = conn.prepare("SELECT file_path, thumbnail_path FROM files WHERE project_id = ?1") {
                                if let Ok(paths) = fstmt.query_map(params![pid], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                                    .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>()) {
                                    for (fp, tp) in paths {
                                        let _ = std::fs::remove_file(app_data.join(&fp));
                                        if !tp.is_empty() { let _ = std::fs::remove_file(app_data.join(&tp)); }
                                    }
                                }
                            }
                            let _ = conn.execute("DELETE FROM files WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM secrets WHERE category_id IN (SELECT id FROM secret_categories WHERE project_id = ?1)", params![pid]);
                            let _ = conn.execute("DELETE FROM secret_categories WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM notes WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM note_folders WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM file_folders WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM todos WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM favorites WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM journal_entries WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM time_sessions WHERE project_id = ?1", params![pid]);
                            let _ = conn.execute("DELETE FROM projects WHERE id = ?1", params![pid]);
                        }
                    }
                }
            }
        }
    }

    conn.execute("DELETE FROM trash", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Todo Commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Todo {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub url: String,
    pub is_completed: bool,
    pub priority: String,
    pub kind: String,
    pub due_date: String,
    pub sort_order: i32,
    pub completed_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_todos(state: State<'_, AppState>, project_id: String) -> Result<Vec<Todo>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, description, url, is_completed, priority, kind, due_date, sort_order, completed_at, created_at, updated_at \
             FROM todos WHERE project_id = ?1 ORDER BY is_completed ASC, sort_order ASC, created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let todos = stmt
        .query_map(params![project_id], |row| {
            Ok(Todo {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                url: row.get(4)?,
                is_completed: row.get(5)?,
                priority: row.get(6)?,
                kind: row.get(7)?,
                due_date: row.get(8)?,
                sort_order: row.get(9)?,
                completed_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(todos)
}

#[tauri::command]
pub fn create_todo(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
    description: String,
    url: String,
    priority: String,
    kind: String,
    due_date: String,
) -> Result<Todo, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM todos WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO todos (id, project_id, title, description, url, priority, kind, due_date, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, project_id, title, description, url, priority, kind, due_date, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Todo {
        id,
        project_id,
        title,
        description,
        url,
        is_completed: false,
        priority,
        kind,
        due_date,
        sort_order: max_order + 1,
        completed_at: String::new(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn toggle_todo(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let is_completed: bool = conn
        .query_row("SELECT is_completed FROM todos WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let new_completed = !is_completed;
    let now = chrono::Utc::now().to_rfc3339();
    let completed_at = if new_completed { now.clone() } else { String::new() };

    conn.execute(
        "UPDATE todos SET is_completed = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
        params![new_completed, completed_at, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(new_completed)
}

#[tauri::command]
pub fn update_todo(
    state: State<'_, AppState>,
    id: String,
    title: String,
    description: String,
    url: String,
    priority: String,
    due_date: String,
) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE todos SET title = ?1, description = ?2, url = ?3, priority = ?4, due_date = ?5, updated_at = ?6 WHERE id = ?7",
        params![title, description, url, priority, due_date, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_todo(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (title, project_id): (String, String) = conn
        .query_row("SELECT title, project_id FROM todos WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": id, "title": title, "project_id": project_id }).to_string();
    move_to_trash(conn, "todo", &title, &data, &project_id)?;

    conn.execute("DELETE FROM todos WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn clear_completed_todos(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM todos WHERE project_id = ?1 AND is_completed = 1", params![project_id])
        .map_err(|e| e.to_string())?;

    Ok(())
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
pub async fn bluetooth_start_pairing(
    state: State<'_, AppState>,
) -> Result<crate::bluetooth::PairingInfo, String> {
    state.bluetooth.start_pairing().await
}

#[tauri::command]
pub async fn bluetooth_check_pairing(
    state: State<'_, AppState>,
) -> Result<Option<crate::bluetooth::PairedDevice>, String> {
    Ok(state.bluetooth.check_pairing_confirmed().await)
}

#[tauri::command]
pub async fn bluetooth_complete_pairing(
    state: State<'_, AppState>,
    name: String,
    address: String,
    ip: String,
) -> Result<(), String> {
    state
        .bluetooth
        .complete_pairing(crate::bluetooth::PairedDevice { name, address, ip })
        .await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_cancel_pairing(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.bluetooth.cancel_pairing().await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_unpair(state: State<'_, AppState>) -> Result<(), String> {
    state.bluetooth.unpair().await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_status(
    state: State<'_, AppState>,
) -> Result<crate::bluetooth::ProximityStatus, String> {
    Ok(state.bluetooth.get_status().await)
}

#[tauri::command]
pub async fn bluetooth_paired_device(
    state: State<'_, AppState>,
) -> Result<Option<crate::bluetooth::PairedDevice>, String> {
    Ok(state.bluetooth.get_paired_device().await)
}

#[tauri::command]
pub async fn bluetooth_set_sensitivity(
    state: State<'_, AppState>,
    threshold: i16,
) -> Result<(), String> {
    state.bluetooth.set_sensitivity(threshold).await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_get_sensitivity(
    state: State<'_, AppState>,
) -> Result<i16, String> {
    Ok(state.bluetooth.get_sensitivity().await)
}
