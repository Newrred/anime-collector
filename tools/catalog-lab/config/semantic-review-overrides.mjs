export const SEMANTIC_REVIEW_POLICY_VERSION = 'SEMANTIC_REVIEW_V1';

// Human-reviewed queue entries. A missing replacement is intentionally not guessed.
export const SEMANTIC_REVIEW_OVERRIDES = Object.freeze({
  titleReviews: Object.freeze({
    'ANILIST:204432': Object.freeze({ reasonCode: 'INCOMPLETE_LEGACY_KOREAN_TITLE' }),
  }),
});
