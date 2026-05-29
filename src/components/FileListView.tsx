import { useState, useEffect, useCallback } from "react";
import { open as dialogOpen, save as dialogSave } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileRecord } from "../types";
import * as api from "../hooks/useTauri";

interface FileListViewProps {
  folderId: string;
  folderName: string;
  projectId: string;
}

const FILE_ICONS: Record<string, string> = {
  "image": "IMG",
  "application/pdf": "PDF",
  "text": "TXT",
  "application/json": "JSON",
  "application/zip": "ZIP",
  "application/gzip": "GZ",
  "video": "VID",
  "audio": "AUD",
};

function getFileIcon(mimeType: string): string {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(key) || mimeType === key) return icon;
  }
  return "FILE";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileListView({
  folderId,
  folderName,
  projectId,
}: FileListViewProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [gridView, setGridView] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const loadFiles = useCallback(async () => {
    try {
      const data = await api.getFiles(folderId);
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  }, [folderId]);

  useEffect(() => {
    loadFiles();
    setSelectedFileId(null);
    setPreviewFile(null);
  }, [loadFiles]);

  // Spacebar Quick Look
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && selectedFileId && !previewFile) {
        e.preventDefault();
        const file = files.find((f) => f.id === selectedFileId);
        if (file) setPreviewFile(file);
      } else if ((e.code === "Space" || e.code === "Escape") && previewFile) {
        e.preventDefault();
        setPreviewFile(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFileId, previewFile, files]);

  const handleAddFiles = async (paths: string[]) => {
    for (const path of paths) {
      try {
        await api.addFile(projectId, folderId, path, false);
      } catch (err) {
        console.error("Failed to add file:", err);
      }
    }
    await loadFiles();
  };

  const handlePickFiles = async () => {
    try {
      const selected = await dialogOpen({
        multiple: true,
        title: "Select files to add",
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await handleAddFiles(paths);
    } catch (err) {
      console.error("Failed to pick files:", err);
    }
  };

  const handleOpenFile = async (fileId: string) => {
    try {
      await api.openFile(fileId);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    try {
      const destination = await dialogSave({
        title: "Save file as",
        defaultPath: file.filename,
      });
      if (!destination) return;
      await api.exportFile(fileId, destination);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  const handleShareFile = async (fileId: string) => {
    try {
      await api.shareFile(fileId);
    } catch (err) {
      console.error("Failed to share file:", err);
    }
  };

  const handleToggleEncryption = async (fileId: string) => {
    try {
      await api.toggleFileEncryption(fileId);
      await loadFiles();
    } catch (err) {
      console.error("Failed to toggle encryption:", err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      await loadFiles();
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-lg font-medium text-text-primary">{folderName}</h3>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded border border-border">
            <button
              className={`px-2 py-1 text-[11px] ${gridView ? "bg-bg-input text-text-primary" : "text-text-muted"}`}
              onClick={() => setGridView(true)}
            >
              Grid
            </button>
            <button
              className={`px-2 py-1 text-[11px] ${!gridView ? "bg-bg-input text-text-primary" : "text-text-muted"}`}
              onClick={() => setGridView(false)}
            >
              List
            </button>
          </div>
          <button
            className="rounded border border-accent bg-bg-input px-3.5 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
            onClick={handlePickFiles}
          >
            + Add File
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="mb-2 text-[14px]">No files yet</div>
            <div className="text-[12px]">
              Drag and drop files here or click &quot;+ Add File&quot;
            </div>
          </div>
        ) : gridView ? (
          <div className="grid grid-cols-4 gap-3">
            {files.map((file) => (
              <FileGridCard
                key={file.id}
                file={file}
                isSelected={selectedFileId === file.id}
                onSelect={() => setSelectedFileId(file.id)}
                onOpen={() => handleOpenFile(file.id)}
                onDownload={() => handleDownloadFile(file.id)}
                onShare={() => handleShareFile(file.id)}
                onToggleEncrypt={() => handleToggleEncryption(file.id)}
                onDelete={() => handleDeleteFile(file.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <FileListRow
                key={file.id}
                file={file}
                isSelected={selectedFileId === file.id}
                onSelect={() => setSelectedFileId(file.id)}
                onOpen={() => handleOpenFile(file.id)}
                onDownload={() => handleDownloadFile(file.id)}
                onShare={() => handleShareFile(file.id)}
                onToggleEncrypt={() => handleToggleEncryption(file.id)}
                onDelete={() => handleDeleteFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Look preview */}
      {previewFile && (
        <QuickLookPreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onOpen={() => {
            handleOpenFile(previewFile.id);
            setPreviewFile(null);
          }}
          onDownload={() => handleDownloadFile(previewFile.id)}
          onShare={() => handleShareFile(previewFile.id)}
        />
      )}
    </div>
  );
}

// ── Grid Card ──

function FileGridCard({
  file,
  isSelected,
  onSelect,
  onOpen,
  onDownload,
  onShare,
  onToggleEncrypt,
  onDelete,
}: {
  file: FileRecord;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onShare: () => void;
  onToggleEncrypt: () => void;
  onDelete: () => void;
}) {
  const isImage = file.mime_type.startsWith("image/");
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [fullSrc, setFullSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;

    if (file.is_encrypted) {
      // For encrypted files, fetch the decrypted thumbnail path from backend
      api
        .getThumbnailPath(file.id)
        .then((path) => setThumbSrc(convertFileSrc(path)))
        .catch(() => setThumbSrc(null));
    } else if (file.thumbnail_path) {
      // For plain files, resolve the thumbnail path via the backend
      api
        .getThumbnailPath(file.id)
        .then((path) => setThumbSrc(convertFileSrc(path)))
        .catch(() => setThumbSrc(null));
    }

    // Also get the full file path for non-image preview fallback
    if (!file.is_encrypted) {
      api
        .getFilePath(file.id)
        .then((path) => setFullSrc(convertFileSrc(path)))
        .catch(() => setFullSrc(null));
    }
  }, [file.id, file.thumbnail_path, file.is_encrypted, isImage]);

  const previewSrc = thumbSrc || fullSrc;

  return (
    <div
      className={`group rounded-md border bg-bg-card transition-colors hover:border-accent/50 ${
        isSelected ? "border-accent ring-1 ring-accent/30" : "border-border"
      }`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {/* Preview area */}
      <div className="flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-t-md bg-bg-input">
        {isImage && previewSrc ? (
          <img
            src={previewSrc}
            alt={file.filename}
            className="h-full w-full object-cover"
            onError={() => {
              setThumbSrc(null);
              setFullSrc(null);
            }}
          />
        ) : (
          <span className="text-[24px] font-bold text-text-dim">
            {getFileIcon(file.mime_type)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1">
          {file.is_encrypted && (
            <span className="text-[10px] text-accent" title="Encrypted">
              🔒
            </span>
          )}
          <div className="truncate text-[12px] text-text-primary" title={file.filename}>
            {file.filename}
          </div>
        </div>
        <div className="mt-0.5 text-[10px] text-text-muted">
          {formatSize(file.size_bytes)}
        </div>
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex flex-wrap gap-1 border-t border-border-subtle px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Open</button>
        <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary" onClick={(e) => { e.stopPropagation(); onDownload(); }}>Save</button>
        <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-accent" onClick={(e) => { e.stopPropagation(); onShare(); }}>Share</button>
        <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-accent" onClick={(e) => { e.stopPropagation(); onToggleEncrypt(); }}>{file.is_encrypted ? "Decrypt" : "Encrypt"}</button>
        <button className="rounded px-1.5 py-0.5 text-[10px] text-status-disconnected hover:text-white" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
      </div>
    </div>
  );
}

// ── List Row ──

function FileListRow({
  file,
  isSelected,
  onSelect,
  onOpen,
  onDownload,
  onShare,
  onToggleEncrypt,
  onDelete,
}: {
  file: FileRecord;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onShare: () => void;
  onToggleEncrypt: () => void;
  onDelete: () => void;
}) {
  const isImage = file.mime_type.startsWith("image/");
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage || !file.thumbnail_path) return;
    api
      .getThumbnailPath(file.id)
      .then((path) => setThumbSrc(convertFileSrc(path)))
      .catch(() => setThumbSrc(null));
  }, [file.id, file.thumbnail_path, isImage]);

  return (
    <div
      className={`group flex cursor-pointer items-center justify-between rounded-md border bg-bg-card p-3 transition-colors hover:border-accent/50 ${
        isSelected ? "border-accent ring-1 ring-accent/30" : "border-border"
      }`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className="flex items-center gap-3">
        {isImage && thumbSrc ? (
          <img
            src={thumbSrc}
            alt={file.filename}
            className="h-9 w-9 rounded object-cover"
            onError={() => setThumbSrc(null)}
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded bg-bg-input text-[11px] font-bold text-text-dim">
            {getFileIcon(file.mime_type)}
          </span>
        )}
        <div>
          <div className="flex items-center gap-1.5">
            {file.is_encrypted && (
              <span className="text-[10px] text-accent">🔒</span>
            )}
            <span
              className="cursor-pointer text-[13px] text-text-primary hover:text-accent"
              onClick={onOpen}
            >
              {file.filename}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">
            {formatSize(file.size_bytes)} · {file.mime_type}
          </div>
        </div>
      </div>
      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Open</button>
        <button className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary" onClick={(e) => { e.stopPropagation(); onDownload(); }}>Save</button>
        <button className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary hover:text-accent" onClick={(e) => { e.stopPropagation(); onShare(); }}>Share</button>
        <button className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary hover:text-accent" onClick={(e) => { e.stopPropagation(); onToggleEncrypt(); }}>{file.is_encrypted ? "Decrypt" : "Encrypt"}</button>
        <button className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-status-disconnected hover:bg-status-disconnected hover:text-white" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
      </div>
    </div>
  );
}

// ── Quick Look Preview ──

function QuickLookPreview({
  file,
  onClose,
  onOpen,
  onDownload,
  onShare,
}: {
  file: FileRecord;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const isImage = file.mime_type.startsWith("image/");
  const isText = file.mime_type.startsWith("text/") || file.mime_type === "application/json";
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const path = await api.getFilePath(file.id);
        if (isImage) {
          setFileSrc(convertFileSrc(path));
        } else if (isText) {
          const src = convertFileSrc(path);
          const res = await fetch(src);
          const text = await res.text();
          setTextContent(text);
        }
      } catch (err) {
        console.error("Failed to load preview:", err);
      }
    };
    load();
  }, [file.id, isImage, isText]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] max-w-[85vw] flex-col overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            {file.is_encrypted && (
              <span className="text-[11px] text-accent">🔒</span>
            )}
            <span className="text-[13px] font-medium text-text-primary">
              {file.filename}
            </span>
            <span className="text-[11px] text-text-muted">
              {formatSize(file.size_bytes)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded bg-bg-input px-3 py-1 text-[11px] text-text-secondary hover:text-text-primary" onClick={onOpen}>Open</button>
            <button className="rounded bg-bg-input px-3 py-1 text-[11px] text-text-secondary hover:text-text-primary" onClick={onDownload}>Save As</button>
            <button className="rounded bg-bg-input px-3 py-1 text-[11px] text-text-secondary hover:text-accent" onClick={onShare}>Share</button>
            <button className="rounded px-2 py-1 text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-bg-tabbar p-4">
          {isImage && fileSrc ? (
            <img
              src={fileSrc}
              alt={file.filename}
              className="max-h-[75vh] max-w-full rounded object-contain"
            />
          ) : isText && textContent !== null ? (
            <pre className="max-h-[75vh] w-full overflow-auto rounded bg-bg-card p-4 font-mono text-[12px] leading-relaxed text-text-primary">
              {textContent}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-3 text-text-muted">
              <span className="text-[48px] font-bold text-text-dim">
                {getFileIcon(file.mime_type)}
              </span>
              <div className="text-[14px]">{file.filename}</div>
              <div className="text-[12px]">
                {file.mime_type} · {formatSize(file.size_bytes)}
              </div>
              <div className="mt-2 flex gap-2">
                <button className="rounded border border-accent px-4 py-2 text-[13px] text-accent hover:bg-accent hover:text-bg-base" onClick={onOpen}>Open</button>
                <button className="rounded border border-border px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary" onClick={onDownload}>Save As</button>
                <button className="rounded border border-border px-4 py-2 text-[13px] text-text-secondary hover:text-accent" onClick={onShare}>Share</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-1.5 text-center text-[10px] text-text-dim">
          Press Space or Esc to close
        </div>
      </div>
    </div>
  );
}
