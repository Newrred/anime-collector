import { getMessageGroup } from "../../domain/messages.js";
import { formatEventLabel } from "../library/libraryCopy.js";

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
    <a href={href || buildLibraryDetailHref(base, anilistId)} className="list-card home-resurfacing-list-card">
      {poster ? <img src={poster} alt={title} loading="lazy" className="list-card__thumb" /> : <div className="list-card__thumb" aria-hidden />}
      <div className="list-card__body">
        <div className="list-card__eyebrow">{metaTop}</div>
        <div className="list-card__title">{title}</div>
        {metaBottom ? <div className="list-card__meta">{metaBottom}</div> : null}
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
  thisTimeRows = [],
}) {
  const copy = getMessageGroup(locale, "homeResurfacing");
  const hasThisTime = thisTimeRows.length > 0;

  return (
    <section className="home-resurfacing-grid">
      <div className="home-section-block">
        <div className="pageHeader">
          <h2 className="sectionTitle home-section-title">{copy.noMemory}</h2>
        </div>
        <section className="surface-card home-resurfacing-card">
          {missingMemory.length === 0 ? (
            <div className="small ui-empty-state ui-empty-state--card">{copy.allLogged}</div>
          ) : (
            <div className="list-stack">
              {missingMemory.map((row) =>
                renderAnimeRow({
                  base,
                  anilistId: row.anilistId,
                  href: buildQuickLogHref(base, row.anilistId),
                  metaTop: copy.noLogMeta,
                  metaBottom: copy.promptLog,
                  mediaMap,
                  titleById,
                })
              )}
            </div>
          )}
        </section>
      </div>

      <div className="home-section-block">
        <div className="pageHeader">
          <h2 className="sectionTitle home-section-title">{copy.recentLogs}</h2>
        </div>
        <section className="surface-card home-resurfacing-card">
          {recentLogs.length === 0 ? (
            <div className="small ui-empty-state ui-empty-state--card">{copy.noLogs}</div>
          ) : (
            <div className="list-stack">
              {recentLogs.map((row) =>
                renderAnimeRow({
                  base,
                  anilistId: row.anilistId,
                  href: buildLibraryDetailHref(base, row.anilistId),
                  metaTop: `${row.label} · ${formatEventLabel(row.eventType, locale)}`,
                  metaBottom: row.cue || "",
                  mediaMap,
                  titleById,
                })
              )}
            </div>
          )}
        </section>
      </div>

      {hasThisTime ? (
        <div className="home-section-block home-resurfacing-card--wide">
          <div className="pageHeader">
            <p className="sectionLead">{copy.revisitHint}</p>
            <h2 className="sectionTitle home-section-title">{copy.thisTime}</h2>
          </div>
          <section className="surface-card home-resurfacing-card">
            <div className="list-stack">
              {thisTimeRows.map((row) =>
                renderAnimeRow({
                  base,
                  anilistId: row.anilistId,
                  href: buildLibraryDetailHref(base, row.anilistId),
                  metaTop: `${row.label} · ${formatEventLabel(row.eventType, locale)}`,
                  metaBottom: row.cue || "",
                  mediaMap,
                  titleById,
                })
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
