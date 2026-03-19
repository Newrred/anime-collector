import { getMessageGroup } from "../../domain/messages.js";
import { formatStatusLabel } from "../library/libraryCopy.js";

function Section({ title, children }) {
  return (
    <section className="quick-action-section">
      <div className="quick-action-section__title">{title}</div>
      {children}
    </section>
  );
}

export default function QuickActionPanel({
  locale = "ko",
  query = "",
  localRows = [],
  remoteRows = [],
  recentRows = [],
  recentQueries = [],
  loading = false,
  quickAddStatus = "미분류",
  onQuickAddStatusChange,
  onPickRecentQuery,
  onOpenDetail,
  onOpenQuickLog,
  onAddRemote,
}) {
  const copy = getMessageGroup(locale, "globalQuickAction");
  const trimmed = String(query || "").trim();
  const showRemote = trimmed.length >= 2;
  const showLocal = trimmed.length >= 1;
  const showRecents = trimmed.length === 0;
  const shortQuery = trimmed.length === 1;
  const hasResults = localRows.length > 0 || remoteRows.length > 0;

  return (
    <div className="quick-action-panel">
      {showRecents ? (
        <>
          <Section title={copy.recentLibraryTitle}>
            <div className="quick-action-row-list">
              {recentRows.length ? (
                recentRows.map((row) => (
                  <div key={`recent-${row.id}`} className="quick-action-row">
                    <button type="button" className="quick-action-row__main" onClick={() => onOpenDetail(row.id)}>
                      {row.poster ? (
                        <img src={row.poster} alt={row.title} className="quick-action-row__poster" loading="lazy" />
                      ) : (
                        <div className="quick-action-row__poster" aria-hidden />
                      )}
                      <span className="quick-action-row__copy">
                        <span className="quick-action-row__title">{row.title}</span>
                        <span className="quick-action-row__meta">{row.subtitle || formatStatusLabel(row.item?.status, locale)}</span>
                      </span>
                    </button>
                    <div className="quick-action-row__actions">
                      <button type="button" className="btn btn--subtle btn--sm" onClick={() => onOpenQuickLog(row.id)}>
                        {copy.quickLog}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="small page-feedback">{copy.noRecentLibrary}</div>
              )}
            </div>
          </Section>

          <Section title={copy.recentQueries}>
            <div className="quick-action-chip-row">
              {recentQueries.length ? (
                recentQueries.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="quick-action-chip"
                    onClick={() => onPickRecentQuery(value)}
                  >
                    {value}
                  </button>
                ))
              ) : (
                <div className="small page-feedback">{copy.hintEmpty}</div>
              )}
            </div>
          </Section>
        </>
      ) : null}

      {showLocal ? (
        <Section title={copy.libraryTitle}>
          <div className="quick-action-row-list">
            {localRows.length ? (
              localRows.map((row) => (
                <div key={`local-${row.id}`} className="quick-action-row">
                  <button type="button" className="quick-action-row__main" onClick={() => onOpenDetail(row.id)}>
                    {row.poster ? (
                      <img src={row.poster} alt={row.title} className="quick-action-row__poster" loading="lazy" />
                    ) : (
                      <div className="quick-action-row__poster" aria-hidden />
                    )}
                    <span className="quick-action-row__copy">
                      <span className="quick-action-row__title">{row.title}</span>
                      <span className="quick-action-row__meta">{row.subtitle || formatStatusLabel(row.item?.status, locale)}</span>
                    </span>
                  </button>
                  <div className="quick-action-row__actions">
                    <button type="button" className="btn btn--subtle btn--sm" onClick={() => onOpenQuickLog(row.id)}>
                      {copy.quickLog}
                    </button>
                  </div>
                </div>
              ))
            ) : shortQuery ? (
              <div className="small page-feedback">{copy.hintShort}</div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {showRemote ? (
        <Section title={copy.remoteTitle}>
          <div className="quick-action-row-list">
            {loading ? <div className="small page-feedback">{copy.loading}</div> : null}
            {!loading && remoteRows.length ? (
              remoteRows.map((row) => (
                <div key={`remote-${row.id}`} className="quick-action-row">
                  <button type="button" className="quick-action-row__main" onClick={() => onAddRemote(row)}>
                    {row.poster ? (
                      <img src={row.poster} alt={row.title} className="quick-action-row__poster" loading="lazy" />
                    ) : (
                      <div className="quick-action-row__poster" aria-hidden />
                    )}
                    <span className="quick-action-row__copy">
                      <span className="quick-action-row__title">{row.title}</span>
                      <span className="quick-action-row__meta">{row.subtitle}</span>
                    </span>
                  </button>
                  <div className="quick-action-row__actions">
                    <button type="button" className="btn btn--subtle btn--sm" onClick={() => onAddRemote(row)}>
                      {copy.add}
                    </button>
                  </div>
                </div>
              ))
            ) : null}
            {!loading && !hasResults && trimmed.length >= 2 ? (
              <div className="small page-feedback">{copy.noResult}</div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <div className="quick-action-panel__footer">
        <label className="small quick-action-default-status">
          <span>{copy.defaultStatus}</span>
          <select
            className="select quick-action-default-status__select"
            value={quickAddStatus}
            onChange={(event) => onQuickAddStatusChange?.(event.target.value)}
            aria-label={copy.defaultStatus}
          >
            {copy.statusOptions?.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
