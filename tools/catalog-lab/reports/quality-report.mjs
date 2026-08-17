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
import { sha256 } from '../lib/hash.mjs';

export const QUALITY_SCHEMA_VERSION = 1;

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

/** Exact Golden-ten manifest gate shared by report builders and CLI commands. */
export async function hasApprovedGoldenManifest({ workspace, manifest, repoRoot = repoFromModule() } = {}) {
  try {
    const store = createCatalogArtifactStore({ workspace });
    const [goldenIds, aliases, idMap] = await Promise.all([
      readFile(resolve(repoRoot, 'tools', 'catalog-lab', 'config', 'golden-targets.json'), 'utf8').then(JSON.parse),
      readFile(resolve(repoRoot, 'src', 'data', 'aliases.json'), 'utf8').then(JSON.parse),
      store.readIdMap(),
    ]);
    if (!idMap || typeof idMap !== 'object' || Array.isArray(idMap) || !Array.isArray(goldenIds)
      || goldenIds.length !== 10 || new Set(goldenIds).size !== 10 || !Array.isArray(manifest)
      || manifest.length !== 10 || new Set(manifest.map((target) => target?.targetKey)).size !== 10
      || new Set(manifest.map((target) => target?.moemoaAnimeId)).size !== 10) return false;
    return goldenIds.every((anilistId, index) => {
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

function canonicalFieldStates(canonical) {
  if (!canonical || typeof canonical !== 'object') return defaultFieldStates();
  return Object.fromEntries(CANONICAL_FIELD_PATHS.map((field) => [
    field,
    typeof canonical[field]?.state === 'string' ? canonical[field].state : 'NOT_FETCHED',
  ]));
}

function displayTitle(target, canonical) {
  const titles = canonical?.titles?.value;
  if (Array.isArray(titles) && typeof titles[0]?.value === 'string') return titles[0].value;
  const seed = target?.seedTitles?.find((title) => typeof title?.value === 'string');
  return seed?.value ?? target.targetKey;
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

function blockersFor({ targets, targetCount, canonicalCount, coverStoredCount, manifestApproved }) {
  const blockers = [];
  if (!manifestApproved) blockers.push('MANIFEST_INVALID');
  if (targetCount !== 10) blockers.push('TARGET_COUNT_NOT_TEN');
  if (canonicalCount !== 10) blockers.push('CANONICAL_COUNT_INCOMPLETE');
  if (coverStoredCount !== 10) blockers.push('COVER_COUNT_INCOMPLETE');
  for (const row of targets) {
    if (!row.canonicalValid) blockers.push(`CANONICAL_INVALID:${row.targetKey}`);
    if (!row.coverValid) blockers.push(`COVER_INVALID:${row.targetKey}`);
  }
  return blockers;
}

/** Projects external golden artifacts into a JSON-safe, raw-data-free quality summary. */
export async function buildQualityReport({ workspace, profile, repoRoot } = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (profile !== 'golden') throw reportError('TARGET_PROFILE_INVALID', 'Quality reports support only the golden profile');
  const store = createCatalogArtifactStore({ workspace });
  const manifest = await store.readManifest(profile);
  const manifestApproved = await hasApprovedGoldenManifest({ workspace, manifest, repoRoot });
  const snapshot = await store.readRunSnapshot();
  const targets = [];
  for (const target of manifestApproved ? manifest : []) {
    const current = await store.readCurrent(target.moemoaAnimeId);
    const pointerValid = current?.animeId === target.moemoaAnimeId && isCanonicalHash(current?.contentHash);
    const canonical = pointerValid
      ? await readJson(workspace.resolve('canonical', toPathKey(target.moemoaAnimeId), `${current.contentHash}.json`))
      : null;
    const canonicalValid = canonicalIsConsistent(canonical, target, current);
    const coverInspection = await inspectCover({ workspace, target, observation: await store.writeCoverObservation(target) });
    targets.push(Object.freeze({
      targetKey: target.targetKey,
      moemoaAnimeId: target.moemoaAnimeId,
      displayTitle: displayTitle(target, canonical),
      sources: Object.freeze(sourceStates(snapshot, target.targetKey)),
      fieldStates: Object.freeze(canonicalFieldStates(canonical)),
      canonicalHash: canonicalValid ? current.contentHash : null,
      cover: coverInspection.cover,
      canonicalValid,
      coverValid: coverInspection.valid,
    }));
  }
  const targetCount = targets.length;
  const canonicalCount = targets.filter((row) => row.canonicalHash).length;
  const coverStoredCount = targets.filter((row) => row.coverValid).length;
  const blockers = blockersFor({ targets, targetCount, canonicalCount, coverStoredCount, manifestApproved });
  return Object.freeze({
    schemaVersion: QUALITY_SCHEMA_VERSION,
    profile,
    generatedAt: snapshot?.generatedAt ?? null,
    targetCount,
    canonicalCount,
    coverStoredCount,
    sourceStateCounts: Object.freeze(countValues(targets, (row) => row.sources)),
    fieldStateCounts: Object.freeze(countValues(targets, (row) => row.fieldStates)),
    growth: Object.freeze({
      sourceRecords: Number.isSafeInteger(snapshot?.growth?.sourceRecords) ? snapshot.growth.sourceRecords : 0,
      claims: Number.isSafeInteger(snapshot?.growth?.claims) ? snapshot.growth.claims : 0,
      canonicalRevisions: Number.isSafeInteger(snapshot?.growth?.canonicalRevisions) ? snapshot.growth.canonicalRevisions : 0,
      images: Number.isSafeInteger(snapshot?.growth?.images) ? snapshot.growth.images : 0,
    }),
    gate: Object.freeze({ passed: blockers.length === 0, blockers: Object.freeze(blockers) }),
    targets: Object.freeze(targets.map(({ canonicalValid: _canonicalValid, coverValid: _coverValid, ...target }) => Object.freeze(target))),
  });
}

/** Strict internal artifact gate used by the CLI in addition to the existing runner validation. */
export async function inspectGoldenArtifacts({ workspace, profile = 'golden', repoRoot } = {}) {
  const report = await buildQualityReport({ workspace, profile, repoRoot });
  return Object.freeze({ valid: report.gate.passed, blockers: report.gate.blockers });
}

/** Renders the sanitized report without paths, raw payloads, or remote diagnostics. */
export function renderQualityReportMarkdown(report) {
  if (!report || report.schemaVersion !== QUALITY_SCHEMA_VERSION || report.profile !== 'golden') {
    throw reportError('QUALITY_REPORT_INVALID', 'Quality report is invalid');
  }
  const lines = [
    '# Golden Catalog Quality Report',
    '',
    `Gate: ${report.gate.passed ? 'PASS' : 'BLOCKED'}`,
    `Targets: ${report.targetCount}; canonical: ${report.canonicalCount}; stored covers: ${report.coverStoredCount}`,
    '',
  ];
  for (const row of report.targets) {
    const fields = Object.entries(row.fieldStates).map(([field, state]) => `${field}=${state}`).join(', ');
    const sources = Object.entries(row.sources).map(([source, state]) => `${source}=${state}`).join(', ') || 'none';
    const cover = row.cover.checksum
      ? `${row.cover.status}; ${row.cover.checksum}; ${row.cover.width}x${row.cover.height}; ${row.cover.byteSize} bytes`
      : `${row.cover.status}${row.cover.errorCode ? ` (${row.cover.errorCode})` : ''}`;
    lines.push(`## ${row.displayTitle}`, '', `- Target: ${row.targetKey}`, `- Sources: ${sources}`, `- Fields: ${fields}`, `- Cover: ${cover}`, '');
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
