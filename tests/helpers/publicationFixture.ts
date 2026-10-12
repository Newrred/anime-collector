import {expect,type BrowserContext,type Page} from '@playwright/test';
import {seedSystemDesignCards} from './memoryVisualFixtures';
const USER = "11111111-1111-4111-8111-111111111111";
const PUBLICATION = "22222222-2222-4222-8222-222222222222";
const PUBLIC_CARD = "33333333-3333-4333-8333-333333333333";
const IMAGE = "44444444-4444-4444-8444-444444444444";
const HASH = "a".repeat(64);

export async function adapters(context: BrowserContext, policyRevision = "MOEMOA_PUBLIC_GENERAL_20261011_01") {
  await context.addInitScript((revision) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("en"));
    (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__ = {
      policyRevision: revision,
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
  }, policyRevision);
}

export function mockPublication() {
  let home: any = null, homePreview: any = null, homeRevision = 0, homePublished: any = null;
  const HOME = "55555555-5555-4555-8555-555555555555";
  let state = "PRIVATE", revision = 0, snapshot: any = null, published: any = null;
  const calls: any[] = [];
  const control = { delay: 0, publishError: "", readError: false, image: false, cover: false, sourceChanged: false, revokeError: false, secondBoard: false, visible: true, policyRevision: "MOEMOA_PUBLIC_GENERAL_20261011_01" };
  const attach = async (context: BrowserContext) => {
    await context.route("**/__publication-test/rpc/*", async (route) => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1);
      const args = route.request().postDataJSON(); calls.push({ name, args });
      let data: any = null, error: any = null;
      if (name === "list_memory_safety") data = { items: [], next: null };
      if (name === "list_memory_relationships") data = { items: [], next: null };
      if (name === "get_memory_relationship") data = { self: true, following: false, blocked: false };
      if (name === "get_memory_minihome") data = homeRevision ? { id: HOME, revision: homeRevision, published: Boolean(homePublished), visible: control.visible } : null;
      if (name === "list_memory_minihome_boards") data = { boards: published?.cards.length ? [{ id: PUBLICATION, ...published }, ...(control.secondBoard ? [{ id: IMAGE, ...published, title: "Second public Board" }] : [])] : [], next: null };
      if (name === "prepare_memory_minihome") {
        home = args.p_selection; homeRevision++;
        homePreview = { nickname: home.nickname, bio: home.bio, entries: home.entries.map((e: any) => ({ publicationId: e.publicationId,
          snapshot: { ...published, cards: e.cardId ? published.cards.filter((c: any) => c.id === e.cardId) : published.cards } })) };
        data = { id: HOME, revision: homeRevision, reviewHash: HASH, policyRevision: control.policyRevision, snapshot: homePreview };
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
      if (name === "get_memory_card_sharing") data = {published:Boolean(published),visible:Boolean(published)&&control.visible,restricted:false};
      if (name === "make_memory_card_private") { published=null;state="REVOKED";revision++;data={published:false}; }
      if (name === "get_memory_publication") data = revision ? { id: PUBLICATION, revision, state, hasPublished: Boolean(published), sourceChanged: control.sourceChanged, visible: control.visible } : null;
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
          data = { id: PUBLICATION, revision, reviewHash: HASH, policyRevision: control.policyRevision, snapshot };
          if (control.delay) await new Promise((resolve) => setTimeout(resolve, control.delay));
        }
      }
      if (name === "publish_memory_publication") {
        if (control.publishError) error = { message: control.publishError };
        else { state = "PUBLISHED"; revision++; published = snapshot; data = { id: PUBLICATION, revision, state, visible:control.visible }; }
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

export async function seedOwner(page: Page) {
  // Existing design cards remain readable and publishable; new design-card creation was removed.
  await seedSystemDesignCards(page, [
    { title: 'Shared memory', note: 'Selected reflection' },
    { title: 'Unselected private memory', note: 'PRIVATE ONLY NOTE' },
  ]);
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

export async function choose(page: Page, note = false) {
  await page.getByLabel("Public title", { exact: true }).fill("Public collection");
  const card = page.locator(".memory-publication__selection > li").filter({ hasText: "1. Shared memory" });
  // Position labels distinguish repeated memories; use the actual title instead if local order differs.
  const item = await card.count() ? card : page.locator(".memory-publication__selection > li").filter({ hasText: "Shared memory" });
  await item.getByLabel("Include this memory", { exact: true }).check();
  if (note) {
    const options=item.locator(".publication-card-options > summary");
    if(await options.count() && await item.locator('.publication-card-options').getAttribute('open') === null)await options.click();
    await item.getByLabel("Reflection", { exact: true }).check();
  }
}

export async function publishSelected(page: Page) {
  await page.getByRole("button", { name: "Preview selected memories" }).click();
  await expect(page.getByRole("link", { name: "Public sharing · rights and reporting (new tab)" })).toHaveAttribute("href", "/legal/public-sharing-2026-10-11/#en");
  await page.getByLabel("I have reviewed these memories", { exact: false }).check();
  await page.getByRole("button", { name: "Publish this version" }).click();
  await expect(page.getByRole("link", { name: "Open visitor page" })).toBeVisible();
}
