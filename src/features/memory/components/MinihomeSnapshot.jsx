import { useCallback, useEffect, useState } from "react";
import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
import { publicationLink } from "../domain/publicationView.js";
import { minihomeCopy } from "./minihomeCopy.js";
import { homeEntryKey } from "../domain/minihomeView.js";
import PublicTitleShelf from "./PublicTitleShelf.jsx";
import CollectionGroupTabs from "../../../components/collection/CollectionGroupTabs.jsx";
function Entry({ entry, services, locale, preview, onReady, base }) {
  const id = homeEntryKey(entry);
  const ready = useCallback((value) => onReady?.(id, value), [id, onReady]);
  if (entry.kind === "TITLE_SHELF") return <article className="minihome-snapshot__entry"><PublicTitleShelf snapshot={entry.snapshot} services={services} locale={locale} base={base} onReady={ready} preview={preview} /></article>;
  return <article className="minihome-snapshot__entry">
    <PublicBoardSnapshot snapshot={entry.snapshot} publicationId={entry.publicationId} services={services} locale={locale} preview={preview} onReady={ready} />
    <a href={publicationLink(entry.publicationId, base)} data-astro-reload>{locale === "ko" ? "공개 보드 열기" : "Open public Board"}</a>
  </article>;
}
export default function MinihomeSnapshot({ snapshot, services, locale, preview = false, onReady, base = "/" }) {
  const [ready, setReady] = useState({});
  const [selected, setSelected] = useState("all");
  const mark = useCallback((id, value) => setReady((current) => current[id] === value ? current : { ...current, [id]: value }), []);
  const complete = snapshot.entries.length > 0 && snapshot.entries.every((e) => ready[homeEntryKey(e)]);
  useEffect(() => { onReady?.(Boolean(complete)); }, [complete, onReady]);
  return <section className="minihome-snapshot" aria-label={preview ? minihomeCopy(locale).preview : minihomeCopy(locale).visitor}>
    <header><h2>{snapshot.nickname}</h2>{snapshot.bio && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{snapshot.bio}</p>}</header>
    {!snapshot.entries.length && <p>{minihomeCopy(locale).noEntries}</p>}
    {!preview && snapshot.entries.length > 0 && <CollectionGroupTabs locale={locale} selected={selected} onSelect={setSelected} entries={snapshot.entries.map(e => ({key:homeEntryKey(e),kind:e.kind || "MEMORY_BOARD",label:e.snapshot.title,count:e.kind === "TITLE_SHELF" ? e.snapshot.titles.length : e.snapshot.cards.length}))} />}
    {snapshot.entries.filter(e => preview || selected === "all" || homeEntryKey(e) === selected).map((entry) => <Entry key={homeEntryKey(entry)} entry={entry} services={services} locale={locale} preview={preview} onReady={mark} base={base} />)}
  </section>;
}
