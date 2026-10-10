import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('existing-member callback retries the separate OAuth route and keeps callback guards', async() => {
  const source = await readFile(new URL('../../src/components/auth/AuthCallbackClient.jsx', import.meta.url), 'utf8');
  assert.match(source, /await startExistingGoogleOAuth\(returnPath\)/u);
  assert.doesNotMatch(source, /signInWithGoogle/u);
  assert.match(source, /parseWebOAuthCallback\(/u);
  assert.match(source, /exchangeCodeForSession\(callback\.code\)/u);
  assert.match(source, /if \(!session\?\.user\?\.id\)/u);
  assert.ok(source.indexOf('history.replaceState') < source.indexOf('await exchangeCodeForSession'));
  assert.match(source, /Object\.hasOwn\(CALLBACK_MESSAGES, error\?\.code\)/u);
  assert.match(source, /encodeURIComponent\(returnPath\)/u);
  assert.doesNotMatch(source, /error\?\.message|error\.message/u);
});

test('callback shares signup presentation without referrer or index leakage', async() => {
  const page = await readFile(new URL('../../src/pages/auth/callback.astro', import.meta.url), 'utf8');
  assert.match(page, /styles\/simple-signup\.css/u);
  assert.match(page, /name="referrer" content="no-referrer"/u);
  assert.match(page, /name="robots" content="noindex"/u);
  assert.doesNotMatch(page, /Auth Callback|surface-card|data-theme="dark"/u);
});
