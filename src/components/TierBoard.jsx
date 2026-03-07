import { useEffect, useMemo, useRef, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";

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
      // 객체/배열은 stringify해서 저장
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}

const DEFAULT_TIERS = ["S", "A", "B", "C", "D"];
const LIST_STORAGE_KEY = "anime:list:v1";
const TIER_STORAGE_KEY = "anime:tier:v1";
const LAST_EXPORT_AT_KEY = "anime:lastBackupAt:v1";
const SCORE_MAX = 5;
const SCORE_STEP = 0.5;
const REWATCH_COUNT_MAX = 999;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeScoreValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
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

function SegTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 10,
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

// ✅ 초기 상태는 ids 배열을 복사해두는 게 안전(참조 공유 방지)
function makeEmptyTierState(ids) {
  return {
    unranked: [...ids],
    tiers: Object.fromEntries(DEFAULT_TIERS.map((t) => [t, []])),
  };
}

function firstHangulSynonym(media) {
  const arr = media?.synonyms;
  if (!Array.isArray(arr)) return null;
  return arr.find((s) => /[가-힣]/.test(String(s || ""))) || null;
}

export default function TierBoard() {
  // ✅ 라이브러리(localStorage) 읽어서 ids를 만든다 (새로 추가된 애니 자동 반영)
  const [library, setLibrary] = useLocalStorageState(LIST_STORAGE_KEY, myListSeed);

  useEffect(() => {
    setLibrary((prev) => {
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
  }, [setLibrary]);

  const ids = useMemo(() => library.map((x) => x.anilistId), [library]);

  // ✅ id -> koTitle 맵 (라이브러리에 저장된 한글 제목 우선)
  const koById = useMemo(() => {
    const m = new Map();
    for (const it of library) {
      if (it?.anilistId == null) continue;
      if (it?.koTitle) m.set(it.anilistId, it.koTitle);
    }
    return m;
  }, [library]);

  // ✅ Tier에서 보여줄 제목 결정(koTitle -> synonyms 한글 -> 영어/로마자/네이티브)
  function titleFor(id, media) {
    const ko = koById.get(id);
    if (ko) return ko;

    const synKo = firstHangulSynonym(media);
    if (synKo) return synKo;

    return (
      media?.title?.english ||
      media?.title?.romaji ||
      media?.title?.native ||
      (id ? `#${id}` : "Loading...")
    );
  }

  const [mediaMap, setMediaMap] = useState(new Map());

  // ✅ tierState는 localStorage에 저장
  const [tierState, setTierState] = useLocalStorageState(
    TIER_STORAGE_KEY,
    makeEmptyTierState(ids)
  );
  const fileRef = useRef(null);
  const dataMenuRef = useRef(null);
  const [dataTab, setDataTab] = useState("export");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [importText, setImportText] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  // AniList 메타 로드(캐시 우선)
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

  // ✅ 라이브러리 ↔ 티어 자동 동기화
  const idsKey = useMemo(() => ids.join(","), [ids]);
  useEffect(() => {
    setTierState((prev) => {
      const next = structuredClone(prev);

      const allNow = new Set();
      for (const id of next.unranked || []) allNow.add(id);
      for (const k of Object.keys(next.tiers || {})) {
        for (const id of next.tiers[k] || []) allNow.add(id);
      }

      const desired = new Set(ids);

      const missing = ids.filter((id) => !allNow.has(id));
      const removed = [...allNow].filter((id) => !desired.has(id));

      if (missing.length === 0 && removed.length === 0) return prev;

      if (removed.length) {
        next.unranked = (next.unranked || []).filter((id) => !removed.includes(id));
        for (const k of Object.keys(next.tiers || {})) {
          next.tiers[k] = (next.tiers[k] || []).filter((id) => !removed.includes(id));
        }
      }

      if (missing.length) {
        next.unranked = [...missing, ...(next.unranked || [])];
        // 중복 제거
        const seen = new Set();
        next.unranked = next.unranked.filter((id) =>
          seen.has(id) ? false : (seen.add(id), true)
        );
      }

      return next;
    });
  }, [idsKey, setTierState]);

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) setDataMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }
    function onInstallReady() {
      setCanInstallPwa(true);
    }
    function onInstalled() {
      setCanInstallPwa(false);
      setBackupMsg("앱이 설치되었습니다. 홈 화면에서 바로 열 수 있어요.");
    }

    syncInstallState();
    window.addEventListener("pwa-install-ready", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ---- Drag & Drop (순서 재정렬 지원) ----
  function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDragStart(e, id, from, fromIndex) {
    // Drag&Drop 데이터는 문자열로 넣고(getData로 꺼냄)
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, from, fromIndex }));
    e.dataTransfer.effectAllowed = "move";
  }

  function parsePayload(e) {
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getListRef(state, listName) {
    return listName === "unranked" ? state.unranked : state.tiers[listName];
  }

  function removeEverywhere(state, id) {
    state.unranked = (state.unranked || []).filter((x) => x !== id);
    for (const k of Object.keys(state.tiers || {})) {
      state.tiers[k] = (state.tiers[k] || []).filter((x) => x !== id);
    }
  }

  function insertAt(arr, index, value) {
    const i = Math.max(0, Math.min(index, arr.length));
    arr.splice(i, 0, value);
  }

  function moveItem(prev, { id, from, fromIndex }, to, toIndex) {
    const next = structuredClone(prev);
    const sameList = from === to;

    removeEverywhere(next, id);

    const target = getListRef(next, to) || [];
    if (to !== "unranked") next.tiers[to] = target;
    else next.unranked = target;

    let idx = typeof toIndex === "number" ? toIndex : target.length;
    if (sameList && typeof fromIndex === "number" && fromIndex < idx) idx = idx - 1;

    insertAt(target, idx, id);
    return next;
  }

  function onDropToEnd(e, to) {
    e.preventDefault();
    const payload = parsePayload(e);
    if (!payload) return;

    setTierState((prev) => {
      const arr = getListRef(prev, to) || [];
      return moveItem(prev, payload, to, arr.length);
    });
  }

  function onDropToItem(e, to, toIndex) {
    e.preventDefault();
    e.stopPropagation();
    const payload = parsePayload(e);
    if (!payload) return;

    setTierState((prev) => moveItem(prev, payload, to, toIndex));
  }

  function reset() {
    setTierState(makeEmptyTierState(ids));
  }

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") {
      setBackupMsg("현재 브라우저에서는 설치 프롬프트를 아직 사용할 수 없습니다.");
      return;
    }
    try {
      const ok = await window.__promptPwaInstall();
      if (!ok) setBackupMsg("설치를 취소했어요. 필요할 때 다시 시도할 수 있습니다.");
    } catch {
      setBackupMsg("설치 요청 중 오류가 발생했습니다.");
    }
  }

  function buildBackupPayload() {
    return {
      app: "ani-site",
      version: 1,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(library),
      tier: tierState,
    };
  }

  function markBackupExported(message) {
    try {
      localStorage.setItem(LAST_EXPORT_AT_KEY, new Date().toISOString());
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
      setLibrary(incomingNormalized);
    } else {
      setLibrary((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingTier) {
      const nextTier = isOverwrite
        ? normalizeTierState(incomingTier)
        : mergeTierState(tierState, incomingTier);
      setTierState(nextTier);
    }

    setBackupMsg(
      isOverwrite
        ? "가져오기 완료! 기존 목록을 덮어썼어요."
        : "가져오기 완료! 기존 목록과 병합했어요."
    );
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

  // ---- Render ----
  const base = import.meta.env.BASE_URL || "/";
  return (
    <div style={{ display: "grid", gap: 16 }}>
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

        <div ref={dataMenuRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setDataMenuOpen((v) => !v)}
            aria-expanded={dataMenuOpen}
            aria-controls="tier-data-menu-panel"
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
              id="tier-data-menu-panel"
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

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onPickImport}
      />
      {backupMsg && <div className="small" style={{ opacity: 0.9 }}>{backupMsg}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={reset}>초기화</button>
        <span className="small">Drag & Drop</span>
      </div>

      {DEFAULT_TIERS.map((t) => (
        <div
          key={t}
          onDragOver={allowDrop}
          onDrop={(e) => onDropToEnd(e, t)}
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr",
            gap: 12,
            alignItems: "start",
            border: "1px rgba(255,255,255,.12)",
            borderStyle: "solid none",
            borderRadius: 0,
            padding: 12,
            background: "rgba(255,255,255,.03)",
            minHeight: 110,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 48 }}>{t}</div>

          <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
            {(tierState.tiers?.[t] || []).map((id, idx) => {
              const m = mediaMap.get(id);
              const title = titleFor(id, m);
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => onDragStart(e, id, t, idx)}
                  onDragOver={allowDrop}
                  onDrop={(e) => onDropToItem(e, t, idx)}
                  title={title}
                  style={{
                    width: 78,
                    borderRadius: 0,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(255,255,255,.04)",
                    cursor: "grab",
                  }}
                >
                  <img
                    src={m?.coverImage?.large ?? undefined}
                    alt={title}
                    style={{
                      width: "100%",
                      aspectRatio: "2/3",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                </div>
              );
            })}

            {(tierState.tiers?.[t] || []).length === 0 && (
              <div className="small" style={{ opacity: 0.7, padding: "6px 0" }} />
            )}
          </div>
        </div>
      ))}

      {/* Unranked */}
      <div
        onDragOver={allowDrop}
        onDrop={(e) => onDropToEnd(e, "unranked")}
        style={{
          border: "1px dashed rgba(255,255,255,.18)",
          borderRadius: 0,
          padding: 12,
          background: "rgba(255,255,255,.02)",
          minHeight: 140,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>미분류</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(tierState.unranked || []).map((id, idx) => {
            const m = mediaMap.get(id);
            const title = titleFor(id, m);
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => onDragStart(e, id, "unranked", idx)}
                onDragOver={allowDrop}
                onDrop={(e) => onDropToItem(e, "unranked", idx)}
                title={title}
                style={{
                  width: 78,
                  borderRadius: 0,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                  cursor: "grab",
                }}
              >
                <img
                  src={m?.coverImage?.large ?? undefined}
                  alt={title}
                  style={{
                    width: "100%",
                    aspectRatio: "2/3",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
