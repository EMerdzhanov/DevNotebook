use crate::pairing::{self, PairingSession};
use crate::proximity::{self, ProximityResult};
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
    pub address: String,
}

pub struct BluetoothMonitor {
    paired_device: Arc<TokioMutex<Option<PairedDevice>>>,
    status: Arc<TokioMutex<ProximityStatus>>,
    rssi_threshold: Arc<TokioMutex<i16>>,
    active_session: Arc<TokioMutex<Option<PairingSession>>>,
}

impl BluetoothMonitor {
    pub fn new() -> Self {
        Self {
            paired_device: Arc::new(TokioMutex::new(None)),
            status: Arc::new(TokioMutex::new(ProximityStatus::NotConfigured)),
            rssi_threshold: Arc::new(TokioMutex::new(-75)),
            active_session: Arc::new(TokioMutex::new(None)),
        }
    }

    pub async fn start_pairing(&self) -> Result<PairingInfo, String> {
        *self.active_session.lock().await = None;

        let local_ip = pairing::get_local_ip()?;
        let session = pairing::start_pairing_server(120)?;
        let url = format!("http://{}:{}/", local_ip, session.port);
        let qr_svg = pairing::generate_qr_svg(&url)?;

        *self.active_session.lock().await = Some(session);

        Ok(PairingInfo { qr_svg, url })
    }

    pub async fn check_pairing_confirmed(&self) -> bool {
        let session = self.active_session.lock().await;
        if let Some(session) = session.as_ref() {
            *session.confirmed.lock().await
        } else {
            false
        }
    }

    pub async fn complete_pairing(&self, device: PairedDevice) {
        *self.paired_device.lock().await = Some(device);
        *self.status.lock().await = ProximityStatus::Disconnected;
        *self.active_session.lock().await = None;
    }

    pub async fn cancel_pairing(&self) {
        *self.active_session.lock().await = None;
    }

    pub async fn unpair(&self) {
        *self.paired_device.lock().await = None;
        *self.status.lock().await = ProximityStatus::NotConfigured;
    }

    pub async fn get_status(&self) -> ProximityStatus {
        self.status.lock().await.clone()
    }

    pub async fn get_paired_device(&self) -> Option<PairedDevice> {
        self.paired_device.lock().await.clone()
    }

    pub async fn set_sensitivity(&self, threshold: i16) {
        *self.rssi_threshold.lock().await = threshold;
    }

    pub async fn get_sensitivity(&self) -> i16 {
        *self.rssi_threshold.lock().await
    }

    pub fn start_monitoring(&self, app_handle: tauri::AppHandle) {
        let paired_device = self.paired_device.clone();
        let status = self.status.clone();
        let threshold = self.rssi_threshold.clone();

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

                    let thresh = *threshold.lock().await;
                    let result = proximity::check_proximity(&device.address, thresh);

                    let new_status = match result {
                        ProximityResult::Connected(_) => ProximityStatus::Connected,
                        ProximityResult::Weak(_) => ProximityStatus::Weak,
                        ProximityResult::Disconnected => ProximityStatus::Disconnected,
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
