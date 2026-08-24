import MemoryVisual from "../../features/memory/components/MemoryVisual.jsx";

const HOME_SPECIMEN = Object.freeze({
  version: 1,
  templateId: "memory-gradient",
  paletteId: "violet-night",
  patternSeed: "moemoa-home-private-memory",
  titleLayout: "BOTTOM_LEFT",
  genreTokens: ["Memory"],
});

export default function HomeEmptyState({ copy, onAddTitle, memoryHref }) {
  return (
    <section className="surface-card home-empty-state" aria-labelledby="home-empty-title">
      <div className="home-empty-state__promise">
        <p className="sectionLead">{copy.eyebrow}</p>
        <h1 id="home-empty-title" className="pageTitle">{copy.promiseTitle}</h1>
        <p className="pageLead home-empty-state__copy">{copy.promiseLead}</p>
      </div>

      <div className="home-empty-state__specimen" aria-label={copy.specimenLabel}>
        <MemoryVisual
          visual={{ kind: "SYSTEM_DESIGN", designSpec: HOME_SPECIMEN }}
          systemCopy={{
            label: copy.systemLabel,
            fallbackTitle: copy.specimenTitle,
            footer: copy.systemFooter,
          }}
        />
        <p className="home-empty-state__specimen-cue">{copy.specimenCue}</p>
      </div>

      <div className="home-empty-state__actions">
        <a className="btn" href={memoryHref}>{copy.createMemory}</a>
        <button type="button" className="btn btn--subtle" onClick={onAddTitle}>
          {copy.searchTitles}
        </button>
      </div>

      <p className="small home-empty-state__local-note">{copy.localOnlyNote}</p>
    </section>
  );
}
