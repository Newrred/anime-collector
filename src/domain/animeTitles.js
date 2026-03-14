function clean(value) {
  return String(value || "").trim();
}

export function firstHangulSynonym(media) {
  const arr = media?.synonyms;
  if (!Array.isArray(arr)) return null;
  return arr.find((value) => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(clean(value))) || null;
}

export function deriveKoTitleFromMedia(media) {
  const synonym = firstHangulSynonym(media);
  if (synonym) return synonym;

  const nativeTitle = clean(media?.title?.native);
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(nativeTitle)) return nativeTitle;
  return null;
}

export function pickDisplayTitle(item, media, locale = "ko") {
  const koTitle = clean(item?.koTitle);
  const synonymKo = deriveKoTitleFromMedia(media);
  const englishTitle = clean(media?.title?.english);
  const romajiTitle = clean(media?.title?.romaji);
  const nativeTitle = clean(media?.title?.native);

  if (locale === "en") {
    return (
      englishTitle ||
      romajiTitle ||
      nativeTitle ||
      koTitle ||
      synonymKo ||
      (Number.isFinite(Number(item?.anilistId)) ? `#${item.anilistId}` : "Unknown")
    );
  }

  return (
    koTitle ||
    synonymKo ||
    nativeTitle ||
    englishTitle ||
    romajiTitle ||
    (Number.isFinite(Number(item?.anilistId)) ? `#${item.anilistId}` : "Unknown")
  );
}

export function pickDisplayMediaTitle(media, locale = "ko") {
  return pickDisplayTitle({ anilistId: media?.id, koTitle: null }, media, locale);
}
