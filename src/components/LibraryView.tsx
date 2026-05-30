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
import type { LibraryEntry, Project } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

const lowlight = createLowlight(common);

const TYPE_ICONS: Record<string, string> = {
  Credentials: "🔐",
  Workflow: "⚡",
  "Setup Guide": "🛠️",
  "Code Snippet": "💻",
  Reference: "📚",
  Checklist: "✅",
};

const ENTRY_TYPES = ["Credentials", "Workflow", "Setup Guide", "Code Snippet", "Reference", "Checklist"];

export default function LibraryView() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeEntry, setActiveEntry] = useState<LibraryEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getAllProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    loadProjects();
  }, [loadEntries, loadProjects]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteLibraryEntry(id);
      if (activeEntry?.id === id) setActiveEntry(null);
      await loadEntries();
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  let filtered = entries;
  if (typeFilter) {
    filtered = filtered.filter((e) => e.entry_type === typeFilter);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - entry list */}
      <div className="flex w-[300px] flex-col border-r border-border bg-bg-sidebar">
        {/* Header */}
        <div className="border-b border-border-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium uppercase tracking-wider text-accent">
              Library
            </span>
            <button
              className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-bg-base hover:opacity-90"
              onClick={() => setShowNewModal(true)}
            >
              + New
            </button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="border-b border-border-subtle px-3 py-2">
          <input
            className="mb-2 w-full rounded border border-border bg-bg-input px-2.5 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
          />
          <div className="relative">
            <button
              className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-[11px] transition-colors ${
                typeFilter ? "border-accent text-accent" : "border-border bg-bg-input text-text-secondary"
              }`}
              onClick={() => setTypeDropOpen(!typeDropOpen)}
            >
              {typeFilter ? `${TYPE_ICONS[typeFilter] || "📄"} ${typeFilter}` : "All Types"}
              <span className="text-[9px] text-text-dim">▾</span>
            </button>
            {typeDropOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setTypeDropOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-border bg-bg-card py-1 shadow-lg">
                  <button
                    className={`flex w-full items-center px-3 py-1.5 text-left text-[11px] hover:bg-bg-input ${!typeFilter ? "text-accent" : "text-text-primary"}`}
                    onClick={() => { setTypeFilter(null); setTypeDropOpen(false); }}
                  >
                    All Types
                  </button>
                  {[...new Set(entries.map((e) => e.entry_type))].sort().map((type) => (
                    <button
                      key={type}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-bg-input ${typeFilter === type ? "text-accent" : "text-text-primary"}`}
                      onClick={() => { setTypeFilter(type); setTypeDropOpen(false); }}
                    >
                      <span>{TYPE_ICONS[type] || "📄"}</span> {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-text-dim">
              {searchQuery || typeFilter ? "No matching entries" : "No entries yet"}
            </div>
          ) : (
            filtered.map((entry) => (
              <button
                key={entry.id}
                className={`flex w-full items-start gap-3 border-b border-border-subtle/50 px-4 py-3 text-left transition-colors ${
                  activeEntry?.id === entry.id
                    ? "bg-bg-card"
                    : "hover:bg-bg-card/50"
                }`}
                onClick={() => setActiveEntry(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setDeleteConfirm(entry.id);
                }}
              >
                <span className="mt-0.5 text-[14px]">{TYPE_ICONS[entry.entry_type] || "📄"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-text-primary">{entry.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-dim">
                    <span>{entry.entry_type}</span>
                    <span>·</span>
                    <span>{entry.is_global ? "Global" : "Project"}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main content - editor */}
      <div className="paper-texture flex flex-1 flex-col overflow-hidden">
        {activeEntry ? (
          <LibraryEntryEditor
            key={activeEntry.id}
            entry={activeEntry}
            onSaved={loadEntries}
            onDelete={() => setDeleteConfirm(activeEntry.id)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-[40px] mb-3">📚</div>
              <div className="text-[14px]">Select an entry or create a new one</div>
            </div>
          </div>
        )}
      </div>

      {/* New entry modal */}
      {showNewModal && (
        <NewEntryModal
          projects={projects}
          onCreated={async (entry) => {
            setShowNewModal(false);
            await loadEntries();
            setActiveEntry(entry);
          }}
          onClose={() => setShowNewModal(false)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Library Entry"
        message="This will permanently delete this entry. This cannot be undone."
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ── Entry Editor ──

function LibraryEntryEditor({
  entry,
  onSaved,
  onDelete,
}: {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
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
          class: "prose-editor outline-none min-h-[300px]",
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

  // Toolbar
  const btn = (label: string, action: () => void, isActive = false) => (
    <button
      type="button"
      className={`rounded px-2 py-1 text-[11px] transition-colors ${
        isActive ? "bg-accent/20 text-accent" : "text-text-secondary hover:bg-bg-input hover:text-text-primary"
      }`}
      onClick={action}
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Toolbar */}
      {editor && (
        <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
          <div className="flex flex-wrap gap-0.5">
            {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
            {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
            <span className="mx-0.5 border-r border-border" />
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
          <button
            className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[16px]">{TYPE_ICONS[entry.entry_type] || "📄"}</span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">
            {entry.entry_type}
          </span>
          <span className="text-[10px] text-text-dim">
            {entry.is_global ? "Global" : "Project-linked"}
          </span>
        </div>
        <input
          ref={titleRef}
          className="mb-4 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
          defaultValue={entry.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Entry title..."
        />
        <EditorContent editor={editor} />
      </div>
    </>
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

// ── New Entry Modal ──

function NewEntryModal({
  projects,
  onCreated,
  onClose,
}: {
  projects: Project[];
  onCreated: (entry: LibraryEntry) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState("Reference");
  const [customType, setCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState("");
  const [isGlobal, setIsGlobal] = useState(true);
  const [projectId, setProjectId] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const pid = isGlobal ? "" : projectId;
      const entry = await api.createLibraryEntry(pid || "", title.trim(), entryType, isGlobal);
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
        className="w-[520px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
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
                <span className="text-[14px]">{TYPE_ICONS[type]}</span>
                {type}
              </button>
            ))}
          </div>
          <div className="mb-4">
            {!customType ? (
              <button
                className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-accent/40 px-3 py-2.5 text-left text-[12px] transition-colors hover:border-accent hover:bg-accent/5"
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
          <div className="mb-2 flex gap-2">
            <button
              className={`flex-1 rounded border px-3 py-2 text-[12px] transition-colors ${
                isGlobal ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-card text-text-secondary"
              }`}
              onClick={() => setIsGlobal(true)}
            >
              Global — all projects
            </button>
            <button
              className={`flex-1 rounded border px-3 py-2 text-[12px] transition-colors ${
                !isGlobal ? "border-accent bg-accent/10 text-text-primary" : "border-border bg-bg-card text-text-secondary"
              }`}
              onClick={() => setIsGlobal(false)}
            >
              Project-linked
            </button>
          </div>
          {!isGlobal && (
            <div className="mb-4">
              <select
                className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[12px] text-text-primary outline-none"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select project...</option>
                {projects.filter((p) => !p.is_archived).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary" onClick={onClose}>Cancel</button>
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
