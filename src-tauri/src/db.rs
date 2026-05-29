use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Option<Connection>>,
    pub db_path: PathBuf,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            conn: Mutex::new(None),
            db_path,
        }
    }

    pub fn open(&self, key: &[u8]) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let hex_key = hex_encode(key);
        conn.pragma_update(None, "key", format!("x'{}'", hex_key))
            .map_err(|e| format!("Failed to set encryption key: {}", e))?;

        // Verify the key works by reading from the database
        conn.execute_batch("SELECT count(*) FROM sqlite_master;")
            .map_err(|_| "Invalid master password".to_string())?;

        self.run_migrations(&conn)?;

        let mut guard = self.conn.lock().map_err(|e| e.to_string())?;
        *guard = Some(conn);
        Ok(())
    }

    pub fn create_new(&self, key: &[u8]) -> Result<(), String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to create database: {}", e))?;

        let hex_key = hex_encode(key);
        conn.pragma_update(None, "key", format!("x'{}'", hex_key))
            .map_err(|e| format!("Failed to set encryption key: {}", e))?;

        self.run_migrations(&conn)?;
        self.seed_defaults(&conn)?;

        let mut guard = self.conn.lock().map_err(|e| e.to_string())?;
        *guard = Some(conn);
        Ok(())
    }

    pub fn close(&self) -> Result<(), String> {
        let mut guard = self.conn.lock().map_err(|e| e.to_string())?;
        *guard = None;
        Ok(())
    }

    pub fn exists(&self) -> bool {
        self.db_path.exists()
    }

    fn run_migrations(&self, conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '',
                directory_path TEXT DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS secret_categories (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                is_hidden INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS secrets (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL,
                name TEXT NOT NULL,
                encrypted_value BLOB NOT NULL,
                masked_preview TEXT NOT NULL DEFAULT '',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES secret_categories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '{}',
                category TEXT NOT NULL DEFAULT 'Ideas',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS file_folders (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT '',
                size_bytes INTEGER NOT NULL DEFAULT 0,
                is_encrypted INTEGER NOT NULL DEFAULT 0,
                thumbnail_path TEXT DEFAULT '',
                note_id TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS favorites (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS item_tags (
                item_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                PRIMARY KEY (item_id, tag_id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT '{}'
            );
            ",
        )
        .map_err(|e| format!("Migration failed: {}", e))
    }

    fn seed_defaults(&self, conn: &Connection) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        let project_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO projects (id, name, icon, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, "My Project", "", 0, now, now],
        ).map_err(|e| format!("Failed to seed project: {}", e))?;

        // Seed default note categories by creating one note per category
        for (i, category) in ["Architecture", "Improvements", "Ideas"].iter().enumerate() {
            let note_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO notes (id, project_id, title, content, category, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, '{}', ?4, ?5, ?6, ?7)",
                params![note_id, project_id, format!("{} Notes", category), category, i as i32, now, now],
            ).map_err(|e| format!("Failed to seed note: {}", e))?;
        }

        // Default settings
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('lock_timeout', '30')",
            [],
        ).map_err(|e| format!("Failed to seed settings: {}", e))?;

        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('bluetooth_device', '{}')",
            [],
        ).map_err(|e| format!("Failed to seed settings: {}", e))?;

        Ok(())
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
