import { useState } from "react";
import type { Project } from "../types";

interface TabBarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onCloseProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
}

export default function TabBar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onCloseProject,
  onRenameProject,
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
      className="flex items-end bg-bg-tabbar px-2 pt-1.5"
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
                ? "bg-bg-base text-text-primary"
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
