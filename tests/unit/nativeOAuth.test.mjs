import test from "node:test";
import assert from "node:assert/strict";

import {
  installNativeOAuthCallback,
  parseNativeAuthCallback,
  startNativeGoogleOAuth,
} from "../../src/features/auth/nativeOAuth.js";

test("native callback accepts only the exact one-time-code URI", () => {
  assert.deepEqual(parseNativeAuthCallback("com.newrred.moemoa://auth/callback?code=one-time-code"), { code: "one-time-code" });
  assert.equal(parseNativeAuthCallback("https://evil.example/auth/callback?code=x"), null);
  assert.equal(parseNativeAuthCallback("com.newrred.moemoa://other?code=x"), null);
  assert.equal(parseNativeAuthCallback("com.newrred.moemoa://auth/callback?access_token=x"), null);
  assert.equal(parseNativeAuthCallback("com.newrred.moemoa://auth/callback?code=a&code=b"), null);
  assert.equal(parseNativeAuthCallback("com.newrred.moemoa://auth/callback?code=x#refresh_token=y"), null);
});

test("native OAuth opens only a returned HTTPS authorization URL and stores a safe next route", async () => {
  const calls = [];
  const next = await startNativeGoogleOAuth({
    supabase: { auth: { signInWithOAuth: async (input) => {
      calls.push(["signIn", input]);
      return { data: { url: "https://example.supabase.co/auth/v1/authorize?provider=google" }, error: null };
    } } },
    browser: { open: async (input) => calls.push(["open", input]) },
    persistNext: (value) => calls.push(["next", value]),
    rawNext: "https://evil.example/steal",
    origin: "https://localhost",
    base: "/",
  });
  assert.equal(next, "/data/");
  assert.deepEqual(calls[0], ["next", "/data/"]);
  assert.equal(calls[1][1].options.redirectTo, "com.newrred.moemoa://auth/callback");
  assert.equal(calls[1][1].options.skipBrowserRedirect, true);
  assert.deepEqual(calls[2], ["open", { url: "https://example.supabase.co/auth/v1/authorize?provider=google" }]);
});

test("cold and warm callbacks exchange each code once and navigate within the app", async () => {
  const listeners = new Map();
  const exchanges = [];
  const navigations = [];
  let removed = false;
  const installed = await installNativeOAuthCallback({
    app: {
      addListener: async (name, handler) => {
        listeners.set(name, handler);
        return { remove: async () => { removed = true; } };
      },
      getLaunchUrl: async () => ({ url: "com.newrred.moemoa://auth/callback?code=cold" }),
    },
    browser: { close: async () => {} },
    exchangeCode: async (code) => exchanges.push(code),
    consumeNext: () => "/boards/",
    navigate: (path) => navigations.push(path),
    origin: "https://localhost",
    base: "/",
    report: () => {},
  });
  await installed.ready;
  await listeners.get("appUrlOpen")({ url: "com.newrred.moemoa://auth/callback?code=cold" });
  await listeners.get("appUrlOpen")({ url: "com.newrred.moemoa://auth/callback?code=warm" });
  assert.deepEqual(exchanges, ["cold", "warm"]);
  assert.deepEqual(navigations, ["/boards/", "/data/"]);
  await installed.remove();
  assert.equal(removed, true);
});

test("callback exchange failure reports only a bounded code", async () => {
  const reports = [];
  const installed = await installNativeOAuthCallback({
    app: { addListener: async () => ({ remove: async () => {} }), getLaunchUrl: async () => ({ url: "com.newrred.moemoa://auth/callback?code=secret-code" }) },
    browser: { close: async () => {} },
    exchangeCode: async () => { throw new Error("raw postgres/provider detail"); },
    consumeNext: () => "/data/", navigate: () => { throw new Error("must not navigate"); },
    origin: "https://localhost", base: "/", report: (value) => reports.push(value),
  });
  await installed.ready;
  assert.deepEqual(reports, [{ code: "PKCE_EXCHANGE_FAILED" }]);
  assert.doesNotMatch(JSON.stringify(reports), /secret|postgres|provider/);
});
