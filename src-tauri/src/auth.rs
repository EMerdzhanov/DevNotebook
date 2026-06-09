use crate::crypto;
use crate::state::AppState;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rusqlite::params;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct AuthMethods {
    pub password: bool,
    pub pin: bool,
    pub biometric: bool,
}

// ── Query which auth methods are enabled ──

#[tauri::command]
pub fn get_auth_methods(state: State<'_, AppState>) -> Result<AuthMethods, String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;

    let pin_enabled = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'pin_data'",
            [],
            |row| row.get::<_, String>(0),
        )
        .is_ok();

    let bio_enabled = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'biometric_enabled'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|v| v == "1")
        .unwrap_or(false);

    Ok(AuthMethods {
        password: true,
        pin: pin_enabled,
        biometric: bio_enabled,
    })
}

/// Check which auth methods are available before the vault is open.
/// Reads from sidecar files since DB is locked.
#[tauri::command]
pub fn get_auth_methods_locked(state: State<'_, AppState>) -> Result<AuthMethods, String> {
    let pin_path = state.db.db_path.with_extension("pin");
    let bio_path = state.db.db_path.with_extension("bio");

    Ok(AuthMethods {
        password: true,
        pin: pin_path.exists(),
        biometric: bio_path.exists(),
    })
}

// ── Preferred auth method ──

#[tauri::command]
pub fn set_preferred_auth(state: State<'_, AppState>, method: String) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('preferred_auth', ?1)",
        params![method],
    ).map_err(|e| e.to_string())?;
    drop(guard);

    let pref_path = state.db.db_path.with_extension("pref");
    std::fs::write(&pref_path, &method)
        .map_err(|e| format!("Failed to write preference: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_preferred_auth_locked(state: State<'_, AppState>) -> Result<String, String> {
    let pref_path = state.db.db_path.with_extension("pref");
    std::fs::read_to_string(&pref_path).unwrap_or_else(|_| "password".to_string());
    Ok(std::fs::read_to_string(&pref_path).unwrap_or_else(|_| "password".to_string()))
}

// ── PIN ──

#[tauri::command]
pub fn set_pin(state: State<'_, AppState>, pin: String) -> Result<(), String> {
    if pin.len() < 4 || pin.len() > 8 {
        return Err("PIN must be 4-8 digits".to_string());
    }
    if !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN must contain only digits".to_string());
    }

    // Get the current vault key from memory
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let vault_key = key_guard.as_ref().ok_or("Vault is not unlocked")?.clone();
    drop(key_guard);

    // Derive a key from the PIN and encrypt the vault key with it
    let (pin_key, pin_salt) = crypto::derive_key(&pin, None)?;
    let vault_key_hex = vault_key.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    let encrypted_vault_key = crypto::encrypt_value(&pin_key, &vault_key_hex)?;
    let encoded = BASE64.encode(&encrypted_vault_key);

    // Store in settings table
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let data = serde_json::json!({ "salt": pin_salt, "key": encoded }).to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('pin_data', ?1)",
        params![data],
    ).map_err(|e| e.to_string())?;
    drop(guard);

    // Also write a sidecar marker so we know PIN is enabled before DB is open
    let pin_path = state.db.db_path.with_extension("pin");
    let sidecar = serde_json::json!({ "salt": pin_salt, "key": encoded }).to_string();
    std::fs::write(&pin_path, &sidecar)
        .map_err(|e| format!("Failed to write PIN file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn remove_pin(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let _ = conn.execute("DELETE FROM settings WHERE key = 'pin_data'", []);
    drop(guard);

    let pin_path = state.db.db_path.with_extension("pin");
    let _ = std::fs::remove_file(&pin_path);

    Ok(())
}

#[tauri::command]
pub fn unlock_with_pin(state: State<'_, AppState>, pin: String) -> Result<(), String> {
    // Read PIN data from sidecar file (DB is locked)
    let pin_path = state.db.db_path.with_extension("pin");
    let sidecar = std::fs::read_to_string(&pin_path)
        .map_err(|_| "PIN not configured".to_string())?;
    let data: serde_json::Value = serde_json::from_str(&sidecar)
        .map_err(|_| "Invalid PIN data".to_string())?;

    let pin_salt = data["salt"].as_str().ok_or("Invalid PIN data")?;
    let encoded_key = data["key"].as_str().ok_or("Invalid PIN data")?;

    // Derive key from PIN
    let (pin_key, _) = crypto::derive_key(&pin, Some(pin_salt))?;

    // Decrypt the vault key
    let encrypted = BASE64.decode(encoded_key)
        .map_err(|_| "Invalid PIN data".to_string())?;
    let vault_key_hex = crypto::decrypt_value(&pin_key, &encrypted)
        .map_err(|_| "Incorrect PIN".to_string())?;

    // Convert hex back to bytes
    let vault_key = hex_to_bytes(&vault_key_hex)
        .map_err(|_| "Invalid stored key".to_string())?;

    // Open the database with the recovered key
    state.db.open(&vault_key)?;
    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(vault_key);

    Ok(())
}

// ── Biometric ──
//
// Touch ID / Windows Hello is the security gate.
// The vault key is stored encrypted in a .bio sidecar file.
// The encryption key for the file is derived from a random secret
// stored alongside it — the security model is that this file is only
// read AFTER biometric authentication succeeds.

#[tauri::command]
pub fn enable_biometric(state: State<'_, AppState>) -> Result<(), String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let vault_key = key_guard.as_ref().ok_or("Vault is not unlocked")?.clone();
    drop(key_guard);

    let vault_key_hex: String = vault_key.iter().map(|b| format!("{:02x}", b)).collect();

    // Generate a random wrapping key and encrypt the vault key
    let wrap_password: String = (0..32).map(|_| format!("{:02x}", rand::random::<u8>())).collect();
    let (wrap_key, wrap_salt) = crypto::derive_key(&wrap_password, None)?;
    let encrypted = crypto::encrypt_value(&wrap_key, &vault_key_hex)?;
    let encoded = BASE64.encode(&encrypted);

    // Store everything in the .bio sidecar file
    let bio_path = state.db.db_path.with_extension("bio");
    let bio_data = serde_json::json!({
        "wrap": wrap_password,
        "salt": wrap_salt,
        "key": encoded,
    }).to_string();
    std::fs::write(&bio_path, &bio_data)
        .map_err(|e| format!("Failed to write biometric data: {}", e))?;

    // Mark as enabled in settings
    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('biometric_enabled', '1')",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn disable_biometric(state: State<'_, AppState>) -> Result<(), String> {
    let bio_path = state.db.db_path.with_extension("bio");
    let _ = std::fs::remove_file(&bio_path);

    let guard = state.db.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not open")?;
    let _ = conn.execute("DELETE FROM settings WHERE key = 'biometric_enabled'", []);

    Ok(())
}

#[tauri::command]
pub fn unlock_with_biometric(state: State<'_, AppState>) -> Result<(), String> {
    // Prompt for biometric auth (Touch ID / Windows Hello)
    prompt_biometric()?;

    // Biometric succeeded — read vault key from sidecar file
    let bio_path = state.db.db_path.with_extension("bio");
    let bio_data = std::fs::read_to_string(&bio_path)
        .map_err(|_| "Biometric not configured".to_string())?;
    let data: serde_json::Value = serde_json::from_str(&bio_data)
        .map_err(|_| "Invalid biometric data".to_string())?;

    let wrap_password = data["wrap"].as_str().ok_or("Invalid biometric data")?;
    let wrap_salt = data["salt"].as_str().ok_or("Invalid biometric data")?;
    let encoded_key = data["key"].as_str().ok_or("Invalid biometric data")?;

    let (wrap_key, _) = crypto::derive_key(wrap_password, Some(wrap_salt))?;
    let encrypted = BASE64.decode(encoded_key)
        .map_err(|_| "Invalid biometric data".to_string())?;
    let vault_key_hex = crypto::decrypt_value(&wrap_key, &encrypted)
        .map_err(|_| "Failed to decrypt vault key".to_string())?;

    let vault_key = hex_to_bytes(&vault_key_hex)
        .map_err(|_| "Invalid stored key".to_string())?;

    state.db.open(&vault_key)?;
    let mut key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(vault_key);

    Ok(())
}

// ── Platform biometric prompt ──

#[cfg(target_os = "macos")]
fn prompt_biometric() -> Result<(), String> {
    // Use osascript to trigger a system authentication dialog via
    // AppleScript's "system attribute" or a keystroke-protected action.
    // The most reliable approach: use `security` CLI with `-T` to prompt
    // for keychain access, but that doesn't do Touch ID.
    //
    // Instead, compile and run a tiny Swift snippet as a temp file
    // (avoids the issues with `swift -e` and process context).
    let tmp = std::env::temp_dir().join("devnotebook_bio_auth.swift");
    std::fs::write(&tmp, r#"
import LocalAuthentication
import Foundation

let context = LAContext()
var error: NSError?
guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
    // Fall back to device passcode if biometrics unavailable
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
        fputs("No authentication available\n", stderr)
        exit(2)
    }
    let sem = DispatchSemaphore(value: 0)
    var success = false
    context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock DevNotebook vault") { result, _ in
        success = result
        sem.signal()
    }
    sem.wait()
    exit(success ? 0 : 1)
}

let sem = DispatchSemaphore(value: 0)
var success = false
context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock DevNotebook vault") { result, _ in
    success = result
    sem.signal()
}
sem.wait()
exit(success ? 0 : 1)
"#).map_err(|e| format!("Failed to write auth script: {}", e))?;

    let output = std::process::Command::new("/usr/bin/swift")
        .arg(tmp.to_str().unwrap())
        .output()
        .map_err(|e| format!("Failed to run biometric auth: {}", e))?;

    let _ = std::fs::remove_file(&tmp);

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("No authentication") {
            Err("Biometric authentication is not available on this device".to_string())
        } else {
            Err("Biometric authentication failed or was cancelled".to_string())
        }
    }
}

#[cfg(target_os = "windows")]
fn prompt_biometric() -> Result<(), String> {
    let output = std::process::Command::new("powershell")
        .args(["-Command", r#"
            Add-Type -AssemblyName System.Runtime.WindowsRuntime
            $null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
            $result = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync("Unlock DevNotebook vault").GetAwaiter().GetResult()
            if ($result -ne 'Verified') { exit 1 }
        "#])
        .output()
        .map_err(|e| format!("Failed to run biometric auth: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err("Biometric authentication failed or was cancelled".to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn prompt_biometric() -> Result<(), String> {
    Err("Biometric authentication is not supported on this platform".to_string())
}

// ── Helpers ──

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("Invalid hex string".to_string());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}
