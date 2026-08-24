import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryCardPreview from "./MemoryCardPreview.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import "./archive-view.css";

const formatArchiveDate = (value, locale) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
};

const toArchiveVisual = ({ asset, previewDataUrl, title, archiveCopy }) => {
  if (asset.designSpec) return { kind: "SYSTEM_DESIGN", designSpec: asset.designSpec };
  if (previewDataUrl) {
    return {
      kind: "IMAGE",
      src: previewDataUrl,
      alt: archiveCopy.cardAlt(title.displayTitle),
    };
  }
  return { kind: "MISSING" };
};

export default function ArchiveView({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="archive">
      <ArchiveContent base={base} />
    </MemoryRouteShell>
  );
}

function ArchiveContent({ base }) {
  const { locale, copy } = useMemoryRouteUi();
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
    <div className="memory-archive page-shell page-shell--wide">
      <header className="memory-archive__header">
        <div className="pageHeader">
          <p className="memory-archive__eyebrow">{archiveCopy.eyebrow}</p>
          <h1 className="pageTitle">{archiveCopy.title}</h1>
          <p className="pageLead">{archiveCopy.lead}</p>
          {status === "ready" && items.length > 0 && (
            <p className="memory-archive__summary">{archiveCopy.count(items.length)}</p>
          )}
        </div>
        <a className="btn" href={`${base}memory/new/`}>{archiveCopy.create}</a>
      </header>

      {status === "loading" && (
        <p className="surface-card memory-archive__state" role="status">{archiveCopy.loading}</p>
      )}
      {status === "error" && (
        <p className="surface-card memory-archive__state" role="alert">
          {archiveCopy.error}
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <section className="surface-card memory-archive__state">
          <h2>{archiveCopy.emptyTitle}</h2>
          <p>{archiveCopy.emptyBody}</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="memory-archive__grid" aria-label={archiveCopy.listLabel}>
          {items.map(({ card, title, asset, previewDataUrl }) => (
            <MemoryCardPreview
              key={card.id}
              className="surface-card memory-archive__card"
              href={`${base}memory/card/?id=${encodeURIComponent(card.id)}`}
              title={title.displayTitle}
              cue={card.note || ""}
              dateLabel={formatArchiveDate(card.updatedAt, locale)}
              badge={asset.designSpec ? archiveCopy.systemDesign : archiveCopy.privateImage}
              visual={toArchiveVisual({ asset, previewDataUrl, title, archiveCopy })}
              variant="grid"
              systemCopy={{
                label: copy.systemDesign.label,
                fallbackTitle: title.displayTitle,
                footer: copy.systemDesign.footer,
              }}
              missingLabel={archiveCopy.missingImage}
            />
          ))}
        </section>
      )}
    </div>
  );
}
