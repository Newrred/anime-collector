import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWebOAuthRedirect,
  parseWebOAuthCallback,
  resolveWebOAuthNext,
  startWebGoogleOAuth,
} from "../../src/features/auth/webOAuth.js";

test("existing member OAuth needs no new signup declaration and preserves a safe return page", async () => {
  const calls = [];
  const client = { auth: { signInWithOAuth: async options => { calls.push(options); return { error: null }; } } };
  await startWebGoogleOAuth(client, { rawNext: '/admin/', origin: 'https://www.moemoa.xyz', persistNext: next => calls.push(next) });
  assert.deepEqual(calls, ['/admin/', { provider: 'google', options: {
    redirectTo: 'https://www.moemoa.xyz/auth/callback/', queryParams: { prompt: 'select_account' },
  } }]);
});

test("existing member OAuth rejects unsafe return destinations and propagates provider failure", async () => {
  let next;
  const failure = new Error('provider unavailable');
  const client = { auth: { signInWithOAuth: async () => ({ error: failure }) } };
  await assert.rejects(startWebGoogleOAuth(client, { rawNext: 'https://evil.test', origin: 'https://www.moemoa.xyz', persistNext: value => { next = value; } }), failure);
  assert.equal(next, '/data/');
});

test("Web OAuth uses the exact allowlisted callback URL and keeps next navigation local", () => {
  assert.equal(buildWebOAuthRedirect({
    origin: "https://www.moemoa.xyz",
    base: "/",
  }), "https://www.moemoa.xyz/auth/callback/");
});

test("Web callback accepts one bounded PKCE code and a same-app next path", () => {
  assert.deepEqual(parseWebOAuthCallback({
    search: "?code=pkce-code-123&next=%2Fmoemoa%2Farchive%2F%3Ffrom%3Dauth",
    hash: "",
    origin: "https://example.test",
    base: "/moemoa/",
    pendingNext: "/moemoa/data/",
  }), {
    code: "pkce-code-123",
    next: "/moemoa/archive/?from=auth",
  });
});

test("Web callback rejects implicit access and refresh token fragments", () => {
  assert.throws(() => parseWebOAuthCallback({ search: "?code=x&access_token=secret", origin: "https://example.test" }), { code: "IMPLICIT_TOKEN_REJECTED" });
  assert.throws(() => parseWebOAuthCallback({
    search: "",
    hash: "#access_token=secret-access&refresh_token=secret-refresh",
    origin: "https://example.test",
    base: "/",
  }), { code: "IMPLICIT_TOKEN_REJECTED" });
});

test("Web callback never exposes a raw provider error or callback payload", () => {
  assert.throws(() => parseWebOAuthCallback({
    search: "?error=access_denied&error_description=private-provider-detail",
    hash: "",
    origin: "https://example.test",
    base: "/",
  }), (error) => {
    assert.equal(error.code, "OAUTH_PROVIDER_ERROR");
    assert.equal(error.message.includes("private-provider-detail"), false);
    assert.equal(error.message.includes("access_denied"), false);
    return true;
  });
});

test("next navigation is restricted to the current origin and app base", () => {
  const input = { origin: "https://example.test", base: "/moemoa/" };
  assert.equal(resolveWebOAuthNext({ ...input, rawNext: "https://evil.test/moemoa/" }), "/moemoa/data/");
  assert.equal(resolveWebOAuthNext({ ...input, rawNext: "/admin/" }), "/moemoa/data/");
  assert.equal(resolveWebOAuthNext({ ...input, rawNext: "//evil.test/path" }), "/moemoa/data/");
  for(const rawNext of ['/moemoa/auth/complete/','/moemoa/api/signup?action=callback','/moemoa/%61uth/complete/']) {
    assert.equal(resolveWebOAuthNext({...input,rawNext}),'/moemoa/data/');
  }
  assert.equal(resolveWebOAuthNext({ ...input, rawNext: "", pendingNext: "/moemoa/boards/?id=1" }), "/moemoa/boards/?id=1");
});

test("missing, duplicate, or unbounded authorization codes are rejected", () => {
  const input = { hash: "", origin: "https://example.test", base: "/" };
  assert.throws(() => parseWebOAuthCallback({ ...input, search: "" }), { code: "AUTH_CODE_MISSING" });
  assert.throws(() => parseWebOAuthCallback({ ...input, search: "?code=one&code=two" }), { code: "AUTH_CODE_INVALID" });
  assert.throws(() => parseWebOAuthCallback({ ...input, search: `?code=${"x".repeat(4097)}` }), { code: "AUTH_CODE_INVALID" });
});
