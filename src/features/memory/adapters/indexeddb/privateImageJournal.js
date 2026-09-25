// Separate additive store. Retry bytes are private and keyed by the original owner, never the active account alone.
export function createPrivateImageJournal(indexedDB = globalThis.indexedDB) {
  const run = (mode, action) => new Promise((resolve, reject) => {
    const open = indexedDB.open('moemoa-private-image-operations-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('operations', { keyPath: 'key' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('operations', mode); let result;
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(Object.assign(new Error('MEDIA_STORAGE_FAILED'), { code: 'MEDIA_STORAGE_FULL' })); };
      action(tx.objectStore('operations'), value => { result = value; });
    };
  });
  return {
    get: key => run('readonly', (store, done) => { store.get(key).onsuccess = e => done(e.target.result || null); }),
    putIfAbsent: value => run('readwrite', (store, done) => {
      store.get(value.key).onsuccess = e => {
        if (e.target.result) done(e.target.result);
        else { store.add(value); done(value); }
      };
    }),
    remove: (key, operationId) => run('readwrite', (store, done) => {
      store.get(key).onsuccess = e => {
        if (e.target.result?.operationId === operationId) store.delete(key);
        done(true);
      };
    }),
    removeAsset: assetId => run('readwrite', (store, done) => {
      store.openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { done(true); return; }
        if (cursor.value.assetId === assetId) cursor.delete();
        cursor.continue();
      };
    }),
  };
}
