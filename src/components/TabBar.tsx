import { useState } from "react";
import type { Project } from "../types";

interface TabBarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onCloseProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onOpenDashboard: () => void;
  isDashboardActive: boolean;
  onOpenLibrary: () => void;
  isLibraryActive: boolean;
  onOpenJournal: () => void;
  isJournalActive: boolean;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
  onOpenTrash: () => void;
  isTrashActive: boolean;
  sidebarOffset: number;
}

export default function TabBar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onCloseProject,
  onRenameProject,
  onOpenDashboard,
  isDashboardActive,
  onOpenLibrary,
  isLibraryActive,
  onOpenJournal,
  isJournalActive,
  onOpenSettings,
  isSettingsActive,
  onOpenTrash,
  isTrashActive,
  sidebarOffset,
}: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const handleDoubleClick = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) {
      onRenameProject(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="flex items-end bg-bg-tabbar pr-2 pt-1.5"
      style={{ paddingLeft: sidebarOffset }}
      data-tauri-drag-region
      onClick={() => setContextMenu(null)}
    >
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        return (
          <div
            key={project.id}
            className={`group flex min-w-[120px] max-w-[200px] cursor-pointer items-center gap-2 rounded-t-md px-3 py-1.5 text-[13px] transition-colors ${
              isActive
                ? "paper-texture text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => onSelectProject(project.id)}
            onDoubleClick={() => handleDoubleClick(project)}
            onContextMenu={(e) => handleContextMenu(e, project.id)}
          >
            {editingId === project.id ? (
              <input
                className="w-full border-none bg-transparent text-[13px] text-text-primary outline-none"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRenameSubmit(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit(project.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{project.name}</span>
            )}
            <button
              className={`ml-auto flex-shrink-0 text-[11px] leading-none transition-colors ${
                isActive
                  ? "text-text-muted hover:text-text-primary"
                  : "text-text-faint opacity-0 group-hover:opacity-100 hover:text-text-secondary"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onCloseProject(project.id);
              }}
            >
              &times;
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        className="flex items-center justify-center px-3 py-1.5 text-[15px] text-text-dim transition-colors hover:text-text-secondary"
        onClick={onCreateProject}
      >
        +
      </button>

      {/* Dashboard, Trash & Settings - far right */}
      <button
        className={`ml-auto flex items-center justify-center px-2 py-1.5 transition-colors ${
          isDashboardActive ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
        onClick={onOpenDashboard}
        title="All Projects"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      </button>
      <button
        className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
          isLibraryActive ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
        onClick={onOpenLibrary}
        title="Library"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </button>
      <button
        className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
          isJournalActive ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
        onClick={onOpenJournal}
        title="Journal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
      <button
        className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
          isTrashActive ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
        onClick={onOpenTrash}
        title="Trash"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      <button
        className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
          isSettingsActive ? "text-accent" : "text-text-dim hover:text-text-secondary"
        }`}
        onClick={onOpenSettings}
        title="Settings (⌘,)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded border border-border bg-bg-card py-1 text-[12px] shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-1.5 text-left text-text-primary hover:bg-bg-input"
            onClick={() => {
              const project = projects.find((p) => p.id === contextMenu.id);
              if (project) handleDoubleClick(project);
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="w-full px-4 py-1.5 text-left text-status-disconnected hover:bg-bg-input"
            onClick={() => {
              onCloseProject(contextMenu.id);
              setContextMenu(null);
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
