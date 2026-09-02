import {
  createAccountOwner,
  createDefaultSyncEnvelope,
  createGuestOwner,
  createPrivateTitle,
  requireOwnerId,
} from "../../domain/memoryDomain.js";

const ACTIVE_OWNER_META_KEY = "activeOwnerId";
const INSTALLATION_IDENTITY_META_KEY = "installationIdentity";
const LEGACY_GUEST_OWNER_META_KEY = "installationGuestOwnerId";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const OWNER_SCOPED_PROMOTION_STORES = [
  "private_titles",
  "memory_cards",
  "visual_assets",
  "media_operations",
  "memory_boards",
  "memory_board_cards",
  "sync_outbox",
  "sync_conflicts",
];
const SYNCED_ENTITY_STORES = new Set([
  "private_titles",
  "memory_cards",
  "visual_assets",
  "memory_boards",
  "memory_board_cards",
]);

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result ?? null);
  request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
});

const clone = (value) => value == null ? value : structuredClone(value);
const fail = (code, message, transaction = null) => {
  if (transaction) transaction.abort();
  throw Object.assign(new Error(message), { code });
};

const requireUuid = (value, field) => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("PROMOTION_JOURNAL_INVALID", `${field} is invalid`);
  return normalized;
};

const readIdentityState = async (database) => {
  const transaction = database.transaction(["meta", "owners"], "readonly");
  const meta = transaction.objectStore("meta");
  const owners = transaction.objectStore("owners");
  const [identity, legacyGuest, active, ownerRows] = await Promise.all([
    requestResult(meta.get(INSTALLATION_IDENTITY_META_KEY)),
    requestResult(meta.get(LEGACY_GUEST_OWNER_META_KEY)),
    requestResult(meta.get(ACTIVE_OWNER_META_KEY)),
    requestResult(owners.getAll()),
  ]);
  await transactionDone(transaction);
  return {
    identity,
    legacyGuest,
    active,
    owners: new Map((ownerRows || []).map((owner) => [owner.id, owner])),
  };
};

export async function getActiveOwner(database) {
  const state = await readIdentityState(database);
  const ownerId = state.active?.value;
  if (!ownerId) return null;
  try {
    requireOwnerId(ownerId);
  } catch {
    return null;
  }
  return clone(state.owners.get(ownerId) || null);
}

export async function ensureInstallationIdentity(database, { uuid, now }) {
  const state = await readIdentityState(database);
  const storedIdentity = state.identity?.value;
  const storedGuestOwnerId = storedIdentity?.guestOwnerId || state.legacyGuest?.value || null;
  const storedGuestOwner = storedGuestOwnerId ? state.owners.get(storedGuestOwnerId) : null;
  let installationId = storedIdentity?.installationId || null;
  let guestOwner = storedGuestOwner || null;

  if (!installationId && storedGuestOwnerId?.startsWith("guest:")) {
    installationId = storedGuestOwnerId.slice(6);
  }
  if (!guestOwner) {
    guestOwner = createGuestOwner({ uuid, now });
    installationId ||= guestOwner.id.slice(6);
  }

  const activeOwner = state.active?.value && state.owners.has(state.active.value)
    ? state.active.value
    : guestOwner.id;
  const timestamp = String(now);
  const transaction = database.transaction(["meta", "owners"], "readwrite");
  transaction.objectStore("owners").put(guestOwner);
  transaction.objectStore("meta").put({
    key: INSTALLATION_IDENTITY_META_KEY,
    value: { installationId, guestOwnerId: guestOwner.id },
    updatedAt: timestamp,
  });
  transaction.objectStore("meta").put({
    key: LEGACY_GUEST_OWNER_META_KEY,
    value: guestOwner.id,
    updatedAt: timestamp,
  });
  transaction.objectStore("meta").put({
    key: ACTIVE_OWNER_META_KEY,
    value: activeOwner,
    updatedAt: timestamp,
  });
  await transactionDone(transaction);

  return clone({ installationId, guestOwner });
}

export async function ensureAccountOwner(database, { userId, now }) {
  const proposed = createAccountOwner({ userId, now });
  const transaction = database.transaction("owners", "readwrite");
  const store = transaction.objectStore("owners");
  const existing = await requestResult(store.get(proposed.id));
  const owner = existing || proposed;
  if (owner.kind !== "ACCOUNT" || owner.userId !== proposed.userId) {
    transaction.abort();
    throw Object.assign(new Error("Owner identity is inconsistent"), {
      code: "OWNER_IDENTITY_CONFLICT",
    });
  }
  if (!existing) store.add(proposed);
  await transactionDone(transaction);
  return clone(owner);
}

export async function activateOwner(database, { ownerId, now }) {
  const validOwnerId = requireOwnerId(ownerId);
  const read = database.transaction("owners", "readonly");
  const owner = await requestResult(read.objectStore("owners").get(validOwnerId));
  await transactionDone(read);
  if (!owner) {
    throw Object.assign(new Error("Owner does not exist"), { code: "OWNER_NOT_FOUND" });
  }

  const write = database.transaction("meta", "readwrite");
  write.objectStore("meta").put({
    key: ACTIVE_OWNER_META_KEY,
    value: owner.id,
    updatedAt: String(now),
  });
  await transactionDone(write);
  return clone(owner);
}

export async function rotateGuestOwnerAfterPromotion(database, { uuid, now }) {
  const state = await readIdentityState(database);
  const installationId = state.identity?.value?.installationId
    || state.legacyGuest?.value?.slice(6)
    || String(uuid).toLowerCase();
  const guestOwner = createGuestOwner({ uuid, now });
  const timestamp = String(now);
  const transaction = database.transaction(["meta", "owners"], "readwrite");
  transaction.objectStore("owners").add(guestOwner);
  transaction.objectStore("meta").put({
    key: INSTALLATION_IDENTITY_META_KEY,
    value: { installationId, guestOwnerId: guestOwner.id },
    updatedAt: timestamp,
  });
  transaction.objectStore("meta").put({
    key: LEGACY_GUEST_OWNER_META_KEY,
    value: guestOwner.id,
    updatedAt: timestamp,
  });
  transaction.objectStore("meta").put({
    key: ACTIVE_OWNER_META_KEY,
    value: guestOwner.id,
    updatedAt: timestamp,
  });
  await transactionDone(transaction);
  return clone(guestOwner);
}

export async function readOwnerPromotionBundle(database, guestOwnerId) {
  const ownerId = requireOwnerId(guestOwnerId);
  if (!ownerId.startsWith("guest:")) fail("PROMOTION_INPUT_INVALID", "A Guest owner is required");
  const stores = [
    "owners",
    "anime_refs",
    "private_titles",
    "memory_cards",
    "visual_assets",
    "media_operations",
    "memory_boards",
    "memory_board_cards",
  ];
  const transaction = database.transaction(stores, "readonly");
  const [owner, animeRefs, privateTitles, cards, visualAssets, mediaOperations, boards, boardCards] = await Promise.all([
    requestResult(transaction.objectStore("owners").get(ownerId)),
    requestResult(transaction.objectStore("anime_refs").getAll()),
    requestResult(transaction.objectStore("private_titles").getAll()),
    requestResult(transaction.objectStore("memory_cards").getAll()),
    requestResult(transaction.objectStore("visual_assets").getAll()),
    requestResult(transaction.objectStore("media_operations").getAll()),
    requestResult(transaction.objectStore("memory_boards").getAll()),
    requestResult(transaction.objectStore("memory_board_cards").getAll()),
  ]);
  await transactionDone(transaction);
  if (!owner || owner.kind !== "GUEST") return null;
  const ownedCards = (cards || []).filter((row) => row.ownerId === ownerId);
  const animeRefIds = new Set(ownedCards.flatMap((row) => row.animeRefId ? [row.animeRefId] : []));
  return clone({
    owner,
    animeRefs: (animeRefs || []).filter((row) => animeRefIds.has(row.id)),
    privateTitles: (privateTitles || []).filter((row) => row.ownerId === ownerId),
    cards: ownedCards,
    visualAssets: (visualAssets || []).filter((row) => row.ownerId === ownerId),
    mediaOperations: (mediaOperations || []).filter((row) => row.ownerId === ownerId),
    boards: (boards || []).filter((row) => row.ownerId === ownerId),
    boardCards: (boardCards || []).filter((row) => row.ownerId === ownerId),
  });
}

export async function resolvePromotionTitleChoice(database, {
  guestOwnerId,
  animeRefId,
  choice,
  now,
}) {
  const ownerId = requireOwnerId(guestOwnerId);
  const referenceId = requireUuid(animeRefId, "animeRefId");
  const transaction = database.transaction(
    ["owners", "anime_refs", "private_titles", "memory_cards"],
    "readwrite",
  );
  const owners = transaction.objectStore("owners");
  const animeRefs = transaction.objectStore("anime_refs");
  const privateTitles = transaction.objectStore("private_titles");
  const cards = transaction.objectStore("memory_cards");
  const [owner, animeRef, allCards] = await Promise.all([
    requestResult(owners.get(ownerId)),
    requestResult(animeRefs.get(referenceId)),
    requestResult(cards.getAll()),
  ]);
  const referencedCards = (allCards || []).filter((card) => (
    card.ownerId === ownerId && card.animeRefId === referenceId
  ));
  if (!owner || owner.kind !== "GUEST" || !animeRef || referencedCards.length < 1) {
    fail("PROMOTION_TITLE_NOT_FOUND", "Guest AnimeRef was not found", transaction);
  }

  const timestamp = String(now);
  if (choice?.kind === "CATALOG" && CATALOG_ID.test(String(choice.catalogAnimeId || ""))) {
    const updated = { ...animeRef, catalogAnimeId: String(choice.catalogAnimeId).toLowerCase(), updatedAt: timestamp };
    animeRefs.put(updated);
    await transactionDone(transaction);
    return clone({ kind: "CATALOG", animeRef: updated, changedCardCount: 0 });
  }
  if (choice?.kind !== "KEEP_PRIVATE") {
    fail("PROMOTION_TITLE_CHOICE_INVALID", "Promotion title choice is invalid", transaction);
  }
  const title = createPrivateTitle({
    id: animeRef.id,
    ownerId,
    displayTitle: animeRef.displayTitle,
    optionalGenres: animeRef.genres || [],
    now: timestamp,
  });
  const existingTitle = await requestResult(privateTitles.get(title.id));
  if (existingTitle && existingTitle.ownerId !== ownerId) {
    fail("CROSS_OWNER_REFERENCE", "PrivateTitle belongs to another owner", transaction);
  }
  privateTitles.put(existingTitle || title);
  for (const card of referencedCards) {
    cards.put({
      ...card,
      animeRefId: null,
      privateTitleId: title.id,
      updatedAt: timestamp,
      sync: {
        ...(card.sync || createDefaultSyncEnvelope(timestamp)),
        syncState: "LOCAL_ONLY",
        clientUpdatedAt: timestamp,
      },
    });
  }
  await transactionDone(transaction);
  return clone({ kind: "KEEP_PRIVATE", privateTitle: existingTitle || title, changedCardCount: referencedCards.length });
}

export async function beginPromotionJournal(database, input) {
  const operationId = requireUuid(input?.operationId, "operationId");
  const userId = requireUuid(input?.userId, "userId");
  const deviceId = requireUuid(input?.deviceId, "deviceId");
  const guestOwnerId = requireOwnerId(input?.guestOwnerId);
  const accountOwnerId = requireOwnerId(input?.accountOwnerId);
  const sourceHash = String(input?.sourceHash || "");
  if (accountOwnerId !== `account:${userId}` || !guestOwnerId.startsWith("guest:") || !HASH.test(sourceHash)) {
    fail("PROMOTION_JOURNAL_INVALID", "Promotion journal identity is invalid");
  }
  const transaction = database.transaction(["owners", "account_promotions"], "readwrite");
  const owners = transaction.objectStore("owners");
  const promotions = transaction.objectStore("account_promotions");
  const [accountOwner, guestOwner, byOperation, byGuest] = await Promise.all([
    requestResult(owners.get(accountOwnerId)),
    requestResult(owners.get(guestOwnerId)),
    requestResult(promotions.get(operationId)),
    requestResult(promotions.index("owner_guest").get([accountOwnerId, guestOwnerId])),
  ]);
  if (accountOwner?.kind !== "ACCOUNT" || accountOwner.userId !== userId || guestOwner?.kind !== "GUEST") {
    fail("PROMOTION_OWNER_NOT_FOUND", "Promotion owners were not found", transaction);
  }
  const existing = byOperation || byGuest;
  if (existing) {
    if (existing.sourceHash !== sourceHash || existing.accountOwnerId !== accountOwnerId
      || existing.guestOwnerId !== guestOwnerId || existing.userId !== userId) {
      fail("PROMOTION_SOURCE_HASH_MISMATCH", "Guest data changed after promotion started", transaction);
    }
    await transactionDone(transaction);
    return clone(existing);
  }
  const journal = {
    operationId,
    ownerId: accountOwnerId,
    accountOwnerId,
    userId,
    guestOwnerId,
    deviceId,
    sourceHash,
    status: "STARTED",
    remoteResult: null,
    startedAt: String(input.startedAt),
    updatedAt: String(input.startedAt),
    completedAt: null,
  };
  promotions.add(journal);
  await transactionDone(transaction);
  return clone(journal);
}

export async function markPromotionRemoteCompleted(database, { operationId, sourceHash, result, now }) {
  const id = requireUuid(operationId, "operationId");
  const transaction = database.transaction("account_promotions", "readwrite");
  const promotions = transaction.objectStore("account_promotions");
  const journal = await requestResult(promotions.get(id));
  if (!journal || journal.sourceHash !== sourceHash || !["STARTED", "REMOTE_COMPLETED"].includes(journal.status)) {
    fail("PROMOTION_JOURNAL_INVALID", "Promotion journal cannot accept a remote result", transaction);
  }
  promotions.put({
    ...journal,
    status: "REMOTE_COMPLETED",
    remoteResult: clone(result),
    updatedAt: String(now),
  });
  await transactionDone(transaction);
}

export async function listRecoverablePromotions(database, accountOwnerId) {
  const ownerId = requireOwnerId(accountOwnerId);
  if (!ownerId.startsWith("account:")) return [];
  const transaction = database.transaction("account_promotions", "readonly");
  const rows = await requestResult(transaction.objectStore("account_promotions").getAll());
  await transactionDone(transaction);
  return clone((rows || [])
    .filter((row) => row.accountOwnerId === ownerId && row.status === "REMOTE_COMPLETED")
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt)));
}

const promotedSync = (row, operationId, now) => ({
  ...(row.sync || createDefaultSyncEnvelope(now)),
  remoteVersion: Math.max(1, Number(row.sync?.remoteVersion || 0)),
  syncState: "SYNCED",
  clientUpdatedAt: String(row.updatedAt || now),
  lastOperationId: operationId,
});

export async function commitPromotionToAccount(database, input) {
  const operationId = requireUuid(input?.operationId, "operationId");
  const userId = requireUuid(input?.userId, "userId");
  const newGuestUuid = requireUuid(input?.newGuestUuid, "newGuestUuid");
  const guestOwnerId = requireOwnerId(input?.guestOwnerId);
  const accountOwnerId = requireOwnerId(input?.accountOwnerId);
  const result = input?.result;
  if (accountOwnerId !== `account:${userId}` || result?.status !== "COMPLETED") {
    fail("PROMOTION_JOURNAL_INVALID", "Promotion commit input is invalid");
  }
  const storeNames = [
    "owners",
    "meta",
    "account_promotions",
    "device_sync_state",
    ...OWNER_SCOPED_PROMOTION_STORES,
  ];
  const transaction = database.transaction([...new Set(storeNames)], "readwrite");
  const owners = transaction.objectStore("owners");
  const meta = transaction.objectStore("meta");
  const promotions = transaction.objectStore("account_promotions");
  const deviceStates = transaction.objectStore("device_sync_state");
  const [journal, accountOwner, guestOwner, identity, deviceState, scopedRows] = await Promise.all([
    requestResult(promotions.get(operationId)),
    requestResult(owners.get(accountOwnerId)),
    requestResult(owners.get(guestOwnerId)),
    requestResult(meta.get(INSTALLATION_IDENTITY_META_KEY)),
    requestResult(deviceStates.get(accountOwnerId)),
    Promise.all(OWNER_SCOPED_PROMOTION_STORES.map(async (storeName) => ({
      storeName,
      rows: await requestResult(transaction.objectStore(storeName).getAll()),
    }))),
  ]);
  if (journal?.status === "COMPLETED") {
    await transactionDone(transaction);
    return clone({ accountOwnerId, guestOwnerId: identity?.value?.guestOwnerId || null });
  }
  if (!journal || journal.status !== "REMOTE_COMPLETED" || journal.sourceHash !== input.sourceHash
    || journal.accountOwnerId !== accountOwnerId || journal.guestOwnerId !== guestOwnerId
    || accountOwner?.kind !== "ACCOUNT" || accountOwner.userId !== userId || guestOwner?.kind !== "GUEST"
    || !deviceState || deviceState.deviceId !== input.deviceId) {
    fail("PROMOTION_JOURNAL_INVALID", "Promotion local commit precondition failed", transaction);
  }

  const timestamp = String(input.now);
  for (const { storeName, rows } of scopedRows) {
    const store = transaction.objectStore(storeName);
    for (const row of (rows || []).filter((candidate) => candidate.ownerId === guestOwnerId)) {
      store.put({
        ...row,
        ownerId: accountOwnerId,
        ...(SYNCED_ENTITY_STORES.has(storeName)
          ? { sync: promotedSync(row, operationId, timestamp) }
          : {}),
      });
    }
  }

  const newGuestOwner = createGuestOwner({ uuid: newGuestUuid, now: timestamp });
  owners.add(newGuestOwner);
  const installationId = identity?.value?.installationId || guestOwnerId.slice(6);
  meta.put({
    key: INSTALLATION_IDENTITY_META_KEY,
    value: { installationId, guestOwnerId: newGuestOwner.id },
    updatedAt: timestamp,
  });
  meta.put({ key: LEGACY_GUEST_OWNER_META_KEY, value: newGuestOwner.id, updatedAt: timestamp });
  meta.put({ key: ACTIVE_OWNER_META_KEY, value: accountOwnerId, updatedAt: timestamp });
  deviceStates.put({ ...deviceState, lastSyncSeq: Number(result.nextSyncSeq), updatedAt: timestamp });
  promotions.put({
    ...journal,
    status: "COMPLETED",
    remoteResult: clone(result),
    updatedAt: timestamp,
    completedAt: timestamp,
    replacementGuestOwnerId: newGuestOwner.id,
  });
  await transactionDone(transaction);
  return clone({ accountOwnerId, guestOwnerId: newGuestOwner.id });
}
