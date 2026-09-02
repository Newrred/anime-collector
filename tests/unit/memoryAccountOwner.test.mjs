import test from "node:test";
import assert from "node:assert/strict";

import {
  createAccountOwner,
  createAnimeRef,
  requireOwnerId,
} from "../../src/features/memory/domain/memoryDomain.js";
import { upgradeMemoryDatabase } from "../../src/features/memory/adapters/indexeddb/memoryDb.js";
import {
  activateOwner,
  ensureAccountOwner,
  ensureInstallationIdentity,
  getActiveOwner,
  rotateGuestOwnerAfterPromotion,
} from "../../src/features/memory/adapters/indexeddb/memoryOwnerStore.js";
import {
  appendSyncOperation,
  listPendingSyncOperations,
  readDeviceSyncState,
  writeDeviceSyncState,
} from "../../src/features/memory/adapters/indexeddb/memorySyncStore.js";

const NOW = "2026-08-26T00:00:00.000Z";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_OWNER_ID = `account:${USER_ID}`;
const INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
const GUEST_OWNER_ID = `guest:${INSTALLATION_ID}`;

const clone = (value) => value == null ? value : structuredClone(value);

class FakeRequest {
  constructor(transaction, action) {
    this.transaction = transaction;
    transaction.pending += 1;
    queueMicrotask(() => {
      try {
        this.result = action();
        this.onsuccess?.({ target: this });
      } catch (error) {
        this.error = error;
        this.onerror?.({ target: this });
      } finally {
        transaction.pending -= 1;
        transaction.scheduleComplete();
      }
    });
  }
}

class FakeStore {
  constructor(database, name, options = {}) {
    this.database = database;
    this.name = name;
    this.keyPath = options.keyPath;
    this.records = new Map();
    this.indexes = [];
  }

  createIndex(name, keyPath, options = {}) {
    this.indexes.push({ name, keyPath, options });
  }
}

class FakeTransaction {
  constructor(database, names, mode) {
    this.database = database;
    this.names = new Set(Array.isArray(names) ? names : [names]);
    this.mode = mode;
    this.pending = 0;
    this.timer = null;
  }

  objectStore(name) {
    if (!this.names.has(name)) throw new Error(`Store ${name} is outside the transaction`);
    const store = this.database.stores.get(name);
    if (!store) throw new Error(`Missing store ${name}`);
    return {
      get: (key) => new FakeRequest(this, () => clone(store.records.get(key) ?? null)),
      getAll: () => new FakeRequest(this, () => [...store.records.values()].map(clone)),
      put: (value) => new FakeRequest(this, () => {
        const key = value[store.keyPath];
        store.records.set(key, clone(value));
        return key;
      }),
      add: (value) => new FakeRequest(this, () => {
        const key = value[store.keyPath];
        if (store.records.has(key)) throw new Error("ConstraintError");
        store.records.set(key, clone(value));
        return key;
      }),
    };
  }

  scheduleComplete() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.pending === 0) this.oncomplete?.();
    }, 0);
  }

  abort() {
    this.onabort?.();
  }
}

class FakeDatabase {
  constructor() {
    this.stores = new Map();
    this.objectStoreNames = { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name, options) {
    const store = new FakeStore(this, name, options);
    this.stores.set(name, store);
    return store;
  }

  transaction(names, mode = "readonly") {
    return new FakeTransaction(this, names, mode);
  }
}

const createDatabase = () => {
  const database = new FakeDatabase();
  upgradeMemoryDatabase(database);
  return database;
};

test("account owner uses the authenticated user UUID as its stable namespace", () => {
  const account = createAccountOwner({ userId: USER_ID, now: NOW });

  assert.deepEqual(account, {
    id: ACCOUNT_OWNER_ID,
    kind: "ACCOUNT",
    userId: USER_ID,
    createdAt: NOW,
  });
  assert.equal(requireOwnerId(GUEST_OWNER_ID), GUEST_OWNER_ID);
  assert.equal(requireOwnerId(ACCOUNT_OWNER_ID), ACCOUNT_OWNER_ID);
});

test("account owner and catalog binding reject malformed identifiers", () => {
  assert.throws(
    () => createAccountOwner({ userId: "not-a-uuid", now: NOW }),
    { code: "INVALID_OWNER_ID" },
  );
  assert.throws(
    () => createAnimeRef({
      id: "anime-ref-1",
      catalogAnimeId: "anime:not-a-uuid",
      displayTitle: "Frieren",
      aliases: [],
      genres: [],
      sourceBinding: { provider: "ANILIST", externalId: "154587" },
      verificationState: "PROVIDER_CANDIDATE",
      now: NOW,
    }),
    { code: "INVALID_CATALOG_ANIME_ID" },
  );
});

test("anime reference preserves a valid catalog ID while provider-only legacy data may remain null", () => {
  const catalogAnimeId = "anime:33333333-3333-4333-8333-333333333333";
  const base = {
    id: "anime-ref-1",
    displayTitle: "Frieren",
    aliases: [],
    genres: ["Fantasy"],
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "PROVIDER_CANDIDATE",
    now: NOW,
  };

  assert.equal(createAnimeRef({ ...base, catalogAnimeId }).catalogAnimeId, catalogAnimeId);
  assert.equal(createAnimeRef({ ...base, catalogAnimeId: null }).catalogAnimeId, null);
});

test("installation identity initializes and preserves an explicit active owner", async () => {
  const database = createDatabase();
  const identity = await ensureInstallationIdentity(database, { uuid: INSTALLATION_ID, now: NOW });

  assert.equal(identity.installationId, INSTALLATION_ID);
  assert.equal(identity.guestOwner.id, GUEST_OWNER_ID);
  assert.equal((await getActiveOwner(database)).id, GUEST_OWNER_ID);

  const account = await ensureAccountOwner(database, { userId: USER_ID, now: NOW });
  await activateOwner(database, { ownerId: account.id, now: NOW });
  assert.equal((await getActiveOwner(database)).id, ACCOUNT_OWNER_ID);

  const repeated = await ensureInstallationIdentity(database, {
    uuid: "44444444-4444-4444-8444-444444444444",
    now: "2026-08-27T00:00:00.000Z",
  });
  assert.equal(repeated.installationId, INSTALLATION_ID);
  assert.equal((await getActiveOwner(database)).id, ACCOUNT_OWNER_ID);
});

test("guest rotation preserves installation identity and activates a fresh guest namespace", async () => {
  const database = createDatabase();
  await ensureInstallationIdentity(database, { uuid: INSTALLATION_ID, now: NOW });
  const nextGuestUuid = "55555555-5555-4555-8555-555555555555";

  const nextGuest = await rotateGuestOwnerAfterPromotion(database, {
    uuid: nextGuestUuid,
    now: "2026-08-27T00:00:00.000Z",
  });

  assert.equal(nextGuest.id, `guest:${nextGuestUuid}`);
  assert.equal((await getActiveOwner(database)).id, nextGuest.id);
  const identity = await ensureInstallationIdentity(database, {
    uuid: "66666666-6666-4666-8666-666666666666",
    now: "2026-08-28T00:00:00.000Z",
  });
  assert.equal(identity.installationId, INSTALLATION_ID);
  assert.equal(identity.guestOwner.id, nextGuest.id);
});

test("sync store returns only bounded pending operations for the requested owner", async () => {
  const database = createDatabase();
  await ensureInstallationIdentity(database, { uuid: INSTALLATION_ID, now: NOW });
  await ensureAccountOwner(database, { userId: USER_ID, now: NOW });
  const operation = {
    id: "77777777-7777-4777-8777-777777777777",
    ownerId: ACCOUNT_OWNER_ID,
    entityType: "MEMORY_CARD",
    entityId: "88888888-8888-4888-8888-888888888888",
    operationType: "UPSERT",
    baseVersion: 0,
    requestHash: "a".repeat(64),
    payload: { titleSnapshot: "Frieren" },
    state: "PENDING",
    createdAt: NOW,
  };

  await appendSyncOperation(database, operation);

  assert.deepEqual(await listPendingSyncOperations(database, ACCOUNT_OWNER_ID, 10), [{ ...operation, ordinal: 0 }]);
  assert.deepEqual(await listPendingSyncOperations(database, GUEST_OWNER_ID, 10), []);
});

test("device sync state is owner-scoped and round-trips exact cursor data", async () => {
  const database = createDatabase();
  await ensureInstallationIdentity(database, { uuid: INSTALLATION_ID, now: NOW });
  await ensureAccountOwner(database, { userId: USER_ID, now: NOW });
  const state = {
    ownerId: ACCOUNT_OWNER_ID,
    userId: USER_ID,
    installationId: INSTALLATION_ID,
    deviceId: "99999999-9999-4999-8999-999999999999",
    lastSyncSeq: 42,
    updatedAt: NOW,
  };

  await writeDeviceSyncState(database, state);

  assert.deepEqual(await readDeviceSyncState(database, ACCOUNT_OWNER_ID), state);
  assert.equal(await readDeviceSyncState(database, GUEST_OWNER_ID), null);
});
