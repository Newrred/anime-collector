import { sha256, stableStringify } from '../lib/hash.mjs';
import { CANONICAL_FIELD_PATHS, COLLECTION_FIELD_PATHS } from './normalize.mjs';

const PROHIBITED_SOURCES = new Set(['anilist', 'anilife_public']);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function genericOrder(left, right) {
  return compareText(stableStringify(left), stableStringify(right));
}

function collectionOrder(fieldPath) {
  if (fieldPath === 'titles') return (left, right) => compareText(left.locale, right.locale)
    || compareText(left.value, right.value);
  if (fieldPath === 'externalIds') return (left, right) => compareText(left.sourceId, right.sourceId)
    || compareText(left.value, right.value);
  if (fieldPath === 'relations') return (left, right) => compareText(left.targetId, right.targetId)
    || compareText(left.type, right.type);
  if (fieldPath === 'characters') return (left, right) => compareText(left.role, right.role)
    || compareText(left.id, right.id);
  if (fieldPath === 'castings') return (left, right) => compareText(left.characterId, right.characterId)
    || compareText(left.personId, right.personId);
  return genericOrder;
}

function uniqueSorted(values, comparator) {
  const byValue = new Map(values.map((value) => [stableStringify(value), value]));
  return [...byValue.values()].sort(comparator);
}

function fieldValue(fieldPath, claims) {
  const valueClaims = claims.filter((claim) => claim.status === 'VALUE' || claim.status === 'CONFLICTED');
  const values = uniqueSorted(valueClaims.map((claim) => claim.normalizedValue),
    COLLECTION_FIELD_PATHS.includes(fieldPath) ? collectionOrder(fieldPath) : genericOrder);
  if (COLLECTION_FIELD_PATHS.includes(fieldPath)) {
    return values.length > 0 ? { state: 'VALUE', value: values }
      : { state: claims.some((claim) => claim.status === 'SOURCE_NOT_AVAILABLE')
        ? 'SOURCE_NOT_AVAILABLE' : 'NOT_FETCHED', value: [] };
  }
  if (values.length > 1 || valueClaims.some((claim) => claim.status === 'CONFLICTED')) {
    return { state: 'CONFLICTED', values };
  }
  if (values.length === 1) return { state: 'VALUE', value: values[0] };
  return {
    state: claims.some((claim) => claim.status === 'SOURCE_NOT_AVAILABLE')
      ? 'SOURCE_NOT_AVAILABLE' : 'NOT_FETCHED',
    value: null,
  };
}

function provenanceFor(fieldPath, claims) {
  const rows = [...claims].sort((left, right) => compareText(left.claimId, right.claimId));
  return {
    fieldPath,
    claimIds: rows.map((claim) => claim.claimId),
    claims: rows.map((claim) => ({
      claimId: claim.claimId,
      sourceId: claim.sourceId,
      sourceRecordId: claim.sourceRecordId,
      catalogPromotion: claim.catalogPromotion,
      ruleId: claim.ruleId,
      confidenceClass: claim.confidenceClass,
      status: claim.status,
      retrievedAt: claim.retrievedAt,
    })),
  };
}

/** Rebuilds a complete deterministic CanonicalAnime revision from claims without overwriting conflicts. */
export function buildCanonicalRevision(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    const error = new Error('Canonical revision requires at least one FieldClaim');
    error.code = 'CANONICAL_CLAIMS_REQUIRED';
    throw error;
  }
  const claimsById = new Map();
  for (const claim of claims) {
    const existing = claimsById.get(claim?.claimId);
    if (existing && stableStringify(existing) !== stableStringify(claim)) {
      const error = new Error('Deterministic FieldClaim ID maps to different content');
      error.code = 'FIELD_CLAIM_ID_COLLISION';
      throw error;
    }
    if (!existing) claimsById.set(claim?.claimId, claim);
  }
  const uniqueClaims = [...claimsById.values()];
  const entityIds = new Set(uniqueClaims.map((claim) => claim?.entityId));
  if (entityIds.size !== 1 || entityIds.has(undefined)) {
    const error = new Error('Canonical revision claims must address one entity');
    error.code = 'CANONICAL_ENTITY_CONFLICT';
    throw error;
  }
  const byField = new Map(CANONICAL_FIELD_PATHS.map((fieldPath) => [fieldPath, []]));
  for (const claim of uniqueClaims) {
    if (!byField.has(claim.fieldPath)) continue;
    byField.get(claim.fieldPath).push(claim);
  }
  const prohibited = uniqueClaims.some((claim) => PROHIBITED_SOURCES.has(claim.sourceId));
  const core = {
    id: [...entityIds][0],
    ...Object.fromEntries(CANONICAL_FIELD_PATHS.map((fieldPath) => [
      fieldPath, fieldValue(fieldPath, byField.get(fieldPath)),
    ])),
    fieldProvenance: CANONICAL_FIELD_PATHS.map((fieldPath) => (
      provenanceFor(fieldPath, byField.get(fieldPath))
    )),
    reviewState: prohibited ? 'TEST_ONLY' : 'PENDING_REVIEW',
    distributionStatus: prohibited ? 'PROHIBITED' : 'CC0',
  };
  return Object.freeze({
    ...core,
    revision: Object.freeze({ algorithm: 'SHA-256', contentHash: sha256(core) }),
  });
}
