import { useState, useEffect, useRef, useMemo } from "react";
import type { Project, SecretCategory, NoteFolder, FileFolder } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  categories: SecretCategory[];
  noteFolders: NoteFolder[];
  fileFolders: FileFolder[];
  onSelectProject: (id: string) => void;
  onSelectCategory: (id: string) => void;
  onSelectNoteFolder: (id: string) => void;
  onSelectFileFolder: (id: string) => void;
  onOpenSettings: () => void;
  onLockVault: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  projects,
  categories,
  noteFolders,
  fileFolders,
  onSelectProject,
  onSelectCategory,
  onSelectNoteFolder,
  onSelectFileFolder,
  onOpenSettings,
  onLockVault,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Projects
    projects.forEach((p) => {
      items.push({
        id: `project-${p.id}`,
        label: p.name,
        category: "Projects",
        action: () => onSelectProject(p.id),
      });
    });

    // Secret categories
    categories.forEach((c) => {
      items.push({
        id: `cat-${c.id}`,
        label: c.name,
        category: "Secrets",
        action: () => onSelectCategory(c.id),
      });
    });

    // Note Folders
    noteFolders.forEach((f) => {
      items.push({
        id: `notefolder-${f.id}`,
        label: f.name,
        category: "Notes",
        action: () => onSelectNoteFolder(f.id),
      });
    });

    // File folders
    fileFolders.forEach((f) => {
      items.push({
        id: `folder-${f.id}`,
        label: f.name,
        category: "Files",
        action: () => onSelectFileFolder(f.id),
      });
    });

    // Actions
    items.push({
      id: "action-settings",
      label: "Open Settings",
      category: "Actions",
      action: onOpenSettings,
    });
    items.push({
      id: "action-lock",
      label: "Lock Vault",
      category: "Actions",
      action: onLockVault,
    });

    return items;
  }, [projects, categories, noteFolders, fileFolders, onSelectProject, onSelectCategory, onSelectNoteFolder, onSelectFileFolder, onOpenSettings, onLockVault]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [query, allCommands]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group by category
  const grouped: Record<string, CommandItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="border-b border-border px-4 py-3">
          <input
            ref={inputRef}
            className="w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-dim"
            placeholder="Search projects, secrets, notes, files..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[350px] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-text-muted">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-text-dim">
                  {category}
                </div>
                {items.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      className={`flex w-full items-center px-4 py-2 text-left text-[13px] transition-colors ${
                        idx === selectedIndex
                          ? "bg-accent/10 text-accent"
                          : "text-text-primary hover:bg-bg-input"
                      }`}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-1.5 text-[10px] text-text-dim">
          <span className="mr-3">&#8593;&#8595; Navigate</span>
          <span className="mr-3">&#9166; Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
