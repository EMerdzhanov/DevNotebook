use crate::state::AppState;
use rusqlite::params;
use serde::Serialize;
use tauri::State;

// ── Global Search ──

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub item_type: String,
    pub title: String,
    pub preview: String,
    pub project_id: String,
    pub project_name: String,
}

#[tauri::command]
pub fn global_search(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let search = format!("%{}%", query);
    let mut results: Vec<SearchResult> = Vec::new();

    // Search secrets
    if let Ok(mut stmt) = conn.prepare(
        "SELECT s.id, s.name, s.masked_preview, sc.project_id, p.name \
         FROM secrets s \
         JOIN secret_categories sc ON s.category_id = sc.id \
         JOIN projects p ON sc.project_id = p.id \
         WHERE s.name LIKE ?1 OR s.notes LIKE ?1 LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "secret".to_string(), title: row.get(1)?,
            preview: row.get(2)?, project_id: row.get(3)?, project_name: row.get(4)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Search notes
    if let Ok(mut stmt) = conn.prepare(
        "SELECT n.id, n.title, '', n.project_id, p.name \
         FROM notes n JOIN projects p ON n.project_id = p.id \
         WHERE n.title LIKE ?1 LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "note".to_string(), title: row.get(1)?,
            preview: row.get(2)?, project_id: row.get(3)?, project_name: row.get(4)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Search files
    if let Ok(mut stmt) = conn.prepare(
        "SELECT f.id, f.filename, f.mime_type, f.project_id, p.name \
         FROM files f JOIN projects p ON f.project_id = p.id \
         WHERE f.filename LIKE ?1 LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "file".to_string(), title: row.get(1)?,
            preview: row.get(2)?, project_id: row.get(3)?, project_name: row.get(4)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Search todos
    if let Ok(mut stmt) = conn.prepare(
        "SELECT t.id, t.title, t.description, t.project_id, p.name \
         FROM todos t JOIN projects p ON t.project_id = p.id \
         WHERE t.title LIKE ?1 OR t.description LIKE ?1 LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "todo".to_string(), title: row.get(1)?,
            preview: row.get::<_, String>(2).unwrap_or_default(), project_id: row.get(3)?, project_name: row.get(4)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Search library
    if let Ok(mut stmt) = conn.prepare(
        "SELECT id, title, entry_type, project_id, '' \
         FROM library_entries WHERE title LIKE ?1 LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "library".to_string(), title: row.get(1)?,
            preview: row.get(2)?, project_id: row.get::<_, String>(3).unwrap_or_default(), project_name: "Library".to_string(),
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Search journal
    if let Ok(mut stmt) = conn.prepare(
        "SELECT j.id, j.date, j.tags, j.project_id, p.name \
         FROM journal_entries j JOIN projects p ON j.project_id = p.id \
         WHERE j.content LIKE ?1 OR j.tags LIKE ?1 LIMIT 10"
    ) {
        if let Ok(rows) = stmt.query_map(params![search], |row| Ok(SearchResult {
            id: row.get(0)?, item_type: "journal".to_string(), title: format!("Journal {}", row.get::<_, String>(1).unwrap_or_default()),
            preview: row.get(2)?, project_id: row.get(3)?, project_name: row.get(4)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    Ok(results)
}

// ── All Credentials Overview ──

#[derive(Serialize, Clone)]
pub struct CredentialOverviewItem {
    pub id: String,
    pub name: String,
    pub masked_preview: String,
    pub url: String,
    pub category_name: String,
    pub category_id: String,
    pub project_id: String,
    pub project_name: String,
    pub source: String, // "secret" or "library"
    pub library_content: String, // for library credentials, the full JSON
}

#[tauri::command]
pub fn get_all_credentials(state: State<'_, AppState>) -> Result<Vec<CredentialOverviewItem>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let mut results: Vec<CredentialOverviewItem> = Vec::new();

    // Get all secrets from "Passwords" categories
    if let Ok(mut stmt) = conn.prepare(
        "SELECT s.id, s.name, s.masked_preview, s.url, sc.name, sc.id, sc.project_id, p.name \
         FROM secrets s \
         JOIN secret_categories sc ON s.category_id = sc.id \
         JOIN projects p ON sc.project_id = p.id \
         WHERE sc.name = 'Passwords' \
         ORDER BY p.name, s.name"
    ) {
        if let Ok(rows) = stmt.query_map([], |row| Ok(CredentialOverviewItem {
            id: row.get(0)?,
            name: row.get(1)?,
            masked_preview: row.get(2)?,
            url: row.get(3)?,
            category_name: row.get(4)?,
            category_id: row.get(5)?,
            project_id: row.get(6)?,
            project_name: row.get(7)?,
            source: "secret".to_string(),
            library_content: String::new(),
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    // Get all library Credentials entries
    if let Ok(mut stmt) = conn.prepare(
        "SELECT le.id, le.title, le.content, le.project_id, \
         COALESCE(p.name, 'Global') as project_name \
         FROM library_entries le \
         LEFT JOIN projects p ON le.project_id = p.id \
         WHERE le.entry_type = 'Credentials' \
         ORDER BY project_name, le.title"
    ) {
        if let Ok(rows) = stmt.query_map([], |row| Ok(CredentialOverviewItem {
            id: row.get(0)?,
            name: row.get(1)?,
            masked_preview: "Credential set".to_string(),
            url: String::new(),
            category_name: "Credentials".to_string(),
            category_id: String::new(),
            project_id: row.get::<_, String>(3).unwrap_or_default(),
            project_name: row.get(4)?,
            source: "library".to_string(),
            library_content: row.get(2)?,
        })) { results.extend(rows.filter_map(|r| r.ok())); }
    }

    Ok(results)
}

// ── Password Generator ──

#[tauri::command]
pub fn generate_password(length: usize, uppercase: bool, lowercase: bool, numbers: bool, symbols: bool) -> Result<String, String> {
    let mut charset = String::new();
    if uppercase { charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); }
    if lowercase { charset.push_str("abcdefghijklmnopqrstuvwxyz"); }
    if numbers { charset.push_str("0123456789"); }
    if symbols { charset.push_str("!@#$%^&*()-_=+[]{}|;:,.<>?"); }

    if charset.is_empty() {
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".to_string();
    }

    let chars: Vec<char> = charset.chars().collect();
    let len = if length < 8 { 16 } else { length };

    let password: String = (0..len)
        .map(|_| {
            let idx: usize = rand::random::<usize>() % chars.len();
            chars[idx]
        })
        .collect();

    Ok(password)
}

// ── Export/Backup ──

#[derive(Serialize)]
pub struct VaultExport {
    pub version: String,
    pub exported_at: String,
    pub projects: Vec<serde_json::Value>,
    pub secrets: Vec<serde_json::Value>,
    pub notes: Vec<serde_json::Value>,
    pub files_metadata: Vec<serde_json::Value>,
    pub todos: Vec<serde_json::Value>,
    pub library: Vec<serde_json::Value>,
    pub journal: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn export_vault(state: State<'_, AppState>) -> Result<String, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut export = VaultExport {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        projects: Vec::new(),
        secrets: Vec::new(),
        notes: Vec::new(),
        files_metadata: Vec::new(),
        todos: Vec::new(),
        library: Vec::new(),
        journal: Vec::new(),
    };

    // Export projects
    if let Ok(mut stmt) = conn.prepare("SELECT id, name, description, platform, environment FROM projects WHERE is_archived = 0") {
        if let Ok(rows) = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?, "platform": row.get::<_, String>(3)?,
            "environment": row.get::<_, String>(4)?,
        }))) { export.projects = rows.filter_map(|r| r.ok()).collect(); }
    }

    // Export secrets (metadata only, not values)
    if let Ok(mut stmt) = conn.prepare("SELECT s.id, s.name, s.masked_preview, sc.name as category FROM secrets s JOIN secret_categories sc ON s.category_id = sc.id") {
        if let Ok(rows) = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?,
            "preview": row.get::<_, String>(2)?, "category": row.get::<_, String>(3)?,
        }))) { export.secrets = rows.filter_map(|r| r.ok()).collect(); }
    }

    // Export notes
    if let Ok(mut stmt) = conn.prepare("SELECT id, title, content, project_id FROM notes") {
        if let Ok(rows) = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?,
            "content": row.get::<_, String>(2)?, "project_id": row.get::<_, String>(3)?,
        }))) { export.notes = rows.filter_map(|r| r.ok()).collect(); }
    }

    // Export todos
    if let Ok(mut stmt) = conn.prepare("SELECT id, title, description, priority, is_completed, project_id FROM todos") {
        if let Ok(rows) = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?, "priority": row.get::<_, String>(3)?,
            "completed": row.get::<_, bool>(4)?, "project_id": row.get::<_, String>(5)?,
        }))) { export.todos = rows.filter_map(|r| r.ok()).collect(); }
    }

    // Export library (strip credential content for security)
    if let Ok(mut stmt) = conn.prepare("SELECT id, title, content, entry_type, is_global, project_id FROM library_entries") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let entry_type: String = row.get(3)?;
            let content: String = if entry_type == "Credentials" {
                "{}".to_string()
            } else {
                row.get(2)?
            };
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?, "title": row.get::<_, String>(1)?,
                "content": content, "type": entry_type,
                "global": row.get::<_, bool>(4)?, "project_id": row.get::<_, String>(5)?,
            }))
        }) { export.library = rows.filter_map(|r| r.ok()).collect(); }
    }

    // Export journal
    if let Ok(mut stmt) = conn.prepare("SELECT id, date, content, tags, time_minutes, project_id FROM journal_entries") {
        if let Ok(rows) = stmt.query_map([], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "date": row.get::<_, String>(1)?,
            "content": row.get::<_, String>(2)?, "tags": row.get::<_, String>(3)?,
            "time": row.get::<_, i32>(4)?, "project_id": row.get::<_, String>(5)?,
        }))) { export.journal = rows.filter_map(|r| r.ok()).collect(); }
    }

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

// ── Export Vault to File ──

#[tauri::command]
pub fn export_vault_to_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let json = export_vault(state)?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

// ── Duplicate Project ──

#[tauri::command]
pub fn duplicate_project(state: State<'_, AppState>, source_id: String, new_name: String) -> Result<String, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let now = chrono::Utc::now().to_rfc3339();
    let new_id = uuid::Uuid::new_v4().to_string();

    // Copy project
    conn.execute(
        "INSERT INTO projects (id, name, description, platform, environment, repo_url, prod_url, dashboard_url, docs_url, ai_provider, ai_model, agent_framework, frontend_stack, backend_stack, database_stack, sort_order, created_at, updated_at) \
         SELECT ?1, ?2, description, platform, environment, repo_url, prod_url, dashboard_url, docs_url, ai_provider, ai_model, agent_framework, frontend_stack, backend_stack, database_stack, \
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects), ?3, ?4 FROM projects WHERE id = ?5",
        params![new_id, new_name, now, now, source_id],
    ).map_err(|e| e.to_string())?;

    // Copy secret categories
    if let Ok(mut stmt) = conn.prepare("SELECT id, name, icon, is_builtin, sort_order FROM secret_categories WHERE project_id = ?1") {
        if let Ok(cats) = stmt.query_map(params![source_id], |row| Ok((
            row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?,
            row.get::<_, bool>(3)?, row.get::<_, i32>(4)?,
        ))) {
            for cat in cats.filter_map(|r| r.ok()) {
                let cat_id = uuid::Uuid::new_v4().to_string();
                let _ = conn.execute(
                    "INSERT INTO secret_categories (id, project_id, name, icon, is_builtin, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![cat_id, new_id, cat.1, cat.2, cat.3, cat.4],
                );
            }
        }
    }

    // Copy note folders
    if let Ok(mut stmt) = conn.prepare("SELECT name, sort_order FROM note_folders WHERE project_id = ?1") {
        if let Ok(folders) = stmt.query_map(params![source_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))) {
            for folder in folders.filter_map(|r| r.ok()) {
                let fid = uuid::Uuid::new_v4().to_string();
                let _ = conn.execute(
                    "INSERT INTO note_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                    params![fid, new_id, folder.0, folder.1],
                );
            }
        }
    }

    // Copy file folders
    if let Ok(mut stmt) = conn.prepare("SELECT name, sort_order FROM file_folders WHERE project_id = ?1") {
        if let Ok(folders) = stmt.query_map(params![source_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))) {
            for folder in folders.filter_map(|r| r.ok()) {
                let fid = uuid::Uuid::new_v4().to_string();
                let _ = conn.execute(
                    "INSERT INTO file_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                    params![fid, new_id, folder.0, folder.1],
                );
            }
        }
    }

    Ok(new_id)
}

// ── Write Export File ──

#[tauri::command]
pub fn write_export_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ── Import .env ──

#[tauri::command]
pub fn parse_env_file(content: String) -> Result<Vec<(String, String)>, String> {
    let mut pairs = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') { continue; }
        if let Some(eq_pos) = trimmed.find('=') {
            let key = trimmed[..eq_pos].trim().to_string();
            let value = trimmed[eq_pos + 1..].trim().trim_matches('"').trim_matches('\'').to_string();
            if !key.is_empty() {
                pairs.push((key, value));
            }
        }
    }
    Ok(pairs)
}

// ── Auto-lock Settings ──

#[tauri::command]
pub fn get_auto_lock_timeout(state: State<'_, AppState>) -> Result<i32, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let timeout: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'auto_lock_minutes'", [], |row| row.get(0))
        .unwrap_or_else(|_| "0".to_string());

    timeout.parse::<i32>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_auto_lock_timeout(state: State<'_, AppState>, minutes: i32) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_lock_minutes', ?1)",
        params![minutes.to_string()],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ── Project Templates ──

#[derive(Serialize)]
pub struct ProjectTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub platform: String,
    pub secret_categories: Vec<String>,
    pub note_folders: Vec<String>,
    pub file_folders: Vec<String>,
}

#[tauri::command]
pub fn get_project_templates() -> Vec<ProjectTemplate> {
    vec![
        ProjectTemplate {
            id: "nextjs-vercel".to_string(),
            name: "Next.js + Vercel".to_string(),
            description: "Full-stack Next.js app deployed on Vercel".to_string(),
            platform: "Vercel".to_string(),
            secret_categories: vec!["API Keys".into(), "Env Variables".into(), "Database".into()],
            note_folders: vec!["Architecture".into(), "Ideas".into()],
            file_folders: vec!["Screenshots".into(), "Design".into()],
        },
        ProjectTemplate {
            id: "python-gcp".to_string(),
            name: "Python + GCP".to_string(),
            description: "Python backend on Google Cloud Platform".to_string(),
            platform: "GCP".to_string(),
            secret_categories: vec!["API Keys".into(), "Database".into(), "Service Accounts".into(), "Env Variables".into()],
            note_folders: vec!["Architecture".into(), "Improvements".into()],
            file_folders: vec!["Configs".into(), "Documents".into()],
        },
        ProjectTemplate {
            id: "rust-aws".to_string(),
            name: "Rust + AWS".to_string(),
            description: "Rust service deployed on AWS".to_string(),
            platform: "AWS".to_string(),
            secret_categories: vec!["API Keys".into(), "SSH Keys".into(), "Database".into(), "Certificates".into()],
            note_folders: vec!["Architecture".into(), "Decisions".into()],
            file_folders: vec!["Configs".into(), "Keys".into()],
        },
        ProjectTemplate {
            id: "mobile-app".to_string(),
            name: "Mobile App".to_string(),
            description: "iOS/Android mobile application".to_string(),
            platform: "Self-hosted".to_string(),
            secret_categories: vec!["API Keys".into(), "Passwords".into(), "Certificates".into()],
            note_folders: vec!["Architecture".into(), "Ideas".into(), "Meeting Notes".into()],
            file_folders: vec!["Screenshots".into(), "Design".into(), "Documents".into()],
        },
        ProjectTemplate {
            id: "ai-agent".to_string(),
            name: "AI Agent Project".to_string(),
            description: "AI/ML agent with API integrations".to_string(),
            platform: "".to_string(),
            secret_categories: vec!["API Keys".into(), "OAuth Tokens".into(), "Env Variables".into()],
            note_folders: vec!["Architecture".into(), "Improvements".into(), "Decisions".into()],
            file_folders: vec!["Configs".into(), "Documents".into()],
        },
    ]
}

#[tauri::command]
pub fn create_project_from_template(
    state: State<'_, AppState>,
    template_id: String,
    name: String,
) -> Result<String, String> {
    let templates = get_project_templates();
    let template = templates.iter().find(|t| t.id == template_id)
        .ok_or("Template not found")?;

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let now = chrono::Utc::now().to_rfc3339();
    let project_id = uuid::Uuid::new_v4().to_string();

    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM projects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO projects (id, name, description, platform, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![project_id, name, template.description, template.platform, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    // Create secret categories
    for (i, cat) in template.secret_categories.iter().enumerate() {
        let cat_id = uuid::Uuid::new_v4().to_string();
        let _ = conn.execute(
            "INSERT INTO secret_categories (id, project_id, name, is_builtin, sort_order) VALUES (?1, ?2, ?3, 0, ?4)",
            params![cat_id, project_id, cat, i as i32],
        );
    }

    // Create note folders
    for (i, folder) in template.note_folders.iter().enumerate() {
        let fid = uuid::Uuid::new_v4().to_string();
        let _ = conn.execute(
            "INSERT INTO note_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![fid, project_id, folder, i as i32],
        );
    }

    // Create file folders
    for (i, folder) in template.file_folders.iter().enumerate() {
        let fid = uuid::Uuid::new_v4().to_string();
        let _ = conn.execute(
            "INSERT INTO file_folders (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![fid, project_id, folder, i as i32],
        );
    }

    Ok(project_id)
}
