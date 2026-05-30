import { useState, useRef, useCallback } from "react";
import type { SecretCategory, NoteFolder, FileFolder, Favorite } from "../types";

const SECTION_ICONS: Record<string, string> = {
  "API Keys": "🔑",
  "Passwords": "🔒",
  "Database": "🗄️",
  "OAuth Tokens": "🎟️",
  "SSH Keys": "🖥️",
  "Env Variables": "⚙️",
  "Certificates": "📜",
  "Webhooks": "🔗",
  "License Keys": "📋",
  "Service Accounts": "👤",
  "Personal Access Tokens": "🪙",
  "Encryption Keys": "🛡️",
};

const NOTE_ICONS: Record<string, string> = {
  "Architecture": "🏗️",
  "Improvements": "📈",
  "Ideas": "💡",
  "Meeting Notes": "📝",
  "API Docs": "📖",
  "Decisions": "⚖️",
};

const FOLDER_ICONS: Record<string, string> = {
  "Screenshots": "📸",
  "Documents": "📄",
  "Configs": "⚙️",
  "Design": "🎨",
  "Keys": "🔐",
};

interface SidebarProps {
  categories: SecretCategory[];
  noteFolders: NoteFolder[];
  fileFolders: FileFolder[];
  activeCategoryId: string | null;
  activeNoteFolderId: string | null;
  activeFolderId: string | null;
  availableTemplates: string[];
  availableNoteFolderTemplates: string[];
  availableFileFolderTemplates: string[];
  onSelectCategory: (id: string) => void;
  onSelectNoteFolder: (id: string) => void;
  onSelectFileFolder: (id: string) => void;
  onAddSection: (name: string) => void;
  onAddNoteFolder: (name: string) => void;
  onAddFileFolder: (name: string) => void;
  favorites: Favorite[];
  onQuickCopy: (categoryId: string) => void;
  onSelectFavorite: (fav: Favorite) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteNoteFolder: (id: string) => void;
  onDeleteFileFolder: (id: string) => void;
  onToggleFavorite: (itemId: string, itemType: string, itemName: string) => void;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
}

export default function Sidebar({
  categories,
  noteFolders,
  fileFolders,
  activeCategoryId,
  activeNoteFolderId,
  activeFolderId,
  availableTemplates,
  availableNoteFolderTemplates,
  availableFileFolderTemplates,
  onSelectCategory,
  onSelectNoteFolder,
  onSelectFileFolder,
  onAddSection,
  onAddNoteFolder,
  onAddFileFolder,
  favorites,
  onQuickCopy,
  onSelectFavorite,
  onDeleteCategory,
  onDeleteNoteFolder,
  onDeleteFileFolder,
  onToggleFavorite,
  onOpenSettings,
  isSettingsActive,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    items: { label: string; danger?: boolean; action: () => void }[];
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(150, Math.min(400, startWidth + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);
  const [customInput, setCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");

  if (collapsed) {
    return (
      <div className="flex w-8 flex-col items-center border-r border-border-subtle bg-bg-sidebar py-3">
        <button
          className="text-[12px] text-accent hover:text-accent/80"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          &rsaquo;
        </button>
      </div>
    );
  }

  const handleAddSection = (name: string) => {
    onAddSection(name);
    setMenuOpen(false);
    setCustomInput(false);
    setCustomName("");
  };

  const handleCustomSubmit = () => {
    if (customName.trim()) {
      handleAddSection(customName.trim());
    }
  };

  return (
    <div
      className="relative flex flex-col border-r border-border-subtle bg-bg-sidebar"
      style={{ width: sidebarWidth }}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Pinned/Favorites Section */}
        {favorites.length > 0 && (
          <>
            <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
              Pinned
            </div>
            {favorites.map((fav) => (
              <button
                key={fav.id}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[12px] text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => onSelectFavorite(fav)}
              >
                <span className="text-[9px] text-text-dim">
                  {fav.item_type === "secret" ? "KEY" : fav.item_type === "note" ? "DOC" : "FILE"}
                </span>
                <span className="truncate">{fav.item_name}</span>
              </button>
            ))}
            <div className="my-2 border-b border-border-subtle" />
          </>
        )}

        {/* Secrets Section */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            Secrets
          </span>
          <button
            className="text-[12px] text-accent hover:text-accent/80"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
          >
            &lsaquo;
          </button>
        </div>
        {categories.length === 0 && !menuOpen && (
          <div className="px-4 py-2 text-[12px] text-text-dim">
            No sections yet
          </div>
        )}
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`group/cat flex w-full items-center justify-between px-4 py-2 text-[13px] transition-colors cursor-pointer ${
              activeCategoryId === cat.id
                ? "border-l-2 border-accent bg-bg-card text-text-primary"
                : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => onSelectCategory(cat.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({
                x: e.clientX, y: e.clientY,
                items: [
                  { label: favorites.some(f => f.item_id === cat.id) ? "Unpin" : "Pin", action: () => onToggleFavorite(cat.id, "category", cat.name) },
                  { label: "Delete", danger: true, action: () => onDeleteCategory(cat.id) },
                ],
              });
            }}
          >
            <span>{cat.name}</span>
            <button
              className="rounded px-1 py-0.5 text-[10px] text-text-dim opacity-0 transition-opacity hover:text-accent group-hover/cat:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onQuickCopy(cat.id);
              }}
              title="Quick copy first secret"
            >
              Copy
            </button>
          </div>
        ))}

        {/* Add Section button */}
        <button
          className="w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-text-dim transition-colors hover:text-accent"
          onClick={() => setMenuOpen(true)}
        >
          + Add Section
        </button>

        {/* Add Section modal */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { setMenuOpen(false); setCustomInput(false); setCustomName(""); }}
          >
            <div
              className="w-[520px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-[13px] font-medium text-text-primary">Add Secret Section</span>
                <button
                  className="text-[14px] text-text-muted hover:text-text-primary"
                  onClick={() => { setMenuOpen(false); setCustomInput(false); setCustomName(""); }}
                >
                  &times;
                </button>
              </div>

              <div className="py-2">
                {availableTemplates.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 px-3 py-2">
                    {availableTemplates.map((name) => (
                      <button
                        key={name}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-card px-3 py-3 text-left transition-colors hover:border-accent/50 hover:bg-bg-input"
                        onClick={() => handleAddSection(name)}
                      >
                        <span className="text-[18px]">{SECTION_ICONS[name] || "📁"}</span>
                        <span className="text-[12px] text-text-secondary">{name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom option */}
                <div className="border-t border-border-subtle px-3 pt-3 pb-2">
                  {!customInput ? (
                    <button
                      className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-accent/40 px-3 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
                      onClick={() => setCustomInput(true)}
                    >
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded bg-accent/20 text-[12px] text-accent">+</span>
                      <span className="text-[12px] text-accent">Custom Section</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2.5 text-[12px] text-text-primary outline-none focus:border-accent"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCustomSubmit();
                          if (e.key === "Escape") { setCustomInput(false); setCustomName(""); }
                        }}
                        placeholder="Section name..."
                        autoFocus
                      />
                      <button
                        className="rounded-lg bg-accent px-3 py-2.5 text-[11px] font-medium text-bg-base hover:opacity-90"
                        onClick={handleCustomSubmit}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files Section */}
        <div className="mt-5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
          Files
        </div>
        {fileFolders.length === 0 && !fileMenuOpen && (
          <div className="px-4 py-2 text-[12px] text-text-dim">
            No folders yet
          </div>
        )}
        {fileFolders.map((folder) => (
          <button
            key={folder.id}
            className={`flex w-full items-center justify-between px-4 py-2 text-left text-[13px] transition-colors ${
              activeFolderId === folder.id
                ? "border-l-2 border-accent bg-bg-card text-text-primary"
                : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => onSelectFileFolder(folder.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({
                x: e.clientX, y: e.clientY,
                items: [
                  { label: "Delete Folder", danger: true, action: () => onDeleteFileFolder(folder.id) },
                ],
              });
            }}
          >
            <span>{folder.name}</span>
            {folder.file_count > 0 && (
              <span className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">
                {folder.file_count}
              </span>
            )}
          </button>
        ))}
        <button
          className="w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-text-dim transition-colors hover:text-accent"
          onClick={() => setFileMenuOpen(true)}
        >
          + Add Folder
        </button>
        {fileMenuOpen && (
          <FileFolderMenu
            suggestions={availableFileFolderTemplates}
            onSelect={(name) => {
              onAddFileFolder(name);
              setFileMenuOpen(false);
            }}
            onClose={() => setFileMenuOpen(false)}
          />
        )}

        {/* Notes Section */}
        <div className="mt-5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
          Notes
        </div>
        {noteFolders.length === 0 && !noteMenuOpen && (
          <div className="px-4 py-2 text-[12px] text-text-dim">
            No categories yet
          </div>
        )}
        {noteFolders.map((folder) => (
          <button
            key={folder.id}
            className={`flex w-full items-center justify-between px-4 py-2 text-left text-[13px] transition-colors ${
              activeNoteFolderId === folder.id
                ? "border-l-2 border-accent bg-bg-card text-text-primary"
                : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => onSelectNoteFolder(folder.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({
                x: e.clientX, y: e.clientY,
                items: [
                  { label: "Delete", danger: true, action: () => onDeleteNoteFolder(folder.id) },
                ],
              });
            }}
          >
            <span>{folder.name}</span>
            {folder.note_count > 0 && (
              <span className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">
                {folder.note_count}
              </span>
            )}
          </button>
        ))}
        <button
          className="w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-text-dim transition-colors hover:text-accent"
          onClick={() => setNoteMenuOpen(true)}
        >
          + Add Category
        </button>
        {noteMenuOpen && (
          <NoteFolderMenu
            suggestions={availableNoteFolderTemplates}
            onSelect={(name) => {
              onAddNoteFolder(name);
              setNoteMenuOpen(false);
            }}
            onClose={() => setNoteMenuOpen(false)}
          />
        )}
      </div>

      {/* Settings button */}
      <button
        className={`flex w-full items-center gap-2 border-t border-border-subtle px-4 py-3 text-left text-[13px] transition-colors ${
          isSettingsActive
            ? "bg-bg-card text-accent"
            : "text-text-muted hover:text-text-primary"
        }`}
        onClick={onOpenSettings}
      >
        Settings
      </button>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
        >
          <div
            className="fixed rounded border border-border bg-bg-card py-1 shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {ctxMenu.items.map((item, i) => (
              <button
                key={i}
                className={`flex w-full items-center px-4 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-input ${
                  item.danger ? "text-status-disconnected" : "text-text-primary"
                }`}
                onClick={() => {
                  item.action();
                  setCtxMenu(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// ── File Folder Menu ──

function NoteFolderMenu({
  suggestions,
  onSelect,
  onClose,
}: {
  suggestions: string[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [customInput, setCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-text-primary">Add Note Category</span>
          <button className="text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
        </div>

        <div className="py-2">
          {suggestions.length > 0 && (
            <div className="grid grid-cols-3 gap-2 px-3 py-2">
              {suggestions.map((name) => (
                <button
                  key={name}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-card px-3 py-3 text-left transition-colors hover:border-accent/50 hover:bg-bg-input"
                  onClick={() => onSelect(name)}
                >
                  <span className="text-[18px]">{NOTE_ICONS[name] || "📓"}</span>
                  <span className="text-[12px] text-text-secondary">{name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border-subtle px-3 pt-3 pb-2">
            {!customInput ? (
              <button
                className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-accent/40 px-3 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
                onClick={() => setCustomInput(true)}
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded bg-accent/20 text-[12px] text-accent">+</span>
                <span className="text-[12px] text-accent">Custom Category</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2.5 text-[12px] text-text-primary outline-none focus:border-accent"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customName.trim()) onSelect(customName.trim());
                    if (e.key === "Escape") onClose();
                  }}
                  placeholder="Category name..."
                  autoFocus
                />
                <button
                  className="rounded-lg bg-accent px-3 py-2.5 text-[11px] font-medium text-bg-base hover:opacity-90"
                  onClick={() => customName.trim() && onSelect(customName.trim())}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileFolderMenu({
  suggestions,
  onSelect,
  onClose,
}: {
  suggestions: string[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [customInput, setCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-text-primary">Add File Folder</span>
          <button className="text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
        </div>

        <div className="py-2">
          {suggestions.length > 0 && (
            <div className="grid grid-cols-3 gap-2 px-3 py-2">
              {suggestions.map((name) => (
                <button
                  key={name}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-card px-3 py-3 text-left transition-colors hover:border-accent/50 hover:bg-bg-input"
                  onClick={() => onSelect(name)}
                >
                  <span className="text-[18px]">{FOLDER_ICONS[name] || "📁"}</span>
                  <span className="text-[12px] text-text-secondary">{name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border-subtle px-3 pt-3 pb-2">
            {!customInput ? (
              <button
                className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-accent/40 px-3 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
                onClick={() => setCustomInput(true)}
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded bg-accent/20 text-[12px] text-accent">+</span>
                <span className="text-[12px] text-accent">Custom Folder</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2.5 text-[12px] text-text-primary outline-none focus:border-accent"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customName.trim()) onSelect(customName.trim());
                    if (e.key === "Escape") onClose();
                  }}
                  placeholder="Folder name..."
                  autoFocus
                />
                <button
                  className="rounded-lg bg-accent px-3 py-2.5 text-[11px] font-medium text-bg-base hover:opacity-90"
                  onClick={() => customName.trim() && onSelect(customName.trim())}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
