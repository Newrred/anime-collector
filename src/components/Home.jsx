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
import HomeTierEntryCard from "./home/HomeTierEntryCard.jsx";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatBackupAgo, formatStatusToggleLabel } from "../domain/uiText";
import { getMessageGroup } from "../domain/messages.js";
import { pickDisplayTitle } from "../domain/animeTitles";

function buildLibraryHref(base, anilistId, focus = "") {
  const params = new URLSearchParams();
  const id = Number(anilistId);
  if (Number.isFinite(id)) params.set("animeId", String(id));
  if (focus) params.set("focus", focus);
  if (!params.toString()) return `${base}library/?tab=add`;
  return `${base}library/?${params.toString()}`;
}

export default function Home() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = getMessageGroup(locale, "home");
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
    const heroId = Number(
      resurfacing?.recentLogs?.[0]?.anilistId ??
      resurfacing?.missingMemory?.[0]?.anilistId ??
      items?.[0]?.anilistId
    );
    if (Number.isFinite(heroId)) {
      const media = mediaMap.get(heroId);
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

  const heroEntry = useMemo(
    () => resurfacing?.recentLogs?.[0] ?? resurfacing?.missingMemory?.[0] ?? items?.[0] ?? null,
    [items, resurfacing]
  );

  const heroAnimeId = Number(heroEntry?.anilistId);
  const heroMedia = Number.isFinite(heroAnimeId) ? mediaMap.get(heroAnimeId) : null;
  const heroTitle = Number.isFinite(heroAnimeId)
    ? (titleById.get(heroAnimeId) || pickDisplayTitle(heroEntry, heroMedia, locale) || `#${heroAnimeId}`)
    : copy.heroFallback;
  const heroSourceLabel = heroEntry?.id
    ? copy.heroMetaRecent
    : heroEntry?.anilistId && resurfacing?.missingMemory?.some((row) => Number(row?.anilistId) === heroAnimeId)
      ? copy.heroMetaMissing
      : copy.heroMetaLibrary;
  const heroPrimaryHref = Number.isFinite(heroAnimeId)
    ? buildLibraryHref(base, heroAnimeId, "quick-log")
    : `${base}library/?tab=add`;
  const heroSecondaryHref = Number.isFinite(heroAnimeId)
    ? buildLibraryHref(base, heroAnimeId)
    : `${base}library/?tab=collection`;
  const heroCue = String(heroEntry?.cue || "").trim();
  const heroMeta = [
    heroSourceLabel,
    Number.isFinite(heroAnimeId) ? heroTitle : "",
    heroEntry?.label || "",
  ].filter(Boolean).slice(0, 3);

  const continueTargets = useMemo(() => resurfacing?.missingMemory?.slice(0, 4) || [], [resurfacing]);
  const recentLogTargets = useMemo(() => resurfacing?.recentLogs?.slice(0, 4) || [], [resurfacing]);
  const characterTargets = useMemo(() => {
    const repeated = resurfacing?.repeatedCharacters?.slice(0, 4) || [];
    if (repeated.length > 0) return repeated;
    return resurfacing?.recentPrimaryCharacters?.slice(0, 4) || [];
  }, [resurfacing]);
  const thisTimeTargets = useMemo(() => resurfacing?.thisTime?.slice(0, 4) || [], [resurfacing]);
  const tierCtaDisabled = recentLogTargets.length === 0;

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
        currentRoute="home"
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
        className="surface-card home-memory-hero"
        style={
          homeHeroImage
            ? {
                backgroundImage: `linear-gradient(135deg, var(--color-hero-overlay-start), var(--color-hero-overlay-end)), linear-gradient(135deg, var(--color-hero-accent-start), var(--color-hero-accent-end)), url("${homeHeroImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(135deg, var(--color-hero-fallback-start), var(--color-hero-fallback-end))" }
        }
      >
        <div className="home-memory-hero__copy">
          <div className="small home-memory-hero__eyebrow">{copy.heroTitle}</div>
          <h2 className="sectionTitle home-memory-hero__title">{heroTitle}</h2>
          <p className="sectionLead home-memory-hero__lead">
            {heroCue || copy.heroLead}
          </p>
          <div className="status-badge-row">
            {heroMeta.map((entry) => (
              <div key={entry} className="small status-badge">{entry}</div>
            ))}
          </div>
          <div className="action-row">
            <a href={heroPrimaryHref} className="btn home-memory-hero__cta">{copy.quickRecord}</a>
            <a href={heroSecondaryHref} className="btn btn--subtle home-memory-hero__cta-link">{copy.heroOpen}</a>
          </div>
        </div>
        <div className="home-memory-hero__meta">
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
          <div className="small page-feedback">{copy.heroHint}</div>
        </div>
      </section>

      <ResurfacingCards
        locale={locale}
        base={base}
        mediaMap={mediaMap}
        titleById={titleById}
        recentLogs={recentLogTargets}
        missingMemory={continueTargets}
        characterRows={characterTargets}
        characterMode={resurfacing?.repeatedCharacters?.length > 0 ? "repeated" : "recent"}
        thisTimeRows={thisTimeTargets}
        pinnedHighlights={resurfacing?.pinnedHighlights || []}
        onOpenCharacter={openCharacterSheet}
      />

      <YearRecapPanel
        locale={locale}
        recapYear={recapYear}
        setRecapYear={setRecapYear}
        recapYears={recapYears}
        yearRecap={yearRecap}
        titleById={titleById}
        onOpenCharacter={openCharacterSheet}
      />

      <HomeTierEntryCard
        locale={locale}
        base={base}
        year={new Date().getUTCFullYear()}
        disabled={tierCtaDisabled}
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
