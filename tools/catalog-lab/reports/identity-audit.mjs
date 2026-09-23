import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../lib/hash.mjs';
import { openCatalogWorkspace } from '../lib/workspace.mjs';
import { identityTitleKey, seasonSignals } from '../pipeline/title-identity-signals.mjs';
export { identityTitleKey, seasonSignals } from '../pipeline/title-identity-signals.mjs';

export const AUDIT_VERSION = 'IDENTITY_AUDIT_V1';
const ANIME_ID = /^anime:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const ANIME_RELATIONS = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY', 'OTHER']);
const values = (field) => field?.state === 'VALUE' ? (Array.isArray(field.value) ? field.value : [field.value]) : [];
const pathKey = (id) => id.replace(':', '-');

export function auditRecord({ target, canonical, projection }) {
  const findings = [];
  const add = (code, evidence, severity = 'REVIEW') => findings.push({ code, severity, evidence });
  if (!canonical || canonical.id !== target.moemoaAnimeId) {
    add('CANONICAL_ID_MISMATCH', { expected: target.moemoaAnimeId, actual: canonical?.id ?? null }, 'BLOCKER');
    return findings;
  }
  const externalIds = values(canonical.externalIds);
  for (const source of ['anilist', 'mal', 'anilife_public']) {
    const ids = [...new Set(externalIds.filter((row) => row.sourceId === source).map((row) => String(row.value)))];
    if (ids.length > 1) add('MULTIPLE_PROVIDER_IDS', { source, ids }, 'BLOCKER');
  }
  for (const seed of target.seedExternalIds || []) {
    // Some source IDs are binding-only and are not promoted into the public canonical row.
    if (seed.sourceId === 'anilist' && !externalIds.some((row) => row.sourceId === seed.sourceId && String(row.value) === String(seed.value))) {
      add('SEED_CANONICAL_ID_MISMATCH', { seed, externalIds }, 'BLOCKER');
    }
  }
  for (const [field, value] of Object.entries(canonical)) {
    if (value?.state === 'CONFLICTED') add('CANONICAL_FIELD_CONFLICT', { field, values: value.values });
  }
  const titles = values(canonical.titles);
  const primaryKeys = new Set(titles.filter((title) => ['en', 'ja', 'ja-Latn'].includes(title.locale)).map((title) => identityTitleKey(title.value)));
  const relationships = values(canonical.relations).filter((row) => ANIME_RELATIONS.has(row.type) && /^anilist:\d+$/.test(row.targetId));
  const seeds = target.seedTitles || [];
  for (const seed of seeds) {
    const key = identityTitleKey(seed.value);
    if (!key || primaryKeys.has(key)) continue;
    const matches = relationships.filter((relation) => identityTitleKey(relation.title) === key);
    if (matches.length) add('SEED_TITLE_MATCHES_RELATED_WORK', { seed, matches, primaryTitles: titles.filter((title) => ['en', 'ja', 'ja-Latn'].includes(title.locale)) });
  }
  const preferred = projection?.preferredTitle || seeds.find((title) => title.locale === 'ko');
  const preferredSignals = seasonSignals(preferred?.value);
  const referenceTitles = titles.filter((title) => ['en', 'ja', 'ja-Latn'].includes(title.locale));
  const ownSignals = new Set(referenceTitles.flatMap((title) => seasonSignals(title.value)));
  for (const signal of preferredSignals) {
    if (ownSignals.has(signal) || !referenceTitles.length) continue;
    const matches = relationships.filter((relation) => seasonSignals(relation.title).includes(signal));
    add(matches.length ? 'PREFERRED_SEASON_SIGNAL_MATCHES_RELATED_WORK' : 'PREFERRED_SEASON_SIGNAL_UNCORROBORATED', { preferred, signal, referenceTitles, matches });
  }
  const format = values(canonical.format)[0];
  if (preferred && /극장판|劇場版|映画|\bmovie\b/iu.test(preferred.value) && format && format !== 'MOVIE') {
    add('PREFERRED_MOVIE_LABEL_FORMAT_MISMATCH', { preferred, format });
  }
  if (projection) {
    if (projection.animeId !== canonical.id || projection.canonicalHash !== canonical.revision?.contentHash) {
      add('PROJECTION_CANONICAL_MISMATCH', { animeId: projection.animeId, canonicalHash: projection.canonicalHash, currentHash: canonical.revision?.contentHash }, 'BLOCKER');
    }
    if (preferred && !titles.some((title) => title.locale === preferred.locale && identityTitleKey(title.value) === identityTitleKey(preferred.value))) {
      add('PREFERRED_TITLE_NOT_IN_CANONICAL', { preferred });
    }
  } else add('SERVICE_PROJECTION_MISSING', {}, 'BLOCKER');
  const anilistId = externalIds.find((row) => row.sourceId === 'anilist')?.value;
  const cover = values(canonical.cover)[0];
  const coverMatch = /^https:\/\/s\d+\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/(?:large|medium)\/[a-z]*(\d+)(?:-|\.)/u.exec(cover?.sourceUrl || '');
  if (coverMatch && anilistId && coverMatch[1] !== String(anilistId)) add('ANILIST_COVER_ID_MISMATCH', { anilistId, coverUrl: cover.sourceUrl, coverId: coverMatch[1] });
  if (canonical.relations?.state !== 'VALUE') add('RELATION_EVIDENCE_UNAVAILABLE', { state: canonical.relations?.state ?? 'MISSING' }, 'COVERAGE');
  if (!referenceTitles.length) add('PRIMARY_TITLE_EVIDENCE_UNAVAILABLE', {}, 'COVERAGE');
  return findings;
}

export function duplicateExternalIds(records) {
  const index = new Map();
  for (const record of records) for (const id of record.externalIds || []) {
    const key = `${id.sourceId}:${id.value}`;
    const owners = index.get(key) || new Set(); owners.add(record.animeId); index.set(key, owners);
  }
  return [...index].filter(([, owners]) => owners.size > 1).map(([externalId, owners]) => ({ externalId, animeIds: [...owners].sort() }));
}

export function buildReviewQueue(records) {
  return records.map((record) => {
    const codes = [...new Set(record.findings.map((finding) => finding.code))];
    const priority = record.findings.some((finding) => finding.severity === 'BLOCKER') ? 0
      : codes.some((code) => ['SEED_TITLE_MATCHES_RELATED_WORK', 'PREFERRED_SEASON_SIGNAL_MATCHES_RELATED_WORK'].includes(code)) ? 1
        : record.findings.length ? 2 : 3;
    return {
      animeId: record.animeId, targetKey: record.targetKey,
      expectedCanonicalHash: record.canonicalHash ?? null,
      preferredTitle: record.preferredTitle ?? null, priority,
      status: 'PENDING_EVIDENCE_REVIEW', findingCodes: codes,
      requiredChecks: ['PROVIDER_IDENTITY', 'SEASON_AND_FORMAT', 'KOREAN_TITLE_AND_ALIASES', 'DATES_AND_EPISODES', 'COVER_IDENTITY', 'RELATED_SEASON_COVERAGE'],
      evidenceReferences: [], proposedChanges: [], reviewer: null,
    };
  }).sort((a, b) => a.priority - b.priority || a.targetKey.localeCompare(b.targetKey));
}

async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function optionalJson(file) { try { return await json(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
export async function runIdentityAudit({ repoRoot, workspaceRoot, outputRoot, progress = () => {} }) {
  const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot });
  const output = resolve(outputRoot);
  const displacement = relative(workspace.root, output);
  if (!displacement || (!displacement.startsWith('..') && !isAbsolute(displacement))) throw new Error('Audit output must be outside source workspace');
  const manifests = (await readdir(workspace.resolve('manifests'))).filter((name) => name === 'full3998.json' || /^increment-\d{4}-\d{2}\.json$/.test(name)).sort();
  const targets = new Map(); const manifestHashes = []; const manifestConflicts = [];
  for (const name of manifests) {
    const rows = await json(workspace.resolve('manifests', name));
    if (!Array.isArray(rows)) throw new Error(`Invalid manifest: ${name}`);
    manifestHashes.push({ file: name, count: rows.length, hash: sha256(rows) });
    for (const target of rows) {
      if (!ANIME_ID.test(target.moemoaAnimeId || '')) throw new Error(`Invalid target in ${name}`);
      if (targets.has(target.moemoaAnimeId) && sha256(target) !== sha256(targets.get(target.moemoaAnimeId))) manifestConflicts.push(target.moemoaAnimeId);
      targets.set(target.moemoaAnimeId, target);
    }
  }
  const currentFiles = (await readdir(workspace.resolve('current'))).filter((name) => name.endsWith('.json'));
  const orphanPointers = currentFiles.filter((name) => !targets.has(name.replace(/^anime-/, 'anime:').replace(/\.json$/, '')));
  const records = [];
  const targetRows = [...targets.values()].sort((a, b) => a.targetKey.localeCompare(b.targetKey));
  for (let start = 0; start < targetRows.length; start += 8) {
    const batch = await Promise.all(targetRows.slice(start, start + 8).map(async (target) => {
      const result = { animeId: target.moemoaAnimeId, targetKey: target.targetKey, seedSource: target.seedSource, seedTitles: target.seedTitles, externalIds: [], findings: [] };
      try {
        const pointer = await json(workspace.resolve('current', `${pathKey(target.moemoaAnimeId)}.json`));
        if (pointer.animeId !== target.moemoaAnimeId || !HASH.test(pointer.contentHash || '')) throw new Error('Invalid canonical pointer');
        const canonical = await json(workspace.resolve('canonical', pathKey(target.moemoaAnimeId), `${pointer.contentHash}.json`));
        const { revision, ...body } = canonical;
        if (revision?.contentHash !== pointer.contentHash || sha256(body) !== pointer.contentHash) throw new Error('Canonical hash mismatch');
        const projection = await optionalJson(workspace.resolve('service-projections', `${pathKey(target.moemoaAnimeId)}.json`));
        Object.assign(result, { canonicalHash: pointer.contentHash, externalIds: values(canonical.externalIds), titles: values(canonical.titles), preferredTitle: projection?.preferredTitle ?? null, relations: values(canonical.relations), format: values(canonical.format)[0] ?? null, startDate: values(canonical.startDate)[0] ?? null, readiness: projection?.readiness?.status ?? null, fieldProvenance: canonical.fieldProvenance });
        result.findings = auditRecord({ target, canonical, projection });
      } catch (error) { result.findings.push({ code: 'READ_OR_INTEGRITY_FAILURE', severity: 'BLOCKER', evidence: { message: error.message, code: error.code ?? null } }); }
      return result;
    }));
    records.push(...batch);
    if (records.length % 200 === 0 || records.length === targetRows.length) progress({ processed: records.length, total: targetRows.length });
  }
  const duplicates = duplicateExternalIds(records);
  for (const duplicate of duplicates) for (const id of duplicate.animeIds) records.find((row) => row.animeId === id).findings.push({ code: 'EXTERNAL_ID_SHARED_BY_MULTIPLE_RECORDS', severity: 'BLOCKER', evidence: duplicate });
  const counts = {};
  for (const record of records) for (const code of new Set(record.findings.map((finding) => finding.code))) counts[code] = (counts[code] || 0) + 1;
  const summary = { version: AUDIT_VERSION, manifests: manifestHashes, manifestConflicts, orphanPointers, total: records.length, integrityVerified: records.filter((row) => row.canonicalHash).length, blockerRecords: records.filter((row) => row.findings.some((finding) => finding.severity === 'BLOCKER')).length, reviewRecords: records.filter((row) => row.findings.some((finding) => finding.severity === 'REVIEW')).length, coverageGapRecords: records.filter((row) => row.findings.some((finding) => finding.severity === 'COVERAGE')).length, noRuleFindingRecords: records.filter((row) => !row.findings.length).length, counts, disclaimer: 'No rule finding is not an independently verified identity. Findings are review candidates, not automatic corrections.' };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'identity-audit.json'), JSON.stringify({ summary, records }, null, 2));
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  // This generated run output is a template; save completed decisions separately.
  // A clean detector result must never promote an unreviewed row to VERIFIED.
  await writeFile(join(output, 'review-queue-template.json'), JSON.stringify({ version: AUDIT_VERSION, manifests: manifestHashes, records: buildReviewQueue(records) }, null, 2));
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [workspaceRoot, outputRoot] = process.argv.slice(2);
  if (!workspaceRoot || !outputRoot) throw new Error('Usage: identity-audit.mjs <catalog-workspace> <separate-output-dir>');
  console.log(JSON.stringify(await runIdentityAudit({ repoRoot: resolve(fileURLToPath(new URL('../../..', import.meta.url))), workspaceRoot, outputRoot, progress: (value) => console.log(JSON.stringify(value)) }), null, 2));
}
