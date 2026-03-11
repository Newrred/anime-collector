import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { isIdbSupported } from "../storage/idb";
import { readLibraryListPreferred } from "../repositories/libraryRepo";
import { readTierStatePreferred } from "../repositories/tierRepo";
import { readAllWatchLogsSnapshot } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred } from "../repositories/characterPinRepo";

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n.toFixed(0)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DataCenter() {
  const [loading, setLoading] = useState(true);
  const [engine, setEngine] = useState("확인 중");
  const [usage, setUsage] = useState(null);
  const [quota, setQuota] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [message, setMessage] = useState("");
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
      setEngine(isIdbSupported() ? "IndexedDB + local mirror" : "legacy localStorage 제한 모드");

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

      await refreshStorageHealth();
      if (!alive) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function requestPersist() {
    if (typeof navigator === "undefined" || !navigator.storage) {
      setMessage("현재 브라우저에서는 저장 보호 API를 지원하지 않습니다.");
      return;
    }
    if (typeof navigator.storage.persist !== "function") {
      setMessage("persist 요청을 지원하지 않는 브라우저입니다.");
      return;
    }
    try {
      const ok = await navigator.storage.persist();
      setPersisted(Boolean(ok));
      setMessage(ok ? "이 기기에서 저장 보호가 활성화되었습니다." : "저장 보호 요청이 허용되지 않았습니다.");
      await refreshStorageHealth();
    } catch {
      setMessage("저장 보호 요청 중 오류가 발생했습니다.");
    }
  }

  const usageRatio = useMemo(() => {
    if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null;
    return Math.min(100, Math.max(0, (usage / quota) * 100));
  }, [usage, quota]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section
        style={{
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.03)",
          borderRadius: 8,
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px" }}>데이터 센터</h1>
          <p className="small" style={{ margin: 0, opacity: 0.85 }}>
            저장 상태와 용량을 점검하고, 장치 저장 보호 상태를 확인합니다.
          </p>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="small">저장 엔진: {engine}</div>
          <div className="small">
            저장 보호: {persisted == null ? "확인 중" : persisted ? "활성" : "비활성"}
          </div>
          <button type="button" className="btn" onClick={requestPersist} style={{ width: "fit-content" }}>
            이 기기 저장 보호 요청
          </button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small">
            사용량: {formatBytes(usage)} / {formatBytes(quota)}
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
            <div className="small" style={{ opacity: 0.8 }}>라이브러리 항목</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.library}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>티어 보드 항목</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.tierPlaced}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>기억 로그 수</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.watchLogs}</div>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>캐릭터 핀 수</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts.characterPins}</div>
          </div>
        </div>

        {message && <div className="small" style={{ opacity: 0.9 }}>{message}</div>}
        {loading && <div className="small" style={{ opacity: 0.8 }}>저장 상태를 확인하는 중...</div>}
      </section>
    </div>
  );
}
