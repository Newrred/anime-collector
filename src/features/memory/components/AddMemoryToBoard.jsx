import { useRef, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";

export default function AddMemoryToBoard({ cardId, base = "/", locale = "ko" }) {
  const actionLock = useRef(false);
  const [addedId, setAddedId] = useState("");
  const ko = locale === "ko";
  const [boards, setBoards] = useState(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <details className="memory-board-picker" onToggle={async (event) => {
    if (!event.currentTarget.open || boards !== null) return;
    try { const runtime = await getPlatformMemoryRuntime(); setBoards(await runtime.listBoards()); }
    catch { setMessage(ko ? "보드를 불러오지 못했어요." : "Could not load Boards."); }
  }}>
    <summary>{ko ? "보드에 담기" : "Add to a Board"}</summary>
    {boards?.length ? <form className="action-row" onSubmit={async (event) => {
      event.preventDefault(); if (actionLock.current || !selected) return; actionLock.current = true; setBusy(true); setMessage("");
      try { const runtime = await getPlatformMemoryRuntime(); await runtime.addCardToBoard(selected, cardId); setAddedId(selected); setSelected(""); setMessage(ko ? "보드에 담았어요." : "Added to Board."); }
      catch (error) { setMessage(error?.code === "BOARD_CARD_EXISTS" ? (ko ? "이미 이 보드에 있어요." : "Already in this Board.") : (ko ? "추가하지 못했어요. 다시 시도해 주세요." : "Could not add. Try again.")); }
      finally { actionLock.current = false; setBusy(false); }
    }}><label>{ko ? "보드 선택" : "Choose Board"}<select required disabled={busy} value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">{ko ? "선택" : "Select"}</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label><button className="btn btn--subtle" disabled={busy || !selected}>{ko ? "담기" : "Add"}</button></form> : null}
    {boards?.length === 0 ? <a href={`${base}boards/`}>{ko ? "보드 만들기" : "Create a Board"}</a> : null}
    <p role="status">{message}</p>
    {addedId && <a href={`${base}boards/?id=${encodeURIComponent(addedId)}`}>{ko ? "보드 열기" : "Open Board"}</a>}
  </details>;
}
