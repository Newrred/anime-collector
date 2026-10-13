#!/usr/bin/env python3
"""Local-only rehearsal of the exact rollback probe; no network credentials."""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
BIN = Path('/usr/lib/postgresql/16/bin')


def main():
    with tempfile.TemporaryDirectory(prefix='moemoa-stale-probe-') as directory:
        work = Path(directory)
        def pg(name, *args):
            return subprocess.run([str(BIN/name), *map(str, args)], capture_output=True,
                                  text=True, timeout=90, check=True)
        pg('initdb', '-D', work/'data', '-A', 'trust', '--no-locale', '-E', 'UTF8')
        pg('pg_ctl', '-D', work/'data', '-l', work/'server.log', '-o',
           f"-k {work} -p 55459 -c listen_addresses=''", 'start')
        try:
            base = ['-h', str(work), '-p', '55459', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
            def sql(value, expected=None):
                r = subprocess.run([str(BIN/'psql'), *base], input=value,
                                   capture_output=True, text=True, timeout=90)
                if expected:
                    assert r.returncode and expected in r.stderr, r.stderr
                else:
                    assert r.returncode == 0, r.stderr
                return r
            pg('psql', *base, '-f', ROOT/'tools/publication-boundary/bootstrap.sql')
            for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
                if migration.name != '20260902055512_memory_user_retention.sql':
                    pg('psql', *base, '-f', migration)
            sql("""update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,
              minihomes_enabled=true,policy_revision='TEST_ONLY_PHONE_WEB_20260927_01',
              content_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01',
              general_publication_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01';
              insert into auth.users(id,email) values('13131313-1313-4131-8131-131313131313','probe@example.invalid');""")
            pg('psql', *base, '-v', 'target_project=nmgkhknponvzcwliajyk', '-v', 'owner_email=probe@example.invalid',
               '-v', 'apply_collection_fixture=true', '-f', HERE/'fixture.sql')
            sql("""insert into private.memory_minihomes(id,user_id) values(
              '4006eb40-ec5a-47fc-8a5b-ec2b78e60daa','13131313-1313-4131-8131-131313131313');""")
            # Snapshot every regular public/private table, not just known writes.
            tables = json.loads(sql("select json_agg(format('%I.%I',schemaname,tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','private');").stdout)
            def snapshot():
                return {t: sql(f"select md5(coalesce(string_agg(row_to_json(r)::text,chr(10) order by row_to_json(r)::text),'')) from {t} r;").stdout.strip() for t in tables}
            probe = (HERE/'stale-preview-probe.sql').read_text()
            before = snapshot()
            result = sql(probe)
            assert 'PASS: stale publish rejected PREVIEW_CHANGED' in result.stderr
            assert snapshot() == before
            print('PASS exact probe rejects stale publication; all table fingerprints unchanged', flush=True)
            # Inner rollback must protect data even if a caller substitutes COMMIT.
            sql(probe.replace('\nROLLBACK;', '\nCOMMIT;'))
            assert snapshot() == before
            print('PASS internal rollback preserves all tables even with outer COMMIT', flush=True)
            sql(probe.replace("release_id='collection-home-test-20261013'", "release_id='wrong-target'"), 'TEST_BASELINE_REQUIRED')
            assert snapshot() == before
            print('PASS wrong catalog target refused with no writes', flush=True)
            sql(probe.replace("IS DISTINCT FROM '[\"ANILIST:9253\"]'", "IS DISTINCT FROM '[\"ANILIST:0\"]'"), 'TEST_SHELF_CHANGED')
            assert snapshot() == before
            print('PASS changed shelf refused with no writes', flush=True)
            # A broken publication guard must fail the probe, never pass it.
            sql("""create or replace function public.publish_memory_minihome(p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid)
              returns jsonb language sql as 'select ''{"published":true}''::jsonb';""")
            sql(probe, 'UNEXPECTED_PUBLICATION_SUCCESS')
            assert snapshot() == before
            print('PASS unexpected publish success aborts and rolls back every table', flush=True)
            print(f'LOCAL_STALE_PROBE: 5 PASS; tables checked={len(tables)}; hosted execution=0', flush=True)
        finally:
            pg('pg_ctl', '-D', work/'data', '-m', 'immediate', 'stop')


if __name__ == '__main__':
    main()
