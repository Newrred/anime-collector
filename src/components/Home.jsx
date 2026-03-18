import { useEffect, useMemo, useState } from "react";
import { buildHomeResurfacing } from "../domain/homeSelectors";
import { buildCharacterInsight } from "../domain/characterInsights";
import { buildYearRecap, listRecapYears } from "../domain/recapSelectors";
import { buildShowcaseModel } from "../domain/showcase/showcaseSelectors.js";
import { useShowcaseSource } from "../hooks/useShowcaseSource.js";
import YearRecapPanel from "./home/YearRecapPanel";
import ResurfacingCards from "./home/ResurfacingCards";
import CharacterInsightSheet from "./home/CharacterInsightSheet";
import HomeShowcasePreview from "./home/HomeShowcasePreview.jsx";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getMessageGroup } from "../domain/messages.js";

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
  const { items, logs, mediaMap, titleById } = useShowcaseSource(locale);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [recapYear, setRecapYear] = useState(null);

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

  const resurfacing = useMemo(() => buildHomeResurfacing({ items, logs }), [items, logs]);

  const showcaseModel = useMemo(
    () => buildShowcaseModel({ items, logs, mediaMap, titleById, locale }),
    [items, logs, mediaMap, titleById, locale]
  );

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  const heroEntry = useMemo(
    () => resurfacing?.recentLogs?.[0] ?? resurfacing?.missingMemory?.[0] ?? items?.[0] ?? null,
    [items, resurfacing]
  );

  const heroAnimeId = Number(heroEntry?.anilistId);
  const heroMedia = Number.isFinite(heroAnimeId) ? mediaMap.get(heroAnimeId) : null;
  const heroTitle = Number.isFinite(heroAnimeId) ? titleById.get(heroAnimeId) || heroMedia?.title?.romaji || `#${heroAnimeId}` : copy.heroFallback;
  const heroSourceLabel = heroEntry?.id
    ? copy.heroMetaRecent
    : heroEntry?.anilistId && resurfacing?.missingMemory?.some((row) => Number(row?.anilistId) === heroAnimeId)
      ? copy.heroMetaMissing
      : copy.heroMetaLibrary;
  const heroPrimaryHref = Number.isFinite(heroAnimeId) ? buildLibraryHref(base, heroAnimeId, "quick-log") : `${base}library/?tab=add`;
  const heroSecondaryHref = Number.isFinite(heroAnimeId) ? buildLibraryHref(base, heroAnimeId) : `${base}library/?tab=collection`;
  const heroCue = String(heroEntry?.cue || "").trim();
  const heroVisual = useMemo(() => {
    if (!Number.isFinite(heroAnimeId)) return "";
    const banner = String(heroMedia?.bannerImage || "").trim();
    if (banner) return banner;
    const cover = heroMedia?.coverImage?.extraLarge || heroMedia?.coverImage?.large || heroMedia?.coverImage?.medium || "";
    return String(cover || "").trim();
  }, [heroAnimeId, heroMedia]);
  const heroLayoutStyle = heroVisual
    ? {
        backgroundImage: `linear-gradient(130deg, var(--color-hero-overlay-start), var(--color-hero-overlay-end)), url("${heroVisual}")`,
      }
    : {};

  const continueTargets = useMemo(() => resurfacing?.missingMemory?.slice(0, 4) || [], [resurfacing]);
  const recentLogTargets = useMemo(() => resurfacing?.recentLogs?.slice(0, 4) || [], [resurfacing]);
  const thisTimeTargets = useMemo(() => resurfacing?.thisTime?.slice(0, 4) || [], [resurfacing]);

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

  const yearRecap = useMemo(() => buildYearRecap({ logs, year: recapYear }), [logs, recapYear]);

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
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onInstallPwa={onClickInstallPwa}
      />

      <section className="pageHeader">
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageLead">{copy.lead}</p>
      </section>

      <section className={`surface-card home-focus-card${heroVisual ? " home-focus-card--hero-bg" : ""}`}>
        <div className="home-focus-card__layout" style={heroLayoutStyle}>
          {heroVisual ? <div className="home-focus-card__overlay" aria-hidden="true" /> : null}
          <div className="home-focus-card__body">
            <div className="pageHeader home-focus-card__head">
              <h2 className="sectionTitle">{copy.heroTitle}</h2>
              <p className="sectionLead">{copy.heroLead}</p>
              <div className="small home-focus-card__source">{heroSourceLabel}</div>
            </div>
            <h3 className="home-focus-card__title">{heroTitle}</h3>
            <p className="home-focus-card__cue">{heroCue || copy.heroLead}</p>
            <div className="home-focus-card__stats">
              <div className="home-focus-card__stat">
                <span className="small">{copy.animeCount}</span>
                <strong>{locale === "en" ? items.length : `${items.length}${copy.unit}`}</strong>
              </div>
              <div className="home-focus-card__stat">
                <span className="small">{copy.logCount}</span>
                <strong>{locale === "en" ? logs.length : `${logs.length}${copy.unit}`}</strong>
              </div>
            </div>
            <div className="action-row">
              <a href={heroPrimaryHref} className="btn">
                {copy.quickRecord}
              </a>
              <a href={heroSecondaryHref} className="btn btn--subtle">
                {copy.heroOpen}
              </a>
            </div>
            <div className="small page-feedback">{copy.heroHint}</div>
          </div>
        </div>
      </section>

      <ResurfacingCards
        locale={locale}
        base={base}
        mediaMap={mediaMap}
        titleById={titleById}
        recentLogs={recentLogTargets}
        missingMemory={continueTargets}
        thisTimeRows={thisTimeTargets}
      />

      <HomeShowcasePreview locale={locale} base={base} model={showcaseModel} />

      <YearRecapPanel
        locale={locale}
        recapYear={recapYear}
        setRecapYear={setRecapYear}
        recapYears={recapYears}
        yearRecap={yearRecap}
        titleById={titleById}
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
