use qrcode::QrCode;
use qrcode::render::svg;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

/// Result of the pairing flow — phone's network identity.
pub struct PairingResult {
    /// Phone's IP address on the local network.
    pub phone_ip: String,
    /// Phone's MAC address (from ARP lookup).
    pub phone_mac: String,
    /// Phone's user-agent string.
    pub phone_ua: String,
}

/// State for an active pairing session.
pub struct PairingSession {
    pub port: u16,
    pub result: Arc<TokioMutex<Option<PairingResult>>>,
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

/// Look up a MAC address for a given IP via the ARP table.
pub fn lookup_mac(ip: &str) -> Option<String> {
    // First ping the IP to ensure it's in the ARP table
    let _ = std::process::Command::new("ping")
        .args(["-c", "1", "-W", "1", ip])
        .output();

    // Then look up the ARP entry
    let output = std::process::Command::new("arp")
        .args(["-n", ip])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Parse ARP output — format: "? (IP) at MAC on interface"
    for line in stdout.lines() {
        if line.contains(ip) && line.contains("at ") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(at_idx) = parts.iter().position(|&p| p == "at") {
                if let Some(mac) = parts.get(at_idx + 1) {
                    let mac = mac.trim();
                    if mac != "(incomplete)" && mac.contains(':') {
                        return Some(mac.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Check if a MAC address is still present on the local network.
/// Pings the stored IP first, then checks ARP for the MAC.
/// If the IP changed (DHCP), falls back to scanning the ARP table for the MAC.
pub fn is_device_on_network(ip: &str, mac: &str) -> bool {
    // Quick ping to refresh ARP entry (1 second timeout)
    let _ = std::process::Command::new("ping")
        .args(["-c", "1", "-W", "1", ip])
        .output();

    // Check ARP table for the MAC at the known IP
    if let Some(found_mac) = lookup_mac_from_arp(ip) {
        if found_mac.to_lowercase() == mac.to_lowercase() {
            return true;
        }
    }

    // IP might have changed — scan entire ARP table for the MAC
    if let Ok(output) = std::process::Command::new("arp").arg("-a").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.to_lowercase().contains(&mac.to_lowercase()) {
                return true;
            }
        }
    }

    false
}

/// Look up MAC from ARP table for a specific IP (no ping, just read).
fn lookup_mac_from_arp(ip: &str) -> Option<String> {
    let output = std::process::Command::new("arp")
        .args(["-n", ip])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains(ip) && line.contains("at ") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(at_idx) = parts.iter().position(|&p| p == "at") {
                if let Some(mac) = parts.get(at_idx + 1) {
                    let mac = mac.trim();
                    if mac != "(incomplete)" && mac.contains(':') {
                        return Some(mac.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Start a one-shot pairing server. Serves the QR landing page,
/// then when the phone taps "Pair", captures its IP + MAC and shuts down.
pub fn start_pairing_server() -> Result<PairingSession, String> {
    let listener = TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind pairing server: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    let result: Arc<TokioMutex<Option<PairingResult>>> = Arc::new(TokioMutex::new(None));
    let result_c = result.clone();

    std::thread::spawn(move || {
        // 2-minute timeout
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(120);

        unsafe {
            use std::os::unix::io::AsRawFd;
            let fd = listener.as_raw_fd();
            let tv = libc::timeval { tv_sec: 2, tv_usec: 0 };
            libc::setsockopt(
                fd, libc::SOL_SOCKET, libc::SO_RCVTIMEO,
                &tv as *const _ as *const _, std::mem::size_of::<libc::timeval>() as _,
            );
        }

        loop {
            if std::time::Instant::now() > deadline {
                break;
            }

            let (mut stream, peer_addr) = match listener.accept() {
                Ok(conn) => conn,
                Err(_) => continue,
            };

            let mut buf = [0u8; 4096];
            let n = match stream.read(&mut buf) {
                Ok(n) if n > 0 => n,
                _ => continue,
            };
            let request = String::from_utf8_lossy(&buf[..n]);

            if request.starts_with("GET /confirm") {
                // Capture phone's network identity
                let phone_ip = peer_addr.ip().to_string();
                let phone_mac = lookup_mac(&phone_ip).unwrap_or_default();
                let phone_ua = request
                    .lines()
                    .find(|l| l.to_lowercase().starts_with("user-agent:"))
                    .map(|l| l[11..].trim().to_string())
                    .unwrap_or_default();

                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    *result_c.lock().await = Some(PairingResult {
                        phone_ip,
                        phone_mac,
                        phone_ua,
                    });
                });

                // Serve confirmation page
                let body = CONFIRM_HTML;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(), body
                );
                let _ = stream.write_all(response.as_bytes());
                break; // Done — shut down server
            } else if request.starts_with("GET") {
                let computer_name = std::process::Command::new("scutil")
                    .args(["--get", "ComputerName"])
                    .output()
                    .ok()
                    .and_then(|o| String::from_utf8(o.stdout).ok())
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| {
                        hostname::get()
                            .map(|h| h.to_string_lossy().to_string())
                            .unwrap_or_else(|_| "this computer".to_string())
                    });
                let body = PAIRING_HTML.replace("{{HOSTNAME}}", &computer_name);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(), body
                );
                let _ = stream.write_all(response.as_bytes());
            }
        }
    });

    Ok(PairingSession { port, result })
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
  .info { color: #999; font-size: 14px; margin: 16px 0; line-height: 1.5; }
  .btn {
    display: block; width: 100%; padding: 14px; margin-top: 24px;
    background: #d4a029; color: #1a1a1a; border: none; border-radius: 8px;
    font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none;
  }
  .btn:active { opacity: 0.8; }
  .sub { color: #666; font-size: 12px; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <h1>Dev<span>Notebook</span></h1>
  <p class="info">
    Pair this phone with <strong style="color:#e0e0e0">"{{HOSTNAME}}"</strong> to enable proximity lock.
  </p>
  <p class="info" style="font-size:13px">
    Your vault will auto-lock when this phone leaves the WiFi network.
    No apps to install — just tap the button below.
  </p>
  <a class="btn" href="/confirm">Pair This Phone</a>
  <p class="sub">One-time setup. Works automatically after this.</p>
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
  .check { font-size: 48px; margin-bottom: 16px; color: #44aa99; }
  h1 { font-size: 20px; }
  h1 span { color: #d4a029; }
  p { color: #999; font-size: 14px; margin-top: 8px; line-height: 1.5; }
</style>
</head>
<body>
<div class="card">
  <div class="check">&#10003;</div>
  <h1>Dev<span>Notebook</span></h1>
  <p><strong style="color:#e0e0e0">Pairing complete!</strong></p>
  <p>You can close this page. Your vault will auto-lock whenever this phone leaves the network.</p>
</div>
</body>
</html>"#;
