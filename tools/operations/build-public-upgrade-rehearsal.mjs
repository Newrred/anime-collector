// Generates a LOCAL REHEARSAL candidate only. No connection, application or ledger writes.
// Production needs an exact approved ledger, backup and recorded release ID first.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const versions = ['20260923090000','20260923093000','20260923182210','20260923183940',
  '20260923192300','20260923213901','20260924115258','20260924121214','20260924193626',
  '20260924194059','20260924195510','20260925164126','20260926140122','20260927042334','20260927044435'];
const files = await readdir(path.join(root, 'supabase/migrations'));
const hash = text => createHash('sha256').update(text).digest('hex');
const manifest = [];
let sql = `-- LOCAL REHEARSAL ONLY. No production migration ledger is written.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if current_setting('moemoa.local_rehearsal',true) is distinct from 'yes' or inet_server_addr() is not null then
  raise exception 'LOCAL_SOCKET_REHEARSAL_REQUIRED';
 end if;
 if to_regclass('private.memory_publications') is not null
 or to_regprocedure('public.retire_memory_card_publications(uuid)') is null then
  raise exception 'EXPECTED_PRIVATE_ONLY_BASELINE';
 end if;
end $$;
`;
for (const version of versions) {
  const matches = files.filter(file => file.startsWith(`${version}_`));
  if (matches.length !== 1) throw Error('MIGRATION_SOURCE_MISMATCH');
  const file = matches[0];
  const original = await readFile(path.join(root, 'supabase/migrations', file), 'utf8');
  let applied = original;
  const adaptations = [];
  if (version === '20260923182210') {
    for (const [before, after] of [
      ['create table private.memory_publication_delete_fences (', 'create table if not exists private.memory_publication_delete_fences ('],
      ['create function public.retire_memory_card_publications(', 'create or replace function public.retire_memory_card_publications('],
    ]) {
      if (applied.split(before).length !== 2) throw Error('ADAPTATION_ANCHOR_MISMATCH');
      applied = applied.replace(before, after);
      adaptations.push({before, after});
    }
  }
  manifest.push({ file, sourceSha256: hash(original), appliedSha256: hash(applied), adaptations });
  sql += `\n-- ${file}\n${applied}\n`;
}
sql += '\ncommit;\n';
const out = path.join(root, '.cache/public-upgrade-rehearsal');
await mkdir(out, {recursive:true});
await writeFile(path.join(out, 'candidate.sql'), sql);
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({scope:'LOCAL_ONLY', migrations:manifest, bundleSha256:hash(sql)}, null, 2)+'\n');
console.log(JSON.stringify({scope:'LOCAL_ONLY', migrationCount:manifest.length, bundleSha256:hash(sql)}));
