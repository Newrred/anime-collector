import { useEffect, useState } from "react";
import { publicDesignStyle, publicImageUrl } from "../domain/publicVisual.js";
import { publicationCopy } from "./publicationCopy.js";
import "./system-design-preview.css";
import "./memory-publication.css";

export default function PublicBoardSnapshot({ snapshot, publicationId, services, preview = false, locale = "en", onReady }) {
  const copy = publicationCopy(locale);
  const [visuals, setVisuals] = useState({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    let alive = true;
    const urls = [];
    setVisuals({});
    const timeout = setTimeout(() => {
      request.abort();
      if (alive) setVisuals((current) => Object.fromEntries(snapshot.cards.map((card) => [card.id,
        current[card.id]?.status === "ready" ? current[card.id] : { status: "error" }])));
    }, 20000);
    for (const card of snapshot.cards) {
      (async () => {
        if (card.visual.type === "SYSTEM_DESIGN") return { status: "ready" };
        let src;
        if (card.visual.type === "CATALOG_COVER") src = await services.resolveCover(card, request.signal);
        else if (preview) {
          const blob = await services.previewImage(card.visual.assetId, request.signal);
          if (!alive) return null;
          src = URL.createObjectURL(blob); urls.push(src);
        } else src = publicImageUrl(publicationId, card.visual.assetId, "full");
        return { status: "loading", src };
      })().then((visual) => {
        if (alive && visual) setVisuals((current) => ({ ...current, [card.id]: visual }));
      }).catch(() => {
        if (alive) setVisuals((current) => ({ ...current, [card.id]: { status: "error" } }));
      });
    }
    return () => { alive = false; clearTimeout(timeout); request.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [snapshot, services, publicationId, preview, retry]);
  const ready = snapshot.cards.length > 0 && snapshot.cards.every((card) => visuals[card.id]?.status === "ready");
  useEffect(() => { onReady?.(ready); }, [ready, onReady]);
  const mark = (id, status) => setVisuals((current) => ({ ...current, [id]: { ...current[id], status } }));
  const failed = Object.values(visuals).some((visual) => visual.status === "error");
  return <section className="public-board-snapshot" aria-label={preview ? copy.previewTitle : copy.title}>
    <header><h2>{snapshot.title}</h2>{snapshot.description && <p>{snapshot.description}</p>}</header>
    {!snapshot.cards.length && <p>{copy.empty}</p>}
    <ol className="public-board-snapshot__cards">
      {snapshot.cards.map((card) => {
        const visual = visuals[card.id];
        return <li key={card.id}>
          <article>
            {card.visual.type === "SYSTEM_DESIGN" ? <div className="system-design-preview" style={publicDesignStyle(card.visual)}
              data-pattern-token={card.visual.patternToken} role="img" aria-label={card.title}>
              <strong>{card.title}</strong><small>MOEMOA</small>
            </div> : visual?.status === "error" ? <div className="public-board-snapshot__missing" role="status">{copy.missing}</div>
              : <div className="public-board-snapshot__image">
                {visual?.src && <img src={visual.src} alt={card.title} referrerPolicy="no-referrer"
                  onLoad={() => mark(card.id, "ready")} onError={() => mark(card.id, "error")} />}
                {visual?.status !== "ready" && <span role="status">{copy.loading}</span>}
              </div>}
            <h3>{card.title}</h3>
            <dl>{Object.entries(copy.details).map(([field, label]) => {
              let value = card[field];
              if (Array.isArray(value)) value = value.join(" · ");
              if (field === "watchedAt" && value) value = value.slice(0, card.watchedAtPrecision === "YEAR" ? 4 : card.watchedAtPrecision === "MONTH" ? 7 : 10);
              return value ? <div key={field}><dt>{label}</dt><dd>{value}</dd></div> : null;
            })}</dl>
          </article>
        </li>;
      })}
    </ol>
    {failed && <button type="button" className="btn btn--subtle" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>}
  </section>;
}
