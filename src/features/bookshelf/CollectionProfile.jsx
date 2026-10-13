import { useEffect, useState } from "react";
import { getPublicationServices, minihomeUiEnabled } from "../memory/runtime/platformPublication.js";
import { minihomeStatus, minihomeLink } from "../memory/domain/minihomeView.js";
export default function CollectionProfile({ userId, locale, base }) {
  const [home, setHome] = useState(null), [error, setError] = useState(false);
  useEffect(() => {
    setHome(null); setError(false);
    if (!userId || !minihomeUiEnabled()) return;
    const abort = new AbortController(), services = getPublicationServices();
    const timer = setTimeout(() => abort.abort(), 20000);
    services.gateway.getHome({ signal: abort.signal }).then(value => {
      if (!abort.signal.aborted) setHome(minihomeStatus(value));
    }).catch(() => { if (!abort.signal.aborted) setError(true); }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); abort.abort(); };
  }, [userId]);
  const ko = locale === "ko";
  return <div className="collection-profile">
    {home?.selection?.nickname && <strong>{home.selection.nickname}</strong>}
    {home?.selection?.bio && <p>{home.selection.bio}</p>}
    <span>{error ? (ko ? "공개 상태 확인 실패" : "Sharing status unavailable") : !minihomeUiEnabled() ? (ko ? "비공개 컬렉션 · 공개 기능 준비 중" : "Private collection · sharing unavailable") : home?.published && !home.hidden && home.visible !== false ? (ko ? "공개 컬렉션" : "Public collection") : (ko ? "비공개 컬렉션" : "Private collection")}</span>
    {home?.published && !home.hidden && home.visible !== false && <a href={minihomeLink(home.id,base)}>{ko ? "방문자 화면 보기 ↗" : "View public collection ↗"}</a>}
  </div>;
}
