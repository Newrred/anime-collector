import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { followsUiEnabled, getPublicationServices } from "../runtime/platformPublication.js";
import { minihomeLink } from "../domain/minihomeView.js";
import { isPublicationId } from "../domain/publicationView.js";

function Relationships({ userId, homeId, locale, base }) {
  const ko = locale === "ko", services = getPublicationServices();
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [blocked, setBlocked] = useState(false), [refresh, setRefresh] = useState(0);
  const request = useRef(null);
  async function run(action, id = homeId, after = null) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setBusy(true); setError(false);
    try {
      if ((await services.getSession())?.user?.id !== userId) throw new Error();
      if (action) await services.gateway.setRelationship(id, action, { signal: controller.signal });
      const result = homeId ? await services.gateway.relationship(homeId, { signal: controller.signal })
        : await services.gateway.relationships(blocked, after, { signal: controller.signal });
      const currentUser = (await services.getSession())?.user?.id;
      if (controller.signal.aborted || currentUser !== userId) throw new Error();
      if (homeId) {
        if (!result || ["self", "following", "blocked"].some((k) => typeof result[k] !== "boolean")) throw new Error();
      } else if (!Array.isArray(result?.items) || result.items.length > 20 || result.items.some((r) => !isPublicationId(r.id)
        || typeof r.available !== "boolean" || (r.nickname !== null && typeof r.nickname !== "string")) || (result.next !== null && !isPublicationId(result.next))) throw new Error();
      setData((old) => after ? { ...result, items: [...new Map([...(old?.items || []), ...result.items].map((r) => [r.id, r])).values()] } : result);
    } catch { if (request.current === controller) { setError(true); setData(null); } }
    finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  useEffect(() => {
    setData(null); run();
    return () => { request.current?.abort(); request.current = null; };
  }, [userId, homeId, blocked, refresh]);
  const act = (action, id) => {
    if (action === "block" && !confirm(ko ? "양방향 팔로우를 해제하고 차단할까요?" : "Block and remove follows in both directions?")) return;
    run(action, id);
  };
  const button = (action, label, id) => <button type="button" className="btn btn--subtle" disabled={busy} onClick={() => act(action, id)}>{label}</button>;
  return <section aria-label={ko ? "팔로우와 차단" : "Follows and blocks"} aria-busy={busy}>
    {!homeId && <><h2>{ko ? "내 팔로우 목록" : "My following"}</h2><button className="btn btn--subtle" disabled={busy} onClick={() => setBlocked((v) => !v)}>{blocked ? (ko ? "팔로우 목록" : "Show following") : (ko ? "차단 목록" : "Show blocked")}</button></>}
    {error && <p role="alert">{ko ? "처리하지 못했습니다. 상태를 새로 확인해 주세요." : "Unable to complete. Refresh to check the current state."}</p>}
    {homeId && data && !data.self && <>{!data.blocked && button(data.following ? "unfollow" : "follow", data.following ? (ko ? "팔로우 해제" : "Unfollow") : (ko ? "팔로우" : "Follow"))}{button(data.blocked ? "unblock" : "block", data.blocked ? (ko ? "차단 해제" : "Unblock") : (ko ? "차단" : "Block"))}</>}
    {homeId && <a href={`${base}minihome/#following`}>{ko ? "내 팔로우 목록" : "My following"}</a>}
    {!homeId && data && <ul>{data.items.map((row) => <li key={row.id}>{row.available && !blocked ? <a href={minihomeLink(row.id, base)}>{row.nickname}</a> : <span>{row.available ? row.nickname : (ko ? "표시할 수 없는 미니홈" : "Home unavailable")}</span>}{button(blocked ? "unblock" : "unfollow", blocked ? (ko ? "차단 해제" : "Unblock") : (ko ? "팔로우 해제" : "Unfollow"), row.id)}</li>)}</ul>}
    {!homeId && data?.items.length === 0 && <p>{ko ? "목록이 비어 있습니다." : "Your list is empty."}</p>}
    {!homeId && data?.next && <button className="btn btn--subtle" disabled={busy} onClick={() => run(null, null, data.next)}>{ko ? "더 보기" : "Load more"}</button>}
    <button className="btn btn--subtle" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>{ko ? "관계 새로고침" : "Refresh relationships"}</button>
    <p>{ko ? "차단하면 서로의 팔로우가 해제됩니다. 해제해도 자동 복구되지 않습니다. 공개 자료는 비회원에게 계속 보일 수 있습니다." : "Blocking removes both follows. Unblocking does not restore them. Public content may still be viewed without signing in."}</p>
  </section>;
}
export default function MemoryRelationships({ homeId, locale, base = "/" }) {
  const auth = useAuthSession(), [failed, setFailed] = useState(false);
  if (!followsUiEnabled() || auth.loading) return null;
  if (!auth.user) return <section>{failed && <p role="alert">{locale === "ko" ? "로그인을 시작하지 못했습니다." : "Unable to start sign-in."}</p>}<button className="btn" onClick={() => auth.signIn(homeId ? minihomeLink(homeId, base) : `${base}minihome/#following`).catch(() => setFailed(true))}>{locale === "ko" ? "로그인 후 팔로우" : "Sign in to follow"}</button></section>;
  return <Relationships key={`${auth.user.id}:${homeId || "list"}`} userId={auth.user.id} homeId={homeId} locale={locale} base={base} />;
}
