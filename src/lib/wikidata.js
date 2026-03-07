// src/lib/wikidata.js
const WD_API = "https://www.wikidata.org/w/api.php";
const WDQS_ENDPOINT = "https://query.wikidata.org/sparql";
const WD_TIMEOUT_MS = 3500;
const WD_RETRIES = 2;
const WD_RETRY_DELAYS_MS = [250, 700, 1400];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
  return WD_RETRY_DELAYS_MS[Math.min(attempt, WD_RETRY_DELAYS_MS.length - 1)];
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function isRetryableError(err) {
  const message = String(err?.message || "").toLowerCase();
  return (
    err?.name === "AbortError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("timed out")
  );
}

async function fetchJsonWithRetry(url, init, { timeoutMs, retries, errorPrefix }) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);

      let res;
      try {
        res = await fetch(url, { ...init, signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (attempt < retries && isRetryableStatus(res.status)) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new Error(`${errorPrefix} ${res.status}: ${text}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryableError(err)) {
        await sleep(retryDelay(attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`${errorPrefix} request failed`);
}

/**
 * Wikidata Query Service(SPARQL) 호출 헬퍼
 */
async function wdqs(query, timeoutMs = WD_TIMEOUT_MS) {
  const url = `${WDQS_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  return fetchJsonWithRetry(
    url,
    { headers: { Accept: "application/sparql-results+json" } },
    { timeoutMs, retries: WD_RETRIES, errorPrefix: "WDQS" }
  );
}

/**
 * Wikidata Action API 호출 헬퍼
 * - 브라우저 CORS 때문에 origin=* 필수(익명 요청)
 */
async function wdApi(params, timeoutMs = WD_TIMEOUT_MS) {
  const qs = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });

  const url = `${WD_API}?${qs.toString()}`;
  return fetchJsonWithRetry(
    url,
    { method: "GET", headers: { Accept: "application/json" } },
    { timeoutMs, retries: WD_RETRIES, errorPrefix: "Wikidata" }
  );
}

// ✅ 메모리 캐시(같은 id는 재조회 안 함)
const koCache = new Map(); // anilistId(number) -> koTitle(string)

/**
 * Namuwiki ID(P8885)에서 제목처럼 쓸만한 표제어 추출
 * 예: "그 비스크 돌은 사랑을 한다/애니메이션" -> "그 비스크 돌은 사랑을 한다"
 */
function namuIdToTitle(namuId) {
  if (!namuId) return null;
  const base = String(namuId).split("/")[0];
  const t = base.replace(/_/g, " ").trim();
  return t || null;
}

function extractFirstExternalId(entity, prop) {
  const claims = entity?.claims?.[prop];
  if (!Array.isArray(claims)) return null;
  for (const c of claims) {
    const raw = c?.mainsnak?.datavalue?.value;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

export async function wikidataGetKoTitlesByAniListIds(ids = []) {
  const uniq = Array.from(new Set(ids.map(Number))).filter(Number.isFinite);

  // 캐시로 이미 아는 것들 먼저
  const out = new Map();
  const need = [];
  for (const id of uniq) {
    const cached = koCache.get(id);
    if (cached) out.set(id, cached);
    else need.push(id);
  }
  if (need.length === 0) return out;

  // VALUES는 너무 길어지면 느려질 수 있어서 50개씩
  for (let i = 0; i < need.length; i += 50) {
    const part = need.slice(i, i + 50);

    // P8729는 external-id라 literal로 저장되는 편이라 문자열 VALUES가 안전
    const values = part.map((x) => `"${String(x)}"`).join(" ");

    // ko label/altLabel이 없을 때 Namuwiki ID(P8885) 표제어를 폴백으로 사용
    const sparql = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?anilistId
       (SAMPLE(?koLabel) AS ?k1)
       (SAMPLE(?koAlt) AS ?k2)
       (SAMPLE(?namuTitle) AS ?k3)
WHERE {
  VALUES ?anilistId { ${values} }
  ?item wdt:P8729 ?anilistId .
  OPTIONAL { ?item rdfs:label ?koLabel . FILTER (lang(?koLabel) = "ko") }
  OPTIONAL { ?item skos:altLabel ?koAlt . FILTER (lang(?koAlt) = "ko") }
  OPTIONAL {
    ?item wdt:P8885 ?namu .
    BIND(REPLACE(STR(?namu), "/.*$", "") AS ?namuTitle)
  }
}
GROUP BY ?anilistId
    `.trim();

    const json = await wdqs(sparql);
    const rows = json?.results?.bindings ?? [];

    for (const r of rows) {
      const idStr = r?.anilistId?.value;
      const id = Number(idStr);
      if (!Number.isFinite(id)) continue;

      const ko = (r?.k1?.value || r?.k2?.value || r?.k3?.value || "").trim();
      if (!ko) continue;

      koCache.set(id, ko);
      out.set(id, ko);
    }
  }

  return out;
}

/**
 * 1) 한글 키워드로 Wikidata 엔티티(QID) 후보를 찾는다.
 * - 1차: wbsearchentities (빠른 엔티티 검색/자동완성, prefix 성격)
 * - 2차(0건일 때만): action=query&list=search (일반 검색, 중간 토큰도 잡을 확률↑)
 */
export async function wikidataSearchEntitiesKo(search, limit = 10) {
  if (!search?.trim()) return [];
  const q = search.trim();

  // 1) 빠른 엔티티 검색
  try {
    const json = await wdApi({
      action: "wbsearchentities",
      search: q,
      language: "ko",
      uselang: "ko",
      type: "item",
      limit: String(Math.min(Math.max(limit, 1), 50)),
    });

    const a = (json?.search || []).map((x) => ({
      qid: x.id,
      label: x.label || "",
      description: x.description || "",
    }));

    if (a.length > 0) return a.slice(0, Math.min(Math.max(limit, 1), 50));
  } catch (e) {
    // 엔티티 검색 실패 시에도 폴백 시도
  }

  // 2) 폴백: 일반 검색으로 QID 페이지를 찾는다
  const qids = await (async () => {
    const json = await wdApi(
      {
        action: "query",
        list: "search",
        srsearch: q,
        srnamespace: "0",
        srlimit: String(Math.min(50, Math.max(limit * 3, 15))),
      },
      1200
    );

    const rows = json?.query?.search ?? [];
    const out = [];
    for (const r of rows) {
      const title = r?.title;
      if (typeof title === "string" && /^Q\d+$/.test(title)) out.push(title);
      if (out.length >= 50) break;
    }
    return out;
  })();

  if (qids.length === 0) return [];

  // QID -> labels/description으로 변환
  const entitiesJson = await wdApi({
    action: "wbgetentities",
    ids: qids.slice(0, 50).join("|"),
    props: "labels|descriptions|aliases|claims",
    languages: "ko|en|ja",
  });

  const entities = entitiesJson?.entities || {};
  const hits = qids
    .map((qid) => {
      const e = entities[qid];
      if (!e) return null;

      // 표시 label: ko 라벨/별칭 우선, 없으면 Namuwiki 표제어, 마지막으로 en 라벨
      const koLabel = e?.labels?.ko?.value || "";
      const koAlias =
        Array.isArray(e?.aliases?.ko) && e.aliases.ko.length ? e.aliases.ko[0]?.value || "" : "";
      const namuTitle = namuIdToTitle(extractFirstExternalId(e, "P8885"));
      const enLabel = e?.labels?.en?.value || "";

      const label = koLabel || koAlias || namuTitle || enLabel || qid;
      const description = e?.descriptions?.ko?.value || e?.descriptions?.en?.value || "";

      return { qid, label, description };
    })
    .filter(Boolean);

  return hits.slice(0, Math.min(Math.max(limit, 1), 50));
}

function pickBestLabel(entity) {
  const koLabel = entity?.labels?.ko?.value || "";
  const koAlias =
    Array.isArray(entity?.aliases?.ko) && entity.aliases.ko.length
      ? entity.aliases.ko[0]?.value || ""
      : "";

  // ✅ ko 라벨/별칭이 없을 때 Namuwiki ID(P8885) 표제어를 폴백
  const namuTitle = namuIdToTitle(extractFirstExternalId(entity, "P8885"));

  return koLabel || koAlias || namuTitle || null;
}

function extractQidsFromProp(entity, prop) {
  const claims = entity?.claims?.[prop];
  if (!Array.isArray(claims)) return [];

  const out = [];
  for (const c of claims) {
    const v = c?.mainsnak?.datavalue?.value;
    // item datatype: { "entity-type":"item", "id":"Qxxxx", ... }
    if (v && typeof v === "object" && typeof v.id === "string" && v.id.startsWith("Q")) {
      out.push(v.id);
    }
  }
  return out;
}

function extractAniListAnimeIds(entity) {
  const claims = entity?.claims?.P8729;
  if (!Array.isArray(claims)) return [];

  const out = [];
  for (const c of claims) {
    const raw = c?.mainsnak?.datavalue?.value;
    const n = Number.parseInt(String(raw ?? ""), 10);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

async function wdqsFindAniListBySeriesQid(seriesQid, limit = 30) {
  // P179: part of the series
  // P8729: AniList anime ID
  // ko 라벨이 없을 때 P8885(나무위키) 표제어로 폴백
  const sparql = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?anilistId ?koTitle WHERE {
  ?item wdt:P179 wd:${seriesQid} .
  ?item wdt:P8729 ?anilistId .
  OPTIONAL { ?item rdfs:label ?koLabel . FILTER (lang(?koLabel) = "ko") }
  OPTIONAL {
    ?item wdt:P8885 ?namu .
    BIND(REPLACE(STR(?namu), "/.*$", "") AS ?namuTitle)
  }
  BIND(COALESCE(?koLabel, ?namuTitle) AS ?koTitle)
}
LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `.trim();

  const json = await wdqs(sparql);
  const rows = json?.results?.bindings ?? [];

  return rows
    .map((r) => ({
      anilistId: Number(r?.anilistId?.value),
      koTitle: r?.koTitle?.value || null,
    }))
    .filter((x) => Number.isFinite(x.anilistId));
}

/**
 * ⭐ 핵심: 한글 검색어 → QID 후보들 → (P8729 없더라도) P527/P4969 타고 내려가서
 *         P8729(AniList anime ID) 가진 하위 항목까지 모아서 반환
 *
 * depth=2면 보통 이런 구조를 커버:
 *   프랜차이즈(QID) → derivative work(P4969) → 애니/시즌(P527) → 시즌 항목(P8729)
 */
export async function wikidataSearchKoToAniListExpanded(search, limit = 10, depth = 2) {
  const targetLimit = Math.min(Math.max(limit, 1), 50);
  const hits = await wikidataSearchEntitiesKo(search, Math.min(20, targetLimit * 2));
  if (hits.length === 0) return [];

  const seedQids = hits.map((h) => h.qid);
  const qidRank = new Map(seedQids.map((qid, idx) => [qid, idx])); // 원 검색 순서 유지용

  const seenQids = new Set();
  let frontier = [...seedQids];

  const outByAniListId = new Map(); // anilistId -> {anilistId, koTitle, qid, qidRank}

  const MAX_QIDS = 90; // 과도 확장 방지

  function addCandidate(qid, anilistId, koTitle) {
    if (outByAniListId.has(anilistId)) return;
    outByAniListId.set(anilistId, {
      anilistId,
      koTitle: koTitle || null,
      qid,
      qidRank: qidRank.get(qid) ?? 9999,
    });
  }

  // ✅ seed 상위 QID의 시리즈 역방향 조회(P179) 병렬 처리
  const seriesSeedQids = seedQids.slice(0, 3);
  const seriesSettled = await Promise.allSettled(
    seriesSeedQids.map((qid) => wdqsFindAniListBySeriesQid(qid, 40))
  );
  let seriesPrefetchHadFailure = false;
  for (let i = 0; i < seriesSettled.length; i++) {
    const qid = seriesSeedQids[i];
    const r = seriesSettled[i];
    if (r.status !== "fulfilled") {
      seriesPrefetchHadFailure = true;
      continue;
    }
    for (const x of r.value) {
      addCandidate(qid, x.anilistId, x.koTitle);
    }
  }

  if (outByAniListId.size >= targetLimit) {
    const arr = [...outByAniListId.values()].sort(
      (a, b) => a.qidRank - b.qidRank || a.anilistId - b.anilistId
    );
    return arr.slice(0, targetLimit);
  }

  for (let d = 0; d <= depth; d++) {
    if (frontier.length === 0) break;

    // 중복 제거 + cap
    frontier = [...new Set(frontier)].filter((q) => !seenQids.has(q));
    frontier = frontier.slice(0, Math.max(0, MAX_QIDS - seenQids.size));
    if (frontier.length === 0) break;
    if (outByAniListId.size >= targetLimit) break;

    // wbgetentities는 최대 50개씩
    const nextDepth = [];
    for (let i = 0; i < frontier.length; i += 20) {
      const chunk = frontier.slice(i, i + 20);
      chunk.forEach((q) => seenQids.add(q));

      const json = await wdApi({
        action: "wbgetentities",
        ids: chunk.join("|"),
        props: "labels|aliases|claims",
        languages: "ko|en|ja",
      });

      const entities = json?.entities || {};

      for (const qid of chunk) {
        const e = entities[qid];
        if (!e) continue;

        // 1) 자기 자신이 P8729를 갖고 있으면 수집
        const label = pickBestLabel(e);
        for (const anilistId of extractAniListAnimeIds(e)) {
          addCandidate(qid, anilistId, label);
        }

        // 2) 확장(하위로 내려가기): P527(has part), P4969(derivative work)
        if (d < depth) {
          const parts = extractQidsFromProp(e, "P527"); // has part(s)
          const deriv = extractQidsFromProp(e, "P4969"); // derivative work
          for (const nq of [...parts, ...deriv]) nextDepth.push(nq);
        }
      }
      if (outByAniListId.size >= targetLimit) break;
    }

    if (d < depth) frontier = nextDepth;
  }

  // ✅ 사전 병렬 조회에서 일부 실패한 경우에만 한 번 더 보강
  if (outByAniListId.size < targetLimit && seriesPrefetchHadFailure) {
    const qids = seriesSeedQids;
    const settled = await Promise.allSettled(
      qids.map((qid) => wdqsFindAniListBySeriesQid(qid, 40))
    );
    for (let i = 0; i < settled.length; i++) {
      const qid = qids[i];
      const r = settled[i];
      if (r.status !== "fulfilled") continue;
      for (const x of r.value) {
        addCandidate(qid, x.anilistId, x.koTitle);
      }
    }
  }

  // 결과: 원 검색 QID 순서 우선, 그 다음 anilistId
  const arr = [...outByAniListId.values()].sort(
    (a, b) => a.qidRank - b.qidRank || a.anilistId - b.anilistId
  );

  return arr.slice(0, targetLimit);
}
