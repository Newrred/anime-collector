import { runIsolatedE2E, waitForLoopbackUrl } from './lib/isolatedE2eServer.mjs';
// Dedicated loopback server: no real account keys, production flags or uploads.
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(PUBLIC_|SUPABASE_|MOEMOA_)/u.test(key)) delete env[key];
Object.assign(env, {
 PUBLIC_SUPABASE_URL:'', PUBLIC_SUPABASE_ANON_KEY:'',
 PUBLIC_CATALOG_SUPABASE_URL:'',PUBLIC_CATALOG_SUPABASE_ANON_KEY:'',
 PUBLIC_MEMORY_ACCOUNT_SYNC_V1:'0',PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1:'0',PUBLIC_TITLE_STATE_SYNC_V1:'0',
 PUBLIC_MEMORY_PUBLICATION_V1:'0',PUBLIC_MEMORY_MINIHOME_V1:'0',PUBLIC_MEMORY_FOLLOWS_V1:'0',
 PUBLIC_MEMORY_MODERATION_V1:'0',PUBLIC_MEMORY_CONTENT_REVIEW_V1:'0',PUBLIC_MEMORY_COLLECTION_HOME_V1:'0',
 PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1:'0',PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1:'0',
});
process.exitCode = await runIsolatedE2E({env,dependencies:{waitForUrl:(url,child)=>waitForLoopbackUrl(url,child,{attempts:240})},playwrightArgs:process.argv.slice(2).length ? [...process.argv.slice(2),'--project=chromium','--workers=1','--reporter=line'] : ['tests/collection-home.spec.ts','tests/bookshelf-editor.spec.ts','--project=chromium','--workers=1','--reporter=line']});
