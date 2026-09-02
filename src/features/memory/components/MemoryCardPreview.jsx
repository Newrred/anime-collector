import MemoryVisual from "./MemoryVisual.jsx";
import "./memory-card-preview.css";

export default function MemoryCardPreview({
  href,
  title,
  cue = "",
  dateLabel = "",
  badge = "",
  syncBadge = "",
  visual,
  variant = "grid",
  systemCopy = {},
  missingLabel = "Visual unavailable",
  className = "",
}) {
  const previewVariant = variant === "featured" ? "featured" : "grid";
  const displayTitle = String(title || "").trim();
  const visualSystemCopy = visual?.kind === "SYSTEM_DESIGN"
    ? { ...systemCopy, fallbackTitle: displayTitle || systemCopy.fallbackTitle }
    : systemCopy;

  return (
    <article className={`memory-visual-scope memory-preview memory-preview--${previewVariant} ${className}`.trim()}>
      <MemoryVisual visual={visual} systemCopy={visualSystemCopy} missingLabel={missingLabel} />
      <div className="memory-preview__body">
        <div className="memory-preview__meta">
          <span className="memory-preview__badges">
            {badge ? <span className="memory-preview__badge">{badge}</span> : null}
            {syncBadge ? <span className="status-badge">{syncBadge}</span> : null}
          </span>
          {dateLabel ? <span className="memory-preview__date">{dateLabel}</span> : null}
        </div>
        <a className="memory-preview__link" href={href} data-astro-reload>
          <h3 className="memory-preview__title">{displayTitle}</h3>
        </a>
        {cue ? <p className="memory-preview__cue">{cue}</p> : null}
      </div>
    </article>
  );
}
