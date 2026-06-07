use crate::pairing;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex as TokioMutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProximityStatus {
    Connected,
    Weak,
    Disconnected,
    NotConfigured,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingInfo {
    pub qr_svg: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedDevice {
    pub name: String,
    /// Phone's MAC address on the local network.
    pub address: String,
    /// Phone's last known IP (used for faster ping checks).
    pub ip: String,
}

pub struct BluetoothMonitor {
    paired_device: Arc<TokioMutex<Option<PairedDevice>>>,
    status: Arc<TokioMutex<ProximityStatus>>,
    /// Seconds without network presence before locking. Default 15s.
    lock_delay: Arc<TokioMutex<i64>>,
    /// Tracks consecutive failed pings.
    consecutive_failures: Arc<TokioMutex<u32>>,
    /// Active pairing session (one-shot, cleared after pairing).
    active_session: Arc<TokioMutex<Option<pairing::PairingSession>>>,
}

impl BluetoothMonitor {
    pub fn new() -> Self {
        Self {
            paired_device: Arc::new(TokioMutex::new(None)),
            status: Arc::new(TokioMutex::new(ProximityStatus::NotConfigured)),
            lock_delay: Arc::new(TokioMutex::new(15)),
            consecutive_failures: Arc::new(TokioMutex::new(0)),
            active_session: Arc::new(TokioMutex::new(None)),
        }
    }

    /// Start QR code pairing flow.
    pub async fn start_pairing(&self) -> Result<PairingInfo, String> {
        let local_ip = pairing::get_local_ip()?;
        let session = pairing::start_pairing_server()?;
        let url = format!("http://{}:{}/", local_ip, session.port);
        let qr_svg = pairing::generate_qr_svg(&url)?;

        *self.active_session.lock().await = Some(session);

        Ok(PairingInfo { qr_svg, url })
    }

    /// Check if the phone has confirmed pairing. If so, return the captured device info.
    pub async fn check_pairing_confirmed(&self) -> Option<PairedDevice> {
        let session = self.active_session.lock().await;
        if let Some(session) = session.as_ref() {
            let result = session.result.lock().await;
            if let Some(ref r) = *result {
                // Extract a friendly name from user-agent
                let name = extract_phone_name(&r.phone_ua);
                Some(PairedDevice {
                    name,
                    address: r.phone_mac.clone(),
                    ip: r.phone_ip.clone(),
                })
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Complete the pairing by saving the device.
    pub async fn complete_pairing(&self, device: PairedDevice) {
        *self.paired_device.lock().await = Some(device);
        *self.status.lock().await = ProximityStatus::Connected;
        *self.consecutive_failures.lock().await = 0;
        // Clean up pairing session
        *self.active_session.lock().await = None;
    }

    /// Cancel an active pairing session.
    pub async fn cancel_pairing(&self) {
        *self.active_session.lock().await = None;
    }

    /// Unpair the current device.
    pub async fn unpair(&self) {
        *self.paired_device.lock().await = None;
        *self.status.lock().await = ProximityStatus::NotConfigured;
        *self.consecutive_failures.lock().await = 0;
    }

    pub async fn get_status(&self) -> ProximityStatus {
        self.status.lock().await.clone()
    }

    pub async fn get_paired_device(&self) -> Option<PairedDevice> {
        self.paired_device.lock().await.clone()
    }

    pub async fn set_sensitivity(&self, delay_secs: i16) {
        *self.lock_delay.lock().await = delay_secs as i64;
    }

    pub async fn get_sensitivity(&self) -> i16 {
        *self.lock_delay.lock().await as i16
    }

    /// Start the background network presence monitoring loop.
    pub fn start_monitoring(&self, app_handle: tauri::AppHandle) {
        let paired_device = self.paired_device.clone();
        let status = self.status.clone();
        let lock_delay = self.lock_delay.clone();
        let consecutive_failures = self.consecutive_failures.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            rt.block_on(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

                    let device = paired_device.lock().await.clone();
                    let device = match device {
                        Some(d) => d,
                        None => continue,
                    };

                    // Check if device is on the network
                    let on_network = pairing::is_device_on_network(&device.ip, &device.address);

                    let mut failures = consecutive_failures.lock().await;
                    if on_network {
                        *failures = 0;
                    } else {
                        *failures += 1;
                    }

                    let delay = *lock_delay.lock().await;
                    let fail_count = *failures;
                    drop(failures);

                    // Each check is 5 seconds apart
                    let elapsed_secs = fail_count as i64 * 5;
                    let warn_threshold = delay / 2;

                    let new_status = if elapsed_secs == 0 {
                        ProximityStatus::Connected
                    } else if elapsed_secs <= warn_threshold {
                        ProximityStatus::Connected
                    } else if elapsed_secs <= delay {
                        ProximityStatus::Weak
                    } else {
                        ProximityStatus::Disconnected
                    };

                    let mut current = status.lock().await;
                    if *current != new_status {
                        *current = new_status.clone();
                        let _ = app_handle.emit("bluetooth-status", &new_status);
                    }
                }
            });
        });
    }
}

/// Extract a friendly phone name from a user-agent string.
fn extract_phone_name(ua: &str) -> String {
    if ua.contains("iPhone") {
        "iPhone".to_string()
    } else if ua.contains("iPad") {
        "iPad".to_string()
    } else if ua.contains("Android") {
        // Try to extract model: "... Build/MODEL ..." or just "Android"
        if let Some(start) = ua.find("Android") {
            let rest = &ua[start..];
            if let Some(semi) = rest.find(';') {
                let after_semi = rest[semi + 1..].trim();
                if let Some(end) = after_semi.find(|c: char| c == ')' || c == ';') {
                    let model = after_semi[..end].trim();
                    if let Some(build) = model.find(" Build") {
                        return model[..build].trim().to_string();
                    }
                    return model.to_string();
                }
            }
        }
        "Android Phone".to_string()
    } else {
        "Phone".to_string()
    }
}
