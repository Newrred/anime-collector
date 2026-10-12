// Local synthetic publication boundary; never uses hosted credentials.
// Run serially with builds: Astro dev and build share Vite cache.
import { runIsolatedE2E } from './lib/isolatedE2eServer.mjs';
const env={...process.env}; for(const key of Object.keys(env))if(/^(PUBLIC_|SUPABASE_|MOEMOA_)/u.test(key))delete env[key];
Object.assign(env,{PUBLIC_SUPABASE_URL:'',PUBLIC_SUPABASE_ANON_KEY:'',PUBLIC_CATALOG_SUPABASE_URL:'',PUBLIC_CATALOG_SUPABASE_ANON_KEY:'',PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1:'1',PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1:'1'});
process.exitCode=await runIsolatedE2E({env,playwrightArgs:['tests/publication-ui.spec.ts','--project=chromium','--no-deps','--workers=1','--retries=0','--reporter=line','--grep',process.argv[2] || 'simple card visibility|image preparation requires|existing account signup recovery|explicit selection|publish retry|shared board opens|relationships follow|mini-home explicit']});
