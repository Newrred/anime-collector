import { createAccountDeleteHandler } from '../src/server/accountDelete/handler.js';
import { createAccountDeleteBackend } from '../src/server/accountDelete/backend.js';

export default createAccountDeleteHandler({
  enabled: process.env.MOEMOA_ACCOUNT_DELETE_ENABLED === 'true',
  origin: process.env.MOEMOA_SIGNUP_ORIGIN,
  preview: process.env.VERCEL_ENV === 'preview',
  allowedEmailHashes: process.env.MOEMOA_SIGNUP_ALLOWED_EMAIL_HASHES,
  createBackend: () => createAccountDeleteBackend(),
});
