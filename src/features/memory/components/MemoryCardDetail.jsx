import { useEffect, useReducer } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryImageReplacement from "./MemoryImageReplacement.jsx";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import "./memory-card-detail.css";

const INITIAL_STATE = Object.freeze({
  runtime: null,
  bundle: null,
  previewDataUrl: null,
  note: "",
  status: "loading",
  message: "",
});

const mergeState = (state, patch) => ({ ...state, ...patch });

export default function MemoryCardDetail() {
  const [state, updateState] = useReducer(mergeState, INITIAL_STATE);
  const { runtime, bundle, previewDataUrl, note, status, message } = state;

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
        message: "변경 내용을 이 기기에 저장했어요.",
        status: "ready",
      });
    } catch {
      updateState({
        message: "변경 내용을 저장하지 못했어요. 다시 시도해 주세요.",
        status: "ready",
      });
    }
  };

  const remove = async () => {
    if (!runtime || !bundle || status === "deleting") return;
    const confirmed = window.confirm(
      "이 카드를 기기에서 삭제할까요? 이미지와 감상도 함께 삭제되며 되돌릴 수 없어요.",
    );
    if (!confirmed) return;
    updateState({ status: "deleting", message: "" });
    try {
      await runtime.deleteCard(bundle.card.id);
      window.location.assign("/archive/index.html");
    } catch {
      updateState({
        message: "카드를 완전히 삭제하지 못했어요. 앱을 다시 열어 복구를 시도해 주세요.",
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
      message: result.cleanupPending
        ? "새 이미지를 이 기기에 저장했어요. 이전 이미지 정리는 앱을 다시 열 때 마무리합니다."
        : "새 이미지를 이 기기에 저장했어요.",
    } : {
      message: "새 이미지는 저장됐어요. 화면을 다시 열면 변경된 카드를 확인할 수 있어요.",
    });
  };

  if (status === "loading") {
    return <main className="memory-detail page-shell page-shell--narrow"><p>카드를 불러오고 있어요…</p></main>;
  }
  if (status === "not-found" || status === "error") {
    return (
      <main className="memory-detail page-shell page-shell--narrow">
        <section className="surface-card memory-detail__state">
          <h1>카드를 찾을 수 없어요.</h1>
          <a className="btn" href="/archive/index.html">Archive로 돌아가기</a>
        </section>
      </main>
    );
  }

  return (
    <main className="memory-detail page-shell page-shell--narrow">
      <header className="memory-detail__header">
        <a href="/archive/index.html">← Memory Archive</a>
        <span className="status-badge">Private · Local only</span>
      </header>
      <article className="surface-card memory-detail__card">
        {bundle.asset.designSpec ? (
          <SystemDesignPreview spec={bundle.asset.designSpec} title={bundle.title.displayTitle} />
        ) : previewDataUrl ? (
          <img src={previewDataUrl} alt={`${bundle.title.displayTitle} 메모리 카드`} />
        ) : (
          <div className="memory-detail__missing-image">이미지를 불러올 수 없어요.</div>
        )}
        <div className="memory-detail__body">
          <h1 className="pageTitle">{bundle.title.displayTitle}</h1>
          <MemoryImageReplacement
            runtime={runtime}
            imageMissing={!bundle.asset.designSpec && !previewDataUrl}
            disabled={status !== "ready"}
            onReplace={replaceImage}
            onBusyChange={(isBusy) => updateState({ status: isBusy ? "replacing" : "ready" })}
            onMessage={(nextMessage) => updateState({ message: nextMessage })}
          />
          <form onSubmit={save}>
            <label className="memory-detail__field">
              <span>짧은 감상</span>
              <textarea
                className="textarea"
                value={note}
                maxLength={500}
                rows={6}
                onChange={(event) => updateState({ note: event.target.value })}
              />
              <small>{note.length}/500</small>
            </label>
            {message && <p className="memory-detail__message" role="status">{message}</p>}
            <div className="memory-detail__actions">
              <button className="btn" type="submit" disabled={status !== "ready"}>
                {status === "saving" ? "저장 중…" : "변경 저장"}
              </button>
              <button
                className="btn btn--danger"
                type="button"
                disabled={status !== "ready"}
                onClick={remove}
              >
                {status === "deleting" ? "삭제 중…" : "카드 삭제"}
              </button>
            </div>
          </form>
        </div>
      </article>
    </main>
  );
}
