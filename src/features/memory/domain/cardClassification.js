export const EMPTY_CLASSIFICATION = Object.freeze({ version: 1, tags: Object.freeze([]), characters: Object.freeze([]) });
const fail = () => { throw Object.assign(new Error("CARD_CLASSIFICATION_INVALID"), { code: "CARD_CLASSIFICATION_INVALID" }); };
const clean = (value, max) => {
  if (typeof value !== "string") fail();
  const result = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!result || result.length > max) fail();
  return result;
};

// Private, user-selected metadata. Catalog genre and WatchLog tags are separate.
export function normalizeCardClassification(input = EMPTY_CLASSIFICATION) {
  if (!input || input.version !== 1 || !Array.isArray(input.tags) || input.tags.length > 20
    || !Array.isArray(input.characters) || input.characters.length > 12) fail();
  const tags = [...new Map(input.tags.map(value => {
    const label = clean(value, 48); return [label.toLocaleLowerCase("en-US"), label];
  })).values()];
  const characters = [...new Map(input.characters.map(row => {
    if (!row || !["ANILIST", "CATALOG"].includes(row.source)) fail();
    const id = clean(row.id, 160), name = clean(row.name, 120);
    if (row.source === "ANILIST" && !/^[1-9]\d{0,11}$/u.test(id)) fail();
    return [`${row.source}:${id}`, { source: row.source, id, name }];
  })).values()];
  return { version: 1, tags, characters };
}
export const characterTagKey = row => `${row.source}:${row.id}`;
export function addCustomTag(classification, draft) {
  const label = String(draft || "").normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/^#+/u, "");
  if (!label || classification.tags.some(value => value.toLocaleLowerCase("en-US") === label.toLocaleLowerCase("en-US"))) return classification;
  return normalizeCardClassification({ ...classification, tags: [...classification.tags, label] });
}
export const classificationSyncEnabled = () => import.meta.env?.PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1 === "1";
