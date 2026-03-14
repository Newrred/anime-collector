import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { isIdbSupported } from "../storage/idb";
import { readLibraryListPreferred } from "../repositories/libraryRepo";
import { readTierStatePreferred } from "../repositories/tierRepo";
import { readAllWatchLogsSnapshot } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred } from "../repositories/characterPinRepo";
import { readLastExportAtMs } from "../repositories/backupRepo";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatBackupAgo, formatStatusToggleLabel, pickByLocale } from "../domain/uiText";

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n.toFixed(0)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DataCenter() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = pickByLocale(locale, {
    ko: {
      checking: "확인 중",
      storageEngineIndexed: "IndexedDB + local mirror",
      storageEngineLegacy: "legacy localStorage 제한 모드",
      persistUnsupported: "현재 브라우저에서는 저장 보호 API를 지원하지 않습니다.",
      persistMethodUnsupported: "persist 요청을 지원하지 않는 브라우저입니다.",
      persistEnabled: "이 기기에서 저장 보호가 활성화되었습니다.",
      persistRejected: "저장 보호 요청이 허용되지 않았습니다.",
      persistFailed: "저장 보호 요청 중 오류가 발생했습니다.",
      title: "데이터 관리",
      lead: "이 앱의 기록은 이 기기에 저장돼요. 필요할 때 백업 파일로 꺼낼 수 있어요.",
      storedHere: "저장 상태: 이 기기에 저장됨",
      storageProtect: "저장 보호:",
      engine: "저장 엔진:",
      requestProtect: "이 기기 저장 보호 요청",
      usage: "사용량:",
      libraryCount: "보관 작품 수",
      tierCount: "티어에 올린 작품 수",
      logCount: "감상 기록 수",
      pinCount: "고정한 캐릭터 수",
      loading: "저장 상태를 확인하는 중...",
    },
    en: {
      checking: "Checking",
      storageEngineIndexed: "IndexedDB + local mirror",
      storageEngineLegacy: "Legacy localStorage fallback",
      persistUnsupported: "This browser does not support the storage persistence API.",
      persistMethodUnsupported: "This browser cannot request persistence.",
      persistEnabled: "Storage protection is enabled on this device.",
      persistRejected: "The storage protection request was not granted.",
      persistFailed: "Failed while requesting storage protection.",
      title: "Data Center",
      lead: "This app keeps your records on this device. You can export them as backup files when needed.",
      storedHere: "Storage: saved on this device",
      storageProtect: "Storage protect:",
      engine: "Engine:",
      requestProtect: "Request storage protection",
      usage: "Usage:",
      libraryCount: "Anime in library",
      tierCount: "Anime placed in tier",
      logCount: "Watch logs",
      pinCount: "Pinned characters",
      loading: "Checking storage status...",
    },
  });
  const [loading, setLoading] = useState(true);
  const [engine, setEngine] = useState(copy.checking);
  const [usage, setUsage] = useState(null);
  const [quota, setQuota] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [message, setMessage] = useState("");
  const [lastBackupMs, setLastBackupMs] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [counts, setCounts] = useState({
    library: 0,
    tierPlaced: 0,
    watchLogs: 0,
    characterPins: 0,
  });

  async function refreshStorageHealth() {
    try {
      if (typeof navigator === "undefined" || !navigator.storage) return;
      const estimate = await navigator.storage.estimate();
      if (Number.isFinite(estimate?.usage)) setUsage(Number(estimate.usage));
      if (Number.isFinite(estimate?.quota)) setQuota(Number(estimate.quota));
      if (typeof navigator.storage.persisted === "function") {
        const ok = await navigator.storage.persisted();
        setPersisted(Boolean(ok));
      }
    } catch {
      // noop
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setEngine(isIdbSupported() ? copy.storageEngineIndexed : copy.storageEngineLegacy);

      const [list, tier, pins] = await Promise.all([
        readLibraryListPreferred(myListSeed).catch(() => myListSeed),
        readTierStatePreferred(null).catch(() => null),
        listCharacterPinsPreferred().catch(() => []),
      ]);
      const logs = readAllWatchLogsSnapshot();

      if (!alive) return;
      const tierPlaced =
        (Array.isArray(tier?.unranked) ? tier.unranked.length : 0) +
        Object.values(tier?.tiers || {}).reduce(
          (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
          0
        );
      setCounts({
        library: Array.isArray(list) ? list.length : 0,
        tierPlaced,
        watchLogs: Array.isArray(logs) ? logs.length : 0,
        characterPins: Array.isArray(pins) ? pins.length : 0,
      });
      setLastBackupMs(readLastExportAtMs());

      await refreshStorageHealth();
      if (!alive) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [copy.storageEngineIndexed, copy.storageEngineLegacy]);

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

  async function requestPersist() {
    if (typeof navigator === "undefined" || !navigator.storage) {
      setMessage(copy.persistUnsupported);
      return;
    }
    if (typeof navigator.storage.persist !== "function") {
      setMessage(copy.persistMethodUnsupported);
      return;
    }
    try {
      const ok = await navigator.storage.persist();
      setPersisted(Boolean(ok));
      setMessage(ok ? copy.persistEnabled : copy.persistRejected);
      await refreshStorageHealth();
    } catch {
      setMessage(copy.persistFailed);
    }
  }

  const usageRatio = useMemo(() => {
    if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null;
    return Math.min(100, Math.max(0, (usage / quota) * 100));
  }, [usage, quota]);

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") return;
    try {
      await window.__promptPwaInstall();
    } catch {}
  }

  return (
    <div className="data-grid">
      <TopNavDataMenu
        base={base}
        panelId="data-center-menu-panel"
        canInstallPwa={canInstallPwa}
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || ((locale === "ko") ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onInstallPwa={onClickInstallPwa}
      />
      <section className="status-panel">
        <div className="pageHeader" style={{ marginBottom: 0 }}>
          <h1 className="pageTitle">{copy.title}</h1>
          <p className="pageLead">{copy.lead}</p>
        </div>

        <div className="status-badge-row">
          <span className="small status-badge">{copy.storedHere}</span>
          <span className="small status-badge">{formatBackupAgo(lastBackupMs, locale)}</span>
          <span className="small status-badge">
            {copy.storageProtect} {formatStatusToggleLabel(persisted, locale)}
          </span>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="small">{copy.engine} {engine}</div>
          <button type="button" className="btn" onClick={requestPersist} style={{ width: "fit-content" }}>
            {copy.requestProtect}
          </button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small">
            {copy.usage} {formatBytes(usage)} / {formatBytes(quota)}
            {usageRatio == null ? "" : ` (${usageRatio.toFixed(1)}%)`}
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
            <div
              style={{
                width: `${usageRatio == null ? 0 : usageRatio}%`,
                height: "100%",
                background: "rgba(120,220,255,.85)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>{copy.libraryCount}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.library}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>{copy.tierCount}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.tierPlaced}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>{copy.logCount}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.watchLogs}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>{copy.pinCount}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.characterPins}</div>
          </div>
        </div>

        {message && <div className="small" style={{ opacity: 0.9 }}>{message}</div>}
        {loading && <div className="small" style={{ opacity: 0.8 }}>{copy.loading}</div>}
      </section>
    </div>
  );
}
