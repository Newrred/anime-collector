import { getMessages } from "../domain/messages.js";
import { RECAP_SHARE_PALETTE } from "../domain/colorSystem.js";

function ellipsize(text, max = 28) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(1, max - 1))}...`;
}

export function seasonLabel(key, locale = "ko") {
  const messages = getMessages(locale);
  return messages.libraryLabels.seasonTerm?.[key] || messages.recapShare.unknownSeason;
}

export function buildRecapShareText({ yearRecap, titleById, recapYear, locale = "ko" }) {
  const copy = getMessages(locale).recapShare;
  const safeYear = Number(recapYear) || new Date().getUTCFullYear();
  if (!yearRecap || yearRecap.totalLogs === 0) return copy.noLogs(safeYear);

  const header = copy.header(yearRecap.year);
  const summary = copy.summary(yearRecap);
  const topAnime = yearRecap.topAnime
    .slice(0, 3)
    .map((row, idx) => `${idx + 1}. ${titleById.get(Number(row.anilistId)) || `#${row.anilistId}`} (${copy.countTimes(row.count)})`)
    .join("\n");
  const topCharacters = yearRecap.topCharacters
    .slice(0, 3)
    .map((row, idx) => `${idx + 1}. ${row.name} (${copy.countTimes(row.count)})`)
    .join("\n");
  const seasonLine = yearRecap.seasons
    .map((row) => `${seasonLabel(row.key, locale)} ${row.count}`)
    .join(" · ");

  return [
    header,
    summary,
    "",
    copy.topAnimeHeading,
    topAnime || "-",
    "",
    copy.topCharactersHeading,
    topCharacters || "-",
    "",
    `${copy.seasonSplitHeading} ${seasonLine}`,
  ].join("\n");
}

export function downloadRecapImage({ yearRecap, titleById, locale = "ko" }) {
  const copy = getMessages(locale).recapShare;
  if (!yearRecap) return { ok: false, message: copy.imageNoData };

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, message: copy.imageFailed };

  const g = ctx.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, RECAP_SHARE_PALETTE.gradientStart);
  g.addColorStop(1, RECAP_SHARE_PALETTE.gradientEnd);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = RECAP_SHARE_PALETTE.panelFill;
  ctx.fillRect(56, 56, 968, 968);

  const title = copy.imageTitle(yearRecap.year);
  const summary = copy.imageSummary(yearRecap);
  const seasonLine = yearRecap.seasons.map((row) => `${seasonLabel(row.key, locale)} ${row.count}`).join("  ");

  ctx.fillStyle = RECAP_SHARE_PALETTE.title;
  ctx.font = "700 58px Arial";
  ctx.fillText(title, 94, 150);
  ctx.font = "400 30px Arial";
  ctx.fillStyle = RECAP_SHARE_PALETTE.body;
  ctx.fillText(summary, 94, 200);

  ctx.font = "700 36px Arial";
  ctx.fillStyle = RECAP_SHARE_PALETTE.heading;
  ctx.fillText(copy.imageTopAnime, 94, 290);
  ctx.font = "500 30px Arial";
  yearRecap.topAnime.slice(0, 5).forEach((row, idx) => {
    const line = `${idx + 1}. ${ellipsize(titleById.get(Number(row.anilistId)) || `#${row.anilistId}`, 34)} (${row.count})`;
    ctx.fillText(line, 110, 340 + idx * 52);
  });

  ctx.font = "700 36px Arial";
  ctx.fillStyle = RECAP_SHARE_PALETTE.heading;
  ctx.fillText(copy.imageTopCharacters, 94, 650);
  ctx.font = "500 30px Arial";
  yearRecap.topCharacters.slice(0, 5).forEach((row, idx) => {
    const suffix = row.bestTag ? ` · ${row.bestTag}` : "";
    const line = `${idx + 1}. ${ellipsize(row.name, 22)} (${row.count})${suffix}`;
    ctx.fillText(line, 110, 700 + idx * 52);
  });

  ctx.font = "500 28px Arial";
  ctx.fillStyle = RECAP_SHARE_PALETTE.bodyMuted;
  ctx.fillText(`${copy.imageSeasonSplit}: ${seasonLine}`, 94, 1010);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `anime-recap-${yearRecap.year}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { ok: true, message: copy.imageSaved };
}
