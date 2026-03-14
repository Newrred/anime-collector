import { useState } from "react";
import {
  buildRecapShareText,
  downloadRecapImage,
  seasonLabel,
} from "../../services/recapShare";
import { pickByLocale } from "../../domain/uiText";
import { formatReasonTagLabel } from "../library/libraryCopy.js";
import { IconCopy, IconImage, IconShare } from "../ui/AppIcons.jsx";

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
    <section className="surface-card year-recap-panel">
      <div className="year-recap-panel__head">
        <div className="pageHeader year-recap-panel__copy">
          <h2 className="sectionTitle">{copy.title}</h2>
          <p className="sectionLead">{copy.lead}</p>
        </div>
        <div className="pill-row">
          {displayYears.map((y) => {
            const active = Number(recapYear) === Number(y);
            return (
              <button
                key={y}
                type="button"
                onClick={() => setRecapYear(Number(y))}
                className={`pill-btn${active ? " is-active" : ""}`}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      {yearRecap && yearRecap.totalLogs > 0 ? (
        <>
          <div className="status-badge-row">
            <div className="small status-badge">
              {locale === "en" ? `${copy.logs} ${yearRecap.totalLogs}` : `${copy.logs} ${yearRecap.totalLogs}${copy.countUnit}`}
            </div>
            <div className="small status-badge">
              {locale === "en" ? `${copy.anime} ${yearRecap.uniqueAnimeCount}` : `${copy.anime} ${yearRecap.uniqueAnimeCount}${copy.countUnit}`}
            </div>
            <div className="small status-badge">
              {locale === "en" ? `${copy.characters} ${yearRecap.uniqueCharacterCount}` : `${copy.characters} ${yearRecap.uniqueCharacterCount}${copy.peopleUnit}`}
            </div>
            <div className="small status-badge">
              {copy.rewatches} {yearRecap.eventCounts.rewatch}{copy.times}
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric-card year-recap-panel__metric">
              <div className="sectionTitle year-recap-panel__metric-title">{copy.topAnime}</div>
              <div className="list-stack">
                {yearRecap.topAnime.slice(0, 5).map((row, idx) => (
                  <div key={row.anilistId} className="small year-recap-panel__rank-row">
                    <span>{idx + 1}</span>
                    <span className="year-recap-panel__rank-text">
                      {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                    </span>
                    <span>{row.count}{copy.times}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card year-recap-panel__metric">
              <div className="sectionTitle year-recap-panel__metric-title">{copy.topCharacters}</div>
              <div className="list-stack">
                {yearRecap.topCharacters.slice(0, 5).map((row, idx) => (
                  <button
                    key={row.characterId}
                    type="button"
                    onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                    className="small year-recap-panel__rank-btn"
                  >
                    <span>{idx + 1}</span>
                    <span className="year-recap-panel__rank-text">
                      {row.name}
                      {row.bestTag ? ` · ${formatReasonTagLabel(row.bestTag, locale)}` : ""}
                    </span>
                    <span>{row.count}{copy.times}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pill-row">
            {yearRecap.seasons.map((row) => (
              <span
                key={row.key}
                className="small status-badge"
              >
                {seasonLabel(row.key, locale)} {row.count}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="small page-feedback">
          {locale === "en"
            ? `${Number.isFinite(Number(recapYear)) ? recapYear : copy.selectedYear} ${copy.noLogsForYear}`
            : `${Number.isFinite(Number(recapYear)) ? `${recapYear}년` : copy.selectedYear}에 ${copy.noLogsForYear}`}
        </div>
      )}

      <div className="action-row">
        <button type="button" className="btn btn--subtle" onClick={onCopyRecapText}>
          <span className="btn__icon"><IconCopy /></span>
          <span className="btn__label">{copy.copyText}</span>
        </button>
        <button type="button" className="btn btn--subtle" onClick={onShareRecapText}>
          <span className="btn__icon"><IconShare /></span>
          <span className="btn__label">{copy.share}</span>
        </button>
        <button type="button" className="btn btn--subtle" onClick={onDownloadRecapImage}>
          <span className="btn__icon"><IconImage /></span>
          <span className="btn__label">{copy.saveImage}</span>
        </button>
      </div>
      {message && (
        <div className="small page-feedback">
          {message}
        </div>
      )}
    </section>
  );
}
