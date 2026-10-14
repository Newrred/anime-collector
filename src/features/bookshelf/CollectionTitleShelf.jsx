import TitlePosterTile from "../titles/components/TitlePosterTile.jsx";
import TitleAlbumCard from "../titles/components/TitleAlbumCard.jsx";

export default function CollectionTitleShelf({ albums, shelf, selected, onSelect, onClose, hrefFor, base, copy, locale, view }) {
  const ko = locale === "ko";
  if (view === "table") return <table className="channel-table"><thead><tr><th>{ko ? "작품" : "Title"}</th><th>{ko ? "기억" : "Memories"}</th></tr></thead><tbody>{albums.map(album => <tr key={album.key}><td><a href={hrefFor(album)}>{album.displayTitle}</a></td><td>{album.memoryCount}</td></tr>)}</tbody></table>;
  return <section className="bookshelf-grid" aria-label={ko ? `${shelf} · 진열한 작품` : `${shelf} · Displayed titles`}>{albums.map(album => {
    const id = `${shelf}:${album.key}`, expanded = selected === id;
    return <div key={album.key} className={`bookshelf-tile ${album.previewMemories.length ? "has-memories" : ""} ${expanded ? "is-expanded" : ""}`}>
      <div className="bookshelf-cover-area">
        <button type="button" className="bookshelf-cover-trigger" aria-label={`${album.displayTitle} ${ko ? "기억 펼치기" : "open memories"}`} aria-expanded={expanded} aria-controls={`collection-memories-${id}`} onClick={() => expanded ? onClose() : onSelect(id)}><span>{expanded ? (ko ? "접기 ×" : "Close ×") : (ko ? "기억 보기 ↗" : "Memories ↗")}</span></button>
        <TitlePosterTile album={album} href={hrefFor(album)} copy={copy} titleKey={album.key} locale={locale} />
      </div>
      {expanded && <div id={`collection-memories-${id}`} className="bookshelf-film collection-memory-fan" role="region" aria-label={`${album.displayTitle} · ${copy.memoryCount(album.memoryCount)}`}><button type="button" className="film-close btn btn--subtle" onClick={onClose}>{ko ? "접기 ×" : "Close ×"}</button><TitleAlbumCard album={album} href={hrefFor(album)} base={base} copy={copy} locale={locale} titleKey={album.key} formatGenre={v => v} />{album.memoryCount > 0 && <a className="bookshelf-film-more" href={hrefFor(album)}>{ko ? `기억 ${album.memoryCount}개 모두 보기 →` : `View all ${album.memoryCount} memories →`}</a>}</div>}
    </div>;
  })}</section>;
}
