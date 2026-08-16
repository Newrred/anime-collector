export const CONFIDENCE_CLASSES = Object.freeze([
  'EXACT_ID', 'EXACT_RULE', 'REVIEWED', 'AMBIGUOUS',
]);

function decision(status, confidenceClass, ruleId) {
  return Object.freeze({ status, confidenceClass, ruleId });
}

function targetExternalId(target, sourceId) {
  const value = target?.seedExternalIds?.find((entry) => entry?.sourceId === sourceId)?.value;
  return value === undefined || value === null ? null : String(value);
}

function candidateExternalId(candidate, sourceId) {
  const value = candidate?.externalIds?.find((entry) => entry?.sourceId === sourceId)?.value;
  return value === undefined || value === null ? null : String(value);
}

function identityTitle(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und')
    : null;
}

function targetNumber(target, names) {
  for (const name of names) {
    if (Number.isSafeInteger(target?.[name]) && target[name] >= 0) return target[name];
  }
  return null;
}

function candidateYears(candidate) {
  if (Number.isSafeInteger(candidate?.releaseYear) && candidate.releaseYear >= 0) {
    return [candidate.releaseYear];
  }
  return [...new Set((Array.isArray(candidate?.releaseYearEvidence)
    ? candidate.releaseYearEvidence : []).filter((value) => Number.isSafeInteger(value) && value >= 0))];
}

function referenceNumbers(record, names) {
  if (names.includes('releaseYear')) return candidateYears(record);
  const value = targetNumber(record, names);
  return value === null ? [] : [value];
}

function exactAniListReferenceNumbers({ target, referenceRecords, names }) {
  const targetAniListId = targetExternalId(target, 'anilist');
  const values = new Set((Array.isArray(referenceRecords) ? referenceRecords : [])
    .filter((record) => record?.sourceId === 'anilist'
      && record.targetKey === target.targetKey
      && candidateExternalId(record, 'anilist') === targetAniListId)
    .flatMap((record) => referenceNumbers(record, names)));
  return values.size === 1 ? { value: [...values][0], conflicted: false }
    : { value: null, conflicted: values.size > 1 };
}

function absenceOnly(candidate, status) {
  return Array.isArray(candidate?.fieldValues) && candidate.fieldValues.length > 0
    && candidate.fieldValues.every((field) => field?.status === status);
}

/** Applies only approved exact identity rules. Every non-exact outcome is sent to review. */
export function resolveIdentity({ target, candidate, sourceId, referenceRecords = [] }) {
  if (!target || !candidate || candidate.sourceId !== sourceId) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'IDENTITY_SOURCE_MISMATCH_V1');
  }
  if (candidate.targetKey !== target.targetKey) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'IDENTITY_TARGET_MISMATCH_V1');
  }
  const targetAniListId = targetExternalId(target, 'anilist');
  if (sourceId === 'anilist') {
    return targetAniListId && candidateExternalId(candidate, 'anilist') === targetAniListId
      ? decision('MATCHED', 'EXACT_ID', 'ANILIST_ID_V1')
      : decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIST_ID_MISMATCH_V1');
  }
  if (sourceId === 'wikidata') {
    if (absenceOnly(candidate, 'SOURCE_NOT_AVAILABLE')) {
      return targetAniListId && candidate.sourceEntityId === `P8729:${targetAniListId}`
        ? decision('MATCHED', 'EXACT_ID', 'WIKIDATA_ABSENCE_TARGET_V1')
        : decision('PENDING_REVIEW', 'AMBIGUOUS', 'WIKIDATA_ID_MISMATCH_V1');
    }
    return targetAniListId && candidateExternalId(candidate, 'anilist') === targetAniListId
      ? decision('MATCHED', 'EXACT_ID', 'WIKIDATA_P8729_V1')
      : decision('PENDING_REVIEW', 'AMBIGUOUS', 'WIKIDATA_ID_MISMATCH_V1');
  }
  if (sourceId !== 'anilife_public') {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'IDENTITY_SOURCE_UNSUPPORTED_V1');
  }

  if (absenceOnly(candidate, 'NOT_FETCHED')) {
    return candidate.sourceEntityId === 'UNBOUND'
      ? decision('MATCHED', 'EXACT_RULE', 'ANILIFE_UNBOUND_TARGET_V1')
      : decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_INSUFFICIENT_EVIDENCE_V1');
  }

  if (candidate.exactTitleCandidateCount > 1) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_MULTIPLE_CANDIDATES_V1');
  }
  const targetTitles = new Set((Array.isArray(target.seedTitles) ? target.seedTitles : [])
    .map((entry) => identityTitle(entry?.value)).filter(Boolean));
  const exactTitle = (Array.isArray(candidate.titles) ? candidate.titles : [])
    .some((entry) => targetTitles.has(identityTitle(entry?.value)));
  if (!exactTitle) return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_TITLE_MISMATCH_V1');

  const referenceYear = exactAniListReferenceNumbers({
    target, referenceRecords, names: ['releaseYear', 'seasonYear'],
  });
  if (referenceYear.conflicted) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_REFERENCE_CONFLICT_V1');
  }
  const targetYear = targetNumber(target, ['releaseYear', 'seedReleaseYear', 'seasonYear'])
    ?? referenceYear.value;
  const candidateYearEvidence = candidateYears(candidate);
  if (candidateYearEvidence.length > 1) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_REFERENCE_CONFLICT_V1');
  }
  const candidateYear = candidateYearEvidence[0] ?? null;
  if (targetYear !== null && candidateYear !== null) {
    return targetYear === candidateYear
      ? decision('MATCHED', 'EXACT_RULE', 'ANILIFE_TITLE_YEAR_V1')
      : decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_YEAR_MISMATCH_V1');
  }
  const referenceEpisodes = exactAniListReferenceNumbers({
    target, referenceRecords, names: ['episodeCount'],
  });
  if (referenceEpisodes.conflicted) {
    return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_REFERENCE_CONFLICT_V1');
  }
  const targetEpisodes = targetNumber(target, ['episodeCount', 'seedEpisodeCount'])
    ?? referenceEpisodes.value;
  const candidateEpisodes = targetNumber(candidate, ['episodeCount']);
  if (targetEpisodes !== null && candidateEpisodes !== null) {
    if (targetEpisodes !== candidateEpisodes) {
      return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_EPISODE_MISMATCH_V1');
    }
    return candidate.exactTitleCandidateCount === 1
      ? decision('MATCHED', 'EXACT_RULE', 'ANILIFE_TITLE_EPISODE_V1')
      : decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_UNIQUENESS_REQUIRED_V1');
  }
  return decision('PENDING_REVIEW', 'AMBIGUOUS', 'ANILIFE_INSUFFICIENT_EVIDENCE_V1');
}
