import { useEffect, useMemo, useState } from "react";
import { fetchAnimeByIdsCached } from "../../../lib/anilist.js";
import { formatRelationTypeLabel } from "../../../components/library/libraryCopy.js";
import { buildTitleHubHref } from "../domain/titleNavigation.js";

const ANIME_FORMATS = new Set(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"]);

function providerRows(media, currentId, locale) {
  const seen = new Set();
  const edges = Array.isArray(media?.relations?.edges) ? media.relations.edges : [];
  return edges.flatMap(edge => {
    const node = edge?.node;
    const id = Number(node?.id);
    if (!Number.isSafeInteger(id) || id < 1 || id === Number(currentId) || seen.has(id)) return [];
    seen.add(id);
    const title = String(node?.title?.english || node?.title?.romaji || node?.title?.native || "").trim();
    if (!title) return [];
    return [{ id, title, format: String(node?.format || "").toUpperCase(),
      relation: formatRelationTypeLabel(edge?.relationType, locale) }];
  }).slice(0, 12);
}

export default function TitleRelatedSeries({ album, service, base, locale }) {
  const ko = locale === "ko";
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", rows: [] });
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const catalogRows = useMemo(() => (Array.isArray(album.catalogDetail?.relations) ? album.catalogDetail.relations : []).slice(0, 12), [album.catalogDetail]);
  useEffect(() => {
    const id = Number(album.anilistId);
    if (!open || !Number.isSafeInteger(id) || id < 1) return undefined;
    let active = true;
    setState({ status: "loading", rows: [] });
    fetchAnimeByIdsCached([id], { includeRelations: true, includeCharacters: false })
      .then(map => active && setState({ status: "ready", rows: providerRows(map.get(id), id, locale) }))
      .catch(() => active && setState({ status: "error", rows: [] }));
    return () => { active = false; };
  }, [album.anilistId, open, retry, locale]);
  if (!album.anilistId && !catalogRows.length) return null;
  const rows = state.status === "ready" && state.rows.length ? state.rows : catalogRows;
  const add = async row => {
    setBusyId(row.id); setMessage("");
    try {
      const created = await service.saveRelatedTitle({ anilistId: row.id, title: row.title, format: row.format });
      setMessage(created ? (ko ? "내 작품에 추가했어요." : "Added to My Titles.")
        : (ko ? "이미 내 작품에 있어요." : "Already in My Titles."));
    } catch {
      setMessage(ko ? "추가하지 못했어요. 다시 시도해 주세요." : "Could not add this title. Try again.");
    } finally { setBusyId(null); }
  };
  return <section className="surface-card title-hub__related">
    <button type="button" className="title-hub__disclosure" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {ko ? "관련 시리즈" : "Related titles"} <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="title-hub__related-body">
      {state.status === "loading" && !catalogRows.length && <p role="status">{ko ? "관련 작품을 불러오는 중…" : "Loading related titles…"}</p>}
      {state.status === "error" && <p role="alert">{ko ? "추가 관계 정보를 불러오지 못했어요." : "Could not load more related titles."}
        <button type="button" className="channel-text-button" onClick={() => setRetry(value => value + 1)}>{ko ? "다시 시도" : "Retry"}</button></p>}
      {rows.length ? <ul>{rows.map((row, index) => <li key={row.id || `${row.title}:${index}`}>
        <div><strong>{row.title}</strong><small>{row.relation || formatRelationTypeLabel(row.type, locale)}{row.format ? ` · ${row.format}` : ""}</small></div>
        {row.id && ANIME_FORMATS.has(row.format) ? <div className="title-hub__related-actions">
          <a href={buildTitleHubHref({ base, anilistId: row.id, title: row.title })} data-astro-reload>{ko ? "작품 보기" : "View title"}</a>
          <button type="button" className="channel-text-button" disabled={busyId != null}
            onClick={() => add(row)}>{busyId === row.id ? (ko ? "추가 중…" : "Adding…") : (ko ? "내 작품에 추가" : "Add to My Titles")}</button>
        </div> : null}
      </li>)}</ul> : state.status !== "loading" && <p>{ko ? "연결된 작품이 아직 없어요." : "No related titles yet."}</p>}
      {message && <p role="status">{message}</p>}
    </div>}
  </section>;
}
