import { useEffect, useReducer, useRef } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";

const ERROR_MESSAGES = {
  IMAGE_TOO_LARGE: "20MB 이하의 이미지를 선택해 주세요.",
  UNSUPPORTED_IMAGE_TYPE: "JPEG, PNG, WebP 이미지만 사용할 수 있어요.",
  IMAGE_DECODE_FAILED: "이 이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요.",
  IMAGE_TOO_COMPLEX: "이미지가 너무 커서 미리보기를 만들 수 없어요.",
  UNSUPPORTED_SOURCE_URI: "이 앱에서 안전하게 읽을 수 있는 이미지가 아니에요.",
  PREVIEW_UNAVAILABLE: "이미지 미리보기를 불러오지 못했어요.",
  LOCAL_USE_CONFIRMATION_REQUIRED: "개인 기록 용도 확인이 필요해요.",
  MEDIA_STORAGE_FULL: "기기 저장 공간이 부족해요.",
  MEDIA_PROMOTION_FAILED: "이미지를 기기에 보관하지 못했어요. 다시 시도해 주세요.",
  OPERATION_IN_PROGRESS: "카드를 저장하고 있어요. 잠시만 기다려 주세요.",
};

const errorMessage = (code) => (
  ERROR_MESSAGES[String(code || "")] || "이미지를 가져오지 못했어요. 다시 시도해 주세요."
);

const INITIAL_STATE = Object.freeze({
  runtime: null,
  ticket: null,
  designSpec: null,
  status: "checking",
  message: "",
  title: "",
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
    if (requestedTitle) updateState({ title: requestedTitle });
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
          message: result.errorCode ? errorMessage(result.errorCode) : "",
        });
      } catch (error) {
        if (!active) return;
        updateState({ status: "error", message: errorMessage(error?.code) });
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
      updateState({ status: "error", message: errorMessage(error?.code) });
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
        updateState({ status: ticket ? "ready" : "empty" });
        return;
      }
      if (ticket && ticket.ticketId !== result.ticket.ticketId) {
        await runtime.imageIntake.discard(ticket.ticketId);
      }
      updateState({ ticket: result.ticket, designSpec: null, status: "ready" });
    } catch (error) {
      updateState({ status: "error", message: errorMessage(error?.code) });
    }
  };

  const useSystemDesign = async () => {
    if (!runtime || busy) return;
    updateState({ status: "processing", message: "" });
    try {
      if (ticket) await runtime.imageIntake.discard(ticket.ticketId);
      updateState({
        ticket: null,
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
      updateState({ status: "error", message: errorMessage(error?.code) });
    }
  };

  const changeTitle = (event) => {
    titleSearchGeneration.current += 1;
    updateState({
      title: event.target.value,
      selectedTitleChoice: null,
      titleResults: [],
      titleSearchStatus: "idle",
      remoteTitleStatus: "SKIPPED",
      ...(designSpec ? { designSpec: { ...designSpec, genreTokens: [] } } : {}),
    });
  };

  const searchTitles = async () => {
    if (!runtime || title.trim().length < 2 || titleSearchStatus === "searching") return;
    const generation = titleSearchGeneration.current + 1;
    titleSearchGeneration.current = generation;
    updateState({ titleSearchStatus: "searching" });
    try {
      const response = await runtime.searchTitles(title);
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
      updateState({ status: "error", message: errorMessage(error?.code) });
    }
  };

  const saveCard = async (event) => {
    event.preventDefault();
    if (
      !runtime ||
      (!ticket && !designSpec) ||
      !title.trim() ||
      (ticket && !rightsConfirmed) ||
      saveInFlight.current
    ) return;
    saveInFlight.current = true;
    updateState({ status: "saving", message: "" });
    try {
      await runtime.createCard({
        titleChoice: selectedTitleChoice || { kind: "PRIVATE_TITLE", displayTitle: title },
        ...(ticket ? { intakeTicketId: ticket.ticketId } : { systemDesignSpec: designSpec }),
        note: state.note,
        rightsConfirmed,
      });
      window.location.assign(`${base}archive/`);
    } catch (error) {
      saveInFlight.current = false;
      updateState({ status: "ready", message: errorMessage(error?.code) });
    }
  };

  return {
    ...state,
    busy,
    canSave: Boolean(
      runtime &&
      (ticket || designSpec) &&
      title.trim() &&
      (designSpec || rightsConfirmed) &&
      !busy
    ),
    displayTitle: selectedTitleChoice?.displayTitle || title,
    chooseImage,
    useSystemDesign,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    saveCard,
    changeNote: (event) => updateState({ note: event.target.value }),
    changeRightsConfirmed: (event) => updateState({ rightsConfirmed: event.target.checked }),
  };
}
