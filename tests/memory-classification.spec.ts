import { test, expect, type Page } from "@playwright/test";
import { installAppState } from "./helpers/appState";

const titleId = "anime:11111111-1111-4111-8111-000000000001";
test.beforeEach(async ({ page }) => {
  await installAppState(page, { locale: "ko", mediaById: { "1": { id: 1, title: { english: "Synthetic title" }, genres: [], characters: { edges: [
    { role: "MAIN", node: { id: 10, name: { full: "합성 캐릭터 A" } } }, { role: "MAIN", node: { id: 20, name: { full: "합성 캐릭터 B" } } },
  ] } } } });
  await page.route("https://**/*", route => route.abort());
});
async function seed(page: Page, privateTitle = false) {
  await page.goto("/");
  return page.evaluate(async ({ id, privateTitle }) => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime(), cards = [];
    for (let i = 0; i < 2; i++) cards.push((await runtime.createCard({
      titleChoice: privateTitle ? { kind: "PRIVATE_TITLE", displayTitle: "직접 만든 테스트 작품" } : { kind: "ANIME_REF", animeId: id, displayTitle: "분류 테스트 작품", sourceBinding: { provider: "ANILIST", externalId: "1" }, verificationState: "PROVIDER_CANDIDATE", genres: [], aliases: [] },
      note: `기존 합성 감상 ${i}`, systemDesignSpec: { version: 1, templateId: "memory-gradient", paletteId: "mint-dusk", patternSeed: `tag-${i}`, titleLayout: "BOTTOM_LEFT", genreTokens: [] },
    })).cardId);
    return cards;
  }, { id: titleId, privateTitle });
}
test("card character and custom tags save together, persist and filter two memories of the same title separately", async ({ page }) => {
  const cards = await seed(page);
  await page.goto(`/memory/card/?id=${cards[0]}`);
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.getByRole("button", { name: "캐릭터 선택", exact: true }).click();
  await page.getByRole("button", { name: "합성 캐릭터 A", exact: true }).click();
  await page.getByRole("button", { name: "선택 적용", exact: true }).click();
  await page.getByLabel("커스텀 태그", { exact: true }).fill("비오는날");
  await page.getByLabel("커스텀 태그", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "비오는날 태그 제거" })).toBeVisible();
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "감상 수정 취소", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".memory-detail__classification")).toContainText("합성 캐릭터 A");
  await expect(page.locator(".memory-detail__reflection")).toContainText("기존 합성 감상 0");
  await page.goto("/archive/");
  await page.getByRole("group", { name: "카드 태그", exact: true }).getByRole("button", { name: "#비오는날", exact: true }).click();
  await page.getByRole("group", { name: "기억의 캐릭터", exact: true }).getByRole("button", { name: "합성 캐릭터 A", exact: true }).click();
  await expect(page.locator(".memory-archive__card")).toHaveCount(1);
  await page.getByRole("group", { name: "기억 보기" }).getByRole("button", { name: "표", exact: true }).click();
  await expect(page.locator(".channel-table tbody tr")).toHaveCount(1);
  await page.reload(); await expect(page.locator(".channel-table tbody tr")).toHaveCount(1);
  await page.goto(`/memory/card/?id=${cards[1]}`);
  await expect(page.locator(".memory-detail__classification")).not.toContainText("합성 캐릭터 A");
  await expect(page.locator(".memory-detail__classification")).not.toContainText("비오는날");
});
test("cancel and delete-cancel preserve classification, while management is folded below editing", async ({ page }) => {
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  await expect(page.locator(".memory-detail__tools")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.getByLabel("커스텀 태그").fill("취소 태그"); await page.getByLabel("커스텀 태그").press("Enter");
  await page.getByRole("button", { name: "감상 수정 취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "취소 태그 태그 제거" })).toHaveCount(0);
  await page.getByRole("tab", { name: "관리", exact: true }).click();
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("tab", { name: "기억", exact: true }).click();
  await expect(page.locator(".memory-detail__reflection")).toContainText("기존 합성 감상 0");
  await page.getByRole("tab", { name: "관리", exact: true }).click();
  await page.getByText("공개·비공개 설정", { exact: true }).click();
  await expect(page.getByText("현재 이 환경에서는 공개 게시를 사용할 수 없어요.")).toBeVisible();
});
test("actual Title Hub displays bound characters without needing a saved title", async ({ page }) => {
  await seed(page);
  await page.goto(`/title/?anilistId=1`);
  await expect(page.getByRole("heading", { name: "등장 캐릭터" })).toBeVisible();
  await expect(page.getByText("합성 캐릭터 A", { exact: true })).toBeVisible();
  await expect(page.getByText("AniList · 대표 캐릭터", { exact: true })).toBeVisible();
});

test("save commits an unsubmitted tag and a failed save preserves both tag and reflection drafts", async ({ page }) => {
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.getByLabel("커스텀 태그", { exact: true }).fill("추가 버튼 없이 저장");
  await page.evaluate(async () => {
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const original = IndexedDbMemoryRepository.prototype.updateCardMetadata;
    IndexedDbMemoryRepository.prototype.updateCardMetadata = async function (input) {
      IndexedDbMemoryRepository.prototype.updateCardMetadata = original;
      throw new Error("synthetic write failure");
    };
  });
  await page.getByLabel("짧은 감상").fill("합성 감상 변경");
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByLabel("커스텀 태그", { exact: true })).toHaveValue("추가 버튼 없이 저장");
  await expect(page.getByLabel("짧은 감상")).toHaveValue("합성 감상 변경");
  await expect(page.getByRole("button", { name: "변경 저장", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "감상 수정 취소", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".memory-detail__classification")).toContainText("추가 버튼 없이 저장");
  await expect(page.locator(".memory-detail__reflection")).toContainText("합성 감상 변경");
});

test("actual IndexedDB hydration preserves locally pending tags, accepts synced tags and scrubs deleted tags", async ({ page }) => {
  const [id] = await seed(page);
  const result = await page.evaluate(async id => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const runtime = await getPlatformMemoryRuntime(), repository = await IndexedDbMemoryRepository.open();
    const { card } = await runtime.getCard(id), ownerId = card.ownerId, now = "2026-10-05T01:00:00Z";
    await runtime.updateCard(id, { classification: { version: 1, tags: ["local"], characters: [] } });
    const remote = { id, titleSnapshot: "Synthetic", status: "COMPLETE_PRIVATE", note: card.note, version: 1, createdAt: now, clientUpdatedAt: now, serverUpdatedAt: now };
    const pull = remoteEntity => repository.commitPulledChange({ ownerId, change: { entityType: "MEMORY_CARD", entityId: id, entityVersion: remoteEntity.version }, remoteEntity, nextSyncSeq: null, now });
    await pull(remote);
    const oldServer = (await runtime.getCard(id)).card.classification.tags;
    await pull({ ...remote, version: 2, classification: { version: 1, tags: ["cloud"], characters: [] } });
    const pending = (await runtime.getCard(id)).card.classification.tags;
    await repository.updateCardMetadata({ ownerId, cardId: id, changes: { classificationPending: false }, now, syncOperations: [] });
    await pull({ ...remote, version: 3, classification: { version: 1, tags: ["cloud"], characters: [] } });
    const synced = (await runtime.getCard(id)).card.classification.tags;
    await pull({ ...remote, status: "DELETED", version: 4, deletedAt: now });
    const tx = repository.database.transaction("memory_cards", "readonly");
    const deleted = await new Promise<any>((resolve, reject) => { const request = tx.objectStore("memory_cards").get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    repository.close();
    return { oldServer, pending, synced, deleted: deleted.classification.tags, pendingDeleted: deleted.classificationPending };
  }, id);
  expect(result).toEqual({ oldServer: ["local"], pending: ["local"], synced: ["cloud"], deleted: [], pendingDeleted: false });
});

test("metadata backup restores card tags and bindings atomically, rejecting malformed tags", async ({ page }) => {
  const [id] = await seed(page);
  const result = await page.evaluate(async id => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const { exportMemoryMetadata, restoreMemoryMetadata } = await import("/src/features/memory/adapters/indexeddb/memoryBackupStore.js");
    const { upgradeMemoryDatabase } = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const runtime = await getPlatformMemoryRuntime(), repository = await IndexedDbMemoryRepository.open();
    const { card } = await runtime.getCard(id);
    const classification = { version: 1, tags: ["backup"], characters: [{ source: "ANILIST", id: "10", name: "합성 캐릭터 A" }] };
    await runtime.updateCard(id, { classification });
    const backup = await exportMemoryMetadata(repository.database, card.ownerId, "2026-10-05T01:00:00Z");
    repository.close();
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("classification-restore-test", 2); request.onupgradeneeded = () => upgradeMemoryDatabase(request.result, { transaction: request.transaction }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const ownerId = "guest:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const tx = database.transaction("owners", "readwrite");
    tx.objectStore("owners").add({ id: ownerId, kind: "GUEST", createdAt: "2026-10-05T01:00:00Z" });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    const malformed = structuredClone(backup); malformed.data.memory_cards[0].classification = { version: 1, tags: [null], characters: [] };
    let rejected = "";
    try { await restoreMemoryMetadata(database, ownerId, malformed); } catch (error) { rejected = error.code; }
    const counts = await restoreMemoryMetadata(database, ownerId, backup);
    const restored = await exportMemoryMetadata(database, ownerId, "2026-10-05T02:00:00Z");
    database.close();
    const tagged = restored.data.memory_cards.find(row => row.classification?.tags.includes("backup"));
    return { rejected, counts, classification: tagged.classification, pending: tagged.classificationPending, originalNote: tagged.note, bindingPresent: restored.data.anime_refs.some(row => row.id === tagged.animeRefId), owner: tagged.ownerId, originalImagesIncluded: restored.includesImageFiles };
  }, id);
  expect(result).toEqual({ rejected: "INVALID_MEMORY_BACKUP", counts: { cards: 2, boards: 0 }, classification: { version: 1, tags: ["backup"], characters: [{ source: "ANILIST", id: "10", name: "합성 캐릭터 A" }] }, pending: true, originalNote: "기존 합성 감상 0", bindingPresent: true, owner: "guest:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", originalImagesIncluded: false });
});
for (const width of [1440, 390, 320]) test(`detail classification fits ${width}px without image management dominating`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 });
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  await expect(page.locator(".memory-detail__reflection")).toContainText("기존 합성 감상 0");
  await expect(page.locator(".memory-detail textarea")).toHaveCount(0);
  await page.screenshot({ path: `.cache/v84-service/detail-read-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.getByRole("button", { name: "캐릭터 선택", exact: true }).click();
  await expect(page.getByRole("button", { name: "합성 캐릭터 A", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.cache/v84-service/detail-picker-${width}.png` });
});

test("long character selection stays usable at 320px in dark mode and enforces the existing limit", async ({ page }) => {
  await page.addInitScript(() => {
    const edges = Array.from({ length: 35 }, (_, index) => ({ role: "MAIN", node: { id: index + 100, name: { full: `선택 캐릭터 ${index + 1}` } } }));
    localStorage.setItem("anime:mediaCache:v1", JSON.stringify({ "1": { ts: Date.now(), media: { id: 1, title: { english: "Synthetic title" }, genres: [], characters: { edges } } } }));
  });
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  await page.getByRole("button", { name: "다크 모드로 전환", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.getByRole("button", { name: "캐릭터 선택", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "캐릭터 선택", exact: true });
  for (let index = 1; index <= 12; index++) await dialog.getByRole("button", { name: `선택 캐릭터 ${index}`, exact: true }).click();
  await expect(dialog.getByRole("button", { name: "선택 캐릭터 13", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "선택 캐릭터 1", exact: true })).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await dialog.locator("footer").evaluate(node => node.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/v84-service/detail-picker-long-dark-320.png" });
  await dialog.getByRole("button", { name: "선택 적용", exact: true }).click();
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.locator(".memory-detail__classification .memory-detail__tag")).toHaveCount(12);
  await page.reload();
  await expect(page.locator(".memory-detail__classification .memory-detail__tag")).toHaveCount(12);
});

test("character search stages selection, Escape restores focus, and card cancel preserves saved values", async ({ page }) => {
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  const trigger = page.getByRole("button", { name: "캐릭터 선택", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "캐릭터 선택", exact: true });
  await dialog.getByLabel("불러온 캐릭터 검색").fill("B");
  await expect(dialog.getByRole("button", { name: "합성 캐릭터 A", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "합성 캐릭터 B", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "합성 캐릭터 B 태그 제거" })).toHaveCount(0);
  await trigger.click();
  await expect(dialog.getByLabel("불러온 캐릭터 검색")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "합성 캐릭터 B", exact: true })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "합성 캐릭터 A", exact: true }).click();
  await dialog.getByRole("button", { name: "선택 적용", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "합성 캐릭터 A 태그 제거" })).toBeVisible();
  await page.getByRole("button", { name: "감상 수정 취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "기억 수정", exact: true })).toBeFocused();
  await expect(page.locator(".memory-detail__classification")).not.toContainText("합성 캐릭터 A");
  await page.reload();
  await expect(page.locator(".memory-detail__reflection")).toContainText("기존 합성 감상 0");
});

test("management tabs support keyboard navigation, and editing keeps dirty drafts visible", async ({ page }) => {
  const [id] = await seed(page);
  await page.goto(`/memory/card/?id=${id}`);
  const memory = page.getByRole("tab", { name: "기억", exact: true }), manage = page.getByRole("tab", { name: "관리", exact: true });
  await memory.focus(); await page.keyboard.press("ArrowRight");
  await expect(manage).toBeFocused();
  await expect(manage).toHaveAttribute("aria-selected", "true");
  await page.getByText("공개·비공개 설정", { exact: true }).click();
  await expect(page.getByText("현재 이 환경에서는 공개 게시를 사용할 수 없어요.")).toBeVisible();
  await manage.focus(); await page.keyboard.press("Home");
  await expect(memory).toBeFocused();
  await expect(memory).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "카드 삭제", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await expect(page.getByLabel("짧은 감상")).toBeFocused();
  await page.getByLabel("짧은 감상").fill("취소하면 유지할 초안");
  await expect(manage).toBeDisabled();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator(".memory-detail__header a").click();
  await expect(page).toHaveURL(new RegExp(id));
  await expect(page.getByLabel("짧은 감상")).toHaveValue("취소하면 유지할 초안");
  await page.getByRole("button", { name: "감상 수정 취소", exact: true }).click();
  await page.locator(".memory-detail__header a").click();
  await expect(page).toHaveURL(/\/archive\/$/);
});
