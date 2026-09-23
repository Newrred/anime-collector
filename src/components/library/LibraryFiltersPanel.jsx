import { Chip, CollapsiblePanelHeader, SegTabButton } from "./LibraryUi.jsx";
import { formatStatusLabel } from "./libraryCopy.js";
import { getMessageGroup } from "../../domain/messages.js";
import { IconSortAsc, IconSortDesc } from "../ui/AppIcons.jsx";

const STATUS_OPTIONS = ["전체", "완료", "보는중", "보류", "하차", "미분류"];

function resolveSortOptions(copy, options) {
  if (Array.isArray(options) && options.length) return options;
  return [
    { value: "addedAt", label: copy.sort.addedAt },
    { value: "title", label: copy.sort.title },
    { value: "score", label: copy.sort.score },
    { value: "year", label: copy.sort.year },
    { value: "genre", label: copy.sort.genre },
  ];
}

function resolveStatusOptions(locale, options) {
  if (Array.isArray(options) && options.length) return options;
  return STATUS_OPTIONS.map((value) => ({ value, label: formatStatusLabel(value, locale) }));
}

function resolveViewOptions(copy, options) {
  if (Array.isArray(options) && options.length === 2) return options;
  return [
    { value: "meta", label: copy.meta },
    { value: "poster", label: copy.poster },
  ];
}

function ViewModeToggle({ cardView, onCardViewChange, options, customOptions, viewLabel }) {
  const activeViewIndex = options.findIndex((option) => option.value === cardView);
  return (
    <div
      className="library-seg-wrap library-view-mode seg-toggle-2"
      data-active-index={activeViewIndex === 1 ? "1" : "0"}
      role={customOptions ? "radiogroup" : undefined}
      aria-label={customOptions ? viewLabel : undefined}
    >
      {options.map((option) => (
        <SegTabButton
          key={option.value}
          active={cardView === option.value}
          onClick={() => onCardViewChange(option.value)}
          role={customOptions ? "radio" : undefined}
          className={customOptions ? "library-seg-btn--page-toggle" : ""}
        >
          {option.label}
        </SegTabButton>
      ))}
    </div>
  );
}

function StatusSelectRow({ status, onStatusChange, options, showGroupByStatus, groupByStatus, onGroupByStatusChange, copy }) {
  return (
    <div className="library-filter-row">
      <select
        className="select library-filter-select library-filter-select--status"
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {showGroupByStatus && (
        <div className="library-filter-actions">
          <label className="library-filter-actions-label">
            <input
              type="checkbox"
              checked={groupByStatus}
              onChange={(event) => onGroupByStatusChange(event.target.checked)}
            />
            <span className="small">{copy.groupByStatus}</span>
          </label>
        </div>
      )}
    </div>
  );
}

function GenreFilterRow({ genreSet, genreOptions, onClearGenres, onToggleGenre, formatGenreLabel, copy }) {
  return (
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
  );
}

function StatusChipRow({ status, onStatusChange, options, copy }) {
  return (
    <div className="library-chip-row">
      <div className="small library-chip-label">{copy.status}</div>
      <div className="library-chip-scroll">
        {options.map((option) => (
          <Chip
            key={option.value}
            active={status === option.value}
            onClick={() => onStatusChange(option.value)}
            title={`${copy.statusTitle} ${option.label}`}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function CardSizeRow({ locale, cardsPerRowBase, onCardsPerRowBaseChange, effectiveCols, copy }) {
  const baseColumns = Number(cardsPerRowBase) || 5;
  const value = locale === "en"
    ? `${copy.base} ${baseColumns} · ${copy.current} ${effectiveCols} ${copy.cols}`
    : `${copy.base} ${baseColumns} · ${copy.current} ${effectiveCols}${copy.cols}`;
  return (
    <div className="library-card-size-row">
      <div className="small library-card-size-label">{copy.cardSize}</div>
      <input
        type="range"
        min={2}
        max={10}
        step={1}
        value={baseColumns}
        onChange={(event) => onCardsPerRowBaseChange(Number(event.target.value))}
        className="library-card-size-slider"
        title={copy.sliderTitle}
      />
      <div className="small library-card-size-value">{value}</div>
    </div>
  );
}

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
  sortOptions = null,
  statusOptions = null,
  viewOptions = null,
  viewLabel = null,
  showGroupByStatus = true,
  showStatusSelect = true,
  searchPlaceholder = null,
  searchAriaLabel = null,
  controlsId = "library-filter-panel-content",
}) {
  const copy = getMessageGroup(locale, "libraryFiltersPanel");
  const resolvedSortOptions = resolveSortOptions(copy, sortOptions);
  const resolvedStatusOptions = resolveStatusOptions(locale, statusOptions);
  const resolvedViewOptions = resolveViewOptions(copy, viewOptions);
  const customViewOptions = Array.isArray(viewOptions);
  const visibleSummary = locale === "en"
    ? `${copy.showing} ${filteredCount}`
    : `${copy.showing} ${filteredCount}${copy.visible}`;

  return (
    <section className="library-panel">
      <div className="library-search-row">
        <input
          type="search"
          className="input library-search-input"
          placeholder={searchPlaceholder || copy.searchPlaceholder}
          aria-label={searchAriaLabel || searchPlaceholder || copy.searchPlaceholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <select
          className="select library-filter-select library-filter-select--sort"
          value={sortKey}
          onChange={(event) => onSortKeyChange(event.target.value)}
        >
          {resolvedSortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ViewModeToggle
          cardView={cardView}
          onCardViewChange={onCardViewChange}
          options={resolvedViewOptions}
          customOptions={customViewOptions}
          viewLabel={viewLabel}
        />
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

      <CollapsiblePanelHeader
        title={copy.title}
        summary={visibleSummary}
        open={open}
        onToggle={onToggle}
        controlsId={controlsId}
        openLabel={copy.open}
        closedLabel={copy.closed}
      />

      {open && (
        <div id={controlsId}>
          {showStatusSelect && <StatusSelectRow
            status={status}
            onStatusChange={onStatusChange}
            options={resolvedStatusOptions}
            showGroupByStatus={showGroupByStatus}
            groupByStatus={groupByStatus}
            onGroupByStatusChange={onGroupByStatusChange}
            copy={copy}
          />}
          <GenreFilterRow
            genreSet={genreSet}
            genreOptions={genreOptions}
            onClearGenres={onClearGenres}
            onToggleGenre={onToggleGenre}
            formatGenreLabel={formatGenreLabel}
            copy={copy}
          />
          <StatusChipRow status={status} onStatusChange={onStatusChange} options={resolvedStatusOptions} copy={copy} />
          <CardSizeRow
            locale={locale}
            cardsPerRowBase={cardsPerRowBase}
            onCardsPerRowBaseChange={onCardsPerRowBaseChange}
            effectiveCols={effectiveCols}
            copy={copy}
          />
        </div>
      )}
    </section>
  );
}
