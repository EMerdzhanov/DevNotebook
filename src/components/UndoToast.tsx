import { useState, useEffect, useCallback } from "react";

export interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
  onExpire: () => void;
}

interface UndoToastProps {
  action: UndoAction | null;
  onDismiss: () => void;
}

const UNDO_TIMEOUT = 10000; // 10 seconds

export default function UndoToast({ action, onDismiss }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!action) return;

    setProgress(100);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / UNDO_TIMEOUT) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        action.onExpire();
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [action, onDismiss]);

  const handleUndo = useCallback(() => {
    if (!action) return;
    action.onUndo();
    onDismiss();
  }, [action, onDismiss]);

  if (!action) return null;

  return (
    <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-lg border border-border bg-bg-card px-4 py-3 shadow-lg">
        <span className="text-[13px] text-text-primary">{action.message}</span>
        <button
          className="rounded bg-accent px-3 py-1 text-[12px] font-medium text-bg-base hover:opacity-90"
          onClick={handleUndo}
        >
          Undo
        </button>
        <button
          className="text-[12px] text-text-muted hover:text-text-primary"
          onClick={() => {
            action.onExpire();
            onDismiss();
          }}
        >
          Dismiss
        </button>
      </div>
      {/* Progress bar */}
      <div className="mx-2 mt-1 h-0.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-accent transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
