import { MemoryApplicationError } from "./createMemoryCard.js";
import { toRemoteMemoryCard } from "../sync/memorySyncContract.js";
import { prepareAccountSyncOperations } from "./prepareAccountSyncOperations.js";

const normalizeNote = (value) => {
  const note = String(value || "").trim();
  if (note.length > 500) {
    throw new MemoryApplicationError("NOTE_TOO_LONG", "Note must be 500 characters or fewer");
  }
  return note || null;
};

export function createUpdateMemoryCardCommand({ repository, telemetry, clock, ids }) {
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
      const now = String(clock.now());
      const candidate = { ...bundle.card, note: normalizedNote, updatedAt: now };
      const syncOperations = await prepareAccountSyncOperations({
        repository,
        ownerId,
        ids,
        createdAt: now,
        specs: () => [{
          entityType: "MEMORY_CARD",
          entityId: candidate.id,
          operationType: "UPSERT",
          baseVersion: candidate.sync?.remoteVersion,
          payload: toRemoteMemoryCard({ card: candidate, title: bundle.title }),
        }],
      });
      const card = await repository.updateCardMetadata({
        ownerId,
        cardId: bundle.card.id,
        changes: { note: normalizedNote },
        now,
        syncOperations,
      });
      telemetry.track("memory_card_updated", { changedFieldCount: 1 });
      return structuredClone(card);
    },
  });
}
