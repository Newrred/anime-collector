import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const READY_ATTEMPTS = 120;
const READY_INTERVAL_MS = 250;
const STOP_TIMEOUT_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function reserveLoopbackPort({ host = DEFAULT_HOST } = {}) {
  if (host !== DEFAULT_HOST) throw new TypeError('Visual test server must use the fixed loopback host');
  const server = createServer();
  server.unref();
  server.listen({ host, port: 0, exclusive: true });
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== host) {
    server.close();
    throw new Error('Visual test port reservation returned an unsafe address');
  }
  let released = false;
  return Object.freeze({
    host,
    port: address.port,
    async release() {
      if (released) return;
      released = true;
      server.close();
      await once(server, 'close');
    },
  });
}

export async function waitForLoopbackUrl(baseUrl, child, {
  attempts = READY_ATTEMPTS,
  intervalMs = READY_INTERVAL_MS,
  requestTimeoutMs = 1000,
  fetchImpl = fetch,
} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Astro visual test server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetchImpl(baseUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) {
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
    } catch {
      // The owned server has not reached readiness yet.
    }
    await sleep(intervalMs);
  }
  throw new Error('Astro visual test server did not become ready before the deadline');
}

async function childExitCode(child) {
  if (child.exitCode !== null) return child.exitCode ?? 1;
  const [code] = await once(child, 'exit');
  return code ?? 1;
}

function settleBeforeTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ timedOut: false, value });
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function stopOwnedChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  const graceful = await settleBeforeTimeout(childExitCode(child), STOP_TIMEOUT_MS);
  if (graceful.timedOut && child.exitCode === null) {
    child.kill('SIGKILL');
    await settleBeforeTimeout(childExitCode(child), STOP_TIMEOUT_MS);
  }
}

function validatePlaywrightArgs(playwrightArgs) {
  if (!Array.isArray(playwrightArgs) || playwrightArgs.some((value) => typeof value !== 'string')) {
    throw new TypeError('Playwright arguments must be an array of strings');
  }
  if (playwrightArgs.some((value) => value === '--output' || value.startsWith('--output='))) {
    throw new TypeError('Visual test output is owned by the isolated runner');
  }
  return [...playwrightArgs];
}

export function sanitizedChildEnvironment(env, overrides = {}) {
  const childEnv = { ...env, ...overrides };
  delete childEnv.NO_COLOR;
  return childEnv;
}

export async function runIsolatedE2E({
  playwrightArgs,
  cwd = process.cwd(),
  env = process.env,
  stdout = process.stdout,
  dependencies = {},
} = {}) {
  const args = validatePlaywrightArgs(playwrightArgs ?? []);
  const reservePort = dependencies.reservePort ?? reserveLoopbackPort;
  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const waitForUrl = dependencies.waitForUrl ?? waitForLoopbackUrl;
  const signalSource = dependencies.signalSource ?? process;
  const reservation = await reservePort();
  const baseUrl = `http://${reservation.host}:${reservation.port}`;
  const artifactRoot = dependencies.artifactRoot ?? resolve(cwd, '..', '.moemoa-ui-test-results');
  let astro = null;
  let playwright = null;
  let reservationReleased = false;
  let resolveSignal;
  const signal = new Promise((resolve) => { resolveSignal = resolve; });
  const onSigint = () => resolveSignal({ kind: 'signal', code: 130 });
  const onSigterm = () => resolveSignal({ kind: 'signal', code: 143 });
  signalSource.once('SIGINT', onSigint);
  signalSource.once('SIGTERM', onSigterm);

  try {
    await reservation.release();
    reservationReleased = true;
    astro = spawnProcess(
      process.execPath,
      ['node_modules/astro/astro.js', 'dev', '--host', reservation.host, '--port', String(reservation.port), '--strictPort'],
      {
        cwd,
        stdio: 'inherit',
        env: sanitizedChildEnvironment(env, {
          CI: '1',
          ASTRO_TELEMETRY_DISABLED: '1',
          MOEMOA_VISUAL_TEST: '1',
        }),
      },
    );
    stdout.write(`Visual test server: ${baseUrl}\n`);

    const ready = Promise.resolve(waitForUrl(baseUrl, astro)).then(
      () => ({ kind: 'ready' }),
      (error) => ({ kind: 'error', error }),
    );
    const readyResult = await Promise.race([ready, signal]);
    if (readyResult.kind === 'signal') return readyResult.code;
    if (readyResult.kind === 'error') throw readyResult.error;

    playwright = spawnProcess(
      process.execPath,
      [
        'node_modules/playwright/cli.js',
        'test',
        ...args,
        `--output=${resolve(artifactRoot, 'test-results')}`,
      ],
      {
        cwd,
        stdio: 'inherit',
        env: sanitizedChildEnvironment(env, {
          PLAYWRIGHT_EXTERNAL_SERVER: '1',
          PLAYWRIGHT_BASE_URL: baseUrl,
          PLAYWRIGHT_HTML_OPEN: 'never',
          PLAYWRIGHT_HTML_OUTPUT_DIR: resolve(artifactRoot, 'report'),
          MOEMOA_VISUAL_TEST: '1',
        }),
      },
    );
    const testExit = childExitCode(playwright).then((code) => ({ kind: 'exit', code }));
    const result = await Promise.race([testExit, signal]);
    return result.code;
  } finally {
    signalSource.off('SIGINT', onSigint);
    signalSource.off('SIGTERM', onSigterm);
    await stopOwnedChild(playwright);
    await stopOwnedChild(astro);
    if (!reservationReleased) await reservation.release();
  }
}
