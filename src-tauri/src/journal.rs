use crate::state::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Clone)]
pub struct JournalEntry {
    pub id: String,
    pub project_id: String,
    pub date: String,
    pub content: String,
    pub tags: String,
    pub time_minutes: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TimeSession {
    pub id: String,
    pub project_id: String,
    pub journal_entry_id: String,
    pub started_at: String,
    pub ended_at: String,
    pub duration_minutes: i32,
    pub is_running: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectSummary {
    pub total_entries: i32,
    pub total_time_minutes: i32,
    pub tags_summary: Vec<(String, i32)>,
    pub entries: Vec<JournalEntry>,
}

// ── Journal Entry Commands ──

#[tauri::command]
pub fn get_journal_entries(state: State<'_, AppState>, project_id: String) -> Result<Vec<JournalEntry>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, date, content, tags, time_minutes, created_at, updated_at \
             FROM journal_entries WHERE project_id = ?1 ORDER BY date DESC"
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![project_id], |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
                tags: row.get(4)?,
                time_minutes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub fn get_or_create_today_entry(state: State<'_, AppState>, project_id: String) -> Result<JournalEntry, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    // Check if today's entry exists
    let existing = conn.query_row(
        "SELECT id, project_id, date, content, tags, time_minutes, created_at, updated_at \
         FROM journal_entries WHERE project_id = ?1 AND date = ?2",
        params![project_id, today],
        |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
                tags: row.get(4)?,
                time_minutes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    );

    match existing {
        Ok(entry) => Ok(entry),
        Err(_) => {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO journal_entries (id, project_id, date, content, tags, time_minutes, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, '', '', 0, ?4, ?5)",
                params![id, project_id, today, now, now],
            ).map_err(|e| e.to_string())?;

            Ok(JournalEntry {
                id,
                project_id,
                date: today,
                content: String::new(),
                tags: String::new(),
                time_minutes: 0,
                created_at: now.clone(),
                updated_at: now,
            })
        }
    }
}

#[tauri::command]
pub fn update_journal_entry(
    state: State<'_, AppState>,
    id: String,
    content: String,
    tags: String,
) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE journal_entries SET content = ?1, tags = ?2, updated_at = ?3 WHERE id = ?4",
        params![content, tags, now, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_journal_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let (date, project_id): (String, String) = conn
        .query_row("SELECT date, project_id FROM journal_entries WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let data = serde_json::json!({ "id": id, "date": date, "project_id": project_id }).to_string();
    crate::commands::move_to_trash(conn, "journal", &format!("Journal {}", date), &data, &project_id)?;

    conn.execute("DELETE FROM time_sessions WHERE journal_entry_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM journal_entries WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Time Tracking Commands ──

#[tauri::command]
pub fn start_timer(state: State<'_, AppState>, project_id: String, journal_entry_id: String) -> Result<TimeSession, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    // Stop any running session first
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE time_sessions SET is_running = 0, ended_at = ?1 WHERE project_id = ?2 AND is_running = 1",
        params![now, project_id],
    ).map_err(|e| e.to_string())?;

    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO time_sessions (id, project_id, journal_entry_id, started_at, is_running) VALUES (?1, ?2, ?3, ?4, 1)",
        params![id, project_id, journal_entry_id, now],
    ).map_err(|e| e.to_string())?;

    Ok(TimeSession {
        id,
        project_id,
        journal_entry_id,
        started_at: now,
        ended_at: String::new(),
        duration_minutes: 0,
        is_running: true,
    })
}

#[tauri::command]
pub fn stop_timer(state: State<'_, AppState>, project_id: String) -> Result<Option<TimeSession>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Find running session
    let session = conn.query_row(
        "SELECT id, project_id, journal_entry_id, started_at FROM time_sessions WHERE project_id = ?1 AND is_running = 1",
        params![project_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)),
    );

    match session {
        Ok((id, pid, jid, started_at)) => {
            // Calculate duration
            let start = chrono::DateTime::parse_from_rfc3339(&started_at).map_err(|e| e.to_string())?;
            let end = chrono::DateTime::parse_from_rfc3339(&now).map_err(|e| e.to_string())?;
            let duration = (end - start).num_minutes() as i32;

            conn.execute(
                "UPDATE time_sessions SET is_running = 0, ended_at = ?1, duration_minutes = ?2 WHERE id = ?3",
                params![now, duration, id],
            ).map_err(|e| e.to_string())?;

            // Add duration to journal entry
            if !jid.is_empty() {
                conn.execute(
                    "UPDATE journal_entries SET time_minutes = time_minutes + ?1 WHERE id = ?2",
                    params![duration, jid],
                ).map_err(|e| e.to_string())?;
            }

            Ok(Some(TimeSession {
                id,
                project_id: pid,
                journal_entry_id: jid,
                started_at,
                ended_at: now,
                duration_minutes: duration,
                is_running: false,
            }))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn get_running_timer(state: State<'_, AppState>, project_id: String) -> Result<Option<TimeSession>, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let session = conn.query_row(
        "SELECT id, project_id, journal_entry_id, started_at, ended_at, duration_minutes, is_running \
         FROM time_sessions WHERE project_id = ?1 AND is_running = 1",
        params![project_id],
        |row| {
            Ok(TimeSession {
                id: row.get(0)?,
                project_id: row.get(1)?,
                journal_entry_id: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                duration_minutes: row.get(5)?,
                is_running: row.get(6)?,
            })
        },
    );

    match session {
        Ok(s) => Ok(Some(s)),
        Err(_) => Ok(None),
    }
}

// ── Summary ──

#[tauri::command]
pub fn get_project_summary(state: State<'_, AppState>, project_id: String) -> Result<ProjectSummary, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, date, content, tags, time_minutes, created_at, updated_at \
             FROM journal_entries WHERE project_id = ?1 ORDER BY date ASC"
        )
        .map_err(|e| e.to_string())?;

    let entries: Vec<JournalEntry> = stmt
        .query_map(params![project_id], |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
                tags: row.get(4)?,
                time_minutes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let total_entries = entries.len() as i32;
    let total_time_minutes: i32 = entries.iter().map(|e| e.time_minutes).sum();

    // Count tags
    let mut tag_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    for entry in &entries {
        for tag in entry.tags.split(',').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) {
            *tag_counts.entry(tag).or_insert(0) += 1;
        }
    }
    let mut tags_summary: Vec<(String, i32)> = tag_counts.into_iter().collect();
    tags_summary.sort_by(|a, b| b.1.cmp(&a.1));

    Ok(ProjectSummary {
        total_entries,
        total_time_minutes,
        tags_summary,
        entries,
    })
}
