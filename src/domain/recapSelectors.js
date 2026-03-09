function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseYearMonthFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return { year: null, month: null, season: null };

  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      season: null,
    };
  }

  m = raw.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      season: null,
    };
  }

  m = raw.match(/^(\d{4})-(Spring|Summer|Fall|Winter)$/i);
  if (m) {
    return {
      year: Number(m[1]),
      month: null,
      season: `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}`,
    };
  }

  m = raw.match(/^(\d{4})$/);
  if (m) {
    return {
      year: Number(m[1]),
      month: null,
      season: null,
    };
  }

  return { year: null, month: null, season: null };
}

function seasonFromMonth(month) {
  const mm = Number(month);
  if (!Number.isFinite(mm)) return null;
  if (mm >= 3 && mm <= 5) return "Spring";
  if (mm >= 6 && mm <= 8) return "Summer";
  if (mm >= 9 && mm <= 11) return "Fall";
  return "Winter";
}

function readLogYearSeason(log) {
  const fromValue = parseYearMonthFromValue(log?.watchedAtValue);
  if (Number.isFinite(fromValue.year)) {
    return {
      year: fromValue.year,
      season: fromValue.season || seasonFromMonth(fromValue.month),
    };
  }

  const fromStart = parseYearMonthFromValue(log?.watchedAtStart);
  if (Number.isFinite(fromStart.year)) {
    return {
      year: fromStart.year,
      season: fromStart.season || seasonFromMonth(fromStart.month),
    };
  }

  const sort = Number(log?.watchedAtSort || log?.createdAt);
  if (!Number.isFinite(sort) || sort <= 0) return { year: null, season: null };
  const d = new Date(sort);
  const year = d.getUTCFullYear();
  if (!Number.isFinite(year)) return { year: null, season: null };
  return {
    year,
    season: seasonFromMonth(d.getUTCMonth() + 1),
  };
}

function normalizeEventType(raw) {
  const type = String(raw || "").trim();
  if (type === "시작") return "시작";
  if (type === "완료") return "완료";
  if (type === "하차") return "하차";
  if (type === "재시청") return "재시청";
  return "기타";
}

export function listRecapYears(logs, limit = 8) {
  const years = new Set();
  for (const log of toArray(logs)) {
    const info = readLogYearSeason(log);
    if (Number.isFinite(info.year)) years.add(info.year);
  }
  return [...years]
    .sort((a, b) => b - a)
    .slice(0, Math.max(1, Number(limit) || 8));
}

export function buildYearRecap({ logs, year }) {
  const targetYear = Number(year);
  if (!Number.isFinite(targetYear)) return null;

  const seasonCountMap = new Map([
    ["Spring", 0],
    ["Summer", 0],
    ["Fall", 0],
    ["Winter", 0],
    ["Unknown", 0],
  ]);
  const eventCountMap = new Map([
    ["시작", 0],
    ["완료", 0],
    ["하차", 0],
    ["재시청", 0],
    ["기타", 0],
  ]);
  const animeMap = new Map();
  const characterMap = new Map();

  const selectedLogs = [];
  for (const log of toArray(logs)) {
    const info = readLogYearSeason(log);
    if (info.year !== targetYear) continue;

    selectedLogs.push(log);
    const eventType = normalizeEventType(log?.eventType);
    eventCountMap.set(eventType, (eventCountMap.get(eventType) || 0) + 1);

    const season = info.season || "Unknown";
    seasonCountMap.set(season, (seasonCountMap.get(season) || 0) + 1);

    const anilistId = Number(log?.anilistId);
    if (Number.isFinite(anilistId)) {
      const cur = animeMap.get(anilistId) || {
        anilistId,
        count: 0,
        lastSort: 0,
      };
      cur.count += 1;
      cur.lastSort = Math.max(cur.lastSort, Number(log?.watchedAtSort || log?.createdAt || 0));
      animeMap.set(anilistId, cur);
    }

    for (const ref of toArray(log?.characterRefs)) {
      const characterId = Number(ref?.characterId);
      if (!Number.isFinite(characterId)) continue;
      const cur = characterMap.get(characterId) || {
        characterId,
        name: String(ref?.nameSnapshot || `#${characterId}`),
        image: ref?.imageSnapshot || "",
        count: 0,
        primaryCount: 0,
        reasonTagMap: new Map(),
      };
      cur.count += 1;
      if (ref?.isPrimary === true) cur.primaryCount += 1;
      for (const tag of toArray(ref?.reasonTags).map((x) => String(x || "").trim()).filter(Boolean)) {
        cur.reasonTagMap.set(tag, (cur.reasonTagMap.get(tag) || 0) + 1);
      }
      characterMap.set(characterId, cur);
    }
  }

  const topAnime = [...animeMap.values()]
    .sort((a, b) => b.count - a.count || b.lastSort - a.lastSort || a.anilistId - b.anilistId)
    .slice(0, 5);

  const topCharacters = [...characterMap.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.primaryCount - a.primaryCount ||
        a.name.localeCompare(b.name, "ko")
    )
    .slice(0, 5)
    .map((row) => {
      const bestTag = [...row.reasonTagMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return {
        characterId: row.characterId,
        name: row.name,
        image: row.image,
        count: row.count,
        primaryCount: row.primaryCount,
        bestTag,
      };
    });

  const seasons = ["Spring", "Summer", "Fall", "Winter", "Unknown"].map((key) => ({
    key,
    label:
      key === "Spring"
        ? "봄"
        : key === "Summer"
          ? "여름"
          : key === "Fall"
            ? "가을"
            : key === "Winter"
              ? "겨울"
              : "미상",
    count: seasonCountMap.get(key) || 0,
  }));

  const eventCounts = {
    start: eventCountMap.get("시작") || 0,
    complete: eventCountMap.get("완료") || 0,
    drop: eventCountMap.get("하차") || 0,
    rewatch: eventCountMap.get("재시청") || 0,
    other: eventCountMap.get("기타") || 0,
  };

  return {
    year: targetYear,
    totalLogs: selectedLogs.length,
    uniqueAnimeCount: animeMap.size,
    uniqueCharacterCount: characterMap.size,
    eventCounts,
    seasons,
    topAnime,
    topCharacters,
  };
}
