import { timingSafeEqual } from 'node:crypto';
import { cleanupPrivateImages } from './handler.js';

export function createPrivateCleanupHandler({ enabled = false, secret, createBackend }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (!enabled) return send(503, { error: 'CLEANUP_DISABLED' });
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'METHOD_NOT_ALLOWED' }); }
    const actual = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${secret || ''}`);
    if (typeof secret !== 'string' || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return send(401, { error: 'AUTH_REQUIRED' });
    }
    try {
      const { deleted, failed } = await cleanupPrivateImages(createBackend());
      return send(failed ? 503 : 200, { deleted, failed });
    } catch {
      return send(503, { error: 'CLEANUP_FAILED' });
    }
  };
}
