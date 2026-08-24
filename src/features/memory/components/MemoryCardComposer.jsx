import SystemDesignPreview from "./SystemDesignPreview.jsx";
import MemoryTitleSelector from "./MemoryTitleSelector.jsx";
import { useMemoryCardComposer } from "./useMemoryCardComposer.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./memory-card-composer.css";

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export default function MemoryCardComposer({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="memory-new">
      <MemoryCardComposerContent base={base} />
    </MemoryRouteShell>
  );
}

function MemoryCardComposerContent({ base }) {
  const { copy } = useMemoryRouteUi();
  const composerCopy = copy.composer;
  const {
    runtime,
    ticket,
    designSpec,
    status,
    message,
    title,
    titleResults,
    selectedTitleChoice,
    titleSearchStatus,
    remoteTitleStatus,
    note,
    rightsConfirmed,
    busy,
    canSave,
    displayTitle,
    chooseImage,
    useSystemDesign,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    saveCard,
    changeNote,
    changeRightsConfirmed,
  } = useMemoryCardComposer({ base });

  const saveReason = busy
    ? composerCopy.saveBlockedBusy
    : !runtime
      ? composerCopy.saveBlockedBusy
      : !ticket && !designSpec
        ? composerCopy.saveBlockedVisual
        : !title.trim()
          ? composerCopy.saveBlockedTitle
          : ticket && !rightsConfirmed
            ? composerCopy.saveBlockedRights
            : composerCopy.saveHint;
  const statusAnnouncement = status === "saving" ? composerCopy.saving : "";

  return (
    <div className="memory-composer page-shell page-shell--wide">
      <section className="memory-composer__intro">
        <div className="pageHeader">
          <p className="memory-composer__eyebrow">{composerCopy.eyebrow}</p>
          <h1 className="pageTitle">{composerCopy.title}</h1>
          <p className="pageLead">{composerCopy.lead}</p>
        </div>
        <div className="memory-composer__privacy">
          <strong>{composerCopy.privacyTitle}</strong>
          <span>{composerCopy.privacyBody}</span>
        </div>
      </section>

      <form className="surface-card memory-composer__form" onSubmit={saveCard}>
        <div className="memory-composer__workspace">
          <section
            className="memory-composer__visual-column"
            aria-labelledby="memory-image-heading"
            aria-describedby={message ? "memory-composer-error" : undefined}
          >
            <div className="memory-composer__section-head">
              <div>
                <p className="memory-composer__step-label">{composerCopy.stepVisual}</p>
                <h2 id="memory-image-heading">{composerCopy.imageHeading}</h2>
                <p>{composerCopy.imageHelp}</p>
              </div>
              {ticket && (
                <span className="status-badge">
                  {ticket.width}×{ticket.height} · {formatBytes(ticket.byteSize)}
                </span>
              )}
            </div>

            {designSpec ? (
              <SystemDesignPreview
                className="memory-composer__preview memory-composer__system-preview"
                spec={designSpec}
                title={displayTitle}
                copy={copy.systemDesign}
              />
            ) : ticket ? (
              <div className="memory-composer__preview-wrap">
                <img
                  className="memory-composer__preview"
                  src={ticket.previewDataUrl}
                  alt={displayTitle ? composerCopy.cardPreview(displayTitle) : composerCopy.selectedPreview}
                />
              </div>
            ) : (
              <div className="memory-composer__empty-image">
                <span aria-hidden="true">＋</span>
                <p>
                  {status === "browser"
                    ? composerCopy.browserOnly
                    : busy
                      ? composerCopy.preparing
                      : composerCopy.noImage}
                </p>
              </div>
            )}

            {message && (
              <p id="memory-composer-error" className="memory-composer__error" role="alert" aria-live="assertive">
                {copy.errors[message] || copy.errors.fallback}
              </p>
            )}

            <div className="action-row memory-composer__image-actions" role="group" aria-label={composerCopy.visualChoices}>
              <button
                type="button"
                className={`btn${runtime?.imageIntake.available ? "" : " btn--subtle"}`}
                onClick={chooseImage}
                disabled={!runtime?.imageIntake.available || busy}
              >
                {ticket ? composerCopy.chooseAnotherImage : composerCopy.chooseImage}
              </button>
              {ticket && (
                <button type="button" className="btn btn--subtle" onClick={removeImage} disabled={busy}>
                  {composerCopy.removeImage}
                </button>
              )}
              <button
                type="button"
                className={`btn${runtime?.imageIntake.available ? " btn--subtle" : ""}`}
                onClick={useSystemDesign}
                disabled={!runtime || busy}
              >
                {composerCopy.useSystemDesign}
              </button>
            </div>
          </section>

          <div className="memory-composer__form-column">
            <MemoryTitleSelector
              title={title}
              runtimeReady={Boolean(runtime)}
              titleResults={titleResults}
              selectedTitleChoice={selectedTitleChoice}
              titleSearchStatus={titleSearchStatus}
              remoteTitleStatus={remoteTitleStatus}
              onTitleChange={changeTitle}
              onSearch={searchTitles}
              onSelectTitle={selectTitle}
              onClearSelected={clearSelectedTitle}
              copy={copy.titleSelector}
              stepLabel={composerCopy.stepTitle}
            />

            <section className="memory-composer__reflection-step">
              <p className="memory-composer__step-label">{composerCopy.stepReflection}</p>
              <label className="memory-composer__field" htmlFor="memory-reflection-input">
                <span>{composerCopy.noteLabel}</span>
                <textarea
                  id="memory-reflection-input"
                  className="textarea"
                  value={note}
                  maxLength={500}
                  rows={5}
                  onChange={changeNote}
                  placeholder={composerCopy.notePlaceholder}
                />
                <small>{note.length}/500</small>
              </label>
            </section>

            <section className="memory-composer__rights-step" aria-labelledby="memory-rights-heading">
              <p className="memory-composer__step-label">{composerCopy.stepRights}</p>
              <h2 id="memory-rights-heading" className="memory-composer__step-heading">{composerCopy.rightsHeading}</h2>
              {ticket ? (
                <label className="memory-composer__rights">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={changeRightsConfirmed}
                  />
                  <span>{composerCopy.rights}</span>
                </label>
              ) : designSpec ? (
                <p className="memory-composer__rights memory-composer__rights--copy">
                  {composerCopy.designStorage}
                </p>
              ) : (
                <p className="memory-composer__rights memory-composer__rights--copy">
                  {composerCopy.rightsPending}
                </p>
              )}
            </section>

            <div className="memory-composer__save-gate">
              <div>
                <p className="memory-composer__step-label">{composerCopy.stepSave}</p>
                <button type="submit" className="btn" disabled={!canSave} aria-describedby="memory-save-reason">
                  {status === "saving" ? composerCopy.saving : composerCopy.save}
                </button>
              </div>
              <p id="memory-save-reason">{saveReason}</p>
            </div>

            <p className="memory-composer__live" role="status" aria-live="polite" aria-atomic="true">
              {statusAnnouncement}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
