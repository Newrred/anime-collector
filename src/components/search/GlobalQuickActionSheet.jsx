import { useEffect } from "react";
import { IconX } from "../ui/AppIcons.jsx";

export default function GlobalQuickActionSheet({
  open = false,
  title = "",
  closeLabel = "Close",
  onClose,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="quick-action-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="quick-action-sheet__backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className="quick-action-sheet__panel">
        <div className="quick-action-sheet__header">
          <div className="quick-action-sheet__title">{title}</div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label={closeLabel}>
            <IconX size={18} />
          </button>
        </div>
        <div className="quick-action-sheet__body">{children}</div>
      </div>
    </div>
  );
}
