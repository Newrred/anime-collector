import { CollapsiblePanelHeader, StatBars } from "./LibraryUi.jsx";
import { pickByLocale } from "../../domain/uiText";

export default function LibraryStatsPanel({
  locale = "ko",
  dashboard,
  open,
  onToggle,
  onOpenAnime,
  scoreMax,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      title: "통계 대시보드",
      summary: "총",
      average: "평균 점수",
      scored: "개 채점",
      open: "통계 대시보드 접기",
      closed: "통계 대시보드 펼치기",
      status: "상태별 분류",
      genre: "시청 장르 상위 5",
      rewatch: "재주행 TOP 5",
      empty: "재주행 기록이 없습니다.",
      times: "회",
    },
    en: {
      title: "Stats dashboard",
      summary: "Total",
      average: "Average score",
      scored: "scored",
      open: "Collapse stats dashboard",
      closed: "Expand stats dashboard",
      status: "Status breakdown",
      genre: "Top 5 genres",
      rewatch: "Top 5 rewatches",
      empty: "No rewatch data yet.",
      times: "x",
    },
  });
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
          <div className="library-stats-card">
            <div className="library-stats-card-title">{copy.status}</div>
            <StatBars rows={dashboard.statusRows} maxCount={dashboard.maxStatus} emptyText={locale === "en" ? "No data" : "데이터 없음"} />
          </div>
          <div className="library-stats-card">
            <div className="library-stats-card-title">{copy.genre}</div>
            <StatBars rows={dashboard.genreRows} maxCount={dashboard.maxGenre} emptyText={locale === "en" ? "No data" : "데이터 없음"} />
          </div>
          <div className="library-stats-card">
            <div className="library-stats-card-title">{copy.rewatch}</div>
            {dashboard.rewatchRows.length === 0 ? (
              <div className="small">{copy.empty}</div>
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
