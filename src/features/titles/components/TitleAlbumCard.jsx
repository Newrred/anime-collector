import { buildMemoryCardHref } from "../../../domain/search/memoryCardNavigation.js";
import { GenresRow } from "../../../components/library/LibraryUi.jsx";
import MemoryVisual from "../../memory/components/MemoryVisual.jsx";
import PrivateMemoryCardPreview from "../../memory/components/PrivateMemoryCardPreview.jsx";
import TitleCover from "./TitleCover.jsx";

const stateText = (album, copy) => [
  album.tracking?.isSaved ? copy.saved : copy.notSaved,
  album.tracking?.watchStatus ? copy.status[album.tracking.watchStatus] : null,
  copy.memoryCount(album.memoryCount),
].filter(Boolean).join(" · ");

export default function TitleAlbumCard({ album, href, base, native, copy, locale, titleKey, formatGenre, onPickGenre }) {
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
            <PrivateMemoryCardPreview key={memory.card.id} bundle={memory} locale={locale} visual={memory.visual} title={album.displayTitle} missingLabel={copy.missingMemory}>
              {({ visual, missingLabel, elementRef }) => (
                <a ref={elementRef} className="title-album-card__preview" href={`${base}memory/card/?id=${encodeURIComponent(memory.card.id)}`} aria-label={`${album.displayTitle} · ${memory.card.note || copy.latestCue}`} data-astro-reload>
                  <MemoryVisual
                    visual={visual}
                    fit={memory.sourceKind === "CATALOG_COVER" ? "contain" : "cover"}
                    systemCopy={{
                      fallbackTitle: album.displayTitle,
                      label: copy.systemDesignLabel,
                      footer: copy.systemDesignFooter,
                    }}
                    missingLabel={missingLabel}
                  />
                  {index === album.previewMemories.length - 1 && extra > 0 ? <span className="title-album-card__extra">+{extra}</span> : null}
                </a>
              )}
            </PrivateMemoryCardPreview>
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
