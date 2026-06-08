import { useState, useEffect, useCallback } from "react";
import * as api from "../hooks/useTauri";
import { IconLock, IconKey, IconLink, IconFolder } from "./Icons";

interface CredItem {
  id: string;
  name: string;
  masked_preview: string;
  url: string;
  category_name: string;
  category_id: string;
  project_id: string;
  project_name: string;
  source: string;
  library_content: string;
}

interface CredentialsOverviewProps {
  onEditSecret: (projectId: string, categoryId: string) => void;
  onEditLibraryEntry: (projectId: string, entryId: string) => void;
  onEditGlobalLibrary: (entryId: string) => void;
  onAddToProject: (projectId: string) => void;
}

export default function CredentialsOverview({ onEditSecret, onEditLibraryEntry, onEditGlobalLibrary, onAddToProject }: CredentialsOverviewProps) {
  const [items, setItems] = useState<CredItem[]>([]);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<string, { code: string; remaining: number }>>({});
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addMode, setAddMode] = useState<"global" | "project">("global");
  const [filterOpen, setFilterOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [detailItem, setDetailItem] = useState<CredItem | null>(null);
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);
  const [detailRevealed, setDetailRevealed] = useState(false);
  const [detailTotp, setDetailTotp] = useState<{ code: string; remaining: number } | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const data = await api.getAllCredentials();
      setItems(data);
    } catch (err) {
      console.error("Failed to load credentials:", err);
    }
  }, []);

  useEffect(() => {
    loadItems();
    api.getAllProjects().then((ps) => setProjects(ps.map((p) => ({ id: p.id, name: p.name })))).catch(() => {});
  }, [loadItems]);

  // Refresh TOTP codes for library credentials (list view)
  useEffect(() => {
    const libraryItems = items.filter((i) => i.source === "library" && i.library_content);
    if (libraryItems.length === 0) return;

    const refreshTotp = async () => {
      for (const item of libraryItems) {
        try {
          const parsed = JSON.parse(item.library_content);
          const credItems = parsed.items || (parsed.service !== undefined ? [parsed] : []);
          for (const cred of credItems) {
            if (cred.totp_secret) {
              const result = await api.generateTotp(cred.totp_secret);
              setTotpCodes((prev) => ({ ...prev, [`${item.id}-${cred.id || cred.service}`]: { code: result.code, remaining: result.remaining_seconds } }));
            }
          }
        } catch {}
      }
    };

    refreshTotp();
    const interval = setInterval(refreshTotp, 5000);
    return () => clearInterval(interval);
  }, [items]);

  // Refresh TOTP in detail modal
  useEffect(() => {
    if (!detailItem || !detailData?.totp_secret) return;
    const refresh = async () => {
      try {
        const result = await api.generateTotp(detailData.totp_secret);
        setDetailTotp({ code: result.code, remaining: result.remaining_seconds });
      } catch { setDetailTotp(null); }
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [detailItem, detailData?.totp_secret]);

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
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
        copyVal = parsed.password || value;
      } catch {}
      await handleCopy(copyVal, id);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyLibField = async (encryptedB64: string, itemKey: string) => {
    try {
      const value = await api.decryptCredentialField(encryptedB64);
      await handleCopy(value, itemKey);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Open detail modal
  const handleOpenDetail = async (item: CredItem) => {
    setDetailItem(item);
    setDetailRevealed(false);
    setDetailTotp(null);

    if (item.source === "secret") {
      try {
        const value = await api.revealSecret(item.id);
        try {
          const parsed = JSON.parse(value);
          setDetailData(parsed);
        } catch {
          setDetailData({ password: value });
        }
      } catch {
        setDetailData({ password: "(unable to decrypt)" });
      }
    } else {
      // Library credential — parse the content
      try {
        const parsed = JSON.parse(item.library_content);
        const credItems = parsed.items || (parsed.service !== undefined ? [parsed] : []);
        // For library items we store the parsed list for rendering
        setDetailData({ _library: JSON.stringify(credItems) });
      } catch {
        setDetailData(null);
      }
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    setDetailData(null);
    setDetailRevealed(false);
    setDetailTotp(null);
  };

  const handleEditSource = (item: CredItem) => {
    closeDetail();
    if (item.source === "secret") {
      onEditSecret(item.project_id, item.category_id);
    } else if (item.project_id) {
      onEditLibraryEntry(item.project_id, item.id);
    } else {
      onEditGlobalLibrary(item.id);
    }
  };

  const handleCreateGlobal = async () => {
    if (!addTitle.trim()) return;
    try {
      const entry = await api.createLibraryEntry("", addTitle.trim(), "Credentials", true);
      setShowAddMenu(false);
      setAddTitle("");
      setAddMode("global");
      onEditGlobalLibrary(entry.id);
    } catch (err) {
      console.error("Failed to create credential:", err);
    }
  };

  // Get unique project names for filter
  const projectNames = [...new Set(items.map((i) => i.project_name))].sort();

  // Filter items
  const filtered = items.filter((item) => {
    if (projectFilter && item.project_name !== projectFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.project_name.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by project
  const grouped: Record<string, CredItem[]> = {};
  for (const item of filtered) {
    const key = item.project_name || "Global";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Credentials</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{items.length} credential{items.length !== 1 ? "s" : ""} across {projectNames.length} project{projectNames.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="w-56 rounded border border-border bg-bg-input px-3 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search credentials..."
          />
          <div className="relative">
            <button
              className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] transition-colors ${
                projectFilter
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-bg-input text-text-primary"
              }`}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <span>{projectFilter || "All Projects"}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-bg-base py-1 shadow-lg">
                  <button
                    className={`flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors hover:bg-bg-input ${
                      !projectFilter ? "text-accent" : "text-text-primary"
                    }`}
                    onClick={() => { setProjectFilter(null); setFilterOpen(false); }}
                  >
                    All Projects
                  </button>
                  {projectNames.map((name) => (
                    <button
                      key={name}
                      className={`flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors hover:bg-bg-input ${
                        projectFilter === name ? "text-accent" : "text-text-primary"
                      }`}
                      onClick={() => { setProjectFilter(name); setFilterOpen(false); }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            className="rounded border border-border bg-bg-input px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/10"
            onClick={() => setShowAddMenu(true)}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add Credential modal */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setShowAddMenu(false); setAddTitle(""); setAddMode("global"); }}
        >
          <div
            className="w-[480px] overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[13px] font-medium text-text-primary">Add Credential</span>
              <button
                className="text-[14px] text-text-muted hover:text-text-primary"
                onClick={() => { setShowAddMenu(false); setAddTitle(""); setAddMode("global"); }}
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {/* Mode toggle */}
              <div className="mb-4 flex gap-1 rounded-lg border border-border bg-bg-input p-0.5">
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12px] transition-colors ${addMode === "global" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-primary"}`}
                  onClick={() => setAddMode("global")}
                >
                  Global Credential
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12px] transition-colors ${addMode === "project" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-primary"}`}
                  onClick={() => setAddMode("project")}
                >
                  Project Password
                </button>
              </div>

              {addMode === "global" ? (
                <>
                  <p className="mb-3 text-[11px] text-text-dim">Create a credential in the Global Library — accessible from all projects.</p>
                  <label className="mb-1 block text-[12px] text-text-secondary">Title</label>
                  <input
                    className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && addTitle.trim()) handleCreateGlobal(); }}
                    placeholder="e.g., Google, AWS, GitHub"
                    autoFocus
                  />
                  <button
                    className="w-full rounded bg-accent py-2 text-[12px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
                    disabled={!addTitle.trim()}
                    onClick={handleCreateGlobal}
                  >
                    Create
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-3 text-[11px] text-text-dim">Add a password to a project's Secrets section.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-card px-3 py-3 text-left transition-colors hover:border-accent/50 hover:bg-bg-input"
                        onClick={() => {
                          setShowAddMenu(false);
                          setAddTitle("");
                          setAddMode("global");
                          onAddToProject(p.id);
                        }}
                      >
                        <span className="text-accent"><IconFolder size={18} /></span>
                        <span className="text-[12px] text-text-secondary">{p.name}</span>
                      </button>
                    ))}
                    {projects.length === 0 && (
                      <div className="col-span-3 py-4 text-center text-[12px] text-text-dim">No projects available</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          data={detailData}
          revealed={detailRevealed}
          totp={detailTotp}
          copied={copied}
          onToggleReveal={() => setDetailRevealed(!detailRevealed)}
          onCopy={handleCopy}
          onCopyLibField={handleCopyLibField}
          onEdit={() => handleEditSource(detailItem)}
          onClose={closeDetail}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {Object.keys(grouped).length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            <div className="mb-2 text-accent"><IconLock size={40} /></div>
            <div className="text-[14px]">No credentials found</div>
            <div className="mt-1 text-[12px] text-text-dim">Add passwords in your projects or create credential entries in the Library</div>
          </div>
        ) : (
          Object.entries(grouped).map(([projectName, projectItems]) => (
            <div key={projectName} className="mb-6">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-accent">{projectName}</div>
              <div className="space-y-2">
                {projectItems.map((item) => {
                  if (item.source === "library") {
                    return <LibraryCredentialCard key={item.id} item={item} totpCodes={totpCodes} copied={copied} onCopyField={handleCopyLibField} onOpen={() => handleOpenDetail(item)} />;
                  }

                  // Regular secret password — clickable card
                  return (
                    <div
                      key={item.id}
                      className="group flex cursor-pointer items-center justify-between rounded-lg border border-border bg-bg-card p-4 transition-colors hover:border-accent/30"
                      onClick={() => handleOpenDetail(item)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-accent flex-shrink-0"><IconKey size={16} /></span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-text-primary">{item.name}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                            <span className="font-mono">{item.masked_preview}</span>
                            {item.url && (() => {
                              try {
                                return (
                                  <span className="flex items-center gap-1 text-accent">
                                    <IconLink size={10} /> {new URL(item.url).hostname}
                                  </span>
                                );
                              } catch { return null; }
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className={`rounded bg-bg-input px-2.5 py-1 text-[11px] ${copied === item.id ? "text-status-connected" : "text-text-secondary hover:text-accent"}`}
                          onClick={(e) => { e.stopPropagation(); handleCopySecret(item.id); }}
                        >
                          {copied === item.id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Detail Modal ──

function DetailModal({
  item,
  data,
  revealed,
  totp,
  copied,
  onToggleReveal,
  onCopy,
  onCopyLibField,
  onEdit,
  onClose,
}: {
  item: CredItem;
  data: Record<string, string> | null;
  revealed: boolean;
  totp: { code: string; remaining: number } | null;
  copied: string | null;
  onToggleReveal: () => void;
  onCopy: (value: string, key: string) => void;
  onCopyLibField: (encrypted: string, key: string) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const isLibrary = item.source === "library";

  // Parse library credential items
  let libCredItems: { id?: string; service?: string; username?: string; encrypted_password?: string; totp_secret?: string; url?: string }[] = [];
  if (isLibrary && data?._library) {
    try { libCredItems = JSON.parse(data._library); } catch {}
  }

  const mask = (val: string) => val.replace(/./g, "\u2022");

  const FIELD_LABELS: Record<string, string> = {
    username: "Username",
    password: "Password",
    url: "URL",
    host: "Host",
    port: "Port",
    database: "Database",
    connection_string: "Connection String",
    notes: "Notes",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-[80vh] overflow-y-auto overflow-hidden rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-accent">{isLibrary ? <IconLock size={18} /> : <IconKey size={18} />}</span>
            <div>
              <div className="text-[14px] font-medium text-text-primary">{item.name}</div>
              <div className="text-[11px] text-text-muted">{item.project_name}</div>
            </div>
          </div>
          <button
            className="text-[16px] text-text-muted hover:text-text-primary"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {!isLibrary && data && (
            <div className="space-y-3">
              {Object.entries(data)
                .filter(([key]) => key !== "totp_secret" && key !== "_library")
                .map(([key, value]) => {
                  if (!value) return null;
                  const isSecret = key === "password";
                  const displayValue = isSecret && !revealed ? mask(value) : value;
                  const label = FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

                  return (
                    <div key={key} className="group">
                      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-text-dim">{label}</div>
                      <div className="flex items-center justify-between rounded border border-border-subtle bg-bg-input px-3 py-2">
                        <span className={`text-[12px] ${isSecret ? "font-mono" : ""} ${key === "notes" ? "text-text-muted" : "text-text-primary"}`}>
                          {key === "url" ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                              <IconLink size={11} /> {value}
                            </a>
                          ) : displayValue}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {isSecret && (
                            <button
                              className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                              onClick={onToggleReveal}
                            >
                              {revealed ? "Hide" : "Reveal"}
                            </button>
                          )}
                          {key !== "notes" && (
                            <button
                              className={`rounded px-2 py-0.5 text-[10px] ${copied === `detail-${key}` ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                              onClick={() => onCopy(value, `detail-${key}`)}
                            >
                              {copied === `detail-${key}` ? "Copied!" : "Copy"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* TOTP */}
              {data.totp_secret && totp && (
                <div className="group">
                  <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-text-dim">2FA Code</div>
                  <div className="flex items-center justify-between rounded border border-border-subtle bg-bg-input px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[16px] tracking-widest text-accent">
                        {totp.code.substring(0, 3)} {totp.code.substring(3)}
                      </span>
                      <span className="text-[10px] text-text-dim">{totp.remaining}s</span>
                    </div>
                    <button
                      className={`rounded px-2 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${copied === "detail-totp" ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                      onClick={() => onCopy(totp.code, "detail-totp")}
                    >
                      {copied === "detail-totp" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Library credentials */}
          {isLibrary && libCredItems.length > 0 && (
            <div className="space-y-3">
              {libCredItems.map((cred, idx) => {
                const credKey = `${item.id}-${cred.id || cred.service || idx}`;
                return (
                  <div key={credKey} className="rounded-lg border border-border-subtle bg-bg-card">
                    <div className="border-b border-border-subtle/50 px-3.5 py-2">
                      <div className="text-[12px] font-medium text-text-primary">{cred.service || `Account ${idx + 1}`}</div>
                    </div>
                    <div className="space-y-0 divide-y divide-border-subtle/50">
                      {cred.username && (
                        <div className="group flex items-center justify-between px-3.5 py-2">
                          <div>
                            <div className="text-[10px] text-text-dim">Username</div>
                            <div className="text-[12px] text-text-primary">{cred.username}</div>
                          </div>
                          <button
                            className={`rounded px-2 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${copied === `detail-user-${credKey}` ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                            onClick={() => onCopy(cred.username!, `detail-user-${credKey}`)}
                          >
                            {copied === `detail-user-${credKey}` ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      )}
                      {cred.encrypted_password && (
                        <div className="group flex items-center justify-between px-3.5 py-2">
                          <div>
                            <div className="text-[10px] text-text-dim">Password</div>
                            <div className="font-mono text-[12px] text-text-muted">{"\u2022".repeat(12)}</div>
                          </div>
                          <button
                            className={`rounded px-2 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${copied === `detail-pw-${credKey}` ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                            onClick={() => onCopyLibField(cred.encrypted_password!, `detail-pw-${credKey}`)}
                          >
                            {copied === `detail-pw-${credKey}` ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      )}
                      {cred.url && (
                        <div className="px-3.5 py-2">
                          <div className="text-[10px] text-text-dim">URL</div>
                          <a href={cred.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-accent hover:underline">
                            <IconLink size={10} /> {cred.url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isLibrary && libCredItems.length === 0 && (
            <div className="py-4 text-center text-[12px] text-text-dim">No accounts in this credential set</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            className="rounded border border-border bg-bg-input px-3 py-1.5 text-[12px] text-text-secondary transition-colors hover:text-text-primary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/20"
            onClick={() => onEdit()}
          >
            {isLibrary ? (item.project_id ? "Edit in Project Library" : "Edit in Global Library") : "Edit in Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Library Credential Card (list view) ──

function LibraryCredentialCard({
  item,
  totpCodes,
  copied,
  onCopyField,
  onOpen,
}: {
  item: CredItem;
  totpCodes: Record<string, { code: string; remaining: number }>;
  copied: string | null;
  onCopyField: (encrypted: string, key: string) => void;
  onOpen: () => void;
}) {
  let credItems: { id?: string; service?: string; username?: string; encrypted_password?: string; totp_secret?: string; url?: string }[] = [];
  try {
    const parsed = JSON.parse(item.library_content);
    credItems = parsed.items || (parsed.service !== undefined ? [parsed] : []);
  } catch {}

  if (credItems.length === 0) {
    return (
      <div
        className="cursor-pointer rounded-lg border border-border bg-bg-card p-4 transition-colors hover:border-accent/30"
        onClick={onOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconLock size={16} /></span>
          <span className="text-[13px] font-medium text-text-primary">{item.name}</span>
          <span className="text-[10px] text-text-dim">Empty</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card transition-colors hover:border-accent/30">
      <div
        className="group flex cursor-pointer items-center justify-between border-b border-border-subtle px-4 py-2.5"
        onClick={onOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconLock size={14} /></span>
          <span className="text-[13px] font-medium text-text-primary">{item.name}</span>
          <span className="rounded bg-bg-input px-1.5 py-0.5 text-[9px] text-text-dim">{credItems.length} account{credItems.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {credItems.map((cred, idx) => {
        const credKey = `${item.id}-${cred.id || cred.service || idx}`;
        const totp = totpCodes[credKey];
        return (
          <div key={credKey} className="group flex items-center justify-between border-b border-border-subtle/50 px-4 py-2.5 last:border-0">
            <div>
              <div className="text-[12px] text-text-primary">{cred.service || cred.username || `Account ${idx + 1}`}</div>
              {cred.username && cred.service && <div className="mt-0.5 text-[11px] text-text-muted">{cred.username}</div>}
            </div>
            <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              {totp && (
                <button
                  className={`rounded bg-bg-input px-2 py-0.5 font-mono text-[11px] ${copied === `totp-${credKey}` ? "text-status-connected" : "text-accent hover:bg-accent/20"}`}
                  onClick={() => { navigator.clipboard.writeText(totp.code); }}
                  title="Copy TOTP"
                >
                  {totp.code.substring(0, 3)} {totp.code.substring(3)}
                </button>
              )}
              {cred.encrypted_password && (
                <button
                  className={`rounded bg-bg-input px-2 py-0.5 text-[10px] ${copied === `pw-${credKey}` ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                  onClick={() => onCopyField(cred.encrypted_password!, `pw-${credKey}`)}
                >
                  {copied === `pw-${credKey}` ? "Copied!" : "Copy Password"}
                </button>
              )}
              {cred.username && (
                <button
                  className="rounded bg-bg-input px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                  onClick={() => { navigator.clipboard.writeText(cred.username!); }}
                >
                  Copy User
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
