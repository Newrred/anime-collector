import { BACKUP_STORES, createMemoryBackup, prepareMemoryRestore } from "../../application/memoryBackup.js";

const result = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error("Backup transaction aborted")); tx.onerror = () => reject(tx.error);
});

export async function exportMemoryMetadata(database, ownerId, now) {
  const tx = database.transaction(BACKUP_STORES, "readonly");
  const completion = done(tx);
  const rows = Object.fromEntries(await Promise.all(BACKUP_STORES.map(async (key) => [key, await result(tx.objectStore(key).getAll())])));
  await completion;
  return createMemoryBackup(rows, ownerId, now);
}

export async function restoreMemoryMetadata(database, ownerId, snapshot) {
  const rows = prepareMemoryRestore(snapshot, ownerId);
  const tx = database.transaction([...BACKUP_STORES, "owners", "meta"], "readwrite");
  const completion = done(tx);
  try {
    const [owner, cards, boards, active] = await Promise.all([
      result(tx.objectStore("owners").get(ownerId)), result(tx.objectStore("memory_cards").getAll()),
      result(tx.objectStore("memory_boards").getAll()), result(tx.objectStore("meta").get("activeOwnerId")),
    ]);
    if (!owner || (active?.value && active.value !== ownerId)) throw new Error("OWNER_CHANGED");
    if ([...cards, ...boards].some((r) => r.ownerId === ownerId)) throw Object.assign(new Error("Restore requires an empty Memory archive"), {code: "BACKUP_REQUIRES_EMPTY_ARCHIVE"});
    for (const key of BACKUP_STORES) for (const row of rows[key]) tx.objectStore(key).add(row);
    await completion;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted by IndexedDB. */ }
    await completion.catch(() => {});
    throw error;
  }
  return { cards: rows.memory_cards.length, boards: rows.memory_boards.length };
}
