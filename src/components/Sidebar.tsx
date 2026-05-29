import { useState, useEffect, useRef } from "react";
import type { SecretCategory, Note, FileFolder } from "../types";

interface SidebarProps {
  categories: SecretCategory[];
  notes: Note[];
  fileFolders: FileFolder[];
  activeCategoryId: string | null;
  activeNoteId: string | null;
  activeFolderId: string | null;
  availableTemplates: string[];
  availableFileFolderTemplates: string[];
  onSelectCategory: (id: string) => void;
  onSelectNote: (id: string) => void;
  onSelectFileFolder: (id: string) => void;
  onAddSection: (name: string) => void;
  onAddFileFolder: (name: string) => void;
  onCreateNote: (category: string) => void;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
}

export default function Sidebar({
  categories,
  notes,
  fileFolders,
  activeCategoryId,
  activeNoteId,
  activeFolderId,
  availableTemplates,
  availableFileFolderTemplates,
  onSelectCategory,
  onSelectNote,
  onSelectFileFolder,
  onAddSection,
  onAddFileFolder,
  onCreateNote,
  onOpenSettings,
  isSettingsActive,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [customInput, setCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setCustomInput(false);
        setCustomName("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (collapsed) {
    return (
      <div className="flex w-8 flex-col items-center border-r border-border-subtle bg-bg-sidebar py-3">
        <button
          className="text-[10px] text-text-dim hover:text-accent"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          &rsaquo;
        </button>
      </div>
    );
  }

  const noteCategories = ["Architecture", "Improvements", "Ideas"];
  const notesByCategory = noteCategories.reduce(
    (acc, cat) => {
      acc[cat] = notes.filter((n) => n.category === cat);
      return acc;
    },
    {} as Record<string, Note[]>,
  );

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
    <div className="flex w-[200px] flex-col border-r border-border-subtle bg-bg-sidebar">
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-1">
        <button
          className="text-[10px] text-text-dim hover:text-accent"
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
        >
          &lsaquo;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Secrets Section */}
        <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
          Secrets
        </div>
        {categories.length === 0 && !menuOpen && (
          <div className="px-4 py-2 text-[12px] text-text-dim">
            No sections yet
          </div>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`flex w-full items-center px-4 py-2 text-left text-[13px] transition-colors ${
              activeCategoryId === cat.id
                ? "border-l-2 border-accent bg-bg-card text-text-primary"
                : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}

        {/* Add Section button + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            className="w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-text-dim transition-colors hover:text-accent"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            + Add Section
          </button>

          {menuOpen && (
            <div className="absolute left-2 right-2 z-40 max-h-[300px] overflow-y-auto rounded border border-border bg-bg-card shadow-lg">
              {/* Builtin templates */}
              {availableTemplates.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Templates
                  </div>
                  {availableTemplates.map((name) => (
                    <button
                      key={name}
                      className="flex w-full items-center px-3 py-2 text-left text-[12px] text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary"
                      onClick={() => handleAddSection(name)}
                    >
                      {name}
                    </button>
                  ))}
                </>
              )}

              {/* Custom option */}
              <div className="border-t border-border-subtle">
                {!customInput ? (
                  <button
                    className="flex w-full items-center px-3 py-2 text-left text-[12px] text-accent transition-colors hover:bg-bg-input"
                    onClick={() => setCustomInput(true)}
                  >
                    + Custom Section
                  </button>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      className="flex-1 rounded border border-border bg-bg-input px-2 py-1 text-[12px] text-text-primary outline-none focus:border-accent"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCustomSubmit();
                        if (e.key === "Escape") {
                          setCustomInput(false);
                          setCustomName("");
                        }
                      }}
                      placeholder="Section name..."
                      autoFocus
                    />
                    <button
                      className="rounded bg-accent px-2 py-1 text-[11px] text-bg-base hover:opacity-90"
                      onClick={handleCustomSubmit}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
          >
            <span>{folder.name}</span>
            {folder.file_count > 0 && (
              <span className="rounded bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">
                {folder.file_count}
              </span>
            )}
          </button>
        ))}
        <div className="relative">
          <button
            className="w-full border-t border-border-subtle px-4 py-2 text-left text-[13px] text-text-dim transition-colors hover:text-accent"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
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
        </div>

        {/* Notes Section */}
        <div className="mt-5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
          Notes
        </div>
        {noteCategories.map((cat) => (
          <div key={cat}>
            <div className="px-4 py-1.5 text-[12px] text-text-muted">{cat}</div>
            {notesByCategory[cat]?.map((note) => (
              <button
                key={note.id}
                className={`flex w-full items-center px-6 py-1.5 text-left text-[12px] transition-colors ${
                  activeNoteId === note.id
                    ? "border-l-2 border-accent bg-bg-card text-text-primary"
                    : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => onSelectNote(note.id)}
              >
                {note.title}
              </button>
            ))}
            <button
              className="w-full px-6 py-1 text-left text-[11px] text-text-dim transition-colors hover:text-accent"
              onClick={() => onCreateNote(cat)}
            >
              + Add note
            </button>
          </div>
        ))}
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
    </div>
  );
}

// ── File Folder Menu ──

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-2 right-2 z-40 max-h-[250px] overflow-y-auto rounded border border-border bg-bg-card shadow-lg"
    >
      {suggestions.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Suggested
          </div>
          {suggestions.map((name) => (
            <button
              key={name}
              className="flex w-full items-center px-3 py-2 text-left text-[12px] text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary"
              onClick={() => onSelect(name)}
            >
              {name}
            </button>
          ))}
        </>
      )}
      <div className="border-t border-border-subtle">
        {!customInput ? (
          <button
            className="flex w-full items-center px-3 py-2 text-left text-[12px] text-accent transition-colors hover:bg-bg-input"
            onClick={() => setCustomInput(true)}
          >
            + Custom Folder
          </button>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <input
              className="flex-1 rounded border border-border bg-bg-input px-2 py-1 text-[12px] text-text-primary outline-none focus:border-accent"
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
              className="rounded bg-accent px-2 py-1 text-[11px] text-bg-base hover:opacity-90"
              onClick={() => customName.trim() && onSelect(customName.trim())}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
