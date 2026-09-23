import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const CAPTURE_METHOD = 'IAB_PUBLIC_RENDERED_PAGE_MINIMAL';
const HASH = /^[a-f0-9]{64}$/u;
const CONTENT_ID = /^[1-9]\d*$/u;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_EXTENSION = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function typedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedTitle(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : null;
}

function mediaNode(rawJsonLd) {
  return rawJsonLd.flatMap((raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed
        : [parsed, ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
    } catch {
      return [];
    }
  }).find((node) => {
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

function exactPublicUrl(value, { origins, contentId }) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !origins.includes(url.origin) || url.pathname !== `/content/${contentId}`) {
      throw new TypeError('invalid public URL');
    }
    return url;
  } catch {
    throw typedError('CAPTURE_IDENTITY_MISMATCH');
  }
}

function exactImageUrl(value, { origins, contentId }) {
  try {
    const url = new URL(value);
    const match = new RegExp(
      `^(?:/images/anime/${contentId}(?:\\.poster)?\\.(jpg|jpeg|png|webp)|/posters/${contentId}-[a-z0-9_-]{1,128}\\.(jpg|jpeg|png|webp))$`,
      'iu',
    ).exec(url.pathname);
    if (!match || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !origins.includes(url.origin)) throw new TypeError('invalid image URL');
    return Object.freeze({
      href: url.href,
      pathname: url.pathname,
      extension: (match[1] ?? match[2]).toLowerCase(),
    });
  } catch {
    throw typedError('CAPTURE_IMAGE_IDENTITY_MISMATCH');
  }
}

async function existingCaptureValid({ root, profile, target, origins, baseUrl }) {
  const contentId = target.incrementEvidence?.contentId;
  try {
    const capture = JSON.parse(await readFile(join(root, 'entries', `${contentId}.json`), 'utf8'));
    const { captureSha256, ...content } = capture;
    if (!HASH.test(captureSha256 ?? '') || sha256(Buffer.from(JSON.stringify(content), 'utf8')) !== captureSha256
      || capture.schemaVersion !== 1 || capture.profile !== profile
      || capture.targetKey !== target.targetKey || capture.moemoaAnimeId !== target.moemoaAnimeId
      || capture.contentId !== contentId || capture.captureMethod !== CAPTURE_METHOD
      || capture.pageUrl !== `${baseUrl}/content/${contentId}` || !HASH.test(capture.imageSha256 ?? '')
      || typeof capture.imageFile !== 'string'
      || !new RegExp(`^images/${contentId}\\.(?:jpg|jpeg|png|webp)$`, 'iu').test(capture.imageFile)) return false;
    const media = mediaNode(capture.rawJsonLd);
    const expectedTitle = target.seedTitles?.find((row) => row.locale === 'ko')?.value;
    if (!media || normalizedTitle(media.name) !== normalizedTitle(expectedTitle)
      || rawImageUrl(media) !== capture.imageSourceUrl) return false;
    exactPublicUrl(media.url, { origins, contentId });
    exactImageUrl(capture.imageSourceUrl, { origins, contentId });
    exactImageUrl(capture.imageFetchedUrl, { origins, contentId });
    const image = await readFile(join(root, ...capture.imageFile.split('/')));
    const imageInfo = await stat(join(root, ...capture.imageFile.split('/')));
    return imageInfo.isFile() && image.byteLength === capture.imageByteSize && sha256(image) === capture.imageSha256;
  } catch {
    return false;
  }
}

async function captureOne({ tab, root, profile, target, sourceConfig }) {
  const contentId = String(target.incrementEvidence?.contentId ?? '');
  const expectedTitle = target.seedTitles?.find((row) => row.locale === 'ko')?.value;
  if (!CONTENT_ID.test(contentId) || target.targetKey !== `ANILIFE:${contentId}` || !expectedTitle) {
    throw typedError('CAPTURE_TARGET_INVALID');
  }
  const pageUrl = `${sourceConfig.baseUrl}/content/${contentId}`;
  await tab.goto(pageUrl);
  await tab.playwright.waitForLoadState({ state: 'domcontentloaded', timeoutMs: 20_000 }).catch(() => {});
  await tab.playwright.waitForTimeout(2_500);
  if (await tab.url() !== pageUrl) throw typedError('CAPTURE_PAGE_REDIRECTED');
  const details = await tab.playwright.evaluate(() => ({
    rawJsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => node.textContent ?? ''),
    badges: [...document.querySelectorAll('.tv-work-badges span')]
      .map((node) => (node.textContent ?? '').trim()).filter(Boolean),
    heading: (document.querySelector('h1')?.textContent ?? '').trim(),
    pageTitle: document.title,
  }));
  const media = mediaNode(details.rawJsonLd);
  if (!media || normalizedTitle(media.name) !== normalizedTitle(expectedTitle)) {
    throw typedError('CAPTURE_IDENTITY_MISMATCH');
  }
  exactPublicUrl(media.url, { origins: sourceConfig.coverOrigins, contentId });
  const image = exactImageUrl(rawImageUrl(media), { origins: sourceConfig.coverOrigins, contentId });
  const expectedAssetUrl = `${sourceConfig.baseUrl}${image.pathname}`;
  const assets = await tab.capabilities.get('pageAssets');
  let inventory = await assets.list();
  let asset = inventory.assets.find((row) => row.kind === 'image' && row.url === expectedAssetUrl);
  if (!asset) {
    await tab.playwright.waitForTimeout(2_000);
    inventory = await assets.list();
    asset = inventory.assets.find((row) => row.kind === 'image' && row.url === expectedAssetUrl);
  }
  if (!asset) throw typedError('CAPTURE_POSTER_ASSET_MISSING');
  const bundled = await assets.bundle({ inventoryId: inventory.id, assetIds: [asset.id] });
  if (bundled.summary.downloadedCount !== 1 || bundled.failures.length || bundled.assets.length !== 1) {
    throw typedError('CAPTURE_POSTER_DOWNLOAD_FAILED', bundled.failures[0]?.reason);
  }
  const downloaded = bundled.assets[0];
  const mime = String(downloaded.contentType ?? '').split(';', 1)[0].trim().toLowerCase();
  const sourceExtension = extname(downloaded.name ?? image.pathname).slice(1).toLowerCase();
  if (downloaded.url !== expectedAssetUrl || !IMAGE_MIME.has(mime)
    || sourceExtension !== image.extension || !['jpg', 'jpeg', 'png', 'webp'].includes(sourceExtension)) {
    throw typedError('CAPTURE_IMAGE_METADATA_INVALID');
  }
  const extension = MIME_EXTENSION[mime];
  const imageRel = `images/${contentId}.${extension}`;
  const imagePath = join(root, ...imageRel.split('/'));
  await copyFile(downloaded.path, imagePath);
  const bytes = await readFile(imagePath);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw typedError('CAPTURE_IMAGE_SIZE_INVALID');
  }
  const entry = {
    schemaVersion: 1, profile, targetKey: target.targetKey, moemoaAnimeId: target.moemoaAnimeId,
    contentId, pageUrl, capturedAt: new Date().toISOString(), captureMethod: CAPTURE_METHOD,
    rawJsonLd: details.rawJsonLd, badges: details.badges, heading: details.heading,
    pageTitle: details.pageTitle, imageSourceUrl: image.href, imageFetchedUrl: downloaded.url,
    imageFile: imageRel, imageMime: mime, imageByteSize: bytes.byteLength, imageSha256: sha256(bytes),
  };
  entry.captureSha256 = sha256(Buffer.from(JSON.stringify(entry), 'utf8'));
  await writeFile(join(root, 'entries', `${contentId}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  return entry;
}

async function boundedPause(totalMilliseconds, heartbeat) {
  let remaining = totalMilliseconds;
  while (remaining > 0) {
    const duration = Math.min(30_000, remaining);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, duration));
    remaining -= duration;
    await heartbeat(remaining);
  }
}

/** Runs a resumable AniLife capture using an already policy-approved in-app browser tab. */
export async function runInAppAniLifeCapture({
  tab, workspaceRoot, profile, manifest, sourceConfig, batchSize = 100, batchOffset = 0,
  pauseMinSeconds = 120, pauseMaxSeconds = 200, onProgress = async () => {},
} = {}) {
  if (!tab || typeof tab.goto !== 'function' || typeof tab.playwright?.evaluate !== 'function'
    || typeof workspaceRoot !== 'string' || !/^increment-\d{4}-\d{2}$/u.test(profile ?? '')
    || !Array.isArray(manifest) || manifest.length < 1 || manifest.length > 500
    || sourceConfig?.sourceId !== 'anilife_public' || sourceConfig.status !== 'approved'
    || typeof sourceConfig.baseUrl !== 'string' || !Array.isArray(sourceConfig.coverOrigins)
    || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100
    || !Number.isInteger(batchOffset) || batchOffset < 0 || batchOffset >= batchSize
    || pauseMinSeconds < 60 || pauseMaxSeconds < pauseMinSeconds || pauseMaxSeconds > 3600) {
    throw typedError('IN_APP_CAPTURE_INPUT_INVALID');
  }
  const root = resolve(workspaceRoot, 'imports', 'anilife-detail-browser', profile);
  let sentinel;
  try {
    sentinel = JSON.parse(await readFile(resolve(workspaceRoot, 'TEST_ONLY.json'), 'utf8'));
  } catch {
    throw typedError('CATALOG_WORKSPACE_REQUIRED');
  }
  if (sentinel?.kind !== 'MOEMOA_CATALOG_LAB' || sentinel.schemaVersion !== 1) {
    throw typedError('CATALOG_WORKSPACE_REQUIRED');
  }
  await mkdir(join(root, 'entries'), { recursive: true });
  await mkdir(join(root, 'images'), { recursive: true });
  const existingNames = new Set((await readdir(join(root, 'entries')))
    .filter((name) => /^\d+\.json$/u.test(name)).map((name) => name.slice(0, -5)));
  const pending = [];
  for (const target of manifest) {
    const contentId = target.incrementEvidence?.contentId;
    if (!existingNames.has(contentId) || !await existingCaptureValid({
      root, profile, target, origins: sourceConfig.coverOrigins, baseUrl: sourceConfig.baseUrl,
    })) pending.push(target);
  }
  const progress = {
    schemaVersion: 1, profile, status: 'RUNNING', total: manifest.length,
    alreadyStored: manifest.length - pending.length, scheduled: pending.length,
    attempted: 0, stored: 0, failed: 0, errors: {}, startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const progressPath = join(root, 'in-app-script-progress.json');
  const update = async (extra = {}) => {
    Object.assign(progress, extra, { updatedAt: new Date().toISOString() });
    await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
    await onProgress(Object.freeze({ ...progress }));
  };
  await update();
  for (const target of pending) {
    progress.attempted += 1;
    try {
      await captureOne({ tab, root, profile, target, sourceConfig });
      progress.stored += 1;
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'CAPTURE_FAILED';
      progress.failed += 1;
      progress.errors[code] = (progress.errors[code] ?? 0) + 1;
      await writeFile(join(root, 'entries', `${target.incrementEvidence.contentId}.in-app-script.error.json`),
        `${JSON.stringify({ targetKey: target.targetKey, code, message: String(error?.message ?? error), failedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
    }
    await update({ currentTarget: target.targetKey });
    const requestCount = batchOffset + progress.attempted;
    if (progress.attempted < pending.length && requestCount % batchSize === 0) {
      const pauseSeconds = pauseMinSeconds
        + Math.floor(Math.random() * (pauseMaxSeconds - pauseMinSeconds + 1));
      await update({ status: 'PAUSED_BETWEEN_BATCHES', pauseSeconds });
      await boundedPause(pauseSeconds * 1000, async (remainingMs) => update({ pauseRemainingSeconds: remainingMs / 1000 }));
      delete progress.pauseSeconds;
      delete progress.pauseRemainingSeconds;
      await update({ status: 'RUNNING' });
    }
  }
  delete progress.currentTarget;
  progress.status = progress.failed === 0 ? 'COMPLETE' : 'COMPLETE_WITH_ERRORS';
  progress.completedAt = new Date().toISOString();
  await update();
  return Object.freeze({ ...progress });
}
