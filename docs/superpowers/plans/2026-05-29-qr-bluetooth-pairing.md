# QR Code Bluetooth Pairing & Proximity Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BLE device scanning with QR code pairing and classic Bluetooth RSSI proximity monitoring for auto-lock.

**Architecture:** App spins up a one-shot HTTP server, generates a QR code pointing to it. Phone scans QR, opens pairing web page, user pairs via OS Bluetooth Settings. A compiled Swift helper (macOS) or `windows` crate (Windows) checks classic BT RSSI every 5s to determine proximity. Sensitivity is adjustable via a slider in Settings.

**Tech Stack:** Rust (Tauri), `qrcode` crate, `local-ip-address` crate, Swift/IOBluetooth (macOS), `windows` crate (Windows), React/TypeScript frontend.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/Cargo.toml` | Modify | Add `qrcode`, `local-ip-address` dependencies |
| `src-tauri/build.rs` | Modify | Compile Swift helper on macOS |
| `src-tauri/helpers/bt_proximity.swift` | Create | macOS classic BT RSSI checker (CLI tool) |
| `src-tauri/src/pairing.rs` | Create | HTTP server + QR code generation + pairing web page |
| `src-tauri/src/proximity.rs` | Create | Platform-specific proximity monitoring via classic BT |
| `src-tauri/src/bluetooth.rs` | Rewrite | Orchestrator: pairing state, threshold, monitoring loop |
| `src-tauri/src/state.rs` | Modify | Add pairing server state |
| `src-tauri/src/commands.rs` | Modify | Replace BT commands with new pairing + sensitivity commands |
| `src-tauri/src/lib.rs` | Modify | Register new modules and commands |
| `src/hooks/useBluetooth.ts` | Rewrite | New pairing flow: startPairing, confirmPairing, sensitivity |
| `src/components/SettingsView.tsx` | Modify | QR code display, pairing flow UI, sensitivity slider |
| `src/App.tsx` | Modify | Update SettingsView props (3 lines) |

---

### Task 1: Add Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add qrcode and local-ip-address crates**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
qrcode = "0.14"
local-ip-address = "0.6"
```

- [ ] **Step 2: Verify dependencies resolve**

Run: `cd src-tauri && cargo check 2>&1 | tail -3`
Expected: `Finished` with no errors (new crates download first time)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "deps: add qrcode and local-ip-address crates for BT pairing"
```

---

### Task 2: Create macOS Swift Proximity Helper

**Files:**
- Create: `src-tauri/helpers/bt_proximity.swift`
- Modify: `src-tauri/build.rs`

This is a small CLI tool that accepts a Bluetooth device address and returns JSON with proximity status and RSSI. Called by Rust via `std::process::Command`.

- [ ] **Step 1: Create the Swift helper**

Create `src-tauri/helpers/bt_proximity.swift`:

```swift
import IOBluetooth
import Foundation

// Usage: bt_proximity <device-address>
// Output: JSON {"status":"connected"|"weak"|"disconnected","rssi":<number>}
// The device address format is "XX-XX-XX-XX-XX-XX" (macOS uses dashes)

guard CommandLine.arguments.count >= 2 else {
    print("{\"status\":\"error\",\"rssi\":0,\"message\":\"Usage: bt_proximity <address>\"}")
    exit(1)
}

let targetAddress = CommandLine.arguments[1]

// Look up the device by address
guard let device = IOBluetoothDevice(addressString: targetAddress) else {
    print("{\"status\":\"disconnected\",\"rssi\":-100}")
    exit(0)
}

// Check if device is connected (paired and active)
if device.isConnected() {
    let rssi = device.rawRSSI()
    // rawRSSI() returns 127 when unavailable
    let rssiValue: Int = (rssi == 127) ? -50 : Int(rssi)
    print("{\"status\":\"connected\",\"rssi\":\(rssiValue)}")
} else {
    // Try to get RSSI even if not connected — device might be nearby
    // Open a brief connection attempt to check
    let rssi = device.rawRSSI()
    if rssi != 127 && rssi != 0 {
        print("{\"status\":\"weak\",\"rssi\":\(Int(rssi))}")
    } else {
        print("{\"status\":\"disconnected\",\"rssi\":-100}")
    }
}
```

- [ ] **Step 2: Update build.rs to compile the Swift helper on macOS**

Replace `src-tauri/build.rs` with:

```rust
fn main() {
    tauri_build::build();

    // Compile Swift Bluetooth helper on macOS
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let out_dir = std::env::var("OUT_DIR").unwrap();
        let helper_path = format!("{}/bt_proximity", out_dir);
        let status = Command::new("swiftc")
            .args([
                "helpers/bt_proximity.swift",
                "-o",
                &helper_path,
                "-framework",
                "IOBluetooth",
                "-O",
            ])
            .status()
            .expect("Failed to compile bt_proximity.swift — is Xcode installed?");
        assert!(status.success(), "Swift compilation failed");
        println!("cargo:rerun-if-changed=helpers/bt_proximity.swift");
    }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Build succeeds, Swift helper compiled into `target/debug/build/devnotebook-*/out/bt_proximity`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/helpers/bt_proximity.swift src-tauri/build.rs
git commit -m "feat: add macOS Swift helper for classic Bluetooth RSSI proximity"
```

---

### Task 3: Create Pairing Module (HTTP Server + QR Code)

**Files:**
- Create: `src-tauri/src/pairing.rs`

This module handles the one-shot HTTP server that serves a pairing web page, and generates the QR code as a base64-encoded PNG data URL.

- [ ] **Step 1: Create pairing.rs**

Create `src-tauri/src/pairing.rs`:

```rust
use qrcode::QrCode;
use qrcode::render::svg;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

/// State for an active pairing session.
pub struct PairingSession {
    /// The port the HTTP server is listening on.
    pub port: u16,
    /// Set to true when the phone confirms pairing via the web page.
    pub confirmed: Arc<TokioMutex<bool>>,
    /// Phone user-agent string captured during pairing.
    pub phone_info: Arc<TokioMutex<Option<String>>>,
}

/// Generate a QR code as an SVG string for the given URL.
pub fn generate_qr_svg(url: &str) -> Result<String, String> {
    let code = QrCode::new(url.as_bytes()).map_err(|e| format!("QR generation failed: {}", e))?;
    let svg_string = code
        .render()
        .min_dimensions(200, 200)
        .dark_color(svg::Color("#e0e0e0"))
        .light_color(svg::Color("#1a1a1a"))
        .build();
    Ok(svg_string)
}

/// Get the machine's local network IP address.
pub fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("Could not determine local IP: {}", e))
}

/// Start a one-shot HTTP server that serves the pairing page.
/// Returns the PairingSession with the port and confirmation state.
/// The server runs in a background thread and shuts down after confirmation
/// or after `timeout_secs`.
pub fn start_pairing_server(timeout_secs: u64) -> Result<PairingSession, String> {
    let listener = TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind pairing server: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    let confirmed = Arc::new(TokioMutex::new(false));
    let phone_info = Arc::new(TokioMutex::new(None));

    let confirmed_clone = confirmed.clone();
    let phone_info_clone = phone_info.clone();

    // Set socket timeout so the server doesn't block forever
    listener
        .set_nonblocking(false)
        .map_err(|e| format!("Failed to set blocking: {}", e))?;

    std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);

        // Set a per-connection timeout
        let _ = listener.set_nonblocking(false);

        loop {
            if std::time::Instant::now() > deadline {
                break;
            }

            // Accept with a timeout by setting SO_RCVTIMEO
            let timeout = deadline.saturating_duration_since(std::time::Instant::now());
            let timeout = timeout.min(std::time::Duration::from_secs(2));
            unsafe {
                use std::os::unix::io::AsRawFd;
                let fd = listener.as_raw_fd();
                let tv = libc::timeval {
                    tv_sec: timeout.as_secs() as _,
                    tv_usec: timeout.subsec_micros() as _,
                };
                libc::setsockopt(
                    fd,
                    libc::SOL_SOCKET,
                    libc::SO_RCVTIMEO,
                    &tv as *const _ as *const _,
                    std::mem::size_of::<libc::timeval>() as _,
                );
            }

            let (mut stream, _) = match listener.accept() {
                Ok(conn) => conn,
                Err(_) => continue, // Timeout or error, check deadline
            };

            let mut buf = [0u8; 4096];
            let n = match stream.read(&mut buf) {
                Ok(n) => n,
                Err(_) => continue,
            };
            let request = String::from_utf8_lossy(&buf[..n]);

            // Extract User-Agent
            let user_agent = request
                .lines()
                .find(|l| l.to_lowercase().starts_with("user-agent:"))
                .map(|l| l[11..].trim().to_string());

            if request.starts_with("GET /confirm") {
                // Phone confirmed pairing
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    *confirmed_clone.lock().await = true;
                    if let Some(ua) = &user_agent {
                        *phone_info_clone.lock().await = Some(ua.clone());
                    }
                });

                let body = CONFIRM_HTML;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                break; // Done — shut down server
            } else if request.starts_with("GET") {
                // Serve the pairing page
                let hostname = hostname::get()
                    .map(|h| h.to_string_lossy().to_string())
                    .unwrap_or_else(|_| "this computer".to_string());
                let body = PAIRING_HTML.replace("{{HOSTNAME}}", &hostname);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
            }
        }
    });

    Ok(PairingSession {
        port,
        confirmed,
        phone_info,
    })
}

const PAIRING_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DevNotebook Pairing</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
  }
  .card {
    background: #222; border: 1px solid #333; border-radius: 12px;
    padding: 32px; max-width: 380px; width: 100%; text-align: center;
  }
  h1 { font-size: 20px; margin-bottom: 8px; }
  h1 span { color: #d4a029; }
  .step { text-align: left; margin: 20px 0; }
  .step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; background: #d4a029; color: #1a1a1a;
    border-radius: 50%; font-size: 13px; font-weight: 600; margin-right: 8px;
  }
  .step p { margin: 6px 0 0 32px; color: #999; font-size: 14px; }
  .btn {
    display: block; width: 100%; padding: 14px; margin-top: 24px;
    background: #d4a029; color: #1a1a1a; border: none; border-radius: 8px;
    font-size: 16px; font-weight: 600; cursor: pointer;
  }
  .btn:active { opacity: 0.8; }
  .sub { color: #666; font-size: 12px; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <h1>Dev<span>Notebook</span></h1>
  <p style="color:#999;font-size:14px;margin-top:4px">Bluetooth Proximity Pairing</p>

  <div class="step">
    <span class="step-num">1</span><strong>Open Bluetooth Settings</strong>
    <p>On your phone, go to Settings → Bluetooth</p>
  </div>

  <div class="step">
    <span class="step-num">2</span><strong>Pair with this computer</strong>
    <p>Find and connect to <strong style="color:#e0e0e0">"{{HOSTNAME}}"</strong></p>
  </div>

  <div class="step">
    <span class="step-num">3</span><strong>Confirm below</strong>
    <p>Once paired, tap the button to finish setup</p>
  </div>

  <a class="btn" href="/confirm">I've Paired My Phone</a>

  <p class="sub">Your vault will auto-lock when this phone moves out of range.</p>
</div>
</body>
</html>"#;

const CONFIRM_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paired!</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
  }
  .card {
    background: #222; border: 1px solid #333; border-radius: 12px;
    padding: 32px; max-width: 380px; width: 100%; text-align: center;
  }
  .check { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; }
  p { color: #999; font-size: 14px; margin-top: 8px; }
</style>
</head>
<body>
<div class="card">
  <div class="check">✓</div>
  <h1>Pairing Complete</h1>
  <p>You can close this page. DevNotebook will auto-lock when your phone moves out of Bluetooth range.</p>
</div>
</body>
</html>"#;
```

- [ ] **Step 2: Add `hostname` and `libc` to Cargo.toml dependencies**

In `src-tauri/Cargo.toml`, add:

```toml
hostname = "0.4"
libc = "0.2"
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -3`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/pairing.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add pairing module with HTTP server and QR code generation"
```

---

### Task 4: Create Proximity Module (Platform-Specific RSSI)

**Files:**
- Create: `src-tauri/src/proximity.rs`

This module abstracts platform-specific proximity checking behind a single `check_proximity()` function. On macOS it calls the Swift helper binary; on Windows it would use the `windows` crate (stubbed for now).

- [ ] **Step 1: Create proximity.rs**

Create `src-tauri/src/proximity.rs`:

```rust
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
        check_proximity_macos(device_address, rssi_threshold)
    }

    #[cfg(target_os = "windows")]
    {
        check_proximity_windows(device_address, rssi_threshold)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (device_address, rssi_threshold);
        ProximityResult::Disconnected
    }
}

#[cfg(target_os = "macos")]
fn check_proximity_macos(device_address: &str, rssi_threshold: i16) -> ProximityResult {
    // Find the compiled Swift helper binary
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
    // In development: built into target/debug/build/<hash>/out/
    // In production: bundled as a resource alongside the app binary
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = &exe_dir {
        // Check next to the executable (production bundle)
        let beside_exe = dir.join("bt_proximity");
        if beside_exe.exists() {
            return beside_exe.to_string_lossy().to_string();
        }
    }

    // Development: search in OUT_DIR build artifacts
    let target_dir = exe_dir
        .as_ref()
        .and_then(|d| d.parent()) // up from debug/
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

    // Fallback — hope it's in PATH
    "bt_proximity".to_string()
}

#[cfg(target_os = "windows")]
fn check_proximity_windows(device_address: &str, rssi_threshold: i16) -> ProximityResult {
    // TODO: Implement using the `windows` crate
    // Windows::Devices::Bluetooth::BluetoothDevice::FromBluetoothAddressAsync
    // For now, return disconnected so the app still compiles on Windows
    let _ = (device_address, rssi_threshold);
    log::warn!("Windows Bluetooth proximity not yet implemented");
    ProximityResult::Disconnected
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -3`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/proximity.rs
git commit -m "feat: add platform-specific Bluetooth proximity module"
```

---

### Task 5: Rewrite Bluetooth Monitor

**Files:**
- Rewrite: `src-tauri/src/bluetooth.rs`
- Modify: `src-tauri/src/state.rs`

Replace the BLE-based BluetoothMonitor with the new design that uses QR pairing and classic BT proximity monitoring. Remove `btleplug` dependency.

- [ ] **Step 1: Rewrite bluetooth.rs**

Replace the entire contents of `src-tauri/src/bluetooth.rs` with:

```rust
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
    /// QR code as SVG string
    pub qr_svg: String,
    /// URL the phone should open
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

    /// Start QR code pairing flow.
    /// Spins up a local HTTP server and returns the QR code SVG + URL.
    pub async fn start_pairing(&self) -> Result<PairingInfo, String> {
        // Stop any existing session
        *self.active_session.lock().await = None;

        let local_ip = pairing::get_local_ip()?;
        let session = pairing::start_pairing_server(120)?; // 2 minute timeout
        let url = format!("http://{}:{}/", local_ip, session.port);
        let qr_svg = pairing::generate_qr_svg(&url)?;

        *self.active_session.lock().await = Some(session);

        Ok(PairingInfo { qr_svg, url })
    }

    /// Check if the phone has confirmed pairing via the web page.
    /// Returns true if confirmed.
    pub async fn check_pairing_confirmed(&self) -> bool {
        let session = self.active_session.lock().await;
        if let Some(session) = session.as_ref() {
            *session.confirmed.lock().await
        } else {
            false
        }
    }

    /// Complete the pairing by saving the device info.
    /// Called after the user confirms which Bluetooth device is their phone.
    pub async fn complete_pairing(&self, device: PairedDevice) {
        *self.paired_device.lock().await = Some(device);
        *self.status.lock().await = ProximityStatus::Disconnected;
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
    }

    /// Get the current proximity status.
    pub async fn get_status(&self) -> ProximityStatus {
        self.status.lock().await.clone()
    }

    /// Get the paired device info.
    pub async fn get_paired_device(&self) -> Option<PairedDevice> {
        self.paired_device.lock().await.clone()
    }

    /// Set the RSSI threshold for proximity sensitivity.
    /// Range: -60 (tight, ~6ft) to -90 (loose, ~30ft).
    pub async fn set_sensitivity(&self, threshold: i16) {
        *self.rssi_threshold.lock().await = threshold;
    }

    /// Get the current RSSI threshold.
    pub async fn get_sensitivity(&self) -> i16 {
        *self.rssi_threshold.lock().await
    }

    /// Start the background proximity monitoring loop.
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
```

- [ ] **Step 2: Update state.rs — no changes needed**

`state.rs` already holds `bluetooth: BluetoothMonitor`. The struct hasn't changed its public API, so no update needed.

- [ ] **Step 3: Remove `btleplug` from Cargo.toml**

In `src-tauri/Cargo.toml`, remove the line:
```toml
btleplug = "0.11"
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/bluetooth.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: rewrite BluetoothMonitor for QR pairing + classic BT proximity"
```

---

### Task 6: Update Tauri Commands and Registration

**Files:**
- Modify: `src-tauri/src/commands.rs` (Bluetooth Commands section only, lines 770-792)
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Replace Bluetooth Commands in commands.rs**

Replace lines 770-792 (the `// ── Bluetooth Commands ──` section through end of `bluetooth_status`) with:

```rust
// ── Bluetooth Commands ──

#[tauri::command]
pub async fn bluetooth_start_pairing(
    state: State<'_, AppState>,
) -> Result<crate::bluetooth::PairingInfo, String> {
    state.bluetooth.start_pairing().await
}

#[tauri::command]
pub async fn bluetooth_check_pairing(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.bluetooth.check_pairing_confirmed().await)
}

#[tauri::command]
pub async fn bluetooth_complete_pairing(
    state: State<'_, AppState>,
    name: String,
    address: String,
) -> Result<(), String> {
    state
        .bluetooth
        .complete_pairing(crate::bluetooth::PairedDevice { name, address })
        .await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_cancel_pairing(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.bluetooth.cancel_pairing().await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_unpair(state: State<'_, AppState>) -> Result<(), String> {
    state.bluetooth.unpair().await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_status(
    state: State<'_, AppState>,
) -> Result<crate::bluetooth::ProximityStatus, String> {
    Ok(state.bluetooth.get_status().await)
}

#[tauri::command]
pub async fn bluetooth_paired_device(
    state: State<'_, AppState>,
) -> Result<Option<crate::bluetooth::PairedDevice>, String> {
    Ok(state.bluetooth.get_paired_device().await)
}

#[tauri::command]
pub async fn bluetooth_set_sensitivity(
    state: State<'_, AppState>,
    threshold: i16,
) -> Result<(), String> {
    state.bluetooth.set_sensitivity(threshold).await;
    Ok(())
}

#[tauri::command]
pub async fn bluetooth_get_sensitivity(
    state: State<'_, AppState>,
) -> Result<i16, String> {
    Ok(state.bluetooth.get_sensitivity().await)
}
```

Also remove the unused import `BluetoothDevice` from the top of commands.rs. The line `use crate::bluetooth::{BluetoothDevice, ProximityStatus};` should become `use crate::bluetooth::ProximityStatus;`.

- [ ] **Step 2: Update lib.rs module declarations and command registration**

In `src-tauri/src/lib.rs`, add the new modules after the existing `mod` declarations:

```rust
mod bluetooth;
mod commands;
mod crypto;
mod db;
mod files;
mod pairing;
mod proximity;
mod state;
```

Replace the bluetooth command registrations in the `invoke_handler` (lines 82-85):

```rust
            // Old:
            commands::bluetooth_scan,
            commands::bluetooth_pair,
            commands::bluetooth_unpair,
            commands::bluetooth_status,
            // New:
            commands::bluetooth_start_pairing,
            commands::bluetooth_check_pairing,
            commands::bluetooth_complete_pairing,
            commands::bluetooth_cancel_pairing,
            commands::bluetooth_unpair,
            commands::bluetooth_status,
            commands::bluetooth_paired_device,
            commands::bluetooth_set_sensitivity,
            commands::bluetooth_get_sensitivity,
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: update Tauri commands for QR pairing flow"
```

---

### Task 7: Rewrite Frontend Bluetooth Hook

**Files:**
- Rewrite: `src/hooks/useBluetooth.ts`

- [ ] **Step 1: Rewrite useBluetooth.ts**

Replace the entire contents of `src/hooks/useBluetooth.ts` with:

```typescript
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
  const [sensitivity, setSensitivity] = useState<number>(-75);

  // Listen for status events from backend
  useEffect(() => {
    const unlisten = listen<BackendStatus>("bluetooth-status", (event) => {
      setStatus(mapStatus(event.payload));
    });

    // Load initial state
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
    const timer = setTimeout(
      () => setCountdown((c) => (c !== null ? c - 1 : null)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown, onDisconnected]);

  // Start QR pairing — returns QR SVG + URL
  const startPairing = useCallback(async (): Promise<PairingInfo> => {
    const info = await invoke<PairingInfo>("bluetooth_start_pairing");
    setPairing(info);
    return info;
  }, []);

  // Poll for phone confirmation
  const checkPairingConfirmed = useCallback(async (): Promise<boolean> => {
    return invoke<boolean>("bluetooth_check_pairing");
  }, []);

  // Complete pairing with device info
  const completePairing = useCallback(
    async (name: string, address: string) => {
      await invoke("bluetooth_complete_pairing", { name, address });
      setPairedDevice({ name, address });
      setPairing(null);
      setStatus("disconnected"); // Will update when monitoring detects it
    },
    [],
  );

  // Cancel active pairing
  const cancelPairing = useCallback(async () => {
    await invoke("bluetooth_cancel_pairing");
    setPairing(null);
  }, []);

  // Unpair device
  const unpairDevice = useCallback(async () => {
    await invoke("bluetooth_unpair");
    setPairedDevice(null);
    setStatus("not-configured");
  }, []);

  // Update sensitivity threshold
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: Errors about SettingsView props (expected — we'll fix those in the next task)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBluetooth.ts
git commit -m "feat: rewrite useBluetooth hook for QR pairing flow"
```

---

### Task 8: Update SettingsView — QR Pairing UI + Sensitivity Slider

**Files:**
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/App.tsx` (3 lines — SettingsView props)

- [ ] **Step 1: Rewrite the Bluetooth section in SettingsView.tsx**

Replace everything from `import { useState }` through the end of the file in `src/components/SettingsView.tsx` with:

```tsx
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

  // Poll for pairing confirmation when QR is showing
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
          {/* Paired device info or pairing prompt */}
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

              {/* Sensitivity slider */}
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
              {/* QR Code display */}
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
```

- [ ] **Step 2: Update App.tsx SettingsView props (lines 491-499)**

Replace the SettingsView usage in `src/App.tsx`:

```tsx
        {viewState?.view === "settings" && (
          <SettingsView
            bluetoothStatus={bluetooth.status}
            activeThemeId={activeThemeId}
            pairing={bluetooth.pairing}
            pairedDevice={bluetooth.pairedDevice}
            sensitivity={bluetooth.sensitivity}
            onThemeChange={handleThemeChange}
            onStartPairing={bluetooth.startPairing}
            onCheckPairingConfirmed={bluetooth.checkPairingConfirmed}
            onCompletePairing={bluetooth.completePairing}
            onCancelPairing={bluetooth.cancelPairing}
            onUnpairDevice={bluetooth.unpairDevice}
            onUpdateSensitivity={bluetooth.updateSensitivity}
            onLockVault={handleLockVault}
          />
        )}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 4: Verify full Rust build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.tsx src/App.tsx
git commit -m "feat: QR code pairing UI with sensitivity slider in Settings"
```

---

### Task 9: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Clean build, Swift helper compiled

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 3: Verify dev server loads**

Run: `npm run dev` (on a different port if 1420 is taken)
Expected: Vite starts without errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete QR code Bluetooth pairing and proximity lock system"
```
