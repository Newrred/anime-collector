const inFlight = new Map();
const ownerFor = userId => `account:${userId}`;

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
  for (const intent of intents.slice(0, 20)) {
    if (inFlight.has(intent.key)) {
      try { await inFlight.get(intent.key); completed++; } catch { pending++; }
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
        throw new Error("PHOTO_METADATA_PENDING");
      }
      await createPhotoTransfer(runtime, bundle).upload({ consented: true });
      await store.remove(intent.key);
    })();
    inFlight.set(intent.key, work);
    try { await work; completed++; } catch { pending++; }
    finally { if (inFlight.get(intent.key) === work) inFlight.delete(intent.key); }
  }
  return { completed, pending: pending + Math.max(0, intents.length - 20) };
}
