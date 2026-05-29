import { useState } from "react";

interface LockScreenProps {
  isNewVault: boolean;
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
}

export default function LockScreen({
  isNewVault,
  onSubmit,
  error,
}: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg-base">
      <div className="w-[360px]">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">
            Dev<span className="text-accent">Notebook</span>
          </h1>
          <p className="mt-2 text-[13px] text-text-muted">
            {isNewVault
              ? "Create a master password to protect your vault"
              : "Enter your master password to unlock"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-[12px] text-text-secondary">
            Master Password
          </label>
          <input
            className="mb-3 w-full rounded border border-border bg-bg-input px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter master password"
            autoFocus
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

          {displayError && (
            <div className="mb-3 rounded bg-status-disconnected/10 px-3 py-2 text-[12px] text-status-disconnected">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-2 w-full rounded bg-accent py-2.5 text-[14px] font-medium text-bg-base transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isNewVault
                ? "Create Vault"
                : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
