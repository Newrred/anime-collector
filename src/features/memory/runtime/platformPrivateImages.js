import { getAuthSession } from '../../../repositories/authRepo.js';
import { createPrivateImageJournal } from '../adapters/indexeddb/privateImageJournal.js';
import { createPrivateImageTransfer } from '../application/createPrivateImageTransfer.js';

export const privateImageUiEnabled = () => import.meta.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 === '1';
// Local imageType describes rights/content (initially UNKNOWN), not the server's USER_IMAGE asset_type.
export const isPrivateUserImage = asset => Boolean(asset && !['SYSTEM_DESIGN', 'CATALOG_COVER'].includes(asset.imageType) && /^[a-f0-9]{64}$/.test(asset.checksumSha256 || ''));
export function privateImageTransfer(runtime, bundle) {
  return createPrivateImageTransfer({
    ownerId: bundle.card.ownerId, assetId: bundle.asset.id, sourceVersion: bundle.asset.sync.remoteVersion,
    getSession: getAuthSession, getOwner: () => runtime.initialize(),
    getAsset: async () => (await runtime.getCard(bundle.card.id))?.asset,
    readOriginal: ref => runtime.imageIntake.getOriginal?.(ref), journal: createPrivateImageJournal(),
  });
}
