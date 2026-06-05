import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import { LIBRARY_ICON_MAP, IconFile } from "./Icons";
import CredentialEditor from "./CredentialEditor";
import ChecklistEditor from "./ChecklistEditor";
import CodeSnippetEditor from "./CodeSnippetEditor";
import WorkflowEditor from "./WorkflowEditor";

const lowlight = createLowlight(common);

function LibIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = LIBRARY_ICON_MAP[type] || IconFile;
  return <Icon size={size} />;
}

interface LibraryPanelProps {
  projectId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

const ENTRY_TYPES = ["Credentials", "Workflow", "Setup Guide", "Code Snippet", "Reference", "Checklist"];

export default function LibraryPanel({ projectId, isOpen, onToggle }: LibraryPanelProps) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<LibraryEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "project" | "global">("global");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [panelHeight, setPanelHeight] = useState(400);
  const isResizing = useRef(false);

  const loadEntries = useCallback(async () => {
    try {
      if (searchQuery.trim()) {
        const results = await api.searchLibrary(searchQuery);
        setEntries(results);
      } else {
        const data = await api.getAllLibraryEntries();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteLibraryEntry(id);
      if (activeEntry?.id === id) setActiveEntry(null);
      await loadEntries();
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startY = e.clientY;
    const startHeight = panelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight - (e.clientY - startY)));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelHeight]);

  // Compute filtered entries
  const filteredEntries = entries
    .filter((e) => {
      if (scopeFilter === "project" && projectId) return e.project_id === projectId;
      if (scopeFilter === "global") return e.is_global;
      return true;
    })
    .filter((e) => !typeFilter || e.entry_type === typeFilter);

  // Collapsed bar
  if (!isOpen) {
    return (
      <button
        className="flex w-full items-center justify-between border-t border-border-subtle bg-bg-sidebar px-4 py-1.5"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-accent">&#9650;</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            Global Library
          </span>
          <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {filteredEntries.length}
          </span>
        </div>
        <span className="text-[10px] text-text-dim">Click to expand</span>
      </button>
    );
  }

  return (
    <div
      className="relative flex flex-col border-t border-border bg-bg-base"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 right-0 top-0 h-1 cursor-row-resize hover:bg-accent/30 active:bg-accent/50"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            Global Library
          </span>
          {activeEntry && (
            <button
              className="rounded bg-bg-input px-2 py-0.5 text-[11px] text-text-secondary hover:text-text-primary"
              onClick={() => setActiveEntry(null)}
            >
              &larr; Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!activeEntry && (
            <>
              <input
                className="w-48 rounded border border-border bg-bg-input px-2.5 py-1 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search library..."
              />
              <button
                className="rounded border border-accent bg-bg-input px-3 py-1 text-[11px] text-accent hover:bg-accent hover:text-bg-base"
                onClick={() => setShowNewModal(true)}
              >
                + New Entry
              </button>
            </>
          )}
          <button
            className="text-[12px] text-accent hover:text-accent/80"
            onClick={onToggle}
          >
            &#9660;
          </button>
        </div>
      </div>

      {/* Filters */}
      {!activeEntry && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
          {/* Scope filter */}
          <div className="flex gap-1">
            {(["project", "global", "all"] as const).map((scope) => (
              <button
                key={scope}
                className={`rounded-full px-2.5 py-0.5 text-[10px] capitalize transition-colors ${
                  scopeFilter === scope ? "bg-accent text-bg-base" : "bg-bg-input text-text-dim hover:text-text-secondary"
                }`}
                onClick={() => setScopeFilter(scope)}
              >
                {scope === "project" ? "This Project" : scope}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-border">|</span>
          {/* Type filter */}
          <div className="flex gap-1">
            <button
              className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                !typeFilter ? "bg-accent text-bg-base" : "bg-bg-input text-text-dim hover:text-text-secondary"
              }`}
              onClick={() => setTypeFilter(null)}
            >
              All
            </button>
            {ENTRY_TYPES.map((type) => {
              const count = entries.filter((e) => e.entry_type === type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                    typeFilter === type ? "bg-accent text-bg-base" : "bg-bg-input text-text-dim hover:text-text-secondary"
                  }`}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeEntry && activeEntry.entry_type === "Credentials" ? (
          <CredentialEditor
            entry={activeEntry}
            onSaved={loadEntries}
            onDelete={() => { handleDelete(activeEntry.id); }}
          />
        ) : activeEntry && activeEntry.entry_type === "Checklist" ? (
          <ChecklistEditor
            entry={activeEntry}
            onSaved={loadEntries}
            onDelete={() => { handleDelete(activeEntry.id); }}
          />
        ) : activeEntry && activeEntry.entry_type === "Code Snippet" ? (
          <CodeSnippetEditor
            entry={activeEntry}
            onSaved={loadEntries}
            onDelete={() => { handleDelete(activeEntry.id); }}
          />
        ) : activeEntry && activeEntry.entry_type === "Workflow" ? (
          <WorkflowEditor
            entry={activeEntry}
            onSaved={loadEntries}
            onDelete={() => { handleDelete(activeEntry.id); }}
          />
        ) : activeEntry ? (
          <LibraryEditor
            entry={activeEntry}
            onSaved={loadEntries}
          />
        ) : (
          <LibraryBrowse
            entries={filteredEntries}
            onSelect={setActiveEntry}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* New entry modal */}
      {showNewModal && projectId && (
        <NewEntryModal
          projectId={projectId}
          onCreated={async (entry) => {
            setShowNewModal(false);
            await loadEntries();
            setActiveEntry(entry);
          }}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}

// ── Browse View ──

function LibraryBrowse({
  entries,
  onSelect,
  onDelete,
}: {
  entries: LibraryEntry[];
  onSelect: (entry: LibraryEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-muted">
        No library entries yet. Click &quot;+ New Entry&quot; to create one.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="group cursor-pointer rounded-lg border border-border bg-bg-card p-4 transition-colors hover:border-accent/50"
          onClick={() => onSelect(entry)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[16px]"><LibIcon type={entry.entry_type} /></span>
              <div>
                <div className="text-[13px] font-medium text-text-primary">{entry.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                  <span>{entry.entry_type}</span>
                  <span>·</span>
                  <span>{entry.is_global ? "Global" : "Project"}</span>
                </div>
              </div>
            </div>
            <button
              className="text-[11px] text-text-dim opacity-0 hover:text-status-disconnected group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
              }}
            >
              ×
            </button>
          </div>
          <div className="mt-2 text-[11px] text-text-dim">
            Updated {new Date(entry.updated_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Editor View ──

function LibraryEditor({
  entry,
  onSaved,
}: {
  entry: LibraryEntry;
  onSaved: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const titleValueRef = useRef(entry.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    (title: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, title, content);
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [entry.id, onSaved],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        Placeholder.configure({ placeholder: "Start writing..." }),
        CodeBlockLowlight.configure({ lowlight }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: parseContent(entry.content),
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        doSave(titleValueRef.current, json);
      },
      editorProps: {
        attributes: {
          class: "prose-editor outline-none min-h-[200px]",
        },
      },
    },
    [entry.id],
  );

  useEffect(() => {
    titleValueRef.current = entry.title;
    if (titleRef.current) titleRef.current.value = entry.title;
  }, [entry.title]);

  const handleTitleChange = (value: string) => {
    titleValueRef.current = value;
    const content = editor ? JSON.stringify(editor.getJSON()) : entry.content;
    doSave(value, content);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mini toolbar */}
      {editor && <LibraryToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[14px]"><LibIcon type={entry.entry_type} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">
            {entry.entry_type}
          </span>
          <span className="text-[10px] text-text-dim">
            {entry.is_global ? "Global" : "Project-linked"}
          </span>
        </div>
        <input
          ref={titleRef}
          className="mb-3 w-full border-none bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-dim"
          defaultValue={entry.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Entry title..."
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function parseContent(content: string): Record<string, unknown> | string {
  if (!content || content === "{}") return "";
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

// ── Mini Toolbar ──

function LibraryToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btn = (label: string, action: () => void, isActive = false) => (
    <button
      type="button"
      className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
        isActive ? "bg-accent/20 text-accent" : "text-text-secondary hover:bg-bg-input hover:text-text-primary"
      }`}
      onClick={action}
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-border px-4 py-1">
      {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
      {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {btn("Code", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"))}
      <span className="mx-0.5 border-r border-border" />
      {btn("Bullet", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {btn("Ordered", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {btn("Task", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}
      <span className="mx-0.5 border-r border-border" />
      {btn("Code Block", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      {btn("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
    </div>
  );
}

// ── New Entry Modal ──

function NewEntryModal({
  projectId,
  onCreated,
  onClose,
}: {
  projectId: string;
  onCreated: (entry: LibraryEntry) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState("Reference");
  const [customType, setCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState("");
  const [isGlobal, setIsGlobal] = useState(true);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const entry = await api.createLibraryEntry(projectId, title.trim(), entryType, isGlobal);
      onCreated(entry);
    } catch (err) {
      console.error("Failed to create entry:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-text-primary">New Library Entry</span>
          <button className="text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
        </div>

        <div className="p-4">
          <label className="mb-1 block text-[12px] text-text-secondary">Title</label>
          <input
            className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="e.g., GCP VM Setup Guide"
            autoFocus
          />

          <label className="mb-1 block text-[12px] text-text-secondary">Type</label>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {ENTRY_TYPES.map((type) => (
              <button
                key={type}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[12px] transition-colors ${
                  entryType === type && !customType
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border bg-bg-card text-text-secondary hover:border-accent/50"
                }`}
                onClick={() => { setEntryType(type); setCustomType(false); }}
              >
                <span className="text-[14px]"><LibIcon type={type} /></span>
                {type}
              </button>
            ))}
          </div>
          <div className="mb-4">
            {!customType ? (
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/40 px-3 py-2.5 text-left text-[12px] transition-colors hover:border-accent hover:bg-accent/5"
                onClick={() => setCustomType(true)}
              >
                <span className="flex h-[20px] w-[20px] items-center justify-center rounded bg-accent/20 text-[11px] text-accent">+</span>
                <span className="text-accent">Custom Type</span>
              </button>
            ) : (
              <input
                className="w-full rounded-lg border border-accent bg-bg-input px-3 py-2.5 text-[12px] text-text-primary outline-none"
                value={customTypeName}
                onChange={(e) => { setCustomTypeName(e.target.value); setEntryType(e.target.value); }}
                placeholder="Enter custom type name..."
                autoFocus
              />
            )}
          </div>

          <label className="mb-1 block text-[12px] text-text-secondary">Scope</label>
          <div className="mb-5 flex gap-2">
            <button
              className={`flex-1 rounded border px-3 py-2 text-[12px] transition-colors ${
                isGlobal ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-card text-text-secondary"
              }`}
              onClick={() => setIsGlobal(true)}
            >
              Global — available in all projects
            </button>
            <button
              className={`flex-1 rounded border px-3 py-2 text-[12px] transition-colors ${
                !isGlobal ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-card text-text-secondary"
              }`}
              onClick={() => setIsGlobal(false)}
            >
              Project — only this project
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <button className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base hover:opacity-90 disabled:opacity-50"
              onClick={handleCreate}
              disabled={!title.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
