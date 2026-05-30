use crate::state::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Clone)]
pub struct LibraryEntry {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub entry_type: String,
    pub is_global: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

pub const ENTRY_TYPE_TEMPLATES: &[&str] = &[
    "Credentials",
    "Workflow",
    "Setup Guide",
    "Code Snippet",
    "Reference",
    "Checklist",
];

#[tauri::command]
pub fn get_library_entries(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<LibraryEntry>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Get global entries + entries linked to this project
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, content, entry_type, is_global, sort_order, created_at, updated_at \
             FROM library_entries \
             WHERE is_global = 1 OR project_id = ?1 \
             ORDER BY sort_order ASC, updated_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![project_id], |row| {
            Ok(LibraryEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                entry_type: row.get(4)?,
                is_global: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub fn create_library_entry(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
    entry_type: String,
    is_global: bool,
) -> Result<LibraryEntry, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM library_entries",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let pid = if is_global { String::new() } else { project_id.clone() };

    conn.execute(
        "INSERT INTO library_entries (id, project_id, title, content, entry_type, is_global, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, '{}', ?4, ?5, ?6, ?7, ?8)",
        params![id, pid, title, entry_type, is_global, max_order + 1, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(LibraryEntry {
        id,
        project_id: pid,
        title,
        content: "{}".to_string(),
        entry_type,
        is_global,
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_library_entry(
    state: State<'_, AppState>,
    id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE library_entries SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![title, content, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_library_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    conn.execute("DELETE FROM library_entries WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn search_library(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<LibraryEntry>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let search = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, content, entry_type, is_global, sort_order, created_at, updated_at \
             FROM library_entries WHERE title LIKE ?1 OR entry_type LIKE ?1 \
             ORDER BY updated_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![search], |row| {
            Ok(LibraryEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                entry_type: row.get(4)?,
                is_global: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}
