import test from "node:test";
import assert from "node:assert/strict";
import { publicShareLink } from "../../src/features/memory/domain/publicShareLink.js";
import { resolveWebOAuthNext } from "../../src/features/auth/webOAuth.js";
const id = "55555555-5555-4555-8555-555555555555";
test("shared public links use only public UUID and canonical route", () => {
  assert.equal(publicShareLink({ kind: "home", id, origin: "https://example.test/private/?token=secret#note", base: "/app/" }), `https://example.test/app/public/home/?id=${id}`);
  assert.equal(publicShareLink({ kind: "board", id, origin: "https://localhost", native: true }), `https://www.moemoa.xyz/public/board/?id=${id}`);
  assert.throws(() => publicShareLink({ kind: "card", id, origin: "https://example.test" }));
  assert.throws(() => publicShareLink({ kind: "home", id: "private-id", origin: "https://example.test" }));
});
test("sign-in return preserves public homes but rejects tokens, callback loops and external hosts", () => {
  const origin = "https://example.test";
  assert.equal(resolveWebOAuthNext({ origin, pendingNext: `/public/home/?id=${id}` }), `/public/home/?id=${id}`);
  for (const rawNext of ["//evil.test", "https://user@example.test/public/home/", "/auth/callback/?code=x", "/public/home/?access_token=secret", "/public/home/#refresh_token=secret", "/public/home/?%63ode=secret", "/\\evil.test", "/public/home/?id=%zz"]) {
    assert.equal(resolveWebOAuthNext({ origin, rawNext }), "/data/", rawNext);
  }
});
