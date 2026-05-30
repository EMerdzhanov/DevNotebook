export interface Project {
  id: string;
  name: string;
  icon: string;
  directory_path: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

export type SidebarItem =
  | { type: "category"; data: SecretCategory }
  | { type: "note"; data: Note };

export type ViewState =
  | { view: "secrets"; categoryId: string }
  | { view: "notes"; noteFolderId: string }
  | { view: "note"; noteId: string }
  | { view: "files"; folderId: string }
  | { view: "settings" }
  | { view: "trash" };

export type AppScreen = "loading" | "setup" | "login" | "main";

export type BluetoothStatus = "connected" | "weak" | "disconnected" | "not-configured";
