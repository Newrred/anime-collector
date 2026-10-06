const keyFor = owner => `moemoa:bookshelf:v1:${encodeURIComponent(owner)}`;
export function normalizeBookshelf(value) {
  const seen = new Set();
  return { shelves: (Array.isArray(value?.shelves) ? value.shelves : []).slice(0, 20).filter(row => {
    if (typeof row?.id !== "string" || !row.id || row.id === "all" || row.id.length > 80 || seen.has(row.id)) return false;
    seen.add(row.id); return true;
  }).map(row => ({
    id: row.id, name: String(row.name || "").trim().slice(0, 80),
    titleKeys: [...new Set((Array.isArray(row.titleKeys) ? row.titleKeys : []).filter(key => typeof key === "string" && key.length > 0 && key.length <= 120))].slice(0, 300),
  })).filter(row => row.name) };
}
export function readBookshelf(owner, storage = globalThis.localStorage) {
  try { return normalizeBookshelf(JSON.parse(storage.getItem(keyFor(owner)) || "null")); } catch { return { shelves: [] }; }
}
export function saveBookshelf(owner, value, storage = globalThis.localStorage) {
  if (!owner) throw new Error("BOOKSHELF_OWNER_REQUIRED");
  const normalized = normalizeBookshelf(value); storage.setItem(keyFor(owner), JSON.stringify(normalized)); return normalized;
}
