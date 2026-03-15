import { getMessageGroup } from "../../domain/messages.js";
import { formatEventLabel, formatReasonTagLabel } from "../library/libraryCopy.js";

export default function CharacterInsightSheet({
  locale = "ko",
  base,
  selectedCharacter,
  characterInsight,
  titleById,
  onClose,
}) {
  const copy = getMessageGroup(locale, "characterInsightSheet");
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
        background: "var(--color-overlay-scrim)",
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
          border: "1px solid var(--color-insight-panel-border)",
          borderRadius: "16px 16px 0 0",
          background: "var(--color-insight-panel-bg)",
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
              <div aria-hidden style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--color-insight-avatar-fallback)" }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="character-insight-sheet__name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "var(--color-insight-chip-bg)" }}>
            {copy.recent60} {characterInsight?.recent60 || 0}{copy.times}
          </div>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "var(--color-insight-chip-bg)" }}>
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
                  style={{ border: "1px solid var(--color-insight-chip-border)", borderRadius: 999, padding: "3px 10px", opacity: 0.92 }}
                >
                  {row.tag} · {row.count}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="character-insight-sheet__panels">
          <div className="character-insight-sheet__panel">
            <div className="small" style={{ marginBottom: 8 }}>{copy.relatedSection}</div>
            {characterInsight?.relatedAnime?.length ? (
              <div className="character-insight-sheet__list">
                {characterInsight.relatedAnime.map((row) => (
                  <div key={row.anilistId} className="character-insight-sheet__row">
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
              <div className="small ui-empty-state ui-empty-state--compact character-insight-sheet__empty">{copy.emptyRelated}</div>
            )}
          </div>

          <div className="character-insight-sheet__panel">
            <div className="small" style={{ marginBottom: 8 }}>{copy.timeline}</div>
            {characterInsight?.recentLogs?.length ? (
              <div className="character-insight-sheet__list">
                {characterInsight.recentLogs.map((row) => (
                  <div key={row.id} className="character-insight-sheet__timeline-item">
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
              <div className="small ui-empty-state ui-empty-state--compact character-insight-sheet__empty">{copy.emptyTimeline}</div>
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
