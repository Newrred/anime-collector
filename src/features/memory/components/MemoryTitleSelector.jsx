const candidateLabel = (candidate) => (
  candidate.verificationState === "PROVIDER_CANDIDATE"
    ? "AniList candidate"
    : "Legacy data · unverified"
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
}) {
  return (
    <section className="memory-composer__title-search">
      <div className="memory-composer__field">
        <label id="memory-title-heading" htmlFor="memory-title-input">작품 또는 카드 제목</label>
        <div className="memory-composer__title-input-row">
          <input
            id="memory-title-input"
            className="input"
            value={title}
            maxLength={120}
            onChange={onTitleChange}
            placeholder="예: 프리렌"
          />
          <button
            type="button"
            className="btn btn--subtle"
            disabled={!runtimeReady || title.trim().length < 2 || titleSearchStatus === "searching"}
            onClick={onSearch}
          >
            {titleSearchStatus === "searching" ? "검색 중…" : "작품 검색"}
          </button>
        </div>
      </div>

      {selectedTitleChoice ? (
        <div className="memory-composer__selected-title">
          <div>
            <span className="status-badge">{candidateLabel(selectedTitleChoice)}</span>
            <strong>{selectedTitleChoice.displayTitle}</strong>
          </div>
          <button type="button" className="btn btn--subtle" onClick={onClearSelected}>
            선택 해제
          </button>
        </div>
      ) : title.trim() ? (
        <p className="memory-composer__private-title-note">
          검색 결과를 선택하지 않으면 “{title.trim()}”을 개인 제목으로 저장합니다.
        </p>
      ) : null}

      {titleResults.length > 0 && (
        <ul className="memory-composer__title-results" aria-label="작품 검색 결과">
          {titleResults.map((candidate) => (
            <li key={`${candidate.sourceBinding.provider}:${candidate.sourceBinding.externalId}`}>
              <button
                type="button"
                aria-label={`${candidate.displayTitle} 선택`}
                onClick={() => onSelectTitle(candidate)}
              >
                <span>
                  <strong>{candidate.displayTitle}</strong>
                  {candidate.aliases?.[0] && <small>{candidate.aliases[0]}</small>}
                </span>
                <span className="status-badge">{candidateLabel(candidate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {titleSearchStatus === "ready" && titleResults.length === 0 && (
        <p className="memory-composer__title-status">일치하는 작품이 없어도 개인 제목으로 계속할 수 있어요.</p>
      )}
      {["UNAVAILABLE", "TIMED_OUT"].includes(remoteTitleStatus) && (
        <p className="memory-composer__title-status">
          온라인 검색을 사용할 수 없어요. 로컬 결과 또는 입력한 개인 제목으로 계속할 수 있어요.
        </p>
      )}
    </section>
  );
}
