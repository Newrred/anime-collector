import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import { loadSourceRegistry } from '../contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from '../lib/workspace.mjs';
import { createCatalogArtifactStore } from '../pipeline/artifact-store.mjs';
import { inspectImageBytes } from '../pipeline/covers.mjs';
import { isIncrementProfile } from '../pipeline/targets.mjs';
import { hasApprovedTargetManifest } from '../reports/quality-report.mjs';
import { createAniLifeReviewedCaptureEnvelope, validateAniLifeBinding } from '../sources/anilife-public-page-test.mjs';

const CAPTURE_METHOD = 'IAB_PUBLIC_RENDERED_PAGE_MINIMAL';
const HASH = /^[a-f0-9]{64}$/u;
const CONTENT_ID = /^[1-9]\d*$/u;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function typedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function repoFromModule() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-network') options.allowNetwork = true;
    else if (['--profile', '--batch-size', '--pause-min-seconds', '--pause-max-seconds', '--limit'].includes(token)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw typedError('CAPTURE_USAGE_INVALID');
      options[token.slice(2)] = value;
    } else throw typedError('CAPTURE_USAGE_INVALID');
  }
  const profile = options.profile ?? 'increment-2026-09';
  const integer = (name, fallback, minimum, maximum) => {
    const value = options[name] ?? String(fallback);
    if (!/^\d+$/u.test(value) || Number(value) < minimum || Number(value) > maximum) {
      throw typedError('CAPTURE_USAGE_INVALID');
    }
    return Number(value);
  };
  const batchSize = integer('batch-size', 100, 1, 100);
  const pauseMinSeconds = integer('pause-min-seconds', 120, 60, 3600);
  const pauseMaxSeconds = integer('pause-max-seconds', 200, pauseMinSeconds, 3600);
  return Object.freeze({
    profile,
    batchSize,
    pauseMinSeconds,
    pauseMaxSeconds,
    limit: integer('limit', 500, 1, 500),
    allowNetwork: options.allowNetwork === true,
  });
}

function normalizeTitle(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : null;
}

function allowedSourceUrl(value, { sourceConfig, contentId }) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !sourceConfig.coverOrigins.includes(url.origin) || url.pathname !== `/content/${contentId}`) {
      throw new TypeError('invalid content URL');
    }
    return url;
  } catch {
    throw typedError('CAPTURE_IDENTITY_MISMATCH');
  }
}

export function approvedImageLocation(value, { sourceConfig, contentId }) {
  try {
    const url = new URL(value);
    const match = new RegExp(
      `^(?:/images/anime/${contentId}(?:\\.poster)?\\.(jpg|jpeg|png|webp)|/posters/${contentId}-[a-z0-9_-]{1,128}\\.(jpg|jpeg|png|webp))$`,
      'iu',
    ).exec(url.pathname);
    if (!match || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !sourceConfig.coverOrigins.includes(url.origin)) throw new TypeError('invalid image URL');
    return Object.freeze({ url: url.href, pathname: url.pathname, extension: (match[1] ?? match[2]).toLowerCase() });
  } catch {
    throw typedError('CAPTURE_IMAGE_IDENTITY_MISMATCH');
  }
}

function mediaNode(rawJsonLd) {
  const nodes = rawJsonLd.flatMap((raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed
        : [parsed, ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
    } catch {
      return [];
    }
  });
  return nodes.find((node) => {
    const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
    return types.some((type) => ['TVSeries', 'Movie', 'VideoObject'].includes(type))
      && typeof node?.name === 'string';
  });
}

function rawImageUrl(media) {
  if (Array.isArray(media?.image)) return media.image[0];
  if (media?.image && typeof media.image === 'object') return media.image.url ?? media.image.contentUrl;
  return media?.image;
}

async function validExistingCapture({ workspace, profile, target, sourceConfig, binding }) {
  const contentId = target.incrementEvidence?.contentId;
  try {
    const entryPath = workspace.resolve('imports', 'anilife-detail-browser', profile, 'entries', `${contentId}.json`);
    const capture = JSON.parse(await readFile(entryPath, 'utf8'));
    const { captureSha256, ...content } = capture;
    if (!HASH.test(captureSha256 ?? '') || sha256(Buffer.from(JSON.stringify(content), 'utf8')) !== captureSha256
      || capture.targetKey !== target.targetKey || capture.moemoaAnimeId !== target.moemoaAnimeId
      || capture.contentId !== contentId || capture.profile !== profile || capture.captureMethod !== CAPTURE_METHOD) return false;
    const envelope = createAniLifeReviewedCaptureEnvelope({ target, binding, capture, sourceConfig });
    if (normalizeTitle(envelope.payload.title) !== normalizeTitle(target.seedTitles?.find((row) => row.locale === 'ko')?.value)
      || envelope.payload.imageUrl !== capture.imageSourceUrl) return false;
    approvedImageLocation(capture.imageSourceUrl, { sourceConfig, contentId });
    approvedImageLocation(capture.imageFetchedUrl, { sourceConfig, contentId });
    const imagePath = workspace.resolve('imports', 'anilife-detail-browser', profile, ...capture.imageFile.split('/'));
    const image = await readFile(imagePath);
    const imageStat = await stat(imagePath);
    return imageStat.isFile() && imageStat.size === capture.imageByteSize
      && sha256(image) === capture.imageSha256;
  } catch {
    return false;
  }
}

async function captureTarget({ page, workspace, profile, target, sourceConfig, responses }) {
  const contentId = target.incrementEvidence?.contentId;
  const expectedTitle = target.seedTitles?.find((row) => row.locale === 'ko')?.value;
  if (!CONTENT_ID.test(contentId ?? '') || target.targetKey !== `ANILIFE:${contentId}` || !expectedTitle) {
    throw typedError('CAPTURE_TARGET_INVALID');
  }
  const pageUrl = `${sourceConfig.baseUrl}/content/${contentId}`;
  responses.clear();
  const responseListener = (response) => {
    if (response.request().resourceType() === 'image') responses.set(response.url(), response);
  };
  page.on('response', responseListener);
  try {
    const navigation = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!navigation || navigation.status() !== 200 || page.url() !== pageUrl) throw typedError('CAPTURE_PAGE_INVALID');
    await page.waitForTimeout(2_500);
    const details = await page.evaluate(() => ({
      rawJsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent ?? ''),
      badges: [...document.querySelectorAll('.tv-work-badges span')]
        .map((node) => (node.textContent ?? '').trim()).filter(Boolean),
      heading: (document.querySelector('h1')?.textContent ?? '').trim(),
      pageTitle: document.title,
    }));
    const media = mediaNode(details.rawJsonLd);
    if (!media || normalizeTitle(media.name) !== normalizeTitle(expectedTitle)) {
      throw typedError('CAPTURE_IDENTITY_MISMATCH');
    }
    allowedSourceUrl(media.url, { sourceConfig, contentId });
    const original = approvedImageLocation(rawImageUrl(media), { sourceConfig, contentId });
    const expectedFetchedUrl = `${sourceConfig.baseUrl}${original.pathname}`;
    const currentSrc = await page.evaluate((url) => [...document.images]
      .map((image) => image.currentSrc).find((candidate) => candidate === url) ?? null, expectedFetchedUrl);
    if (currentSrc !== expectedFetchedUrl) throw typedError('CAPTURE_POSTER_ASSET_MISSING');
    const response = responses.get(expectedFetchedUrl);
    if (!response || response.status() !== 200) throw typedError('CAPTURE_POSTER_ASSET_MISSING');
    await response.finished();
    const imageBytes = await response.body();
    if (imageBytes.byteLength < 1 || imageBytes.byteLength > MAX_IMAGE_BYTES) {
      throw typedError('CAPTURE_IMAGE_SIZE_INVALID');
    }
    const imageMime = String(response.headers()['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if (!IMAGE_MIME.has(imageMime)) throw typedError('CAPTURE_IMAGE_MIME_INVALID');
    const inspection = inspectImageBytes({ declaredMime: imageMime, bytes: imageBytes });
    const imageRel = `images/${contentId}.${inspection.extension}`;
    const imagePath = workspace.resolve('imports', 'anilife-detail-browser', profile, ...imageRel.split('/'));
    await writeFile(imagePath, imageBytes);
    const entry = {
      schemaVersion: 1, profile, targetKey: target.targetKey, moemoaAnimeId: target.moemoaAnimeId,
      contentId, pageUrl, capturedAt: new Date().toISOString(), captureMethod: CAPTURE_METHOD,
      rawJsonLd: details.rawJsonLd, badges: details.badges, heading: details.heading, pageTitle: details.pageTitle,
      imageSourceUrl: original.url, imageFetchedUrl: expectedFetchedUrl, imageFile: imageRel,
      imageMime, imageByteSize: imageBytes.byteLength, imageSha256: sha256(imageBytes),
    };
    entry.captureSha256 = sha256(Buffer.from(JSON.stringify(entry), 'utf8'));
    await writeFile(workspace.resolve('imports', 'anilife-detail-browser', profile, 'entries', `${contentId}.json`),
      `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    return entry;
  } finally {
    page.off('response', responseListener);
  }
}

function errorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/u.test(error.code)
    ? error.code : 'CAPTURE_FAILED';
}

async function sleep(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function runAniLifeDetailCapture({ argv = process.argv.slice(2), repoRoot = repoFromModule() } = {}) {
  const options = parseArgs(argv);
  if (!options.allowNetwork || !isIncrementProfile(options.profile)) throw typedError('CAPTURE_USAGE_INVALID');
  const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot: process.env.MOEMOA_CATALOG_LAB_DIR });
  const store = createCatalogArtifactStore({ workspace });
  const [manifest, bindings, registry] = await Promise.all([
    store.readManifest(options.profile), store.readAniLifeBindings(), loadSourceRegistry({ repoRoot }),
  ]);
  if (!Array.isArray(manifest) || manifest.length < 1 || manifest.length > 500
    || !await hasApprovedTargetManifest({ workspace, profile: options.profile, manifest, repoRoot })) {
    throw typedError('TARGET_MANIFEST_INVALID');
  }
  const sourceConfig = registry.find((entry) => entry.sourceId === 'anilife_public');
  if (!sourceConfig || sourceConfig.status !== 'approved') throw typedError('SOURCE_NOT_REGISTERED');
  for (const target of manifest) validateAniLifeBinding(bindings[target.targetKey], { targetKey: target.targetKey });
  const root = workspace.resolve('imports', 'anilife-detail-browser', options.profile);
  await mkdir(workspace.resolve('imports', 'anilife-detail-browser', options.profile, 'entries'), { recursive: true });
  await mkdir(workspace.resolve('imports', 'anilife-detail-browser', options.profile, 'images'), { recursive: true });
  const existing = new Set((await readdir(workspace.resolve(
    'imports', 'anilife-detail-browser', options.profile, 'entries',
  ))).filter((name) => /^\d+\.json$/u.test(name)).map((name) => name.slice(0, -5)));
  const pending = [];
  for (const target of manifest) {
    const contentId = target.incrementEvidence.contentId;
    if (!existing.has(contentId) || !await validExistingCapture({
      workspace, profile: options.profile, target, sourceConfig, binding: bindings[target.targetKey],
    })) pending.push(target);
  }
  const selected = pending.slice(0, options.limit);
  const progress = {
    schemaVersion: 1, profile: options.profile, status: 'RUNNING', totalTargets: manifest.length,
    alreadyStored: manifest.length - pending.length, scheduled: selected.length,
    completed: 0, failed: 0, errors: {}, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const progressPath = resolve(root, 'script-progress.json');
  const saveProgress = async () => {
    progress.updatedAt = new Date().toISOString();
    await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  };
  await saveProgress();
  if (selected.length === 0) {
    progress.status = 'COMPLETE';
    progress.completedAt = new Date().toISOString();
    await saveProgress();
    return progress;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const responses = new Map();
    for (let index = 0; index < selected.length; index += 1) {
      const target = selected[index];
      progress.currentTarget = target.targetKey;
      try {
        await captureTarget({ page, workspace, profile: options.profile, target, sourceConfig, responses });
        progress.completed += 1;
      } catch (error) {
        const code = errorCode(error);
        progress.failed += 1;
        progress.errors[code] = (progress.errors[code] ?? 0) + 1;
        await writeFile(resolve(root, 'entries', `${target.incrementEvidence.contentId}.script.error.json`),
          `${JSON.stringify({ targetKey: target.targetKey, code, message: String(error?.message ?? error), failedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
      }
      await saveProgress();
      if (index + 1 < selected.length && (index + 1) % options.batchSize === 0) {
        const pauseSeconds = options.pauseMinSeconds
          + Math.floor(Math.random() * (options.pauseMaxSeconds - options.pauseMinSeconds + 1));
        progress.status = 'PAUSED_BETWEEN_BATCHES';
        progress.pauseSeconds = pauseSeconds;
        await saveProgress();
        await sleep(pauseSeconds * 1000);
        progress.status = 'RUNNING';
        delete progress.pauseSeconds;
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  delete progress.currentTarget;
  progress.status = progress.failed === 0 ? 'COMPLETE' : 'COMPLETE_WITH_ERRORS';
  progress.completedAt = new Date().toISOString();
  await saveProgress();
  return progress;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runAniLifeDetailCapture();
    console.log(`AniLife detail capture: ${result.completed}/${result.scheduled} captured; ${result.failed} failed; ${result.alreadyStored} already stored`);
    process.exitCode = result.failed === 0 ? 0 : 2;
  } catch (error) {
    console.error(`AniLife detail capture rejected: ${error?.code ?? 'CAPTURE_FAILED'}`);
    process.exitCode = 64;
  }
}
