import { useState, useEffect } from "react";
import type { Project } from "../types";
import * as api from "../hooks/useTauri";

interface ProjectInfoViewProps {
  project: Project;
  onSaved: () => void;
}

export default function ProjectInfoView({ project, onSaved }: ProjectInfoViewProps) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(project.name);
    setDesc(project.description);
  }, [project.id]);

  const handleSave = async () => {
    await api.renameProject(project.id, name);
    onSaved();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const info = [
    { label: "Platform", value: project.platform },
    { label: "Environment", value: project.environment },
    { label: "AI Provider", value: project.ai_provider },
    { label: "AI Model", value: project.ai_model },
    { label: "Agent Framework", value: project.agent_framework },
    { label: "Frontend", value: project.frontend_stack },
    { label: "Backend", value: project.backend_stack },
    { label: "Database", value: project.database_stack },
  ].filter((i) => i.value);

  const links = [
    { label: "Repository", url: project.repo_url },
    { label: "Production", url: project.prod_url },
    { label: "Dashboard", url: project.dashboard_url },
    { label: "Documentation", url: project.docs_url },
  ].filter((l) => l.url);

  return (
    <div className="paper-texture flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Project Info</h2>
          <button
            className={`rounded px-4 py-1.5 text-[12px] transition-colors ${
              saved ? "bg-status-connected/20 text-status-connected" : "border border-accent text-accent hover:bg-accent hover:text-bg-base"
            }`}
            onClick={handleSave}
          >
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-text-secondary">Project Name</label>
          <input
            className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[14px] text-text-primary outline-none focus:border-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-text-secondary">Description</label>
          <textarea
            className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
        </div>

        {/* Metadata */}
        {info.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">Stack & Infrastructure</h3>
            <div className="grid grid-cols-2 gap-3">
              {info.map((item) => (
                <div key={item.label} className="rounded border border-border bg-bg-card px-4 py-3">
                  <div className="text-[10px] text-text-dim">{item.label}</div>
                  <div className="mt-1 text-[13px] text-text-primary">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">Links</h3>
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.label} className="flex items-center justify-between rounded border border-border bg-bg-card px-4 py-2.5">
                  <div>
                    <div className="text-[10px] text-text-dim">{link.label}</div>
                    <div className="mt-0.5 text-[12px] text-accent">{link.url}</div>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-bg-input px-3 py-1 text-[11px] text-text-secondary hover:text-accent"
                  >
                    Open
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="text-[11px] text-text-dim">
          <div>Created: {new Date(project.created_at).toLocaleDateString()}</div>
          <div>Updated: {new Date(project.updated_at).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
