import { requireOwnerId } from "../domain/memoryDomain.js";
import { parsePromotionResult } from "../sync/memorySyncContract.js";
import { buildGuestPromotionManifest } from "./buildGuestPromotionManifest.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

const validateInput = (input) => {
  const userId = String(input?.userId || "").toLowerCase();
  const guestOwnerId = requireOwnerId(input?.guestOwnerId);
  const accountOwnerId = requireOwnerId(input?.accountOwnerId);
  const deviceId = String(input?.deviceId || "").toLowerCase();
  const operationId = String(input?.operationId || "").toLowerCase();
  if (!UUID_V4.test(userId) || accountOwnerId !== `account:${userId}`
    || !guestOwnerId.startsWith("guest:") || !UUID_V4.test(deviceId) || !UUID_V4.test(operationId)) {
    fail("PROMOTION_INPUT_INVALID", "Guest promotion identity is invalid");
  }
  return { userId, guestOwnerId, accountOwnerId, deviceId, operationId };
};

const sameCounts = (left, right) => Object.keys(left).every((key) => Number(left[key]) === Number(right[key]));

export function createPromoteGuestMemory({ repository, gateway, uuid, clock } = {}) {
  const required = [
    "readOwnerPromotionBundle",
    "beginPromotionJournal",
    "markPromotionRemoteCompleted",
    "listRecoverablePromotions",
    "commitPromotionToAccount",
  ];
  if (!repository || required.some((method) => typeof repository[method] !== "function")
    || typeof gateway?.promoteGuest !== "function" || typeof uuid !== "function"
    || typeof clock?.now !== "function") {
    fail("PROMOTION_RUNTIME_INVALID", "Guest promotion dependencies are incomplete");
  }

  const commitLocal = (journal) => repository.commitPromotionToAccount({
    operationId: journal.operationId,
    userId: journal.userId,
    guestOwnerId: journal.guestOwnerId,
    accountOwnerId: journal.accountOwnerId,
    deviceId: journal.deviceId,
    sourceHash: journal.sourceHash,
    result: journal.remoteResult,
    newGuestUuid: String(uuid()).toLowerCase(),
    now: String(clock.now()),
  });

  return Object.freeze({
    async execute(rawInput) {
      const input = validateInput(rawInput);
      const manifest = await buildGuestPromotionManifest({ repository, guestOwnerId: input.guestOwnerId });
      if (manifest.unresolvedAnimeRefs.length > 0) {
        fail("PROMOTION_CATALOG_MAPPING_REQUIRED", "Every AnimeRef needs an explicit promotion choice");
      }
      const journal = await repository.beginPromotionJournal({
        ...input,
        sourceHash: manifest.sourceHash,
        startedAt: String(clock.now()),
      });
      if (journal.status === "COMPLETED") return structuredClone(journal.remoteResult);
      if (journal.status === "REMOTE_COMPLETED") {
        await commitLocal(journal);
        return structuredClone(journal.remoteResult);
      }
      if (journal.status !== "STARTED") fail("PROMOTION_JOURNAL_INVALID", "Promotion journal state is invalid");

      const result = parsePromotionResult(await gateway.promoteGuest({
        operationId: journal.operationId,
        deviceId: journal.deviceId,
        guestOwnerId: journal.guestOwnerId,
        sourceHash: journal.sourceHash,
        bundle: manifest.remoteBundle,
      }));
      if (!sameCounts(manifest.counts, result.importedCounts)) {
        fail("PROMOTION_RESPONSE_INVALID", "Promotion result counts do not match the source");
      }
      const completedJournal = {
        ...journal,
        status: "REMOTE_COMPLETED",
        remoteResult: result,
      };
      await repository.markPromotionRemoteCompleted({
        operationId: journal.operationId,
        sourceHash: journal.sourceHash,
        result,
        now: String(clock.now()),
      });
      await commitLocal(completedJournal);
      return structuredClone(result);
    },

    async recoverPromotion({ accountOwnerId } = {}) {
      const ownerId = requireOwnerId(accountOwnerId);
      if (!ownerId.startsWith("account:")) fail("PROMOTION_INPUT_INVALID", "An Account owner is required");
      const journals = await repository.listRecoverablePromotions(ownerId);
      const recovered = [];
      for (const journal of journals) {
        if (journal.status !== "REMOTE_COMPLETED" || !journal.remoteResult) continue;
        await commitLocal(journal);
        recovered.push(structuredClone(journal.remoteResult));
      }
      return recovered;
    },
  });
}
