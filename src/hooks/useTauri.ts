import { invoke } from "@tauri-apps/api/core";
import type { Project, SecretCategory, Secret, Note, NoteFolder, FileFolder, FileRecord, Favorite, Tag, Todo } from "../types";

// Auth
export const checkVaultExists = () => invoke<boolean>("check_vault_exists");
export const createVault = (password: string) =>
  invoke<void>("create_vault", { password });
export const unlockVault = (password: string) =>
  invoke<void>("unlock_vault", { password });
export const lockVault = () => invoke<void>("lock_vault");

// Projects
export const getProjects = () => invoke<Project[]>("get_projects");
export const createProject = (name: string) =>
  invoke<Project>("create_project", { name });
export const renameProject = (id: string, name: string) =>
  invoke<void>("rename_project", { id, name });
export const deleteProject = (id: string) =>
  invoke<void>("delete_project", { id });

// Secret Categories
export const getSecretCategories = (projectId: string) =>
  invoke<SecretCategory[]>("get_secret_categories", { projectId });
export const getBuiltinTemplates = (projectId: string) =>
  invoke<string[]>("get_builtin_templates", { projectId });
export const createSecretCategory = (projectId: string, name: string) =>
  invoke<SecretCategory>("create_secret_category", { projectId, name });
export const hideSecretCategory = (id: string) =>
  invoke<void>("hide_secret_category", { id });
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
export const cleanupTempFiles = () => invoke<void>("cleanup_temp_files");

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
export const searchByTag = (tagName: string) =>
  invoke<[string, string, string][]>("search_by_tag", { tagName });
