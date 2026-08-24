import { useEffect, useRef, useState } from "react";
import { getMessageGroup } from "../domain/messages.js";
import { deriveSyncPresentation } from "../domain/syncPresentation.js";
import { useAuthSession } from "../hooks/useAuthSession.js";
import { useSyncStatus } from "../hooks/useSyncStatus.js";
import {
  IconDatabase,
  IconGear,
  IconGlobe,
  IconHelp,
  IconMenu,
  IconMoon,
  IconSun,
  IconX,
} from "./ui/AppIcons.jsx";
import AuthSheet from "./auth/AuthSheet.jsx";
import TopNavGlobalSearch from "./search/TopNavGlobalSearch.jsx";
import "./top-nav-readiness.css";

function ActionLabel({ icon, children }) {
  return (
    <span className="data-menu-action-label">
      {icon}
      <span>{children}</span>
    </span>
  );
}

function syncToneClass(tone) {
  return `is-${tone || "idle"}`;
}

export default function TopNavDataMenu({
  base = "/",
  panelId = "data-menu-panel",
  canInstallPwa = false,
  currentRoute = "",
  locale = "ko",
  theme = "dark",
  preferenceControls = null,
  onToggleLocale,
  onToggleTheme,
  onInstallPwa,
}) {
  const copy = getMessageGroup(locale, "topNavDataMenu");
  const dataMenuRef = useRef(null);
  const menuReturnFocusRef = useRef(null);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const auth = useAuthSession(`${base}data/`);
  const sync = useSyncStatus({ session: auth.session, autoSync: false });
  const syncPresentation = deriveSyncPresentation({
    configured: sync.configured,
    connected: Boolean(auth.session?.user),
    loading: sync.loading,
    remoteChecked: sync.remoteChecked,
    remoteMissing: sync.remoteMissing,
    status: sync.status,
  });

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) {
        setDataMenuOpen(false);
        setLocaleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!dataMenuOpen && !localeMenuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDataMenuOpen(false);
      setLocaleMenuOpen(false);
      requestAnimationFrame(() => menuReturnFocusRef.current?.focus());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dataMenuOpen, localeMenuOpen]);

  function openDataPage() {
    if (typeof window === "undefined") return;
    window.location.href = `${base}data/`;
  }

  async function handleInstallPwaClick() {
    if (typeof onInstallPwa === "function") {
      await onInstallPwa();
      return;
    }
    if (typeof window !== "undefined" && typeof window.__promptPwaInstall === "function") {
      try {
        await window.__promptPwaInstall();
      } catch {}
    }
  }

  function handleSelectLocale(nextLocale) {
    setDataMenuOpen(false);
    setLocaleMenuOpen(false);
    if (typeof onToggleLocale === "function") onToggleLocale(nextLocale);
  }

  function handleToggleTheme() {
    setDataMenuOpen(false);
    setLocaleMenuOpen(false);
    if (typeof onToggleTheme === "function") onToggleTheme();
  }

  return (
    <>
      <nav
        className="nav top-nav"
        aria-label="Primary"
      >
        <a
          href={`${base}`}
          className="top-nav__brand"
          aria-label="MOEMOA home"
        >
          <img
            src={`${base}MOEMOA.svg`}
            alt="MOEMOA"
            className="top-nav__brand-mark"
            width="155"
            height="41"
          />
        </a>
        <div className="top-nav__links top-nav__links--routes">
          <a
            href={`${base}`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "home" ? " is-active" : ""}`}
            aria-current={currentRoute === "home" ? "page" : undefined}
          >
            {copy.home}
          </a>
          <a
            href={`${base}library/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "library" ? " is-active" : ""}`}
            aria-current={currentRoute === "library" ? "page" : undefined}
          >
            {copy.library}
          </a>
          <a
            href={`${base}archive/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "archive" ? " is-active" : ""}`}
            aria-current={currentRoute === "archive" ? "page" : undefined}
          >
            {copy.archive}
          </a>
          <a
            href={`${base}tier/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "tier" ? " is-active" : ""}`}
            aria-current={currentRoute === "tier" ? "page" : undefined}
          >
            {copy.tier}
          </a>
        </div>

        <a className="btn top-nav__memory-action" href={`${base}memory/new/`} aria-label={copy.createMemory}>
          <span className="top-nav__memory-action-plus" aria-hidden>＋</span>
          <span className="top-nav__memory-action-short" aria-hidden>{copy.memoryShort}</span>
          <span className="top-nav__memory-action-label">{copy.createMemory}</span>
        </a>

        <div className="top-nav__search-slot">
          <TopNavGlobalSearch base={base} locale={locale} />
        </div>

        <div ref={dataMenuRef} className="top-nav__menu">
          <div className="data-menu-actions">
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={theme === "dark" ? copy.switchToLight : copy.switchToDark}
              title={theme === "dark" ? copy.switchToLight : copy.switchToDark}
              className="data-menu-trigger data-menu-theme-trigger top-nav__desktop-action"
            >
              <span className="data-menu-trigger-label data-menu-theme-icon" aria-hidden>
                {theme === "dark" ? <IconMoon /> : <IconSun />}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                menuReturnFocusRef.current = event.currentTarget;
                setLocaleMenuOpen((v) => !v);
                setDataMenuOpen(false);
              }}
              aria-expanded={localeMenuOpen}
              aria-controls="locale-menu-panel"
              aria-label={copy.localeMenu}
              title={copy.localeMenu}
              className="data-menu-trigger top-nav__desktop-action"
            >
              <span className="data-menu-trigger-label data-menu-locale-icon" aria-hidden>
                <IconGlobe />
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                menuReturnFocusRef.current = event.currentTarget;
                setDataMenuOpen((v) => !v);
                setLocaleMenuOpen(false);
              }}
              aria-expanded={dataMenuOpen}
              aria-controls={panelId}
              aria-label={copy.manage}
              title={copy.manage}
              className={`data-menu-trigger auth-trigger top-nav__desktop-action ${syncToneClass(syncPresentation.tone)}${sync.syncing ? " is-syncing" : ""}`}
            >
              <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
                <IconGear />
              </span>
              <span className={`sync-dot ${syncToneClass(syncPresentation.tone)}`} aria-hidden />
            </button>
            <button
              type="button"
              onClick={(event) => {
                menuReturnFocusRef.current = event.currentTarget;
                setDataMenuOpen((v) => !v);
                setLocaleMenuOpen(false);
              }}
              aria-expanded={dataMenuOpen}
              aria-controls={panelId}
              aria-label={dataMenuOpen ? copy.closeMobileMenu : copy.openMobileMenu}
              title={dataMenuOpen ? copy.closeMobileMenu : copy.openMobileMenu}
              className={`data-menu-trigger top-nav__mobile-menu-trigger ${syncToneClass(syncPresentation.tone)}${sync.syncing ? " is-syncing" : ""}`}
            >
              <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
                {dataMenuOpen ? <IconX size={18} /> : <IconMenu size={18} />}
              </span>
              <span className={`sync-dot ${syncToneClass(syncPresentation.tone)}`} aria-hidden />
            </button>
          </div>

          {localeMenuOpen && (
            <div
              id="locale-menu-panel"
              className="data-menu-panel data-menu-locale-panel"
              role="dialog"
              aria-label={copy.localeMenu}
            >
              <button
                type="button"
                className={`data-menu-locale-option${locale === "ko" ? " is-active" : ""}`}
                onClick={() => handleSelectLocale("ko")}
              >
                <span className="data-menu-locale-option-code">KO</span>
                <span className="data-menu-locale-option-text">{copy.localeKorean}</span>
              </button>
              <button
                type="button"
                className={`data-menu-locale-option${locale === "en" ? " is-active" : ""}`}
                onClick={() => handleSelectLocale("en")}
              >
                <span className="data-menu-locale-option-code">EN</span>
                <span className="data-menu-locale-option-text">{copy.localeEnglish}</span>
              </button>
            </div>
          )}

          {dataMenuOpen && (
            <div
              id={panelId}
              className="data-menu-panel data-menu-panel--manage"
              role="dialog"
              aria-label={copy.manage}
            >
              <div className="data-menu-stack">
                <section className="data-menu-section top-nav-mobile-only">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconMenu />
                    </span>
                    <div className="data-menu-section-title">{copy.navigationTitle}</div>
                  </div>
                  <div className="top-nav-mobile-links">
                    <a
                      href={`${base}`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "home" ? " is-active" : ""}`}
                      aria-current={currentRoute === "home" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      {copy.home}
                    </a>
                    <a
                      href={`${base}library/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "library" ? " is-active" : ""}`}
                      aria-current={currentRoute === "library" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      {copy.library}
                    </a>
                    <a
                      href={`${base}archive/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "archive" ? " is-active" : ""}`}
                      aria-current={currentRoute === "archive" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      {copy.archive}
                    </a>
                    <a
                      href={`${base}tier/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "tier" ? " is-active" : ""}`}
                      aria-current={currentRoute === "tier" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      {copy.tier}
                    </a>
                  </div>
                </section>

                <section className="data-menu-section top-nav-mobile-only">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconGlobe />
                    </span>
                    <div className="data-menu-section-title">{copy.appearanceTitle}</div>
                  </div>
                  <div className="top-nav-mobile-preferences">
                    <button type="button" className="btn btn--subtle" onClick={handleToggleTheme}>
                      {theme === "dark" ? copy.switchToLight : copy.switchToDark}
                    </button>
                    <div className="top-nav-mobile-locale-row">
                      <button
                        type="button"
                        className={`btn btn--subtle${locale === "ko" ? " is-active" : ""}`}
                        onClick={() => handleSelectLocale("ko")}
                      >
                        KO
                      </button>
                      <button
                        type="button"
                        className={`btn btn--subtle${locale === "en" ? " is-active" : ""}`}
                        onClick={() => handleSelectLocale("en")}
                      >
                        EN
                      </button>
                    </div>
                  </div>
                </section>

                <section className="data-menu-section">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconGear />
                    </span>
                    <div className="data-menu-section-title">{copy.profileMinihomeTitle}</div>
                  </div>
                  <p className="small data-menu-section-summary">{copy.profileMinihomeSummary}</p>
                  <a
                    href={`${base}profile/`}
                    className={`btn btn--subtle data-menu-link${currentRoute === "profile" ? " is-active" : ""}`}
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconGear />}>{copy.openProfileMinihome}</ActionLabel>
                  </a>
                </section>

                <section className="data-menu-section">
                  <AuthSheet
                    embedded
                    copy={getMessageGroup(locale, "authSheet")}
                    session={auth.session}
                    configured={auth.configured}
                    loading={auth.loading}
                    syncStatus={getMessageGroup(locale, "syncStatus").statusLabels?.[syncPresentation.tone] || syncPresentation.tone}
                    syncing={sync.syncing}
                    showSyncActions={syncPresentation.showSyncActions}
                    onSignIn={async () => {
                      await auth.signIn(`${base}data/`);
                    }}
                    onSignOut={async () => {
                      await auth.signOut();
                    }}
                    onSyncNow={async () => {
                      await sync.syncNow().catch(() => {});
                    }}
                    onOpenData={() => {
                      setDataMenuOpen(false);
                      openDataPage();
                    }}
                  />
                </section>

                {preferenceControls ? (
                  <section className="data-menu-section">
                    <div className="data-menu-preferences">
                      {preferenceControls}
                    </div>
                  </section>
                ) : null}

                <section className="data-menu-section">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconDatabase />
                    </span>
                    <div className="data-menu-section-title">{copy.dataToolsTitle}</div>
                  </div>
                  <p className="small data-menu-section-summary">{copy.dataToolsSummary}</p>
                  <div className="data-menu-body">
                    {canInstallPwa && (
                      <button
                        className="btn"
                        onClick={async () => {
                          await handleInstallPwaClick();
                          setDataMenuOpen(false);
                        }}
                      >
                        {copy.installApp}
                      </button>
                    )}
                  </div>
                </section>

                <section className="data-menu-section">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconHelp />
                    </span>
                    <div className="data-menu-section-title">{copy.helpTitle}</div>
                  </div>
                  <p className="small data-menu-section-summary">{copy.helpSummary}</p>
                  <a
                    href={`${base}help/`}
                    className="btn btn--subtle data-menu-link"
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconHelp />}>{copy.openHelpPage}</ActionLabel>
                  </a>
                </section>
              </div>
            </div>
          )}
        </div>
      </nav>

    </>
  );
}
