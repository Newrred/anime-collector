const keyFor = owner => `moemoa:bookshelf:v1:${encodeURIComponent(owner)}`;
export function normalizeBookshelf(value) {
  const seen = new Set();
  if (value?.layoutVersion !== undefined && (!Array.isArray(value.shelves) || value.shelves.length > 20)) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
  const normalized = { shelves: (Array.isArray(value?.shelves) ? value.shelves : []).slice(0, 20).filter(row => {
    if (typeof row?.id !== "string" || !row.id || row.id === "all" || row.id.length > 80 || seen.has(row.id)) return false;
    seen.add(row.id); return true;
  }).map(row => ({
    id: row.id, name: String(row.name || "").trim().slice(0, 80),
    titleKeys: [...new Set((Array.isArray(row.titleKeys) ? row.titleKeys : []).filter(key => typeof key === "string" && key.length > 0 && key.length <= 120))].slice(0, 300),
  })).filter(row => row.name) };
  if (value?.layoutVersion !== undefined) {
    if (value.layoutVersion !== 1 || !Array.isArray(value.sections) || value.sections.length > 40) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
    const sectionIds = new Set();
    normalized.layoutVersion = 1;
    normalized.sections = value.sections.map(section => {
      if (!["TITLE_SHELF", "MEMORY_BOARD"].includes(section?.kind) || typeof section.sourceId !== "string" || !section.sourceId || section.sourceId.length > 80) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
      const id = `${section.kind}:${section.sourceId}`;
      if (sectionIds.has(id)) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
      sectionIds.add(id);
      return { kind: section.kind, sourceId: section.sourceId };
    }).filter(section => section.kind !== "TITLE_SHELF" || normalized.shelves.some(s => s.id === section.sourceId));
    for (const shelf of normalized.shelves) if (!normalized.sections.some(s => s.kind === "TITLE_SHELF" && s.sourceId === shelf.id)) normalized.sections.push({ kind: "TITLE_SHELF", sourceId: shelf.id });
    if (normalized.sections.length > 40) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
  }
  return normalized;
}
export function readBookshelf(owner, storage = globalThis.localStorage) {
  try { return normalizeBookshelf(JSON.parse(storage.getItem(keyFor(owner)) || "null")); } catch { return { shelves: [], loadError: "COLLECTION_READ_FAILED" }; }
}
export function saveBookshelf(owner, value, storage = globalThis.localStorage, { source = "local" } = {}) {
  if (!owner) throw new Error("BOOKSHELF_OWNER_REQUIRED");
  const current = typeof storage.getItem === "function" ? readBookshelf(owner, storage) : { shelves: [] };
  if (current.loadError || (current.layoutVersion && value.layoutVersion !== current.layoutVersion)) throw new Error("COLLECTION_LAYOUT_UNSUPPORTED");
  const normalized = normalizeBookshelf(value); storage.setItem(keyFor(owner), JSON.stringify(normalized));
  if (storage === globalThis.localStorage) globalThis.dispatchEvent?.(new CustomEvent("moemoa:bookshelf-updated", { detail: { source } }));
  return normalized;
}
