import { createPrivateCleanupHandler } from '../src/server/privateImages/cleanupHandler.js';
import { cleanupPublicImages } from '../src/server/publicImages/handler.js';
import { createSupabaseImageBackend } from '../src/server/publicImages/supabaseImageBackend.js';

// Same authenticated maintenance principal; separate switch and storage backend.
export default createPrivateCleanupHandler({
  enabled: process.env.MOEMOA_PUBLIC_IMAGE_CLEANUP_ENABLED === 'true',
  secret: process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET,
  cleanup: cleanupPublicImages,
  createBackend: () => {
    const project = process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT;
    if (!/^[a-z]{20}$/.test(project || '') || process.env.SUPABASE_URL !== `https://${project}.supabase.co`) {
      throw new Error('CLEANUP_TARGET_MISMATCH');
    }
    return createSupabaseImageBackend();
  },
});
