import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCatalogWorkspace } from '../lib/workspace.mjs';
import { sha256 } from '../lib/hash.mjs';
import { buildServiceProjection } from '../pipeline/service-projection.mjs';
import { buildServiceProjectionV2, validateServiceProjectionV2Bundle } from '../pipeline/service-projection-v2.mjs';
import { reviewedTitleIdentity } from '../pipeline/title-identity-review.mjs';
import { identityTitleKey } from '../pipeline/title-identity-signals.mjs';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const within = (root, path) => { const rel = relative(root, path); return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };
const values = (field) => field?.state === 'VALUE' && Array.isArray(field.value) ? field.value : [];

export async function stageIdentityCorrections({ repoRoot, workspaceRoot, outputRoot, progress = () => {} }) {
  const source = await openCatalogWorkspace({ repoRoot, workspaceRoot });
  if (within(source.root, resolve(outputRoot))) throw new Error('Staging must be outside the source workspace');
  const output = await openCatalogWorkspace({ repoRoot, workspaceRoot: outputRoot, create: true });
  if (within(source.root, output.root) || within(output.root, source.root)) throw new Error('Source and staging must be disjoint');
  const names = (await readdir(source.resolve('manifests'))).filter(name => name === 'full3998.json' || /^increment-\d{4}-\d{2}\.json$/.test(name)).sort();
  const targets = new Map(); const manifestHashes = [];
  for (const name of names) {
    const rows = await json(source.resolve('manifests', name));
    manifestHashes.push({ file: name, hash: sha256(rows) });
    for (const target of rows) {
      if (!/^anime:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(target.moemoaAnimeId)) throw new Error('Invalid target');
      if (targets.has(target.moemoaAnimeId)) throw new Error('Duplicate target');
      targets.set(target.moemoaAnimeId, target);
    }
  }
  if (!targets.size) throw new Error('No targets');
  const rows = []; const inventory = new Set(); const frontier = new Map();
  const all = [...targets.values()];
  for (let offset = 0; offset < all.length; offset += 8) {
    const batch = await Promise.all(all.slice(offset, offset + 8).map(async (target) => {
      const key = target.moemoaAnimeId.replace(':', '-');
      const pointer = await json(source.resolve('current', `${key}.json`));
      if (pointer.animeId !== target.moemoaAnimeId || !/^[a-f0-9]{64}$/.test(pointer.contentHash)) throw new Error('Invalid pointer');
      const canonical = await json(source.resolve('canonical', key, `${pointer.contentHash}.json`));
      if (pointer.contentHash !== canonical.revision?.contentHash) throw new Error('Pointer mismatch');
      const previous = await json(source.resolve('service-projections', `${key}.json`));
      const { projectionHash, ...previousCore } = previous;
      if (previous.canonicalHash !== pointer.contentHash || sha256(previousCore) !== projectionHash) throw new Error('Previous projection mismatch');
      let cover = null;
      try { cover = await json(source.resolve('covers', `${key}.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const projection = buildServiceProjection({ target, canonical, cover });
      const review = reviewedTitleIdentity(target, canonical);
      for (const id of values(canonical.externalIds).filter(row => row.sourceId === 'anilist')) inventory.add(`anilist:${id.value}`);
      if (review) for (const relation of review.evidence.relations) frontier.set(relation.targetId, relation);
      let reviewedBundle = null;
      if (review && cover?.status === 'STORED' && cover.sourceId === 'anilist') {
        const extension = cover.localRef.split('.').at(-1);
        reviewedBundle = buildServiceProjectionV2({ target, canonical, serviceProjection: projection, coverAsset: {
          sourceProvider: 'ANILIST', checksum: cover.checksum, byteSize: cover.byteSize,
          width: cover.width, height: cover.height, extension, mimeType: { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[extension],
        } });
        if (!validateServiceProjectionV2Bundle(reviewedBundle)) throw new Error('Invalid staged bundle');
        if (review.excludedTitles.some(excluded => reviewedBundle.detail.titles.some(title => identityTitleKey(title.value) === identityTitleKey(excluded.value)))) throw new Error('Excluded title reappeared in detail');
      }
      return { targetKey: target.targetKey, animeId: target.moemoaAnimeId, canonicalHash: pointer.contentHash,
        beforeTitle: previous.preferredTitle, afterTitle: projection.preferredTitle,
        titleChanged: sha256(previous.preferredTitle) !== sha256(projection.preferredTitle),
        reviewHash: review?.reviewHash ?? null, reviewScope: review?.scope ?? null,
        koreanTitlePending: review?.koreanTitlePending ?? false,
        projection, reviewedBundle,
        fallbackSeedProposal: review && /^ANILIST:\d+$/.test(target.targetKey) ? { anilistId: Number(target.targetKey.split(':')[1]),
          title: projection.preferredTitle.value, locale: projection.preferredTitle.locale,
          aliases: [...new Set(projection.searchTitles.map(title => title.value))] } : null,
      };
    }));
    rows.push(...batch);
    if (rows.length % 400 === 0 || rows.length === all.length) progress({ processed: rows.length, total: all.length });
  }
  // No report is accepted if an input pointer changed while staging.
  for (const row of rows) {
    const pointer = await json(source.resolve('current', `${row.animeId.replace(':', '-')}.json`));
    if (pointer.contentHash !== row.canonicalHash) throw new Error('Source changed while staging');
  }
  const missingRelatedWorks = [...frontier.values()].filter(row => !inventory.has(row.targetId));
  const summary = { targets: rows.length, titleBindingReviewed: rows.filter(row => row.reviewHash).length,
    titleChanged: rows.filter(row => row.titleChanged).length,
    koreanTitlePending: rows.filter(row => row.koreanTitlePending).length,
    unresolvedIdentity: rows.filter(row => row.projection.reviewItems.some(item => item.reasonCode === 'TITLE_IDENTITY_REVIEW_REQUIRED')).length,
    scalarConflictRecords: rows.filter(row => row.projection.reviewItems.some(item => item.reasonCode === 'SCALAR_CONFLICT_REQUIRES_EVIDENCE')).length,
    missingRelatedWorks: missingRelatedWorks.length,
    fullIdentityVerified: 0, sourceModified: false, productionModified: false, coverBytesRevalidated: false };
  const artifact = { version: 'IDENTITY_CORRECTION_STAGE_V1', manifestHashes, summary, missingRelatedWorks, rows };
  await mkdir(output.resolve('reports'), { recursive: true });
  const hash = sha256(artifact);
  const path = output.resolve('reports', `${hash}.json`);
  try { await writeFile(path, JSON.stringify(artifact, null, 2), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST' || sha256(await json(path)) !== hash) throw error; }
  await writeFile(output.resolve('summary.json'), JSON.stringify({ ...summary, artifactHash: hash, artifactPath: path }, null, 2));
  return { ...summary, artifactPath: path };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [workspaceRoot, outputRoot] = process.argv.slice(2);
  if (!workspaceRoot || !outputRoot) throw new Error('Usage: stage-identity-corrections.mjs <source-lab> <separate-staging-lab>');
  console.log(JSON.stringify(await stageIdentityCorrections({ repoRoot: resolve(fileURLToPath(new URL('../../..', import.meta.url))), workspaceRoot, outputRoot, progress: console.log }), null, 2));
}
