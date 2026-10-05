import { createServer } from 'node:http';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_ROOT = fileURLToPath(new URL('../design/prototypes/film-archive/', import.meta.url));
export const DEFAULT_PAGE = 'moemoa-film-grid.html';
export const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
});

export function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Validate the raw request before URL normalization could erase traversal segments.
export function requestFilePath(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) throw httpError(400, 'Invalid request path');
  const raw = target.split(/[?#]/, 1)[0];
  if (/%(?:2f|5c|25)/i.test(raw)) throw httpError(400, 'Encoded separators are not allowed');
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { throw httpError(400, 'Malformed path encoding'); }
  if (/[\\\u0000-\u001f\u007f:<>"|?*]/.test(decoded)) throw httpError(400, 'Invalid path character');
  if (decoded === '/') return DEFAULT_PAGE;
  const segments = decoded.slice(1).split('/');
  if (segments.some((part) => !part || part.startsWith('.') || /[.\s]$/.test(part))) throw httpError(403, 'Path is not allowed');
  if (!Object.hasOwn(MIME_TYPES, path.extname(decoded).toLowerCase())) throw httpError(403, 'File type is not allowed');
  return segments.join(path.sep);
}

export async function safeFile(root, relative) {
  const candidate = path.resolve(root, relative);
  if (!isWithinRoot(root, candidate)) throw httpError(403, 'Path is not allowed');
  // Reject symlinks/junctions entirely, including ones currently pointing inside.
  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep)) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw httpError(403, 'Linked paths are not allowed');
  }
  const resolved = await realpath(candidate);
  if (!isWithinRoot(root, resolved)) throw httpError(403, 'Path is not allowed');
  if (!(await stat(resolved)).isFile()) throw httpError(404, 'Not found');
  return resolved;
}

function send(request, response, status, body, headers = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': bytes.length,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin', ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : bytes);
}

// Importing this module never listens. The CLI has no --host or --root override.
export async function createDesignPrototypeServer({ root = DEFAULT_ROOT } = {}) {
  const resolvedRoot = await realpath(root);
  if (!(await stat(resolvedRoot)).isDirectory()) throw new Error('Design prototype root is not a directory');
  return createServer(async (request, response) => {
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(request.headers.host || '')) {
        return send(request, response, 403, 'Loopback host required');
      }
      if (!['GET', 'HEAD'].includes(request.method)) return send(request, response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
      const relative = requestFilePath(request.url);
      const file = await safeFile(resolvedRoot, relative);
      const body = await readFile(file);
      send(request, response, 200, body, { 'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] });
    } catch (error) {
      const status = error.status || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500);
      send(request, response, status, status === 500 ? 'Unable to read design file' : status === 404 ? 'Not found' : error.message);
    }
  });
}

export function parseArguments(args) {
  if (args.length === 0) return { port: 4348 };
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { help: true };
  if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) throw new Error('Usage: node scripts/serve-design-prototypes.mjs [--port 1..65535]');
  const port = Number(args[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535');
  return { port };
}

export async function startDesignPrototypeServer({ port = 4348, root = DEFAULT_ROOT } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = await createDesignPrototypeServer({ root });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log('Usage: node scripts/serve-design-prototypes.mjs [--port 1..65535]\nLoopback-only static design preview; default port 4348.');
    else {
      const server = await startDesignPrototypeServer(options);
      console.log(`Design preview: http://127.0.0.1:${server.address().port}/\nFictional prototype only. Press Ctrl+C to stop.`);
      const stop = () => { server.close(); server.closeAllConnections(); };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    }
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? 'Design preview port is already in use. Stop the existing preview or choose --port 4349.'
      : `Design preview failed: ${error.code === 'ENOENT' ? 'design/prototypes/film-archive is missing; fetch the handoff files first.' : error.message}`);
    process.exitCode = 1;
  }
}
