import { useState, useEffect } from "react";
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

  useEffect(() => {
    api.getAutoLockTimeout().then(setLockTimeout).catch(() => {});
  }, []);

  const handleTimeoutChange = async (minutes: number) => {
    setLockTimeout(minutes);
    try {
      await api.setAutoLockTimeout(minutes);
    } catch (err) {
      console.error("Failed to set auto-lock timeout:", err);
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

      {/* About Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          About
        </h4>
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
      </div>
    </div>
  );
}
