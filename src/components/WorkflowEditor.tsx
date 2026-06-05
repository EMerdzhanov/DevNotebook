import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setData(parseWorkflow(entry.content));
    setTitle(entry.title);
  }, [entry.id, entry.content, entry.title]);

  const autoSave = useCallback(
    (newTitle: string, newData: WorkflowData) => {
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconBolt size={18} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">Workflow</span>
          <span className="text-[10px] text-text-dim">{data.steps.length} step{data.steps.length !== 1 ? "s" : ""}</span>
        </div>
        <button className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input" onClick={onDelete}>Delete</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl">
          <input
            className="mb-2 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
            value={title}
            onChange={(e) => { setTitle(e.target.value); autoSave(e.target.value, data); }}
            placeholder="Workflow name..."
          />

          {/* Description */}
          <input
            className="mb-6 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
            value={data.description}
            onChange={(e) => updateData({ description: e.target.value })}
            placeholder="Brief description of this workflow..."
          />

          {/* Steps */}
          {data.steps.map((step, idx) => (
            <div key={step.id} className="group mb-4 flex gap-4">
              {/* Step number + line */}
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-accent bg-accent/10 text-[13px] font-bold text-accent">
                  {idx + 1}
                </div>
                {idx < data.steps.length - 1 && (
                  <div className="mt-1 flex-1 w-px bg-border" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between">
                  <input
                    className="w-full border-none bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-dim"
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                    placeholder={`Step ${idx + 1} title...`}
                  />
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {idx > 0 && (
                      <button className="rounded px-1 py-0.5 text-[10px] text-text-dim hover:text-text-primary" onClick={() => moveStep(step.id, -1)}>↑</button>
                    )}
                    {idx < data.steps.length - 1 && (
                      <button className="rounded px-1 py-0.5 text-[10px] text-text-dim hover:text-text-primary" onClick={() => moveStep(step.id, 1)}>↓</button>
                    )}
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

                {/* Command */}
                {step.command || true ? (
                  <div className="mt-1.5 overflow-hidden rounded border border-border bg-bg-tabbar">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1">
                      <span className="text-[10px] text-text-dim">Command</span>
                      {step.command && (
                        <button
                          className="text-[10px] text-text-dim hover:text-accent"
                          onClick={() => navigator.clipboard.writeText(step.command)}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    <input
                      className="w-full bg-transparent px-3 py-1.5 font-mono text-[12px] text-text-primary outline-none placeholder:text-text-dim"
                      value={step.command}
                      onChange={(e) => updateStep(step.id, { command: e.target.value })}
                      placeholder="$ npm install, gcloud run deploy, etc."
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {/* Add step */}
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
        </div>
      </div>
    </div>
  );
}
