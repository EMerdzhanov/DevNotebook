import { useState, useEffect, useCallback, useMemo } from "react";
import type { TrashItem, Project } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";
import { IconKey, IconDoc, IconFolder, IconFile, IconBuilding, IconCheck, IconBookOpen, IconNote } from "./Icons";

interface TrashViewProps {
  onRestored: () => void;
}

const TRASH_ICONS: Record<string, React.FC<{ size?: number }>> = {
  project: IconBuilding,
  secret: IconKey,
  secret_category: IconKey,
  note: IconDoc,
  note_folder: IconDoc,
  file: IconFolder,
  file_folder: IconFolder,
  todo: IconCheck,
  journal: IconNote,
  library: IconBookOpen,
};

export default function TrashView({ onRestored }: TrashViewProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const loadTrash = useCallback(async () => {
    try {
      const data = await api.getTrash();
      setItems(data);
      setSelected(new Set());
    } catch (err) {
      console.error("Failed to load trash:", err);
    }
  }, []);

  useEffect(() => {
    loadTrash();
    api.getAllProjects().then(setProjects).catch(() => {});
  }, [loadTrash]);

  const getOriginLabel = (item: TrashItem) => {
    if (!item.project_id || item.project_id === "") return "Global";
    return projectMap.get(item.project_id) || "Unknown Project";
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.restoreFromTrash(id);
      await loadTrash();
      onRestored();
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await api.permanentlyDeleteFromTrash(id);
      await loadTrash();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleBatchDelete = async () => {
    try {
      await api.batchDeleteFromTrash(Array.from(selected));
      await loadTrash();
    } catch (err) {
      console.error("Failed to batch delete:", err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      setItems([]);
      setSelected(new Set());
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-text-primary">Trash</h3>
          <span className="rounded-full bg-bg-input px-2 py-0.5 text-[11px] text-text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              className="rounded border border-status-disconnected/50 px-3 py-1.5 text-[12px] text-status-disconnected transition-colors hover:bg-status-disconnected hover:text-white"
              onClick={() => setBatchDeleteConfirm(true)}
            >
              Delete Selected ({selected.size})
            </button>
          )}
          {items.length > 0 && (
            <button
              className="rounded border border-status-disconnected/50 px-3 py-1.5 text-[12px] text-status-disconnected transition-colors hover:bg-status-disconnected hover:text-white"
              onClick={() => setEmptyConfirm(true)}
            >
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="mx-auto mb-3 text-text-dim"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <div className="text-[13px] text-text-muted">Trash is empty</div>
          <div className="mt-1 text-[11px] text-text-dim">
            Deleted secrets and notes will appear here
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-3.5 py-1.5">
            <button
              onClick={toggleSelectAll}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                selected.size === items.length && items.length > 0
                  ? "border-accent bg-accent text-bg-base"
                  : "border-border hover:border-text-muted"
              }`}
            >
              {selected.size === items.length && items.length > 0 && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {selected.size > 0 && selected.size < items.length && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </button>
            <span className="text-[11px] text-text-muted">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between rounded-md border p-3.5 ${
                selected.has(item.id)
                  ? "border-accent/40 bg-accent/5"
                  : "border-border bg-bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    selected.has(item.id)
                      ? "border-accent bg-accent text-bg-base"
                      : "border-border hover:border-text-muted"
                  }`}
                >
                  {selected.has(item.id) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className="text-accent">{(() => { const I = TRASH_ICONS[item.item_type] || IconFile; return <I size={16} />; })()}</span>
                <div>
                  <div className="text-[13px] text-text-primary">{item.item_name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="capitalize">{item.item_type}</span>
                    <span>·</span>
                    <span className={!item.project_id || item.project_id === "" ? "text-text-dim" : "text-accent/70"}>
                      {getOriginLabel(item)}
                    </span>
                    <span>·</span>
                    <span>Deleted {new Date(item.deleted_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="rounded bg-bg-input px-3 py-1 text-[11px] text-accent hover:bg-accent hover:text-bg-base"
                  onClick={() => handleRestore(item.id)}
                >
                  Restore
                </button>
                <button
                  className="rounded bg-bg-input px-3 py-1 text-[11px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                  onClick={() => setDeleteConfirm(item.id)}
                >
                  Delete Forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Forever"
        message="This will permanently delete this item. This cannot be undone."
        confirmLabel="Delete Forever"
        onConfirm={() => {
          if (deleteConfirm) handlePermanentDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        isOpen={batchDeleteConfirm}
        title="Delete Selected Items"
        message={`This will permanently delete ${selected.size} ${selected.size === 1 ? "item" : "items"}. This cannot be undone.`}
        confirmLabel={`Delete ${selected.size} ${selected.size === 1 ? "Item" : "Items"}`}
        onConfirm={() => {
          handleBatchDelete();
          setBatchDeleteConfirm(false);
        }}
        onCancel={() => setBatchDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={emptyConfirm}
        title="Empty Trash"
        message="This will permanently delete all items in the trash. This cannot be undone."
        confirmLabel="Empty Trash"
        onConfirm={() => {
          handleEmptyTrash();
          setEmptyConfirm(false);
        }}
        onCancel={() => setEmptyConfirm(false)}
      />
    </div>
  );
}
