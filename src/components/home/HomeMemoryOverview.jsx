import SystemDesignPreview from "../../features/memory/components/SystemDesignPreview.jsx";

export default function HomeMemoryOverview({ base, copy, memory }) {
  const titleId = "home-memory-overview-title";
  const latest = memory.latest;

  return (
    <section className="home-section-block home-memory-overview" aria-labelledby={titleId}>
      <div className="pageHeader">
        <p className="sectionLead">{copy.eyebrow}</p>
        <h2 id={titleId} className="sectionTitle home-section-title">{copy.title}</h2>
      </div>

      {memory.status === "loading" && (
        <p className="surface-card" role="status">{copy.loading}</p>
      )}

      {memory.status === "error" && (
        <div className="surface-card ui-panel-stack" role="alert">
          <strong>{copy.errorTitle}</strong>
          <p>{copy.errorLead}</p>
          <a className="btn btn--subtle" href={`${base}archive/`}>{copy.openArchive}</a>
        </div>
      )}

      {memory.status === "ready" && !latest && (
        <div className="surface-card ui-panel-stack">
          <strong>{copy.emptyTitle}</strong>
          <p>{copy.emptyLead}</p>
          <a className="btn" href={`${base}memory/new/`}>{copy.createCard}</a>
        </div>
      )}

      {memory.status === "ready" && latest && (
        <article className="surface-card home-focus-card">
          <div className="home-focus-card__layout">
            <div className="home-focus-card__body">
              <span className="status-badge">{copy.count(memory.count)}</span>
              <p className="small home-focus-card__source">{copy.latest}</p>
              <a
                href={`${base}memory/card/?id=${encodeURIComponent(latest.card.id)}`}
                className="home-memory-overview__card-link"
              >
                <h3 className="home-focus-card__title">{latest.title.displayTitle}</h3>
              </a>
              {latest.card.note ? <p className="home-focus-card__cue">{latest.card.note}</p> : null}
              <div className="action-row">
                <a className="btn" href={`${base}archive/`}>{copy.openArchive}</a>
                <a className="btn btn--subtle" href={`${base}memory/new/`}>{copy.createCard}</a>
              </div>
            </div>
            <div className="home-focus-card__visual">
              {latest.asset.designSpec ? (
                <SystemDesignPreview spec={latest.asset.designSpec} title={latest.title.displayTitle} />
              ) : latest.previewDataUrl ? (
                <img src={latest.previewDataUrl} alt={copy.imageAlt(latest.title.displayTitle)} />
              ) : (
                <div className="ui-empty-state ui-empty-state--compact">{copy.imageMissing}</div>
              )}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
