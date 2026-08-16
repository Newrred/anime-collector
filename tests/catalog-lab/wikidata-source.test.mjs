import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createWikidataAdapter } from '../../tools/catalog-lab/sources/wikidata.mjs';
import { collectEnvelopes } from './helpers/collect-envelopes.mjs';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
  .then(JSON.parse);
const clock = Object.freeze({ now: () => '2026-08-17T00:00:00.000Z' });
const userAgent = 'MOEMOA-Catalog-Lab/0.1 test';

function target(anilistId) {
  return Object.freeze({
    targetKey: `ANILIST:${anilistId}`,
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: String(anilistId) }]),
  });
}

function requestValues(query) {
  return [...query.matchAll(/"(\d+)"/g)].map((match) => match[1]);
}

test('Wikidata maps exact P8729 values and projects only approved CC0 fields', async () => {
  const [mapping, entities] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const requests = [];
  const adapter = createWikidataAdapter({ userAgent });
  const http = {
    async request({ url, init }) {
      requests.push({ url, init });
      if (url.startsWith('https://query.wikidata.org/sparql?')) {
        return new Response(JSON.stringify(mapping), { status: 200 });
      }
      if (url.startsWith('https://www.wikidata.org/w/api.php?')) {
        return new Response(JSON.stringify(entities), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const envelopes = await collectEnvelopes(adapter, { targets: [target(1), target(121)], http, workspace: {}, clock });

  assert.equal(envelopes[0].sourceEntityId, 'Q101244908');
  assert.equal(envelopes[0].payload.externalIds.anilist, '1');
  assert.equal(envelopes[0].payload.labels.ko, '카우보이 비밥');
  assert.deepEqual(Object.keys(envelopes[0].payload.claims), ['P8729', 'P856', 'P577', 'P136', 'P272']);
  assert.deepEqual(Object.keys(envelopes[0].payload.labels).sort(), ['en', 'ja', 'ko']);
  assert.deepEqual(Object.keys(envelopes[0].payload.aliases).sort(), ['en', 'ko']);
  assert.deepEqual(envelopes[0].payload.sitelinks, entities.entities.Q101244908.sitelinks);

  const wdqs = requests.find(({ url }) => url.startsWith('https://query.wikidata.org/sparql?'));
  const api = requests.find(({ url }) => url.startsWith('https://www.wikidata.org/w/api.php?'));
  assert.deepEqual(requestValues(new URL(wdqs.url).searchParams.get('query')), ['1', '121']);
  assert.equal(new URL(api.url).searchParams.get('action'), 'wbgetentities');
  assert.equal(new URL(api.url).searchParams.get('props'), 'labels|aliases|claims|sitelinks');
  assert.equal(new URL(api.url).searchParams.get('languages'), 'ko|ja|en');
  assert.equal(new URL(api.url).searchParams.get('format'), 'json');
  assert.equal(api.init.headers['user-agent'], userAgent);
  assert.equal(requests.some(({ url }) => url.includes('wbsearchentities')), false);
  assert.equal(requests.some(({ url }) => /search|title=/i.test(url)), false);
});

test('Wikidata keeps WDQS at 25 IDs and wbgetentities at 50 QIDs', async () => {
  const [baseMapping, baseEntities] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const requests = [];
  const adapter = createWikidataAdapter({ userAgent });
  const http = {
    async request({ url }) {
      requests.push(url);
      if (url.startsWith('https://query.wikidata.org/sparql?')) {
        const ids = requestValues(new URL(url).searchParams.get('query'));
        return new Response(JSON.stringify({
          ...baseMapping,
          results: {
            bindings: ids.map((id) => ({
              item: { type: 'uri', value: `http://www.wikidata.org/entity/Q${100000000 + Number(id)}` },
              anilistId: { type: 'literal', value: id },
            })),
          },
        }), { status: 200 });
      }
      if (url.startsWith('https://www.wikidata.org/w/api.php?')) {
        const ids = new URL(url).searchParams.get('ids').split('|');
        const entities = Object.fromEntries(ids.map((qid) => [qid, {
          ...structuredClone(baseEntities.entities.Q101244908),
          id: qid,
          claims: { P8729: [{ mainsnak: { datavalue: { value: String(Number(qid.slice(1)) - 100000000), type: 'string' } } }] },
        }]));
        return new Response(JSON.stringify({ entities }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const envelopes = await collectEnvelopes(adapter, {
    targets: Array.from({ length: 51 }, (_, index) => target(index + 1)), http, workspace: {}, clock,
  });

  const wdqs = requests.filter((url) => url.startsWith('https://query.wikidata.org/sparql?'));
  const entities = requests.filter((url) => url.startsWith('https://www.wikidata.org/w/api.php?'));
  assert.deepEqual(wdqs.map((url) => requestValues(new URL(url).searchParams.get('query')).length), [25, 25, 1]);
  assert.deepEqual(entities.map((url) => new URL(url).searchParams.get('ids').split('|').length), [50, 1]);
  assert.equal(envelopes.length, 51);
});

test('Wikidata emits SOURCE_NOT_AVAILABLE when exact P8729 mapping is absent', async () => {
  const mapping = await fixture('wikidata-p8729.json');
  const adapter = createWikidataAdapter({ userAgent });
  let entityRequests = 0;
  const http = {
    async request({ url }) {
      if (url.startsWith('https://query.wikidata.org/sparql?')) {
        return new Response(JSON.stringify({ ...mapping, results: { bindings: [] } }), { status: 200 });
      }
      entityRequests += 1;
      throw new Error('Entity lookup must not occur without a P8729 mapping');
    },
  };

  const [envelope] = await collectEnvelopes(adapter, { targets: [target(999)], http, workspace: {}, clock });

  assert.equal(envelope.targetKey, 'ANILIST:999');
  assert.equal(envelope.responseStatus, 404);
  assert.equal(envelope.payload.errorCode, 'SOURCE_NOT_AVAILABLE');
  assert.equal(envelope.payload.externalIds.anilist, '999');
  assert.equal(entityRequests, 0);
});
