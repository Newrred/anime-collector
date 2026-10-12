#!/usr/bin/env node
// Offline D06 artifact builder. Reads Git objects and an aggregate preflight only.
// No credentials, network, SQL execution, Git push or deployment capability.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source='7cd3a8234db86ce4f4fba9f0172719b3f1fa3466';
const baseline='199613b139d9fcd085e298a9f03bad94b4e53f5a';
const tested='a6b6ddaaadf9487f5f8f3b14064cb794b27826c0';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const raw=p=>execFileSync('git',['show',source+':'+p],{stdio:['ignore','pipe','pipe']});
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=[
 'supabase/migrations/20261010160000_publication_signup_connection.sql',
 'supabase/migrations/20261011120000_simple_card_sharing.sql',
 'supabase/migrations/20261011180000_memory_sized_image_delivery.sql'];
try {
 if(process.argv.length!==3)throw new Error('EXPECTED_AGGREGATE_PREFLIGHT_PATH');
 const inventory=JSON.parse(readFileSync(process.argv[2],'utf8'));
 if(inventory.target!=='okchpyagfucpzpyrfgol'||inventory.readOnly!==true)throw new Error('WRONG_TARGET');
 const s=inventory.snapshot;
 if(!Array.isArray(s?.migrations)||s.migrations.length!==38||new Set(s.migrations).size!==38)throw new Error('BASELINE_CHANGED');
 const migrations=git('ls-tree','-r','--name-only',source,'supabase/migrations').split(String.fromCharCode(10));
 const missing=migrations.filter(p=>!s.migrations.includes(p.split('/').pop().split('_')[0]));
 if(JSON.stringify(missing)!==JSON.stringify(files))throw new Error('MIGRATION_DELTA_CHANGED');
 if(s.publicationSettings.reads_enabled||s.publicationSettings.writes_enabled||s.activeDeliveryOverrides!==0)throw new Error('PUBLIC_BASELINE_CHANGED');
 for(const scope of ['IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES']){
  const p=s.resourcePolicies.find(p=>p.scope===scope);
  if(!p||p.enabled||p.paused||p.daily_limit!==0)throw new Error('DELIVERY_BASELINE_CHANGED');
 }
 if(git('diff','--name-only',tested+'..'+source,'--','src','api','supabase','scripts','.github','package.json','package-lock.json','vercel.json','astro.config.mjs','.env.production'))throw new Error('UNTESTED_RUNTIME_CHANGE');
 git('merge-base','--is-ancestor',baseline,source);
 const changed=git('diff','--name-only',baseline+'..'+source).split(String.fromCharCode(10));
 const runtime=changed.filter(p=>['src/','api/','supabase/','scripts/','.github/'].some(prefix=>p.startsWith(prefix)));
 const manifest={
  release:'MOEMOA_FIRST_PUBLIC_CANDIDATE_20261011_01',status:'PREPARED_NOT_APPROVED_NOT_APPLIED',
  sourceCommit:source,productionBaseline:baseline,testedCommit:tested,
  testedCi:{run:38129338217,conclusion:'success',runtimeDiffFromTested:[]},
  preflight:inventory,preflightSha256:hash(JSON.stringify(inventory)),
  sourceFiles:runtime.map(file=>({file,sha256:hash(raw(file))})),
  migrations:files.map(file=>({file,version:file.split('/').pop().split('_')[0],sha256:hash(raw(file))})),
  budgetFiles:['tools/operations/public-delivery-budget-candidate.sql','tools/operations/public-delivery-budget-rollback.sql'].map(file=>({file,sha256:hash(raw(file))})),
  proposedConfiguration:{
   releaseId:'MOEMOA_FIRST_PUBLIC_CONFIG_PROD_20261011_01',
   publication:{reads_enabled:true,writes_enabled:true,images_enabled:true,minihomes_enabled:true,follows_enabled:true,reports_enabled:true,signup_declaration_required:true,
    policy_revision:'MOEMOA_PUBLIC_GENERAL_20261011_01',content_policy_revision:'MOEMOA_PUBLIC_GENERAL_20261011_01',general_publication_policy_revision:'MOEMOA_PUBLIC_GENERAL_20261011_01',
    asset_limit:10,asset_bytes_limit:41943040,report_daily_limit:10},
   limitBasis:'Existing tested per-account 10 assets/40MiB and 10 reports/day, proposed for initial launch; global 20MiB storage remains the tighter shared cap. Not production-approved.',
   delivery:{requestsPerUtcDay:2000,reservedBytesPerUtcDay:64000000,alertRatio:0.8},
   preserve:{globalPublicStorageBytes:20971520,signup:s.signupPolicy,countries:s.enabledCountries,moderatorCount:s.moderatorCount,usageCounters:true,originals:true},
   vercelProduction:{PUBLIC_MEMORY_PUBLICATION_V1:'1',PUBLIC_MEMORY_MINIHOME_V1:'1',PUBLIC_MEMORY_FOLLOWS_V1:'1',PUBLIC_MEMORY_MODERATION_V1:'1',PUBLIC_MEMORY_CONTENT_REVIEW_V1:'1',PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1:'1',PUBLIC_MEMORY_PUBLICATION_POLICY_REVISION:'MOEMOA_PUBLIC_GENERAL_20261011_01',MOEMOA_PUBLIC_IMAGE_CLEANUP_ENABLED:'true',MOEMOA_PUBLIC_IMAGE_API_ENABLED:'true',MOEMOA_PUBLIC_IMAGE_PRIVATE_SOURCE_ENABLED:'true',MOEMOA_CONTENT_REVIEW_IMAGE_ENABLED:'true',MOEMOA_PUBLIC_IMAGE_SIZED_DELIVERY_ENABLED:'true',MOEMOA_PUBLIC_IMAGE_ALLOWED_ORIGINS:'https://www.moemoa.xyz,https://moemoa.xyz'},
   githubRepositoryVariables:{MOEMOA_PUBLIC_IMAGE_CLEANUP_ENABLED:'true'},
   configReadback:'Desired values only; latest Vercel/GitHub non-secret baseline still requires readback before activation.',
   keepDisabled:['PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1','MOEMOA_PUBLIC_IMAGE_VIEWER_ENABLED'],
   existingObservation:'Keep current production observation and 980000000-byte storage alert; no new credentials or recipients.'
  },
  rights:'Existing GENERAL-only consent; self-declared own creation; third-party screenshots/fanart still require separate evidence. No new scope decision.',
  executionOrder:[
   'Complete D04 operating notice/rights binding and D05 recovery handoff; obtain exact source/schema/config approval.',
   'Re-read production Git SHA/config/schema. Stop on drift; do not use this snapshot as a future authorization.',
   'Apply the three versioned migrations in listed order under one guarded transaction, preserving data/settings/usage and recording source/hash/release IDs; keep Public reads/writes off.',
   'Save exact Production environment changes after current-value snapshot, then Git master deployment of approved candidate. Verify Vercel Git SHA and build-info.',
   'After deployed sized flag is verified, apply existing budget SQL; independently read back 2000/64000000. Keep Public off on any failure.',
   'Enable existing scheduled public-derivative cleanup using the same maintenance principal (eligible expired/retired derivatives only; no private originals); preserve audit metadata. Requires exact approval and verified job/API config.',
   'After rollout gates pass, apply exact approved publication config; current user explicitly reviews and publishes a synthetic card. Check anonymous deployed image/home, follow/list, report/moderation and withdrawal on this same source.',
   'Observe actual usage and confirm operator alert receipt; distinguish local evaluator from delivered notification. No unsolicited external alert tests.'
  ],
  rollbackOrder:[
   'Immediately disable publication reads/writes in DB to stop public exposure; retain reports/moderator access and private data.',
   'Keep delivery limits until public reads are closed. Revert only exact changed config, never usage counters or rights/consent evidence.',
   'Use versioned budget rollback only if active settings exactly match the candidate; preserve additive functions/migration history.',
   'Restore Production environment baseline and deploy approved prior source through Git master; no CLI production promotion or destructive down migration.'
  ],
  openGates:[
   {id:'D04',condition:'Bind final operating Public policy revision and existing GENERAL rights/notice to the exact candidate; TEST_ONLY revision is not production approval.'},
   {id:'D05',condition:'Recovery key independent custody and remaining recovery/retention acceptance are not confirmed; do not mark completed.'},
   {id:'D03/Q19',condition:'Actual operator alert receipt unverified; existing six-hour observation is not immediate notification.'},
   {id:'W19/D06',condition:'Final deployed sized-image HTTP/withdrawal and exact production release approval remain.'}
  ],
  newUserBehaviorPass:0,remoteMutations:0
 };
 console.log(JSON.stringify(manifest,null,2));
} catch(e){console.error(['WRONG_TARGET','BASELINE_CHANGED','MIGRATION_DELTA_CHANGED','PUBLIC_BASELINE_CHANGED','DELIVERY_BASELINE_CHANGED','UNTESTED_RUNTIME_CHANGE','EXPECTED_AGGREGATE_PREFLIGHT_PATH'].includes(e.message)?e.message:'CANDIDATE_BUILD_FAILED_DETAILS_WITHHELD');process.exitCode=1;}
