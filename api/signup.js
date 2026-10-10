import {createSignupHandler} from '../src/server/signup/handler.js';
import {createSignupBackend} from '../src/server/signup/backend.js';

export default createSignupHandler({
  enabled:process.env.MOEMOA_SIMPLE_SIGNUP_SERVER_ENABLED==='true',
  origin:process.env.MOEMOA_SIGNUP_ORIGIN,
  clientId:process.env.MOEMOA_GOOGLE_CLIENT_ID,
  clientSecret:process.env.MOEMOA_GOOGLE_CLIENT_SECRET,
  cookieKey:process.env.MOEMOA_SIGNUP_COOKIE_KEY,
  preview:process.env.VERCEL_ENV==='preview',
  allowTestDocuments:process.env.MOEMOA_SIGNUP_TEST_DOCUMENTS==='true',
  allowedEmailHashes:process.env.MOEMOA_SIGNUP_ALLOWED_EMAIL_HASHES,
  observe:event=>console.warn('signup_request_failed',JSON.stringify(event)),
  createBackend:()=>createSignupBackend(),
});
