// Actual app and browser; Auth remains synthetic, RPC values come from local SQL.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

export async function runContentReviewBrowser({ user, rpc, verify }) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const origin = 'http://127.0.0.1:4387';
  const server = spawn(process.execPath, ['node_modules/astro/astro.js', 'dev', '--host', '127.0.0.1', '--port', '4387', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('Dedicated browser server exited');
      try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('Dedicated browser server unavailable');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.route('**/__publication-test/rpc/*', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1);
      await route.fulfill({ json: await rpc(name, route.request().postDataJSON()) });
    });
    await context.addInitScript(userId => {
      localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
      localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: { id: userId }, access_token: 'local-test-token' }));
      window.__MOEMOA_TEST_PUBLICATION_ADAPTERS__ = { policyRevision: 'TEST_ONLY_CONTENT', client: { rpc(name, args) {
        let signal;
        const result = { abortSignal(value) { signal = value; return result; }, then(resolve, reject) {
          return fetch(`/__publication-test/rpc/${name}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }).then(response => response.json()).then(resolve, reject);
        } };
        return result;
      } } };
    }, user);
    const page = await context.newPage();
    await page.goto(`${origin}/moderation/`);
    await page.getByRole('button', { name: 'Homes', exact: true }).click();
    await page.getByRole('button', { name: 'Gateway integration fixture', exact: true }).click();
    await expect(page.getByText('Synthetic latest bio', { exact: true })).toBeVisible();
    await page.getByLabel('Content classification', { exact: true }).selectOption('MATURE');
    const save = page.getByRole('button', { name: 'Save review decision', exact: true });
    await expect(save).toBeDisabled();
    await page.getByLabel('I reviewed the displayed content and selected classification.', { exact: true }).check();
    await save.click();
    await expect(page.getByText('Review decision saved.', { exact: true })).toBeVisible();
    verify();
    console.log('PASS: Chromium operator classification stores MATURE revision2 in real local database');
    await page.getByRole('button', { name: 'Refresh review queue', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gateway integration fixture', exact: true })).toHaveCount(0);
    console.log('PASS: Chromium refresh removes the database-classified home from pending queue');
    await page.screenshot({ path: fileURLToPath(new URL('../../.cache/content-review-db-browser.png', import.meta.url)), fullPage: true });
  } finally {
    await browser?.close();
    if (server.exitCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
  }
}
