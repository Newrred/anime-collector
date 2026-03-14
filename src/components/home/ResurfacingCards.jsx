import { pickByLocale } from "../../domain/uiText";
import { formatEventLabel, formatReasonTagLabel } from "../library/libraryCopy.js";

function buildLibraryDetailHref(base, anilistId) {
  const id = Number(anilistId);
  if (!Number.isFinite(id)) return `${base}library/`;
  return `${base}library/?animeId=${encodeURIComponent(String(id))}`;
}

function renderAnimeRow({ base, anilistId, metaTop, metaBottom = "", mediaMap, titleById }) {
  const media = mediaMap.get(Number(anilistId));
  const title = titleById.get(Number(anilistId)) || `#${anilistId}`;
  const poster = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || "";
  return (
    <a
      href={buildLibraryDetailHref(base, anilistId)}
      style={{
        display: "grid",
        gridTemplateColumns: "42px 1fr",
        gap: 8,
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 8,
        padding: 6,
        background: "rgba(255,255,255,.02)",
      }}
    >
      {poster ? (
        <img
          src={poster}
          alt={title}
          loading="lazy"
          style={{ width: 42, height: 58, borderRadius: 6, objectFit: "cover" }}
        />
      ) : (
        <div
          aria-hidden
          style={{ width: 42, height: 58, borderRadius: 6, background: "rgba(255,255,255,.14)" }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {metaTop}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {metaBottom && (
          <div className="small" style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {metaBottom}
          </div>
        )}
      </div>
    </a>
  );
}

export default function ResurfacingCards({
  locale = "ko",
  base,
  mediaMap,
  titleById,
  resurfacing,
  onOpenCharacter,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      recentLogs: "최근 감상 기록",
      noLogs: "아직 기록이 없습니다.",
      noMemory: "아직 기록 안 남긴 작품",
      allLogged: "모든 작품에 최소 1개 이상의 기록이 있습니다.",
      noLogMeta: "기록 없음",
      promptLog: "바로 기록해 보세요",
      recentPrimary: "최근 감상 대표캐",
      noPrimary: "대표캐를 남긴 기록이 아직 없어요.",
      recurring: "자꾸 생각난 캐릭터",
      thisTime: "이맘때 봤던 작품",
      revisitHint: "오래된 기억 카드와 최근 캐릭터 카드를 번갈아 확인해 보세요.",
      pinned: "최애로 고정한 캐릭터",
      recent60: "최근 60일",
      total: "전체",
      relatedAnime: "관련 작품",
      featuredAnime: "대표 작품",
      countUnit: "회",
      countItem: "개",
    },
    en: {
      recentLogs: "Recent logs",
      noLogs: "No logs yet.",
      noMemory: "Anime without logs yet",
      allLogged: "Every anime already has at least one log.",
      noLogMeta: "No log",
      promptLog: "Add a quick log",
      recentPrimary: "Recent primary characters",
      noPrimary: "No logs with a primary character yet.",
      recurring: "Characters that keep returning",
      thisTime: "Watched around this time",
      revisitHint: "Alternate between older memory cards and recent character cards.",
      pinned: "Pinned favorite characters",
      recent60: "Last 60d",
      total: "Total",
      relatedAnime: "Related anime",
      featuredAnime: "Featured anime",
      countUnit: "x",
      countItem: "",
    },
  });
  const hasRepeated = resurfacing.repeatedCharacters.length > 0;
  const hasThisTime = resurfacing.thisTime.length > 0;

  return (
    <>
      <div className="home-grid">
        <div className="home-row-2">
        <div className="surface-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.recentLogs}</div>
          {resurfacing.recentLogs.length === 0 ? (
            <div className="small">{copy.noLogs}</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.recentLogs.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: `${row.label} · ${formatEventLabel(row.eventType, locale)}`,
                    metaBottom: row.cue || "",
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.noMemory}</div>
          {resurfacing.missingMemory.length === 0 ? (
            <div className="small">{copy.allLogged}</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.missingMemory.map((row) => (
                <div key={row.anilistId}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: copy.noLogMeta,
                    metaBottom: copy.promptLog,
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        <div className="home-row-2">
        <div className="surface-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.recentPrimary}</div>
          {resurfacing.recentPrimaryCharacters.length === 0 ? (
            <div className="small">{copy.noPrimary}</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {resurfacing.recentPrimaryCharacters.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 8, alignItems: "center" }}>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name} · {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                      </div>
                      <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.label}
                        {row.reasonTag ? ` · ${formatReasonTagLabel(row.reasonTag, locale)}` : ""}
                        {row.cue ? ` · ${row.cue}` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {hasRepeated ? (
          <div className="surface-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.recurring}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {resurfacing.repeatedCharacters.map((row) => (
                <button
                  key={row.characterId}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8, alignItems: "center" }}>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name}
                      </div>
                      <div className="small" style={{ opacity: 0.82 }}>
                        {locale === "en"
                          ? `${copy.recent60} ${row.countRecent60}${copy.countUnit} · ${copy.total} ${row.countTotal}${copy.countUnit} · ${copy.relatedAnime} ${row.relatedAnimeCount}`
                          : `${copy.recent60} ${row.countRecent60}${copy.countUnit} · ${copy.total} ${row.countTotal}${copy.countUnit} · ${copy.relatedAnime} ${row.relatedAnimeCount}${copy.countItem}`}
                        {Number.isFinite(Number(row.topAnimeId))
                          ? ` · ${copy.featuredAnime} ${titleById.get(Number(row.topAnimeId)) || `#${row.topAnimeId}`}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : hasThisTime ? (
          <div className="surface-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.thisTime}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.thisTime.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: `${row.label} · ${formatEventLabel(row.eventType, locale)}`,
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        </div>

        {hasRepeated && hasThisTime && (
          <div className="home-row-2">
          <div className="surface-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.thisTime}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.thisTime.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: `${row.label} · ${row.eventType}`,
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card" style={{ display: "grid", placeItems: "center" }}>
            <div className="small" style={{ opacity: 0.84 }}>
              {copy.revisitHint}
            </div>
          </div>
          </div>
        )}

      </div>

      {resurfacing.pinnedHighlights.length > 0 && (
        <section className="surface-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.pinned}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
            {resurfacing.pinnedHighlights.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenCharacter(p.characterId, p.nameSnapshot, p.imageSnapshot)}
                style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, alignItems: "center" }}>
                  {p.imageSnapshot ? (
                    <img
                      src={p.imageSnapshot}
                      alt={p.nameSnapshot}
                      loading="lazy"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nameSnapshot}
                    </div>
                    <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleById.get(Number(p.mediaId)) || `#${p.mediaId}`}
                      {p.pinReason ? ` · ${formatReasonTagLabel(p.pinReason, locale)}` : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
