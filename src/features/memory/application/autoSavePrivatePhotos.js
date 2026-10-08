const inFlight = new Map();
const ownerFor = userId => `account:${userId}`;
const transientRequestError = error => error?.code === "PRIVATE_IMAGE_REQUEST_FAILED";
const waitBeforeRetry = () => new Promise(resolve => setTimeout(resolve, 350));
const safePendingReasons = new Set([
  "PHOTO_METADATA_PENDING", "PRIVATE_IMAGE_REQUEST_FAILED", "PRIVATE_IMAGE_DISABLED",
  "PRIVATE_IMAGE_PAUSED", "PRIVATE_IMAGE_POLICY_STALE", "PRIVATE_IMAGE_QUOTA_EXCEEDED",
  "PRIVATE_IMAGE_CAPACITY_EXCEEDED", "PRIVATE_IMAGE_RATE_LIMITED", "IMAGE_SIZE_LIMIT",
  "AUTH_REQUIRED", "ORIGINAL_IMAGE_UNAVAILABLE", "SOURCE_IMAGE_MISMATCH",
  "PRIVATE_IMAGE_SOURCE_CHANGED",
]);
const safePendingReason = error => safePendingReasons.has(error?.code) ? error.code : "PHOTO_TRANSFER_PENDING";

export async function queueNewPrivatePhoto({ runtime, userId, cardId, store, isPrivateImage }) {
  if (!userId) return null;
  const bundle = await runtime.getCard(cardId);
  if (bundle?.card?.ownerId !== ownerFor(userId) || !bundle.asset.localRef || !isPrivateImage(bundle.asset)) return null;
  const intent = {
    key: `${bundle.card.ownerId}:${bundle.asset.id}`,
    ownerId: bundle.card.ownerId,
    cardId,
    assetId: bundle.asset.id,
    createdAt: new Date().toISOString(),
  };
  await store.put(intent);
  globalThis.dispatchEvent?.(new CustomEvent("moemoa:memory-updated", { detail: { ownerId: intent.ownerId } }));
  return intent;
}

export async function drainPrivatePhotoAutoSave({
  runtime, userId, store, getSession, createPhotoTransfer, isPrivateImage, enabled, cardId = null,
}) {
  if (!enabled || !userId || globalThis.navigator?.onLine === false) return { completed: 0, pending: 0 };
  const ownerId = ownerFor(userId);
  const intents = (await store.list(ownerId)).filter(intent => !cardId || intent.cardId === cardId);
  let completed = 0;
  let pending = 0;
  let reason = null;
  for (const intent of intents.slice(0, 20)) {
    if (inFlight.has(intent.key)) {
      try { await inFlight.get(intent.key); completed++; }
      catch (error) { pending++; reason ||= safePendingReason(error); }
      continue;
    }
    const work = (async () => {
      const session = await getSession();
      if (session?.user?.id !== userId) throw new Error("AUTH_REQUIRED");
      const bundle = await runtime.getCard(intent.cardId);
      if (!bundle || bundle.card.ownerId !== ownerId || bundle.asset.id !== intent.assetId || !isPrivateImage(bundle.asset)) {
        await store.remove(intent.key);
        return;
      }
      if (bundle.asset.sync?.syncState !== "SYNCED" || !(bundle.asset.sync.remoteVersion > 0)) {
        throw Object.assign(new Error("PHOTO_METADATA_PENDING"), { code: "PHOTO_METADATA_PENDING" });
      }
      const transfer = createPhotoTransfer(runtime, bundle);
      try { await transfer.upload({ consented: true }); }
      catch (error) {
        if (!transientRequestError(error) || globalThis.navigator?.onLine === false) throw error;
        await waitBeforeRetry();
        if (globalThis.navigator?.onLine === false) throw error;
        await transfer.upload({ consented: true });
      }
      await store.remove(intent.key);
    })();
    inFlight.set(intent.key, work);
    try { await work; completed++; }
    catch (error) { pending++; reason ||= safePendingReason(error); }
    finally { if (inFlight.get(intent.key) === work) inFlight.delete(intent.key); }
  }
  const result = { completed, pending: pending + Math.max(0, intents.length - 20) };
  if (reason) result.reason = reason;
  return result;
}
