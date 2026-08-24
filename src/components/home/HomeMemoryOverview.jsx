import MemoryCardPreview from "../../features/memory/components/MemoryCardPreview.jsx";

export default function HomeMemoryOverview({ base, copy, memory }) {
  const titleId = "home-memory-overview-title";
  const latest = memory.latest;
  const visual = latest?.asset?.designSpec
    ? { kind: "SYSTEM_DESIGN", designSpec: latest.asset.designSpec }
    : latest?.previewDataUrl
      ? {
          kind: "IMAGE",
          src: latest.previewDataUrl,
          alt: copy.imageAlt(latest.title.displayTitle),
        }
      : { kind: "MISSING" };

  return (
    <section className="home-section-block home-memory-overview" aria-labelledby={titleId}>
      <div className="pageHeader">
        <p className="sectionLead">{copy.eyebrow}</p>
        <h2 id={titleId} className="sectionTitle home-section-title">{copy.title}</h2>
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

      {memory.status === "ready" && latest && (
        <div className="surface-card home-memory-overview__featured">
          <MemoryCardPreview
            href={`${base}memory/card/?id=${encodeURIComponent(latest.card.id)}`}
            title={latest.title.displayTitle}
            cue={latest.card.note || ""}
            badge={copy.latest}
            visual={visual}
            variant="featured"
            systemCopy={{
              label: copy.systemLabel,
              fallbackTitle: latest.title.displayTitle,
              footer: copy.systemFooter,
            }}
            missingLabel={copy.imageMissing}
          />
          <div className="home-memory-overview__utility">
            <span className="status-badge">{copy.count(memory.count)}</span>
            <div className="action-row">
              <a className="btn" href={`${base}archive/`}>{copy.openArchive}</a>
              <a className="btn btn--subtle" href={`${base}memory/new/`} data-astro-reload>{copy.createAnother}</a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
