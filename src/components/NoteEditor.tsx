import { useState, useEffect, useCallback, useRef } from "react";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { marked } from "marked";
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
import { Image } from "@tiptap/extension-image";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { common, createLowlight } from "lowlight";
import { FileCard } from "./FileCardExtension";
import * as api from "../hooks/useTauri";

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  projectId: string;
  initialTitle: string;
  initialContent: string;
}

export default function NoteEditor({
  noteId,
  projectId,
  initialTitle,
  initialContent,
}: NoteEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const titleValueRef = useRef(initialTitle);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setToolbarTick] = useState(0);

  const doSave = useCallback(
    (title: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateNote(noteId, title, content);
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [noteId],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: "Start writing...",
        }),
        CodeBlockLowlight.configure({
          lowlight,
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        Image,
        HorizontalRule,
        FileCard,
      ],
      content: parseContent(initialContent),
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        doSave(titleValueRef.current, json);
        setToolbarTick((t) => t + 1);
      },
      onSelectionUpdate: () => {
        setToolbarTick((t) => t + 1);
      },
      onTransaction: () => {
        setToolbarTick((t) => t + 1);
      },
      editorProps: {
        attributes: {
          class: "prose-editor outline-none min-h-[300px]",
        },
      },
    },
    [noteId],
  );

  useEffect(() => {
    titleValueRef.current = initialTitle;
    if (titleRef.current) {
      titleRef.current.value = initialTitle;
    }
  }, [initialTitle]);

  // Floating copy button for code blocks
  const [copyBtnPos, setCopyBtnPos] = useState<{ top: number; right: number; pre: HTMLPreElement } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const container = document.querySelector(".prose-editor");
    if (!container) return;

    const handleMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      const pre = target.closest("pre") as HTMLPreElement | null;
      if (pre) {
        const rect = pre.getBoundingClientRect();
        setCopyBtnPos({ top: rect.top + 3, right: window.innerWidth - rect.right + 8, pre });
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.relatedTarget as HTMLElement | null;
      if (!target?.closest("pre") && !target?.closest(".floating-code-copy")) {
        setCopyBtnPos(null);
        setCopyFeedback(false);
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseleave", handleMouseLeave as EventListener);
    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseleave", handleMouseLeave as EventListener);
    };
  }, [editor]);

  const handleTitleChange = (value: string) => {
    titleValueRef.current = value;
    const content = editor ? JSON.stringify(editor.getJSON()) : initialContent;
    doSave(value, content);
  };

  const handleAttachFile = async () => {
    if (!editor) return;

    try {
      const selected = await dialogOpen({
        multiple: true,
        title: "Attach files to note",
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];

      // Ensure a "Documents" file folder exists for this project
      let folders = await api.getFileFolders(projectId);
      let folder = folders.find((f) => f.name === "Documents");
      if (!folder) {
        folder = await api.createFileFolder(projectId, "Documents");
      }

      for (const filePath of paths) {
        const record = await api.addFile(projectId, folder.id, filePath, false);

        if (record.mime_type.startsWith("image/")) {
          // Insert as inline image
          const absPath = await api.getFilePath(record.id);
          editor
            .chain()
            .focus()
            .setImage({ src: `asset://localhost/${absPath}` })
            .run();
        } else {
          // Insert as file card
          editor
            .chain()
            .focus()
            .insertFileCard({
              fileId: record.id,
              filename: record.filename,
              mimeType: record.mime_type,
              sizeBytes: record.size_bytes,
            })
            .run();
        }
      }
    } catch (err) {
      console.error("Failed to attach file:", err);
    }
  };

  const handleImportMarkdown = async () => {
    if (!editor) return;

    try {
      const selected = await dialogOpen({
        multiple: false,
        title: "Import Markdown file",
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }],
      });
      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      let mdContent = await api.readTextFile(path);

      // If note title is empty, adopt leading # heading from markdown
      const currentTitle = titleValueRef.current.trim();
      if (!currentTitle || currentTitle === "Untitled") {
        const titleMatch = mdContent.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          const newTitle = titleMatch[1].trim();
          titleValueRef.current = newTitle;
          if (titleRef.current) titleRef.current.value = newTitle;
          // Remove the title line from content so it's not duplicated
          mdContent = mdContent.replace(/^#\s+.+\n*/, "");
        }
      }

      const html = await marked(mdContent);

      // Insert the converted content at current cursor position
      editor.chain().focus().insertContent(html).run();
    } catch (err) {
      console.error("Failed to import markdown:", err);
    }
  };

  return (
    <div className="paper-texture flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      {editor && (
        <EditorToolbar
          editor={editor}
          onAttach={handleAttachFile}
          onImportMd={handleImportMarkdown}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <input
          ref={titleRef}
          className="mb-4 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
          defaultValue={initialTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
        />

        <EditorContent editor={editor} />
      </div>

      {/* Floating copy button for code blocks */}
      {copyBtnPos && (
        <button
          className={`floating-code-copy fixed z-20 px-2 py-0.5 text-[10px] transition-colors ${
            copyFeedback
              ? "text-status-connected"
              : "text-text-dim hover:text-accent"
          }`}
          style={{ top: copyBtnPos.top, right: copyBtnPos.right }}
          onClick={() => {
            const code = copyBtnPos.pre.querySelector("code");
            navigator.clipboard.writeText(code?.textContent || copyBtnPos.pre.textContent || "");
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
          }}
          onMouseLeave={() => { setCopyBtnPos(null); setCopyFeedback(false); }}
        >
          {copyFeedback ? "Copied!" : "Copy"}
        </button>
      )}
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

// ── Toolbar ──

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>;
  onAttach: () => void;
  onImportMd: () => void;
}

function EditorToolbar({ editor, onAttach, onImportMd }: ToolbarProps) {
  if (!editor) return null;

  const btn = (
    label: string,
    action: () => void,
    isActive: boolean = false,
  ) => (
    <button
      type="button"
      className={`rounded px-2 py-1 text-[11px] transition-colors ${
        isActive
          ? "bg-accent/20 text-accent"
          : "text-text-secondary hover:bg-bg-input hover:text-text-primary"
      }`}
      onClick={action}
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-border px-4 py-1.5">
      {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
      {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
      <span className="mx-1 border-r border-border" />
      {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {btn("Strike", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
      {btn("Code", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"))}
      <span className="mx-1 border-r border-border" />
      {btn("Bullet", () => {
        if (editor.isActive("bulletList")) {
          editor.chain().focus().liftListItem("listItem").run();
        } else {
          editor.chain().focus().toggleBulletList().run();
        }
      }, editor.isActive("bulletList"))}
      {btn("Ordered", () => {
        if (editor.isActive("orderedList")) {
          editor.chain().focus().liftListItem("listItem").run();
        } else {
          editor.chain().focus().toggleOrderedList().run();
        }
      }, editor.isActive("orderedList"))}
      {btn("Task", () => {
        if (editor.isActive("taskList")) {
          editor.chain().focus().liftListItem("taskItem").run();
        } else {
          editor.chain().focus().toggleTaskList().run();
        }
      }, editor.isActive("taskList"))}
      <span className="mx-1 border-r border-border" />
      {btn("Code Block", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      {btn("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {btn("Divider", () => editor.chain().focus().setHorizontalRule().run())}
      {btn("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      <span className="mx-1 border-r border-border" />
      <button
        type="button"
        className="rounded border border-accent/50 px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent/20"
        onClick={onAttach}
        onMouseDown={(e) => e.preventDefault()}
      >
        Attach
      </button>
      <button
        type="button"
        className="rounded border border-accent/50 px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent/20"
        onClick={onImportMd}
        onMouseDown={(e) => e.preventDefault()}
      >
        Import .md
      </button>
    </div>
  );
}
