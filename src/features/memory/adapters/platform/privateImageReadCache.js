const STORAGE_KEY = 'moemoa.private-photo-cache.v1';

// Tab-scoped bytes only; callers must revalidate server policy and hashes before display.
export function createPrivateImageReadCache({ storage = () => globalThis.sessionStorage, now = Date.now,
  maxChars = 2_000_000, ttl = 20 * 60_000 } = {}) {
  const read = () => {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      if (!raw || raw.length > maxChars) return { owner: null, entries: [] };
      const state = JSON.parse(raw);
      if (!Array.isArray(state.entries)) return { owner: null, entries: [] };
      return { owner: state.owner, entries: state.entries.filter(row => Number.isFinite(row.at)
        && now() >= row.at && now() - row.at < ttl && typeof row.data === 'string') };
    } catch { return { owner: null, entries: [] }; }
  };
  const clear = () => { try { storage().removeItem(STORAGE_KEY); } catch { /* Optional cache. */ } };
  const write = state => {
    try {
      let json = JSON.stringify(state);
      while (json.length > maxChars && state.entries.length) {
        state.entries.shift(); json = JSON.stringify(state);
      }
      storage().setItem(STORAGE_KEY, json);
    } catch { clear(); }
  };
  return {
    clear,
    setOwner(owner) {
      if (!owner) { clear(); return; }
      if (read().owner !== owner) write({ owner, entries: [] });
    },
    get(owner, key) {
      const state = read();
      if (state.owner !== owner) return null;
      const row = state.entries.find(entry => entry.key === key);
      if (!row) return null;
      try { return new Blob([Uint8Array.from(atob(row.data), char => char.charCodeAt(0))], { type: 'image/webp' }); }
      catch { return null; }
    },
    async put(owner, key, blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      // Encoding may finish after sign-out. Never recreate the old account's cache.
      const state = read();
      if (state.owner !== owner) return;
      state.entries = state.entries.filter(row => row.key !== key);
      state.entries.push({ key, at: now(), data: btoa(binary) });
      write(state);
    },
  };
}

export const privateImageReadCache = createPrivateImageReadCache();
