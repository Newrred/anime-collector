import { useEffect, useReducer, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import { recordFirstMemoryViewSuggestion } from "../../titles/application/firstMemoryViewSuggestion.js";

const titleChoiceKey = (choice) => choice ? JSON.stringify([choice.kind, choice.animeId, choice.privateTitleId, choice.anilistId, choice.displayTitle]) : "";
const errorCode = (code) => String(code || "fallback");

const INITIAL_STATE = Object.freeze({
  runtime: null,
  ticket: null,
  designSpec: null,
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
});

const mergeState = (state, patch) => ({ ...state, ...patch });

export function useMemoryCardComposer({ base = "/" } = {}) {
  const saveInFlight = useRef(false);
  const titleSearchGeneration = useRef(0);
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const {
    runtime,
    ticket,
    designSpec,
    catalogCoverSelection,
    status,
    title,
    selectedTitleChoice,
    titleSearchStatus,
    rightsConfirmed,
  } = state;

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

  const busy = ["checking", "processing", "picking", "removing", "saving"].includes(status);

  const chooseImage = async () => {
    updateState({ status: "picking", message: "" });
    try {
      const result = await runtime.imageIntake.pick();
      if (result.cancelled || !result.ticket) {
        updateState({ status: ticket || catalogCoverSelection || designSpec ? "ready" : "empty" });
        return;
      }
      if (ticket && ticket.ticketId !== result.ticket.ticketId) {
        await runtime.imageIntake.discard(ticket.ticketId);
      }
      updateState({ ticket: result.ticket, designSpec: null, catalogCoverSelection: null, rightsConfirmed: false, status: "ready" });
    } catch (error) {
      updateState({ status: "error", message: errorCode(error?.code) });
    }
  };

  const useSystemDesign = async () => {
    if (!runtime || busy) return;
    updateState({ status: "processing", message: "" });
    try {
      if (ticket) await runtime.imageIntake.discard(ticket.ticketId);
      updateState({
        ticket: null,
        catalogCoverSelection: null,
        rightsConfirmed: false,
        designSpec: {
          version: 1,
          templateId: "memory-gradient",
          paletteId: "violet-dawn",
          patternSeed: globalThis.crypto.randomUUID(),
          titleLayout: "BOTTOM_LEFT",
          genreTokens: selectedTitleChoice?.genres || [],
        },
        status: "ready",
      });
    } catch (error) {
      updateState({ status: "error", message: errorCode(error?.code) });
    }
  };

  const useCatalogCover = async () => {
    const coverPreviewUrl = String(selectedTitleChoice?.coverPreviewUrl || "");
    const catalogCoverRef = selectedTitleChoice?.catalogCoverRef;
    if (!runtime || busy || !coverPreviewUrl || !catalogCoverRef) return;
    updateState({ status: "processing", message: "" });
    try {
      if (ticket) await runtime.imageIntake.discard(ticket.ticketId);
      updateState({
        ticket: null,
        designSpec: null,
        rightsConfirmed: false,
        catalogCoverSelection: {
          previewUrl: coverPreviewUrl,
          catalogCoverRef: structuredClone(catalogCoverRef),
        },
        status: "ready",
      });
    } catch (error) {
      updateState({ status: "error", message: errorCode(error?.code) });
    }
  };

  const removeCatalogCover = () => {
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
      ...(designSpec ? { designSpec: { ...designSpec, genreTokens: [] } } : {}),
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
      ...(designSpec
        ? { designSpec: { ...designSpec, genreTokens: safeCandidate.genres || [] } }
        : {}),
    });
  };

  const clearSelectedTitle = () => {
    updateState({
      selectedTitleChoice: null,
      titleResults: [],
      titleSearchStatus: "idle",
      remoteTitleStatus: "SKIPPED",
      catalogCoverSelection: null,
      ...(designSpec ? { designSpec: { ...designSpec, genreTokens: [] } } : {}),
    });
  };

  const removeImage = async () => {
    if (!ticket) return;
    updateState({ status: "removing" });
    try {
      await runtime.imageIntake.discard(ticket.ticketId);
      updateState({ ticket: null, status: "empty", message: "" });
    } catch (error) {
      updateState({ status: "error", message: errorCode(error?.code) });
    }
  };

  const saveCard = async (event, onSaved = () => {}) => {
    event.preventDefault();
    if (
      !runtime ||
      (!ticket && !designSpec && !catalogCoverSelection) ||
      !title.trim() ||
      (ticket && !rightsConfirmed) ||
      saveInFlight.current
    ) return;
    saveInFlight.current = true;
    updateState({ status: "saving", message: "" });
    try {
      const result = await runtime.createCard({
        titleChoice: selectedTitleChoice || { kind: "PRIVATE_TITLE", displayTitle: title },
        ...(ticket
          ? { intakeTicketId: ticket.ticketId }
          : designSpec
            ? { systemDesignSpec: designSpec }
            : { catalogCoverRef: catalogCoverSelection.catalogCoverRef }),
        note: state.note,
        rightsConfirmed,
      });
      try {
        recordFirstMemoryViewSuggestion({ cardId: result.cardId, archive: await runtime.listArchive() });
      } catch {
        // Optional guidance must never turn a successful save into a failed save.
      }
      onSaved();
      window.location.assign(toPlatformAppHref(`${base}archive/`, {
        native: Capacitor.isNativePlatform(),
        origin: window.location.origin,
      }));
    } catch (error) {
      saveInFlight.current = false;
      updateState({ status: "ready", message: errorCode(error?.code) });
    }
  };

  return {
    ...state,
    dirty: Boolean(ticket || designSpec || catalogCoverSelection || state.note
      || title !== state.initialTitle || titleChoiceKey(selectedTitleChoice) !== titleChoiceKey(state.initialTitleChoice)),
    busy,
    canSave: Boolean(
      runtime &&
      (ticket || designSpec || catalogCoverSelection) &&
      title.trim() &&
      (designSpec || catalogCoverSelection || rightsConfirmed) &&
      (!catalogCoverSelection || state.note.trim()) &&
      !busy
    ),
    displayTitle: selectedTitleChoice?.displayTitle || title,
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
    changeNote: (event) => updateState({ note: event.target.value }),
    changeRightsConfirmed: (event) => updateState({ rightsConfirmed: event.target.checked }),
  };
}
