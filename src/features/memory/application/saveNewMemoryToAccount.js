const accountOwner = userId => `account:${userId}`;

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
  if (!isOnline()) return { status: "PENDING", stage: "metadata" };

  let stage = "account";
  try {
    const session = await getSession();
    if (session?.user?.id !== userId) return { status: "PENDING", stage: "account" };
    const bundle = await runtime.getCard(cardId);
    if (bundle?.card?.ownerId !== accountOwner(userId)) return { status: "PENDING", stage: "account" };

    const account = await getAccountRuntime();
    const ready = await account.initializeAccountSession(session);
    if (ready?.userId !== userId || !["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(ready.status)) {
      return { status: "PENDING", stage: "account" };
    }
    stage = "metadata";
    const synced = await account.syncNow();
    if (synced?.syncResultCode !== "SYNCED" || synced?.syncErrorCode) {
      return { status: "PENDING", stage: "metadata" };
    }

    // Another caller may have started this sync before the new Card was written.
    // Verify this exact Card and visual asset instead of trusting the batch result.
    const syncedBundle = await runtime.getCard(cardId);
    if (syncedBundle?.card?.ownerId !== accountOwner(userId)
      || syncedBundle.card.sync?.syncState !== "SYNCED"
      || syncedBundle.asset.sync?.syncState !== "SYNCED") {
      return { status: "PENDING", stage: "metadata" };
    }

    if (!includePhoto) return { status: "SYNCED" };
    stage = "photo";
    if (!photoEnabled) return { status: "PENDING", stage: "photo" };
    if (saveQueuedPhoto) {
      const result = await saveQueuedPhoto(cardId);
      return result?.pending ? { status: "PENDING", stage: "photo" } : { status: "SYNCED" };
    }
    if (!isPrivateImage(syncedBundle.asset)
      || !(syncedBundle.asset.sync.remoteVersion > 0)) {
      return { status: "PENDING", stage: "photo" };
    }
    await createPhotoTransfer(runtime, syncedBundle).upload({ consented: true });
    return { status: "SYNCED" };
  } catch {
    // The local Card and its original image are already durable. Never retry creation here.
    return { status: "PENDING", stage };
  }
}
