import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWebOAuthRedirect,
  parseWebOAuthCallback,
  resolveWebOAuthNext,
} from "../../src/features/auth/webOAuth.js";

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
  assert.equal(resolveWebOAuthNext({ ...input, rawNext: "", pendingNext: "/moemoa/boards/?id=1" }), "/moemoa/boards/?id=1");
});

test("missing, duplicate, or unbounded authorization codes are rejected", () => {
  const input = { hash: "", origin: "https://example.test", base: "/" };
  assert.throws(() => parseWebOAuthCallback({ ...input, search: "" }), { code: "AUTH_CODE_MISSING" });
  assert.throws(() => parseWebOAuthCallback({ ...input, search: "?code=one&code=two" }), { code: "AUTH_CODE_INVALID" });
  assert.throws(() => parseWebOAuthCallback({ ...input, search: `?code=${"x".repeat(4097)}` }), { code: "AUTH_CODE_INVALID" });
});
