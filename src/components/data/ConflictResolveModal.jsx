import { formatRelativeAgo } from "../../domain/uiText";
import { IconDownload, IconUpload, IconX } from "../ui/AppIcons.jsx";

export default function ConflictResolveModal({
  open = false,
  locale = "ko",
  copy,
  conflict,
  syncing = false,
  onClose,
  onKeepLocal,
  onUseCloud,
  onExportBackup,
}) {
  if (!open) return null;

  return (
    <div className="modalOverlay conflict-modal">
      <div className="modalCard conflict-modal__card">
        <button type="button" className="closeBtn" onClick={onClose} aria-label={copy.close}>
          <IconX size={16} />
        </button>
        <div className="pageHeader">
          <h2 className="sectionTitle">{copy.title}</h2>
          <p className="pageLead">{copy.lead}</p>
        </div>

        <div className="conflict-modal__meta">
          <div className="small status-badge">{copy.localChanged}</div>
          <div className="small status-badge">
            {copy.remoteChanged}{" "}
            {formatRelativeAgo(Date.parse(conflict?.remoteUpdatedAt || ""), locale, copy.unknownRemote)}
          </div>
        </div>

        <div className="conflict-modal__actions">
          <button type="button" className="btn" onClick={onKeepLocal} disabled={syncing}>
            <span className="btn__icon"><IconUpload size={14} /></span>
            <span className="btn__label">{copy.keepLocal}</span>
          </button>
          <button type="button" className="btn btn--subtle" onClick={onUseCloud} disabled={syncing}>
            <span className="btn__icon"><IconDownload size={14} /></span>
            <span className="btn__label">{copy.useCloud}</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExportBackup} disabled={syncing}>
            <span className="btn__label">{copy.exportBackup}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
