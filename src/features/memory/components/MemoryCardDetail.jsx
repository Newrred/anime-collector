import { memoryReturnHref } from "../../../domain/search/memoryReturnNavigation.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import AddMemoryToBoard from "./AddMemoryToBoard.jsx";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import MemoryTitleLink from "../../titles/components/MemoryTitleLink.jsx";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import { getPlatformMemoryAccountRuntime } from "../runtime/platformMemoryAccountRuntime.js";
import { getAuthSession } from "../../../repositories/authRepo.js";
import { saveNewMemoryToAccount } from "../application/saveNewMemoryToAccount.js";
import MemoryImageReplacement from "./MemoryImageReplacement.jsx";
import MemorySharingSettings from "./MemorySharingSettings.jsx";
import MemoryClassificationEditor from "./MemoryClassificationEditor.jsx";
import { addCustomTag, characterTagKey, classificationSyncEnabled, EMPTY_CLASSIFICATION, normalizeCardClassification } from "../domain/cardClassification.js";
import { publicationUiEnabled } from "../runtime/platformPublication.js";
import MemoryPrivateImageSync from "./MemoryPrivateImageSync.jsx";
import { isPrivateUserImage, privateImageUiEnabled, queuePlatformPrivatePhoto, hasPlatformPrivatePhotoIntent, drainPlatformPrivatePhotos, privateImageTransfer } from '../runtime/platformPrivateImages.js';
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
  classification: EMPTY_CLASSIFICATION,
  draftTag: "",
  status: "loading",
  message: "",
  deleteDialogOpen: false,
  imageToolsOpen: false,
  editing: false,
  detailTab: "memory",
  photoSyncRevision: 0,
});

const mergeState = (state, patch) => ({ ...state, ...patch });

const localizedMessage = (message, copy, locale) => {
  if (!message) return "";
  if (message.scope === "detail") return copy.detail[message.key] || "";
  if (message.scope === "replacement") return copy.replacement[message.key] || "";
  if (message.scope === "error") {
    if (message.code === "CARD_CLASSIFICATION_INVALID") return locale === "ko" ? "태그는 48자 이내 최대 20개, 캐릭터는 최대 12개까지 저장할 수 있어요." : "Use up to 20 tags (48 characters each) and 12 characters.";
    return copy.errors[message.code] || copy.errors.replacementFallback;
  }
  return "";
};

const syncLabel = (entity, copy) => copy.syncStates?.[entity?.sync?.syncState] || "";

function AccountSaveRetry({ runtime, bundle, userId, locale, copy, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(null);
  if (!userId || bundle.card.ownerId !== `account:${userId}`
    || (bundle.card.sync?.syncState === "SYNCED" && bundle.asset.sync?.syncState === "SYNCED")) return null;
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setReason(null);
    try {
      const includePhoto = privateImageUiEnabled()
        && await hasPlatformPrivatePhotoIntent(bundle.card.ownerId, bundle.asset.id);
      const result = await saveNewMemoryToAccount({
        cardId: bundle.card.id,
        userId,
        runtime,
        includePhoto,
        photoEnabled: privateImageUiEnabled(),
        getSession: getAuthSession,
        getAccountRuntime: getPlatformMemoryAccountRuntime,
        createPhotoTransfer: privateImageTransfer,
        isPrivateImage: isPrivateUserImage,
        saveQueuedPhoto: () => drainPlatformPrivatePhotos(userId, bundle.card.id),
      });
      await onResolved();
      if (result.status !== "SYNCED") setReason(result.reason || "ACCOUNT_SAVE_FAILED");
    } catch {
      setReason("ACCOUNT_SAVE_FAILED");
    } finally {
      setBusy(false);
    }
  };
  return <div className="memory-detail__message" role="status">
    <p>{locale === "ko" ? "이 카드는 기기에 저장됐지만 계정 저장은 아직 끝나지 않았어요." : "This card is on this device, but account storage has not finished."}</p>
    {reason && <small>{copy.composer.pendingReason(reason)}</small>}
    <button type="button" className="btn" disabled={busy} onClick={retry}>{busy
      ? locale === "ko" ? "계정에 저장 중…" : "Saving to account…"
      : locale === "ko" ? "계정 저장 다시 시도" : "Retry account save"}</button>
  </div>;
}

export default function MemoryCardDetail({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="memory-card">
      <MemoryCardDetailContent base={base} />
    </MemoryRouteShell>
  );
}

function MemoryCardDetailContent({ base }) {
  const { copy, locale } = useMemoryRouteUi();
  const auth = useAuthSession();
  const detailCopy = copy.detail;
  const returnHref = memoryReturnHref(globalThis.location?.search, base);
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const { runtime, bundle, previewDataUrl, remotePreviewDataUrl, catalogCover, note, classification, draftTag, status, message, deleteDialogOpen } = state;
  const cardId = bundle?.card.id;
  const authUserId = auth.user?.id;
  const dirty = Boolean(bundle && (draftTag.trim() || note !== (bundle.card.note || "") || JSON.stringify(classification) !== JSON.stringify(normalizeCardClassification(bundle.card.classification))));
  const onPrivatePreview = useCallback(value => updateState({ remotePreviewDataUrl: value }), []);
  const onPrivateBusy = useCallback(value => updateState({ status: value ? 'private-sync' : 'ready' }), []);
  const allowLeave = useUnsavedNavigation(dirty, locale, { busy: ["saving", "deleting", "replacing", "private-sync"].includes(status) });
  const saveInFlight = useRef(false);
  const deleteTriggerRef = useRef(null);
  const deleteCancelRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const editTriggerRef = useRef(null);
  const noteRef = useRef(null);
  const tabRefs = useRef({});
  useEffect(() => { if (state.editing) noteRef.current?.focus(); }, [state.editing]);
  const endEditing = () => window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  const cancelEditing = () => {
    updateState({ editing: false, note: bundle.card.note || "", classification: normalizeCardClassification(bundle.card.classification), draftTag: "", message: "" });
    endEditing();
  };
  const switchTabByKey = event => {
    if (state.editing || status !== "ready") return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "memory" : event.key === "End" ? "manage" : state.detailTab === "memory" ? "manage" : "memory";
    updateState({ detailTab: next });
    tabRefs.current[next]?.focus();
  };

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
        classification: normalizeCardClassification(cardBundle.card.classification),
        imageToolsOpen: !cardBundle.asset.designSpec && !preview && !resolvedCover?.publicUrl,
        detailTab: !cardBundle.asset.designSpec && !preview && !resolvedCover?.publicUrl ? "manage" : "memory",
        status: "ready",
        editing: false,
      });
    }).catch(() => {
      if (active) updateState({ status: "error" });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!runtime || !cardId || !authUserId) return undefined;
    let active = true;
    const onSync = (event) => {
      if (event.detail?.userId !== authUserId || event.detail?.state?.syncBusy) return;
      runtime.getCard(cardId).then((next) => {
        if (!active) return;
        if (!next) {
          updateState({ ...INITIAL_STATE, runtime, status: "not-found" });
          return;
        }
        if (!state.editing) updateState({ bundle: next, note: next.card.note || "",
          classification: normalizeCardClassification(next.card.classification),
          ...(event.detail.photoCompleted > 0 ? { photoSyncRevision: state.photoSyncRevision + 1 } : {}) });
      }).catch(() => {});
    };
    globalThis.addEventListener("moemoa:memory-sync-state", onSync);
    return () => { active = false; globalThis.removeEventListener("moemoa:memory-sync-state", onSync); };
  }, [runtime, cardId, authUserId, state.editing, state.photoSyncRevision]);

  const save = async (event) => {
    event.preventDefault();
    if (!runtime || !bundle || status !== "ready" || saveInFlight.current) return;
    saveInFlight.current = true;
    updateState({ status: "saving", message: "" });
    try {
      const card = await runtime.updateCard(bundle.card.id, { note, classification: addCustomTag(classification, draftTag) });
      updateState({
        bundle: { ...bundle, card },
        note: card.note || "",
        classification: normalizeCardClassification(card.classification),
        draftTag: "",
        message: { scope: "detail", key: "saved" },
        status: "ready",
        editing: false,
      });
      endEditing();
    } catch (error) {
      updateState({
        message: ["CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED", "CARD_CLASSIFICATION_INVALID"].includes(error?.code) ? { scope: "error", code: error.code } : { scope: "detail", key: "saveFailed" },
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
    let photoQueued = false;
    if (auth.user && privateImageUiEnabled()) {
      try { photoQueued = Boolean(await queuePlatformPrivatePhoto(runtime, auth.user.id, bundle.card.id)); }
      catch { /* Local replacement is already committed. Keep it and show the pending state below. */ }
    }
    updateState(result.bundle ? {
      bundle: result.bundle,
      previewDataUrl: result.previewDataUrl || ticket.previewDataUrl,
      remotePreviewDataUrl: null,
      catalogCover: null,
      message: {
        scope: "detail",
        key: result.cleanupPending ? "imageSavedCleanup" : photoQueued ? "imageSavedAccountPending" : "imageSaved",
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
  if (!bundle || status === "not-found" || status === "error") {
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
          <span className="status-badge">{publicationUiEnabled() ? (locale === "ko" ? "비공개 원본" : "Private original") : privateImageUiEnabled() && isPrivateUserImage(bundle.asset) ? (locale === 'ko' ? '비공개' : 'Private') : detailCopy.privacy}</span>
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
          <dl className="memory-detail__facts">
            <div><dt>{locale === "ko" ? "기록일" : "Created"}</dt><dd>{new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", { dateStyle: "medium" }).format(new Date(bundle.card.createdAt))}</dd></div>
            <div><dt>{locale === "ko" ? "이미지" : "Visual"}</dt><dd>{bundle.asset.designSpec ? copy.archive.systemDesign : bundle.asset.imageType === "CATALOG_COVER" ? detailCopy.catalogCover : copy.archive.privateImage}</dd></div>
          </dl>
          <MemoryTitleLink bundle={bundle} base={base} label={detailCopy.openTitleHub} className="memory-detail__title-link" />
          <AccountSaveRetry runtime={runtime} bundle={bundle} userId={authUserId} locale={locale} copy={copy}
            onResolved={async () => {
              const next = await runtime.getCard(bundle.card.id);
              if (next) updateState({ bundle: next, photoSyncRevision: state.photoSyncRevision + 1 });
            }} />
          <div className="memory-detail__toolbar">
            <button ref={editTriggerRef} type="button" className="memory-detail__edit-trigger" disabled={status !== "ready" || state.editing} onClick={() => updateState({ editing: true, detailTab: "memory", message: "" })}>{locale === "ko" ? "기억 수정" : "Edit memory"}</button>
            <AddMemoryToBoard cardId={bundle.card.id} base={base} locale={locale} disabled={status !== "ready" || state.editing} />
          </div>
          <div className="memory-detail__tabs" role="tablist" aria-label={locale === "ko" ? "기억 상세" : "Memory details"} onKeyDown={switchTabByKey}>
            {[['memory', locale === 'ko' ? '기억' : 'Memory'], ['manage', locale === 'ko' ? '관리' : 'Manage']].map(([key, label]) => <button key={key} ref={node => { tabRefs.current[key] = node; }} id={`memory-detail-tab-${key}`} type="button" role="tab" aria-selected={state.detailTab === key} aria-controls={`memory-detail-panel-${key}`} tabIndex={state.detailTab === key ? 0 : -1} disabled={status !== 'ready' || state.editing} onClick={() => updateState({ detailTab: key })}>{label}</button>)}
          </div>
          <section id="memory-detail-panel-memory" role="tabpanel" aria-labelledby="memory-detail-tab-memory" hidden={state.detailTab !== "memory"}>
          {state.editing ? <form className="memory-detail__editor" onSubmit={save}>
            <label className="memory-detail__field">
              <span>{detailCopy.noteLabel}</span>
              <textarea
                ref={noteRef}
                className="textarea"
                value={note}
                disabled={status !== "ready"}
                maxLength={500}
                rows={3}
                onChange={(event) => updateState({ note: event.target.value })}
              />
              <small>{note.length}/500</small>
            </label>
            <MemoryClassificationEditor title={bundle.title} value={classification} onChange={value => updateState({ classification: value, message: "" })} draftTag={draftTag} onDraftTag={value => updateState({ draftTag: value, message: "" })} locale={locale} disabled={status !== "ready"} />
            <div className="memory-detail__actions">
              <button className="btn btn--subtle" type="button" aria-label={locale === "ko" ? "감상 수정 취소" : "Cancel reflection changes"} disabled={status !== "ready"} onClick={cancelEditing}>{locale === "ko" ? "취소" : "Cancel"}</button>
              <button className="btn" type="submit" disabled={status !== "ready"}>
                {status === "saving" ? detailCopy.saving : detailCopy.save}
              </button>
            </div>
          </form> : <div className="memory-detail__read">
            <div className="memory-detail__reflection"><h2>{detailCopy.noteLabel}</h2><p className={!note ? "memory-detail__empty" : undefined}>{note || (locale === "ko" ? "아직 남긴 감상이 없어요." : "No reflection yet.")}</p></div>
            <dl className="memory-detail__classification">
              <div><dt>{locale === "ko" ? "캐릭터" : "Characters"}</dt><dd>{classification.characters.length ? classification.characters.map(row => <span className="memory-detail__tag" key={characterTagKey(row)}>{row.name}</span>) : <span className="memory-detail__empty">{locale === "ko" ? "선택 안 함" : "None selected"}</span>}</dd></div>
              <div><dt>{locale === "ko" ? "커스텀 태그" : "Custom tags"}</dt><dd>{classification.tags.length ? classification.tags.map(tag => <span className="memory-detail__tag" key={tag}>#{tag}</span>) : <span className="memory-detail__empty">{locale === "ko" ? "태그 없음" : "No tags"}</span>}</dd></div>
            </dl>
            {!classificationSyncEnabled() && (classification.tags.length > 0 || classification.characters.length > 0) && <small className="memory-detail__local-hint">{locale === "ko" ? "카드 태그는 현재 이 기기에만 저장돼요." : "Memory tags are currently saved on this device only."}</small>}
          </div>}
          </section>
          <section id="memory-detail-panel-manage" role="tabpanel" aria-labelledby="memory-detail-tab-manage" hidden={state.detailTab !== "manage"}>
          <MemorySharingSettings card={bundle.card} locale={locale} base={base} disabled={status !== "ready"} />
          <details className="memory-detail__tools" open={state.imageToolsOpen} onToggle={event => { if (event.currentTarget.open !== state.imageToolsOpen) updateState({ imageToolsOpen: event.currentTarget.open }); }}><summary>{locale === "ko" ? "이미지 변경·관리" : "Change and manage image"}</summary>
            <MemoryPrivateImageSync key={`${bundle.asset.id}:${bundle.asset.sync?.remoteVersion}:${state.photoSyncRevision}`} runtime={runtime} bundle={bundle} locale={locale}
              hasLocalPreview={Boolean(previewDataUrl)} disabled={!['ready', 'private-sync'].includes(status)} onPreview={onPrivatePreview} onBusyChange={onPrivateBusy} />
            {auth.loading ? null : !auth.user ? <div className="memory-detail__replacement"><p>{locale === "ko" ? "로그인한 뒤 이 기기의 카드를 계정으로 가져오면 사진을 추가할 수 있어요." : "After signing in, import this device's card to your account before adding a photo."}</p><button type="button" className="btn btn--subtle" disabled={!auth.configured} onClick={() => auth.signIn(`${base}data/`)}>{locale === "ko" ? "로그인하고 카드 가져오기" : "Sign in and import card"}</button></div>
              : auth.user && !privateImageUiEnabled() ? <p className="memory-detail__replacement-note">{locale === "ko" ? "지금은 사진 계정 저장을 사용할 수 없어요." : "Account photo storage is unavailable right now."}</p>
                : <MemoryImageReplacement runtime={runtime} imageMissing={!bundle.asset.designSpec && !previewDataUrl && !remotePreviewDataUrl && !catalogCover?.publicUrl}
                  active={state.detailTab === "manage" && state.imageToolsOpen && !deleteDialogOpen} inputCopy={copy.imageInput}
                  disabled={status !== "ready"} onReplace={replaceImage} onBusyChange={isBusy => updateState({ status: isBusy ? "replacing" : "ready" })} onMessage={nextMessage => updateState({ message: nextMessage })} copy={copy.replacement} />}
          </details>
          <div className="memory-detail__danger"><button
                ref={deleteTriggerRef}
                className="btn btn--danger"
                type="button"
                disabled={status !== "ready"}
                onClick={() => updateState({ deleteDialogOpen: true })}
              >
                {status === "deleting" ? detailCopy.deleting : detailCopy.remove}
              </button>
          </div>
          </section>
          {message && <p className="memory-detail__message" role="status">{localizedMessage(message, copy, locale)}</p>}
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
