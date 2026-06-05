use crate::crypto;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;
use totp_rs::{Algorithm, Secret, TOTP};

#[derive(Serialize, Deserialize, Clone)]
pub struct CredentialData {
    pub service: String,
    pub username: String,
    pub encrypted_password: String,
    pub url: String,
    pub totp_secret: String, // encrypted
    pub notes: String,
}

#[derive(Serialize)]
pub struct TotpCode {
    pub code: String,
    pub remaining_seconds: u64,
    pub period: u64,
}

/// Encrypt a credential password
#[tauri::command]
pub fn encrypt_credential_field(state: State<'_, AppState>, value: String) -> Result<String, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let encrypted = crypto::encrypt_value(key, &value)?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &encrypted))
}

/// Decrypt a credential password
#[tauri::command]
pub fn decrypt_credential_field(state: State<'_, AppState>, encrypted_b64: String) -> Result<String, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let encrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted_b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    crypto::decrypt_value(key, &encrypted)
}

/// Generate a TOTP code from a secret
#[tauri::command]
pub fn generate_totp(state: State<'_, AppState>, encrypted_secret_b64: String) -> Result<TotpCode, String> {
    let key_guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    // Decrypt the TOTP secret
    let encrypted = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted_secret_b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    let secret_str = crypto::decrypt_value(key, &encrypted)?;

    // Parse the secret (supports base32 encoded secrets)
    let secret = Secret::Encoded(secret_str.trim().replace(' ', ""))
        .to_bytes()
        .map_err(|e| format!("Invalid TOTP secret: {}", e))?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret)
        .map_err(|e| format!("TOTP error: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let code = totp.generate(now);
    let remaining = 30 - (now % 30);

    Ok(TotpCode {
        code,
        remaining_seconds: remaining,
        period: 30,
    })
}

/// Validate that a TOTP secret is valid
#[tauri::command]
pub fn validate_totp_secret(secret: String) -> Result<bool, String> {
    let result = Secret::Encoded(secret.trim().replace(' ', "")).to_bytes();
    Ok(result.is_ok())
}
