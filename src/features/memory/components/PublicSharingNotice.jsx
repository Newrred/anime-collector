import { publicSharingNoticeHref } from '../domain/publicSharingPolicy.js';
export default function PublicSharingNotice({ revision, locale, base = '/' }) {
  const href = publicSharingNoticeHref(revision, base), ko = locale === 'ko';
  return href ? <p className="memory-publication__notice">
    <a href={href + (ko ? '#ko' : '#en')} target="_blank" rel="noopener noreferrer">{ko ? '공개 안내 · 권리 및 신고 처리 (새 탭)' : 'Public sharing · rights and reporting (new tab)'}</a>
    <small>{revision}</small>
  </p> : <p role="alert">{ko ? '이 정책 버전의 공개 안내를 확인할 수 없어 새 게시를 진행할 수 없어요. 비공개 전환은 계속 사용할 수 있어요.' : 'The public notice for this policy version is unavailable. New publication is disabled; saving as private remains available.'}</p>;
}
