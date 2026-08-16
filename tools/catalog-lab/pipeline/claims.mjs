import { sha256, stableStringify } from '../lib/hash.mjs';
import { SOURCE_PROMOTION_POLICY } from '../contracts/catalogContracts.mjs';
import {
  CANONICAL_FIELD_PATHS,
  COLLECTION_FIELD_PATHS,
  deepFrozenSnapshot,
  isAniLifeIdentityEvidence,
  isExactIsoTimestamp,
  isNormalizedFieldValue,
  isPlainRecord,
  normalizeSourceRecord,
} from './normalize.mjs';
import { CONFIDENCE_CLASSES, resolveIdentity } from './identity.mjs';

const CLAIM_KEYS = Object.freeze([
  'catalogPromotion', 'claimId', 'confidenceClass', 'contentIntegrity', 'entityId', 'entityType', 'fieldPath',
  'normalizedValue', 'rawValue', 'retrievedAt', 'reviewedAt', 'reviewedBy', 'ruleId',
  'sourceId', 'sourceRecordId', 'status',
]);
const NORMALIZED_META_KEYS = Object.freeze([
  'fieldStates', 'fieldValues', 'identityEvidence', 'releaseYear', 'releaseYearEvidence', 'retrievedAt',
  'sourceEntityId', 'sourceId', 'sourceRecordId', 'targetKey',
]);
const CLAIM_STATUSES = Object.freeze(['VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED']);
const PROMOTION_VALUES = Object.freeze([...new Set(Object.values(SOURCE_PROMOTION_POLICY))]);
const SOURCE_IDS = Object.freeze(['anilist', 'wikidata', 'anilife_public']);
const CLAIM_INTEGRITY_VERSION = 'FIELD_CLAIM_CONTENT_V1';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hasExactKeys(value, keys) {
  return isPlainRecord(value)
    && stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort());
}

function frozenSnapshot(value, code) {
  return deepFrozenSnapshot(value, {
    code, message: `${code} input is not immutable JSON data`,
  });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function claimOrder(left, right) {
  return compareText(left.fieldPath, right.fieldPath)
    || compareText(stableStringify(left.normalizedValue), stableStringify(right.normalizedValue))
    || compareText(stableStringify(left.rawValue), stableStringify(right.rawValue))
    || compareText(left.sourceId, right.sourceId)
    || compareText(left.sourceRecordId, right.sourceRecordId)
    || compareText(left.claimId, right.claimId);
}

function normalizedInvalid() {
  return typedError('NORMALIZED_RECORD_INVALID', 'Normalized record does not match its schema');
}

function validIdentityEvidence(record) {
  if (record.identityEvidence === null) return true;
  return record.sourceId === 'anilife_public'
    && isAniLifeIdentityEvidence(record.identityEvidence, {
      targetKey: record.targetKey, contentId: record.sourceEntityId,
    });
}

function normalizedSourceBindingValid(record) {
  const targetAniListId = record.targetKey.match(/^ANILIST:([1-9]\d*)$/u)?.[1];
  if (!targetAniListId) return false;
  const wholeStatuses = new Set(record.fieldValues.map((field) => field.status));
  const wholeAbsence = wholeStatuses.size === 1 && !wholeStatuses.has('VALUE');
  if (record.sourceId === 'anilist') {
    return !wholeAbsence && record.externalIds.some((value) => value.sourceId === 'anilist'
      && value.value === record.sourceEntityId);
  }
  if (record.sourceId === 'wikidata') {
    if (wholeAbsence) {
      return wholeStatuses.has('SOURCE_NOT_AVAILABLE')
        && record.sourceEntityId === `P8729:${targetAniListId}`;
    }
    return /^Q[1-9]\d*$/u.test(record.sourceEntityId)
      && record.externalIds.some((value) => value.sourceId === 'wikidata'
        && value.value === record.sourceEntityId)
      && record.externalIds.some((value) => value.sourceId === 'anilist'
        && value.value === targetAniListId);
  }
  if (record.sourceId === 'anilife_public') {
    if (wholeAbsence) return wholeStatuses.has('NOT_FETCHED') && record.sourceEntityId === 'UNBOUND';
    return /^[1-9]\d*$/u.test(record.sourceEntityId)
      && record.externalIds.some((value) => value.sourceId === 'anilife_public'
        && value.value === record.sourceEntityId);
  }
  return false;
}

function validSummary(record, fieldPath) {
  const state = record.fieldStates[fieldPath];
  const value = record[fieldPath];
  if (COLLECTION_FIELD_PATHS.includes(fieldPath)) {
    return Array.isArray(value) && value.every((entry) => isNormalizedFieldValue(fieldPath, entry))
      && (state === 'VALUE' ? value.length > 0 : value.length === 0);
  }
  if (state === 'VALUE') return isNormalizedFieldValue(fieldPath, value);
  return value === null;
}

/** Validates the persisted normalized-record boundary before identity or claim creation. */
export function validateNormalizedRecord(input) {
  const record = frozenSnapshot(input, 'NORMALIZED_RECORD_INVALID');
  const expectedKeys = [...NORMALIZED_META_KEYS, ...CANONICAL_FIELD_PATHS];
  if (!hasExactKeys(record, expectedKeys) || !SOURCE_IDS.includes(record.sourceId)
    || typeof record.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(record.sourceRecordId)
    || typeof record.targetKey !== 'string' || !record.targetKey
    || typeof record.sourceEntityId !== 'string' || !record.sourceEntityId
    || !isExactIsoTimestamp(record.retrievedAt)
    || !validIdentityEvidence(record)
    || !Array.isArray(record.releaseYearEvidence)
    || record.releaseYearEvidence.some((year) => !Number.isSafeInteger(year) || year < 1000 || year > 9999)
    || stableStringify(record.releaseYearEvidence) !== stableStringify([...new Set(record.releaseYearEvidence)].sort((a, b) => a - b))
    || (record.releaseYear !== null && (!Number.isSafeInteger(record.releaseYear)
      || record.releaseYearEvidence.length !== 1 || record.releaseYear !== record.releaseYearEvidence[0]))
    || (record.releaseYear === null && record.releaseYearEvidence.length === 1)
    || !hasExactKeys(record.fieldStates, CANONICAL_FIELD_PATHS)
    || Object.values(record.fieldStates).some((state) => !['VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED', 'CONFLICTED'].includes(state))
    || CANONICAL_FIELD_PATHS.some((fieldPath) => !validSummary(record, fieldPath))
    || !Array.isArray(record.fieldValues) || record.fieldValues.length < CANONICAL_FIELD_PATHS.length) {
    throw normalizedInvalid();
  }
  const pathsSeen = new Set();
  const valuesByPath = new Map(CANONICAL_FIELD_PATHS.map((fieldPath) => [fieldPath, []]));
  for (const field of record.fieldValues) {
    if (!hasExactKeys(field, ['fieldPath', 'normalizedValue', 'rawValue', 'status'])
      || !CANONICAL_FIELD_PATHS.includes(field.fieldPath) || !CLAIM_STATUSES.includes(field.status)
      || (field.status === 'VALUE' && !isNormalizedFieldValue(field.fieldPath, field.normalizedValue))
      || (field.status !== 'VALUE' && field.normalizedValue !== null)) {
      throw normalizedInvalid();
    }
    pathsSeen.add(field.fieldPath);
    valuesByPath.get(field.fieldPath).push(field);
  }
  if (pathsSeen.size !== CANONICAL_FIELD_PATHS.length
    || CANONICAL_FIELD_PATHS.some((fieldPath) => !pathsSeen.has(fieldPath))) throw normalizedInvalid();
  for (const fieldPath of CANONICAL_FIELD_PATHS) {
    const rows = valuesByPath.get(fieldPath);
    const valueRows = rows.filter((row) => row.status === 'VALUE');
    const distinctValues = new Set(valueRows.map((row) => stableStringify(row.normalizedValue)));
    if (valueRows.length > 0) {
      if (distinctValues.size !== valueRows.length) throw normalizedInvalid();
      if (COLLECTION_FIELD_PATHS.includes(fieldPath)) {
        const summaryValues = new Set(record[fieldPath].map((value) => stableStringify(value)));
        if (record.fieldStates[fieldPath] !== 'VALUE' || summaryValues.size !== record[fieldPath].length
          || stableStringify([...summaryValues].sort()) !== stableStringify([...distinctValues].sort())) {
          throw normalizedInvalid();
        }
      } else if (distinctValues.size === 1) {
        if (record.fieldStates[fieldPath] !== 'VALUE'
          || stableStringify(record[fieldPath]) !== [...distinctValues][0]) throw normalizedInvalid();
      } else if (record.fieldStates[fieldPath] !== 'CONFLICTED' || record[fieldPath] !== null) {
        throw normalizedInvalid();
      }
    } else if (rows.length !== 1 || rows[0].status !== record.fieldStates[fieldPath]) {
      throw normalizedInvalid();
    }
  }
  if (!normalizedSourceBindingValid(record)) throw normalizedInvalid();
  return record;
}

function claimInvalid() {
  return typedError('FIELD_CLAIM_INVALID', 'FieldClaim does not match its schema');
}

function claimContent(claim) {
  const { contentIntegrity, ...content } = claim;
  return content;
}

function claimContentHash(content) {
  return sha256({ version: CLAIM_INTEGRITY_VERSION, content });
}

/** Validates FieldClaim schema/checksum drift; source authentication requires authenticateFieldClaims(). */
export function validateFieldClaim(input) {
  const claim = frozenSnapshot(input, 'FIELD_CLAIM_INVALID');
  if (!hasExactKeys(claim, CLAIM_KEYS) || claim.entityType !== 'Anime'
    || typeof claim.entityId !== 'string' || !claim.entityId
    || !CANONICAL_FIELD_PATHS.includes(claim.fieldPath)
    || !CLAIM_STATUSES.includes(claim.status)
    || !CONFIDENCE_CLASSES.includes(claim.confidenceClass)
    || !PROMOTION_VALUES.includes(claim.catalogPromotion)
    || typeof claim.ruleId !== 'string' || !claim.ruleId
    || typeof claim.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(claim.sourceRecordId)
    || !isExactIsoTimestamp(claim.retrievedAt)
    || !((claim.reviewedAt === null && claim.reviewedBy === null)
      || (isExactIsoTimestamp(claim.reviewedAt) && typeof claim.reviewedBy === 'string' && claim.reviewedBy))) {
    throw claimInvalid();
  }
  const policy = SOURCE_PROMOTION_POLICY[claim.sourceId];
  if (!SOURCE_IDS.includes(claim.sourceId) || !policy || policy !== claim.catalogPromotion) {
    throw typedError('FIELD_CLAIM_SOURCE_POLICY_INVALID', 'FieldClaim source promotion policy is invalid');
  }
  const expectedId = sha256([
    claim.entityId, claim.fieldPath, claim.normalizedValue, claim.sourceRecordId,
  ]);
  if (claim.claimId !== expectedId) {
    throw typedError('FIELD_CLAIM_ID_INVALID', 'FieldClaim deterministic ID is invalid');
  }
  if (!hasExactKeys(claim.contentIntegrity, ['algorithm', 'contentHash', 'version'])
    || claim.contentIntegrity.version !== CLAIM_INTEGRITY_VERSION
    || claim.contentIntegrity.algorithm !== 'SHA-256'
    || !/^[a-f0-9]{64}$/u.test(claim.contentIntegrity.contentHash)
    || claim.contentIntegrity.contentHash !== claimContentHash(claimContent(claim))) {
    throw typedError('FIELD_CLAIM_INTEGRITY_INVALID', 'FieldClaim full-content integrity is invalid');
  }
  if ((claim.status === 'VALUE' && !isNormalizedFieldValue(claim.fieldPath, claim.normalizedValue))
    || (claim.status !== 'VALUE' && claim.normalizedValue !== null)) {
    throw claimInvalid();
  }
  return claim;
}

/** Builds deterministic immutable source claims. Conflict state is derived only in canonical revisions. */
export function buildFieldClaims(input) {
  const request = frozenSnapshot(input, 'FIELD_CLAIM_INPUT_INVALID');
  if (!hasExactKeys(request, ['normalizedRecords', 'target'])) {
    throw typedError('FIELD_CLAIM_INPUT_INVALID', 'FieldClaim input is invalid');
  }
  const targetSnapshot = request.target;
  const recordInputs = request.normalizedRecords;
  if (!isPlainRecord(targetSnapshot) || typeof targetSnapshot.moemoaAnimeId !== 'string'
    || !targetSnapshot.moemoaAnimeId || typeof targetSnapshot.targetKey !== 'string'
    || !targetSnapshot.targetKey || !Array.isArray(recordInputs)) {
    throw typedError('FIELD_CLAIM_INPUT_INVALID', 'FieldClaim input is invalid');
  }
  const records = recordInputs.map((record) => {
    return validateNormalizedRecord(record);
  });
  const claimsById = new Map();
  for (const record of records) {
    const identity = resolveIdentity({
      target: targetSnapshot, candidate: record, sourceId: record.sourceId, referenceRecords: records,
    });
    if (identity.status !== 'MATCHED') continue;
    for (const field of record.fieldValues) {
      const normalizedValue = structuredClone(field.normalizedValue);
      const content = {
        claimId: sha256([targetSnapshot.moemoaAnimeId, field.fieldPath, normalizedValue, record.sourceRecordId]),
        entityType: 'Anime',
        entityId: targetSnapshot.moemoaAnimeId,
        fieldPath: field.fieldPath,
        rawValue: structuredClone(field.rawValue),
        normalizedValue,
        sourceId: record.sourceId,
        sourceRecordId: record.sourceRecordId,
        catalogPromotion: SOURCE_PROMOTION_POLICY[record.sourceId],
        ruleId: identity.ruleId,
        confidenceClass: identity.confidenceClass,
        status: field.status,
        retrievedAt: record.retrievedAt,
        reviewedAt: null,
        reviewedBy: null,
      };
      const claim = {
        ...content,
        contentIntegrity: {
          version: CLAIM_INTEGRITY_VERSION,
          algorithm: 'SHA-256',
          contentHash: claimContentHash(content),
        },
      };
      validateFieldClaim(claim);
      const existing = claimsById.get(claim.claimId);
      if (existing && stableStringify(existing) !== stableStringify(claim)) {
        throw typedError('FIELD_CLAIM_ID_COLLISION', 'Deterministic FieldClaim ID maps to different content');
      }
      if (!existing) claimsById.set(claim.claimId, claim);
    }
  }
  return frozenSnapshot([...claimsById.values()].sort(claimOrder), 'FIELD_CLAIM_INVALID');
}

function uniquePersistedClaims(claims) {
  const byId = new Map();
  for (const claim of claims) {
    if (!isPlainRecord(claim) || typeof claim.claimId !== 'string') throw claimInvalid();
    const existing = byId.get(claim.claimId);
    if (existing && stableStringify(existing) !== stableStringify(claim)) {
      throw typedError('FIELD_CLAIM_ID_COLLISION', 'Deterministic FieldClaim ID maps to different content');
    }
    if (!existing) byId.set(claim.claimId, validateFieldClaim(claim));
  }
  return [...byId.values()].sort(claimOrder);
}

function uniqueNormalizedRecords(records, code) {
  const byId = new Map();
  for (const record of records) {
    const existing = byId.get(record.sourceRecordId);
    if (existing && stableStringify(existing) !== stableStringify(record)) {
      throw typedError(code, 'SourceRecord identity maps to different normalized content');
    }
    if (!existing) byId.set(record.sourceRecordId, record);
  }
  return [...byId.values()].sort((left, right) => compareText(left.sourceRecordId, right.sourceRecordId));
}

/**
 * Rebuilds claims from caller-trusted immutable SourceRecords and compares every persisted layer.
 * FieldClaim contentIntegrity is a drift checksum; this reconstruction is the trust decision.
 */
export function authenticateFieldClaims(input) {
  const request = frozenSnapshot(input, 'FIELD_CLAIM_AUTH_INPUT_INVALID');
  if (!hasExactKeys(request, ['fieldClaims', 'normalizedRecords', 'sourceRecords', 'target'])
    || !Array.isArray(request.sourceRecords) || request.sourceRecords.length === 0
    || !Array.isArray(request.normalizedRecords) || !Array.isArray(request.fieldClaims)) {
    throw typedError('FIELD_CLAIM_AUTH_INPUT_INVALID', 'Authenticated FieldClaim input is invalid');
  }
  const rebuiltRecords = uniqueNormalizedRecords(
    request.sourceRecords.map((sourceRecord) => normalizeSourceRecord(sourceRecord)),
    'SOURCE_RECORD_AUTHENTICATION_INVALID',
  );
  const persistedRecords = uniqueNormalizedRecords(
    request.normalizedRecords.map((record) => validateNormalizedRecord(record)),
    'NORMALIZED_RECORD_AUTHENTICATION_INVALID',
  );
  if (stableStringify(persistedRecords) !== stableStringify(rebuiltRecords)) {
    throw typedError('NORMALIZED_RECORD_AUTHENTICATION_INVALID',
      'Normalized records do not match trusted SourceRecords');
  }
  const rebuiltClaims = buildFieldClaims({ target: request.target, normalizedRecords: rebuiltRecords });
  const persistedClaims = uniquePersistedClaims(request.fieldClaims);
  if (stableStringify(persistedClaims) !== stableStringify(rebuiltClaims)) {
    throw typedError('FIELD_CLAIM_AUTHENTICATION_INVALID',
      'FieldClaims do not match claims rebuilt from trusted SourceRecords');
  }
  return rebuiltClaims;
}
