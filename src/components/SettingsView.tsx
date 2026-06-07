import { useState, useEffect, useRef } from "react";
import { themes } from "../themes";

interface PairingInfo {
  qr_svg: string;
  url: string;
}

interface PairedDevice {
  name: string;
  address: string;
  ip: string;
}

interface SettingsViewProps {
  bluetoothStatus: string;
  activeThemeId: string;
  pairing: PairingInfo | null;
  pairedDevice: PairedDevice | null;
  sensitivity: number;
  onThemeChange: (id: string) => void;
  onStartPairing: () => Promise<PairingInfo>;
  onCheckPairingConfirmed: () => Promise<PairedDevice | null>;
  onCompletePairing: (device: PairedDevice) => Promise<void>;
  onCancelPairing: () => Promise<void>;
  onUnpairDevice: () => Promise<void>;
  onUpdateSensitivity: (threshold: number) => Promise<void>;
  onLockVault: () => void;
}

export default function SettingsView({
  bluetoothStatus,
  activeThemeId,
  pairing,
  pairedDevice,
  sensitivity,
  onThemeChange,
  onStartPairing,
  onCheckPairingConfirmed,
  onCompletePairing,
  onCancelPairing,
  onUnpairDevice,
  onUpdateSensitivity,
  onLockVault,
}: SettingsViewProps) {
  const [pairingError, setPairingError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for pairing confirmation — auto-completes when phone taps "Pair"
  useEffect(() => {
    if (!pairing) return;

    pollRef.current = setInterval(async () => {
      const device = await onCheckPairingConfirmed();
      if (device) {
        if (pollRef.current) clearInterval(pollRef.current);
        try {
          await onCompletePairing(device);
        } catch (err) {
          setPairingError(String(err));
        }
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pairing, onCheckPairingConfirmed, onCompletePairing]);

  const handleStartPairing = async () => {
    setPairingError(null);
    try {
      await onStartPairing();
    } catch (err) {
      setPairingError(String(err));
    }
  };

  const handleCancel = async () => {
    await onCancelPairing();
  };

  const delayLabel = (val: number) => {
    if (val <= 10) return "Fast (10s)";
    if (val <= 15) return "Normal (15s)";
    if (val <= 30) return "Relaxed (30s)";
    return "Slow (60s)";
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

      {/* Proximity Lock Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Proximity Lock
        </h4>
        <div className="rounded-md border border-border bg-bg-card p-4">
          {pairedDevice ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-text-primary">{pairedDevice.name}</div>
                  <div className="mt-1 text-[12px] text-text-muted">
                    Status: {bluetoothStatus}
                  </div>
                </div>
                <button
                  className="rounded bg-bg-input px-3 py-1.5 text-[12px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                  onClick={onUnpairDevice}
                >
                  Unpair
                </button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-text-primary">Lock Delay</div>
                  <div className="text-[12px] text-accent">{delayLabel(sensitivity)}</div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={sensitivity}
                  onChange={(e) => onUpdateSensitivity(Number(e.target.value))}
                  className="mt-2 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                  <span>Fast (10s)</span>
                  <span>Slow (60s)</span>
                </div>
              </div>
            </>
          ) : pairing ? (
            <div className="text-center">
              <div className="text-[14px] text-text-primary mb-3">
                Scan this QR code with your phone
              </div>
              <div
                className="mx-auto mb-3 inline-block rounded-lg bg-bg-base p-3"
                dangerouslySetInnerHTML={{ __html: pairing.qr_svg }}
              />
              <div className="text-[11px] text-text-dim mb-4">
                Tap "Pair This Phone" on the page that opens — pairing completes automatically
              </div>
              <button
                className="rounded bg-bg-input px-4 py-2 text-[12px] text-text-muted hover:text-text-primary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-[14px] text-text-primary">No device paired</div>
                <div className="mt-1 text-[12px] text-text-muted">
                  Pair your phone to auto-lock when you walk away
                </div>
              </div>
              <button
                className="rounded border border-accent bg-bg-input px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
                onClick={handleStartPairing}
              >
                Pair Phone
              </button>
            </>
          )}

          {pairingError && (
            <div className="mt-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
              {pairingError}
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Security
        </h4>
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
