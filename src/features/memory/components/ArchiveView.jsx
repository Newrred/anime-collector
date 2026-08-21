import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import MemoryRouteShell from "./MemoryRouteShell.jsx";
import "./archive-view.css";

export default function ArchiveView({ base = "/" }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    getPlatformMemoryRuntime().then(async (runtime) => {
      await runtime.initialize();
      const archive = await runtime.listArchive();
      const withPreviews = await Promise.all(archive.filter(Boolean).map(async (item) => ({
        ...item,
        previewDataUrl: item.asset.localRef
          ? await runtime.getPreview(item.asset.localRef).catch(() => null)
          : null,
      })));
      if (!active) return;
      setItems(withPreviews);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, []);

  return (
    <MemoryRouteShell base={base} currentRoute="archive">
    <div className="memory-archive page-shell">
      <header className="memory-archive__header">
        <div>
          <a className="memory-archive__brand" href={base}>MOEMOA</a>
          <p className="memory-archive__eyebrow">Private · Local only</p>
          <h1 className="pageTitle">Memory Archive</h1>
          <p className="pageLead">내가 남긴 장면과 감상을 이 기기에서 다시 꺼내보세요.</p>
        </div>
        <a className="btn" href={`${base}memory/new/`}>새 카드 만들기</a>
      </header>

      {status === "loading" && <p className="surface-card memory-archive__state">Archive를 불러오고 있어요…</p>}
      {status === "error" && (
        <p className="surface-card memory-archive__state" role="alert">
          Archive를 불러오지 못했어요. 앱을 다시 열어 주세요.
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <section className="surface-card memory-archive__state">
          <h2>아직 저장한 카드가 없어요.</h2>
          <p>기억하고 싶은 장면 한 장으로 첫 카드를 만들어 보세요.</p>
          <a className="btn memory-archive__empty-action" href={`${base}memory/new/`}>첫 카드 만들기</a>
        </section>
      )}

      {items.length > 0 && (
        <section className="memory-archive__grid" aria-label="저장한 메모리 카드">
          {items.map(({ card, title, asset, previewDataUrl }) => (
            <article className="surface-card memory-archive__card" key={card.id}>
              {asset.designSpec ? (
                <SystemDesignPreview spec={asset.designSpec} title={title.displayTitle} />
              ) : previewDataUrl ? (
                <img src={previewDataUrl} alt={`${title.displayTitle} 메모리 카드`} />
              ) : (
                <div className="memory-archive__missing-image">이미지를 불러올 수 없어요.</div>
              )}
              <div className="memory-archive__card-body">
                <span className="status-badge">
                  {asset.designSpec ? "System design" : "Private image"}
                </span>
                <a
                  className="memory-archive__card-link"
                  href={`${base}memory/card/?id=${encodeURIComponent(card.id)}`}
                >
                  <h2>{title.displayTitle}</h2>
                </a>
                {card.note && <p>{card.note}</p>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
    </MemoryRouteShell>
  );
}
