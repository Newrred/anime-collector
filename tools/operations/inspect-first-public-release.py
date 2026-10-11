#!/usr/bin/env python3
"""D06 production read-only configuration inventory; no apply mode or private content."""
import importlib.util,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SQL="""begin read only; set local statement_timeout='15s'; set local lock_timeout='2s';
select jsonb_build_object(
 'checkedAt',now(),
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'publicationSettings',(select to_jsonb(s) from private.memory_publication_settings s where singleton),
 'storagePolicy',(select to_jsonb(s) from private.memory_public_storage_policy s where singleton),
 'resourcePolicies',(select jsonb_agg(to_jsonb(p) order by scope) from private.memory_resource_policies p),
 'activeDeliveryOverrides',(select count(*) from private.memory_resource_overrides where actor='00000000-0000-0000-0000-000000000000' and scope in ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') and expires_at>now()),
 'signupPolicy',(select jsonb_build_object('enabled',enabled,'admissionEnabled',admission_enabled,'policyVersion',policy_version,'termsVersion',terms_version,'privacyVersion',privacy_version) from private.simple_signup_policy where singleton),
 'enabledCountries',(select jsonb_agg(jsonb_build_object('country',country,'minimumAge',minimum_age) order by country) from private.simple_signup_countries where enabled),
 'moderatorCount',(select count(*) from private.memory_moderators where enabled),
 'publicCounts',jsonb_build_object('boards',(select count(*) from private.memory_publications),'homes',(select count(*) from private.memory_minihomes),'assets',(select count(*) from private.memory_public_assets)),
 'functions',jsonb_build_object('sharingStatus',to_regprocedure('public.get_memory_card_sharing(uuid)') is not null,'makePrivate',to_regprocedure('public.make_memory_card_private(uuid)') is not null,'sizedDelivery',to_regprocedure('public.authorize_memory_sized_image_delivery(uuid,text,text,text)') is not null)
); rollback;"""
def inspect():
 spec=importlib.util.spec_from_file_location('connection',ROOT/'tools/operations/inspect-retention.py')
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 result=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=SQL,env=module.connection('production'),capture_output=True,text=True,timeout=25)
 if result.returncode:raise RuntimeError('PREFLIGHT_FAILED')
 rows=[json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]
 if len(rows)!=1:raise RuntimeError('PREFLIGHT_RESULT_INVALID')
 return dict(target='okchpyagfucpzpyrfgol',readOnly=True,snapshot=rows[0])
if __name__=='__main__':
 try: print(json.dumps(inspect()))
 except Exception: print(json.dumps({'readOnly':True,'error':'PREFLIGHT_FAILED_DETAILS_WITHHELD'}));raise SystemExit(1)
