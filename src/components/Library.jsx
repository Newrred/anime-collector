import { useEffect, useMemo, useRef, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import AddAnime from "./AddAnime.jsx";

function dedupeByAnilistId(list) {
  const source = Array.isArray(list) ? list : [];
  const map = new Map();
  for (const it of source) {
    const id = Number(it?.anilistId);
    if (!Number.isFinite(id)) continue;

    if (!map.has(id)) {
      map.set(id, { ...it, anilistId: id });
      continue;
    }

    const prev = map.get(id);
    map.set(id, {
      ...prev,
      ...it,
      addedAt: Math.max(prev.addedAt ?? 0, it.addedAt ?? 0),
      koTitle: it.koTitle || prev.koTitle || null,
    });
  }
  return [...map.values()];
}

function firstHangulSynonym(media) {
  const arr = media?.synonyms;
  if (!Array.isArray(arr)) return null;
  return arr.find((s) => /[\uAC00-\uD7A3]/.test(String(s || ""))) || null;
}

function pickCardTitle(item, media) {
  if (item?.koTitle) return item.koTitle;

  const synKo = firstHangulSynonym(media);
  if (synKo) return synKo;

  return (
    media?.title?.english ||
    media?.title?.romaji ||
    media?.title?.native ||
    (item?.anilistId ? `#${item.anilistId}` : "Unknown")
  );
}

function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}

function pruneTierStorage(removedId) {
  try {
    const raw = localStorage.getItem("anime:tier:v1");
    if (!raw) return;

    const ts = JSON.parse(raw);
    ts.unranked = (ts.unranked || []).filter((id) => id !== removedId);

    if (ts.tiers) {
      for (const k of Object.keys(ts.tiers)) {
        ts.tiers[k] = (ts.tiers[k] || []).filter((id) => id !== removedId);
      }
    }

    localStorage.setItem("anime:tier:v1", JSON.stringify(ts));
  } catch {
    // ignore
  }
}

/** AniList 장르(영문) -> 한글 매핑 */
const GENRE_KO = {
  Action: "액션",
  Adventure: "어드벤처",
  Comedy: "코미디",
  Drama: "드라마",
  Ecchi: "에치",
  Fantasy: "판타지",
  Horror: "호러",
  "Mahou Shoujo": "마법소녀",
  Mecha: "메카",
  Music: "음악",
  Mystery: "미스터리",
  Psychological: "심리",
  Romance: "로맨스",
  "Sci-Fi": "SF",
  SciFi: "SF",
  "Slice of Life": "일상",
  Sports: "스포츠",
  Supernatural: "초자연",
  Thriller: "스릴러",
  Hentai: "헨타이",
};

function genreKo(g) {
  const s = String(g || "").trim();
  return GENRE_KO[s] || s;
}

function safeGenres(media) {
  const arr = media?.genres;
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

const LIST_STORAGE_KEY = "anime:list:v1";
const TIER_STORAGE_KEY = "anime:tier:v1";
const LAST_EXPORT_AT_KEY = "anime:lastBackupAt:v1";
const AUTO_BACKUP_KEY = "anime:autoBackup:v1";
const AUTO_BACKUP_META_KEY = "anime:autoBackup:meta:v1";
const BACKUP_REMIND_DAYS = 7;
const SCORE_MAX = 5;
const SCORE_STEP = 0.5;
const REWATCH_COUNT_MAX = 999;

function normalizeScoreValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  // Backward-compat: legacy 10-point scores are converted to 5-point.
  const scaled = n > SCORE_MAX ? n / 2 : n;
  const rounded = Math.round(scaled / SCORE_STEP) * SCORE_STEP;
  return clamp(rounded, 0, SCORE_MAX);
}

function normalizeRewatchCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), 0, REWATCH_COUNT_MAX);
}

function normalizeRewatchDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [yy, mm, dd] = s.split("-").map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;

  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return null;
  }
  return s;
}

function sameItem(a, b) {
  return (
    a?.anilistId === b?.anilistId &&
    (a?.koTitle ?? null) === (b?.koTitle ?? null) &&
    (a?.status ?? "미분류") === (b?.status ?? "미분류") &&
    (a?.score ?? null) === (b?.score ?? null) &&
    (a?.memo ?? "") === (b?.memo ?? "") &&
    (a?.rewatchCount ?? 0) === (b?.rewatchCount ?? 0) &&
    (a?.lastRewatchAt ?? null) === (b?.lastRewatchAt ?? null) &&
    (a?.addedAt ?? 0) === (b?.addedAt ?? 0)
  );
}

function normalizeItem(it, fallbackAddedAt = 0) {
  const anilistId = Number(it?.anilistId);
  const addedAtNum = Number(it?.addedAt);
  return {
    anilistId,
    koTitle: it?.koTitle ?? null,
    status: it?.status ?? "미분류",
    score: normalizeScoreValue(it?.score),
    memo: it?.memo ?? "",
    rewatchCount: normalizeRewatchCount(it?.rewatchCount),
    lastRewatchAt: normalizeRewatchDate(it?.lastRewatchAt),
    addedAt: Number.isFinite(addedAtNum) ? addedAtNum : fallbackAddedAt,
  };
}

function normalizeImportList(rawList) {
  const baseTs = Date.now();
  return dedupeByAnilistId(
    (rawList || []).map((it, idx) => normalizeItem(it, baseTs + idx))
  );
}

function toUniqueIdArray(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const n = Number(x);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function normalizeTierState(rawTier) {
  const tier = rawTier && typeof rawTier === "object" ? rawTier : {};
  const tiers = {};
  for (const [k, v] of Object.entries(tier?.tiers || {})) {
    tiers[k] = toUniqueIdArray(v);
  }
  return {
    unranked: toUniqueIdArray(tier?.unranked || []),
    tiers,
  };
}

function mergeTierState(currentTier, incomingTier) {
  const a = normalizeTierState(currentTier);
  const b = normalizeTierState(incomingTier);
  const keys = new Set([...Object.keys(a.tiers), ...Object.keys(b.tiers)]);

  const tiers = {};
  for (const k of keys) {
    tiers[k] = toUniqueIdArray([...(a.tiers[k] || []), ...(b.tiers[k] || [])]);
  }

  const ranked = new Set();
  for (const ids of Object.values(tiers)) {
    for (const id of ids) ranked.add(id);
  }

  const unranked = toUniqueIdArray([...(a.unranked || []), ...(b.unranked || [])]).filter(
    (id) => !ranked.has(id)
  );

  return { unranked, tiers };
}

function readLastExportAt() {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_AT_KEY);
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

function formatAgo(ms) {
  if (!Number.isFinite(ms)) return "기록 없음";
  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) return "1시간 이내";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return `${days}일 전`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function isHangulText(s) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(String(s || ""));
}

function pickCharacterName(node) {
  const full = String(node?.name?.full || "").trim();
  const native = String(node?.name?.native || "").trim();
  let name = "Unknown";

  if (isHangulText(full)) name = full;
  else if (isHangulText(native)) name = native;
  else name = full || native || "Unknown";

  const subName = [full, native].find((v) => v && v !== name) || "";
  return { name, subName };
}

function getCharacterRows(media, limit = 8) {
  const edges = media?.characters?.edges;
  if (!Array.isArray(edges)) return [];

  const mapped = edges
    .map((edge) => {
      const { name, subName } = pickCharacterName(edge?.node);
      return {
        id: Number(edge?.node?.id),
        name,
        subName,
        image: edge?.node?.image?.medium || edge?.node?.image?.large || "",
        role: String(edge?.role || ""),
      };
    })
    .filter((x) => Number.isFinite(x.id) && x.name);

  if (!mapped.length) return [];

  mapped.sort((a, b) => {
    const ar = a.role === "MAIN" ? 0 : 1;
    const br = b.role === "MAIN" ? 0 : 1;
    return ar - br || a.name.localeCompare(b.name, "ko");
  });

  const seen = new Set();
  const out = [];
  for (const row of mapped) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="small"
      style={{
        border: "solid 0.1px rgba(255,255,255,0.3)",
        color: "white",
        cursor: "pointer",
        padding: "4px 10px",
        borderRadius: 999,
        lineHeight: 1.6,
        background: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.08)",
        fontWeight: active ? 700 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function StatBars({ rows, maxCount, emptyText = "데이터 없음" }) {
  if (!rows.length) return <div className="small">{emptyText}</div>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((row) => {
        const w = maxCount > 0 ? Math.max(6, Math.round((row.count / maxCount) * 100)) : 0;
        return (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "74px 1fr 36px", gap: 8, alignItems: "center" }}>
            <div className="small" style={{ opacity: 0.9, textAlign: "right" }}>{row.label}</div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 999 }}>
              <div style={{ width: `${w}%`, height: "100%", borderRadius: 999, background: "rgba(120,220,255,.85)" }} />
            </div>
            <div className="small" style={{ opacity: 0.95 }}>{row.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function SegTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 5,
        padding: "8px 12px",
        cursor: "pointer",
        color: active ? "#0b0c10" : "rgba(255,255,255,0.92)",
        background: active ? "rgba(255,255,255,.88)" : "transparent",
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

/**
 * 장르 태그(카드/모달 공용)
 * - compact=true: 줄바꿈 없이 1줄로 잘라서 meta 높이 줄임
 * - onPickGenre: 태그 클릭 시 필터
 */
function GenresRow({ genres, max = 3, compact = false, onPickGenre }) {
  const arr = Array.isArray(genres) ? genres : [];
  if (arr.length === 0) return null;

  const show = arr.slice(0, max);
  const rest = arr.length - show.length;

  const wrapStyle = compact
    ? {
        display: "flex",
        flexWrap: "nowrap",
        gap: 6,
        marginTop: 6,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }
    : { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 };

  return (
    <div style={wrapStyle}>
      {show.map((g) => (
        <button
          key={g}
          type="button"
          className="small"
          title={g}
          onClick={(e) => {
            e.stopPropagation(); // 카드 클릭(모달 열기) 방지
            onPickGenre?.(g, e);
          }}
          style={{
            border: "none",
            cursor: onPickGenre ? "pointer" : "default",
            padding: "2px 8px",
            borderRadius: 999,
            color: "white",
            background: "rgba(255,255,255,0.08)",
            lineHeight: 1.6,
            whiteSpace: "nowrap",
          }}
        >
          {genreKo(g)}
        </button>
      ))}
      {rest > 0 && (
        <span
          className="small"
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.06)",
            opacity: 0.85,
            lineHeight: 1.6,
            whiteSpace: "nowrap",
          }}
          title={arr.map(genreKo).join(", ")}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export default function Library() {
  const [sortKey, setSortKey] = useState("addedAt"); // addedAt | title | score | year | genre
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [groupByStatus, setGroupByStatus] = useState(true);
  const [items, setItems] = useLocalStorageState(LIST_STORAGE_KEY, myListSeed);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("전체");

  // 장르 다중 선택(영문 원본 값 배열)
  const [genre, setGenre] = useState([]); // [] = 전체

  const [selectedId, setSelectedId] = useState(null);
  const [hoverScore, setHoverScore] = useState(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [rewatchCountDraft, setRewatchCountDraft] = useState(0);
  const [lastRewatchAtDraft, setLastRewatchAtDraft] = useState("");

  const fileRef = useRef(null);
  const dataMenuRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupReminder, setBackupReminder] = useState("");
  const [importMode, setImportMode] = useState("merge"); // merge | overwrite
  const [importText, setImportText] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [dataTab, setDataTab] = useState("export"); // export | import
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [addTab, setAddTab] = useState("search"); // search | recommend
  const [cardView, setCardView] = useState("meta"); // meta | poster
  const [cardsPerRowBase, setCardsPerRowBase] = useLocalStorageState("anime:grid:perRowBase:v1", 5);
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    setItems((prev) => {
      const source = Array.isArray(prev) ? prev : [];
      const normalized = dedupeByAnilistId(
        source.map((it, idx) =>
          normalizeItem(
            it,
            Number.isFinite(Number(it?.addedAt)) ? Number(it.addedAt) : idx
          )
        )
      );

      if (!Array.isArray(prev)) {
        return normalized;
      }
      if (
        normalized.length === source.length &&
        normalized.every((it, idx) => sameItem(it, source[idx]))
      ) {
        return prev;
      }
      return normalized;
    });
  }, [setItems]);

  function buildBackupPayload() {
    let tier = null;
    try {
      const raw = localStorage.getItem(TIER_STORAGE_KEY);
      tier = raw ? JSON.parse(raw) : null;
    } catch {}

    return {
      app: "ani-site",
      version: 1,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(items),
      tier,
    };
  }

  function markBackupExported(message) {
    try {
      const nowIso = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_AT_KEY, nowIso);
    } catch {}
    setBackupMsg(message);
  }

  function exportBackup() {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ani-site-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    markBackupExported("백업 파일을 다운로드했어요.");
  }

  async function exportBackupMobile() {
    const payload = buildBackupPayload();
    const text = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `ani-site-backup-${date}.json`;

    try {
      const file = new File([text], filename, { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "애니 라이브러리 백업",
          files: [file],
        });
        markBackupExported("백업 JSON 파일을 공유했어요.");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setBackupMsg("공유를 취소했어요.");
        return;
      }
    }

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "애니 라이브러리 백업(JSON)",
          text,
        });
        markBackupExported("백업 JSON 텍스트를 공유했어요.");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setBackupMsg("공유를 취소했어요.");
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      markBackupExported("백업 JSON을 클립보드에 복사했어요.");
    } catch {
      setBackupMsg("공유/복사에 실패했어요. JSON 파일 내보내기를 사용해 주세요.");
    }
  }

  async function importBackupFromJson(json, mode = "merge") {
    const incomingList = Array.isArray(json) ? json : json?.list;
    if (!Array.isArray(incomingList)) {
      throw new Error("가져오기 파일에 list 배열이 없어요.");
    }

    const incomingNormalized = normalizeImportList(incomingList);
    const isOverwrite = mode === "overwrite";

    if (isOverwrite) {
      const ok = window.confirm("현재 목록을 모두 덮어쓰고 가져올까요?");
      if (!ok) return;
      setItems(incomingNormalized);
    } else {
      setItems((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingTier) {
      try {
        const currentRaw = localStorage.getItem(TIER_STORAGE_KEY);
        const currentTier = currentRaw ? JSON.parse(currentRaw) : null;
        const nextTier = isOverwrite
          ? normalizeTierState(incomingTier)
          : mergeTierState(currentTier, incomingTier);
        localStorage.setItem(TIER_STORAGE_KEY, JSON.stringify(nextTier));
      } catch {}
    }

    setBackupMsg(
      isOverwrite
        ? "가져오기 완료! 기존 목록을 덮어썼어요."
        : "가져오기 완료! 기존 목록과 병합했어요."
    );
    setSelectedId(null);
    setDataMenuOpen(false);
  }

  async function importBackup(file, mode = "merge") {
    const text = await file.text();
    const json = JSON.parse(text);
    await importBackupFromJson(json, mode);
  }

  async function onImportText() {
    const raw = String(importText || "").trim();
    if (!raw) {
      setBackupMsg("붙여넣은 JSON 텍스트가 비어 있어요.");
      return;
    }

    try {
      const json = JSON.parse(raw);
      await importBackupFromJson(json, importMode);
      setImportText("");
      setDataMenuOpen(false);
    } catch (err) {
      console.error(err);
      setBackupMsg(`붙여넣기 가져오기 실패: ${err?.message || "알 수 없는 오류"}`);
    }
  }

  async function onPickImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importBackup(file, importMode);
    } catch (err) {
      console.error(err);
      setBackupMsg(`가져오기 실패: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      e.target.value = "";
    }
  }

  const ids = useMemo(() => items.map((x) => x.anilistId), [items]);

  useEffect(() => {
    setItems((prev) => dedupeByAnilistId(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMediaMap(getCachedAnimeMap(ids));

    let alive = true;
    (async () => {
      const map = await fetchAnimeByIdsCached(ids);
      if (alive) setMediaMap(map);
    })().catch(console.error);
    return () => {
      alive = false;
    };
  }, [ids]);

  useEffect(() => {
    setItems((prev) => {
      const baseTs = Date.now() - prev.length;
      let changed = false;
      const next = prev.map((x, idx) => {
        if (Number.isFinite(Number(x?.addedAt))) return x;
        changed = true;
        return { ...x, addedAt: baseTs + idx };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const rawTier = localStorage.getItem(TIER_STORAGE_KEY);
      const tier = rawTier ? JSON.parse(rawTier) : null;
      const snapshot = {
        app: "ani-site",
        version: 1,
        savedAt: new Date().toISOString(),
        list: items,
        tier,
      };
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
      localStorage.setItem(
        AUTO_BACKUP_META_KEY,
        JSON.stringify({ savedAt: snapshot.savedAt, count: items.length })
      );
    } catch {}
  }, [items]);

  useEffect(() => {
    const last = readLastExportAt();
    if (!items.length) {
      setBackupReminder("");
      return;
    }

    if (!last) {
      setBackupReminder("수동 백업 기록이 없습니다. 내보내기(JSON)로 백업해 두세요.");
      return;
    }

    const threshold = BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - last >= threshold) {
      setBackupReminder(`마지막 수동 백업이 ${formatAgo(last)}입니다. 백업 갱신을 권장합니다.`);
    } else {
      setBackupReminder(`마지막 수동 백업: ${formatAgo(last)} (자동 로컬 스냅샷은 계속 저장)`);
    }
  }, [items, backupMsg]);

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }
    function onInstallReady() {
      setCanInstallPwa(true);
    }
    function onInstalled() {
      setCanInstallPwa(false);
      setBackupMsg("앱이 설치됐습니다. 홈 화면에서 바로 실행할 수 있어요.");
    }

    syncInstallState();
    window.addEventListener("pwa-install-ready", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) setDataMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!gridRef.current || typeof ResizeObserver === "undefined") return undefined;
    const el = gridRef.current;
    const ro = new ResizeObserver((entries) => {
      const width = entries?.[0]?.contentRect?.width;
      if (Number.isFinite(width)) setGridWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statusOrder = { 보는중: 0, 완료: 1, 보류: 2, 하차: 3, 미분류: 4 };
  const statusBadgeTheme = {
    완료: { text: "#8fd3ff", border: "rgba(143,211,255,.72)", bg: "rgba(143,211,255,.14)" },
    보는중: { text: "#8ff3ba", border: "rgba(143,243,186,.72)", bg: "rgba(143,243,186,.14)" },
    보류: { text: "#ffd083", border: "rgba(255,208,131,.72)", bg: "rgba(255,208,131,.14)" },
    하차: { text: "#ff9a9a", border: "rgba(255,154,154,.72)", bg: "rgba(255,154,154,.14)" },
    미분류: { text: "#d7d9df", border: "rgba(215,217,223,.52)", bg: "rgba(215,217,223,.10)" },
  };

  function getStatusBadgeStyle(statusRaw) {
    const status = statusRaw || "미분류";
    const theme = statusBadgeTheme[status] || statusBadgeTheme.미분류;
    return {
      display: "inline-flex",
      alignItems:"center",
      justifyContent: "center",
      padding: "1px 6px",
      borderRadius: 999,
      border: `1px solid ${theme.border}`,
      background: theme.bg,
      color: theme.text,
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.3,
      whiteSpace: "nowrap",
    };
  }

  function getTitle(it) {
    const m = mediaMap.get(it.anilistId);
    return pickCardTitle(it, m);
  }
  function getYear(it) {
    const m = mediaMap.get(it.anilistId);
    return m?.seasonYear ?? -1;
  }
  function getScore(it) {
    const score = normalizeScoreValue(it?.score);
    return score == null ? -1 : score;
  }
  function getGenreKey(it) {
    const m = mediaMap.get(it.anilistId);
    const gs = safeGenres(m);
    if (!gs.length) return "";
    return gs.map((g) => genreKo(g)).join("|");
  }

  function removeAnime(id) {
    const ok = window.confirm("이 애니를 라이브러리에서 삭제할까요?\n(점수/메모 포함된 모든 데이터가 사라집니다)");
    if (!ok) return;

    setItems((prev) => prev.filter((x) => x.anilistId !== id));
    pruneTierStorage(id);
    setSelectedId(null);
  }

  const genreSet = useMemo(() => new Set((Array.isArray(genre) ? genre : []).filter(Boolean)), [genre]);

  function clearGenres() {
    setGenre([]);
  }

  function toggleGenre(g) {
    setGenre((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const s = new Set(arr);
      if (s.has(g)) s.delete(g);
      else s.add(g);
      return [...s];
    });
  }

  // 카드 장르 태그 클릭: 기본은 해당 장르만, (Shift/Meta/Ctrl) 누르면 다중 선택 유지
  function onPickGenreFromTag(g, e) {
    const hasModifier = !!(e?.shiftKey || e?.metaKey || e?.ctrlKey);
    if (!hasModifier) {
      // 바로 필터링 느낌: 단일로 만들기(이미 단일이면 해제)
      setGenre((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        if (arr.length === 1 && arr[0] === g) return [];
        return [g];
      });
    } else {
      toggleGenre(g);
    }
  }

  // 현재 라이브러리에 저장된 장르 목록(추가 요청 없이 mediaMap 기반)
  const genreOptions = useMemo(() => {
    const s = new Set();
    for (const it of items) {
      const m = mediaMap.get(it.anilistId);
      for (const g of safeGenres(m)) s.add(g);
    }
    const arr = [...s];
    arr.sort((a, b) => genreKo(a).localeCompare(genreKo(b), "ko"));
    return arr;
  }, [items, mediaMap]);

  // 검색어(q)에 제목과 장르를 모두 포함
  function matchesQuery(it, qq) {
    if (!qq) return true;

    const m = mediaMap.get(it.anilistId);
    const gs = safeGenres(m);

    // 제목 관련
    const titles = [
      getTitle(it),
      m?.title?.english,
      m?.title?.romaji,
      m?.title?.native,
      ...(Array.isArray(m?.synonyms) ? m.synonyms : []),
      it?.koTitle,
    ].filter(Boolean);

    // 장르(영문 + 한글)
    const genreText = [
      ...gs,
      ...gs.map((g) => genreKo(g)),
    ].filter(Boolean);

    const hay = (titles.join(" ") + " " + genreText.join(" ")).toLowerCase();
    return hay.includes(qq);
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const arr = items.filter((it) => {
      if (status !== "전체" && (it.status || "미분류") !== status) return false;

      // 장르 다중 필터: 선택값이 있으면 교집합만 통과
      if (genreSet.size > 0) {
        const m = mediaMap.get(it.anilistId);
        const gs = safeGenres(m);
        let ok = false;
        for (const g of gs) {
          if (genreSet.has(g)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      // 제목/장르 포함 검색
      if (!matchesQuery(it, qq)) return false;

      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (groupByStatus && status === "전체") {
        const sa = a.status || "미분류";
        const sb = b.status || "미분류";
        const da = statusOrder[sa] ?? 999;
        const db = statusOrder[sb] ?? 999;
        if (da !== db) return da - db;
      }

      let va = 0, vb = 0;

      if (sortKey === "addedAt") { va = a.addedAt ?? 0; vb = b.addedAt ?? 0; }

      if (sortKey === "title") {
        const ta = getTitle(a) || "";
        const tb = getTitle(b) || "";
        return dir * ta.localeCompare(tb, "ko") || (a.anilistId - b.anilistId);
      }

      if (sortKey === "score") { va = getScore(a); vb = getScore(b); }
      if (sortKey === "year")  { va = getYear(a);  vb = getYear(b); }

      if (sortKey === "genre") {
        const ga = getGenreKey(a);
        const gb = getGenreKey(b);
        return dir * ga.localeCompare(gb, "ko") || (a.anilistId - b.anilistId);
      }

      if (va === vb) return (a.anilistId - b.anilistId);
      return dir * (va - vb);
    });

    return arr;
  }, [items, mediaMap, q, status, sortKey, sortDir, groupByStatus, genreSet]);

  const effectiveCols = useMemo(() => {
    const base = clamp(Number(cardsPerRowBase) || 5, 2, 10);
    if (!Number.isFinite(gridWidth) || gridWidth <= 0) return base;

    const normalized = gridWidth / 1080;
    const scaled = Math.round(base * normalized);
    const minCols = cardView === "poster" ? 2 : 1;
    const minCardWidth = cardView === "poster" ? 120 : 180;
    const maxColsByWidth = Math.max(minCols, Math.floor(gridWidth / minCardWidth));
    return clamp(scaled, minCols, Math.max(minCols, maxColsByWidth));
  }, [cardsPerRowBase, gridWidth, cardView]);

  const dashboard = useMemo(() => {
    const statusRows = ["완료", "보는중", "보류", "하차", "미분류"].map((s) => ({
      key: s,
      label: s,
      count: items.filter((it) => (it.status || "미분류") === s).length,
    }));

    const genreCount = new Map();
    let scoreSum = 0;
    let scoreCount = 0;

    for (const it of items) {
      const m = mediaMap.get(it.anilistId);
      const gs = safeGenres(m);
      for (const g of gs) {
        genreCount.set(g, (genreCount.get(g) || 0) + 1);
      }

      const score = normalizeScoreValue(it?.score);
      if (score != null) {
        scoreSum += score;
        scoreCount += 1;
      }
    }

    const genreRows = [...genreCount.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "ko"))
      .slice(0, 5)
      .map(([g, count]) => ({ key: g, label: genreKo(g), count }));

    const rewatchRows = items
      .map((it) => ({
        key: String(it.anilistId),
        id: it.anilistId,
        title: getTitle(it),
        count: normalizeRewatchCount(it?.rewatchCount),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ko"))
      .slice(0, 5)
      .map((row) => ({ ...row }));

    const maxStatus = Math.max(...statusRows.map((x) => x.count), 1);
    const maxGenre = Math.max(...genreRows.map((x) => x.count), 1);
    const averageScore = scoreCount > 0 ? scoreSum / scoreCount : null;

    return {
      total: items.length,
      scored: scoreCount,
      averageScore,
      statusRows,
      genreRows,
      rewatchRows,
      maxStatus,
      maxGenre,
    };
  }, [items, mediaMap]);

  const selected = selectedId ? items.find((x) => x.anilistId === selectedId) : null;
  const selectedMedia = selectedId ? mediaMap.get(selectedId) : null;
  const selectedTitle = pickCardTitle(selected, selectedMedia);
  const selectedScoreRaw = normalizeScoreValue(selected?.score);
  const selectedScore = selectedScoreRaw ?? 0;
  const selectedRewatchCount = normalizeRewatchCount(selected?.rewatchCount);
  const selectedLastRewatchAt = normalizeRewatchDate(selected?.lastRewatchAt) || "";
  const previewScore = hoverScore == null ? selectedScore : hoverScore;
  const selectedStarsFill = `${(previewScore / SCORE_MAX) * 100}%`;
  const selectedScoreLabel = hoverScore != null
    ? `${hoverScore} / ${SCORE_MAX}`
    : selectedScoreRaw == null
      ? "미평가"
      : `${selectedScore} / ${SCORE_MAX}`;
  const selectedCharacters = useMemo(
    () => getCharacterRows(selectedMedia, 8),
    [selectedMedia]
  );

  useEffect(() => {
    if (!selectedId) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") closeSelectedModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, memoDraft, rewatchCountDraft, lastRewatchAtDraft]);

  useEffect(() => {
    setHoverScore(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setMemoDraft(selected?.memo || "");
    setRewatchCountDraft(selectedRewatchCount);
    setLastRewatchAtDraft(selectedLastRewatchAt);
  }, [selectedId, selected?.memo, selectedRewatchCount, selectedLastRewatchAt]);

  function commitModalDraft() {
    if (!selectedId) return;
    updateSelected({
      memo: memoDraft,
      rewatchCount: rewatchCountDraft,
      lastRewatchAt: lastRewatchAtDraft || null,
    });
  }

  function closeSelectedModal() {
    commitModalDraft();
    setSelectedId(null);
  }

  function updateSelected(patch) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.anilistId !== selectedId) return x;
        const next = { ...x, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, "score")) {
          next.score = normalizeScoreValue(patch.score);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "rewatchCount")) {
          next.rewatchCount = normalizeRewatchCount(patch.rewatchCount);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "lastRewatchAt")) {
          next.lastRewatchAt = normalizeRewatchDate(patch.lastRewatchAt);
        }
        return next;
      })
    );
  }

  function onCardKeyDown(e, id) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(id);
    }
  }

  function getHoverScoreFromPointer(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return normalizeScoreValue(ratio * SCORE_MAX);
  }

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") {
      setBackupMsg("현재 브라우저에서는 설치 프롬프트를 직접 사용할 수 없습니다.");
      return;
    }

    try {
      const ok = await window.__promptPwaInstall();
      if (!ok) setBackupMsg("설치를 취소했어요. 필요하면 다시 시도해 주세요.");
    } catch {
      setBackupMsg("설치 요청 중 오류가 발생했습니다.");
    }
  }

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return (
    <>
      <section
        className="nav"
        style={{
          margin: "calc(-1 * var(--page-pad)) calc(-1 * var(--page-pad)) 12px",
          padding: "10px var(--page-pad)",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <a href={`${base}`}>목록</a>
          <a href={`${base}tier/`}>티어</a>
        </div>

        <div
          ref={dataMenuRef}
          style={{ position: "relative", marginLeft: "auto" }}
        >
          <button
            type="button"
            onClick={() => setDataMenuOpen((v) => !v)}
            aria-expanded={dataMenuOpen}
            aria-controls="data-menu-panel"
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            내보내기/불러오기
          </button>

          {dataMenuOpen && (
            <div
              id="data-menu-panel"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 360,
                maxWidth: "min(94vw, 360px)",
                zIndex: 70,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(15,17,23,.98)",
                borderRadius: 12,
                padding: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              }}
            >
              <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, background: "rgba(0,0,0,.18)" }}>
                <SegTabButton active={dataTab === "export"} onClick={() => setDataTab("export")}>내보내기</SegTabButton>
                <SegTabButton active={dataTab === "import"} onClick={() => setDataTab("import")}>불러오기</SegTabButton>
              </div>

              {dataTab === "export" ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      exportBackup();
                      setDataMenuOpen(false);
                    }}
                  >
                    JSON 파일 저장
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      exportBackupMobile();
                      setDataMenuOpen(false);
                    }}
                  >
                    모바일 공유/복사
                  </button>
                  {canInstallPwa && (
                    <button
                      className="btn"
                      onClick={() => {
                        onClickInstallPwa();
                        setDataMenuOpen(false);
                      }}
                    >
                      홈 화면 설치
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, background: "rgba(0,0,0,.18)" }}>
                    <SegTabButton active={importMode === "merge"} onClick={() => setImportMode("merge")}>병합</SegTabButton>
                    <SegTabButton active={importMode === "overwrite"} onClick={() => setImportMode("overwrite")}>덮어쓰기</SegTabButton>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      fileRef.current?.click();
                      setDataMenuOpen(false);
                    }}
                  >
                    JSON 파일 선택
                  </button>
                  <textarea
                    className="textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="모바일에서는 백업 JSON을 복사해서 여기에 붙여넣고 불러오세요."
                    style={{ minHeight: 100 }}
                  />
                  <button className="btn" onClick={onImportText}>
                    붙여넣기 불러오기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        <h1 style={{ margin: "0 0 4px" }}>애니 목록</h1>
        <p className="small" style={{ margin: 0, opacity: 0.82 }}>지금까지 본 애니를 추가하고 정렬하는 개인 라이브러리</p>
        <div style={{ marginTop: 6 }}>
          <span className="small" style={{ opacity: 0.9 }}>
            {backupReminder || "자동 로컬 백업이 켜져 있어요. 주기적으로 JSON 내보내기를 권장합니다."}
          </span>
        </div>
        {backupMsg && <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>{backupMsg}</div>}
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onPickImport}
      />

      <section style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", borderRadius: 5, padding: 12, marginBottom: 5 }}>
        <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.12)", borderRadius: 5, background: "rgba(0,0,0,.18)", width: "fit-content", marginBottom: 5 }}>
          <SegTabButton active={addTab === "search"} onClick={() => setAddTab("search")}>애니 검색</SegTabButton>
          <SegTabButton active={addTab === "recommend"} onClick={() => setAddTab("recommend")}>AI 추천</SegTabButton>
        </div>
        {addTab === "search" ? (
          <AddAnime items={items} setItems={setItems} />
        ) : (
          <div style={{ border: "1px dashed rgba(255,255,255,.2)", borderRadius: 5, padding: 12, margin: "14px 0px 10px", background: "rgba(255,255,255,.02)" }}>
            <div className="small" style={{ opacity: 0.9}}>
              추후 구현 예정: 시청기록 기반 추천
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid rgba(255,255,255,.1)",
          background: "rgba(255,255,255,.03)",
          borderRadius: 5,
          padding: 14,
          margin: "10px 0 5px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: statsOpen ? 10 : 0, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>통계 대시보드</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div className="small">
              총 {dashboard.total}개 · 평균 점수 {dashboard.averageScore == null ? "-" : `${dashboard.averageScore.toFixed(2)} / ${SCORE_MAX}`} ({dashboard.scored}개 채점)
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setStatsOpen((v) => !v)}
              aria-expanded={statsOpen}
              aria-controls="stats-board-content"
              aria-label={statsOpen ? "통계 대시보드 접기" : "통계 대시보드 펼치기"}
              title={statsOpen ? "접기" : "펼치기"}
              style={{ width: 34, height: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
                style={{
                  display: "block",
                  transition: "transform 160ms ease",
                  transform: statsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <path
                  d="M5.5 7.5L10 12l4.5-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {statsOpen && (
          <div id="stats-board-content" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 5, padding: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>상태별 분류</div>
              <StatBars rows={dashboard.statusRows} maxCount={dashboard.maxStatus} />
            </div>
            <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 5, padding: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>시청 장르 상위 5</div>
              <StatBars rows={dashboard.genreRows} maxCount={dashboard.maxGenre} />
            </div>
            <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 5, padding: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>정주행 TOP 5</div>
              {dashboard.rewatchRows.length === 0 ? (
                <div className="small">정주행 기록이 없습니다.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {dashboard.rewatchRows.map((row) => {
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          textAlign: "left",
                          padding: 0,
                          cursor: "pointer",
                        }}
                        title={`${row.title} · ${row.count}회`}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: 8, alignItems: "center" }}>
                          <div className="small" style={{ opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.title}
                          </div>
                          <div className="small" style={{ opacity: 0.95, textAlign: "right" }}>{row.count}회</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", borderRadius: 5, padding: 12, marginBottom: 5 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <select
            className="select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            style={{ width: "auto", minWidth: 160, flex: "1 1 200px" }}
          >
            <option value="addedAt">추가순</option>
            <option value="title">제목순</option>
            <option value="score">점수순</option>
            <option value="year">연도순</option>
            <option value="genre">장르순</option>
          </select>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: "auto", minWidth: 130, flex: "1 1 160px" }}
          >
            <option>전체</option>
            <option>완료</option>
            <option>보는중</option>
            <option>보류</option>
            <option>하차</option>
            <option>미분류</option>
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", marginLeft: "auto" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={groupByStatus} onChange={(e) => setGroupByStatus(e.target.checked)} />
              <span className="small">상태별 정렬</span>
            </label>
            <button className="btn" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? "오름차순" : "내림차순"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="라이브러리 검색 (제목/장르)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220, flex: "1 1 320px" }}
          />
          <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.10)", borderRadius: 5, background: "rgba(0,0,0,.18)", marginLeft: "auto", flex: "0 0 auto" }}>
            <SegTabButton active={cardView === "meta"} onClick={() => setCardView("meta")}>포스터/정보</SegTabButton>
            <SegTabButton active={cardView === "poster"} onClick={() => setCardView("poster")}>포스터</SegTabButton>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="small" style={{ whiteSpace: "nowrap", opacity: 0.85 }}>장르:</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, flex: 1 }}>
            <Chip active={genreSet.size === 0} onClick={clearGenres} title="장르 전체">전체</Chip>
            {genreOptions.map((g) => (
              <Chip key={g} active={genreSet.has(g)} onClick={() => toggleGenre(g)} title={g}>
                {genreKo(g)}
              </Chip>
            ))}
          </div>
          {genreSet.size > 0 && (
            <button type="button" className="btn" onClick={clearGenres} style={{ whiteSpace: "nowrap" }}>
              선택 해제({genreSet.size})
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <div className="small" style={{ whiteSpace: "nowrap", opacity: 0.85 }}>상태:</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, flex: 1 }}>
            {["전체", "완료", "보는중", "보류", "하차", "미분류"].map((s) => (
              <Chip
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
                title={`상태 ${s}`}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <div className="small" style={{ whiteSpace: "nowrap", opacity: 0.9, border: 0 }}>한 줄 포스터 수</div>
          <input
            type="range"
            min={2}
            max={10}
            step={1}
            value={Number(cardsPerRowBase) || 5}
            onChange={(e) => setCardsPerRowBase(Number(e.target.value))}
            style={{ width: 180 }}
            title="그리드 가로 수 조절"
          />
          <div className="small" style={{ opacity: 0.92 }}>
            기준 {Number(cardsPerRowBase) || 5} · 현재 {effectiveCols}열
          </div>
        </div>
      </section>

      <div
        ref={gridRef}
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
        }}
      >
        {filtered.map((it) => {
          const m = mediaMap.get(it.anilistId);
          const cardTitle = getTitle(it);
          const cardStatus = it.status || "미분류";
          const cardScore = normalizeScoreValue(it.score);
          const cardStarsFill = `${((cardScore ?? 0) / SCORE_MAX) * 100}%`;
          const gs = safeGenres(m);

          return (
            <div
              key={it.anilistId}
              className="card"
              onClick={() => setSelectedId(it.anilistId)}
              onKeyDown={(e) => onCardKeyDown(e, it.anilistId)}
              role="button"
              tabIndex={0}
              aria-label={`${cardTitle} 상세 열기`}
            >
              <img
                src={m?.coverImage?.large ?? undefined}
                alt={cardTitle}
                loading="lazy"
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {cardView === "meta" && (
                <div className="meta" style={{ padding: "8px 10px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      lineHeight: 1.25,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minHeight: "2.5em",
                    }}
                  >
                    {cardTitle}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      fontSize: 12,
                      opacity: 0.82,
                    }}
                  >
                    <span style={getStatusBadgeStyle(cardStatus)}>{cardStatus}</span>
                    <span
                      aria-label={cardScore == null ? "미평가" : `별점 ${cardScore} / ${SCORE_MAX}`}
                      style={{
                        marginLeft: "auto",
                        textAlign: "right",
                        position: "relative",
                        width: 62,
                        height: 14,
                        fontSize: 13,
                        letterSpacing: 1,
                        lineHeight: 1,
                        display: "inline-block",
                      }}
                    >
                      <span aria-hidden style={{ color: "rgba(255,255,255,.22)" }}>★★★★★</span>
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: cardStarsFill,
                          overflow: "hidden",
                          color: "#ffd76b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ★★★★★
                      </span>
                    </span>
                  </div>

                  <GenresRow
                    genres={gs}
                    max={3}
                    compact={true}
                    onPickGenre={onPickGenreFromTag}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          className="modalBack"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSelectedModal();
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modalCloseBtn"
              onClick={closeSelectedModal}
              aria-label="닫기"
            >
              X
            </button>
            <div className="modalBody">
              <div className="modalCover">
                <img src={selectedMedia?.coverImage?.large || ""} alt={selectedTitle} />
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedMedia?.siteUrl && (
                    <a className="btn" href={selectedMedia.siteUrl} target="_blank" rel="noreferrer">
                      AniList 열기
                    </a>
                  )}
                  <button className="removeBtn" onClick={() => removeAnime(selectedId)}>삭제</button>
                </div>
              </div>

              <div>
                <h2 style={{ margin: "6px 0 4px" }}>{selectedTitle}</h2>
                <div className="small">
                  {selectedMedia?.seasonYear ? `${selectedMedia.seasonYear} · ` : ""}
                  {selectedMedia?.format || ""}
                  {selectedMedia?.episodes ? ` · ${selectedMedia.episodes}화` : ""}
                </div>

                {/* 모달 장르 태그(전체, 클릭하면 필터) */}
                <GenresRow
                  genres={safeGenres(selectedMedia)}
                  max={999}
                  compact={false}
                  onPickGenre={onPickGenreFromTag}
                />

                <div className="row">
                  <div className="small">상태</div>
                  <select
                    className="select"
                    value={selected.status || "미분류"}
                    onChange={(e) => updateSelected({ status: e.target.value })}
                  >
                    <option>완료</option>
                    <option>보는중</option>
                    <option>보류</option>
                    <option>하차</option>
                    <option>미분류</option>
                  </select>
                </div>

                <div className="row">
                  <div className="small">점수</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div
                        style={{
                          position: "relative",
                          width: 132,
                          height: 24,
                          fontSize: 24,
                          letterSpacing: 2,
                          lineHeight: 1,
                          userSelect: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div aria-hidden style={{ color: "rgba(255,255,255,.22)" }}>★★★★★</div>
                        <div
                          aria-hidden
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: selectedStarsFill,
                            overflow: "hidden",
                            color: "#ffd76b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ★★★★★
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={SCORE_MAX}
                          step={SCORE_STEP}
                          value={selectedScore}
                          onChange={(e) => updateSelected({ score: Number(e.target.value) })}
                          onMouseMove={(e) => setHoverScore(getHoverScoreFromPointer(e))}
                          onMouseLeave={() => setHoverScore(null)}
                          aria-label="별점"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            opacity: 0,
                            margin: 0,
                            cursor: "pointer",
                          }}
                        />
                      </div>
                      <div className="small" style={{ opacity: 0.95, minWidth: 44 }}>
                        {selectedScoreLabel}
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setHoverScore(null);
                          updateSelected({ score: null });
                        }}
                        style={{ marginLeft: "auto", padding: "6px 10px" }}
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="small">정주행</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const nextCount = normalizeRewatchCount(rewatchCountDraft + 1);
                          const today = new Date().toISOString().slice(0, 10);
                          setRewatchCountDraft(nextCount);
                          setLastRewatchAtDraft(today);
                          updateSelected({ rewatchCount: nextCount, lastRewatchAt: today });
                        }}
                      >
                        정주행 완료!  +1
                      </button>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={1}
                        value={rewatchCountDraft}
                        onChange={(e) => setRewatchCountDraft(normalizeRewatchCount(e.target.value))}
                        onBlur={commitModalDraft}
                        style={{ width: 50, textAlign: "center" }}
                        aria-label="정주행 횟수"
                      />
                      
                      <input
                      className="input"
                      type="date"
                      value={lastRewatchAtDraft}
                      onChange={(e) => setLastRewatchAtDraft(e.target.value)}
                      onBlur={commitModalDraft}
                      style={{ width: 200 }}
                      aria-label="마지막 정주행 날짜"
                      />
                    </div>


                  </div>
                </div>
                <div className="row">
                    <div className="small">메모</div>
                    <textarea
                      className="textarea"
                      value={memoDraft}
                      onChange={(e) => setMemoDraft(e.target.value)}
                      onBlur={commitModalDraft}
                      placeholder="보고 난 뒤 한 줄 메모.."
                    />
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="small" style={{ marginBottom: 8 }}>캐릭터</div>
                  {selectedCharacters.length === 0 ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      캐릭터 정보를 아직 가져오지 못했습니다.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                      {selectedCharacters.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: 40,
                            background: "rgba(255,255,255,.03)",
                            padding: 7,
                            minWidth: 0,
                          }}
                        >
                          {c.image ? (
                            <img
                              src={c.image}
                              alt={c.name}
                              loading="lazy"
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              aria-hidden
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,.1)",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={c.name}
                            >
                              {c.name}
                            </div>
                            {c.subName && (
                              <div
                                className="small"
                                style={{
                                  opacity: 0.8,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={c.subName}
                              >
                                {c.subName}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


