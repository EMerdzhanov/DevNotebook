import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import { IconCheck } from "./Icons";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistData {
  items: ChecklistItem[];
}

interface ChecklistEditorProps {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
}

function newId() { return Math.random().toString(36).substring(2, 10); }

function parseChecklist(content: string): ChecklistData {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.items)) return parsed;
  } catch {}
  return { items: [] };
}

export default function ChecklistEditor({ entry, onSaved, onDelete }: ChecklistEditorProps) {
  const [data, setData] = useState<ChecklistData>(() => parseChecklist(entry.content));
  const [title, setTitle] = useState(entry.title);
  const [newItemText, setNewItemText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setData(parseChecklist(entry.content));
    setTitle(entry.title);
  }, [entry.id, entry.content, entry.title]);

  const autoSave = useCallback(
    (newTitle: string, newData: ChecklistData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, newTitle, JSON.stringify(newData));
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 500);
    },
    [entry.id, onSaved],
  );

  const toggleItem = (id: string) => {
    const updated = { items: data.items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i) };
    setData(updated);
    autoSave(title, updated);
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    const updated = { items: [...data.items, { id: newId(), text: newItemText.trim(), checked: false }] };
    setData(updated);
    setNewItemText("");
    autoSave(title, updated);
    inputRef.current?.focus();
  };

  const removeItem = (id: string) => {
    const updated = { items: data.items.filter((i) => i.id !== id) };
    setData(updated);
    autoSave(title, updated);
  };

  const updateItemText = (id: string, text: string) => {
    const updated = { items: data.items.map((i) => i.id === id ? { ...i, text } : i) };
    setData(updated);
    autoSave(title, updated);
  };

  const checked = data.items.filter((i) => i.checked).length;
  const total = data.items.length;
  const progress = total > 0 ? (checked / total) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconCheck size={18} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">Checklist</span>
        </div>
        <button className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input" onClick={onDelete}>Delete</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-lg">
          <input
            className="mb-2 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
            value={title}
            onChange={(e) => { setTitle(e.target.value); autoSave(e.target.value, data); }}
            placeholder="Checklist name..."
          />

          {/* Progress bar */}
          {total > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>{checked} of {total} complete</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Items */}
          {data.items.map((item) => (
            <div key={item.id} className="group mb-1 flex items-center gap-3 rounded px-2 py-1.5 hover:bg-bg-card/50">
              <button
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                  item.checked ? "border-accent bg-accent text-bg-base" : "border-text-dim hover:border-accent"
                }`}
                onClick={() => toggleItem(item.id)}
              >
                {item.checked && <span className="text-[11px]">✓</span>}
              </button>
              <input
                className={`flex-1 border-none bg-transparent text-[14px] outline-none ${
                  item.checked ? "text-text-dim line-through" : "text-text-primary"
                }`}
                value={item.text}
                onChange={(e) => updateItemText(item.id, e.target.value)}
              />
              <button
                className="text-[11px] text-text-dim opacity-0 hover:text-status-disconnected group-hover:opacity-100"
                onClick={() => removeItem(item.id)}
              >
                ×
              </button>
            </div>
          ))}

          {/* Add item */}
          <div className="mt-2 flex items-center gap-3 px-2">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-dashed border-text-dim">
              <span className="text-[10px] text-text-dim">+</span>
            </div>
            <input
              ref={inputRef}
              className="flex-1 border-none bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-dim"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder="Add item..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
