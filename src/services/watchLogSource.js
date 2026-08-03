function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function loadAuthoritativeWatchLogSnapshot({
  hasLocalSnapshot,
  readLocalSnapshot,
  readAllIdbSnapshot,
  writeLocalSnapshot,
}) {
  if (hasLocalSnapshot()) return toArray(readLocalSnapshot());

  try {
    const rows = toArray(await readAllIdbSnapshot());
    if (rows.length > 0) writeLocalSnapshot(rows);
    return rows;
  } catch {
    return toArray(readLocalSnapshot());
  }
}
