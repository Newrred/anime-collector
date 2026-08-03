import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = 4321;
const baseUrl = `http://${host}:${port}/`;
const args = process.argv.slice(2);
const liveOnly = args[0] === "--live";
if (liveOnly) args.shift();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function serverIsReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await serverIsReady()) return;
    if (server.exitCode !== null) {
      throw new Error(`Astro test server exited early with code ${server.exitCode}.`);
    }
    await sleep(250);
  }
  throw new Error(`Astro test server did not become ready at ${baseUrl}.`);
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
    });

try {
  if (server) await waitForServer(server);

  const playwright = spawn(
    process.execPath,
    ["node_modules/playwright/cli.js", "test", ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_EXTERNAL_SERVER: "1",
        ...(liveOnly ? { MOEMOA_E2E_LIVE: "1" } : {}),
      },
    },
  );
  const exitCode = await new Promise((resolve) => playwright.once("exit", (code) => resolve(code ?? 1)));
  process.exitCode = exitCode;
} finally {
  await stopServer(server);
}
