import { useEffect, useMemo, useState } from "react";
import { buildTitleHubHref } from "../../titles/domain/titleNavigation.js";
// Approved catalog references only. No private memory bundles are loaded here.
export default function PublicTitleShelf({ snapshot, services, locale, base = "/", onReady, preview = false }) {
  const [covers, setCovers] = useState({}), [loaded, setLoaded] = useState({}), [limit, setLimit] = useState(24), [failed, setFailed] = useState(false);
  const titleKey = JSON.stringify(snapshot.titles);
  const titles = useMemo(() => JSON.parse(titleKey), [titleKey]);
  const complete = !failed && snapshot.titles.length > 0 && snapshot.titles.slice(0,limit).every(t => covers[t.animeId] && loaded[t.animeId] === covers[t.animeId]);
  useEffect(() => { onReady?.(complete); }, [complete,onReady]);
  useEffect(() => { setLimit(24); }, [titles]);
  useEffect(() => {
    const abort = new AbortController(); setCovers({}); setLoaded({}); setFailed(false);
    Promise.allSettled(titles.slice(0, limit).map(async title => [title.animeId, await services.resolveCover(title, abort.signal)]))
      .then(rows => {
        if (abort.signal.aborted) return;
        const next = {}; let unavailable = false;
        for (const row of rows) {
          if (row.status === "fulfilled") next[row.value[0]] = row.value[1];
          else unavailable = true;
        }
        setCovers(next); setFailed(unavailable);
      })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [titles, services, limit]);
  return <section className="public-title-shelf"><h3>{snapshot.title}</h3><p>{locale === "ko" ? `작품 ${snapshot.titles.length}개 · 작품명과 승인 표지만 공개` : `${snapshot.titles.length} titles · catalog titles and approved covers`}</p>
    {failed && <p role="status">{locale === "ko" ? "일부 표지를 표시할 수 없습니다." : "Some covers are unavailable."}</p>}
    <div className="public-title-shelf__grid">{snapshot.titles.slice(0,limit).map(t => <a key={t.animeId} aria-label={`${t.title} · ${locale === "ko" ? "작품 정보·내 기록 보기" : "title information and your own records"}`} href={buildTitleHubHref({ base, titleRef: { kind: "ANIME", animeId: t.animeId }, title: t.title })}>
      {covers[t.animeId] ? <img loading={preview ? "eager" : "lazy"} src={covers[t.animeId]} alt={t.title} width="200" height="300" onLoad={() => setLoaded(current => ({ ...current, [t.animeId]: covers[t.animeId] }))} onError={() => setFailed(true)} /> : <span className="public-title-shelf__missing">{t.title}</span>}<strong>{t.title}</strong>
    </a>)}</div>
    {limit < snapshot.titles.length && <button type="button" className="btn btn--subtle" onClick={() => setLimit(n => n + 24)}>{locale === "ko" ? "작품 더 보기" : "More titles"}</button>}
  </section>;
}
