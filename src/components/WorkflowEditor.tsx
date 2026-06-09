import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import { exportAsMarkdown } from "../utils/exportItem";
import { IconBolt } from "./Icons";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  command: string;
}

interface WorkflowData {
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowEditorProps {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
}

function newId() { return Math.random().toString(36).substring(2, 10); }

function parseWorkflow(content: string): WorkflowData {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.steps)) return parsed;
  } catch {}
  return { description: "", steps: [] };
}

export default function WorkflowEditor({ entry, onSaved, onDelete }: WorkflowEditorProps) {
  const [data, setData] = useState<WorkflowData>(() => parseWorkflow(entry.content));
  const [title, setTitle] = useState(entry.title);
  const [editing, setEditing] = useState(!data.steps.length); // Start in edit if empty
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const parsed = parseWorkflow(entry.content);
    setData(parsed);
    setTitle(entry.title);
  }, [entry.content, entry.title]);

  // Only set initial editing state on entry switch
  useEffect(() => {
    const parsed = parseWorkflow(entry.content);
    setEditing(!parsed.steps.length);
  }, [entry.id]);

  const autoSave = useCallback(
    (newTitle: string, newData: WorkflowData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, newTitle, JSON.stringify(newData));
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

  const updateData = (updates: Partial<WorkflowData>) => {
    const updated = { ...data, ...updates };
    setData(updated);
    autoSave(title, updated);
  };

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    const updated = { ...data, steps: data.steps.map((s) => s.id === id ? { ...s, ...updates } : s) };
    setData(updated);
    autoSave(title, updated);
  };

  const addStep = () => {
    const step: WorkflowStep = { id: newId(), title: "", description: "", command: "" };
    updateData({ steps: [...data.steps, step] });
  };

  const removeStep = (id: string) => {
    updateData({ steps: data.steps.filter((s) => s.id !== id) });
  };

  const moveStep = (id: string, direction: -1 | 1) => {
    const idx = data.steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= data.steps.length) return;
    const steps = [...data.steps];
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    updateData({ steps });
  };

  const handleExport = async () => {
    const lines: string[] = [];
    lines.push(`# ${title}`);
    if (data.description) lines.push("", data.description);
    lines.push("");
    data.steps.forEach((step, idx) => {
      lines.push(`## ${idx + 1}. ${step.title || `Step ${idx + 1}`}`);
      if (step.description) lines.push("", step.description);
      if (step.command) lines.push("", "```", step.command, "```");
      lines.push("");
    });
    await exportAsMarkdown(title, lines.join("\n"));
  };

  const [copied, setCopied] = useState<string | null>(null);
  const copyCmd = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconBolt size={18} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">Workflow</span>
          <span className="text-[10px] text-text-dim">{data.steps.length} step{data.steps.length !== 1 ? "s" : ""}</span>
          {saveStatus !== "idle" && (
            <span className="text-[10px] text-text-dim">{saveStatus === "saving" ? "Saving..." : "Saved"}</span>
          )}
        </div>
        <div className="flex gap-2">
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
        <div className="mx-auto max-w-2xl">
          {editing ? (
            <input
              className="mb-2 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
              value={title}
              onChange={(e) => { setTitle(e.target.value); autoSave(e.target.value, data); }}
              placeholder="Workflow name..."
            />
          ) : (
            <h2 className="mb-2 text-xl font-semibold text-text-primary">{title}</h2>
          )}

          {editing ? (
            <input
              className="mb-6 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
              value={data.description}
              onChange={(e) => updateData({ description: e.target.value })}
              placeholder="Brief description of this workflow..."
            />
          ) : data.description ? (
            <p className="mb-6 text-[13px] text-text-secondary">{data.description}</p>
          ) : null}

          {/* Steps */}
          {data.steps.map((step, idx) => (
            <div key={step.id} className="group mb-4 flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-accent bg-accent/10 text-[13px] font-bold text-accent">
                  {idx + 1}
                </div>
                {idx < data.steps.length - 1 && <div className="mt-1 flex-1 w-px bg-border" />}
              </div>

              <div className="flex-1 pb-2">
                {editing ? (
                  <>
                    <div className="flex items-start justify-between">
                      <input
                        className="w-full border-none bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-dim"
                        value={step.title}
                        onChange={(e) => updateStep(step.id, { title: e.target.value })}
                        placeholder={`Step ${idx + 1} title...`}
                      />
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {idx > 0 && <button className="rounded px-1 py-0.5 text-[10px] text-text-dim hover:text-text-primary" onClick={() => moveStep(step.id, -1)}>↑</button>}
                        {idx < data.steps.length - 1 && <button className="rounded px-1 py-0.5 text-[10px] text-text-dim hover:text-text-primary" onClick={() => moveStep(step.id, 1)}>↓</button>}
                        <button className="rounded px-1 py-0.5 text-[10px] text-text-dim hover:text-status-disconnected" onClick={() => removeStep(step.id)}>×</button>
                      </div>
                    </div>
                    <textarea
                      className="mt-1 w-full resize-none rounded border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
                      value={step.description}
                      onChange={(e) => updateStep(step.id, { description: e.target.value })}
                      placeholder="Description or instructions..."
                      rows={2}
                    />
                    <div className="mt-1.5 overflow-hidden rounded border border-border bg-bg-tabbar">
                      <div className="flex items-center justify-between border-b border-border px-3 py-1">
                        <span className="text-[10px] text-text-dim">Command</span>
                      </div>
                      <input
                        className="w-full bg-transparent px-3 py-1.5 font-mono text-[12px] text-text-primary outline-none placeholder:text-text-dim"
                        value={step.command}
                        onChange={(e) => updateStep(step.id, { command: e.target.value })}
                        placeholder="$ npm install, gcloud run deploy, etc."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[15px] font-medium text-text-primary">{step.title || `Step ${idx + 1}`}</div>
                    {step.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{step.description}</p>
                    )}
                    {step.command && (
                      <div className="mt-1.5 overflow-hidden rounded border border-border bg-bg-tabbar">
                        <div className="flex items-center justify-between border-b border-border px-3 py-1">
                          <span className="text-[10px] text-text-dim">Command</span>
                          <button
                            className={`text-[10px] ${copied === step.id ? "text-status-connected" : "text-text-dim hover:text-accent"}`}
                            onClick={() => copyCmd(step.command, step.id)}
                          >
                            {copied === step.id ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <div className="px-3 py-1.5 font-mono text-[12px] text-text-primary">{step.command}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {editing && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                <div className="h-8 w-8 rounded-full border border-dashed border-text-dim" />
              </div>
              <button
                className="flex-1 rounded border border-dashed border-accent/40 px-4 py-2.5 text-left text-[13px] text-accent transition-colors hover:border-accent hover:bg-accent/5"
                onClick={addStep}
              >
                + Add Step
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
