export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  directory_path: string;
  platform: string;
  environment: string;
  repo_url: string;
  prod_url: string;
  dashboard_url: string;
  docs_url: string;
  ai_provider: string;
  ai_model: string;
  agent_framework: string;
  frontend_stack: string;
  backend_stack: string;
  database_stack: string;
  is_open: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  platform?: string;
  environment?: string;
  repo_url?: string;
  prod_url?: string;
  dashboard_url?: string;
  docs_url?: string;
  ai_provider?: string;
  ai_model?: string;
  agent_framework?: string;
  frontend_stack?: string;
  backend_stack?: string;
  database_stack?: string;
}

export interface SecretCategory {
  id: string;
  project_id: string;
  name: string;
  icon: string;
  is_builtin: boolean;
  is_hidden: boolean;
  sort_order: number;
}

export interface Secret {
  id: string;
  category_id: string;
  name: string;
  masked_preview: string;
  notes: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  folder_id: string;
  project_id: string;
  title: string;
  content: string;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteFolder {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  note_count: number;
}

export interface FileFolder {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  file_count: number;
}

export interface FileRecord {
  id: string;
  folder_id: string;
  project_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  is_encrypted: boolean;
  thumbnail_path: string;
  note_id: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  project_id: string;
  item_id: string;
  item_type: string;
  item_name: string;
  sort_order: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Todo {
  id: string;
  project_id: string;
  title: string;
  description: string;
  url: string;
  is_completed: boolean;
  priority: string;
  kind: string;
  due_date: string;
  sort_order: number;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryEntry {
  id: string;
  project_id: string;
  title: string;
  content: string;
  entry_type: string;
  is_global: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrashItem {
  id: string;
  item_type: string;
  item_name: string;
  item_data: string;
  project_id: string;
  deleted_at: string;
}

export interface JournalEntry {
  id: string;
  project_id: string;
  date: string;
  content: string;
  tags: string;
  time_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSession {
  id: string;
  project_id: string;
  journal_entry_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  is_running: boolean;
}

export interface ProjectSummary {
  total_entries: number;
  total_time_minutes: number;
  tags_summary: [string, number][];
  entries: JournalEntry[];
}


export type ViewState =
  | { view: "secrets"; categoryId: string }
  | { view: "notes"; noteFolderId: string }
  | { view: "note"; noteId: string }
  | { view: "files"; folderId: string }
  | { view: "settings" }
  | { view: "trash" }
  | { view: "dashboard" }
  | { view: "library"; focusEntryId?: string }
  | { view: "journal" }
  | { view: "credentials" }
  | { view: "libraryEntry"; entryId: string };

export type AppScreen = "loading" | "setup" | "login" | "main";

export type BluetoothStatus = "connected" | "weak" | "disconnected" | "not-configured";
