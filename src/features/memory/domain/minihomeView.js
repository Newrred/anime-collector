import { isPublicationId, publicationSnapshot } from "./publicationView.js";
const fail = () => { throw Object.assign(new Error("PUBLICATION_RESPONSE_INVALID"), { code: "PUBLICATION_RESPONSE_INVALID" }); };
export function titleShelfSnapshot(value) {
  if (value?.schemaVersion !== 1 || typeof value.title !== "string" || !value.title.trim() || value.title.length > 80 || !Array.isArray(value.titles) || value.titles.length > 300) fail();
  const seen = new Set();
  return { schemaVersion: 1, title: value.title, titles: value.titles.map(t => {
    if (!/^anime:[a-f0-9-]{36}$/i.test(t.animeId || "") || seen.has(t.animeId) || typeof t.title !== "string" || !t.title || t.title.length > 500 || t.visual?.type !== "CATALOG_COVER" || !/^asset:[a-f0-9]{40}$/i.test(t.visual.revisionId || "")) fail();
    seen.add(t.animeId);
    return { animeId: t.animeId, title: t.title, visual: { type: "CATALOG_COVER", revisionId: t.visual.revisionId } };
  }) };
}
export const homeEntryKey = entry => entry.kind === "TITLE_SHELF" ? entry.sectionId || `shelf:${entry.sourceId}` : entry.publicationId;
export function minihomeSnapshot(value) {
  if (value?.schemaVersion !== undefined && value.schemaVersion !== 2) fail();
  if (typeof value?.nickname !== "string" || !value.nickname.trim() || value.nickname.length > 60
    || typeof value.bio !== "string" || value.bio.length > 500 || !Array.isArray(value.entries) || value.entries.length > 10) fail();
  const seen = new Set();
  return { ...(value.schemaVersion === 2 ? { schemaVersion: 2 } : {}), nickname: value.nickname, bio: value.bio, entries: value.entries.map((entry) => {
    if (value.schemaVersion === 2 && entry.kind === "TITLE_SHELF") {
      if (typeof entry.sectionId !== "string" || !entry.sectionId.startsWith("shelf:") || entry.sectionId.length > 86 || seen.has(entry.sectionId)) fail();
      seen.add(entry.sectionId);
      return { kind: "TITLE_SHELF", sectionId: entry.sectionId, snapshot: titleShelfSnapshot(entry.snapshot) };
    }
    if (entry.kind !== undefined && entry.kind !== "MEMORY_BOARD") fail();
    if (!isPublicationId(entry.publicationId) || seen.has(entry.publicationId)) fail();
    seen.add(entry.publicationId);
    return { ...(value.schemaVersion === 2 ? { kind: "MEMORY_BOARD" } : {}), publicationId: entry.publicationId, snapshot: publicationSnapshot(entry.snapshot) };
  }) };
}
export function minihomeSelection(value) {
  if (value?.schemaVersion !== undefined && value.schemaVersion !== 2) fail();
  if (!value || typeof value.nickname !== "string" || value.nickname.length > 60 || typeof value.bio !== "string" || value.bio.length > 500 || !Array.isArray(value.entries) || value.entries.length > 10) fail();
  const seen = new Set();
  return { ...(value.schemaVersion === 2 ? { schemaVersion: 2 } : {}), nickname: value.nickname, bio: value.bio, entries: value.entries.map(e => {
    if (value.schemaVersion === 2 && e.kind === "TITLE_SHELF") {
      if (typeof e.sourceId !== "string" || !e.sourceId || e.sourceId.length > 80 || seen.has(`shelf:${e.sourceId}`) || !Number.isSafeInteger(e.sourceVersion) || e.sourceVersion < 1) fail();
      // Public title DTO validation also protects owner editor hydration.
      titleShelfSnapshot({ schemaVersion: 1, title: e.title, titles: e.titles?.map(t => ({ ...t, title: t.animeId, visual: { type: "CATALOG_COVER", revisionId: t.revisionId } })) });
      if (!e.titles?.length) fail();
      seen.add(`shelf:${e.sourceId}`);
      return { kind: "TITLE_SHELF", sourceId: e.sourceId, sourceVersion: e.sourceVersion, title: e.title,
        titles: e.titles.map(t => { if (typeof t.titleKey !== "string" || !t.titleKey || t.titleKey.length > 120) fail(); if (typeof t.catalogTitle !== "string" || !t.catalogTitle || t.catalogTitle.length > 500) fail(); return { titleKey: t.titleKey, animeId: t.animeId, revisionId: t.revisionId, catalogTitle: t.catalogTitle }; }) };
    }
    if (e.kind !== undefined && e.kind !== "MEMORY_BOARD") fail();
    if (!isPublicationId(e.publicationId) || seen.has(e.publicationId) || (e.cardId !== undefined && !isPublicationId(e.cardId))) fail();
    seen.add(e.publicationId);
    return { ...(value.schemaVersion === 2 ? { kind: "MEMORY_BOARD" } : {}), publicationId: e.publicationId, ...(e.cardId ? { cardId: e.cardId } : {}) };
  }) };
}
export function minihomeStatus(value) {
  if (value == null) return null;
  if (!isPublicationId(value.id) || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.published !== "boolean") fail();
  return { id: value.id, revision: value.revision, published: value.published, hidden: value.hidden === true,
    ...(value.selection ? { selection: minihomeSelection(value.selection) } : {}),
    ...(typeof value.visible === 'boolean' ? { visible: value.visible } : {}) };
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
