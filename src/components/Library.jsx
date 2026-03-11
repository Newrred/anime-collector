import { useEffect, useMemo, useRef, useState } from "react";
import myListSeed from "../data/myAnime.json";
import aliasSeed from "../data/aliases.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import AddAnime from "./AddAnime.jsx";
import {
  clamp,
  dedupeByAnilistId,
  mergeTierState,
  normalizeImportList,
  normalizeItem,
  normalizeRewatchCount,
  normalizeRewatchDate,
  normalizeScoreValue,
  normalizeTierState,
  sameItem,
  SCORE_MAX,
  SCORE_STEP,
} from "../domain/animeState";
import { useStoredState } from "../hooks/useStoredState";
import { STORAGE_KEYS } from "../storage/keys";
import { readTierState, writeTierState, pruneTierByAnimeId } from "../repositories/tierRepo";
import { readLibraryListPreferred, writeLibraryList } from "../repositories/libraryRepo";
import {
  markManualBackupExported,
  readLastExportAtMs,
  writeAutoBackupSnapshot,
} from "../repositories/backupRepo";
import {
  appendWatchLog,
  buildWatchedRange,
  createWatchLog,
  listWatchLogsByAnimeId,
  mergeWatchLogs,
  readAllWatchLogsSnapshot,
  replaceWatchLogs,
  updateWatchLog,
} from "../repositories/watchLogRepo";
import {
  listCharacterPinsPreferred,
  mergeCharacterPins,
  readCharacterPinsSnapshot,
  removeCharacterPin,
  replaceCharacterPins,
  upsertCharacterPin,
} from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import { wikidataGetKoTitlesByAniListIds } from "../lib/wikidata";
import TopNavDataMenu from "./TopNavDataMenu.jsx";

function firstHangulSynonym(media) {
  const arr = media?.synonyms;
  if (!Array.isArray(arr)) return null;
  return arr.find((s) => /[\uAC00-\uD7A3]/.test(String(s || ""))) || null;
}

function deriveKoTitleFromMedia(media) {
  const synKo = firstHangulSynonym(media);
  if (synKo) return synKo;
  const nativeTitle = String(media?.title?.native || "").trim();
  if (isHangulText(nativeTitle)) return nativeTitle;
  return null;
}

function pickCardTitle(item, media) {
  if (item?.koTitle) return item.koTitle;

  const derivedKo = deriveKoTitleFromMedia(media);
  if (derivedKo) return derivedKo;

  return (
    media?.title?.native ||
    media?.title?.english ||
    media?.title?.romaji ||
    (item?.anilistId ? `#${item.anilistId}` : "Unknown")
  );
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

const BACKUP_REMIND_DAYS = 7;
const AFFINITY_OPTIONS = ["최애", "기억남음", "불호지만강렬"];
const REASON_TAG_OPTIONS = ["성장", "관계성", "대사", "연출", "디자인", "성우", "기타"];
const AFFINITY_LABELS = {
  최애: "최애",
  기억남음: "인상 깊었음",
  불호지만강렬: "불호인데 강렬함",
};
const REASON_TAG_LABELS = {
  성장: "서사",
  관계성: "관계성",
  대사: "대사",
  연출: "연출",
  디자인: "비주얼",
  성우: "성우연기",
  기타: "기타",
};
const SEASON_TERM_OPTIONS = ["Spring", "Summer", "Fall", "Winter"];
const STATUS_UNCLASSIFIED = "\uBBF8\uBD84\uB958";
const STATUS_WATCHING = "\uBCF4\uB294\uC911";
const STATUS_HOLD = "\uBCF4\uB958";
const STATUS_COMPLETED = "\uC644\uB8CC";
const STATUS_DROPPED = "\uD558\uCC28";
const EVENT_START = "\uC2DC\uC791";
const EVENT_COMPLETE = "\uC644\uB8CC";
const EVENT_REWATCH = "\uC7AC\uC2DC\uCCAD";
const EVENT_DROP = "\uD558\uCC28";

function formatLocalDate(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeStatusValue(rawStatus) {
  const value = String(rawStatus || "").trim();
  if (value === STATUS_WATCHING) return STATUS_WATCHING;
  if (value === STATUS_HOLD) return STATUS_HOLD;
  if (value === STATUS_COMPLETED) return STATUS_COMPLETED;
  if (value === STATUS_DROPPED) return STATUS_DROPPED;
  return STATUS_UNCLASSIFIED;
}

function eventTypeFromStatus(status) {
  if (status === STATUS_WATCHING) return EVENT_START;
  if (status === STATUS_COMPLETED) return EVENT_COMPLETE;
  if (status === STATUS_DROPPED) return EVENT_DROP;
  return null;
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

function formatWatchLogDate(log) {
  const value = String(log?.watchedAtValue || "").trim();
  if (value) return value;
  const createdAt = Number(log?.createdAt);
  if (!Number.isFinite(createdAt)) return "날짜 잘 모름";
  return new Date(createdAt).toISOString().slice(0, 10);
}

function affinityLabel(value) {
  return AFFINITY_LABELS[String(value || "").trim()] || String(value || "").trim() || "인상 깊었음";
}

function reasonTagLabel(value) {
  return REASON_TAG_LABELS[String(value || "").trim()] || String(value || "").trim();
}

function parseSeasonValue(value) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(Spring|Summer|Fall|Winter)$/i);
  if (!m) return null;
  return { year: m[1], term: `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}` };
}

function normalizeQuickLogPrecision(raw) {
  const p = String(raw || "").toLowerCase();
  if (["day", "month", "season", "year", "unknown"].includes(p)) return p;
  return "day";
}

function defaultQuickLogValue(precision) {
  const nowIso = formatLocalDate(new Date());
  if (precision === "day") return nowIso;
  if (precision === "month") return nowIso.slice(0, 7);
  if (precision === "year") return nowIso.slice(0, 4);
  if (precision === "season") return `${nowIso.slice(0, 4)}-Spring`;
  return "";
}

function coerceQuickLogValue(precision, rawValue) {
  const raw = String(rawValue || "").trim();
  if (precision === "day") {
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : defaultQuickLogValue("day");
  }
  if (precision === "month") {
    return /^\d{4}-\d{2}$/.test(raw) ? raw : defaultQuickLogValue("month");
  }
  if (precision === "year") {
    return /^\d{4}$/.test(raw) ? raw : defaultQuickLogValue("year");
  }
  if (precision === "season") {
    const season = parseSeasonValue(raw);
    const year = season?.year || defaultQuickLogValue("year");
    const term = season?.term || "Spring";
    return `${year}-${term}`;
  }
  return "";
}

function buildQuickLogInputByPrecision(draft) {
  const precision = normalizeQuickLogPrecision(draft?.watchedAtPrecision);
  const raw = String(draft?.watchedAtValue || "").trim();

  if (precision === "day") {
    return { precision, value: coerceQuickLogValue("day", raw) };
  }
  if (precision === "month") {
    return { precision, value: coerceQuickLogValue("month", raw) };
  }
  if (precision === "year") {
    return { precision, value: coerceQuickLogValue("year", raw) };
  }
  if (precision === "season") {
    return { precision, value: coerceQuickLogValue("season", raw) };
  }
  return { precision: "unknown", value: "" };
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

const RELATION_TYPE_KO = {
  ADAPTATION: "원작 연계",
  PREQUEL: "전편",
  SEQUEL: "속편",
  PARENT: "본편",
  SIDE_STORY: "외전",
  CHARACTER: "캐릭터",
  SUMMARY: "총집편",
  ALTERNATIVE: "대체 설정",
  SPIN_OFF: "스핀오프",
  OTHER: "기타",
  SOURCE: "원작",
  COMPILATION: "편집본",
  CONTAINS: "포함",
};

const ANIME_MEDIA_FORMATS = new Set([
  "TV",
  "TV_SHORT",
  "MOVIE",
  "SPECIAL",
  "OVA",
  "ONA",
  "MUSIC",
]);

function relationTypeKo(type) {
  const key = String(type || "").trim();
  if (!key) return "연관";
  return RELATION_TYPE_KO[key] || key.replace(/_/g, " ").toLowerCase();
}

function isAnimeMediaFormat(format) {
  const key = String(format || "").trim().toUpperCase();
  return ANIME_MEDIA_FORMATS.has(key);
}

function pickMediaTitle(media) {
  const synKo = firstHangulSynonym(media);
  if (synKo) return synKo;
  const nativeTitle = String(media?.title?.native || "").trim();
  const englishTitle = String(media?.title?.english || "").trim();
  const romajiTitle = String(media?.title?.romaji || "").trim();
  if (isHangulText(nativeTitle)) return nativeTitle;
  return nativeTitle || englishTitle || romajiTitle || (Number.isFinite(Number(media?.id)) ? `#${media.id}` : "Unknown");
}

function getRelatedSeriesRows(media, currentId, limit = 12) {
  const edges = media?.relations?.edges;
  if (!Array.isArray(edges)) return [];

  const current = Number(currentId);
  const seen = new Set();
  const out = [];
  for (const edge of edges) {
    const node = edge?.node;
    const id = Number(node?.id);
    if (!Number.isFinite(id)) continue;
    if (Number.isFinite(current) && id === current) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const seasonYear = Number(node?.seasonYear);
    const episodes = Number(node?.episodes);
    out.push({
      id,
      relationType: String(edge?.relationType || ""),
      relationLabel: relationTypeKo(edge?.relationType),
      title: pickMediaTitle(node),
      siteUrl: String(node?.siteUrl || ""),
      cover: node?.coverImage?.large || "",
      seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
      format: String(node?.format || ""),
      episodes: Number.isFinite(episodes) && episodes > 0 ? episodes : null,
      media: node,
    });

    if (out.length >= limit) break;
  }
  return out;
}

function buildAliasKoTitleMap(seed) {
  const out = new Map();
  if (!Array.isArray(seed)) return out;

  for (const row of seed) {
    const id = Number(row?.anilistId);
    if (!Number.isFinite(id) || out.has(id)) continue;

    const ko = String(row?.ko || "").trim();
    if (ko) {
      out.set(id, ko);
      continue;
    }

    const aliases = Array.isArray(row?.aliases) ? row.aliases : [];
    const koAlias = aliases
      .map((v) => String(v || "").trim())
      .find((v) => v && /[\uAC00-\uD7A3]/.test(v));
    if (koAlias) out.set(id, koAlias);
  }

  return out;
}

const ALIAS_KO_TITLE_MAP = buildAliasKoTitleMap(aliasSeed);

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
  const [items, setItems] = useStoredState(STORAGE_KEYS.list, myListSeed);
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
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [characterPins, setCharacterPins] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogDraft, setQuickLogDraft] = useState(null);
  const [quickLogCandidates, setQuickLogCandidates] = useState([]);
  const [quickLogCharacterIds, setQuickLogCharacterIds] = useState([]);
  const [quickLogPrimaryCharacterId, setQuickLogPrimaryCharacterId] = useState(null);
  const [quickLogCharacterMeta, setQuickLogCharacterMeta] = useState({});
  const [quickLogContext, setQuickLogContext] = useState(null);
  const [relatedKoTitleById, setRelatedKoTitleById] = useState({});

  const [backupMsg, setBackupMsg] = useState("");
  const [backupReminder, setBackupReminder] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [addTab, setAddTab] = useState("search"); // search | recommend
  const [cardView, setCardView] = useState("meta"); // meta | poster
  const [cardsPerRowBase, setCardsPerRowBase] = useStoredState(STORAGE_KEYS.cardsPerRowBase, 5);
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const preferred = await readLibraryListPreferred(myListSeed).catch(() => null);
      if (!alive || !Array.isArray(preferred)) return;

      setItems((prev) => {
        const source = Array.isArray(prev) ? prev : [];
        const next = dedupeByAnilistId(
          preferred.map((it, idx) =>
            normalizeItem(
              it,
              Number.isFinite(Number(it?.addedAt)) ? Number(it.addedAt) : idx
            )
          )
        );

        if (
          source.length === next.length &&
          next.every((it, idx) => sameItem(it, source[idx]))
        ) {
          return prev;
        }
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [setItems]);

  useEffect(() => {
    writeLibraryList(items, { mirrorOnly: true });
  }, [items]);

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
    const tier = readTierState(null);

    return {
      app: "ani-site",
      version: 3,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(items),
      tier,
      watchLogs: readAllWatchLogsSnapshot(),
      characterPins: readCharacterPinsSnapshot(),
      preferences: {
        cardsPerRowBase,
        cardView,
      },
    };
  }

  function markBackupExported(message) {
    markManualBackupExported(new Date().toISOString());
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
          title: "애니 보관함 백업",
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
          title: "애니 보관함 백업(JSON)",
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
      const ok = window.confirm("지금 보관함 데이터를 모두 바꾸고 불러올까요?");
      if (!ok) return;
      setItems(incomingNormalized);
    } else {
      setItems((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingTier) {
      const currentTier = readTierState(null);
      const nextTier = isOverwrite
        ? normalizeTierState(incomingTier)
        : mergeTierState(currentTier, incomingTier);
      writeTierState(nextTier);
    }

    const incomingLogs = !Array.isArray(json) ? json?.watchLogs : null;
    if (Array.isArray(incomingLogs)) {
      if (isOverwrite) {
        await replaceWatchLogs(incomingLogs);
      } else {
        await mergeWatchLogs(incomingLogs);
      }
      if (selectedId) {
        const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
        setSelectedLogs(Array.isArray(rows) ? rows : []);
      }
    } else if (isOverwrite) {
      await replaceWatchLogs([]);
      setSelectedLogs([]);
    }

    const incomingPins = !Array.isArray(json) ? json?.characterPins : null;
    if (Array.isArray(incomingPins)) {
      if (isOverwrite) {
        await replaceCharacterPins(incomingPins);
      } else {
        await mergeCharacterPins(incomingPins);
      }
      refreshCharacterPins();
    } else if (isOverwrite) {
      await replaceCharacterPins([]);
      refreshCharacterPins();
    }

    const incomingPrefs = !Array.isArray(json) ? json?.preferences : null;
    if (incomingPrefs && typeof incomingPrefs === "object") {
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardsPerRowBase")) {
        setCardsPerRowBase(incomingPrefs.cardsPerRowBase);
      }
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardView")) {
        const cv = String(incomingPrefs.cardView || "");
        if (cv === "meta" || cv === "poster") setCardView(cv);
      }
    }

    setBackupMsg(
      isOverwrite
        ? "불러오기 완료! 지금 보관함 데이터로 교체했어요."
        : "불러오기 완료! 기존 보관함 뒤에 이어서 합쳤어요."
    );
    setSelectedId(null);
  }

  async function importBackup(file, mode = "merge") {
    const text = await file.text();
    const json = JSON.parse(text);
    await importBackupFromJson(json, mode);
  }

  async function importBackupText(rawText, mode = "merge") {
    const raw = String(rawText || "").trim();
    if (!raw) {
      setBackupMsg("붙여넣은 JSON 텍스트가 비어 있어요.");
      return;
    }

    try {
      const json = JSON.parse(raw);
      await importBackupFromJson(json, mode);
    } catch (err) {
      console.error(err);
      setBackupMsg(`붙여넣기 가져오기 실패: ${err?.message || "알 수 없는 오류"}`);
      throw err;
    }
  }

  async function importBackupFile(file, mode = "merge") {
    try {
      await importBackup(file, mode);
    } catch (err) {
      console.error(err);
      setBackupMsg(`가져오기 실패: ${err?.message || "알 수 없는 오류"}`);
      throw err;
    }
  }

  const ids = useMemo(() => items.map((x) => x.anilistId), [items]);

  useEffect(() => {
    setItems((prev) => dedupeByAnilistId(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = Number(params.get("animeId"));
    if (!Number.isFinite(fromQuery)) {
      deepLinkHandledRef.current = true;
      return;
    }

    const exists = items.some((x) => Number(x?.anilistId) === fromQuery);
    if (!exists) return;

    setSelectedId(fromQuery);
    deepLinkHandledRef.current = true;
  }, [items]);

  useEffect(() => {
    setMediaMap(getCachedAnimeMap(ids));

    let alive = true;
    (async () => {
      const map = await fetchAnimeByIdsCached(ids, { includeCharacters: false });
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
    if (!items.length) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (String(item?.koTitle || "").trim()) return item;
        const id = Number(item?.anilistId);
        const aliasKo = Number.isFinite(id) ? String(ALIAS_KO_TITLE_MAP.get(id) || "").trim() : "";
        const media = mediaMap.get(id);
        const koTitle = aliasKo || deriveKoTitleFromMedia(media);
        if (!koTitle) return item;
        changed = true;
        return { ...item, koTitle };
      });
      return changed ? next : prev;
    });
  }, [items.length, mediaMap, setItems]);

  useEffect(() => {
    const tier = readTierState(null);
    const snapshot = {
      app: "ani-site",
      version: 1,
      savedAt: new Date().toISOString(),
      list: items,
      tier,
    };
    writeAutoBackupSnapshot(snapshot);
  }, [items]);

  useEffect(() => {
    const last = readLastExportAtMs();
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
    const ok = window.confirm("이 작품을 보관함에서 삭제할까요?\n(점수/메모 포함된 모든 데이터가 사라집니다)");
    if (!ok) return;

    setItems((prev) => prev.filter((x) => x.anilistId !== id));
    pruneTierByAnimeId(id);
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
  const selectedRelatedSeries = useMemo(
    () => getRelatedSeriesRows(selectedMedia, selectedId, 12),
    [selectedMedia, selectedId]
  );
  const itemKoTitleMap = useMemo(() => {
    const m = new Map();
    for (const item of items) {
      const id = Number(item?.anilistId);
      if (!Number.isFinite(id)) continue;
      const koTitle = String(item?.koTitle || "").trim();
      if (koTitle) m.set(id, koTitle);
    }
    return m;
  }, [items]);
  const libraryIdSet = useMemo(
    () => new Set(items.map((x) => Number(x?.anilistId)).filter(Number.isFinite)),
    [items]
  );
  const pinnedCharacterKeySet = useMemo(() => {
    const s = new Set();
    for (const pin of Array.isArray(characterPins) ? characterPins : []) {
      const cid = Number(pin?.characterId);
      const mid = Number(pin?.mediaId);
      if (!Number.isFinite(cid) || !Number.isFinite(mid)) continue;
      s.add(`${cid}:${mid}`);
    }
    return s;
  }, [characterPins]);
  const quickLogAnime = quickLogDraft
    ? items.find((x) => x.anilistId === Number(quickLogDraft.anilistId)) || null
    : null;
  const quickLogMedia = quickLogDraft ? mediaMap.get(Number(quickLogDraft.anilistId)) : null;
  const quickLogTitle = quickLogDraft ? pickCardTitle(quickLogAnime, quickLogMedia) : "";
  const quickLogSelectedCharacters = useMemo(() => {
    const ids = Array.isArray(quickLogCharacterIds)
      ? quickLogCharacterIds.map((x) => Number(x)).filter(Number.isFinite).slice(0, 3)
      : [];
    if (!ids.length) return [];
    const byId = new Map(
      (Array.isArray(quickLogCandidates) ? quickLogCandidates : []).map((c) => [Number(c.id), c])
    );
    return ids.map((id) => byId.get(id) || { id, name: `#${id}`, image: "", role: "" });
  }, [quickLogCandidates, quickLogCharacterIds]);
  const quickLogPrimaryCharacterIdSafe = useMemo(() => {
    const id = Number(quickLogPrimaryCharacterId);
    if (!Number.isFinite(id)) return null;
    return quickLogSelectedCharacters.some((c) => Number(c.id) === id) ? id : null;
  }, [quickLogPrimaryCharacterId, quickLogSelectedCharacters]);

  useEffect(() => {
    let alive = true;
    if (!selectedId) {
      setSelectedLogs([]);
      setLogsLoading(false);
      return undefined;
    }

    setLogsLoading(true);
    listWatchLogsByAnimeId(selectedId)
      .then((rows) => {
        if (!alive) return;
        setSelectedLogs(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!alive) return;
        setSelectedLogs([]);
      })
      .finally(() => {
        if (!alive) return;
        setLogsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const id = Number(selectedId);
    if (!Number.isFinite(id)) return undefined;

    const media = mediaMap.get(id);
    const hasCharacters = Array.isArray(media?.characters?.edges);
    const hasRelations = Array.isArray(media?.relations?.edges);
    if (hasCharacters && hasRelations) return undefined;

    let alive = true;
    fetchAnimeByIdsCached([id], { includeCharacters: true, includeRelations: true })
      .then((map) => {
        if (!alive) return;
        const full = map.get(id);
        if (!full) return;
        setMediaMap((prev) => {
          const current = prev.get(id);
          const currentHasCharacters = Array.isArray(current?.characters?.edges);
          const currentHasRelations = Array.isArray(current?.relations?.edges);
          if (currentHasCharacters && currentHasRelations) return prev;
          const next = new Map(prev);
          next.set(id, full);
          return next;
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [selectedId, mediaMap]);

  useEffect(() => {
    const ids = selectedRelatedSeries
      .map((row) => Number(row?.id))
      .filter(Number.isFinite);
    if (!ids.length) return undefined;

    const need = ids.filter((id) => {
      const existingKo = String(relatedKoTitleById[id] || "").trim();
      if (existingKo) return false;
      if (itemKoTitleMap.has(id)) return false;
      if (ALIAS_KO_TITLE_MAP.has(id)) return false;

      const media = mediaMap.get(id) || selectedRelatedSeries.find((row) => Number(row?.id) === id)?.media;
      return !deriveKoTitleFromMedia(media);
    });
    if (!need.length) return undefined;

    let alive = true;
    wikidataGetKoTitlesByAniListIds(need)
      .then((koMap) => {
        if (!alive) return;
        if (!(koMap instanceof Map) || koMap.size === 0) return;

        setRelatedKoTitleById((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [rawId, rawTitle] of koMap.entries()) {
            const id = Number(rawId);
            const title = String(rawTitle || "").trim();
            if (!Number.isFinite(id) || !title) continue;
            if (next[id] === title) continue;
            next[id] = title;
            changed = true;
          }
          return changed ? next : prev;
        });

        setItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (String(item?.koTitle || "").trim()) return item;
            const id = Number(item?.anilistId);
            if (!Number.isFinite(id)) return item;
            const title = String(koMap.get(id) || "").trim();
            if (!title) return item;
            changed = true;
            return { ...item, koTitle: title };
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [selectedRelatedSeries, relatedKoTitleById, itemKoTitleMap, mediaMap, setItems]);

  function refreshCharacterPins() {
    const rows = readCharacterPinsSnapshot();
    setCharacterPins(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    refreshCharacterPins();
    listCharacterPinsPreferred()
      .then((rows) => {
        setCharacterPins(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
  }, []);

  async function ensureQuickLogCharacters(anilistId, fallbackMedia = null) {
    const id = Number(anilistId);
    if (!Number.isFinite(id)) {
      setQuickLogCandidates([]);
      return;
    }

    const pickFromMedia = (media) => getCharacterRows(media, 8);

    const fromFallback = fallbackMedia ? pickFromMedia(fallbackMedia) : [];
    if (fromFallback.length) {
      setQuickLogCandidates(fromFallback);
      return;
    }

    const existing = mediaMap.get(id);
    const fromExisting = pickFromMedia(existing);
    if (fromExisting.length) {
      setQuickLogCandidates(fromExisting);
      return;
    }

    try {
      const map = await fetchAnimeByIdsCached([id], { includeCharacters: true });
      const media = map.get(id);
      if (media) {
        setMediaMap((prev) => {
          const next = new Map(prev);
          next.set(id, media);
          return next;
        });
      }
      setQuickLogCandidates(pickFromMedia(media));
    } catch {
      setQuickLogCandidates([]);
    }
  }

  function openQuickLogSheet(log, fallbackMedia = null, context = null) {
    if (!log) return;
    const precision = normalizeQuickLogPrecision(log.watchedAtPrecision || "day");
    const value = coerceQuickLogValue(precision, log.watchedAtValue);

    const existingRefs = Array.isArray(log.characterRefs) ? log.characterRefs : [];
    const existingIds = Array.isArray(log.characterIds)
      ? log.characterIds.map((x) => Number(x)).filter(Number.isFinite)
      : existingRefs.map((x) => Number(x?.characterId)).filter(Number.isFinite);
    const existingPrimary = Number(
      existingRefs.find((x) => x?.isPrimary === true)?.characterId
    );
    const primaryId = Number.isFinite(existingPrimary) ? existingPrimary : null;
    const initialIds = existingIds.slice(0, 3);
    if (Number.isFinite(primaryId) && !initialIds.includes(primaryId)) {
      initialIds.unshift(primaryId);
    }
    const compactIds = [...new Set(initialIds)].slice(0, 3);
    const resolvedPrimaryId = Number.isFinite(primaryId)
      ? primaryId
      : compactIds.length
        ? compactIds[0]
        : null;
    const nextMeta = {};
    for (const id of existingIds) {
      const ref = existingRefs.find((x) => Number(x?.characterId) === id);
      nextMeta[id] = {
        affinity: ref?.affinity || "기억남음",
        reasonTags: Array.isArray(ref?.reasonTags) ? ref.reasonTags.filter(Boolean) : [],
        note: String(ref?.note || ""),
      };
    }

    setQuickLogDraft({
      logId: log.id,
      anilistId: log.anilistId,
      eventType: log.eventType,
      watchedAtPrecision: precision,
      watchedAtValue: value,
      cue: String(log.cue || "").slice(0, 120),
      note: String(log.note || ""),
    });
    setQuickLogCharacterIds(compactIds);
    setQuickLogPrimaryCharacterId(resolvedPrimaryId);
    setQuickLogCharacterMeta(nextMeta);
    setQuickLogContext(context && typeof context === "object" ? context : null);
    setQuickLogOpen(true);
    ensureQuickLogCharacters(log.anilistId, fallbackMedia).catch(() => {});
  }

  function closeQuickLogSheet() {
    setQuickLogOpen(false);
    setQuickLogDraft(null);
    setQuickLogCandidates([]);
    setQuickLogCharacterIds([]);
    setQuickLogPrimaryCharacterId(null);
    setQuickLogCharacterMeta({});
    setQuickLogContext(null);
  }

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

  function appendSelectedWatchLog(eventType, overrides = {}, options = {}) {
    if (!selectedId) return Promise.resolve(null);
    const today = formatLocalDate(new Date());
    const log = createWatchLog({
      anilistId: selectedId,
      eventType,
      watchedAtPrecision: "day",
      watchedAtValue: today,
      cue: overrides.cue || "",
      note: overrides.note || "",
      scoreAtThatTime: selectedScoreRaw ?? null,
      contextTags: overrides.contextTags || [],
      characterIds: [],
      characterRefs: [],
    });
    return appendWatchLog(log)
      .then((saved) => listWatchLogsByAnimeId(selectedId).then((rows) => ({ saved, rows })))
      .then(({ saved, rows }) => {
        if (options?.openQuickSheet && saved) {
          openQuickLogSheet(saved, selectedMedia || null, options?.quickContext || null);
        }
        return { saved, rows };
      })
      .then(({ rows, saved }) => {
        setSelectedLogs(Array.isArray(rows) ? rows : []);
        return saved;
      })
      .catch(() => {
        setBackupMsg("\uB85C\uADF8 \uC800\uC7A5 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
        return null;
      });
  }

  function onAddAnimeFromSearch(addedItem, addedMedia, options = {}) {
    const id = Number(addedItem?.anilistId);
    if (!Number.isFinite(id)) return;

    const initialStatus = normalizeStatusValue(options?.initialStatus || addedItem?.status);
    const eventType = eventTypeFromStatus(initialStatus);
    if (!eventType) return;

    const today = formatLocalDate(new Date());
    const cueByStatus = {
      [STATUS_WATCHING]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uBCF4\uB294\uC911 \uC0C1\uD0DC\uB85C \uCD94\uAC00",
      [STATUS_COMPLETED]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uC644\uB8CC \uC0C1\uD0DC\uB85C \uCD94\uAC00",
      [STATUS_DROPPED]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uD558\uCC28 \uC0C1\uD0DC\uB85C \uCD94\uAC00",
    };
    const log = createWatchLog({
      anilistId: id,
      eventType,
      watchedAtPrecision: "day",
      watchedAtValue: today,
      cue: cueByStatus[initialStatus] || "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uCD94\uAC00",
      note: "",
      scoreAtThatTime: null,
      contextTags: ["\uCD94\uAC00", "\uCD08\uAE30\uC0C1\uD0DC"],
      characterIds: [],
      characterRefs: [],
    });
    const quickContext = {
      source:
        initialStatus === STATUS_COMPLETED
          ? "add-completed"
          : initialStatus === STATUS_DROPPED
            ? "add-dropped"
            : "add-watching",
      isAuto: true,
      status: initialStatus,
    };
    const shouldOpenQuickSheet =
      initialStatus === STATUS_COMPLETED || initialStatus === STATUS_DROPPED;

    appendWatchLog(log)
      .then((saved) => {
        if (!saved) return;
        if (shouldOpenQuickSheet) {
          openQuickLogSheet(saved, addedMedia || null, quickContext);
        }
      })
      .catch(() => {
        setBackupMsg("\uCD08\uAE30 \uC0C1\uD0DC \uB85C\uADF8 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      });
  }

  function onSelectedStatusChange(nextStatus) {
    const normalizedNext = normalizeStatusValue(nextStatus);
    const prevStatus = normalizeStatusValue(selected?.status);
    updateSelected({ status: normalizedNext });

    if (normalizedNext === prevStatus) return;
    const eventType = eventTypeFromStatus(normalizedNext);
    if (!eventType) return;
    appendSelectedWatchLog(eventType, {
      cue: `\uC0C1\uD0DC \uBCC0\uACBD: ${prevStatus} -> ${normalizedNext}`,
    }, {
      openQuickSheet: true,
      quickContext: { source: "status-change", isAuto: true, status: normalizedNext },
    });
  }

  function addRelatedSeriesToLibrary(row) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    if (!isAnimeMediaFormat(row?.format)) {
      setBackupMsg("애니 형식이 아닌 항목은 보관함에 추가하지 않습니다.");
      return;
    }
    if (libraryIdSet.has(id)) {
      setSelectedId(id);
      return;
    }

    const derivedKoTitle =
      String(ALIAS_KO_TITLE_MAP.get(id) || "").trim() ||
      String(relatedKoTitleById[id] || "").trim() ||
      deriveKoTitleFromMedia(row?.media);

    const nextItem = normalizeItem({
      anilistId: id,
      koTitle: derivedKoTitle,
      status: STATUS_UNCLASSIFIED,
      score: null,
      memo: "",
      rewatchCount: 0,
      lastRewatchAt: null,
      addedAt: Date.now(),
    });
    setItems((prev) => dedupeByAnilistId([...prev, nextItem]));
    if (row?.media && typeof row.media === "object") {
      setMediaMap((prev) => {
        const next = new Map(prev);
        const previousMedia = next.get(id) || {};
        next.set(id, { ...previousMedia, ...row.media });
        return next;
      });
    }
    setSelectedId(id);
    setBackupMsg("관련 시리즈를 보관함에 추가하고 상세를 열었습니다.");
  }

  function toggleQuickLogCharacter(characterId) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    setQuickLogCharacterIds((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const exists = arr.includes(id);
      if (exists) {
        setQuickLogCharacterMeta((metaPrev) => {
          const next = { ...metaPrev };
          delete next[id];
          return next;
        });
        const nextIds = arr.filter((x) => x !== id);
        setQuickLogPrimaryCharacterId((prevPrimary) => {
          const cur = Number(prevPrimary);
          if (Number.isFinite(cur) && cur !== id && nextIds.includes(cur)) return cur;
          return nextIds.length ? nextIds[0] : null;
        });
        return nextIds;
      }
      if (arr.length >= 3) return arr;
      setQuickLogCharacterMeta((metaPrev) => ({
        ...metaPrev,
        [id]: metaPrev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" },
      }));
      const nextIds = [...arr, id];
      setQuickLogPrimaryCharacterId((prevPrimary) =>
        Number.isFinite(Number(prevPrimary)) ? Number(prevPrimary) : id
      );
      return nextIds;
    });
  }

  function setQuickLogPrimaryCharacter(characterId) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    if (!Array.isArray(quickLogCharacterIds) || !quickLogCharacterIds.includes(id)) return;
    setQuickLogPrimaryCharacterId(id);
  }

  function setQuickLogPrecision(nextPrecisionRaw) {
    const nextPrecision = normalizeQuickLogPrecision(nextPrecisionRaw);
    setQuickLogDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        watchedAtPrecision: nextPrecision,
        watchedAtValue: coerceQuickLogValue(nextPrecision, prev.watchedAtValue),
      };
    });
  }

  function setQuickLogCharacterAffinity(characterId, affinity) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    const value = AFFINITY_OPTIONS.includes(affinity) ? affinity : "기억남음";
    setQuickLogCharacterMeta((prev) => ({
      ...prev,
      [id]: {
        affinity: value,
        reasonTags: Array.isArray(prev?.[id]?.reasonTags) ? prev[id].reasonTags : [],
        note: String(prev?.[id]?.note || ""),
      },
    }));
  }

  function toggleQuickLogReasonTag(characterId, tag) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    const safeTag = String(tag || "").trim();
    if (!safeTag) return;
    setQuickLogCharacterMeta((prev) => {
      const cur = prev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" };
      const curTags = Array.isArray(cur.reasonTags) ? cur.reasonTags : [];
      const exists = curTags.includes(safeTag);
      const nextTags = exists ? curTags.filter((x) => x !== safeTag) : [...curTags, safeTag];
      return {
        ...prev,
        [id]: {
          affinity: cur.affinity || "기억남음",
          reasonTags: nextTags.slice(0, 3),
          note: String(cur.note || ""),
        },
      };
    });
  }

  function setQuickLogCharacterNote(characterId, note) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    setQuickLogCharacterMeta((prev) => {
      const cur = prev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" };
      return {
        ...prev,
        [id]: {
          affinity: cur.affinity || "기억남음",
          reasonTags: Array.isArray(cur.reasonTags) ? cur.reasonTags.slice(0, 3) : [],
          note: String(note || "").slice(0, 200),
        },
      };
    });
  }

  async function deleteSelectedWatchLog(logId) {
    const key = String(logId || "").trim();
    if (!key) return;
    const ok = window.confirm("이 감상 기록을 삭제할까요?");
    if (!ok) return;

    try {
      const all = readAllWatchLogsSnapshot();
      const next = Array.isArray(all) ? all.filter((row) => String(row?.id || "") !== key) : [];
      await replaceWatchLogs(next);
      const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
      setSelectedLogs(Array.isArray(rows) ? rows : []);
      if (quickLogDraft?.logId && String(quickLogDraft.logId) === key) closeQuickLogSheet();
      setBackupMsg("감상 기록을 삭제했습니다.");
    } catch {
      setBackupMsg("감상 기록 삭제 중 오류가 발생했습니다.");
    }
  }

  async function saveQuickLogDraft() {
    if (!quickLogDraft?.logId || !Number.isFinite(Number(quickLogDraft?.anilistId))) {
      closeQuickLogSheet();
      return;
    }

    const watchedInput = buildQuickLogInputByPrecision(quickLogDraft);
    const watchedMeta = buildWatchedRange(
      watchedInput.value,
      watchedInput.precision,
      Date.now()
    );

    const selectedRefs = quickLogSelectedCharacters
      .slice(0, 3)
      .map((c, idx) => ({
        characterId: Number(c.id),
        mediaId: Number(quickLogDraft.anilistId),
        order: idx,
        nameSnapshot: c.name || `#${c.id}`,
        imageSnapshot: c.image || null,
        role: c.role || "",
        affinity: quickLogCharacterMeta?.[c.id]?.affinity || "기억남음",
        reasonTags: Array.isArray(quickLogCharacterMeta?.[c.id]?.reasonTags)
          ? quickLogCharacterMeta[c.id].reasonTags
          : [],
        note: String(quickLogCharacterMeta?.[c.id]?.note || ""),
        isPrimary:
          Number(c.id) === Number(quickLogPrimaryCharacterIdSafe) ||
          (!Number.isFinite(Number(quickLogPrimaryCharacterIdSafe)) && idx === 0),
      }));
    const saved = await updateWatchLog(quickLogDraft.logId, {
      watchedAtPrecision: watchedInput.precision,
      watchedAtValue: watchedInput.value,
      watchedAtStart: watchedMeta.watchedAtStart,
      watchedAtEnd: watchedMeta.watchedAtEnd,
      watchedAtSort: watchedMeta.watchedAtSort,
      cue: String(quickLogDraft.cue || "").slice(0, 120),
      note: String(quickLogDraft.note || ""),
      characterIds: selectedRefs.map((x) => x.characterId),
      characterRefs: selectedRefs,
    });

    const primaryRef = selectedRefs.find((x) => x.isPrimary);
    if (saved && primaryRef) {
      const pinId = buildCharacterPinId(primaryRef.characterId, quickLogDraft.anilistId);
      const alreadyPinned = pinnedCharacterKeySet.has(pinId);
      if (!alreadyPinned) {
        const reasonSeed =
          (Array.isArray(primaryRef.reasonTags) ? primaryRef.reasonTags[0] : "") ||
          String(primaryRef.note || "").trim() ||
          String(quickLogDraft.cue || "").trim();
        const shouldPin = window.confirm(
          `이 캐릭터("${primaryRef.nameSnapshot}")를 최애로 고정할까요?`
        );
        if (shouldPin) {
          await upsertCharacterPin({
            id: pinId,
            characterId: primaryRef.characterId,
            mediaId: Number(quickLogDraft.anilistId),
            nameSnapshot: primaryRef.nameSnapshot,
            imageSnapshot: primaryRef.imageSnapshot || null,
            note: String(primaryRef.note || ""),
            sourceLogId: saved.id,
            pinnedFromLogId: saved.id,
            pinReason: String(reasonSeed || ""),
            pinnedAt: Date.now(),
          }).catch(() => {});
          refreshCharacterPins();
        }
      }
    }

    if (selectedId && Number(selectedId) === Number(quickLogDraft.anilistId)) {
      const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
      setSelectedLogs(Array.isArray(rows) ? rows : []);
    }
    closeQuickLogSheet();
  }

  function buildCharacterPinId(characterId, mediaId) {
    return `${Number(characterId)}:${Number(mediaId)}`;
  }

  async function toggleCharacterPin(character) {
    const cid = Number(character?.id);
    const mid = Number(selectedId);
    if (!Number.isFinite(cid) || !Number.isFinite(mid)) return;

    const pinId = buildCharacterPinId(cid, mid);
    const isPinned = pinnedCharacterKeySet.has(pinId);
    if (isPinned) {
      await removeCharacterPin(pinId).catch(() => {});
      refreshCharacterPins();
      return;
    }

    await upsertCharacterPin({
      id: pinId,
      characterId: cid,
      mediaId: mid,
      nameSnapshot: character?.name || `#${cid}`,
      imageSnapshot: character?.image || null,
      note: "",
      sourceLogId: null,
      pinnedFromLogId: null,
      pinReason: "",
      pinnedAt: Date.now(),
    }).catch(() => {});
    refreshCharacterPins();
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
      <TopNavDataMenu
        base={base}
        panelId="data-menu-panel"
        canInstallPwa={canInstallPwa}
        onExportFile={exportBackup}
        onExportMobile={exportBackupMobile}
        onInstallPwa={onClickInstallPwa}
        onImportJsonFile={importBackupFile}
        onImportJsonText={importBackupText}
      />

      <section className="pageHeader">
        <h1 className="pageTitle">애니 보관함</h1>
        <p className="pageLead">지금까지 본 작품을 모아 두고 다시 꺼내보는 개인 보관함</p>
        <div style={{ marginTop: 6 }}>
          <span className="small" style={{ opacity: 0.9 }}>
            {backupReminder || "자동 로컬 백업이 켜져 있어요. 주기적으로 JSON 내보내기를 권장합니다."}
          </span>
        </div>
        {backupMsg && <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>{backupMsg}</div>}
      </section>

      <section style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", borderRadius: 5, padding: 12, marginBottom: 5 }}>
        <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.12)", borderRadius: 5, background: "rgba(0,0,0,.18)", width: "fit-content", marginBottom: 5 }}>
          <SegTabButton active={addTab === "search"} onClick={() => setAddTab("search")}>애니 검색</SegTabButton>
          <SegTabButton active={addTab === "recommend"} onClick={() => setAddTab("recommend")}>AI 추천</SegTabButton>
        </div>
        {addTab === "search" ? (
          <AddAnime items={items} setItems={setItems} onAnimeAdded={onAddAnimeFromSearch} />
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
              <div style={{ fontWeight: 700, marginBottom: 8 }}>재주행 TOP 5</div>
              {dashboard.rewatchRows.length === 0 ? (
                <div className="small">재주행 기록이 없습니다.</div>
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
            placeholder="보관함 검색 (제목/장르)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220, flex: "1 1 320px" }}
          />
          <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.10)", borderRadius: 5, background: "rgba(0,0,0,.18)", marginLeft: "auto", flex: "0 0 auto" }}>
            <SegTabButton active={cardView === "meta"} onClick={() => setCardView("meta")}>정보 함께</SegTabButton>
            <SegTabButton active={cardView === "poster"} onClick={() => setCardView("poster")}>포스터만</SegTabButton>
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
          <div className="small" style={{ whiteSpace: "nowrap", opacity: 0.9, border: 0 }}>카드 크기</div>
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
              ×
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

              <div className="modalMain">
                <h2 className="modalTitle">{selectedTitle}</h2>
                <div className="small modalMeta">
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
                  <div className="small">관련 시리즈</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedRelatedSeries.length === 0 ? (
                      <div className="small" style={{ opacity: 0.85 }}>
                        관련 시리즈 정보가 없거나 불러오는 중입니다.
                      </div>
                    ) : (
                      selectedRelatedSeries.map((row) => {
                        const inLibrary = libraryIdSet.has(row.id);
                        const canAddToLibrary = isAnimeMediaFormat(row.format);
                        const libraryItem = inLibrary
                          ? items.find((x) => Number(x?.anilistId) === row.id) || null
                          : null;
                        const cachedMedia = mediaMap.get(row.id) || null;
                        const mappedKoTitle = String(
                          itemKoTitleMap.get(row.id) || ALIAS_KO_TITLE_MAP.get(row.id) || relatedKoTitleById[row.id] || ""
                        ).trim();
                        const displayTitle = mappedKoTitle || pickCardTitle(libraryItem, cachedMedia || row.media || null);
                        return (
                          <div
                            key={`${row.id}:${row.relationType}`}
                            style={{
                              border: "1px solid rgba(255,255,255,.1)",
                              borderRadius: 10,
                              background: "rgba(255,255,255,.03)",
                              padding: 8,
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {row.cover ? (
                                <img
                                  src={row.cover}
                                  alt={displayTitle}
                                  style={{ width: 40, height: 56, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                                />
                              ) : (
                                <div
                                  aria-hidden
                                  style={{
                                    width: 40,
                                    height: 56,
                                    borderRadius: 6,
                                    background: "rgba(255,255,255,.08)",
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {displayTitle}
                                </div>
                                <div className="small" style={{ opacity: 0.86 }}>
                                  {row.relationLabel}
                                  {row.seasonYear ? ` · ${row.seasonYear}` : ""}
                                  {row.format ? ` · ${row.format}` : ""}
                                  {row.episodes ? ` · ${row.episodes}화` : ""}
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                  justifyContent: "flex-end",
                                  marginLeft: "auto",
                                  flex: "0 0 auto",
                                }}
                              >
                                {inLibrary ? (
                                  <button type="button" className="btn" onClick={() => setSelectedId(row.id)}>
                                    상세 열기
                                  </button>
                                ) : canAddToLibrary ? (
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => addRelatedSeriesToLibrary(row)}
                                    aria-label={`${displayTitle} 추가 후 상세 열기`}
                                    title="추가 후 열기"
                                    style={{
                                      width: 34,
                                      minWidth: 34,
                                      padding: 0,
                                      fontSize: 22,
                                      lineHeight: 1,
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    +
                                  </button>
                                ) : null}
                                {row.siteUrl && (
                                  <a className="btn" href={row.siteUrl} target="_blank" rel="noreferrer">
                                    AniList
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="row">
                  <div className="small">상태</div>
                  <select
                    className="select"
                    value={selected.status || "미분류"}
                    onChange={(e) => onSelectedStatusChange(e.target.value)}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
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
                  <div className="small">재주행</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const nextCount = normalizeRewatchCount(rewatchCountDraft + 1);
                          const today = formatLocalDate(new Date());
                          setRewatchCountDraft(nextCount);
                          setLastRewatchAtDraft(today);
                          updateSelected({ rewatchCount: nextCount, lastRewatchAt: today });
                          appendSelectedWatchLog(EVENT_REWATCH, {
                            cue: `\uC7AC\uC8FC\uD589 \uC644\uB8CC (${nextCount}\uD68C\uCC28)`,
                          }, {
                            openQuickSheet: true,
                            quickContext: { source: "rewatch-plus", isAuto: true, status: STATUS_COMPLETED },
                          });
                        }}
                      >
                        재주행 +1
                      </button>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={1}
                        value={rewatchCountDraft}
                        onChange={(e) => setRewatchCountDraft(normalizeRewatchCount(e.target.value))}
                        onBlur={commitModalDraft}
                        style={{ width: 72, maxWidth: "100%", textAlign: "center", flex: "0 0 72px" }}
                        aria-label="재주행 횟수"
                      />

                      <input
                        className="input"
                        type="date"
                        value={lastRewatchAtDraft}
                        onChange={(e) => setLastRewatchAtDraft(e.target.value)}
                        onBlur={commitModalDraft}
                        style={{ width: "min(220px, 100%)", maxWidth: "100%", flex: "1 1 180px" }}
                        aria-label="마지막 재주행"
                      />
                    </div>
                  </div>
                </div>
                <div className="row">
                    <div className="small">자세한 메모</div>
                    <textarea
                      className="textarea"
                      value={memoDraft}
                      onChange={(e) => setMemoDraft(e.target.value)}
                      onBlur={commitModalDraft}
                      placeholder="보고 난 뒤 한줄 메모"
                    />
                </div>

                <div className="row">
                  <div className="small">감상 기록</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {logsLoading ? (
                      <div className="small" style={{ opacity: 0.85 }}>불러오는 중...</div>
                    ) : selectedLogs.length === 0 ? (
                      <div className="small" style={{ opacity: 0.85 }}>
                        {"\uC544\uC9C1 \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uCD94\uAC00 \uC2DC \uC120\uD0DD\uD55C \uCD08\uAE30 \uC0C1\uD0DC\uC640 \uC0C1\uD0DC \uBCC0\uACBD/\uC815\uC8FC\uD589 \uC644\uB8CC \uC2DC \uC790\uB3D9 \uAE30\uB85D\uB429\uB2C8\uB2E4."}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                        {selectedLogs.slice(0, 20).map((log) => (
                          <div
                            key={log.id}
                            style={{
                              border: "1px solid rgba(255,255,255,.1)",
                              borderRadius: 10,
                              padding: "8px 10px",
                              background: "rgba(255,255,255,.03)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                              <div className="small" style={{ opacity: 0.9 }}>
                                {formatWatchLogDate(log)} · {log.eventType || "기록"}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => openQuickLogSheet(log, selectedMedia || null, { source: "manual-edit", isAuto: false })}
                                  style={{ padding: "4px 8px" }}
                                >
                                  기록 편집
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => deleteSelectedWatchLog(log.id)}
                                  style={{ padding: "4px 8px" }}
                                >
                                  기록 삭제
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}>
                              {log.cue || "한줄 감상 없음"}
                            </div>
                            {String(log.note || "").trim() && (
                              <div className="small" style={{ opacity: 0.82, marginTop: 2, wordBreak: "break-word" }}>
                                {log.note}
                              </div>
                            )}
                            <div className="small" style={{ opacity: 0.7, marginTop: 2 }}>
                              시점: {formatWatchLogDate(log)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                          <div style={{ minWidth: 0, flex: 1 }}>
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
                          <button
                            type="button"
                            className="btn"
                            onClick={() => toggleCharacterPin(c)}
                            title={pinnedCharacterKeySet.has(`${c.id}:${selectedId}`) ? "핀 해제" : "핀"}
                            style={{
                              width: 34,
                              height: 34,
                              padding: 0,
                              borderRadius: "50%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderColor: "rgba(255,255,255,.22)",
                              background: pinnedCharacterKeySet.has(`${c.id}:${selectedId}`)
                                ? "rgba(255,215,107,.22)"
                                : "transparent",
                            }}
                          >
                            {pinnedCharacterKeySet.has(`${c.id}:${selectedId}`) ? "★" : "☆"}
                          </button>
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

      {quickLogOpen && quickLogDraft && (
        <div
          onClick={closeQuickLogSheet}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "grid",
            alignItems: "end",
            zIndex: 1300,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(780px, calc(100vw - 16px))",
              margin: "0 auto",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: "16px 16px 0 0",
              background: "rgba(15,17,23,.98)",
              padding: 14,
              maxHeight: "78vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>빠른 기록</div>
                <div className="small" style={{ opacity: 0.85 }}>
                  {quickLogTitle || `#${quickLogDraft.anilistId}`} · {quickLogDraft.eventType}
                </div>
              </div>
              <button type="button" className="btn" onClick={closeQuickLogSheet}>
                닫기
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {quickLogContext?.isAuto && (
                <div
                  className="small"
                  style={{
                    border: "1px solid rgba(255,255,255,.14)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,.05)",
                    opacity: 0.9,
                  }}
                >
                  {"\uC790\uB3D9 \uC0DD\uC131\uB41C \uAE30\uB85D\uC785\uB2C8\uB2E4. \uC9C0\uAE08 \uB0B4\uC6A9\uC744 \uBCF4\uC644\uD558\uC9C0 \uC54A\uC544\uB3C4 \uAE30\uBCF8\uAC12\uC73C\uB85C \uC800\uC7A5\uB429\uB2C8\uB2E4."}
                </div>
              )}
              {quickLogContext?.source === "add-completed" && (
                <div className="small" style={{ opacity: 0.88 }}>
                  {"\uC644\uB8CC \uC0C1\uD0DC\uB85C \uCD94\uAC00\uD55C \uAE30\uB85D\uC774\uB77C \uC2DC\uCCAD \uC2DC\uC810/\uD55C \uC904 \uAE30\uC5B5\uC744 \uAC00\uB2A5\uD55C \uBC94\uC704\uC5D0\uC11C \uD568\uAED8 \uB0A8\uAE30\uB294 \uAC83\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4."}
                </div>
              )}
              {quickLogContext?.source === "add-dropped" && (
                <div className="small" style={{ opacity: 0.88 }}>
                  {"\uD558\uCC28 \uC0C1\uD0DC \uAE30\uB85D\uC740 \uC774\uC720 \uD0DC\uADF8/\uBA54\uBAA8\uB97C \uD568\uAED8 \uB0A8\uAE30\uBA74 \uB098\uC911\uC5D0 \uBCF5\uAE30 \uD310\uB2E8\uC5D0 \uB3C4\uC6C0\uC774 \uB429\uB2C8\uB2E4."}
                </div>
              )}
              <div className="row">
                <div className="small">언제 봤는지</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { key: "day", label: "날짜" },
                    { key: "month", label: "월" },
                    { key: "season", label: "시즌" },
                    { key: "year", label: "연도" },
                    { key: "unknown", label: "잘 모름" },
                  ].map((opt) => (
                    <Chip
                      key={opt.key}
                      active={quickLogDraft.watchedAtPrecision === opt.key}
                      onClick={() => setQuickLogPrecision(opt.key)}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="row">
                <div className="small">
                  {quickLogDraft.watchedAtPrecision === "day"
                    ? "본 날짜"
                    : quickLogDraft.watchedAtPrecision === "month"
                      ? "본 달"
                      : quickLogDraft.watchedAtPrecision === "season"
                        ? "본 시즌"
                        : quickLogDraft.watchedAtPrecision === "year"
                          ? "본 연도"
                          : "언제 봤는지"}
                </div>
                {quickLogDraft.watchedAtPrecision === "day" && (
                  <input
                    className="input"
                    type="date"
                    value={coerceQuickLogValue("day", quickLogDraft.watchedAtValue)}
                    onChange={(e) =>
                      setQuickLogDraft((prev) => ({ ...prev, watchedAtValue: e.target.value }))
                    }
                    aria-label="빠른 기록 날짜"
                  />
                )}
                {quickLogDraft.watchedAtPrecision === "month" && (
                  <input
                    className="input"
                    type="month"
                    value={coerceQuickLogValue("month", quickLogDraft.watchedAtValue)}
                    onChange={(e) =>
                      setQuickLogDraft((prev) => ({ ...prev, watchedAtValue: e.target.value }))
                    }
                    aria-label="빠른 기록 월"
                  />
                )}
                {quickLogDraft.watchedAtPrecision === "season" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      className="input"
                      type="number"
                      min={1950}
                      max={2099}
                      value={(parseSeasonValue(quickLogDraft.watchedAtValue)?.year || "").slice(0, 4)}
                      onChange={(e) => {
                        const year = String(e.target.value || "").replace(/[^\d]/g, "").slice(0, 4);
                        const term = parseSeasonValue(quickLogDraft.watchedAtValue)?.term || "Spring";
                        setQuickLogDraft((prev) => ({
                          ...prev,
                          watchedAtValue: year ? `${year}-${term}` : "",
                        }));
                      }}
                      placeholder="YYYY"
                      aria-label="빠른 기록 시즌 연도"
                    />
                    <select
                      className="select"
                      value={parseSeasonValue(quickLogDraft.watchedAtValue)?.term || "Spring"}
                      onChange={(e) => {
                        const term = SEASON_TERM_OPTIONS.includes(e.target.value)
                          ? e.target.value
                          : "Spring";
                        const year =
                          parseSeasonValue(quickLogDraft.watchedAtValue)?.year || defaultQuickLogValue("year");
                        setQuickLogDraft((prev) => ({
                          ...prev,
                          watchedAtValue: `${year}-${term}`,
                        }));
                      }}
                      aria-label="빠른 기록 시즌"
                    >
                      {SEASON_TERM_OPTIONS.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {quickLogDraft.watchedAtPrecision === "year" && (
                  <input
                    className="input"
                    type="number"
                    min={1950}
                    max={2099}
                    value={coerceQuickLogValue("year", quickLogDraft.watchedAtValue)}
                    onChange={(e) =>
                      setQuickLogDraft((prev) => ({
                        ...prev,
                        watchedAtValue: String(e.target.value || "")
                          .replace(/[^\d]/g, "")
                          .slice(0, 4),
                      }))
                    }
                    placeholder="YYYY"
                    aria-label="빠른 기록 연도"
                  />
                )}
                {quickLogDraft.watchedAtPrecision === "unknown" && (
                  <div className="small" style={{ opacity: 0.85 }}>
                    정확한 날짜가 기억나지 않으면 이 항목을 선택하세요. 정렬은 기록한 시점을 기준으로 맞춰집니다.
                  </div>
                )}
              </div>

              <div className="row">
                <div className="small">한줄 감상</div>
                <input
                  className="input"
                  value={quickLogDraft.cue}
                  maxLength={120}
                  onChange={(e) =>
                    setQuickLogDraft((prev) => ({ ...prev, cue: e.target.value }))
                  }
                  placeholder="예: 캐릭터 연출이 인상적이었음"
                  aria-label="한줄 감상"
                />
              </div>

              <div className="row">
                <div className="small">자세한 메모</div>
                <textarea
                  className="textarea"
                  value={quickLogDraft.note}
                  onChange={(e) =>
                    setQuickLogDraft((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="선택 입력"
                />
              </div>

              <div className="row">
                <div className="small">기억에 남은 캐릭터 (최대 3)</div>
                {quickLogCandidates.length === 0 ? (
                  <div className="small" style={{ opacity: 0.8 }}>
                    캐릭터 후보를 아직 불러오지 못했습니다.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {quickLogCandidates.map((c) => {
                      const active = quickLogCharacterIds.includes(c.id);
                      const isPrimary = Number(c.id) === Number(quickLogPrimaryCharacterIdSafe);
                      return (
                        <div key={c.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => toggleQuickLogCharacter(c.id)}
                            style={{
                              border: `1px solid ${active ? "rgba(120,220,255,.9)" : "rgba(255,255,255,.16)"}`,
                              borderRadius: 999,
                              background: active ? "rgba(120,220,255,.2)" : "rgba(255,255,255,.06)",
                              color: "inherit",
                              padding: "6px 10px",
                              cursor: "pointer",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={c.name}
                          >
                            {isPrimary ? "★ " : ""}{c.name}
                          </button>
                          {active && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setQuickLogPrimaryCharacter(c.id)}
                              style={{
                                padding: "4px 8px",
                                borderColor: isPrimary ? "rgba(255,215,107,.9)" : "rgba(255,255,255,.2)",
                                background: isPrimary ? "rgba(255,215,107,.2)" : "transparent",
                              }}
                              title="대표캐 지정"
                            >
                              {isPrimary ? "대표캐" : "대표캐로"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="small" style={{ opacity: 0.8 }}>
                  대표캐는 한 명만 고를 수 있어요.
                </div>
              </div>

              {quickLogSelectedCharacters.length > 0 && (
                <div className="row">
                  <div className="small">캐릭터별 기록</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {quickLogSelectedCharacters.map((c) => {
                      const meta = quickLogCharacterMeta?.[c.id] || {
                        affinity: "기억남음",
                        reasonTags: [],
                        note: "",
                      };
                      return (
                        <div
                          key={c.id}
                          style={{
                            border: "1px solid rgba(255,255,255,.12)",
                            borderRadius: 12,
                            padding: 10,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {c.image ? (
                              <img
                                src={c.image}
                                alt={c.name}
                                loading="lazy"
                                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                aria-hidden
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: "rgba(255,255,255,.1)",
                                }}
                              />
                            )}
                            <div style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.name}
                            </div>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setQuickLogPrimaryCharacter(c.id)}
                              style={{
                                marginLeft: "auto",
                                padding: "4px 8px",
                                borderColor:
                                  Number(c.id) === Number(quickLogPrimaryCharacterIdSafe)
                                    ? "rgba(255,215,107,.9)"
                                    : "rgba(255,255,255,.2)",
                                background:
                                  Number(c.id) === Number(quickLogPrimaryCharacterIdSafe)
                                    ? "rgba(255,215,107,.2)"
                                    : "transparent",
                              }}
                            >
                              {Number(c.id) === Number(quickLogPrimaryCharacterIdSafe) ? "대표캐" : "대표캐로"}
                            </button>
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div className="small">감정 태그</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {AFFINITY_OPTIONS.map((aff) => (
                                <Chip
                                  key={aff}
                                  active={meta.affinity === aff}
                                  onClick={() => setQuickLogCharacterAffinity(c.id, aff)}
                                >
                                  {affinityLabel(aff)}
                                </Chip>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div className="small">꽂힌 포인트 (최대 3)</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {REASON_TAG_OPTIONS.map((tag) => (
                                <Chip
                                  key={`${c.id}-${tag}`}
                                  active={Array.isArray(meta.reasonTags) && meta.reasonTags.includes(tag)}
                                  onClick={() => toggleQuickLogReasonTag(c.id, tag)}
                                >
                                  {reasonTagLabel(tag)}
                                </Chip>
                              ))}
                            </div>
                          </div>

                          <input
                            className="input"
                            value={String(meta.note || "")}
                            maxLength={200}
                            onChange={(e) => setQuickLogCharacterNote(c.id, e.target.value)}
                            placeholder="캐릭터 한줄 (선택)"
                            aria-label={`${c.name} 메모`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={closeQuickLogSheet}>
                {"\uAE30\uBCF8\uAC12 \uC720\uC9C0"}
              </button>
              <button type="button" className="btn" onClick={saveQuickLogDraft}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
