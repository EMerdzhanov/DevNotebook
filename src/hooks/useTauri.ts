import { invoke } from "@tauri-apps/api/core";
import type { Project, CreateProjectInput, SecretCategory, Secret, Note, NoteFolder, FileFolder, FileRecord, Favorite, Tag, Todo, LibraryEntry, TrashItem, JournalEntry, TimeSession, ProjectSummary } from "../types";

// Auth
export const checkVaultExists = () => invoke<boolean>("check_vault_exists");
export const createVault = (password: string) =>
  invoke<void>("create_vault", { password });
export const unlockVault = (password: string) =>
  invoke<void>("unlock_vault", { password });
export const lockVault = () => invoke<void>("lock_vault");

// Projects
export const getProjects = () => invoke<Project[]>("get_projects");
export const getAllProjects = () => invoke<Project[]>("get_all_projects");
export const createProject = (input: CreateProjectInput) =>
  invoke<Project>("create_project", { input });
export const renameProject = (id: string, name: string) =>
  invoke<void>("rename_project", { id, name });
export const updateProject = (id: string, input: CreateProjectInput) =>
  invoke<void>("update_project", { id, input });
export const closeProject = (id: string) =>
  invoke<void>("close_project", { id });
export const openProject = (id: string) =>
  invoke<void>("open_project", { id });
export const archiveProject = (id: string) =>
  invoke<void>("archive_project", { id });
export const deleteProject = (id: string) =>
  invoke<void>("delete_project", { id });

// Secret Categories
export const getSecretCategories = (projectId: string) =>
  invoke<SecretCategory[]>("get_secret_categories", { projectId });
export const getBuiltinTemplates = (projectId: string) =>
  invoke<string[]>("get_builtin_templates", { projectId });
export const createSecretCategory = (projectId: string, name: string) =>
  invoke<SecretCategory>("create_secret_category", { projectId, name });
export const deleteSecretCategory = (id: string) =>
  invoke<void>("delete_secret_category", { id });

// Secrets
export const getSecrets = (categoryId: string) =>
  invoke<Secret[]>("get_secrets", { categoryId });
export const createSecret = (
  categoryId: string,
  name: string,
  value: string,
  notes: string,
  url: string,
) => invoke<Secret>("create_secret", { categoryId, name, value, notes, url });
export const revealSecret = (id: string) =>
  invoke<string>("reveal_secret", { id });
export const updateSecret = (
  id: string,
  name: string,
  value: string,
  notes: string,
  url: string,
) => invoke<void>("update_secret", { id, name, value, notes, url });
export const deleteSecret = (id: string) =>
  invoke<void>("delete_secret", { id });

// Note Folders
export const getSuggestedNoteFolders = (projectId: string) =>
  invoke<string[]>("get_suggested_note_folders", { projectId });
export const createNoteFolder = (projectId: string, name: string) =>
  invoke<NoteFolder>("create_note_folder", { projectId, name });
export const getNoteFolders = (projectId: string) =>
  invoke<NoteFolder[]>("get_note_folders", { projectId });
export const deleteNoteFolder = (id: string) =>
  invoke<void>("delete_note_folder", { id });

// Notes
export const getNotes = (folderId: string) =>
  invoke<Note[]>("get_notes", { folderId });
export const createNote = (
  folderId: string,
  projectId: string,
  title: string,
) => invoke<Note>("create_note", { folderId, projectId, title });
export const updateNote = (id: string, title: string, content: string) =>
  invoke<void>("update_note", { id, title, content });
export const deleteNote = (id: string) => invoke<void>("delete_note", { id });
export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });

// File Folders
export const getSuggestedFileFolders = (projectId: string) =>
  invoke<string[]>("get_suggested_file_folders", { projectId });
export const createFileFolder = (projectId: string, name: string) =>
  invoke<FileFolder>("create_file_folder", { projectId, name });
export const getFileFolders = (projectId: string) =>
  invoke<FileFolder[]>("get_file_folders", { projectId });
export const deleteFileFolder = (id: string) =>
  invoke<void>("delete_file_folder", { id });

// Files
export const addFile = (
  projectId: string,
  folderId: string,
  sourcePath: string,
  encrypt: boolean,
) => invoke<FileRecord>("add_file", { projectId, folderId, sourcePath, encrypt });
export const getFiles = (folderId: string) =>
  invoke<FileRecord[]>("get_files", { folderId });
export const getFilePath = (fileId: string) =>
  invoke<string>("get_file_path", { fileId });
export const getThumbnailPath = (fileId: string) =>
  invoke<string>("get_thumbnail_path", { fileId });
export const deleteFile = (fileId: string) =>
  invoke<void>("delete_file", { fileId });
export const toggleFileEncryption = (fileId: string) =>
  invoke<boolean>("toggle_file_encryption", { fileId });
export const openFile = (fileId: string) =>
  invoke<void>("open_file", { fileId });
export const exportFile = (fileId: string, destination: string) =>
  invoke<void>("export_file", { fileId, destination });
export const shareFile = (fileId: string) =>
  invoke<void>("share_file", { fileId });

// Todos
export const getTodos = (projectId: string) =>
  invoke<Todo[]>("get_todos", { projectId });
export const createTodo = (projectId: string, title: string, description: string, url: string, priority: string, dueDate: string) =>
  invoke<Todo>("create_todo", { projectId, title, description, url, priority, dueDate });
export const toggleTodo = (id: string) =>
  invoke<boolean>("toggle_todo", { id });
export const updateTodo = (id: string, title: string, description: string, url: string, priority: string, dueDate: string) =>
  invoke<void>("update_todo", { id, title, description, url, priority, dueDate });
export const deleteTodo = (id: string) =>
  invoke<void>("delete_todo", { id });
export const clearCompletedTodos = (projectId: string) =>
  invoke<void>("clear_completed_todos", { projectId });

// Library
export const getLibraryEntries = (projectId: string) =>
  invoke<LibraryEntry[]>("get_library_entries", { projectId });
export const getAllLibraryEntries = () =>
  invoke<LibraryEntry[]>("get_all_library_entries");
export const createLibraryEntry = (projectId: string, title: string, entryType: string, isGlobal: boolean) =>
  invoke<LibraryEntry>("create_library_entry", { projectId, title, entryType, isGlobal });
export const updateLibraryEntry = (id: string, title: string, content: string) =>
  invoke<void>("update_library_entry", { id, title, content });
export const deleteLibraryEntry = (id: string) =>
  invoke<void>("delete_library_entry", { id });
export const searchLibrary = (query: string) =>
  invoke<LibraryEntry[]>("search_library", { query });

// Trash
export const getTrash = () => invoke<TrashItem[]>("get_trash");
export const restoreFromTrash = (id: string) => invoke<string>("restore_from_trash", { id });
export const permanentlyDeleteFromTrash = (id: string) => invoke<void>("permanently_delete_from_trash", { id });
export const batchDeleteFromTrash = (ids: string[]) => invoke<void>("batch_delete_from_trash", { ids });
export const emptyTrash = () => invoke<void>("empty_trash");

// Journal
export const getJournalEntries = (projectId: string) =>
  invoke<JournalEntry[]>("get_journal_entries", { projectId });
export const getOrCreateTodayEntry = (projectId: string) =>
  invoke<JournalEntry>("get_or_create_today_entry", { projectId });
export const updateJournalEntry = (id: string, content: string, tags: string) =>
  invoke<void>("update_journal_entry", { id, content, tags });
export const deleteJournalEntry = (id: string) =>
  invoke<void>("delete_journal_entry", { id });
export const startTimer = (projectId: string, journalEntryId: string) =>
  invoke<TimeSession>("start_timer", { projectId, journalEntryId });
export const stopTimer = (projectId: string) =>
  invoke<TimeSession | null>("stop_timer", { projectId });
export const getRunningTimer = (projectId: string) =>
  invoke<TimeSession | null>("get_running_timer", { projectId });
export const getProjectSummary = (projectId: string) =>
  invoke<ProjectSummary>("get_project_summary", { projectId });

// Credentials
export const encryptCredentialField = (value: string) =>
  invoke<string>("encrypt_credential_field", { value });
export const decryptCredentialField = (encryptedB64: string) =>
  invoke<string>("decrypt_credential_field", { encryptedB64 });
export const generateTotp = (encryptedSecretB64: string) =>
  invoke<{ code: string; remaining_seconds: number; period: number }>("generate_totp", { encryptedSecretB64 });
export const validateTotpSecret = (secret: string) =>
  invoke<boolean>("validate_totp_secret", { secret });

// Global Search
export const globalSearch = (query: string) =>
  invoke<{ id: string; item_type: string; title: string; preview: string; project_id: string; project_name: string }[]>("global_search", { query });

// Password Generator
export const generatePassword = (length: number, uppercase: boolean, lowercase: boolean, numbers: boolean, symbols: boolean) =>
  invoke<string>("generate_password", { length, uppercase, lowercase, numbers, symbols });

// Export
export const exportVault = () => invoke<string>("export_vault");

// Duplicate Project
export const duplicateProject = (sourceId: string, newName: string) =>
  invoke<string>("duplicate_project", { sourceId, newName });

// Import .env
export const parseEnvFile = (content: string) =>
  invoke<[string, string][]>("parse_env_file", { content });

// Auto-lock
export const getAutoLockTimeout = () => invoke<number>("get_auto_lock_timeout");
export const setAutoLockTimeout = (minutes: number) =>
  invoke<void>("set_auto_lock_timeout", { minutes });

// Project Templates
export const getProjectTemplates = () =>
  invoke<{ id: string; name: string; description: string; platform: string; secret_categories: string[]; note_folders: string[]; file_folders: string[] }[]>("get_project_templates");
export const createProjectFromTemplate = (templateId: string, name: string) =>
  invoke<string>("create_project_from_template", { templateId, name });

// Reorder
export const reorderItems = (table: string, ids: string[]) =>
  invoke<void>("reorder_items", { table, ids });

// Favorites
export const getFavorites = (projectId: string) =>
  invoke<Favorite[]>("get_favorites", { projectId });
export const toggleFavorite = (
  projectId: string,
  itemId: string,
  itemType: string,
  itemName: string,
) => invoke<boolean>("toggle_favorite", { projectId, itemId, itemType, itemName });

// Tags
export const getAllTags = () => invoke<Tag[]>("get_all_tags");
export const getItemTags = (itemId: string) =>
  invoke<Tag[]>("get_item_tags", { itemId });
export const addTagToItem = (itemId: string, itemType: string, tagName: string) =>
  invoke<Tag>("add_tag_to_item", { itemId, itemType, tagName });
export const removeTagFromItem = (itemId: string, tagId: string) =>
  invoke<void>("remove_tag_from_item", { itemId, tagId });
