import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import { getPublicationServices, minihomeUiEnabled } from "../runtime/platformPublication.js";
import { createMinihomeController } from "../application/createMinihomeController.js";
import { minihomeLink } from "../domain/minihomeView.js";
import { publicationError } from "./publicationCopy.js";
import { minihomeCopy } from "./minihomeCopy.js";
import MinihomeSnapshot from "./MinihomeSnapshot.jsx";
import MemoryRelationships from "./MemoryRelationships.jsx";
import PublicLinkCopy from "./PublicLinkCopy.jsx";
import MemorySafety from "./MemorySafety.jsx";
import "./memory-publication.css";

function Review({ review, controller, services, locale, busy, base }) {
  const copy = minihomeCopy(locale), [consented, setConsented] = useState(false), [ready, setReady] = useState(false);
  return <>
    <MinihomeSnapshot snapshot={review.snapshot} services={services} locale={locale} preview onReady={setReady} base={base} />
    <p>{locale === "ko" ? "정책 버전" : "Policy version"}: {review.policyRevision}</p>
    <label className="memory-publication__check"><input type="checkbox" checked={consented} disabled={busy} onChange={(e) => setConsented(e.target.checked)} />{copy.consent}</label>
    <button className="btn" disabled={busy || !consented || !ready} onClick={() => controller.publish({ consented, visualsReady: ready })}>{copy.publish}</button>
    <button className="btn btn--subtle" disabled={busy} onClick={() => controller.cancel()}>{copy.cancel}</button>
  </>;
}
function Editor({ userId, locale, base }) {
  const services = getPublicationServices(), copy = minihomeCopy(locale);
  const controller = useMemo(() => createMinihomeController({ userId, gateway: services.gateway, getSession: services.getSession }), [userId, services]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [nickname, setNickname] = useState(""), [bio, setBio] = useState(""), [entries, setEntries] = useState([]);
  useUnsavedNavigation(Boolean(nickname || bio || entries.length) && state.phase !== "published", locale, { busy: state.busy });
  useEffect(() => { controller.load(); return () => controller.dispose(); }, [controller]);
  const change = (fn) => { controller.cancel(); fn(); };
  return <section className="memory-publication memory-minihome" aria-busy={state.busy}>
    <p>{copy.intro}</p>
    {state.busy && <p role="status">{copy.loading}</p>}
    {state.error && <p role="alert">{state.error === "INVALID_SELECTION" ? copy.invalid : publicationError(state.error, locale)} <button className="btn btn--subtle" disabled={state.busy} onClick={() => controller.load()}>{copy.retry}</button></p>}
    {state.home?.published && <p role="status">{copy.published} <a data-astro-reload href={minihomeLink(state.home.id, base)}>{copy.visit}</a></p>}
    {state.home?.published && <PublicLinkCopy key={state.home.id} kind="home" id={state.home.id} locale={locale} base={base} />}
    {state.phase === "revoked" && <p role="status">{copy.revoked}</p>}
    {state.home && <button className="btn btn--subtle" disabled={state.busy} onClick={() => { if (confirm(copy.confirm)) controller.revoke(); }}>{copy.withdraw}</button>}
    {state.review ? <Review key={state.review.reviewHash} review={state.review} controller={controller} services={services} locale={locale} busy={state.busy} base={base} /> : <form onSubmit={(e) => { e.preventDefault(); controller.prepare({ nickname, bio, entries }); }}>
      <fieldset disabled={state.busy}>
        <label>{copy.nickname}<input required maxLength={60} value={nickname} onChange={(e) => change(() => setNickname(e.target.value))} /></label>
        <label>{copy.bio}<textarea rows={3} maxLength={500} value={bio} onChange={(e) => change(() => setBio(e.target.value))} /></label>
        {!state.boards.length && !state.busy && <p>{copy.empty} <a href={`${base}boards/`}>{copy.boards}</a></p>}
        <ol className="memory-publication__selection">{state.boards.map((board) => {
          const selected = entries.find((e) => e.publicationId === board.id);
          return <li key={board.id}><div><h3>{board.title}</h3>
            <label className="memory-publication__check"><input type="checkbox" checked={Boolean(selected)} disabled={!selected && entries.length >= 10}
              onChange={(e) => { const checked = e.target.checked; change(() => setEntries((current) => checked ? [...current, { publicationId: board.id }] : current.filter((item) => item.publicationId !== board.id))); }} />{copy.choose}</label>
            {selected && <label>{copy.representative}<select aria-label={copy.representative} value={selected.cardId || ""} onChange={(e) => { const value = e.target.value; change(() => setEntries((current) => current.map((item) => item.publicationId !== board.id ? item : { publicationId: board.id, ...(value ? { cardId: value } : {}) }))); }}>
              <option value="">{copy.whole}</option>{board.cards.map((card, i) => <option key={card.id} value={card.id}>{i + 1}. {card.title}{card.note ? ` — ${card.note.slice(0, 60)}` : ""}</option>)}
            </select></label>}
          </div></li>;
        })}</ol>
        {state.next && <button type="button" className="btn btn--subtle" onClick={() => controller.more()}>{copy.more}</button>}
        <ol>{entries.map((entry, i) => <li key={entry.publicationId}>
          {state.boards.find((b) => b.id === entry.publicationId)?.title}
          {[-1, 1].map((direction) => <button type="button" className="btn btn--subtle" key={direction} disabled={i + direction < 0 || i + direction >= entries.length} onClick={() => change(() => setEntries((current) => { const next = [...current]; [next[i], next[i + direction]] = [next[i + direction], next[i]]; return next; }))}>{direction < 0 ? copy.up : copy.down}</button>)}
        </li>)}</ol>
        <button type="submit" className="btn" disabled={!nickname.trim() || !entries.length}>{copy.preview}</button>
      </fieldset>
    </form>}
    {state.busy && !["publishing", "revoking"].includes(state.phase) && <button className="btn btn--subtle" onClick={() => controller.cancel()}>{copy.cancel}</button>}
  </section>;
}
function Content({ base }) {
  const { locale } = useMemoryRouteUi(), auth = useAuthSession(), copy = minihomeCopy(locale);
  return <main className="page-shell page-shell--narrow"><h1>{copy.title}</h1><a href={`${base}boards/`}>{copy.boards}</a>
    <div id="following"><MemoryRelationships locale={locale} base={base} /></div>
    <MemorySafety locale={locale} base={base} />
    {!minihomeUiEnabled() ? <p>{copy.disabled}</p> : !auth.user ? <p>{copy.login} <a href={`${base}data/`}>{locale === "ko" ? "계정" : "Account"}</a></p>
      : <Editor key={auth.user.id} userId={auth.user.id} locale={locale} base={base} />}
  </main>;
}
export default function MemoryMinihome({ base = "/" }) {
  return <MemoryRouteShell base={base} currentRoute="boards"><Content base={base} /></MemoryRouteShell>;
}
