import { IconChevronDown } from "../ui/AppIcons.jsx";

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`small library-chip${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function StatBars({ rows, maxCount, emptyText = "데이터 없음" }) {
  if (!rows.length) return <div className="small">{emptyText}</div>;
  return (
    <div className="library-stat-bars">
      {rows.map((row) => {
        const width = maxCount > 0 ? Math.max(6, Math.round((row.count / maxCount) * 100)) : 0;
        return (
          <div key={row.key} className="library-stat-bar-row">
            <div className="small library-stat-bar-label">{row.label}</div>
            <div className="library-stat-bar-track">
              <div className="library-stat-bar-fill" style={{ width: `${width}%` }} />
            </div>
            <div className="small library-stat-bar-count">{row.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function SegTabButton({ active, onClick, children, className = "", ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`library-seg-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}

function CollapsiblePanelHeader({
  title,
  summary = null,
  open,
  onToggle,
  controlsId,
  openLabel,
  closedLabel,
}) {
  return (
    <button
      type="button"
      className={`library-panel-header-btn${open ? "" : " is-collapsed"}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={open ? openLabel : closedLabel}
    >
      <div className="library-panel-header-main">
        <h3 className="library-panel-header-title">{title}</h3>
        {summary ? <div className="small library-panel-header-summary">{summary}</div> : null}
      </div>
      <span className="library-panel-header-toggle" aria-hidden="true">
        <span className={`library-panel-header-chevron${open ? " is-open" : ""}`}>
          <IconChevronDown size={16} />
        </span>
      </span>
    </button>
  );
}

function GenresRow({ genres, max = 3, compact = false, formatGenreLabel = (value) => value, onPickGenre }) {
  const arr = Array.isArray(genres) ? genres : [];
  if (arr.length === 0) return null;

  const show = arr.slice(0, max);
  const rest = arr.length - show.length;

  return (
    <div className={`library-genres-row${compact ? " library-genres-row--compact" : ""}`}>
      {show.map((genre) => (
        <button
          key={genre}
          type="button"
          className="small library-genre-chip"
          title={genre}
          onClick={(event) => {
            event.stopPropagation();
            onPickGenre?.(genre, event);
          }}
          style={!onPickGenre ? { cursor: "default" } : undefined}
        >
          {formatGenreLabel(genre)}
        </button>
      ))}
      {rest > 0 && (
        <span className="small library-genre-rest" title={arr.map(formatGenreLabel).join(", ")}>
          +{rest}
        </span>
      )}
    </div>
  );
}

export { Chip, StatBars, SegTabButton, CollapsiblePanelHeader, GenresRow };
