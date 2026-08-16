import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { normalizeSourceRecord } from '../../tools/catalog-lab/pipeline/normalize.mjs';
import { storeSourceEnvelope } from '../../tools/catalog-lab/pipeline/raw-store.mjs';
import { createWikidataAdapter } from '../../tools/catalog-lab/sources/wikidata.mjs';
import { collectEnvelopes } from './helpers/collect-envelopes.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
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

async function collectWithEntityBody(mapping, body) {
  const http = {
    async request({ url }) {
      return new Response(JSON.stringify(url.startsWith('https://query.wikidata.org/')
        ? { ...mapping, results: { bindings: [mapping.results.bindings[0]] } }
        : body), { status: 200 });
    },
  };
  return collectEnvelopes(createWikidataAdapter({ userAgent }), {
    targets: [target(1)], http, workspace: {}, clock,
  });
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-wikidata-integration-'));
  try {
    return await run(await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
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
  assert.deepEqual(envelopes[0].payload.claims.P856[1].mainsnak, {
    snaktype: 'somevalue', property: 'P856', datatype: 'url',
  });
  assert.deepEqual(envelopes[0].payload.claims.P136[1].mainsnak, {
    snaktype: 'novalue', property: 'P136', datatype: 'wikibase-item',
  });
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

test('Wikidata adapter envelope stores and normalizes its explicit snak union without rewriting', async () => {
  await withWorkspace(async (workspace) => {
    const [mapping, entities] = await Promise.all([
      fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
    ]);
    const http = {
      async request({ url }) {
        return new Response(JSON.stringify(url.startsWith('https://query.wikidata.org/')
          ? { ...mapping, results: { bindings: [mapping.results.bindings[0]] } }
          : entities), { status: 200 });
      },
    };
    const [envelope] = await collectEnvelopes(createWikidataAdapter({ userAgent }), {
      targets: [target(1)], http, workspace, clock,
    });
    assert.equal(envelope.payload.claims.P8729[0].mainsnak.snaktype, 'value');
    const stored = await storeSourceEnvelope({ workspace, envelope });
    const record = JSON.parse(await readFile(stored.path, 'utf8'));
    const normalized = normalizeSourceRecord(record);
    assert.equal(normalized.externalIds.some((id) => id.sourceId === 'wikidata'
      && id.value === 'Q101244908'), true);
    assert.equal(normalized.startDate, '1998-04-03');
  });
});

test('Wikidata adapter rejects value claims without an explicit snaktype', async () => {
  const [mapping, entities] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const malformed = structuredClone(entities);
  delete malformed.entities.Q101244908.claims.P8729[0].mainsnak.snaktype;
  const http = {
    async request({ url }) {
      return new Response(JSON.stringify(url.startsWith('https://query.wikidata.org/')
        ? { ...mapping, results: { bindings: [mapping.results.bindings[0]] } }
        : malformed), { status: 200 });
    },
  };
  await assert.rejects(collectEnvelopes(createWikidataAdapter({ userAgent }), {
    targets: [target(1)], http, workspace: {}, clock,
  }), { code: 'SOURCE_SCHEMA_DRIFT' });
});

test('Wikidata rejects malformed entity and claims record containers instead of source absence', async () => {
  const [mapping, fixtureBody] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const entity = fixtureBody.entities.Q101244908;
  const missingClaims = structuredClone(entity);
  delete missingClaims.claims;
  const cases = [
    ['entities array', { entities: [] }],
    ['entities null', { entities: null }],
    ['entities string', { entities: 'not-a-record' }],
    ['selected entity missing', { entities: {} }],
    ['selected entity array', { entities: { Q101244908: [] } }],
    ['selected entity null', { entities: { Q101244908: null } }],
    ['selected entity string', { entities: { Q101244908: 'not-a-record' } }],
    ['claims missing', { entities: { Q101244908: missingClaims } }],
    ['claims array', { entities: { Q101244908: { ...entity, claims: [] } } }],
    ['claims null', { entities: { Q101244908: { ...entity, claims: null } } }],
    ['claims string', { entities: { Q101244908: { ...entity, claims: 'not-a-record' } } }],
  ];
  for (const [name, body] of cases) {
    await assert.rejects(collectWithEntityBody(mapping, body), {
      code: 'SOURCE_SCHEMA_DRIFT',
    }, name);
  }
});

test('Wikidata rejects property and datatype contradictions for value and missing snaks', async () => {
  const [mapping, fixtureBody] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const mutations = [
    ['value property', 'P856', 0, 'property', 'P8729'],
    ['value datatype', 'P577', 0, 'datatype', 'url'],
    ['somevalue property', 'P856', 1, 'property', 'P8729'],
    ['novalue datatype', 'P136', 1, 'datatype', 'wikibase-property'],
  ];
  for (const [name, property, index, key, value] of mutations) {
    const malformed = structuredClone(fixtureBody);
    malformed.entities.Q101244908.claims[property][index].mainsnak[key] = value;
    await assert.rejects(collectWithEntityBody(mapping, malformed), {
      code: 'SOURCE_SCHEMA_DRIFT',
    }, name);
  }
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
          claims: { P8729: [{ mainsnak: {
            snaktype: 'value', property: 'P8729', datatype: 'external-id',
            datavalue: { value: String(Number(qid.slice(1)) - 100000000), type: 'string' },
          } }] },
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

test('Wikidata never records a rejected WDQS QID when the entity P8729 is missing or mismatched', async () => {
  const [mapping, entities] = await Promise.all([
    fixture('wikidata-p8729.json'), fixture('wikidata-entities.json'),
  ]);
  const adapter = createWikidataAdapter({ userAgent });
  const http = {
    async request({ url }) {
      if (url.startsWith('https://query.wikidata.org/sparql?')) {
        return new Response(JSON.stringify({
          ...mapping,
          results: { bindings: [mapping.results.bindings[0]] },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        entities: {
          Q101244908: {
            ...entities.entities.Q101244908,
            claims: {
              ...entities.entities.Q101244908.claims,
              P8729: [{ mainsnak: {
                snaktype: 'value', property: 'P8729', datatype: 'external-id',
                datavalue: { value: '121', type: 'string' },
              } }],
            },
          },
        },
      }), { status: 200 });
    },
  };

  const [envelope] = await collectEnvelopes(adapter, { targets: [target(1)], http, workspace: {}, clock });

  assert.equal(envelope.responseStatus, 404);
  assert.equal(envelope.sourceEntityId, 'P8729:1');
  assert.equal(envelope.payload.errorCode, 'SOURCE_NOT_AVAILABLE');
});
