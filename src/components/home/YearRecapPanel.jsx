import { useState } from "react";
import {
  buildRecapShareText,
  downloadRecapImage,
  seasonLabel,
} from "../../services/recapShare";
import { pickByLocale } from "../../domain/uiText";
import { formatReasonTagLabel } from "../library/libraryCopy.js";

export default function YearRecapPanel({
  locale = "ko",
  recapYear,
  setRecapYear,
  recapYears,
  yearRecap,
  titleById,
  onOpenCharacter,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      clipboardUnsupported: "이 브라우저는 클립보드 복사를 지원하지 않습니다.",
      copied: "리캡 텍스트를 복사했어요.",
      copyFailed: "복사에 실패했습니다. 브라우저 권한을 확인해 주세요.",
      shareUnsupported: "이 브라우저는 공유 기능을 지원하지 않습니다.",
      shareTitle: "회고",
      shared: "리캡 텍스트를 공유했어요.",
      shareCancelled: "공유를 취소했어요.",
      shareFailed: "공유에 실패했습니다.",
      title: "연말 리캡",
      lead: "연도별 로그를 요약한 공유 카드",
      logs: "기록",
      anime: "작품",
      characters: "캐릭터",
      rewatches: "재시청",
      topAnime: "Top 작품",
      topCharacters: "Top 캐릭터",
      noLogsForYear: "에 기록된 로그가 없습니다.",
      selectedYear: "선택한 연도",
      copyText: "리캡 텍스트 복사",
      share: "공유",
      saveImage: "이미지 저장",
      countUnit: "개",
      peopleUnit: "명",
      times: "회",
    },
    en: {
      clipboardUnsupported: "This browser does not support clipboard copy.",
      copied: "Copied recap text.",
      copyFailed: "Failed to copy. Check browser permissions.",
      shareUnsupported: "This browser does not support sharing.",
      shareTitle: "Recap",
      shared: "Shared recap text.",
      shareCancelled: "Share cancelled.",
      shareFailed: "Failed to share.",
      title: "Year Recap",
      lead: "A shareable card summarizing yearly logs",
      logs: "Logs",
      anime: "Anime",
      characters: "Characters",
      rewatches: "Rewatches",
      topAnime: "Top Anime",
      topCharacters: "Top Characters",
      noLogsForYear: "has no logs.",
      selectedYear: "Selected year",
      copyText: "Copy recap text",
      share: "Share",
      saveImage: "Save image",
      countUnit: "",
      peopleUnit: "",
      times: "x",
    },
  });
  const [message, setMessage] = useState("");
  const displayYears = recapYears.length ? recapYears : [new Date().getUTCFullYear()];

  async function onCopyRecapText() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setMessage(copy.clipboardUnsupported);
      return;
    }
    const text = buildRecapShareText({ yearRecap, titleById, recapYear, locale });
    try {
      await navigator.clipboard.writeText(text);
      setMessage(copy.copied);
    } catch {
      setMessage(copy.copyFailed);
    }
  }

  async function onShareRecapText() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setMessage(copy.shareUnsupported);
      return;
    }
    const text = buildRecapShareText({ yearRecap, titleById, recapYear, locale });
    try {
      await navigator.share({
        title: `${Number(recapYear) || new Date().getUTCFullYear()} ${copy.shareTitle}`,
        text,
      });
      setMessage(copy.shared);
    } catch (err) {
      if (err?.name === "AbortError") setMessage(copy.shareCancelled);
      else setMessage(copy.shareFailed);
    }
  }

  function onDownloadRecapImage() {
    const result = downloadRecapImage({ yearRecap, titleById, locale });
    setMessage(result.message);
  }

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 10,
        padding: 12,
        background: "linear-gradient(135deg, rgba(64,180,130,.16), rgba(255,255,255,.02))",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{copy.title}</div>
          <div className="small" style={{ opacity: 0.82 }}>
            {copy.lead}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {displayYears.map((y) => {
            const active = Number(recapYear) === Number(y);
            return (
              <button
                key={y}
                type="button"
                onClick={() => setRecapYear(Number(y))}
                className="small"
                style={{
                  border: "1px solid rgba(255,255,255,.2)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: active ? "rgba(255,255,255,.86)" : "rgba(255,255,255,.08)",
                  color: active ? "#121217" : "inherit",
                  cursor: "pointer",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      {yearRecap && yearRecap.totalLogs > 0 ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              {locale === "en" ? `${copy.logs} ${yearRecap.totalLogs}` : `${copy.logs} ${yearRecap.totalLogs}${copy.countUnit}`}
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              {locale === "en" ? `${copy.anime} ${yearRecap.uniqueAnimeCount}` : `${copy.anime} ${yearRecap.uniqueAnimeCount}${copy.countUnit}`}
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              {locale === "en" ? `${copy.characters} ${yearRecap.uniqueCharacterCount}` : `${copy.characters} ${yearRecap.uniqueCharacterCount}${copy.peopleUnit}`}
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              {copy.rewatches} {yearRecap.eventCounts.rewatch}{copy.times}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.topAnime}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {yearRecap.topAnime.slice(0, 5).map((row, idx) => (
                  <div key={row.anilistId} className="small" style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8 }}>
                    <span>{idx + 1}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                    </span>
                    <span>{row.count}{copy.times}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.topCharacters}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {yearRecap.topCharacters.slice(0, 5).map((row, idx) => (
                  <button
                    key={row.characterId}
                    type="button"
                    onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                    className="small"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "20px 1fr auto",
                      gap: 8,
                      textAlign: "left",
                      padding: 0,
                    }}
                  >
                    <span>{idx + 1}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name}
                      {row.bestTag ? ` · ${formatReasonTagLabel(row.bestTag, locale)}` : ""}
                    </span>
                    <span>{row.count}{copy.times}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {yearRecap.seasons.map((row) => (
              <span
                key={row.key}
                className="small"
                style={{ border: "1px solid rgba(255,255,255,.16)", borderRadius: 999, padding: "3px 10px" }}
              >
                {seasonLabel(row.key, locale)} {row.count}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="small" style={{ opacity: 0.85 }}>
          {locale === "en"
            ? `${Number.isFinite(Number(recapYear)) ? recapYear : copy.selectedYear} ${copy.noLogsForYear}`
            : `${Number.isFinite(Number(recapYear)) ? `${recapYear}년` : copy.selectedYear}에 ${copy.noLogsForYear}`}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={onCopyRecapText}>
          {copy.copyText}
        </button>
        <button type="button" className="btn" onClick={onShareRecapText}>
          {copy.share}
        </button>
        <button type="button" className="btn" onClick={onDownloadRecapImage}>
          {copy.saveImage}
        </button>
      </div>
      {message && (
        <div className="small" style={{ opacity: 0.88 }}>
          {message}
        </div>
      )}
    </section>
  );
}
