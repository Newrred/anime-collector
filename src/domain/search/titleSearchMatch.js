export const strictTitleSearchKey = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
const looseKey = value => strictTitleSearchKey(value).replace(/[\p{P}\p{S}]/gu, '');

/** A punctuation-free query may omit decoration; explicit punctuation is never discarded. */
export function titleSearchMatchRank(title, query) {
  const strictQuery = strictTitleSearchKey(query);
  if (!strictQuery) return 0;
  const strictTitle = strictTitleSearchKey(title);
  if (strictTitle === strictQuery) return 3;
  if (strictTitle.startsWith(strictQuery)) return 2;
  if (strictTitle.includes(strictQuery)) return 1;
  if (/[\p{P}\p{S}]/u.test(strictQuery)) return 0;
  const looseTitle = looseKey(title);
  if (looseTitle === strictQuery) return 3;
  if (looseTitle.startsWith(strictQuery)) return 2;
  return looseTitle.includes(strictQuery) ? 1 : 0;
}
