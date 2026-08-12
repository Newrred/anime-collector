import { useEffect, useMemo, useState } from "react";
import { createPlatformImageIntake } from "../adapters/platform/nativeImageIntake.js";
import "./memory-card-composer.css";

const ERROR_MESSAGES = {
  IMAGE_TOO_LARGE: "20MB 이하의 이미지를 선택해 주세요.",
  UNSUPPORTED_IMAGE_TYPE: "JPEG, PNG, WebP 이미지만 사용할 수 있어요.",
  IMAGE_DECODE_FAILED: "이 이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요.",
  IMAGE_TOO_COMPLEX: "이미지가 너무 커서 미리보기를 만들 수 없어요.",
  UNSUPPORTED_SOURCE_URI: "이 앱에서 안전하게 읽을 수 있는 이미지가 아니에요.",
  PREVIEW_UNAVAILABLE: "이미지 미리보기를 불러오지 못했어요.",
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
  const intake = useMemo(() => createPlatformImageIntake(), []);
  const [ticket, setTicket] = useState(null);
  const [status, setStatus] = useState(intake.available ? "checking" : "browser");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    if (!intake.available) return undefined;
    let active = true;
    let timer = null;

    const claim = async () => {
      try {
        const result = await intake.claim();
        if (!active) return;
        if (result.ticket) {
          setTicket(result.ticket);
          setStatus("ready");
          setMessage("");
          return;
        }
        if (result.processing) {
          setStatus("processing");
          timer = window.setTimeout(claim, 250);
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

    claim();
    return () => {
      active = false;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [intake]);

  const chooseImage = async () => {
    setStatus("picking");
    setMessage("");
    try {
      const result = await intake.pick();
      if (result.cancelled || !result.ticket) {
        setStatus(ticket ? "ready" : "empty");
        return;
      }
      if (ticket && ticket.ticketId !== result.ticket.ticketId) {
        await intake.discard(ticket.ticketId);
      }
      setTicket(result.ticket);
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
      await intake.discard(ticket.ticketId);
      setTicket(null);
      setStatus("empty");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error?.code));
    }
  };

  const busy = ["checking", "processing", "picking", "removing"].includes(status);

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
          <strong>현재 단계에서는 내 기기에만 임시 보관</strong>
          <span>원본 이미지의 주소와 저장 경로는 웹 화면에 전달되지 않아요.</span>
        </div>
      </section>

      <form className="surface-card memory-composer__form" onSubmit={(event) => event.preventDefault()}>
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

          {ticket ? (
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
              disabled={!intake.available || busy}
            >
              {ticket ? "다른 이미지 선택" : "이미지 선택"}
            </button>
            {ticket && (
              <button type="button" className="btn btn--subtle" onClick={removeImage} disabled={busy}>
                이미지 제거
              </button>
            )}
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

          <label className="memory-composer__rights">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(event) => setRightsConfirmed(event.target.checked)}
            />
            <span>이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.</span>
          </label>
        </div>

        <div className="memory-composer__save-gate">
          <button type="button" className="btn" disabled>
            카드 저장은 다음 단계에서 연결
          </button>
          <p>이번 슬라이스는 이미지 인입과 작성 화면 연결까지만 검증합니다.</p>
        </div>
      </form>
    </div>
  );
}
