import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("en"));
  });
});

async function createSystemCard(page, title: string, note: string) {
  await page.goto("/memory/new/");
  await page.getByRole("button", { name: "Use system design" }).click();
  await page.getByLabel("Anime or card title").fill(title);
  await page.getByLabel("Short reflection").fill(note);
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/u);
}

async function createBoard(page, title: string) {
  await page.getByLabel("Board title").fill(title);
  await page.getByLabel("Description (optional)").fill(`Private collection: ${title}`);
  await page.getByRole("button", { name: "Create Board", exact: true }).click();
  await expect(page).toHaveURL(/\/boards\/(?:index\.html)?\?id=/u);
  await expect(page.locator(".memory-boards__title-input")).toHaveValue(title);
}

async function addCard(page, title: string) {
  const candidate = page.locator(".memory-boards__add li").filter({ hasText: title });
  await candidate.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".memory-boards__cards li").filter({ hasText: title })).toBeVisible();
}

test("private Boards keep cards reusable, ordered, and independent from Archive", async ({ page }) => {
  await createSystemCard(page, "Alpha memory", "First scene");
  await createSystemCard(page, "Beta memory", "Second scene");
  await createSystemCard(page, "Gamma memory", "Third scene");

  await expect(page.getByRole("heading", { name: "Turn these memories into a Board" })).toBeVisible();
  await page.getByRole("link", { name: "Create a private Board" }).click();
  await expect(page.getByText("Boards and their membership stay private on this device.")).toBeVisible();

  await createBoard(page, "Remembered scenes");
  await addCard(page, "Alpha memory");
  await addCard(page, "Beta memory");
  await expect(page.locator(".memory-boards__add li").filter({ hasText: "Alpha memory" })).toHaveCount(0);

  const initialOrder = await page.locator(".memory-boards__cards strong").allTextContents();
  expect(initialOrder).toEqual(["Alpha memory", "Beta memory"]);
  await page.getByRole("button", { name: "Move Alpha memory down" }).click();
  await expect.poll(() => page.locator(".memory-boards__cards strong").allTextContents()).toEqual([
    "Beta memory",
    "Alpha memory",
  ]);

  await page.getByRole("link", { name: "Create another Board" }).click();
  await createBoard(page, "Favorites");
  await addCard(page, "Alpha memory");

  await page.getByRole("link", { name: "Remembered scenes" }).click();
  const alphaInFirst = page.locator(".memory-boards__cards li").filter({ hasText: "Alpha memory" });
  await alphaInFirst.getByRole("button", { name: "Remove" }).click();
  await expect(alphaInFirst).toHaveCount(0);
  await expect(page.locator(".memory-boards__cards li").filter({ hasText: "Beta memory" })).toBeVisible();

  await page.getByRole("link", { name: "Favorites" }).click();
  await expect(page.locator(".memory-boards__cards li").filter({ hasText: "Alpha memory" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Board" }).click();
  await expect(page).toHaveURL(/\/boards\/(?:index\.html)?$/u);
  await page.getByRole("link", { name: "Back to Archive" }).click();
  await expect(page.getByRole("heading", { name: "Alpha memory" })).toBeVisible();

  const persisted = await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["memory_boards", "memory_board_cards", "memory_cards"], "readonly");
    const readAll = (name: string) => new Promise<any[]>((resolve, reject) => {
      const read = transaction.objectStore(name).getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const [boards, memberships, cards] = await Promise.all([
      readAll("memory_boards"), readAll("memory_board_cards"), readAll("memory_cards"),
    ]);
    database.close();
    return { boards, memberships, cards };
  });
  expect(persisted.boards.filter((board) => !board.deletedAt)).toHaveLength(1);
  expect(persisted.boards.filter((board) => board.deletedAt)).toHaveLength(1);
  expect(persisted.cards.filter((card) => card.status === "COMPLETE_PRIVATE")).toHaveLength(3);
  expect(persisted.memberships.filter((row) => !row.deletedAt)).toHaveLength(1);
  expect(persisted.memberships.filter((row) => row.deletedAt)).toHaveLength(2);
});

test("Board controls remain readable and keyboard reachable at 320 by 720", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/boards/");
  await expect(page.getByRole("heading", { name: "Memory Boards" })).toBeVisible();
  await expect(page.getByText("Boards and their membership stay private on this device.")).toBeVisible();
  await page.getByLabel("Board title").fill("Keyboard Board");
  await page.getByLabel("Board title").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Description (optional)")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create Board", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("deleting a Card tombstones its Board membership without deleting the Board", async ({ page }) => {
  await createSystemCard(page, "Temporary memory", "A card to remove");
  await page.goto("/boards/");
  await createBoard(page, "Persistent Board");
  await addCard(page, "Temporary memory");
  await page.locator(".memory-boards__cards li").filter({ hasText: "Temporary memory" }).getByRole("link").click();
  await page.getByRole("button", { name: "Delete card" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete memory card" });
  await dialog.getByRole("button", { name: "Confirm card deletion" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/u);

  const state = await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["memory_boards", "memory_board_cards", "memory_cards"], "readonly");
    const readAll = (name: string) => new Promise<any[]>((resolve, reject) => {
      const read = transaction.objectStore(name).getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const [boards, memberships, cards] = await Promise.all([
      readAll("memory_boards"), readAll("memory_board_cards"), readAll("memory_cards"),
    ]);
    database.close();
    return { boards, memberships, cards };
  });
  expect(state.boards).toHaveLength(1);
  expect(state.boards[0].deletedAt).toBeNull();
  expect(state.memberships).toHaveLength(1);
  expect(state.memberships[0].deletedAt).not.toBeNull();
  expect(state.cards[0].status).toBe("DELETED");
});
