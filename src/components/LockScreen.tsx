import { useState, useEffect } from "react";
import * as api from "../hooks/useTauri";

interface LockScreenProps {
  isNewVault: boolean;
  onSubmit: (password: string) => Promise<void>;
  onUnlocked: () => void;
  error: string | null;
}

type AuthTab = "password" | "pin" | "biometric";

export default function LockScreen({
  isNewVault,
  onSubmit,
  onUnlocked,
  error,
}: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AuthTab>("password");
  const [authMethods, setAuthMethods] = useState({ password: true, pin: false, biometric: false });

  useEffect(() => {
    if (!isNewVault) {
      api.getAuthMethodsLocked().then((methods) => {
        setAuthMethods(methods);
        // Default to biometric if available, then PIN, then password
        if (methods.biometric) setActiveTab("biometric");
        else if (methods.pin) setActiveTab("pin");
      }).catch(() => {});
    }
  }, [isNewVault]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (isNewVault && password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    if (password.length < 8 && isNewVault) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(password);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (submittedPin: string) => {
    setLocalError(null);
    setLoading(true);
    try {
      await api.unlockWithPin(submittedPin);
      onUnlocked();
    } catch (err) {
      setLocalError(String(err));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setLocalError(null);
    setLoading(true);
    try {
      await api.unlockWithBiometric();
      onUnlocked();
    } catch (err) {
      setLocalError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length >= 8) return;
    const next = pin + digit;
    setPin(next);
    if (next.length >= 4) {
      // Auto-submit when PIN is long enough (after small delay for visual feedback)
      setTimeout(() => handlePinSubmit(next), 150);
    }
  };

  const handlePinBackspace = () => {
    setPin((p) => p.slice(0, -1));
  };

  const displayError = localError || error;
  const availableTabs = isNewVault
    ? []
    : ([
        authMethods.password && "password",
        authMethods.pin && "pin",
        authMethods.biometric && "biometric",
      ].filter(Boolean) as AuthTab[]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg-base">
      <div className="w-[360px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">
            Dev<span className="text-accent">Notebook</span>
          </h1>
          <p className="mt-2 text-[13px] text-text-muted">
            {isNewVault
              ? "Create a master password to protect your vault"
              : "Unlock your vault"}
          </p>
        </div>

        {/* Auth method tabs (only for existing vaults with multiple methods) */}
        {!isNewVault && availableTabs.length > 1 && (
          <div className="mb-5 flex rounded-md border border-border bg-bg-card">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                className={`flex-1 py-2 text-[12px] capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text-muted hover:text-text-primary"
                }`}
                onClick={() => { setActiveTab(tab); setLocalError(null); setPin(""); }}
              >
                {tab === "biometric" ? "Fingerprint" : tab === "pin" ? "PIN" : "Password"}
              </button>
            ))}
          </div>
        )}

        {/* Password form */}
        {(isNewVault || activeTab === "password") && (
          <form onSubmit={handlePasswordSubmit}>
            <label className="mb-1 block text-[12px] text-text-secondary">
              Master Password
            </label>
            <input
              className="mb-3 w-full rounded border border-border bg-bg-input px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              autoFocus={activeTab === "password" || isNewVault}
            />

            {isNewVault && (
              <>
                <label className="mb-1 block text-[12px] text-text-secondary">
                  Confirm Password
                </label>
                <input
                  className="mb-3 w-full rounded border border-border bg-bg-input px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm master password"
                />
              </>
            )}

            {displayError && activeTab === "password" && (
              <div className="mb-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="mt-2 w-full rounded bg-accent py-2.5 text-[14px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Processing..." : isNewVault ? "Create Vault" : "Unlock"}
            </button>
          </form>
        )}

        {/* PIN pad */}
        {!isNewVault && activeTab === "pin" && (
          <div>
            {/* PIN dots */}
            <div className="mb-5 flex justify-center gap-2">
              {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border transition-colors ${
                    i < pin.length
                      ? "border-accent bg-accent"
                      : "border-border"
                  }`}
                />
              ))}
            </div>

            {displayError && activeTab === "pin" && (
              <div className="mb-3 rounded bg-status-disconnected/10 px-3 py-2 text-center text-[12px] text-status-disconnected">
                {displayError}
              </div>
            )}

            {/* Number grid */}
            <div className="mx-auto grid w-[240px] grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  className="rounded-md border border-border bg-bg-card py-3 text-[18px] text-text-primary transition-colors hover:border-accent hover:bg-bg-input"
                  onClick={() => handlePinInput(String(n))}
                  disabled={loading}
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                className="rounded-md border border-border bg-bg-card py-3 text-[18px] text-text-primary transition-colors hover:border-accent hover:bg-bg-input"
                onClick={() => handlePinInput("0")}
                disabled={loading}
              >
                0
              </button>
              <button
                className="rounded-md border border-border bg-bg-card py-3 text-[14px] text-text-muted transition-colors hover:text-text-primary"
                onClick={handlePinBackspace}
                disabled={loading}
              >
                ←
              </button>
            </div>

            {loading && (
              <div className="mt-4 text-center text-[12px] text-text-muted">Unlocking...</div>
            )}
          </div>
        )}

        {/* Biometric */}
        {!isNewVault && activeTab === "biometric" && (
          <div className="text-center">
            <button
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/50 transition-colors hover:border-accent hover:bg-accent/5"
              onClick={handleBiometric}
              disabled={loading}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02.1 2.51.412 4.12M12 10a2 2 0 0 1 2 2c0 1.02-.1 2.51-.412 4.12M12 14c0 1.02-.1 2.51-.412 4.12" />
                <path d="M3.1 7.9C3.04 8.26 3 8.63 3 9c0 7 3 11 9 11 1 0 1.88-.12 2.67-.36" />
                <path d="M7.2 4.8A7 7 0 0 1 19 9c0 2-.4 3.7-1 5.2" />
                <path d="M5 12c0-1.68.33-3.17.87-4.39" />
                <path d="M17 9.87C17 9.25 17 8.63 17 9c0 1.68-.33 3.17-.87 4.39" />
              </svg>
            </button>
            <div className="mt-4 text-[13px] text-text-muted">
              {loading ? "Authenticating..." : "Tap to unlock with fingerprint"}
            </div>

            {displayError && activeTab === "biometric" && (
              <div className="mt-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
                {displayError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
