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
import { formatBackupAgo, formatStatusToggleLabel } from "../domain/uiText";
import { getMessageGroup } from "../domain/messages.js";
import { IconShield } from "./ui/AppIcons.jsx";

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
  const copy = getMessageGroup(locale, "dataCenter");
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
        currentRoute="data"
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || ((locale === "ko") ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onInstallPwa={onClickInstallPwa}
      />
      <section className="status-panel surface-card">
        <div className="pageHeader">
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

        <div className="list-stack">
          <div className="small">{copy.engine} {engine}</div>
          <button type="button" className="btn btn--subtle" onClick={requestPersist} style={{ width: "fit-content" }}>
            <span className="btn__icon"><IconShield /></span>
            <span className="btn__label">{copy.requestProtect}</span>
          </button>
        </div>

        <div className="list-stack">
          <div className="small">
            {copy.usage} {formatBytes(usage)} / {formatBytes(quota)}
            {usageRatio == null ? "" : ` (${usageRatio.toFixed(1)}%)`}
          </div>
          <div className="progress-meter">
            <div
              className="progress-meter__fill"
              style={{ width: `${usageRatio == null ? 0 : usageRatio}%` }}
            />
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-card__label">{copy.libraryCount}</div>
            <div className="metric-card__value">{counts.library}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card__label">{copy.tierCount}</div>
            <div className="metric-card__value">{counts.tierPlaced}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card__label">{copy.logCount}</div>
            <div className="metric-card__value">{counts.watchLogs}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card__label">{copy.pinCount}</div>
            <div className="metric-card__value">{counts.characterPins}</div>
          </div>
        </div>

        {message && <div className="small page-feedback">{message}</div>}
        {loading && <div className="small page-feedback">{copy.loading}</div>}
      </section>
    </div>
  );
}
