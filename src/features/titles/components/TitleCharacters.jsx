import { useEffect, useMemo, useRef, useState } from "react";
import { createTitleCharactersReader } from "../application/titleCharacters.js";
import { characterTagKey } from "../../memory/domain/cardClassification.js";
import "./title-characters.css";

export default function TitleCharacters({ animeId, anilistId, locale = "ko", selected, onSelect, disabled = false, query = "", readCharacters }) {
  const ko = locale === "ko", selectable = typeof onSelect === "function";
  const reader = useMemo(() => readCharacters ?? createTitleCharactersReader(), [readCharacters]);
  const [state, setState] = useState({ status: "loading", rows: [], page: 0, hasMore: false, source: null });
  const [retry, setRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    setState({ status: "loading", rows: [], page: 0, hasMore: false, source: null });
    setVisibleCount(6);
    reader({ animeId, anilistId }).then(result => active && setState({ status: "ready", rows: result.characters, ...result }))
      .catch(() => active && setState({ status: "error", rows: [], page: 0, hasMore: false, source: null }));
    return () => { active = false; generation.current += 1; };
  }, [animeId, anilistId, reader, retry]);
  const loadMore = async () => {
    const requestedGeneration = generation.current;
    setState(current => ({ ...current, status: "loading-more" }));
    try {
      const result = await reader({ animeId, anilistId, page: state.page + 1 });
      if (generation.current !== requestedGeneration) return;
      setState(current => ({ ...current, ...result, rows: [...current.rows, ...result.characters], status: "ready" }));
    } catch { if (generation.current === requestedGeneration) setState(current => ({ ...current, status: "more-error" })); }
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleRows = selectable ? state.rows.filter(row => row.name.toLocaleLowerCase().includes(normalizedQuery)) : state.rows.slice(0, visibleCount);
  return <div className="title-characters">
    {state.status === "loading" && <p role="status">{ko ? "캐릭터를 불러오고 있어요." : "Loading characters…"}</p>}
    {state.status === "error" && <p role="alert">{ko ? "캐릭터 정보를 불러오지 못했어요." : "Characters could not be loaded."} <button type="button" className="channel-text-button" onClick={() => setRetry(value => value + 1)}>{ko ? "다시 시도" : "Retry"}</button></p>}
    {state.status === "ready" && !state.rows.length && <p>{ko ? "아직 등록된 캐릭터 정보가 없어요." : "No character information yet."}</p>}
    {selectable && normalizedQuery && state.rows.length > 0 && !visibleRows.length && <p role="status">{ko ? "불러온 목록에 일치하는 캐릭터가 없어요." : "No match in the loaded characters."}</p>}
    <ul>{visibleRows.map(row => {
      const key = characterTagKey(row), picked = selected?.some(value => characterTagKey(value) === key);
      const content = <>{row.image ? <img src={row.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="title-characters__initial" aria-hidden="true">{row.name.slice(0, 1)}</span>}<span>{row.name}{!selectable && row.castings?.length > 0 && <small>{row.castings.map(c => c.creditedName).join(" · ")}</small>}</span></>;
      return <li key={key}>{selectable ? <button type="button" aria-pressed={picked} disabled={disabled || (!picked && selected?.length >= 12)} onClick={() => onSelect({ source: row.source, id: row.id, name: row.name })}>{content}</button> : <div className="title-characters__entry">{content}</div>}</li>;
    })}</ul>
    {state.rows.length > 0 && <small className="title-characters__source">{state.source === "ANILIST" ? (ko ? "AniList · 대표 캐릭터" : "AniList · Featured characters") : (ko ? "작품 카탈로그" : "Title catalog")}</small>}
    {state.status === "more-error" && <p role="alert">{ko ? "추가 캐릭터를 불러오지 못했어요." : "More characters could not be loaded."}</p>}
    {!selectable && visibleCount < state.rows.length ? <button type="button" className="channel-text-button" onClick={() => setVisibleCount(value => value + 6)}>{ko ? "캐릭터 더 보기" : "More characters"}</button> : state.hasMore && <button type="button" className="channel-text-button" disabled={disabled || state.status === "loading-more"} onClick={loadMore}>{ko ? "캐릭터 더 보기" : "More characters"}</button>}
  </div>;
}
