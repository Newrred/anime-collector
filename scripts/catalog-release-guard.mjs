import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function checkCatalogContinuity(baseline, candidate) {
  const ids = baseline?.animeIds;
  const entries = candidate?.entries;
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length
    || !Array.isArray(entries) || entries.length !== candidate.targetCount
    || typeof candidate.releaseId !== 'string' || !candidate.releaseId
    || !/^[a-f0-9]{64}$/.test(candidate.releaseHash || '')) throw new Error('MANIFEST_INVALID');
  const pattern = /^anime:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const next = entries.map((entry) => entry?.animeId);
  if ([...ids, ...next].some((id) => !pattern.test(id)) || new Set(next).size !== next.length) {
    throw new Error('IDENTITY_INVALID');
  }
  const nextIds = new Set(next);
  const previous = new Set(ids);
  const missingIds = ids.filter((id) => !nextIds.has(id));
  return { ok: missingIds.length === 0, baselineRelease: baseline.releaseId,
    candidateRelease: candidate.releaseId, previousCount: ids.length, candidateCount: next.length,
    addedCount: next.filter((id) => !previous.has(id)).length, missingIds };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('USAGE: node scripts/catalog-release-guard.mjs baseline.json release.json');
    const [baseline, candidate] = await Promise.all(process.argv.slice(2).map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
    const result = checkCatalogContinuity(baseline, candidate);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
