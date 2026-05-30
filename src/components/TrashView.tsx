import { useState, useEffect, useCallback } from "react";
import type { TrashItem } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

interface TrashViewProps {
  onRestored: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  secret: "🔑",
  note: "📝",
  file: "📁",
};

export default function TrashView({ onRestored }: TrashViewProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const loadTrash = useCallback(async () => {
    try {
      const data = await api.getTrash();
      setItems(data);
    } catch (err) {
      console.error("Failed to load trash:", err);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

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

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      setItems([]);
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
        {items.length > 0 && (
          <button
            className="rounded border border-status-disconnected/50 px-3 py-1.5 text-[12px] text-status-disconnected transition-colors hover:bg-status-disconnected hover:text-white"
            onClick={() => setEmptyConfirm(true)}
          >
            Empty Trash
          </button>
        )}
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
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between rounded-md border border-border bg-bg-card p-3.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-[16px]">{TYPE_ICONS[item.item_type] || "📄"}</span>
                <div>
                  <div className="text-[13px] text-text-primary">{item.item_name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="capitalize">{item.item_type}</span>
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
