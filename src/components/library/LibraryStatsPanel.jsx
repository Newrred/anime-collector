import { CollapsiblePanelHeader, StatBars } from "./LibraryUi.jsx";
import { getMessageGroup } from "../../domain/messages.js";

export default function LibraryStatsPanel({
  locale = "ko",
  dashboard,
  open,
  onToggle,
  onOpenAnime,
  scoreMax,
}) {
  const copy = getMessageGroup(locale, "libraryStatsPanel");
  return (
    <section className="library-panel library-panel--stats">
      <CollapsiblePanelHeader
        title={copy.title}
        summary={locale === "en"
          ? `${copy.summary} ${dashboard.total} · ${copy.average} ${dashboard.averageScore == null ? "-" : `${dashboard.averageScore.toFixed(2)} / ${scoreMax}`} (${dashboard.scored} ${copy.scored})`
          : `${copy.summary} ${dashboard.total}개 · ${copy.average} ${dashboard.averageScore == null ? "-" : `${dashboard.averageScore.toFixed(2)} / ${scoreMax}`} (${dashboard.scored}${copy.scored})`}
        open={open}
        onToggle={onToggle}
        controlsId="stats-board-content"
        openLabel={copy.open}
        closedLabel={copy.closed}
      />

      {open && (
        <div id="stats-board-content" className="library-stats-grid">
          <div className="library-stats-card ui-panel-stack">
            <div className="library-stats-card-title">{copy.status}</div>
            <StatBars rows={dashboard.statusRows} maxCount={dashboard.maxStatus} emptyText={copy.noData} />
          </div>
          <div className="library-stats-card ui-panel-stack">
            <div className="library-stats-card-title">{copy.genre}</div>
            <StatBars rows={dashboard.genreRows} maxCount={dashboard.maxGenre} emptyText={copy.noData} />
          </div>
          <div className="library-stats-card ui-panel-stack">
            <div className="library-stats-card-title">{copy.rewatch}</div>
            {dashboard.rewatchRows.length === 0 ? (
              <div className="small ui-empty-state ui-empty-state--compact">{copy.empty}</div>
            ) : (
              <div className="library-rewatch-list">
                {dashboard.rewatchRows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => onOpenAnime(row.id)}
                    className="library-rewatch-item"
                    title={`${row.title} · ${row.count}${copy.times}`}
                  >
                    <div className="library-rewatch-item-grid">
                      <div className="small library-rewatch-item-title">{row.title}</div>
                      <div className="small library-rewatch-item-count">{row.count}{copy.times}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
