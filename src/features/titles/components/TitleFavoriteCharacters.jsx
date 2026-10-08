import { useEffect, useState } from "react";
import { catalogCharacterAniListId, createTitleCharactersReader } from "../application/titleCharacters.js";
import { readCharacterPinsSnapshot, removeCharacterPin, upsertCharacterPin } from "../../../repositories/characterPinRepo.js";
import { withTitleStateMutation } from "../application/titleStateMutationLock.js";

const catalogReader = createTitleCharactersReader();
const numericId = value => {
  return catalogCharacterAniListId(value);
};

export default function TitleFavoriteCharacters({ animeId, anilistId, locale, readCharacters }) {
  const reader = readCharacters ?? catalogReader;
  const ko = locale === "ko";
  const mediaId = numericId(anilistId);
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState(() => readCharacterPinsSnapshot());
  const [state, setState] = useState({ status: "idle", rows: [], page: 0, hasMore: false });
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [visible, setVisible] = useState(8);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open || !mediaId) return undefined;
    let active = true;
    setState({ status: "loading", rows: [], page: 0, hasMore: false });
    reader({ animeId }).then(result => {
      if (active) setState({ status: "ready", rows: result.characters.filter(row => numericId(row.id)), page: result.page, hasMore: result.hasMore });
    }).catch(() => active && setState({ status: "error", rows: [], page: 0, hasMore: false }));
    return () => { active = false; };
  }, [animeId, open, mediaId, reader, retry]);
  if (!mediaId) return null;
  const ownPins = pins.filter(pin => pin.mediaId === mediaId);
  const pinIds = new Set(ownPins.map(pin => pin.characterId));
  const candidates = state.rows.slice(0, visible);
  const showMore = async () => {
    if (visible < state.rows.length) { setVisible(value => value + 8); return; }
    if (!state.hasMore || state.status === "loading-more") return;
    setState(current => ({ ...current, status: "loading-more" }));
    try {
      const result = await reader({ animeId, page: state.page + 1 });
      setState(current => ({ status: "ready", rows: [...current.rows, ...result.characters.filter(row => numericId(row.id))],
        page: result.page, hasMore: result.hasMore }));
      setVisible(value => value + 8);
    } catch { setState(current => ({ ...current, status: "more-error" })); }
  };
  const toggle = async row => {
    const characterId = numericId(row.characterId ?? row.id);
    if (!characterId) return;
    const id = `${characterId}:${mediaId}`;
    setBusyId(characterId); setMessage("");
    try {
      await withTitleStateMutation(() => pinIds.has(characterId) ? removeCharacterPin(id)
        : upsertCharacterPin({ id, characterId, mediaId, nameSnapshot: row.name || row.nameSnapshot,
          imageSnapshot: row.image || row.imageSnapshot || null, note: "", sourceLogId: null,
          pinnedFromLogId: null, pinReason: "", pinnedAt: Date.now() }));
      const latest = readCharacterPinsSnapshot();
      const saved = latest.some(pin => pin.id === id);
      if (saved === pinIds.has(characterId)) throw new Error("PIN_SAVE_FAILED");
      setPins(latest);
    } catch {
      setMessage(ko ? "즐겨찾기를 변경하지 못했어요. 다시 시도해 주세요." : "Could not update favorites. Try again.");
    } finally { setBusyId(null); }
  };
  return <section className="surface-card title-hub__favorites">
    <button type="button" className="title-hub__disclosure" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {ko ? "즐겨찾는 캐릭터" : "Favorite characters"} {ownPins.length ? ` ${ownPins.length}` : ""}
      <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="title-hub__favorite-body">
      {ownPins.length > 0 && <ul>{ownPins.map(pin => <li key={pin.id}><span>{pin.nameSnapshot}</span>
        <button type="button" className="channel-text-button" disabled={busyId != null} onClick={() => toggle(pin)}>
          {ko ? "고정 해제" : "Unpin"}</button></li>)}</ul>}
      {state.status === "loading" && <p role="status">{ko ? "캐릭터를 불러오는 중…" : "Loading characters…"}</p>}
      {state.status === "error" && <p role="alert">{ko ? "후보를 불러오지 못했어요." : "Could not load character suggestions."}
        <button type="button" className="channel-text-button" onClick={() => setRetry(value => value + 1)}>{ko ? "다시 시도" : "Retry"}</button></p>}
      {candidates.length > 0 && <ul>{candidates.filter(row => !pinIds.has(numericId(row.id))).map(row => <li key={row.id}>
        <span>{row.name}</span><button type="button" className="channel-text-button" disabled={busyId != null} onClick={() => toggle(row)}>
          {ko ? "고정" : "Pin"}</button></li>)}</ul>}
      {state.status === "ready" && !state.rows.length && !ownPins.length && <p>{ko ? "고정할 캐릭터가 아직 없어요." : "No characters available yet."}</p>}
      {(visible < state.rows.length || state.hasMore) && <button type="button" className="channel-text-button" disabled={state.status === "loading-more"} onClick={showMore}>
        {ko ? "더 보기" : "Show more"}</button>}
      {state.status === "more-error" && <p role="alert">{ko ? "추가 캐릭터를 불러오지 못했어요." : "Could not load more characters."}</p>}
      <p className="watch-record-help">{ko ? "즐겨찾기는 이 기기에 저장돼요." : "Favorites are saved on this device."}</p>
      {message && <p role="alert">{message}</p>}
    </div>}
  </section>;
}
