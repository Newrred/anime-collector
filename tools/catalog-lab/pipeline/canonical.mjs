import { sha256, stableStringify } from '../lib/hash.mjs';
import { CANONICAL_FIELD_PATHS, COLLECTION_FIELD_PATHS, isPlainRecord } from './normalize.mjs';
import { validateFieldClaim } from './claims.mjs';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function totalOrder(parts) {
  return (left, right) => {
    for (const part of parts) {
      const result = compareText(String(part(left) ?? ''), String(part(right) ?? ''));
      if (result) return result;
    }
    return compareText(stableStringify(left), stableStringify(right));
  };
}

const GENERIC_ORDER = totalOrder([]);

function collectionOrder(fieldPath) {
  if (fieldPath === 'titles') return totalOrder([(value) => value.locale, (value) => value.value]);
  if (fieldPath === 'externalIds') return totalOrder([(value) => value.sourceId, (value) => value.value]);
  if (fieldPath === 'studios') return totalOrder([(value) => value.id, (value) => value.name, (value) => value.role]);
  if (fieldPath === 'relations') return totalOrder([(value) => value.targetId, (value) => value.type]);
  if (fieldPath === 'characters') return totalOrder([(value) => value.role, (value) => value.id]);
  if (fieldPath === 'castings') return totalOrder([
    (value) => value.characterId, (value) => value.personId, (value) => value.language,
  ]);
  return GENERIC_ORDER;
}

function collectionNaturalKey(fieldPath, value) {
  if (fieldPath === 'externalIds') return stableStringify([value.sourceId]);
  if (fieldPath === 'titles') return stableStringify([value.locale, value.value]);
  if (fieldPath === 'studios') return stableStringify([value.id]);
  if (fieldPath === 'relations') return stableStringify([value.targetId, value.type]);
  if (fieldPath === 'sourceGenres' || fieldPath === 'coreGenres') return stableStringify([value]);
  if (fieldPath === 'characters') return stableStringify([value.id]);
  if (fieldPath === 'castings') {
    return stableStringify([value.characterId, value.personId, value.language]);
  }
  return stableStringify(value);
}

function uniqueSorted(values, comparator) {
  const byValue = new Map();
  for (const value of values) {
    const key = stableStringify(value);
    if (!byValue.has(key)) byValue.set(key, value);
  }
  return [...byValue.values()].sort(comparator);
}

function absentState(claims) {
  return claims.some((claim) => claim.status === 'SOURCE_NOT_AVAILABLE')
    ? 'SOURCE_NOT_AVAILABLE' : 'NOT_FETCHED';
}

function collectionFieldValue(fieldPath, claims) {
  const values = uniqueSorted(
    claims.filter((claim) => claim.status === 'VALUE').map((claim) => claim.normalizedValue),
    collectionOrder(fieldPath),
  );
  if (values.length === 0) return { state: absentState(claims), value: [] };
  const groups = new Map();
  for (const value of values) {
    const key = collectionNaturalKey(fieldPath, value);
    const variants = groups.get(key) ?? new Set();
    variants.add(stableStringify(value));
    groups.set(key, variants);
  }
  const conflicted = [...groups.values()].some((variants) => variants.size > 1);
  return conflicted ? { state: 'CONFLICTED', values } : { state: 'VALUE', value: values };
}

function scalarFieldValue(claims) {
  const values = uniqueSorted(
    claims.filter((claim) => claim.status === 'VALUE').map((claim) => claim.normalizedValue),
    GENERIC_ORDER,
  );
  if (values.length > 1) return { state: 'CONFLICTED', values };
  if (values.length === 1) return { state: 'VALUE', value: values[0] };
  return { state: absentState(claims), value: null };
}

function fieldValue(fieldPath, claims) {
  return COLLECTION_FIELD_PATHS.includes(fieldPath)
    ? collectionFieldValue(fieldPath, claims) : scalarFieldValue(claims);
}

function provenanceFor(fieldPath, claims) {
  const rows = [...claims].sort((left, right) => compareText(left.claimId, right.claimId)
    || compareText(stableStringify(left), stableStringify(right)));
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

function jsonSafe(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  let valid;
  if (Array.isArray(value)) {
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      seen.delete(value);
      return false;
    }
    valid = Reflect.ownKeys(value).every((key) => typeof key === 'string')
      && Object.keys(value).length === value.length
      && Object.entries(descriptors).every(([key, descriptor]) => key === 'length'
        || ('value' in descriptor && /^\d+$/u.test(key)))
      && Object.keys(value).every((key) => jsonSafe(descriptors[key].value, seen));
  } else {
    valid = isPlainRecord(value) && Object.values(Object.getOwnPropertyDescriptors(value))
      .every((descriptor) => jsonSafe(descriptor.value, seen));
  }
  seen.delete(value);
  return valid;
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function frozenSnapshot(value) {
  if (!jsonSafe(value)) throw typedError('FIELD_CLAIM_INVALID', 'Claims must be immutable JSON data');
  return deepFreeze(structuredClone(value));
}

/** Rebuilds a complete deterministic CanonicalAnime revision without overwriting conflicts. */
export function buildCanonicalRevision(inputClaims) {
  if (!Array.isArray(inputClaims) || inputClaims.length === 0) {
    throw typedError('CANONICAL_CLAIMS_REQUIRED', 'Canonical revision requires at least one FieldClaim');
  }
  const claims = frozenSnapshot(inputClaims);
  const claimsById = new Map();
  for (const claim of claims) {
    const existing = claimsById.get(claim.claimId);
    if (existing && stableStringify(existing) !== stableStringify(claim)) {
      throw typedError('FIELD_CLAIM_ID_COLLISION', 'Deterministic FieldClaim ID maps to different content');
    }
    validateFieldClaim(claim);
    if (!existing) claimsById.set(claim.claimId, claim);
  }
  const uniqueClaims = [...claimsById.values()];
  const entityIds = new Set(uniqueClaims.map((claim) => claim.entityId));
  if (entityIds.size !== 1) {
    throw typedError('CANONICAL_ENTITY_CONFLICT', 'Canonical revision claims must address one entity');
  }
  const byField = new Map(CANONICAL_FIELD_PATHS.map((fieldPath) => [fieldPath, []]));
  for (const claim of uniqueClaims) byField.get(claim.fieldPath).push(claim);
  const prohibited = uniqueClaims.some((claim) => claim.catalogPromotion === 'PROHIBITED');
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
  return frozenSnapshot({
    ...core,
    revision: { algorithm: 'SHA-256', contentHash: sha256(core) },
  });
}
