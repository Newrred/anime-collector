const CANONICAL_POSITIVE_INTEGER = /^[1-9]\d*$/u;

const readAniListId = (bundle) => {
  if (!bundle || typeof bundle !== "object" || !bundle.card || typeof bundle.card !== "object") return null;
  if (!String(bundle.card.id || "").trim()) return null;
  const title = bundle.title;
  const binding = title?.sourceBinding;
  const animeRefId = String(bundle.card.animeRefId || "").trim();
  if (!animeRefId || bundle.card.privateTitleId != null || String(title?.id || "") !== animeRefId) return null;
  if (binding?.provider !== "ANILIST") return null;
  if (typeof binding.externalId !== "string" || !CANONICAL_POSITIVE_INTEGER.test(binding.externalId)) return null;
  const id = Number(binding.externalId);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== binding.externalId) return null;
  return id;
};

export function buildMemoryCardCountsByAniListId(archive) {
  const counts = new Map();
  for (const bundle of Array.isArray(archive) ? archive : []) {
    const id = readAniListId(bundle);
    if (id == null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
