import TitleCover from "./TitleCover.jsx";

export default function TitlePosterTile({ album, href, copy, titleKey }) {
  return (
    <article className="card library-card library-card--poster title-poster-tile" data-title-key={titleKey}>
      <a href={href} data-astro-reload aria-label={album.displayTitle} title={album.displayTitle}>
        <TitleCover album={album} copy={copy} className="title-poster-tile__cover" />
        <div className="title-poster-tile__caption">
          <h2>{album.displayTitle}</h2>
          <p>{[album.tracking?.watchStatus ? copy.status[album.tracking.watchStatus] : album.tracking?.isSaved ? copy.saved : copy.notSaved, copy.memoryCount(album.memoryCount)].filter(Boolean).join(" · ")}</p>
        </div>
      </a>
    </article>
  );
}
