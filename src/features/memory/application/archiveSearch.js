const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
export function filterArchive(items, query, sort) {
  const field = sort === "updated" ? "updatedAt" : "createdAt";
  const term = normalize(query);
  return items.filter((item) => normalize(`${item.title.displayTitle} ${item.card.note || ""}`).includes(term))
    .sort((a, b) => String(b.card[field] || "").localeCompare(String(a.card[field] || "")) || a.card.id.localeCompare(b.card.id));
}
