import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { toPlatformAppHref } from "../src/domain/search/memoryCardNavigation.js";

export const ANDROID_ROUTE_CONTRACTS = Object.freeze([
  { href: "/", packaged: "/index.html" },
  { href: "/library/?animeId=1", packaged: "/library/index.html?animeId=1" },
  { href: "/archive/", packaged: "/archive/index.html" },
  { href: "/boards/", packaged: "/boards/index.html" },
  { href: "/memory/new/?title=Test", packaged: "/memory/new/index.html?title=Test" },
  { href: "/memory/card/?id=card-1", packaged: "/memory/card/index.html?id=card-1" },
  { href: "/tier/", packaged: "/tier/index.html" },
  { href: "/profile/", packaged: "/profile/index.html" },
  { href: "/data/", packaged: "/data/index.html" },
  { href: "/help/", packaged: "/help/index.html" },
  { href: "/catalog/detail/?id=anime-1", packaged: "/catalog/detail/index.html?id=anime-1" },
  { href: "/u/?handle=tester", packaged: "/u/index.html?handle=tester" },
  { href: "/auth/callback/", packaged: "/auth/callback/index.html" },
]);

export const ANDROID_STATIC_ROUTES = Object.freeze([
  ...new Set(ANDROID_ROUTE_CONTRACTS.map(({ packaged }) => packaged.split(/[?#]/, 1)[0].replace(/^\/+/, ""))),
]);

export async function verifyAndroidStaticRoutes(root = process.cwd()) {
  const dist = path.join(root, "dist");
  await Promise.all(ANDROID_STATIC_ROUTES.map((route) => access(path.join(dist, route))));
  const nativeRoutes = await readFile(
    path.join(root, "android/app/src/main/java/com/newrred/moemoa/NativeRoutes.java"),
    "utf8",
  );
  if (!nativeRoutes.includes("/memory/new/index.html")) {
    throw new Error("Native composer route is not mapped to the generated static shell");
  }
  return { routeCount: ANDROID_STATIC_ROUTES.length };
}

export async function verifyPackagedAndroidRoutes(root = process.cwd()) {
  const publicRoot = path.join(root, "android/app/src/main/assets/public");
  for (const contract of ANDROID_ROUTE_CONTRACTS) {
    const actual = toPlatformAppHref(contract.href, {
      native: true,
      origin: "https://localhost",
    });
    assert.equal(actual, contract.packaged, `Native mapping failed for ${contract.href}`);
    const pathname = new URL(actual, "https://localhost").pathname.replace(/^\/+/, "");
    await access(path.join(publicRoot, pathname));
  }
  return { routeCount: ANDROID_ROUTE_CONTRACTS.length, publicRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.all([verifyAndroidStaticRoutes(), verifyPackagedAndroidRoutes()]).then(([, packaged]) => {
    process.stdout.write(`Android static route contract: ${packaged.routeCount} routes verified in ${packaged.publicRoot}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
