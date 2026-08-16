import { sha256, stableStringify } from '../lib/hash.mjs';
import { COLLECTION_FIELD_PATHS } from './normalize.mjs';
import { resolveIdentity } from './identity.mjs';

const CATALOG_PROMOTION = Object.freeze({
  anilist: 'PROHIBITED',
  anilife_public: 'PROHIBITED',
  wikidata: 'FIELD_REVIEW_REQUIRED',
});

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function claimOrder(left, right) {
  return compareText(left.fieldPath, right.fieldPath)
    || compareText(stableStringify(left.normalizedValue), stableStringify(right.normalizedValue))
    || compareText(left.sourceId, right.sourceId)
    || compareText(left.sourceRecordId, right.sourceRecordId)
    || compareText(left.claimId, right.claimId);
}

/** Builds deterministic source-addressable claims and marks scalar disagreements as conflicts. */
export function buildFieldClaims({ target, normalizedRecords }) {
  if (!target || typeof target.moemoaAnimeId !== 'string' || !Array.isArray(normalizedRecords)) {
    const error = new Error('FieldClaim input is invalid');
    error.code = 'FIELD_CLAIM_INPUT_INVALID';
    throw error;
  }
  const claimsById = new Map();
  for (const record of normalizedRecords) {
    let identity = resolveIdentity({
      target, candidate: record, sourceId: record?.sourceId, referenceRecords: normalizedRecords,
    });
    const absenceOnly = record?.targetKey === target.targetKey
      && Array.isArray(record.fieldValues) && record.fieldValues.length > 0
      && record.fieldValues.every((field) => (
        field.status === 'SOURCE_NOT_AVAILABLE' || field.status === 'NOT_FETCHED'
      ));
    if (identity.status !== 'MATCHED' && absenceOnly) {
      identity = {
        status: 'MATCHED', confidenceClass: 'EXACT_ID', ruleId: 'SOURCE_TARGET_BINDING_V1',
      };
    }
    if (identity.status !== 'MATCHED') continue;
    for (const field of record.fieldValues ?? []) {
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
        catalogPromotion: CATALOG_PROMOTION[record.sourceId] ?? 'PROHIBITED',
        ruleId: identity.ruleId,
        confidenceClass: identity.confidenceClass,
        status: field.status,
        retrievedAt: record.retrievedAt,
        reviewedAt: null,
        reviewedBy: null,
      };
      const existing = claimsById.get(claim.claimId);
      if (existing && stableStringify(existing) !== stableStringify(claim)) {
        const error = new Error('Deterministic FieldClaim ID maps to different content');
        error.code = 'FIELD_CLAIM_ID_COLLISION';
        throw error;
      }
      if (!existing) claimsById.set(claim.claimId, claim);
    }
  }

  const claims = [...claimsById.values()];

  const scalarValueClaims = new Map();
  for (const claim of claims) {
    if (COLLECTION_FIELD_PATHS.includes(claim.fieldPath) || claim.status !== 'VALUE') continue;
    const rows = scalarValueClaims.get(claim.fieldPath) ?? [];
    rows.push(claim);
    scalarValueClaims.set(claim.fieldPath, rows);
  }
  for (const rows of scalarValueClaims.values()) {
    if (new Set(rows.map((row) => stableStringify(row.normalizedValue))).size > 1) {
      for (const row of rows) row.status = 'CONFLICTED';
    }
  }
  return Object.freeze(claims.sort(claimOrder).map((claim) => Object.freeze(claim)));
}
