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

function SegTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`library-seg-btn${active ? " is-active" : ""}`}
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
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          style={{
            display: "block",
            transition: "transform 160ms ease",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <path
            d="M5.5 7.5L10 12l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
