import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { createHash } from 'node:crypto';

const USER = "11111111-1111-4111-8111-111111111111";
const PUBLICATION = "22222222-2222-4222-8222-222222222222";
const PUBLIC_CARD = "33333333-3333-4333-8333-333333333333";
const IMAGE = "44444444-4444-4444-8444-444444444444";
const HASH = "a".repeat(64);

test("shared board opens the public author home and omits withdrawn author links", async ({ page, context }) => {
  const mock=mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page); await publishSelected(page);
  const home="55555555-5555-4555-8555-555555555555";let visible=true;
  await context.route("**/__publication-test/rpc/read_memory_publication_author",route=>route.fulfill({json:{data:visible?{id:home,nickname:"Public author",email:"never-render@example.test"}:null,error:null}}));
  await context.route("**/__publication-test/rpc/read_memory_minihome",route=>route.fulfill({json:{data:{id:home,nickname:"Public author",bio:"",entries:[]},error:null}}));
  await page.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(page.getByRole("link",{name:"Visit Public author's public home"})).toBeVisible();
  await expect(page.locator("body")).not.toContainText("never-render@example.test");
  await page.getByRole("link",{name:"Visit Public author's public home"}).click();
  await expect(page).toHaveURL(new RegExp(`public/home/\\?id=${home}`));
  await expect(page.getByRole("heading",{name:"Public author",exact:true})).toBeVisible();
  visible=false;await page.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(page.getByRole("link",{name:"Visit Public author's public home"})).toHaveCount(0);
});

test("report retry retains receipt operation and owner can read notice and appeal", async ({ page, context }) => {
  await adapters(context); const backend = mockPublication(); await backend.attach(context); await seedOwner(page);
  const home = "55555555-5555-4555-8555-555555555555", receipt = "66666666-6666-4666-8666-666666666666", notice = "77777777-7777-4777-8777-777777777777";
  let submitted = false, appealed = false, fail = true; const submissions: any[] = [];
  await context.route(/\/(submit_memory_report|list_memory_safety|appeal_memory_notice)$/, async (route) => {
    const name = route.request().url(), args = route.request().postDataJSON(); let data: any = null, error: any = null;
    if (name.endsWith("submit_memory_report")) { submissions.push(args); if (fail) { error = { message: "private server detail" }; fail = false; } else { submitted = true; data = { id: receipt, status: "RECEIVED" }; } }
    if (name.endsWith("list_memory_safety")) data = { items: submitted ? [
      { id: receipt, type: "REPORT", targetKind: "home", targetId: home, status: "CLOSED" },
      { id: notice, type: "NOTICE", targetKind: "home", targetId: home, action: "HIDE", reason: "Public safety review", appealed }
    ] : [], next: null };
    if (name.endsWith("appeal_memory_notice")) { appealed = true; data = { id: notice, appealed: true }; }
    await route.fulfill({ json: { data, error } });
  });
  await page.goto(`/public/home/?id=${home}`);
  await page.getByRole("button", { name: "Report content", exact: true }).click();
  await page.getByRole("button", { name: "Cancel report", exact: true }).click(); expect(submissions).toEqual([]);
  await page.getByRole("button", { name: "Report content", exact: true }).click();
  await page.getByLabel("Report details (optional)").fill("Please review this public target.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Cancel report", exact: true }).click();
  await expect(page.getByLabel("Report details (optional)")).toHaveValue("Please review this public target.");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await expect(page.getByRole("region", { name: "Report public content" }).getByRole("alert")).toContainText("Unable to complete");
  await expect(page.locator("body")).not.toContainText("private server detail");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await expect(page.getByText(`Report received. Receipt: ${receipt}`, { exact: false })).toBeVisible();
  expect(submissions).toHaveLength(2); expect(submissions[0].p_operation).toBe(submissions[1].p_operation);
  await page.getByRole("link", { name: "My safety inbox", exact: true }).click();
  await expect(page.getByText("Public safety review", { exact: true })).toBeVisible();
  await page.getByLabel("Appeal reason", { exact: true }).fill("Please check the decision again.");
  await page.getByRole("button", { name: "Submit appeal", exact: true }).click();
  await expect(page.getByText("Appeal received.", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/w14-inbox-320.png", fullPage: true });
  await page.evaluate(async () => { const { writeMockAuthSession } = await import("/src/repositories/mockAuthStorage.js"); writeMockAuthSession(null); });
  await expect(page.getByText("Public safety review", { exact: true })).toHaveCount(0);
});

test("public link copies only its public ID and offers manual copy on denial", async ({ page, context }) => {
  await adapters(context); const backend = mockPublication(); await backend.attach(context);
  await seedOwner(page); await choose(page); await publishSelected(page);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as any).__copiedLink = text; } } }));
  await page.getByRole("button", { name: "Copy public link", exact: true }).click();
  await expect(page.getByText("Public link copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copiedLink)).toBe(new URL(`/public/board/?id=${PUBLICATION}`, page.url()).href);
  await page.goto(`/public/board/?id=${PUBLICATION}&unrelated=private#private`);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } }));
  await page.getByRole("button", { name: "Copy public link", exact: true }).click();
  await expect(page.getByLabel("Public address", { exact: true })).toHaveValue(new URL(`/public/board/?id=${PUBLICATION}`, page.url()).href);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/w13-share-320.png", fullPage: true });
});

test("cancelled sign-in scrubs provider data and returns to the original public home", async ({ page, context }) => {
  await adapters(context); const backend = mockPublication(); await backend.attach(context);
  await page.goto("/");
  const target = "/public/home/?id=55555555-5555-4555-8555-555555555555";
  await page.evaluate((next) => localStorage.setItem("auth.redirect.next", next), target);
  await page.goto("/auth/callback/?error=access_denied&error_description=private-provider-info");
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
  await expect(page.locator("body")).not.toContainText("private-provider-info");
  await page.getByRole("link", { name: /Return to page/ }).click();
  await expect(page).toHaveURL(new URL(target, page.url()).href);
  expect(backend.calls.filter((c) => c.name === "set_memory_relationship")).toEqual([]);
  await page.goto("/auth/callback/?error=access_denied&next=https%3A%2F%2Fevil.test");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("link", { name: /Return to page/ })).toHaveCount(0);
});

test("expired SDK session rejects refresh and reauth returns home without automatic follow", async ({ page, context }) => {
  const consoleMessages: string[] = [];
  page.on("console", message => consoleMessages.push(message.text()));
  await adapters(context);
  const backend = mockPublication(); await backend.attach(context);
  const home = "55555555-5555-4555-8555-555555555555";
  const target = `/public/home/?id=${home}`;
  const authOrigin = "https://w19-auth.example.test";
  const storageKey = "sb-w19-auth-auth-token";
  const user = { id: USER, aud: "authenticated", role: "authenticated", email: "synthetic@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const jwt = (exp: number) => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: USER, exp, aud: "authenticated", role: "authenticated" })).toString("base64url"), "synthetic-signature"].join(".");
  await context.route("**/src/lib/supabaseClient.js*", async route => {
    const response = await route.fetch(); let body = await response.text();
    expect(body).toContain("const url = env.PUBLIC_SUPABASE_URL;");
    body = body.replace("const url = env.PUBLIC_SUPABASE_URL;", `const url = '${authOrigin}';`)
      .replace("const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;", "const anonKey = 'synthetic-publishable-key';")
      .replace('env.PUBLIC_MEMORY_ACCOUNT_SYNC_V1 === "1"', "true");
    await route.fulfill({ response, body });
  });
  await context.addInitScript(({ storageKey, token, user }) => {
    if (sessionStorage.getItem("w19.seeded")) return;
    sessionStorage.setItem("w19.seeded", "1");
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "synthetic-expired-refresh", expires_at: 1, expires_in: 1, token_type: "bearer", user }));
  }, { storageKey, token: jwt(1), user });
  let refreshes = 0, exchanges = 0;
  await context.route(`${authOrigin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      refreshes++;
      await route.fulfill({ status: 400, json: { code: "refresh_token_not_found", message: "Synthetic session expired" } });
    } else if (url.pathname === "/auth/v1/authorize") {
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      const callback = new URL(url.searchParams.get("redirect_to")!); callback.searchParams.set("code", "synthetic-reauth-code");
      await route.fulfill({ status: 302, headers: { location: callback.href }, body: "" });
    } else if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      exchanges++; expect(route.request().postDataJSON().code_verifier).toBeTruthy();
      await route.fulfill({ json: { access_token: jwt(Math.floor(Date.now() / 1000) + 3600), refresh_token: "synthetic-new-refresh", expires_in: 3600, token_type: "bearer", user } });
    } else { throw new Error(`Unexpected synthetic Auth path: ${url.pathname}`); }
  });
  await context.route("**/__publication-test/rpc/read_memory_minihome", route => route.fulfill({ json: { data: { id: home, nickname: "Synthetic author", bio: "", entries: [] }, error: null } }));
  await context.route("**/__publication-test/rpc/get_memory_relationship", route => route.fulfill({ json: { data: { self: false, following: false, blocked: false }, error: null } }));
  await page.goto(target);
  await expect(page.getByRole("button", { name: "Sign in to follow", exact: true })).toBeVisible();
  expect(refreshes).toBe(1);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  await page.getByRole("button", { name: "Sign in to follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new URL(target, page.url()).href);
  expect(exchanges).toBe(1);
  expect(backend.calls.filter(c => c.name === "set_memory_relationship")).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("auth.redirect.next"))).toBeNull();
  expect(consoleMessages.join("\n")).not.toMatch(/synthetic-expired-refresh|synthetic-new-refresh|synthetic-reauth-code|synthetic-signature/);
  await expect(page.locator("body")).not.toContainText("synthetic-expired-refresh");
});

test("callback exchanges once, returns to home without following, and recovers from exchange failure", async ({ page, context }) => {
  await adapters(context); const backend = mockPublication(); await backend.attach(context);
  await context.route("**/src/lib/supabaseClient.js*", (route) => route.fulfill({ contentType: "text/javascript", body: `
    export const isSupabaseConfigured = true, isMemoryAccountSyncEnabled = true;
    export const supabase = { auth: {
      exchangeCodeForSession: async (code) => {
        sessionStorage.setItem('test.exchanges', String(Number(sessionStorage.getItem('test.exchanges') || 0) + 1));
        return code === 'local-failure' ? { error: new Error('private-exchange-error') } : { data: { session: { user: { id: '${USER}' } } } };
      },
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: async () => ({ error: new Error('private-start-error') })
    } };
  ` }));
  const target = "/public/home/?id=55555555-5555-4555-8555-555555555555";
  await page.goto(`/auth/callback/?code=local-success&next=${encodeURIComponent(target)}`);
  await expect(page).toHaveURL(new URL(target, page.url()).href);
  expect(await page.evaluate(() => sessionStorage.getItem("test.exchanges"))).toBe("1");
  expect(backend.calls.filter((c) => c.name === "set_memory_relationship")).toEqual([]);
  await page.goto(`/auth/callback/?code=local-failure&next=${encodeURIComponent(target)}`);
  await expect(page.getByRole("alert")).toContainText("could not be verified");
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
  await page.getByRole("button", { name: /Retry sign-in/ }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to start sign-in");
  await expect(page.locator("body")).not.toContainText("private-start-error");
  await page.getByRole("link", { name: /Return to page/ }).click();
  await expect(page).toHaveURL(new URL(target, page.url()).href);
});

test("relationships follow, revisit, block and unblock without automatic restore", async ({ page, context }) => {
  await adapters(context);
  const backend = mockPublication(); await backend.attach(context); await seedOwner(page);
  const homeId = "55555555-5555-4555-8555-555555555555";
  let following = false, blocked = false;
  await context.route("**/__publication-test/rpc/*memory_relationship*", async (route) => {
    const args = route.request().postDataJSON(), name = route.request().url();
    if (name.includes("set_memory")) {
      if (args.p_action === "follow") following = true;
      if (args.p_action === "unfollow") following = false;
      if (args.p_action === "block") { blocked = true; following = false; }
      if (args.p_action === "unblock") blocked = false;
    }
    const data = name.includes("list_memory") ? { items: (args.p_blocked ? blocked : following) ? [{ id: homeId, nickname: "A public home", available: true, blocked }] : [], next: null } : { self: false, following, blocked };
    await route.fulfill({ json: { data, error: null } });
  });
  await page.goto(`/public/home/?id=${homeId}`);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My following", exact: true }).click();
  await page.getByRole("link", { name: "A public home" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Unblock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My following", exact: true }).click();
  await expect(page.getByText("Your list is empty.")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/w12-following-320.png", fullPage: true });
  await page.evaluate(async () => { const { writeMockAuthSession } = await import("/src/repositories/mockAuthStorage.js"); writeMockAuthSession(null); });
  await expect(page.getByRole("heading", { name: "My following", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in to follow" })).toBeVisible();
});

test("anonymous home visit does not auto-follow or fetch an owner graph", async ({ page, context }) => {
  await adapters(context); const backend = mockPublication(); await backend.attach(context);
  await page.goto("/public/home/?id=55555555-5555-4555-8555-555555555555");
  await expect(page.getByRole("button", { name: "Sign in to follow" })).toBeVisible();
  expect(backend.calls.filter((c) => c.name.includes("relationship"))).toEqual([]);
});

async function adapters(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("en"));
    (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__ = {
      policyRevision: "local-test-policy",
      resolveCover: async () => "/__publication-test/cover.webp",
      client: { rpc(name: string, args: any) {
        let signal: AbortSignal | undefined;
        const query: any = {
          abortSignal(value: AbortSignal) { signal = value; return query; },
          then(resolve: any, reject: any) {
            return fetch(`/__publication-test/rpc/${name}`, { method: "POST", cache: "no-store", signal,
              headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) }).then((response) => response.json()).then(resolve, reject);
          },
        };
        return query;
      } },
    };
  });
}

function mockPublication() {
  let home: any = null, homePreview: any = null, homeRevision = 0, homePublished: any = null;
  const HOME = "55555555-5555-4555-8555-555555555555";
  let state = "PRIVATE", revision = 0, snapshot: any = null, published: any = null;
  const calls: any[] = [];
  const control = { delay: 0, publishError: "", readError: false, image: false, cover: false, sourceChanged: false, revokeError: false, secondBoard: false };
  const attach = async (context: BrowserContext) => {
    await context.route("**/__publication-test/rpc/*", async (route) => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1);
      const args = route.request().postDataJSON(); calls.push({ name, args });
      let data: any = null, error: any = null;
      if (name === "list_memory_safety") data = { items: [], next: null };
      if (name === "list_memory_relationships") data = { items: [], next: null };
      if (name === "get_memory_relationship") data = { self: true, following: false, blocked: false };
      if (name === "get_memory_minihome") data = homeRevision ? { id: HOME, revision: homeRevision, published: Boolean(homePublished) } : null;
      if (name === "list_memory_minihome_boards") data = { boards: published?.cards.length ? [{ id: PUBLICATION, ...published }, ...(control.secondBoard ? [{ id: IMAGE, ...published, title: "Second public Board" }] : [])] : [], next: null };
      if (name === "prepare_memory_minihome") {
        home = args.p_selection; homeRevision++;
        homePreview = { nickname: home.nickname, bio: home.bio, entries: home.entries.map((e: any) => ({ publicationId: e.publicationId,
          snapshot: { ...published, cards: e.cardId ? published.cards.filter((c: any) => c.id === e.cardId) : published.cards } })) };
        data = { id: HOME, revision: homeRevision, reviewHash: HASH, policyRevision: "local-test-policy", snapshot: homePreview };
        if (control.delay) await new Promise((resolve) => setTimeout(resolve, control.delay));
      }
      if (name === "publish_memory_minihome") {
        if (control.publishError) error = { message: control.publishError };
        else { homePublished = homePreview; homeRevision++; data = { id: HOME, revision: homeRevision, published: true }; }
      }
      if (name === "revoke_memory_minihome") { homePublished = null; homeRevision++; data = { id: HOME, revision: homeRevision, published: false }; }
      if (name === "read_memory_minihome") {
        if (control.readError) error = { message: "network failure" };
        else data = homePublished ? { id: HOME, ...homePublished, entries: published?.cards.length ? homePublished.entries : [] } : null;
      }
      if (name === "get_memory_publication") data = revision ? { id: PUBLICATION, revision, state, hasPublished: Boolean(published), sourceChanged: control.sourceChanged } : null;
      if (name === "prepare_memory_publication") {
        if (args.p_expected_revision !== revision) error = { message: "PUBLICATION_CONFLICT" };
        else {
          revision++; state = "PREPARING";
          snapshot = { schemaVersion: 1, title: args.p_selection.title, description: args.p_selection.description,
            cards: args.p_selection.cards.map((card: any, index: number) => ({ id: index ? IMAGE : PUBLIC_CARD, title: "Shared memory",
              ...(control.cover ? { animeId: `anime:${USER}` } : {}),
              visual: control.image ? { type: "USER_IMAGE", assetId: IMAGE } : control.cover
                ? { type: "CATALOG_COVER", revisionId: `asset:${"a".repeat(40)}` }
                : { type: "SYSTEM_DESIGN", rendererVersion: 1, patternToken: "cc4499ff" },
              ...(card.fields.includes("note") ? { note: "Selected reflection" } : {}),
            })) };
          data = { id: PUBLICATION, revision, reviewHash: HASH, policyRevision: "local-test-policy", snapshot };
          if (control.delay) await new Promise((resolve) => setTimeout(resolve, control.delay));
        }
      }
      if (name === "publish_memory_publication") {
        if (control.publishError) error = { message: control.publishError };
        else { state = "PUBLISHED"; revision++; published = snapshot; data = { id: PUBLICATION, revision, state }; }
      }
      if (name === "read_memory_publication") {
        if (control.readError) error = { message: "private upstream detail" };
        else data = published ? { id: PUBLICATION, ...published } : null;
      }
      if (name === "revoke_memory_publication") { state = "REVOKED"; published = null; revision++; data = { id: PUBLICATION, state, revision }; }
      if (name === "revoke_memory_card_publications" || name === "retire_memory_card_publications") {
        if (control.revokeError) error = { message: "connection failed" };
        else if (published) published = { ...published, cards: [] };
      }
      await route.fulfill({ contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ data, error }) }).catch(() => {});
    });
  };
  return { calls, control, attach };
}

async function seedOwner(page: Page) {
  // Real local UI/IndexedDB; only remote account/sync acknowledgement is synthetic.
  for (const title of ["Shared memory", "Unselected private memory"]) {
    await page.goto("/memory/new/");
    await page.getByRole("button", { name: "Use system design" }).click();
    await page.getByLabel("Anime or card title").fill(title);
    await page.getByLabel("Short reflection").fill(title === "Shared memory" ? "Selected reflection" : "PRIVATE ONLY NOTE");
    await page.getByRole("button", { name: "Save card" }).click();
    await expect(page).toHaveURL(/\/archive\/$/);
  }
  await page.goto("/boards/");
  await page.locator("summary").filter({ hasText: "New Board" }).click();
  await page.getByLabel("Board title").fill("PRIVATE BOARD NAME");
  await page.getByRole("button", { name: "Create Board", exact: true }).click();
  await expect(page).toHaveURL(/\/boards\/\?id=/);
  await page.locator("details").filter({ has: page.locator(".memory-boards__add") }).locator("summary").click();
  for (const title of ["Shared memory", "Unselected private memory"]) {
    await page.locator(".memory-boards__add li").filter({ hasText: title }).getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator(".memory-boards__cards li").filter({ hasText: title })).toBeVisible();
  }
  const boardUrl = page.url();
  await page.evaluate(async (user) => {
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const repository = await IndexedDbMemoryRepository.open();
    const now = new Date().toISOString();
    const owner = await repository.ensureAccountOwner({ userId: user, now });
    const { writeDeviceSyncState } = await import("/src/features/memory/adapters/indexeddb/memorySyncStore.js");
    await writeDeviceSyncState(repository.database, { ownerId: owner.id, userId: user,
      installationId: crypto.randomUUID(), deviceId: crypto.randomUUID(), lastSyncSeq: 1, updatedAt: now });
    const stores = ["private_titles", "memory_cards", "visual_assets", "memory_boards", "memory_board_cards"];
    const tx = repository.database.transaction(stores, "readwrite");
    for (const name of stores) {
      const store = tx.objectStore(name), request = store.getAll();
      request.onsuccess = () => request.result.forEach((row: any) => store.put({ ...row, ownerId: owner.id,
        sync: { ...row.sync, syncState: "SYNCED", remoteVersion: 1 } }));
    }
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    await repository.activateOwner({ ownerId: owner.id, now });
    localStorage.setItem("moemoa.e2e.mockSession.v1", JSON.stringify({ user: { id: user }, access_token: "local-test-token" }));
  }, USER);
  await page.goto(boardUrl);
  await page.getByRole("button", { name: "Share selected memories" }).click();
  await expect(page.getByLabel("Public title", { exact: true })).toHaveValue("");
}

async function choose(page: Page, note = false) {
  await page.getByLabel("Public title", { exact: true }).fill("Public collection");
  const card = page.locator(".memory-publication__selection > li").filter({ hasText: "1. Shared memory" });
  // Position labels distinguish repeated memories; use the actual title instead if local order differs.
  const item = await card.count() ? card : page.locator(".memory-publication__selection > li").filter({ hasText: "Shared memory" });
  await item.getByLabel("Include this memory", { exact: true }).check();
  if (note) await item.getByLabel("Reflection", { exact: true }).check();
}

async function publishSelected(page: Page) {
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("link", { name: "Open visitor page" })).toBeVisible();
}

test("mini-home explicit representative → preview → fresh visitor → private without withdrawing Board", async ({ page, context, browser }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page, true); await publishSelected(page);
  await page.getByRole("link", { name: "My public home" }).click();
  await expect(page.getByLabel("Public nickname", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Display this Board", { exact: true })).not.toBeChecked();
  await page.getByLabel("Public nickname", { exact: true }).fill("My memories <script>");
  await page.getByLabel("Public introduction", { exact: true }).fill("A small collection");
  await page.getByLabel("Display this Board", { exact: true }).check();
  await page.getByLabel("Display selection", { exact: true }).selectOption(PUBLIC_CARD);
  await page.getByRole("button", { name: "Preview public home", exact: true }).click();
  await expect(page.getByRole("region", { name: "Preview public home", exact: true }).getByText("Selected reflection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish public home", exact: true })).toBeDisabled();
  await page.getByLabel("I reviewed this public home", { exact: false }).check();
  await page.getByRole("button", { name: "Publish public home", exact: true }).click();
  const link = page.getByRole("link", { name: "Open public home", exact: true }); await expect(link).toBeVisible();
  await expect(link).not.toHaveAttribute("target", "_blank");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as any).__copiedHome = text; } } }));
  await page.getByRole("button", { name: "Copy public link", exact: true }).click();
  await expect(page.getByText("Public link copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copiedHome)).toBe(new URL((await link.getAttribute("href"))!, page.url()).href);
  const visitor = await browser.newContext({ viewport: { width: 320, height: 720 } }); await adapters(visitor); await mock.attach(visitor);
  try {
    const other = await visitor.newPage(); await other.goto(new URL((await link.getAttribute("href"))!, page.url()).href);
    await expect(other.getByRole("heading", { name: "My memories <script>", exact: true })).toBeVisible();
    await expect(other.getByText("Selected reflection")).toBeVisible();
    expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await other.evaluate(() => localStorage.getItem("moemoa.e2e.mockSession.v1"))).toBeNull();
    await expect(other.locator("body")).not.toContainText("PRIVATE");
    await other.screenshot({ path: ".cache/w11-home-320.png", fullPage: true });
    mock.control.readError = true; await other.reload(); await expect(other.getByRole("alert")).toContainText("Check your connection");
    mock.control.readError = false; await other.getByRole("button", { name: "Try again" }).click(); await expect(other.getByText("Selected reflection")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Make public home private" }).click();
    await expect(page.getByText("Your public home is private.", { exact: false })).toBeVisible();
    await other.reload(); await expect(other.getByText("This public home is unavailable.")).toBeVisible();
    await other.goto(new URL(`/public/board/?id=${PUBLICATION}`, page.url()).href); await expect(other.getByText("Selected reflection")).toBeVisible();
  } finally { await visitor.close(); }
});

test("mini-home cancellation, stale consent, account change and empty state are safe", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page);
  await page.getByRole("link", { name: "My public home" }).click();
  await expect(page.getByText("Publish a Board first", { exact: false })).toBeVisible();
  await page.goto("/boards/");
  // Reuse the existing owner Board through its persisted local ID.
  const boardId = await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime(); await runtime.initialize(); return (await runtime.listBoards())[0].id;
  });
  await page.goto(`/boards/?id=${boardId}`); await page.getByRole("button", { name: "Share selected memories" }).click();
  await choose(page); await publishSelected(page); await page.getByRole("link", { name: "My public home" }).click();
  await page.getByLabel("Public nickname", { exact: true }).fill("Name"); await page.getByLabel("Display this Board", { exact: true }).check();
  mock.control.delay = 600; await page.getByRole("button", { name: "Preview public home", exact: true }).click();
  await expect.poll(() => mock.calls.filter((c) => c.name === "prepare_memory_minihome").length).toBe(1);
  await page.getByRole("button", { name: "Back to selection" }).click(); await page.waitForTimeout(650);
  await expect(page.getByLabel("I reviewed this public home", { exact: false })).toHaveCount(0);
  mock.control.delay = 0; await page.getByRole("button", { name: "Preview public home", exact: true }).click();
  await page.getByLabel("I reviewed this public home", { exact: false }).check(); mock.control.publishError = "PREVIEW_CHANGED";
  await page.getByRole("button", { name: "Publish public home", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("content or policy changed");
  await expect(page.getByLabel("I reviewed this public home", { exact: false })).toHaveCount(0);
  mock.control.publishError = ""; mock.control.delay = 600; await page.getByRole("button", { name: "Preview public home", exact: true }).click();
  await page.evaluate(async () => { const { writeMockAuthSession } = await import("/src/repositories/mockAuthStorage.js"); writeMockAuthSession(null); });
  await expect(page.getByText("Sign in to choose your public home.", { exact: false })).toBeVisible();
  await page.waitForTimeout(650); await expect(page.getByLabel("I reviewed this public home", { exact: false })).toHaveCount(0);
});

test("mini-home selected Board order is explicit and Korean editor fits 320px", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page); await publishSelected(page);
  mock.control.secondBoard = true;
  await page.getByRole("link", { name: "My public home" }).click();
  await page.getByLabel("Public nickname", { exact: true }).fill("Ordered home");
  await page.getByLabel("Display this Board", { exact: true }).nth(0).check();
  await page.getByLabel("Display this Board", { exact: true }).nth(1).check();
  await page.getByRole("button", { name: "Move up", exact: true }).nth(1).click();
  await page.getByRole("button", { name: "Preview public home", exact: true }).click();
  await expect(page.getByLabel("I reviewed this public home", { exact: false })).toBeVisible();
  const selected = mock.calls.filter((c) => c.name === "prepare_memory_minihome").at(-1).args.p_selection.entries;
  expect(selected.map((entry: any) => entry.publicationId)).toEqual([IMAGE, PUBLICATION]);
  await page.getByRole("button", { name: "Back to selection" }).click();
  await context.addInitScript(() => localStorage.setItem("ui:locale:v1", JSON.stringify("ko")));
  await page.setViewportSize({ width: 320, height: 720 }); await page.reload();
  await expect(page.getByRole("heading", { name: "내 공개 미니홈" })).toBeVisible();
  await page.getByLabel("공개 닉네임", { exact: true }).fill("나의 기억");
  await page.getByLabel("이 보드 전시", { exact: true }).nth(0).check();
  await expect(page.getByLabel("전시할 내용", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/w11-editor-320-ko.png", fullPage: true });
});

test("mini-home UI defaults closed and guest cannot open the editor", async ({ page, context }) => {
  await page.goto("/minihome/"); await expect(page.getByText("Public homes are not available yet.")).toBeVisible();
  await page.goto("/public/home/?id=55555555-5555-4555-8555-555555555555");
  await expect(page.getByText("Public homes are not available yet.")).toBeVisible();
  await adapters(context); const mock = mockPublication(); await mock.attach(context);
  await page.goto("/minihome/"); await expect(page.getByText("Sign in to choose your public home.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Public nickname", { exact: true })).toHaveCount(0);
  expect(mock.calls.filter((c) => c.name === "get_memory_minihome")).toHaveLength(0);
});

test("public update needs fresh review, cancelled update keeps previous snapshot, global stop keeps private original", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page, true);
  await publishSelected(page);
  mock.control.sourceChanged = true;
  await page.reload(); await page.getByRole("button", { name: "Share selected memories" }).click();
  await expect(page.getByText("Private sources have changed", { exact: false })).toBeVisible();
  await choose(page, true);
  await page.getByLabel("Public title", { exact: true }).fill("Updated public collection");
  await page.getByRole("button", { name: "Review and update public content" }).click();
  const visitor = await context.newPage();
  await visitor.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(visitor.getByRole("heading", { name: "Public collection", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish this version" })).toBeDisabled();
  await page.screenshot({ path: ".cache/w10-public-update.png", fullPage: true });
  await page.getByRole("button", { name: "Back to selection" }).click();
  expect(mock.calls.filter((call) => call.name === "publish_memory_publication")).toHaveLength(1);
  await page.getByRole("button", { name: "Review and update public content" }).click();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("link", { name: "Open visitor page" })).toBeVisible();
  await visitor.reload(); await expect(visitor.getByRole("heading", { name: "Updated public collection" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".memory-publication__selection > li").filter({ hasText: "Shared memory" })
    .getByRole("button", { name: "Stop sharing this memory everywhere" }).click();
  await expect(page.getByText("Sharing of this memory has stopped everywhere.", { exact: false })).toBeVisible();
  await expect(page.locator(".memory-boards__cards li").filter({ hasText: "Shared memory" })).toBeVisible();
  // Returning to a previously open page must recheck rather than use its old DTO.
  await visitor.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(visitor.getByText("There are no visible memories in this Board.")).toBeVisible();
  await visitor.close();
});

test("failed remote withdrawal preserves a synced original, retry withdraws before deleting", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page, true);
  await publishSelected(page);
  const cardId = mock.calls.find((call) => call.name === "prepare_memory_publication").args.p_selection.cards[0].cardId;
  await page.goto(`/memory/card/?id=${cardId}`);
  await expect(page.getByRole("heading", { name: "Shared memory" })).toBeVisible();
  mock.control.revokeError = true;
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm card deletion", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shared memory" })).toBeVisible();
  await expect.poll(() => mock.calls.filter((call) => call.name === "retire_memory_card_publications").length).toBe(1);
  await expect(page.getByText("Your original was not deleted.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Shared memory" })).toBeVisible();
  mock.control.revokeError = false;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Stop sharing this memory everywhere" }).click();
  await expect(page.getByText("Sharing of this memory has stopped everywhere.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shared memory" })).toBeVisible();
  await page.screenshot({ path: ".cache/w10-card-withdrawal.png", fullPage: true });
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm card deletion", exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  await page.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(page.getByText("There are no visible memories in this Board.")).toBeVisible();
});

test("explicit selection → exact public preview → fresh anonymous context → Board withdrawal", async ({ page, context, browser }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page, true);
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  const preview = page.getByRole("region", { name: "Visitor preview" });
  await expect(preview.getByText("Selected reflection")).toBeVisible();
  await expect(preview).not.toContainText("PRIVATE");
  const selectionCall = mock.calls.find((call) => call.name === "prepare_memory_publication");
  expect(selectionCall.args.p_selection.cards).toHaveLength(1);
  expect(selectionCall.args.p_selection.cards[0].fields).toEqual(["note"]);
  expect(JSON.stringify(selectionCall)).not.toMatch(/PRIVATE|localRef|Selected reflection/);
  await expect(page.getByRole("button", { name: "Publish this version" })).toBeDisabled();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("link", { name: "Open visitor page" })).toBeVisible();
  const visitor = await browser.newContext(); await adapters(visitor); await mock.attach(visitor);
  try {
    const other = await visitor.newPage();
    await other.goto(new URL(`/public/board/?id=${PUBLICATION}`, page.url()).href);
    await expect(other.getByRole("heading", { name: "Public collection" })).toBeVisible();
    await expect(other.getByText("Selected reflection")).toBeVisible();
    await expect(other.locator("body")).not.toContainText("PRIVATE");
    expect(await other.evaluate(() => localStorage.getItem("moemoa.e2e.mockSession.v1"))).toBeNull();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Withdraw this Board" }).click();
    await expect(page.getByText("This Board has been withdrawn.")).toBeVisible();
    await other.reload(); await expect(other.getByText("This Board is unavailable.")).toBeVisible();
  } finally { await visitor.close(); }
});

test("cancelled preparation stays cancelled and recovers server revision on next preview", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page);
  mock.control.delay = 800;
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect.poll(() => mock.calls.filter((call) => call.name === "prepare_memory_publication").length).toBe(1);
  await page.getByRole("button", { name: "Back to selection" }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole("region", { name: "Visitor preview" })).toHaveCount(0);
  expect(mock.calls.filter((call) => call.name === "publish_memory_publication")).toHaveLength(0);
  mock.control.delay = 0;
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect(page.getByRole("region", { name: "Visitor preview" })).toBeVisible();
  expect(mock.calls.filter((call) => call.name === "prepare_memory_publication").at(-1).args.p_expected_revision).toBe(1);
});

test("publish retry preserves operation and stale review requires fresh consent", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page);
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  mock.control.publishError = "temporary network detail";
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("alert")).toContainText("result could not be confirmed");
  mock.control.publishError = "PREVIEW_CHANGED";
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("alert")).toContainText("content or policy changed");
  const calls = mock.calls.filter((call) => call.name === "publish_memory_publication");
  expect(calls[0].args).toEqual(calls[1].args);
  await expect(page.getByRole("region", { name: "Visitor preview" })).toHaveCount(0);
  mock.control.publishError = "";
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect(page.getByLabel("I have reviewed these memories", { exact: false })).not.toBeChecked();
});

test("visitor distinguishes unavailable from network error and UI flag defaults closed", async ({ page, context }) => {
  await page.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(page.getByText("Public Boards are not available yet.")).toBeVisible();
  const mock = mockPublication(); await adapters(context); await mock.attach(context);
  mock.control.readError = true;
  await page.reload(); await expect(page.getByRole("alert")).toContainText("Check your connection");
  mock.control.readError = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("This Board is unavailable.")).toBeVisible();
});

test("320px preview remains readable, omits unselected notes and supports Korean", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  const preview = page.getByRole("region", { name: "Visitor preview" });
  await expect(preview.getByRole("img", { name: "Shared memory" })).toBeVisible();
  await expect(preview).not.toContainText("Selected reflection");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/w09-preview-320.png", fullPage: true });
  await context.addInitScript(() => localStorage.setItem("ui:locale:v1", JSON.stringify("ko")));
  await page.goto(`/public/board/?id=${PUBLICATION}`);
  await expect(page.getByRole("heading", { name: "공개 보드" })).toBeVisible();
});

test("failed preview image blocks posting; retry loads actual cover bytes", async ({ page, context }) => {
  const mock = mockPublication(); mock.control.cover = true;
  await adapters(context); await mock.attach(context);
  await context.route("**/__publication-test/cover.webp", (route) => route.fulfill({ status: 404 }));
  await seedOwner(page); await choose(page); await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect(page.getByRole("region", { name: "Visitor preview" }).getByText("Visual unavailable")).toBeVisible();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await expect(page.getByRole("button", { name: "Publish this version" })).toBeDisabled();
  await context.unroute("**/__publication-test/cover.webp");
  await context.route("**/__publication-test/cover.webp", (route) => route.fulfill({ contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") }));
  await page.getByRole("region", { name: "Visitor preview" }).getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Publish this version" })).toBeEnabled();
});

for (const usePrivate of [false, true]) test(`image preparation requires explicit ${usePrivate ? 'private-copy' : 'original-file'} consent and authenticated derivative preview`, async ({ page, context, browser }) => {
  test.skip(usePrivate && process.env.PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1 !== '1', 'Explicit private-source UI flag required');
  const mock = mockPublication(); mock.control.image = true;
  await adapters(context); await mock.attach(context); await seedOwner(page);
  await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime();
    const boardId = new URLSearchParams(location.search).get("id");
    const detail = await runtime.getBoard(boardId);
    const asset = detail.items.find((item: any) => item.bundle.title.displayTitle === "Shared memory").bundle.asset;
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const repository = await IndexedDbMemoryRepository.open();
    const tx = repository.database.transaction("visual_assets", "readwrite");
    tx.objectStore("visual_assets").put({ ...asset, designSpec: null, imageType: "USER_ORIGINAL", localRef: null, checksumSha256: 'b'.repeat(64) });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
  });
  const png = await sharp({ create: { width: 24, height: 30, channels: 3, background: "#cc7799" } }).png().toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  const uploads: any[] = [], reads: any[] = [];
  const privateHash = createHash('sha256').update(webp).digest('hex');
  await context.route('**/api/private-image**', async route => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe('Bearer local-test-token');
    if (route.request().url().includes('policy=1')) return route.fulfill({ json: { revision: 'PRIVATE_TEST', quotaBytes: 50_000_000, usedBytes: webp.length * 2, mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000,
      representation: { id: IMAGE, state: 'READY', sourceVersion: 1, mainHash: privateHash, mainBytes: webp.length, thumbnailHash: privateHash, thumbnailBytes: webp.length } } });
    return route.fulfill({ contentType: 'image/webp', body: webp });
  });
  await context.route("**/api/public-image?*", async (route) => {
    reads.push(route.request().headers());
    expect(route.request().headers().authorization).toBe("Bearer local-test-token");
    await route.fulfill({ contentType: "image/webp", body: webp, headers: { "Cache-Control": "no-store" } });
  });
  await context.route("**/api/public-image", async (route) => {
    uploads.push(route.request());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: IMAGE, state: "READY" }) });
  });
  await page.reload(); await page.getByRole("button", { name: "Share selected memories" }).click(); await choose(page);
  if (usePrivate) {
    await page.getByRole('button', { name: 'Choose my synced image copy', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Selected private image copy', exact: true })).toBeVisible();
  } else await page.getByLabel("Select the original image file").setInputFiles({ name: "original.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Prepare selected image" })).toBeDisabled();
  expect(uploads).toHaveLength(0);
  await page.getByLabel(usePrivate ? 'I agree to use this selected image' : "I agree to upload this selected image", { exact: false }).check();
  await page.getByRole("button", { name: "Prepare selected image" }).click();
  await expect(page.getByText("The selected image copy is ready.", { exact: false })).toBeVisible();
  expect(uploads).toHaveLength(1); expect(uploads[0].postDataBuffer()).toEqual(usePrivate ? null : png);
  if (usePrivate) {
    expect(uploads[0].headers()['x-moemoa-private-representation']).toBe(IMAGE);
    expect(uploads[0].headers()['x-moemoa-representation-hash']).toBe(privateHash);
  }
  expect(uploads[0].headers()["x-moemoa-consent"]).toBe("local-test-policy");
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await expect(page.getByRole("button", { name: "Publish this version" })).toBeEnabled();
  expect(reads).toHaveLength(1);
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("link", { name: "Open visitor page" })).toBeVisible();
  const visitor = await browser.newContext(); await adapters(visitor); await mock.attach(visitor);
  try {
    await visitor.route("**/api/public-image?*", async (route) => {
      expect(route.request().headers().authorization).toBeUndefined();
      expect(new URL(route.request().url()).searchParams.get("publication")).toBe(PUBLICATION);
      await route.fulfill({ contentType: "image/webp", body: webp, headers: { "Cache-Control": "no-store" } });
    });
    const other = await visitor.newPage(); await other.goto(new URL(`/public/board/?id=${PUBLICATION}`, page.url()).href);
    await expect.poll(() => other.getByRole("img", { name: "Shared memory" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(24);
  } finally { await visitor.close(); }
});

test("account switch removes an in-flight owner preview and never sends publish", async ({ page, context }) => {
  const mock = mockPublication(); await adapters(context); await mock.attach(context); await seedOwner(page); await choose(page);
  mock.control.delay = 800;
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect.poll(() => mock.calls.filter((call) => call.name === "prepare_memory_publication").length).toBe(1);
  await page.evaluate(async () => {
    const { writeMockAuthSession } = await import("/src/repositories/mockAuthStorage.js");
    writeMockAuthSession({ user: { id: "99999999-9999-4999-8999-999999999999" }, access_token: "other-test-token" });
  });
  await expect(page.getByText("Sign in and sync this Board before sharing it.", { exact: false })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole("region", { name: "Visitor preview" })).toHaveCount(0);
  expect(mock.calls.filter((call) => call.name === "publish_memory_publication")).toHaveLength(0);
});
