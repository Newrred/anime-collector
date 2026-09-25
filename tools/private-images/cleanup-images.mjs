import { cleanupPrivateImages } from '../../src/server/privateImages/handler.js';
import { createPrivateImageBackend } from '../../src/server/privateImages/supabaseBackend.js';

// Operator explicitly names the approved environment; never schedule or run on import.
const project = process.argv.find(value => value.startsWith('--project='))?.slice(10);
if (!process.argv.includes('--apply') || !/^[a-z]{20}$/.test(project || '') ||
  process.env.SUPABASE_URL !== `https://${project}.supabase.co`) {
  throw new Error('Explicit --apply and matching --project are required for an approved environment.');
}
const result = await cleanupPrivateImages(createPrivateImageBackend());
console.log(JSON.stringify(result));
if (result.failed) process.exitCode = 1;
