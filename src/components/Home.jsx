import { useEffect, useMemo, useRef, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import { readLibraryListPreferred } from "../repositories/libraryRepo";
import { readAllWatchLogsSnapshot } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred } from "../repositories/characterPinRepo";
import { readLastExportAtMs } from "../repositories/backupRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import { buildHomeResurfacing } from "../domain/homeSelectors";
import { buildCharacterInsight } from "../domain/characterInsights";
import { buildYearRecap, listRecapYears } from "../domain/recapSelectors";
import YearRecapPanel from "./home/YearRecapPanel";
import ResurfacingCards from "./home/ResurfacingCards";
import CharacterInsightSheet from "./home/CharacterInsightSheet";

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

function formatBackupAgo(ms) {
  if (!Number.isFinite(ms)) return "백업 기록 없음";
  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) return "1시간 이내 백업";
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}시간 전 백업`;
  return `${Math.floor(diff / (24 * 60 * 60 * 1000))}일 전 백업`;
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [logs, setLogs] = useState([]);
  const [pins, setPins] = useState([]);
  const [lastBackupMs, setLastBackupMs] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [utilOpen, setUtilOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [recapYear, setRecapYear] = useState(null);
  const utilRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const list = await readLibraryListPreferred(myListSeed).catch(() => myListSeed);
      const safeList = Array.isArray(list) ? list : [];
      if (!alive) return;
      setItems(safeList);
      setLogs(readAllWatchLogsSnapshot());
      setLastBackupMs(readLastExportAtMs());

      const pinRows = await listCharacterPinsPreferred().catch(() => []);
      if (!alive) return;
      setPins(Array.isArray(pinRows) ? pinRows : []);

      if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
        try {
          const ok = await navigator.storage.persisted();
          if (alive) setPersisted(Boolean(ok));
        } catch {
          if (alive) setPersisted(null);
        }
      }

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

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }
    function onInstallReady() {
      setCanInstallPwa(true);
    }
    function onInstalled() {
      setCanInstallPwa(false);
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
      if (!utilRef.current) return;
      if (!utilRef.current.contains(e.target)) setUtilOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const resurfacing = useMemo(
    () => buildHomeResurfacing({ items, logs, pins }),
    [items, logs, pins]
  );

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  const titleById = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      map.set(Number(it.anilistId), pickTitle(it, mediaMap.get(Number(it.anilistId))));
    }
    return map;
  }, [items, mediaMap]);

  const characterInsight = useMemo(() => {
    const id = Number(selectedCharacter?.characterId);
    if (!Number.isFinite(id)) return null;
    const built = buildCharacterInsight({ characterId: id, logs, titleById });
    if (built) {
      if (!built.name && selectedCharacter?.name) built.name = selectedCharacter.name;
      if (!built.image && selectedCharacter?.image) built.image = selectedCharacter.image;
      return built;
    }
    if (!selectedCharacter) return null;
    return {
      characterId: id,
      name: selectedCharacter.name || `#${id}`,
      image: selectedCharacter.image || "",
      total: 0,
      recent60: 0,
      relatedAnime: [],
      reasonTags: [],
      recentLogs: [],
    };
  }, [logs, selectedCharacter, titleById]);

  const recapYears = useMemo(() => listRecapYears(logs, 10), [logs]);

  useEffect(() => {
    const fallbackYear = new Date().getUTCFullYear();
    if (!recapYears.length) {
      if (!Number.isFinite(Number(recapYear))) setRecapYear(fallbackYear);
      return;
    }
    if (!Number.isFinite(Number(recapYear)) || !recapYears.includes(Number(recapYear))) {
      setRecapYear(recapYears[0]);
    }
  }, [recapYear, recapYears]);

  const yearRecap = useMemo(
    () => buildYearRecap({ logs, year: recapYear }),
    [logs, recapYear]
  );

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") return;
    try {
      await window.__promptPwaInstall();
    } catch {}
    setUtilOpen(false);
  }

  function openCharacterSheet(characterId, name = "", image = "") {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    setSelectedCharacter({
      characterId: id,
      name: String(name || "").trim(),
      image: image || "",
    });
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
        </div>
        <div ref={utilRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setUtilOpen((v) => !v)}
            style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "8px 10px", borderRadius: 10, fontSize: 14 }}
            aria-label="유틸 메뉴"
            aria-expanded={utilOpen}
          >
            유틸
          </button>
          {utilOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                maxWidth: "min(92vw, 280px)",
                zIndex: 70,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(15,17,23,.98)",
                borderRadius: 12,
                padding: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,.35)",
                display: "grid",
                gap: 8,
              }}
            >
              <a
                href={`${base}library/`}
                className="btn"
                style={{ textAlign: "center", textDecoration: "none" }}
                onClick={() => setUtilOpen(false)}
              >
                목록에서 백업/가져오기
              </a>
              <a
                href={`${base}data/`}
                className="btn"
                style={{ textAlign: "center", textDecoration: "none" }}
                onClick={() => setUtilOpen(false)}
              >
                데이터 센터
              </a>
              {canInstallPwa && (
                <button type="button" className="btn" onClick={onClickInstallPwa}>
                  홈 화면 설치
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="pageHeader" style={{ marginBottom: 6 }}>
        <h1 className="pageTitle">회상 홈</h1>
        <p className="pageLead">
          검색 후 기록하고, 나중에 다시 떠올릴 수 있는 개인 회상 허브
        </p>
      </section>

      <section
        style={{
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 10,
          padding: 12,
          background: "linear-gradient(135deg, rgba(55,128,255,.18), rgba(255,255,255,.02))",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
            작품 {items.length}개
          </div>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
            로그 {logs.length}개
          </div>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
            {formatBackupAgo(lastBackupMs)}
          </div>
          <div className="small" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.12)" }}>
            저장 보호 {persisted == null ? "확인 중" : persisted ? "활성" : "비활성"}
          </div>
        </div>
        <div>
          <a href={`${base}library/`} className="btn" style={{ textDecoration: "none" }}>
            최근 기록하기
          </a>
        </div>
      </section>

      <YearRecapPanel
        recapYear={recapYear}
        setRecapYear={setRecapYear}
        recapYears={recapYears}
        yearRecap={yearRecap}
        titleById={titleById}
        onOpenCharacter={openCharacterSheet}
      />

      <ResurfacingCards
        base={base}
        mediaMap={mediaMap}
        titleById={titleById}
        resurfacing={resurfacing}
        onOpenCharacter={openCharacterSheet}
      />

      <CharacterInsightSheet
        base={base}
        selectedCharacter={selectedCharacter}
        characterInsight={characterInsight}
        titleById={titleById}
        onClose={() => setSelectedCharacter(null)}
      />
    </div>
  );
}
