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
                Err(_) => continue,
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
                break;
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
