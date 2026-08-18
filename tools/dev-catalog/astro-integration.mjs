import { openCatalogWorkspace } from '../catalog-lab/lib/workspace.mjs';
import { createDevelopmentCatalogReadModel } from './read-model.mjs';

const SEARCH_PATH = '/__moemoa-dev/catalog/search';
const COVER_PATH = /^\/__moemoa-dev\/catalog\/cover\/([1-9]\d{0,11})$/u;

function isLoopbackRequest(request) {
  const remote = String(request.socket?.remoteAddress ?? '').toLowerCase();
  const host = String(request.headers?.host ?? '').toLowerCase();
  const loopbackRemote = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const loopbackHost = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/u.test(host)
    || /^\[::1\](?::\d{1,5})?$/u.test(host);
  return loopbackRemote && loopbackHost;
}

function headers(response, contentType) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', contentType);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function endJson(response, statusCode, value) {
  response.statusCode = statusCode;
  headers(response, 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function safeCandidate(value) {
  const externalId = String(value?.sourceBinding?.externalId ?? '');
  if (value?.kind !== 'ANIME_REF' || value?.sourceBinding?.provider !== 'ANILIST'
    || !/^[1-9]\d{0,11}$/u.test(externalId)) return null;
  return {
    kind: 'ANIME_REF',
    displayTitle: value.displayTitle,
    aliases: value.aliases,
    genres: value.genres,
    sourceBinding: { provider: 'ANILIST', externalId },
    verificationState: value.verificationState,
    catalogSource: value.catalogSource,
    readiness: value.readiness,
    coverPreviewUrl: value.coverPreviewUrl,
  };
}

/** Connect-compatible loopback-only middleware used by Astro's development server. */
export function createDevelopmentCatalogMiddleware({ reader } = {}) {
  if (!reader || typeof reader.search !== 'function' || typeof reader.readCover !== 'function') {
    throw new TypeError('Development catalog reader is required');
  }
  return async function developmentCatalogMiddleware(request, response, next) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== SEARCH_PATH && !COVER_PATH.test(url.pathname)) return next();
    if (!isLoopbackRequest(request)) return endJson(response, 403, { error: 'FORBIDDEN' });
    if (request.method !== 'GET') return endJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    try {
      if (url.pathname === SEARCH_PATH) {
        const query = String(url.searchParams.get('q') ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
        if ([...query].length < 2 || [...query].length > 120) {
          return endJson(response, 400, { error: 'INVALID_QUERY' });
        }
        const results = (await reader.search(query, { limit: 8 })).map(safeCandidate).filter(Boolean);
        return endJson(response, 200, { schemaVersion: 1, results });
      }
      const externalId = COVER_PATH.exec(url.pathname)?.[1];
      const cover = await reader.readCover(externalId);
      if (!cover) return endJson(response, 404, { error: 'NOT_FOUND' });
      response.statusCode = 200;
      headers(response, cover.mimeType);
      response.end(cover.bytes);
      return undefined;
    } catch {
      return endJson(response, 500, { error: 'CATALOG_UNAVAILABLE' });
    }
  };
}

/** Astro integration that is inert for production builds and requires an explicit external workspace. */
export function createDevelopmentCatalogIntegration({
  repoRoot = process.cwd(),
  workspaceRoot = process.env.MOEMOA_CATALOG_LAB_DIR,
} = {}) {
  return {
    name: 'moemoa-development-catalog',
    hooks: {
      'astro:server:setup': async ({ server, logger }) => {
        if (!workspaceRoot) {
          logger.info('Development catalog is disabled (workspace not configured).');
          return;
        }
        try {
          const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot, create: false });
          const reader = createDevelopmentCatalogReadModel({ workspace });
          server.middlewares.use(createDevelopmentCatalogMiddleware({ reader }));
          logger.info('Development catalog is enabled from the external TEST_ONLY workspace.');
        } catch {
          logger.warn('Development catalog is disabled because its TEST_ONLY workspace is unavailable.');
        }
      },
    },
  };
}
