import { createPrivateImageHandler } from '../src/server/privateImages/handler.js';
import { createPrivateImageBackend } from '../src/server/privateImages/supabaseBackend.js';

export default createPrivateImageHandler({
  enabled: process.env.MOEMOA_PRIVATE_IMAGE_API_ENABLED === 'true',
  createBackend: () => createPrivateImageBackend(),
  allowedOrigins: (process.env.MOEMOA_PRIVATE_IMAGE_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
});
