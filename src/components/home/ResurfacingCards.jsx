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
      className="list-card"
    >
      {poster ? (
        <img
          src={poster}
          alt={title}
          loading="lazy"
          className="list-card__thumb"
        />
      ) : (
        <div aria-hidden className="list-card__thumb" />
      )}
      <div className="list-card__body">
        <div className="list-card__eyebrow">{metaTop}</div>
        <div className="list-card__title">{title}</div>
        {metaBottom && (
          <div className="list-card__meta">{metaBottom}</div>
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
          <h2 className="sectionTitle">{copy.recentLogs}</h2>
          {resurfacing.recentLogs.length === 0 ? (
            <div className="small">{copy.noLogs}</div>
          ) : (
            <div className="list-stack">
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
          <h2 className="sectionTitle">{copy.noMemory}</h2>
          {resurfacing.missingMemory.length === 0 ? (
            <div className="small">{copy.allLogged}</div>
          ) : (
            <div className="list-stack">
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
          <h2 className="sectionTitle">{copy.recentPrimary}</h2>
          {resurfacing.recentPrimaryCharacters.length === 0 ? (
            <div className="small">{copy.noPrimary}</div>
          ) : (
            <div className="list-stack">
              {resurfacing.recentPrimaryCharacters.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  className="list-card list-card--button"
                >
                  <>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        className="list-card__thumb list-card__thumb--circle"
                      />
                    ) : (
                      <div aria-hidden className="list-card__thumb list-card__thumb--circle" />
                    )}
                    <div className="list-card__body">
                      <div className="list-card__title">
                        {row.name} · {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                      </div>
                      <div className="list-card__meta">
                        {row.label}
                        {row.reasonTag ? ` · ${formatReasonTagLabel(row.reasonTag, locale)}` : ""}
                        {row.cue ? ` · ${row.cue}` : ""}
                      </div>
                    </div>
                  </>
                </button>
              ))}
            </div>
          )}
        </div>
        {hasRepeated ? (
          <div className="surface-card">
            <h2 className="sectionTitle">{copy.recurring}</h2>
            <div className="list-stack">
              {resurfacing.repeatedCharacters.map((row) => (
                <button
                  key={row.characterId}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  className="list-card list-card--button"
                >
                  <>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        className="list-card__thumb list-card__thumb--circle list-card__thumb--sm"
                      />
                    ) : (
                      <div aria-hidden className="list-card__thumb list-card__thumb--circle list-card__thumb--sm" />
                    )}
                    <div className="list-card__body">
                      <div className="list-card__title">{row.name}</div>
                      <div className="list-card__meta">
                        {locale === "en"
                          ? `${copy.recent60} ${row.countRecent60}${copy.countUnit} · ${copy.total} ${row.countTotal}${copy.countUnit} · ${copy.relatedAnime} ${row.relatedAnimeCount}`
                          : `${copy.recent60} ${row.countRecent60}${copy.countUnit} · ${copy.total} ${row.countTotal}${copy.countUnit} · ${copy.relatedAnime} ${row.relatedAnimeCount}${copy.countItem}`}
                        {Number.isFinite(Number(row.topAnimeId))
                          ? ` · ${copy.featuredAnime} ${titleById.get(Number(row.topAnimeId)) || `#${row.topAnimeId}`}`
                          : ""}
                      </div>
                    </div>
                  </>
                </button>
              ))}
            </div>
          </div>
        ) : hasThisTime ? (
          <div className="surface-card">
            <h2 className="sectionTitle">{copy.thisTime}</h2>
            <div className="list-stack">
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
            <h2 className="sectionTitle">{copy.thisTime}</h2>
            <div className="list-stack">
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
          <div className="surface-card home-note-card">
            <div className="small page-feedback">
              {copy.revisitHint}
            </div>
          </div>
          </div>
        )}

      </div>

      {resurfacing.pinnedHighlights.length > 0 && (
        <section className="surface-card">
          <h2 className="sectionTitle">{copy.pinned}</h2>
          <div className="metric-grid">
            {resurfacing.pinnedHighlights.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenCharacter(p.characterId, p.nameSnapshot, p.imageSnapshot)}
                className="list-card list-card--button"
              >
                <>
                  {p.imageSnapshot ? (
                    <img
                      src={p.imageSnapshot}
                      alt={p.nameSnapshot}
                      loading="lazy"
                      className="list-card__thumb list-card__thumb--circle list-card__thumb--sm"
                    />
                  ) : (
                    <div aria-hidden className="list-card__thumb list-card__thumb--circle list-card__thumb--sm" />
                  )}
                  <div className="list-card__body">
                    <div className="list-card__title">{p.nameSnapshot}</div>
                    <div className="list-card__meta">
                      {titleById.get(Number(p.mediaId)) || `#${p.mediaId}`}
                      {p.pinReason ? ` · ${formatReasonTagLabel(p.pinReason, locale)}` : ""}
                    </div>
                  </div>
                </>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
