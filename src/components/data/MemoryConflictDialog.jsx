import { IconDownload, IconUpload, IconX } from "../ui/AppIcons.jsx";

const readValue = (entity, camel, snake = camel) => entity?.[camel] ?? entity?.[snake] ?? null;
const noteFor = (entity, empty) => String(readValue(entity, "note") ?? empty);
const titleFor = (conflict, fallback) => {
  const local = conflict?.localEntity;
  const cloud = conflict?.remoteEntity;
  return String(
    readValue(local, "titleSnapshot", "title_snapshot")
    || readValue(cloud, "titleSnapshot", "title_snapshot")
    || readValue(local, "displayTitle", "display_title")
    || readValue(cloud, "displayTitle", "display_title")
    || fallback,
  );
};

export default function MemoryConflictDialog({ copy, conflict, busy, onClose, onKeepLocal, onUseCloud, onExport }) {
  if (!conflict) return null;
  return (
    <div className="modalOverlay conflict-modal" role="presentation">
      <section className="modalCard conflict-modal__card" role="dialog" aria-modal="true" aria-labelledby="memory-conflict-title">
        <button type="button" className="closeBtn" onClick={onClose} aria-label={copy.close} disabled={busy}>
          <IconX size={16} />
        </button>
        <div className="pageHeader">
          <h2 id="memory-conflict-title" className="sectionTitle">{copy.title}</h2>
          <p className="pageLead">{copy.lead}</p>
        </div>
        <div className="small status-badge">{titleFor(conflict, copy.unknownTitle)}</div>
        <div className="memory-conflict__compare">
          <article>
            <h3 className="sectionTitle sectionTitle--small">{copy.localVersion}</h3>
            <p className="small memory-conflict__note">{noteFor(conflict.localEntity, copy.emptyNote)}</p>
          </article>
          <article>
            <h3 className="sectionTitle sectionTitle--small">{copy.cloudVersion}</h3>
            <p className="small memory-conflict__note">{noteFor(conflict.remoteEntity, copy.emptyNote)}</p>
          </article>
        </div>
        <div className="conflict-modal__actions">
          <button type="button" className="btn" onClick={onKeepLocal} disabled={busy}>
            <span className="btn__icon"><IconUpload size={14} /></span>
            <span className="btn__label">{copy.keepLocal}</span>
          </button>
          <button type="button" className="btn btn--subtle" onClick={onUseCloud} disabled={busy}>
            <span className="btn__icon"><IconDownload size={14} /></span>
            <span className="btn__label">{copy.useCloud}</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExport} disabled={busy}>{copy.exportBackup}</button>
        </div>
      </section>
    </div>
  );
}
