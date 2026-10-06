import { assertCatalogCoverPersonalSignal } from "../domain/memoryDomain.js";
import { MemoryApplicationError } from "./createMemoryCard.js";
import { toRemoteMemoryCard } from "../sync/memorySyncContract.js";
import { prepareAccountSyncOperations } from "./prepareAccountSyncOperations.js";
import { classificationSyncEnabled, normalizeCardClassification } from "../domain/cardClassification.js";

const normalizeNote = (value) => {
  const note = String(value || "").trim();
  if (note.length > 500) {
    throw new MemoryApplicationError("NOTE_TOO_LONG", "Note must be 500 characters or fewer");
  }
  return note || null;
};

export function createUpdateMemoryCardCommand({ repository, telemetry, clock, ids, classificationSync = classificationSyncEnabled() }) {
  return Object.freeze({
    async execute({ ownerId, cardId, ...updates }) {
      const bundle = await repository.getCardBundle(String(ownerId || ""), String(cardId || ""));
      if (
        !bundle ||
        bundle.card.ownerId !== ownerId ||
        bundle.card.status !== "COMPLETE_PRIVATE"
      ) {
        throw new MemoryApplicationError("CARD_NOT_FOUND", "Private Card was not found");
      }

      const changes = {};
      if (Object.hasOwn(updates, "note")) {
        const note = normalizeNote(updates.note);
        if (note !== bundle.card.note) changes.note = note;
      }
      if (Object.hasOwn(updates, "classification")) {
        const classification = normalizeCardClassification(updates.classification);
        if (JSON.stringify(classification) !== JSON.stringify(normalizeCardClassification(bundle.card.classification)) || (classificationSync && bundle.card.classificationPending)) changes.classification = classification;
      }
      if (!Object.keys(changes).length) return structuredClone(bundle.card);
      const now = String(clock.now());
      const candidate = { ...bundle.card, ...changes, updatedAt: now };
      assertCatalogCoverPersonalSignal(candidate, bundle.asset);
      const syncOperations = (Object.hasOwn(changes, "note") || classificationSync) ? await prepareAccountSyncOperations({
        repository,
        ownerId,
        ids,
        createdAt: now,
        specs: () => [{
          entityType: "MEMORY_CARD",
          entityId: candidate.id,
          operationType: "UPSERT",
          baseVersion: candidate.sync?.remoteVersion,
          payload: toRemoteMemoryCard({ card: candidate, title: bundle.title }, { includeClassification: classificationSync }),
        }],
      }) : [];
      const card = await repository.updateCardMetadata({
        ownerId,
        cardId: bundle.card.id,
        changes: { ...changes, ...(Object.hasOwn(changes, "classification") ? { classificationPending: !classificationSync } : {}) },
        now,
        syncOperations,
      });
      telemetry.track("memory_card_updated", { changedFieldCount: Object.keys(changes).length });
      return structuredClone(card);
    },
  });
}
