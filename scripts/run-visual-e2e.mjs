import { runIsolatedE2E } from './lib/isolatedE2eServer.mjs';

process.exitCode = await runIsolatedE2E({ playwrightArgs: process.argv.slice(2) });
