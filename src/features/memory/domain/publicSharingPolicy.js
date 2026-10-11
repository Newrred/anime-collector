// Published notice paths are immutable. Never substitute a different policy for an unknown revision.
export const PUBLIC_SHARING_POLICY_REVISION = 'MOEMOA_PUBLIC_GENERAL_20261011_01';
export function publicSharingNoticeHref(revision, base = '/') {
  if (revision !== PUBLIC_SHARING_POLICY_REVISION) return null;
  return base.replace(/\/?$/, '/') + 'legal/public-sharing-2026-10-11/';
}
