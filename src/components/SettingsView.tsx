import { useState, useEffect } from "react";
import { save as dialogSave } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { themes } from "../themes";
import * as api from "../hooks/useTauri";

interface SettingsViewProps {
  activeThemeId: string;
  onThemeChange: (id: string) => void;
  onLockVault: () => void;
}

export default function SettingsView({
  activeThemeId,
  onThemeChange,
  onLockVault,
}: SettingsViewProps) {
  const [lockTimeout, setLockTimeout] = useState(30);
  const [authMethods, setAuthMethods] = useState({ password: true, pin: false, biometric: false });
  const [preferredAuth, setPreferredAuth] = useState("password");
  const [showSetPin, setShowSetPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    api.getAutoLockTimeout().then(setLockTimeout).catch(() => {});
    api.getAuthMethods().then(setAuthMethods).catch(() => {});
    api.getPreferredAuthLocked().then(setPreferredAuth).catch(() => {});
  }, []);

  const handleTimeoutChange = async (minutes: number) => {
    setLockTimeout(minutes);
    try {
      await api.setAutoLockTimeout(minutes);
    } catch (err) {
      console.error("Failed to set auto-lock timeout:", err);
    }
  };

  const handleSetPin = async () => {
    setPinError(null);
    if (pinInput.length < 4 || pinInput.length > 8) {
      setPinError("PIN must be 4-8 digits");
      return;
    }
    if (!/^\d+$/.test(pinInput)) {
      setPinError("PIN must contain only digits");
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError("PINs do not match");
      return;
    }
    try {
      await api.setPin(pinInput);
      setAuthMethods((m) => ({ ...m, pin: true }));
      setShowSetPin(false);
      setPinInput("");
      setPinConfirm("");
    } catch (err) {
      setPinError(String(err));
    }
  };

  const handleRemovePin = async () => {
    try {
      await api.removePin();
      setAuthMethods((m) => ({ ...m, pin: false }));
    } catch (err) {
      console.error("Failed to remove PIN:", err);
    }
  };

  const handleToggleBiometric = async () => {
    setBioError(null);
    try {
      if (authMethods.biometric) {
        await api.disableBiometric();
        setAuthMethods((m) => ({ ...m, biometric: false }));
      } else {
        await api.enableBiometric();
        setAuthMethods((m) => ({ ...m, biometric: true }));
      }
    } catch (err) {
      setBioError(String(err));
    }
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPw.length < 4) {
      setPwError("New password must be at least 4 characters");
      return;
    }
    try {
      await api.changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => { setShowChangePassword(false); setPwSuccess(false); }, 2000);
    } catch (err) {
      setPwError(String(err));
    }
  };

  const timeoutLabel = (val: number) => {
    if (val === 0) return "Disabled";
    if (val === 1) return "1 minute";
    return `${val} minutes`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h3 className="mb-6 text-lg font-medium text-text-primary">Settings</h3>

      {/* Appearance Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Appearance
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((theme) => {
            const isActive = theme.id === activeThemeId;
            const c = theme.colors;
            return (
              <button
                key={theme.id}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                  isActive
                    ? "border-accent bg-bg-card"
                    : "border-border bg-bg-card/50 hover:border-border hover:bg-bg-card"
                }`}
                onClick={() => onThemeChange(theme.id)}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 overflow-hidden rounded"
                  style={{ background: c.bgBase }}
                >
                  <div className="flex w-3 flex-col" style={{ background: c.bgSidebar }}>
                    <div className="mt-2 mx-auto h-1 w-1.5 rounded-sm" style={{ background: c.accent }} />
                    <div className="mt-1 mx-auto h-1 w-1.5 rounded-sm" style={{ background: c.textMuted }} />
                    <div className="mt-1 mx-auto h-1 w-1.5 rounded-sm" style={{ background: c.textMuted }} />
                  </div>
                  <div className="flex-1 p-1">
                    <div className="h-1 w-3/4 rounded-sm" style={{ background: c.textPrimary }} />
                    <div className="mt-1 h-1 w-full rounded-sm" style={{ background: c.textSecondary }} />
                    <div className="mt-1 h-1 w-2/3 rounded-sm" style={{ background: c.textMuted }} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary">
                      {theme.name}
                    </span>
                    {isActive && (
                      <span className="text-[11px] text-accent">Active</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">{theme.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Security
        </h4>
        <div className="space-y-4">
          {/* Lock Vault */}
          <div className="rounded-md border border-border bg-bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] text-text-primary">Lock Vault</div>
                <div className="mt-1 text-[12px] text-text-muted">
                  Lock now and require master password to re-enter
                </div>
              </div>
              <button
                className="rounded bg-bg-input px-4 py-2 text-[13px] text-text-secondary hover:bg-status-warning hover:text-bg-base"
                onClick={onLockVault}
              >
                Lock Now
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-md border border-border bg-bg-card p-4">
            {!showChangePassword ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-text-primary">Change Password</div>
                  <div className="mt-1 text-[12px] text-text-muted">
                    Update your master password
                  </div>
                </div>
                <button
                  className="rounded bg-bg-input px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
                  onClick={() => { setShowChangePassword(true); setPwError(null); setPwSuccess(false); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-3 text-[14px] text-text-primary">Change Password</div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[12px] text-text-secondary">Current Password</label>
                    <input
                      type="password"
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] text-text-secondary">New Password</label>
                    <input
                      type="password"
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] text-text-secondary">Confirm New Password</label>
                    <input
                      type="password"
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                    />
                  </div>
                </div>
                {pwError && (
                  <div className="mt-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="mt-3 rounded bg-status-connected/10 px-3 py-2 text-[12px] text-status-connected">
                    Password changed successfully
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
                    onClick={() => { setShowChangePassword(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwError(null); setPwSuccess(false); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base hover:opacity-90 disabled:opacity-50"
                    onClick={handleChangePassword}
                    disabled={!currentPw || !newPw || !confirmPw}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Authentication Methods */}
          <div className="rounded-md border border-border bg-bg-card p-4">
            <div className="mb-3 text-[14px] text-text-primary">Authentication Methods</div>
            <div className="space-y-3">
              {/* PIN */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-text-primary">PIN Unlock</div>
                  <div className="text-[11px] text-text-dim">Quick unlock with a numeric PIN</div>
                </div>
                {authMethods.pin ? (
                  <button
                    className="rounded bg-bg-input px-3 py-1.5 text-[12px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                    onClick={handleRemovePin}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    className="rounded bg-bg-input px-3 py-1.5 text-[12px] text-accent hover:bg-accent hover:text-bg-base"
                    onClick={() => { setShowSetPin(true); setPinError(null); }}
                  >
                    Set PIN
                  </button>
                )}
              </div>

              {showSetPin && (
                <div className="rounded border border-border bg-bg-base p-3">
                  <div className="space-y-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-center text-[16px] tracking-[0.5em] text-text-primary outline-none focus:border-accent"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter PIN"
                      autoFocus
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-center text-[16px] tracking-[0.5em] text-text-primary outline-none focus:border-accent"
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                      placeholder="Confirm PIN"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSetPin(); }}
                    />
                  </div>
                  {pinError && (
                    <div className="mt-2 text-[12px] text-status-disconnected">{pinError}</div>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      className="rounded px-3 py-1.5 text-[12px] text-text-muted hover:text-text-primary"
                      onClick={() => { setShowSetPin(false); setPinInput(""); setPinConfirm(""); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded bg-accent px-3 py-1.5 text-[12px] font-medium text-bg-base hover:opacity-90"
                      onClick={handleSetPin}
                    >
                      Save PIN
                    </button>
                  </div>
                </div>
              )}

              {/* Biometric */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-text-primary">Fingerprint Unlock</div>
                  <div className="text-[11px] text-text-dim">Touch ID (Mac) or Windows Hello</div>
                </div>
                <button
                  className={`rounded px-3 py-1.5 text-[12px] transition-colors ${
                    authMethods.biometric
                      ? "bg-accent/10 text-accent font-medium"
                      : "bg-bg-input text-text-muted hover:text-text-primary"
                  }`}
                  onClick={handleToggleBiometric}
                >
                  {authMethods.biometric ? "Enabled" : "Enable"}
                </button>
              </div>
              {bioError && (
                <div className="text-[12px] text-status-disconnected">{bioError}</div>
              )}

              {/* Default Login Method */}
              {(authMethods.pin || authMethods.biometric) && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-2 text-[13px] text-text-primary">Default Login Method</div>
                  <div className="flex gap-2">
                    {(["password", "pin", "biometric"] as const).map((method) => {
                      const enabled = method === "password" || (method === "pin" && authMethods.pin) || (method === "biometric" && authMethods.biometric);
                      if (!enabled) return null;
                      return (
                        <button
                          key={method}
                          className={`flex-1 rounded border py-1.5 text-[12px] capitalize transition-colors ${
                            preferredAuth === method
                              ? "border-accent bg-accent/10 text-accent font-medium"
                              : "border-border bg-bg-input text-text-muted hover:text-text-primary"
                          }`}
                          onClick={async () => {
                            setPreferredAuth(method);
                            await api.setPreferredAuth(method);
                          }}
                        >
                          {method === "biometric" ? "Fingerprint" : method === "pin" ? "PIN" : "Password"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 text-[11px] text-text-dim">
                    Shown first on the lock screen
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Lock Timer */}
          <div className="rounded-md border border-border bg-bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-[14px] text-text-primary">Auto-Lock After Inactivity</div>
              <div className="text-[12px] text-accent">{timeoutLabel(lockTimeout)}</div>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={lockTimeout}
              onChange={(e) => handleTimeoutChange(Number(e.target.value))}
              className="mt-2 w-full accent-accent"
            />
            <div className="mt-1 flex justify-between text-[10px] text-text-dim">
              <span>Off</span>
              <span>60 min</span>
            </div>
            <div className="mt-2 text-[11px] text-text-dim">
              Vault locks automatically after no mouse or keyboard activity
            </div>
          </div>

          {/* Keyboard Shortcut Info */}
          <div className="rounded-md border border-border bg-bg-card p-4">
            <div className="text-[14px] text-text-primary">Keyboard Shortcuts</div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-muted">Lock vault</span>
                <kbd className="rounded border border-border bg-bg-input px-2 py-0.5 font-mono text-[11px] text-text-secondary">⌘L</kbd>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-muted">Also locks on</span>
                <span className="text-[11px] text-text-dim">Screen lock · Sleep · Lid close</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Data
        </h4>
        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-text-primary">Export Vault</div>
              <div className="mt-1 text-[12px] text-text-muted">
                Export projects, notes, todos, library, and journal as JSON
              </div>
              <div className="mt-0.5 text-[11px] text-text-dim">
                Secret values are NOT included — only names and masked previews
              </div>
            </div>
            <button
              className="rounded bg-bg-input px-4 py-2 text-[13px] text-text-secondary hover:text-accent"
              onClick={async () => {
                try {
                  const path = await dialogSave({
                    defaultPath: `devnotebook-export-${new Date().toISOString().slice(0, 10)}.json`,
                    filters: [{ name: "JSON", extensions: ["json"] }],
                  });
                  if (path) {
                    await api.exportVaultToFile(path);
                  }
                } catch (err) {
                  console.error("Export failed:", err);
                }
              }}
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          About
        </h4>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-bg-card p-4">
            <div className="text-[14px] text-text-primary">
              Dev<span className="text-accent">Notebook</span>
            </div>
            <div className="mt-1 text-[12px] text-text-muted">
              Version 0.1.0 — Secure developer notebook
            </div>
            <div className="mt-1 text-[11px] text-text-dim">
              Encryption: AES-256-GCM + SQLCipher | Key derivation: Argon2id
            </div>
          </div>

          <UpdateChecker />
        </div>
      </div>
    </div>
  );
}

function UpdateChecker() {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "downloading" | "ready" | "uptodate" | "error">("idle");
  const [updateVersion, setUpdateVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const checkForUpdate = async () => {
    setStatus("checking");
    setErrorMsg("");
    try {
      const update = await check();
      if (update) {
        setUpdateVersion(update.version);
        setStatus("available");
      } else {
        setStatus("uptodate");
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  };

  const downloadAndInstall = async () => {
    setStatus("downloading");
    try {
      const update = await check();
      if (!update) return;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          setProgress(0);
        } else if (event.event === "Progress") {
          setProgress((p) => p + (event.data.chunkLength || 0));
        } else if (event.event === "Finished") {
          setStatus("ready");
        }
      });

      setStatus("ready");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  return (
    <div className="rounded-md border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] text-text-primary">Updates</div>
          <div className="mt-1 text-[12px] text-text-muted">
            {status === "idle" && "Check for new versions"}
            {status === "checking" && "Checking for updates..."}
            {status === "uptodate" && "You're on the latest version"}
            {status === "available" && `Version ${updateVersion} is available`}
            {status === "downloading" && "Downloading update..."}
            {status === "ready" && "Update installed — restart to apply"}
            {status === "error" && "Update check failed"}
          </div>
          {status === "error" && errorMsg && (
            <div className="mt-1 text-[11px] text-status-disconnected">{errorMsg}</div>
          )}
        </div>
        <div>
          {(status === "idle" || status === "uptodate" || status === "error") && (
            <button
              className="rounded bg-bg-input px-4 py-2 text-[13px] text-text-secondary hover:text-accent"
              onClick={checkForUpdate}
            >
              Check
            </button>
          )}
          {status === "checking" && (
            <span className="text-[12px] text-text-dim">...</span>
          )}
          {status === "available" && (
            <button
              className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base hover:opacity-90"
              onClick={downloadAndInstall}
            >
              Update
            </button>
          )}
          {status === "downloading" && (
            <span className="text-[12px] text-accent">{Math.round(progress / 1024)}KB</span>
          )}
          {status === "ready" && (
            <button
              className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base hover:opacity-90"
              onClick={handleRelaunch}
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
