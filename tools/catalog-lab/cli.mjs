import { execFile } from 'node:child_process';
import { open, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CATALOG_LAB_USER_AGENT, assertSourceExecution, loadSourceRegistry } from './contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from './lib/workspace.mjs';
import { createCatalogArtifactStore } from './pipeline/artifact-store.mjs';
import { runCatalogBatches } from './pipeline/batches.mjs';
import { buildTargetManifest, TARGET_PROFILE_COUNTS } from './pipeline/targets.mjs';
import { rebuildCatalogProfile, runCatalogPipeline, validateCatalogArtifacts } from './pipeline/runner.mjs';
import { createAniLifePublicPageAdapter, validateAniLifeBinding } from './sources/anilife-public-page-test.mjs';
import { createAniListTestAdapter } from './sources/anilist-test.mjs';
import { createWikidataAdapter } from './sources/wikidata.mjs';
import { inspectVisualBaselinePolicy } from './visual-baseline-policy.mjs';
import { hasApprovedTargetManifest, inspectCatalogArtifacts, writeQualityReport } from './reports/quality-report.mjs';

export const CLI_EXIT = Object.freeze({
  OK: 0, QUALITY_GATE_FAILED: 2, SOURCE_PAUSED: 3, USAGE_OR_SAFETY: 64,
});

const COMMANDS = new Set(['init', 'targets', 'bind-anilife', 'collect', 'rebuild', 'validate', 'report', 'guard']);
const SOURCE_IDS = new Set(['anilist', 'wikidata', 'anilife_public']);
const DEFAULT_BUILD_ROOTS = Object.freeze(['dist', 'android/app/src', 'test-output', 'test-results', '.vercel/output']);
const GUARD_SCAN_CHUNK_BYTES = 64 * 1024;
const GUARD_SCAN_OVERLAP_BYTES = 128;
const GUARD_SCAN_MAX_BYTES = 64 * 1024 * 1024;
const RAW_JSON_RECORD = /[\[{,]\s*["']rawPayloadRef["']\s*:\s*["'][^"'\r\n]+["']/u;
const RAW_QUOTED_RECORD = /["']rawPayloadRef["']\s*:\s*["'][^"'\r\n]+["']/u;
const RAW_SCRIPT_RECORD = /[\{,;]\s*rawPayloadRef\s*:\s*["'][^"'\r\n]+["']/u;
const EXTERNAL_LOCAL_REF = /(?:["']localRef["']|\blocalRef)\s*:\s*["'](?:images\/covers\/|https?:\/\/|[A-Za-z]:[\\/])/u;

function repoFromModule() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function usageError(message) {
  return typedError('CLI_USAGE_OR_SAFETY', message);
}

function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || !COMMANDS.has(argv[0])) throw usageError('Command is not supported');
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || Object.hasOwn(options, token)) throw usageError('Arguments are invalid');
    if (token === '--allow-network' || token === '--refresh') options[token] = true;
    else {
      const value = argv[index + 1];
      if (typeof value !== 'string' || value.startsWith('--')) throw usageError('Option value is required');
      options[token] = value;
      index += 1;
    }
  }
  return { command: argv[0], options };
}

function onlyOptions(options, allowed) {
  if (Object.keys(options).some((option) => !allowed.has(option))) throw usageError('Option is not supported for this command');
}

function selectedProfile(options) {
  const profile = options['--profile'] ?? 'golden';
  if (!TARGET_PROFILE_COUNTS[profile]) throw usageError('Catalog profile is invalid');
  return profile;
}

function selectedSources(value) {
  if (typeof value !== 'string' || !value) throw usageError('Collection requires --sources');
  const rows = value.split(',');
  if (rows.some((source) => !SOURCE_IDS.has(source)) || new Set(rows).size !== rows.length) throw usageError('Collection sources are invalid');
  return rows;
}

function boundedIntegerOption(value, { fallback, minimum, maximum, name }) {
  const candidate = value ?? String(fallback);
  if (!/^\d+$/u.test(candidate)) throw usageError(`${name} must be an integer`);
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw usageError(`${name} is outside its safe range`);
  }
  return parsed;
}

function io(dependencies) {
  return {
    stdout: dependencies.stdout ?? process.stdout,
    stderr: dependencies.stderr ?? process.stderr,
  };
}

function writeLine(stream, message) {
  stream.write(`${message}\n`);
}

async function openWorkspace(dependencies, create) {
  const repoRoot = dependencies.repoRoot ?? repoFromModule();
  return openCatalogWorkspace({ repoRoot, workspaceRoot: dependencies.workspaceRoot ?? process.env.MOEMOA_CATALOG_LAB_DIR, create });
}

async function targetManifest(workspace, profile, dependencies = {}) {
  const store = createCatalogArtifactStore({ workspace });
  const manifest = await store.readManifest(profile);
  if (!Array.isArray(manifest) || manifest.length !== TARGET_PROFILE_COUNTS[profile]) {
    throw typedError('TARGET_MANIFEST_REQUIRED', 'Approved target manifest is required');
  }
  await assertApprovedTargetManifest({
    workspace, profile, manifest, repoRoot: dependencies.repoRoot ?? repoFromModule(),
  });
  return { store, manifest };
}

async function assertApprovedTargetManifest({ workspace, profile, manifest, repoRoot }) {
  if (!await hasApprovedTargetManifest({ workspace, profile, manifest, repoRoot })) {
    throw typedError('TARGET_MANIFEST_INVALID', 'Target manifest is not approved');
  }
}

function defaultAdapters() {
  return Object.freeze({
    anilist: createAniListTestAdapter(),
    wikidata: createWikidataAdapter({ userAgent: CATALOG_LAB_USER_AGENT }),
    anilife_public: createAniLifePublicPageAdapter(),
  });
}

async function listTrackedFiles(repoRoot) {
  return new Promise((resolvePromise, reject) => {
    execFile('git', ['-C', repoRoot, 'ls-files', '-z'], { encoding: 'buffer' }, (error, stdout) => {
      if (error) return reject(error);
      const files = stdout.toString('utf8').split('\0').filter(Boolean).map((path) => resolve(repoRoot, path));
      return resolvePromise(files);
    });
  });
}

function relativePath(repoRoot, path) {
  const value = relative(repoRoot, path).replaceAll('\\', '/');
  return value && !value.startsWith('../') && value !== '..' ? value : null;
}

function hasImageSignature(bytes) {
  return (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    || (bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP')));
}

function hasStructuredLeak(text, relativeFile) {
  const markdown = relativeFile.endsWith('.md');
  // Markdown is scanned for serialized JSON records; prose naming a field is not an artifact.
  if (RAW_JSON_RECORD.test(text)) return true;
  // JavaScript-like artifacts additionally permit identifier-form object properties.
  return !markdown && (RAW_QUOTED_RECORD.test(text) || RAW_SCRIPT_RECORD.test(text) || EXTERNAL_LOCAL_REF.test(text));
}

async function leakedArtifact(path, relativeFile) {
  const fileName = relativeFile.split('/').at(-1);
  if (fileName === 'TEST_ONLY.json') return true;
  const handle = await open(path, 'r').catch(() => null);
  if (!handle) return false;
  try {
    const first = Buffer.alloc(12);
    const { bytesRead } = await handle.read(first, 0, first.byteLength, 0);
    if (hasImageSignature(first.subarray(0, bytesRead))) return true;
    let position = 0;
    let total = 0;
    let tail = '';
    while (total < GUARD_SCAN_MAX_BYTES) {
      const chunk = Buffer.alloc(GUARD_SCAN_CHUNK_BYTES);
      const result = await handle.read(chunk, 0, chunk.byteLength, position);
      if (result.bytesRead === 0) return false;
      position += result.bytesRead;
      total += result.bytesRead;
      const text = tail + chunk.subarray(0, result.bytesRead).toString('utf8');
      if (hasStructuredLeak(text, relativeFile)) return true;
      tail = text.slice(-GUARD_SCAN_OVERLAP_BYTES);
    }
    // A textual artifact larger than this fixed 64 MiB budget is blocked rather than accepted unscanned.
    return true;
  } finally {
    await handle.close();
  }
}

function isKnownAndroidBootstrapAsset(path) {
  return /^android\/app\/src\/main\/res\/(?:drawable(?:-(?:land|port)-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi))?\/splash|mipmap-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)\/ic_launcher(?:_foreground|_round)?)\.png$/u.test(path);
}

async function filesUnder(root) {
  const files = [];
  const walk = async (directory) => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await walk(root);
  return files;
}

async function runGuard(dependencies) {
  const repoRoot = dependencies.repoRoot ?? repoFromModule();
  const visualBaselinePolicy = await inspectVisualBaselinePolicy({ repoRoot });
  const tracked = await (dependencies.trackedFiles ?? (() => listTrackedFiles(repoRoot)))();
  const roots = dependencies.buildRoots ?? DEFAULT_BUILD_ROOTS.map((root) => resolve(repoRoot, root));
  const rootFiles = (await Promise.all(roots.map((root) => filesUnder(root)))).flat();
  const leaks = [...visualBaselinePolicy.violations];
  for (const path of [...new Set([...tracked, ...rootFiles])]) {
    const rel = relativePath(repoRoot, path);
    if (!rel) continue;
    // Existing application launcher/splash resources are not catalog covers.
    if (isKnownAndroidBootstrapAsset(rel)) continue;
    if (visualBaselinePolicy.approvedPaths.has(rel)) continue;
    if (await leakedArtifact(path, rel)) leaks.push(rel);
  }
  return [...new Set(leaks)].sort();
}

function hasPausedSources(summary) {
  return summary.targets?.some((target) => Object.values(target.sources ?? {}).some((state) => state?.stage === 'SOURCE_PAUSED'));
}

/** Runs one intentionally narrow local-only catalog command without calling process.exit(). */
export async function runCli(argv, dependencies = {}) {
  const { stdout, stderr } = io(dependencies);
  try {
    const { command, options } = parseArgs(argv);
    if (command === 'guard') {
      onlyOptions(options, new Set());
      const leaks = await runGuard(dependencies);
      if (leaks.length) {
        writeLine(stderr, `Catalog guard blocked: ${leaks.join(', ')}`);
        return CLI_EXIT.QUALITY_GATE_FAILED;
      }
      writeLine(stdout, 'Catalog guard: no leaks');
      return CLI_EXIT.OK;
    }
    if (command === 'init') {
      onlyOptions(options, new Set());
      await openWorkspace(dependencies, true);
      writeLine(stdout, 'Catalog workspace initialized');
      return CLI_EXIT.OK;
    }
    if (command === 'targets') {
      onlyOptions(options, new Set(['--profile']));
      const profile = selectedProfile(options);
      const workspace = await openWorkspace(dependencies, false);
      const { manifest } = await targetManifestOrCreate(workspace, profile, dependencies);
      writeLine(stdout, `${profile} targets: ${manifest.length}`);
      return CLI_EXIT.OK;
    }
    if (command === 'bind-anilife') {
      onlyOptions(options, new Set(['--anilist-id', '--content-id']));
      if (!/^[1-9]\d*$/u.test(options['--anilist-id'] ?? '') || !/^[1-9]\d*$/u.test(options['--content-id'] ?? '')) throw usageError('AniLife ids must be numeric');
      const workspace = await openWorkspace(dependencies, false);
      const { store, manifest } = await targetManifest(workspace, 'golden', dependencies);
      const target = manifest.find((row) => row.targetKey === `ANILIST:${options['--anilist-id']}`);
      if (!target) throw usageError('AniLife binding target is not in the golden manifest');
      const binding = validateAniLifeBinding({ contentId: options['--content-id'], evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' }, { targetKey: target.targetKey });
      await store.writeAniLifeBinding(target.targetKey, { ...binding, evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' });
      writeLine(stdout, 'AniLife binding stored');
      return CLI_EXIT.OK;
    }
    if (command === 'collect') {
      onlyOptions(options, new Set([
        '--profile', '--sources', '--allow-network', '--refresh', '--batch-size',
        '--pause-min-seconds', '--pause-max-seconds',
      ]));
      const profile = selectedProfile(options);
      if (options['--allow-network'] !== true) throw usageError('Collection requires --allow-network');
      const workspace = await openWorkspace(dependencies, false);
      const { store, manifest } = await targetManifest(workspace, profile, dependencies);
      const sources = selectedSources(options['--sources']);
      const registry = await loadSourceRegistry({ repoRoot: dependencies.repoRoot ?? repoFromModule() });
      if (profile === 'full3998') {
        if (options['--refresh'] === true) throw usageError('Full collection refresh is intentionally disabled');
        const batchSize = boundedIntegerOption(options['--batch-size'], {
          fallback: 100, minimum: 1, maximum: 100, name: '--batch-size',
        });
        const pauseMinSeconds = boundedIntegerOption(options['--pause-min-seconds'], {
          fallback: 120, minimum: 60, maximum: 3600, name: '--pause-min-seconds',
        });
        const pauseMaxSeconds = boundedIntegerOption(options['--pause-max-seconds'], {
          fallback: 200, minimum: pauseMinSeconds, maximum: 3600, name: '--pause-max-seconds',
        });
        for (const sourceId of sources) {
          assertSourceExecution(registry.find((entry) => entry.sourceId === sourceId), batchSize, {
            profileTargetCount: manifest.length,
          });
        }
        const summary = await (dependencies.runBatches ?? runCatalogBatches)({
          workspace, profile, targets: manifest, registry,
          adapters: dependencies.adapters ?? defaultAdapters(), bindings: await store.readAniLifeBindings(),
          selectedSources: sources, allowNetwork: true, refresh: false, clock: dependencies.clock,
          httpFactory: dependencies.httpFactory,
          ...(dependencies.coverPipeline ? { coverPipeline: dependencies.coverPipeline } : {}),
          batchSize, pauseMinMs: pauseMinSeconds * 1000, pauseMaxMs: pauseMaxSeconds * 1000,
          runBatch: dependencies.runBatch ?? runCatalogPipeline,
          writeSnapshot: (snapshot) => store.writeRunSnapshot(profile, snapshot),
          ...(dependencies.batchSleep ? { sleep: dependencies.batchSleep } : {}),
          ...(dependencies.batchRandom ? { random: dependencies.batchRandom } : {}),
          onProgress: ({ batchNumber, totalBatches, processedTargets, scheduledPauseMs }) => {
            const pause = scheduledPauseMs === null ? '' : `; next pause ${Math.ceil(scheduledPauseMs / 1000)}s`;
            writeLine(stdout, `Batch ${batchNumber}/${totalBatches}: ${processedTargets}/${manifest.length} targets${pause}`);
          },
        });
        writeLine(stdout, `Collection: ${summary.counts.targets} targets`);
        return summary.stoppedForSourcePause ? CLI_EXIT.SOURCE_PAUSED : CLI_EXIT.OK;
      }
      if (options['--batch-size'] !== undefined || options['--pause-min-seconds'] !== undefined
        || options['--pause-max-seconds'] !== undefined) {
        throw usageError('Batch options require the full3998 profile');
      }
      const summary = await runCatalogPipeline({
        workspace, profile, targets: manifest, registry,
        adapters: dependencies.adapters ?? defaultAdapters(), bindings: await store.readAniLifeBindings(), selectedSources: sources,
        allowNetwork: true, refresh: options['--refresh'] === true, clock: dependencies.clock,
        httpFactory: dependencies.httpFactory,
        ...(dependencies.coverPipeline ? { coverPipeline: dependencies.coverPipeline } : {}),
      });
      writeLine(stdout, `Collection: ${summary.counts.targets} targets`);
      return hasPausedSources(summary) ? CLI_EXIT.SOURCE_PAUSED : CLI_EXIT.OK;
    }
    onlyOptions(options, new Set(['--profile']));
    const profile = selectedProfile(options);
    const workspace = await openWorkspace(dependencies, false);
    const { manifest } = await targetManifest(workspace, profile, dependencies);
    if (command === 'rebuild') {
      const summary = await rebuildCatalogProfile({
        workspace, profile, targets: manifest,
        clock: dependencies.clock ?? { now: () => new Date().toISOString() },
      });
      writeLine(stdout, `Offline rebuild: ${summary.counts.targets} targets; network requests: ${summary.networkRequests}`);
      return CLI_EXIT.OK;
    }
    if (command === 'validate') {
      const result = await validateCatalogArtifacts({ workspace, profile, targets: manifest });
      const strict = await inspectCatalogArtifacts({ workspace, profile, repoRoot: dependencies.repoRoot ?? repoFromModule() });
      const valid = result.valid && strict.valid;
      writeLine(stdout, valid ? 'Catalog artifacts valid' : 'Catalog artifacts blocked');
      return valid ? CLI_EXIT.OK : CLI_EXIT.QUALITY_GATE_FAILED;
    }
    const report = await writeQualityReport({ workspace, profile, repoRoot: dependencies.repoRoot ?? repoFromModule() });
    writeLine(stdout, report.gate.passed ? 'Quality report written' : 'Quality report written with blockers');
    return report.gate.passed ? CLI_EXIT.OK : CLI_EXIT.QUALITY_GATE_FAILED;
  } catch (error) {
    writeLine(stderr, `Catalog command rejected: ${error?.code ?? 'CATALOG_COMMAND_FAILED'}`);
    return CLI_EXIT.USAGE_OR_SAFETY;
  }
}

async function targetManifestOrCreate(workspace, profile, dependencies) {
  const store = createCatalogArtifactStore({ workspace });
  const current = await store.readManifest(profile);
  if (Array.isArray(current)) {
    await assertApprovedTargetManifest({
      workspace, profile, manifest: current, repoRoot: dependencies.repoRoot ?? repoFromModule(),
    });
    return { store, manifest: current };
  }
  const repoRoot = dependencies.repoRoot ?? repoFromModule();
  const aliases = JSON.parse(await readFile(resolve(repoRoot, 'src', 'data', 'aliases.json'), 'utf8'));
  const idMap = (await store.readIdMap()) ?? {};
  const manifest = await buildTargetManifest({
    profile, rows: aliases, idMapStore: idMap,
    clock: dependencies.clock ?? { now: () => new Date().toISOString() },
    uuid: dependencies.uuid ?? (() => crypto.randomUUID()),
  });
  await store.writeIdMap(idMap);
  await store.writeManifest(profile, manifest);
  await assertApprovedTargetManifest({ workspace, profile, manifest, repoRoot });
  return { store, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
