const KEY_PREFIX = "moemoa:titles:first-memory-view:v1:";

// Device-local presentation state only; never part of Memory or account sync data.
export function recordFirstMemoryViewSuggestion({ cardId, archive }, storage) {
  try {
    const card = archive?.length === 1 ? archive[0]?.card : null;
    if (!card?.ownerId || card.id !== cardId || card.status !== "COMPLETE_PRIVATE") return false;
    const target = storage || globalThis.localStorage;
    const key = `${KEY_PREFIX}${card.ownerId}`;
    if (target.getItem(key) !== null) return false;
    target.setItem(key, JSON.stringify({ cardId }));
    return true;
  } catch {
    return false;
  }
}

export function consumeFirstMemoryViewSuggestion(archive, storage) {
  try {
    const ownerId = archive?.[0]?.card?.ownerId;
    if (!ownerId) return false;
    const target = storage || globalThis.localStorage;
    const key = `${KEY_PREFIX}${ownerId}`;
    const pending = JSON.parse(target.getItem(key) || "null");
    if (!pending?.cardId || !archive.some(({ card }) => (
      card.ownerId === ownerId && card.id === pending.cardId && card.status === "COMPLETE_PRIVATE"
    ))) return false;
    target.setItem(key, JSON.stringify({ seen: true }));
    return true;
  } catch {
    return false;
  }
}
