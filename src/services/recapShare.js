import { pickByLocale } from "../domain/uiText";

function ellipsize(text, max = 28) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(1, max - 1))}...`;
}

export function seasonLabel(key, locale = "ko") {
  const copy = {
    Spring: { ko: "봄", en: "Spring" },
    Summer: { ko: "여름", en: "Summer" },
    Fall: { ko: "가을", en: "Fall" },
    Winter: { ko: "겨울", en: "Winter" },
  };
  return pickByLocale(locale, copy[key]) || (locale === "en" ? "Unknown" : "미상");
}

export function buildRecapShareText({ yearRecap, titleById, recapYear, locale = "ko" }) {
  const safeYear = Number(recapYear) || new Date().getUTCFullYear();
  if (!yearRecap || yearRecap.totalLogs === 0) {
    return locale === "en"
      ? `${safeYear} recap: no logs yet.`
      : `${safeYear}년 회고: 기록이 아직 없습니다.`;
  }

  const header = locale === "en"
    ? `Anime Collector ${yearRecap.year} Recap`
    : `Anime Collector ${yearRecap.year} 회고`;
  const summary = locale === "en"
    ? `Logs ${yearRecap.totalLogs} · Anime ${yearRecap.uniqueAnimeCount} · Characters ${yearRecap.uniqueCharacterCount} · Rewatches ${yearRecap.eventCounts.rewatch}`
    : `기록 ${yearRecap.totalLogs}개 · 작품 ${yearRecap.uniqueAnimeCount}개 · 캐릭터 ${yearRecap.uniqueCharacterCount}명 · 재시청 ${yearRecap.eventCounts.rewatch}회`;
  const topAnime = yearRecap.topAnime
    .slice(0, 3)
    .map((row, idx) => `${idx + 1}. ${titleById.get(Number(row.anilistId)) || `#${row.anilistId}`} (${locale === "en" ? `${row.count}x` : `${row.count}회`})`)
    .join("\n");
  const topCharacters = yearRecap.topCharacters
    .slice(0, 3)
    .map((row, idx) => `${idx + 1}. ${row.name} (${locale === "en" ? `${row.count}x` : `${row.count}회`})`)
    .join("\n");
  const seasonLine = yearRecap.seasons
    .map((row) => `${seasonLabel(row.key, locale)} ${row.count}`)
    .join(" · ");

  return [
    header,
    summary,
    "",
    locale === "en" ? "[Top Anime]" : "[Top 작품]",
    topAnime || "-",
    "",
    locale === "en" ? "[Top Characters]" : "[Top 캐릭터]",
    topCharacters || "-",
    "",
    locale === "en" ? `[Season Split] ${seasonLine}` : `[시즌 분포] ${seasonLine}`,
  ].join("\n");
}

export function downloadRecapImage({ yearRecap, titleById, locale = "ko" }) {
  if (!yearRecap) return { ok: false, message: locale === "en" ? "No recap data." : "리캡 데이터가 없습니다." };

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, message: locale === "en" ? "Failed to generate image." : "이미지 생성에 실패했습니다." };

  const g = ctx.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, "#1d2b64");
  g.addColorStop(1, "#182848");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(56, 56, 968, 968);

  const title = locale === "en" ? `${yearRecap.year} Recap Card` : `${yearRecap.year} 회고 카드`;
  const summary = locale === "en"
    ? `Logs ${yearRecap.totalLogs} · Anime ${yearRecap.uniqueAnimeCount} · Rewatches ${yearRecap.eventCounts.rewatch}`
    : `기록 ${yearRecap.totalLogs} · 작품 ${yearRecap.uniqueAnimeCount} · 재시청 ${yearRecap.eventCounts.rewatch}`;
  const seasonLine = yearRecap.seasons.map((row) => `${seasonLabel(row.key, locale)} ${row.count}`).join("  ");

  ctx.fillStyle = "#f6f7fb";
  ctx.font = "700 58px Arial";
  ctx.fillText(title, 94, 150);
  ctx.font = "400 30px Arial";
  ctx.fillStyle = "rgba(246,247,251,0.92)";
  ctx.fillText(summary, 94, 200);

  ctx.font = "700 36px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(locale === "en" ? "Top Anime" : "Top 작품", 94, 290);
  ctx.font = "500 30px Arial";
  yearRecap.topAnime.slice(0, 5).forEach((row, idx) => {
    const line = `${idx + 1}. ${ellipsize(titleById.get(Number(row.anilistId)) || `#${row.anilistId}`, 34)} (${row.count})`;
    ctx.fillText(line, 110, 340 + idx * 52);
  });

  ctx.font = "700 36px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(locale === "en" ? "Top Characters" : "Top 캐릭터", 94, 650);
  ctx.font = "500 30px Arial";
  yearRecap.topCharacters.slice(0, 5).forEach((row, idx) => {
    const suffix = row.bestTag ? ` · ${row.bestTag}` : "";
    const line = `${idx + 1}. ${ellipsize(row.name, 22)} (${row.count})${suffix}`;
    ctx.fillText(line, 110, 700 + idx * 52);
  });

  ctx.font = "500 28px Arial";
  ctx.fillStyle = "rgba(246,247,251,0.9)";
  ctx.fillText(`${locale === "en" ? "Season Split" : "시즌 분포"}: ${seasonLine}`, 94, 1010);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `anime-recap-${yearRecap.year}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { ok: true, message: locale === "en" ? "Saved recap image." : "리캡 이미지를 저장했어요." };
}
