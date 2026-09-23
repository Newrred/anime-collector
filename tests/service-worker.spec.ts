import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// A synthetic origin: never reads accounts, production, or a user's browser storage.
test('worker upgrade preserves local data, isolates caches, and refreshes sensitive responses', async ({ browser }) => {
  const worker = await readFile('public/sw.js', 'utf8');
  let revision = 'first';
  let assetStatus = 200;
  let networkDown = false;
  const server = createServer((req, res) => {
    if (networkDown) { res.destroy(); return; }
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(worker.replaceAll('__MOEMOA_BUILD__', revision)); return; }
    if (req.url?.startsWith('/_astro/')) { res.statusCode = assetStatus; res.setHeader('Cache-Control', 'public,max-age=31536000,immutable'); res.end(`asset-${revision}`); return; }
    if (req.url === '/build-info.json' || req.url?.startsWith('/api/') || req.url?.startsWith('/public/')) { res.end(revision); return; }
    // Known shells and icons are synthetic build output, containing no user data.
    res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate');
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Static shell</title><p>Offline shell</p>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      localStorage.setItem('private-test-record', 'keep-me');
      const old = await caches.open('ani-site-cache-v2');
      await old.put('/build-info.json', new Response('stale-private-response'));
      await caches.open('unrelated-cache');
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['moemoa-static-first', 'unrelated-cache']));
    expect(await page.evaluate(() => caches.has('ani-site-cache-v2'))).toBe(false);
    const read = (path: string) => page.evaluate(async p => (await fetch(p)).text(), path);
    expect(await read('/build-info.json')).toBe('first');
    expect(await read('/api/account')).toBe('first');
    expect(await read('/public/image')).toBe('first');
    expect(await read('/_astro/app.hash.js')).toBe('asset-first');
    assetStatus = 500;
    await read('/_astro/failure.hash.js');
    expect(await page.evaluate(async () => Boolean(await caches.match('/_astro/failure.hash.js')))).toBe(false);
    revision = 'second'; assetStatus = 200;
    expect(await read('/build-info.json')).toBe('second');
    expect(await read('/api/account')).toBe('second');
    expect(await read('/public/image')).toBe('second');
    expect(await page.evaluate(async () => Boolean(await caches.match('/api/account')))).toBe(false);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect.poll(() => page.evaluate(() => caches.has('moemoa-static-first'))).toBe(false);
    expect(await read('/_astro/app.secondhash.js')).toBe('asset-second');
    expect(await page.evaluate(() => localStorage.getItem('private-test-record'))).toBe('keep-me');
    expect(await page.evaluate(() => caches.has('unrelated-cache'))).toBe(true);
    networkDown = true;
    await context.setOffline(true);
    await page.goto(`${origin}/archive/?sort=recent`);
    await expect(page.locator('p')).toHaveText('Offline shell');
    const result = await page.evaluate(async () => {
      try { await fetch('/public/image'); return 'leaked'; } catch { return 'network-only'; }
    });
    expect(result).toBe('network-only');
    networkDown = false;
    await context.setOffline(false);
    // Rollback also installs a distinct version and discards the superseded cache.
    revision = 'first';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect.poll(() => page.evaluate(() => caches.has('moemoa-static-second'))).toBe(false);
    expect(await read('/build-info.json')).toBe('first');
  } finally { await context.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
