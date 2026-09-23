import TitleCover from "./TitleCover.jsx";

export default function TitlePosterTile({ album, href, copy, titleKey }) {
  return (
    <article className="card library-card library-card--poster title-poster-tile" data-title-key={titleKey}>
      <a href={href} data-astro-reload aria-label={album.displayTitle} title={album.displayTitle}>
        <TitleCover album={album} copy={copy} className="title-poster-tile__cover" />
      </a>
    </article>
  );
}
