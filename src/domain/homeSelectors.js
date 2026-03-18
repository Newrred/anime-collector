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

function mmddScore(value) {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return mm * 31 + dd;
}

export function buildHomeResurfacing({ items, logs, nowMs = Date.now() }) {
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
      cue: String(log.cue || "").trim(),
    });
    if (thisTime.length >= 8) break;
  }

  return {
    recentLogs,
    missingMemory,
    thisTime: thisTime.length >= 3 ? thisTime : [],
  };
}
