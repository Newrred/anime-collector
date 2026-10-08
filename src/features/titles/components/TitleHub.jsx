import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { buildMemoryCardHref } from "../../../domain/search/memoryCardNavigation.js";
import PrivateMemoryCardPreview from "../../memory/components/PrivateMemoryCardPreview.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "../../memory/components/MemoryRouteShell.jsx";
import { createTitleHubService } from "../application/titleHubService.js";
import { parseTitleHubRequest } from "../domain/titleNavigation.js";
import { titleReturnHref } from "../../../domain/search/memoryReturnNavigation.js";
import "./title-hub.css";
import TitleCharacters from "./TitleCharacters.jsx";
import TitleFavoriteCharacters from "./TitleFavoriteCharacters.jsx";
import TitleRelatedSeries from "./TitleRelatedSeries.jsx";
import TitleWatchRecords, { watchStatusLabel } from "./TitleWatchRecords.jsx";

const dateLabel = (value, locale) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", { dateStyle: "medium" }).format(parsed)
    : "";
};

const displayValue = (value) => String(value || "").trim() || "—";

function TitleIdentity({ album, copy, memoryHref, recordHref, locale, busy, editing, onToggleSaved }) {
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
          <span className="status-badge">{album.isPrivateTitle ? copy.privateBadge : !detail ? locale === "ko" ? "작품 정보 미연결" : "Title information pending" : copy.catalogBadge}</span>
          <span className="status-badge">{album.tracking.isSaved ? copy.saved : copy.notSaved}</span>
        </div>
        <h1 className="pageTitle">{album.displayTitle}</h1>
        {facts.length ? <p className="title-hub__facts">{facts.join(" · ")}</p> : null}
        {album.isPrivateTitle ? <p className="title-hub__private-notice">{copy.privateNotice}</p> : null}
        <div className="title-hub__actions">
          {!album.isPrivateTitle && <a className="btn btn--subtle" href={recordHref} data-astro-reload>{locale === "ko" ? "감상 기록 남기기" : "Add watch record"}</a>}
          {canAddMemory ? (
            <a className="btn" href={memoryHref} data-astro-reload>
              {album.memoryCount ? copy.addMemory : copy.firstMemory}
            </a>
          ) : null}
          {album.anilistId || album.titleRef?.kind === "ANIME" ? (
            <button className="btn btn--subtle" type="button" disabled={busy || editing} onClick={onToggleSaved}>
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
            <PrivateMemoryCardPreview bundle={memory} locale={locale}
              key={memory.card.id}
              className="surface-card title-hub__memory"
              href={`${base}memory/card/?id=${encodeURIComponent(memory.card.id)}`}
              title={memory.title.displayTitle}
              cue={memory.card.note || ""}
              dateLabel={dateLabel(memory.card.updatedAt, locale)}
              badge={memory.sourceKind === "MISSING" ? "" : copy.memorySource[memory.sourceKind] || ""}
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

function TitleFacts({ album, copy, recordHref, locale, base, service }) {
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
      {!album.isPrivateTitle && <section className="surface-card title-hub__characters">
        <h2>{locale === "ko" ? "등장 캐릭터" : "Characters"}</h2>
        <TitleCharacters animeId={album.titleRef.kind === "ANIME" ? album.titleRef.animeId : null} anilistId={album.anilistId} locale={locale} />
      </section>}
      {!album.isPrivateTitle && <TitleFavoriteCharacters animeId={album.titleRef.kind === "ANIME" ? album.titleRef.animeId : null} anilistId={album.anilistId} locale={locale} />}
      {!album.isPrivateTitle && <TitleRelatedSeries album={album} service={service} base={base} locale={locale} />}
      <section className="surface-card title-hub__tracking">
        <h2>{copy.watchLogs(album.watchLogs.length)}</h2>
        <dl>
          <div><dt>{copy.watchingStatus}</dt><dd>{watchStatusLabel(album.tracking.watchStatus, locale === "ko")}</dd></div>
          <div><dt>{copy.rating}</dt><dd>{album.tracking.rating == null ? "—" : album.tracking.rating}</dd></div>
          <div><dt>{locale === "ko" ? "재시청" : "Rewatches"}</dt><dd>{album.tracking.rewatchCount || 0}</dd></div>
        </dl>
        {!album.isPrivateTitle && <a href={recordHref} data-astro-reload>{locale === "ko" ? "감상 기록 보기 →" : "View watch records →"}</a>}
        {!album.watchLogs.length ? <p>{copy.noWatchLogs}</p> : null}
      </section>
    </aside>
  );
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
  const [watchEditing, setWatchEditing] = useState(false);
  const [newerRecordNotice, setNewerRecordNotice] = useState(false);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const watchTab = params.get("tab") === "watch";

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

  useEffect(() => {
    if (!request) return undefined;
    let active = true;
    const refresh = () => {
      if (watchEditing) { setNewerRecordNotice(true); return; }
      service.load(request).then(next => {
        if (!active || !next) return;
        setAlbum(next);
        setNewerRecordNotice(false);
      }).catch(() => {});
    };
    window.addEventListener("moemoa:library-updated", refresh);
    return () => { active = false; window.removeEventListener("moemoa:library-updated", refresh); };
  }, [request, service, watchEditing]);

  const toggleSaved = async () => {
    if (!album || status !== "ready") return;
    if (album.tracking.isSaved && !window.confirm(locale === "ko"
      ? "작품을 저장 해제하면 현재 시청 상태·평점·작품 메모·재시청 요약이 제거돼요. 감상 기록과 기억 이미지는 남습니다. 계속할까요?"
      : "Removing this saved title clears its current status, rating, title memo and rewatch summary. Watch records and memories remain. Continue?")) return;
    setStatus("saving");
    setMessage("");
    try {
      const isSaved = await service.setSaved(album, !album.tracking.isSaved);
      const refreshed = await service.load(request).catch(() => null);
      setAlbum(refreshed || { ...album, libraryItem: isSaved ? album.libraryItem : null,
        tracking: { ...album.tracking, isSaved }, presence: isSaved
          ? (album.memoryCount ? "SAVED_WITH_MEMORY" : "SAVED_NO_MEMORY")
          : (album.memoryCount ? "NOT_SAVED_WITH_MEMORY" : "NOT_SAVED_NO_MEMORY") });
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
  const tabHref = (tab, writing = false) => {
    const next = new URLSearchParams(window.location.search);
    next.set("tab", tab); next.delete("record"); if (writing) next.set("record", "new");
    return `${window.location.pathname}?${next}`;
  };
  const recordHref = tabHref("watch", true);
  const backHref = titleReturnHref(window.location.search, base);

  return (
    <div className="title-hub page-shell">
      <a className="title-hub__back" href={backHref} data-astro-reload>{copy.back}</a>
      <TitleIdentity album={album} copy={copy} memoryHref={memoryHref} recordHref={recordHref} locale={locale} busy={status === "saving"} editing={watchEditing} onToggleSaved={toggleSaved} />
      {message ? <p className="title-hub__message" role="status">{message}</p> : null}
      {newerRecordNotice && watchEditing ? <p className="title-hub__message" role="status">{locale === "ko"
        ? "다른 곳에서 작품 기록이 바뀌었을 수 있어요. 저장 전에 최신 내용을 확인해 주세요."
        : "This title may have changed elsewhere. Review the latest details before saving."}</p> : null}
      <div className="title-hub__content">
        <div className="title-hub__body">
          <nav className="title-hub__tabs" aria-label={locale === "ko" ? "작품 기록 보기" : "Title records"}>
            <a href={tabHref("memories")} aria-current={!watchTab ? "page" : undefined} data-astro-reload>{locale === "ko" ? "기억 이미지" : "Memory images"} <small>{album.memoryCount}</small></a>
            {!album.isPrivateTitle && <a href={tabHref("watch")} aria-current={watchTab ? "page" : undefined} data-astro-reload>{locale === "ko" ? "감상 기록" : "Watch records"} <small>{album.watchLogs.length}</small></a>}
          </nav>
          {watchTab && !album.isPrivateTitle ? <TitleWatchRecords album={album} service={service} locale={locale}
            startWriting={params.get("record") === "new"} busy={status === "saving"} onSaveTitle={toggleSaved}
            onEditingChange={setWatchEditing}
            onSaved={({ log, tracking }) => setAlbum((current) => ({ ...current, tracking,
              watchLogs: [log, ...current.watchLogs.filter((row) => row.id !== log.id)] }))}
            onLogChanged={(updated, deletedId = null) => setAlbum(current => ({ ...current,
              watchLogs: deletedId ? current.watchLogs.filter(row => row.id !== deletedId)
                : current.watchLogs.map(row => row.id === updated.id ? updated : row) }))}
            onTitleDetailsSaved={() => service.load(request).then(next => next && setAlbum(next)).catch(() => {})} />
            : <TitleMemoryGallery album={album} base={base} copy={copy} locale={locale} />}
        </div>
        <TitleFacts album={album} copy={copy} recordHref={tabHref("watch")} locale={locale} base={base} service={service} />
      </div>
    </div>
  );
}
