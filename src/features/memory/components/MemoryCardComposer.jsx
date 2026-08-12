import { useEffect, useRef, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import "./memory-card-composer.css";

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

const errorMessage = (code) =>
  ERROR_MESSAGES[String(code || "")] || "이미지를 가져오지 못했어요. 다시 시도해 주세요.";

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export default function MemoryCardComposer() {
  const saveInFlight = useRef(false);
  const [runtime, setRuntime] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [designSpec, setDesignSpec] = useState(null);
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer = null;

    const claim = async (activeRuntime) => {
      try {
        const result = await activeRuntime.imageIntake.claim();
        if (!active) return;
        if (result.ticket) {
          setTicket(result.ticket);
          setStatus("ready");
          setMessage("");
          return;
        }
        if (result.processing) {
          setStatus("processing");
          timer = window.setTimeout(() => claim(activeRuntime), 250);
          return;
        }
        setStatus(result.errorCode ? "error" : "empty");
        setMessage(result.errorCode ? errorMessage(result.errorCode) : "");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(errorMessage(error?.code));
      }
    };

    getPlatformMemoryRuntime().then(async (activeRuntime) => {
      if (!active) return;
      await activeRuntime.initialize();
      if (!active) return;
      setRuntime(activeRuntime);
      if (!activeRuntime.imageIntake.available) {
        setStatus("browser");
        return;
      }
      claim(activeRuntime);
    }).catch((error) => {
      if (!active) return;
      setStatus("error");
      setMessage(errorMessage(error?.code));
    });
    return () => {
      active = false;
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  const chooseImage = async () => {
    setStatus("picking");
    setMessage("");
    try {
      const result = await runtime.imageIntake.pick();
      if (result.cancelled || !result.ticket) {
        setStatus(ticket ? "ready" : "empty");
        return;
      }
      if (ticket && ticket.ticketId !== result.ticket.ticketId) {
        await runtime.imageIntake.discard(ticket.ticketId);
      }
      setTicket(result.ticket);
      setDesignSpec(null);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error?.code));
    }
  };

  const useSystemDesign = async () => {
    if (!runtime || busy) return;
    setStatus("processing");
    setMessage("");
    try {
      if (ticket) await runtime.imageIntake.discard(ticket.ticketId);
      setTicket(null);
      setRightsConfirmed(false);
      setDesignSpec({
        version: 1,
        templateId: "memory-gradient",
        paletteId: "violet-dawn",
        patternSeed: globalThis.crypto.randomUUID(),
        titleLayout: "BOTTOM_LEFT",
        genreTokens: [],
      });
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error?.code));
    }
  };

  const removeImage = async () => {
    if (!ticket) return;
    setStatus("removing");
    try {
      await runtime.imageIntake.discard(ticket.ticketId);
      setTicket(null);
      setStatus("empty");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error?.code));
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
    setStatus("saving");
    setMessage("");
    try {
      await runtime.createCard({
        titleChoice: { kind: "PRIVATE_TITLE", displayTitle: title },
        ...(ticket ? { intakeTicketId: ticket.ticketId } : { systemDesignSpec: designSpec }),
        note,
        rightsConfirmed,
      });
      window.location.assign("/archive/index.html");
    } catch (error) {
      saveInFlight.current = false;
      setStatus("ready");
      setMessage(errorMessage(error?.code));
    }
  };

  const busy = ["checking", "processing", "picking", "removing", "saving"].includes(status);
  const canSave = Boolean(
    runtime &&
    (ticket || designSpec) &&
    title.trim() &&
    (designSpec || rightsConfirmed) &&
    !busy,
  );

  return (
    <div className="memory-composer page-shell page-shell--narrow">
      <header className="memory-composer__header">
        <a className="memory-composer__back" href="/">MOEMOA</a>
        <span className="status-badge">Private vertical slice</span>
      </header>

      <section className="surface-card memory-composer__intro">
        <div className="pageHeader">
          <p className="memory-composer__eyebrow">한 장면에서 시작하는 개인 기록</p>
          <h1 className="pageTitle">나만의 애니 메모리 카드</h1>
          <p className="pageLead">
            기억하고 싶은 장면과 짧은 감상을 한 장의 카드로 정리해 보세요.
          </p>
        </div>
        <div className="memory-composer__privacy">
          <strong>내 기기에만 비공개로 저장</strong>
          <span>서버 업로드 없이 앱 전용 공간에 보관하며 원본 경로는 웹 화면에 전달되지 않아요.</span>
        </div>
      </section>

      <form className="surface-card memory-composer__form" onSubmit={saveCard}>
        <section className="memory-composer__image-section" aria-labelledby="memory-image-heading">
          <div className="memory-composer__section-head">
            <div>
              <h2 id="memory-image-heading">기억할 장면</h2>
              <p>시스템 사진 선택기나 다른 앱의 공유 메뉴에서 한 장을 가져올 수 있어요.</p>
            </div>
            {ticket && (
              <span className="status-badge">
                {ticket.width}×{ticket.height} · {formatBytes(ticket.byteSize)}
              </span>
            )}
          </div>

          {designSpec ? (
            <SystemDesignPreview
              className="memory-composer__preview memory-composer__system-preview"
              spec={designSpec}
              title={title}
            />
          ) : ticket ? (
            <div className="memory-composer__preview-wrap">
              <img
                className="memory-composer__preview"
                src={ticket.previewDataUrl}
                alt={title ? `${title} 메모리 카드 미리보기` : "선택한 이미지 미리보기"}
              />
            </div>
          ) : (
            <div className="memory-composer__empty-image">
              <span aria-hidden="true">＋</span>
              <p>
                {status === "browser"
                  ? "이미지 가져오기는 현재 Android 앱에서만 사용할 수 있어요."
                  : busy
                    ? "이미지를 안전하게 준비하고 있어요…"
                    : "아직 선택한 이미지가 없어요."}
              </p>
            </div>
          )}

          {message && <p className="memory-composer__error" role="alert">{message}</p>}

          <div className="action-row memory-composer__image-actions">
            <button
              type="button"
              className="btn"
              onClick={chooseImage}
              disabled={!runtime?.imageIntake.available || busy}
            >
              {ticket ? "다른 이미지 선택" : "이미지 선택"}
            </button>
            {ticket && (
              <button type="button" className="btn btn--subtle" onClick={removeImage} disabled={busy}>
                이미지 제거
              </button>
            )}
            <button
              type="button"
              className="btn btn--subtle"
              onClick={useSystemDesign}
              disabled={!runtime || busy}
            >
              시스템 디자인 사용
            </button>
          </div>
        </section>

        <div className="memory-composer__fields">
          <label className="memory-composer__field">
            <span>작품 또는 카드 제목</span>
            <input
              className="input"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 프리렌 — 다시 만날 날을 기억하며"
            />
          </label>

          <label className="memory-composer__field">
            <span>짧은 감상</span>
            <textarea
              className="textarea"
              value={note}
              maxLength={500}
              rows={5}
              onChange={(event) => setNote(event.target.value)}
              placeholder="이 장면을 남기고 싶은 이유를 적어보세요."
            />
            <small>{note.length}/500</small>
          </label>

          {ticket ? (
            <label className="memory-composer__rights">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
              />
              <span>이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.</span>
            </label>
          ) : designSpec ? (
            <p className="memory-composer__rights">
              시스템 디자인은 이미지 파일 대신 재현 가능한 디자인 정보만 저장합니다.
            </p>
          ) : null}
        </div>

        <div className="memory-composer__save-gate">
          <button type="submit" className="btn" disabled={!canSave}>
            {status === "saving" ? "카드 저장 중…" : "카드 저장"}
          </button>
          <p>저장하면 이 기기의 비공개 Archive에서 바로 다시 볼 수 있어요.</p>
        </div>
      </form>
    </div>
  );
}
