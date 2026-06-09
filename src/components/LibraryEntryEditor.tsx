import { useState, useEffect, useCallback, useRef } from "react";
import { useCodeBlockCopy } from "../hooks/useCodeBlockCopy";
import TableGridPicker from "./TableGridPicker";
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
import { exportAsMarkdown, tiptapJsonToMarkdown } from "../utils/exportItem";
import { LIBRARY_ICON_MAP, IconFile } from "./Icons";

const lowlight = createLowlight(common);

interface LibraryEntryEditorProps {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
}

function parseContent(content: string): Record<string, unknown> | string {
  if (!content || content === "{}") return "";
  try { return JSON.parse(content); } catch { return content; }
}

export default function LibraryEntryEditor({ entry, onSaved, onDelete }: LibraryEntryEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const titleValueRef = useRef(entry.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const doSave = useCallback(
    (title: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, title, content);
          onSaved();
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
          console.error("Auto-save failed:", err);
          setSaveStatus("idle");
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
        TableRow, TableCell, TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: parseContent(entry.content),
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        doSave(titleValueRef.current, json);
      },
      editorProps: {
        attributes: { class: "prose-editor outline-none min-h-[200px]" },
      },
    },
    [entry.id],
  );

  // Floating copy button for code blocks
  const { copyBtnPos, copyFeedback, handleCopy: handleCodeCopy, handleMouseLeave: handleCopyLeave } = useCodeBlockCopy(".prose-editor", [editor]);

  useEffect(() => {
    titleValueRef.current = entry.title;
    if (titleRef.current) titleRef.current.value = entry.title;
  }, [entry.title]);

  const handleTitleChange = (value: string) => {
    titleValueRef.current = value;
    const content = editor ? JSON.stringify(editor.getJSON()) : entry.content;
    doSave(value, content);
  };

  const handleExport = async () => {
    if (!editor) return;
    const json = JSON.stringify(editor.getJSON());
    const md = tiptapJsonToMarkdown(json);
    const t = titleValueRef.current || "Untitled";
    const content = t.trim() ? `# ${t}\n\n${md}` : md;
    await exportAsMarkdown(t, content);
  };

  const Icon = LIBRARY_ICON_MAP[entry.entry_type] || IconFile;

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
    <div className="paper-texture flex flex-1 flex-col overflow-hidden">
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
            <EntryTableButton editor={editor} />
          </div>
          <div className="flex gap-2">
            <button className="rounded px-2 py-1 text-[11px] text-text-secondary hover:text-accent" onClick={handleExport}>Export</button>
            <button className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input" onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-accent"><Icon size={16} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">{entry.entry_type}</span>
          <span className="text-[10px] text-text-dim">{entry.is_global ? "Global" : "Project-linked"}</span>
          {saveStatus !== "idle" && (
            <span className="text-[10px] text-text-dim">{saveStatus === "saving" ? "Saving..." : "Saved"}</span>
          )}
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

      {/* Floating copy button for code blocks */}
      {copyBtnPos && (
        <button
          className={`floating-code-copy fixed z-20 px-2 py-0.5 text-[10px] transition-colors ${
            copyFeedback ? "text-status-connected" : "text-text-dim hover:text-accent"
          }`}
          style={{ top: copyBtnPos.top, right: copyBtnPos.right }}
          onClick={handleCodeCopy}
          onMouseLeave={handleCopyLeave}
        >
          {copyFeedback ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

function EntryTableButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  if (!editor) return null;
  const isActive = editor.isActive("table");

  if (isActive) {
    return (
      <button type="button" className="rounded bg-accent/20 px-2 py-1 text-[11px] text-accent transition-colors"
        onClick={() => editor.chain().focus().deleteTable().run()} onMouseDown={(e) => e.preventDefault()}>Table</button>
    );
  }

  return (
    <div className="relative">
      <button type="button" className="rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary"
        onClick={() => setOpen(!open)} onMouseDown={(e) => e.preventDefault()}>Table</button>
      {open && (
        <TableGridPicker
          onInsert={(rows, cols) => editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
