import { useEffect, useRef, useState } from "react";

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
      {children}
    </button>
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
      // Error messaging is handled in parent callbacks.
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
            유틸
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
              <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, background: "rgba(0,0,0,.18)" }}>
                <SegTabButton active={dataTab === "export"} onClick={() => setDataTab("export")}>내보내기</SegTabButton>
                <SegTabButton active={dataTab === "import"} onClick={() => setDataTab("import")}>불러오기</SegTabButton>
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
                    JSON 파일 저장
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (typeof onExportMobile === "function") await onExportMobile();
                      setDataMenuOpen(false);
                    }}
                  >
                    모바일 공유/복사
                  </button>
                  {canInstallPwa && (
                    <button
                      className="btn"
                      onClick={async () => {
                        if (typeof onInstallPwa === "function") await onInstallPwa();
                        setDataMenuOpen(false);
                      }}
                    >
                      홈 화면 설치
                    </button>
                  )}
                  <a
                    href={`${base}data/`}
                    className="btn"
                    style={{ textAlign: "center", textDecoration: "none" }}
                    onClick={() => setDataMenuOpen(false)}
                  >
                    저장 상태 보기
                  </a>
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6, padding: 4, border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, background: "rgba(0,0,0,.18)" }}>
                    <SegTabButton active={importMode === "merge"} onClick={() => setImportMode("merge")}>병합</SegTabButton>
                    <SegTabButton active={importMode === "overwrite"} onClick={() => setImportMode("overwrite")}>덮어쓰기</SegTabButton>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      fileRef.current?.click();
                      setDataMenuOpen(false);
                    }}
                  >
                    JSON 파일 선택
                  </button>
                  <textarea
                    className="textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="모바일에서는 백업 JSON을 복사해서 여기에 붙여넣고 불러오세요."
                    style={{ minHeight: 100 }}
                  />
                  <button className="btn" onClick={handleImportText}>
                    붙여넣기 불러오기
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
