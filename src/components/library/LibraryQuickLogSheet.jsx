import { Chip } from "./LibraryUi.jsx";
import { formatEventLabel, formatSeasonTermLabel } from "./libraryCopy.js";
import { pickByLocale } from "../../domain/uiText";
import { IconX } from "../ui/AppIcons.jsx";

export default function LibraryQuickLogSheet({
  locale = "ko",
  open,
  draft,
  title,
  context,
  candidates,
  characterIds,
  primaryCharacterId,
  selectedCharacters,
  characterMeta,
  onClose,
  onSave,
  onDraftChange,
  onPrecisionChange,
  onToggleCharacter,
  onSetPrimaryCharacter,
  onSetAffinity,
  onToggleReasonTag,
  onSetCharacterNote,
  helpers,
  constants,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      title: "빠른 기록",
      close: "닫기",
      autoHint: "자동 생성된 기록입니다. 지금 내용을 보완하지 않아도 기본값으로 저장됩니다.",
      completedHint: "완료 상태로 추가한 기록이라 시청 시점과 한 줄 기억을 가능한 범위에서 함께 남기는 것을 권장합니다.",
      droppedHint: "하차 상태 기록은 이유 태그와 메모를 같이 남기면 나중에 복기할 때 도움이 됩니다.",
      watchedWhen: "언제 봤는지",
      precision: { day: "날짜", month: "월", season: "시즌", year: "연도", unknown: "잘 모름" },
      day: "본 날짜",
      month: "본 달",
      season: "본 시즌",
      year: "본 연도",
      unknown: "언제 봤는지",
      unknownHint: "정확한 날짜가 기억나지 않으면 이 항목을 선택하세요. 정렬은 기록한 시점을 기준으로 맞춰집니다.",
      cue: "한줄 감상",
      cuePlaceholder: "예: 캐릭터 연출이 인상적이었음",
      note: "자세한 메모",
      notePlaceholder: "선택 입력",
      characters: "기억에 남은 캐릭터 (최대 3)",
      noCharacters: "캐릭터 후보를 아직 불러오지 못했습니다.",
      primaryTitle: "대표캐 지정",
      primary: "대표캐",
      makePrimary: "대표캐로",
      onlyOnePrimary: "대표캐는 한 명만 고를 수 있어요.",
      perCharacter: "캐릭터별 기록",
      affinity: "감정 태그",
      reasonTags: "꽂힌 포인트 (최대 3)",
      characterMemo: "캐릭터 한줄 (선택)",
      keepDefaults: "기본값 유지",
      save: "저장",
      seasonYear: "빠른 기록 시즌 연도",
      seasonAria: "빠른 기록 시즌",
      dateAria: "빠른 기록 날짜",
      monthAria: "빠른 기록 월",
      yearAria: "빠른 기록 연도",
      cueAria: "한줄 감상",
      characterMemoSuffix: "메모",
    },
    en: {
      title: "Quick log",
      close: "Close",
      autoHint: "This log was auto-created. You can save it as-is without filling everything in.",
      completedHint: "Since this was added as completed, it helps to leave when you watched it and a short memory if you can.",
      droppedHint: "For dropped logs, leaving a reason tag and note helps when you revisit it later.",
      watchedWhen: "When did you watch it?",
      precision: { day: "Date", month: "Month", season: "Season", year: "Year", unknown: "Not sure" },
      day: "Watch date",
      month: "Watch month",
      season: "Watch season",
      year: "Watch year",
      unknown: "When watched",
      unknownHint: "Choose this if you do not remember the exact date. Sorting will use the recorded log time.",
      cue: "One-line note",
      cuePlaceholder: "e.g. Character direction stood out",
      note: "Detailed note",
      notePlaceholder: "Optional",
      characters: "Memorable characters (up to 3)",
      noCharacters: "Character candidates are not loaded yet.",
      primaryTitle: "Set primary character",
      primary: "Primary",
      makePrimary: "Make primary",
      onlyOnePrimary: "Only one primary character can be selected.",
      perCharacter: "Per-character notes",
      affinity: "Affinity",
      reasonTags: "Hook points (up to 3)",
      characterMemo: "Character note (optional)",
      keepDefaults: "Keep defaults",
      save: "Save",
      seasonYear: "Quick log season year",
      seasonAria: "Quick log season",
      dateAria: "Quick log date",
      monthAria: "Quick log month",
      yearAria: "Quick log year",
      cueAria: "One-line note",
      characterMemoSuffix: "memo",
    },
  });
  if (!open || !draft) return null;

  const {
    coerceQuickLogValue,
    parseSeasonValue,
    defaultQuickLogValue,
    affinityLabel,
    reasonTagLabel,
  } = helpers;
  const { seasonTermOptions, affinityOptions, reasonTagOptions } = constants;

  return (
    <div onClick={onClose} className="log-sheet-backdrop">
      <div onClick={(event) => event.stopPropagation()} className="log-sheet">
        <div className="log-sheet__header">
          <div className="log-sheet__header-row">
            <div>
              <div className="log-sheet__title">{copy.title}</div>
              <div className="small log-sheet__subtitle">
                {title || `#${draft.anilistId}`} · {formatEventLabel(draft.eventType, locale)}
              </div>
            </div>
            <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label={copy.close} title={copy.close}>
              <IconX size={14} />
            </button>
          </div>
        </div>

        <div className="log-sheet__body">
          {context?.isAuto && (
            <div className="small log-sheet__hint">
              {copy.autoHint}
            </div>
          )}
          {context?.source === "add-completed" && (
            <div className="small log-sheet__helper-text">
              {copy.completedHint}
            </div>
          )}
          {context?.source === "add-dropped" && (
            <div className="small log-sheet__helper-text">
              {copy.droppedHint}
            </div>
          )}

          <div className="row">
            <div className="small">{copy.watchedWhen}</div>
            <div className="log-sheet__chip-wrap">
              {[
                { key: "day", label: copy.precision.day },
                { key: "month", label: copy.precision.month },
                { key: "season", label: copy.precision.season },
                { key: "year", label: copy.precision.year },
                { key: "unknown", label: copy.precision.unknown },
              ].map((option) => (
                <Chip
                  key={option.key}
                  active={draft.watchedAtPrecision === option.key}
                  onClick={() => onPrecisionChange(option.key)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="row">
            <div className="small">
              {draft.watchedAtPrecision === "day"
                ? copy.day
                : draft.watchedAtPrecision === "month"
                  ? copy.month
                  : draft.watchedAtPrecision === "season"
                    ? copy.season
                    : draft.watchedAtPrecision === "year"
                      ? copy.year
                      : copy.unknown}
            </div>
            {draft.watchedAtPrecision === "day" && (
              <input
                className="input"
                type="date"
                value={coerceQuickLogValue("day", draft.watchedAtValue)}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, watchedAtValue: event.target.value }))
                }
                aria-label={copy.dateAria}
              />
            )}
            {draft.watchedAtPrecision === "month" && (
              <input
                className="input"
                type="month"
                value={coerceQuickLogValue("month", draft.watchedAtValue)}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, watchedAtValue: event.target.value }))
                }
                aria-label={copy.monthAria}
              />
            )}
            {draft.watchedAtPrecision === "season" && (
              <div className="log-sheet__season-grid">
                <input
                  className="input"
                  type="number"
                  min={1950}
                  max={2099}
                  value={(parseSeasonValue(draft.watchedAtValue)?.year || "").slice(0, 4)}
                  onChange={(event) => {
                    const year = String(event.target.value || "").replace(/[^\d]/g, "").slice(0, 4);
                    const term = parseSeasonValue(draft.watchedAtValue)?.term || "Spring";
                    onDraftChange((prev) => ({
                      ...prev,
                      watchedAtValue: year ? `${year}-${term}` : "",
                    }));
                  }}
                  placeholder="YYYY"
                  aria-label={copy.seasonYear}
                />
                <select
                  className="select"
                  value={parseSeasonValue(draft.watchedAtValue)?.term || "Spring"}
                  onChange={(event) => {
                    const term = seasonTermOptions.includes(event.target.value) ? event.target.value : "Spring";
                    const year = parseSeasonValue(draft.watchedAtValue)?.year || defaultQuickLogValue("year");
                    onDraftChange((prev) => ({
                      ...prev,
                      watchedAtValue: `${year}-${term}`,
                    }));
                  }}
                  aria-label={copy.seasonAria}
                >
                  {seasonTermOptions.map((term) => (
                    <option key={term} value={term}>
                      {formatSeasonTermLabel(term, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {draft.watchedAtPrecision === "year" && (
              <input
                className="input"
                type="number"
                min={1950}
                max={2099}
                value={coerceQuickLogValue("year", draft.watchedAtValue)}
                onChange={(event) =>
                  onDraftChange((prev) => ({
                    ...prev,
                    watchedAtValue: String(event.target.value || "").replace(/[^\d]/g, "").slice(0, 4),
                  }))
                }
                placeholder="YYYY"
                aria-label={copy.yearAria}
              />
            )}
            {draft.watchedAtPrecision === "unknown" && (
              <div className="small log-sheet__helper-text">
                {copy.unknownHint}
              </div>
            )}
          </div>

          <div className="row">
            <div className="small">{copy.cue}</div>
            <input
              className="input"
              value={draft.cue}
              maxLength={120}
              onChange={(event) =>
                onDraftChange((prev) => ({ ...prev, cue: event.target.value }))
              }
              placeholder={copy.cuePlaceholder}
              aria-label={copy.cueAria}
            />
          </div>

          <div className="row">
            <div className="small">{copy.note}</div>
            <textarea
              className="textarea"
              value={draft.note}
              onChange={(event) =>
                onDraftChange((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder={copy.notePlaceholder}
            />
          </div>

          <div className="row">
            <div className="small">{copy.characters}</div>
            {candidates.length === 0 ? (
              <div className="small log-sheet__helper-text">{copy.noCharacters}</div>
            ) : (
              <div className="log-sheet__character-picker">
                {candidates.map((character) => {
                  const active = characterIds.includes(character.id);
                  const isPrimary = Number(character.id) === Number(primaryCharacterId);
                  return (
                    <div key={character.id} className="log-sheet__character-option">
                      <button
                        type="button"
                        onClick={() => onToggleCharacter(character.id)}
                        className={`log-sheet__character-toggle${active ? " is-active" : ""}`}
                        title={character.name}
                      >
                        {isPrimary ? "★ " : ""}
                        {character.name}
                      </button>
                      {active && (
                        <button
                          type="button"
                          className={`btn log-sheet__character-primary${isPrimary ? " is-active" : ""}`}
                          onClick={() => onSetPrimaryCharacter(character.id)}
                          title={copy.primaryTitle}
                        >
                          {isPrimary ? copy.primary : copy.makePrimary}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="small log-sheet__helper-text">{copy.onlyOnePrimary}</div>
          </div>

          {selectedCharacters.length > 0 && (
            <div className="row">
              <div className="small">{copy.perCharacter}</div>
              <div className="log-sheet__character-meta-list">
                {selectedCharacters.map((character) => {
                  const meta = characterMeta?.[character.id] || {
                    affinity: "기억남음",
                    reasonTags: [],
                    note: "",
                  };
                  const isPrimary = Number(character.id) === Number(primaryCharacterId);
                  return (
                    <div key={character.id} className="log-sheet__character-meta-card">
                      <div className="log-sheet__character-heading">
                        {character.image ? (
                          <img
                            src={character.image}
                            alt={character.name}
                            loading="lazy"
                            className="log-sheet__character-avatar"
                          />
                        ) : (
                          <div aria-hidden className="log-sheet__character-avatar log-sheet__character-avatar--empty" />
                        )}
                        <div className="log-sheet__character-name">{character.name}</div>
                        <button
                          type="button"
                          className={`btn log-sheet__character-primary${isPrimary ? " is-active" : ""}`}
                          onClick={() => onSetPrimaryCharacter(character.id)}
                        >
                          {isPrimary ? copy.primary : copy.makePrimary}
                        </button>
                      </div>

                      <div className="log-sheet__section">
                        <div className="small">{copy.affinity}</div>
                        <div className="log-sheet__chip-wrap">
                          {affinityOptions.map((affinity) => (
                            <Chip
                              key={affinity}
                              active={meta.affinity === affinity}
                              onClick={() => onSetAffinity(character.id, affinity)}
                            >
                              {affinityLabel(affinity)}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div className="log-sheet__section">
                        <div className="small">{copy.reasonTags}</div>
                        <div className="log-sheet__chip-wrap">
                          {reasonTagOptions.map((tag) => (
                            <Chip
                              key={`${character.id}-${tag}`}
                              active={Array.isArray(meta.reasonTags) && meta.reasonTags.includes(tag)}
                              onClick={() => onToggleReasonTag(character.id, tag)}
                            >
                              {reasonTagLabel(tag)}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <input
                        className="input"
                        value={String(meta.note || "")}
                        maxLength={200}
                        onChange={(event) => onSetCharacterNote(character.id, event.target.value)}
                        placeholder={copy.characterMemo}
                        aria-label={`${character.name} ${copy.characterMemoSuffix}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="log-sheet__footer">
          <button type="button" className="btn" onClick={onClose}>
            {copy.keepDefaults}
          </button>
          <button type="button" className="btn" onClick={onSave}>
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
