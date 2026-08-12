import { MemoryApplicationError } from "./createMemoryCard.js";

const normalizeNote = (value) => {
  const note = String(value || "").trim();
  if (note.length > 500) {
    throw new MemoryApplicationError("NOTE_TOO_LONG", "Note must be 500 characters or fewer");
  }
  return note || null;
};

export function createUpdateMemoryCardCommand({ repository, telemetry, clock }) {
  return Object.freeze({
    async execute({ ownerId, cardId, note }) {
      const bundle = await repository.getCardBundle(String(ownerId || ""), String(cardId || ""));
      if (
        !bundle ||
        bundle.card.ownerId !== ownerId ||
        bundle.card.status !== "COMPLETE_PRIVATE"
      ) {
        throw new MemoryApplicationError("CARD_NOT_FOUND", "Private Card was not found");
      }

      const normalizedNote = normalizeNote(note);
      if (normalizedNote === bundle.card.note) return structuredClone(bundle.card);
      const card = {
        ...bundle.card,
        note: normalizedNote,
        updatedAt: String(clock.now()),
      };
      await repository.updateCardMetadata({ ownerId, card });
      telemetry.track("memory_card_updated", { changedFieldCount: 1 });
      return structuredClone(card);
    },
  });
}
