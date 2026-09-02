import { fileURLToPath } from "node:url";

const APPROVED_PROJECT_REF = "okchpyagfucpzpyrfgol";
const EXPECTED_CATALOG_RELEASE_HASH = "52487fc3ef22eb9df3ca0a78d6e3b0b43cfdebaf7395f78f9110af4f3be4f556";
const USER_TABLES = Object.freeze([
  "user_profiles", "user_devices", "user_account_promotions", "user_preferences",
  "memory_private_titles", "memory_cards", "memory_visual_assets", "memory_boards",
  "memory_board_cards", "sync_operations", "sync_changes",
]);
const RPC_SIGNATURES = Object.freeze([
  "ensure_user_profile(text,text,text)",
  "register_user_device(uuid,uuid,text,text)",
  "promote_guest_memory(uuid,uuid,text,text,jsonb)",
  "apply_memory_card_mutation(uuid,uuid,text,uuid,text,bigint,text,jsonb)",
  "apply_board_mutation(uuid,uuid,text,uuid,text,bigint,text,jsonb)",
  "pull_memory_changes(bigint,integer)",
  "resolve_memory_conflict(uuid,uuid,text,uuid,bigint,text,jsonb)",
]);

const fail = (code) => { throw Object.assign(new Error("Supabase verification failed"), { code }); };
const identifier = (value) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) fail("VERIFY_IDENTIFIER_INVALID");
  return `public.${value}`;
};

export function parseVerifyArguments(args) {
  const allowed = new Set(["--project-ref", "--expected-catalog-count", "--mode"]);
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!allowed.has(key) || index + 1 >= args.length) fail("VERIFY_ARGUMENT_INVALID");
    values[key] = args[index += 1];
  }
  const projectRef = String(values["--project-ref"] || "");
  const expectedCatalogCount = Number(values["--expected-catalog-count"]);
  const mode = String(values["--mode"] || "");
  if (projectRef !== APPROVED_PROJECT_REF) fail("PROJECT_REF_REJECTED");
  if (!Number.isSafeInteger(expectedCatalogCount) || expectedCatalogCount < 1) fail("CATALOG_COUNT_INVALID");
  if (!new Set(["before", "after"]).has(mode)) fail("VERIFY_MODE_INVALID");
  return Object.freeze({ projectRef, expectedCatalogCount, mode });
}

const rowsFrom = (body) => {
  const rows = Array.isArray(body) ? body : Array.isArray(body?.result) ? body.result : Array.isArray(body?.data) ? body.data : null;
  if (!rows) fail("VERIFY_RESPONSE_INVALID");
  return rows;
};

export async function createReadOnlyQuery({ projectRef, accessToken, fetchImpl = fetch }) {
  if (projectRef !== APPROVED_PROJECT_REF) fail("PROJECT_REF_REJECTED");
  if (!String(accessToken || "").trim()) fail("SUPABASE_ACCESS_TOKEN_MISSING");
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`;
  return async (query, parameters = []) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, parameters }),
    });
    if (!response.ok) fail(`VERIFY_HTTP_${response.status}`);
    return rowsFrom(await response.json());
  };
}

export async function verifySupabaseUserData({ config, accessToken, fetchImpl = fetch }) {
  const query = await createReadOnlyQuery({ projectRef: config.projectRef, accessToken, fetchImpl });
  const [catalog] = await query(`
    select r.id as release_id, r.release_hash, r.target_count, r.people_page_count,
      (select count(*)::int from public.catalog_anime_search s where s.release_id = r.id) as search_count,
      (select count(*)::int from public.catalog_anime_details d where d.release_id = r.id) as detail_count,
      (select count(*)::int from public.catalog_assets a where a.release_id = r.id) as asset_count,
      (select count(*)::int from public.catalog_anime_people p where p.release_id = r.id) as people_count,
      (select count(*)::int from public.catalog_assets a join storage.objects o on o.bucket_id = a.bucket_id and o.name = a.object_path where a.release_id = r.id) as cover_object_count
    from public.catalog_active_release active
    join public.catalog_releases r on r.id = active.release_id
    where active.singleton
  `);
  if (!catalog || catalog.release_hash !== EXPECTED_CATALOG_RELEASE_HASH) fail("CATALOG_RELEASE_INVALID");
  for (const field of ["target_count", "search_count", "detail_count", "asset_count", "cover_object_count"]) {
    if (Number(catalog[field]) !== config.expectedCatalogCount) fail("CATALOG_COUNT_REGRESSION");
  }
  if (Number(catalog.people_count) !== Number(catalog.people_page_count)) fail("CATALOG_PEOPLE_REGRESSION");

  const relationRows = await query(`
    select name, to_regclass('public.' || name) is not null as exists
    from unnest($1::text[]) as name
    order by name
  `, [USER_TABLES]);
  const exists = new Map(relationRows.map((row) => [row.name, Boolean(row.exists)]));
  const legacyRows = await query("select to_regclass('public.user_snapshots') is not null as exists");
  if (legacyRows[0]?.exists) fail("LEGACY_TABLE_PRESENT");
  const present = USER_TABLES.filter((table) => exists.get(table));
  if (config.mode === "before" && present.length) fail("NEW_TABLE_PRESENT_BEFORE");
  if (config.mode === "after" && present.length !== USER_TABLES.length) fail("NEW_TABLE_MISSING_AFTER");

  const tableCounts = {};
  for (const table of present) {
    const rows = await query(`select count(*)::int as count from ${identifier(table)}`);
    tableCounts[table] = Number(rows[0]?.count || 0);
  }
  if (config.mode === "after" && Object.values(tableCounts).some((count) => count !== 0)) {
    fail("NEW_TABLES_NOT_EMPTY_AFTER");
  }

  let security = { rlsAll: null, authenticatedDirectDmlDenied: null, rpcGrantsExact: null, retentionJobActive: null };
  if (config.mode === "after") {
    const [checks] = await query(`
      with expected_tables(name) as (select unnest($1::text[])),
      expected_rpcs(signature) as (select unnest($2::text[]))
      select
        bool_and(c.relrowsecurity) as rls_all,
        bool_and(not has_table_privilege('authenticated', format('public.%I', t.name), 'INSERT,UPDATE,DELETE')) as authenticated_direct_dml_denied,
        (select bool_and(
          has_function_privilege('authenticated', 'public.' || signature, 'EXECUTE')
          and not has_function_privilege('anon', 'public.' || signature, 'EXECUTE')
        ) from expected_rpcs) as rpc_grants_exact,
        coalesce((select count(*) = 1 and bool_and(active) from cron.job where jobname = 'moemoa-memory-retention-daily'), false) as retention_job_active
      from expected_tables t
      join pg_catalog.pg_class c on c.oid = to_regclass('public.' || t.name)
    `, [USER_TABLES, RPC_SIGNATURES]);
    security = {
      rlsAll: Boolean(checks?.rls_all),
      authenticatedDirectDmlDenied: Boolean(checks?.authenticated_direct_dml_denied),
      rpcGrantsExact: Boolean(checks?.rpc_grants_exact),
      retentionJobActive: Boolean(checks?.retention_job_active),
    };
    if (Object.values(security).some((value) => value !== true)) fail("SECURITY_CONTRACT_REGRESSION");
  }

  return Object.freeze({
    projectRef: config.projectRef,
    mode: config.mode,
    authUserCount: Number((await query("select count(*)::int as count from auth.users"))[0]?.count || 0),
    catalog: {
      releaseId: catalog.release_id,
      releaseHash: catalog.release_hash,
      targetCount: Number(catalog.target_count),
      searchCount: Number(catalog.search_count),
      detailCount: Number(catalog.detail_count),
      assetCount: Number(catalog.asset_count),
      peopleCount: Number(catalog.people_count),
      coverObjectCount: Number(catalog.cover_object_count),
    },
    userTables: { present: present.length, expected: USER_TABLES.length, counts: tableCounts },
    legacyUserSnapshotsPresent: false,
    security,
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === String(process.argv[1]).toLowerCase();

if (isMain) {
  try {
    const config = parseVerifyArguments(process.argv.slice(2));
    const result = await verifySupabaseUserData({ config, accessToken: process.env.SUPABASE_ACCESS_TOKEN });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Supabase user-data verification failed: ${error?.code || "VERIFY_FAILED"}\n`);
    process.exitCode = 1;
  }
}
