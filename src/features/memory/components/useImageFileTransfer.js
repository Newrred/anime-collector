import { useEffect, useRef, useState } from "react";
import { filesFromTransfer, isEditablePasteTarget } from "../application/imageTransferFiles.js";

// Read only the File supplied by an explicit drop/paste. Never request clipboard
// permission, inspect its text, or fetch a URL from it.
export function useImageFileTransfer({ active, disabled, onFile, onError }) {
  const regionRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const current = useRef({ active, disabled, onFile, onError });
  current.current = { active, disabled, onFile, onError };

  const receive = (event, transfer) => {
    if (!current.current.active) return;
    const files = filesFromTransfer(transfer);
    if (!files.length) return;
    event.preventDefault();
    if (current.current.disabled) return;
    if (files.length !== 1) {
      current.current.onError("IMAGE_ONE_AT_A_TIME");
      return;
    }
    void current.current.onFile(files[0]);
  };

  useEffect(() => {
    if (!active) return;
    const paste = (event) => {
      const region = regionRef.current;
      const target = event.composedPath?.()[0] || event.target;
      if (!region?.isConnected || region.getClientRects().length === 0
        || isEditablePasteTarget(target)) return;
      // Body focus is common when returning from an OS screenshot. Other UI
      // (account menus, dialogs) must not silently replace the image.
      if (target !== document.body && target !== document.documentElement
        && !region.contains(target)) return;
      receive(event, event.clipboardData);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [active]);

  useEffect(() => {
    if (!active || disabled) { dragDepth.current = 0; setDragging(false); }
  }, [active, disabled]);

  const isFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");
  return {
    regionRef,
    dragging,
    handlers: {
      onDragEnter(event) {
        if (!active || !isFileDrag(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        if (!disabled) setDragging(true);
      },
      onDragOver(event) {
        if (!active || !isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      },
      onDragLeave(event) {
        if (!active || !isFileDrag(event)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      },
      onDrop(event) {
        dragDepth.current = 0;
        setDragging(false);
        receive(event, event.dataTransfer);
      },
    },
  };
}
