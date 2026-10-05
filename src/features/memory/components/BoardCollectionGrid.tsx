import { useEffect, useRef, useState } from "react";
import { loadMemoryVisual } from "../application/loadMemoryVisual.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import PrivateMemoryCardPreview from "./PrivateMemoryCardPreview.jsx";
import MemoryVisual from "./MemoryVisual.jsx";
import "./board-collection-grid.css";

type BoardSummary = { id: string; title: string; description?: string; cardCount: number; updatedAt?: string };
type Runtime = Awaited<ReturnType<typeof getPlatformMemoryRuntime>>;
type Preview = { bundle: Parameters<typeof loadMemoryVisual>[0]; visual: Awaited<ReturnType<typeof loadMemoryVisual>> };
type Props = { boards: BoardSummary[]; runtime: Runtime; base?: string; locale?: string };

function BoardCollectionTile({ board, runtime, base, locale }: Omit<Props, "boards"> & { board: BoardSummary }) {
  const element = useRef<HTMLAnchorElement>(null);
  const [preview, setPreview] = useState<{ id: string; items: Preview[] } | null>(null);
  useEffect(() => {
    let active = true;
    let started = false;
    const start = async () => {
      if (started || !runtime) return;
      started = true;
      try {
        const detail = await runtime.getBoard(board.id);
        const items = await Promise.all((detail?.items || []).slice(0, 3).map(async ({ bundle }) => ({
          bundle, visual: await loadMemoryVisual(bundle, runtime),
        })));
        if (active) setPreview({ id: board.id, items });
      } catch {
        if (active) setPreview({ id: board.id, items: [] });
      }
    };
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: "160px" }) : null;
    if (observer && element.current) observer.observe(element.current); else start();
    return () => { active = false; observer?.disconnect(); };
  }, [board.id, board.updatedAt, board.cardCount, runtime]);
  const items = preview?.id === board.id ? preview.items : [];
  return (
    <a ref={element} className="board-collection" href={`${base}boards/?id=${encodeURIComponent(board.id)}`} data-astro-reload aria-label={board.title}>
      <div className={`board-collection__cover${items.length ? "" : " is-empty"}`}>
        {items.length ? Array.from({ length: 3 }, (_, index) => {
          const item = items[index];
          return item ? (
            <PrivateMemoryCardPreview key={item.bundle.card.id} runtime={runtime} bundle={item.bundle} locale={locale} visual={item.visual} title={item.bundle.title.displayTitle}>
              {({ visual, missingLabel, elementRef }) => <span ref={elementRef} className="board-collection__image">
                <MemoryVisual visual={visual} fit={item.bundle.asset.imageType === "CATALOG_COVER" ? "contain" : "cover"}
                  systemCopy={{ fallbackTitle: item.bundle.title.displayTitle }} missingLabel={missingLabel || (locale === "ko" ? "이미지 없음" : "No image")} />
              </span>}
            </PrivateMemoryCardPreview>
          ) : <span key={`empty-${index}`} className="board-collection__placeholder" aria-hidden="true" />;
        }) : <span className="board-collection__empty-mark" aria-hidden="true"><span /><span /><span /></span>}
      </div>
      <div className="board-collection__caption">
        <h3>{board.title}</h3>
        <span>{locale === "ko" ? `기억 ${board.cardCount || 0}개` : `${board.cardCount || 0} memories`}</span>
      </div>
      {board.description ? <p>{board.description}</p> : null}
    </a>
  );
}

export default function BoardCollectionGrid({ boards, runtime, base = "/", locale = "ko" }: Props) {
  return <div className="board-collection-grid">
    {boards.map((board) => <BoardCollectionTile key={board.id} board={board} runtime={runtime} base={base} locale={locale} />)}
  </div>;
}
