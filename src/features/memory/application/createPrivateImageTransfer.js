import { blobHash, optimizePrivateImage } from './optimizePrivateImage.js';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const SHA = /^[a-f0-9]{64}$/;
const safeErrors = new Set(['AUTH_REQUIRED','NOT_FOUND','PRIVATE_IMAGE_DISABLED','PRIVATE_IMAGE_PAUSED','PRIVATE_IMAGE_POLICY_STALE',
  'PRIVATE_IMAGE_RETIRED','PRIVATE_IMAGE_CONFLICT','PRIVATE_IMAGE_QUOTA_EXCEEDED','PRIVATE_IMAGE_CAPACITY_EXCEEDED',
  'PRIVATE_IMAGE_RATE_LIMITED','IMAGE_SIZE_LIMIT','OPERATION_MISMATCH']);

export function createPrivateImageTransfer({ ownerId, assetId, sourceVersion, getSession, getOwner, getAsset, readOriginal, journal,
  optimize = optimizePrivateImage, fetchImpl = globalThis.fetch, uuid = () => globalThis.crypto.randomUUID() }) {
  const key = `${ownerId}:${assetId}:${sourceVersion}`;
  const url = `/api/private-image?asset=${encodeURIComponent(assetId)}&version=${sourceVersion}`;
  async function context(signal) {
    if (signal?.aborted) fail('REQUEST_ABORTED');
    const [session, owner, asset] = await Promise.all([getSession(), getOwner(), getAsset()]);
    if (signal?.aborted) fail('REQUEST_ABORTED');
    if (!session?.access_token || owner?.id !== ownerId || ownerId !== `account:${session.user?.id}`) fail('AUTH_REQUIRED');
    if (!asset || asset.ownerId !== ownerId || asset.id !== assetId || asset.sync?.remoteVersion !== sourceVersion || asset.sync?.syncState !== 'SYNCED') fail('PRIVATE_IMAGE_SOURCE_CHANGED');
    return { session, asset };
  }
  async function request(target, init, signal) {
    const { session } = await context(signal);
    let response;
    try { response = await fetchImpl(target, { ...init, signal, cache: 'no-store', headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` } }); }
    catch { fail(signal?.aborted ? 'REQUEST_ABORTED' : 'PRIVATE_IMAGE_REQUEST_FAILED'); }
    await context(signal);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      fail(safeErrors.has(result?.error) ? result.error : 'PRIVATE_IMAGE_REQUEST_FAILED');
    }
    return response;
  }
  function manifest(value) {
    if (value?.state !== 'READY' || value.sourceVersion !== sourceVersion || !SHA.test(value.mainHash || '') ||
      !Number.isSafeInteger(value.mainBytes) || value.mainBytes < 1 || value.mainBytes > 1_000_000) fail('PRIVATE_IMAGE_REQUEST_FAILED');
    return value;
  }
  async function policy(signal) {
    const result = await (await request(`${url}&policy=1`, {}, signal)).json();
    await context(signal);
    if (!result || typeof result.revision !== 'string' || !result.revision || result.revision.length > 120 ||
      !Number.isSafeInteger(result.mainMaxBytes) || result.mainMaxBytes < 1 || result.mainMaxBytes > 1_000_000 ||
      !Number.isSafeInteger(result.transportBodyMaxBytes) || result.transportBodyMaxBytes < 1 || result.transportBodyMaxBytes > 1_500_000 ||
      !Number.isSafeInteger(result.quotaBytes) || result.quotaBytes < 0 || !Number.isSafeInteger(result.usedBytes) || result.usedBytes < 0) fail('PRIVATE_IMAGE_REQUEST_FAILED');
    if (result.representation) manifest(result.representation);
    return result;
  }
  return {
    policy,
    async pending(signal) { await context(signal); const value = await journal.get(key); await context(signal); return Boolean(value); },
    async upload({ consented, signal }) {
      if (consented !== true) fail('IMAGE_CONSENT_REQUIRED');
      const current = await policy(signal);
      if (current.representation) {
        const done = await journal.get(key);
        await context(signal);
        if (done) await journal.remove(key, done.operationId);
        return manifest(current.representation);
      }
      let record = await journal.get(key);
      const { asset } = await context(signal);
      if (!record) {
        const original = await readOriginal(asset.localRef);
        if (!(original instanceof Blob)) fail('ORIGINAL_IMAGE_UNAVAILABLE');
        const originalHash = await blobHash(original);
        if (originalHash !== asset.checksumSha256) fail('SOURCE_IMAGE_MISMATCH');
        const blob = await optimize(original, current, { signal });
        await context(signal);
        record = await journal.putIfAbsent({ key, ownerId, assetId, operationId: uuid(), policyRevision: current.revision, originalHash, blob });
      }
      await context(signal);
      if (record.originalHash !== asset.checksumSha256) fail('SOURCE_IMAGE_MISMATCH');
      if (record.policyRevision !== current.revision) fail('PRIVATE_IMAGE_POLICY_STALE');
      const response = await request('/api/private-image', { method: 'POST', headers: {
        'Content-Type': 'application/octet-stream', 'X-Moemoa-Asset': assetId, 'X-Moemoa-Version': String(sourceVersion),
        'X-Moemoa-Operation': record.operationId, 'X-Moemoa-Consent': record.policyRevision,
      }, body: record.blob }, signal);
      const result = manifest(await response.json());
      await context(signal);
      await journal.remove(key, record.operationId);
      return result;
    },
    async read(signal, variant = 'main') {
      if (!['main', 'thumb'].includes(variant)) fail('PRIVATE_IMAGE_REQUEST_FAILED');
      const current = await policy(signal);
      if (!current.representation) fail('NOT_FOUND');
      const expected = manifest(current.representation);
      const expectedBytes = variant === 'thumb' ? expected.thumbnailBytes : expected.mainBytes;
      const expectedHash = variant === 'thumb' ? expected.thumbnailHash : expected.mainHash;
      const limit = variant === 'thumb' ? 120_000 : 1_000_000;
      if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > limit || !SHA.test(expectedHash || '')) fail('PRIVATE_IMAGE_REQUEST_FAILED');
      const response = await request(variant === 'thumb' ? `${url}&variant=thumb` : url, {}, signal);
      if (response.headers.get('content-type')?.split(';')[0] !== 'image/webp') fail('PRIVATE_IMAGE_REQUEST_FAILED');
      const blob = await response.blob();
      if (blob.size !== expectedBytes || blob.size > limit || await blobHash(blob) !== expectedHash) fail('PRIVATE_IMAGE_REQUEST_FAILED');
      await context(signal);
      return blob;
    },
    async cancel(signal) {
      await context(signal);
      const record = await journal.get(key);
      if (!record) fail('PRIVATE_IMAGE_OPERATION_MISSING');
      const response = await request('/api/private-image', { method: 'DELETE', headers: { 'X-Moemoa-Operation': record.operationId } }, signal);
      const result = await response.json();
      if (result?.state !== 'DELETING' && result?.state !== 'DELETED') fail('PRIVATE_IMAGE_REQUEST_FAILED');
      await context(signal);
      await journal.remove(key, record.operationId);
    },
  };
}
