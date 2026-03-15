import { getMessageGroup } from "../../domain/messages.js";
import { formatEventLabel, formatReasonTagLabel } from "../library/libraryCopy.js";

function buildLibraryDetailHref(base, anilistId) {
  const id = Number(anilistId);
  if (!Number.isFinite(id)) return `${base}library/`;
  return `${base}library/?animeId=${encodeURIComponent(String(id))}`;
}

function buildQuickLogHref(base, anilistId) {
  const id = Number(anilistId);
  if (!Number.isFinite(id)) return `${base}library/?tab=add`;
  return `${base}library/?animeId=${encodeURIComponent(String(id))}&focus=quick-log`;
}

function renderAnimeRow({ base, anilistId, href, metaTop, metaBottom = "", mediaMap, titleById }) {
  const media = mediaMap.get(Number(anilistId));
  const title = titleById.get(Number(anilistId)) || `#${anilistId}`;
  const poster = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || "";
  return (
    <a
      href={href || buildLibraryDetailHref(base, anilistId)}
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
  recentLogs = [],
  missingMemory = [],
  characterRows = [],
  characterMode = "recent",
  thisTimeRows = [],
  pinnedHighlights = [],
  onOpenCharacter,
}) {
  const copy = getMessageGroup(locale, "homeResurfacing");
  const showRepeatedCopy = characterMode === "repeated";
  const hasThisTime = thisTimeRows.length > 0;

  return (
    <>
      <div className="home-grid">
        <div className="home-row-2">
        <div className="surface-card ui-panel-stack">
          <h2 className="sectionTitle">{copy.noMemory}</h2>
          {missingMemory.length === 0 ? (
            <div className="small ui-empty-state ui-empty-state--card">{copy.allLogged}</div>
          ) : (
            <div className="list-stack">
              {missingMemory.map((row) => (
                <div key={row.anilistId}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    href: buildQuickLogHref(base, row.anilistId),
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

        <div className="surface-card ui-panel-stack">
          <h2 className="sectionTitle">{copy.recentLogs}</h2>
          {recentLogs.length === 0 ? (
            <div className="small ui-empty-state ui-empty-state--card">{copy.noLogs}</div>
          ) : (
            <div className="list-stack">
              {recentLogs.map((row) => (
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
        </div>

        <div className="home-row-2">
        <div className="surface-card ui-panel-stack">
          <h2 className="sectionTitle">{showRepeatedCopy ? copy.recurring : copy.recentPrimary}</h2>
          {characterRows.length === 0 ? (
            <div className="small ui-empty-state ui-empty-state--card">{copy.noPrimary}</div>
          ) : (
            <div className="list-stack">
              {characterRows.map((row) => (
                <button
                  key={row.id || row.characterId}
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
                        {row.name}
                        {Number.isFinite(Number(row.anilistId ?? row.topAnimeId))
                          ? ` · ${titleById.get(Number(row.anilistId ?? row.topAnimeId)) || `#${row.anilistId ?? row.topAnimeId}`}`
                          : ""}
                      </div>
                      <div className="list-card__meta">
                        {[
                          row.label || "",
                          row.reasonTag ? formatReasonTagLabel(row.reasonTag, locale) : "",
                          row.cue || "",
                          showRepeatedCopy && Number.isFinite(Number(row.countTotal))
                            ? `${copy.total} ${row.countTotal}${copy.countUnit}`
                            : "",
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </>
                </button>
              ))}
            </div>
          )}
        </div>
        {hasThisTime ? (
          <div className="surface-card ui-panel-stack">
            <h2 className="sectionTitle">{copy.thisTime}</h2>
            <div className="list-stack">
              {thisTimeRows.map((row) => (
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
        ) : (
          <div className="surface-card home-note-card ui-panel-stack">
            <div className="small page-feedback">
              {copy.revisitHint}
            </div>
          </div>
        )}
        </div>
      </div>

      {pinnedHighlights.length > 0 && (
        <section className="surface-card ui-panel-stack">
          <h2 className="sectionTitle">{copy.pinned}</h2>
          <div className="metric-grid">
            {pinnedHighlights.map((p) => (
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
