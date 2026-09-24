import { publicDesignStyle } from "./publicVisual.js";

export const PUBLIC_FIELDS = Object.freeze(["note", "watchedAt", "episode", "sceneCue", "emotionTags", "rewatchIntent"]);
export const isPublicationId = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || "");
const fail = () => { throw Object.assign(new Error("PUBLICATION_RESPONSE_INVALID"), { code: "PUBLICATION_RESPONSE_INVALID" }); };
const text = (value, limit) => typeof value === "string" && value.length <= limit ? value : fail();

// Only the public DTO is admitted. Never merge private bundles into this view model.
export function publicationSnapshot(input) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.cards) || input.cards.length > 100) fail();
  const seen = new Set();
  return {
    schemaVersion: 1, title: text(input.title, 80), description: text(input.description, 500),
    cards: input.cards.map((card) => {
      if (!isPublicationId(card?.id) || seen.has(card.id)) fail();
      seen.add(card.id);
      const result = { id: card.id, title: text(card.title, 500) };
      const visual = card.visual;
      if (visual?.type === "SYSTEM_DESIGN") {
        try { publicDesignStyle(visual); } catch { fail(); }
        result.visual = { type: visual.type, rendererVersion: 1, patternToken: visual.patternToken };
      } else if (visual?.type === "CATALOG_COVER" && /^asset:[a-f0-9]{40}$/i.test(visual.revisionId || "")
        && /^anime:[a-f0-9-]{36}$/i.test(card.animeId || "")) {
        result.animeId = card.animeId;
        result.visual = { type: visual.type, revisionId: visual.revisionId };
      } else if (visual?.type === "USER_IMAGE" && isPublicationId(visual.assetId)) {
        result.visual = { type: visual.type, assetId: visual.assetId };
      } else fail();
      for (const field of PUBLIC_FIELDS) {
        if (!(field in card)) continue;
        if (field === "emotionTags") {
          if (!Array.isArray(card[field]) || card[field].length > 32) fail();
          result[field] = card[field].map((value) => text(value, 100));
        } else result[field] = card[field] == null ? null : text(card[field], 10000);
      }
      if ("watchedAt" in card) result.watchedAtPrecision = text(card.watchedAtPrecision, 16);
      return result;
    }),
  };
}

export function publicationReview(input) {
  if (!isPublicationId(input?.id) || !Number.isSafeInteger(input.revision) || input.revision < 1
    || !/^[a-f0-9]{64}$/i.test(input.reviewHash || "") || typeof input.policyRevision !== "string"
    || !input.policyRevision || input.policyRevision.length > 120 || input.policyRevision === "UNAPPROVED") fail();
  const snapshot = publicationSnapshot(input.snapshot);
  if (!snapshot.cards.length) fail();
  return { id: input.id, revision: input.revision, reviewHash: input.reviewHash, policyRevision: input.policyRevision, snapshot };
}

export function publicationLink(id, base = "/") {
  if (!isPublicationId(id)) fail();
  return `${base}public/board/?id=${encodeURIComponent(id)}`;
}
