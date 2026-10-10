import {runIsolatedE2E} from './lib/isolatedE2eServer.mjs';

const env = {...process.env};
for (const key of Object.keys(env)) if (/^(PUBLIC_|SUPABASE_|MOEMOA_)/u.test(key)) delete env[key];
Object.assign(env, {
  PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399', PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  PUBLIC_CATALOG_SUPABASE_URL: '', PUBLIC_CATALOG_SUPABASE_ANON_KEY: '',
  PUBLIC_MEMORY_ACCOUNT_SYNC_V1: '1', PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1: '0',
  PUBLIC_SERVICE_ADMIN_V1: '1', PUBLIC_SIGNUP_TEST_DOCUMENTS: '1', PUBLIC_SIMPLE_SIGNUP_V1: '1',
  MOEMOA_ADMIN_E2E: '1',
});
process.exitCode = await runIsolatedE2E({env,
  playwrightArgs: ['tests/admin-ui.spec.ts', '--project=chromium', '--no-deps', '--workers=1', '--reporter=line', ...process.argv.slice(2)],
});
