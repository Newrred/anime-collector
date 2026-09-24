import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MemoryCardPreview from "./MemoryCardPreview.jsx";
import MemoryPublicationPanel from "./MemoryPublicationPanel.jsx";
import { minihomeUiEnabled } from "../runtime/platformPublication.js";
import { loadMemoryVisual } from "../application/loadMemoryVisual.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./memory-board.css";

const readBoardId = () => new URLSearchParams(globalThis.location?.search || "").get("id") || "";

export default function MemoryBoardView({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="boards">
      <MemoryBoardContent base={base} />
    </MemoryRouteShell>
  );
}

function MemoryBoardContent({ base }) {
  const { copy, locale } = useMemoryRouteUi();
  const boardCopy = copy.boards;
  const [runtime, setRuntime] = useState(null);
  const [boards, setBoards] = useState([]);
  const [archive, setArchive] = useState([]);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("loading");
  const [feedback, setFeedback] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const actionLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const selectedBoardId = useMemo(readBoardId, []);
  const allowLeave = useUnsavedNavigation(detail
    ? Boolean(editing && (title !== detail.board.title || description !== (detail.board.description || "")))
    : Boolean(title || description), locale, { busy });
  const syncLabel = (entity) => boardCopy.syncStates?.[entity?.sync?.syncState] || "";

  const refresh = useCallback(async (activeRuntime, boardId = selectedBoardId, resetEditor = true) => {
    const [nextBoards, nextArchive, nextDetail] = await Promise.all([
      activeRuntime.listBoards(),
      activeRuntime.listArchive(),
      boardId ? activeRuntime.getBoard(boardId) : Promise.resolve(null),
    ]);
    if (nextDetail) nextDetail.items = await Promise.all(nextDetail.items.map(async (item) => ({
      ...item, visual: await loadMemoryVisual(item.bundle, activeRuntime),
    })));
    setBoards(nextBoards);
    setArchive(nextArchive.filter(Boolean));
    setDetail(nextDetail);
    if (nextDetail && resetEditor) {
      setTitle(nextDetail.board.title);
      setDescription(nextDetail.board.description);
    }
  }, [selectedBoardId]);

  useEffect(() => {
    let active = true;
    getPlatformMemoryRuntime().then(async (nextRuntime) => {
      await nextRuntime.initialize();
      if (!active) return;
      setRuntime(nextRuntime);
      await refresh(nextRuntime);
      if (active) setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [refresh]);

  const run = async (action, success) => {
    if (!runtime || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setFeedback("");
    try {
      await action();
      await refresh(runtime, selectedBoardId, success === boardCopy.saved);
      setFeedback(success);
      return true;
    } catch (error) {
      setFeedback(boardCopy.errors?.[error?.code] || boardCopy.actionFailed);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const create = async (event) => {
    event.preventDefault();
    if (!runtime || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const board = await runtime.createBoard({ title, description });
      allowLeave();
      globalThis.location.assign(`${base}boards/?id=${encodeURIComponent(board.id)}`);
    } catch (error) {
      setFeedback(boardCopy.errors?.[error?.code] || boardCopy.actionFailed);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const memberIds = new Set((detail?.items || []).map((item) => item.membership.cardId));
  const availableCards = archive.filter((item) => !memberIds.has(item.card.id));
  const saveBoard = async (event) => {
    event.preventDefault();
    const saved = await run(() => runtime.updateBoard(detail.board.id, { title, description }), boardCopy.saved);
    if (saved) setEditing(false);
  };

  return (
    <div className="memory-boards page-shell page-shell--wide" aria-busy={busy}>
      <header className="memory-boards__header">
        <div className="pageHeader">
          <h1 className="pageTitle">{boardCopy.title}</h1>
          {minihomeUiEnabled() && <a href={`${base}minihome/`} data-astro-reload>{locale === "ko" ? "내 공개 미니홈" : "My public home"}</a>}
        </div>
        <a className="btn btn--subtle" href={`${base}archive/`}>{boardCopy.archiveLink}</a>
      </header>

      {status === "loading" && <p className="surface-card memory-boards__state" role="status">{boardCopy.loading}</p>}
      {status === "error" && <p className="surface-card memory-boards__state" role="alert">{boardCopy.loadFailed} <button type="button" className="btn btn--subtle" onClick={() => globalThis.location.reload()}>{locale === "ko" ? "다시 시도" : "Try again"}</button></p>}
      {feedback && <p className="memory-boards__feedback" role="status">{feedback}</p>}

      {status === "ready" && (
        <div className="memory-boards__layout">
          <aside className="surface-card memory-boards__sidebar" aria-label={boardCopy.listLabel}>
            <div>
              <h2>{boardCopy.yourBoards}</h2>
            </div>
            {boards.length === 0 ? <p className="memory-boards__muted">{boardCopy.empty}</p> : (
              <nav className="memory-boards__list">
                {boards.map((board) => (
                  <a
                    key={board.id}
                    href={`${base}boards/?id=${encodeURIComponent(board.id)}`}
                    data-astro-reload
                    className={board.id === selectedBoardId ? "is-active" : ""}
                    aria-current={board.id === selectedBoardId ? "page" : undefined}
                  >
                    <strong>{board.title}</strong>
                    <span>{boardCopy.cardCount(board.cardCount)}</span>
                  </a>
                ))}
              </nav>
            )}
            {detail ? <a href={`${base}boards/`} data-astro-reload>{boardCopy.newBoard}</a> : <details className="memory-boards__tools">
              <summary>{boardCopy.createTitle}</summary>
            <form className="memory-boards__form" onSubmit={create}>
              <label>
                <span>{boardCopy.titleLabel}</span>
                <input value={detail ? "" : title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required disabled={busy || Boolean(detail)} />
              </label>
              <label>
                <span>{boardCopy.descriptionLabel}</span>
                <textarea value={detail ? "" : description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} disabled={busy || Boolean(detail)} />
              </label>
              <button className="btn" type="submit" disabled={busy || Boolean(detail) || !title.trim()}>{boardCopy.create}</button>
              {detail && <a className="btn btn--subtle" href={`${base}boards/`} data-astro-reload>{boardCopy.newBoard}</a>}
            </form>
            </details>}
          </aside>

          <section className="surface-card memory-boards__detail" aria-live="polite">
            {!selectedBoardId ? (
              <div className="memory-boards__welcome">
                <h2>{boardCopy.chooseTitle}</h2>
                <p>{boardCopy.chooseBody}</p>
              </div>
            ) : !detail ? (
              <div className="memory-boards__welcome">
                <h2>{boardCopy.notFound}</h2>
                <a className="btn" href={`${base}boards/`} data-astro-reload>{boardCopy.backToBoards}</a>
              </div>
            ) : (
              <>
                <div className="memory-boards__section-heading">
                  <div><h2>{detail.board.title}</h2>{detail.board.description && <p>{detail.board.description}</p>}</div>
                  <button type="button" className="btn btn--subtle" aria-expanded={editing} disabled={busy} onClick={() => { setTitle(detail.board.title); setDescription(detail.board.description); setEditing((value) => !value); }}>{editing ? (locale === "ko" ? "취소" : "Cancel") : boardCopy.edit}</button>
                </div>
                {editing && <form className="memory-boards__edit" onSubmit={saveBoard}>
                    <small>{locale === "ko" ? "취소는 이름·설명에만 적용됩니다. 카드 추가·제거·순서는 바로 저장됩니다." : "Cancel discards title and description edits only. Card additions, removals and order save immediately."}</small>
                  <div>
                    <span className="memory-boards__privacy">{boardCopy.privateBadge}</span>
                    {syncLabel(detail.board) ? <span className="status-badge">{syncLabel(detail.board)}</span> : null}
                    <label>
                      <span className="sr-only">{boardCopy.titleLabel}</span>
                      <input className="memory-boards__title-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required disabled={busy} />
                    </label>
                    <label>
                      <span className="sr-only">{boardCopy.descriptionLabel}</span>
                      <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} disabled={busy} placeholder={boardCopy.descriptionPlaceholder} />
                    </label>
                  </div>
                  <div className="memory-boards__edit-actions">
                    <button className="btn btn--subtle" type="submit" disabled={busy || !title.trim()}>{boardCopy.save}</button>
                    <button className="btn btn--danger" type="button" disabled={busy} onClick={() => {
                      if (!globalThis.confirm(boardCopy.deleteConfirm)) return;
                      run(async () => {
                        await runtime.deleteBoard(detail.board.id);
                        allowLeave();
                        globalThis.location.assign(`${base}boards/`);
                      }, boardCopy.deleted);
                    }}>{boardCopy.delete}</button>
                  </div>
                </form>}

                <section>
                  <div className="memory-boards__section-heading">
                    <div><h2>{boardCopy.cardsTitle}</h2>{editing && <p>{boardCopy.reorderHelp}</p>}</div>
                    <span>{boardCopy.cardCount(detail.items.length)}</span>
                  </div>
                  {detail.items.length === 0 ? <p className="memory-boards__muted">{boardCopy.noCards}</p> : (
                    <ol className="memory-boards__cards">
                      {detail.items.map((item, index) => {
                        const { membership, bundle } = item;
                        const beforePrevious = detail.items[index - 2]?.membership.positionKey || null;
                        const previous = detail.items[index - 1]?.membership.positionKey || null;
                        const next = detail.items[index + 1]?.membership.positionKey || null;
                        const afterNext = detail.items[index + 2]?.membership.positionKey || null;
                        return (
                          <li key={membership.id}>
                            <MemoryCardPreview href={`${base}memory/card/?id=${encodeURIComponent(bundle.card.id)}`}
                              title={bundle.title.displayTitle} cue={bundle.card.note || boardCopy.noReflection}
                              visual={item.visual} syncBadge={syncLabel(bundle.card)}
                              visualFit={bundle.asset.imageType === "CATALOG_COVER" ? "contain" : "cover"}
                            />
                            {editing && <div className="memory-boards__card-actions">
                              <button type="button" className="btn btn--subtle" disabled={busy || index === 0} aria-label={boardCopy.moveUp(bundle.title.displayTitle)} onClick={() => run(
                                () => runtime.reorderBoardCard(detail.board.id, bundle.card.id, { leftPosition: beforePrevious, rightPosition: previous }),
                                boardCopy.reordered,
                              )}>↑</button>
                              <button type="button" className="btn btn--subtle" disabled={busy || index === detail.items.length - 1} aria-label={boardCopy.moveDown(bundle.title.displayTitle)} onClick={() => run(
                                () => runtime.reorderBoardCard(detail.board.id, bundle.card.id, { leftPosition: next, rightPosition: afterNext }),
                                boardCopy.reordered,
                              )}>↓</button>
                              <button type="button" className="btn btn--subtle" disabled={busy} onClick={() => run(
                                () => runtime.removeCardFromBoard(detail.board.id, bundle.card.id),
                                boardCopy.removed,
                              )}>{boardCopy.remove}</button>
                            </div>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                <MemoryPublicationPanel detail={detail} runtime={runtime} locale={locale} base={base} disabled={busy || editing} />
                <details className="memory-boards__tools">
                  <summary>{boardCopy.addTitle}</summary>
                  <div className="memory-boards__add">
                  {availableCards.length === 0 ? <p className="memory-boards__muted">{boardCopy.noAvailable}</p> : (
                    <ul>
                      {availableCards.map((bundle) => (
                        <li key={bundle.card.id}>
                          <div><strong>{bundle.title.displayTitle}</strong><span>{bundle.card.note || boardCopy.noReflection}</span></div>
                          <button className="btn btn--subtle" type="button" disabled={busy} onClick={() => run(
                            () => runtime.addCardToBoard(detail.board.id, bundle.card.id),
                            boardCopy.added,
                          )}>{boardCopy.add}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
