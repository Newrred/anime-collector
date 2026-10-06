import { useEffect, useMemo, useState } from "react";
import MemoryRouteShell, { useMemoryRouteUi } from "../../memory/components/MemoryRouteShell.jsx";
import { createTitleCollectionService } from "../application/titleCollectionService.js";
import { getPlatformTitleResolver } from "../../memory/runtime/platformTitleResolver.js";
import { buildTitleHubHref } from "../domain/titleNavigation.js";
import { isWatchCatalogId } from "../../../domain/watchLogIdentity.js";
import TitleCover from "./TitleCover.jsx";
import { watchStatusLabel } from "./TitleWatchRecords.jsx";
import "./title-hub.css";

export default function RecordStart({ base = "/" }) {
  return <MemoryRouteShell base={base} currentRoute="record-new"><RecordStartContent base={base} /></MemoryRouteShell>;
}

function RecordStartContent({ base }) {
  const { locale, copy } = useMemoryRouteUi();
  const ko = locale === "ko";
  const services = useMemo(() => import.meta.env.DEV && globalThis.__MOEMOA_TEST_RECORD_START__
    || { collection: createTitleCollectionService(), resolver: getPlatformTitleResolver() }, []);
  const [albums, setAlbums] = useState([]);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  useEffect(() => {
    let active = true;
    services.collection.load().then((rows) => active && setAlbums(rows.filter((row) => row.tracking.isSaved && !row.isPrivateTitle)))
      .catch(() => active && setError(true)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [services]);
  useEffect(() => {
    let active = true;
    setRemote([]); setSearchError(false); setSearching(false);
    if (query.trim().length < 2) return () => { active = false; };
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const result = await services.resolver.search(query.trim());
        if (active) {
          setRemote((Array.isArray(result) ? result : result.results || []).filter((row) => isWatchCatalogId(row.animeId)
            || row.sourceBinding?.provider === "ANILIST" && Number(row.sourceBinding.externalId) > 0));
          setSearchError(["UNAVAILABLE", "TIMED_OUT"].includes(result.remoteStatus));
        }
      } catch { if (active) setSearchError(true); }
      finally { if (active) setSearching(false); }
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [query, services]);
  const local = albums.filter((row) => [row.displayTitle, ...row.aliases].some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const newRemote = remote.filter((row) => !albums.some((album) => isWatchCatalogId(row.animeId) && row.animeId === album.titleRef.animeId
    || row.sourceBinding?.provider === "ANILIST" && Number(row.sourceBinding.externalId) === album.anilistId));
  const recordHref = (row) => `${buildTitleHubHref({ base, titleRef: row.titleRef, anilistId: row.anilistId, title: row.displayTitle })}&tab=watch&record=new`;
  return <div className="record-start page-shell">
    <header><h1>{ko ? "기억 남기기" : "Add Memory"}</h1><p>{ko ? "작품의 감상을 기록하거나, 오래 남기고 싶은 장면을 저장하세요." : "Record your impressions, or keep a scene you want to remember."}</p></header>
    <div className="record-start__paths"><a className="record-start__path is-active" href="#watch-title-picker" aria-current="true"><strong>{ko ? "감상 기록" : "Watch record"}</strong><span>{ko ? "시청 상태 · 별점 · 정주행 · 감상 이력" : "Status · rating · rewatches · reflections"}</span></a>
      <a className="record-start__path" href={`${base}memory/new/`} data-astro-reload><strong>{ko ? "장면·이미지 남기기 →" : "Keep a scene or image →"}</strong><span>{ko ? "내 이미지, 디자인 카드, 선택한 작품 표지" : "Your image, a design card, or a selected cover"}</span></a></div>
    <section id="watch-title-picker"><h2>{ko ? "어떤 작품의 감상을 남길까요?" : "Which title are you recording?"}</h2>
      <label className="record-start__search">{ko ? "작품 찾기" : "Find a title"}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ko ? "내 작품이나 새 작품 검색" : "Search your titles or find a new one"} /></label>
      <h3>{ko ? "내 작품" : "My titles"}</h3>
      {loading ? <p role="status">{ko ? "작품 불러오는 중…" : "Loading titles…"}</p> : error ? <p role="alert">{ko ? "내 작품을 불러오지 못했어요. 다시 열어 주세요." : "Could not load your titles. Please reopen this page."}</p>
        : !local.length ? <p className="watch-record-help">{ko ? "저장한 작품이 없거나 검색과 맞지 않아요. 작품명을 검색해 선택해 주세요." : "No saved title matches. Search by title to get started."}</p> : null}
      <div className="record-start__titles">{local.map((album) => <a key={album.key} href={recordHref(album)} data-astro-reload><TitleCover album={album} copy={copy.titles} />
        <span><strong>{album.displayTitle}</strong><small>{watchStatusLabel(album.tracking.watchStatus, ko)} · {album.tracking.rating == null ? ko ? "미평가" : "Unrated" : `★ ${album.tracking.rating}`} · {ko ? `재시청 ${album.tracking.rewatchCount || 0}회` : `${album.tracking.rewatchCount || 0} rewatches`}</small></span><span aria-hidden="true">→</span></a>)}</div>
      {query.trim().length >= 2 && <section className="record-start__catalog"><h3>{ko ? "새 작품 찾기" : "Find new titles"}</h3>
        {searching && <p role="status">{ko ? "검색 중…" : "Searching…"}</p>}{searchError && <p role="status">{ko ? "온라인 검색에 연결하지 못했어요. 내 작품은 계속 선택할 수 있어요." : "Online search is unavailable. You can still choose a saved title."}</p>}
        <div className="record-start__titles">{newRemote.map((row) => { const album = { displayTitle: row.displayTitle, titleRef: isWatchCatalogId(row.animeId) ? { kind: "ANIME", animeId: row.animeId } : null,
          anilistId: row.sourceBinding?.provider === "ANILIST" ? Number(row.sourceBinding.externalId) : null, officialCover: row.coverPreviewUrl ? { src: row.coverPreviewUrl } : null };
          return <a key={row.animeId || album.anilistId} href={recordHref(album)} data-astro-reload><TitleCover album={album} copy={copy.titles} /><span><strong>{row.displayTitle}</strong><small>{ko ? "작품을 선택한 뒤 저장하고 기록하기" : "Choose, save the title, then record"}</small></span><span aria-hidden="true">→</span></a>; })}</div>
        {!searching && !searchError && !newRemote.length && <p className="watch-record-help">{ko ? "새로운 검색 결과가 없어요. 작품명이나 다른 제목으로 찾아 보세요." : "No new matches. Try another title or alias."}</p>}
      </section>}
    </section>
  </div>;
}
