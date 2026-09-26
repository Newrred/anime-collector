import { createPrivateCleanupHandler } from '../src/server/privateImages/cleanupHandler.js';
import { createPrivateImageBackend } from '../src/server/privateImages/supabaseBackend.js';

export default createPrivateCleanupHandler({
  enabled: process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED === 'true',
  secret: process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET,
  createBackend: () => {
    const project = process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT;
    if (!/^[a-z]{20}$/.test(project || '') || process.env.SUPABASE_URL !== `https://${project}.supabase.co`) {
      throw new Error('CLEANUP_TARGET_MISMATCH');
    }
    return createPrivateImageBackend();
  },
});
