import { useEffect, useMemo, useState } from "react";
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
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatBackupAgo, formatStatusToggleLabel, pickByLocale } from "../domain/uiText";
import { pickDisplayTitle } from "../domain/animeTitles";

export default function Home() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = pickByLocale(locale, {
    ko: {
      title: "기록 홈",
      lead: "검색하고 기록한 작품을 나중에 다시 꺼내보는 개인 홈",
      animeCount: "작품",
      logCount: "감상 기록",
      storageProtect: "저장 보호",
      quickRecord: "바로 기록하기",
      heroHint: "오늘 떠오른 장면을 짧게 남겨두면 회상 카드가 더 정확해집니다.",
      unit: "개",
    },
    en: {
      title: "Home",
      lead: "A personal home for revisiting anime you searched and logged",
      animeCount: "Anime",
      logCount: "Logs",
      storageProtect: "Storage protect",
      quickRecord: "Log now",
      heroHint: "Leave a short note about what stood out today to improve resurfacing cards.",
      unit: "",
    },
  });
  const [items, setItems] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [logs, setLogs] = useState([]);
  const [pins, setPins] = useState([]);
  const [lastBackupMs, setLastBackupMs] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [recapYear, setRecapYear] = useState(null);

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

  const resurfacing = useMemo(
    () => buildHomeResurfacing({ items, logs, pins }),
    [items, logs, pins]
  );

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  const titleById = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      map.set(Number(it.anilistId), pickDisplayTitle(it, mediaMap.get(Number(it.anilistId)), locale));
    }
    return map;
  }, [items, mediaMap, locale]);

  const homeHeroImage = useMemo(() => {
    const recentId = Number(resurfacing?.recentLogs?.[0]?.anilistId);
    if (Number.isFinite(recentId)) {
      const media = mediaMap.get(recentId);
      const banner = String(media?.bannerImage || "").trim();
      if (banner) return banner;
      const cover =
        media?.coverImage?.extraLarge ||
        media?.coverImage?.large ||
        media?.coverImage?.medium ||
        "";
      if (cover) return String(cover);
    }

    for (const it of items) {
      const media = mediaMap.get(Number(it?.anilistId));
      const banner = String(media?.bannerImage || "").trim();
      if (banner) return banner;
    }

    return "";
  }, [items, mediaMap, resurfacing]);

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
    <div className="home-page">
      <TopNavDataMenu
        base={base}
        panelId="home-data-menu-panel"
        canInstallPwa={canInstallPwa}
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || ((locale === "ko") ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onInstallPwa={onClickInstallPwa}
      />

      <section className="pageHeader">
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageLead">{copy.lead}</p>
      </section>

      <section
        className="surface-card home-quick-panel"
        style={
          homeHeroImage
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(7,12,28,.82), rgba(13,22,45,.76)), linear-gradient(135deg, rgba(91,124,255,.24), rgba(255,255,255,.02)), url("${homeHeroImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(135deg, rgba(91,124,255,.18), rgba(255,255,255,.02))" }
        }
      >
        <div className="status-badge-row">
          <div className="small status-badge">
            {locale === "en" ? `${copy.animeCount} ${items.length}` : `${copy.animeCount} ${items.length}${copy.unit}`}
          </div>
          <div className="small status-badge">
            {locale === "en" ? `${copy.logCount} ${logs.length}` : `${copy.logCount} ${logs.length}${copy.unit}`}
          </div>
          <div className="small status-badge">
            {formatBackupAgo(lastBackupMs, locale)}
          </div>
          <div className="small status-badge">
            {copy.storageProtect} {formatStatusToggleLabel(persisted, locale)}
          </div>
        </div>
        <div className="action-row">
          <a href={`${base}library/`} className="btn btn--subtle" style={{ textDecoration: "none" }}>
            {copy.quickRecord}
          </a>
          <span className="small page-feedback">{copy.heroHint}</span>
        </div>
      </section>

      <YearRecapPanel
        locale={locale}
        recapYear={recapYear}
        setRecapYear={setRecapYear}
        recapYears={recapYears}
        yearRecap={yearRecap}
        titleById={titleById}
        onOpenCharacter={openCharacterSheet}
      />

      <ResurfacingCards
        locale={locale}
        base={base}
        mediaMap={mediaMap}
        titleById={titleById}
        resurfacing={resurfacing}
        onOpenCharacter={openCharacterSheet}
      />

      <CharacterInsightSheet
        locale={locale}
        base={base}
        selectedCharacter={selectedCharacter}
        characterInsight={characterInsight}
        titleById={titleById}
        onClose={() => setSelectedCharacter(null)}
      />
    </div>
  );
}
