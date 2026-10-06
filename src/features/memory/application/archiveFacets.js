const externalId = bundle => bundle?.title?.sourceBinding?.provider === "ANILIST" ? Number(bundle.title.sourceBinding.externalId) : null;
import { characterTagKey } from "../domain/cardClassification.js";
export function matchesArchiveFacets(bundle, logs, { tag = "", character = "", affinity = "", memoryTag = "", memoryCharacter = "" } = {}) {
  if (memoryTag && !(bundle.card?.classification?.tags || []).includes(memoryTag)) return false;
  if (memoryCharacter && !(bundle.card?.classification?.characters || []).some(row => characterTagKey(row) === memoryCharacter)) return false;
  if (!tag && !character && !affinity) return true;
  const id = externalId(bundle);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  return logs.some(log => Number(log.anilistId) === id && (log.characterRefs || []).some(ref =>
    (!tag || (ref.reasonTags || []).includes(tag)) && (!character || String(ref.characterId) === character) && (!affinity || ref.affinity === affinity)));
}
export function archiveFacetOptions(items, logs) {
  const ids = new Set(items.map(externalId).filter(id => Number.isSafeInteger(id) && id > 0));
  const tags = new Set(), affinities = new Set(), characters = new Map();
  const memoryTags = new Set(), memoryCharacters = new Map();
  for (const item of items) {
    for (const tag of item.card?.classification?.tags || []) memoryTags.add(tag);
    for (const row of item.card?.classification?.characters || []) memoryCharacters.set(characterTagKey(row), row.name);
  }
  for (const log of logs) if (ids.has(Number(log.anilistId))) for (const ref of log.characterRefs || []) {
    for (const tag of ref.reasonTags || []) tags.add(tag);
    if (ref.affinity) affinities.add(ref.affinity);
    if (Number.isSafeInteger(Number(ref.characterId)) && Number(ref.characterId) > 0) characters.set(String(ref.characterId), ref.nameSnapshot || `#${ref.characterId}`);
  }
  return { memoryTags: [...memoryTags], memoryCharacters: [...memoryCharacters].map(([value, label]) => ({ value, label })), tags: [...tags], affinities: [...affinities], characters: [...characters].map(([value, label]) => ({ value, label })) };
}
