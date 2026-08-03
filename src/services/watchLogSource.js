function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeByIdPreferLocal(idbRows, localRows) {
  const rowsById = new Map();
  for (const row of [...toArray(idbRows), ...toArray(localRows)]) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    rowsById.set(id, row);
  }
  return [...rowsById.values()];
}

export async function loadAuthoritativeWatchLogSnapshot({
  hasLocalSnapshot,
  readLocalSnapshot,
  readAllIdbSnapshot,
  writeLocalSnapshot,
}) {
  if (hasLocalSnapshot()) return toArray(readLocalSnapshot());

  const idbRows = toArray(await readAllIdbSnapshot());
  if (hasLocalSnapshot()) {
    const merged = mergeByIdPreferLocal(idbRows, readLocalSnapshot());
    if (merged.length > 0) writeLocalSnapshot(merged);
    return merged;
  }

  if (idbRows.length > 0) writeLocalSnapshot(idbRows);
  return idbRows;
}
