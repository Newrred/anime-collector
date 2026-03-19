import { useEffect, useRef, useState } from "react";
import { getMessageGroup } from "../domain/messages.js";
import { useAuthSession } from "../hooks/useAuthSession.js";
import { useSyncStatus } from "../hooks/useSyncStatus.js";
import {
  IconDatabase,
  IconGear,
  IconGlobe,
  IconHelp,
  IconMoon,
  IconSun,
} from "./ui/AppIcons.jsx";
import AuthSheet from "./auth/AuthSheet.jsx";
import TopNavGlobalSearch from "./search/TopNavGlobalSearch.jsx";

function ActionLabel({ icon, children }) {
  return (
    <span className="data-menu-action-label">
      {icon}
      <span>{children}</span>
    </span>
  );
}

function syncToneClass(status) {
  if (status === "conflict") return "is-conflict";
  if (status === "error") return "is-error";
  if (status === "pending") return "is-pending";
  if (status === "synced") return "is-synced";
  return "is-idle";
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
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const auth = useAuthSession(`${base}data/`);
  const sync = useSyncStatus({ session: auth.session, autoSync: false });

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
      <section
        className="nav top-nav"
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
            href={`${base}profile/`}
            className={`top-nav__link top-nav__link--primary${currentRoute === "profile" ? " is-active" : ""}`}
            aria-current={currentRoute === "profile" ? "page" : undefined}
          >
            {copy.showcase}
          </a>
        </div>

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
              className="data-menu-trigger data-menu-theme-trigger"
            >
              <span className="data-menu-trigger-label data-menu-theme-icon" aria-hidden>
                {theme === "dark" ? <IconMoon /> : <IconSun />}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLocaleMenuOpen((v) => !v);
                setDataMenuOpen(false);
              }}
              aria-expanded={localeMenuOpen}
              aria-controls="locale-menu-panel"
              aria-label={copy.localeMenu}
              title={copy.localeMenu}
              className="data-menu-trigger"
            >
              <span className="data-menu-trigger-label data-menu-locale-icon" aria-hidden>
                <IconGlobe />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDataMenuOpen((v) => !v);
                setLocaleMenuOpen(false);
              }}
              aria-expanded={dataMenuOpen}
              aria-controls={panelId}
              aria-label={copy.manage}
              title={copy.manage}
              className={`data-menu-trigger auth-trigger ${syncToneClass(sync.status)}${sync.syncing ? " is-syncing" : ""}`}
            >
              <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
                <IconGear />
              </span>
              <span className={`sync-dot ${syncToneClass(sync.status)}`} aria-hidden />
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
                <section className="data-menu-section">
                  <AuthSheet
                    embedded
                    copy={getMessageGroup(locale, "authSheet")}
                    session={auth.session}
                    configured={auth.configured}
                    loading={auth.loading}
                    syncStatus={getMessageGroup(locale, "syncStatus").statusLabels?.[sync.status] || sync.status}
                    syncing={sync.syncing}
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
                      <IconDatabase />
                    </span>
                    <div className="data-menu-section-title">{copy.labs}</div>
                  </div>
                  <p className="small data-menu-section-summary">{copy.labsSummary}</p>
                  <a
                    href={`${base}tier/`}
                    className="btn btn--subtle data-menu-link"
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconDatabase />}>{copy.openLabsPage}</ActionLabel>
                  </a>
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
      </section>

    </>
  );
}
