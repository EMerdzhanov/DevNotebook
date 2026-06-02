import { useState, useEffect, useCallback, useRef } from "react";
import type { JournalEntry, ProjectSummary } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

interface JournalViewProps {
  projectId: string;
  projectName: string;
}

const TAGS = ["accomplishment", "blocker", "decision", "learning", "bug-fix", "feature", "refactor"];

const TAG_COLORS: Record<string, string> = {
  accomplishment: "bg-status-connected/20 text-status-connected",
  blocker: "bg-status-disconnected/20 text-status-disconnected",
  decision: "bg-accent/20 text-accent",
  learning: "bg-blue-500/20 text-blue-400",
  "bug-fix": "bg-orange-500/20 text-orange-400",
  feature: "bg-green-500/20 text-green-400",
  refactor: "bg-purple-500/20 text-purple-400",
};

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function JournalView({ projectId, projectName }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const data = await api.getJournalEntries(projectId);
      setEntries(data);
    } catch (err) {
      console.error("Failed to load journal:", err);
    }
  }, [projectId]);

  const checkTimer = useCallback(async () => {
    try {
      const session = await api.getRunningTimer(projectId);
      if (session) {
        setTimerRunning(true);
        const start = new Date(session.started_at).getTime();
        setTimerElapsed(Math.floor((Date.now() - start) / 60000));
      } else {
        setTimerRunning(false);
        setTimerElapsed(0);
      }
    } catch (err) {
      console.error("Failed to check timer:", err);
    }
  }, [projectId]);

  useEffect(() => {
    loadEntries();
    checkTimer();
  }, [loadEntries, checkTimer]);

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerElapsed((e) => e + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleOpenToday = async () => {
    try {
      const entry = await api.getOrCreateTodayEntry(projectId);
      setActiveEntry(entry);
      await loadEntries();
    } catch (err) {
      console.error("Failed to open today:", err);
    }
  };

  const handleStartTimer = async () => {
    if (!activeEntry) {
      const entry = await api.getOrCreateTodayEntry(projectId);
      setActiveEntry(entry);
      await api.startTimer(projectId, entry.id);
    } else {
      await api.startTimer(projectId, activeEntry.id);
    }
    setTimerRunning(true);
    setTimerElapsed(0);
  };

  const handleStopTimer = async () => {
    await api.stopTimer(projectId);
    setTimerRunning(false);
    setTimerElapsed(0);
    await loadEntries();
    if (activeEntry) {
      const updated = await api.getOrCreateTodayEntry(projectId);
      setActiveEntry(updated);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteJournalEntry(id);
      if (activeEntry?.id === id) setActiveEntry(null);
      await loadEntries();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleShowSummary = async () => {
    try {
      const data = await api.getProjectSummary(projectId);
      setSummary(data);
      setShowSummary(true);
    } catch (err) {
      console.error("Failed to get summary:", err);
    }
  };

  return (
    <div className="flex h-full">
      {/* Entry list */}
      <div className="flex w-[280px] flex-col border-r border-border bg-bg-sidebar">
        <div className="border-b border-border-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium uppercase tracking-wider text-accent">
              Journal
            </span>
            <div className="flex gap-1.5">
              <button
                className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-bg-base hover:opacity-90"
                onClick={handleOpenToday}
              >
                Today
              </button>
              <button
                className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary hover:text-accent"
                onClick={handleShowSummary}
              >
                Summary
              </button>
            </div>
          </div>

          {/* Timer */}
          <div className="mt-2 flex items-center gap-2">
            <button
              className={`flex-1 rounded border py-1.5 text-center text-[11px] font-medium transition-colors ${
                timerRunning
                  ? "border-status-disconnected bg-status-disconnected/10 text-status-disconnected"
                  : "border-accent bg-accent/10 text-accent"
              }`}
              onClick={timerRunning ? handleStopTimer : handleStartTimer}
            >
              {timerRunning ? `Stop Timer (${formatTime(timerElapsed)})` : "Start Timer"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-text-dim">
              No entries yet. Click &quot;Today&quot; to start.
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.id}
                className={`flex w-full items-start gap-3 border-b border-border-subtle/50 px-4 py-3 text-left transition-colors ${
                  activeEntry?.id === entry.id ? "bg-bg-card" : "hover:bg-bg-card/50"
                }`}
                onClick={() => setActiveEntry(entry)}
                onContextMenu={(e) => { e.preventDefault(); setDeleteConfirm(entry.id); }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-text-primary">{entry.date}</div>
                  <div className="mt-0.5 text-[11px] text-text-dim">
                    {entry.time_minutes > 0 && <span>{formatTime(entry.time_minutes)} · </span>}
                    {entry.content ? `${entry.content.substring(0, 60)}${entry.content.length > 60 ? "..." : ""}` : "Empty entry"}
                  </div>
                  {entry.tags && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                        <span key={tag} className={`rounded-full px-1.5 py-0.5 text-[8px] ${TAG_COLORS[tag] || "bg-bg-input text-text-dim"}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="paper-texture flex flex-1 flex-col overflow-hidden">
        {activeEntry ? (
          <JournalEntryEditor
            entry={activeEntry}
            onSaved={loadEntries}
          />
        ) : showSummary && summary ? (
          <SummaryView summary={summary} projectName={projectName} onClose={() => setShowSummary(false)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="mb-2 text-[14px]">Select a journal entry or click &quot;Today&quot;</div>
              <div className="text-[12px] text-text-dim">Track your work, log decisions, and celebrate wins</div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Journal Entry"
        message="This will permanently delete this entry and its time records."
        onConfirm={() => { if (deleteConfirm) handleDelete(deleteConfirm); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ── Entry Editor ──

function extractTagsFromContent(content: string): string {
  const found = new Set<string>();
  for (const tag of TAGS) {
    if (content.includes(`[${tag}]`)) found.add(tag);
  }
  return Array.from(found).join(", ");
}

function JournalEntryEditor({ entry, onSaved }: { entry: JournalEntry; onSaved: () => void }) {
  const [content, setContent] = useState(entry.content);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(entry.content);
  }, [entry.id, entry.content]);

  const autoSave = useCallback(
    (newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const tags = extractTagsFromContent(newContent);
          await api.updateJournalEntry(entry.id, newContent, tags);
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [entry.id, onSaved],
  );

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const before = content.substring(0, start);
    const after = content.substring(start);

    // Add newline before if not at start and previous char isn't a newline
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const prefix = needsNewline ? "\n" : "";
    const insert = `${prefix}[${tag}] `;

    const newContent = before + insert + after;
    setContent(newContent);
    autoSave(newContent);

    // Move cursor after the inserted tag
    setTimeout(() => {
      const pos = start + insert.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Extract tags used in content for highlighting
  const usedTags = TAGS.filter((tag) => content.includes(`[${tag}]`));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <div className="text-[16px] font-semibold text-text-primary">{entry.date}</div>
          {entry.time_minutes > 0 && (
            <div className="mt-0.5 text-[11px] text-text-muted">
              Time logged: {formatTime(entry.time_minutes)}
            </div>
          )}
        </div>
      </div>

      {/* Tag insert buttons */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-6 py-2">
        <span className="mr-1 text-[10px] text-text-dim">Insert:</span>
        {TAGS.map((tag) => (
          <button
            key={tag}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] capitalize transition-colors ${
              usedTags.includes(tag)
                ? `${TAG_COLORS[tag] || "bg-bg-input text-text-primary"} border-transparent`
                : "border-border text-text-dim hover:text-text-secondary"
            }`}
            onClick={() => insertTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Content — synced overlay + textarea */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto px-6 py-4" id="journal-scroll">
          {/* Colored render layer */}
          <div
            className="pointer-events-none whitespace-pre-wrap break-words text-[14px] leading-relaxed"
            aria-hidden
          >
            {(content || " ").split("\n").map((line, i) => {
              const tagMatch = line.match(/^\[([^\]]+)\]/);
              if (tagMatch && TAGS.includes(tagMatch[1])) {
                const tag = tagMatch[1];
                const rest = line.substring(tagMatch[0].length);
                const colors = TAG_COLORS[tag] || "bg-bg-input text-text-dim";
                return (
                  <div key={i}>
                    <span className={`rounded px-1 py-0.5 text-[13px] font-medium ${colors}`}>[{tag}]</span>
                    <span className="text-text-primary">{rest}</span>
                  </div>
                );
              }
              return <div key={i} className="text-text-primary">{line || " "}</div>;
            })}
          </div>
        </div>
        {/* Invisible textarea on top for input + cursor */}
        <textarea
          ref={textareaRef}
          className="absolute inset-0 h-full w-full resize-none bg-transparent px-6 py-4 text-[14px] leading-relaxed text-transparent caret-accent outline-none"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            autoSave(e.target.value);
          }}
          onScroll={(e) => {
            const scrollEl = document.getElementById("journal-scroll");
            if (scrollEl) scrollEl.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
          }}
          placeholder=""
        />
        {!content && (
          <div className="pointer-events-none absolute left-6 top-4 text-[14px] text-text-dim">
            What did you work on today?
          </div>
        )}
      </div>
    </div>
  );
}


// ── Summary View ──

function SummaryView({ summary, projectName, onClose }: { summary: ProjectSummary; projectName: string; onClose: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Project Summary</h2>
            <p className="mt-1 text-[13px] text-text-muted">{projectName}</p>
          </div>
          <button className="rounded bg-bg-input px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-bg-card p-4">
            <div className="text-[24px] font-bold text-accent">{summary.total_entries}</div>
            <div className="text-[12px] text-text-muted">Journal Entries</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-card p-4">
            <div className="text-[24px] font-bold text-accent">{formatTime(summary.total_time_minutes)}</div>
            <div className="text-[12px] text-text-muted">Total Time</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-card p-4">
            <div className="text-[24px] font-bold text-accent">{summary.tags_summary.length}</div>
            <div className="text-[12px] text-text-muted">Unique Tags</div>
          </div>
        </div>

        {/* Tags breakdown */}
        {summary.tags_summary.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-[14px] font-medium text-text-primary">Activity Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {summary.tags_summary.map(([tag, count]) => (
                <div key={tag} className={`rounded-full px-3 py-1 text-[11px] ${TAG_COLORS[tag] || "bg-bg-input text-text-secondary"}`}>
                  {tag}: {count}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h3 className="mb-3 text-[14px] font-medium text-text-primary">Timeline</h3>
          <div className="space-y-3">
            {summary.entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-text-primary">{entry.date}</div>
                  {entry.time_minutes > 0 && (
                    <span className="text-[11px] text-text-muted">{formatTime(entry.time_minutes)}</span>
                  )}
                </div>
                {entry.tags && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entry.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className={`rounded-full px-1.5 py-0.5 text-[9px] ${TAG_COLORS[tag] || "bg-bg-input text-text-dim"}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {entry.content && (
                  <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                    {entry.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
