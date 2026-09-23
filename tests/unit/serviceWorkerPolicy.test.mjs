import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
function worker({ fetch = async () => { throw new Error('offline'); }, match = async () => undefined, names = [] } = {}) {
  const listeners = new Map(), puts = [], deleted = [], reads = [];
  const cache = { put: async (key, response) => puts.push([key, response]), match: async key => { reads.push(key); return match(key); } };
  const caches = { open: async () => cache, keys: async () => names, delete: async key => deleted.push(key) };
  const self = { registration: { scope: 'https://example.test/app/' }, location: { origin: 'https://example.test' },
    clients: { claim() {} }, skipWaiting() {}, addEventListener: (name, fn) => listeners.set(name, fn) };
  vm.runInNewContext(source, { self, caches, fetch, URL, Response, Promise });
  const dispatch = (path, options = {}) => {
    let result;
    listeners.get('fetch')({ request: { method: 'GET', mode: 'navigate', headers: new Headers(), url: new URL(path, self.registration.scope).href, ...options }, respondWith: promise => { result = promise; } });
    return result;
  };
  const lifecycle = async name => { let result; listeners.get(name)({ waitUntil: promise => { result = promise; } }); await result; };
  return { dispatch, lifecycle, puts, deleted, reads };
}
test('service worker installs static private route shells with no user credentials', async () => {
  const calls = [];
  const sw = worker({ fetch: async (url, options) => { calls.push([url, options]); return new Response('shell'); } });
  await sw.lifecycle('install');
  for (const path of ['archive/', 'boards/', 'memory/new/', 'memory/card/']) assert.ok(sw.puts.some(([key]) => key === `https://example.test/app/${path}`));
  assert.ok(calls.every(([, options]) => options.credentials === 'omit' && options.cache === 'reload'));
});
test('offline deep links use only their installed shell; unknown/public routes never fall back to home', async () => {
  const shell = new Response('local-shell');
  const sw = worker({ match: async key => key === 'https://example.test/app/memory/card/' ? shell : undefined });
  assert.equal(await sw.dispatch('memory/card/?id=card-123'), shell);
  await assert.rejects(sw.dispatch('public/board?id=123'), /offline/);
  await assert.rejects(sw.dispatch('u/?id=123'), /offline/);
});
test('tokens, authorization, and no-store always bypass route and asset caches', async () => {
  for (const [path, options] of [['memory/card/?access_token=private', {}], ['_astro/a.js', { headers: new Headers({ Authorization: 'Bearer private' }) }], ['archive/', { cache: 'no-store' }]]) {
    const sw = worker({ fetch: async (_, options) => { assert.equal(options.cache, 'no-store'); return new Response('network'); } });
    assert.equal(await (await sw.dispatch(path, options)).text(), 'network');
    assert.equal(sw.reads.length, 0); assert.equal(sw.puts.length, 0);
  }
});
test('build info, account APIs and public images are always fetched fresh', async () => {
  for (const path of ['build-info.json', 'api/account', 'public/image.jpg', 'sw.js']) {
    let version = 0;
    const sw = worker({ fetch: async (_, options) => { assert.equal(options.cache, 'no-store'); return new Response(String(++version)); } });
    assert.equal(await (await sw.dispatch(path, { mode: 'cors' })).text(), '1');
    assert.equal(await (await sw.dispatch(path, { mode: 'cors' })).text(), '2');
    assert.equal(sw.reads.length, 0); assert.equal(sw.puts.length, 0);
  }
});
test('failed or private responses never enter the immutable asset cache', async () => {
  for (const response of [new Response('bad', { status: 404 }), new Response('bad', { status: 500 }), new Response('private', { headers: { 'Cache-Control': 'private' } }), new Response('secret', { headers: { 'Cache-Control': 'no-store' } }), new Response('vary', { headers: { Vary: '*' } })]) {
    const sw = worker({ fetch: async () => response });
    await sw.dispatch('_astro/app.hash.js', { mode: 'cors' }); assert.equal(sw.puts.length, 0);
  }
  const sw = worker({ fetch: async () => new Response('asset') });
  await sw.dispatch('_astro/app.hash.js', { mode: 'cors' }); assert.equal(sw.puts.length, 1);
});
test('navigation responses never overwrite the static offline shell', async () => {
  const sw = worker({ fetch: async () => new Response('user-specific response') });
  await sw.dispatch('boards/?id=private'); assert.equal(sw.puts.length, 0);
});
test('activation deletes only old MOEMOA caches and preserves unrelated storage', async () => {
  const sw = worker({ names: ['ani-site-cache-v2', 'moemoa-static-old', 'moemoa-static-__MOEMOA_BUILD__', 'unrelated-cache'] });
  await sw.lifecycle('activate'); assert.deepEqual(sw.deleted, ['ani-site-cache-v2', 'moemoa-static-old']);
});
test('a failed shell install rejects activation rather than caching an error page', async () => {
  const sw = worker({ fetch: async () => new Response('bad', { status: 500 }) });
  await assert.rejects(sw.lifecycle('install'), /STATIC_SHELL_UNAVAILABLE/); assert.equal(sw.puts.length, 0);
});
