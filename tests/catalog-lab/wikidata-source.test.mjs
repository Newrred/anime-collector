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
  assert.deepEqual(envelopes[0].payload.claims.P856[1].mainsnak, { snaktype: 'somevalue' });
  assert.deepEqual(envelopes[0].payload.claims.P136[1].mainsnak, { snaktype: 'novalue' });
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
          claims: { P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: String(Number(qid.slice(1)) - 100000000), type: 'string' } } }] },
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
              P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: '121', type: 'string' } } }],
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
