export const SEMANTIC_AUTOMATION_POLICY_VERSION = 'SEMANTIC_AUTOMATION_V2';

// Known anomalies can force the same automatic fallback used by the general shape heuristic.
export const SEMANTIC_AUTOMATION_OVERRIDES = Object.freeze({
  titleFallbacks: Object.freeze({
    'ANILIST:204432': Object.freeze({ reasonCode: 'KNOWN_INCOMPLETE_LEGACY_KOREAN_TITLE' }),
  }),
});
