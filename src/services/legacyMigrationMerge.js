import { normalizeTierState } from "../domain/animeState.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function mergeLegacyLibraryRows(existingRows, legacyRows) {
  const rowsById = new Map();
  for (const row of [...toArray(legacyRows), ...toArray(existingRows)]) {
    const anilistId = Number(row?.anilistId);
    if (!Number.isFinite(anilistId)) continue;
    rowsById.set(anilistId, {
      ...(rowsById.get(anilistId) || {}),
      ...row,
      anilistId,
    });
  }
  return [...rowsById.values()];
}

export function mergeTierStatePreferExisting(existingTier, legacyTier) {
  const existing = normalizeTierState(existingTier);
  const legacy = normalizeTierState(legacyTier);
  const keys = [...new Set([
    ...Object.keys(existing.tiers),
    ...Object.keys(legacy.tiers),
  ])];
  const tiers = Object.fromEntries(keys.map((key) => [key, []]));
  const unranked = [];
  const placed = new Set();

  const append = (target, values) => {
    for (const raw of values || []) {
      const id = Number(raw);
      if (!Number.isFinite(id) || placed.has(id)) continue;
      placed.add(id);
      target.push(id);
    }
  };

  for (const key of keys) append(tiers[key], existing.tiers[key]);
  append(unranked, existing.unranked);
  for (const key of keys) append(tiers[key], legacy.tiers[key]);
  append(unranked, legacy.unranked);

  return { unranked, tiers };
}

export function mergeLegacyWatchLogs(existingRows, legacyRows) {
  const rowsById = new Map();
  for (const row of [...toArray(legacyRows), ...toArray(existingRows)]) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    rowsById.set(id, { ...row, id });
  }
  return [...rowsById.values()];
}
