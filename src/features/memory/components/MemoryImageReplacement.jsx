import { useEffect, useRef, useState } from "react";

const replacementErrorMessage = (code) => {
  const messages = {
    IMAGE_TOO_LARGE: "20MB 이하의 이미지를 선택해 주세요.",
    UNSUPPORTED_IMAGE_TYPE: "JPEG, PNG, WebP 이미지만 사용할 수 있어요.",
    IMAGE_DECODE_FAILED: "이 이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요.",
    MEDIA_STORAGE_FULL: "기기 저장 공간이 부족해요.",
    MEDIA_PROMOTION_FAILED: "새 이미지를 기기에 보관하지 못했어요.",
    OPERATION_IN_PROGRESS: "이미지 작업을 복구하고 있어요. 앱을 다시 열어 주세요.",
  };
  return messages[String(code || "")] || "이미지를 교체하지 못했어요. 기존 이미지는 그대로 보관됩니다.";
};

export default function MemoryImageReplacement({
  runtime,
  imageMissing,
  disabled,
  onReplace,
  onBusyChange,
  onMessage,
}) {
  const [ticket, setTicket] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingTicketRef = useRef(null);
  const actionInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const pickerGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pickerGenerationRef.current += 1;
      const ticketId = pendingTicketRef.current;
      if (ticketId && !submitInFlightRef.current) {
        pendingTicketRef.current = null;
        void runtime.releaseImageTicket(ticketId);
      }
    };
  }, [runtime]);

  const setWorking = (value) => {
    if (!mountedRef.current) return;
    setBusy(value);
    onBusyChange(value);
  };

  const beginAction = () => {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    setWorking(true);
    return true;
  };

  const finishAction = () => {
    actionInFlightRef.current = false;
    setWorking(false);
  };

  const chooseImage = async () => {
    if (disabled || !runtime.imageIntake.available || !beginAction()) return;
    const generation = pickerGenerationRef.current + 1;
    pickerGenerationRef.current = generation;
    onMessage("");
    try {
      const result = await runtime.imageIntake.pick();
      if (!mountedRef.current || pickerGenerationRef.current !== generation) {
        if (result.ticket) await runtime.releaseImageTicket(result.ticket.ticketId);
        return;
      }
      if (result.cancelled || !result.ticket) return;
      if (pendingTicketRef.current && pendingTicketRef.current !== result.ticket.ticketId) {
        const removed = await runtime.releaseImageTicket(pendingTicketRef.current);
        if (removed !== true) {
          onMessage("선택한 임시 이미지를 정리하지 못했어요. 다시 시도해 주세요.");
          return;
        }
      }
      pendingTicketRef.current = result.ticket.ticketId;
      setTicket(result.ticket);
      setRightsConfirmed(false);
    } catch (error) {
      if (mountedRef.current) onMessage(replacementErrorMessage(error?.code));
    } finally {
      finishAction();
    }
  };

  const cancel = async () => {
    if (!ticket || !beginAction()) return;
    const ticketId = ticket.ticketId;
    try {
      const removed = await runtime.releaseImageTicket(ticketId);
      if (removed !== true) {
        if (mountedRef.current) {
          onMessage("선택한 임시 이미지를 정리하지 못했어요. 다시 시도해 주세요.");
        }
        return;
      }
      pendingTicketRef.current = null;
      if (mountedRef.current) {
        setTicket(null);
        setRightsConfirmed(false);
        onMessage("");
      }
    } catch {
      if (mountedRef.current) {
        onMessage("선택한 임시 이미지를 정리하지 못했어요. 다시 시도해 주세요.");
      }
    } finally {
      finishAction();
    }
  };

  const replace = async () => {
    if (!ticket || !rightsConfirmed || disabled || !beginAction()) return;
    const replacementTicket = ticket;
    submitInFlightRef.current = true;
    onMessage("");
    try {
      await onReplace(replacementTicket);
      pendingTicketRef.current = null;
      if (mountedRef.current) {
        setTicket(null);
        setRightsConfirmed(false);
      }
    } catch (error) {
      if (error?.intakeTicketOwned === true) {
        pendingTicketRef.current = null;
        if (mountedRef.current) {
          setTicket(null);
          setRightsConfirmed(false);
        }
      } else if (!mountedRef.current) {
        pendingTicketRef.current = null;
        await runtime.releaseImageTicket(replacementTicket.ticketId);
      }
      if (mountedRef.current) onMessage(replacementErrorMessage(error?.code));
    } finally {
      submitInFlightRef.current = false;
      finishAction();
    }
  };

  return (
    <section className="memory-detail__replacement" aria-label="카드 이미지 관리">
      <div className="memory-detail__replacement-head">
        <div>
          <strong>{imageMissing ? "이미지를 다시 연결할 수 있어요" : "이 카드의 이미지를 바꿀 수 있어요"}</strong>
          <p>새 이미지가 안전하게 저장된 뒤에만 기존 이미지를 정리합니다.</p>
        </div>
        {!ticket && (
          <button
            className="btn btn--subtle"
            type="button"
            disabled={disabled || busy || !runtime.imageIntake.available}
            onClick={chooseImage}
          >
            {imageMissing ? "이미지 복구" : "이미지 교체"}
          </button>
        )}
      </div>

      {ticket && (
        <div className="memory-detail__replacement-review">
          <img src={ticket.previewDataUrl} alt="새 이미지 미리보기" />
          <div>
            <p>현재 카드에는 아직 적용되지 않았어요. 미리보기를 확인한 뒤 교체해 주세요.</p>
            <label className="memory-detail__rights">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                disabled={busy}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
              />
              <span>이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.</span>
            </label>
            <div className="memory-detail__replacement-actions">
              <button
                className="btn"
                type="button"
                disabled={!rightsConfirmed || busy || disabled}
                onClick={replace}
              >
                {busy ? "교체 중…" : "이 이미지로 교체"}
              </button>
              <button className="btn btn--subtle" type="button" disabled={busy} onClick={cancel}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {!runtime.imageIntake.available && (
        <p className="memory-detail__replacement-note">이미지 교체는 현재 Android 앱에서 사용할 수 있어요.</p>
      )}
    </section>
  );
}
