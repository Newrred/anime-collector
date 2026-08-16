import { sha256, stableStringify } from '../lib/hash.mjs';
import sourceRegistry from '../config/source-registry.json' with { type: 'json' };
import {
  CANONICAL_FIELD_PATHS,
  COLLECTION_FIELD_PATHS,
  isNormalizedFieldValue,
  isPlainRecord,
} from './normalize.mjs';
import { CONFIDENCE_CLASSES, resolveIdentity } from './identity.mjs';

const CLAIM_KEYS = Object.freeze([
  'catalogPromotion', 'claimId', 'confidenceClass', 'entityId', 'entityType', 'fieldPath',
  'normalizedValue', 'rawValue', 'retrievedAt', 'reviewedAt', 'reviewedBy', 'ruleId',
  'sourceId', 'sourceRecordId', 'status',
]);
const NORMALIZED_META_KEYS = Object.freeze([
  'fieldStates', 'fieldValues', 'releaseYear', 'releaseYearEvidence', 'retrievedAt',
  'sourceEntityId', 'sourceId', 'sourceRecordId', 'targetKey',
]);
const CLAIM_STATUSES = Object.freeze(['VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED']);
const PROMOTION_VALUES = Object.freeze(['PROHIBITED', 'FIELD_REVIEW_REQUIRED']);
const SOURCE_IDS = Object.freeze(['anilist', 'wikidata', 'anilife_public']);

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hasExactKeys(value, keys) {
  return isPlainRecord(value)
    && stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort());
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

function frozenSnapshot(value, code) {
  if (!jsonSafe(value)) throw typedError(code, `${code} input is not immutable JSON data`);
  return deepFreeze(structuredClone(value));
}

function policyConfig() {
  if (!Array.isArray(sourceRegistry)) {
    throw typedError('CATALOG_CONFIG_INVALID', 'Source registry must be an array');
  }
  const rows = sourceRegistry.filter((row) => SOURCE_IDS.includes(row?.sourceId));
  const policies = new Map();
  for (const row of rows) {
    if (!isPlainRecord(row) || row.status !== 'approved' || !PROMOTION_VALUES.includes(row.catalogPromotion)
      || policies.has(row.sourceId)) {
      throw typedError('CATALOG_CONFIG_INVALID', 'Source registry promotion policy is invalid');
    }
    policies.set(row.sourceId, row.catalogPromotion);
  }
  if (policies.size !== SOURCE_IDS.length || SOURCE_IDS.some((sourceId) => !policies.has(sourceId))) {
    throw typedError('CATALOG_CONFIG_INVALID', 'Source registry is missing an approved pipeline source');
  }
  return policies;
}

const POLICY_BY_SOURCE = policyConfig();

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

function validIsoTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && new Date(value).toISOString() === value;
}

function normalizedInvalid() {
  return typedError('NORMALIZED_RECORD_INVALID', 'Normalized record does not match its schema');
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
export function validateNormalizedRecord(record) {
  const expectedKeys = [...NORMALIZED_META_KEYS, ...CANONICAL_FIELD_PATHS];
  if (!hasExactKeys(record, expectedKeys) || !SOURCE_IDS.includes(record.sourceId)
    || typeof record.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(record.sourceRecordId)
    || typeof record.targetKey !== 'string' || !record.targetKey
    || typeof record.sourceEntityId !== 'string' || !record.sourceEntityId
    || !validIsoTimestamp(record.retrievedAt)
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
      || !jsonSafe(field.rawValue) || !jsonSafe(field.normalizedValue)
      || (field.status === 'VALUE' && !isNormalizedFieldValue(field.fieldPath, field.normalizedValue))
      || (field.status !== 'VALUE' && (field.rawValue !== null || field.normalizedValue !== null))) {
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
      if (valueRows.length !== rows.length || distinctValues.size !== valueRows.length) throw normalizedInvalid();
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

/** Validates a persisted FieldClaim, including its authoritative policy and deterministic ID. */
export function validateFieldClaim(claim) {
  if (!hasExactKeys(claim, CLAIM_KEYS) || claim.entityType !== 'Anime'
    || typeof claim.entityId !== 'string' || !claim.entityId
    || !CANONICAL_FIELD_PATHS.includes(claim.fieldPath)
    || !CLAIM_STATUSES.includes(claim.status)
    || !CONFIDENCE_CLASSES.includes(claim.confidenceClass)
    || !PROMOTION_VALUES.includes(claim.catalogPromotion)
    || typeof claim.ruleId !== 'string' || !claim.ruleId
    || typeof claim.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(claim.sourceRecordId)
    || !validIsoTimestamp(claim.retrievedAt)
    || !jsonSafe(claim.rawValue) || !jsonSafe(claim.normalizedValue)
    || !((claim.reviewedAt === null && claim.reviewedBy === null)
      || (validIsoTimestamp(claim.reviewedAt) && typeof claim.reviewedBy === 'string' && claim.reviewedBy))) {
    throw claimInvalid();
  }
  const policy = POLICY_BY_SOURCE.get(claim.sourceId);
  if (!policy || policy !== claim.catalogPromotion) {
    throw typedError('FIELD_CLAIM_SOURCE_POLICY_INVALID', 'FieldClaim source promotion policy is invalid');
  }
  const expectedId = sha256([
    claim.entityId, claim.fieldPath, claim.normalizedValue, claim.sourceRecordId,
  ]);
  if (claim.claimId !== expectedId) {
    throw typedError('FIELD_CLAIM_ID_INVALID', 'FieldClaim deterministic ID is invalid');
  }
  if ((claim.status === 'VALUE' && !isNormalizedFieldValue(claim.fieldPath, claim.normalizedValue))
    || (claim.status !== 'VALUE' && (claim.rawValue !== null || claim.normalizedValue !== null))) {
    throw claimInvalid();
  }
  return claim;
}

/** Builds deterministic immutable source claims. Conflict state is derived only in canonical revisions. */
export function buildFieldClaims({ target, normalizedRecords }) {
  if (!isPlainRecord(target) || typeof target.moemoaAnimeId !== 'string' || !target.moemoaAnimeId
    || typeof target.targetKey !== 'string' || !target.targetKey || !Array.isArray(normalizedRecords)) {
    throw typedError('FIELD_CLAIM_INPUT_INVALID', 'FieldClaim input is invalid');
  }
  const records = normalizedRecords.map((record) => {
    const snapshot = frozenSnapshot(record, 'NORMALIZED_RECORD_INVALID');
    validateNormalizedRecord(snapshot);
    return snapshot;
  });
  const claimsById = new Map();
  for (const record of records) {
    const identity = resolveIdentity({
      target, candidate: record, sourceId: record.sourceId, referenceRecords: records,
    });
    if (identity.status !== 'MATCHED') continue;
    for (const field of record.fieldValues) {
      const normalizedValue = structuredClone(field.normalizedValue);
      const claim = {
        claimId: sha256([target.moemoaAnimeId, field.fieldPath, normalizedValue, record.sourceRecordId]),
        entityType: 'Anime',
        entityId: target.moemoaAnimeId,
        fieldPath: field.fieldPath,
        rawValue: structuredClone(field.rawValue),
        normalizedValue,
        sourceId: record.sourceId,
        sourceRecordId: record.sourceRecordId,
        catalogPromotion: POLICY_BY_SOURCE.get(record.sourceId),
        ruleId: identity.ruleId,
        confidenceClass: identity.confidenceClass,
        status: field.status,
        retrievedAt: record.retrievedAt,
        reviewedAt: null,
        reviewedBy: null,
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
