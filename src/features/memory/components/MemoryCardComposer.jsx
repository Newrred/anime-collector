import { memoryReturnHref } from "../../../domain/search/memoryReturnNavigation.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import MemoryTitleSelector from "./MemoryTitleSelector.jsx";
import { useMemoryCardComposer } from "./useMemoryCardComposer.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import { IconImage, IconPlus } from "../../../components/ui/AppIcons.jsx";
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
  const { copy, locale } = useMemoryRouteUi();
  const composerCopy = copy.composer;
  const returnHref = memoryReturnHref(globalThis.location?.search, base);
  const {
    runtime,
    ticket,
    designSpec,
    catalogCoverSelection,
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
    dirty,
    canSave,
    displayTitle,
    chooseImage,
    useSystemDesign,
    useCatalogCover,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    removeCatalogCover,
    saveCard,
    changeNote,
    changeRightsConfirmed,
  } = useMemoryCardComposer({ base });

  const allowLeave = useUnsavedNavigation(dirty, locale, { busy: status === "saving" });
  const saveReason = busy
    ? composerCopy.saveBlockedBusy
    : !runtime
      ? composerCopy.saveBlockedBusy
      : !ticket && !designSpec && !catalogCoverSelection
        ? composerCopy.saveBlockedVisual
        : !title.trim()
          ? composerCopy.saveBlockedTitle
          : catalogCoverSelection && !note.trim()
            ? composerCopy.saveBlockedReflection
            : ticket && !rightsConfirmed
            ? composerCopy.saveBlockedRights
            : composerCopy.saveHint;
  const statusAnnouncement = status === "saving" ? composerCopy.saving : "";
  const hasVisual = Boolean(ticket || designSpec || catalogCoverSelection);
  const hasTitle = Boolean(title.trim());
  const hasRights = Boolean(designSpec || catalogCoverSelection || (ticket && rightsConfirmed));
  const catalogCoverAvailable = Boolean(
    selectedTitleChoice?.coverPreviewUrl && selectedTitleChoice?.catalogCoverRef,
  );
  const submitComposer = (event) => {
    const activeElement = event.currentTarget.ownerDocument.activeElement;
    if (activeElement?.id === "memory-title-input") {
      event.preventDefault();
      searchTitles(activeElement.value);
      return;
    }
    saveCard(event, allowLeave);
  };

  return (
    <div className="memory-composer page-shell page-shell--wide">
      <section className="memory-composer__intro">
        <div className="pageHeader">
          <h1 className="pageTitle">{composerCopy.title}</h1>
          <a href={returnHref} className="btn btn--subtle">{locale === "ko" ? "취소" : "Cancel"}</a>
        </div>
        <details className="memory-composer__storage-help">
          <summary>{composerCopy.privacyTitle}</summary>
          <p>{composerCopy.privacyBody}</p>
        </details>
      </section>

      <form className="memory-composer__form" onSubmit={submitComposer}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="memory-composer__workspace">
          <section
            className={`memory-composer__visual-column memory-composer__step-card${hasVisual ? " is-complete" : " is-current"}`}
            aria-labelledby="memory-image-heading"
            aria-describedby={message ? "memory-composer-error" : undefined}
          >
            <div className="memory-composer__section-head">
              <div>
                <p className="memory-composer__step-label">{composerCopy.stepVisual}</p>
                <h2 id="memory-image-heading">{composerCopy.imageHeading}</h2>
                {status !== "browser" && <p>{composerCopy.imageHelp}</p>}
              </div>
              {ticket ? (
                <span className="status-badge">
                  {ticket.width}×{ticket.height} · {formatBytes(ticket.byteSize)}
                </span>
              ) : (
                <span className={`memory-composer__requirement${hasVisual ? " is-complete" : ""}`}>
                  {hasVisual ? composerCopy.done : composerCopy.required}
                </span>
              )}
            </div>

            {status === "browser" && !designSpec && !ticket && !catalogCoverSelection ? (
              <button type="button" className="btn memory-composer__visual-primary memory-composer__empty-cta" onClick={useSystemDesign}>
                {composerCopy.useSystemDesign}
              </button>
            ) : null}

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
            ) : catalogCoverSelection ? (
              <div className="memory-composer__preview-wrap memory-composer__cover-preview-wrap">
                <img
                  className="memory-composer__preview memory-composer__cover-preview"
                  src={catalogCoverSelection.previewUrl}
                  alt={composerCopy.officialCoverAlt(displayTitle)}
                />
                <span className="status-badge memory-composer__cover-badge">{composerCopy.officialCoverBadge}</span>
              </div>
            ) : (
              <div className="memory-composer__empty-image">
                <span className="memory-composer__empty-image-icon" aria-hidden="true"><IconImage size={34} /></span>
                <p>
                  {status === "browser"
                    ? composerCopy.webVisualTitle
                    : busy
                      ? composerCopy.preparing
                      : composerCopy.noImage}
                </p>
                {status === "browser" ? <small>{composerCopy.webVisualBody}</small> : null}
              </div>
            )}

            {message && (
              <p id="memory-composer-error" className="memory-composer__error" role="alert" aria-live="assertive">
                {copy.errors[message] || copy.errors.fallback}
              </p>
            )}

            {runtime?.imageIntake.available || ticket || catalogCoverAvailable || catalogCoverSelection ? (
            <div className="action-row memory-composer__image-actions" role="group" aria-label={composerCopy.visualChoices}>
              {runtime?.imageIntake.available ? (
                <button
                  type="button"
                  className="btn memory-composer__visual-primary"
                  onClick={chooseImage}
                  disabled={busy}
                >
                  <IconPlus size={17} />
                  {ticket ? composerCopy.chooseAnotherImage : composerCopy.chooseImage}
                </button>
              ) : null}
              {ticket && (
                <button type="button" className="btn btn--subtle" onClick={removeImage} disabled={busy}>
                  {composerCopy.removeImage}
                </button>
              )}
              {catalogCoverAvailable && !catalogCoverSelection ? (
                <button
                  type="button"
                  className="btn btn--subtle memory-composer__cover-action"
                  onClick={useCatalogCover}
                  disabled={!runtime || busy}
                >
                  {composerCopy.useOfficialCover}
                </button>
              ) : null}
              {catalogCoverSelection ? (
                <button type="button" className="btn btn--subtle" onClick={removeCatalogCover} disabled={busy}>
                  {composerCopy.removeOfficialCover}
                </button>
              ) : null}
              <button
                type="button"
                className={`btn memory-composer__system-action${runtime?.imageIntake.available ? " btn--subtle" : " memory-composer__visual-primary"}`}
                onClick={useSystemDesign}
                disabled={!runtime || busy}
              >
                {composerCopy.useSystemDesign}
              </button>
            </div>
            ) : null}
          </section>

          <div className="memory-composer__form-column">
            <MemoryTitleSelector
              title={title}
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
              requiredLabel={composerCopy.required}
              completeLabel={composerCopy.done}
              complete={hasTitle}
            />

            <section className="memory-composer__reflection-step memory-composer__step-card">
              <div className="memory-composer__step-card-head">
                <p className="memory-composer__step-label">{composerCopy.stepReflection}</p>
                <span className={`memory-composer__requirement${catalogCoverSelection ? "" : " is-optional"}`}>
                  {catalogCoverSelection ? composerCopy.required : composerCopy.optional}
                </span>
              </div>
              <div className="memory-composer__field">
                <label htmlFor="memory-reflection-input">{composerCopy.noteLabel}</label>
                <textarea
                  id="memory-reflection-input"
                  aria-describedby="memory-reflection-count memory-reflection-help"
                  className="textarea"
                  value={note}
                  maxLength={500}
                  rows={5}
                  onChange={changeNote}
                  placeholder={composerCopy.notePlaceholder}
                />
                <small id="memory-reflection-count">{note.length}/500</small>
                <small id="memory-reflection-help">{catalogCoverSelection ? composerCopy.coverReflectionHelp : ""}</small>
              </div>
            </section>

            {ticket && <section className={`memory-composer__rights-step memory-composer__step-card${hasRights ? " is-complete" : ""}`} aria-labelledby="memory-rights-heading">
              <div className="memory-composer__step-card-head">
                <span className={`memory-composer__requirement${hasRights ? " is-complete" : ""}`}>
                  {hasRights ? composerCopy.done : composerCopy.required}
                </span>
              </div>
              <h2 id="memory-rights-heading" className="memory-composer__step-heading">{composerCopy.rightsHeading}</h2>
                <label className="memory-composer__rights">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={changeRightsConfirmed}
                  />
                  <span>{composerCopy.rights}</span>
                </label>
            </section>}

            <div className={`memory-composer__save-gate memory-composer__step-card${canSave ? " is-current" : ""}`}>
              <div>
                <button type="submit" className="btn memory-composer__save-button" disabled={!canSave} aria-describedby="memory-save-reason">
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
        </fieldset>
      </form>
    </div>
  );
}
