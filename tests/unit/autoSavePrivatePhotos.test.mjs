import assert from "node:assert/strict";
import test from "node:test";
import { queueNewPrivatePhoto, drainPrivatePhotoAutoSave } from "../../src/features/memory/application/autoSavePrivatePhotos.js";

const userId = "11111111-1111-4111-8111-111111111111";
const ownerId = `account:${userId}`;
const asset = { id: "asset-1", ownerId, imageType: "UNKNOWN", localRef: "local:1", checksumSha256: "a".repeat(64), sync: { syncState: "SYNCED", remoteVersion: 2 } };
const card = { id: "card-1", ownerId };
const store = () => {
  const rows = new Map();
  return {
    put: async value => { rows.set(value.key, value); return value; },
    list: async owner => [...rows.values()].filter(value => value.ownerId === owner),
    remove: async key => { rows.delete(key); },
  };
};
const input = (overrides = {}) => ({
  runtime: { getCard: async () => ({ card, asset }), initialize: async () => ({ id: ownerId }) },
  userId, store: store(), getSession: async () => ({ user: { id: userId } }),
  createPhotoTransfer: () => ({ upload: async () => {} }),
  isPrivateImage: value => value.imageType === "UNKNOWN", enabled: true,
  ...overrides,
});

test("only a newly selected account photo creates a retry intent", async () => {
  const options = input();
  const intent = await queueNewPrivatePhoto({ runtime: options.runtime, userId, cardId: card.id, store: options.store, isPrivateImage: options.isPrivateImage });
  assert.equal(intent.assetId, asset.id);
  assert.equal((await options.store.list(ownerId)).length, 1);
  const guest = await queueNewPrivatePhoto({ ...options, runtime: { getCard: async () => ({ card: { ...card, ownerId: "guest:1" }, asset }) }, cardId: card.id });
  assert.equal(guest, null);
  assert.equal((await options.store.list(ownerId)).length, 1);
});

test("photo intent waits for metadata and survives a failed transfer before completing once", async () => {
  const options = input();
  let synced = false;
  let attempts = 0;
  options.runtime.getCard = async () => ({ card, asset: { ...asset, sync: synced ? asset.sync : { syncState: "PENDING", remoteVersion: 0 } } });
  options.createPhotoTransfer = () => ({ upload: async () => { attempts++; if (attempts === 1) throw new Error("offline"); } });
  await queueNewPrivatePhoto({ runtime: options.runtime, userId, cardId: card.id, store: options.store, isPrivateImage: options.isPrivateImage });
  assert.deepEqual(await drainPrivatePhotoAutoSave(options), { completed: 0, pending: 1 });
  assert.equal(attempts, 0);
  synced = true;
  assert.deepEqual(await drainPrivatePhotoAutoSave(options), { completed: 0, pending: 1 });
  assert.deepEqual(await drainPrivatePhotoAutoSave(options), { completed: 1, pending: 0 });
  assert.equal(attempts, 2);
  assert.deepEqual(await options.store.list(ownerId), []);
});

test("another account cannot drain an intent, and replaced assets discard only their old intent", async () => {
  const options = input();
  await queueNewPrivatePhoto({ runtime: options.runtime, userId, cardId: card.id, store: options.store, isPrivateImage: options.isPrivateImage });
  assert.deepEqual(await drainPrivatePhotoAutoSave({ ...options, getSession: async () => ({ user: { id: "other" } }) }), { completed: 0, pending: 1 });
  assert.equal((await options.store.list(ownerId)).length, 1);
  options.runtime.getCard = async () => ({ card, asset: { ...asset, id: "asset-2" } });
  assert.deepEqual(await drainPrivatePhotoAutoSave(options), { completed: 1, pending: 0 });
  assert.deepEqual(await options.store.list(ownerId), []);
});
