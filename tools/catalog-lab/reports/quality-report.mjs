import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteJson } from '../lib/atomic-json.mjs';
import { toPathKey } from '../lib/path-key.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { CANONICAL_FIELD_PATHS } from '../pipeline/normalize.mjs';
import { createCatalogArtifactStore } from '../pipeline/artifact-store.mjs';
import { inspectImageBytes } from '../pipeline/covers.mjs';
import { sha256, stableStringify } from '../lib/hash.mjs';
import { buildServiceProjection } from '../pipeline/service-projection.mjs';
import { TARGET_PROFILE_COUNTS, targetIdsForProfile } from '../pipeline/targets.mjs';

export const QUALITY_SCHEMA_VERSION = 2;

function repoFromModule() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function reportError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function defaultFieldStates() {
  return Object.fromEntries(CANONICAL_FIELD_PATHS.map((field) => [field, 'NOT_FETCHED']));
}

function isCanonicalHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function expectedCoverRef(target, checksum) {
  return typeof target?.moemoaAnimeId === 'string' && isCanonicalHash(checksum)
    ? new RegExp(`^images/covers/${toPathKey(target.moemoaAnimeId)}/${checksum}\\.(?:jpg|png|webp)$`, 'u') : null;
}

/** Exact deterministic manifest gate shared by report builders and CLI commands. */
export async function hasApprovedTargetManifest({
  workspace, profile = 'golden', manifest, repoRoot = repoFromModule(),
} = {}) {
  try {
    const store = createCatalogArtifactStore({ workspace });
    const [aliases, idMap] = await Promise.all([
      readFile(resolve(repoRoot, 'src', 'data', 'aliases.json'), 'utf8').then(JSON.parse),
      store.readIdMap(),
    ]);
    const expectedCount = TARGET_PROFILE_COUNTS[profile];
    const expectedIds = expectedCount ? await targetIdsForProfile({ profile, rows: aliases }) : [];
    if (!expectedCount || !idMap || typeof idMap !== 'object' || Array.isArray(idMap)
      || expectedIds.length !== expectedCount || new Set(expectedIds).size !== expectedCount
      || !Array.isArray(manifest) || manifest.length !== expectedCount
      || new Set(manifest.map((target) => target?.targetKey)).size !== expectedCount
      || new Set(manifest.map((target) => target?.moemoaAnimeId)).size !== expectedCount) return false;
    return expectedIds.every((anilistId, index) => {
      const row = aliases.find((candidate) => String(candidate?.anilistId) === anilistId);
      const target = manifest[index];
      const expectedTitles = [
        ...(row?.ko ? [{ locale: 'ko', value: row.ko }] : []),
        ...(Array.isArray(row?.aliases) ? row.aliases.filter(Boolean).map((value) => ({ locale: 'und', value })) : []),
      ];
      return Boolean(row) && target?.targetKey === `ANILIST:${anilistId}` && typeof target.moemoaAnimeId === 'string'
        && idMap[target.targetKey] === target.moemoaAnimeId && target.seedSource === 'legacy_aliases'
        && target.targetStatus === 'ACTIVE'
        && JSON.stringify(target.seedExternalIds) === JSON.stringify([{ sourceId: 'anilist', value: anilistId }])
        && JSON.stringify(target.seedTitles) === JSON.stringify(expectedTitles);
    });
  } catch {
    return false;
  }
}

export async function hasApprovedGoldenManifest(input = {}) {
  return hasApprovedTargetManifest({ ...input, profile: 'golden' });
}

function canonicalFieldStates(canonical) {
  if (!canonical || typeof canonical !== 'object') return defaultFieldStates();
  return Object.fromEntries(CANONICAL_FIELD_PATHS.map((field) => [
    field,
    typeof canonical[field]?.state === 'string' ? canonical[field].state : 'NOT_FETCHED',
  ]));
}

function displayTitle(target, canonical, projection) {
  if (typeof projection?.preferredTitle?.locale === 'string' && typeof projection.preferredTitle.value === 'string') {
    return projection.preferredTitle.value;
  }
  const titles = canonical?.titles?.value;
  if (Array.isArray(titles) && typeof titles[0]?.value === 'string') return titles[0].value;
  const seed = target?.seedTitles?.find((title) => typeof title?.value === 'string');
  return seed?.value ?? target.targetKey;
}

const SERVICE_READINESS = new Set(['BLOCKED', 'READY_WITH_REVIEW', 'READY_WITH_GAPS', 'READY']);
const SERVICE_TIERS = Object.freeze(['required', 'recommended', 'optional']);

function serviceProjectionIsConsistent(projection, target, current, canonical, cover) {
  if (!projection || typeof projection !== 'object' || projection.targetKey !== target.targetKey
    || projection.animeId !== target.moemoaAnimeId || projection.canonicalHash !== current?.contentHash
    || typeof projection.projectionHash !== 'string' || !isCanonicalHash(projection.projectionHash)
    || !SERVICE_READINESS.has(projection.readiness?.status)
    || typeof projection.preferredTitle?.locale !== 'string'
    || typeof projection.preferredTitle?.value !== 'string') return false;
  try {
    return stableStringify(projection) === stableStringify(buildServiceProjection({ target, canonical, cover }));
  } catch {
    return false;
  }
}

function sanitizeServiceProjection(projection, valid) {
  if (!valid) return Object.freeze({
    preferredTitle: null,
    serviceReadiness: 'BLOCKED',
    fieldTiers: Object.freeze(Object.fromEntries(SERVICE_TIERS.map((tier) => [tier, Object.freeze({})]))),
    quarantinedTitleCount: 0,
    autoAcceptedTitleAliasCount: 0,
    officialLinkCount: 0,
    officialLinkReviewCount: 0,
    primaryOfficialSiteAvailable: false,
    reviewReasonCodes: Object.freeze([]),
    warningReasonCodes: Object.freeze([]),
  });
  const fieldTiers = Object.fromEntries(SERVICE_TIERS.map((tier) => [
    tier,
    Object.freeze(Object.fromEntries(Object.entries(projection.fieldTiers?.[tier] ?? {}).filter(([, state]) => (
      typeof state === 'string' && /^[A-Z0-9_]+$/u.test(state)
    )))),
  ]));
  const reviewReasonCodes = [...new Set((projection.reviewItems ?? [])
    .map((item) => item?.reasonCode)
    .filter((code) => typeof code === 'string' && /^[A-Z0-9_]+$/u.test(code)))].sort();
  const warningReasonCodes = [...new Set((projection.qualityWarnings ?? [])
    .map((item) => item?.reasonCode)
    .filter((code) => typeof code === 'string' && /^[A-Z0-9_]+$/u.test(code)))].sort();
  return Object.freeze({
    preferredTitle: Object.freeze({
      locale: projection.preferredTitle.locale, value: projection.preferredTitle.value,
    }),
    serviceReadiness: projection.readiness.status,
    fieldTiers: Object.freeze(fieldTiers),
    quarantinedTitleCount: Array.isArray(projection.quarantinedTitles) ? projection.quarantinedTitles.length : 0,
    autoAcceptedTitleAliasCount: Array.isArray(projection.autoAcceptedTitleAliases)
      ? projection.autoAcceptedTitleAliases.length : 0,
    officialLinkCount: Array.isArray(projection.officialLinks) ? projection.officialLinks.length : 0,
    officialLinkReviewCount: Array.isArray(projection.officialLinks)
      ? projection.officialLinks.filter((link) => link?.selectionState === 'PENDING_REVIEW').length : 0,
    primaryOfficialSiteAvailable: typeof projection.primaryOfficialSiteUrl === 'string',
    reviewReasonCodes: Object.freeze(reviewReasonCodes),
    warningReasonCodes: Object.freeze(warningReasonCodes),
  });
}

function sanitizeCover(value, target) {
  const cover = value && typeof value === 'object' ? value : {};
  const refPattern = expectedCoverRef(target, cover.checksum);
  const localRef = typeof cover.localRef === 'string'
    && Boolean(refPattern?.test(cover.localRef))
    ? cover.localRef : null;
  return Object.freeze({
    status: typeof cover.status === 'string' ? cover.status : 'NOT_STORED',
    sourceId: typeof cover.sourceId === 'string' ? cover.sourceId : null,
    checksum: /^[a-f0-9]{64}$/u.test(cover.checksum ?? '') ? cover.checksum : null,
    byteSize: Number.isSafeInteger(cover.byteSize) ? cover.byteSize : null,
    width: Number.isSafeInteger(cover.width) ? cover.width : null,
    height: Number.isSafeInteger(cover.height) ? cover.height : null,
    localRef,
    errorCode: typeof cover.errorCode === 'string' && /^[A-Z0-9_]+$/u.test(cover.errorCode) ? cover.errorCode : null,
  });
}

function canonicalIsConsistent(canonical, target, current) {
  const currentHash = current?.contentHash;
  if (!canonical || typeof canonical !== 'object' || current?.animeId !== target.moemoaAnimeId || !isCanonicalHash(currentHash)
    || canonical.id !== target.moemoaAnimeId || canonical.revision?.algorithm !== 'SHA-256'
    || canonical.revision?.contentHash !== currentHash) return false;
  const { revision, ...core } = canonical;
  return sha256(core) === currentHash;
}

async function inspectCover({ workspace, target, observation }) {
  const cover = sanitizeCover(observation, target);
  if (cover.status !== 'STORED' || !cover.localRef || !cover.checksum
    || !Number.isSafeInteger(cover.byteSize) || cover.byteSize < 1
    || !Number.isSafeInteger(cover.width) || cover.width < 1
    || !Number.isSafeInteger(cover.height) || cover.height < 1) {
    return { cover, valid: false };
  }
  try {
    const path = workspace.resolve(...cover.localRef.split('/'));
    const [info, bytes] = await Promise.all([stat(path), readFile(path)]);
    const metadata = inspectImageBytes({ bytes });
    const digest = createHash('sha256').update(bytes).digest('hex');
    const extension = cover.localRef.slice(cover.localRef.lastIndexOf('.') + 1);
    return {
      cover,
      valid: info.isFile() && info.size === cover.byteSize && bytes.byteLength === cover.byteSize
        && digest === cover.checksum && metadata.byteSize === cover.byteSize
        && metadata.width === cover.width && metadata.height === cover.height && metadata.extension === extension,
    };
  } catch {
    return { cover, valid: false };
  }
}

function sourceStates(snapshot, targetKey) {
  const sources = snapshot?.targets?.find((row) => row?.targetKey === targetKey)?.sources;
  if (!sources || typeof sources !== 'object') return {};
  return Object.fromEntries(Object.entries(sources).map(([sourceId, state]) => [
    sourceId,
    typeof state?.stage === 'string' ? state.stage : 'NOT_FETCHED',
  ]));
}

function countValues(rows, selector) {
  const counts = {};
  for (const row of rows) {
    for (const value of Object.values(selector(row))) counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function countFieldTierStates(rows) {
  return Object.freeze(Object.fromEntries(SERVICE_TIERS.map((tier) => [
    tier,
    Object.freeze(rows.reduce((fields, row) => {
      for (const [field, state] of Object.entries(row.fieldTiers[tier])) {
        fields[field] ??= {};
        fields[field][state] = (fields[field][state] ?? 0) + 1;
      }
      return fields;
    }, {})),
  ])));
}

function blockersFor({ targets, targetCount, canonicalCount, coverStoredCount, manifestApproved, expectedCount }) {
  const blockers = [];
  if (!manifestApproved) blockers.push('MANIFEST_INVALID');
  if (targetCount !== expectedCount) blockers.push('TARGET_COUNT_INCOMPLETE');
  if (canonicalCount !== expectedCount) blockers.push('CANONICAL_COUNT_INCOMPLETE');
  if (coverStoredCount !== expectedCount) blockers.push('COVER_COUNT_INCOMPLETE');
  for (const row of targets) {
    if (!row.canonicalValid) blockers.push(`CANONICAL_INVALID:${row.targetKey}`);
    if (!row.coverValid) blockers.push(`COVER_INVALID:${row.targetKey}`);
    if (!row.serviceProjectionValid) blockers.push(`SERVICE_PROJECTION_INVALID:${row.targetKey}`);
  }
  return blockers;
}

function serviceBlockersFor(targets) {
  return targets.flatMap((row) => (
    row.serviceProjectionValid && row.serviceReadiness !== 'BLOCKED'
      ? [] : [`SERVICE_NOT_READY:${row.targetKey}`]
  ));
}

/** Projects external profile artifacts into a JSON-safe, raw-data-free quality summary. */
export async function buildQualityReport({ workspace, profile, repoRoot } = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  const expectedCount = TARGET_PROFILE_COUNTS[profile];
  if (!expectedCount) throw reportError('TARGET_PROFILE_INVALID', 'Quality report profile is invalid');
  const store = createCatalogArtifactStore({ workspace });
  const manifest = await store.readManifest(profile);
  const manifestApproved = await hasApprovedTargetManifest({ workspace, profile, manifest, repoRoot });
  const snapshot = await store.readRunSnapshot(profile);
  const rebuildSnapshot = await store.readRebuildSnapshot(profile);
  const targets = [];
  for (const target of manifestApproved ? manifest : []) {
    const current = await store.readCurrent(target.moemoaAnimeId);
    const pointerValid = current?.animeId === target.moemoaAnimeId && isCanonicalHash(current?.contentHash);
    const canonical = pointerValid
      ? await readJson(workspace.resolve('canonical', toPathKey(target.moemoaAnimeId), `${current.contentHash}.json`))
      : null;
    const canonicalValid = canonicalIsConsistent(canonical, target, current);
    const coverObservation = await store.writeCoverObservation(target);
    const coverInspection = await inspectCover({ workspace, target, observation: coverObservation });
    const projection = await store.readServiceProjection(target);
    const serviceProjectionValid = canonicalValid
      && serviceProjectionIsConsistent(projection, target, current, canonical, coverObservation);
    const service = sanitizeServiceProjection(projection, serviceProjectionValid);
    targets.push(Object.freeze({
      targetKey: target.targetKey,
      moemoaAnimeId: target.moemoaAnimeId,
      displayTitle: displayTitle(target, canonical, serviceProjectionValid ? projection : null),
      sources: Object.freeze(sourceStates(snapshot, target.targetKey)),
      fieldStates: Object.freeze(canonicalFieldStates(canonical)),
      canonicalHash: canonicalValid ? current.contentHash : null,
      cover: coverInspection.cover,
      ...service,
      canonicalValid,
      coverValid: coverInspection.valid,
      serviceProjectionValid,
    }));
  }
  const targetCount = targets.length;
  const canonicalCount = targets.filter((row) => row.canonicalHash).length;
  const coverStoredCount = targets.filter((row) => row.coverValid).length;
  const blockers = blockersFor({
    targets, targetCount, canonicalCount, coverStoredCount, manifestApproved, expectedCount,
  });
  const serviceBlockers = serviceBlockersFor(targets);
  blockers.push(...serviceBlockers);
  return Object.freeze({
    schemaVersion: QUALITY_SCHEMA_VERSION,
    profile,
    generatedAt: rebuildSnapshot?.generatedAt ?? snapshot?.generatedAt ?? null,
    targetCount,
    canonicalCount,
    coverStoredCount,
    sourceStateCounts: Object.freeze(countValues(targets, (row) => row.sources)),
    fieldStateCounts: Object.freeze(countValues(targets, (row) => row.fieldStates)),
    serviceReadinessCounts: Object.freeze(targets.reduce((counts, row) => ({
      ...counts,
      [row.serviceReadiness]: (counts[row.serviceReadiness] ?? 0) + 1,
    }), {})),
    fieldTierStateCounts: countFieldTierStates(targets),
    serviceTotals: Object.freeze({
      quarantinedTitles: targets.reduce((sum, row) => sum + row.quarantinedTitleCount, 0),
      autoAcceptedTitleAliases: targets.reduce((sum, row) => sum + row.autoAcceptedTitleAliasCount, 0),
      officialLinks: targets.reduce((sum, row) => sum + row.officialLinkCount, 0),
      officialLinksPendingReview: targets.reduce((sum, row) => sum + row.officialLinkReviewCount, 0),
      targetsWithReview: targets.filter((row) => row.reviewReasonCodes.length > 0 || row.serviceReadiness === 'BLOCKED').length,
      targetsWithWarnings: targets.filter((row) => row.warningReasonCodes.length > 0).length,
      automaticTitleFallbacks: targets.filter((row) => row.warningReasonCodes.includes('PREFERRED_TITLE_FALLBACK_USED')).length,
      officialLinkAutoSelections: targets.filter((row) => row.warningReasonCodes.includes('OFFICIAL_LINK_AUTO_SELECTED')).length,
    }),
    growth: Object.freeze({
      sourceRecords: Number.isSafeInteger(snapshot?.growth?.sourceRecords) ? snapshot.growth.sourceRecords : 0,
      claims: Number.isSafeInteger(snapshot?.growth?.claims) ? snapshot.growth.claims : 0,
      canonicalRevisions: Number.isSafeInteger(snapshot?.growth?.canonicalRevisions) ? snapshot.growth.canonicalRevisions : 0,
      images: Number.isSafeInteger(snapshot?.growth?.images) ? snapshot.growth.images : 0,
    }),
    rebuildGrowth: Object.freeze({
      sourceRecords: Number.isSafeInteger(rebuildSnapshot?.growth?.sourceRecords) ? rebuildSnapshot.growth.sourceRecords : 0,
      claims: Number.isSafeInteger(rebuildSnapshot?.growth?.claims) ? rebuildSnapshot.growth.claims : 0,
      canonicalRevisions: Number.isSafeInteger(rebuildSnapshot?.growth?.canonicalRevisions) ? rebuildSnapshot.growth.canonicalRevisions : 0,
      images: Number.isSafeInteger(rebuildSnapshot?.growth?.images) ? rebuildSnapshot.growth.images : 0,
      serviceProjections: Number.isSafeInteger(rebuildSnapshot?.growth?.serviceProjections) ? rebuildSnapshot.growth.serviceProjections : 0,
    }),
    serviceGate: Object.freeze({ passed: serviceBlockers.length === 0, blockers: Object.freeze(serviceBlockers) }),
    gate: Object.freeze({ passed: blockers.length === 0, blockers: Object.freeze(blockers) }),
    targets: Object.freeze(targets.map(({
      canonicalValid: _canonicalValid, coverValid: _coverValid,
      serviceProjectionValid: _serviceProjectionValid, ...target
    }) => Object.freeze(target))),
  });
}

/** Strict internal artifact gate used by the CLI in addition to the existing runner validation. */
export async function inspectGoldenArtifacts({ workspace, profile = 'golden', repoRoot } = {}) {
  const report = await buildQualityReport({ workspace, profile: 'golden', repoRoot });
  return Object.freeze({ valid: report.gate.passed, blockers: report.gate.blockers });
}

export async function inspectCatalogArtifacts({ workspace, profile = 'golden', repoRoot } = {}) {
  const report = await buildQualityReport({ workspace, profile, repoRoot });
  return Object.freeze({ valid: report.gate.passed, blockers: report.gate.blockers });
}

/** Renders the sanitized report without paths, raw payloads, or remote diagnostics. */
export function renderQualityReportMarkdown(report) {
  if (!report || report.schemaVersion !== QUALITY_SCHEMA_VERSION || !TARGET_PROFILE_COUNTS[report.profile]) {
    throw reportError('QUALITY_REPORT_INVALID', 'Quality report is invalid');
  }
  const title = {
    golden: 'Golden',
    sample100: 'Sample 100',
    full3998: 'Full 3,998',
  }[report.profile];
  const lines = [
    `# ${title} Catalog Quality Report`,
    '',
    `Gate: ${report.gate.passed ? 'PASS' : 'BLOCKED'}`,
    `Service gate: ${report.serviceGate.passed ? 'PASS' : 'BLOCKED'}`,
    `Targets: ${report.targetCount}; canonical: ${report.canonicalCount}; stored covers: ${report.coverStoredCount}`,
    `Service readiness: ${Object.entries(report.serviceReadinessCounts).map(([state, count]) => `${state}=${count}`).join(', ')}`,
    `Manual review: targets=${report.serviceTotals.targetsWithReview}; warning targets=${report.serviceTotals.targetsWithWarnings}`,
    `Automation: aliases=${report.serviceTotals.autoAcceptedTitleAliases}; quarantined=${report.serviceTotals.quarantinedTitles}; official links=${report.serviceTotals.officialLinkAutoSelections}; title fallbacks=${report.serviceTotals.automaticTitleFallbacks}`,
    '',
  ];
  for (const row of report.targets) {
    const fields = Object.entries(row.fieldStates).map(([field, state]) => `${field}=${state}`).join(', ');
    const sources = Object.entries(row.sources).map(([source, state]) => `${source}=${state}`).join(', ') || 'none';
    const cover = row.cover.checksum
      ? `${row.cover.status}; ${row.cover.checksum}; ${row.cover.width}x${row.cover.height}; ${row.cover.byteSize} bytes`
      : `${row.cover.status}${row.cover.errorCode ? ` (${row.cover.errorCode})` : ''}`;
    const gaps = Object.entries(row.fieldTiers).flatMap(([tier, states]) => Object.entries(states)
      .filter(([, state]) => state !== 'VALUE').map(([field, state]) => `${tier}.${field}=${state}`)).join(', ') || 'none';
    lines.push(
      `## ${row.displayTitle}`, '', `- Target: ${row.targetKey}`, `- Sources: ${sources}`,
      `- Fields: ${fields}`, `- Service: ${row.serviceReadiness}; gaps: ${gaps}`,
      `- Review: ${row.reviewReasonCodes.join(', ') || 'none'}`,
      `- Warnings: ${row.warningReasonCodes.join(', ') || 'none'}`, `- Cover: ${cover}`, '',
    );
  }
  if (report.gate.blockers.length > 0) lines.push('## Blockers', '', ...report.gate.blockers.map((blocker) => `- ${blocker}`), '');
  return `${lines.join('\n')}\n`;
}

/** Writes report artifacts only into the authenticated external catalog workspace. */
export async function writeQualityReport({ workspace, profile, repoRoot } = {}) {
  const report = await buildQualityReport({ workspace, profile, repoRoot });
  const directory = await assertCatalogWorkspaceMutation(workspace, ['reports', profile]);
  await mkdir(directory, { recursive: true });
  await atomicWriteJson(workspace.resolve('reports', profile, 'quality-report.json'), report);
  await writeFile(workspace.resolve('reports', profile, 'quality-report.md'), renderQualityReportMarkdown(report), 'utf8');
  return report;
}
