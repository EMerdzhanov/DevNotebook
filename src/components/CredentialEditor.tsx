import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryEntry } from "../types";
import * as api from "../hooks/useTauri";
import { IconLock, IconLink, IconUser, IconShield } from "./Icons";
import ConfirmDialog from "./ConfirmDialog";

interface CredentialItem {
  id: string;
  service: string;
  username: string;
  encrypted_password: string;
  url: string;
  totp_secret: string;
  notes: string;
}

interface CredentialStore {
  items: CredentialItem[];
}

interface CredentialEditorProps {
  entry: LibraryEntry;
  onSaved: () => void;
  onDelete: () => void;
}

function newId() {
  return Math.random().toString(36).substring(2, 10);
}

const emptyItem = (): CredentialItem => ({
  id: newId(),
  service: "",
  username: "",
  encrypted_password: "",
  url: "",
  totp_secret: "",
  notes: "",
});

function parseStore(content: string): CredentialStore {
  try {
    const parsed = JSON.parse(content);
    // New format: { items: [...] }
    if (Array.isArray(parsed.items)) return parsed;
    // Old single-credential format: migrate
    if (parsed.service !== undefined || parsed.username !== undefined) {
      return { items: [{ id: newId(), ...parsed }] };
    }
  } catch {}
  return { items: [] };
}

export default function CredentialEditor({ entry, onSaved, onDelete }: CredentialEditorProps) {
  const [store, setStore] = useState<CredentialStore>(() => parseStore(entry.content));
  const [title, setTitle] = useState(entry.title);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const parsed = parseStore(entry.content);
    setStore(parsed);
    setTitle(entry.title);
    // Auto-expand if only one item
    if (parsed.items.length === 1) setExpandedId(parsed.items[0].id);
    else setExpandedId(null);
  }, [entry.id, entry.content, entry.title]);

  const autoSave = useCallback(
    (newTitle: string, newStore: CredentialStore) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateLibraryEntry(entry.id, newTitle, JSON.stringify(newStore));
          onSaved();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 800);
    },
    [entry.id, onSaved],
  );

  const updateItem = (itemId: string, updates: Partial<CredentialItem>) => {
    const newStore = {
      items: store.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    };
    setStore(newStore);
    autoSave(title, newStore);
  };

  const addItem = () => {
    const item = emptyItem();
    const newStore = { items: [...store.items, item] };
    setStore(newStore);
    setExpandedId(item.id);
    autoSave(title, newStore);
  };

  const removeItem = (itemId: string) => {
    const newStore = { items: store.items.filter((i) => i.id !== itemId) };
    setStore(newStore);
    if (expandedId === itemId) setExpandedId(null);
    autoSave(title, newStore);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    autoSave(value, store);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconLock size={18} /></span>
          <span className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted">Credentials</span>
          <span className="text-[10px] text-text-dim">{store.items.length} {store.items.length === 1 ? "account" : "accounts"}</span>
        </div>
        <button
          className="rounded px-2 py-1 text-[11px] text-status-disconnected hover:bg-bg-input"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-lg">
          <input
            className="mb-5 w-full border-none bg-transparent text-xl font-semibold text-text-primary outline-none placeholder:text-text-dim"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Credential group name..."
          />

          {/* Credential items */}
          {store.items.map((item) => (
            <CredentialCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => setDeleteConfirm(item.id)}
              isSingle={store.items.length === 1}
            />
          ))}

          {/* Add button */}
          <button
            className="mt-3 w-full rounded border border-dashed border-accent/40 px-4 py-3 text-[13px] text-accent transition-colors hover:border-accent hover:bg-accent/5"
            onClick={addItem}
          >
            + Add Credential
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Remove Credential"
        message="This will remove this credential from the entry."
        confirmLabel="Remove"
        onConfirm={() => { if (deleteConfirm) removeItem(deleteConfirm); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ── Credential Card ──

function CredentialCard({
  item,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  isSingle,
}: {
  item: CredentialItem;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<CredentialItem>) => void;
  onRemove: () => void;
  isSingle: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpInput, setTotpInput] = useState("");
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState(30);
  const [totpValid, setTotpValid] = useState<boolean | null>(null);

  // Reset reveal state on item change
  useEffect(() => {
    setShowPassword(false);
    setDecryptedPassword("");
    setPasswordInput("");
    setTotpCode(null);
  }, [item.id]);

  // Password
  const handleSetPassword = async () => {
    if (!passwordInput.trim()) return;
    const encrypted = await api.encryptCredentialField(passwordInput);
    onUpdate({ encrypted_password: encrypted });
    setPasswordInput("");
  };

  const handleRevealPassword = async () => {
    if (!item.encrypted_password) return;
    const decrypted = await api.decryptCredentialField(item.encrypted_password);
    setDecryptedPassword(decrypted);
    setShowPassword(true);
    setTimeout(() => { setShowPassword(false); setDecryptedPassword(""); }, 15000);
  };

  const handleCopyPassword = async () => {
    if (!item.encrypted_password) return;
    const decrypted = await api.decryptCredentialField(item.encrypted_password);
    await navigator.clipboard.writeText(decrypted);
    setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
  };

  // TOTP
  const handleSetTotp = async () => {
    if (!totpInput.trim()) return;
    const valid = await api.validateTotpSecret(totpInput);
    if (!valid) { setTotpValid(false); return; }
    const encrypted = await api.encryptCredentialField(totpInput.trim());
    onUpdate({ totp_secret: encrypted });
    setTotpInput("");
    setShowTotpSetup(false);
    setTotpValid(null);
  };

  const refreshTotp = useCallback(async () => {
    if (!item.totp_secret) return;
    try {
      const result = await api.generateTotp(item.totp_secret);
      setTotpCode(result.code);
      setTotpRemaining(result.remaining_seconds);
    } catch { setTotpCode(null); }
  }, [item.totp_secret]);

  useEffect(() => {
    if (!item.totp_secret) return;
    refreshTotp();
    const interval = setInterval(refreshTotp, 1000);
    return () => clearInterval(interval);
  }, [item.totp_secret, refreshTotp]);

  const displayName = item.service || item.username || "New Credential";

  return (
    <div className="mb-2 rounded-lg border border-border bg-bg-card overflow-hidden">
      {/* Collapsed header */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-bg-input/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-accent"><IconUser size={14} /></span>
          <div>
            <div className="text-[13px] font-medium text-text-primary">{displayName}</div>
            {item.username && item.service && (
              <div className="text-[11px] text-text-muted">{item.username}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.totp_secret && totpCode && (
            <button
              className="rounded bg-bg-input px-2 py-0.5 font-mono text-[11px] text-accent hover:bg-accent/20"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(totpCode); }}
              title="Copy TOTP code"
            >
              {totpCode.substring(0, 3)} {totpCode.substring(3)}
            </button>
          )}
          {item.encrypted_password && (
            <button
              className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
              onClick={(e) => { e.stopPropagation(); handleCopyPassword(); }}
              title="Copy password"
            >
              Copy
            </button>
          )}
          <span className="text-[10px] text-text-dim">{isExpanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border-subtle px-4 py-4">
          {/* Service */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconShield size={11} /> Service
            </label>
            <input
              className="w-full rounded border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
              value={item.service}
              onChange={(e) => onUpdate({ service: e.target.value })}
              placeholder="e.g., Google Cloud, AWS"
            />
          </div>

          {/* Username */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconUser size={11} /> Username / Email
            </label>
            <div className="flex gap-1.5">
              <input
                className="flex-1 rounded border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
                value={item.username}
                onChange={(e) => onUpdate({ username: e.target.value })}
                placeholder="user@example.com"
              />
              <button className="rounded bg-bg-input px-2 py-1.5 text-[10px] text-text-muted hover:text-text-primary" onClick={() => navigator.clipboard.writeText(item.username)}>Copy</button>
            </div>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconLock size={11} /> Password
            </label>
            {item.encrypted_password ? (
              <div className="flex items-center gap-1.5 rounded border border-border bg-bg-input px-3 py-1.5">
                <span className="flex-1 font-mono text-[13px] text-text-primary">
                  {showPassword ? decryptedPassword : "••••••••••••"}
                </span>
                <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary" onClick={handleRevealPassword}>{showPassword ? "Hide" : "Reveal"}</button>
                <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-accent" onClick={handleCopyPassword}>Copy</button>
                <button className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-status-warning" onClick={() => onUpdate({ encrypted_password: "" })}>Clear</button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <input
                  className="flex-1 rounded border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSetPassword(); }}
                  placeholder="Enter password..."
                />
                <button className="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-bg-base hover:opacity-90 disabled:opacity-50" onClick={handleSetPassword} disabled={!passwordInput.trim()}>Save</button>
              </div>
            )}
          </div>

          {/* URL */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconLink size={11} /> URL
            </label>
            <div className="flex gap-1.5">
              <input
                className="flex-1 rounded border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
                value={item.url}
                onChange={(e) => onUpdate({ url: e.target.value })}
                placeholder="https://..."
              />
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center rounded bg-bg-input px-2 py-1.5 text-[10px] text-accent hover:opacity-80">Open</a>
              )}
            </div>
          </div>

          {/* TOTP */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconShield size={11} /> 2FA (TOTP)
            </label>
            {item.totp_secret ? (
              <div className="flex items-center justify-between rounded border border-border bg-bg-input px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center">
                    <svg className="absolute h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-border)" strokeWidth="2" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray={`${(totpRemaining / 30) * 100.5} 100.5`} strokeLinecap="round" />
                    </svg>
                    <span className="text-[8px] text-text-muted">{totpRemaining}s</span>
                  </div>
                  <span className="font-mono text-[20px] font-bold tracking-[0.15em] text-text-primary">
                    {totpCode ? `${totpCode.substring(0, 3)} ${totpCode.substring(3)}` : "------"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-accent" onClick={() => totpCode && navigator.clipboard.writeText(totpCode)}>Copy</button>
                  <button className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-status-disconnected" onClick={() => onUpdate({ totp_secret: "" })}>Remove</button>
                </div>
              </div>
            ) : showTotpSetup ? (
              <div>
                <p className="mb-1.5 text-[11px] text-text-dim">Enter the secret key from your 2FA setup</p>
                <div className="flex gap-1.5">
                  <input className="flex-1 rounded border border-border bg-bg-input px-3 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent" value={totpInput} onChange={(e) => { setTotpInput(e.target.value); setTotpValid(null); }} placeholder="JBSWY3DPEHPK3PXP" autoFocus />
                  <button className="rounded bg-accent px-3 py-1.5 text-[10px] font-medium text-bg-base" onClick={handleSetTotp}>Save</button>
                  <button className="rounded bg-bg-input px-2 py-1.5 text-[10px] text-text-muted" onClick={() => { setShowTotpSetup(false); setTotpInput(""); }}>Cancel</button>
                </div>
                {totpValid === false && <p className="mt-1 text-[10px] text-status-disconnected">Invalid secret</p>}
              </div>
            ) : (
              <button className="w-full rounded border border-dashed border-border px-3 py-2 text-left text-[11px] text-text-dim hover:border-accent hover:text-accent" onClick={() => setShowTotpSetup(true)}>+ Set up 2FA</button>
            )}
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="mb-1 block text-[11px] text-text-secondary">Notes</label>
            <textarea
              className="w-full rounded border border-border bg-bg-input px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Remove */}
          {!isSingle && (
            <button className="text-[11px] text-status-disconnected hover:underline" onClick={onRemove}>Remove this credential</button>
          )}
        </div>
      )}
    </div>
  );
}
