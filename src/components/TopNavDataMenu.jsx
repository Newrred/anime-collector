import { useEffect, useRef, useState } from "react";

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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{children}</span>
    </button>
  );
}

function ActionLabel({ icon, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export default function TopNavDataMenu({
  base = "/",
  panelId = "data-menu-panel",
  canInstallPwa = false,
  onExportFile,
  onExportMobile,
  onInstallPwa,
  onImportJsonFile,
  onImportJsonText,
}) {
  const fileRef = useRef(null);
  const dataMenuRef = useRef(null);
  const [dataTab, setDataTab] = useState("export");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [importText, setImportText] = useState("");

  useEffect(() => {
    function onDocDown(e) {
      if (!dataMenuRef.current) return;
      if (!dataMenuRef.current.contains(e.target)) setDataMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  async function handleImportText() {
    if (typeof onImportJsonText !== "function") return;
    try {
      await onImportJsonText(importText, importMode);
      setImportText("");
      setDataMenuOpen(false);
    } catch {}
  }

  async function handlePickImport(e) {
    const file = e.target.files?.[0];
    if (!file || typeof onImportJsonFile !== "function") {
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
          <a href={`${base}`}>회상</a>
          <a href={`${base}library/`}>목록</a>
          <a href={`${base}tier/`}>티어</a>
        </div>

        <div ref={dataMenuRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setDataMenuOpen((v) => !v)}
            aria-expanded={dataMenuOpen}
            aria-controls={panelId}
            aria-label="유틸 메뉴"
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconGear />
              <span>유틸</span>
            </span>
          </button>

          {dataMenuOpen && (
            <div
              id={panelId}
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
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: 4,
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 12,
                  background: "rgba(0,0,0,.18)",
                }}
              >
                <SegTabButton active={dataTab === "export"} onClick={() => setDataTab("export")}>
                  <IconDownload />
                  내보내기
                </SegTabButton>
                <SegTabButton active={dataTab === "import"} onClick={() => setDataTab("import")}>
                  <IconUpload />
                  불러오기
                </SegTabButton>
              </div>

              {dataTab === "export" ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (typeof onExportFile === "function") await onExportFile();
                      setDataMenuOpen(false);
                    }}
                  >
                    <ActionLabel icon={<IconFile />}>JSON 파일 저장</ActionLabel>
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (typeof onExportMobile === "function") await onExportMobile();
                      setDataMenuOpen(false);
                    }}
                  >
                    <ActionLabel icon={<IconMobile />}>모바일 공유/복사</ActionLabel>
                  </button>
                  {canInstallPwa && (
                    <button
                      className="btn"
                      onClick={async () => {
                        if (typeof onInstallPwa === "function") await onInstallPwa();
                        setDataMenuOpen(false);
                      }}
                    >
                      앱 설치
                    </button>
                  )}
                  <a
                    href={`${base}data/`}
                    className="btn"
                    style={{ textAlign: "center", textDecoration: "none" }}
                    onClick={() => setDataMenuOpen(false)}
                  >
                    <ActionLabel icon={<IconDatabase />}>저장 상태 보기</ActionLabel>
                  </a>
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: 4,
                      border: "1px solid rgba(255,255,255,.10)",
                      borderRadius: 12,
                      background: "rgba(0,0,0,.18)",
                    }}
                  >
                    <SegTabButton active={importMode === "merge"} onClick={() => setImportMode("merge")}>
                      병합
                    </SegTabButton>
                    <SegTabButton active={importMode === "overwrite"} onClick={() => setImportMode("overwrite")}>
                      덮어쓰기
                    </SegTabButton>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      fileRef.current?.click();
                      setDataMenuOpen(false);
                    }}
                  >
                    <ActionLabel icon={<IconFile />}>JSON 파일 선택</ActionLabel>
                  </button>
                  <textarea
                    className="textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="모바일에서는 백업 JSON을 복사해서 여기에 붙여넣고 불러오세요."
                    style={{ minHeight: 100 }}
                  />
                  <button className="btn" onClick={handleImportText}>
                    <ActionLabel icon={<IconClipboard />}>붙여넣기 불러오기</ActionLabel>
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
