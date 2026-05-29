use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, password_hash::SaltString};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const KEY_LEN: usize = 32; // AES-256

/// Derive a 256-bit encryption key from a master password using Argon2id.
/// Returns (key, salt) where salt should be stored for future derivation.
pub fn derive_key(password: &str, salt: Option<&str>) -> Result<(Vec<u8>, String), String> {
    let salt_string = match salt {
        Some(s) => SaltString::from_b64(s).map_err(|e| format!("Invalid salt: {}", e))?,
        None => SaltString::generate(&mut OsRng),
    };

    let mut key = vec![0u8; KEY_LEN];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt_string.as_str().as_bytes(), &mut key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    Ok((key, salt_string.to_string()))
}

/// Encrypt a plaintext value with AES-256-GCM.
/// Returns nonce + ciphertext bytes.
pub fn encrypt_value(key: &[u8], plaintext: &str) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Invalid key: {}", e))?;

    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

/// Decrypt a value encrypted with encrypt_value.
pub fn decrypt_value(key: &[u8], encrypted: &[u8]) -> Result<String, String> {
    if encrypted.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Invalid key: {}", e))?;

    let nonce = Nonce::from_slice(&encrypted[..12]);
    let ciphertext = &encrypted[12..];

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong password?".to_string())?;

    String::from_utf8(plaintext)
        .map_err(|e| format!("Invalid UTF-8 in decrypted value: {}", e))
}

/// Generate a masked preview of a secret value.
/// e.g., "sk_live_abc123xyz" -> "sk_live_••••xyz"
pub fn generate_masked_preview(value: &str) -> String {
    let len = value.len();
    if len <= 4 {
        return "••••".to_string();
    }

    // Find a good split point (after prefix like sk_live_, AKIA, etc.)
    let prefix_end = value
        .find(|c: char| c.is_alphanumeric())
        .map(|start| {
            if let Some(pos) = value[start..].find('_') {
                let after_underscore = start + pos + 1;
                if let Some(pos2) = value[after_underscore..].find('_') {
                    after_underscore + pos2 + 1
                } else {
                    after_underscore
                }
            } else {
                4.min(len)
            }
        })
        .unwrap_or(4.min(len));

    let suffix_len = 4.min(len - prefix_end);
    let prefix = &value[..prefix_end];
    let suffix = &value[len - suffix_len..];

    format!("{}••••{}", prefix, suffix)
}

/// Encode key to base64 for storage
#[allow(dead_code)]
pub fn key_to_base64(key: &[u8]) -> String {
    BASE64.encode(key)
}

/// Decode key from base64
#[allow(dead_code)]
pub fn key_from_base64(encoded: &str) -> Result<Vec<u8>, String> {
    BASE64.decode(encoded).map_err(|e| format!("Invalid base64: {}", e))
}
