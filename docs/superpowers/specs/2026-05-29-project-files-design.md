# Project File Attachments — Design Spec

Add file/document storage to DevNotebook projects. Users can store screenshots, configs, PDFs, and any other file type per-project, with optional per-file encryption. Files are also embeddable inline within TipTap notes.

## Storage Architecture

**Approach: Filesystem storage with DB metadata.**

Files are stored on disk in the app data directory. The SQLCipher database stores metadata only (filename, path, size, encryption flag, etc.). This keeps the DB lean and allows fast image previews without decryption overhead.

### Filesystem Layout

```
<app_data>/files/<project_id>/<file_id>-<filename>
<app_data>/files/<project_id>/thumbs/<file_id>.png
```

### Encryption

- **Plain files**: Written directly to disk.
- **Encrypted files**: AES-256-GCM encrypted with the vault's derived key before writing. Decrypted on read to a temp directory.
- **Thumbnails for encrypted images**: Also encrypted.
- User chooses per-file whether to encrypt. Default is plain.

### Size Limits

- Maximum 50MB per file. Reject files above this.
- Warning toast shown for files above 10MB.
- No limit on total files per project.

## Data Model

### New Tables

**file_folders**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK to projects |
| name | TEXT | Folder display name (e.g., "Screenshots", "Documents") |
| sort_order | INTEGER | Sidebar ordering |

**files**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| folder_id | TEXT | FK to file_folders |
| project_id | TEXT | FK to projects |
| filename | TEXT | Original filename |
| file_path | TEXT | Relative path within app data |
| mime_type | TEXT | MIME type (image/png, application/pdf, etc.) |
| size_bytes | INTEGER | File size in bytes |
| is_encrypted | INTEGER | 0 = plain, 1 = encrypted |
| thumbnail_path | TEXT | Relative path to thumbnail (nullable) |
| note_id | TEXT | FK to notes (nullable — set when embedded in a note) |
| created_at | TEXT | |
| updated_at | TEXT | |

## UI Integration

### Sidebar — Files Section

- New section between "Secrets" and "Notes"
- Same add-from-menu pattern as secrets: starts empty
- `+ Add Folder` button opens a menu with suggested folder names (Screenshots, Documents, Configs, Design, Keys) plus a custom name option
- Each folder shows file count badge
- Clicking a folder shows the file list view in the content area

### File List View (Content Area)

- **Grid/list toggle**: Grid shows thumbnails for images, file-type icons for others. List shows rows.
- **File card**: Filename, size, type icon, lock icon if encrypted.
- **Actions per file**: Open (OS default app), Export (save copy to user-chosen location), Encrypt/Decrypt toggle, Delete.
- **Drag-and-drop zone**: Top area of the view accepts dropped files.
- **`+ Add File` button**: Opens native file picker as alternative to drag-and-drop.

### Inline in Notes (TipTap)

- Drag a file onto the TipTap editor or use a toolbar "Attach" button.
- **Images**: Render inline as previews (using existing TipTap Image extension).
- **Non-image files**: Render as styled file cards (filename + icon + size), clickable to open.
- Files attached through notes also appear in the Files section, linked via `note_id`.

### Preview Support

- **Images** (png, jpg, gif, svg, webp): Inline preview + thumbnail in grid.
- **All other types**: File-type icon in grid (document, code, archive, video, etc.).

## Backend Commands

### File Folder CRUD

- `create_file_folder(project_id, name)` → FileFolderRecord
- `get_file_folders(project_id)` → Vec<FileFolderRecord>
- `delete_file_folder(id)` → deletes folder and all contained files from disk + DB

### File CRUD

- `add_file(project_id, folder_id, source_path, encrypt)` → FileRecord
  - Copies file from source path into app data directory
  - Generates thumbnail if image (using `image` crate, 200px wide)
  - If `encrypt` is true, encrypts file (and thumbnail) with vault key before writing
  - Returns metadata record
- `get_files(folder_id)` → Vec<FileRecord>
- `get_file_for_preview(file_id)` → String (absolute path)
  - For plain files: returns the path directly
  - For encrypted files: decrypts to temp directory, returns temp path
- `open_file(file_id)` → opens in OS default app via Tauri shell
- `delete_file(file_id)` → removes file + thumbnail from disk, deletes DB record
- `toggle_file_encryption(file_id)` → encrypts a plain file or decrypts an encrypted file in place
- `export_file(file_id, destination_path)` → copies/decrypts file to user-chosen location

### Note Integration

- `attach_file_to_note(file_id, note_id)` → sets note_id on file record
- `detach_file_from_note(file_id)` → clears note_id

### Drag-and-Drop

- Tauri v2 drag-and-drop API captures file paths dropped onto the window
- Frontend detects drop target (file list view vs. TipTap editor) and routes accordingly

## Thumbnail Generation

- **Rust `image` crate**: Resize images to 200px wide, maintain aspect ratio, save as PNG
- **Encrypted image thumbnails**: Encrypt the thumbnail with the same method as the source file
- **Non-image files**: No thumbnail generated; frontend uses file-type icons

## Temp File Cleanup

- Decrypted temp files are cleaned up on:
  - Vault lock (manual or Bluetooth auto-lock)
  - App close
  - After a 5-minute inactivity timer per temp file
- Temp directory: `<app_data>/tmp/`

## Verification Plan

1. Add a file via drag-and-drop → verify it appears in the folder, can be opened
2. Add an image → verify thumbnail generates, grid preview works
3. Mark a file as encrypted → verify file on disk is encrypted, can still open/preview
4. Toggle encryption off → verify file is decrypted back to plain
5. Embed an image in a TipTap note → verify inline preview renders
6. Attach a non-image file in a note → verify file card renders, clicking opens the file
7. Lock vault → verify temp decrypted files are cleaned up
8. Add a 40MB file → verify it works. Try a 60MB file → verify rejection
9. Delete a folder → verify all contained files are removed from disk
