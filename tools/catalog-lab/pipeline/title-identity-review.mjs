import { readFileSync } from 'node:fs';
import { sha256 } from '../lib/hash.mjs';
import { identityTitleKey, seasonSignals } from './title-identity-signals.mjs';

const registry = JSON.parse(readFileSync(new URL('../config/title-identity-reviews.json', import.meta.url), 'utf8'));
const reviews = new Map(registry.records.map((row) => [row.targetKey, row]));
if (reviews.size !== registry.records.length) throw new Error('Duplicate title identity review');
const values = (field) => field?.state === 'VALUE' && Array.isArray(field.value) ? field.value : [];
const primary = (canonical) => values(canonical.titles).filter((row) => ['en', 'ja', 'ja-Latn'].includes(row.locale));
const sameTitle = (a, b) => a.locale === b.locale && identityTitleKey(a.value) === identityTitleKey(b.value);

export function reviewedTitleIdentity(target, canonical) {
  const review = reviews.get(target.targetKey);
  if (!review) return null;
  if (review.animeId !== canonical.id || review.expectedCanonicalHash !== canonical.revision?.contentHash
    || review.expectedSeedTitlesHash !== sha256(target.seedTitles)
    || review.scope !== 'TITLE_BINDING_ONLY' || !review.reviewedBy || !review.rationale
    || !review.evidence.primaryTitles.length
    || !review.evidence.primaryTitles.every((row) => primary(canonical).some((title) => sameTitle(row, title)))
    || !review.preferredTitle?.value
    || (review.preferredTitle.locale !== 'ko' && !primary(canonical).some((row) => sameTitle(row, review.preferredTitle)))) {
    const error = new Error(`Title identity review is stale or invalid: ${target.targetKey}`);
    error.code = 'TITLE_IDENTITY_REVIEW_STALE';
    throw error;
  }
  return structuredClone({ ...review, reviewHash: sha256(review) });
}

export function hasRelatedTitleConflict(target, canonical, preferredTitle, searchTitles = []) {
  const own = primary(canonical);
  const ownKeys = new Set(own.map((row) => identityTitleKey(row.value)));
  const relations = values(canonical.relations).filter((row) =>
    ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY', 'OTHER'].includes(row.type)
      && /^anilist:\d+$/.test(row.targetId));
  const candidates = [...(target.seedTitles || []), ...searchTitles, ...(preferredTitle ? [preferredTitle] : [])];
  if (candidates.some((row) => !ownKeys.has(identityTitleKey(row.value))
    && relations.some((relation) => identityTitleKey(relation.title) === identityTitleKey(row.value)))) return true;
  const ownSignals = new Set(own.flatMap((row) => seasonSignals(row.value)));
  return own.length > 0 && candidates.some((row) => seasonSignals(row.value).some((signal) => !ownSignals.has(signal)
    && relations.some((relation) => seasonSignals(relation.title).includes(signal))));
}

export function applyTitleIdentityReview(titles, review) {
  if (!review) return titles;
  const rejected = new Set(review.excludedTitles.map((row) => identityTitleKey(row.value)));
  const allowed = (row) => !rejected.has(identityTitleKey(row.value));
  const searchTitles = [review.preferredTitle, ...titles.searchTitles.filter(allowed)]
    .filter((row, index, all) => all.findIndex((other) => sameTitle(row, other)) === index);
  const quarantinedTitles = [...titles.quarantinedTitles, ...review.excludedTitles.map((row) => ({
    ...row, reasonCode: review.decision === 'QUARANTINE_AMBIGUOUS_ALIAS'
      ? 'REVIEWED_AMBIGUOUS_TITLE' : 'REVIEWED_OTHER_WORK_TITLE',
  }))].filter((row, index, all) => all.findIndex((other) => sameTitle(row, other)) === index);
  return { ...titles, preferredTitle: review.preferredTitle, searchTitles, quarantinedTitles,
    autoAcceptedTitleAliases: titles.autoAcceptedTitleAliases.filter(allowed),
    usedFallback: review.koreanTitlePending, fallbackReasonCode: review.koreanTitlePending ? 'REVIEWED_SPECIFIC_ORIGINAL_TITLE' : null };
}
