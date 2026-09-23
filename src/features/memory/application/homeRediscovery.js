const DAY = 86400000;
const stamp = (value) => Date.parse(String(value || ""));
const titleKey = (bundle) => bundle.card.privateTitleId
  ? `private:${bundle.card.privateTitleId}`
  : `anime:${bundle.title.catalogAnimeId || bundle.card.animeRefId}`;

// A read model only: never interprets edits as viewing dates or creates new cards.
export function selectHomeRediscovery(archive, now = Date.now()) {
  const cards = [...new Map(archive.filter((b) => b?.card?.status === "COMPLETE_PRIVATE" && !b.card.deletedAt)
    .map((b) => [b.card.id, b])).values()]
    .sort((a, b) => (stamp(b.card.createdAt) || 0) - (stamp(a.card.createdAt) || 0) || a.card.id.localeCompare(b.card.id));
  const recent = cards.slice(0, 3);
  const used = new Set(recent.map((b) => b.card.id));
  const eligible = cards.filter((b) => !used.has(b.card.id) && Number.isFinite(stamp(b.card.createdAt)) && now - stamp(b.card.createdAt) >= 30 * DAY);
  const day = Math.floor(now / DAY);
  const past = eligible.length ? [eligible[day % eligible.length]] : [];
  past.forEach((b) => used.add(b.card.id));
  const groups = new Map();
  for (const b of cards.filter((b) => !used.has(b.card.id))) {
    const key = titleKey(b);
    groups.set(key, [...(groups.get(key) || []), b]);
  }
  let sameTitle = [];
  for (const group of groups.values()) {
    const second = group.find((b) => Number.isFinite(stamp(b.card.createdAt)) && Math.abs(stamp(group[0].card.createdAt) - stamp(b.card.createdAt)) >= DAY);
    if (second) { sameTitle = [group[0], second]; break; }
  }
  sameTitle.forEach((b) => used.add(b.card.id));
  const lines = sameTitle.length ? [] : cards.filter((b) => !used.has(b.card.id) && String(b.card.note || "").trim()).slice(0, 1);
  return { recent, past, sameTitle, lines };
}
