const normalizeTextList = (values, excludedTitle) => {
  const excluded = String(excludedTitle || "").toLocaleLowerCase("en-US");
  const seen = new Set([excluded]);
  return (Array.isArray(values) ? values : []).flatMap((value) => {
    const text = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    const key = text.toLocaleLowerCase("en-US");
    if (!text || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
};

const projectMedia = (media) => {
  const externalId = String(media?.id ?? "").trim();
  const titleCandidates = [media?.title?.english, media?.title?.romaji, media?.title?.native];
  const displayTitle = titleCandidates
    .map((value) => String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " "))
    .find(Boolean);
  if (!displayTitle || !/^[1-9]\d{0,11}$/.test(externalId)) return null;

  return {
    kind: "ANIME_REF",
    displayTitle,
    aliases: normalizeTextList([...titleCandidates, ...(media?.synonyms || [])], displayTitle),
    genres: normalizeTextList(media?.genres || [], ""),
    sourceBinding: { provider: "ANILIST", externalId },
    verificationState: "PROVIDER_CANDIDATE",
  };
};

export function createAniListTitleResolver({ searchAnime, limit = 8 }) {
  if (typeof searchAnime !== "function") throw new TypeError("AniList search function is required");
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));

  return Object.freeze({
    async search(query) {
      const normalizedQuery = String(query || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
      if (normalizedQuery.length < 2) return [];
      const mediaRows = await searchAnime(normalizedQuery, safeLimit);
      return (Array.isArray(mediaRows) ? mediaRows : [])
        .flatMap((media) => {
          const candidate = projectMedia(media);
          return candidate ? [candidate] : [];
        })
        .slice(0, safeLimit);
    },
  });
}
