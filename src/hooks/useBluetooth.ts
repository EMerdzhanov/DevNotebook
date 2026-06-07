import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { BluetoothStatus } from "../types";

interface PairingInfo {
  qr_svg: string;
  url: string;
}

interface PairedDevice {
  name: string;
  address: string;
  ip: string;
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
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(15);

  useEffect(() => {
    const unlisten = listen<BackendStatus>("bluetooth-status", (event) => {
      setStatus(mapStatus(event.payload));
    });

    invoke<BackendStatus>("bluetooth_status").then((s) =>
      setStatus(mapStatus(s)),
    );
    invoke<PairedDevice | null>("bluetooth_paired_device").then((d) =>
      setPairedDevice(d),
    );
    invoke<number>("bluetooth_get_sensitivity").then((s) =>
      setSensitivity(s),
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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
    const timer = setTimeout(
      () => setCountdown((c) => (c !== null ? c - 1 : null)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown, onDisconnected]);

  const startPairing = useCallback(async (): Promise<PairingInfo> => {
    const info = await invoke<PairingInfo>("bluetooth_start_pairing");
    setPairing(info);
    return info;
  }, []);

  const checkPairingConfirmed = useCallback(async (): Promise<PairedDevice | null> => {
    return invoke<PairedDevice | null>("bluetooth_check_pairing");
  }, []);

  const completePairing = useCallback(
    async (device: PairedDevice) => {
      await invoke("bluetooth_complete_pairing", {
        name: device.name,
        address: device.address,
        ip: device.ip,
      });
      setPairedDevice(device);
      setPairing(null);
      setStatus("connected");
    },
    [],
  );

  const cancelPairing = useCallback(async () => {
    await invoke("bluetooth_cancel_pairing");
    setPairing(null);
  }, []);

  const unpairDevice = useCallback(async () => {
    await invoke("bluetooth_unpair");
    setPairedDevice(null);
    setStatus("not-configured");
  }, []);

  const updateSensitivity = useCallback(async (threshold: number) => {
    await invoke("bluetooth_set_sensitivity", { threshold });
    setSensitivity(threshold);
  }, []);

  return {
    status,
    countdown,
    pairing,
    pairedDevice,
    sensitivity,
    startPairing,
    checkPairingConfirmed,
    completePairing,
    cancelPairing,
    unpairDevice,
    updateSensitivity,
  };
}
