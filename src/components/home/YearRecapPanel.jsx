import { useState } from "react";
import {
  buildRecapShareText,
  downloadRecapImage,
  seasonLabelKo,
} from "../../services/recapShare";

export default function YearRecapPanel({
  recapYear,
  setRecapYear,
  recapYears,
  yearRecap,
  titleById,
  onOpenCharacter,
}) {
  const [message, setMessage] = useState("");
  const displayYears = recapYears.length ? recapYears : [new Date().getUTCFullYear()];

  async function onCopyRecapText() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setMessage("이 브라우저는 클립보드 복사를 지원하지 않습니다.");
      return;
    }
    const text = buildRecapShareText({ yearRecap, titleById, recapYear });
    try {
      await navigator.clipboard.writeText(text);
      setMessage("리캡 텍스트를 복사했어요.");
    } catch {
      setMessage("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  async function onShareRecapText() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setMessage("이 브라우저는 공유 기능을 지원하지 않습니다.");
      return;
    }
    const text = buildRecapShareText({ yearRecap, titleById, recapYear });
    try {
      await navigator.share({
        title: `${Number(recapYear) || new Date().getUTCFullYear()} 회고`,
        text,
      });
      setMessage("리캡 텍스트를 공유했어요.");
    } catch (err) {
      if (err?.name === "AbortError") setMessage("공유를 취소했어요.");
      else setMessage("공유에 실패했습니다.");
    }
  }

  function onDownloadRecapImage() {
    const result = downloadRecapImage({ yearRecap, titleById });
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
          <div style={{ fontWeight: 700 }}>연말 리캡</div>
          <div className="small" style={{ opacity: 0.82 }}>
            연도별 로그를 요약한 공유 카드
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
              기록 {yearRecap.totalLogs}개
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              작품 {yearRecap.uniqueAnimeCount}개
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              캐릭터 {yearRecap.uniqueCharacterCount}명
            </div>
            <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
              재시청 {yearRecap.eventCounts.rewatch}회
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top 작품</div>
              <div style={{ display: "grid", gap: 6 }}>
                {yearRecap.topAnime.slice(0, 5).map((row, idx) => (
                  <div key={row.anilistId} className="small" style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8 }}>
                    <span>{idx + 1}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                    </span>
                    <span>{row.count}회</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top 캐릭터</div>
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
                      {row.bestTag ? ` · ${row.bestTag}` : ""}
                    </span>
                    <span>{row.count}회</span>
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
                {seasonLabelKo(row.key)} {row.count}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="small" style={{ opacity: 0.85 }}>
          {Number.isFinite(Number(recapYear)) ? `${recapYear}년` : "선택한 연도"}에 기록된 로그가 없습니다.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={onCopyRecapText}>
          리캡 텍스트 복사
        </button>
        <button type="button" className="btn" onClick={onShareRecapText}>
          공유
        </button>
        <button type="button" className="btn" onClick={onDownloadRecapImage}>
          이미지 저장
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
