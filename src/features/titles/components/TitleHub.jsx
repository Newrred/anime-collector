import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { buildMemoryCardHref } from "../../../domain/search/memoryCardNavigation.js";
import MemoryCardPreview from "../../memory/components/MemoryCardPreview.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "../../memory/components/MemoryRouteShell.jsx";
import { createTitleHubService } from "../application/titleHubService.js";
import { parseTitleHubRequest } from "../domain/titleNavigation.js";
import "./title-hub.css";

const dateLabel = (value, locale) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", { dateStyle: "medium" }).format(parsed)
    : "";
};

const displayValue = (value) => String(value || "").trim() || "—";

function TitleIdentity({ album, copy, memoryHref, busy, onToggleSaved }) {
  const detail = album.catalogDetail;
  const canAddMemory = album.titleRef.kind === "ANIME" || album.isPrivateTitle;
  const facts = [
    detail?.release?.format,
    Number.isSafeInteger(detail?.release?.episodeCount) ? copy.episodeCount(detail.release.episodeCount) : null,
    album.genres[0],
  ].filter(Boolean);

  return (
    <header className="title-hub__identity">
      <div className="title-hub__poster" aria-label={copy.catalogBadge}>
        {album.officialCover?.src ? (
          <img src={album.officialCover.src} alt={`${album.displayTitle} ${copy.catalogBadge}`} />
        ) : (
          <span aria-hidden="true">MOEMOA</span>
        )}
      </div>
      <div className="title-hub__identity-copy">
        <div className="title-hub__badges">
          <span className="status-badge">{album.isPrivateTitle ? copy.privateBadge : copy.catalogBadge}</span>
          <span className="status-badge">{album.tracking.isSaved ? copy.saved : copy.notSaved}</span>
        </div>
        <h1 className="pageTitle">{album.displayTitle}</h1>
        {facts.length ? <p className="title-hub__facts">{facts.join(" · ")}</p> : null}
        {album.isPrivateTitle ? <p className="title-hub__private-notice">{copy.privateNotice}</p> : null}
        <div className="title-hub__actions">
          {canAddMemory ? (
            <a className="btn" href={memoryHref} data-astro-reload>
              {album.memoryCount ? copy.addMemory : copy.firstMemory}
            </a>
          ) : null}
          {album.anilistId || album.titleRef?.kind === "ANIME" ? (
            <button className="btn btn--subtle" type="button" disabled={busy} onClick={onToggleSaved}>
              {busy ? copy.savingTitle : album.tracking.isSaved ? copy.removeTitle : copy.saveTitle}
            </button>
          ) : null}
        </div>
        {!canAddMemory && !album.isPrivateTitle ? <p className="title-hub__action-help">{copy.memoryRequiresCatalog}</p> : null}
      </div>
    </header>
  );
}

function TitleMemoryGallery({ album, base, copy, locale }) {
  return (
    <section className="title-hub__memories" aria-labelledby="title-memory-heading">
      <div className="title-hub__section-heading">
        <div>
          <h2 id="title-memory-heading">{copy.memories(album.memoryCount)}</h2>
        </div>
      </div>
      {album.memoryCount ? (
        <div className="title-hub__memory-grid">
          {album.memories.map((memory) => (
            <MemoryCardPreview
              key={memory.card.id}
              className="surface-card title-hub__memory"
              href={`${base}memory/card/?id=${encodeURIComponent(memory.card.id)}`}
              title={memory.title.displayTitle}
              cue={memory.card.note || ""}
              dateLabel={dateLabel(memory.card.updatedAt, locale)}
              badge={copy.memorySource[memory.sourceKind] || ""}
              visual={memory.visual}
              visualFit="contain"
              missingLabel={copy.memorySource.MISSING}
            />
          ))}
        </div>
      ) : (
        <div className="surface-card title-hub__empty">
          <h3>{copy.noMemories}</h3>
          <p>{copy.noMemoriesLead}</p>
        </div>
      )}
    </section>
  );
}

function TitleFacts({ album, copy, base, service, onTracking, locale }) {
  const detail = album.catalogDetail;
  const studios = detail?.studios?.map((row) => row.name).filter(Boolean).join(", ");
  const rows = [
    [copy.format, detail?.release?.format],
    [copy.episodes, detail?.release?.episodeCount],
    [copy.release, detail?.release?.startDate],
    [copy.studio, studios],
    [copy.genres, album.genres.join(", ")],
  ];
  return (
    <aside className="title-hub__side">
      <section className="surface-card title-hub__metadata">
        <h2>{copy.metadata}</h2>
        <dl>{rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>
        ))}</dl>
      </section>
      <section className="surface-card title-hub__tracking">
        <h2>{copy.watchLogs(album.watchLogs.length)}</h2>
        {album.tracking.isSaved && album.anilistId ? (
          <a className="btn btn--subtle" href={`${base}library/?animeId=${album.anilistId}&focus=edit`} data-astro-reload>{copy.editTracking}</a>
        ) : null}
        {album.tracking.isSaved && album.titleRef.kind === "ANIME" && !album.anilistId ? <TitleTrackingEditor album={album} service={service} onTracking={onTracking} locale={locale} /> : null}
        <dl>
          <div><dt>{copy.watchingStatus}</dt><dd>{displayValue(album.tracking.watchStatus)}</dd></div>
          <div><dt>{copy.rating}</dt><dd>{album.tracking.rating == null ? "—" : album.tracking.rating}</dd></div>
        </dl>
        {!album.watchLogs.length ? <p>{copy.noWatchLogs}</p> : null}
      </section>
    </aside>
  );
}

function TitleTrackingEditor({ album, service, onTracking, locale }) {
  const ko = locale === "ko";
  const [watchStatus, setWatchStatus] = useState(album.tracking.watchStatus || "미분류");
  const [rating, setRating] = useState(album.tracking.rating ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <details><summary>{ko ? "시청 상태·평점 수정" : "Edit status and rating"}</summary>
    <form className="ui-panel-stack" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
      try { onTracking(await service.updateTracking(album, { watchStatus, rating })); setMessage(ko ? "저장했어요" : "Saved"); }
      catch { setMessage(ko ? "저장하지 못했어요. 다시 시도해 주세요." : "Could not save. Please try again."); }
      finally { setBusy(false); }
    }}>
      <label>{ko ? "시청 상태" : "Watch status"}<select value={watchStatus} onChange={(e) => setWatchStatus(e.target.value)}>
        {["미분류", "보는중", "완료", "보류", "하차", "볼예정"].map((value, i) => <option key={value} value={value}>{ko ? value : ["Unsorted", "Watching", "Completed", "On hold", "Dropped", "Plan to watch"][i]}</option>)}
      </select></label>
      <label>{ko ? "평점 (0~5, 미평가는 비워두기)" : "Rating (0–5, leave blank if unrated)"}<input type="number" min="0" max="5" step="0.5" value={rating} onChange={(e) => setRating(e.target.value)} /></label>
      <button className="btn" disabled={busy}>{ko ? "저장" : "Save"}</button><p role="status">{message}</p>
    </form>
  </details>;
}

export default function TitleHub({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="title">
      <TitleHubContent base={base} />
    </MemoryRouteShell>
  );
}

function TitleHubContent({ base }) {
  const { copy: memoryCopy, locale } = useMemoryRouteUi();
  const copy = memoryCopy.titleHub;
  const request = useMemo(() => parseTitleHubRequest(window.location.search), []);
  const service = useMemo(() => (
    import.meta.env.DEV && globalThis.__MOEMOA_TEST_TITLE_HUB_SERVICE__
      ? globalThis.__MOEMOA_TEST_TITLE_HUB_SERVICE__
      : createTitleHubService()
  ), []);
  const [album, setAlbum] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!request) {
      setStatus("not-found");
      return () => { active = false; };
    }
    service.load(request).then((nextAlbum) => {
      if (!active) return;
      setAlbum(nextAlbum);
      setStatus(nextAlbum ? "ready" : "not-found");
    }).catch(() => active && setStatus("error"));
    return () => { active = false; };
  }, [request, service]);

  const toggleSaved = async () => {
    if (!album || status !== "ready") return;
    setStatus("saving");
    setMessage("");
    try {
      const isSaved = await service.setSaved(album, !album.tracking.isSaved);
      setAlbum((current) => ({
        ...current,
        tracking: { ...current.tracking, isSaved },
        presence: isSaved
          ? (current.memoryCount ? "SAVED_WITH_MEMORY" : "SAVED_NO_MEMORY")
          : (current.memoryCount ? "NOT_SAVED_WITH_MEMORY" : "NOT_SAVED_NO_MEMORY"),
      }));
    } catch {
      setMessage(copy.actionFailed);
    } finally {
      setStatus("ready");
    }
  };

  if (status === "loading") return <div className="title-hub page-shell"><p>{copy.loading}</p></div>;
  if (!album) return (
    <div className="title-hub page-shell page-shell--narrow">
      <section className="surface-card title-hub__state">
        <h1>{status === "error" ? copy.actionFailed : copy.notFound}</h1>
        {status === "error" ? <button className="btn" onClick={() => window.location.reload()}>{locale === "ko" ? "다시 시도" : "Try again"}</button> : null}
        <a className="btn" href={`${base}titles/`} data-astro-reload>{copy.back}</a>
      </section>
    </div>
  );

  const memoryHref = buildMemoryCardHref({
    base,
    native: Capacitor.isNativePlatform(),
    row: { catalogAnimeId: album.titleRef.kind === "ANIME" ? album.titleRef.animeId : "", privateTitleId: album.titleRef.privateTitleId, title: album.displayTitle },
  });

  return (
    <div className="title-hub page-shell">
      <a className="title-hub__back" href={`${base}titles/`} data-astro-reload>{copy.back}</a>
      <TitleIdentity album={album} copy={copy} memoryHref={memoryHref} busy={status === "saving"} onToggleSaved={toggleSaved} />
      {message ? <p className="title-hub__message" role="status">{message}</p> : null}
      <div className="title-hub__content">
        <TitleMemoryGallery album={album} base={base} copy={copy} locale={locale} />
        <TitleFacts album={album} copy={copy} base={base} service={service} locale={locale} onTracking={(tracking) => setAlbum((current) => ({ ...current, tracking }))} />
      </div>
    </div>
  );
}
