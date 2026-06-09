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
                description TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                directory_path TEXT DEFAULT '',
                platform TEXT DEFAULT '',
                environment TEXT DEFAULT '',
                repo_url TEXT DEFAULT '',
                prod_url TEXT DEFAULT '',
                dashboard_url TEXT DEFAULT '',
                docs_url TEXT DEFAULT '',
                ai_provider TEXT DEFAULT '',
                ai_model TEXT DEFAULT '',
                agent_framework TEXT DEFAULT '',
                frontend_stack TEXT DEFAULT '',
                backend_stack TEXT DEFAULT '',
                database_stack TEXT DEFAULT '',
                is_open INTEGER NOT NULL DEFAULT 1,
                is_archived INTEGER NOT NULL DEFAULT 0,
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
                url TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES secret_categories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS note_folders (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                url TEXT DEFAULT '',
                is_completed INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                due_date TEXT DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS library_entries (
                id TEXT PRIMARY KEY,
                project_id TEXT DEFAULT '',
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '{}',
                entry_type TEXT NOT NULL DEFAULT 'Reference',
                is_global INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                date TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                tags TEXT DEFAULT '',
                time_minutes INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS time_sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                journal_entry_id TEXT DEFAULT '',
                started_at TEXT NOT NULL,
                ended_at TEXT DEFAULT '',
                duration_minutes INTEGER NOT NULL DEFAULT 0,
                is_running INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS trash (
                id TEXT PRIMARY KEY,
                item_type TEXT NOT NULL,
                item_name TEXT NOT NULL,
                item_data TEXT NOT NULL,
                project_id TEXT DEFAULT '',
                deleted_at TEXT NOT NULL
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
        .map_err(|e| format!("Migration failed: {}", e))?;

        // Add folder_id to notes if it doesn't exist (migration for existing DBs)
        let _ = conn.execute_batch(
            "ALTER TABLE notes ADD COLUMN folder_id TEXT NOT NULL DEFAULT '';"
        );
        // Add url to secrets if it doesn't exist (migration for existing DBs)
        let _ = conn.execute_batch(
            "ALTER TABLE secrets ADD COLUMN url TEXT DEFAULT '';"
        );
        // Add description and url to todos if they don't exist (migration for existing DBs)
        let _ = conn.execute_batch(
            "ALTER TABLE todos ADD COLUMN description TEXT DEFAULT '';"
        );
        let _ = conn.execute_batch(
            "ALTER TABLE todos ADD COLUMN url TEXT DEFAULT '';"
        );
        // Add is_open and is_archived to projects if they don't exist
        let _ = conn.execute_batch(
            "ALTER TABLE projects ADD COLUMN is_open INTEGER NOT NULL DEFAULT 1;"
        );
        let _ = conn.execute_batch(
            "ALTER TABLE projects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;"
        );
        // Add project metadata columns
        for col in &["description", "platform", "environment", "repo_url", "prod_url", "dashboard_url", "docs_url", "ai_provider", "ai_model", "agent_framework", "frontend_stack", "backend_stack", "database_stack"] {
            let _ = conn.execute_batch(&format!("ALTER TABLE projects ADD COLUMN {} TEXT DEFAULT '';", col));
        }
        // Add kind to todos (task vs bug)
        let _ = conn.execute_batch(
            "ALTER TABLE todos ADD COLUMN kind TEXT NOT NULL DEFAULT 'task';"
        );

        Ok(())
    }

    fn seed_defaults(&self, conn: &Connection) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        let project_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO projects (id, name, icon, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, "My Project", "", 0, now, now],
        ).map_err(|e| format!("Failed to seed project: {}", e))?;

        // Default settings
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('lock_timeout', '30')",
            [],
        ).map_err(|e| format!("Failed to seed settings: {}", e))?;

        Ok(())
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn hex_encode_key(bytes: &[u8]) -> String {
    hex_encode(bytes)
}
