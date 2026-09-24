import { useCallback, useEffect, useState } from "react";
import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
import { publicationLink } from "../domain/publicationView.js";
import { minihomeCopy } from "./minihomeCopy.js";
function Entry({ entry, services, locale, preview, onReady, base }) {
  const ready = useCallback((value) => onReady?.(entry.publicationId, value), [entry.publicationId, onReady]);
  return <article>
    <PublicBoardSnapshot snapshot={entry.snapshot} publicationId={entry.publicationId} services={services} locale={locale} preview={preview} onReady={ready} />
    <a href={publicationLink(entry.publicationId, base)} data-astro-reload>{locale === "ko" ? "공개 보드 열기" : "Open public Board"}</a>
  </article>;
}
export default function MinihomeSnapshot({ snapshot, services, locale, preview = false, onReady, base = "/" }) {
  const [ready, setReady] = useState({});
  const mark = useCallback((id, value) => setReady((current) => current[id] === value ? current : { ...current, [id]: value }), []);
  const complete = snapshot.entries.length > 0 && snapshot.entries.every((e) => ready[e.publicationId]);
  useEffect(() => { onReady?.(Boolean(complete)); }, [complete, onReady]);
  return <section aria-label={preview ? minihomeCopy(locale).preview : minihomeCopy(locale).visitor}>
    <header><h2>{snapshot.nickname}</h2>{snapshot.bio && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{snapshot.bio}</p>}</header>
    {!snapshot.entries.length && <p>{minihomeCopy(locale).noEntries}</p>}
    {snapshot.entries.map((entry) => <Entry key={entry.publicationId} entry={entry} services={services} locale={locale} preview={preview} onReady={mark} base={base} />)}
  </section>;
}
