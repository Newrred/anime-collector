import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

test.beforeEach(async ({ page }) => {
  await installAppState(page, { locale: "en" });
  await page.route("https://**/*", route => route.abort());
});

test("Archive sort commits with keyboard, cancels without changing and retains its URL", async ({ page }) => {
  await page.goto("/archive/");
  const sort = page.getByRole("combobox", { name: "Sort", exact: true });
  await sort.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(sort).toHaveAttribute("data-value", "updated");
  await expect(page).toHaveURL(/sort=updated/);
  await sort.click(); await page.keyboard.press("Home"); await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAttribute("data-value", "updated");
  await sort.click(); await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.reload(); await expect(sort).toHaveAttribute("data-value", "updated");
});

test("Title sort changes order and keeps it when a second selection is cancelled", async ({ page }) => {
  await page.goto("/titles/");
  const sort = page.getByRole("combobox", { name: "Title sort", exact: true });
  await sort.click();
  await page.getByRole("option", { name: "Title", exact: true }).click();
  await expect(sort).toHaveAttribute("data-value", "TITLE");
  await sort.click(); await page.keyboard.press("End"); await page.keyboard.press("Escape");
  await expect(sort).toHaveAttribute("data-value", "TITLE");
});

for (const width of [1440, 390, 320]) test(`search status menu stays inside the search flow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.goto("/");
  const open = async () => {
    if (width < 700) await page.locator(".quick-action__mobile-trigger").click();
    else await page.locator(".quick-action__input:visible").focus();
  };
  await open();
  const status = page.getByRole("combobox", { name: "Default add status" });
  await status.click();
  const option = page.getByRole("option", { name: "Watching", exact: true });
  await expect(option).toBeVisible();
  // Hit testing proves the portalled list is above the mobile dialog.
  expect(await option.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await option.click();
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("data-value", "보는중");
  await status.click(); await page.keyboard.press("Home"); await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(status).toBeFocused(); await expect(status).toHaveAttribute("data-value", "보는중");
  if (width < 700) {
    await expect(page.getByRole("dialog", { name: "Add title · Find my record" })).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".quick-action-panel:visible")).toHaveCount(0);
  await page.reload(); await open();
  await expect(status).toHaveAttribute("data-value", "보는중");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await status.click();
  if (width < 700) expect(await page.getByRole("listbox").evaluate(node => Boolean(node.closest('[role="dialog"]')))).toBe(true);
  await page.screenshot({ path: `.cache/v84-service/status-menu-${width}.png`, fullPage: true });
});

test("bookshelf search has a visible cue and dark wordmark has no hover plate", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search collection", exact: true });
  await expect(search).toHaveAttribute("placeholder", "Find a title");
  await search.focus(); await expect(search).toHaveCSS("outline-style", "none");
  await expect(search).toHaveCSS("border-bottom-color", "rgb(230, 0, 104)");
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  const brand = page.locator(".top-nav__brand");
  await brand.hover(); await expect(brand).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(brand).toHaveCSS("opacity", "1");
  await page.screenshot({ path: ".cache/v84-service/wordmark-dark-hover.png", fullPage: true });
  await page.locator(".quick-action__input:visible").focus();
  await page.getByRole("combobox", { name: "Default add status" }).click();
  await expect(page.getByRole("listbox")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await expect(page.getByRole("listbox")).toHaveCSS("color", "rgb(237, 237, 237)");
  await page.screenshot({ path: ".cache/v84-service/status-menu-dark.png", fullPage: true });
});
