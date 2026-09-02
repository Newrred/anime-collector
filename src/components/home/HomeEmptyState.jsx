import MemoryVisual from "../../features/memory/components/MemoryVisual.jsx";
import { IconArrowRight, IconPlus, IconSearch, IconShield } from "../ui/AppIcons.jsx";

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
        <p className="home-empty-state__eyebrow">
          <IconShield size={15} />
          <span>{copy.eyebrow}</span>
        </p>
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
        <a className="btn home-empty-state__primary" href={memoryHref} data-astro-reload>
          <IconPlus size={18} />
          <span>{copy.createMemory}</span>
          <IconArrowRight size={16} />
        </a>
        <button type="button" className="btn btn--subtle home-empty-state__secondary" onClick={onAddTitle}>
          <IconSearch size={17} />
          <span>{copy.searchTitles}</span>
        </button>
      </div>

      <ol className="home-empty-state__flow" aria-label={copy.flowLabel}>
        {copy.flowSteps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>

      <p className="small home-empty-state__local-note">{copy.localOnlyNote}</p>
    </section>
  );
}
