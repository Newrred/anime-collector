import { useEffect, useRef, useState } from "react";
import { useImageFileTransfer } from "./useImageFileTransfer.js";
import ImageInputHint from "./ImageInputHint.jsx";

export default function MemoryImageReplacement({
  runtime,
  imageMissing,
  disabled,
  active = true,
  onReplace,
  onBusyChange,
  onMessage,
  copy,
  inputCopy,
}) {
  const [ticket, setTicket] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingTicketRef = useRef(null);
  const actionInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const pickerGenerationRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) pickerGenerationRef.current += 1;
  }, [active]);

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

  const receiveImage = async (file) => {
    if (!active || disabled || !runtime.imageIntake.available || !beginAction()) return;
    const generation = pickerGenerationRef.current + 1;
    pickerGenerationRef.current = generation;
    const isCurrent = () => {
      const region = imageTransfer.regionRef.current;
      // A native <details> toggle hides its contents before React's onToggle
      // update. Do not adopt a late image during that event/render gap.
      return mountedRef.current && activeRef.current && pickerGenerationRef.current === generation
        && region?.getClientRects().length > 0 && !region.closest('[hidden], details:not([open])');
    };
    let incoming = null;
    onMessage("");
    try {
      const result = await (file ? runtime.imageIntake.ingestFile(file) : runtime.imageIntake.pick());
      incoming = result.ticket;
      if (!isCurrent()) return;
      if (result.cancelled || !result.ticket) return;
      if (pendingTicketRef.current && pendingTicketRef.current !== result.ticket.ticketId) {
        const removed = await runtime.releaseImageTicket(pendingTicketRef.current);
        if (removed === true) {
          pendingTicketRef.current = null;
          if (mountedRef.current) { setTicket(null); setRightsConfirmed(false); }
        }
        if (!isCurrent()) return;
        if (removed !== true) {
          onMessage({ scope: "replacement", key: "cleanupFailed" });
          return;
        }
      }
      pendingTicketRef.current = result.ticket.ticketId;
      setTicket(result.ticket);
      setRightsConfirmed(false);
      incoming = null;
    } catch (error) {
      if (isCurrent()) onMessage({ scope: "error", code: String(error?.code || "replacementFallback") });
    } finally {
      if (incoming && incoming.ticketId !== pendingTicketRef.current) await runtime.releaseImageTicket(incoming.ticketId);
      finishAction();
    }
  };
  const chooseImage = () => receiveImage();
  const webFileInput = typeof runtime.imageIntake.ingestFile === "function";
  const imageTransfer = useImageFileTransfer({
    active: active && webFileInput,
    disabled: disabled || busy,
    onFile: receiveImage,
    onError: code => onMessage({ scope: "error", code }),
  });

  const cancel = async () => {
    if (!ticket || !beginAction()) return;
    const ticketId = ticket.ticketId;
    try {
      const removed = await runtime.releaseImageTicket(ticketId);
      if (removed !== true) {
        if (mountedRef.current) {
          onMessage({ scope: "replacement", key: "cleanupFailed" });
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
        onMessage({ scope: "replacement", key: "cleanupFailed" });
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
      if (mountedRef.current) onMessage({ scope: "error", code: String(error?.code || "replacementFallback") });
    } finally {
      submitInFlightRef.current = false;
      finishAction();
    }
  };

  if (!runtime.imageIntake.available) {
    return <p className="memory-detail__replacement-note">{copy.androidOnly}</p>;
  }

  return (
    <section ref={imageTransfer.regionRef} {...imageTransfer.handlers} tabIndex={webFileInput ? 0 : undefined}
      className={`memory-detail__replacement memory-image-input${imageTransfer.dragging ? " is-dragging" : ""}`} aria-label={copy.regionLabel}>
      <div className="memory-detail__replacement-head">
        <div>
          <strong>{imageMissing ? copy.missingTitle : copy.replaceTitle}</strong>
          <p>{copy.safety}</p>
        </div>
        {!ticket && (
          <button
            className="btn btn--subtle"
            type="button"
            disabled={disabled || busy || !runtime.imageIntake.available}
            onClick={chooseImage}
          >
            {imageMissing ? copy.recover : copy.replace}
          </button>
        )}
      </div>

      {webFileInput && inputCopy && <ImageInputHint copy={inputCopy} dragging={imageTransfer.dragging} />}

      {ticket && (
        <div className="memory-detail__replacement-review">
          <img src={ticket.previewDataUrl} alt={copy.previewAlt} />
          <div>
            <p>{copy.review}</p>
            <label className="memory-detail__rights">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                disabled={busy}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
              />
              <span>{copy.rights}</span>
            </label>
            <div className="memory-detail__replacement-actions">
              <button
                className="btn"
                type="button"
                disabled={!rightsConfirmed || busy || disabled}
                onClick={replace}
              >
                {busy ? copy.replacing : copy.apply}
              </button>
              <button className="btn btn--subtle" type="button" disabled={busy} onClick={cancel}>
                {copy.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {!runtime.imageIntake.available && (
        <p className="memory-detail__replacement-note">{copy.androidOnly}</p>
      )}
    </section>
  );
}
