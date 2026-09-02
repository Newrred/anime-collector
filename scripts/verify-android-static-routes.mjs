import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ANDROID_STATIC_ROUTES = Object.freeze([
  "index.html",
  "archive/index.html",
  "boards/index.html",
  "memory/new/index.html",
  "memory/card/index.html",
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
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyAndroidStaticRoutes().then(({ routeCount }) => {
    process.stdout.write(`Android static routes verified: ${routeCount}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
