import { useCallback, useEffect, useMemo, useState } from "react";
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
  const { copy } = useMemoryRouteUi();
  const boardCopy = copy.boards;
  const [runtime, setRuntime] = useState(null);
  const [boards, setBoards] = useState([]);
  const [archive, setArchive] = useState([]);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("loading");
  const [feedback, setFeedback] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const selectedBoardId = useMemo(readBoardId, []);

  const refresh = useCallback(async (activeRuntime, boardId = selectedBoardId) => {
    const [nextBoards, nextArchive, nextDetail] = await Promise.all([
      activeRuntime.listBoards(),
      activeRuntime.listArchive(),
      boardId ? activeRuntime.getBoard(boardId) : Promise.resolve(null),
    ]);
    setBoards(nextBoards);
    setArchive(nextArchive.filter(Boolean));
    setDetail(nextDetail);
    if (nextDetail) {
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
    if (!runtime) return;
    setFeedback("");
    try {
      await action();
      await refresh(runtime);
      setFeedback(success);
    } catch (error) {
      setFeedback(boardCopy.errors?.[error?.code] || boardCopy.actionFailed);
    }
  };

  const create = async (event) => {
    event.preventDefault();
    if (!runtime) return;
    try {
      const board = await runtime.createBoard({ title, description });
      globalThis.location.assign(`${base}boards/?id=${encodeURIComponent(board.id)}`);
    } catch (error) {
      setFeedback(boardCopy.errors?.[error?.code] || boardCopy.actionFailed);
    }
  };

  const memberIds = new Set((detail?.items || []).map((item) => item.membership.cardId));
  const availableCards = archive.filter((item) => !memberIds.has(item.card.id));

  return (
    <main className="memory-boards page-shell page-shell--wide">
      <header className="memory-boards__header">
        <div className="pageHeader">
          <p className="memory-boards__eyebrow">{boardCopy.eyebrow}</p>
          <h1 className="pageTitle">{boardCopy.title}</h1>
          <p className="pageLead">{boardCopy.lead}</p>
        </div>
        <a className="btn btn--subtle" href={`${base}archive/`}>{boardCopy.archiveLink}</a>
      </header>

      {status === "loading" && <p className="surface-card memory-boards__state" role="status">{boardCopy.loading}</p>}
      {status === "error" && <p className="surface-card memory-boards__state" role="alert">{boardCopy.loadFailed}</p>}
      {feedback && <p className="memory-boards__feedback" role="status">{feedback}</p>}

      {status === "ready" && (
        <div className="memory-boards__layout">
          <aside className="surface-card memory-boards__sidebar" aria-label={boardCopy.listLabel}>
            <div>
              <h2>{boardCopy.yourBoards}</h2>
              <p>{boardCopy.privateCopy}</p>
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
            <form className="memory-boards__form" onSubmit={create}>
              <h3>{boardCopy.createTitle}</h3>
              <label>
                <span>{boardCopy.titleLabel}</span>
                <input value={detail ? "" : title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required disabled={Boolean(detail)} />
              </label>
              <label>
                <span>{boardCopy.descriptionLabel}</span>
                <textarea value={detail ? "" : description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} disabled={Boolean(detail)} />
              </label>
              <button className="btn" type="submit" disabled={Boolean(detail) || !title.trim()}>{boardCopy.create}</button>
              {detail && <a className="btn btn--subtle" href={`${base}boards/`} data-astro-reload>{boardCopy.newBoard}</a>}
            </form>
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
                <form className="memory-boards__edit" onSubmit={(event) => {
                  event.preventDefault();
                  run(() => runtime.updateBoard(detail.board.id, { title, description }), boardCopy.saved);
                }}>
                  <div>
                    <span className="memory-boards__privacy">{boardCopy.privateBadge}</span>
                    <label>
                      <span className="sr-only">{boardCopy.titleLabel}</span>
                      <input className="memory-boards__title-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
                    </label>
                    <label>
                      <span className="sr-only">{boardCopy.descriptionLabel}</span>
                      <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder={boardCopy.descriptionPlaceholder} />
                    </label>
                  </div>
                  <div className="memory-boards__edit-actions">
                    <button className="btn btn--subtle" type="submit">{boardCopy.save}</button>
                    <button className="btn btn--danger" type="button" onClick={() => {
                      if (!globalThis.confirm(boardCopy.deleteConfirm)) return;
                      run(async () => {
                        await runtime.deleteBoard(detail.board.id);
                        globalThis.location.assign(`${base}boards/`);
                      }, boardCopy.deleted);
                    }}>{boardCopy.delete}</button>
                  </div>
                </form>

                <section>
                  <div className="memory-boards__section-heading">
                    <div><h2>{boardCopy.cardsTitle}</h2><p>{boardCopy.reorderHelp}</p></div>
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
                            <a href={`${base}memory/card/?id=${encodeURIComponent(bundle.card.id)}`}>
                              <strong>{bundle.title.displayTitle}</strong>
                              <span>{bundle.card.note || boardCopy.noReflection}</span>
                            </a>
                            <div className="memory-boards__card-actions">
                              <button type="button" className="btn btn--subtle" disabled={index === 0} aria-label={boardCopy.moveUp(bundle.title.displayTitle)} onClick={() => run(
                                () => runtime.reorderBoardCard(detail.board.id, bundle.card.id, { leftPosition: beforePrevious, rightPosition: previous }),
                                boardCopy.reordered,
                              )}>↑</button>
                              <button type="button" className="btn btn--subtle" disabled={index === detail.items.length - 1} aria-label={boardCopy.moveDown(bundle.title.displayTitle)} onClick={() => run(
                                () => runtime.reorderBoardCard(detail.board.id, bundle.card.id, { leftPosition: next, rightPosition: afterNext }),
                                boardCopy.reordered,
                              )}>↓</button>
                              <button type="button" className="btn btn--subtle" onClick={() => run(
                                () => runtime.removeCardFromBoard(detail.board.id, bundle.card.id),
                                boardCopy.removed,
                              )}>{boardCopy.remove}</button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                <section className="memory-boards__add">
                  <div className="memory-boards__section-heading"><div><h2>{boardCopy.addTitle}</h2><p>{boardCopy.addHelp}</p></div></div>
                  {availableCards.length === 0 ? <p className="memory-boards__muted">{boardCopy.noAvailable}</p> : (
                    <ul>
                      {availableCards.map((bundle) => (
                        <li key={bundle.card.id}>
                          <div><strong>{bundle.title.displayTitle}</strong><span>{bundle.card.note || boardCopy.noReflection}</span></div>
                          <button className="btn btn--subtle" type="button" onClick={() => run(
                            () => runtime.addCardToBoard(detail.board.id, bundle.card.id),
                            boardCopy.added,
                          )}>{boardCopy.add}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
