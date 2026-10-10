import { runIsolatedE2E } from './lib/isolatedE2eServer.mjs';

const args = process.argv.slice(2);
const visual = args.includes('--visual');
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(PUBLIC_|SUPABASE_|MOEMOA_)/u.test(key)) delete env[key];
}
Object.assign(env, {
  PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '',
  PUBLIC_CATALOG_SUPABASE_URL: '', PUBLIC_CATALOG_SUPABASE_ANON_KEY: '',
  PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1: '1', PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1: '1',
  PUBLIC_MEMORY_ACCOUNT_SYNC_V1: '0', PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1: '0',
  PUBLIC_MEMORY_PUBLICATION_V1: '0', PUBLIC_MEMORY_MINIHOME_V1: '0',
  PUBLIC_MEMORY_FOLLOWS_V1: '0', PUBLIC_MEMORY_MODERATION_V1: '0',
  PUBLIC_MEMORY_CONTENT_REVIEW_V1: '0', PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1: '0',
  PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1: '0',
  ...(visual ? { MOEMOA_VISUAL_TEST: '1' } : {}),
});
process.exitCode = await runIsolatedE2E({
  env,
  playwrightArgs: [
    'tests/account-menu.spec.ts', 'tests/desktop-image-input.spec.ts',
    'tests/desktop-image-lifecycle.spec.ts', 'tests/web-image-intake.spec.ts',
    'tests/memory-card-composer.spec.ts', 'tests/memory-card-discovery.spec.ts',
    'tests/memory-owner-boundary.spec.ts',
    ...(visual ? ['tests/visual/account-image-input.spec.ts'] : []),
    '--project=chromium', '--workers=1', '--reporter=line',
    ...args.filter(arg => arg !== '--visual'),
  ],
});
