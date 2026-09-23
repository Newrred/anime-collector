import { strictTitleSearchKey as normalizeSearchText, titleSearchMatchRank } from '../../../../domain/search/titleSearchMatch.js';

const cleanDisplayTitle = (value) => String(value || "")
  .replace(/^\s*[[(（【][^)\]）】]{0,40}(?:고화질|무삭제|무료|다시보기|자막|더빙)[^)\]）】]{0,40}[\])）】]\s*/iu, "")
  .normalize("NFKC").trim().replace(/\s+/gu, " ");

const normalizeTextList = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).flatMap((value) => {
    const text = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    const key = text.toLocaleLowerCase("en-US");
    if (!text || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
};

const candidateFromRow = (row) => {
  const externalId = String(row?.anilistId ?? "").trim();
  const aliases = normalizeTextList(row?.aliases);
  const displayTitle = cleanDisplayTitle(row?.ko || aliases[0]);
  if (!displayTitle || !/^[1-9]\d{0,11}$/.test(externalId)) return null;
  return {
    candidate: {
      kind: "ANIME_REF",
      displayTitle,
      aliases,
      genres: [],
      sourceBinding: { provider: "ANILIST", externalId },
      verificationState: "LEGACY_UNVERIFIED",
    },
    searchableTitles: normalizeTextList([displayTitle, ...aliases]),
  };
};

export function createLegacyAliasTitleResolver({ rows, limit = 8 }) {
  const candidates = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const candidate = candidateFromRow(row);
    return candidate ? [candidate] : [];
  });
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));

  return Object.freeze({
    async search(query) {
      const normalizedQuery = normalizeSearchText(query);
      if (normalizedQuery.length < 2) return [];

      return candidates.flatMap(({ candidate, searchableTitles }) => {
        let score = 0;
        for (const title of searchableTitles) {
          score = Math.max(score, titleSearchMatchRank(title, query));
        }
        return score ? [{ candidate, score }] : [];
      })
        .sort((left, right) => right.score - left.score || (
          Number(left.candidate.sourceBinding.externalId) - Number(right.candidate.sourceBinding.externalId)
        ))
        .slice(0, safeLimit)
        .map(({ candidate }) => structuredClone(candidate));
    },
  });
}
