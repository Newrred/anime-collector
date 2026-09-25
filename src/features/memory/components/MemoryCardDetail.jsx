import { memoryReturnHref } from "../../../domain/search/memoryReturnNavigation.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import AddMemoryToBoard from "./AddMemoryToBoard.jsx";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import MemoryTitleLink from "../../titles/components/MemoryTitleLink.jsx";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryImageReplacement from "./MemoryImageReplacement.jsx";
import MemoryPublicCardControl from "./MemoryPublicCardControl.jsx";
import MemoryPrivateImageSync from "./MemoryPrivateImageSync.jsx";
import { isPrivateUserImage, privateImageUiEnabled } from '../runtime/platformPrivateImages.js';
import MemoryVisual from "./MemoryVisual.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./memory-card-detail.css";

const INITIAL_STATE = Object.freeze({
  runtime: null,
  bundle: null,
  previewDataUrl: null,
  remotePreviewDataUrl: null,
  catalogCover: null,
  note: "",
  status: "loading",
  message: "",
  deleteDialogOpen: false,
});

const mergeState = (state, patch) => ({ ...state, ...patch });

const localizedMessage = (message, copy) => {
  if (!message) return "";
  if (message.scope === "detail") return copy.detail[message.key] || "";
  if (message.scope === "replacement") return copy.replacement[message.key] || "";
  if (message.scope === "error") {
    return copy.errors[message.code] || copy.errors.replacementFallback;
  }
  return "";
};

const syncLabel = (entity, copy) => copy.syncStates?.[entity?.sync?.syncState] || "";

export default function MemoryCardDetail({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="memory-card">
      <MemoryCardDetailContent base={base} />
    </MemoryRouteShell>
  );
}

function MemoryCardDetailContent({ base }) {
  const { copy, locale } = useMemoryRouteUi();
  const detailCopy = copy.detail;
  const returnHref = memoryReturnHref(globalThis.location?.search, base);
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const { runtime, bundle, previewDataUrl, remotePreviewDataUrl, catalogCover, note, status, message, deleteDialogOpen } = state;
  const onPrivatePreview = useCallback(value => updateState({ remotePreviewDataUrl: value }), []);
  const onPrivateBusy = useCallback(value => updateState({ status: value ? 'private-sync' : 'ready' }), []);
  const allowLeave = useUnsavedNavigation(Boolean(bundle && note !== (bundle.card.note || "")), locale, { busy: ["saving", "deleting", "replacing", "private-sync"].includes(status) });
  const saveInFlight = useRef(false);
  const deleteTriggerRef = useRef(null);
  const deleteCancelRef = useRef(null);
  const deleteDialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    const cardId = new URLSearchParams(window.location.search).get("id");
    if (!cardId) {
      updateState({ status: "not-found" });
      return () => { active = false; };
    }
    getPlatformMemoryRuntime().then(async (activeRuntime) => {
      await activeRuntime.initialize();
      const cardBundle = await activeRuntime.getCard(cardId);
      if (!cardBundle) {
        if (active) updateState({ status: "not-found" });
        return;
      }
      const preview = cardBundle.asset.localRef
        ? await activeRuntime.getPreview(cardBundle.asset.localRef).catch(() => null)
        : null;
      const resolvedCover = cardBundle.asset.catalogCoverRef
        ? await activeRuntime.resolveCatalogCover(cardBundle.asset.catalogCoverRef).catch(() => null)
        : null;
      if (!active) return;
      updateState({
        runtime: activeRuntime,
        bundle: cardBundle,
        previewDataUrl: preview,
        catalogCover: resolvedCover,
        note: cardBundle.card.note || "",
        status: "ready",
      });
    }).catch(() => {
      if (active) updateState({ status: "error" });
    });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (!runtime || !bundle || status !== "ready" || saveInFlight.current) return;
    saveInFlight.current = true;
    updateState({ status: "saving", message: "" });
    try {
      const card = await runtime.updateCard(bundle.card.id, { note });
      updateState({
        bundle: { ...bundle, card },
        note: card.note || "",
        message: { scope: "detail", key: "saved" },
        status: "ready",
      });
    } catch (error) {
      updateState({
        message: error?.code === "CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED" ? { scope: "error", code: error.code } : { scope: "detail", key: "saveFailed" },
        status: "ready",
      });
    } finally {
      saveInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!deleteDialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => deleteCancelRef.current?.focus());
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteDialogOpen]);

  const closeDeleteDialog = () => {
    updateState({ deleteDialogOpen: false });
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const keepDeleteDialogFocus = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }
    if (event.key !== "Tab" || !deleteDialogRef.current) return;
    const focusable = [...deleteDialogRef.current.querySelectorAll("button:not([disabled])")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const remove = async () => {
    if (!runtime || !bundle || status === "deleting") return;
    updateState({ status: "deleting", message: "", deleteDialogOpen: false });
    try {
      await runtime.deleteCard(bundle.card.id);
      allowLeave();
      window.location.assign(toPlatformAppHref(returnHref, {
        native: Capacitor.isNativePlatform(),
        origin: window.location.origin,
      }));
    } catch (error) {
      updateState({
        message: { scope: "detail", key: error?.code === "PUBLICATION_WITHDRAWAL_UNCONFIRMED" ? "deleteWithdrawalFailed" : "deleteFailed" },
        status: "ready",
      });
    }
  };

  const replaceImage = async (ticket) => {
    const result = await runtime.replaceCardImage(bundle.card.id, {
      intakeTicketId: ticket.ticketId,
      rightsConfirmed: true,
    });
    updateState(result.bundle ? {
      bundle: result.bundle,
      previewDataUrl: result.previewDataUrl || ticket.previewDataUrl,
      remotePreviewDataUrl: null,
      catalogCover: null,
      message: {
        scope: "detail",
        key: result.cleanupPending ? "imageSavedCleanup" : "imageSaved",
      },
    } : {
      message: { scope: "detail", key: "imageSavedRefresh" },
    });
  };

  if (status === "loading") {
    return (
      <div className="memory-detail page-shell page-shell--narrow"><p>{detailCopy.loading}</p></div>
    );
  }
  if (status === "not-found" || status === "error") {
    return (
      <div className="memory-detail page-shell page-shell--narrow">
        <section className="surface-card memory-detail__state">
          <h1>{status === "error" ? copy.archive.error : detailCopy.notFound}</h1>
          {status === "error" && <button className="btn" onClick={() => window.location.reload()}>{locale === "ko" ? "다시 시도" : "Try again"}</button>}
          <a className="btn" href={returnHref} data-astro-reload>{detailCopy.backToArchive}</a>
        </section>
      </div>
    );
  }

  return (
    <div className="memory-detail page-shell page-shell--narrow">
      <header className="memory-detail__header">
        <a href={returnHref}>{returnHref === `${base}archive/` ? detailCopy.archiveLink : (locale === "ko" ? "돌아가기" : "Back")}</a>
        <span className="memory-detail__badges">
          <span className="status-badge">{privateImageUiEnabled() && isPrivateUserImage(bundle.asset) ? (locale === 'ko' ? '비공개' : 'Private') : detailCopy.privacy}</span>
          {bundle.asset.imageType === "CATALOG_COVER"
            ? <span className="status-badge">{detailCopy.catalogCover}</span>
            : null}
          {syncLabel(bundle.card, detailCopy) ? <span className="status-badge">{syncLabel(bundle.card, detailCopy)}</span> : null}
        </span>
      </header>
      <article className="surface-card memory-detail__card">
        <div className="memory-detail__visual">
          <MemoryVisual
            visual={bundle.asset.designSpec
              ? { kind: "SYSTEM_DESIGN", designSpec: bundle.asset.designSpec }
              : (previewDataUrl || remotePreviewDataUrl)
                ? {
                    kind: "IMAGE",
                    src: remotePreviewDataUrl || previewDataUrl,
                    alt: detailCopy.cardAlt(bundle.title.displayTitle),
                  }
                : catalogCover?.publicUrl
                  ? {
                      kind: "IMAGE",
                      src: catalogCover.publicUrl,
                      alt: detailCopy.cardAlt(bundle.title.displayTitle),
                    }
                : { kind: "MISSING" }}
            fit="contain"
            systemCopy={{
              label: copy.systemDesign.label,
              fallbackTitle: bundle.title.displayTitle,
              footer: copy.systemDesign.footer,
            }}
            missingLabel={bundle.asset.imageType === "CATALOG_COVER"
              ? detailCopy.coverUnavailable
              : !bundle.asset.designSpec && !bundle.asset.localRef
                ? detailCopy.unavailableOnDevice
                : detailCopy.missingImage}
          />
        </div>
        <div className="memory-detail__body">
          <h1 className="pageTitle">{bundle.title.displayTitle}</h1>
          <MemoryTitleLink bundle={bundle} base={base} label={detailCopy.openTitleHub} className="memory-detail__title-link" />
          <MemoryImageReplacement
            runtime={runtime}
            imageMissing={!bundle.asset.designSpec && !previewDataUrl && !remotePreviewDataUrl && !catalogCover?.publicUrl}
            disabled={status !== "ready"}
            onReplace={replaceImage}
            onBusyChange={(isBusy) => updateState({ status: isBusy ? "replacing" : "ready" })}
            onMessage={(nextMessage) => updateState({ message: nextMessage })}
            copy={copy.replacement}
          />
          <AddMemoryToBoard cardId={bundle.card.id} base={base} locale={locale} />
          <MemoryPublicCardControl card={bundle.card} locale={locale} disabled={status !== "ready"} />
          <MemoryPrivateImageSync key={`${bundle.asset.id}:${bundle.asset.sync?.remoteVersion}`} runtime={runtime} bundle={bundle} locale={locale}
            hasLocalPreview={Boolean(previewDataUrl)} disabled={!['ready', 'private-sync'].includes(status)} onPreview={onPrivatePreview} onBusyChange={onPrivateBusy} />
            <form onSubmit={save}>
            <label className="memory-detail__field">
              <span>{detailCopy.noteLabel}</span>
              <textarea
                className="textarea"
                value={note}
                disabled={status !== "ready"}
                maxLength={500}
                rows={6}
                onChange={(event) => updateState({ note: event.target.value })}
              />
              <small>{note.length}/500</small>
            </label>
            {message && (
              <p className="memory-detail__message" role="status">
                {localizedMessage(message, copy)}
              </p>
            )}
            <div className="memory-detail__actions">
              {note !== (bundle.card.note || "") && <button className="btn btn--subtle" type="button" disabled={status !== "ready"} onClick={() => updateState({ note: bundle.card.note || "", message: "" })}>{locale === "ko" ? "감상 수정 취소" : "Cancel reflection changes"}</button>}
              <button className="btn" type="submit" disabled={status !== "ready"}>
                {status === "saving" ? detailCopy.saving : detailCopy.save}
              </button>
              <button
                ref={deleteTriggerRef}
                className="btn btn--danger"
                type="button"
                disabled={status !== "ready"}
                onClick={() => updateState({ deleteDialogOpen: true })}
              >
                {status === "deleting" ? detailCopy.deleting : detailCopy.remove}
              </button>
            </div>
          </form>
        </div>
      </article>
      {deleteDialogOpen && (
        <div className="memory-detail__dialog-backdrop">
          <button
            className="memory-detail__dialog-dismiss"
            type="button"
            tabIndex={-1}
            aria-label={detailCopy.deleteCancel}
            onClick={closeDeleteDialog}
          />
          <section
            ref={deleteDialogRef}
            className="surface-card memory-detail__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-delete-dialog-title"
            aria-describedby="memory-delete-dialog-description"
            tabIndex={-1}
            onKeyDown={keepDeleteDialogFocus}
          >
            <h2 id="memory-delete-dialog-title">{detailCopy.deleteDialogTitle}</h2>
            <p id="memory-delete-dialog-description">{detailCopy.deleteConfirm}</p>
            {bundle.card.ownerId?.startsWith("account:") && <p>{locale === "ko"
              ? "계정 기억은 먼저 서버에서 모든 공개 위치의 접근을 철회합니다. 연결이나 로그인을 확인할 수 없으면 삭제하지 않습니다. 철회 후 기기 삭제에 실패해도 공개 중지는 유지됩니다."
              : "Account memories are withdrawn from every public display before deletion. Deletion requires a connection and sign-in. If local deletion then fails, sharing stays stopped."}</p>}
            <div className="memory-detail__dialog-actions">
              <button ref={deleteCancelRef} className="btn btn--subtle" type="button" onClick={closeDeleteDialog}>
                {detailCopy.deleteCancel}
              </button>
              <button className="btn btn--danger" type="button" onClick={remove}>
                {detailCopy.deleteConfirmAction}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
