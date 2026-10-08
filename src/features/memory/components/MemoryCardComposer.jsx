import { memoryReturnHref } from "../../../domain/search/memoryReturnNavigation.js";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import MemoryTitleSelector from "./MemoryTitleSelector.jsx";
import { useMemoryCardComposer } from "./useMemoryCardComposer.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import { IconImage, IconPlus } from "../../../components/ui/AppIcons.jsx";
import { privateImageUiEnabled } from "../runtime/platformPrivateImages.js";
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
  const auth = useAuthSession();
  const photoAccountAvailable = Boolean(auth.user && privateImageUiEnabled());
  const composerCopy = copy.composer;
  const returnHref = memoryReturnHref(globalThis.location?.search, base);
  const {
    runtime,
    ticket,
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
    savedCardId,
    cloudStage,
    busy,
    dirty,
    canSave,
    displayTitle,
    chooseImage,
    useCatalogCover,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    removeCatalogCover,
    saveCard,
    retryAccountSave,
    changeNote,
    changeRightsConfirmed,
  } = useMemoryCardComposer({ base, accountUserId: auth.user?.id || null });

  const allowLeave = useUnsavedNavigation(dirty, locale, { busy: status === "saving" || status === "syncing" });
  const saveReason = busy
    ? composerCopy.saveBlockedBusy
    : !runtime
      ? composerCopy.saveBlockedBusy
      : !ticket && !catalogCoverSelection
        ? composerCopy.saveBlockedVisual
        : !title.trim()
          ? composerCopy.saveBlockedTitle
          : catalogCoverSelection && !note.trim()
            ? composerCopy.saveBlockedReflection
            : ticket && !photoAccountAvailable
              ? composerCopy.photoSignInRequired
            : ticket && !rightsConfirmed
            ? composerCopy.saveBlockedRights
            : composerCopy.saveHint;
  const statusAnnouncement = status === "saving" ? composerCopy.saving : status === "syncing" ? composerCopy.syncingAccount : "";
  const hasVisual = Boolean(ticket || catalogCoverSelection);
  const hasTitle = Boolean(title.trim());
  const hasRights = Boolean(catalogCoverSelection || (ticket && rightsConfirmed));
  const catalogCoverAvailable = Boolean(
    selectedTitleChoice?.coverPreviewUrl && selectedTitleChoice?.catalogCoverRef,
  );
  const submitComposer = (event) => {
    const activeElement = event.currentTarget.ownerDocument.activeElement;
    // Safari may leave focus in the title when the save button is tapped.
    // Only an implicit title submission should fall back to searching.
    const explicitSave = event.nativeEvent.submitter?.name === "save-memory";
    if (!explicitSave && activeElement?.id === "memory-title-input") {
      event.preventDefault();
      searchTitles(activeElement.value);
      return;
    }
    saveCard(event, allowLeave, { includePhoto: Boolean(ticket && photoAccountAvailable) });
  };
  const signInForPhoto = () => auth.signIn(`${window.location.pathname}${window.location.search}`);

  return (
    <div className="memory-composer page-shell page-shell--wide">
      <section className="memory-composer__intro">
        <div className="pageHeader">
          <h1 className="pageTitle">{composerCopy.title}</h1>
          <a href={returnHref} className="btn btn--subtle">{locale === "ko" ? "취소" : "Cancel"}</a>
        </div>
        <details className="memory-composer__storage-help">
          <summary>{composerCopy.privacyTitle}</summary>
          <p>{photoAccountAvailable ? composerCopy.privacyBodyAccount : composerCopy.privacyBody}</p>
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

            {ticket ? (
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
                  {busy ? composerCopy.preparing : composerCopy.noImage}
                </p>
                <small>{composerCopy.chooseTitleForCover}</small>
                {runtime?.imageIntake.available && photoAccountAvailable ? <button type="button" className="btn" onClick={chooseImage} disabled={busy}>{composerCopy.chooseImage}</button> : null}
                {!auth.loading && !auth.user && <button type="button" className="btn btn--subtle" disabled={!auth.configured} onClick={signInForPhoto}>{composerCopy.signInForPhoto}</button>}
                {!auth.loading && auth.user && !privateImageUiEnabled() && <small>{composerCopy.photoTemporarilyUnavailable}</small>}
              </div>
            )}

            {message && (
              <p id="memory-composer-error" className="memory-composer__error" role="alert" aria-live="assertive">
                {copy.errors[message] || copy.errors.fallback}
              </p>
            )}

            {runtime?.imageIntake.available || ticket || catalogCoverAvailable || catalogCoverSelection ? (
            <div className="action-row memory-composer__image-actions" role="group" aria-label={composerCopy.visualChoices}>
              {runtime?.imageIntake.available && hasVisual && photoAccountAvailable ? (
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

            {ticket && photoAccountAvailable && <p className="memory-composer__account-photo-choice">{composerCopy.savePhotoInAccount}</p>}
            {ticket && !auth.user && <div className="memory-composer__photo-sign-in" role="status"><p>{composerCopy.photoSignInRequired}</p><button type="button" className="btn" disabled={!auth.configured} onClick={signInForPhoto}>{composerCopy.signInForPhoto}</button></div>}

            <div className={`memory-composer__save-gate memory-composer__step-card${canSave ? " is-current" : ""}`}>
              <div>
                <button type="submit" name="save-memory" className="btn memory-composer__save-button" disabled={!canSave} aria-describedby="memory-save-reason">
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
        {savedCardId && status === "saved-local" && <div className="surface-card memory-composer__account-pending" role="status">
          <p>{cloudStage === "photo" ? composerCopy.photoPending : composerCopy.accountPending}</p>
          <div className="action-row">
            <button type="button" className="btn" onClick={retryAccountSave}>{composerCopy.retryAccountSave}</button>
            <a className="btn btn--subtle" href={`${base}memory/card/?id=${encodeURIComponent(savedCardId)}`} data-astro-reload>{composerCopy.viewSavedCard}</a>
          </div>
        </div>}
      </form>
    </div>
  );
}
