import { Chip } from "./LibraryUi.jsx";
import { formatEventLabel, formatSeasonTermLabel } from "./libraryCopy.js";
import { getMessageGroup } from "../../domain/messages.js";
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
  const copy = getMessageGroup(locale, "libraryQuickLogSheet");
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
            {copy.onlyOnePrimary ? (
              <div className="small log-sheet__helper-text">{copy.onlyOnePrimary}</div>
            ) : null}
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
