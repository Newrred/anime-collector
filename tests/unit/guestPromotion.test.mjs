import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuestPromotionManifest,
  resolvePromotionTitleChoice,
} from "../../src/features/memory/application/buildGuestPromotionManifest.js";
import { createPromoteGuestMemory } from "../../src/features/memory/application/promoteGuestMemory.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_OWNER = `account:${USER_ID}`;
const GUEST_OWNER = "guest:22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_ID = "44444444-4444-4444-8444-444444444444";
const NEXT_GUEST_UUID = "55555555-5555-4555-8555-555555555555";
const PRIVATE_TITLE_ID = "66666666-6666-4666-8666-666666666666";
const ANIME_REF_ID = "77777777-7777-4777-8777-777777777777";
const CARD_A = "88888888-8888-4888-8888-888888888888";
const CARD_B = "99999999-9999-4999-8999-999999999999";
const ASSET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ASSET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOARD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MEMBER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MEMBER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CATALOG_ID = "anime:ffffffff-ffff-4fff-8fff-ffffffffffff";
const NOW = "2026-09-02T03:00:00.000Z";
const sync = { remoteVersion: 0, syncState: "LOCAL_ONLY", clientUpdatedAt: NOW, serverUpdatedAt: null, lastOperationId: null };

const makeCard = (id, title) => ({
  id,
  ownerId: GUEST_OWNER,
  animeRefId: title === ANIME_REF_ID ? title : null,
  privateTitleId: title === PRIVATE_TITLE_ID ? title : null,
  visualAssetId: id === CARD_A ? ASSET_A : ASSET_B,
  status: "COMPLETE_PRIVATE",
  note: id === CARD_A ? "First memory" : "Second memory",
  watchedAt: null,
  watchedAtPrecision: "UNKNOWN",
  episode: null,
  sceneCue: null,
  emotionTags: [],
  rewatchIntent: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  sync,
});

const makeAsset = (id) => ({
  id,
  ownerId: GUEST_OWNER,
  imageType: "UNKNOWN",
  state: "READY",
  storageScope: "LOCAL_ONLY",
  visibility: "PRIVATE",
  rightsBasis: "UNKNOWN",
  localRef: `asset:private-${id}`,
  checksumSha256: id[0].repeat(64),
  mimeType: "image/png",
  byteSize: 1024,
  width: 800,
  height: 1000,
  designSpec: null,
  isCurrent: true,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  sync,
});

function fixture({ reverse = false, note = "Second memory", catalogAnimeId = null } = {}) {
  const privateTitle = {
    id: PRIVATE_TITLE_ID,
    ownerId: GUEST_OWNER,
    displayTitle: "Frieren",
    normalizedTitle: "frieren",
    optionalGenres: ["Fantasy"],
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    sync,
  };
  const animeRef = {
    id: ANIME_REF_ID,
    catalogAnimeId,
    displayTitle: "Naruto",
    normalizedTitle: "naruto",
    aliases: [],
    genres: ["Action"],
    sourceKey: "ANILIST:20",
    sourceBinding: { provider: "ANILIST", externalId: "20" },
    verificationState: "PROVIDER_CANDIDATE",
    createdAt: NOW,
    updatedAt: NOW,
  };
  const cards = [makeCard(CARD_A, PRIVATE_TITLE_ID), { ...makeCard(CARD_B, ANIME_REF_ID), note }];
  const visualAssets = [makeAsset(ASSET_A), makeAsset(ASSET_B)];
  const board = {
    id: BOARD_ID, ownerId: GUEST_OWNER, title: "Favorites", description: "",
    visibility: "PRIVATE", createdAt: NOW, updatedAt: NOW, deletedAt: null, sync,
  };
  const boardCards = [
    { id: MEMBER_A, ownerId: GUEST_OWNER, boardId: BOARD_ID, cardId: CARD_A, positionKey: "a", createdAt: NOW, updatedAt: NOW, deletedAt: null, sync },
    { id: MEMBER_B, ownerId: GUEST_OWNER, boardId: BOARD_ID, cardId: CARD_B, positionKey: "b", createdAt: NOW, updatedAt: NOW, deletedAt: null, sync },
  ];
  const maybeReverse = (rows) => reverse ? [...rows].reverse() : rows;
  return {
    owner: { id: GUEST_OWNER, kind: "GUEST", createdAt: NOW },
    privateTitles: [privateTitle],
    animeRefs: [animeRef],
    cards: maybeReverse(cards),
    visualAssets: maybeReverse(visualAssets),
    boards: [board],
    boardCards: maybeReverse(boardCards),
    mediaOperations: [{ id: OPERATION_ID, ownerId: GUEST_OWNER, cardId: CARD_A, assetId: ASSET_A }],
  };
}

function manifestRepository(bundle) {
  return { readOwnerPromotionBundle: async () => structuredClone(bundle) };
}

test("Guest manifest is deterministic, bounded, and redacts local image references", async () => {
  const first = await buildGuestPromotionManifest({ repository: manifestRepository(fixture()), guestOwnerId: GUEST_OWNER });
  const reordered = await buildGuestPromotionManifest({ repository: manifestRepository(fixture({ reverse: true })), guestOwnerId: GUEST_OWNER });
  const changed = await buildGuestPromotionManifest({ repository: manifestRepository(fixture({ note: "Changed note" })), guestOwnerId: GUEST_OWNER });

  assert.deepEqual(first.counts, { privateTitles: 1, cards: 2, visualAssets: 2, boards: 1, boardCards: 2 });
  assert.deepEqual(first.unresolvedAnimeRefs.map(({ id }) => id), [ANIME_REF_ID]);
  assert.match(first.sourceHash, /^[a-f0-9]{64}$/u);
  assert.equal(first.sourceHash, reordered.sourceHash);
  assert.notEqual(first.sourceHash, changed.sourceHash);
  assert.equal(JSON.stringify(first.remoteBundle).includes("localRef"), false);
});

test("title choices require an exact catalog id or explicitly keep a personal title", async () => {
  const calls = [];
  const repository = {
    resolvePromotionTitleChoice: async (input) => { calls.push(structuredClone(input)); return input.choice; },
  };
  await resolvePromotionTitleChoice({
    repository, guestOwnerId: GUEST_OWNER, animeRefId: ANIME_REF_ID,
    choice: { kind: "CATALOG", catalogAnimeId: CATALOG_ID }, now: NOW,
  });
  await resolvePromotionTitleChoice({
    repository, guestOwnerId: GUEST_OWNER, animeRefId: ANIME_REF_ID,
    choice: { kind: "KEEP_PRIVATE" }, now: NOW,
  });
  assert.equal(calls[0].choice.catalogAnimeId, CATALOG_ID);
  assert.equal(calls[1].choice.kind, "KEEP_PRIVATE");
  await assert.rejects(() => resolvePromotionTitleChoice({
    repository, guestOwnerId: GUEST_OWNER, animeRefId: ANIME_REF_ID,
    choice: { kind: "CATALOG", catalogAnimeId: "Naruto" }, now: NOW,
  }), { code: "PROMOTION_TITLE_CHOICE_INVALID" });
});

function sagaHarness({ unresolved = false, failRemote = false, failLocalOnce = false } = {}) {
  const calls = [];
  const journals = new Map();
  let localFailure = failLocalOnce;
  let activeOwnerId = GUEST_OWNER;
  let ownerBundle = fixture({ catalogAnimeId: unresolved ? null : CATALOG_ID });
  const repository = {
    async readOwnerPromotionBundle() { return structuredClone(ownerBundle); },
    async beginPromotionJournal(input) {
      calls.push(["begin", input.operationId, input.sourceHash]);
      const existing = [...journals.values()].find((row) => row.accountOwnerId === input.accountOwnerId && row.guestOwnerId === input.guestOwnerId);
      if (existing) {
        if (existing.sourceHash !== input.sourceHash) throw Object.assign(new Error("changed"), { code: "PROMOTION_SOURCE_HASH_MISMATCH" });
        return structuredClone(existing);
      }
      const row = { ...input, status: "STARTED", remoteResult: null };
      journals.set(row.operationId, row);
      return structuredClone(row);
    },
    async markPromotionRemoteCompleted(input) {
      calls.push(["remote-completed", input.operationId]);
      const row = journals.get(input.operationId);
      journals.set(input.operationId, { ...row, status: "REMOTE_COMPLETED", remoteResult: structuredClone(input.result) });
    },
    async listRecoverablePromotions(accountOwnerId) {
      return [...journals.values()]
        .filter((row) => row.accountOwnerId === accountOwnerId && row.status === "REMOTE_COMPLETED")
        .map((row) => structuredClone(row));
    },
    async commitPromotionToAccount(input) {
      calls.push(["local-commit", input.operationId]);
      if (localFailure) {
        localFailure = false;
        throw Object.assign(new Error("disk full"), { code: "LOCAL_COMMIT_FAILED" });
      }
      const row = journals.get(input.operationId);
      journals.set(input.operationId, { ...row, status: "COMPLETED" });
      activeOwnerId = input.accountOwnerId;
      ownerBundle = { ...ownerBundle, cards: [], visualAssets: [], privateTitles: [], boards: [], boardCards: [], mediaOperations: [] };
      return { accountOwnerId: input.accountOwnerId, guestOwnerId: `guest:${input.newGuestUuid}` };
    },
  };
  const gateway = {
    async promoteGuest(input) {
      calls.push(["rpc", input.operationId, input.sourceHash, structuredClone(input.bundle)]);
      if (failRemote) throw Object.assign(new Error("offline"), { code: "MEMORY_GATEWAY_FAILED" });
      return { status: "COMPLETED", importedCounts: { privateTitles: 1, cards: 2, visualAssets: 2, boards: 1, boardCards: 2 }, nextSyncSeq: 7 };
    },
  };
  const command = createPromoteGuestMemory({ repository, gateway, uuid: () => NEXT_GUEST_UUID, clock: { now: () => NOW } });
  return { command, calls, journals, getActiveOwnerId: () => activeOwnerId, setBundle: (bundle) => { ownerBundle = bundle; } };
}

const executeInput = { userId: USER_ID, guestOwnerId: GUEST_OWNER, accountOwnerId: ACCOUNT_OWNER, deviceId: DEVICE_ID, operationId: OPERATION_ID };

test("unresolved AnimeRefs stop before journal and remote RPC", async () => {
  const harness = sagaHarness({ unresolved: true });
  await assert.rejects(() => harness.command.execute(executeInput), { code: "PROMOTION_CATALOG_MAPPING_REQUIRED" });
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.getActiveOwnerId(), GUEST_OWNER);
});

test("network failure preserves Guest ownership and a STARTED retry journal", async () => {
  const harness = sagaHarness({ failRemote: true });
  await assert.rejects(() => harness.command.execute(executeInput), { code: "MEMORY_GATEWAY_FAILED" });
  assert.equal(harness.getActiveOwnerId(), GUEST_OWNER);
  assert.equal(harness.journals.get(OPERATION_ID).status, "STARTED");
  assert.equal(harness.calls.filter(([name]) => name === "local-commit").length, 0);
});

test("remote completion survives a local failure and recovery never repeats the RPC", async () => {
  const harness = sagaHarness({ failLocalOnce: true });
  await assert.rejects(() => harness.command.execute(executeInput), { code: "LOCAL_COMMIT_FAILED" });
  assert.equal(harness.journals.get(OPERATION_ID).status, "REMOTE_COMPLETED");
  assert.equal(harness.getActiveOwnerId(), GUEST_OWNER);

  const recovered = await harness.command.recoverPromotion({ accountOwnerId: ACCOUNT_OWNER });
  assert.equal(recovered.length, 1);
  assert.equal(harness.journals.get(OPERATION_ID).status, "COMPLETED");
  assert.equal(harness.getActiveOwnerId(), ACCOUNT_OWNER);
  assert.equal(harness.calls.filter(([name]) => name === "rpc").length, 1);
});

test("same operation and hash retries idempotently, while changed source hard-fails", async () => {
  const harness = sagaHarness({ failRemote: true });
  await assert.rejects(() => harness.command.execute(executeInput));
  const changed = fixture({ catalogAnimeId: CATALOG_ID, note: "Changed after retry" });
  harness.setBundle(changed);
  await assert.rejects(() => harness.command.execute(executeInput), { code: "PROMOTION_SOURCE_HASH_MISMATCH" });
  assert.equal(harness.getActiveOwnerId(), GUEST_OWNER);
});
