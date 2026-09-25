import { PrivateImageError, processPrivateImage, TRANSPORT_LIMIT, hash } from './processImage.js';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id = value => { if (!UUID.test(value || '')) throw new PrivateImageError('INVALID_REQUEST'); return value; };
const paths = value => { id(value); return [`${value}/main.webp`, `${value}/thumb.webp`]; };
const bearer = req => /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
const json = (res, value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
const projection = row => ({ id: row.id, state: row.state, sourceVersion: row.source_version, mainHash: row.main_hash,
  thumbnailHash: row.thumb_hash, mainBytes: row.main_bytes, thumbnailBytes: row.thumb_bytes, width: row.width, height: row.height, pipeline: row.pipeline });
async function body(req) {
  if (Number(req.headers['content-length']) > TRANSPORT_LIMIT) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
  if (req.body != null) {
    if (!Buffer.isBuffer(req.body)) throw new PrivateImageError('INVALID_BINARY_BODY');
    if (req.body.length > TRANSPORT_LIMIT) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
    return req.body;
  }
  const parts = []; let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > TRANSPORT_LIMIT) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}

export function createPrivateImageHandler({ enabled = false, allowedOrigins = [], createBackend, transform = processPrivateImage }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store'); res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Vary', 'Authorization, Origin');
    try {
      if (!enabled) throw new PrivateImageError('PRIVATE_IMAGE_DISABLED', 503);
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) throw new PrivateImageError('ORIGIN_NOT_ALLOWED', 403);
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Moemoa-Asset, X-Moemoa-Version, X-Moemoa-Operation, X-Moemoa-Consent');
        res.statusCode = 204; res.end(); return;
      }
      if (!['GET','POST','DELETE'].includes(req.method)) throw new PrivateImageError('METHOD_NOT_ALLOWED', 405);
      const backend = createBackend(), user = await backend.user(bearer(req));
      if (req.method === 'DELETE') {
        await user.rpc('cancel_memory_private_image', { p_operation: id(req.headers['x-moemoa-operation']) });
        json(res, { state: 'DELETING' }); return;
      }
      if (req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0] !== 'application/octet-stream') throw new PrivateImageError('INVALID_BINARY_BODY');
        const asset = id(req.headers['x-moemoa-asset']), operation = id(req.headers['x-moemoa-operation']), version = Number(req.headers['x-moemoa-version']);
        if (!Number.isSafeInteger(version) || version < 1) throw new PrivateImageError('INVALID_REQUEST');
        const policy = await user.rpc('get_memory_private_image_policy', { p_asset: asset, p_version: version });
        if (req.headers['x-moemoa-consent'] !== policy.revision) throw new PrivateImageError('PRIVATE_IMAGE_POLICY_STALE', 409);
        await user.rpc('authorize_memory_private_image_attempt', { p_asset: asset, p_version: version, p_policy: policy.revision });
        const output = await transform(await body(req), policy);
        const reservation = await backend.rpc('reserve_memory_private_image', { p_owner: user.id, p_asset: asset, p_version: version, p_operation: operation, p_policy: policy.revision,
          p_input_hash: output.inputHash, p_main_hash: output.mainHash, p_thumb_hash: output.thumbHash,
          p_main_bytes: output.main.length, p_thumb_bytes: output.thumb.length, p_width: output.width, p_height: output.height });
        if (reservation.state === 'READY') { json(res, projection(reservation)); return; }
        if (reservation.state !== 'PREPARING') throw new PrivateImageError('PRIVATE_IMAGE_RETIRED', 409);
        const [mainPath, thumbPath] = paths(reservation.id);
        // Never delete after an ambiguous write/finalization; same operation retries immutable objects.
        await backend.put(mainPath, output.main); await backend.put(thumbPath, output.thumb);
        await backend.rpc('complete_memory_private_image', { p_id: reservation.id });
        json(res, projection({ ...reservation, state: 'READY' })); return;
      }
      const query = new URL(req.url, 'https://local.invalid').searchParams;
      for (const key of query.keys()) if (!['asset','version','variant','policy'].includes(key) || query.getAll(key).length !== 1) throw new PrivateImageError('INVALID_REQUEST');
      const asset = id(query.get('asset')), version = Number(query.get('version')), variant = query.get('variant') || 'main';
      if (!Number.isSafeInteger(version) || version < 1 || !['main','thumb'].includes(variant)) throw new PrivateImageError('INVALID_REQUEST');
      if (query.has('policy')) {
        if (query.get('policy') !== '1') throw new PrivateImageError('INVALID_REQUEST');
        json(res, await user.rpc('get_memory_private_image_policy', { p_asset: asset, p_version: version })); return;
      }
      const resolve = charge => user.rpc('read_memory_private_image', { p_asset: asset, p_version: version, p_variant: variant, p_charge: charge });
      const reference = await resolve(true), filePaths = paths(reference.id);
      const bytes = await backend.get(filePaths[variant === 'main' ? 0 : 1]);
      if (bytes.length > 1_000_000 || bytes.length !== reference.bytes || hash(bytes) !== reference.hash) throw new PrivateImageError('PRIVATE_IMAGE_STORAGE_FAILED', 503);
      const latest = await resolve(false);
      if (latest.id !== reference.id || latest.hash !== reference.hash) throw new PrivateImageError('NOT_FOUND', 404);
      res.setHeader('Content-Type', 'image/webp'); res.setHeader('Content-Length', bytes.length); res.end(bytes);
    } catch (error) {
      const safe = error instanceof PrivateImageError ? error : new PrivateImageError('PRIVATE_IMAGE_SERVICE_FAILED', 503);
      res.statusCode = safe.status; json(res, { error: safe.code });
    }
  };
}

export async function cleanupPrivateImages(backend) {
  const pending = await backend.rpc('claim_memory_private_image_cleanup', {});
  let deleted = 0, failed = 0;
  for (const row of pending) {
    try { await backend.remove(paths(row.id)); await backend.rpc('complete_memory_private_image_cleanup', { p_id: row.id }); deleted++; }
    catch { failed++; }
  }
  return { deleted, failed };
}
