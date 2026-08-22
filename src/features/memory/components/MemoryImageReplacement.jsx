import { useEffect, useRef, useState } from "react";

export default function MemoryImageReplacement({
  runtime,
  imageMissing,
  disabled,
  onReplace,
  onBusyChange,
  onMessage,
  copy,
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
          onMessage({ scope: "replacement", key: "cleanupFailed" });
          return;
        }
      }
      pendingTicketRef.current = result.ticket.ticketId;
      setTicket(result.ticket);
      setRightsConfirmed(false);
    } catch (error) {
      if (mountedRef.current) onMessage({ scope: "error", code: String(error?.code || "replacementFallback") });
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

  return (
    <section className="memory-detail__replacement" aria-label={copy.regionLabel}>
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
