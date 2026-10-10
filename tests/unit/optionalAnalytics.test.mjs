import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Source guard; the release check also inspects the generated production HTML.
// Provider access/security logs are separate and are not covered by this check.
test('shared and account layouts do not automatically install optional page analytics', async () => {
  for (const path of [
    'src/layouts/BaseLayout.astro',
    'src/pages/auth/start.astro',
    'src/pages/auth/complete.astro',
  ]) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /@vercel\/analytics|<Analytics\b|<vercel-analytics\b|\/_vercel\/insights\//i, path);
  }
});
