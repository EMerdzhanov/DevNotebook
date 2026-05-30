import { useState, useEffect, useCallback } from "react";
import type { Secret } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

interface SecretListViewProps {
  categoryId: string;
  categoryName: string;
}

export default function SecretListView({
  categoryId,
  categoryName,
}: SecretListViewProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadSecrets = useCallback(async () => {
    try {
      const data = await api.getSecrets(categoryId);
      setSecrets(data);
    } catch (err) {
      console.error("Failed to load secrets:", err);
    }
  }, [categoryId]);

  useEffect(() => {
    loadSecrets();
    setRevealedId(null);
  }, [loadSecrets]);

  const handleReveal = async (id: string) => {
    try {
      const value = await api.revealSecret(id);
      setRevealedId(id);
      setRevealedValue(value);
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setRevealedId(null);
        setRevealedValue("");
      }, 10000);
    } catch (err) {
      console.error("Failed to reveal secret:", err);
    }
  };

  const handleCopy = async (id: string) => {
    try {
      const value = await api.revealSecret(id);
      await navigator.clipboard.writeText(value);
      // Auto-clear clipboard after 30 seconds
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, 30000);
    } catch (err) {
      console.error("Failed to copy secret:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSecret(id);
      await loadSecrets();
    } catch (err) {
      console.error("Failed to delete secret:", err);
    }
  };

  return (
    <div className="paper-texture flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">{categoryName}</h3>
        <button
          className="rounded border border-accent bg-bg-input px-3.5 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
          onClick={() => {
            setEditingSecret(null);
            setShowAddModal(true);
          }}
        >
          + Add Secret
        </button>
      </div>

      {secrets.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          No secrets yet. Click &quot;+ Add Secret&quot; to get started.
        </div>
      ) : (
        <div className="space-y-2.5">
          {secrets.map((secret) => (
            <div
              key={secret.id}
              className="flex items-center justify-between rounded-md border border-border bg-bg-card p-3.5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-text-primary">{secret.name}</span>
                  {secret.url && (
                    <a
                      href={secret.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                      title={secret.url}
                    >
                      🔗
                    </a>
                  )}
                </div>
                <div className="mt-1 font-mono text-[12px] text-text-muted">
                  {revealedId === secret.id
                    ? revealedValue
                    : secret.masked_preview}
                </div>
                {secret.notes && (
                  <div className="mt-1 text-[11px] text-text-dim">
                    {secret.notes}
                  </div>
                )}
                {secret.url && (
                  <div className="mt-1 truncate text-[11px] text-accent/60">
                    {secret.url}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => handleCopy(secret.id)}
                >
                  Copy
                </button>
                <button
                  className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => handleReveal(secret.id)}
                >
                  {revealedId === secret.id ? "Hide" : "Reveal"}
                </button>
                <button
                  className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => {
                    setEditingSecret(secret);
                    setShowAddModal(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-status-disconnected transition-colors hover:bg-status-disconnected hover:text-white"
                  onClick={() => setDeleteConfirm(secret.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <SecretEditModal
          categoryId={categoryId}
          secret={editingSecret}
          onClose={() => {
            setShowAddModal(false);
            setEditingSecret(null);
          }}
          onSaved={loadSecrets}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Secret"
        message="Are you sure you want to delete this secret? It will be moved to Trash and can be restored later."
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ── Secret Edit Modal ──

interface SecretEditModalProps {
  categoryId: string;
  secret: Secret | null;
  onClose: () => void;
  onSaved: () => void;
}

function SecretEditModal({
  categoryId,
  secret,
  onClose,
  onSaved,
}: SecretEditModalProps) {
  const [name, setName] = useState(secret?.name ?? "");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState(secret?.notes ?? "");
  const [url, setUrl] = useState(secret?.url ?? "");
  const [showValue, setShowValue] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If editing, load the current value
    if (secret) {
      api.revealSecret(secret.id).then(setValue).catch(console.error);
    }
  }, [secret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value.trim()) return;

    setLoading(true);
    try {
      if (secret) {
        await api.updateSecret(secret.id, name.trim(), value, notes.trim(), url.trim());
      } else {
        await api.createSecret(categoryId, name.trim(), value, notes.trim(), url.trim());
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save secret:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <form
        className="w-[460px] rounded-lg border border-border bg-bg-base p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="mb-4 text-[16px] font-medium text-text-primary">
          {secret ? "Edit Secret" : "Add Secret"}
        </h3>

        <label className="mb-1 block text-[12px] text-text-secondary">Name</label>
        <input
          className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Stripe Production Key"
          autoFocus
        />

        <label className="mb-1 block text-[12px] text-text-secondary">Value</label>
        <div className="relative mb-4">
          <input
            className="w-full rounded border border-border bg-bg-input px-3 py-2 pr-16 font-mono text-[13px] text-text-primary outline-none focus:border-accent"
            type={showValue ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Secret value"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted hover:text-text-primary"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? "Hide" : "Show"}
          </button>
        </div>

        <label className="mb-1 block text-[12px] text-text-secondary">
          URL (optional)
        </label>
        <input
          className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://dashboard.stripe.com/apikeys"
        />

        <label className="mb-1 block text-[12px] text-text-secondary">
          Notes (optional)
        </label>
        <textarea
          className="mb-5 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context..."
          rows={2}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim() || !value.trim()}
            className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : secret ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
