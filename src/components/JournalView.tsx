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

function JournalEntryEditor({ entry, onSaved }: { entry: JournalEntry; onSaved: () => void }) {
  const [content, setContent] = useState(entry.content);
  const [tags, setTags] = useState(entry.tags);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(entry.content);
    setTags(entry.tags);
  }, [entry.id, entry.content, entry.tags]);

  const autoSave = useCallback(
    (newContent: string, newTags: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateJournalEntry(entry.id, newContent, newTags);
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [entry.id, onSaved],
  );

  const selectedTags = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    const newTags = next.join(", ");
    setTags(newTags);
    autoSave(content, newTags);
  };

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

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 border-b border-border px-6 py-2">
        {TAGS.map((tag) => (
          <button
            key={tag}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] capitalize transition-colors ${
              selectedTags.includes(tag)
                ? `${TAG_COLORS[tag] || "bg-bg-input text-text-primary"} border-transparent`
                : "border-border text-text-dim hover:text-text-secondary"
            }`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <textarea
          className="h-full w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-dim"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            autoSave(e.target.value, tags);
          }}
          placeholder="What did you work on today? Log accomplishments, decisions, blockers, learnings..."
        />
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
