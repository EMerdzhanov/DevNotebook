import { useState, useEffect, useCallback } from "react";
import type { Project, LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";
import { LIBRARY_ICON_MAP, IconFile } from "./Icons";

function LibIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = LIBRARY_ICON_MAP[type] || IconFile;
  return <Icon size={size} />;
}

interface ProjectDashboardProps {
  onOpenProject: (id: string) => void;
  onProjectsChanged: () => void;
  onOpenLibraryEntry: (entry: LibraryEntry) => void;
  onCreateProject: () => void;
  onCreateLibraryEntry: () => void;
}

export default function ProjectDashboard({
  onOpenProject,
  onProjectsChanged,
  onOpenLibraryEntry,
  onCreateProject,
  onCreateLibraryEntry,
}: ProjectDashboardProps) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<string | null>(null);
  const [libraryProjectFilter, setLibraryProjectFilter] = useState<string | null>(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const [scopeDropOpen, setScopeDropOpen] = useState(false);
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
        const data = await api.getAllLibraryEntries();
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

  const handleCreate = () => {
    onCreateProject();
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
                <div className="flex gap-1">
                  {project.environment && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      project.environment === "Production" ? "bg-status-connected/20 text-status-connected" :
                      project.environment === "Staging" ? "bg-status-warning/20 text-status-warning" :
                      "bg-bg-input text-text-muted"
                    }`}>
                      {project.environment}
                    </span>
                  )}
                  {project.is_open && (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                      Open
                    </span>
                  )}
                </div>
              </div>
              {project.description && (
                <div className="mt-1.5 text-[12px] text-text-secondary line-clamp-2">
                  {project.description}
                </div>
              )}
              {/* Metadata chips */}
              <div className="mt-2 flex flex-wrap gap-1">
                {project.platform && (
                  <span className="rounded bg-bg-input px-1.5 py-0.5 text-[9px] text-text-muted">{project.platform}</span>
                )}
                {project.ai_provider && (
                  <span className="rounded bg-bg-input px-1.5 py-0.5 text-[9px] text-text-muted">{project.ai_provider}</span>
                )}
                {project.frontend_stack && (
                  <span className="rounded bg-bg-input px-1.5 py-0.5 text-[9px] text-text-muted">{project.frontend_stack.split(",")[0].trim()}</span>
                )}
                {project.backend_stack && (
                  <span className="rounded bg-bg-input px-1.5 py-0.5 text-[9px] text-text-muted">{project.backend_stack.split(",")[0].trim()}</span>
                )}
              </div>
              <div className="mt-2 text-[10px] text-text-dim">
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
              {/* Type filter dropdown */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors ${
                    libraryTypeFilter ? "border-accent text-accent" : "border-border bg-bg-input text-text-secondary hover:text-text-primary"
                  }`}
                  onClick={() => { setTypeDropOpen(!typeDropOpen); setScopeDropOpen(false); }}
                >
                  {libraryTypeFilter ? <><LibIcon type={libraryTypeFilter} /> {libraryTypeFilter}</> : "All Types"}
                  <span className="text-[9px] text-text-dim">▾</span>
                </button>
                {typeDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setTypeDropOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-border bg-bg-card py-1 shadow-lg">
                      <button
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-bg-input ${!libraryTypeFilter ? "text-accent" : "text-text-primary"}`}
                        onClick={() => { setLibraryTypeFilter(null); setTypeDropOpen(false); }}
                      >
                        All Types
                      </button>
                      {[...new Set(libraryEntries.map((e) => e.entry_type))].sort().map((type) => (
                        <button
                          key={type}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-bg-input ${libraryTypeFilter === type ? "text-accent" : "text-text-primary"}`}
                          onClick={() => { setLibraryTypeFilter(type); setTypeDropOpen(false); }}
                        >
                          <LibIcon type={type} />
                          {type}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Scope filter dropdown */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors ${
                    libraryProjectFilter ? "border-accent text-accent" : "border-border bg-bg-input text-text-secondary hover:text-text-primary"
                  }`}
                  onClick={() => { setScopeDropOpen(!scopeDropOpen); setTypeDropOpen(false); }}
                >
                  {libraryProjectFilter === "global" ? "Global" : libraryProjectFilter ? allProjects.find((p) => p.id === libraryProjectFilter)?.name || "Project" : "All Scopes"}
                  <span className="text-[9px] text-text-dim">▾</span>
                </button>
                {scopeDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setScopeDropOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-border bg-bg-card py-1 shadow-lg">
                      <button
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-bg-input ${!libraryProjectFilter ? "text-accent" : "text-text-primary"}`}
                        onClick={() => { setLibraryProjectFilter(null); setScopeDropOpen(false); }}
                      >
                        All Scopes
                      </button>
                      <button
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-bg-input ${libraryProjectFilter === "global" ? "text-accent" : "text-text-primary"}`}
                        onClick={() => { setLibraryProjectFilter("global"); setScopeDropOpen(false); }}
                      >
                        Global
                      </button>
                      {allProjects.filter((p) => !p.is_archived).map((p) => (
                        <button
                          key={p.id}
                          className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-bg-input ${libraryProjectFilter === p.id ? "text-accent" : "text-text-primary"}`}
                          onClick={() => { setLibraryProjectFilter(p.id); setScopeDropOpen(false); }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                className="rounded border border-accent bg-bg-input px-4 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
                onClick={onCreateLibraryEntry}
              >
                + New Entry
              </button>
            </div>
          </div>

          {(() => {
            let filtered = libraryEntries;
            if (libraryTypeFilter) {
              filtered = filtered.filter((e) => e.entry_type === libraryTypeFilter);
            }
            if (libraryProjectFilter === "global") {
              filtered = filtered.filter((e) => e.is_global);
            } else if (libraryProjectFilter) {
              filtered = filtered.filter((e) => e.project_id === libraryProjectFilter);
            }
            return filtered.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-text-muted">
              {librarySearch || libraryTypeFilter || libraryProjectFilter ? "No matching entries" : "No library entries yet. Open a project and use the Library panel to create one."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="group cursor-pointer rounded-lg border border-border bg-bg-card p-5 transition-colors hover:border-accent/50"
                  onClick={() => onOpenLibraryEntry(entry)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px]"><LibIcon type={entry.entry_type} /></span>
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
          );
          })()}
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
