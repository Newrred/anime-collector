import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { minihomeUiEnabled, publicationUiEnabled } from "../runtime/platformPublication.js";
import MemoryQuickSharing from './MemoryQuickSharing.jsx';
import MemoryPublicCardControl from "./MemoryPublicCardControl.jsx";

export default function MemorySharingSettings({ card, locale, base, disabled }) {
  const ko = locale === "ko", auth = useAuthSession(), enabled = publicationUiEnabled();
  const canPublish = enabled && card.ownerId === `account:${auth.user?.id}` && card.sync?.remoteVersion > 0;
  return <section className="memory-sharing" aria-label={ko ? "공개 범위" : "Visibility"}>
    <div className="memory-sharing__heading"><h2>{ko ? "공개 범위" : "Visibility"}</h2><span>{ko ? "원본은 비공개" : "Original is private"}</span></div>
    {canPublish && <MemoryQuickSharing key={card.ownerId+card.id} card={card} locale={locale} base={base} disabled={disabled}/>}
    <details><summary>{ko ? "보드·미니홈 상세 설정" : "Board and home settings"}</summary>
      <p>{ko ? "여러 기억을 함께 공개하려면 보드를 이용하세요. 원본과 카드 태그는 비공개로 보관됩니다." : "Use a Board to share several memories together. Originals and memory tags stay private."}</p>
      {!enabled ? <p>{ko ? "현재 이 환경에서는 공개 게시를 사용할 수 없어요." : "Public publishing is unavailable in this environment."}</p> : !canPublish ? <p>{ko ? "로그인 후 이 기억을 계정에 연동하면 공개를 준비할 수 있어요." : "Sign in and sync this memory to prepare sharing."}</p> : <>
        <p>{ko ? "공개된 사본의 상태는 보드·미니홈에서 확인해 주세요." : "Check Boards and your public home for the status of published copies."}</p>
        <div className="memory-sharing__links"><a href={`${base}boards/`} data-astro-reload>{ko ? "보드 공개 설정 →" : "Board sharing →"}</a>{minihomeUiEnabled() && <a href={`${base}minihome/`} data-astro-reload>{ko ? "미니홈 공개 설정 →" : "Public home settings →"}</a>}</div>
        <MemoryPublicCardControl card={card} locale={locale} disabled={disabled} />
      </>}
    </details>
  </section>;
}
