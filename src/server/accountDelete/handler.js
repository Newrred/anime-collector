const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_BODY_BYTES = 1024;
const STATUS = Object.freeze({
  INVALID_REQUEST: 400,
  CONFIRMATION_REQUIRED: 400,
  AUTH_REQUIRED: 401,
  ACCOUNT_DELETE_NOT_ALLOWED: 403,
  ACCOUNT_CHANGED: 409,
  ACCOUNT_DELETE_FAILED: 503,
  ACCOUNT_DELETE_SERVICE_UNAVAILABLE: 503,
});
const fail = code => { throw Object.assign(new Error(code), { code }); };
const send = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
};

async function readBody(req) {
  const type = req.headers?.['content-type'];
  if (typeof type !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(type)) fail('INVALID_REQUEST');
  const length = req.headers?.['content-length'];
  if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length)
    || Number(length) > MAX_BODY_BYTES)) fail('INVALID_REQUEST');
  try {
    let body = req.body;
    if (body === undefined) {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_BODY_BYTES) fail('INVALID_REQUEST');
        chunks.push(buffer);
      }
      body = Buffer.concat(chunks);
    }
    if (Buffer.isBuffer(body)) {
      if (body.length > MAX_BODY_BYTES) fail('INVALID_REQUEST');
      body = body.toString('utf8');
    }
    if (typeof body === 'string') {
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) fail('INVALID_REQUEST');
      body = JSON.parse(body);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(body))
      || Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) fail('INVALID_REQUEST');
    // Reject accidental extra identity/PII fields, not just an attacker-selected ID.
    if (Object.keys(body).some(key => !['expectedUserId', 'confirmed'].includes(key))) fail('INVALID_REQUEST');
    if (typeof body.expectedUserId !== 'string' || !UUID.test(body.expectedUserId)) fail('INVALID_REQUEST');
    if (body.confirmed !== true) fail('CONFIRMATION_REQUIRED');
    return body;
  } catch (error) {
    if (error?.code === 'CONFIRMATION_REQUIRED') throw error;
    fail('INVALID_REQUEST');
  }
}

/** Auth deletion only: success is not proof of Storage cleanup or local erasure. */
export function createAccountDeleteHandler({
  enabled = false, origin, preview = false, allowedEmailHashes, createBackend,
} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin, Authorization');
    if (enabled !== true) return send(res, 404, { error: 'ACCOUNT_DELETE_DISABLED' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }
    try {
      const site = new URL(origin);
      if (site.protocol !== 'https:' || site.origin !== origin) fail('ACCOUNT_DELETE_SERVICE_UNAVAILABLE');
      if (allowedEmailHashes !== undefined && typeof allowedEmailHashes !== 'string') fail('ACCOUNT_DELETE_SERVICE_UNAVAILABLE');
      const allowlist = (allowedEmailHashes || '').split(',').map(value => value.trim()).filter(Boolean);
      if ((preview && !allowlist.length) || allowlist.some(value => !/^[a-f0-9]{64}$/.test(value))) {
        fail('ACCOUNT_DELETE_SERVICE_UNAVAILABLE');
      }
      const fetchSite = req.headers?.['sec-fetch-site'];
      if (req.headers?.origin !== origin || (fetchSite !== undefined && fetchSite !== 'same-origin')) fail('INVALID_REQUEST');
      const authorization = req.headers?.authorization;
      if (typeof authorization !== 'string' || authorization.length > 8199
        || !/^Bearer [^\s]+$/.test(authorization)) fail('AUTH_REQUIRED');
      const body = await readBody(req);
      const backend = createBackend();
      const user = await backend.authenticate(authorization.slice(7));
      if (!user || typeof user.id !== 'string' || !UUID.test(user.id)) fail('AUTH_REQUIRED');
      if (body.expectedUserId !== user.id) fail('ACCOUNT_CHANGED');
      if (allowlist.length && !allowlist.includes(user.emailHash)) fail('ACCOUNT_DELETE_NOT_ALLOWED');
      // Only the verified server identity ever reaches the administrative API.
      const result = await backend.deleteUser(user.id);
      if (result !== true) fail('ACCOUNT_DELETE_FAILED');
      return send(res, 200, { deleted: true });
    } catch (error) {
      // Never echo provider payloads, email, tokens, IDs, stack traces or credentials.
      const code = Object.hasOwn(STATUS, error?.code) ? error.code : 'ACCOUNT_DELETE_SERVICE_UNAVAILABLE';
      return send(res, STATUS[code], { error: code });
    }
  };
}
