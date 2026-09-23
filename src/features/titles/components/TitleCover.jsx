export default function TitleCover({ album, copy, className = "" }) {
  return (
    <div className={`title-cover ${className}`.trim()}>
      {album.officialCover?.src ? (
        <img
          src={album.officialCover.src}
          width={album.officialCover.width || 460}
          height={album.officialCover.height || 690}
          loading="lazy"
          alt={copy.coverAlt(album.displayTitle)}
        />
      ) : (
        <span><strong>{album.displayTitle || "MOEMOA"}</strong><small>{copy.missingCover}</small></span>
      )}
    </div>
  );
}
