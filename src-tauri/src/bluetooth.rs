use btleplug::api::{Central, Manager as BtManager, Peripheral as _, ScanFilter};
use btleplug::platform::{Adapter, Manager};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::Mutex as TokioMutex;
use tokio::time;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProximityStatus {
    Connected,
    Weak,
    Disconnected,
    NotConfigured,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothDevice {
    pub name: String,
    pub address: String,
}

pub struct BluetoothMonitor {
    paired_device_address: Arc<TokioMutex<Option<String>>>,
    status: Arc<TokioMutex<ProximityStatus>>,
    rssi_threshold: i16,
}

impl BluetoothMonitor {
    pub fn new() -> Self {
        Self {
            paired_device_address: Arc::new(TokioMutex::new(None)),
            status: Arc::new(TokioMutex::new(ProximityStatus::NotConfigured)),
            rssi_threshold: -80,
        }
    }

    pub async fn set_paired_device(&self, address: Option<String>) {
        let mut addr = self.paired_device_address.lock().await;
        *addr = address.clone();
        let mut status = self.status.lock().await;
        *status = if address.is_some() {
            ProximityStatus::Disconnected
        } else {
            ProximityStatus::NotConfigured
        };
    }

    pub async fn get_status(&self) -> ProximityStatus {
        self.status.lock().await.clone()
    }

    /// Scan for nearby BLE devices and return their names + addresses.
    pub async fn scan_devices(&self) -> Result<Vec<BluetoothDevice>, String> {
        let manager = Manager::new()
            .await
            .map_err(|e| format!("Bluetooth manager error: {}", e))?;

        let adapters = manager
            .adapters()
            .await
            .map_err(|e| format!("No Bluetooth adapters found: {}", e))?;

        let adapter = adapters
            .into_iter()
            .next()
            .ok_or_else(|| "No Bluetooth adapter available".to_string())?;

        adapter
            .start_scan(ScanFilter::default())
            .await
            .map_err(|e| format!("Failed to start scan: {}", e))?;

        // Scan for 5 seconds
        time::sleep(Duration::from_secs(5)).await;

        adapter
            .stop_scan()
            .await
            .map_err(|e| format!("Failed to stop scan: {}", e))?;

        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| format!("Failed to get peripherals: {}", e))?;

        let mut devices = Vec::new();
        for p in peripherals {
            let props = p.properties().await.ok().flatten();
            if let Some(props) = props {
                let name = props
                    .local_name
                    .unwrap_or_else(|| "Unknown Device".to_string());
                let address = props.address.to_string();
                devices.push(BluetoothDevice { name, address });
            }
        }

        Ok(devices)
    }

    /// Start background monitoring loop in a dedicated thread with its own Tokio runtime.
    pub fn start_monitoring(
        &self,
        app_handle: tauri::AppHandle,
    ) {
        let paired_addr = self.paired_device_address.clone();
        let status = self.status.clone();
        let threshold = self.rssi_threshold;

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            rt.block_on(async move {
            let manager = match Manager::new().await {
                Ok(m) => m,
                Err(e) => {
                    log::error!("Bluetooth manager error: {}", e);
                    return;
                }
            };

            let adapter = match get_adapter(&manager).await {
                Some(a) => a,
                None => {
                    log::error!("No Bluetooth adapter found");
                    return;
                }
            };

            loop {
                time::sleep(Duration::from_secs(5)).await;

                let addr = paired_addr.lock().await.clone();
                let target_addr = match addr {
                    Some(a) => a,
                    None => continue, // Not configured, skip
                };

                let new_status = check_device_proximity(&adapter, &target_addr, threshold).await;

                let mut current = status.lock().await;
                if *current != new_status {
                    *current = new_status.clone();
                    // Emit event to frontend
                    let _ = app_handle.emit("bluetooth-status", &new_status);
                }
            }
            }); // block_on
        }); // thread::spawn
    }
}

async fn get_adapter(manager: &Manager) -> Option<Adapter> {
    manager.adapters().await.ok()?.into_iter().next()
}

async fn check_device_proximity(
    adapter: &Adapter,
    target_address: &str,
    rssi_threshold: i16,
) -> ProximityStatus {
    // Start a quick scan
    if adapter.start_scan(ScanFilter::default()).await.is_err() {
        return ProximityStatus::Disconnected;
    }

    time::sleep(Duration::from_secs(3)).await;
    let _ = adapter.stop_scan().await;

    let peripherals = match adapter.peripherals().await {
        Ok(p) => p,
        Err(_) => return ProximityStatus::Disconnected,
    };

    for p in peripherals {
        let props = match p.properties().await {
            Ok(Some(props)) => props,
            _ => continue,
        };

        if props.address.to_string() == target_address {
            return match props.rssi {
                Some(rssi) if rssi >= rssi_threshold => ProximityStatus::Connected,
                Some(_) => ProximityStatus::Weak,
                None => ProximityStatus::Connected, // Device found but no RSSI — treat as connected
            };
        }
    }

    ProximityStatus::Disconnected
}
