import { useEffect, useMemo, useRef, useState } from "react";
import { searchAnimeByTitle, fetchAnimeByIdsCached } from "../lib/anilist";
import {
  wikidataSearchKoToAniListExpanded,
  wikidataGetKoTitlesByAniListIds,
} from "../lib/wikidata";
import aliasSeed from "../data/aliases.json";
import {
  isFreshSearchCacheEntry,
  loadSearchCacheMap,
  persistSearchCacheMap,
  setSearchCacheEntry,
} from "../repositories/searchCacheRepo";
import { formatStatusLabel } from "./library/libraryCopy.js";
import { deriveKoTitleFromMedia, pickDisplayTitle } from "../domain/animeTitles";
import { getMessageGroup } from "../domain/messages.js";
import { IconPlus } from "./ui/AppIcons.jsx";

function isHangulQuery(q) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
}

function inferKoTitleFromMedia(media) {
  return deriveKoTitleFromMedia(media);
}

function normalizeSearchText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function buildAliasEntries(seed) {
  if (!Array.isArray(seed)) return [];
  const out = [];
  for (const row of seed) {
    const id = Number(row?.anilistId);
    if (!Number.isFinite(id)) continue;

    const names = [row?.ko, ...(Array.isArray(row?.aliases) ? row.aliases : [])]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (names.length === 0) continue;

    out.push({ id, ko: row?.ko || null, names });
  }
  return out;
}

function findAliasMatches(query, aliasEntries, limit = 20) {
  const qn = normalizeSearchText(query);
  if (!qn) return [];

  const hits = [];
  for (const row of aliasEntries) {
    let best = 0;
    for (const name of row.names) {
      const nn = normalizeSearchText(name);
      if (!nn) continue;
      if (nn === qn) best = Math.max(best, 400);
      else if (nn.startsWith(qn)) best = Math.max(best, 280);
      else if (nn.includes(qn)) best = Math.max(best, 200);
      else if (qn.startsWith(nn)) best = Math.max(best, 120);
    }
    if (best > 0) hits.push({ id: row.id, ko: row.ko, score: best, src: "alias" });
  }

  hits.sort((a, b) => b.score - a.score || a.id - b.id);
  return hits.slice(0, Math.max(1, limit));
}

function formatRank(fmt) {
  const map = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5, MUSIC: 6 };
  return map[fmt] ?? 9;
}

const ALIAS_LIMIT = 14;
const WD_DEPTH1_LIMIT = 18;
const WD_DEPTH2_LIMIT = 24;
const MAX_CANDIDATE_FETCH = 28;
const FAST_CANDIDATE_FETCH = 12;
const SEARCH_DEBOUNCE_MS = 200;
const STATUS_UNCLASSIFIED = "\uBBF8\uBD84\uB958";
const INITIAL_STATUS_OPTIONS = [
  STATUS_UNCLASSIFIED,
  "\uBCF4\uB294\uC911",
  "\uBCF4\uB958",
  "\uC644\uB8CC",
  "\uD558\uCC28",
];

function normalizeInitialStatus(raw) {
  const value = String(raw || "").trim();
  return INITIAL_STATUS_OPTIONS.includes(value) ? value : STATUS_UNCLASSIFIED;
}

export default function AddAnime({ items, setItems, onAnimeAdded, locale = "ko" }) {
  const copy = getMessageGroup(locale, "addAnime");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [loadingDots, setLoadingDots] = useState("");
  const [addStatus, setAddStatus] = useState(STATUS_UNCLASSIFIED);
  const [results, setResults] = useState([]); // [{id, ko, media, src}]
  const boxRef = useRef(null);
  const aliasEntries = useMemo(() => buildAliasEntries(aliasSeed), []);

  const hasId = useMemo(() => {
    const s = new Set(items.map((x) => x.anilistId));
    return (id) => s.has(id);
  }, [items]);

  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const cacheRef = useRef(new Map()); // key -> { ts, results }

  useEffect(() => {
    let alive = true;
    loadSearchCacheMap()
      .then((map) => {
        if (!alive || !(map instanceof Map)) return;
        cacheRef.current = map;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const query = dq;
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      setLoadingStage("");
      return;
    }

    const key = `${isHangulQuery(query) ? "ko" : "any"}:${normalizeSearchText(query)}`;
    const cached = cacheRef.current.get(key);
      if (cached) {
      const isFresh = isFreshSearchCacheEntry(cached, Date.now());
      if (isFresh) {
        const cachedResults = Array.isArray(cached.results) ? cached.results : [];
        if (cachedResults.length > 0) {
          setResults(cachedResults);
          setLoading(false);
          setLoadingStage("recent");
          return;
        }
      }
      cacheRef.current.delete(key);
      persistSearchCacheMap(cacheRef.current).catch(() => {});
    }

    let alive = true;
    let fallbackRows = [];
    setLoading(true);
    setLoadingStage("searching");

    (async () => {
      const setStage = (v) => {
        if (alive) setLoadingStage(v);
      };
      const rememberRows = (rows) => {
        if (Array.isArray(rows) && rows.length > 0) fallbackRows = rows;
      };

      function buildMergedResults(ids, candidateMap, mediaMap) {
        const merged = ids
          .map((id) => {
            const c = candidateMap.get(id) || {};
            return {
              id,
              ko: c.ko || null,
              media: mediaMap.get(id),
              src: c.src || "wd",
              sourceRank: c.sourceRank ?? 9,
              score: c.score ?? 0,
            };
          })
          .filter((x) => x.media);

        merged.sort((a, b) => {
          if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
          if (a.score !== b.score) return b.score - a.score;
          const ar = formatRank(a.media?.format);
          const br = formatRank(b.media?.format);
          const ay = a.media?.seasonYear ?? a.media?.startDate?.year ?? 9999;
          const by = b.media?.seasonYear ?? b.media?.startDate?.year ?? 9999;
          return ar - br || ay - by;
        });

        return merged;
      }

      // 1) 한글 검색: Wikidata 확장으로 ID 후보를 더 잘 뽑고 → AniList로 카드 데이터
      if (isHangulQuery(query)) {
        setStage("alias");
        const aliasHits = findAliasMatches(query, aliasEntries, ALIAS_LIMIT);
        const aliasIds = aliasHits
          .map((x) => Number(x?.id))
          .filter(Number.isFinite);
        const aliasMetaById = new Map(
          aliasHits.map((x) => [Number(x.id), { ko: x.ko || null, score: x.score ?? 0 }])
        );
        let hasQuickRendered = false;
        function renderQuick(rows, stage) {
          if (!alive || hasQuickRendered || rows.length === 0) return;
          hasQuickRendered = true;
          const quickRows = rows.slice(0, 10);
          rememberRows(quickRows);
          setResults(quickRows);
          setStage(stage);
          setLoading(false);
        }

        const directAniPromise = searchAnimeByTitle(query, 8).catch(() => []);
        directAniPromise.then((mediaList) => {
          if (!alive || hasQuickRendered || !Array.isArray(mediaList) || mediaList.length === 0) return;
          renderQuick(
            mediaList.map((m) => ({
              id: m.id,
              ko: null,
              media: m,
              src: "anilist",
              sourceRank: 2,
              score: 0,
            })),
            "searching"
          );
        }).catch(() => {});

        // alias 메타는 즉시 병렬 조회해서 전체 대기시간 단축
        const aliasMediaPromise = aliasIds.length
          ? fetchAnimeByIdsCached(aliasIds, { includeCharacters: false }).catch(() => new Map())
          : Promise.resolve(new Map());

        if (aliasIds.length) {
          aliasMediaPromise.then((aliasMediaMap) => {
            if (!alive) return;
            const quickAliasRows = aliasIds
              .map((id) => {
                const meta = aliasMetaById.get(id) || {};
                return {
                  id,
                  ko: meta.ko || null,
                  media: aliasMediaMap.get(id),
                  src: "alias",
                  sourceRank: 0,
                  score: meta.score ?? 0,
                };
              })
              .filter((x) => x.media)
              .slice(0, 10);

            renderQuick(quickAliasRows, "searching");
          }).catch(() => {});
        }

        const qn = normalizeSearchText(query);
        const quickMode = qn.length < 3;
        let wd = [];

        if (!quickMode) {
          const wdDepth = qn.length >= 4 ? 2 : 0;
          const wdLimit = wdDepth === 2 ? WD_DEPTH2_LIMIT : WD_DEPTH1_LIMIT;
          setStage("koTitle");
          wd = await wikidataSearchKoToAniListExpanded(query, wdLimit, wdDepth).catch(() => []);
        }

        const candidateMap = new Map(); // id -> {ko, src, sourceRank, score}
        function upsertCandidate(id, patch) {
          const prev = candidateMap.get(id);
          if (!prev) {
            candidateMap.set(id, patch);
            return;
          }

          const next = { ...prev };
          if ((patch.sourceRank ?? 99) < (prev.sourceRank ?? 99)) {
            next.sourceRank = patch.sourceRank;
            next.src = patch.src;
          }
          if ((patch.score ?? 0) > (prev.score ?? 0)) next.score = patch.score;
          if (!next.ko && patch.ko) next.ko = patch.ko;
          candidateMap.set(id, next);
        }

        for (const x of aliasHits) {
          const id = Number(x?.id);
          if (!Number.isFinite(id)) continue;
          upsertCandidate(id, { ko: x.ko || null, src: "alias", sourceRank: 0, score: x.score ?? 0 });
        }

        for (const x of wd) {
          const id = Number(x?.anilistId);
          if (!Number.isFinite(id)) continue;
          const ko = x?.koTitle && /[가-힣]/.test(x.koTitle) ? x.koTitle : null;
          upsertCandidate(id, { ko, src: "wd", sourceRank: 1, score: 0 });
        }

        const directAniList = await directAniPromise;
        for (const m of directAniList) {
          const id = Number(m?.id);
          if (!Number.isFinite(id)) continue;
          upsertCandidate(id, { ko: null, src: "anilist", sourceRank: 2, score: 0 });
        }

        const ids = [...candidateMap.entries()]
          .sort((a, b) => {
            const pa = a[1] || {};
            const pb = b[1] || {};
            const sa = pa.sourceRank ?? 99;
            const sb = pb.sourceRank ?? 99;
            if (sa !== sb) return sa - sb;
            const sca = pa.score ?? 0;
            const scb = pb.score ?? 0;
            if (sca !== scb) return scb - sca;
            return a[0] - b[0];
          })
          .slice(0, MAX_CANDIDATE_FETCH)
          .map(([id]) => id);
        setStage("preparing");

        const aliasMediaMap = await aliasMediaPromise;
        const mediaMap = new Map(aliasMediaMap);
        for (const m of directAniList) {
          const id = Number(m?.id);
          if (!Number.isFinite(id) || mediaMap.has(id)) continue;
          mediaMap.set(id, m);
        }

        const fastIds = ids.slice(0, FAST_CANDIDATE_FETCH);
        const tailIds = ids.slice(FAST_CANDIDATE_FETCH);

        const fastNeed = fastIds.filter((id) => !mediaMap.has(id));
        if (fastNeed.length) {
          const fastMap = await fetchAnimeByIdsCached(fastNeed, { includeCharacters: false });
          for (const [id, media] of fastMap.entries()) mediaMap.set(id, media);
        }

        if (!alive) return;
        const fastMerged = buildMergedResults(fastIds, candidateMap, mediaMap).slice(0, 10);
        if (fastMerged.length > 0) {
          rememberRows(fastMerged);
          setResults(fastMerged);
          setStage(tailIds.length ? "preparing" : "organizing");
          setLoading(false);
        }

        const tailNeed = tailIds.filter((id) => !mediaMap.has(id));
        if (tailNeed.length) {
          const tailMap = await fetchAnimeByIdsCached(tailNeed, { includeCharacters: false });
          for (const [id, media] of tailMap.entries()) mediaMap.set(id, media);
        }

        setStage("organizing");
        const merged = buildMergedResults(ids, candidateMap, mediaMap);

        if (!alive) return;
        const finalList = merged.slice(0, 10);
        if (finalList.length > 0) {
          rememberRows(finalList);
          setSearchCacheEntry(cacheRef.current, key, finalList);
          persistSearchCacheMap(cacheRef.current)
            .then((nextMap) => {
              if (nextMap instanceof Map) cacheRef.current = nextMap;
            })
            .catch(() => {});
          setResults(finalList);
        } else if (!fallbackRows.length) {
          // 아무 결과도 없을 때만 비움 처리
          cacheRef.current.delete(key);
          setResults([]);
        }
        setLoading(false);
        setLoadingStage("");
        return;
      }

      // 2) 한글이 아닌 검색(영어/일본어 등): AniList로 검색 → Wikidata로 한글 타이틀 보강
      setStage("searching");
      const mediaList = await searchAnimeByTitle(query, 8);
      const ids = mediaList.map((m) => m.id);
      if (alive) {
        setResults(
          mediaList.map((m) => ({
            id: m.id,
            ko: null,
            media: m,
            src: "anilist",
          }))
        );
        setLoading(false);
      }

      let koMap = new Map();
      try {
        setStage("koTitle");
        koMap = await wikidataGetKoTitlesByAniListIds(ids); // P8729 기반 보강 :contentReference[oaicite:1]{index=1}
      } catch (e) {
        // WDQS 실패해도 검색 자체는 계속
      }

      setStage("organizing");
      const merged = mediaList.map((m) => ({
        id: m.id,
        ko: koMap.get(m.id) || null,
        media: m,
        src: "anilist+wd",
      }));

      if (!alive) return;
      setSearchCacheEntry(cacheRef.current, key, merged);
      persistSearchCacheMap(cacheRef.current)
        .then((nextMap) => {
          if (nextMap instanceof Map) cacheRef.current = nextMap;
        })
        .catch(() => {});
      setResults(merged);
      setLoading(false);
      setLoadingStage("");
    })().catch((e) => {
      console.error(e);
      if (!alive) return;
      if (fallbackRows.length > 0) {
        setResults(fallbackRows);
        setLoading(false);
        setLoadingStage("");
        return;
      }
      setResults([]);
      setLoading(false);
      setLoadingStage("error");
    });

    return () => {
      alive = false;
    };
  }, [dq, aliasEntries]);

  useEffect(() => {
    if (!loading) {
      setLoadingDots("");
      return undefined;
    }

    const seq = ["", ".", "..", "..."];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % seq.length;
      setLoadingDots(seq[idx]);
    }, 300);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    function onDocDown(e) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function addAnime(r, statusOverride = addStatus) {
    const id = r.id;
    const koTitle = r.ko || inferKoTitleFromMedia(r?.media) || null;
    const initialStatus = normalizeInitialStatus(statusOverride);
    if (hasId(id)) {
      setQ("");
      setOpen(false);
      return;
    }

    let addedItem = null;
    setItems((prev) => {
      if (prev.some((x) => x.anilistId === id)) return prev;
      addedItem = {
        anilistId: id,
        koTitle,
        status: initialStatus,
        score: null,
        memo: "",
        rewatchCount: 0,
        lastRewatchAt: null,
        addedAt: Date.now(),
      };
      return [...prev, addedItem];
    });

    if (addedItem && typeof onAnimeAdded === "function") {
      onAnimeAdded(addedItem, r?.media || null, { initialStatus });
    }

    setQ("");
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) addAnime(results[0], addStatus); // ✅ 객체로
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={boxRef} className="suggestWrap library-add-search">
      <div className="library-add-search__controls">
        <input
          className="input"
          value={q}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchAria}
          aria-autocomplete="list"
          aria-controls="anime-suggest-list"
          aria-expanded={open && dq.length >= 2}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <div className="library-add-status-row">
          <label className="small library-add-status-label" htmlFor="add-status-select">
            {copy.addStatus}
          </label>
          <select
            id="add-status-select"
            className="select library-add-status-select"
            value={addStatus}
            onChange={(e) => setAddStatus(normalizeInitialStatus(e.target.value))}
            aria-label={copy.addStatus}
          >
            {INITIAL_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {formatStatusLabel(value, locale)}
              </option>
            ))}
          </select>
          <div className="small library-add-status-hint">
            {copy.addStatusHint}
          </div>
        </div>
      </div>

      {open && dq.length >= 2 && (
        <div className="suggestList" id="anime-suggest-list" role="listbox" aria-label={copy.results}>
          {(loading || loadingStage === "recent") && (
            <div className="small library-add-results-state library-add-results-state--framed">
              {loading
                ? `${copy.stage.searching}${loadingDots} · ${copy.stage[loadingStage] || copy.preparingFallback}`
                : copy.stage.recent}
            </div>
          )}
          {results.length === 0 && !loading && (
            <div className="small library-add-results-state">
              {copy.noResult}
            </div>
          )}

          {results.map((r) => {
            const already = hasId(r.id);
            const title = pickDisplayTitle(
              { anilistId: r.id, koTitle: r.ko || null },
              r.media,
              locale
            );
            const sub =
              locale === "en"
                ? r.media?.title?.romaji || r.media?.title?.native || r.ko || ""
                : r.media?.title?.english || r.media?.title?.romaji || "";

            return (
              <div
                key={r.id}
                onClick={() => !already && addAnime(r)}      // ✅ 객체로
                onKeyDown={(e) => {
                  if (already) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addAnime(r);
                  }
                }}
                className={`suggestItem${already ? " suggestItem--disabled" : ""}`}
                title={already ? copy.alreadyInLibrary : copy.clickToAdd}
                role="option"
                aria-selected={already}
                aria-disabled={already}
                tabIndex={already ? -1 : 0}
              >
                <img
                  className="suggestThumb"
                  src={r.media?.coverImage?.extraLarge || r.media?.coverImage?.large || r.media?.coverImage?.medium || ""}
                  alt={title}
                  loading="lazy"
                />
                <div className="suggestItem__body">
                  <div className="suggestItem__titleRow">
                    <div className="suggestItem__title">
                      {title}
                    </div>
                    {already && <span className="badge">{copy.added}</span>}
                  </div>
                  <div className="small suggestItem__meta">
                    {sub}
                    {r.media?.seasonYear ? ` · ${r.media.seasonYear}` : ""}
                    {r.media?.format ? ` · ${r.media.format}` : ""}
                  </div>
                </div>

                <button
                  className="btn btn--icon"
                  disabled={already}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!already) addAnime(r);              // ✅ 객체로
                  }}
                  aria-label={copy.add}
                  title={`${title} ${copy.add}`}
                >
                  <IconPlus size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

