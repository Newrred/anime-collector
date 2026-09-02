import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ANDROID_STATIC_ROUTES,
  verifyAndroidStaticRoutes,
} from "../../scripts/verify-android-static-routes.mjs";
import * as navigation from "../../src/domain/search/memoryCardNavigation.js";
import { openLibraryDeepLink } from "../../src/domain/search/quickActionActions.js";

test("Android static route manifest includes Archive, Board, and private Card shells", () => {
  assert.equal(ANDROID_STATIC_ROUTES.includes("archive/index.html"), true);
  assert.equal(ANDROID_STATIC_ROUTES.includes("boards/index.html"), true);
  assert.equal(ANDROID_STATIC_ROUTES.includes("memory/new/index.html"), true);
  assert.equal(ANDROID_STATIC_ROUTES.includes("memory/card/index.html"), true);
});

test("static route verification rejects a missing generated Board shell", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "moemoa-routes-"));
  await Promise.all(ANDROID_STATIC_ROUTES.filter((route) => route !== "boards/index.html").map(async (route) => {
    const target = path.join(root, "dist", route);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "ok");
  }));
  const nativeFile = path.join(root, "android/app/src/main/java/com/newrred/moemoa/NativeRoutes.java");
  await mkdir(path.dirname(nativeFile), { recursive: true });
  await writeFile(nativeFile, 'return "/memory/new/index.html";');
  await assert.rejects(() => verifyAndroidStaticRoutes(root), { code: "ENOENT" });
});

test("native Memory Card navigation targets the packaged index document", () => {
  const href = navigation.buildMemoryCardHref({
    base: "/",
    native: true,
    row: {
      catalogAnimeId: "anime:11111111-1111-4111-8111-000000000001",
      title: "카우보이 비밥",
    },
  });

  assert.equal(
    href,
    "/memory/new/index.html?animeId=anime%3A11111111-1111-4111-8111-000000000001&title=%EC%B9%B4%EC%9A%B0%EB%B3%B4%EC%9D%B4+%EB%B9%84%EB%B0%A5",
  );
});

test("native internal navigation preserves query and hash while targeting index.html", () => {
  const href = navigation.toPlatformAppHref?.(
    "/archive/?sort=recent#memory-42",
    { native: true, origin: "https://localhost" },
  ) ?? null;

  assert.equal(href, "/archive/index.html?sort=recent#memory-42");
});

test("native anchor clicks bypass the web router and load the packaged document", () => {
  let assigned = null;
  let prevented = false;
  let stopped = false;
  const anchor = {
    href: "https://localhost/library/?animeId=20",
    target: "",
    hasAttribute: () => false,
    getAttribute: (name) => (name === "href" ? "/library/?animeId=20" : null),
  };
  const event = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest: () => anchor },
    preventDefault: () => { prevented = true; },
    stopImmediatePropagation: () => { stopped = true; },
  };

  const handled = navigation.handleNativeAppLinkClick?.(event, {
    native: true,
    origin: "https://localhost",
    assign: (href) => { assigned = href; },
  }) ?? false;

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(assigned, "/library/index.html?animeId=20");
});

test("native navigation installs one capture listener and removes it during cleanup", () => {
  let installed = null;
  let removed = null;
  const documentRef = {
    addEventListener: (type, listener, capture) => { installed = { type, listener, capture }; },
    removeEventListener: (type, listener, capture) => { removed = { type, listener, capture }; },
  };

  const cleanup = navigation.installNativeAppLinkNavigation?.({
    native: true,
    documentRef,
    locationRef: { origin: "https://localhost", assign: () => {} },
  }) ?? null;

  assert.equal(typeof cleanup, "function");
  assert.equal(installed?.type, "click");
  assert.equal(installed?.capture, true);
  cleanup();
  assert.deepEqual(removed, installed);
});

test("native Library actions open the packaged Library document", () => {
  let assigned = null;

  openLibraryDeepLink({
    base: "/",
    animeId: 20,
    focus: "quick-log",
    native: true,
    locationRef: {
      origin: "https://localhost",
      assign: (href) => { assigned = href; },
    },
  });

  assert.equal(assigned, "/library/index.html?animeId=20&focus=quick-log");
});
