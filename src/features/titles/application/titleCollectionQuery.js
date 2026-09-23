const FILTERS = new Set([
  "ALL",
  "SAVED",
  "HAS_MEMORY",
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
  "UNSORTED",
]);
const SORTS = new Set(["RECENT_MEMORY", "RECENT_SAVED", "TITLE", "SCORE", "YEAR", "GENRE"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const VIEW_MODES = new Set(["POSTER", "MEMORY"]);

const text = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
const searchKey = (value) => text(value).toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]/gu, "");

const normalizeGenres = (genres) => Object.freeze([
  ...new Set((Array.isArray(genres) ? genres : []).map(text).filter(Boolean).slice(0, 32)),
]);

export function normalizeTitleCollectionControls({ filter, sort, sortDir, query, genres } = {}) {
  const normalizedSort = SORTS.has(sort) ? sort : "RECENT_MEMORY";
  return Object.freeze({
    filter: FILTERS.has(filter) ? filter : "ALL",
    sort: normalizedSort,
    sortDir: SORT_DIRECTIONS.has(sortDir)
      ? sortDir
      : (normalizedSort === "TITLE" || normalizedSort === "GENRE" ? "asc" : "desc"),
    query: [...text(query)].slice(0, 120).join(""),
    genres: normalizeGenres(genres),
  });
}

const matchesFilter = (album, filter) => {
  if (filter === "SAVED") return album.tracking?.isSaved === true;
  if (filter === "HAS_MEMORY") return Number(album.memoryCount) > 0;
  if (filter === "WATCHING") return album.tracking?.watchStatus === "보는중";
  if (filter === "COMPLETED") return album.tracking?.watchStatus === "완료";
  if (filter === "ON_HOLD") return album.tracking?.watchStatus === "보류";
  if (filter === "DROPPED") return album.tracking?.watchStatus === "하차";
  if (filter === "UNSORTED") return !album.tracking?.watchStatus || album.tracking.watchStatus === "미분류";
  return true;
};

const byTitle = (left, right) => left.displayTitle.localeCompare(right.displayTitle, "ko");
const byLatestMemory = (left, right) => String(left.latestMemoryAt || "").localeCompare(String(right.latestMemoryAt || ""));
const byRecentSaved = (left, right) => Number(left.libraryItem?.addedAt || 0) - Number(right.libraryItem?.addedAt || 0);
const byScore = (left, right) => Number(left.tracking?.rating ?? -1) - Number(right.tracking?.rating ?? -1);
const yearOf = (album) => Number(String(album.catalogDetail?.release?.startDate || "").slice(0, 4)) || -1;
const byYear = (left, right) => yearOf(left) - yearOf(right);
const genreKey = (album) => (Array.isArray(album.genres) ? album.genres : []).join("|");
const byGenre = (left, right) => genreKey(left).localeCompare(genreKey(right), "ko");

const compareAlbums = (left, right, sort) => {
  if (sort === "TITLE") return byTitle(left, right);
  if (sort === "SCORE") return byScore(left, right);
  if (sort === "YEAR") return byYear(left, right);
  if (sort === "GENRE") return byGenre(left, right);
  if (sort === "RECENT_SAVED") {
    return byRecentSaved(left, right) || byLatestMemory(left, right);
  }
  return byLatestMemory(left, right) || byRecentSaved(left, right);
};

export function applyTitleCollectionQuery(albums = [], controls = {}) {
  const normalized = normalizeTitleCollectionControls(controls);
  const query = searchKey(normalized.query);
  const selectedGenres = new Set(normalized.genres);
  const result = (Array.isArray(albums) ? albums : []).filter((album) => {
    if (!matchesFilter(album, normalized.filter)) return false;
    const albumGenres = Array.isArray(album.genres) ? album.genres : [];
    if (selectedGenres.size && !albumGenres.some((genre) => selectedGenres.has(genre))) return false;
    if (!query) return true;
    return [
      album.displayTitle,
      ...(Array.isArray(album.aliases) ? album.aliases : []),
      ...albumGenres,
      ...(Array.isArray(album.genreSearchLabels) ? album.genreSearchLabels : []),
    ]
      .some((value) => searchKey(value).includes(query));
  });
  const direction = normalized.sortDir === "asc" ? 1 : -1;
  return result.sort((left, right) => (
    direction * compareAlbums(left, right, normalized.sort)
    || byTitle(left, right)
    || String(left.key || "").localeCompare(String(right.key || ""))
  ));
}

export function chooseInitialTitleViewMode(storedMode, albums = []) {
  if (VIEW_MODES.has(storedMode)) return storedMode;
  return (Array.isArray(albums) ? albums : []).some((album) => Number(album?.memoryCount) > 0)
    ? "MEMORY"
    : "POSTER";
}
