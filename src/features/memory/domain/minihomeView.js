import { isPublicationId, publicationSnapshot } from "./publicationView.js";
const fail = () => { throw Object.assign(new Error("PUBLICATION_RESPONSE_INVALID"), { code: "PUBLICATION_RESPONSE_INVALID" }); };
export function minihomeSnapshot(value) {
  if (typeof value?.nickname !== "string" || !value.nickname.trim() || value.nickname.length > 60
    || typeof value.bio !== "string" || value.bio.length > 500 || !Array.isArray(value.entries) || value.entries.length > 10) fail();
  const seen = new Set();
  return { nickname: value.nickname, bio: value.bio, entries: value.entries.map((entry) => {
    if (!isPublicationId(entry.publicationId) || seen.has(entry.publicationId)) fail();
    seen.add(entry.publicationId);
    return { publicationId: entry.publicationId, snapshot: publicationSnapshot(entry.snapshot) };
  }) };
}
export function minihomeStatus(value) {
  if (value == null) return null;
  if (!isPublicationId(value.id) || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.published !== "boolean") fail();
  return { id: value.id, revision: value.revision, published: value.published, hidden: value.hidden === true };
}
export function minihomeReview(value) {
  const status = minihomeStatus({ ...value, published: false });
  if (!status || status.revision < 1 || !/^[a-f0-9]{64}$/.test(value.reviewHash || "")
    || typeof value.policyRevision !== "string" || !value.policyRevision || value.policyRevision.length > 120 || value.policyRevision === "UNAPPROVED") fail();
  const snapshot = minihomeSnapshot(value.snapshot);
  if (!snapshot.entries.length) fail();
  return { ...status, snapshot, reviewHash: value.reviewHash, policyRevision: value.policyRevision };
}
export function minihomeLink(id, base = "/") {
  if (!isPublicationId(id)) fail();
  return `${base}public/home/?id=${encodeURIComponent(id)}`;
}
