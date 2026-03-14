import { Chip, CollapsiblePanelHeader, SegTabButton } from "./LibraryUi.jsx";
import { formatStatusLabel } from "./libraryCopy.js";
import { pickByLocale } from "../../domain/uiText";
import { IconSortAsc, IconSortDesc } from "../ui/AppIcons.jsx";

const STATUS_OPTIONS = ["전체", "완료", "보는중", "보류", "하차", "미분류"];

export default function LibraryFiltersPanel({
  locale = "ko",
  filteredCount,
  open,
  onToggle,
  sortKey,
  onSortKeyChange,
  status,
  onStatusChange,
  groupByStatus,
  onGroupByStatusChange,
  sortDir,
  onToggleSortDir,
  query,
  onQueryChange,
  cardView,
  onCardViewChange,
  genreSet,
  genreOptions,
  onClearGenres,
  onToggleGenre,
  cardsPerRowBase,
  onCardsPerRowBaseChange,
  effectiveCols,
  formatGenreLabel,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      title: "라이브러리 검색/정렬",
      showing: "현재",
      visible: "개 표시",
      open: "라이브러리 검색/정렬 접기",
      closed: "라이브러리 검색/정렬 펼치기",
      sort: { addedAt: "추가순", title: "제목순", score: "점수순", year: "연도순", genre: "장르순" },
      groupByStatus: "상태별 정렬",
      asc: "오름차순",
      desc: "내림차순",
      sortDirection: "정렬 방향 전환",
      searchPlaceholder: "보관함 검색 (제목/장르)",
      meta: "정보 함께",
      poster: "포스터만",
      genre: "장르:",
      allGenre: "장르 전체",
      all: "전체",
      clearSelected: "선택 해제",
      status: "상태:",
      statusTitle: "상태",
      cardSize: "카드 크기",
      sliderTitle: "그리드 가로 수 조절",
      base: "기준",
      current: "현재",
      cols: "열",
    },
    en: {
      title: "Library filters",
      showing: "Showing",
      visible: "",
      open: "Collapse library filters",
      closed: "Expand library filters",
      sort: { addedAt: "Recently added", title: "Title", score: "Score", year: "Year", genre: "Genre" },
      groupByStatus: "Group by status",
      asc: "Ascending",
      desc: "Descending",
      sortDirection: "Toggle sort direction",
      searchPlaceholder: "Search library (title/genre)",
      meta: "With meta",
      poster: "Poster only",
      genre: "Genre:",
      allGenre: "All genres",
      all: "All",
      clearSelected: "Clear",
      status: "Status:",
      statusTitle: "Status",
      cardSize: "Card size",
      sliderTitle: "Adjust grid density",
      base: "Base",
      current: "Current",
      cols: "cols",
    },
  });
  return (
    <section className="library-panel">
      <CollapsiblePanelHeader
        title={copy.title}
        summary={locale === "en" ? `${copy.showing} ${filteredCount}` : `${copy.showing} ${filteredCount}${copy.visible}`}
        open={open}
        onToggle={onToggle}
        controlsId="library-filter-panel-content"
        openLabel={copy.open}
        closedLabel={copy.closed}
      />

      {open && (
        <div id="library-filter-panel-content">
          <div className="library-filter-row">
            <select
              className="select library-filter-select library-filter-select--sort"
              value={sortKey}
              onChange={(event) => onSortKeyChange(event.target.value)}
            >
              <option value="addedAt">{copy.sort.addedAt}</option>
              <option value="title">{copy.sort.title}</option>
              <option value="score">{copy.sort.score}</option>
              <option value="year">{copy.sort.year}</option>
              <option value="genre">{copy.sort.genre}</option>
            </select>
            <select
              className="select library-filter-select library-filter-select--status"
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option}>{formatStatusLabel(option, locale)}</option>
              ))}
            </select>
            <div className="library-filter-actions">
              <label className="library-filter-actions-label">
                <input
                  type="checkbox"
                  checked={groupByStatus}
                  onChange={(event) => onGroupByStatusChange(event.target.checked)}
                />
                <span className="small">{copy.groupByStatus}</span>
              </label>
              <button
                type="button"
                className="btn btn--icon"
                onClick={onToggleSortDir}
                aria-label={`${copy.sortDirection}: ${sortDir === "asc" ? copy.asc : copy.desc}`}
                title={sortDir === "asc" ? copy.asc : copy.desc}
              >
                {sortDir === "asc" ? <IconSortAsc /> : <IconSortDesc />}
              </button>
            </div>
          </div>

          <div className="library-search-row">
            <input
              className="input library-search-input"
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <div className="library-seg-wrap library-view-mode">
              <SegTabButton active={cardView === "meta"} onClick={() => onCardViewChange("meta")}>
                {copy.meta}
              </SegTabButton>
              <SegTabButton active={cardView === "poster"} onClick={() => onCardViewChange("poster")}>
                {copy.poster}
              </SegTabButton>
            </div>
          </div>

          <div className="library-chip-row">
            <div className="small library-chip-label">{copy.genre}</div>
            <div className="library-chip-scroll">
              <Chip active={genreSet.size === 0} onClick={onClearGenres} title={copy.allGenre}>
                {copy.all}
              </Chip>
              {genreOptions.map((genre) => (
                <Chip
                  key={genre}
                  active={genreSet.has(genre)}
                  onClick={() => onToggleGenre(genre)}
                  title={genre}
                >
                  {formatGenreLabel(genre)}
                </Chip>
              ))}
            </div>
            {genreSet.size > 0 && (
              <button type="button" className="btn library-chip-reset" onClick={onClearGenres}>
                {copy.clearSelected}({genreSet.size})
              </button>
            )}
          </div>

          <div className="library-chip-row">
            <div className="small library-chip-label">{copy.status}</div>
            <div className="library-chip-scroll">
              {STATUS_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  active={status === option}
                  onClick={() => onStatusChange(option)}
                  title={locale === "en"
                    ? `${copy.statusTitle} ${formatStatusLabel(option, locale)}`
                    : `${copy.statusTitle} ${formatStatusLabel(option, locale)}`}
                >
                  {formatStatusLabel(option, locale)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="library-card-size-row">
            <div className="small library-card-size-label">{copy.cardSize}</div>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={Number(cardsPerRowBase) || 5}
              onChange={(event) => onCardsPerRowBaseChange(Number(event.target.value))}
              className="library-card-size-slider"
              title={copy.sliderTitle}
            />
            <div className="small library-card-size-value">
              {locale === "en"
                ? `${copy.base} ${Number(cardsPerRowBase) || 5} · ${copy.current} ${effectiveCols} ${copy.cols}`
                : `${copy.base} ${Number(cardsPerRowBase) || 5} · ${copy.current} ${effectiveCols}${copy.cols}`}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
