// Only newly chosen account photos are queued. Existing local photos are never discovered here.
export function createPrivatePhotoAutoSaveStore(indexedDB = globalThis.indexedDB) {
  const run = (mode, action) => new Promise((resolve, reject) => {
    const open = indexedDB.open("moemoa-private-photo-autosave-v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("intents", { keyPath: "key" });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("intents", mode);
      let result;
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("Private photo intent storage failed")); };
      action(tx.objectStore("intents"), value => { result = value; });
    };
  });
  return Object.freeze({
    put: intent => run("readwrite", (store, done) => { store.put(intent); done(intent); }),
    list: ownerId => run("readonly", (store, done) => {
      const rows = [];
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) { done(rows); return; }
        if (cursor.value.ownerId === ownerId) rows.push(cursor.value);
        cursor.continue();
      };
    }),
    remove: key => run("readwrite", (store, done) => { store.delete(key); done(true); }),
  });
}
