import { pickDisplayTitle } from "../animeTitles.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function buildStatusMeta(item) {
  const parts = [];
  if (item?.status) parts.push(String(item.status));
  if (item?.score != null) parts.push(`${item.score}/5`);
  return parts.join(" · ");
}

export function mapLocalLibraryRow({ item, media, locale = "ko", score = 0 }) {
  const id = Number(item?.anilistId);
  if (!Number.isFinite(id)) return null;

  return {
    kind: "library",
    id,
    score,
    item,
    media,
    title: pickDisplayTitle(item, media, locale),
    subtitle: buildStatusMeta(item),
    poster: media?.coverImage?.medium || media?.coverImage?.large || "",
  };
}

export function searchLocalLibrary({
  items,
  mediaMap,
  query,
  locale = "ko",
  limit = 6,
}) {
  const qn = normalizeText(query);
  if (!qn) return [];

  const scored = [];

  for (const item of Array.isArray(items) ? items : []) {
    const id = Number(item?.anilistId);
    if (!Number.isFinite(id)) continue;

    const media = mediaMap instanceof Map ? mediaMap.get(id) : null;
    const title = pickDisplayTitle(item, media, locale);
    const ko = String(item?.koTitle || "");
    const genres = Array.isArray(media?.genres) ? media.genres.join(" ") : "";
    const blob = normalizeText([title, ko, genres].join(" "));

    let score = 0;
    if (blob === qn) score = 400;
    else if (blob.startsWith(qn)) score = 320;
    else if (blob.includes(qn)) score = 240;

    if (score <= 0) continue;

    const row = mapLocalLibraryRow({ item, media, locale, score });
    if (row) scored.push(row);
  }

  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, locale === "en" ? "en" : "ko"))
    .slice(0, limit);
}
