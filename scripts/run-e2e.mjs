import { spawn } from "node:child_process";

import { sanitizedChildEnvironment, waitForLoopbackUrl } from "./lib/isolatedE2eServer.mjs";

const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4321";
const parsedBaseUrl = new URL(configuredBaseUrl);
if (parsedBaseUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(parsedBaseUrl.hostname)
  || parsedBaseUrl.username || parsedBaseUrl.password
  || (parsedBaseUrl.pathname !== "/" && parsedBaseUrl.pathname !== "")) {
  throw new Error("PLAYWRIGHT_BASE_URL must be an uncredentialed loopback HTTP origin");
}
const host = parsedBaseUrl.hostname;
const port = Number(parsedBaseUrl.port || 80);
const baseUrl = `${parsedBaseUrl.origin}/`;
const args = process.argv.slice(2);
const liveOnly = args[0] === "--live";
if (liveOnly) args.shift();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function serverIsReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000), redirect: 'error' });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(server) {
  await waitForLoopbackUrl(baseUrl, server, { attempts: 120, intervalMs: 250, requestTimeoutMs: 1000 });
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    sleep(5000),
  ]);
}

const existingServer = await serverIsReady();
const server = existingServer
  ? null
  : spawn(process.execPath, ["node_modules/astro/astro.js", "dev", "--host", host, "--port", String(port)], {
      stdio: "inherit",
      env: sanitizedChildEnvironment(process.env, {
        CI: process.env.CI ?? "1",
        ASTRO_TELEMETRY_DISABLED: process.env.ASTRO_TELEMETRY_DISABLED ?? "1",
      }),
    });

try {
  if (server) await waitForServer(server);

  const playwright = spawn(
    process.execPath,
    ["node_modules/playwright/cli.js", "test", ...args],
    {
      stdio: "inherit",
      env: sanitizedChildEnvironment(process.env, {
        PLAYWRIGHT_EXTERNAL_SERVER: "1",
        PLAYWRIGHT_BASE_URL: parsedBaseUrl.origin,
        ...(liveOnly ? { MOEMOA_E2E_LIVE: "1" } : {}),
      }),
    },
  );
  const exitCode = await new Promise((resolve) => playwright.once("exit", (code) => resolve(code ?? 1)));
  process.exitCode = exitCode;
} finally {
  await stopServer(server);
}
