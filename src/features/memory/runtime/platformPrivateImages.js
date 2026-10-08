import { privateImageReadCache } from '../adapters/platform/privateImageReadCache.js';
import { getAuthSession } from '../../../repositories/authRepo.js';
import { createPrivateImageJournal } from '../adapters/indexeddb/privateImageJournal.js';
import { createPrivateImageTransfer } from '../application/createPrivateImageTransfer.js';
import { createPrivatePhotoAutoSaveStore } from '../adapters/indexeddb/privatePhotoAutoSaveStore.js';
import { queueNewPrivatePhoto, drainPrivatePhotoAutoSave } from '../application/autoSavePrivatePhotos.js';
import { getPlatformMemoryRuntime } from './platformMemoryRuntime.js';

export const privateImageUiEnabled = () => import.meta.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 === '1';
// Local imageType describes rights/content (initially UNKNOWN), not the server's USER_IMAGE asset_type.
export const isPrivateUserImage = asset => Boolean(asset && !['SYSTEM_DESIGN', 'CATALOG_COVER'].includes(asset.imageType) && /^[a-f0-9]{64}$/.test(asset.checksumSha256 || ''));
const photoAutoSaveStore = createPrivatePhotoAutoSaveStore();
export async function hasPlatformPrivatePhotoIntent(ownerId, assetId) {
  return (await photoAutoSaveStore.list(ownerId)).some(intent => intent.assetId === assetId);
}
export function queuePlatformPrivatePhoto(runtime, userId, cardId) {
  if (!privateImageUiEnabled()) return Promise.resolve(null);
  return queueNewPrivatePhoto({ runtime, userId, cardId, store: photoAutoSaveStore, isPrivateImage: isPrivateUserImage });
}
export async function drainPlatformPrivatePhotos(userId, cardId = null) {
  if (!privateImageUiEnabled()) return { completed: 0, pending: 0 };
  return drainPrivatePhotoAutoSave({
    runtime: await getPlatformMemoryRuntime(), userId, store: photoAutoSaveStore,
    getSession: getAuthSession, createPhotoTransfer: privateImageTransfer,
    isPrivateImage: isPrivateUserImage, enabled: true, cardId,
  });
}
export function privateImageTransfer(runtime, bundle) {
  return createPrivateImageTransfer({
    cache: privateImageReadCache,
    onTiming: new URLSearchParams(globalThis.location?.search).get('photoTiming') === '1'
      ? value => console.info('MOEMOA_PHOTO_TIMING', JSON.stringify({ ...value, sinceNavigationMs: Math.round(performance.now()) })) : undefined,
    ownerId: bundle.card.ownerId, assetId: bundle.asset.id, sourceVersion: bundle.asset.sync.remoteVersion,
    getSession: getAuthSession, getOwner: () => runtime.initialize(),
    getAsset: async () => (await runtime.getCard(bundle.card.id))?.asset,
    readOriginal: ref => runtime.imageIntake.getOriginal?.(ref), journal: createPrivateImageJournal(),
  });
}
