export default function HomeEmptyState({ copy, stage, onAddTitle, libraryHref, memoryHref }) {
  const first = stage === "add-first-title";
  const needsMoreTitles = stage === "add-three-titles";
  const title = first ? copy.firstTitle : needsMoreTitles ? copy.moreTitles : copy.firstLog;
  const lead = first ? copy.firstTitleLead : needsMoreTitles ? copy.moreTitlesLead : copy.firstLogLead;
  return (
    <section className="surface-card home-empty-state" aria-labelledby="home-empty-title">
      <p className="sectionLead">{copy.eyebrow}</p>
      <h1 id="home-empty-title" className="pageTitle">{title}</h1>
      <p className="pageLead">{lead}</p>
      <a className="btn" href={memoryHref}>{copy.createMemory}</a>
      {first || needsMoreTitles ? (
        <button type="button" className="btn btn--subtle" onClick={onAddTitle}>
          {first ? copy.addFirstTitle : copy.addMoreTitles}
        </button>
      ) : (
        <a className="btn btn--subtle" href={libraryHref}>{copy.writeFirstLog}</a>
      )}
    </section>
  );
}
