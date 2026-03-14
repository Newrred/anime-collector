import { GenresRow } from "./LibraryUi.jsx";
import { formatStatusLabel, formatEventLabel } from "./libraryCopy.js";
import { pickByLocale } from "../../domain/uiText";

export default function LibraryDetailModal({
  locale = "ko",
  open,
  selectedId,
  selected,
  selectedMedia,
  selectedTitle,
  selectedRelatedSeries,
  libraryIdSet,
  items,
  mediaMap,
  itemKoTitleMap,
  relatedKoTitleById,
  aliasKoTitleMap,
  selectedScore,
  selectedScoreLabel,
  selectedStarsFill,
  selectedLogs,
  logsLoading,
  selectedCharacters,
  memoDraft,
  rewatchCountDraft,
  lastRewatchAtDraft,
  pinnedCharacterKeySet,
  onClose,
  onRemoveAnime,
  onOpenAnime,
  onAddRelatedSeries,
  onStatusChange,
  onUpdateSelected,
  onHoverScoreChange,
  getHoverScoreFromPointer,
  setMemoDraft,
  setRewatchCountDraft,
  setLastRewatchAtDraft,
  onCommitModalDraft,
  onAppendSelectedWatchLog,
  onOpenQuickLogSheet,
  onDeleteSelectedWatchLog,
  onToggleCharacterPin,
  safeGenres,
  formatGenreLabel,
  isAnimeMediaFormat,
  pickCardTitle,
  formatLocalDate,
  formatWatchLogDate,
  normalizeRewatchCount,
  onPickGenreFromTag,
  scoreMax,
  scoreStep,
  eventRewatch,
  statusCompleted,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      close: "닫기",
      openAniList: "AniList 열기",
      delete: "삭제",
      episodes: "화",
      relatedSeries: "관련 시리즈",
      relatedEmpty: "관련 시리즈 정보가 없거나 불러오는 중입니다.",
      openDetail: "상세 열기",
      addAndOpen: "추가 후 열기",
      status: "상태",
      score: "점수",
      starRating: "별점",
      reset: "초기화",
      rewatch: "재주행",
      rewatchPlus: "재주행 +1",
      rewatchCount: "재주행 횟수",
      lastRewatch: "마지막 재주행",
      memo: "자세한 메모",
      memoPlaceholder: "보고 난 뒤 한줄 메모",
      watchLogs: "감상 기록",
      loading: "불러오는 중...",
      emptyLogs: "아직 로그가 없습니다. 추가 시 선택한 초기 상태와 상태 변경, 재주행 완료 시 자동 기록됩니다.",
      logEdit: "기록 편집",
      logDelete: "기록 삭제",
      noCue: "한줄 감상 없음",
      watchedAt: "시점:",
      logDefault: "기록",
      characters: "캐릭터",
      noCharacters: "캐릭터 정보를 아직 가져오지 못했습니다.",
      unpin: "핀 해제",
      pin: "핀",
    },
    en: {
      close: "Close",
      openAniList: "Open AniList",
      delete: "Delete",
      episodes: "eps",
      relatedSeries: "Related series",
      relatedEmpty: "No related series data yet, or it is still loading.",
      openDetail: "Open detail",
      addAndOpen: "Add and open",
      status: "Status",
      score: "Score",
      starRating: "Star rating",
      reset: "Reset",
      rewatch: "Rewatch",
      rewatchPlus: "Rewatch +1",
      rewatchCount: "Rewatch count",
      lastRewatch: "Last rewatch",
      memo: "Detailed memo",
      memoPlaceholder: "A short note after watching",
      watchLogs: "Watch logs",
      loading: "Loading...",
      emptyLogs: "No logs yet. Initial status, status changes, and rewatch completion are logged automatically.",
      logEdit: "Edit log",
      logDelete: "Delete log",
      noCue: "No one-line note",
      watchedAt: "When:",
      logDefault: "Log",
      characters: "Characters",
      noCharacters: "Character data is not loaded yet.",
      unpin: "Unpin",
      pin: "Pin",
    },
  });
  if (!open || !selected) return null;

  return (
    <div
      className="modalBack"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modalCloseBtn" onClick={onClose} aria-label={copy.close}>
          ×
        </button>
        <div className="modalBody">
          <div className="modalCover">
            <img
              src={selectedMedia?.coverImage?.extraLarge || selectedMedia?.coverImage?.large || selectedMedia?.coverImage?.medium || ""}
              alt={selectedTitle}
            />
            <div className="library-modal-cover-actions">
              {selectedMedia?.siteUrl && (
                <a className="btn" href={selectedMedia.siteUrl} target="_blank" rel="noreferrer">
                  {copy.openAniList}
                </a>
              )}
              <button className="removeBtn" onClick={() => onRemoveAnime(selectedId)}>
                {copy.delete}
              </button>
            </div>
          </div>

          <div className="modalMain">
            <h2 className="modalTitle">{selectedTitle}</h2>
            <div className="small modalMeta">
              {selectedMedia?.seasonYear ? `${selectedMedia.seasonYear} · ` : ""}
              {selectedMedia?.format || ""}
              {selectedMedia?.episodes ? ` · ${selectedMedia.episodes}${copy.episodes}` : ""}
            </div>

            <GenresRow
              genres={safeGenres(selectedMedia)}
              max={999}
              compact={false}
              formatGenreLabel={formatGenreLabel}
              onPickGenre={onPickGenreFromTag}
            />

            <div className="row">
              <div className="small">{copy.relatedSeries}</div>
              <div className="library-modal-section-stack">
                {selectedRelatedSeries.length === 0 ? (
                  <div className="small library-modal-note">
                    {copy.relatedEmpty}
                  </div>
                ) : (
                  selectedRelatedSeries.map((row) => {
                    const inLibrary = libraryIdSet.has(row.id);
                    const canAddToLibrary = isAnimeMediaFormat(row.format);
                    const libraryItem = inLibrary
                      ? items.find((item) => Number(item?.anilistId) === row.id) || null
                      : null;
                    const cachedMedia = mediaMap.get(row.id) || null;
                    const mappedKoTitle = String(
                      itemKoTitleMap.get(row.id) || aliasKoTitleMap.get(row.id) || relatedKoTitleById[row.id] || ""
                    ).trim();
                    const fallbackTitle = pickCardTitle(libraryItem, cachedMedia || row.media || null);
                    const displayTitle = locale === "ko"
                      ? (mappedKoTitle || fallbackTitle)
                      : (fallbackTitle || mappedKoTitle);
                    return (
                      <div key={`${row.id}:${row.relationType}`} className="library-modal-related-card">
                        <div className="library-modal-related-row">
                          {row.cover ? (
                            <img src={row.cover} alt={displayTitle} className="library-modal-related-thumb" />
                          ) : (
                            <div aria-hidden className="library-modal-related-thumb library-modal-related-thumb--empty" />
                          )}
                          <div className="library-modal-related-main">
                            <div className="library-modal-related-title">{displayTitle}</div>
                            <div className="small library-modal-related-meta">
                              {row.relationLabel}
                              {row.seasonYear ? ` · ${row.seasonYear}` : ""}
                              {row.format ? ` · ${row.format}` : ""}
                              {row.episodes ? ` · ${row.episodes}${copy.episodes}` : ""}
                            </div>
                          </div>
                          <div className="library-modal-related-actions">
                            {inLibrary ? (
                              <button type="button" className="btn" onClick={() => onOpenAnime(row.id)}>
                                {copy.openDetail}
                              </button>
                            ) : canAddToLibrary ? (
                              <button
                                type="button"
                                className="btn library-modal-icon-btn"
                                onClick={() => onAddRelatedSeries(row)}
                                aria-label={`${displayTitle} ${copy.addAndOpen}`}
                                title={copy.addAndOpen}
                              >
                                +
                              </button>
                            ) : null}
                            {row.siteUrl && (
                              <a className="btn" href={row.siteUrl} target="_blank" rel="noreferrer">
                                AniList
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="row">
              <div className="small">{copy.status}</div>
              <select
                className="select"
                value={selected.status || "미분류"}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                <option value="완료">{formatStatusLabel("완료", locale)}</option>
                <option value="보는중">{formatStatusLabel("보는중", locale)}</option>
                <option value="보류">{formatStatusLabel("보류", locale)}</option>
                <option value="하차">{formatStatusLabel("하차", locale)}</option>
                <option value="미분류">{formatStatusLabel("미분류", locale)}</option>
              </select>
            </div>

            <div className="row">
              <div className="small">{copy.score}</div>
              <div>
                <div className="library-modal-score-row">
                  <div className="library-modal-score-stars">
                    <div aria-hidden className="library-modal-score-base">
                      ★★★★★
                    </div>
                    <div aria-hidden className="library-modal-score-fill" style={{ width: selectedStarsFill }}>
                      ★★★★★
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={scoreMax}
                      step={scoreStep}
                      value={selectedScore}
                      onChange={(event) => onUpdateSelected({ score: Number(event.target.value) })}
                      onMouseMove={(event) => onHoverScoreChange(getHoverScoreFromPointer(event))}
                      onMouseLeave={() => onHoverScoreChange(null)}
                      aria-label={copy.starRating}
                      className="library-modal-score-input"
                    />
                  </div>
                  <div className="small library-modal-score-label">{selectedScoreLabel}</div>
                  <button
                    type="button"
                    className="btn library-modal-score-reset"
                    onClick={() => {
                      onHoverScoreChange(null);
                      onUpdateSelected({ score: null });
                    }}
                  >
                    {copy.reset}
                  </button>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="small">{copy.rewatch}</div>
              <div className="library-modal-section-stack">
                <div className="library-modal-inline-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const nextCount = normalizeRewatchCount(rewatchCountDraft + 1);
                      const today = formatLocalDate(new Date());
                      setRewatchCountDraft(nextCount);
                      setLastRewatchAtDraft(today);
                      onUpdateSelected({ rewatchCount: nextCount, lastRewatchAt: today });
                      onAppendSelectedWatchLog(
                        eventRewatch,
                        { cue: locale === "en" ? `Rewatch completed (${nextCount})` : `재주행 완료 (${nextCount}회차)` },
                        {
                          openQuickSheet: true,
                          quickContext: { source: "rewatch-plus", isAuto: true, status: statusCompleted },
                        }
                      );
                    }}
                  >
                    {copy.rewatchPlus}
                  </button>
                  <input
                    className="input library-modal-count-input"
                    type="number"
                    min={0}
                    step={1}
                    value={rewatchCountDraft}
                    onChange={(event) => setRewatchCountDraft(normalizeRewatchCount(event.target.value))}
                    onBlur={onCommitModalDraft}
                    aria-label={copy.rewatchCount}
                  />

                  <input
                    className="input library-modal-date-input"
                    type="date"
                    value={lastRewatchAtDraft}
                    onChange={(event) => setLastRewatchAtDraft(event.target.value)}
                    onBlur={onCommitModalDraft}
                    aria-label={copy.lastRewatch}
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="small">{copy.memo}</div>
              <textarea
                className="textarea"
                value={memoDraft}
                onChange={(event) => setMemoDraft(event.target.value)}
                onBlur={onCommitModalDraft}
                placeholder={copy.memoPlaceholder}
              />
            </div>

            <div className="row">
              <div className="small">{copy.watchLogs}</div>
              <div className="library-modal-section-stack">
                {logsLoading ? (
                  <div className="small library-modal-note">{copy.loading}</div>
                ) : selectedLogs.length === 0 ? (
                  <div className="small library-modal-note">
                    {copy.emptyLogs}
                  </div>
                ) : (
                  <div className="library-modal-log-list">
                    {selectedLogs.slice(0, 20).map((log) => (
                      <div key={log.id} className="library-modal-log-card">
                        <div className="library-modal-log-top">
                          <div className="small library-modal-log-meta">
                            {formatWatchLogDate(log)} · {formatEventLabel(log.eventType || copy.logDefault, locale)}
                          </div>
                          <div className="library-modal-log-actions">
                            <button
                              type="button"
                              className="btn library-modal-small-btn"
                              onClick={() => onOpenQuickLogSheet(log, selectedMedia || null, { source: "manual-edit", isAuto: false })}
                            >
                              {copy.logEdit}
                            </button>
                            <button
                              type="button"
                              className="btn library-modal-small-btn"
                              onClick={() => onDeleteSelectedWatchLog(log.id)}
                            >
                              {copy.logDelete}
                            </button>
                          </div>
                        </div>
                        <div className="library-modal-log-cue">{log.cue || copy.noCue}</div>
                        {String(log.note || "").trim() && (
                          <div className="small library-modal-log-note">{log.note}</div>
                        )}
                        <div className="small library-modal-log-submeta">{copy.watchedAt} {formatWatchLogDate(log)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="library-modal-characters-block">
              <div className="small library-modal-characters-label">{copy.characters}</div>
              {selectedCharacters.length === 0 ? (
                <div className="small library-modal-note">{copy.noCharacters}</div>
              ) : (
                <div className="library-modal-characters">
                  {selectedCharacters.map((character) => {
                    const pinKey = `${character.id}:${selectedId}`;
                    const isPinned = pinnedCharacterKeySet.has(pinKey);
                    return (
                      <div key={character.id} className="library-modal-character-card">
                        {character.image ? (
                          <img src={character.image} alt={character.name} loading="lazy" className="library-modal-character-thumb" />
                        ) : (
                          <div aria-hidden className="library-modal-character-thumb library-modal-character-thumb--empty" />
                        )}
                        <div className="library-modal-character-main">
                          <div className="library-modal-character-name" title={character.name}>
                            {character.name}
                          </div>
                          {character.subName && (
                            <div className="small library-modal-character-subname" title={character.subName}>
                              {character.subName}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className={`btn library-modal-pin-btn${isPinned ? " is-active" : ""}`}
                          onClick={() => onToggleCharacterPin(character)}
                          title={isPinned ? copy.unpin : copy.pin}
                        >
                          {isPinned ? "★" : "☆"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
