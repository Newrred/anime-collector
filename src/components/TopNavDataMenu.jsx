import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getMessageGroup } from "../domain/messages.js";
import { toPlatformAppHref } from "../domain/search/memoryCardNavigation.js";
import { useAuthSession } from "../hooks/useAuthSession.js";
import { useMemoryAccountSync } from "../hooks/useMemoryAccountSync.js";
import {
  IconArchiveBox,
  IconArrowRight,
  IconBoard,
  IconBookOpen,
  IconDatabase,
  IconGear,
  IconGlobe,
  IconHelp,
  IconHome,
  IconMenu,
  IconMoon,
  IconSun,
  IconTrophy,
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
  const account = useMemoryAccountSync({ session: auth.session, authLoading: auth.loading });
  const accountCopy = getMessageGroup(locale, "memoryAccount");
  const accountTone = account.status === "INITIALIZATION_FAILED"
    ? "disabled"
    : account.loading
      ? "pending"
      : auth.session?.user
        ? "connected"
        : "offline-local";

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
    window.location.assign(toPlatformAppHref(`${base}data/`, {
      native: Capacitor.isNativePlatform(),
      origin: window.location.origin,
    }));
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
            href={`${base}boards/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "boards" ? " is-active" : ""}`}
            aria-current={currentRoute === "boards" ? "page" : undefined}
          >
            {copy.boards}
          </a>
          <a
            href={`${base}tier/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "tier" ? " is-active" : ""}`}
            aria-current={currentRoute === "tier" ? "page" : undefined}
          >
            {copy.tier}
          </a>
        </div>

        <a className="btn top-nav__memory-action" href={`${base}memory/new/`} aria-label={copy.createMemory} data-astro-reload>
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
              className={`data-menu-trigger auth-trigger top-nav__desktop-action ${syncToneClass(accountTone)}${account.loading ? " is-syncing" : ""}`}
            >
              <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
                <IconGear />
              </span>
              <span className={`sync-dot ${syncToneClass(accountTone)}`} aria-hidden />
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
              className={`data-menu-trigger top-nav__mobile-menu-trigger ${syncToneClass(accountTone)}${account.loading ? " is-syncing" : ""}`}
            >
              <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
                {dataMenuOpen ? <IconX size={18} /> : <IconMenu size={18} />}
              </span>
              <span className={`sync-dot ${syncToneClass(accountTone)}`} aria-hidden />
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
                <header className="data-menu-mobile-head top-nav-mobile-only">
                  <div>
                    <strong>{copy.menuTitle}</strong>
                    <span>{copy.menuLead}</span>
                  </div>
                </header>

                <section className="data-menu-section data-menu-section--navigation top-nav-mobile-only">
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
                      <ActionLabel icon={<IconHome size={17} />}>{copy.home}</ActionLabel>
                      <IconArrowRight size={14} />
                    </a>
                    <a
                      href={`${base}library/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "library" ? " is-active" : ""}`}
                      aria-current={currentRoute === "library" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconBookOpen size={17} />}>{copy.library}</ActionLabel>
                      <IconArrowRight size={14} />
                    </a>
                    <a
                      href={`${base}archive/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "archive" ? " is-active" : ""}`}
                      aria-current={currentRoute === "archive" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconArchiveBox size={17} />}>{copy.archive}</ActionLabel>
                      <IconArrowRight size={14} />
                    </a>
                    <a
                      href={`${base}boards/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "boards" ? " is-active" : ""}`}
                      aria-current={currentRoute === "boards" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconBoard size={17} />}>{copy.boards}</ActionLabel>
                      <IconArrowRight size={14} />
                    </a>
                    <a
                      href={`${base}tier/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "tier" ? " is-active" : ""}`}
                      aria-current={currentRoute === "tier" ? "page" : undefined}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconTrophy size={17} />}>{copy.tier}</ActionLabel>
                      <IconArrowRight size={14} />
                    </a>
                  </div>
                </section>

                <section className="data-menu-section data-menu-section--account">
                  <AuthSheet
                    embedded
                    copy={getMessageGroup(locale, "authSheet")}
                    session={auth.session}
                    configured={auth.configured}
                    loading={auth.loading}
                    syncStatus={accountCopy.statusTitles?.[account.status] || accountCopy.statusTitles.LOCAL_ONLY}
                    syncing={account.loading}
                    showSyncActions={false}
                    onSignIn={async () => {
                      await auth.signIn(`${base}data/`);
                    }}
                    onSignOut={async () => {
                      await auth.signOut();
                    }}
                    onSyncNow={async () => {}}
                    onOpenData={() => {
                      setDataMenuOpen(false);
                      openDataPage();
                    }}
                  />
                </section>

                <section className="data-menu-section data-menu-section--appearance top-nav-mobile-only">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconGlobe />
                    </span>
                    <div className="data-menu-section-title">{copy.appearanceTitle}</div>
                  </div>
                  <div className="top-nav-mobile-preferences">
                    <button type="button" className="btn btn--subtle top-nav-mobile-theme" onClick={handleToggleTheme}>
                      {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
                      <span>{theme === "dark" ? copy.themeLight : copy.themeDark}</span>
                    </button>
                    <div className="top-nav-mobile-locale-row" aria-label={copy.localeMenu}>
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

                {preferenceControls ? (
                  <section className="data-menu-section">
                    <div className="data-menu-preferences">
                      {preferenceControls}
                    </div>
                  </section>
                ) : null}

                <section className="data-menu-section data-menu-section--utilities">
                  <div className="data-menu-section-head">
                    <span className="data-menu-section-icon" aria-hidden>
                      <IconGear />
                    </span>
                    <div className="data-menu-section-title">{copy.moreTitle}</div>
                  </div>
                  <div className="data-menu-utility-grid">
                    <a
                      href={`${base}profile/`}
                      className={`btn btn--subtle data-menu-link${currentRoute === "profile" ? " is-active" : ""}`}
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconGear size={15} />}>{copy.profileShort}</ActionLabel>
                    </a>
                    <a
                      href={`${base}help/`}
                      className="btn btn--subtle data-menu-link"
                      onClick={() => setDataMenuOpen(false)}
                    >
                      <ActionLabel icon={<IconHelp size={15} />}>{copy.help}</ActionLabel>
                    </a>
                    {canInstallPwa ? (
                      <button
                        className="btn btn--subtle"
                        onClick={async () => {
                          await handleInstallPwaClick();
                          setDataMenuOpen(false);
                        }}
                      >
                        <ActionLabel icon={<IconDatabase size={15} />}>{copy.installApp}</ActionLabel>
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </nav>

    </>
  );
}
