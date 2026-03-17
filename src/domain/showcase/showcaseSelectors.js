const STOPWORDS = new Set([
  "그리고", "근데", "그냥", "정말", "진짜", "너무", "조금", "약간", "뭔가", "같다",
  "같음", "했다", "해서", "하는", "있는", "없는", "이었다", "였다", "입니다", "the",
  "and", "for", "with", "this", "that", "from", "have", "has", "just", "very",
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function topEntries(map, limit = 5, locale = "ko") {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), locale))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function parseLogDate(log) {
  const raw = String(log?.watchedAtStart || log?.watchedAtValue || "").trim();
  const day = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) {
    return {
      year: Number(day[1]),
      month: Number(day[2]),
      day: Number(day[3]),
      monthKey: `${day[1]}-${day[2]}`,
    };
  }
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    return {
      year: Number(month[1]),
      month: Number(month[2]),
      day: 1,
      monthKey: `${month[1]}-${month[2]}`,
    };
  }
  const season = raw.match(/^(\d{4})-(spring|summer|fall|winter)$/i);
  if (season) {
    const seasonMonth =
      season[2].toLowerCase() === "spring"
        ? 3
        : season[2].toLowerCase() === "summer"
          ? 6
          : season[2].toLowerCase() === "fall"
            ? 9
            : 12;
    return {
      year: Number(season[1]),
      month: seasonMonth,
      day: 1,
      monthKey: `${season[1]}-${String(seasonMonth).padStart(2, "0")}`,
    };
  }
  const year = raw.match(/^(\d{4})$/);
  if (year) {
    return {
      year: Number(year[1]),
      month: 1,
      day: 1,
      monthKey: `${year[1]}-01`,
    };
  }
  return null;
}

function seasonKeyFromMonth(month) {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function getMedia(anilistId, mediaMap) {
  return mediaMap?.get(Number(anilistId)) || null;
}

function getPoster(anilistId, mediaMap) {
  const media = getMedia(anilistId, mediaMap);
  return media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || "";
}

function getTitle(anilistId, titleById) {
  return titleById?.get(Number(anilistId)) || `#${anilistId}`;
}

function getGenres(anilistId, mediaMap) {
  const media = getMedia(anilistId, mediaMap);
  return safeArray(media?.genres).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4);
}

function getReasonTags(log) {
  return safeArray(log?.characterRefs)
    .flatMap((ref) => safeArray(ref?.reasonTags))
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function segmentWords(text, locale = "ko") {
  const raw = String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ");
  if (!raw.trim()) return [];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return [...segmenter.segment(raw)]
      .map((part) => String(part.segment || "").trim())
      .filter(Boolean);
  }
  return raw.split(/\s+/).filter(Boolean);
}

function tokenizeLog(log, locale = "ko") {
  const joined = [log?.cue, log?.note, ...safeArray(log?.contextTags), ...getReasonTags(log)]
    .filter(Boolean)
    .join(" ");
  return [
    ...new Set(
      segmentWords(joined, locale)
        .map((token) => token.replace(/^-+|-+$/g, ""))
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .filter((token) => !STOPWORDS.has(token))
    ),
  ];
}

function hexToRgb(hex) {
  const clean = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHue({ r, g, b }) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const diff = max - min;
  if (diff === 0) return 0;
  if (max === nr) return ((ng - nb) / diff) * 60 + (ng < nb ? 360 : 0);
  if (max === ng) return ((nb - nr) / diff) * 60 + 120;
  return ((nr - ng) / diff) * 60 + 240;
}

function hueFamily(hue, locale = "ko") {
  const ko = locale !== "en";
  if (hue < 18 || hue >= 342) return ko ? "붉은색" : "Red";
  if (hue < 42) return ko ? "주황색" : "Orange";
  if (hue < 68) return ko ? "노란색" : "Yellow";
  if (hue < 155) return ko ? "초록색" : "Green";
  if (hue < 200) return ko ? "청록색" : "Cyan";
  if (hue < 255) return ko ? "파란색" : "Blue";
  if (hue < 300) return ko ? "보라색" : "Purple";
  return ko ? "분홍색" : "Pink";
}

function getLogSort(log) {
  return Number(log?.watchedAtSort || log?.createdAt || 0);
}

function topEntryLabel(map, locale = "ko") {
  return topEntries(map, 1, locale)[0]?.label || "";
}

export function buildThisTimeCapsule({ logs, mediaMap, titleById, limit = 4 }) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const rows = [];
  const seenAnime = new Set();

  for (const log of logs) {
    const date = parseLogDate(log);
    if (!date) continue;
    if (date.year >= currentYear) continue;
    if (date.month !== currentMonth) continue;
    if (seenAnime.has(Number(log.anilistId))) continue;
    seenAnime.add(Number(log.anilistId));

    rows.push({
      id: log.id,
      anilistId: Number(log.anilistId),
      title: getTitle(log.anilistId, titleById),
      poster: getPoster(log.anilistId, mediaMap),
      cue: String(log.cue || "").trim(),
      year: date.year,
      month: date.month,
      eventType: String(log.eventType || ""),
      watchedAtSort: Number(log.watchedAtSort || 0),
    });
  }

  return rows
    .sort((a, b) => b.year - a.year || b.watchedAtSort - a.watchedAtSort)
    .slice(0, limit);
}

export function buildGenreWordHeatmap({ logs, mediaMap, locale = "ko", maxGenres = 6, maxTerms = 8 }) {
  const genreCounts = new Map();
  const termCounts = new Map();
  const pairCounts = new Map();
  let totalGenreAssignments = 0;

  for (const log of logs) {
    const genres = getGenres(log.anilistId, mediaMap);
    if (!genres.length) continue;
    const tokens = tokenizeLog(log, locale);
    if (!tokens.length) continue;

    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      totalGenreAssignments += 1;

      for (const token of tokens) {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
        const key = `${genre}::${token}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  const genres = topEntries(genreCounts, maxGenres, locale).map((row) => row.label);
  if (!genres.length) return { genres: [], terms: [], cells: [], maxLift: 0 };

  const candidateTerms = [...termCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([term, total]) => {
      let bestLift = 0;
      let support = 0;
      for (const genre of genres) {
        const pair = pairCounts.get(`${genre}::${term}`) || 0;
        if (!pair) continue;
        support += pair;
        const lift = (pair / (genreCounts.get(genre) || 1)) / (total / Math.max(1, totalGenreAssignments));
        bestLift = Math.max(bestLift, lift);
      }
      return { term, total, bestLift, support };
    })
    .filter((row) => row.support >= 2)
    .sort((a, b) => b.bestLift - a.bestLift || b.support - a.support || a.term.localeCompare(b.term, locale))
    .slice(0, maxTerms);

  const terms = candidateTerms.map((row) => row.term);
  const maxLift = candidateTerms.reduce((acc, row) => Math.max(acc, row.bestLift), 0);

  const cells = genres.map((genre) => {
    const genreTotal = genreCounts.get(genre) || 1;
    return {
      genre,
      values: terms.map((term) => {
        const pair = pairCounts.get(`${genre}::${term}`) || 0;
        const global = termCounts.get(term) || 1;
        const lift =
          pair > 0 ? (pair / genreTotal) / (global / Math.max(1, totalGenreAssignments)) : 0;
        return {
          term,
          count: pair,
          lift,
          intensity: maxLift > 0 ? lift / maxLift : 0,
        };
      }),
    };
  });

  return { genres, terms, cells, maxLift };
}

export function buildTasteFingerprint({ logs, mediaMap, locale = "ko" }) {
  const genreMap = new Map();
  const reasonMap = new Map();
  const wordMap = new Map();
  const seasonMap = new Map();

  for (const log of logs) {
    for (const genre of getGenres(log.anilistId, mediaMap)) {
      genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    }
    for (const reason of getReasonTags(log)) {
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }
    for (const token of tokenizeLog(log, locale)) {
      wordMap.set(token, (wordMap.get(token) || 0) + 1);
    }
    const date = parseLogDate(log);
    const season = date ? seasonKeyFromMonth(date.month) : "unknown";
    seasonMap.set(season, (seasonMap.get(season) || 0) + 1);
  }

  const topGenres = topEntries(genreMap, 3, locale);
  const topReasons = topEntries(reasonMap, 3, locale);
  const signatureWords = topEntries(wordMap, 5, locale);
  const seasons = topEntries(seasonMap, 4, locale);

  return {
    topGenres,
    topReasons,
    signatureWords,
    seasons,
    dominantSeasonKey: seasons[0]?.label || "unknown",
  };
}

export function buildResonanceShelf({ logs, mediaMap, titleById, limit = 6 }) {
  const byAnime = new Map();

  for (const log of logs) {
    const id = Number(log?.anilistId);
    if (!Number.isFinite(id)) continue;
    if (!byAnime.has(id)) {
      byAnime.set(id, {
        anilistId: id,
        title: getTitle(id, titleById),
        poster: getPoster(id, mediaMap),
        count: 0,
        totalText: 0,
        monthKeys: new Set(),
        rewatchCount: 0,
        primaryCount: 0,
        latestSort: 0,
        lastCue: "",
      });
    }
    const row = byAnime.get(id);
    row.count += 1;
    row.totalText +=
      String(log?.cue || "").trim().length + String(log?.note || "").trim().length;
    const date = parseLogDate(log);
    if (date?.monthKey) row.monthKeys.add(date.monthKey);
    if (String(log?.eventType || "") === "재시청") row.rewatchCount += 1;
    if (safeArray(log?.characterRefs).some((ref) => ref?.isPrimary === true)) row.primaryCount += 1;
    row.latestSort = Math.max(row.latestSort, Number(log?.watchedAtSort || 0));
    if (String(log?.cue || "").trim()) row.lastCue = String(log.cue).trim();
  }

  return [...byAnime.values()]
    .map((row) => ({
      ...row,
      resonanceScore:
        row.count * 4 +
        row.monthKeys.size * 3 +
        row.rewatchCount * 2 +
        row.primaryCount * 2 +
        Math.min(12, row.totalText / 80),
    }))
    .sort((a, b) => b.resonanceScore - a.resonanceScore || b.latestSort - a.latestSort)
    .slice(0, limit);
}

export function buildMemoryLineShelf({ logs, mediaMap, titleById, locale = "ko", limit = 6 }) {
  const seenCue = new Set();

  return safeArray(logs)
    .map((log) => {
      const cue = String(log?.cue || "").trim();
      if (cue.length < 8) return null;
      if (cue.length > 68) return null;
      const key = cue.toLowerCase();
      if (seenCue.has(key)) return null;
      seenCue.add(key);

      const tokenCount = tokenizeLog(log, locale).length;
      const date = parseLogDate(log);
      const primary = safeArray(log?.characterRefs).some((ref) => ref?.isPrimary === true);
      const score =
        (cue.length >= 12 && cue.length <= 36 ? 2.2 : 1.1) +
        Math.min(2, tokenCount / 3) +
        (primary ? 1.2 : 0) +
        (String(log?.note || "").trim() ? 0.4 : 0) +
        Math.min(1.2, getLogSort(log) / 10 ** 13);

      return {
        id: String(log?.id || ""),
        anilistId: Number(log?.anilistId),
        title: getTitle(log?.anilistId, titleById),
        poster: getPoster(log?.anilistId, mediaMap),
        cue,
        eventType: String(log?.eventType || "기록"),
        monthKey: date?.monthKey || "",
        score,
        watchedAtSort: getLogSort(log),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.watchedAtSort - a.watchedAtSort)
    .slice(0, limit);
}

export function buildLogDensityCalendar({ logs, months = 12, now = new Date() }) {
  const slots = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    slots.push({
      key: `${year}-${month}`,
      label: String(d.getUTCMonth() + 1),
      count: 0,
      preciseCount: 0,
      fuzzyCount: 0,
    });
  }

  const byKey = new Map(slots.map((row) => [row.key, row]));

  for (const log of safeArray(logs)) {
    const date = parseLogDate(log);
    if (!date?.monthKey || !byKey.has(date.monthKey)) continue;
    const row = byKey.get(date.monthKey);
    row.count += 1;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(log?.watchedAtStart || "").trim())) row.preciseCount += 1;
    else row.fuzzyCount += 1;
  }

  const maxCount = Math.max(0, ...slots.map((row) => row.count));
  const peak = [...slots].sort((a, b) => b.count - a.count)[0] || null;

  return {
    months: slots.map((row) => ({
      ...row,
      intensity: maxCount > 0 ? row.count / maxCount : 0,
    })),
    peakLabel: peak?.label || "-",
    peakCount: peak?.count || 0,
  };
}

export function buildCharacterGravity({ logs, titleById, locale = "ko", limit = 8 }) {
  const nowMs = Date.now();
  const cutoff60 = nowMs - 60 * 24 * 60 * 60 * 1000;
  const nodeMap = new Map();
  const linkMap = new Map();

  for (const log of safeArray(logs)) {
    const sort = getLogSort(log);
    const refs = safeArray(log?.characterRefs)
      .map((ref) => ({
        characterId: Number(ref?.characterId),
        name: String(ref?.nameSnapshot || "").trim(),
        image: String(ref?.imageSnapshot || "").trim(),
        isPrimary: ref?.isPrimary === true,
        reasonTags: safeArray(ref?.reasonTags).map((tag) => String(tag || "").trim()).filter(Boolean),
      }))
      .filter((ref) => Number.isFinite(ref.characterId));

    const uniq = [];
    const seen = new Set();
    for (const ref of refs) {
      if (seen.has(ref.characterId)) continue;
      seen.add(ref.characterId);
      uniq.push(ref);
    }
    if (!uniq.length) continue;

    for (const ref of uniq) {
      if (!nodeMap.has(ref.characterId)) {
        nodeMap.set(ref.characterId, {
          characterId: ref.characterId,
          name: ref.name || `#${ref.characterId}`,
          image: ref.image || "",
          total: 0,
          recent60: 0,
          primaryCount: 0,
          animeIds: new Set(),
          tagMap: new Map(),
          featuredAnimeId: Number(log?.anilistId),
        });
      }

      const row = nodeMap.get(ref.characterId);
      row.total += 1;
      if (sort >= cutoff60) row.recent60 += 1;
      if (ref.isPrimary) row.primaryCount += 1;
      if (Number.isFinite(Number(log?.anilistId))) row.animeIds.add(Number(log.anilistId));
      if (Number.isFinite(Number(log?.anilistId))) row.featuredAnimeId = Number(log.anilistId);
      for (const tag of ref.reasonTags) {
        row.tagMap.set(tag, (row.tagMap.get(tag) || 0) + 1);
      }
    }

    for (let i = 0; i < uniq.length; i += 1) {
      for (let j = i + 1; j < uniq.length; j += 1) {
        const a = uniq[i].characterId;
        const b = uniq[j].characterId;
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        linkMap.set(key, (linkMap.get(key) || 0) + 1);
      }
    }
  }

  const ranked = [...nodeMap.values()]
    .map((row) => ({
      ...row,
      topTag: topEntryLabel(row.tagMap, locale),
      animeCount: row.animeIds.size,
      featuredAnimeTitle: Number.isFinite(row.featuredAnimeId) ? getTitle(row.featuredAnimeId, titleById) : "",
      weight: row.total * 3 + row.recent60 * 2 + row.primaryCount * 1.5 + row.animeIds.size,
    }))
    .filter((row) => row.total >= 2)
    .sort((a, b) => b.weight - a.weight || b.total - a.total)
    .slice(0, limit);

  if (!ranked.length) return { nodes: [], links: [] };

  const allowed = new Set(ranked.map((row) => row.characterId));
  const maxWeight = Math.max(...ranked.map((row) => row.weight));

  const positioned = ranked.map((row, index) => {
    if (index === 0) {
      return { ...row, x: 320, y: 180, r: 52 };
    }
    const ring = Math.floor((index - 1) / 4) + 1;
    const posInRing = (index - 1) % 4;
    const angle = -Math.PI / 2 + (Math.PI * 2 * posInRing) / 4;
    const radius = ring === 1 ? 116 : 190;
    return {
      ...row,
      x: 320 + Math.cos(angle) * radius,
      y: 180 + Math.sin(angle) * radius,
      r: 26 + Math.round((row.weight / Math.max(1, maxWeight)) * 18),
    };
  });

  const links = [...linkMap.entries()]
    .map(([key, weight]) => {
      const [sourceId, targetId] = key.split("::").map(Number);
      if (!allowed.has(sourceId) || !allowed.has(targetId)) return null;
      if (weight < 2) return null;
      const source = positioned.find((row) => row.characterId === sourceId);
      const target = positioned.find((row) => row.characterId === targetId);
      if (!source || !target) return null;
      return { sourceId, targetId, weight, source, target };
    })
    .filter(Boolean);

  return { nodes: positioned, links };
}

export function buildPosterPalette({ items, mediaMap, titleById, locale = "ko" }) {
  const buckets = new Map();

  for (const item of items) {
    const id = Number(item?.anilistId);
    if (!Number.isFinite(id)) continue;
    const media = getMedia(id, mediaMap);
    const hex = String(media?.coverImage?.color || "").trim();
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const family = hueFamily(rgbToHue(rgb), locale);
    if (!buckets.has(family)) {
      buckets.set(family, {
        label: family,
        count: 0,
        hex,
        examples: [],
      });
    }
    const bucket = buckets.get(family);
    bucket.count += 1;
    if (bucket.examples.length < 3) bucket.examples.push(getTitle(id, titleById));
  }

  const total = [...buckets.values()].reduce((acc, row) => acc + row.count, 0);
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale))
    .slice(0, 6)
    .map((row) => ({
      ...row,
      ratio: total > 0 ? row.count / total : 0,
    }));
}

export function buildShowcaseModel({ items, logs, mediaMap, titleById, locale = "ko" }) {
  return {
    tasteFingerprint: buildTasteFingerprint({ logs, mediaMap, locale }),
    thisTimeCapsule: buildThisTimeCapsule({ logs, mediaMap, titleById }),
    genreWordHeatmap: buildGenreWordHeatmap({ logs, mediaMap, locale }),
    resonanceShelf: buildResonanceShelf({ logs, mediaMap, titleById }),
    memoryLineShelf: buildMemoryLineShelf({ logs, mediaMap, titleById, locale }),
    logDensityCalendar: buildLogDensityCalendar({ logs }),
    characterGravity: buildCharacterGravity({ logs, titleById, locale }),
    posterPalette: buildPosterPalette({ items, mediaMap, titleById, locale }),
  };
}

export function buildPublicShowcaseSnapshot({ profile, layout, model }) {
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    profile: {
      displayName: String(profile?.displayName || "").trim(),
      handle: String(profile?.handle || "").trim(),
      bio: String(profile?.bio || "").trim(),
    },
    layout,
    widgets: {
      tasteFingerprint: model?.tasteFingerprint || null,
      thisTimeCapsule: model?.thisTimeCapsule || [],
      genreWordHeatmap: model?.genreWordHeatmap || { genres: [], terms: [], cells: [] },
      resonanceShelf: model?.resonanceShelf || [],
      memoryLineShelf: model?.memoryLineShelf || [],
      logDensityCalendar: model?.logDensityCalendar || { months: [], peakLabel: "-", peakCount: 0 },
      characterGravity: model?.characterGravity || { nodes: [], links: [] },
      posterPalette: model?.posterPalette || [],
    },
  };
}
