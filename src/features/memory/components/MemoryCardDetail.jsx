import { useEffect, useReducer, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryImageReplacement from "./MemoryImageReplacement.jsx";
import MemoryVisual from "./MemoryVisual.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./memory-card-detail.css";

const INITIAL_STATE = Object.freeze({
  runtime: null,
  bundle: null,
  previewDataUrl: null,
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

export default function MemoryCardDetail({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="memory-card">
      <MemoryCardDetailContent base={base} />
    </MemoryRouteShell>
  );
}

function MemoryCardDetailContent({ base }) {
  const { copy } = useMemoryRouteUi();
  const detailCopy = copy.detail;
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const { runtime, bundle, previewDataUrl, note, status, message, deleteDialogOpen } = state;
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
      if (!active) return;
      updateState({
        runtime: activeRuntime,
        bundle: cardBundle,
        previewDataUrl: preview,
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
    if (!runtime || !bundle || status === "saving") return;
    updateState({ status: "saving", message: "" });
    try {
      const card = await runtime.updateCard(bundle.card.id, { note });
      updateState({
        bundle: { ...bundle, card },
        note: card.note || "",
        message: { scope: "detail", key: "saved" },
        status: "ready",
      });
    } catch {
      updateState({
        message: { scope: "detail", key: "saveFailed" },
        status: "ready",
      });
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
      window.location.assign(toPlatformAppHref(`${base}archive/`, {
        native: Capacitor.isNativePlatform(),
        origin: window.location.origin,
      }));
    } catch {
      updateState({
        message: { scope: "detail", key: "deleteFailed" },
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
          <h1>{detailCopy.notFound}</h1>
          <a className="btn" href={`${base}archive/`} data-astro-reload>{detailCopy.backToArchive}</a>
        </section>
      </div>
    );
  }

  return (
    <div className="memory-detail page-shell page-shell--narrow">
      <header className="memory-detail__header">
        <a href={`${base}archive/`}>{detailCopy.archiveLink}</a>
        <span className="status-badge">{detailCopy.privacy}</span>
      </header>
      <article className="surface-card memory-detail__card">
        <div className="memory-detail__visual">
          <MemoryVisual
            visual={bundle.asset.designSpec
              ? { kind: "SYSTEM_DESIGN", designSpec: bundle.asset.designSpec }
              : previewDataUrl
                ? {
                    kind: "IMAGE",
                    src: previewDataUrl,
                    alt: detailCopy.cardAlt(bundle.title.displayTitle),
                  }
                : { kind: "MISSING" }}
            fit="contain"
            systemCopy={{
              label: copy.systemDesign.label,
              fallbackTitle: bundle.title.displayTitle,
              footer: copy.systemDesign.footer,
            }}
            missingLabel={detailCopy.missingImage}
          />
        </div>
        <div className="memory-detail__body">
          <h1 className="pageTitle">{bundle.title.displayTitle}</h1>
          <MemoryImageReplacement
            runtime={runtime}
            imageMissing={!bundle.asset.designSpec && !previewDataUrl}
            disabled={status !== "ready"}
            onReplace={replaceImage}
            onBusyChange={(isBusy) => updateState({ status: isBusy ? "replacing" : "ready" })}
            onMessage={(nextMessage) => updateState({ message: nextMessage })}
            copy={copy.replacement}
          />
          <form onSubmit={save}>
            <label className="memory-detail__field">
              <span>{detailCopy.noteLabel}</span>
              <textarea
                className="textarea"
                value={note}
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
