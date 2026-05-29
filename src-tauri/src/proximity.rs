use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HelperOutput {
    status: String,
    rssi: i16,
}

/// Result of a proximity check.
#[derive(Debug, Clone, PartialEq)]
pub enum ProximityResult {
    /// Device nearby, signal strong
    Connected(i16),
    /// Device detected but signal weak
    Weak(i16),
    /// Device not found
    Disconnected,
}

/// Check proximity of a paired Bluetooth device by address.
/// Uses classic Bluetooth (not BLE) for reliable phone detection.
///
/// `rssi_threshold` is the boundary between Connected and Weak.
/// Typical values: -60 (tight, ~6ft) to -90 (loose, ~30ft).
pub fn check_proximity(device_address: &str, rssi_threshold: i16) -> ProximityResult {
    #[cfg(target_os = "macos")]
    {
        return check_proximity_macos(device_address, rssi_threshold);
    }

    #[cfg(target_os = "windows")]
    {
        return check_proximity_windows(device_address, rssi_threshold);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (device_address, rssi_threshold);
        ProximityResult::Disconnected
    }
}

#[cfg(target_os = "macos")]
fn check_proximity_macos(device_address: &str, rssi_threshold: i16) -> ProximityResult {
    let helper_path = find_helper_binary();

    let output = match std::process::Command::new(&helper_path)
        .arg(device_address)
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            log::warn!("Failed to run bt_proximity helper: {}", e);
            return ProximityResult::Disconnected;
        }
    };

    if !output.status.success() {
        return ProximityResult::Disconnected;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: HelperOutput = match serde_json::from_str(stdout.trim()) {
        Ok(p) => p,
        Err(e) => {
            log::warn!("Failed to parse bt_proximity output: {} — raw: {}", e, stdout.trim());
            return ProximityResult::Disconnected;
        }
    };

    match parsed.status.as_str() {
        "connected" => {
            if parsed.rssi >= rssi_threshold {
                ProximityResult::Connected(parsed.rssi)
            } else {
                ProximityResult::Weak(parsed.rssi)
            }
        }
        "weak" => ProximityResult::Weak(parsed.rssi),
        _ => ProximityResult::Disconnected,
    }
}

#[cfg(target_os = "macos")]
fn find_helper_binary() -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = &exe_dir {
        let beside_exe = dir.join("bt_proximity");
        if beside_exe.exists() {
            return beside_exe.to_string_lossy().to_string();
        }
    }

    let target_dir = exe_dir
        .as_ref()
        .and_then(|d| d.parent())
        .map(|d| d.join("build"));

    if let Some(build_dir) = target_dir {
        if let Ok(entries) = std::fs::read_dir(&build_dir) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("out").join("bt_proximity");
                if candidate.exists() {
                    return candidate.to_string_lossy().to_string();
                }
            }
        }
    }

    "bt_proximity".to_string()
}

#[cfg(target_os = "windows")]
fn check_proximity_windows(device_address: &str, rssi_threshold: i16) -> ProximityResult {
    let _ = (device_address, rssi_threshold);
    log::warn!("Windows Bluetooth proximity not yet implemented");
    ProximityResult::Disconnected
}
