import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import SystemDesignPreview from "./SystemDesignPreview.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./archive-view.css";

export default function ArchiveView({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="archive">
      <ArchiveContent base={base} />
    </MemoryRouteShell>
  );
}

function ArchiveContent({ base }) {
  const { copy } = useMemoryRouteUi();
  const archiveCopy = copy.archive;
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
    <div className="memory-archive page-shell">
      <header className="memory-archive__header">
        <div>
          <a className="memory-archive__brand" href={base}>MOEMOA</a>
          <p className="memory-archive__eyebrow">{archiveCopy.eyebrow}</p>
          <h1 className="pageTitle">{archiveCopy.title}</h1>
          <p className="pageLead">{archiveCopy.lead}</p>
        </div>
        <a className="btn" href={`${base}memory/new/`}>{archiveCopy.create}</a>
      </header>

      {status === "loading" && <p className="surface-card memory-archive__state">{archiveCopy.loading}</p>}
      {status === "error" && (
        <p className="surface-card memory-archive__state" role="alert">
          {archiveCopy.error}
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <section className="surface-card memory-archive__state">
          <h2>{archiveCopy.emptyTitle}</h2>
          <p>{archiveCopy.emptyBody}</p>
          <a className="btn memory-archive__empty-action" href={`${base}memory/new/`}>{archiveCopy.firstCard}</a>
        </section>
      )}

      {items.length > 0 && (
        <section className="memory-archive__grid" aria-label={archiveCopy.listLabel}>
          {items.map(({ card, title, asset, previewDataUrl }) => (
            <article className="surface-card memory-archive__card" key={card.id}>
              {asset.designSpec ? (
                <SystemDesignPreview spec={asset.designSpec} title={title.displayTitle} copy={copy.systemDesign} />
              ) : previewDataUrl ? (
                <img src={previewDataUrl} alt={archiveCopy.cardAlt(title.displayTitle)} />
              ) : (
                <div className="memory-archive__missing-image">{archiveCopy.missingImage}</div>
              )}
              <div className="memory-archive__card-body">
                <span className="status-badge">
                  {asset.designSpec ? archiveCopy.systemDesign : archiveCopy.privateImage}
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
  );
}
