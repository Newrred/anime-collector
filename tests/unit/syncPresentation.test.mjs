import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSyncPresentation,
  hasSuccessfulRemoteCheck,
  shouldShowAuthSheetSyncAction,
  shouldAcceptSyncStatusRequest,
} from "../../src/domain/syncPresentation.js";

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

test("failed remote check remains not checked and does not enable sync actions", () => {
  assert.deepEqual(
    deriveSyncPresentation({ configured: true, connected: true, status: "error" }),
    {
      tone: "error",
      accountState: "connected",
      remoteState: "not-checked",
      showSyncActions: false,
    }
  );
});

test("auth sheet sync action stays hidden until the presentation allows it", () => {
  assert.equal(
    shouldShowAuthSheetSyncAction({
      configured: true,
      connected: true,
      showSyncActions: false,
    }),
    false
  );
  assert.equal(
    shouldShowAuthSheetSyncAction({
      configured: true,
      connected: true,
      showSyncActions: true,
    }),
    true
  );
});

test("successful remote reads only apply to the current signed-in user", () => {
  assert.equal(
    hasSuccessfulRemoteCheck({
      configured: true,
      connected: true,
      currentUserId: "user-1",
      successfulUserId: "user-1",
    }),
    true
  );
  assert.equal(
    hasSuccessfulRemoteCheck({
      configured: true,
      connected: true,
      currentUserId: "user-2",
      successfulUserId: "user-1",
    }),
    false
  );
});

test("a late user-1 refresh cannot replace a successful user-2 refresh", () => {
  const user2Request = {
    requestId: 2,
    latestRequestId: 2,
    capturedUserId: "user-2",
    currentUserId: "user-2",
  };
  const lateUser1Request = {
    requestId: 1,
    latestRequestId: 2,
    capturedUserId: "user-1",
    currentUserId: "user-2",
  };

  assert.equal(shouldAcceptSyncStatusRequest(user2Request), true);
  assert.equal(shouldAcceptSyncStatusRequest(lateUser1Request), false);
  assert.deepEqual(
    deriveSyncPresentation({
      configured: true,
      connected: true,
      remoteChecked: true,
      remoteMissing: false,
    }),
    {
      tone: "connected",
      accountState: "connected",
      remoteState: "available",
      showSyncActions: true,
    }
  );
});
