import { pickByLocale } from "../../domain/uiText";
import { formatEventLabel, formatReasonTagLabel } from "../library/libraryCopy.js";

export default function CharacterInsightSheet({
  locale = "ko",
  base,
  selectedCharacter,
  characterInsight,
  titleById,
  onClose,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      totalLogs: "이 캐릭터로 남긴 감상 기록",
      close: "닫기",
      recent60: "최근 60일",
      relatedAnime: "관련 작품",
      commonTags: "자주 붙는 포인트 태그",
      relatedSection: "관련 작품",
      emptyRelated: "아직 관련 로그가 없습니다.",
      timeline: "최근 기록 타임라인",
      emptyTimeline: "표시할 로그가 없습니다.",
      openLibrary: "보관함에서 상세 보기",
      countUnit: "개",
      times: "회",
    },
    en: {
      totalLogs: "Logs left for this character",
      close: "Close",
      recent60: "Last 60d",
      relatedAnime: "Related anime",
      commonTags: "Common reason tags",
      relatedSection: "Related anime",
      emptyRelated: "No related logs yet.",
      timeline: "Recent timeline",
      emptyTimeline: "No logs to show.",
      openLibrary: "Open in Library",
      countUnit: "",
      times: "x",
    },
  });
  if (!selectedCharacter) return null;
  function buildLibraryDetailHref(anilistId) {
    const id = Number(anilistId);
    if (!Number.isFinite(id)) return `${base}library/`;
    return `${base}library/?animeId=${encodeURIComponent(String(id))}`;
  }

  const topRelatedAnimeId = Number(characterInsight?.relatedAnime?.[0]?.anilistId);
  const insightCtaHref = Number.isFinite(topRelatedAnimeId)
    ? buildLibraryDetailHref(topRelatedAnimeId)
    : `${base}library/`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        alignItems: "end",
        zIndex: 1400,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 100vw)",
          margin: "0 auto",
          border: "1px solid rgba(255,255,255,.14)",
          borderRadius: "16px 16px 0 0",
          background: "rgba(15,17,23,.98)",
          padding: 14,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
            {characterInsight?.image ? (
              <img
                src={characterInsight.image}
                alt={characterInsight.name}
                loading="lazy"
                style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div aria-hidden style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {characterInsight?.name || selectedCharacter?.name || `#${selectedCharacter.characterId}`}
              </div>
              <div className="small" style={{ opacity: 0.82 }}>
                {locale === "en"
                  ? `${copy.totalLogs} ${characterInsight?.total || 0}`
                  : `${copy.totalLogs} ${characterInsight?.total || 0}${copy.countUnit}`}
              </div>
            </div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {copy.close}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.1)" }}>
            {copy.recent60} {characterInsight?.recent60 || 0}{copy.times}
          </div>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.1)" }}>
            {locale === "en"
              ? `${copy.relatedAnime} ${characterInsight?.relatedAnime?.length || 0}`
              : `${copy.relatedAnime} ${characterInsight?.relatedAnime?.length || 0}${copy.countUnit}`}
          </div>
        </div>

        {characterInsight?.reasonTags?.length > 0 && (
          <section style={{ marginBottom: 12 }}>
            <div className="small" style={{ marginBottom: 6 }}>{copy.commonTags}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {characterInsight.reasonTags.map((row) => (
                <span
                  key={row.tag}
                  className="small"
                  style={{ border: "1px solid rgba(255,255,255,.16)", borderRadius: 999, padding: "3px 10px", opacity: 0.92 }}
                >
                  {row.tag} · {row.count}
                </span>
              ))}
            </div>
          </section>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ marginBottom: 8 }}>{copy.relatedSection}</div>
            {characterInsight?.relatedAnime?.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                {characterInsight.relatedAnime.map((row) => (
                  <div key={row.anilistId} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <a
                      href={buildLibraryDetailHref(row.anilistId)}
                      className="small"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit" }}
                    >
                      {row.title}
                    </a>
                    <div className="small" style={{ opacity: 0.9 }}>{row.count}{copy.times}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small" style={{ opacity: 0.82 }}>{copy.emptyRelated}</div>
            )}
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ marginBottom: 8 }}>{copy.timeline}</div>
            {characterInsight?.recentLogs?.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {characterInsight.recentLogs.map((row) => (
                  <div key={row.id} style={{ display: "grid", gap: 2 }}>
                    <div className="small" style={{ opacity: 0.86 }}>
                      {row.label} · {formatEventLabel(row.eventType, locale)}
                      {row.reasonTag ? ` · ${formatReasonTagLabel(row.reasonTag, locale)}` : ""}
                    </div>
                    <div className="small" style={{ opacity: 0.94 }}>
                      <a
                        href={buildLibraryDetailHref(row.anilistId)}
                        style={{ color: "inherit" }}
                      >
                        {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                      </a>
                    </div>
                    {row.cue && (
                      <div className="small" style={{ opacity: 0.82 }}>
                        {row.cue}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="small" style={{ opacity: 0.82 }}>{copy.emptyTimeline}</div>
            )}
          </div>
        </section>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <a href={insightCtaHref} className="btn" style={{ textDecoration: "none" }}>
            {copy.openLibrary}
          </a>
        </div>
      </div>
    </div>
  );
}
