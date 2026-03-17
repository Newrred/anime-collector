import { getMessageGroup } from "../../domain/messages.js";

function WidgetShell({ title, lead, children, className = "" }) {
  return (
    <section className={`surface-card showcase-card ${className}`.trim()}>
      <div className="pageHeader showcase-card__head">
        <h2 className="sectionTitle">{title}</h2>
        <p className="sectionLead">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function TasteFingerprintCard({ data, locale }) {
  const copy = getMessageGroup(locale, "showcaseWidgets").tasteFingerprint || {};
  const seasonLabel = copy.seasons?.[data?.dominantSeasonKey] || copy.seasons?.unknown || "-";

  return (
    <WidgetShell title={copy.title} lead={copy.lead}>
      <div className="showcase-chip-group">
        {(data?.topGenres || []).map((row) => (
          <span key={row.label} className="status-badge">
            {row.label} {row.count}
          </span>
        ))}
      </div>

      <div className="showcase-meta-list">
        <div>
          <div className="small showcase-meta-label">{copy.topGenres}</div>
          <div>{(data?.topGenres || []).map((row) => row.label).join(" · ") || "-"}</div>
        </div>
        <div>
          <div className="small showcase-meta-label">{copy.topReasons}</div>
          <div>{(data?.topReasons || []).map((row) => row.label).join(" · ") || "-"}</div>
        </div>
        <div>
          <div className="small showcase-meta-label">{copy.words}</div>
          <div>{(data?.signatureWords || []).map((row) => `'${row.label}'`).join(" · ") || "-"}</div>
        </div>
        <div>
          <div className="small showcase-meta-label">{copy.seasonBias}</div>
          <div>{seasonLabel}</div>
        </div>
      </div>
    </WidgetShell>
  );
}

function ThisTimeCapsuleCard({ rows = [], locale }) {
  const copy = getMessageGroup(locale, "showcaseWidgets").thisTimeCapsule || {};

  return (
    <WidgetShell title={copy.title} lead={copy.lead}>
      {!rows.length ? (
        <div className="small ui-empty-state ui-empty-state--card">{copy.empty}</div>
      ) : (
        <div className="list-stack">
          {rows.map((row) => (
            <div key={row.id} className="list-card">
              {row.poster ? (
                <img src={row.poster} alt={row.title} loading="lazy" className="list-card__thumb" />
              ) : (
                <div className="list-card__thumb" aria-hidden />
              )}
              <div className="list-card__body">
                <div className="list-card__eyebrow">
                  {row.year}
                  {copy.yearSuffix}
                </div>
                <div className="list-card__title">{row.title}</div>
                <div className="list-card__meta">{row.cue || row.eventType || ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function GenreWordHeatmapCard({ data, locale }) {
  const copy = getMessageGroup(locale, "showcaseWidgets").genreWordHeatmap || {};
  const hasData = Boolean(data?.genres?.length && data?.terms?.length);

  return (
    <WidgetShell title={copy.title} lead={copy.lead} className="showcase-card--wide">
      {!hasData ? (
        <div className="small ui-empty-state ui-empty-state--card">{copy.empty}</div>
      ) : (
        <div className="showcase-heatmap">
          <div className="showcase-heatmap__header">
            <div className="small showcase-meta-label">{copy.axisGenre}</div>
            <div className="showcase-heatmap__terms">
              {data.terms.map((term) => (
                <div key={term} className="showcase-heatmap__term">
                  {term}
                </div>
              ))}
            </div>
          </div>
          <div className="showcase-heatmap__body">
            {data.cells.map((row) => (
              <div key={row.genre} className="showcase-heatmap__row">
                <div className="showcase-heatmap__genre">{row.genre}</div>
                <div className="showcase-heatmap__cells">
                  {row.values.map((cell) => (
                    <div
                      key={`${row.genre}-${cell.term}`}
                      className="showcase-heatmap__cell"
                      style={{ "--heat": `${Math.max(10, Math.round(cell.intensity * 100))}%` }}
                      title={`${row.genre} · ${cell.term} · ${cell.count}`}
                    >
                      <span>{cell.count > 0 ? cell.count : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function ResonanceShelfCard({ rows = [], locale }) {
  const copy = getMessageGroup(locale, "showcaseWidgets").resonanceShelf || {};

  return (
    <WidgetShell title={copy.title} lead={copy.lead} className="showcase-card--wide">
      {!rows.length ? (
        <div className="small ui-empty-state ui-empty-state--card">{copy.empty}</div>
      ) : (
        <div className="showcase-shelf">
          {rows.map((row) => (
            <div key={row.anilistId} className="list-card">
              {row.poster ? (
                <img src={row.poster} alt={row.title} loading="lazy" className="list-card__thumb" />
              ) : (
                <div className="list-card__thumb" aria-hidden />
              )}
              <div className="list-card__body">
                <div className="list-card__title">{row.title}</div>
                <div className="list-card__meta">
                  {copy.logs} {row.count} · score {row.resonanceScore.toFixed(1)}
                </div>
                <div className="list-card__meta">{row.lastCue || ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function PosterPaletteCard({ rows = [], locale }) {
  const copy = getMessageGroup(locale, "showcaseWidgets").posterPalette || {};

  return (
    <WidgetShell title={copy.title} lead={copy.lead}>
      {!rows.length ? (
        <div className="small ui-empty-state ui-empty-state--card">{copy.empty}</div>
      ) : (
        <div className="showcase-palette">
          {rows.map((row) => (
            <div key={row.label} className="showcase-palette__item">
              <div className="showcase-palette__swatch" style={{ background: row.hex }} />
              <div className="showcase-palette__meta">
                <div className="showcase-palette__label">{row.label}</div>
                <div className="small showcase-palette__count">{Math.round(row.ratio * 100)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

const REGISTRY = {
  tasteFingerprint: TasteFingerprintCard,
  thisTimeCapsule: ThisTimeCapsuleCard,
  genreWordHeatmap: GenreWordHeatmapCard,
  resonanceShelf: ResonanceShelfCard,
  posterPalette: PosterPaletteCard,
};

export default function ShowcaseGrid({ model, layout, locale = "ko", compact = false }) {
  const widgets = Array.isArray(layout?.widgets) ? layout.widgets.filter((row) => row.enabled !== false) : [];

  return (
    <div className={`showcase-grid${compact ? " is-compact" : ""}`}>
      {widgets.map((widget) => {
        const Comp = REGISTRY[widget.id];
        if (!Comp) return null;
        const data = model?.[widget.id];
        return (
          <div key={widget.id} className={`showcase-grid__item ${widget.size === "wide" ? "is-wide" : "is-half"}`}>
            <Comp data={data} rows={data} locale={locale} />
          </div>
        );
      })}
    </div>
  );
}
