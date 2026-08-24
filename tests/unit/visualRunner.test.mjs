import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import { writeVisualBaselineManifest } from '../../scripts/update-visual-baseline-manifest.mjs';
import {
  reserveLoopbackPort,
  runIsolatedE2E,
  sanitizedChildEnvironment,
  waitForLoopbackUrl,
} from '../../scripts/lib/isolatedE2eServer.mjs';
import { inspectVisualBaselinePolicy } from '../../tools/catalog-lab/visual-baseline-policy.mjs';
import { pngBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

class FakeChild extends EventEmitter {
  constructor({ autoExitCode = null } = {}) {
    super();
    this.exitCode = null;
    this.killed = false;
    if (autoExitCode !== null) {
      queueMicrotask(() => this.finish(autoExitCode));
    }
  }

  finish(code) {
    if (this.exitCode !== null) return;
    this.exitCode = code;
    this.emit('exit', code);
  }

  kill() {
    this.killed = true;
    this.finish(0);
    return true;
  }
}

test('visual runner reserves a loopback port without reusing an existing 4321 server', async () => {
  const sentinel = createServer();
  const ownsSentinel = await new Promise((resolve, reject) => {
    sentinel.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    sentinel.listen(4321, '127.0.0.1', () => resolve(true));
  });
  try {
    const reservation = await reserveLoopbackPort();
    try {
      assert.equal(reservation.host, '127.0.0.1');
      assert.notEqual(reservation.port, 4321);
    } finally {
      await reservation.release();
    }
  } finally {
    if (ownsSentinel) {
      sentinel.close();
      await once(sentinel, 'close');
    }
  }
});

test('test runners remove NO_COLOR before a child tool enables forced color', () => {
  assert.deepEqual(
    sanitizedChildEnvironment({ PATH: 'fixture', NO_COLOR: '1' }, { CI: '1' }),
    { PATH: 'fixture', CI: '1' },
  );
});

test('visual runner bounds a readiness connection that accepts but never responds', async () => {
  const sockets = new Set();
  const stalled = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  stalled.listen(0, '127.0.0.1');
  await once(stalled, 'listening');
  const address = stalled.address();
  const startedAt = Date.now();
  try {
    await assert.rejects(
      waitForLoopbackUrl(
        `http://127.0.0.1:${address.port}`,
        { exitCode: null },
        { attempts: 2, intervalMs: 1, requestTimeoutMs: 25 },
      ),
      /did not become ready/u,
    );
    assert.equal(Date.now() - startedAt < 500, true);
  } finally {
    for (const socket of sockets) socket.destroy();
    stalled.close();
    await once(stalled, 'close');
  }
});

test('visual runner owns and closes its Astro child after Playwright succeeds', async () => {
  const children = [];
  let released = false;
  const result = await runIsolatedE2E({
    playwrightArgs: ['tests/ui-readiness-functional.spec.ts', '--project=chromium'],
    cwd: 'D:/fixture',
    env: { PATH: 'fixture-path', NO_COLOR: '1' },
    stdout: { write() {} },
    dependencies: {
      reservePort: async () => ({
        host: '127.0.0.1',
        port: 45678,
        release: async () => { released = true; },
      }),
      waitForUrl: async () => true,
      spawnProcess: (_executable, args, options) => {
        const playwright = args.includes('node_modules/playwright/cli.js');
        const child = new FakeChild({ autoExitCode: playwright ? 0 : null });
        children.push({ args, options, child });
        return child;
      },
      signalSource: new EventEmitter(),
    },
  });

  assert.equal(result, 0);
  assert.equal(released, true);
  assert.equal(children.length, 2);
  assert.equal(children[0].child.killed, true);
  assert.equal(children[1].child.killed, false);
  assert.equal(children[0].options.env.CI, '1');
  assert.equal(children[1].options.env.PLAYWRIGHT_EXTERNAL_SERVER, '1');
  assert.equal(children[1].options.env.PLAYWRIGHT_BASE_URL, 'http://127.0.0.1:45678');
  assert.equal(children[1].options.env.MOEMOA_VISUAL_TEST, '1');
  assert.equal(Object.hasOwn(children[1].options.env, 'NO_COLOR'), false);
  assert.equal(
    children[1].options.env.PLAYWRIGHT_HTML_OUTPUT_DIR,
    resolve('D:/fixture', '..', '.moemoa-ui-test-results', 'report'),
  );
  assert.equal(children[1].args.includes(
    `--output=${resolve('D:/fixture', '..', '.moemoa-ui-test-results', 'test-results')}`,
  ), true);
});

test('visual runner closes both owned children when interrupted', async () => {
  const children = [];
  const signalSource = new EventEmitter();
  const run = runIsolatedE2E({
    playwrightArgs: [],
    stdout: { write() {} },
    dependencies: {
      reservePort: async () => ({ host: '127.0.0.1', port: 45679, release: async () => {} }),
      waitForUrl: async () => true,
      spawnProcess: () => {
        const child = new FakeChild();
        children.push(child);
        return child;
      },
      signalSource,
    },
  });
  while (children.length < 2) await new Promise((resolve) => setImmediate(resolve));
  signalSource.emit('SIGINT');

  assert.equal(await run, 130);
  assert.equal(children.length, 2);
  assert.equal(children.every((child) => child.killed), true);
  assert.equal(signalSource.listenerCount('SIGINT'), 0);
  assert.equal(signalSource.listenerCount('SIGTERM'), 0);
});

test('visual runner returns Playwright failure and still closes its Astro child', async () => {
  const children = [];
  const result = await runIsolatedE2E({
    playwrightArgs: [],
    stdout: { write() {} },
    dependencies: {
      reservePort: async () => ({ host: '127.0.0.1', port: 45680, release: async () => {} }),
      waitForUrl: async () => true,
      spawnProcess: (_executable, args) => {
        const child = new FakeChild({
          autoExitCode: args.includes('node_modules/playwright/cli.js') ? 7 : null,
        });
        children.push(child);
        return child;
      },
      signalSource: new EventEmitter(),
    },
  });

  assert.equal(result, 7);
  assert.equal(children[0].killed, true);
  assert.equal(children[1].killed, false);
});

test('visual baseline updater writes one deterministic manifest for synthetic PNG snapshots', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-visual-manifest-'));
  try {
    const second = join(
      fixtureRoot,
      'tests',
      'visual',
      'ui-readiness.visual.spec.ts-snapshots',
      'home-empty-en-dark-390x844-chromium-win32.png',
    );
    const first = join(
      fixtureRoot,
      'tests',
      'visual',
      'navigation.visual.spec.ts-snapshots',
      'navigation-en-dark-320x720-chromium-win32.png',
    );
    await mkdir(dirname(first), { recursive: true });
    await mkdir(dirname(second), { recursive: true });
    await writeFile(second, pngBytes);
    await writeFile(first, pngBytes);

    const manifest = await writeVisualBaselineManifest({ repoRoot: fixtureRoot });
    const stored = JSON.parse(await readFile(
      join(fixtureRoot, 'tests', 'visual', 'visual-baseline-manifest.json'),
      'utf8',
    ));

    assert.deepEqual(stored, manifest);
    assert.deepEqual(stored.entries.map((entry) => entry.path), [
      'tests/visual/navigation.visual.spec.ts-snapshots/navigation-en-dark-320x720-chromium-win32.png',
      'tests/visual/ui-readiness.visual.spec.ts-snapshots/home-empty-en-dark-390x844-chromium-win32.png',
    ]);
    assert.deepEqual(stored.entries.map((entry) => entry.scenario), [
      'navigation-en-dark-320x720-chromium-win32',
      'home-empty-en-dark-390x844-chromium-win32',
    ]);
    assert.equal(stored.entries.every((entry) => entry.assetClass === 'TEST_UI_SCREENSHOT'), true);
    assert.equal((await inspectVisualBaselinePolicy({ repoRoot: fixtureRoot })).violations.length, 0);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('visual baseline updater refuses a non-PNG artifact inside a snapshot directory', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-visual-manifest-invalid-'));
  try {
    const artifact = join(
      fixtureRoot,
      'tests',
      'visual',
      'ui-readiness.visual.spec.ts-snapshots',
      'not-a-screenshot.jpg',
    );
    await mkdir(dirname(artifact), { recursive: true });
    await writeFile(artifact, Buffer.from('not a screenshot'));

    await assert.rejects(
      writeVisualBaselineManifest({ repoRoot: fixtureRoot }),
      { code: 'VISUAL_BASELINE_POLICY_INVALID' },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
