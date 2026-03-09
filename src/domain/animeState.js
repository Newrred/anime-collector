export const DEFAULT_TIERS = ["S", "A", "B", "C", "D"];
export const SCORE_MAX = 5;
export const SCORE_STEP = 0.5;
export const REWATCH_COUNT_MAX = 999;

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeScoreValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  // Backward-compat: legacy 10-point scores are converted to 5-point.
  const scaled = n > SCORE_MAX ? n / 2 : n;
  const rounded = Math.round(scaled / SCORE_STEP) * SCORE_STEP;
  return clamp(rounded, 0, SCORE_MAX);
}

export function normalizeRewatchCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), 0, REWATCH_COUNT_MAX);
}

export function normalizeRewatchDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [yy, mm, dd] = s.split("-").map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;

  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return null;
  }
  return s;
}

export function sameItem(a, b) {
  return (
    a?.anilistId === b?.anilistId &&
    (a?.koTitle ?? null) === (b?.koTitle ?? null) &&
    (a?.status ?? "미분류") === (b?.status ?? "미분류") &&
    (a?.score ?? null) === (b?.score ?? null) &&
    (a?.memo ?? "") === (b?.memo ?? "") &&
    (a?.rewatchCount ?? 0) === (b?.rewatchCount ?? 0) &&
    (a?.lastRewatchAt ?? null) === (b?.lastRewatchAt ?? null) &&
    (a?.addedAt ?? 0) === (b?.addedAt ?? 0)
  );
}

export function dedupeByAnilistId(list) {
  const source = Array.isArray(list) ? list : [];
  const map = new Map();
  for (const it of source) {
    const id = Number(it?.anilistId);
    if (!Number.isFinite(id)) continue;

    if (!map.has(id)) {
      map.set(id, { ...it, anilistId: id });
      continue;
    }

    const prev = map.get(id);
    map.set(id, {
      ...prev,
      ...it,
      addedAt: Math.max(prev.addedAt ?? 0, it.addedAt ?? 0),
      koTitle: it.koTitle || prev.koTitle || null,
    });
  }
  return [...map.values()];
}

export function normalizeItem(it, fallbackAddedAt = 0) {
  const anilistId = Number(it?.anilistId);
  const addedAtNum = Number(it?.addedAt);
  return {
    anilistId,
    koTitle: it?.koTitle ?? null,
    status: it?.status ?? "미분류",
    score: normalizeScoreValue(it?.score),
    memo: it?.memo ?? "",
    rewatchCount: normalizeRewatchCount(it?.rewatchCount),
    lastRewatchAt: normalizeRewatchDate(it?.lastRewatchAt),
    addedAt: Number.isFinite(addedAtNum) ? addedAtNum : fallbackAddedAt,
  };
}

export function normalizeImportList(rawList) {
  const baseTs = Date.now();
  return dedupeByAnilistId(
    (rawList || []).map((it, idx) => normalizeItem(it, baseTs + idx))
  );
}

export function toUniqueIdArray(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function normalizeTierState(rawTier) {
  const tier = rawTier && typeof rawTier === "object" ? rawTier : {};
  const tiers = {};
  for (const [k, v] of Object.entries(tier?.tiers || {})) {
    tiers[k] = toUniqueIdArray(v);
  }
  return {
    unranked: toUniqueIdArray(tier?.unranked || []),
    tiers,
  };
}

export function mergeTierState(currentTier, incomingTier) {
  const a = normalizeTierState(currentTier);
  const b = normalizeTierState(incomingTier);
  const keys = new Set([...Object.keys(a.tiers), ...Object.keys(b.tiers)]);

  const tiers = {};
  for (const k of keys) {
    tiers[k] = toUniqueIdArray([...(a.tiers[k] || []), ...(b.tiers[k] || [])]);
  }

  const ranked = new Set();
  for (const ids of Object.values(tiers)) {
    for (const id of ids) ranked.add(id);
  }

  const unranked = toUniqueIdArray([...(a.unranked || []), ...(b.unranked || [])]).filter(
    (id) => !ranked.has(id)
  );

  return { unranked, tiers };
}

export function makeEmptyTierState(ids) {
  return {
    unranked: [...(Array.isArray(ids) ? ids : [])],
    tiers: Object.fromEntries(DEFAULT_TIERS.map((t) => [t, []])),
  };
}

