import { buildMemoryCardHref } from "../../../domain/search/memoryCardNavigation.js";
import { GenresRow } from "../../../components/library/LibraryUi.jsx";
import MemoryVisual from "../../memory/components/MemoryVisual.jsx";
import TitleCover from "./TitleCover.jsx";

const stateText = (album, copy) => [
  album.tracking?.isSaved ? copy.saved : copy.notSaved,
  album.tracking?.watchStatus ? copy.status[album.tracking.watchStatus] : null,
  copy.memoryCount(album.memoryCount),
].filter(Boolean).join(" · ");

export default function TitleAlbumCard({ album, href, base, native, copy, titleKey, formatGenre, onPickGenre }) {
  const extra = Math.max(0, album.memoryCount - album.previewMemories.length);
  const composerHref = buildMemoryCardHref({
    base, native, row: { catalogAnimeId: album.titleRef.animeId, privateTitleId: album.titleRef.privateTitleId, title: album.displayTitle },
  });
  return (
    <article className="surface-card title-album-card" data-title-key={titleKey}>
      <a className="title-album-card__identity" href={href} data-astro-reload>
        <TitleCover album={album} copy={copy} className="title-album-card__cover" />
        <span className="title-album-card__copy">
          <span className="title-album-card__title">{album.displayTitle}</span>
          <span className="title-album-card__state">{stateText(album, copy)}</span>
          {album.isPrivateTitle ? <span className="status-badge">{copy.privateTitle}</span> : null}
        </span>
      </a>
      <GenresRow
        genres={album.genres}
        max={4}
        compact={true}
        formatGenreLabel={formatGenre}
        onPickGenre={onPickGenre}
      />
      {album.previewMemories.length ? (
        <div className="title-album-card__previews" style={{ gridTemplateColumns: `repeat(${Math.min(3, album.previewMemories.length)}, minmax(0, 1fr))` }} aria-label={copy.memoryCount(album.memoryCount)}>
          {album.previewMemories.map((memory, index) => (
            <a className="title-album-card__preview" key={memory.card.id} href={`${base}memory/card/?id=${encodeURIComponent(memory.card.id)}`} aria-label={`${album.displayTitle} · ${memory.card.note || copy.latestCue}`} data-astro-reload>
              <MemoryVisual
                visual={memory.visual}
                fit={memory.sourceKind === "CATALOG_COVER" ? "contain" : "cover"}
                systemCopy={{
                  fallbackTitle: album.displayTitle,
                  label: copy.systemDesignLabel,
                  footer: copy.systemDesignFooter,
                }}
                missingLabel={copy.missingMemory}
              />
              {index === album.previewMemories.length - 1 && extra > 0 ? <span className="title-album-card__extra">+{extra}</span> : null}
            </a>
          ))}
        </div>
      ) : (
        <div className="title-album-card__empty">
          <p>{copy.memoryCount(0)}</p>
          {composerHref ? <a className="btn btn--subtle" href={composerHref} data-astro-reload>{copy.firstMemory}</a> : null}
        </div>
      )}
      {album.memories[0]?.card?.note ? (
        <p className="title-album-card__cue"><span>{copy.latestCue}</span>{album.memories[0].card.note}</p>
      ) : null}
    </article>
  );
}
