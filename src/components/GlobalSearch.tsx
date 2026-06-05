import { useState, useEffect, useRef } from "react";
import * as api from "../hooks/useTauri";
import { IconKey, IconDoc, IconFolder, IconCheck, IconBookOpen, IconNote, IconFile } from "./Icons";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (itemType: string, itemId: string, projectId: string) => void;
}

const TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  secret: IconKey,
  note: IconDoc,
  file: IconFolder,
  todo: IconCheck,
  library: IconBookOpen,
  journal: IconNote,
};

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; item_type: string; title: string; preview: string; project_id: string; project_name: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.globalSearch(q);
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIndex]) {
      const r = results[selectedIndex];
      onNavigate(r.item_type, r.id, r.project_id);
      onClose();
    }
    else if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]" onClick={onClose}>
      <div className="w-[560px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-dim"
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Search everything — secrets, notes, files, todos, library..."
          />
          {loading && <span className="text-[10px] text-text-dim">Searching...</span>}
        </div>

        <div className="max-h-[400px] overflow-y-auto py-1">
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-6 text-center text-[13px] text-text-muted">No results found</div>
          )}
          {results.map((result, idx) => {
            const Icon = TYPE_ICONS[result.item_type] || IconFile;
            return (
              <button
                key={`${result.item_type}-${result.id}`}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === selectedIndex ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-input"
                }`}
                onClick={() => { onNavigate(result.item_type, result.id, result.project_id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="text-text-muted"><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{result.title}</div>
                  {result.preview && <div className="truncate text-[11px] text-text-dim">{result.preview}</div>}
                </div>
                <span className="text-[10px] text-text-dim">{result.project_name}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border px-4 py-1.5 text-[10px] text-text-dim">
          <span className="mr-3">↑↓ Navigate</span>
          <span className="mr-3">⏎ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
