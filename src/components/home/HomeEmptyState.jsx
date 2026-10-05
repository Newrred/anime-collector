import { IconArrowRight, IconPlus, IconSearch, IconBoard } from "../ui/AppIcons.jsx";
import "./home-collection.css";

export default function HomeEmptyState({ copy, onAddTitle, memoryHref }) {
  return (
    <section className="collection-start" aria-labelledby="home-empty-title">
      <header className="collection-start__heading">
        <p className="collection-kicker">{copy.eyebrow}</p>
        <h1 id="home-empty-title">{copy.promiseTitle}</h1>
        <p>{copy.promiseLead}</p>
      </header>
      <div className="collection-start__grid">
        <a className="collection-start__memory" href={memoryHref} data-astro-reload aria-label={copy.createMemory}>
          <div className="collection-start__canvas" aria-hidden="true"><span className="collection-start__frame"><IconPlus size={30} /></span></div>
          <div className="collection-start__caption"><div><h2>{copy.createMemory}</h2><p>{copy.specimenCue}</p></div><IconArrowRight size={22} /></div>
        </a>
        <button className="collection-start__titles" type="button" onClick={onAddTitle} aria-label={copy.searchTitles}>
          <div className="collection-start__shelf" aria-hidden="true"><span /><span /><span /></div>
          <div className="collection-start__caption"><div><h2>{copy.searchTitles}</h2><p>{copy.firstTitleLead}</p></div><IconSearch size={22} /></div>
        </button>
        <div className="collection-start__board">
          <div className="collection-start__mosaic" aria-hidden="true"><span /><span /><span /></div>
          <div className="collection-start__caption"><div><h2>{copy.boardsTitle}</h2><p>{copy.boardsLead}</p></div><IconBoard size={22} /></div>
        </div>
      </div>
      <p className="collection-start__privacy">{copy.localOnlyNote}</p>
    </section>
  );
}
