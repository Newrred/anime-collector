import { useEffect, useReducer, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import { getPlatformMemoryAccountRuntime } from "../runtime/platformMemoryAccountRuntime.js";
import { privateImageTransfer, privateImageUiEnabled, isPrivateUserImage, queuePlatformPrivatePhoto, drainPlatformPrivatePhotos } from "../runtime/platformPrivateImages.js";
import { getAuthSession } from "../../../repositories/authRepo.js";
import { recordFirstMemoryViewSuggestion } from "../../titles/application/firstMemoryViewSuggestion.js";
import { saveNewMemoryToAccount } from "../application/saveNewMemoryToAccount.js";

const titleChoiceKey = (choice) => choice ? JSON.stringify([choice.kind, choice.animeId, choice.privateTitleId, choice.anilistId, choice.displayTitle]) : "";
const errorCode = (code) => String(code || "fallback");

const INITIAL_STATE = Object.freeze({
  runtime: null,
  ticket: null,
  catalogCoverSelection: null,
  status: "checking",
  message: "",
  title: "",
  initialTitle: "",
  initialTitleChoice: null,
  titleResults: [],
  selectedTitleChoice: null,
  titleSearchStatus: "idle",
  remoteTitleStatus: "SKIPPED",
  note: "",
  rightsConfirmed: false,
  savedCardId: null,
  cloudStage: null,
  cloudReason: null,
});

const mergeState = (state, patch) => ({ ...state, ...patch });

export function useMemoryCardComposer({ base = "/", accountUserId = null } = {}) {
  const saveInFlight = useRef(false);
  const cloudInFlight = useRef(false);
  const savedCloudOptions = useRef(null);
  const titleSearchGeneration = useRef(0);
  const mounted = useRef(false);
  const intakeGeneration = useRef(0);
  const intakeInFlight = useRef(false);
  const pendingTicket = useRef(null);
  const submittedTicket = useRef(null);
  const activeRuntimeRef = useRef(null);
  const currentOwner = useRef(accountUserId);
  currentOwner.current = accountUserId;
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const {
    runtime,
    ticket,
    catalogCoverSelection,
    status,
    title,
    selectedTitleChoice,
    titleSearchStatus,
    rightsConfirmed,
  } = state;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      intakeGeneration.current += 1;
      if (typeof activeRuntimeRef.current?.imageIntake.ingestFile === "function"
        && pendingTicket.current && !saveInFlight.current && pendingTicket.current !== submittedTicket.current) {
        void activeRuntimeRef.current?.releaseImageTicket(pendingTicket.current);
        pendingTicket.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    const parameters = new URLSearchParams(window.location.search);
    const requestedTitle = String(parameters.get("title") || "")
      .normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, 120);
    if (requestedTitle) updateState({ title: requestedTitle, initialTitle: requestedTitle });
    const requestedPrivateTitleId = parameters.get("privateTitleId");
    if (requestedPrivateTitleId) {
      updateState({ title: "", initialTitle: "" });
      const generation = titleSearchGeneration.current;
      getPlatformMemoryRuntime().then((activeRuntime) => activeRuntime.getPrivateTitle(requestedPrivateTitleId)).then((existing) => {
        if (!active || generation !== titleSearchGeneration.current) return;
        if (!existing) {
          updateState({ title: "", message: "PRIVATE_TITLE_NOT_FOUND" });
          return;
        }
        const choice = { kind: "PRIVATE_TITLE", privateTitleId: existing.id, displayTitle: existing.displayTitle };
        updateState({ title: existing.displayTitle, initialTitle: existing.displayTitle, initialTitleChoice: choice,
          selectedTitleChoice: choice, titleSearchStatus: "ready" });
      }).catch(() => { if (active && generation === titleSearchGeneration.current) updateState({ title: "", message: "PRIVATE_TITLE_NOT_FOUND" }); });
      return () => { active = false; };
    }
    const requestedAnimeId = String(parameters.get("animeId") || "");
    if (requestedAnimeId) {
      const generation = titleSearchGeneration.current;
      const testChoice = import.meta.env.DEV
        ? globalThis.__MOEMOA_TEST_CATALOG_TITLE_CHOICE__
        : null;
      const choicePromise = testChoice
        ? Promise.resolve(structuredClone(testChoice))
        : import("../../catalog/catalogConsumer.js")
          .then(({ loadCatalogTitleChoice }) => loadCatalogTitleChoice(requestedAnimeId));
      choicePromise.then((choice) => {
        if (!active || generation !== titleSearchGeneration.current || !choice) return;
        updateState({
          title: choice.displayTitle,
          initialTitle: choice.displayTitle,
          initialTitleChoice: choice,
          selectedTitleChoice: choice,
          titleResults: [],
          titleSearchStatus: "ready",
          remoteTitleStatus: "READY",
        });
      }).catch(() => {});
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let timer = null;

    const claim = async (activeRuntime) => {
      try {
        const result = await activeRuntime.imageIntake.claim();
        if (!active) return;
        if (result.ticket) {
          pendingTicket.current = result.ticket.ticketId;
          updateState({ ticket: result.ticket, status: "ready", message: "" });
          return;
        }
        if (result.processing) {
          updateState({ status: "processing" });
          timer = window.setTimeout(() => claim(activeRuntime), 250);
          return;
        }
        updateState({
          status: result.errorCode ? "error" : "empty",
          message: result.errorCode ? errorCode(result.errorCode) : "",
        });
      } catch (error) {
        if (!active) return;
        updateState({ status: "error", message: errorCode(error?.code) });
      }
    };

    getPlatformMemoryRuntime().then(async (activeRuntime) => {
      if (!active) return;
      await activeRuntime.initialize();
      if (!active) return;
      updateState({ runtime: activeRuntime });
      activeRuntimeRef.current = activeRuntime;
      if (!activeRuntime.imageIntake.available) {
        updateState({ status: "browser" });
        return;
      }
      claim(activeRuntime);
    }).catch((error) => {
      if (!active) return;
      updateState({ status: "error", message: errorCode(error?.code) });
    });
    return () => {
      active = false;
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  const busy = ["checking", "processing", "picking", "removing", "saving", "syncing", "saved-local"].includes(status);

  const receiveImage = async (file) => {
    if (!runtime?.imageIntake.available || busy || intakeInFlight.current || saveInFlight.current) return;
    if (!accountUserId || !privateImageUiEnabled()) {
      updateState({ message: accountUserId ? "IMAGE_STORAGE_UNAVAILABLE" : "IMAGE_SIGN_IN_REQUIRED" });
      return;
    }
    if (file && typeof runtime.imageIntake.ingestFile !== "function") return;
    intakeInFlight.current = true;
    const generation = ++intakeGeneration.current;
    const owner = accountUserId;
    const isCurrent = () => mounted.current && intakeGeneration.current === generation && currentOwner.current === owner;
    let incoming = null;
    updateState({ status: "picking", message: "" });
    try {
      const result = await (file ? runtime.imageIntake.ingestFile(file) : runtime.imageIntake.pick());
      incoming = result.ticket;
      if (!isCurrent()) return;
      if (result.cancelled || !result.ticket) {
        updateState({ status: ticket || catalogCoverSelection ? "ready" : "empty" });
        return;
      }
      if (ticket && ticket.ticketId !== result.ticket.ticketId) {
        if (await runtime.releaseImageTicket(ticket.ticketId) !== true) {
          throw Object.assign(new Error("Image cleanup pending"), { code: "IMAGE_CLEANUP_FAILED" });
        }
      }
      if (!isCurrent()) return;
      pendingTicket.current = result.ticket.ticketId;
      updateState({ ticket: result.ticket, catalogCoverSelection: null, rightsConfirmed: false, status: "ready" });
      incoming = null;
    } catch (error) {
      if (isCurrent()) updateState({ status: "error", message: errorCode(error?.code) });
    } finally {
      if (incoming && incoming.ticketId !== pendingTicket.current) await runtime.releaseImageTicket(incoming.ticketId);
      intakeInFlight.current = false;
    }
  };
  const chooseImage = () => receiveImage();

  const useCatalogCover = async () => {
    const coverPreviewUrl = String(selectedTitleChoice?.coverPreviewUrl || "");
    const catalogCoverRef = selectedTitleChoice?.catalogCoverRef;
    if (!runtime || busy || intakeInFlight.current || !coverPreviewUrl || !catalogCoverRef) return;
    intakeInFlight.current = true;
    updateState({ status: "processing", message: "" });
    try {
      if (ticket && await runtime.releaseImageTicket(ticket.ticketId) !== true) {
        throw Object.assign(new Error("Image cleanup pending"), { code: "IMAGE_CLEANUP_FAILED" });
      }
      pendingTicket.current = null;
      if (!mounted.current) return;
      updateState({
        ticket: null,
        rightsConfirmed: false,
        catalogCoverSelection: {
          previewUrl: coverPreviewUrl,
          catalogCoverRef: structuredClone(catalogCoverRef),
        },
        status: "ready",
      });
    } catch (error) {
      if (mounted.current) updateState({ status: "error", message: errorCode(error?.code) });
    } finally {
      intakeInFlight.current = false;
    }
  };

  const removeCatalogCover = () => {
    if (busy || intakeInFlight.current) return;
    updateState({ catalogCoverSelection: null, status: runtime?.imageIntake.available ? "empty" : "browser" });
  };

  const changeTitle = (event) => {
    titleSearchGeneration.current += 1;
    updateState({
      title: event.target.value,
      selectedTitleChoice: null,
      titleResults: [],
      titleSearchStatus: "idle",
      remoteTitleStatus: "SKIPPED",
      catalogCoverSelection: null,
    });
  };

  const searchTitles = async (requestedTitle = title) => {
    const searchTitle = typeof requestedTitle === "string" ? requestedTitle.trim() : title.trim();
    if (searchTitle.length < 2 || titleSearchStatus === "searching") return;
    const generation = titleSearchGeneration.current + 1;
    titleSearchGeneration.current = generation;
    updateState({ titleSearchStatus: "searching" });
    try {
      const searchRuntime = runtime || await getPlatformMemoryRuntime();
      await searchRuntime.initialize();
      const response = await searchRuntime.searchTitles(searchTitle);
      if (generation !== titleSearchGeneration.current) return;
      updateState({
        titleResults: Array.isArray(response?.results) ? response.results : [],
        remoteTitleStatus: String(response?.remoteStatus || "UNAVAILABLE"),
        titleSearchStatus: "ready",
      });
    } catch {
      if (generation !== titleSearchGeneration.current) return;
      updateState({
        titleResults: [],
        remoteTitleStatus: "UNAVAILABLE",
        titleSearchStatus: "ready",
      });
    }
  };

  const selectTitle = (candidate) => {
    const safeCandidate = structuredClone(candidate);
    updateState({
      selectedTitleChoice: safeCandidate,
      title: safeCandidate.displayTitle,
      titleResults: [],
      catalogCoverSelection: null,
    });
  };

  const clearSelectedTitle = () => {
    updateState({
      selectedTitleChoice: null,
      titleResults: [],
      titleSearchStatus: "idle",
      remoteTitleStatus: "SKIPPED",
      catalogCoverSelection: null,
    });
  };

  const removeImage = async () => {
    if (!ticket || busy || intakeInFlight.current) return;
    intakeInFlight.current = true;
    updateState({ status: "removing" });
    try {
      if (await runtime.releaseImageTicket(ticket.ticketId) !== true) {
        throw Object.assign(new Error("Image cleanup pending"), { code: "IMAGE_CLEANUP_FAILED" });
      }
      pendingTicket.current = null;
      if (!mounted.current) return;
      updateState({ ticket: null, status: "empty", message: "" });
    } catch (error) {
      if (mounted.current) updateState({ status: "error", message: errorCode(error?.code) });
    } finally {
      intakeInFlight.current = false;
    }
  };

  const openArchive = () => window.location.assign(toPlatformAppHref(`${base}archive/`, {
    native: Capacitor.isNativePlatform(),
    origin: window.location.origin,
  }));

  const syncSavedCard = async (cardId, options) => {
    if (cloudInFlight.current) return;
    cloudInFlight.current = true;
    updateState({ status: "syncing", cloudStage: null, cloudReason: null });
    try {
      if (options.includePhoto && options.accountUserId && privateImageUiEnabled()) {
        try { await queuePlatformPrivatePhoto(runtime, options.accountUserId, cardId); }
        catch { updateState({ status: "saved-local", cloudStage: "photo", cloudReason: "PHOTO_QUEUE_FAILED" }); return; }
      }
      const result = await saveNewMemoryToAccount({
        cardId,
        userId: options.accountUserId,
        runtime,
        includePhoto: options.includePhoto,
        photoEnabled: privateImageUiEnabled(),
        getSession: getAuthSession,
        getAccountRuntime: getPlatformMemoryAccountRuntime,
        createPhotoTransfer: privateImageTransfer,
        isPrivateImage: isPrivateUserImage,
        saveQueuedPhoto: () => drainPlatformPrivatePhotos(options.accountUserId, cardId),
      });
      if (result.status === "SYNCED" || result.status === "LOCAL_ONLY") {
        openArchive();
        return;
      }
      updateState({ status: "saved-local", cloudStage: result.stage, cloudReason: result.reason || "ACCOUNT_SAVE_FAILED" });
    } finally {
      cloudInFlight.current = false;
    }
  };

  const saveCard = async (event, onSaved = () => {}, { includePhoto = false } = {}) => {
    event.preventDefault();
    if (
      !runtime ||
      (!ticket && !catalogCoverSelection) ||
      !title.trim() ||
      (ticket && (!rightsConfirmed || !accountUserId || !privateImageUiEnabled())) ||
      busy || intakeInFlight.current ||
      saveInFlight.current
    ) return;
    saveInFlight.current = true;
    // Once submitted, createCard's recovery journal may own the ticket even if
    // the operation rejects. Unmount cleanup must not discard that recovery data.
    submittedTicket.current = ticket?.ticketId || null;
    updateState({ status: "saving", message: "" });
    try {
      const result = await runtime.createCard({
        titleChoice: selectedTitleChoice || { kind: "PRIVATE_TITLE", displayTitle: title },
        ...(ticket
          ? { intakeTicketId: ticket.ticketId }
          : { catalogCoverRef: catalogCoverSelection.catalogCoverRef }),
        note: state.note,
        rightsConfirmed,
      });
      pendingTicket.current = null;
      submittedTicket.current = null;
      try {
        recordFirstMemoryViewSuggestion({ cardId: result.cardId, archive: await runtime.listArchive() });
      } catch {
        // Optional guidance must never turn a successful save into a failed save.
      }
      updateState({ savedCardId: result.cardId });
      try { onSaved(); } catch { /* Navigation guidance cannot reverse a saved Card. */ }
      savedCloudOptions.current = { accountUserId, includePhoto };
      await syncSavedCard(result.cardId, savedCloudOptions.current);
    } catch (error) {
      saveInFlight.current = false;
      if (!mounted.current) return;
      updateState({ status: "ready", message: errorCode(error?.code) });
    }
  };

  return {
    ...state,
    dirty: !state.savedCardId && Boolean(ticket || catalogCoverSelection || state.note
      || title !== state.initialTitle || titleChoiceKey(selectedTitleChoice) !== titleChoiceKey(state.initialTitleChoice)),
    busy,
    canSave: Boolean(
      runtime &&
      (ticket || catalogCoverSelection) &&
      title.trim() &&
      (catalogCoverSelection || (rightsConfirmed && accountUserId && privateImageUiEnabled())) &&
      (!catalogCoverSelection || state.note.trim()) &&
      !state.savedCardId &&
      !busy
    ),
    displayTitle: selectedTitleChoice?.displayTitle || title,
    chooseImage,
    receiveImage,
    reportImageError: (code) => updateState({ message: code }),
    useCatalogCover,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    removeCatalogCover,
    saveCard,
    retryAccountSave: () => state.savedCardId && savedCloudOptions.current
      ? syncSavedCard(state.savedCardId, savedCloudOptions.current) : Promise.resolve(),
    changeNote: (event) => updateState({ note: event.target.value }),
    changeRightsConfirmed: (event) => updateState({ rightsConfirmed: event.target.checked }),
  };
}
