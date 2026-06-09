import { useState } from "react";
import * as api from "../hooks/useTauri";

interface PasswordGeneratorProps {
  onGenerated: (password: string) => void;
  onClose: () => void;
}

export default function PasswordGenerator({ onGenerated, onClose }: PasswordGeneratorProps) {
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    const pw = await api.generatePassword(length, uppercase, lowercase, numbers, symbols);
    setPassword(pw);
  };

  const handleUse = () => {
    onGenerated(password);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[400px] rounded-lg border border-border bg-bg-base shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-text-primary">Generate Password</span>
          <button className="text-[14px] text-text-muted hover:text-text-primary" onClick={onClose}>&times;</button>
        </div>

        <div className="p-4">
          {/* Generated password */}
          {password && (
            <div className="mb-4 flex items-center gap-2 rounded border border-border bg-bg-tabbar px-3 py-2">
              <span className="flex-1 break-all font-mono text-[13px] text-text-primary">{password}</span>
              <button
                className={`rounded px-2 py-0.5 text-[10px] ${copied ? "text-status-connected" : "text-text-muted hover:text-accent"}`}
                onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000); }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {/* Length */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[12px] text-text-secondary">
              <span>Length</span>
              <span className="font-mono text-accent">{length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="mt-1 w-full accent-[var(--color-accent)]"
            />
          </div>

          {/* Options */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            {[
              { label: "Uppercase (A-Z)", value: uppercase, set: setUppercase },
              { label: "Lowercase (a-z)", value: lowercase, set: setLowercase },
              { label: "Numbers (0-9)", value: numbers, set: setNumbers },
              { label: "Symbols (!@#$)", value: symbols, set: setSymbols },
            ].map(({ label, value, set }) => (
              <button
                key={label}
                className={`rounded border px-3 py-1.5 text-[11px] transition-colors ${
                  value ? "border-accent bg-accent/10 text-accent" : "border-border text-text-dim"
                }`}
                onClick={() => set(!value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 rounded border border-accent py-2 text-[13px] text-accent hover:bg-accent/10"
              onClick={generate}
            >
              Generate
            </button>
            {password && (
              <button
                className="flex-1 rounded bg-accent py-2 text-[13px] font-medium text-bg-base hover:opacity-90"
                onClick={handleUse}
              >
                Use Password
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
