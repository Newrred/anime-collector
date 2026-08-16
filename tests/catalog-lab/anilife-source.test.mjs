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

test('AniLife rejects explicit falsey, inherited, and prototype-backed bindings before requests', async () => {
  const adapter = createAniLifePublicPageAdapter();
  const cases = [
    { name: 'explicit null', bindings: { 'ANILIST:1': null } },
    { name: 'explicit false', bindings: { 'ANILIST:1': false } },
    { name: 'explicit empty string', bindings: { 'ANILIST:1': '' } },
    {
      name: 'inherited map binding',
      bindings: Object.create({ 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } }),
    },
    {
      name: 'inherited binding fields',
      bindings: { 'ANILIST:1': Object.create({ contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' }) },
    },
  ];

  for (const { name, bindings } of cases) {
    const requests = [];
    const http = { async request({ url }) { requests.push(url); throw new Error('Must not request'); } };
    await assert.rejects(collectEnvelopes(adapter, {
      targets: [target], http, workspace: {}, clock, bindings,
    }), { code: 'SOURCE_SCHEMA_DRIFT' }, name);
    assert.deepEqual(requests, [], name);
  }
});

test('AniLife rejects forwarding and trap-throwing binding proxies before requests', async () => {
  const reviewedBinding = { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' };
  const cases = [
    { name: 'forwarding map proxy', bindings: new Proxy({ 'ANILIST:1': reviewedBinding }, {}) },
    { name: 'forwarding entry proxy', bindings: { 'ANILIST:1': new Proxy(reviewedBinding, {}) } },
    {
      name: 'descriptor trap map proxy',
      bindings: new Proxy({}, { ownKeys() { throw new Error('descriptor trap'); } }),
    },
    {
      name: 'descriptor trap entry proxy',
      bindings: { 'ANILIST:1': new Proxy({}, { ownKeys() { throw new Error('descriptor trap'); } }) },
    },
  ];

  for (const { name, bindings } of cases) {
    const requests = [];
    const http = { async request({ url }) { requests.push(url); throw new Error('Must not request'); } };
    await assert.rejects(collectEnvelopes(createAniLifePublicPageAdapter(), {
      targets: [target], http, workspace: {}, clock, bindings,
    }), { code: 'SOURCE_SCHEMA_DRIFT' }, name);
    assert.deepEqual(requests, [], name);
  }
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

test('AniLife accepts CDATA only as direct sitemap locator text', async () => {
  const [fixtureSitemap, content] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const sitemap = fixtureSitemap.replace(
    'https://anilife1.tv/content/1', '<![CDATA[https://anilife1.tv/content/1]]>',
  );
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.sourceEntityId, '1');
  assert.deepEqual(requests, ['https://anilife1.tv/sitemap.xml', 'https://anilife1.tv/content/1']);
});

test('AniLife rejects sitemap lookalikes and does not request content without a real urlset locator', async () => {
  const content = await fixture('anilife-content-1.html');
  const invalidSitemaps = [
    '<urlset><!-- <loc>https://anilife1.tv/content/1</loc> --></urlset>',
    '<urlset><url><loc>https://anilife1.tv/api/content/1</loc></url></urlset>',
    '<urlset><url><loc>https://anilife1.tv/content/1?next=%2Fapi%2F</loc></url></urlset>',
    '<urlset><![CDATA[<url><loc>https://anilife1.tv/content/1</loc></url>]]></urlset>',
    '<not-urlset><url><loc>https://anilife1.tv/content/1</loc></url></not-urlset>',
    '<urlset><url><extension><loc>https://anilife1.tv/content/1</loc></extension></url></urlset>',
    '<urlset><url><loc>https://anilife1.tv/content/1</url></urlset>',
  ];

  for (const sitemap of invalidSitemaps) {
    const requests = [];
    const adapter = createAniLifePublicPageAdapter();
    const http = createFixtureHttp({ sitemap, content, requests });
    await assert.rejects(collectEnvelopes(adapter, {
      targets: [target], http, workspace: {}, clock,
      bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
    }), { code: 'SOURCE_SCHEMA_DRIFT' });
    assert.deepEqual(requests, ['https://anilife1.tv/sitemap.xml']);
  }
});

test('AniLife uses redirect error mode and rejects blocked redirects before a follow-up request', async () => {
  const sitemap = await fixture('anilife-sitemap.xml');
  const destinations = [
    'https://anilife1.tv/api/internal',
    'https://elsewhere.example/content/1',
  ];

  for (const destination of destinations) {
    for (const stage of ['sitemap', 'content']) {
      const requests = [];
      const adapter = createAniLifePublicPageAdapter();
      const http = {
        async request({ url, init }) {
          requests.push({ url, init });
          assert.equal(init.redirect, 'error');
          if ((stage === 'sitemap' && url.endsWith('/sitemap.xml'))
            || (stage === 'content' && url.endsWith('/content/1'))) {
            const redirect = Response.redirect(destination, 302);
            const error = new Error(`redirect prevented: ${redirect.headers.get('location')}`);
            error.code = 'SOURCE_REDIRECT_FORBIDDEN';
            throw error;
          }
          return new Response(sitemap, { status: 200 });
        },
      };

      await assert.rejects(collectEnvelopes(adapter, {
        targets: [target], http, workspace: {}, clock,
        bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
      }), { code: 'SOURCE_REDIRECT_FORBIDDEN' });
      assert.deepEqual(requests.map(({ url }) => url), stage === 'sitemap'
        ? ['https://anilife1.tv/sitemap.xml']
        : ['https://anilife1.tv/sitemap.xml', 'https://anilife1.tv/content/1']);
    }
  }
});

test('AniLife default HTTP classifies redirect-error failures once without retrying', async () => {
  const sitemap = await fixture('anilife-sitemap.xml');
  for (const stage of ['sitemap', 'content']) {
    const requests = [];
    const adapter = createAniLifePublicPageAdapter({
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        assert.equal(init.redirect, 'error');
        if ((stage === 'sitemap' && url.endsWith('/sitemap.xml'))
          || (stage === 'content' && url.endsWith('/content/1'))) {
          const error = new TypeError('fetch failed');
          error.cause = new Error('unexpected redirect');
          throw error;
        }
        return new Response(sitemap, { status: 200 });
      },
    });

    await assert.rejects(collectEnvelopes(adapter, {
      targets: [target], workspace: {}, clock,
      bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
    }), { code: 'SOURCE_REDIRECT_FORBIDDEN' });
    assert.deepEqual(requests.map(({ url }) => url), stage === 'sitemap'
      ? ['https://anilife1.tv/sitemap.xml']
      : ['https://anilife1.tv/sitemap.xml', 'https://anilife1.tv/content/1']);
  }
});

test('AniLife falls back to OpenGraph title and image while classifying malformed JSON-LD', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml
    .replace('content="Cowboy Bebop"', 'content="Cowboy &amp; Bebop"')
    .replace('content="https://anilife1.tv/images/cowboy-bebop.jpg"',
      'content="https://anilife1.tv/images/cowboy-bebop.jpg?x=1&amp;y=2"')
    .replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.title, 'Cowboy & Bebop');
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg?x=1&y=2');
  assert.equal(envelope.payload.errorCode, 'SOURCE_SCHEMA_DRIFT');
  assert.deepEqual(Object.keys(envelope.payload).sort(), [
    'contentId', 'errorCode', 'imageUrl', 'publicPageUrl', 'title',
  ]);
});

test('AniLife decodes numeric HTML entities in OpenGraph fallback', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml
    .replace('content="Cowboy Bebop"', 'content="Cowboy &#x26; Bebop"')
    .replace('content="https://anilife1.tv/images/cowboy-bebop.jpg"',
      'content="https://anilife1.tv/images/cowboy-bebop.jpg?x=1&#38;y=2"')
    .replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.title, 'Cowboy & Bebop');
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg?x=1&y=2');
});

test('AniLife decodes non-core named HTML entities in OpenGraph fallback', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml
    .replace('content="Cowboy Bebop"', 'content="Cowboy&nbsp;Bebop"')
    .replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.title, 'Cowboy\u00a0Bebop');
});

test('AniLife omits OpenGraph values with unsupported named entities', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml
    .replace('content="Cowboy Bebop"', 'content="Cowboy&unsupported;Bebop"')
    .replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal('title' in envelope.payload, false);
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg');
});

test('AniLife omits digit-bearing unsupported named OpenGraph entities', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml
    .replace('content="Cowboy Bebop"', 'content="Cowboy&frac12;Bebop"')
    .replace('"@context": "https://schema.org",', '"@context":');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal('title' in envelope.payload, false);
  assert.equal(envelope.payload.imageUrl, 'https://anilife1.tv/images/cowboy-bebop.jpg');
});

test('AniLife rejects malformed JSON-LD when OpenGraph tags have no usable content', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const cases = [
    fixtureHtml
      .replace(/<meta property="og:image"[^>]*>\s*/i, '')
      .replace('content="Cowboy Bebop"', '')
      .replace('"@context": "https://schema.org",', '"@context":'),
    fixtureHtml
      .replace(/<meta property="og:title"[^>]*>\s*/i, '')
      .replace('content="https://anilife1.tv/images/cowboy-bebop.jpg"', '')
      .replace('"@context": "https://schema.org",', '"@context":'),
  ];

  for (const content of cases) {
    const requests = [];
    await assert.rejects(collectEnvelopes(createAniLifePublicPageAdapter(), {
      targets: [target], http: createFixtureHttp({ sitemap, content, requests }), workspace: {}, clock,
      bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
    }), { code: 'SOURCE_SCHEMA_DRIFT' });
  }
});

test('AniLife treats unsafe episode integers as unavailable rather than rounding them', async () => {
  const [sitemap, fixtureHtml] = await Promise.all([
    fixture('anilife-sitemap.xml'), fixture('anilife-content-1.html'),
  ]);
  const content = fixtureHtml.replace('"numberOfEpisodes": 26', '"numberOfEpisodes": "9007199254740992"');
  const requests = [];
  const adapter = createAniLifePublicPageAdapter();
  const http = createFixtureHttp({ sitemap, content, requests });

  const [envelope] = await collectEnvelopes(adapter, {
    targets: [target], http, workspace: {}, clock,
    bindings: { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });

  assert.equal(envelope.payload.numberOfEpisodes, null);
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
