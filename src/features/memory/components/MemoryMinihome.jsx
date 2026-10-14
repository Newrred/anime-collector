import PublicSharingNotice from './PublicSharingNotice.jsx';
import { publicSharingNoticeHref } from '../domain/publicSharingPolicy.js';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import { getPublicationServices, minihomeUiEnabled } from "../runtime/platformPublication.js";
import { createMinihomeController } from "../application/createMinihomeController.js";
import { minihomeLink, homeEntryKey } from "../domain/minihomeView.js";
import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
import PublicTitleShelf from "./PublicTitleShelf.jsx";
import { publicationError } from "./publicationCopy.js";
import { minihomeCopy } from "./minihomeCopy.js";
import MinihomeSnapshot from "./MinihomeSnapshot.jsx";
import MemoryRelationships from "./MemoryRelationships.jsx";
import PublicLinkCopy from "./PublicLinkCopy.jsx";
import MemorySafety from "./MemorySafety.jsx";
import PublicSignupNotice from "./PublicSignupNotice.jsx";
import "./memory-publication.css";
import PublicPageHeading from './PublicPageHeading.jsx';
import TaskSections, { TaskPanel } from '../../../components/ui/TaskSections.jsx';
import CollectionLegacyRedirect from '../../bookshelf/CollectionLegacyRedirect.jsx';

function PublicBoardSummary({ board, services, locale }) {
  return <PublicBoardSnapshot snapshot={{ ...board, cards: board.cards.slice(0,1) }} publicationId={board.id} services={services} locale={locale} />;
}
function Review({ review, controller, services, locale, busy, base }) {
  const noticeAvailable = Boolean(publicSharingNoticeHref(review.policyRevision, base));
  const copy = minihomeCopy(locale), [consented, setConsented] = useState(false), [ready, setReady] = useState(false);
  return <div className="publication-review">
    <MinihomeSnapshot snapshot={review.snapshot} services={services} locale={locale} preview onReady={setReady} base={base} />
    <div className="publication-review__consent">
    <PublicSharingNotice revision={review.policyRevision} locale={locale} base={base} />
    <label className="memory-publication__check"><input type="checkbox" checked={consented} disabled={busy || !noticeAvailable} onChange={(e) => setConsented(e.target.checked)} />{copy.consent}</label>
    <button className="btn" disabled={busy || !consented || !ready || !noticeAvailable} onClick={() => controller.publish({ consented, visualsReady: ready })}>{copy.publish}</button>
    <button className="btn btn--subtle" disabled={busy} onClick={() => controller.cancel()}>{copy.cancel}</button>
    </div>
  </div>;
}
export function MinihomeEditor({ userId, locale, base, onStateChange }) {
  const services = getPublicationServices(), copy = minihomeCopy(locale);
  const controller = useMemo(() => createMinihomeController({ userId, gateway: services.gateway, getSession: services.getSession, collectionHomeEnabled: services.collectionHomeEnabled }), [userId, services]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [nickname, setNickname] = useState(""), [bio, setBio] = useState(""), [entries, setEntries] = useState([]);
  const touched = useRef(false), baseline = useRef(JSON.stringify({ nickname: "", bio: "", entries: [] }));
  const draftKey = JSON.stringify({ nickname, bio, entries });
  const dirty = draftKey !== baseline.current && state.phase !== "published";
  useEffect(() => { onStateChange?.({ busy: state.busy, dirty: dirty || Boolean(state.review) }); }, [onStateChange,state.busy,state.review,dirty]);
  useUnsavedNavigation(draftKey !== baseline.current && state.phase !== "published", locale, { busy: state.busy });
  useEffect(() => {
    if (!state.home?.selection || touched.current) return;
    const selection = state.home.selection;
    setNickname(selection.nickname); setBio(selection.bio); setEntries(selection.entries);
    baseline.current = JSON.stringify({ nickname: selection.nickname, bio: selection.bio, entries: selection.entries });
  }, [state.home]);
  useEffect(() => { if (state.phase === "published") { baseline.current = draftKey; touched.current = false; } }, [state.phase, draftKey]);
  useEffect(() => { controller.load(); return () => controller.dispose(); }, [controller]);
  const change = (fn) => { touched.current = true; controller.cancel(); fn(); };
  return <section className="memory-publication memory-minihome" aria-busy={state.busy}>
    <p>{services.collectionHomeEnabled ? (locale === "ko" ? "작품 선반·이미지 보드를 골라 컬렉션의 방문자 화면을 만드세요. 공개할 묶음은 최대 10개입니다." : "Choose title shelves and Memory Boards for your collection’s visitor page. Share up to 10 groups.") : copy.intro}</p>
    {dirty && !state.busy && <p className="collection-sharing-draft-status" role="status">{locale === "ko" ? "변경한 내용은 아직 공개되지 않았습니다." : "Your changes have not been published."}</p>}
    {state.busy && <p role="status">{copy.loading}</p>}
    {state.error && <p role="alert">{state.error === "INVALID_SELECTION" ? services.collectionHomeEnabled ? (locale === "ko" ? "공개할 묶음 1~10개를 선택하고 이름과 선택 내용을 확인해 주세요." : "Choose 1–10 groups and check their names and selected content.") : copy.invalid : publicationError(state.error, locale)} <button className="btn btn--subtle" disabled={state.busy} onClick={() => controller.load()}>{copy.retry}</button></p>}
    <PublicSignupNotice error={state.error} locale={locale} base={base} />
    {state.home?.published && (state.home.hidden || state.home.visible === false) && <p role="status">{copy.notVisible}</p>}
    {state.home?.published && !state.home.hidden && state.home.visible !== false && <p role="status">{copy.published} <a href={minihomeLink(state.home.id, base)}>{copy.visit}</a></p>}
    {state.home?.published && !state.home.hidden && state.home.visible !== false && <PublicLinkCopy key={state.home.id} kind="home" id={state.home.id} locale={locale} base={base} />}
    {state.phase === "revoked" && <p role="status">{copy.revoked}</p>}
    {state.home && <details className="public-management"><summary>{locale === 'ko' ? '공개 관리' : 'Manage sharing'}</summary><button className="btn btn--subtle" disabled={state.busy} onClick={() => { if (confirm(copy.confirm)) controller.revoke(); }}>{copy.withdraw}</button></details>}
    {state.review ? <Review key={state.review.reviewHash} review={state.review} controller={controller} services={services} locale={locale} busy={state.busy} base={base} /> : <form onSubmit={(e) => { e.preventDefault(); controller.prepare(entries.some(e => e.kind === "TITLE_SHELF") || state.home?.selection?.schemaVersion === 2 ? { schemaVersion: 2, nickname, bio, entries: entries.map(e => e.kind === "TITLE_SHELF" ? e : { ...e, kind: "MEMORY_BOARD" }) } : { nickname, bio, entries }); }}>
      <fieldset disabled={state.busy} className="collection-sharing-canvas">
        <label>{copy.nickname}<input required maxLength={60} value={nickname} onChange={(e) => change(() => setNickname(e.target.value))} /></label>
        <label>{copy.bio}<textarea rows={3} maxLength={500} value={bio} onChange={(e) => change(() => setBio(e.target.value))} /></label>
        <p>{locale === "ko" ? "선택한 묶음만 공개됩니다. 작품 선반은 작품명·승인 표지만, 이미지 보드는 이미 공개한 범위만 표시합니다." : "Only selected groups are shared. Title shelves show catalog titles and approved covers; Boards retain their existing public scope."}</p>
        {!state.boards.length && !state.shelves.length && !state.busy && <p>{copy.empty} <a href={`${base}boards/`}>{copy.boards}</a></p>}
        <div className="collection-sharing-choices" aria-label={locale === "ko" ? "공개할 묶음 선택" : "Groups to share"}>
        {state.shelvesEnabled && <div className="collection-sharing-shelves"><h3>{locale === "ko" ? "작품 선반" : "Title shelves"}</h3>{!state.shelves.length && <p>{locale === "ko" ? "작품 선반을 계정에 동기화하면 공개할 수 있는 승인 표지가 여기에 표시됩니다." : "Sync your shelves to see titles with approved covers here."}</p>}{state.shelves.map(shelf => {
          const selected = entries.find(e => e.kind === "TITLE_SHELF" && e.sourceId === shelf.sourceId);
          return <article key={shelf.sourceId} className="collection-sharing-shelf"><label className="memory-publication__check"><input type="checkbox" checked={Boolean(selected)} disabled={!selected && (entries.length >= 10 || !shelf.titles.length)} onChange={e => change(() => setEntries(current => e.target.checked ? [...current, { kind: "TITLE_SHELF", sourceId: shelf.sourceId, sourceVersion: shelf.sourceVersion, title: shelf.name, titles: shelf.titles.map(t => ({ titleKey: t.titleKey, animeId: t.animeId, revisionId: t.visual.revisionId, catalogTitle: t.title })) }] : current.filter(item => item.kind !== "TITLE_SHELF" || item.sourceId !== shelf.sourceId)))} />{shelf.name} · {shelf.titles.length}</label>
          {shelf.excludedCount > 0 && <p>{locale === "ko" ? `승인된 카탈로그 표지가 없는 작품 ${shelf.excludedCount}개는 공개에서 제외됩니다. 비공개 원본은 유지됩니다.` : `${shelf.excludedCount} titles without an approved catalog cover are excluded. Private originals are preserved.`}</p>}
          {selected && selected.sourceVersion !== shelf.sourceVersion && <p role="status">{locale === "ko" ? "원본 선반이 변경되어 이전 전시는 표시되지 않습니다. 아래 버튼으로 현재 버전을 선택하고 다시 확인해 주세요." : "The source shelf changed, so its previous display is unavailable. Select the current version and review it again."}<button type="button" className="btn btn--subtle" disabled={!shelf.titles.length} onClick={() => change(() => setEntries(current => current.map(item => item === selected ? { ...item, sourceVersion:shelf.sourceVersion,titles:shelf.titles.map(t => ({titleKey:t.titleKey,animeId:t.animeId,revisionId:t.visual.revisionId,catalogTitle:t.title})) } : item)))}>{locale === "ko" ? "현재 선반 버전 선택" : "Select current shelf version"}</button></p>}
          {selected && <label>{locale === "ko" ? "공개할 선반 이름" : "Public shelf title"}<input required maxLength={80} value={selected.title} onChange={e => { const title = e.target.value; change(() => setEntries(current => current.map(item => item === selected ? { ...item, title } : item))); }} /></label>}
          <PublicTitleShelf snapshot={{ schemaVersion: 1, title: shelf.name, titles: shelf.titles.slice(0,4) }} services={services} locale={locale} base={base} />
          </article>;
        })}</div>}
        <ol className="memory-publication__selection">{state.boards.map((board) => {
          const selected = entries.find((e) => e.publicationId === board.id);
          return <li key={board.id}><div><h3>{board.title}</h3>
            <label className="memory-publication__check"><input type="checkbox" checked={Boolean(selected)} disabled={!selected && entries.length >= 10}
              onChange={(e) => { const checked = e.target.checked; change(() => setEntries((current) => checked ? [...current, { publicationId: board.id }] : current.filter((item) => item.publicationId !== board.id))); }} />{copy.choose}</label>
            {selected && <label>{copy.representative}<select aria-label={copy.representative} value={selected.cardId || ""} onChange={(e) => { const value = e.target.value; change(() => setEntries((current) => current.map((item) => item.publicationId !== board.id ? item : { publicationId: board.id, ...(value ? { cardId: value } : {}) }))); }}>
                <option value="">{copy.whole}</option>{board.cards.map((card, i) => <option key={card.id} value={card.id}>{i + 1}. {card.title}{card.note ? ` — ${card.note.slice(0, 60)}` : ""}</option>)}
            </select></label>}
            <PublicBoardSummary board={board} services={services} locale={locale} />
          </div></li>;
        })}</ol>
        {state.next && <button type="button" className="btn btn--subtle" onClick={() => controller.more()}>{copy.more}</button>}
        </div>
        <p className="collection-sharing-summary" role="status">{locale === "ko" ? `묶음 ${entries.length}/10개 선택 · 변경은 공개 결과 확인 후 게시됩니다.` : `${entries.length}/10 groups selected · Changes go live only after review and publishing.`}</p>
        <ol className="collection-sharing-order" aria-label={locale === "ko" ? "공개 묶음 순서" : "Public group order"}>{entries.map((entry, i) => <li key={homeEntryKey(entry)}>
          {entry.kind === "TITLE_SHELF" ? (entry.title || state.shelves.find(s => s.sourceId === entry.sourceId)?.name) : state.boards.find((b) => b.id === entry.publicationId)?.title || (locale === "ko" ? "기존 공개 보드 · 원본 확인 필요" : "Existing public Board · check source")}
          {[-1, 1].map((direction) => <button type="button" className="btn btn--subtle" key={direction} disabled={i + direction < 0 || i + direction >= entries.length} onClick={() => change(() => setEntries((current) => { const next = [...current]; [next[i], next[i + direction]] = [next[i + direction], next[i]]; return next; }))}>{direction < 0 ? copy.up : copy.down}</button>)}
          <button type="button" className="btn btn--subtle" onClick={() => change(() => setEntries(current => current.filter((_, index) => index !== i)))}>{locale === "ko" ? "선택 해제" : "Remove selection"}</button>
        </li>)}</ol>
        <div className="collection-sharing-actions"><button type="submit" className="btn" disabled={!nickname.trim() || !entries.length || entries.some(e => e.kind === "TITLE_SHELF" && !e.title.trim())}>{copy.preview}</button></div>
      </fieldset>
    </form>}
    {state.busy && !["publishing", "revoking"].includes(state.phase) && <button className="btn btn--subtle" onClick={() => controller.cancel()}>{copy.cancel}</button>}
  </section>;
}
function MinihomeTasks({ userId, locale, base }) {
  const labels = locale === 'ko'
    ? { nav: '미니홈 메뉴', edit: '미니홈 편집', following: '팔로우', safety: '신고·알림' }
    : { nav: 'Minihome tasks', edit: 'Edit home', following: 'Following', safety: 'Safety inbox' };
  return <TaskSections label={labels.nav}>
    <TaskPanel sectionId="edit" label={labels.edit}>
    <MinihomeEditor key={userId} userId={userId} locale={locale} base={base} />
    </TaskPanel>
    <TaskPanel sectionId="following" label={labels.following}><MemoryRelationships locale={locale} base={base} /></TaskPanel>
    <TaskPanel sectionId="safety" label={labels.safety}><MemorySafety locale={locale} base={base} /></TaskPanel>
    </TaskSections>;
}
function Content({ base }) {
  const { locale } = useMemoryRouteUi(), auth = useAuthSession(), copy = minihomeCopy(locale);
  return <main className="page-shell page-shell--wide public-workspace-page">
    <PublicPageHeading title={copy.title} base={`${base}boards/`} breadcrumb={copy.boards} />
    {!minihomeUiEnabled() ? <p>{copy.disabled}</p> : !auth.user ? <section>
      <p>{copy.login} <a href={`${base}data/`}>{locale === 'ko' ? '계정' : 'Account'}</a></p>
      {globalThis.location?.hash === '#following' && <MemoryRelationships locale={locale} base={base} />}
    </section>
      : <MinihomeTasks userId={auth.user.id} locale={locale} base={base} />}
  </main>;
}
export default function MemoryMinihome({ base = "/" }) {
  if (getPublicationServices().collectionHomeEnabled) return <CollectionLegacyRedirect kind="home" base={base} />;
  return <MemoryRouteShell base={base} currentRoute="boards"><Content base={base} /></MemoryRouteShell>;
}
