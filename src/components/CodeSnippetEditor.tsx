import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import { exportAsCode } from "../utils/exportItem";
import { IconCode } from "./Icons";

interface SnippetData {
  language: string;
  code: string;
  description: string;
}

interface CodeSnippetEditorProps {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
}

const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "Ruby",
  "C#", "PHP", "Swift", "Kotlin", "SQL", "Bash", "YAML", "JSON",
  "HTML", "CSS", "Dockerfile", "Terraform", "GraphQL", "Other",
];

function parseSnippet(content: string): SnippetData {
  try {
    const parsed = JSON.parse(content);
    if (parsed.code !== undefined) return { language: "", code: "", description: "", ...parsed };
  } catch {}
  return { language: "", code: "", description: "" };
}

export default function CodeSnippetEditor({ entry, onSaved, onDelete }: CodeSnippetEditorProps) {
  const [data, setData] = useState<SnippetData>(() => parseSnippet(entry.content));
  const [title, setTitle] = useState(entry.title);
  const [editing, setEditing] = useState(!data.code);
  const [copied, setCopied] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const parsed = parseSnippet(entry.content);
    setData(parsed);
    setTitle(entry.title);
  }, [entry.content, entry.title]);

  useEffect(() => {
    const parsed = parseSnippet(entry.content);
    setEditing(!parsed.code);
  }, [entry.id]);

  const autoSave = useCallback(
    (newTitle: string, newData: SnippetData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, newTitle, JSON.stringify(newData));
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [entry.id, onSaved],
  );

  const update = (updates: Partial<SnippetData>) => {
    const updated = { ...data, ...updates };
    setData(updated);
    autoSave(title, updated);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    await exportAsCode(title, data.code, data.language);
  };

  const lineCount = data.code.split("\n").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconCode size={18} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">Code Snippet</span>
          {data.language && <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] text-accent">{data.language}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`rounded px-3 py-1 text-[11px] transition-colors ${
              copied ? "bg-status-connected/20 text-status-connected" : "bg-bg-input text-text-secondary hover:text-accent"
            }`}
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button
            className="rounded px-2 py-1 text-[11px] text-text-secondary hover:text-accent"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            className={`rounded px-3 py-1 text-[11px] transition-colors ${
              editing ? "bg-accent text-bg-base" : "bg-bg-input text-text-secondary hover:text-accent"
            }`}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </button>
          <button className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl">
          {editing ? (
            <input
              className="mb-4 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
              value={title}
              onChange={(e) => { setTitle(e.target.value); autoSave(e.target.value, data); }}
              placeholder="Snippet name..."
            />
          ) : (
            <h2 className="mb-2 text-xl font-semibold text-text-primary">{title}</h2>
          )}

          {editing ? (
            <input
              className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
              value={data.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What does this snippet do?"
            />
          ) : data.description ? (
            <p className="mb-4 text-[13px] text-text-secondary">{data.description}</p>
          ) : null}

          {/* Language selector — edit only */}
          {editing && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
                    data.language === lang
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-text-dim hover:text-text-secondary"
                  }`}
                  onClick={() => update({ language: data.language === lang ? "" : lang })}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}

          {/* Code block */}
          <div className="overflow-hidden rounded-lg border border-border bg-bg-tabbar">
            <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
              <span className="text-[11px] text-text-muted">
                {data.language || "Code"} · {lineCount} line{lineCount !== 1 ? "s" : ""}
              </span>
              <button className={`text-[10px] ${copied ? "text-status-connected" : "text-text-dim hover:text-accent"}`} onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex">
              <div className="select-none border-r border-border px-3 py-3 text-right">
                {(data.code || " ").split("\n").map((_, i) => (
                  <div key={i} className="text-[13px] leading-[1.6] text-text-dim">{i + 1}</div>
                ))}
              </div>
              {editing ? (
                <textarea
                  className="flex-1 resize-none bg-transparent p-3 font-mono text-[13px] leading-[1.6] text-text-primary outline-none placeholder:text-text-dim"
                  value={data.code}
                  onChange={(e) => update({ code: e.target.value })}
                  placeholder="Paste or type your code here..."
                  spellCheck={false}
                />
              ) : (
                <pre className="flex-1 overflow-x-auto p-3 font-mono text-[13px] leading-[1.6] text-text-primary">
                  {data.code || "No code yet"}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
