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

function TitlePresence({ row, copy }) {
  return <span className="quick-action-row__meta">{row.isSaved ? copy.saved : copy.notSaved} · {row.memoryCount == null ? copy.memoryCountUnavailable : copy.memoryCount(row.memoryCount)}</span>;
}

function TitleResultButton({ row, copy, subtitle, onOpenTitle }) {
  return (
    <button type="button" className="quick-action-row__main" onClick={() => onOpenTitle(row)}>
      {row.poster ? (
        <img src={row.poster} alt={row.title} className="quick-action-row__poster" loading="lazy" />
      ) : (
        <div className="quick-action-row__poster" aria-hidden />
      )}
      <span className="quick-action-row__copy">
        <span className="quick-action-row__title">{row.title}</span>
        <span className="quick-action-row__meta">{subtitle}</span>
        <TitlePresence row={row} copy={copy} />
      </span>
    </button>
  );
}

function LocalTitleActions({ row, copy, onCreateMemory, onOpenQuickLog, onOpenTitle }) {
  return (
    <div className="quick-action-row__actions">
      {row.kind !== "memory" || row.catalogAnimeId ? (
        <button type="button" className="btn btn--subtle btn--sm quick-action-row__create-action" onClick={() => onCreateMemory(row)}>
          {copy.createMemory}
        </button>
      ) : null}
      {row.isSaved && Number.isSafeInteger(row.id) ? (
        <button type="button" className="btn btn--subtle btn--sm" onClick={() => onOpenQuickLog(row.id)}>{copy.quickLog}</button>
      ) : (
        <button type="button" className="btn btn--subtle btn--sm" onClick={() => onOpenTitle(row)}>{copy.openLibrary}</button>
      )}
    </div>
  );
}

function SearchActionFeedback({ actionFeedback, copy, onOpenDetail }) {
  if (!actionFeedback) return null;
  return (
    <div
      className={`small page-feedback quick-action-panel__feedback is-${actionFeedback.tone || "success"}`}
    >
      <span role={actionFeedback.tone === "error" ? "alert" : "status"}>
        {actionFeedback.message}
      </span>
      {actionFeedback.tone === "success" && Boolean(actionFeedback.animeId) ? (
        <button
          type="button"
          className="btn btn--subtle btn--sm"
          onClick={() => onOpenDetail(actionFeedback.animeId)}
        >
          {copy.openLibrary}
        </button>
      ) : null}
    </div>
  );
}

function RecentSearches({ recentRows, recentQueries, locale, copy, onOpenTitle, onOpenQuickLog, onPickRecentQuery }) {
  return (
    <>
      <Section title={copy.recentLibraryTitle}>
        <div className="quick-action-row-list">
          {recentRows.length ? (
            recentRows.map((row) => (
              <div key={`recent-${row.id}`} className="quick-action-row">
                <TitleResultButton row={row} copy={copy} subtitle={row.subtitle || formatStatusLabel(row.item?.status, locale)} onOpenTitle={onOpenTitle} />
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
  );
}

function RemoteTitleResult({ row, copy, onOpenTitle, onCreateMemory, onAddRemote, addingAnimeId }) {
  return (
    <div className="quick-action-row quick-action-row--choice">
      <TitleResultButton row={row} copy={copy} subtitle={row.subtitle} onOpenTitle={onOpenTitle} />
      <div className="quick-action-row__actions quick-action-row__actions--choice" role="group" aria-label={copy.actionChoice}>
        <div className="quick-action-row__action-option is-primary">
          <button type="button" className="btn btn--sm quick-action-row__create-action" onClick={() => onCreateMemory(row)}>
            {copy.createMemory}
          </button>
          <small>{copy.createMemoryEffect}</small>
        </div>
        <div className="quick-action-row__action-option">
          <button
            type="button"
            className="btn btn--subtle btn--sm quick-action-row__library-action"
            onClick={() => onAddRemote(row)}
            disabled={addingAnimeId !== null}
          >
            {addingAnimeId === row.id ? copy.addingToLibrary : copy.addToLibrary}
          </button>
          <small>{copy.addToLibraryEffect}</small>
        </div>
      </div>
    </div>
  );
}

function LocalTitleResults({ localRows, copy, locale, shortQuery, onOpenTitle, onCreateMemory, onOpenQuickLog }) {
  return (
    <Section title={copy.libraryTitle}>
      <div className="quick-action-row-list">
        {localRows.length ? (
          localRows.map((row) => (
            <div key={`local-${row.id}`} className="quick-action-row">
              <TitleResultButton row={row} copy={copy} subtitle={row.subtitle || formatStatusLabel(row.item?.status, locale)} onOpenTitle={onOpenTitle} />
              <LocalTitleActions row={row} copy={copy} onCreateMemory={onCreateMemory} onOpenQuickLog={onOpenQuickLog} onOpenTitle={onOpenTitle} />
            </div>
          ))
        ) : shortQuery ? (
          <div className="small page-feedback">{copy.hintShort}</div>
        ) : null}
      </div>
    </Section>
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
  actionFeedback = null,
  addingAnimeId = null,
  quickAddStatus = "미분류",
  onQuickAddStatusChange,
  onPickRecentQuery,
  onOpenDetail,
  onOpenTitle,
  onOpenQuickLog,
  onCreateMemory,
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
      <SearchActionFeedback actionFeedback={actionFeedback} copy={copy} onOpenDetail={onOpenDetail} />
      {showRecents ? <RecentSearches recentRows={recentRows} recentQueries={recentQueries} locale={locale} copy={copy} onOpenTitle={onOpenTitle} onOpenQuickLog={onOpenQuickLog} onPickRecentQuery={onPickRecentQuery} /> : null}

      {showLocal ? <LocalTitleResults localRows={localRows} copy={copy} locale={locale} shortQuery={shortQuery} onOpenTitle={onOpenTitle} onCreateMemory={onCreateMemory} onOpenQuickLog={onOpenQuickLog} /> : null}

      {showRemote ? (
        <Section title={copy.remoteTitle}>
          <div className="quick-action-row-list">
            {loading ? <div className="small page-feedback">{copy.loading}</div> : null}
            {!loading && remoteRows.length ? (
              remoteRows.map((row) => (
                <RemoteTitleResult key={`remote-${row.id}`} row={row} copy={copy} onOpenTitle={onOpenTitle} onCreateMemory={onCreateMemory} onAddRemote={onAddRemote} addingAnimeId={addingAnimeId} />
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
