import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export function useDragDrop(onFilesDropped: (paths: string[]) => void) {
  const [isDragging, setIsDragging] = useState(false);

  const stableCallback = useCallback(onFilesDropped, [onFilesDropped]);

  useEffect(() => {
    const unlistenDrop = listen<DragDropPayload>(
      "tauri://drag-drop",
      (event) => {
        setIsDragging(false);
        if (event.payload.paths && event.payload.paths.length > 0) {
          stableCallback(event.payload.paths);
        }
      },
    );

    const unlistenEnter = listen("tauri://drag-enter", () => {
      setIsDragging(true);
    });

    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });

    return () => {
      unlistenDrop.then((fn) => fn());
      unlistenEnter.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [stableCallback]);

  return { isDragging };
}
