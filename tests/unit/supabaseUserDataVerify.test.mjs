import assert from "node:assert/strict";
import test from "node:test";

import {
  createReadOnlyQuery,
  parseVerifyArguments,
  verifySupabaseUserData,
} from "../../tools/supabase-user-data/verify.mjs";

const PROJECT_REF = "okchpyagfucpzpyrfgol";

test("Supabase user-data verification accepts only the approved project and modes", () => {
  assert.deepEqual(
    parseVerifyArguments([
      "--project-ref", PROJECT_REF,
      "--expected-catalog-count", "3998",
      "--mode", "before",
    ]),
    { projectRef: PROJECT_REF, expectedCatalogCount: 3998, mode: "before" },
  );
  assert.throws(
    () => parseVerifyArguments([
      "--project-ref", "wrong-project",
      "--expected-catalog-count", "3998",
      "--mode", "before",
    ]),
    (error) => error.code === "PROJECT_REF_REJECTED",
  );
  assert.throws(
    () => parseVerifyArguments([
      "--project-ref", PROJECT_REF,
      "--expected-catalog-count", "3998",
      "--mode", "preview",
    ]),
    (error) => error.code === "VERIFY_MODE_INVALID",
  );
});

test("Supabase user-data verification requires an access token", async () => {
  await assert.rejects(
    createReadOnlyQuery({ projectRef: PROJECT_REF, accessToken: "" }),
    (error) => error.code === "SUPABASE_ACCESS_TOKEN_MISSING",
  );
});

test("Supabase user-data verification calls only the read-only management endpoint", async () => {
  const calls = [];
  const query = await createReadOnlyQuery({
    projectRef: PROJECT_REF,
    accessToken: "test-access-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => [{ count: 1 }] };
    },
  });

  assert.deepEqual(await query("select 1 as count"), [{ count: 1 }]);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query/read-only`,
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-access-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    query: "select 1 as count",
    parameters: [],
  });
});

const catalogRow = {
  release_id: "catalog-v2-52487fc3ef22eb9df3ca0a78",
  release_hash: "52487fc3ef22eb9df3ca0a78d6e3b0b43cfdebaf7395f78f9110af4f3be4f556",
  target_count: 3998,
  people_page_count: 4899,
  search_count: 3998,
  detail_count: 3998,
  asset_count: 3998,
  people_count: 4899,
  cover_object_count: 3998,
};

const beforeFetch = (firstRow = catalogRow) => {
  const responses = [
    [firstRow],
    [],
    [{ exists: false }],
    [{ count: 0 }],
  ];
  return async () => ({
    ok: true,
    json: async () => responses.shift(),
  });
};

test("before verification preserves the exact recorded catalog release", async () => {
  const result = await verifySupabaseUserData({
    config: { projectRef: PROJECT_REF, expectedCatalogCount: 3998, mode: "before" },
    accessToken: "test-access-token",
    fetchImpl: beforeFetch(),
  });
  assert.equal(result.catalog.releaseHash, catalogRow.release_hash);
  assert.equal(result.userTables.present, 0);
  assert.equal(result.legacyUserSnapshotsPresent, false);
});

test("before verification rejects catalog release hash drift", async () => {
  await assert.rejects(
    verifySupabaseUserData({
      config: { projectRef: PROJECT_REF, expectedCatalogCount: 3998, mode: "before" },
      accessToken: "test-access-token",
      fetchImpl: beforeFetch({ ...catalogRow, release_hash: "0".repeat(64) }),
    }),
    (error) => error.code === "CATALOG_RELEASE_INVALID",
  );
});
