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
    pub rssi: Option<i16>,
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

    /// Scan for nearby phones via BLE and return their names + addresses.
    /// Filters to only phone-like devices using appearance and name heuristics.
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

        // Scan for 8 seconds — phones can take longer to appear
        time::sleep(Duration::from_secs(8)).await;

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
                // Skip unnamed devices — phones always have a name
                let name = match &props.local_name {
                    Some(n) if !n.is_empty() => n.clone(),
                    _ => continue,
                };

                // Check if this is likely a phone
                if !is_likely_phone(&name, None) {
                    continue;
                }

                let address = props.address.to_string();
                let rssi = props.rssi;
                devices.push(BluetoothDevice { name, address, rssi });
            }
        }

        // Sort by signal strength (strongest first)
        devices.sort_by(|a, b| {
            let rssi_a = a.rssi.unwrap_or(-100);
            let rssi_b = b.rssi.unwrap_or(-100);
            rssi_b.cmp(&rssi_a)
        });

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

/// Determine if a BLE device is likely a phone.
///
/// Uses an exclusion strategy: allow everything through EXCEPT devices that are
/// clearly not phones (peripherals, accessories, appliances, computers).
/// This ensures phones with custom names or uncommon brands still appear.
fn is_likely_phone(name: &str, appearance: Option<u16>) -> bool {
    // BLE appearance: reject known non-phone categories
    if let Some(app) = appearance {
        let category = app >> 6; // upper 10 bits = category
        match category {
            // 0 = Unknown — allow through (many phones report this)
            0 => {}
            // 1 = Phone — definitely yes
            1 => return true,
            // 2 = Computer (laptop, tablet, desktop)
            2 => return false,
            // 3 = Watch
            3 => return false,
            // 15 = HID (keyboard, mouse, gamepad)
            15 => return false,
            // Other categories: allow through, filter by name below
            _ => {}
        }
    }

    let lower = name.to_lowercase();

    // Exclude: devices that are definitely not phones
    let not_phone = [
        // Audio
        "airpods", "buds", "earbuds", "headphone", "headset",
        "speaker", "soundbar", "soundcore", "bose ", "jbl ",
        "sony wh-", "sony wf-", "beats ", "jabra", "marshall",
        "homepod", "echo", "sonos",
        // Input devices
        "keyboard", "mouse", "trackpad", "trackball", "gamepad",
        "controller", "joystick", "magic mouse", "magic keyboard",
        // Wearables
        "watch", " band", "fitbit", "garmin", "whoop", "oura",
        // TVs and streaming
        " tv", "smart tv", "roku", "chromecast", "firestick",
        "fire tv", "apple tv", "shield",
        "[tv]", "[lg]", "samsung tv", "lg tv", "sony tv",
        "tizen", "webos", "vidaa",
        // Computers
        "macbook", "imac", "mac mini", "mac pro", "mac studio",
        "laptop", "desktop", "thinkpad", "surface",
        // Printers and peripherals
        "printer", "scanner", "epson", "canon mx", "canon pixma",
        "brother ", "hp deskjet", "hp officejet",
        // Cameras
        "gopro", "camera", "canon eos", "nikon",
        // Trackers
        "tile", "airtag", "chipolo", "smarttag",
        // IoT / embedded
        "arduino", "esp32", "raspberry", "sensor", "beacon",
        "thermometer", "scale", "thermostat", "hue", "bulb",
        "lock", "door", "plug", "switch", "light",
    ];

    if not_phone.iter().any(|p| lower.contains(p)) {
        return false;
    }

    // Allow everything else — phones with any name will pass through
    true
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
