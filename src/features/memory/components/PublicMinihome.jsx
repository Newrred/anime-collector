import { useEffect, useState } from "react";
import { useUiPreferences } from "../../../hooks/useUiPreferences.js";
import { getPublicationServices, minihomeUiEnabled } from "../runtime/platformPublication.js";
import { isPublicationId } from "../domain/publicationView.js";
import { minihomeSnapshot } from "../domain/minihomeView.js";
import MinihomeSnapshot from "./MinihomeSnapshot.jsx";
import MemoryRelationships from "./MemoryRelationships.jsx";
import PublicLinkCopy from "./PublicLinkCopy.jsx";
import MemorySafety from "./MemorySafety.jsx";
import { minihomeCopy } from "./minihomeCopy.js";
export default function PublicMinihome({ base = "/" }) {
  const { locale } = useUiPreferences(), copy = minihomeCopy(locale), services = getPublicationServices();
  const [state, setState] = useState({ status: "loading", snapshot: null }), [retry, setRetry] = useState(0);
  const id = new URLSearchParams(globalThis.location?.search).get("id");
  useEffect(() => {
    const request = new AbortController();
    const timeout = setTimeout(() => { request.abort(); setState({ status: "failed", snapshot: null }); }, 20000);
    const read = async () => {
      setState({ status: "loading", snapshot: null });
      if (!minihomeUiEnabled() || !services.enabled) { setState({ status: "disabled", snapshot: null }); return; }
      if (!isPublicationId(id)) { setState({ status: "unavailable", snapshot: null }); return; }
      try {
        const result = await services.reader.readHome(id, { signal: request.signal });
        if (request.signal.aborted) return;
        if (result && result.id !== id) throw new Error("INVALID_RESPONSE");
        setState(result ? { status: "ready", snapshot: minihomeSnapshot(result) } : { status: "unavailable", snapshot: null });
      } catch { if (!request.signal.aborted) setState({ status: "failed", snapshot: null }); }
    };
    read().finally(() => clearTimeout(timeout));
    const recheck = () => { if (document.visibilityState === "visible") setRetry((n) => n + 1); };
    window.addEventListener("pageshow", recheck); document.addEventListener("visibilitychange", recheck);
    return () => { clearTimeout(timeout); request.abort(); window.removeEventListener("pageshow", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, [id, retry, services]);
  return <main className="public-memory-board page-shell page-shell--narrow"><a href={base}>MOEMOA</a><h1>{copy.visitor}</h1>
    {state.status === "ready" ? <MinihomeSnapshot key={retry} snapshot={state.snapshot} services={services} locale={locale} base={base} /> : <p role={state.status === "failed" ? "alert" : "status"}>{copy[state.status]}</p>}
    <button className="btn btn--subtle" disabled={state.status === "loading"} onClick={() => setRetry((n) => n + 1)}>{copy.retry}</button>
    {state.status === "ready" && <PublicLinkCopy key={id} kind="home" id={id} locale={locale} base={base} />}
    {minihomeUiEnabled() && isPublicationId(id) && <MemoryRelationships homeId={id} locale={locale} base={base} />}
    {minihomeUiEnabled() && isPublicationId(id) && <MemorySafety kind="home" target={id} locale={locale} base={base} />}
  </main>;
}
