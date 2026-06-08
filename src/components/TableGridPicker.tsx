import { useState } from "react";

const MAX_ROWS = 8;
const MAX_COLS = 8;

interface TableGridPickerProps {
  onInsert: (rows: number, cols: number) => void;
  onClose: () => void;
}

export default function TableGridPicker({ onInsert, onClose }: TableGridPickerProps) {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 mt-1 rounded-lg border border-border bg-bg-base p-2.5 shadow-lg">
        <div className="mb-1.5 text-center text-[11px] text-text-muted">
          {hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : "Select size"}
        </div>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)` }}
          onMouseLeave={() => { setHoverRow(0); setHoverCol(0); }}
        >
          {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
            const row = Math.floor(i / MAX_COLS) + 1;
            const col = (i % MAX_COLS) + 1;
            const isActive = row <= hoverRow && col <= hoverCol;
            return (
              <div
                key={i}
                className={`h-[18px] w-[18px] rounded-[2px] border transition-colors cursor-pointer ${
                  isActive
                    ? "border-accent bg-accent/25"
                    : "border-border-subtle bg-bg-input"
                }`}
                onMouseEnter={() => { setHoverRow(row); setHoverCol(col); }}
                onClick={() => {
                  onInsert(row, col);
                  onClose();
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
