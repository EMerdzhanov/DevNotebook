import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { BluetoothStatus } from "../types";

interface BluetoothDevice {
  name: string;
  address: string;
}

type BackendStatus = "Connected" | "Weak" | "Disconnected" | "NotConfigured";

function mapStatus(status: BackendStatus): BluetoothStatus {
  switch (status) {
    case "Connected":
      return "connected";
    case "Weak":
      return "weak";
    case "Disconnected":
      return "disconnected";
    case "NotConfigured":
    default:
      return "not-configured";
  }
}

export function useBluetooth(
  onDisconnected: () => void,
  lockTimeout: number = 30,
) {
  const [status, setStatus] = useState<BluetoothStatus>("not-configured");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const unlisten = listen<BackendStatus>("bluetooth-status", (event) => {
      const mapped = mapStatus(event.payload);
      setStatus(mapped);
    });

    // Initial status check
    invoke<BackendStatus>("bluetooth_status").then((s) =>
      setStatus(mapStatus(s)),
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle countdown and lock
  useEffect(() => {
    if (status === "disconnected") {
      setCountdown(lockTimeout);
    } else {
      setCountdown(null);
    }
  }, [status, lockTimeout]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onDisconnected();
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onDisconnected]);

  const scanDevices = useCallback(async (): Promise<BluetoothDevice[]> => {
    return invoke<BluetoothDevice[]>("bluetooth_scan");
  }, []);

  const pairDevice = useCallback(async (address: string) => {
    await invoke("bluetooth_pair", { address });
    setStatus("disconnected"); // Will become connected when monitoring detects it
  }, []);

  const unpairDevice = useCallback(async () => {
    await invoke("bluetooth_unpair");
    setStatus("not-configured");
  }, []);

  return {
    status,
    countdown,
    scanDevices,
    pairDevice,
    unpairDevice,
  };
}
