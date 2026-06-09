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
  const [showOtherMethods, setShowOtherMethods] = useState(false);

  useEffect(() => {
    if (!isNewVault) {
      Promise.all([
        api.getAuthMethodsLocked(),
        api.getPreferredAuthLocked(),
      ]).then(([methods, preferred]) => {
        setAuthMethods(methods);
        const pref = preferred as AuthTab;
        // Use preferred if it's still enabled, otherwise fall back
        if (pref === "biometric" && methods.biometric) {
          setActiveTab("biometric");
        } else if (pref === "pin" && methods.pin) {
          setActiveTab("pin");
        } else {
          setActiveTab("password");
        }
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
    setPin(pin + digit);
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

        {/* Auth method tabs — only shown when "Other methods" is clicked */}
        {!isNewVault && showOtherMethods && availableTabs.length > 1 && (
          <div className="mb-5 flex rounded-md border border-border bg-bg-card">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                className={`flex-1 py-2 text-[12px] capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text-muted hover:text-text-primary"
                }`}
                onClick={() => { setActiveTab(tab); setLocalError(null); setPin(""); setShowOtherMethods(false); }}
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

        {/* PIN keyboard input */}
        {!isNewVault && activeTab === "pin" && <PinKeyboardListener onDigit={handlePinInput} onBackspace={handlePinBackspace} onSubmit={() => { if (pin.length >= 4) handlePinSubmit(pin); }} disabled={loading} />}

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

            <button
              className="mt-3 mx-auto block w-[240px] rounded bg-accent py-2.5 text-[14px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
              onClick={() => handlePinSubmit(pin)}
              disabled={loading || pin.length < 4}
            >
              {loading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        )}

        {/* Biometric */}
        {!isNewVault && activeTab === "biometric" && (
          <div className="flex flex-col items-center pt-4">
            <button
              className={`group relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                loading
                  ? "border-accent/70 bg-accent/10"
                  : "border-accent/30 hover:border-accent hover:bg-accent/5"
              }`}
              onClick={handleBiometric}
              disabled={loading}
            >
              {loading && (
                <span className="absolute inset-0 animate-ping rounded-full border border-accent/20" />
              )}
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors ${loading ? "text-accent" : "text-accent/70 group-hover:text-accent"}`}>
                {/* Fingerprint ridges — offset arcs like a real print */}
                <path d="M12 2C6.48 2 2 6.48 2 12" />
                <path d="M22 12c0-5.52-4.48-10-10-10" />
                <path d="M12 6c-3.31 0-6 2.69-6 6 0 1.2.36 2.34 1 3.28" />
                <path d="M18 12c0-3.31-2.69-6-6-6" />
                <path d="M12 10c-1.1 0-2 .9-2 2 0 1.75.5 3.4 1 4.8" />
                <path d="M14 12c0-1.1-.9-2-2-2" />
                <path d="M17 12c0 2.76-.5 5.28-1.4 7" />
                <path d="M12 22c.7-1.8 1-3.9 1-6" />
              </svg>
            </button>
            <div className="mt-5 text-[13px] text-text-muted">
              {loading ? "Authenticating..." : "Tap to unlock with Touch ID"}
            </div>

            {displayError && activeTab === "biometric" && (
              <div className="mt-4 rounded bg-status-disconnected/10 px-4 py-2 text-[12px] text-status-disconnected">
                {displayError}
              </div>
            )}
          </div>
        )}
        {/* Other methods link */}
        {!isNewVault && availableTabs.length > 1 && !showOtherMethods && (
          <button
            className="mt-6 w-full text-center text-[12px] text-text-dim transition-colors hover:text-text-muted"
            onClick={() => setShowOtherMethods(true)}
          >
            Other login methods
          </button>
        )}
      </div>
    </div>
  );
}

function PinKeyboardListener({ onDigit, onBackspace, onSubmit, disabled }: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        onDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDigit, onBackspace, onSubmit, disabled]);
  return null;
}
