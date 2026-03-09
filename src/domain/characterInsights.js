function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatWatchLogDate(log) {
  const value = String(log?.watchedAtValue || "").trim();
  if (value) return value;
  const createdAt = Number(log?.createdAt);
  if (!Number.isFinite(createdAt)) return "날짜 미상";
  return new Date(createdAt).toISOString().slice(0, 10);
}

export function buildCharacterInsight({ characterId, logs, titleById }) {
  const id = Number(characterId);
  if (!Number.isFinite(id)) return null;

  const sortedLogs = toArray(logs).sort(
    (a, b) =>
      Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) ||
      Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
  );

  const cutoff60 = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const relatedAnimeMap = new Map();
  const reasonTagMap = new Map();
  const recentLogs = [];
  let name = "";
  let image = "";
  let total = 0;
  let recent60 = 0;

  for (const log of sortedLogs) {
    const refs = toArray(log?.characterRefs);
    const match = refs.find((ref) => Number(ref?.characterId) === id);
    if (!match) continue;

    total += 1;
    const sort = Number(log?.watchedAtSort || 0);
    if (sort >= cutoff60) recent60 += 1;

    if (!name) name = String(match?.nameSnapshot || "").trim();
    if (!image) image = match?.imageSnapshot || "";

    const anilistId = Number(log?.anilistId);
    if (Number.isFinite(anilistId)) {
      const cur = relatedAnimeMap.get(anilistId) || 0;
      relatedAnimeMap.set(anilistId, cur + 1);
    }

    const tags = toArray(match?.reasonTags)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    for (const tag of tags) {
      reasonTagMap.set(tag, (reasonTagMap.get(tag) || 0) + 1);
    }

    recentLogs.push({
      id: String(log?.id || ""),
      anilistId,
      label: formatWatchLogDate(log),
      eventType: String(log?.eventType || "기록"),
      cue: String(log?.cue || "").trim(),
      reasonTag: tags[0] || "",
    });
    if (recentLogs.length >= 12) break;
  }

  if (!total) return null;

  const relatedAnime = [...relatedAnimeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([anilistId, count]) => ({
      anilistId,
      title:
        typeof titleById?.get === "function"
          ? titleById.get(Number(anilistId)) || `#${anilistId}`
          : `#${anilistId}`,
      count,
    }));

  const reasonTags = [...reasonTagMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    characterId: id,
    name: name || `#${id}`,
    image,
    total,
    recent60,
    relatedAnime,
    reasonTags,
    recentLogs,
  };
}
