import { useEffect, useRef, useState } from "react";
import { pickByLocale } from "../domain/uiText";

function Icon({ children, size = 14 }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </span>
  );
}

function IconGear() {
  return (
    <Icon>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </Icon>
  );
}

function IconDownload() {
  return (
    <Icon>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  );
}

function IconUpload() {
  return (
    <Icon>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </Icon>
  );
}

function IconFile() {
  return (
    <Icon>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </Icon>
  );
}

function IconClipboard() {
  return (
    <Icon>
      <rect x="8" y="4" width="8" height="4" rx="1" />
      <path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    </Icon>
  );
}

function IconMobile() {
  return (
    <Icon>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  );
}

function IconDatabase() {
  return (
    <Icon>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v10c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </Icon>
  );
}

function SegTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`data-menu-seg-btn${active ? " is-active" : ""}`}
    >
      <span className="data-menu-seg-label">{children}</span>
    </button>
  );
}

function IconHelp() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9.4a2.6 2.6 0 0 1 5.2 0c0 1.4-.8 2.1-1.8 2.7-.8.5-1.2.9-1.2 1.7" />
      <circle cx="12" cy="17.2" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
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
  locale = "ko",
  preferenceControls = null,
  onToggleLocale,
  onExportFile,
  onExportMobile,
  onInstallPwa,
  onImportJsonFile,
  onImportJsonText,
}) {
  const copy = pickByLocale(locale, {
    ko: {
      home: "홈",
      library: "보관함",
      tier: "티어",
      switchToEnglish: "영어로 전환",
      switchToKorean: "한국어로 전환",
      help: "도움말",
      manage: "관리 메뉴",
      helpDialog: "서비스 도움말",
      helpTitle: "도움말",
      helpBlocks: [
        "홈에서는 최근 감상/회상 카드와 연간 요약을 확인합니다.",
        "보관함에서 작품 검색 추가, 상태/점수/메모/재시청 기록을 관리합니다.",
        "티어에서는 작품 카드를 드래그해서 순위를 정리합니다.",
        "관리에서 JSON 내보내기/불러오기를 사용합니다. 이어붙이기는 합치기, 덮어쓰기는 현재 데이터를 교체합니다.",
        "모바일에서는 모바일로 보내기/복사 또는 붙여넣기 불러오기를 사용하세요.",
      ],
      export: "내보내기",
      import: "불러오기",
      saveBackupFile: "백업 파일 저장",
      mobileShare: "모바일로 보내기/복사",
      installApp: "앱 설치",
      storageStatus: "저장 상태",
      mergeImport: "이어서 불러오기",
      overwriteImport: "지금 데이터 대신 불러오기",
      pickBackupFile: "백업 파일 선택",
      importPlaceholder: "모바일에서는 백업 내용을 복사해 여기에 붙여넣고 불러오세요.",
      importFromPaste: "붙여넣은 내용 불러오기",
    },
    en: {
      home: "Home",
      library: "Library",
      tier: "Tier",
      switchToEnglish: "Switch to English",
      switchToKorean: "Switch to Korean",
      help: "Help",
      manage: "Manage",
      helpDialog: "Service help",
      helpTitle: "Help",
      helpBlocks: [
        "On Home, review recent logs, resurfacing cards, and yearly recap.",
        "In Library, add anime and manage status, score, memo, and rewatch logs.",
        "In Tier, drag anime cards to reorganize rankings.",
        "Use Manage for JSON export and import. Merge appends data, overwrite replaces current data.",
        "On mobile, use share/copy export or paste import.",
      ],
      export: "Export",
      import: "Import",
      saveBackupFile: "Save backup file",
      mobileShare: "Send to mobile / copy",
      installApp: "Install app",
      storageStatus: "Storage status",
      mergeImport: "Merge import",
      overwriteImport: "Overwrite current data",
      pickBackupFile: "Choose backup file",
      importPlaceholder: "On mobile, paste copied backup JSON here and import it.",
      importFromPaste: "Import pasted content",
    },
  });
  const fileRef = useRef(null);
  const dataMenuRef = useRef(null);
  const [dataTab, setDataTab] = useState("export");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [importText, setImportText] = useState("");

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) {
        setDataMenuOpen(false);
        setHelpOpen(false);
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

  function handleToggleLocale() {
    setHelpOpen(false);
    setDataMenuOpen(false);
    if (typeof onToggleLocale === "function") onToggleLocale();
  }

  return (
    <>
      <section
        className="nav"
        style={{
          margin: "calc(-1 * var(--page-pad)) calc(-1 * var(--page-pad)) 12px",
          padding: "10px var(--page-pad)",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <a href={`${base}`}>{copy.home}</a>
          <a href={`${base}library/`}>{copy.library}</a>
          <a href={`${base}tier/`}>{copy.tier}</a>
        </div>

        <div ref={dataMenuRef} style={{ position: "relative", marginLeft: "auto" }}>
          <div className="data-menu-actions">
            <button
              type="button"
              onClick={handleToggleLocale}
              aria-label={locale === "ko" ? copy.switchToEnglish : copy.switchToKorean}
              title={locale === "ko" ? copy.switchToEnglish : copy.switchToKorean}
              className="data-menu-trigger data-menu-locale-trigger"
            >
              <span className="data-menu-locale-label" aria-hidden>
                <span className={`data-menu-locale-token${locale === "ko" ? " is-active" : ""}`}>KO</span>
                <span className="data-menu-locale-divider">/</span>
                <span className={`data-menu-locale-token${locale === "en" ? " is-active" : ""}`}>EN</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setHelpOpen((v) => !v);
                setDataMenuOpen(false);
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
              <div className="data-menu-tabs">
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
                    className="btn"
                    style={{ textAlign: "center", textDecoration: "none" }}
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconDatabase />}>{copy.storageStatus}</ActionLabel>
                  </a>
                </div>
              ) : (
                <div className="data-menu-body">
                  <div className="data-menu-import-mode">
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
                    className="textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={copy.importPlaceholder}
                    style={{ minHeight: 100 }}
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
        style={{ display: "none" }}
        onChange={handlePickImport}
      />
    </>
  );
}
