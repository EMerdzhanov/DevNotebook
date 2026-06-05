interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { category: "Navigation", items: [
    { keys: ["Cmd", "K"], description: "Global search" },
    { keys: ["Cmd", "Shift", "K"], description: "Command palette" },
    { keys: ["Cmd", "?"], description: "Show keyboard shortcuts" },
    { keys: ["Space"], description: "Quick Look file preview" },
    { keys: ["Esc"], description: "Close modal / Quick Look" },
  ]},
  { category: "Secrets", items: [
    { keys: ["Double-click"], description: "Rename project tab" },
    { keys: ["Hover", "Copy"], description: "Quick copy first secret in category" },
  ]},
  { category: "Editor", items: [
    { keys: ["Cmd", "B"], description: "Bold text" },
    { keys: ["Cmd", "I"], description: "Italic text" },
    { keys: ["Cmd", "Shift", "X"], description: "Strikethrough" },
    { keys: ["Cmd", "E"], description: "Inline code" },
    { keys: ["Cmd", "Shift", "8"], description: "Bullet list" },
    { keys: ["Cmd", "Shift", "9"], description: "Ordered list" },
  ]},
  { category: "App", items: [
    { keys: ["Cmd", "T"], description: "Toggle To Do panel" },
    { keys: ["Cmd", "Shift", "L"], description: "Toggle Library view" },
    { keys: ["Cmd", "L"], description: "Lock vault" },
    { keys: ["Cmd", ","], description: "Open settings" },
  ]},
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[500px] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[15px] font-medium text-text-primary">
            Keyboard Shortcuts
          </h3>
          <button
            className="text-[14px] text-text-muted hover:text-text-primary"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-5">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-accent">
                {section.category}
              </div>
              <div className="space-y-1.5">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-[13px] text-text-secondary">
                      {item.description}
                    </span>
                    <div className="flex gap-1">
                      {item.keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="rounded border border-border bg-bg-input px-1.5 py-0.5 text-[11px] text-text-primary"
                        >
                          {key === "Cmd" ? "\u2318" : key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-2 text-center text-[10px] text-text-dim">
          Press Esc to close
        </div>
      </div>
    </div>
  );
}
