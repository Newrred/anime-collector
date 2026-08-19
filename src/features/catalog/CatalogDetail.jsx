import { useEffect, useMemo, useState } from "react";

import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";
import { createSupabaseCatalogRepository } from "./catalogRepository.js";
import "./catalog-detail.css";

const label = (value) => String(value || "정보 없음").replaceAll("_", " ");

export default function CatalogDetail() {
  const animeId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("id") || "";
  }, []);
  const [detail, setDetail] = useState(null);
  const [people, setPeople] = useState([]);
  const [nextPage, setNextPage] = useState(1);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!isSupabaseConfigured || !animeId) { setStatus("unavailable"); return undefined; }
    let active = true;
    const repository = createSupabaseCatalogRepository({ client: supabase });
    repository.getDetail(animeId).then(async (row) => {
      if (!active) return;
      if (!row) { setStatus("missing"); return; }
      setDetail(row);
      if (row.people.pageCount > 0) {
        const first = await repository.getPeople(animeId, 1);
        if (active && first) { setPeople(first.entries); setNextPage(2); }
      }
      if (active) setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [animeId]);

  async function loadMore() {
    if (!detail || nextPage > detail.people.pageCount) return;
    setStatus("loading-more");
    try {
      const repository = createSupabaseCatalogRepository({ client: supabase });
      const page = await repository.getPeople(animeId, nextPage);
      if (page) setPeople((current) => [...current, ...page.entries]);
      setNextPage((current) => current + 1);
      setStatus("ready");
    } catch { setStatus("error"); }
  }

  if (status === "loading") return <div className="catalog-detail page-shell"><p>작품 정보를 불러오는 중…</p></div>;
  if (!detail) return (
    <div className="catalog-detail page-shell page-shell--narrow">
      <a href="/memory/new/">← 카드 작성으로 돌아가기</a>
      <h1>작품 정보를 표시할 수 없어요</h1>
      <p>{status === "unavailable" ? "Preview 카탈로그 연결이 필요합니다." : "잠시 후 다시 시도해 주세요."}</p>
    </div>
  );

  const genres = detail.genres.core.length ? detail.genres.core : detail.genres.source;
  const cardHref = `/memory/new/?${new URLSearchParams({ title: detail.preferredTitle.value })}`;
  return (
    <div className="catalog-detail page-shell">
      <header className="catalog-detail__hero surface-card">
        <img
          className="catalog-detail__cover"
          src={detail.cover.publicUrl}
          width={detail.cover.width}
          height={detail.cover.height}
          alt={`${detail.preferredTitle.value} 표지`}
        />
        <div>
          <p className="catalog-detail__eyebrow">MOEMOA Catalog</p>
          <h1>{detail.preferredTitle.value}</h1>
          <p>{detail.titles.filter((row) => row.value !== detail.preferredTitle.value).slice(0, 3).map((row) => row.value).join(" · ")}</p>
        </div>
        <a className="btn" href={cardHref}>이 작품으로 카드 만들기</a>
      </header>

      <section className="catalog-detail__facts surface-card" aria-label="작품 기본 정보">
        <dl>
          <div><dt>형식</dt><dd>{label(detail.release.format)}</dd></div>
          <div><dt>상태</dt><dd>{label(detail.release.status)}</dd></div>
          <div><dt>화수</dt><dd>{detail.release.episodeCount ?? "정보 없음"}</dd></div>
          <div><dt>방영 시작</dt><dd>{detail.release.startDate || "정보 없음"}</dd></div>
          <div><dt>원작</dt><dd>{label(detail.release.sourceMaterialType)}</dd></div>
          <div><dt>제작사</dt><dd>{detail.studios.map((row) => row.name).join(", ") || "정보 없음"}</dd></div>
        </dl>
        {genres.length > 0 && <div className="catalog-detail__chips">{genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}
      </section>

      <section className="catalog-detail__people surface-card">
        <div className="catalog-detail__section-head">
          <div><h2>캐릭터와 성우</h2><p>{detail.people.characterCount}명 · 성우 연결 {detail.people.castingCount}개</p></div>
        </div>
        <ul>
          {people.map((row) => (
            <li key={row.characterId}>
              <div><strong>{row.name}</strong><small>{label(row.role)}</small></div>
              <span>{row.castings.map((casting) => casting.creditedName).join(", ") || "성우 정보 없음"}</span>
            </li>
          ))}
        </ul>
        {nextPage <= detail.people.pageCount && (
          <button className="btn btn--subtle" type="button" onClick={loadMore} disabled={status === "loading-more"}>
            {status === "loading-more" ? "불러오는 중…" : "캐릭터 더 보기"}
          </button>
        )}
      </section>

      {detail.officialLinks.length > 0 && (
        <section className="catalog-detail__links surface-card"><h2>공식 사이트</h2>
          {detail.officialLinks.map((row) => <a key={row.url} href={row.url} target="_blank" rel="noreferrer">공식 링크 열기</a>)}
        </section>
      )}
    </div>
  );
}
