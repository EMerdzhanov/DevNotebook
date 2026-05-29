import { useState } from "react";
import { themes } from "../themes";

interface BluetoothDevice {
  name: string;
  address: string;
}

interface SettingsViewProps {
  bluetoothStatus: string;
  activeThemeId: string;
  onThemeChange: (id: string) => void;
  onScanDevices: () => Promise<BluetoothDevice[]>;
  onPairDevice: (address: string) => Promise<void>;
  onUnpairDevice: () => Promise<void>;
  onLockVault: () => void;
}

export default function SettingsView({
  bluetoothStatus,
  activeThemeId,
  onThemeChange,
  onScanDevices,
  onPairDevice,
  onUnpairDevice,
  onLockVault,
}: SettingsViewProps) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const results = await onScanDevices();
      setDevices(results);
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
    }
  };

  const handlePair = async (device: BluetoothDevice) => {
    try {
      await onPairDevice(device.address);
      setDevices([]);
    } catch (err) {
      setScanError(String(err));
    }
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
                {/* Theme preview swatch */}
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

      {/* Bluetooth Section */}
      <div className="mb-8">
        <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-accent">
          Bluetooth Proximity Lock
        </h4>
        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[14px] text-text-primary">Paired Device</div>
              <div className="mt-1 text-[12px] text-text-muted">
                {bluetoothStatus === "not-configured"
                  ? "No device paired"
                  : `Status: ${bluetoothStatus}`}
              </div>
            </div>
            {bluetoothStatus !== "not-configured" && (
              <button
                className="rounded bg-bg-input px-3 py-1.5 text-[12px] text-status-disconnected hover:bg-status-disconnected hover:text-white"
                onClick={onUnpairDevice}
              >
                Unpair
              </button>
            )}
          </div>

          <button
            className="rounded border border-accent bg-bg-input px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-bg-base disabled:opacity-50"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? "Scanning..." : "Scan for Devices"}
          </button>

          {scanError && (
            <div className="mt-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
              {scanError}
            </div>
          )}

          {devices.length > 0 && (
            <div className="mt-3 space-y-2">
              {devices.map((device) => (
                <div
                  key={device.address}
                  className="flex items-center justify-between rounded border border-border-subtle bg-bg-base p-3"
                >
                  <div>
                    <div className="text-[13px] text-text-primary">
                      {device.name}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {device.address}
                    </div>
                  </div>
                  <button
                    className="rounded bg-accent px-3 py-1 text-[12px] text-bg-base hover:opacity-90"
                    onClick={() => handlePair(device)}
                  >
                    Pair
                  </button>
                </div>
              ))}
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
