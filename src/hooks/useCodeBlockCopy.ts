import { useState, useEffect } from "react";

interface CopyBtnPos {
  top: number;
  right: number;
  pre: HTMLPreElement;
}

export function useCodeBlockCopy(containerSelector: string, deps: unknown[] = []) {
  const [copyBtnPos, setCopyBtnPos] = useState<CopyBtnPos | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const handleMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      const pre = target.closest("pre") as HTMLPreElement | null;
      if (pre) {
        const rect = pre.getBoundingClientRect();
        setCopyBtnPos({ top: rect.top + 3, right: window.innerWidth - rect.right + 8, pre });
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.relatedTarget as HTMLElement | null;
      if (!target?.closest("pre") && !target?.closest(".floating-code-copy")) {
        setCopyBtnPos(null);
        setCopyFeedback(false);
      }
    };

    // Hide on scroll — fixed position goes stale
    const scrollParent = container.closest(".overflow-y-auto") || container.parentElement;
    const handleScroll = () => {
      setCopyBtnPos(null);
      setCopyFeedback(false);
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseleave", handleMouseLeave as EventListener);
    scrollParent?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseleave", handleMouseLeave as EventListener);
      scrollParent?.removeEventListener("scroll", handleScroll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const handleCopy = () => {
    if (!copyBtnPos) return;
    const code = copyBtnPos.pre.querySelector("code");
    navigator.clipboard.writeText(code?.textContent || copyBtnPos.pre.textContent || "");
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleMouseLeave = () => {
    setCopyBtnPos(null);
    setCopyFeedback(false);
  };

  return { copyBtnPos, copyFeedback, handleCopy, handleMouseLeave };
}
