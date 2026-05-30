interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-[380px] rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[15px] font-medium text-text-primary">{title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            className="rounded px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`rounded px-4 py-2 text-[13px] font-medium transition-colors ${
              danger
                ? "bg-status-disconnected text-white hover:opacity-90"
                : "bg-accent text-bg-base hover:opacity-90"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
