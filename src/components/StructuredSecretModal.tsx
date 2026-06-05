import { useState, useEffect, useCallback } from "react";
import type { Secret } from "../types";
import * as api from "../hooks/useTauri";
import PasswordGenerator from "./PasswordGenerator";

interface StructuredSecretModalProps {
  categoryId: string;
  categoryName: string;
  secret: Secret | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "url" | "number" | "totp";
  placeholder?: string;
  required?: boolean;
  generated?: (fields: Record<string, string>) => string;
}

const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  "Passwords": [
    { key: "username", label: "Username / Email", type: "text", placeholder: "user@example.com", required: true },
    { key: "password", label: "Password", type: "password", placeholder: "Enter password", required: true },
    { key: "url", label: "Login URL", type: "url", placeholder: "https://app.example.com/login" },
    { key: "totp_secret", label: "2FA (TOTP)", type: "totp", placeholder: "JBSWY3DPEHPK3PXP" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "Database": [
    { key: "host", label: "Host", type: "text", placeholder: "localhost or db.example.com", required: true },
    { key: "port", label: "Port", type: "number", placeholder: "5432" },
    { key: "username", label: "Username", type: "text", placeholder: "postgres" },
    { key: "password", label: "password", type: "password", placeholder: "Database password" },
    { key: "database", label: "Database Name", type: "text", placeholder: "my_app_db" },
    { key: "connection_string", label: "Connection String", type: "text", placeholder: "Auto-generated",
      generated: (f) => {
        const scheme = f.port === "27017" ? "mongodb" : "postgresql";
        const userPart = f.username ? (f.password ? `${f.username}:****@` : `${f.username}@`) : "";
        const portPart = f.port ? `:${f.port}` : "";
        const dbPart = f.database ? `/${f.database}` : "";
        return f.host ? `${scheme}://${userPart}${f.host}${portPart}${dbPart}` : "";
      }
    },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "SSH Keys": [
    { key: "host", label: "Host", type: "text", placeholder: "192.168.1.100 or server.example.com", required: true },
    { key: "port", label: "Port", type: "number", placeholder: "22" },
    { key: "username", label: "Username", type: "text", placeholder: "root" },
    { key: "private_key", label: "Private Key", type: "textarea", placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----\n..." },
    { key: "passphrase", label: "Passphrase", type: "password", placeholder: "Key passphrase (if any)" },
    { key: "ssh_command", label: "SSH Command", type: "text", placeholder: "Auto-generated",
      generated: (f) => {
        const port = f.port && f.port !== "22" ? ` -p ${f.port}` : "";
        const user = f.username ? `${f.username}@` : "";
        return f.host ? `ssh${port} ${user}${f.host}` : "";
      }
    },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "OAuth Tokens": [
    { key: "client_id", label: "Client ID", type: "text", placeholder: "abc123.apps.googleusercontent.com", required: true },
    { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Client secret" },
    { key: "token_url", label: "Token URL", type: "url", placeholder: "https://oauth2.googleapis.com/token" },
    { key: "redirect_uri", label: "Redirect URI", type: "url", placeholder: "http://localhost:3000/callback" },
    { key: "scopes", label: "Scopes", type: "text", placeholder: "openid profile email" },
    { key: "access_token", label: "Access Token", type: "password", placeholder: "Current access token" },
    { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Refresh token" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "API Keys": [
    { key: "key_name", label: "Key Name", type: "text", placeholder: "e.g., Production, Staging", required: true },
    { key: "api_key", label: "API Key", type: "password", placeholder: "sk_live_...", required: true },
    { key: "base_url", label: "Base URL", type: "url", placeholder: "https://api.service.com/v1" },
    { key: "docs_url", label: "Documentation URL", type: "url", placeholder: "https://docs.service.com" },
    { key: "rate_limit", label: "Rate Limit", type: "text", placeholder: "e.g., 1000 req/min" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "Env Variables": [
    { key: "env_pairs", label: "Environment Variables", type: "textarea", placeholder: "KEY=value\nDATABASE_URL=postgres://...\nAPI_KEY=sk_...", required: true },
    { key: "environment", label: "Environment", type: "text", placeholder: "e.g., production, staging, local" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
  "Certificates": [
    { key: "domain", label: "Domain", type: "text", placeholder: "*.example.com", required: true },
    { key: "certificate", label: "Certificate (PEM)", type: "textarea", placeholder: "-----BEGIN CERTIFICATE-----\n..." },
    { key: "private_key", label: "Private Key (PEM)", type: "textarea", placeholder: "-----BEGIN PRIVATE KEY-----\n..." },
    { key: "ca_bundle", label: "CA Bundle", type: "textarea", placeholder: "Intermediate certificates..." },
    { key: "expiry_date", label: "Expiry Date", type: "text", placeholder: "2026-12-31" },
    { key: "issuer", label: "Issuer", type: "text", placeholder: "Let's Encrypt, DigiCert, etc." },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional context..." },
  ],
};

export function hasStructuredForm(categoryName: string): boolean {
  return categoryName in CATEGORY_FIELDS;
}

export default function StructuredSecretModal({
  categoryId,
  categoryName,
  secret,
  onClose,
  onSaved,
}: StructuredSecretModalProps) {
  const fields = CATEGORY_FIELDS[categoryName] || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState(secret?.name ?? "");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPwGen, setShowPwGen] = useState<string | null>(null);
  const [totpSetup, setTotpSetup] = useState(false);
  const [totpInput, setTotpInput] = useState("");
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState(30);
  const [totpValid, setTotpValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (secret) {
      api.revealSecret(secret.id).then((val) => {
        try {
          const parsed = JSON.parse(val);
          setValues(parsed);
        } catch {
          setValues({ value: val });
        }
      }).catch(console.error);
    }
  }, [secret]);

  const setValue = (key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      // Update generated fields
      fields.forEach((f) => {
        if (f.generated) {
          next[f.key] = f.generated(next);
        }
      });
      return next;
    });
  };

  // TOTP
  const handleSetTotp = async () => {
    if (!totpInput.trim()) return;
    const valid = await api.validateTotpSecret(totpInput);
    if (!valid) { setTotpValid(false); return; }
    const encrypted = await api.encryptCredentialField(totpInput.trim());
    setValue("totp_secret", encrypted);
    setTotpInput("");
    setTotpSetup(false);
    setTotpValid(null);
  };

  const refreshTotp = useCallback(async () => {
    if (!values.totp_secret) return;
    try {
      const result = await api.generateTotp(values.totp_secret);
      setTotpCode(result.code);
      setTotpRemaining(result.remaining_seconds);
    } catch { setTotpCode(null); }
  }, [values.totp_secret]);

  useEffect(() => {
    if (!values.totp_secret) return;
    refreshTotp();
    const interval = setInterval(refreshTotp, 1000);
    return () => clearInterval(interval);
  }, [values.totp_secret, refreshTotp]);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(values[key] || "");
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const secretName = name.trim() || values[fields[0]?.key] || categoryName;
    const secretValue = JSON.stringify(values);

    setLoading(true);
    try {
      if (secret) {
        await api.updateSecret(secret.id, secretName, secretValue, "", "");
      } else {
        await api.createSecret(categoryId, secretName, secretValue, "", "");
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setLoading(false);
    }
  };

  // For Env Variables — export as .env
  const handleExportEnv = () => {
    const content = values.env_pairs || "";
    navigator.clipboard.writeText(content);
    setCopied("env_export");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <form
        className="max-h-[80vh] w-[520px] overflow-y-auto rounded-lg border border-border bg-bg-base p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="mb-1 text-[16px] font-medium text-text-primary">
          {secret ? "Edit" : "Add"} {categoryName}
        </h3>
        <p className="mb-4 text-[11px] text-text-muted">All sensitive fields are encrypted</p>

        {/* Name */}
        <label className="mb-1 block text-[12px] text-text-secondary">Name</label>
        <input
          className="mb-4 w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g., ${categoryName === "Database" ? "Production DB" : categoryName === "SSH Keys" ? "Web Server" : "My " + categoryName}`}
          autoFocus
        />

        {/* Structured fields */}
        {fields.map((field) => (
          <div key={field.key} className="mb-3">
            <label className="mb-1 flex items-center justify-between text-[12px] text-text-secondary">
              <span>{field.label}{field.required ? " *" : ""}</span>
              {(field.type === "password" || field.generated) && (
                <div className="flex gap-1">
                  {field.type === "password" && (
                    <button type="button" className="text-[10px] text-accent hover:text-accent/80" onClick={() => setShowPwGen(field.key)}>Generate</button>
                  )}
                  {field.type === "password" && values[field.key] && (
                    <button
                      type="button"
                      className="text-[10px] text-text-dim hover:text-text-primary"
                      onClick={() => setShowPasswords((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    >
                      {showPasswords[field.key] ? "Hide" : "Show"}
                    </button>
                  )}
                  {values[field.key] && (
                    <button
                      type="button"
                      className={`text-[10px] ${copied === field.key ? "text-status-connected" : "text-text-dim hover:text-accent"}`}
                      onClick={() => handleCopy(field.key)}
                    >
                      {copied === field.key ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
              )}
            </label>
            {field.type === "totp" ? (
              values[field.key] ? (
                <div className="flex items-center justify-between rounded border border-border bg-bg-input px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 items-center justify-center">
                      <svg className="absolute h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-border)" strokeWidth="2" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray={`${(totpRemaining / 30) * 100.5} 100.5`} strokeLinecap="round" />
                      </svg>
                      <span className="text-[8px] text-text-muted">{totpRemaining}s</span>
                    </div>
                    <span className="font-mono text-[20px] font-bold tracking-[0.15em] text-text-primary">
                      {totpCode ? `${totpCode.substring(0, 3)} ${totpCode.substring(3)}` : "------"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className={`rounded px-2 py-0.5 text-[10px] ${copied === "totp" ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                      onClick={() => { if (totpCode) { navigator.clipboard.writeText(totpCode); setCopied("totp"); setTimeout(() => setCopied(null), 2000); } }}>
                      {copied === "totp" ? "Copied!" : "Copy"}
                    </button>
                    <button type="button" className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-status-disconnected"
                      onClick={() => setValue(field.key, "")}>Remove</button>
                  </div>
                </div>
              ) : totpSetup ? (
                <div>
                  <p className="mb-1.5 text-[11px] text-text-dim">Enter the secret key from your 2FA setup</p>
                  <div className="flex gap-1.5">
                    <input className="flex-1 rounded border border-border bg-bg-input px-3 py-2 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
                      value={totpInput} onChange={(e) => { setTotpInput(e.target.value); setTotpValid(null); }} placeholder="JBSWY3DPEHPK3PXP" />
                    <button type="button" className="rounded bg-accent px-3 py-2 text-[10px] font-medium text-bg-base" onClick={handleSetTotp}>Save</button>
                    <button type="button" className="rounded bg-bg-input px-2 py-2 text-[10px] text-text-muted" onClick={() => { setTotpSetup(false); setTotpInput(""); }}>Cancel</button>
                  </div>
                  {totpValid === false && <p className="mt-1 text-[10px] text-status-disconnected">Invalid secret</p>}
                </div>
              ) : (
                <button type="button" className="w-full rounded border border-dashed border-border px-3 py-2 text-left text-[11px] text-text-dim hover:border-accent hover:text-accent"
                  onClick={() => setTotpSetup(true)}>+ Set up 2FA authenticator</button>
              )
            ) : field.type === "textarea" ? (
              <textarea
                className="w-full rounded border border-border bg-bg-input px-3 py-2 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
                value={values[field.key] || ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={field.key === "env_pairs" ? 6 : field.key.includes("key") || field.key.includes("certificate") ? 4 : 2}
                readOnly={!!field.generated}
              />
            ) : (
              <input
                className={`w-full rounded border border-border bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent ${
                  field.generated ? "text-text-muted" : ""
                } ${field.type === "password" || field.key.includes("key") ? "font-mono" : ""}`}
                type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                value={values[field.key] || ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                readOnly={!!field.generated}
              />
            )}
          </div>
        ))}

        {/* Password generator modal */}
        {showPwGen && (
          <PasswordGenerator
            onGenerated={(pw) => setValue(showPwGen, pw)}
            onClose={() => setShowPwGen(null)}
          />
        )}

        {/* Env export button */}
        {categoryName === "Env Variables" && values.env_pairs && (
          <button
            type="button"
            className={`mb-4 w-full rounded border py-2 text-[12px] transition-colors ${
              copied === "env_export"
                ? "border-status-connected text-status-connected"
                : "border-accent text-accent hover:bg-accent/10"
            }`}
            onClick={handleExportEnv}
          >
            {copied === "env_export" ? "Copied to clipboard!" : "Copy as .env"}
          </button>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : secret ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
