import {
  MemoryDomainError,
  assertCompletePrivateCard,
  createAnimeRef,
  createPrivateTitle,
} from "../domain/memoryDomain.js";
import { normalizeSystemDesignSpec } from "../domain/systemDesign.js";

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

export class MemoryApplicationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemoryApplicationError";
    this.code = code;
  }
}

const applicationError = (code, message) => {
  throw new MemoryApplicationError(code, message);
};

const requiredId = (value, field) => {
  const id = String(value || "").trim();
  if (!id) applicationError("INVALID_INPUT", `${field} is required`);
  return id;
};

const normalizeNote = (value) => {
  const note = String(value || "").trim();
  if (note.length > 500) applicationError("NOTE_TOO_LONG", "Note must be 500 characters or fewer");
  return note || null;
};

export const normalizeLocalMediaResult = (value) => {
  const result = value && typeof value === "object" ? value : {};
  const localRef = String(result.localRef || "");
  const checksumSha256 = String(result.checksumSha256 || "").toLowerCase();
  const mimeType = String(result.mimeType || "").toLowerCase();
  const byteSize = Number(result.byteSize);
  const width = Number(result.width);
  const height = Number(result.height);

  if (!/^asset:[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(localRef)) {
    applicationError("MEDIA_RESULT_INVALID", "Media adapter returned an invalid local reference");
  }
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) {
    applicationError("MEDIA_RESULT_INVALID", "Media adapter returned an invalid checksum");
  }
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(mimeType)) {
    applicationError("MEDIA_RESULT_INVALID", "Media adapter returned an unsupported MIME type");
  }
  if (![byteSize, width, height].every(Number.isSafeInteger) || byteSize < 1 || width < 1 || height < 1) {
    applicationError("MEDIA_RESULT_INVALID", "Media adapter returned invalid dimensions");
  }

  return { localRef, checksumSha256, mimeType, byteSize, width, height };
};

const milestoneEvent = (completeCountBeforeSave) => ({
  0: "first_memory_card_saved",
  1: "second_memory_card_saved",
  2: "third_memory_card_saved",
})[completeCountBeforeSave] || "memory_card_saved";

const asTypedMediaError = (error) => {
  const code = SAFE_ERROR_CODE.test(String(error?.code || ""))
    ? String(error.code)
    : "MEDIA_PROMOTION_FAILED";
  return new MemoryApplicationError(code, "The image could not be stored on this device");
};

/**
 * Creates the first-slice private Card command without importing browser or native APIs.
 * All persistence and file effects cross injected ports.
 */
export function createMemoryCardCommand({ repository, localMedia, telemetry, clock, ids }) {
  if (!repository || !localMedia || !telemetry || !clock || !ids) {
    throw new TypeError("Memory Card command dependencies are required");
  }

  return Object.freeze({
    async execute(rawInput) {
      const input = rawInput && typeof rawInput === "object" ? rawInput : {};
      const operationId = requiredId(input.operationId, "operationId");
      const ownerId = requiredId(input.ownerId, "ownerId");
      const hasNativeTicket = Boolean(String(input.intakeTicketId || "").trim());
      const hasSystemDesign = Boolean(input.systemDesignSpec);
      if (hasNativeTicket === hasSystemDesign) {
        applicationError(
          "VISUAL_SOURCE_CONFLICT",
          "Choose exactly one native image ticket or system design",
        );
      }
      const intakeTicketId = hasNativeTicket
        ? requiredId(input.intakeTicketId, "intakeTicketId")
        : null;
      const designSpec = hasSystemDesign
        ? normalizeSystemDesignSpec(input.systemDesignSpec)
        : null;
      if (hasNativeTicket && input.rightsConfirmed !== true) {
        applicationError(
          "LOCAL_USE_CONFIRMATION_REQUIRED",
          "Local image use confirmation is required",
        );
      }
      const titleKind = input.titleChoice?.kind;
      if (!new Set(["PRIVATE_TITLE", "ANIME_REF"]).has(titleKind)) {
        applicationError("UNSUPPORTED_TITLE_CHOICE", "Choose a catalog result or a PrivateTitle");
      }

      const existing = await repository.getOperation(ownerId, operationId);
      if (existing?.state === "COMPLETED" && existing.result) {
        return structuredClone(existing.result);
      }
      if (existing?.state === "PLANNED" || existing?.state === "FILE_READY") {
        applicationError("OPERATION_IN_PROGRESS", "Card creation is already in progress");
      }
      if (existing?.state === "FAILED") {
        applicationError("OPERATION_RETRY_REQUIRED", "Retry this failed operation explicitly");
      }

      const now = String(clock.now());
      const cardId = requiredId(ids.next("card"), "card id");
      const assetId = requiredId(ids.next("asset"), "asset id");
      let title = null;
      let animeRef = null;
      if (titleKind === "PRIVATE_TITLE") {
        title = createPrivateTitle({
          id: requiredId(ids.next("privateTitle"), "private title id"),
          ownerId,
          displayTitle: input.titleChoice.displayTitle,
          now,
        });
      } else {
        const proposed = createAnimeRef({
          id: requiredId(ids.next("animeRef"), "anime reference id"),
          displayTitle: input.titleChoice.displayTitle,
          aliases: input.titleChoice.aliases,
          genres: input.titleChoice.genres,
          sourceBinding: input.titleChoice.sourceBinding,
          verificationState: input.titleChoice.verificationState,
          now,
        });
        const existingAnimeRef = typeof repository.findAnimeRefBySourceKey === "function"
          ? await repository.findAnimeRefBySourceKey(proposed.sourceKey)
          : null;
        const shouldUpgrade = existingAnimeRef?.verificationState === "LEGACY_UNVERIFIED"
          && proposed.verificationState === "PROVIDER_CANDIDATE";
        animeRef = existingAnimeRef
          ? (shouldUpgrade
            ? { ...proposed, id: existingAnimeRef.id, createdAt: existingAnimeRef.createdAt }
            : existingAnimeRef)
          : proposed;
      }
      const privateTitleId = title?.id || null;
      const animeRefId = animeRef?.id || null;
      const completeCountBeforeSave = await repository.countCompleteCards(ownerId);

      const card = {
        id: cardId,
        ownerId,
        animeRefId,
        privateTitleId,
        visualAssetId: assetId,
        status: "DRAFT",
        note: normalizeNote(input.note),
        watchedAt: null,
        episode: null,
        sceneCue: null,
        emotionTags: [],
        rewatchIntent: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const asset = {
        id: assetId,
        ownerId,
        intakeSource: hasSystemDesign ? "SYSTEM_DESIGN" : "NATIVE_IMAGE_INTAKE",
        imageType: hasSystemDesign ? "SYSTEM_DESIGN" : "UNKNOWN",
        storageScope: "LOCAL_ONLY",
        visibility: "PRIVATE",
        rightsBasis: hasSystemDesign ? "SYSTEM_GENERATED" : "UNKNOWN",
        creatorName: null,
        sourceUrl: null,
        licenseType: null,
        permissionEvidenceRef: null,
        contentRating: "UNSPECIFIED",
        spoilerLevel: "UNSPECIFIED",
        moderationStatus: "NOT_REQUESTED_PRIVATE",
        state: "IMPORTING",
        localRef: null,
        checksumSha256: null,
        mimeType: null,
        byteSize: null,
        width: null,
        height: null,
        designSpec,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const operation = {
        id: operationId,
        ownerId,
        assetId,
        cardId,
        kind: "IMPORT",
        state: "PLANNED",
        attemptCount: 1,
        lastErrorCode: null,
        intakeTicketId,
        result: null,
        createdAt: now,
        updatedAt: now,
      };

      await repository.reserveCreate({ title, animeRef, card, asset, operation });

      let media = {};
      if (hasNativeTicket) {
        try {
          media = normalizeLocalMediaResult(await localMedia.promoteTicket({
            ticketId: intakeTicketId,
            assetId,
            operationId,
          }));
        } catch (error) {
          const typed = error instanceof MemoryApplicationError ? error : asTypedMediaError(error);
          await repository.failOperation({
            ownerId,
            operationId,
            errorCode: typed.code,
            now: String(clock.now()),
          });
          throw typed;
        }
      }

      const completedAt = String(clock.now());
      const completeAsset = { ...asset, ...media, state: "READY", updatedAt: completedAt };
      const completeCard = { ...card, status: "COMPLETE_PRIVATE", updatedAt: completedAt };
      const result = {
        operationId,
        cardId,
        visualAssetId: assetId,
        ...(title ? { privateTitleId } : { animeRefId }),
      };
      const completeOperation = {
        ...operation,
        state: "COMPLETED",
        intakeTicketId: null,
        result,
        updatedAt: completedAt,
      };

      assertCompletePrivateCard({ card: completeCard, title, animeRef, asset: completeAsset });
      await repository.completeCreate({
        title,
        animeRef,
        card: completeCard,
        asset: completeAsset,
        operation: completeOperation,
      });

      if (hasSystemDesign) {
        telemetry.track("system_design_selected", { templateId: designSpec.templateId });
      }
      telemetry.track(milestoneEvent(completeCountBeforeSave), {
        storageScope: "LOCAL_ONLY",
        titleKind,
      });
      return structuredClone(result);
    },
  });
}

export { MemoryDomainError };
