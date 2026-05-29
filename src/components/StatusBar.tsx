import type { BluetoothStatus } from "../types";

interface StatusBarProps {
  bluetoothStatus: BluetoothStatus;
  bluetoothDevice: string;
  lockCountdown: number | null;
}

const statusConfig: Record<
  BluetoothStatus,
  { color: string; bgColor: string; label: string }
> = {
  connected: {
    color: "text-status-connected",
    bgColor: "bg-status-connected",
    label: "connected",
  },
  weak: {
    color: "text-status-warning",
    bgColor: "bg-status-warning",
    label: "weak signal",
  },
  disconnected: {
    color: "text-status-disconnected",
    bgColor: "bg-status-disconnected",
    label: "disconnected",
  },
  "not-configured": {
    color: "text-text-muted",
    bgColor: "bg-text-muted",
    label: "not configured",
  },
};

export default function StatusBar({
  bluetoothStatus,
  bluetoothDevice,
  lockCountdown,
}: StatusBarProps) {
  const config = statusConfig[bluetoothStatus];

  return (
    <div className="flex items-center justify-between border-t border-border bg-bg-tabbar px-4 py-1.5 text-[11px]">
      <div className={`flex items-center gap-1.5 ${config.color}`}>
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${config.bgColor}`}
        />
        <span>
          Bluetooth: {bluetoothDevice || "Phone"} {config.label}
        </span>
        {lockCountdown !== null && (
          <span className="ml-2 text-status-warning">
            Locking in {lockCountdown}s
          </span>
        )}
      </div>
      <div className="text-text-muted">Vault encrypted</div>
    </div>
  );
}
