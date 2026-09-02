import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ANDROID_STATIC_ROUTES,
  verifyAndroidStaticRoutes,
} from "../../scripts/verify-android-static-routes.mjs";

test("Android static route manifest includes Archive, Board, and private Card shells", () => {
  assert.deepEqual(ANDROID_STATIC_ROUTES, [
    "index.html",
    "archive/index.html",
    "boards/index.html",
    "memory/new/index.html",
    "memory/card/index.html",
  ]);
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
