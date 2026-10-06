import { runIsolatedE2E } from './lib/isolatedE2eServer.mjs';

// Own the test server and do not inherit account credentials or rollout flags.
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(PUBLIC_|SUPABASE_|MOEMOA_)/u.test(key)) delete env[key];
}
Object.assign(env, {
  PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '',
  PUBLIC_CATALOG_SUPABASE_URL: '', PUBLIC_CATALOG_SUPABASE_ANON_KEY: '',
  PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1: '1',
  PUBLIC_MEMORY_ACCOUNT_SYNC_V1: '0', PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1: '0',
  PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1: '0', PUBLIC_MEMORY_PUBLICATION_V1: '0',
  PUBLIC_MEMORY_MINIHOME_V1: '0', PUBLIC_MEMORY_FOLLOWS_V1: '0',
  PUBLIC_MEMORY_MODERATION_V1: '0', PUBLIC_MEMORY_CONTENT_REVIEW_V1: '0',
  PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1: '0', PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1: '0',
});
process.exitCode = await runIsolatedE2E({
  env,
  playwrightArgs: [
    'tests/memory-classification.spec.ts', 'tests/channel-service.spec.ts', 'tests/channel-controls.spec.ts',
    'tests/title-hub.spec.ts', 'tests/memory-card-composer.spec.ts', 'tests/memory-account-sync.spec.ts',
    'tests/release-editing.spec.ts', '--project=chromium', '--workers=1', '--reporter=line',
    ...process.argv.slice(2),
  ],
});
