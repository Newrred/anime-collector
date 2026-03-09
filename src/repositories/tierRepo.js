import { STORAGE_KEYS } from "../storage/keys";
import { readJson, writeJson } from "../storage/localJsonStore";
import { getTierStateIdb, putTierStateIdb } from "../storage/idb";

export function readTierState(fallback = null) {
  return readJson(STORAGE_KEYS.tier, fallback);
}

export async function readTierStatePreferred(fallback = null) {
  try {
    const tier = await getTierStateIdb("default");
    if (tier && typeof tier === "object") return tier;
  } catch {}
  return readTierState(fallback);
}

export function writeTierState(nextTier, options = {}) {
  if (!options?.mirrorOnly) {
    writeJson(STORAGE_KEYS.tier, nextTier);
  }
  putTierStateIdb(nextTier, "default").catch(() => {});
}

export function pruneTierByAnimeId(removedId) {
  const tier = readTierState(null);
  if (!tier || typeof tier !== "object") return;

  const next = structuredClone(tier);
  next.unranked = (next.unranked || []).filter((id) => Number(id) !== Number(removedId));
  for (const k of Object.keys(next.tiers || {})) {
    next.tiers[k] = (next.tiers[k] || []).filter((id) => Number(id) !== Number(removedId));
  }

  writeTierState(next);
}
