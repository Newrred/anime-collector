import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from '../lib/hash.mjs';
import { identityTitleKey } from '../pipeline/title-identity-signals.mjs';

const legacyTargets = JSON.parse(await readFile(new URL('../config/legacy-alias-review-targets.json', import.meta.url)));

export function buildReviewedAliasOverrides(sourceRows, reviews) {
  // The legacy roster is AniList-only; other providers belong to catalog projections.
  return legacyTargets.map((targetKey) => {
    const review = reviews.find(row => row.targetKey === targetKey);
    if (!review) throw new Error(`Missing legacy review ${targetKey}`);
    const id = Number(review.targetKey.split(':')[1]);
    const row = sourceRows.find((candidate) => candidate.anilistId === id);
    if (!row) throw new Error(`Missing reviewed seed ${id}`);
    const seedTitles = [{ locale: 'ko', value: row.ko }, ...row.aliases.map(value => ({ locale: 'und', value }))];
    if (sha256(seedTitles) !== review.expectedSeedTitlesHash) throw new Error(`Stale reviewed seed ${id}`);
    const rejected = new Set(review.excludedTitles.map(title => identityTitleKey(title.value)));
    const aliases = [...new Set([review.preferredTitle.value, ...review.evidence.primaryTitles.map(title => title.value),
      ...row.aliases.filter(value => !rejected.has(identityTitleKey(value)))])];
    return { anilistId: id, expected: { ko: row.ko, aliases: row.aliases },
      replacement: { ko: review.preferredTitle.locale === 'ko' ? review.preferredTitle.value : null, aliases } };
  }).sort((a, b) => a.anilistId - b.anilistId);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = JSON.parse(await readFile(new URL('../../../src/data/aliases.json', import.meta.url)));
  const registry = JSON.parse(await readFile(new URL('../config/title-identity-reviews.json', import.meta.url)));
  const content = JSON.stringify(buildReviewedAliasOverrides(rows, registry.records), null, 2) + '\n';
  const path = new URL('../../../src/data/reviewed-alias-overrides.json', import.meta.url);
  if (process.argv.includes('--check')) {
    if (await readFile(path, 'utf8') !== content) throw new Error('Runtime alias overrides require regeneration');
  } else await writeFile(path, content);
  console.log(`Reviewed alias overrides: ${JSON.parse(content).length} records validated`);
}
