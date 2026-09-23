import HomeRediscovery from "./HomeRediscovery.jsx";

export default function HomeMemoryOverview({ base, copy, memory, locale = "ko" }) {
  const titleId = "home-memory-overview-title";
  return (
    <section className="home-section-block home-memory-overview" aria-labelledby={titleId}>
      <div className="pageHeader">
        <h1 id={titleId} className="sectionTitle home-section-title">{memory.groups ? (locale === "ko" ? "내 기억 다시 보기" : "Return to your memories") : copy.title}</h1>
      </div>

      {memory.status === "loading" && (
        <div className="surface-card home-memory-state home-memory-state--loading" role="status">
          <span className="home-memory-state__pulse" aria-hidden="true" />
          <p>{copy.loading}</p>
        </div>
      )}

      {memory.status === "error" && (
        <div className="surface-card ui-panel-stack home-memory-state home-memory-state--error" role="alert">
          <strong>{copy.errorTitle}</strong>
          <p>{copy.errorLead}</p>
          <a className="btn btn--subtle" href={`${base}archive/`}>{copy.openArchive}</a>
        </div>
      )}

      {memory.status === "ready" && memory.groups ? <>
        <div className="action-row"><a className="btn" href={`${base}memory/new/`}>{locale === "ko" ? "기억 남기기" : "Add Memory"}</a><a className="btn btn--subtle" href={`${base}archive/`}>{copy.openArchive}</a></div>
        <HomeRediscovery groups={memory.groups} base={base} locale={locale} />
      </> : null}

    </section>
  );
}
