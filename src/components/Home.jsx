import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import { readLibraryListPreferred } from "../repositories/libraryRepo";
import { readAllWatchLogsSnapshot } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred } from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";

function formatWatchLogDate(log) {
  const value = String(log?.watchedAtValue || "").trim();
  if (value) return value;
  const createdAt = Number(log?.createdAt);
  if (!Number.isFinite(createdAt)) return "날짜 미상";
  return new Date(createdAt).toISOString().slice(0, 10);
}

function pickTitle(item, media) {
  if (item?.koTitle) return item.koTitle;
  const synKo = Array.isArray(media?.synonyms)
    ? media.synonyms.find((s) => /[가-힣]/.test(String(s || "")))
    : null;
  return (
    synKo ||
    media?.title?.english ||
    media?.title?.romaji ||
    media?.title?.native ||
    (item?.anilistId ? `#${item.anilistId}` : "Unknown")
  );
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [logs, setLogs] = useState([]);
  const [pins, setPins] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const list = await readLibraryListPreferred(myListSeed).catch(() => myListSeed);
      const safeList = Array.isArray(list) ? list : [];
      if (!alive) return;
      setItems(safeList);
      setLogs(readAllWatchLogsSnapshot());
      const pinRows = await listCharacterPinsPreferred().catch(() => []);
      if (!alive) return;
      setPins(Array.isArray(pinRows) ? pinRows : []);

      const ids = safeList.map((x) => Number(x?.anilistId)).filter(Number.isFinite);
      setMediaMap(getCachedAnimeMap(ids));
      const map = await fetchAnimeByIdsCached(ids, { includeCharacters: false }).catch(() => new Map());
      if (!alive) return;
      setMediaMap(map);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const resurfacing = useMemo(() => {
    const sortedLogs = [...(Array.isArray(logs) ? logs : [])].sort(
      (a, b) =>
        Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) ||
        Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
    );

    const recentLogs = sortedLogs.slice(0, 8).map((log) => ({
      id: String(log.id),
      anilistId: Number(log.anilistId),
      label: formatWatchLogDate(log),
      eventType: log.eventType || "기록",
      cue: String(log.cue || "").trim(),
    }));

    const seenLogAnime = new Set(
      sortedLogs.map((x) => Number(x?.anilistId)).filter(Number.isFinite)
    );
    const noLogItems = items
      .filter((it) => !seenLogAnime.has(Number(it?.anilistId)))
      .sort((a, b) => Number(b?.addedAt || 0) - Number(a?.addedAt || 0))
      .slice(0, 8)
      .map((it) => ({
        anilistId: Number(it.anilistId),
      }));

    const currentYear = new Date().getUTCFullYear();
    const thisTimeRows = sortedLogs
      .filter((log) => {
        const value = String(log?.watchedAtValue || "");
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        const year = Number(m[1]);
        return Number.isFinite(year) && year !== currentYear;
      })
      .map((log) => {
        const value = String(log.watchedAtValue || "");
        const mmdd = value.slice(5, 10);
        return { log, mmdd };
      });

    const todayMmDd = new Date().toISOString().slice(5, 10);
    const todayM = Number(todayMmDd.slice(0, 2));
    const todayD = Number(todayMmDd.slice(3, 5));
    const todayScore = todayM * 31 + todayD;
    const thisTime = [];
    const seenThisTime = new Set();

    for (const row of thisTimeRows) {
      const m = Number(row.mmdd.slice(0, 2));
      const d = Number(row.mmdd.slice(3, 5));
      const score = m * 31 + d;
      const diff = Math.abs(score - todayScore);
      if (diff > 20) continue;
      const animeId = Number(row.log.anilistId);
      if (!Number.isFinite(animeId) || seenThisTime.has(animeId)) continue;
      seenThisTime.add(animeId);
      thisTime.push({
        id: String(row.log.id),
        anilistId: animeId,
        label: formatWatchLogDate(row.log),
        eventType: row.log.eventType || "기록",
      });
      if (thisTime.length >= 8) break;
    }

    const recentCharMap = new Map();
    for (const log of sortedLogs.slice(0, 120)) {
      const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
      for (const ref of refs) {
        const characterId = Number(ref?.characterId);
        if (!Number.isFinite(characterId)) continue;
        const cur = recentCharMap.get(characterId) || {
          characterId,
          name: String(ref?.nameSnapshot || `#${characterId}`),
          image: ref?.imageSnapshot || "",
          count: 0,
          lastSort: 0,
        };
        cur.count += 1;
        cur.lastSort = Math.max(cur.lastSort, Number(log?.watchedAtSort || 0));
        recentCharMap.set(characterId, cur);
      }
    }
    const recentCharacters = [...recentCharMap.values()]
      .sort((a, b) => b.count - a.count || b.lastSort - a.lastSort)
      .slice(0, 8);

    return { recentLogs, thisTime, noLogItems, recentCharacters };
  }, [items, logs]);

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  const titleById = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      map.set(Number(it.anilistId), pickTitle(it, mediaMap.get(Number(it.anilistId))));
    }
    return map;
  }, [items, mediaMap]);

  function renderAnimeRow(anilistId, metaTop, metaBottom = "") {
    const media = mediaMap.get(Number(anilistId));
    const title = titleById.get(Number(anilistId)) || `#${anilistId}`;
    const poster = media?.coverImage?.large || "";
    return (
      <a
        href={`${base}library/`}
        style={{
          display: "grid",
          gridTemplateColumns: "42px 1fr",
          gap: 8,
          alignItems: "center",
          textDecoration: "none",
          color: "inherit",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 8,
          padding: 6,
          background: "rgba(255,255,255,.02)",
        }}
      >
        {poster ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            style={{ width: 42, height: 58, borderRadius: 6, objectFit: "cover" }}
          />
        ) : (
          <div
            aria-hidden
            style={{ width: 42, height: 58, borderRadius: 6, background: "rgba(255,255,255,.14)" }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {metaTop}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          {metaBottom && (
            <div className="small" style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {metaBottom}
            </div>
          )}
        </div>
      </a>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section
        className="nav"
        style={{
          margin: "calc(-1 * var(--page-pad)) calc(-1 * var(--page-pad)) 12px",
          padding: "10px var(--page-pad)",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <a href={`${base}`}>회상</a>
          <a href={`${base}library/`}>목록</a>
          <a href={`${base}tier/`}>티어</a>
          <a href={`${base}data/`}>데이터</a>
        </div>
      </section>

      <section style={{ marginBottom: 6 }}>
        <h1 style={{ margin: "0 0 4px" }}>회상 홈</h1>
        <p className="small" style={{ margin: 0, opacity: 0.82 }}>
          최근 감상 기록과 놓친 작품을 빠르게 다시 꺼내보는 화면
        </p>
      </section>

      <section
        style={{
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 10,
          padding: 12,
          background: "linear-gradient(135deg, rgba(55,128,255,.18), rgba(255,255,255,.02))",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
          작품 {items.length}개
        </div>
        <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
          로그 {logs.length}개
        </div>
        <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
          핀 캐릭터 {pins.length}개
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>최근 기록</div>
          {resurfacing.recentLogs.length === 0 ? (
            <div className="small">아직 기록이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.recentLogs.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow(row.anilistId, `${row.label} · ${row.eventType}`, row.cue || "")}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>이맘때 본 작품</div>
          {resurfacing.thisTime.length === 0 ? (
            <div className="small">아직 표시할 과거 기록이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.thisTime.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow(row.anilistId, `${row.label} · ${row.eventType}`)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>기억 없는 작품</div>
          {resurfacing.noLogItems.length === 0 ? (
            <div className="small">모든 작품에 최소 1개 이상의 기록이 있습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.noLogItems.map((row) => (
                <div key={row.anilistId}>
                  {renderAnimeRow(row.anilistId, "기록 없음")}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>최근 자주 기록한 캐릭터</div>
          {resurfacing.recentCharacters.length === 0 ? (
            <div className="small">아직 캐릭터 기록이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {resurfacing.recentCharacters.map((c) => (
                <div key={c.characterId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </div>
                  </div>
                  <div className="small" style={{ opacity: 0.85 }}>{c.count}회</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>핀 캐릭터</div>
          {pins.length === 0 ? (
            <div className="small">목록 상세 모달에서 캐릭터를 핀으로 고정해 보세요.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {pins.slice(0, 8).map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {p.imageSnapshot ? (
                    <img
                      src={p.imageSnapshot}
                      alt={p.nameSnapshot}
                      loading="lazy"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nameSnapshot}
                    </div>
                    <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleById.get(Number(p.mediaId)) || `#${p.mediaId}`}
                    </div>
                  </div>
                </div>
              ))}
              <a href={`${base}library/`} className="small" style={{ opacity: 0.9 }}>
                목록에서 핀 관리하기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
