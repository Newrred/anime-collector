// Use the existing account/Google flow. Never create a receipt from a public checkbox.
export default function PublicSignupNotice({ error, locale = 'ko', base = '/', follow = false }) {
  if (error !== 'PUBLIC_SIGNUP_REQUIRED') return null;
  const next = typeof window === 'undefined' ? `${base}boards/` : `${window.location.pathname}${window.location.search}`;
  return <p className="memory-publication__signup">
    <a data-astro-reload href={`${base}auth/start/?next=${encodeURIComponent(next)}`}>
      {locale === 'ko' ? '현재 계정의 가입 정보 확인' : 'Review signup details for this account'}
    </a>{' '}
    {locale === 'ko'
      ? follow ? '같은 Google 계정으로 이어간 뒤 돌아와 팔로우를 선택하세요. 차단과 팔로우 해제는 그대로 사용할 수 있습니다.' : '같은 Google 계정으로 이어가세요. 확인 후 돌아와 공개할 내용을 다시 선택합니다. 기존 기억과 공개 철회는 그대로 사용할 수 있습니다.'
      : follow ? 'Continue with the same Google account, then return to choose Follow. Blocking and unfollowing remain available.' : 'Continue with the same Google account, then return to review what to publish. Existing memories and withdrawal remain available.'}
  </p>;
}
