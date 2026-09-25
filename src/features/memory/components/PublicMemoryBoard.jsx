import { useEffect, useState } from "react";
import PublicLinkCopy from "./PublicLinkCopy.jsx";
import MemorySafety from "./MemorySafety.jsx";
import { useUiPreferences } from "../../../hooks/useUiPreferences.js";
import { getPublicationServices } from "../runtime/platformPublication.js";
import { isPublicationId, publicationSnapshot, publicationAuthor } from "../domain/publicationView.js";
import { minihomeLink } from "../domain/minihomeView.js";
import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
import { publicationCopy } from "./publicationCopy.js";

export default function PublicMemoryBoard({ base = "/" }) {
  const { locale } = useUiPreferences(), copy = publicationCopy(locale);
  const [state, setState] = useState({ status: "loading", snapshot: null });
  const [retry, setRetry] = useState(0);
  const services = getPublicationServices();
  const id = new URLSearchParams(globalThis.location?.search || "").get("id");
  useEffect(() => {
    const request = new AbortController();
    const timeout = setTimeout(() => {
      request.abort(); setState({ status: "error", snapshot: null });
    }, 20000);
    const read = async () => {
      setState({ status: "loading", snapshot: null });
      if (!services.enabled) { setState({ status: "disabled", snapshot: null }); return; }
      if (!isPublicationId(id)) { setState({ status: "unavailable", snapshot: null }); return; }
      try {
        const result = await services.reader.read(id, { signal: request.signal });
        if (request.signal.aborted) return;
        if (result && result.id !== id) throw new Error("PUBLICATION_RESPONSE_INVALID");
        const author = result ? publicationAuthor(await services.reader.readAuthor(id, { signal: request.signal })) : null;
        if (request.signal.aborted) return;
        setState(result ? { status: "ready", snapshot: publicationSnapshot(result), author } : { status: "unavailable", snapshot: null });
      } catch {
        if (!request.signal.aborted) setState({ status: "error", snapshot: null });
      }
    };
    read().finally(() => clearTimeout(timeout));
    const recheck = () => { if (document.visibilityState === "visible") setRetry((value) => value + 1); };
    window.addEventListener("pageshow", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => { clearTimeout(timeout); request.abort(); window.removeEventListener("pageshow", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, [id, retry, services]);
  return <main className="public-memory-board page-shell page-shell--wide">
    <header><a href={base}>MOEMOA</a><h1>{copy.title}</h1></header>
    {state.status === "ready" ? <PublicBoardSnapshot snapshot={state.snapshot} publicationId={id} services={services} locale={locale} />
      : <p role={state.status === "error" ? "alert" : "status"}>{state.status === "loading" ? copy.loading
        : state.status === "disabled" ? copy.disabled : state.status === "error" ? copy.failed : copy.unavailable}</p>}
    {state.status === "ready" && <PublicLinkCopy key={id} kind="board" id={id} locale={locale} base={base} />}
    {state.status === "ready" && state.author && <a href={minihomeLink(state.author.id, base)} data-astro-reload>
      {locale === "ko" ? `${state.author.nickname}님의 공개 미니홈` : `Visit ${state.author.nickname}'s public home`}
    </a>}
    {state.status !== "loading" && state.status !== "disabled" && <button type="button" className="btn btn--subtle"
      onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>}
    {isPublicationId(id) && <MemorySafety kind="board" target={id} locale={locale} base={base} />}
  </main>;
}
