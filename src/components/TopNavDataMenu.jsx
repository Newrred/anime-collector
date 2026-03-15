import { useEffect, useRef, useState } from "react";
import { getMessageGroup } from "../domain/messages.js";
import {
  IconClipboard,
  IconDatabase,
  IconDownload,
  IconFile,
  IconGear,
  IconGlobe,
  IconHelp,
  IconMobile,
  IconMoon,
  IconSun,
  IconUpload,
} from "./ui/AppIcons.jsx";

function SegTabButton({ active, onClick, children, className = "", ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`data-menu-seg-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      {...props}
    >
      <span className="data-menu-seg-label">{children}</span>
    </button>
  );
}

function ActionLabel({ icon, children }) {
  return (
    <span className="data-menu-action-label">
      {icon}
      <span>{children}</span>
    </span>
  );
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
  onExportFile,
  onExportMobile,
  onInstallPwa,
  onImportJsonFile,
  onImportJsonText,
}) {
  const copy = getMessageGroup(locale, "topNavDataMenu");
  const fileRef = useRef(null);
  const dataMenuRef = useRef(null);
  const [dataTab, setDataTab] = useState("export");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [importText, setImportText] = useState("");

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) {
        setDataMenuOpen(false);
        setHelpOpen(false);
        setLocaleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function openLibraryManageFallback() {
    if (typeof window === "undefined") return;
    window.location.href = `${base}library/`;
  }

  async function handleImportText() {
    if (typeof onImportJsonText !== "function") {
      openLibraryManageFallback();
      return;
    }
    try {
      await onImportJsonText(importText, importMode);
      setImportText("");
      setDataMenuOpen(false);
    } catch {}
  }

  async function handlePickImport(e) {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = "";
      return;
    }
    if (typeof onImportJsonFile !== "function") {
      openLibraryManageFallback();
      e.target.value = "";
      return;
    }
    try {
      await onImportJsonFile(file, importMode);
      setDataMenuOpen(false);
    } catch {
      // Parent handles error messaging.
    } finally {
      e.target.value = "";
    }
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
    setHelpOpen(false);
    setDataMenuOpen(false);
    setLocaleMenuOpen(false);
    if (typeof onToggleLocale === "function") onToggleLocale(nextLocale);
  }

  function handleToggleTheme() {
    setHelpOpen(false);
    setDataMenuOpen(false);
    setLocaleMenuOpen(false);
    if (typeof onToggleTheme === "function") onToggleTheme();
  }

  return (
    <>
      <section
        className="nav top-nav"
      >
        <div className="top-nav__links">
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
            href={`${base}tier/`}
            className={`top-nav__link top-nav__link--secondary${currentRoute === "tier" ? " is-active" : ""}`}
            aria-current={currentRoute === "tier" ? "page" : undefined}
          >
            {copy.tier}
          </a>
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
                setHelpOpen(false);
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
                setHelpOpen((v) => !v);
                setDataMenuOpen(false);
                setLocaleMenuOpen(false);
              }}
              aria-expanded={helpOpen}
              aria-label={copy.help}
              className="data-menu-trigger"
            >
              <span className="data-menu-trigger-label">
                <IconHelp />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDataMenuOpen((v) => !v);
                setHelpOpen(false);
                setLocaleMenuOpen(false);
              }}
              aria-expanded={dataMenuOpen}
              aria-controls={panelId}
              aria-label={copy.manage}
              className="data-menu-trigger"
            >
              <span className="data-menu-trigger-label">
                <IconGear />
              </span>
            </button>
          </div>

          {helpOpen && (
            <div className="data-menu-panel data-help-panel" role="dialog" aria-label={copy.helpDialog}>
              <div className="data-help-title">{copy.helpTitle}</div>
              {copy.helpBlocks.map((block) => (
                <div key={block} className="small data-help-block">
                  {block}
                </div>
              ))}
            </div>
          )}

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
              className="data-menu-panel"
            >
              {preferenceControls ? (
                <div className="data-menu-preferences">
                  {preferenceControls}
                </div>
              ) : null}
              <div className="data-menu-tabs seg-toggle-2" data-active-index={dataTab === "export" ? "0" : "1"}>
                <SegTabButton active={dataTab === "export"} onClick={() => setDataTab("export")}>
                  <IconDownload />
                  {copy.export}
                </SegTabButton>
                <SegTabButton active={dataTab === "import"} onClick={() => setDataTab("import")}>
                  <IconUpload />
                  {copy.import}
                </SegTabButton>
              </div>

              {dataTab === "export" ? (
                <div className="data-menu-body">
                  <button
                    className="btn"
                    onClick={async () => {
                      if (typeof onExportFile === "function") await onExportFile();
                      else openLibraryManageFallback();
                      setDataMenuOpen(false);
                    }}
                  >
                    <ActionLabel icon={<IconFile />}>{copy.saveBackupFile}</ActionLabel>
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (typeof onExportMobile === "function") await onExportMobile();
                      else openLibraryManageFallback();
                      setDataMenuOpen(false);
                    }}
                  >
                    <ActionLabel icon={<IconMobile />}>{copy.mobileShare}</ActionLabel>
                  </button>
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
                  <a
                    href={`${base}data/`}
                    className="btn data-menu-link"
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconDatabase />}>{copy.storageStatus}</ActionLabel>
                  </a>
                </div>
              ) : (
                <div className="data-menu-body">
                  <div
                    className="data-menu-import-mode seg-toggle-2"
                    data-active-index={importMode === "merge" ? "0" : "1"}
                  >
                    <SegTabButton active={importMode === "merge"} onClick={() => setImportMode("merge")}>
                      {copy.mergeImport}
                    </SegTabButton>
                    <SegTabButton active={importMode === "overwrite"} onClick={() => setImportMode("overwrite")}>
                      {copy.overwriteImport}
                    </SegTabButton>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      if (typeof onImportJsonFile === "function") {
                        fileRef.current?.click();
                        setDataMenuOpen(false);
                      } else {
                        openLibraryManageFallback();
                      }
                    }}
                  >
                    <ActionLabel icon={<IconFile />}>{copy.pickBackupFile}</ActionLabel>
                  </button>
                  <textarea
                    className="textarea data-menu-import-text"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={copy.importPlaceholder}
                  />
                  <button className="btn" onClick={handleImportText}>
                    <ActionLabel icon={<IconClipboard />}>{copy.importFromPaste}</ActionLabel>
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
        className="data-menu-file-input"
        onChange={handlePickImport}
      />
    </>
  );
}
