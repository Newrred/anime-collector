import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { retirePublicationBeforeDelete } from "../application/retirePublicationBeforeDelete.js";
import { getPublicationServices, publicationUiEnabled } from "../runtime/platformPublication.js";
import { publicationCopy, publicationError } from "./publicationCopy.js";

export default function MemoryPublicCardControl({ card, locale, disabled }) {
  const auth = useAuthSession(), copy = publicationCopy(locale);
  const [state, setState] = useState({ busy: false, done: false, error: null });
  const request = useRef(null);
  useEffect(() => () => { request.current?.abort(); }, [card.id, card.ownerId]);
  if (!publicationUiEnabled() || card.ownerId !== `account:${auth.user?.id}` || !(card.sync?.remoteVersion > 0)) return null;
  const stop = async () => {
    if (request.current || !confirm(copy.revokeCardConfirm)) return;
    const abort = new AbortController(); request.current = abort;
    setState({ busy: true, done: false, error: null });
    const timeout = setTimeout(() => {
      if (!abort.signal.aborted) setState({ busy: false, done: false, error: "PUBLICATION_REQUEST_FAILED" });
      abort.abort();
    }, 20000);
    try {
      const services = getPublicationServices();
      await retirePublicationBeforeDelete({ card, ownerId: card.ownerId, gateway: services.gateway,
        getSession: services.getSession, signal: abort.signal });
      if (!abort.signal.aborted) setState({ busy: false, done: true, error: null });
    } catch (error) {
      if (!abort.signal.aborted) setState({ busy: false, done: false, error: error.code || "PUBLICATION_REQUEST_FAILED" });
    } finally {
      clearTimeout(timeout);
      if (request.current === abort) request.current = null;
    }
  };
  return <div>
    <button className="btn btn--subtle" type="button" disabled={disabled || state.busy} onClick={stop}>{copy.revokeCard}</button>
    {state.done && <p role="status">{copy.cardRevoked}</p>}
    {state.error && <p role="alert">{publicationError(state.error, locale)}</p>}
  </div>;
}
