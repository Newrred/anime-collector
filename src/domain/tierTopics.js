import { makeEmptyTierState, mergeTierState, normalizeTierState, toUniqueIdArray } from "./animeState.js";

export const DEFAULT_TIER_TOPIC_ID = "default-all";

function makeTopicId(prefix = "topic") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(value, fallback) {
  const raw = String(value || "").trim();
  return raw || fallback;
}

export function isLegacyTierState(raw) {
  return !!(
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    !Array.isArray(raw?.topics) &&
    ("unranked" in raw || "tiers" in raw)
  );
}

export function createDefaultTierTopic(tier = null) {
  return {
    id: DEFAULT_TIER_TOPIC_ID,
    kind: "all",
    name: "All anime",
    genreKey: "",
    includedIds: [],
    createdAt: Date.now(),
    tier: normalizeTierState(tier || makeEmptyTierState([])),
  };
}

export function createGenreTierTopic({ id, name, genreKey, tier, createdAt } = {}) {
  const key = String(genreKey || "").trim();
  return {
    id: String(id || makeTopicId("genre")),
    kind: "genre",
    name: normalizeName(name, key || "Genre"),
    genreKey: key,
    includedIds: [],
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
    tier: normalizeTierState(tier || makeEmptyTierState([])),
  };
}

export function createCustomTierTopic({ id, name, includedIds, tier, createdAt } = {}) {
  return {
    id: String(id || makeTopicId("custom")),
    kind: "custom",
    name: normalizeName(name, "Custom topic"),
    genreKey: "",
    includedIds: toUniqueIdArray(includedIds || []),
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
    tier: normalizeTierState(tier || makeEmptyTierState(includedIds || [])),
  };
}

export function normalizeTierTopic(raw) {
  if (!raw || typeof raw !== "object") return createDefaultTierTopic();

  const kind = raw.kind === "genre" || raw.kind === "custom" ? raw.kind : "all";
  if (kind === "genre") {
    return createGenreTierTopic(raw);
  }
  if (kind === "custom") {
    return createCustomTierTopic(raw);
  }

  return {
    ...createDefaultTierTopic(raw?.tier),
    id: String(raw?.id || DEFAULT_TIER_TOPIC_ID),
    name: normalizeName(raw?.name, "All anime"),
    createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : Date.now(),
    tier: normalizeTierState(raw?.tier || raw),
  };
}

export function normalizeTierTopicBundle(raw, fallbackTier = null) {
  if (isLegacyTierState(raw)) {
    return {
      version: 1,
      activeTopicId: DEFAULT_TIER_TOPIC_ID,
      topics: [createDefaultTierTopic(raw)],
    };
  }

  const source = raw && typeof raw === "object" ? raw : {};
  const topicsRaw = Array.isArray(source?.topics) ? source.topics : [];
  const topics = topicsRaw.map((topic) => normalizeTierTopic(topic));

  const hasDefault = topics.some((topic) => topic.id === DEFAULT_TIER_TOPIC_ID);
  if (!hasDefault) {
    topics.unshift(createDefaultTierTopic(fallbackTier));
  }

  const activeTopicId = topics.some((topic) => topic.id === source?.activeTopicId)
    ? source.activeTopicId
    : DEFAULT_TIER_TOPIC_ID;

  return {
    version: 1,
    activeTopicId,
    topics,
  };
}

export function getActiveTierTopic(bundle) {
  const normalized = normalizeTierTopicBundle(bundle);
  return (
    normalized.topics.find((topic) => topic.id === normalized.activeTopicId) ||
    normalized.topics[0] ||
    createDefaultTierTopic()
  );
}

export function replaceActiveTierState(bundle, nextTier) {
  const normalized = normalizeTierTopicBundle(bundle);
  return {
    ...normalized,
    topics: normalized.topics.map((topic) =>
      topic.id === normalized.activeTopicId
        ? { ...topic, tier: normalizeTierState(nextTier) }
        : topic
    ),
  };
}

export function upsertTierTopic(bundle, topic, makeActive = false) {
  const normalized = normalizeTierTopicBundle(bundle);
  const nextTopic = normalizeTierTopic(topic);
  const exists = normalized.topics.some((row) => row.id === nextTopic.id);
  const topics = exists
    ? normalized.topics.map((row) => (row.id === nextTopic.id ? nextTopic : row))
    : [...normalized.topics, nextTopic];

  return {
    ...normalized,
    activeTopicId: makeActive ? nextTopic.id : normalized.activeTopicId,
    topics,
  };
}

export function removeTierTopic(bundle, topicId) {
  const normalized = normalizeTierTopicBundle(bundle);
  if (!topicId || topicId === DEFAULT_TIER_TOPIC_ID) return normalized;

  const topics = normalized.topics.filter((topic) => topic.id !== topicId);
  return {
    ...normalized,
    activeTopicId:
      normalized.activeTopicId === topicId
        ? DEFAULT_TIER_TOPIC_ID
        : normalized.activeTopicId,
    topics: topics.length ? topics : [createDefaultTierTopic()],
  };
}

export function setActiveTierTopicId(bundle, topicId) {
  const normalized = normalizeTierTopicBundle(bundle);
  if (!normalized.topics.some((topic) => topic.id === topicId)) return normalized;
  return {
    ...normalized,
    activeTopicId: topicId,
  };
}

export function syncTierStateWithEligibleIds(tierState, eligibleIds) {
  const next = normalizeTierState(tierState);
  const desired = new Set(toUniqueIdArray(eligibleIds || []));
  const ranked = new Set();

  next.unranked = next.unranked.filter((id) => desired.has(id));
  for (const key of Object.keys(next.tiers || {})) {
    next.tiers[key] = (next.tiers[key] || []).filter((id) => {
      if (!desired.has(id) || ranked.has(id)) return false;
      ranked.add(id);
      return true;
    });
  }

  for (const id of next.unranked) ranked.add(id);

  const missing = [...desired].filter((id) => !ranked.has(id));
  if (missing.length) {
    next.unranked = [...missing, ...next.unranked];
  }

  return next;
}

export function mergeTierTopicBundles(currentBundle, incomingRaw) {
  const current = normalizeTierTopicBundle(currentBundle);
  const incoming = normalizeTierTopicBundle(incomingRaw);
  let next = { ...current, topics: [...current.topics] };

  const incomingDefault = incoming.topics.find((topic) => topic.id === DEFAULT_TIER_TOPIC_ID);
  if (incomingDefault) {
    next = upsertTierTopic(
      next,
      {
        ...getActiveTierTopic({ ...next, activeTopicId: DEFAULT_TIER_TOPIC_ID }),
        id: DEFAULT_TIER_TOPIC_ID,
        kind: "all",
        name: "All anime",
        tier: mergeTierState(
          getActiveTierTopic({ ...next, activeTopicId: DEFAULT_TIER_TOPIC_ID }).tier,
          incomingDefault.tier
        ),
      },
      false
    );
  }

  for (const topic of incoming.topics) {
    if (topic.id === DEFAULT_TIER_TOPIC_ID) continue;
    const duplicateId = next.topics.some((row) => row.id === topic.id);
    const nextTopic = duplicateId ? { ...topic, id: makeTopicId(topic.kind || "topic") } : topic;
    next = upsertTierTopic(next, nextTopic, false);
  }

  return next;
}
