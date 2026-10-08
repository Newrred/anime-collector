import { timingSafeEqual } from 'node:crypto';

export function createPrivateObservationHandler({ enabled = false, secret, createBackend }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (!enabled) return send(503, { error: 'OBSERVATION_DISABLED' });
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'METHOD_NOT_ALLOWED' }); }
    const actual = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${secret || ''}`);
    if (typeof secret !== 'string' || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return send(401, { error: 'AUTH_REQUIRED' });
    }
    try {
      const result = await createBackend().rpc('observe_memory_private_image_capacity', {});
      if (!result?.observedAt || !Number.isSafeInteger(result.storedBytes)
        || !Number.isSafeInteger(result.reservedBytes) || !Number.isSafeInteger(result.globalReadBytes)) {
        return send(503, { error: 'OBSERVATION_FAILED' });
      }
      return send(200, { observedAt: result.observedAt, storedBytes: result.storedBytes,
        reservedBytes: result.reservedBytes, globalReadBytes: result.globalReadBytes });
    } catch {
      return send(503, { error: 'OBSERVATION_FAILED' });
    }
  };
}
