const candidateLabel = (candidate, copy) => (
  candidate.catalogSource === "SUPABASE_SERVICE_PROJECTION_V2"
    ? copy.catalogCandidate
    : candidate.verificationState === "PROVIDER_CANDIDATE"
    ? copy.providerCandidate
    : copy.legacyCandidate
);

export default function MemoryTitleSelector({
  title,
  runtimeReady,
  titleResults,
  selectedTitleChoice,
  titleSearchStatus,
  remoteTitleStatus,
  onTitleChange,
  onSearch,
  onSelectTitle,
  onClearSelected,
  copy,
}) {
  return (
    <section className="memory-composer__title-search">
      <div className="memory-composer__field">
        <label id="memory-title-heading" htmlFor="memory-title-input">{copy.label}</label>
        <div className="memory-composer__title-input-row">
          <input
            id="memory-title-input"
            className="input"
            value={title}
            maxLength={120}
            onChange={onTitleChange}
            placeholder={copy.placeholder}
          />
          <button
            type="button"
            className="btn btn--subtle"
            disabled={!runtimeReady || title.trim().length < 2 || titleSearchStatus === "searching"}
            onClick={onSearch}
          >
            {titleSearchStatus === "searching" ? copy.searching : copy.search}
          </button>
        </div>
      </div>

      {selectedTitleChoice ? (
        <div className="memory-composer__selected-title">
          <div>
            <span className="status-badge">{candidateLabel(selectedTitleChoice, copy)}</span>
            <strong>{selectedTitleChoice.displayTitle}</strong>
          </div>
          <button type="button" className="btn btn--subtle" onClick={onClearSelected}>
            {copy.clear}
          </button>
        </div>
      ) : title.trim() ? (
        <p className="memory-composer__private-title-note">
          {copy.privateTitle(title.trim())}
        </p>
      ) : null}

      {titleResults.length > 0 && (
        <ul className="memory-composer__title-results" aria-label={copy.resultLabel}>
          {titleResults.map((candidate) => (
            <li key={`${candidate.sourceBinding.provider}:${candidate.sourceBinding.externalId}`}>
              <button
                type="button"
                aria-label={copy.select(candidate.displayTitle)}
                onClick={() => onSelectTitle(candidate)}
              >
                <span>
                  <strong>{candidate.displayTitle}</strong>
                  {candidate.aliases?.[0] && <small>{candidate.aliases[0]}</small>}
                </span>
                <span className="status-badge">{candidateLabel(candidate, copy)}</span>
              </button>
              {candidate.animeId && candidate.catalogSource === "SUPABASE_SERVICE_PROJECTION_V2" && (
                <a className="memory-composer__catalog-detail-link" href={`/catalog/detail/?${new URLSearchParams({ id: candidate.animeId })}`}>
                  {copy.viewDetails}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {!selectedTitleChoice && titleSearchStatus === "ready" && titleResults.length === 0 && (
        <p className="memory-composer__title-status">{copy.noMatch}</p>
      )}
      {["UNAVAILABLE", "TIMED_OUT"].includes(remoteTitleStatus) && (
        <p className="memory-composer__title-status">
          {copy.offline}
        </p>
      )}
    </section>
  );
}
