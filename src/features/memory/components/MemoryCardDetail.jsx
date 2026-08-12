import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import "./memory-card-detail.css";

export default function MemoryCardDetail() {
  const [runtime, setRuntime] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const cardId = new URLSearchParams(window.location.search).get("id");
    if (!cardId) {
      setStatus("not-found");
      return () => { active = false; };
    }
    getPlatformMemoryRuntime().then(async (activeRuntime) => {
      await activeRuntime.initialize();
      const cardBundle = await activeRuntime.getCard(cardId);
      if (!cardBundle) {
        if (active) setStatus("not-found");
        return;
      }
      const preview = await activeRuntime.getPreview(cardBundle.asset.localRef).catch(() => null);
      if (!active) return;
      setRuntime(activeRuntime);
      setBundle(cardBundle);
      setPreviewDataUrl(preview);
      setNote(cardBundle.card.note || "");
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (!runtime || !bundle || status === "saving") return;
    setStatus("saving");
    setMessage("");
    try {
      const card = await runtime.updateCard(bundle.card.id, { note });
      setBundle({ ...bundle, card });
      setNote(card.note || "");
      setMessage("변경 내용을 이 기기에 저장했어요.");
      setStatus("ready");
    } catch {
      setMessage("변경 내용을 저장하지 못했어요. 다시 시도해 주세요.");
      setStatus("ready");
    }
  };

  const remove = async () => {
    if (!runtime || !bundle || status === "deleting") return;
    const confirmed = window.confirm(
      "이 카드를 기기에서 삭제할까요? 이미지와 감상도 함께 삭제되며 되돌릴 수 없어요.",
    );
    if (!confirmed) return;
    setStatus("deleting");
    setMessage("");
    try {
      await runtime.deleteCard(bundle.card.id);
      window.location.assign("/archive/index.html");
    } catch {
      setMessage("카드를 완전히 삭제하지 못했어요. 앱을 다시 열어 복구를 시도해 주세요.");
      setStatus("ready");
    }
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
          <form onSubmit={save}>
            <label className="memory-detail__field">
              <span>짧은 감상</span>
              <textarea
                className="textarea"
                value={note}
                maxLength={500}
                rows={6}
                onChange={(event) => setNote(event.target.value)}
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
