const PROMOTIONAL_TITLE_PREFIX = /^\s*[\[(（【][^)\]）】]{0,40}(?:고화질|무삭제|무료|다시보기|자막|더빙)[^)\]）】]{0,40}[\])）】]/iu;

export const isPromotionalCatalogTitle = (value) => PROMOTIONAL_TITLE_PREFIX.test(String(value || ""));

export function selectCatalogDisplayTitle(preferredTitle, aliases = []) {
  const preferred = String(preferredTitle || "").trim();
  if (preferred && !isPromotionalCatalogTitle(preferred)) return preferred;
  return aliases.map((value) => String(value || "").trim())
    .find((value) => value && !isPromotionalCatalogTitle(value)) || null;
}
