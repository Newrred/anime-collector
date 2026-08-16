import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createAniLifePublicPageAdapter,
  validateAniLifeBinding,
} from '../../tools/catalog-lab/sources/anilife-public-page-test.mjs';
import { collectEnvelopes } from './helpers/collect-envelopes.mjs';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const clock = Object.freeze({ now: () => '2026-08-17T00:00:00.000Z' });
const target = Object.freeze({
  targetKey: 'ANILIST:1',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '1' }]),
});
const unboundTarget = Object.freeze({
  targetKey: 'ANILIST:121',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '121' }]),
});

function createFixtureHttp({ sitemap, content, requests }) {
  return {
    async request({ url }) {
      requests.push(url);
      if (url === 'https://anilife1.tv/sitemap.xml') return new Response(sitemap, { status: 200 });
      if (url === 'https://anilife1.tv/content/1') return new Response(content, { status: 200 });
      throw new Error(`Unexpected URL: ${url}`);
    },
  };
}

test('AniLife adapter only fetches manually bound public content pages', async () => {
  const [sitemap, content] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });
  const bindings = { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } };

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock, bindings,
  });

  assert.equal(envelope.sourceEntityId, '1');
  assert.deepEqual(envelope.payload, {
    contentId: '1',
    title: 'Cowboy Bebop',
    alternateName: '카우보이 비밥',
    datePublished: '1998-04-03',
    numberOfEpisodes: 26,
    imageUrl: 'https://anilife1.tv/images/cowboy-bebop.jpg',
    publicPageUrl: 'https://anilife1.tv/content/1',
  });
  assert.deepEqual(requests, [
    'https://anilife1.tv/sitemap.xml',
    'https://anilife1.tv/content/1',
  ]);
  assert.equal(requests.some((url) => new URL(url).pathname.startsWith('/api/')), false);
  assert.doesNotMatch(JSON.stringify(envelope.payload), /episode.*(?:stream|playback)|comment/i);
});

test('unbound target is marked NOT_FETCHED without sitemap-wide page crawling', async () => {
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = { async request({ url }) { requests.push(url); throw new Error('Unbound target must not request'); } };

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [unboundTarget], http, workspace: {}, clock, bindings: {},
  });

  assert.deepEqual(envelope.payload, { fieldState: 'NOT_FETCHED' });
  assert.deepEqual(requests, []);
});

test('AniLife requires a reviewed numeric binding and rejects API-shaped content identifiers', () => {
  assert.deepEqual(validateAniLifeBinding({ contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' }), {
    contentId: '1',
  });
  assert.throws(
    () => validateAniLifeBinding({ contentId: '1/api/episodes', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' }),
    { code: 'SOURCE_ENDPOINT_FORBIDDEN' },
  );
  assert.throws(
    () => validateAniLifeBinding({ contentId: '1', evidence: 'UNREVIEWED' }),
    { code: 'SOURCE_SCHEMA_DRIFT' },
  );
});

test('AniLife verifies sitemap membership before fetching a bound content page', async () => {
  const [sitemap, content] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  await assert.rejects(collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '3', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  }), { code: 'SOURCE_SCHEMA_DRIFT' });
  assert.deepEqual(requests, ['https://anilife1.tv/sitemap.xml']);
});

test('AniLife falls back to OpenGraph title and image while classifying malformed JSON-LD', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml.replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.title, 'Cowboy Bebop');
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg');
  assert.equal(envelope.payload.errorCode, 'SOURCE_SCHEMA_DRIFT');
  assert.deepEqual(Object.keys(envelope.payload).sort(), [
    'contentId', 'errorCode', 'imageUrl', 'publicPageUrl', 'title',
  ]);
});

test('AniLife ignores unrelated JSON-LD before the public media record', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml.replace('<script type="application/ld+json">', `
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Unrelated site","image":"https://anilife1.tv/images/site.jpg"}
    </script>
    <script type="application/ld+json">`);
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.title, 'Cowboy Bebop');
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg');
});
