import { useState, useEffect, useRef } from "react";
import { themes } from "../themes";

interface PairingInfo {
  qr_svg: string;
  url: string;
}

interface PairedDevice {
  name: string;
  address: string;
}

interface SettingsViewProps {
  bluetoothStatus: string;
  activeThemeId: string;
  pairing: PairingInfo | null;
  pairedDevice: PairedDevice | null;
  sensitivity: number;
  onThemeChange: (id: string) => void;
  onStartPairing: () => Promise<PairingInfo>;
  onCheckPairingConfirmed: () => Promise<boolean>;
  onCompletePairing: (name: string, address: string) => Promise<void>;
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
  const [waitingForConfirm, setWaitingForConfirm] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deviceAddress, setDeviceAddress] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pairing || waitingForConfirm) return;

    pollRef.current = setInterval(async () => {
      const confirmed = await onCheckPairingConfirmed();
      if (confirmed) {
        setWaitingForConfirm(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pairing, waitingForConfirm, onCheckPairingConfirmed]);

  const handleStartPairing = async () => {
    setPairingError(null);
    try {
      await onStartPairing();
    } catch (err) {
      setPairingError(String(err));
    }
  };

  const handleCompletePairing = async () => {
    if (!deviceName.trim() || !deviceAddress.trim()) return;
    try {
      await onCompletePairing(deviceName.trim(), deviceAddress.trim());
      setWaitingForConfirm(false);
      setDeviceName("");
      setDeviceAddress("");
      setShowManualEntry(false);
    } catch (err) {
      setPairingError(String(err));
    }
  };

  const handleCancel = async () => {
    await onCancelPairing();
    setWaitingForConfirm(false);
    setDeviceName("");
    setDeviceAddress("");
    setShowManualEntry(false);
  };

  const sensitivityLabel = (val: number) => {
    if (val >= -60) return "Tight (~6ft)";
    if (val >= -70) return "Close (~10ft)";
    if (val >= -80) return "Medium (~20ft)";
    return "Loose (~30ft)";
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

      {/* Bluetooth Proximity Lock Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Bluetooth Proximity Lock
        </h4>
        <div className="rounded-md border border-border bg-bg-card p-4">
          {pairedDevice ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-text-primary">{pairedDevice.name}</div>
                  <div className="mt-1 text-[12px] text-text-muted">
                    Status: {bluetoothStatus} — {pairedDevice.address}
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
                  <div className="text-[13px] text-text-primary">Lock Sensitivity</div>
                  <div className="text-[12px] text-accent">{sensitivityLabel(sensitivity)}</div>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={-55}
                  step={5}
                  value={sensitivity}
                  onChange={(e) => onUpdateSensitivity(Number(e.target.value))}
                  className="mt-2 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                  <span>Loose (~30ft)</span>
                  <span>Tight (~6ft)</span>
                </div>
              </div>
            </>
          ) : pairing ? (
            <>
              {!waitingForConfirm ? (
                <div className="text-center">
                  <div className="text-[14px] text-text-primary mb-3">
                    Scan this QR code with your phone
                  </div>
                  <div
                    className="mx-auto mb-3 inline-block rounded-lg bg-bg-base p-3"
                    dangerouslySetInnerHTML={{ __html: pairing.qr_svg }}
                  />
                  <div className="text-[11px] text-text-dim mb-4">
                    Opens a page to guide you through Bluetooth pairing
                  </div>
                  <button
                    className="rounded bg-bg-input px-4 py-2 text-[12px] text-text-muted hover:text-text-primary"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-[14px] text-text-primary mb-2">
                    Phone connected! Now enter your device details:
                  </div>
                  <div className="text-[11px] text-text-dim mb-3">
                    Find the Bluetooth name and address in your phone's Bluetooth settings,
                    or on your computer under System Settings → Bluetooth → paired devices.
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Device name (e.g. John's iPhone)"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Bluetooth address (e.g. AA-BB-CC-DD-EE-FF)"
                      value={deviceAddress}
                      onChange={(e) => setDeviceAddress(e.target.value)}
                      className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded border border-accent bg-bg-input px-4 py-2 text-[13px] text-accent hover:bg-accent hover:text-bg-base disabled:opacity-50"
                      onClick={handleCompletePairing}
                      disabled={!deviceName.trim() || !deviceAddress.trim()}
                    >
                      Complete Pairing
                    </button>
                    <button
                      className="rounded bg-bg-input px-4 py-2 text-[12px] text-text-muted hover:text-text-primary"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
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

              {showManualEntry && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Device name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Bluetooth address (AA-BB-CC-DD-EE-FF)"
                    value={deviceAddress}
                    onChange={(e) => setDeviceAddress(e.target.value)}
                    className="w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none"
                  />
                  <button
                    className="rounded border border-accent bg-bg-input px-3 py-1.5 text-[12px] text-accent hover:bg-accent hover:text-bg-base disabled:opacity-50"
                    onClick={handleCompletePairing}
                    disabled={!deviceName.trim() || !deviceAddress.trim()}
                  >
                    Save
                  </button>
                </div>
              )}

              <button
                className="mt-2 block text-[11px] text-text-dim hover:text-text-muted"
                onClick={() => setShowManualEntry(!showManualEntry)}
              >
                {showManualEntry ? "Hide manual entry" : "Or enter device details manually"}
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
