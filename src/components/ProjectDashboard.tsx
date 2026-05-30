import { useState, useEffect, useCallback } from "react";
import type { Project, LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

interface ProjectDashboardProps {
  onOpenProject: (id: string) => void;
  onProjectsChanged: () => void;
  onOpenLibraryEntry: (entry: LibraryEntry) => void;
}

const TYPE_ICONS: Record<string, string> = {
  Credentials: "🔐",
  Workflow: "⚡",
  "Setup Guide": "🛠️",
  "Code Snippet": "💻",
  Reference: "📚",
  Checklist: "✅",
};

export default function ProjectDashboard({
  onOpenProject,
  onProjectsChanged,
  onOpenLibraryEntry,
}: ProjectDashboardProps) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLibConfirm, setDeleteLibConfirm] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getAllProjects();
      setAllProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      if (librarySearch.trim()) {
        const results = await api.searchLibrary(librarySearch);
        setLibraryEntries(results);
      } else {
        // Get all global entries (pass empty project_id)
        const data = await api.getLibraryEntries("");
        setLibraryEntries(data);
      }
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  }, [librarySearch]);

  useEffect(() => {
    loadProjects();
    loadLibrary();
  }, [loadProjects, loadLibrary]);

  const handleOpen = async (id: string) => {
    try {
      await api.openProject(id);
      onOpenProject(id);
      onProjectsChanged();
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.archiveProject(id);
      await loadProjects();
      onProjectsChanged();
    } catch (err) {
      console.error("Failed to archive project:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProject(id);
      await loadProjects();
      onProjectsChanged();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleDeleteLibEntry = async (id: string) => {
    try {
      await api.deleteLibraryEntry(id);
      await loadLibrary();
    } catch (err) {
      console.error("Failed to delete library entry:", err);
    }
  };

  const handleCreate = async () => {
    try {
      const project = await api.createProject("New Project");
      onOpenProject(project.id);
      onProjectsChanged();
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const activeProjects = allProjects.filter((p) => !p.is_archived);
  const archivedProjects = allProjects.filter((p) => p.is_archived);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">
              Projects
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              {activeProjects.length} project{activeProjects.length !== 1 ? "s" : ""}
              {archivedProjects.length > 0 && ` · ${archivedProjects.length} archived`}
            </p>
          </div>
          <button
            className="rounded border border-accent bg-bg-input px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
            onClick={handleCreate}
          >
            + New Project
          </button>
        </div>

        {/* Active Projects */}
        <div className="grid grid-cols-3 gap-4">
          {activeProjects.map((project) => (
            <div
              key={project.id}
              className="group cursor-pointer rounded-lg border border-border bg-bg-card p-5 transition-colors hover:border-accent/50"
              onClick={() => handleOpen(project.id)}
            >
              <div className="flex items-start justify-between">
                <div className="text-[15px] font-medium text-text-primary">
                  {project.name}
                </div>
                {project.is_open && (
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                    Open
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-text-dim">
                Created {new Date(project.created_at).toLocaleDateString()}
              </div>
              <div className="mt-1 text-[11px] text-text-dim">
                Updated {new Date(project.updated_at).toLocaleDateString()}
              </div>
              <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="rounded bg-bg-input px-2 py-1 text-[10px] text-text-secondary hover:text-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(project.id);
                  }}
                >
                  Archive
                </button>
                <button
                  className="rounded bg-bg-input px-2 py-1 text-[10px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(project.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <div className="mt-8">
            <button
              className="mb-3 text-[12px] text-text-dim hover:text-text-secondary"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "▾" : "▸"} Archived ({archivedProjects.length})
            </button>
            {showArchived && (
              <div className="grid grid-cols-3 gap-4">
                {archivedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group rounded-lg border border-border bg-bg-card/50 p-5 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <div className="text-[15px] font-medium text-text-primary">
                      {project.name}
                    </div>
                    <div className="mt-2 text-[11px] text-text-dim">
                      Archived
                    </div>
                    <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded bg-bg-input px-2 py-1 text-[10px] text-accent hover:bg-accent hover:text-bg-base"
                        onClick={() => handleOpen(project.id)}
                      >
                        Restore
                      </button>
                      <button
                        className="rounded bg-bg-input px-2 py-1 text-[10px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                        onClick={() => setDeleteConfirm(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Library Section */}
        <div className="mt-12 border-t border-border pt-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Library</h2>
              <p className="mt-1 text-[13px] text-text-muted">
                {libraryEntries.length} entr{libraryEntries.length !== 1 ? "ies" : "y"} — workflows, guides, credentials, and more
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="w-48 rounded border border-border bg-bg-input px-2.5 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search library..."
              />
            </div>
          </div>

          {libraryEntries.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-text-muted">
              {librarySearch ? "No matching entries" : "No library entries yet. Open a project and use the Library panel to create one."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {libraryEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="group cursor-pointer rounded-lg border border-border bg-bg-card p-5 transition-colors hover:border-accent/50"
                  onClick={() => onOpenLibraryEntry(entry)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px]">{TYPE_ICONS[entry.entry_type] || "📄"}</span>
                      <div>
                        <div className="text-[14px] font-medium text-text-primary">{entry.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                          <span>{entry.entry_type}</span>
                          <span>·</span>
                          <span>{entry.is_global ? "Global" : "Project"}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="text-[11px] text-text-dim opacity-0 hover:text-status-disconnected group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteLibConfirm(entry.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-text-dim">
                    Updated {new Date(entry.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Project Permanently"
        message="This will permanently delete the project and ALL its secrets, notes, files, and todos. This cannot be undone."
        confirmLabel="Delete Forever"
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        isOpen={deleteLibConfirm !== null}
        title="Delete Library Entry"
        message="This will permanently delete this library entry. This cannot be undone."
        onConfirm={() => {
          if (deleteLibConfirm) handleDeleteLibEntry(deleteLibConfirm);
          setDeleteLibConfirm(null);
        }}
        onCancel={() => setDeleteLibConfirm(null)}
      />
    </div>
  );
}
