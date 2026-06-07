import { useState, useEffect, useCallback } from "react";
import type { Secret } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";
import StructuredSecretModal, { hasStructuredForm, getCategoryFields } from "./StructuredSecretModal";
import { IconLink } from "./Icons";

interface SecretListViewProps {
  categoryId: string;
  categoryName: string;
}

export default function SecretListView({
  categoryId,
  categoryName,
}: SecretListViewProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, string> | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState(30);

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
    setExpandedId(null);
    setExpandedData(null);
  }, [loadSecrets]);

  // TOTP refresh for expanded card
  useEffect(() => {
    if (!expandedData?.totp_secret) { setTotpCode(null); return; }
    const refresh = async () => {
      try {
        const result = await api.generateTotp(expandedData.totp_secret);
        setTotpCode(result.code);
        setTotpRemaining(result.remaining_seconds);
      } catch { setTotpCode(null); }
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [expandedData?.totp_secret]);

  const handleExpand = async (secret: Secret) => {
    if (expandedId === secret.id) {
      setExpandedId(null);
      setExpandedData(null);
      setRevealedFields({});
      return;
    }
    setExpandedId(secret.id);
    setRevealedFields({});
    try {
      const value = await api.revealSecret(secret.id);
      try {
        const parsed = JSON.parse(value);
        setExpandedData(parsed);
      } catch {
        setExpandedData({ value });
      }
    } catch {
      setExpandedData({ value: "(unable to decrypt)" });
    }
  };

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
  };

  const handleCopySecret = async (id: string) => {
    try {
      const value = await api.revealSecret(id);
      let copyVal = value;
      try {
        const parsed = JSON.parse(value);
        copyVal = parsed.password || parsed.api_key || parsed.private_key || parsed.client_secret || value;
      } catch {}
      handleCopy(copyVal, `quick-${id}`);
    } catch (err) {
      console.error("Failed to copy secret:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSecret(id);
      if (expandedId === id) { setExpandedId(null); setExpandedData(null); }
      await loadSecrets();
    } catch (err) {
      console.error("Failed to delete secret:", err);
    }
  };

  const mask = (val: string) => val.replace(/./g, "\u2022");

  const isStructured = hasStructuredForm(categoryName);
  const fields = isStructured ? getCategoryFields(categoryName) : [];

  const FIELD_LABELS: Record<string, string> = {};
  for (const f of fields) {
    FIELD_LABELS[f.key] = f.label;
  }

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
          {secrets.map((secret) => {
            const isExpanded = expandedId === secret.id;
            return (
              <div
                key={secret.id}
                className={`rounded-lg border bg-bg-card transition-colors ${isExpanded ? "border-accent/30" : "border-border"}`}
              >
                {/* Collapsed header — always visible */}
                <div
                  className="group flex cursor-pointer items-center justify-between p-3.5"
                  onClick={() => handleExpand(secret)}
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
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        </a>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[12px] text-text-muted">
                      {secret.masked_preview}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`rounded bg-bg-input px-2.5 py-1 text-[11px] ${copied === `quick-${secret.id}` ? "text-status-connected" : "text-text-secondary hover:text-accent"}`}
                      onClick={() => handleCopySecret(secret.id)}
                    >
                      {copied === `quick-${secret.id}` ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Expanded view card */}
                {isExpanded && expandedData && (
                  <div className="border-t border-border-subtle">
                    <div className="space-y-0 divide-y divide-border-subtle/50">
                      {isStructured ? (
                        // Structured fields from category definition
                        fields.map((field) => {
                          const value = expandedData[field.key];
                          if (!value || field.type === "totp") return null;
                          const isSecret = field.type === "password";
                          const isRevealed = revealedFields[field.key];
                          const displayValue = isSecret && !isRevealed ? mask(value) : value;

                          return (
                            <div key={field.key} className="group flex items-center justify-between px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-medium uppercase tracking-wider text-text-dim">{field.label}</div>
                                <div className={`mt-0.5 text-[12px] ${isSecret ? "font-mono" : ""} ${field.type === "textarea" ? "whitespace-pre-wrap text-text-muted" : "text-text-primary"}`}>
                                  {field.type === "url" ? (
                                    <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                                      <IconLink size={10} /> {value}
                                    </a>
                                  ) : field.key === "env_pairs" ? (
                                    <pre className="font-mono text-[11px]">{displayValue}</pre>
                                  ) : displayValue}
                                </div>
                              </div>
                              <div className="ml-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                                {isSecret && (
                                  <button
                                    className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                                    onClick={() => setRevealedFields((p) => ({ ...p, [field.key]: !p[field.key] }))}
                                  >
                                    {isRevealed ? "Hide" : "Reveal"}
                                  </button>
                                )}
                                {field.type !== "textarea" && (
                                  <button
                                    className={`rounded px-2 py-0.5 text-[10px] ${copied === `field-${field.key}` ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                                    onClick={() => handleCopy(value, `field-${field.key}`)}
                                  >
                                    {copied === `field-${field.key}` ? "Copied!" : "Copy"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        // Plain key-value secret
                        <div className="group flex items-center justify-between px-4 py-2.5">
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-text-dim">Value</div>
                            <div className="mt-0.5 font-mono text-[12px] text-text-primary">
                              {revealedFields["value"] ? expandedData.value : mask(expandedData.value || "")}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                              onClick={() => setRevealedFields((p) => ({ ...p, value: !p.value }))}
                            >
                              {revealedFields["value"] ? "Hide" : "Reveal"}
                            </button>
                            <button
                              className={`rounded px-2 py-0.5 text-[10px] ${copied === "field-value" ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                              onClick={() => handleCopy(expandedData.value || "", "field-value")}
                            >
                              {copied === "field-value" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TOTP section */}
                      {expandedData.totp_secret && totpCode && (
                        <div className="group flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-9 w-9 items-center justify-center">
                              <svg className="absolute h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-border)" strokeWidth="2" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray={`${(totpRemaining / 30) * 100.5} 100.5`} strokeLinecap="round" />
                              </svg>
                              <span className="text-[8px] text-text-muted">{totpRemaining}s</span>
                            </div>
                            <div>
                              <div className="text-[10px] font-medium uppercase tracking-wider text-text-dim">2FA Code</div>
                              <span className="font-mono text-[18px] font-bold tracking-[0.15em] text-text-primary">
                                {totpCode.substring(0, 3)} {totpCode.substring(3)}
                              </span>
                            </div>
                          </div>
                          <button
                            className={`rounded px-2 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${copied === "totp" ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                            onClick={() => handleCopy(totpCode, "totp")}
                          >
                            {copied === "totp" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-2.5">
                      <button
                        className="rounded bg-bg-input px-3 py-1 text-[11px] text-text-secondary transition-colors hover:text-accent"
                        onClick={() => {
                          setEditingSecret(secret);
                          setShowAddModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded bg-bg-input px-3 py-1 text-[11px] text-status-disconnected transition-colors hover:bg-status-disconnected hover:text-white"
                        onClick={() => setDeleteConfirm(secret.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && hasStructuredForm(categoryName) ? (
        <StructuredSecretModal
          categoryId={categoryId}
          categoryName={categoryName}
          secret={editingSecret}
          onClose={() => {
            setShowAddModal(false);
            setEditingSecret(null);
          }}
          onSaved={() => {
            loadSecrets();
            setExpandedId(null);
            setExpandedData(null);
          }}
        />
      ) : showAddModal && (
        <SecretEditModal
          categoryId={categoryId}
          secret={editingSecret}
          onClose={() => {
            setShowAddModal(false);
            setEditingSecret(null);
          }}
          onSaved={() => {
            loadSecrets();
            setExpandedId(null);
            setExpandedData(null);
          }}
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

// ── Secret Edit Modal (plain, non-structured) ──

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
