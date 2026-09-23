/** Retain the historical roster, but never expose a known stale identity as a fallback. */
export function applyReviewedAliases(rows, overrides) {
  const byId = new Map(overrides.map((row) => [String(row.anilistId), row]));
  return rows.flatMap((row) => {
    const review = byId.get(String(row.anilistId));
    if (!review) return [row];
    if (row.ko !== review.expected.ko || JSON.stringify(row.aliases) !== JSON.stringify(review.expected.aliases)) return [];
    return [{ ...row, ko: review.replacement.ko, aliases: [...review.replacement.aliases] }];
  });
}
