import { useState } from "react";
import type { CreateProjectInput, Project } from "../types";
import * as api from "../hooks/useTauri";

interface NewProjectModalProps {
  onCreated: (project: Project) => void;
  onClose: () => void;
}

const PLATFORMS = ["AWS", "GCP", "Azure", "Vercel", "Netlify", "Self-hosted", "Local", "Other"];
const ENVIRONMENTS = ["Production", "Staging", "Development", "Local"];
const AI_PROVIDERS = ["Anthropic", "OpenAI", "Google", "Meta", "Mistral", "Local/Ollama", "None"];
const AGENT_FRAMEWORKS = ["Claude Code", "LangChain", "CrewAI", "AutoGen", "Custom", "None"];
const FRONTEND = ["React", "Next.js", "Vue", "Nuxt", "Svelte", "SvelteKit", "Angular", "Astro", "Remix"];
const BACKEND = ["Node.js", "Rust", "Python", "Go", "Java", "Ruby", ".NET", "Elixir"];
const DATABASES = ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis", "DynamoDB", "Supabase", "Firebase"];

function ChipSelect({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12px] text-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              value === opt
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-bg-card text-text-secondary hover:border-accent/50"
            }`}
            onClick={() => onChange(value === opt ? "" : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChipSelect({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(", "));
  };
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12px] text-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              selected.includes(opt)
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-bg-card text-text-secondary hover:border-accent/50"
            }`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewProjectModal({ onCreated, onClose }: NewProjectModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateProjectInput>({
    name: "",
    description: "",
    platform: "",
    environment: "",
    repo_url: "",
    prod_url: "",
    dashboard_url: "",
    docs_url: "",
    ai_provider: "",
    ai_model: "",
    agent_framework: "",
    frontend_stack: "",
    backend_stack: "",
    database_stack: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof CreateProjectInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const project = await api.createProject(form);
      onCreated(project);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: "Project Info", subtitle: "Name your project and describe what it does" },
    { title: "Infrastructure", subtitle: "Where does this project live?" },
    { title: "AI & Agents", subtitle: "What AI tools power this project?" },
    { title: "Tech Stack", subtitle: "What's the stack?" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[560px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-[14px] font-medium text-text-primary">New Project</div>
            <div className="text-[11px] text-text-muted">{steps[step].subtitle}</div>
          </div>
          <button className="text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 pt-3">
          {steps.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
              <div className={`mt-1 text-[9px] ${i === step ? "text-accent" : "text-text-dim"}`}>{s.title}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 min-h-[280px]">
          {step === 0 && (
            <>
              <label className="mb-1 block text-[12px] text-text-secondary">Project Name *</label>
              <input
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g., my-saas-app"
                autoFocus
              />
              <label className="mb-1 block text-[12px] text-text-secondary">Description</label>
              <textarea
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of the project..."
                rows={2}
              />
              <ChipSelect label="Environment" options={ENVIRONMENTS} value={form.environment || ""} onChange={(v) => set("environment", v)} />
            </>
          )}

          {step === 1 && (
            <>
              <ChipSelect label="Platform" options={PLATFORMS} value={form.platform || ""} onChange={(v) => set("platform", v)} />
              <label className="mb-1 block text-[12px] text-text-secondary">Repository URL</label>
              <input
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.repo_url}
                onChange={(e) => set("repo_url", e.target.value)}
                placeholder="https://github.com/..."
              />
              <label className="mb-1 block text-[12px] text-text-secondary">Production URL</label>
              <input
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.prod_url}
                onChange={(e) => set("prod_url", e.target.value)}
                placeholder="https://myapp.com"
              />
              <label className="mb-1 block text-[12px] text-text-secondary">Dashboard / Console URL</label>
              <input
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.dashboard_url}
                onChange={(e) => set("dashboard_url", e.target.value)}
                placeholder="https://console.cloud.google.com/..."
              />
              <label className="mb-1 block text-[12px] text-text-secondary">Documentation URL</label>
              <input
                className="mb-3 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.docs_url}
                onChange={(e) => set("docs_url", e.target.value)}
                placeholder="https://docs.myapp.com"
              />
            </>
          )}

          {step === 2 && (
            <>
              <ChipSelect label="AI Provider" options={AI_PROVIDERS} value={form.ai_provider || ""} onChange={(v) => set("ai_provider", v)} />
              <label className="mb-1 block text-[12px] text-text-secondary">AI Model</label>
              <input
                className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                value={form.ai_model}
                onChange={(e) => set("ai_model", e.target.value)}
                placeholder="e.g., Claude Opus 4.6, GPT-4o"
              />
              <ChipSelect label="Agent Framework" options={AGENT_FRAMEWORKS} value={form.agent_framework || ""} onChange={(v) => set("agent_framework", v)} />
            </>
          )}

          {step === 3 && (
            <>
              <MultiChipSelect label="Frontend" options={FRONTEND} value={form.frontend_stack || ""} onChange={(v) => set("frontend_stack", v)} />
              <MultiChipSelect label="Backend" options={BACKEND} value={form.backend_stack || ""} onChange={(v) => set("backend_stack", v)} />
              <MultiChipSelect label="Database" options={DATABASES} value={form.database_stack || ""} onChange={(v) => set("database_stack", v)} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div>
            {step > 0 && (
              <button
                className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <>
                <button
                  className="rounded px-4 py-2 text-[13px] text-text-muted hover:text-text-primary"
                  onClick={handleCreate}
                  disabled={!form.name.trim() || loading}
                >
                  Skip & Create
                </button>
                <button
                  className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base hover:opacity-90 disabled:opacity-50"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 && !form.name.trim()}
                >
                  Next
                </button>
              </>
            ) : (
              <button
                className="rounded bg-accent px-5 py-2 text-[13px] font-medium text-bg-base hover:opacity-90 disabled:opacity-50"
                onClick={handleCreate}
                disabled={!form.name.trim() || loading}
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
