import { useEffect, useMemo, useRef, useState } from "react";
import MemoryRouteShell, { useMemoryRouteUi } from "../memory/components/MemoryRouteShell.jsx";
import { createTitleCollectionService } from "../titles/application/titleCollectionService.js";
import { buildTitleHubHref } from "../titles/domain/titleNavigation.js";
import CollectionTitleShelf from "./CollectionTitleShelf.jsx";
import ChannelHeader, { TextChoices } from "../../components/collection/ChannelHeader.jsx";
import { useUnsavedNavigation } from "../../hooks/useUnsavedNavigation.js";
import { readBookshelf, saveBookshelf } from "./bookshelfSettings.js";
import BookshelfEditor from "./BookshelfEditor.jsx";
import CollectionGroups from "./CollectionGroups.jsx";
import CollectionProfile from "./CollectionProfile.jsx";
import { MemoryBoardContent } from "../memory/components/MemoryBoardView.jsx";
import { MinihomeEditor } from "../memory/components/MemoryMinihome.jsx";
import { useAuthSession } from "../../hooks/useAuthSession.js";
import { minihomeUiEnabled } from "../memory/runtime/platformPublication.js";
import MemoryRelationships from "../memory/components/MemoryRelationships.jsx";
import MemorySafety from "../memory/components/MemorySafety.jsx";
import "./collection-home.css";
import { isTitleStateSyncEnabled } from "../../lib/supabaseClient.js";

export default function BookshelfView({ base = "/" }) {
  return <MemoryRouteShell base={base} currentRoute="home"><BookshelfContent base={base} /></MemoryRouteShell>;
}
function BookshelfContent({ base }) {
  const { locale, copy, ownerKey } = useMemoryRouteUi(), ko = locale === "ko";
  const auth = useAuthSession();
  const [panel, setPanel] = useState(() => { const value = new URLSearchParams(globalThis.location?.search || "").get("panel"); return ["sharing", "following", "safety", "boards"].includes(value) ? value : ""; });
  const [sharingState, setSharingState] = useState({ busy:false, dirty:false });
  const changePanel = next => { if (sharingState.busy || draft) return; if (sharingState.dirty && !confirm(ko ? "저장하지 않은 내용이 있습니다. 닫을까요?" : "You have unsaved changes. Close them?")) return; setSharingState({busy:false,dirty:false}); setPanel(next); const url = new URL(location.href); if (next) url.searchParams.set("panel",next); else url.searchParams.delete("panel"); history.replaceState(null,"",url); };
  const [group, setGroup] = useState(() => { const value = new URLSearchParams(globalThis.location?.search || "").get("section") || "all"; return /^(TITLE_SHELF|MEMORY_BOARD):.{1,80}$/.test(value) ? value : "all"; });
  const service = useMemo(() => createTitleCollectionService(), []);
  const [albums, setAlbums] = useState([]), [status, setStatus] = useState("loading");
  const [settings, setSettings] = useState(() => readBookshelf(ownerKey)), [draft, setDraft] = useState(null);
  const remoteChangedWhileEditing = useRef(false);
  const [selected, setSelected] = useState(""), [query, setQuery] = useState(""), [view, setView] = useState("grid"), [message, setMessage] = useState("");
  const [editorShelf, setEditorShelf] = useState("");
  const shelf = group.startsWith("TITLE_SHELF:") ? group.slice(12) : "all";
  const boardSelected = group.startsWith("MEMORY_BOARD:");
  useUnsavedNavigation(Boolean(draft && JSON.stringify(draft) !== JSON.stringify(settings)), locale);
  const grid = useRef(null);
  const closeSelection = () => {
    grid.current?.querySelector('.bookshelf-cover-trigger[aria-expanded="true"]')?.focus();
    setSelected("");
  };
  useEffect(() => {
    if (!selected) return;
    grid.current?.querySelector('.is-expanded .bookshelf-cover-area')?.scrollIntoView({ block: "nearest" });
    const escape = event => { if (event.key === "Escape") { event.preventDefault(); closeSelection(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selected]);
  useEffect(() => {
    let active = true, revision = 0;
    const refresh = () => {
      const request = ++revision;
      service.load().then(rows => {
        if (!active || request !== revision) return;
        setAlbums(rows); setStatus("ready");
      }).catch(() => active && request === revision && setStatus("error"));
    };
    refresh(); window.addEventListener("moemoa:library-updated", refresh);
    return () => { active = false; window.removeEventListener("moemoa:library-updated", refresh); };
  }, [service]);
  useEffect(() => {
    const refresh = event => {
      setSettings(readBookshelf(ownerKey));
      if (event?.detail?.source === "sync" && draft) {
        remoteChangedWhileEditing.current = true;
        setMessage(locale === "ko" ? "다른 기기에서 컬렉션이 바뀌었습니다. 취소 후 다시 편집해 주세요." : "Collection changed on another device. Cancel and reopen editing.");
      }
    };
    window.addEventListener("moemoa:bookshelf-updated", refresh);
    return () => window.removeEventListener("moemoa:bookshelf-updated", refresh);
  }, [ownerKey, draft, locale]);
  const model = draft || settings;
  const ids = new Set(model.shelves.filter(row => shelf === "all" || row.id === shelf).flatMap(row => row.titleKeys));
  const visible = albums.filter(album => ids.has(album.key) && album.displayTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const hrefFor = album => buildTitleHubHref({ base, titleRef: album.titleRef, anilistId: album.anilistId, title: album.displayTitle });
  const saveLayout = value => { if (sharingState.busy || sharingState.dirty) return false; try { setSettings(saveBookshelf(ownerKey, value)); setMessage(ko ? "컬렉션에 적용했어요." : "Collection saved."); return true; } catch { setMessage(ko ? "저장하지 못했습니다. 기존 설정은 유지됩니다." : "Could not save. Existing settings are preserved."); return false; } };
  const selectGroup = value => { if (sharingState.busy || sharingState.dirty || draft) return; setGroup(value); setSelected(""); const url = new URL(location.href); url.searchParams.set("section", value); history.replaceState(null, "", url); };
  const editCollection = (add = false) => {
    if (status !== "ready" || settings.loadError || draft || panel || sharingState.busy || sharingState.dirty || (add && (settings.shelves.length >= 20 || (settings.sections?.length || 0) >= 40))) return;
    const next = structuredClone(settings), id = add ? crypto.randomUUID() : shelf === "all" ? next.shelves[0]?.id : shelf;
    if (add) next.shelves.push({ id, name: ko ? "새 선반" : "New shelf", titleKeys: [] });
    setMessage(""); setSelected(""); setEditorShelf(id || ""); remoteChangedWhileEditing.current = false; setDraft(next);
  };
  const renderShelf = row => {
    if (!row) return null;
    const keys = new Set(row.titleKeys), rows = albums.filter(a => keys.has(a.key) && a.displayTitle.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    return <section className="collection-owner-section" data-section-kind="TITLE_SHELF"><header><div><small>{ko ? "작품 선반" : "Title shelf"}</small><h2>{row.name}</h2></div><span>{ko ? `작품 ${rows.length}개` : `${rows.length} titles`}</span></header>
      {rows.length ? <CollectionTitleShelf albums={rows} shelf={row.id} selected={selected} onSelect={setSelected} onClose={closeSelection} hrefFor={hrefFor} base={base} copy={copy.titles} locale={locale} view={view} /> : <p>{query ? (ko ? "이 선반에는 검색 결과가 없습니다." : "No matching titles in this shelf.") : (ko ? "이 선반에 진열할 작품을 골라 주세요." : "Choose titles to display in this shelf.")}</p>}
    </section>;
  };
  return <div className="bookshelf-page channel-page">
    <ChannelHeader base={base} locale={locale} title={ko ? "컬렉션" : "Collection"} trail={panel || shelf === "all" ? "" : model.shelves.find(row => row.id === shelf)?.name}
      actions={<><button className="btn btn--subtle" disabled={status !== "ready" || Boolean(draft) || Boolean(settings.loadError) || Boolean(panel) || sharingState.busy || sharingState.dirty} onClick={() => editCollection()}>{ko ? "컬렉션 편집" : "Edit collection"}</button><button className="btn btn--subtle" disabled={Boolean(draft) || sharingState.busy} onClick={() => changePanel(panel === "sharing" ? "" : "sharing")}>{ko ? "공개 설정" : "Sharing"}</button><button className="channel-text-button" disabled={Boolean(draft) || sharingState.busy} onClick={() => changePanel(panel === "following" ? "" : "following")}>{ko ? "팔로우" : "Following"}</button><button className="channel-text-button" disabled={Boolean(draft) || sharingState.busy} onClick={() => changePanel(panel === "safety" ? "" : "safety")}>{ko ? "신고·알림" : "Safety"}</button></>}
      sections={null} />
    {!panel && <CollectionProfile key={auth.user?.id || "guest"} userId={auth.user?.id} locale={locale} base={base} onEdit={() => changePanel("sharing")} disabled={Boolean(draft) || sharingState.busy} />}
    {settings.loadError && <p role="alert">{ko ? "컬렉션 설정을 읽지 못했습니다. 기존 데이터를 보존하고 편집을 중단합니다." : "Collection settings could not be read. Editing is paused to preserve your data."}</p>}
    {!settings.loadError && !draft && !panel && <CollectionGroups disabled={sharingState.busy || sharingState.dirty} settings={settings} ownerKey={ownerKey} locale={locale} selected={group} onSelect={selectGroup} onSave={saveLayout} onAddShelf={() => editCollection(true)} base={base} />}
    {panel && <section className="collection-task"><header><h2>{panel === "sharing" ? (ko ? "컬렉션 공개 설정" : "Collection sharing") : panel === "following" ? (ko ? "팔로우" : "Following") : panel === "boards" ? (ko ? "이미지 보드" : "Memory Boards") : (ko ? "신고·알림" : "Safety")}</h2><button className="btn btn--subtle" disabled={sharingState.busy} onClick={() => changePanel("")}>{ko ? "컬렉션으로 돌아가기" : "Back to collection"}</button></header>{panel === "sharing" ? !minihomeUiEnabled() ? <p>{ko ? "현재 환경에서는 공개 설정이 비활성화되어 있습니다." : "Sharing is disabled in this environment."}</p> : auth.user ? <MinihomeEditor onStateChange={setSharingState} key={auth.user.id} userId={auth.user.id} locale={locale} base={base} /> : <p>{ko ? "공개하려면 로그인해 주세요." : "Sign in to share."}<a href={base + "data/"}>{ko ? "계정" : "Account"}</a></p> : panel === "following" ? <MemoryRelationships locale={locale} base={base} /> : panel === "boards" ? <MemoryBoardContent onTaskStateChange={setSharingState} base={base} embedded /> : <MemorySafety locale={locale} base={base} />}</section>}
    {!panel && !draft && group.startsWith("MEMORY_BOARD:") && <MemoryBoardContent onTaskStateChange={setSharingState} key={ownerKey + group} base={base} boardId={group.slice(13)} embedded />}
    {status === "loading" ? <p role="status">{copy.titles.loading}</p> : status === "error" ? <p role="alert">{copy.titles.loadFailed}</p> : null}
    {draft && <BookshelfEditor draft={draft} setDraft={setDraft} initialShelfId={editorShelf} albums={albums} copy={copy.titles} locale={locale}
      onCancel={() => { setDraft(null); remoteChangedWhileEditing.current = false; setMessage(""); }}
      onApply={() => { if (remoteChangedWhileEditing.current) { setMessage(ko ? "다른 기기에서 컬렉션이 바뀌었습니다. 취소 후 다시 편집해 주세요." : "Collection changed on another device. Cancel and reopen editing."); return; } try { const saved = saveBookshelf(ownerKey, draft); setSettings(saved); setDraft(null); setSelected(""); setMessage(ko ? "컬렉션에 적용했어요." : "Collection saved."); } catch { setMessage(ko ? "저장하지 못했어요. 저장 공간을 확인해 주세요." : "Could not save. Check browser storage."); } }} />}
    {message ? <p role="status">{message}</p> : null}

    {!settings.loadError && !draft && !panel && !boardSelected && <div className="collection-content-controls">
      <label className="channel-search">{ko ? "선반 작품 검색" : "Search shelf titles"}<input type="search" value={query} placeholder={ko ? "작품명으로 찾기" : "Find a title"} onChange={e => { setQuery(e.target.value); setSelected(""); }} /></label>
      <TextChoices label={ko ? "컬렉션 보기" : "Collection view"} options={[{ value: "grid", label: ko ? "그리드" : "Grid" }, { value: "table", label: ko ? "표" : "Table" }]} value={view} onChange={next => { setView(next); setSelected(""); }} />
      <small>{ko ? `진열한 작품 ${visible.length}종 · 선반 설정은 ${isTitleStateSyncEnabled && ownerKey.startsWith("account:") ? "계정에 동기화됩니다" : "이 기기에 저장됩니다"}.` : `${visible.length} unique titles · Shelf settings ${isTitleStateSyncEnabled && ownerKey.startsWith("account:") ? "sync with your account" : "stay on this device"}.`}</small>
    </div>}
    {status === "ready" && !settings.loadError && !draft && !panel && !boardSelected && !model.shelves.length && !(model.sections || []).some(s => s.kind === "MEMORY_BOARD") && <section className="channel-empty"><h2>{albums.length ? (ko ? "작품을 첫 선반에 모아 보세요." : "Collect your titles in a first shelf.") : (ko ? "아직 컬렉션에 담은 자료가 없어요." : "Your collection is empty.")}</h2><p>{ko ? "작품 선반과 이미지 보드를 골라 컬렉션을 구성하세요." : "Choose title shelves and Memory Boards for your collection."}</p><button type="button" className="btn btn--subtle" onClick={() => editCollection(true)}>{ko ? "작품 선반 만들기" : "Create title shelf"}</button><a href={`${base}titles/`}>{ko ? "내 작품 보기 →" : "My titles →"}</a></section>}
    {status === "ready" && !settings.loadError && !draft && !panel && !boardSelected && <div ref={grid} className="collection-owner-content">
      {group === "all" ? <CollectionGroups settings={settings} ownerKey={ownerKey} locale={locale} selected={group} onSelect={selectGroup} onSave={saveLayout} base={base} overview renderShelf={renderShelf} /> : model.shelves.some(s => s.id === shelf) ? renderShelf(model.shelves.find(s => s.id === shelf)) : <section className="channel-empty"><h2>{ko ? "이 선반을 찾을 수 없습니다." : "This shelf is unavailable."}</h2><button type="button" className="btn btn--subtle" onClick={() => selectGroup("all")}>{ko ? "전체 컬렉션 보기" : "View all groups"}</button></section>}
    </div>}
  </div>;
}
