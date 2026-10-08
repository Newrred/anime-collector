const accountOwner = userId => `account:${userId}`;
const SAFE_FAILURE_CODES = new Set([
  "AUTH_REQUIRED", "ACCOUNT_INITIALIZATION_FAILED", "ACCOUNT_SYNC_UNAVAILABLE",
  "SYNC_ABORTED", "SYNC_PAUSED", "SYNC_RATE_LIMITED", "SYNC_QUOTA_EXCEEDED",
  "SYNC_SERVER_SCHEMA_UNAVAILABLE", "SYNC_RESPONSE_INVALID", "SYNC_REQUEST_INVALID",
  "SYNC_OWNER_CHANGED", "DEVICE_NOT_REGISTERED", "DEVICE_SYNC_STATE_INVALID",
  "MEMORY_GATEWAY_FAILED", "PHOTO_METADATA_PENDING", "MEDIA_STORAGE_FULL",
  "PRIVATE_IMAGE_REQUEST_FAILED", "PRIVATE_IMAGE_DISABLED", "PRIVATE_IMAGE_PAUSED",
  "PRIVATE_IMAGE_POLICY_STALE", "PRIVATE_IMAGE_QUOTA_EXCEEDED",
  "PRIVATE_IMAGE_CAPACITY_EXCEEDED", "PRIVATE_IMAGE_RATE_LIMITED", "IMAGE_SIZE_LIMIT",
  "ORIGINAL_IMAGE_UNAVAILABLE", "SOURCE_IMAGE_MISMATCH", "PRIVATE_IMAGE_SOURCE_CHANGED",
]);
const safeFailureCode = (value, fallback) => SAFE_FAILURE_CODES.has(value) ? value : fallback;

export async function saveNewMemoryToAccount({
  cardId,
  userId,
  runtime,
  includePhoto = false,
  photoEnabled = false,
  getSession,
  getAccountRuntime,
  createPhotoTransfer,
  isPrivateImage,
  saveQueuedPhoto,
  isOnline = () => globalThis.navigator?.onLine !== false,
}) {
  if (!userId) return { status: "LOCAL_ONLY" };
  if (!isOnline()) return { status: "PENDING", stage: "metadata", reason: "OFFLINE" };

  let stage = "account";
  try {
    const session = await getSession();
    if (session?.user?.id !== userId) return { status: "PENDING", stage: "account", reason: "AUTH_SESSION_MISMATCH" };
    const bundle = await runtime.getCard(cardId);
    if (bundle?.card?.ownerId !== accountOwner(userId)) return { status: "PENDING", stage: "account", reason: "CARD_OWNER_MISMATCH" };

    const account = await getAccountRuntime();
    const ready = await account.initializeAccountSession(session);
    if (ready?.userId !== userId || !["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(ready.status)) {
      return { status: "PENDING", stage: "account", reason: "ACCOUNT_NOT_READY" };
    }
    stage = "metadata";
    const synced = await account.syncNow();
    // The batch can report a problem in another Card after this one succeeded, or
    // can finish before this Card was added. Trust only this Card and its asset.
    const syncedBundle = await runtime.getCard(cardId);
    if (syncedBundle?.card?.ownerId !== accountOwner(userId)
      || syncedBundle.card.sync?.syncState !== "SYNCED"
      || syncedBundle.asset?.sync?.syncState !== "SYNCED") {
      return {
        status: "PENDING", stage: "metadata",
        reason: safeFailureCode(synced?.syncErrorCode, ({
          CONFLICT: "SYNC_CONFLICT", REJECTED: "SYNC_REJECTED",
          PARTIAL: "SYNC_PARTIAL", ERROR: "ACCOUNT_SAVE_FAILED",
        })[synced?.syncResultCode] || "CARD_NOT_CONFIRMED"),
      };
    }

    if (!includePhoto) return { status: "SYNCED" };
    stage = "photo";
    if (!photoEnabled) return { status: "PENDING", stage: "photo", reason: "PHOTO_UNAVAILABLE" };
    if (saveQueuedPhoto) {
      const result = await saveQueuedPhoto(cardId);
      return result?.pending
        ? { status: "PENDING", stage: "photo", reason: safeFailureCode(result.reason, "PHOTO_TRANSFER_PENDING") }
        : { status: "SYNCED" };
    }
    if (!isPrivateImage(syncedBundle.asset)
      || !(syncedBundle.asset.sync.remoteVersion > 0)) {
      return { status: "PENDING", stage: "photo", reason: "PHOTO_METADATA_PENDING" };
    }
    await createPhotoTransfer(runtime, syncedBundle).upload({ consented: true });
    return { status: "SYNCED" };
  } catch (error) {
    // The local Card and its original image are already durable. Never retry creation here.
    return { status: "PENDING", stage, reason: safeFailureCode(error?.code, "ACCOUNT_SAVE_FAILED") };
  }
}
