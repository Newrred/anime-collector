import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { toPlatformAppHref } from "../src/domain/search/memoryCardNavigation.js";

const publicRoot = new URL("../android/app/src/main/assets/public/", import.meta.url);
const routeContracts = [
  { href: "/", packaged: "/index.html" },
  { href: "/library/?animeId=1", packaged: "/library/index.html?animeId=1" },
  { href: "/archive/", packaged: "/archive/index.html" },
  { href: "/memory/new/?title=Test", packaged: "/memory/new/index.html?title=Test" },
  { href: "/memory/card/?id=card-1", packaged: "/memory/card/index.html?id=card-1" },
  { href: "/tier/", packaged: "/tier/index.html" },
  { href: "/profile/", packaged: "/profile/index.html" },
  { href: "/data/", packaged: "/data/index.html" },
  { href: "/help/", packaged: "/help/index.html" },
  { href: "/catalog/detail/?id=anime-1", packaged: "/catalog/detail/index.html?id=anime-1" },
  { href: "/u/?handle=tester", packaged: "/u/index.html?handle=tester" },
  { href: "/auth/callback/", packaged: "/auth/callback/index.html" },
];

for (const contract of routeContracts) {
  const actual = toPlatformAppHref(contract.href, {
    native: true,
    origin: "https://localhost",
  });
  assert.equal(actual, contract.packaged, `Native mapping failed for ${contract.href}`);
  const pathname = new URL(actual, "https://localhost").pathname.replace(/^\/+/, "");
  await access(new URL(pathname, publicRoot));
}

console.log(`Android static route contract: ${routeContracts.length} routes verified in ${fileURLToPath(publicRoot)}`);
