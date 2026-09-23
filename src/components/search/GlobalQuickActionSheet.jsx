import { useModalInteraction } from "../../hooks/useModalInteraction.js";
import { IconX } from "../ui/AppIcons.jsx";

export default function GlobalQuickActionSheet({
  open = false,
  title = "",
  closeLabel = "Close",
  onClose,
  children,
}) {
  const dialogRef = useModalInteraction({ open, onClose });

  if (!open) return null;

  return (
    <div className="quick-action-sheet" data-modal-layer>
      <button type="button" className="quick-action-sheet__backdrop" tabIndex={-1} aria-label={closeLabel} onClick={onClose} />
      <div ref={dialogRef} tabIndex={-1} className="quick-action-sheet__panel" role="dialog" aria-modal="true" aria-label={title}>
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
