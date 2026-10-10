// Synthetic aggregates only; this fixture neither activates a release nor grants a real role.
export function adminFixture() {
  return {
    version: 1, checkedAt: '2026-10-10T09:00:00Z', revision: 'a'.repeat(64),
    signup: {enabled: true, admissionEnabled: true, policyVersion: 'simple-signup-2026-10-10-test',
      termsVersion: 'terms-2026-10-10-test', privacyVersion: 'privacy-2026-10-10-test',
      countries: [{country: 'KR', minimumAge: 14}, {country: 'PH', minimumAge: 13}, {country: 'TH', minimumAge: 13}],
      canPause: true, canResume: false, readyForResume: true},
    counts: {accounts: 12, receipts: 10, pendingAdmissions: 0, pendingHandoffs: 0},
    images: {private: {states: {READY: 2}, reservedBytes: 1024, due: 0, waiting: 0, orphaned: 0}, public: {states: {}, reservedBytes: 0}},
    publication: {readsEnabled: false, writesEnabled: false, reportsEnabled: false},
    moderation: {enabled: true, reports: {received: 0, appealed: 0, closed: 0}},
    costs: {policies: [{scope: 'PUBLIC_PUBLISH', enabled: true, paused: false, dailyLimit: 10, liveLimit: null}], usage: [],
      privateStorageLimitBytes: 104857600, privateMonthlyReadLimitBytes: 1048576000, privateObservedAt: null,
      privateMonthlyReadBytes: 0, publicStorageLimitBytes: 20971520},
    audit: [],
  };
}
