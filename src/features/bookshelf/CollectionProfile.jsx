import { useEffect, useState } from "react";
import { getPublicationServices, minihomeUiEnabled } from "../memory/runtime/platformPublication.js";
import { minihomeStatus, minihomeLink } from "../memory/domain/minihomeView.js";
export default function CollectionProfile({ userId, locale, base, onEdit, disabled = false }) {
  const [home, setHome] = useState(null), [error, setError] = useState(false);
  const enabled = minihomeUiEnabled();
  const [loading, setLoading] = useState(Boolean(userId && enabled)), [retry, setRetry] = useState(0);
  useEffect(() => {
    setHome(null); setError(false); setLoading(Boolean(userId && enabled));
    if (!userId || !enabled) return;
    const abort = new AbortController(), services = getPublicationServices();
    const timer = setTimeout(() => { abort.abort(); setError(true); setLoading(false); }, 20000);
    services.gateway.getHome({ signal: abort.signal }).then(value => {
      if (!abort.signal.aborted) setHome(minihomeStatus(value));
    }).catch(() => { if (!abort.signal.aborted) setError(true); }).finally(() => { clearTimeout(timer); if (!abort.signal.aborted) setLoading(false); });
    return () => { clearTimeout(timer); abort.abort(); };
  }, [userId, enabled, retry]);
  const ko = locale === "ko";
  return <div className="collection-profile">
    {home?.selection?.nickname && <strong>{home.selection.nickname}</strong>}
    {home?.selection?.bio && <p>{home.selection.bio}</p>}
    <span role={loading || error ? "status" : undefined}>{loading ? (ko ? "공개 상태 확인 중…" : "Checking sharing status…") : error ? (ko ? "공개 상태 확인 실패" : "Sharing status unavailable") : !enabled ? (ko ? "비공개 컬렉션 · 현재 공개할 수 없습니다" : "Private collection · sharing unavailable") : home?.published ? home.hidden || home.visible === false ? (ko ? "현재 방문자에게 표시되지 않습니다" : "Not currently visible to visitors") : (ko ? "공개 컬렉션" : "Public collection") : (ko ? "비공개 컬렉션" : "Private collection")}</span>
    {error && <button type="button" className="channel-text-button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>{ko ? "상태 다시 확인" : "Retry sharing status"}</button>}
    {userId && enabled && onEdit && <button type="button" className="channel-text-button" disabled={disabled || loading} onClick={onEdit}>{ko ? "소개·공개 설정" : "Edit profile and sharing"}</button>}
    {home?.published && !home.hidden && home.visible !== false && <a href={minihomeLink(home.id,base)}>{ko ? "방문자 화면 보기 ↗" : "View public collection ↗"}</a>}
  </div>;
}
