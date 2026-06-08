export default function StatusBar() {
  return (
    <div className="flex items-center justify-between border-t border-border bg-bg-tabbar px-4 py-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 text-text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-connected" />
        <span>Vault encrypted</span>
      </div>
      <div className="text-text-dim">
        Lock: ⌘L
      </div>
    </div>
  );
}
