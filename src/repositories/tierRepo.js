import { STORAGE_KEYS } from "../storage/keys";
import { readJson, writeJson } from "../storage/localJsonStore";
import { getTierStateIdb, putTierStateIdb } from "../storage/idb";
import {
  getActiveTierTopic,
  normalizeTierTopicBundle,
  removeTierTopic,
  replaceActiveTierState,
} from "../domain/tierTopics";

export function readTierState(fallback = null) {
  const raw = readJson(STORAGE_KEYS.tier, null);
  const bundle = normalizeTierTopicBundle(raw, fallback);
  return getActiveTierTopic(bundle)?.tier || fallback;
}

export function readTierBoardBundle(fallback = null) {
  return normalizeTierTopicBundle(readJson(STORAGE_KEYS.tier, null), fallback);
}

export async function readTierStatePreferred(fallback = null) {
  const raw = readJson(STORAGE_KEYS.tier, null);
  if (raw && typeof raw === "object" && Array.isArray(raw?.topics)) {
    const bundle = normalizeTierTopicBundle(raw, fallback);
    return getActiveTierTopic(bundle)?.tier || fallback;
  }

  try {
    const tier = await getTierStateIdb("default");
    if (tier && typeof tier === "object") return tier;
  } catch {}
  return readTierState(fallback);
}

export async function readTierBoardBundlePreferred(fallback = null) {
  const raw = readJson(STORAGE_KEYS.tier, null);
  if (raw && typeof raw === "object") {
    return normalizeTierTopicBundle(raw, fallback);
  }

  try {
    const tier = await getTierStateIdb("default");
    if (tier && typeof tier === "object") {
      return normalizeTierTopicBundle(tier, fallback);
    }
  } catch {}

  return normalizeTierTopicBundle(null, fallback);
}

export function writeTierState(nextTier, options = {}) {
  const raw = readJson(STORAGE_KEYS.tier, null);
  const bundle = replaceActiveTierState(normalizeTierTopicBundle(raw, nextTier), nextTier);

  if (!options?.mirrorOnly) {
    writeJson(STORAGE_KEYS.tier, bundle);
  }
  putTierStateIdb(nextTier, "default").catch(() => {});
}

export function writeTierBoardBundle(nextBundle, options = {}) {
  const bundle = normalizeTierTopicBundle(nextBundle);
  if (!options?.mirrorOnly) {
    writeJson(STORAGE_KEYS.tier, bundle);
  }
  putTierStateIdb(getActiveTierTopic(bundle)?.tier || { unranked: [], tiers: {} }, "default").catch(() => {});
}

export function pruneTierByAnimeId(removedId) {
  const bundle = readTierBoardBundle(null);
  if (!bundle || typeof bundle !== "object") return;

  const next = {
    ...bundle,
    topics: bundle.topics.map((topic) => {
      const tier = structuredClone(topic.tier || { unranked: [], tiers: {} });
      tier.unranked = (tier.unranked || []).filter((id) => Number(id) !== Number(removedId));
      for (const key of Object.keys(tier.tiers || {})) {
        tier.tiers[key] = (tier.tiers[key] || []).filter((id) => Number(id) !== Number(removedId));
      }

      return {
        ...topic,
        includedIds: Array.isArray(topic.includedIds)
          ? topic.includedIds.filter((id) => Number(id) !== Number(removedId))
          : [],
        tier,
      };
    }),
  };

  const sanitized = removeTierTopic(next, "");
  if (!sanitized || typeof sanitized !== "object") return;

  writeJson(STORAGE_KEYS.tier, sanitized);
  putTierStateIdb(getActiveTierTopic(sanitized)?.tier || { unranked: [], tiers: {} }, "default").catch(() => {});
}
