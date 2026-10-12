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
import PublicPageHeading from './PublicPageHeading.jsx';
export default function PublicMinihome({ base = "/" }) {
  const { locale } = useUiPreferences(), copy = minihomeCopy(locale), services = getPublicationServices();
  const [state, setState] = useState({ status: "loading", snapshot: null }), [retry, setRetry] = useState(0);
  const id = new URLSearchParams(globalThis.location?.search).get("id");
  useEffect(() => {
    const request = new AbortController();
    let unsubscribeViewer;
    const timeout = setTimeout(() => { request.abort(); setState({ status: "failed", snapshot: null }); }, 20000);
    const read = async () => {
      setState({ status: "loading", snapshot: null });
      if (!minihomeUiEnabled() || !services.enabled) { setState({ status: "disabled", snapshot: null }); return; }
      if (!isPublicationId(id)) { setState({ status: "unavailable", snapshot: null }); return; }
      try {
        if(services.subscribeViewer) {
          unsubscribeViewer=await services.subscribeViewer(()=>{
            request.abort();setState({status:'loading',snapshot:null});setRetry(n=>n+1);
          });
          if(request.signal.aborted) {unsubscribeViewer?.();return;}
        }
        const result = await services.reader.readHome(id, { signal: request.signal });
        if (request.signal.aborted) return;
        if (result && result.id !== id) throw new Error("INVALID_RESPONSE");
        setState(result ? { status: "ready", snapshot: minihomeSnapshot(result) } : { status: "unavailable", snapshot: null });
      } catch { if (!request.signal.aborted) setState({ status: "failed", snapshot: null }); }
    };
    read().finally(() => clearTimeout(timeout));
    const recheck = () => { if (document.visibilityState === "visible") setRetry((n) => n + 1); };
    window.addEventListener("pageshow", recheck); document.addEventListener("visibilitychange", recheck);
    return () => { clearTimeout(timeout); request.abort(); unsubscribeViewer?.(); window.removeEventListener("pageshow", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, [id, retry, services]);
  return <main className="public-memory-board page-shell page-shell--wide">
    <PublicPageHeading title={copy.visitor} base={base} />
    <div className="public-page-layout"><div className="public-page-content">
    {state.status === "ready" ? <MinihomeSnapshot key={retry} snapshot={state.snapshot} services={services} locale={locale} base={base} /> : <p className="public-page-state" role={state.status === "failed" ? "alert" : "status"}>{copy[state.status]}</p>}
    </div><aside className="public-page-tools" aria-label={locale === 'ko' ? '미니홈 관계와 신고' : 'Home relationships and reporting'}>
    {['failed', 'ready'].includes(state.status) && <button className="btn btn--subtle" onClick={() => setRetry((n) => n + 1)}>{state.status === 'ready' ? (locale === 'ko' ? '새로고침' : 'Refresh') : copy.retry}</button>}
    {state.status === 'unavailable' && <a href={base}>{locale === 'ko' ? '컬렉션으로 돌아가기 →' : 'Return to Collection →'}</a>}
    {state.status === "ready" && <PublicLinkCopy key={id} kind="home" id={id} locale={locale} base={base} />}
    {minihomeUiEnabled() && isPublicationId(id) && <MemoryRelationships homeId={id} locale={locale} base={base} />}
    {minihomeUiEnabled() && isPublicationId(id) && <MemorySafety kind="home" target={id} locale={locale} base={base} />}
    </aside></div>
  </main>;
}
