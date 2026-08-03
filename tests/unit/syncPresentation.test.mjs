import test from "node:test";
import assert from "node:assert/strict";
import { deriveSyncPresentation } from "../../src/domain/syncPresentation.js";

test("unconfigured cloud never claims remote data exists", () => {
  assert.deepEqual(deriveSyncPresentation({ configured: false }), {
    tone: "disabled",
    accountState: "local-only",
    remoteState: "unavailable",
    showSyncActions: false,
  });
});

test("signed-out configured cloud is not checked", () => {
  assert.equal(
    deriveSyncPresentation({ configured: true, connected: false }).remoteState,
    "not-checked"
  );
});

test("connected cloud stays checking until remote data is checked", () => {
  assert.equal(
    deriveSyncPresentation({ configured: true, connected: true }).remoteState,
    "checking"
  );
});

test("checked empty remote is reported as empty", () => {
  assert.equal(
    deriveSyncPresentation({ configured: true, connected: true, remoteChecked: true, remoteMissing: true }).remoteState,
    "empty"
  );
});

test("checked remote data is available and enables sync actions", () => {
  assert.deepEqual(
    deriveSyncPresentation({ configured: true, connected: true, remoteChecked: true }),
    {
      tone: "connected",
      accountState: "connected",
      remoteState: "available",
      showSyncActions: true,
    }
  );
});
