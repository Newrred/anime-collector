import {
  createAccountOwner,
  createGuestOwner,
  requireOwnerId,
} from "../../domain/memoryDomain.js";

const ACTIVE_OWNER_META_KEY = "activeOwnerId";
const INSTALLATION_IDENTITY_META_KEY = "installationIdentity";
const LEGACY_GUEST_OWNER_META_KEY = "installationGuestOwnerId";

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
