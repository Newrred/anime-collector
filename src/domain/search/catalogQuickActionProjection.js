function buildSubtitle(media) {
  const parts = [
    String(media?.title?.english || media?.title?.romaji || media?.title?.native || "").trim(),
  ];
  if (Number.isFinite(Number(media?.seasonYear))) parts.push(String(media.seasonYear));
  if (media?.format) parts.push(String(media.format));
  return parts.filter(Boolean).join(" · ");
}

export function projectCatalogQuickRows(results, libraryIdSet = new Set()) {
  return (Array.isArray(results) ? results : [])
    .filter((row) => !libraryIdSet.has(Number(row?.id)))
    .slice(0, 8)
    .flatMap((row) => {
      const id = Number(row?.id);
      const media = row?.media;
      if (!Number.isFinite(id) || !media) return [];
      const title = String(
        row?.ko || media?.title?.english || media?.title?.romaji || media?.title?.native || ""
      ).trim();
      if (!title) return [];
      return [{
        kind: "remote",
        id,
        catalogAnimeId: String(row?.catalogAnimeId || row?.animeId || "").trim() || null,
        ko: row?.ko || null,
        media,
        src: "moemoa-catalog",
        title,
        subtitle: buildSubtitle(media),
        poster: media?.coverImage?.medium || media?.coverImage?.large || media?.coverImage?.extraLarge || "",
      }];
    });
}
