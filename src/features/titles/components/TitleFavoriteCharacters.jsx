import { useEffect, useState } from "react";
import { createTitleCharactersReader } from "../application/titleCharacters.js";
import { readCharacterPinsSnapshot, removeCharacterPin, upsertCharacterPin } from "../../../repositories/characterPinRepo.js";
import { withTitleStateMutation } from "../application/titleStateMutationLock.js";

const reader = createTitleCharactersReader({ catalog: null });
const numericId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export default function TitleFavoriteCharacters({ anilistId, locale }) {
  const ko = locale === "ko";
  const mediaId = numericId(anilistId);
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState(() => readCharacterPinsSnapshot());
  const [state, setState] = useState({ status: "idle", rows: [] });
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [visible, setVisible] = useState(8);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open || !mediaId) return undefined;
    let active = true;
    setState({ status: "loading", rows: [] });
    reader({ animeId: null, anilistId: mediaId }).then(result => {
      if (active) setState({ status: "ready", rows: result.characters.filter(row => numericId(row.id)) });
    }).catch(() => active && setState({ status: "error", rows: [] }));
    return () => { active = false; };
  }, [open, mediaId, retry]);
  if (!mediaId) return null;
  const ownPins = pins.filter(pin => pin.mediaId === mediaId);
  const pinIds = new Set(ownPins.map(pin => pin.characterId));
  const candidates = state.rows.slice(0, visible);
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
      {visible < state.rows.length && <button type="button" className="channel-text-button" onClick={() => setVisible(value => value + 8)}>
        {ko ? "더 보기" : "Show more"}</button>}
      <p className="watch-record-help">{ko ? "즐겨찾기는 이 기기에 저장돼요." : "Favorites are saved on this device."}</p>
      {message && <p role="alert">{message}</p>}
    </div>}
  </section>;
}
