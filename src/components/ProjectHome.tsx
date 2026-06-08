import { useState, useEffect } from "react";
import type { Project, SecretCategory, NoteFolder, FileFolder, LibraryEntry, Todo } from "../types";
import * as api from "../hooks/useTauri";

interface ProjectHomeProps {
  project: Project;
  categories: SecretCategory[];
  noteFolders: NoteFolder[];
  fileFolders: FileFolder[];
  libraryEntries: LibraryEntry[];
  onNavigate: (view: string, id?: string) => void;
}

export default function ProjectHome({
  project,
  categories,
  noteFolders,
  fileFolders,
  libraryEntries,
  onNavigate,
}: ProjectHomeProps) {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    api.getTodos(project.id).then(setTodos).catch(() => {});
  }, [project.id]);

  const totalSecrets = categories.length;
  const totalNotes = noteFolders.reduce((sum, f) => sum + f.note_count, 0);
  const totalFiles = fileFolders.reduce((sum, f) => sum + f.file_count, 0);
  const totalLibrary = libraryEntries.length;
  const pendingBugs = todos.filter((t) => !t.is_completed && t.kind === "bug");
  const pendingTasks = todos.filter((t) => !t.is_completed && t.kind !== "bug");
  const completedTodos = todos.filter((t) => t.is_completed).length;

  const stats = [
    { label: "Secret Sections", value: totalSecrets, action: () => categories[0] && onNavigate("secrets", categories[0].id) },
    { label: "Notes", value: totalNotes, action: () => noteFolders[0] && onNavigate("notes", noteFolders[0].id) },
    { label: "Files", value: totalFiles, action: () => fileFolders[0] && onNavigate("files", fileFolders[0].id) },
    { label: "Library Items", value: totalLibrary, action: () => libraryEntries[0] && onNavigate("libraryEntry", libraryEntries[0].id) },
    { label: "Bugs", value: pendingBugs.length, accent: "text-status-disconnected", action: undefined },
    { label: "Pending Tasks", value: pendingTasks.length, action: undefined },
    { label: "Done", value: completedTodos, action: undefined },
  ];

  const details = [
    { label: "Platform", value: project.platform },
    { label: "Environment", value: project.environment },
    { label: "Frontend", value: project.frontend_stack },
    { label: "Backend", value: project.backend_stack },
    { label: "Database", value: project.database_stack },
    { label: "AI Provider", value: project.ai_provider },
    { label: "AI Model", value: project.ai_model },
    { label: "Agent Framework", value: project.agent_framework },
  ].filter((d) => d.value);

  const links = [
    { label: "Repository", value: project.repo_url },
    { label: "Production", value: project.prod_url },
    { label: "Dashboard", value: project.dashboard_url },
    { label: "Documentation", value: project.docs_url },
  ].filter((l) => l.value);

  return (
    <div className="paper-texture flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{project.name}</h2>
        {project.description && (
          <p className="mt-1.5 text-[13px] text-text-muted">{project.description}</p>
        )}
        <div className="mt-2 text-[11px] text-text-dim">
          Created {new Date(project.created_at).toLocaleDateString()}
          {project.updated_at !== project.created_at && (
            <> · Updated {new Date(project.updated_at).toLocaleDateString()}</>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-md border border-border bg-bg-card p-3.5 ${
              stat.action ? "cursor-pointer transition-colors hover:border-accent/40" : ""
            }`}
            onClick={stat.action}
          >
            <div className={`text-2xl font-semibold ${"accent" in stat && stat.accent ? stat.accent : "text-text-primary"}`}>{stat.value}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Project Details */}
      {details.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-text-muted">Stack</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between rounded border border-border bg-bg-card px-3 py-2">
                <span className="text-[11px] text-text-dim">{d.label}</span>
                <span className="text-[12px] text-text-primary">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-text-muted">Links</h3>
          <div className="space-y-1.5">
            {links.map((l) => (
              <div key={l.label} className="flex items-center gap-3 rounded border border-border bg-bg-card px-3 py-2">
                <span className="text-[11px] text-text-dim">{l.label}</span>
                <a
                  href={l.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[12px] text-accent hover:underline"
                >
                  {l.value}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bugs to Fix */}
      {pendingBugs.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-status-disconnected">Bugs to Fix</h3>
          <div className="space-y-1.5">
            {pendingBugs.slice(0, 5).map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 rounded border border-status-disconnected/20 bg-bg-card px-3 py-2">
                <span className={`text-[10px] font-medium uppercase ${
                  todo.priority === "high" ? "text-status-disconnected" :
                  todo.priority === "medium" ? "text-accent" : "text-text-dim"
                }`}>
                  {todo.priority || "—"}
                </span>
                <span className="text-[12px] text-text-primary">{todo.title}</span>
                {todo.due_date && (
                  <span className="ml-auto text-[10px] text-text-dim">
                    Due {new Date(todo.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
            {pendingBugs.length > 5 && (
              <div className="text-[11px] text-text-dim">
                +{pendingBugs.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div>
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-text-muted">Pending Tasks</h3>
          <div className="space-y-1.5">
            {pendingTasks.slice(0, 5).map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 rounded border border-border bg-bg-card px-3 py-2">
                <span className={`text-[10px] font-medium uppercase ${
                  todo.priority === "high" ? "text-status-disconnected" :
                  todo.priority === "medium" ? "text-accent" : "text-text-dim"
                }`}>
                  {todo.priority || "—"}
                </span>
                <span className="text-[12px] text-text-primary">{todo.title}</span>
                {todo.due_date && (
                  <span className="ml-auto text-[10px] text-text-dim">
                    Due {new Date(todo.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
            {pendingTasks.length > 5 && (
              <div className="text-[11px] text-text-dim">
                +{pendingTasks.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
