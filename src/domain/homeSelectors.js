function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatWatchLogDate(log) {
  const value = String(log?.watchedAtValue || "").trim();
  if (value) return value;
  const createdAt = Number(log?.createdAt);
  if (!Number.isFinite(createdAt)) return "날짜 미상";
  return new Date(createdAt).toISOString().slice(0, 10);
}

function pickPrimaryCharacterRef(log) {
  const refs = toArray(log?.characterRefs);
  if (!refs.length) return null;

  const primary =
    refs.find((ref) => ref?.isPrimary === true) ||
    refs.find((ref) => Number.isFinite(Number(ref?.characterId))) ||
    null;
  if (!primary) return null;

  const characterId = Number(primary.characterId);
  if (!Number.isFinite(characterId)) return null;

  const reasonTags = toArray(primary.reasonTags)
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return {
    characterId,
    name: String(primary.nameSnapshot || `#${characterId}`),
    image: primary.imageSnapshot || "",
    reasonTag: reasonTags[0] || "",
    affinity: String(primary.affinity || ""),
    note: String(primary.note || ""),
  };
}

function mmddScore(value) {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return mm * 31 + dd;
}

export function buildHomeResurfacing({ items, logs, pins, nowMs = Date.now() }) {
  const safeItems = toArray(items);
  const sortedLogs = toArray(logs).sort(
    (a, b) =>
      Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) ||
      Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
  );

  const recentLogs = sortedLogs.slice(0, 8).map((log) => ({
    id: String(log.id || ""),
    anilistId: Number(log.anilistId),
    label: formatWatchLogDate(log),
    eventType: log.eventType || "기록",
    cue: String(log.cue || "").trim(),
  }));

  const seenLogAnime = new Set(
    sortedLogs.map((x) => Number(x?.anilistId)).filter(Number.isFinite)
  );
  const missingMemory = safeItems
    .filter((it) => !seenLogAnime.has(Number(it?.anilistId)))
    .sort((a, b) => Number(b?.addedAt || 0) - Number(a?.addedAt || 0))
    .slice(0, 8)
    .map((it) => ({
      anilistId: Number(it.anilistId),
    }));

  const currentYear = new Date(nowMs).getUTCFullYear();
  const todayMmDd = new Date(nowMs).toISOString().slice(5, 10);
  const todayScore = mmddScore(`2000-${todayMmDd}`) || 0;
  const thisTime = [];
  const seenThisTime = new Set();

  for (const log of sortedLogs) {
    const value = String(log?.watchedAtValue || "");
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) continue;
    const year = Number(m[1]);
    if (!Number.isFinite(year) || year === currentYear) continue;

    const score = mmddScore(value);
    if (!Number.isFinite(score)) continue;
    if (Math.abs(score - todayScore) > 20) continue;

    const anilistId = Number(log?.anilistId);
    if (!Number.isFinite(anilistId) || seenThisTime.has(anilistId)) continue;
    seenThisTime.add(anilistId);

    thisTime.push({
      id: String(log.id || ""),
      anilistId,
      label: formatWatchLogDate(log),
      eventType: log.eventType || "기록",
    });
    if (thisTime.length >= 8) break;
  }

  const recentPrimaryCharacters = [];
  for (const log of sortedLogs.slice(0, 80)) {
    const anilistId = Number(log?.anilistId);
    if (!Number.isFinite(anilistId)) continue;
    const primary = pickPrimaryCharacterRef(log);
    if (!primary) continue;
    recentPrimaryCharacters.push({
      id: String(log.id || ""),
      logId: String(log.id || ""),
      anilistId,
      label: formatWatchLogDate(log),
      eventType: String(log?.eventType || "기록"),
      characterId: primary.characterId,
      name: primary.name,
      image: primary.image,
      reasonTag: primary.reasonTag,
      cue: String(log?.cue || "").trim(),
      note: String(log?.note || "").trim(),
    });
    if (recentPrimaryCharacters.length >= 8) break;
  }

  const cutoff60 = nowMs - 60 * 24 * 60 * 60 * 1000;
  const repeatMap = new Map();
  for (const log of sortedLogs) {
    const anilistId = Number(log?.anilistId);
    if (!Number.isFinite(anilistId)) continue;
    const primary = pickPrimaryCharacterRef(log);
    if (!primary) continue;
    const key = String(primary.characterId);
    const cur = repeatMap.get(key) || {
      characterId: primary.characterId,
      name: primary.name,
      image: primary.image,
      countTotal: 0,
      countRecent60: 0,
      lastSort: 0,
      animeCountMap: new Map(),
    };
    cur.countTotal += 1;
    const sort = toNumber(log?.watchedAtSort) || 0;
    if (sort >= cutoff60) cur.countRecent60 += 1;
    cur.lastSort = Math.max(cur.lastSort, sort);
    cur.animeCountMap.set(anilistId, (cur.animeCountMap.get(anilistId) || 0) + 1);
    repeatMap.set(key, cur);
  }

  const repeatedCharacters = [...repeatMap.values()]
    .filter((row) => row.countRecent60 >= 2 || row.countTotal >= 3)
    .sort(
      (a, b) =>
        b.countRecent60 - a.countRecent60 ||
        b.countTotal - a.countTotal ||
        b.lastSort - a.lastSort
    )
    .slice(0, 8)
    .map((row) => ({
      ...(() => {
        const topAnime = [...row.animeCountMap.entries()].sort((a, b) => b[1] - a[1])[0];
        return {
          topAnimeId: topAnime ? Number(topAnime[0]) : null,
        };
      })(),
      characterId: row.characterId,
      name: row.name,
      image: row.image,
      countTotal: row.countTotal,
      countRecent60: row.countRecent60,
      relatedAnimeCount: row.animeCountMap.size,
    }));

  const pinnedHighlights = toArray(pins)
    .filter((p) => {
      const reason = String(p?.pinReason || "").trim();
      return (
        reason.length > 0 ||
        String(p?.pinnedFromLogId || "").trim().length > 0 ||
        String(p?.sourceLogId || "").trim().length > 0
      );
    })
    .slice(0, 4)
    .map((p) => ({
      id: String(p?.id || ""),
      characterId: Number(p?.characterId),
      mediaId: Number(p?.mediaId),
      nameSnapshot: String(p?.nameSnapshot || ""),
      imageSnapshot: p?.imageSnapshot || "",
      pinReason: String(p?.pinReason || "").trim(),
      pinnedFromLogId: String(p?.pinnedFromLogId || p?.sourceLogId || "").trim(),
    }));

  return {
    recentLogs,
    missingMemory,
    thisTime: thisTime.length >= 3 ? thisTime : [],
    recentPrimaryCharacters,
    repeatedCharacters,
    pinnedHighlights,
  };
}
