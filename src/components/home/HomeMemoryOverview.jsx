import HomeRediscovery from "./HomeRediscovery.jsx";
import BoardCollectionGrid from "../../features/memory/components/BoardCollectionGrid.tsx";
import "./home-collection.css";

export default function HomeMemoryOverview({ base, copy, memory, locale = "ko" }) {
  const titleId = "home-memory-overview-title";
  return (
    <section className="home-section-block home-memory-overview" aria-labelledby={titleId}>
      <div className="home-collection-heading">
        <div><p className="collection-kicker">{locale === "ko" ? "나의 컬렉션" : "Your collection"}</p>
        <h1 id={titleId} className="pageTitle">{locale === "ko" ? "다시 보고 싶은 순간들" : "Worth coming back to."}</h1></div>
        <a className="btn" href={`${base}memory/new/`} aria-label={copy.createCard}>{locale === "ko" ? "+ 기억 남기기" : "+ Add Memory"}</a>
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
        {memory.boards?.length ? <section className="home-board-collections">
          <div className="collection-section-head"><h2>{locale === "ko" ? "나의 보드" : "Your boards"}</h2><a href={`${base}boards/`}>{locale === "ko" ? "모두 보기" : "View all"} →</a></div>
          <BoardCollectionGrid boards={memory.boards} runtime={memory.runtime} base={base} locale={locale} />
        </section> : null}
        <HomeRediscovery groups={memory.groups} base={base} locale={locale} />
      </> : null}

    </section>
  );
}
