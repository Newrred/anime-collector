const ERROR_CODES = new Set(['ADMIN_REQUIRED', 'ADMIN_INVALID_REQUEST', 'ADMIN_REVISION_CONFLICT',
  'ADMIN_ACTIVATION_REQUIRED', 'ADMIN_RELEASE_NOT_READY', 'ADMIN_CONFIGURATION_UNAVAILABLE']);

export function adminErrorCode(error) {
  return ERROR_CODES.has(error?.message) ? error.message : 'ADMIN_UNAVAILABLE';
}

function invalid() { throw new Error('ADMIN_UNAVAILABLE'); }
function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
function flag(value) { return typeof value === 'boolean' ? value : invalid(); }
function identifier(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value) ? value : invalid();
}
function date(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : invalid();
}
function list(value, limit, parse) {
  if (!Array.isArray(value) || value.length > limit) invalid();
  return value.map(parse);
}
function totals(value, keys) {
  return Object.fromEntries(keys.map(key => [key, count(value?.[key])]));
}
function states(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 30) invalid();
  return Object.fromEntries(Object.entries(value).map(([key, value]) => [identifier(key), count(value)]));
}

// Project only the aggregate RPC contract. Never pass arbitrary server fields or URLs into the UI.
export function parseAdminStatus(value) {
  if (value?.version !== 1 || !/^[a-f0-9]{64}$/.test(value.revision || '')) invalid();
  const signup = value.signup, costs = value.costs;
  if (!signup || !costs) invalid();
  const countries = list(signup.countries, 250, row => {
    if (!/^[A-Z]{2}$/.test(row?.country || '') || !Number.isInteger(row.minimumAge)
      || row.minimumAge < 13 || row.minimumAge > 20) invalid();
    return {country: row.country, minimumAge: row.minimumAge};
  });
  if (new Set(countries.map(row => row.country)).size !== countries.length) invalid();
  return {
    version: 1, revision: value.revision, checkedAt: date(value.checkedAt),
    signup: {
      enabled: flag(signup.enabled), admissionEnabled: flag(signup.admissionEnabled),
      canPause: flag(signup.canPause), canResume: flag(signup.canResume), readyForResume: flag(signup.readyForResume),
      policyVersion: identifier(signup.policyVersion), termsVersion: identifier(signup.termsVersion),
      privacyVersion: identifier(signup.privacyVersion), countries,
    },
    counts: totals(value.counts, ['accounts', 'receipts', 'pendingAdmissions', 'pendingHandoffs']),
    images: {
      private: {...totals(value.images?.private, ['reservedBytes', 'due', 'waiting', 'orphaned']), states: states(value.images?.private?.states)},
      public: {...totals(value.images?.public, ['reservedBytes']), states: states(value.images?.public?.states)},
    },
    publication: Object.fromEntries(['readsEnabled', 'writesEnabled', 'reportsEnabled'].map(key => [key, flag(value.publication?.[key])])),
    moderation: {enabled: flag(value.moderation?.enabled), reports: totals(value.moderation?.reports, ['received', 'appealed', 'closed'])},
    costs: {
      ...totals(costs, ['privateStorageLimitBytes', 'privateMonthlyReadLimitBytes', 'privateMonthlyReadBytes']),
      publicStorageLimitBytes: costs.publicStorageLimitBytes === null ? null : count(costs.publicStorageLimitBytes),
      privateObservedAt: costs.privateObservedAt === null ? null : date(costs.privateObservedAt),
      policies: list(costs.policies, 100, row => ({scope: identifier(row.scope), enabled: flag(row.enabled), paused: flag(row.paused),
        dailyLimit: count(row.dailyLimit), liveLimit: row.liveLimit === null ? null : count(row.liveLimit)})),
      usage: list(costs.usage, 100, row => ({scope: identifier(row.scope), used: count(row.used)})),
    },
    audit: list(value.audit, 20, row => {
      if (!['SIGNUP_PAUSED', 'SIGNUP_RESUMED'].includes(row?.action)) invalid();
      return {action: row.action, createdAt: date(row.createdAt), enabledBefore: flag(row.enabledBefore), enabledAfter: flag(row.enabledAfter)};
    }),
  };
}

export function createAdminService(client) {
  async function request(name, params) {
    if (!client?.rpc) throw new Error('ADMIN_UNAVAILABLE');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const request = client.rpc(name, params);
      const {data, error} = await (typeof request?.abortSignal === 'function' ? request.abortSignal(controller.signal) : request);
      if (error) throw error;
      return parseAdminStatus(data);
    } catch (error) {
      throw new Error(adminErrorCode(error));
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    read: () => request('get_moemoa_admin_status'),
    setPaused: (revision, paused) => {
      if (!/^[a-f0-9]{64}$/.test(revision || '') || typeof paused !== 'boolean') return Promise.reject(new Error('ADMIN_INVALID_REQUEST'));
      return request('set_moemoa_signup_paused', {p_expected_revision: revision, p_paused: paused});
    },
  };
}

// A session or newer request invalidates older responses, including a late successful mutation.
export function createAdminRequestScope() {
  let revision = 0;
  return {next: () => ++revision, current: ticket => ticket === revision, invalidate: () => { revision++; }};
}
