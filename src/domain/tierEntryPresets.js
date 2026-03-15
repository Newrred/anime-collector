function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getLogYear(log) {
  const start = String(log?.watchedAtStart || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return Number(start.slice(0, 4));
  const value = String(log?.watchedAtValue || "").trim();
  if (/^\d{4}/.test(value)) return Number(value.slice(0, 4));
  const sort = Number(log?.watchedAtSort ?? log?.createdAt);
  if (!Number.isFinite(sort)) return null;
  return new Date(sort).getUTCFullYear();
}

function collectAnimeIds(logs, predicate) {
  const ids = new Set();
  for (const log of toArray(logs)) {
    const id = Number(log?.anilistId);
    if (!Number.isFinite(id)) continue;
    if (predicate(log)) ids.add(id);
  }
  return ids;
}

export function buildTierPresetEligibleMap({
  itemIds = [],
  items = [],
  logs = [],
  currentYear = new Date().getUTCFullYear(),
}) {
  const sourceIds = Array.isArray(itemIds) && itemIds.length
    ? itemIds.map((id) => Number(id)).filter(Number.isFinite)
    : toArray(items).map((item) => Number(item?.anilistId)).filter(Number.isFinite);

  const all = new Set(sourceIds);
  const yearCurrent = collectAnimeIds(logs, (log) => getLogYear(log) === Number(currentYear));
  const rewatch = new Set([
    ...collectAnimeIds(logs, (log) => String(log?.eventType || "").trim() === "재시청"),
    ...toArray(items)
      .filter((item) => Number(item?.rewatchCount) > 0)
      .map((item) => Number(item?.anilistId))
      .filter(Number.isFinite),
  ]);
  const characterLogged = collectAnimeIds(
    logs,
    (log) => toArray(log?.characterRefs).length > 0 || toArray(log?.characterIds).length > 0
  );

  return {
    all,
    "year-current": new Set([...yearCurrent].filter((id) => all.has(id))),
    rewatch: new Set([...rewatch].filter((id) => all.has(id))),
    "character-logged": new Set([...characterLogged].filter((id) => all.has(id))),
  };
}

export function getTierPresetEligibleIds({
  presetId = "all",
  eligibleIds = [],
  presetMap = {},
}) {
  const base = Array.isArray(eligibleIds) ? eligibleIds.filter(Number.isFinite) : [];
  if (!presetId || presetId === "all") return base;
  const presetSet = presetMap?.[presetId];
  if (!(presetSet instanceof Set)) return base;
  return base.filter((id) => presetSet.has(id));
}
