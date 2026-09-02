import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test("Android manifest exposes one exact OAuth callback and keeps the image Share Target", async () => {
  const manifest = await fs.readFile(path.resolve("android/app/src/main/AndroidManifest.xml"), "utf8");
  expect((manifest.match(/android:scheme="com\.newrred\.moemoa"/g) || [])).toHaveLength(1);
  expect(manifest).toContain('android:host="auth"');
  expect(manifest).toContain('android:path="/callback"');
  expect(manifest).toContain('android:name="android.intent.action.VIEW"');
  expect(manifest).toContain('android:name="android.intent.action.SEND"');
  expect(manifest).toContain('android:mimeType="image/*"');
});

test("built app bootstraps native callback handling without embedding a service-role secret", async ({ page }) => {
  await page.goto("/");
  const scripts = await page.locator('script[type="module"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src") || node.textContent || ""));
  expect(scripts.join("\n")).toMatch(/BaseLayout\.astro|_astro\//);
  const dist = await fs.readdir(path.resolve("dist/_astro"));
  const text = (await Promise.all(dist.filter((name) => name.endsWith(".js")).map((name) => fs.readFile(path.resolve("dist/_astro", name), "utf8")))).join("\n");
  expect(text).toContain("com.newrred.moemoa://auth/callback");
  expect(text).not.toMatch(/service[_-]?role/i);
  expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
});
