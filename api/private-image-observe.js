import { createPrivateObservationHandler } from '../src/server/privateImages/observationHandler.js';
import { createPrivateImageBackend } from '../src/server/privateImages/supabaseBackend.js';

export default createPrivateObservationHandler({
  enabled: process.env.MOEMOA_PRIVATE_IMAGE_OBSERVE_ENABLED === 'true',
  secret: process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET,
  createBackend: () => {
    const project = process.env.MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT;
    if (!/^[a-z]{20}$/.test(project || '') || process.env.SUPABASE_URL !== `https://${project}.supabase.co`) {
      throw new Error('OBSERVATION_TARGET_MISMATCH');
    }
    return createPrivateImageBackend();
  },
});
