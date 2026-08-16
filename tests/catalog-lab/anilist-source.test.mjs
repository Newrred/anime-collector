import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createAniListTestAdapter } from '../../tools/catalog-lab/sources/anilist-test.mjs';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
  .then(JSON.parse);

const target = Object.freeze({
  targetKey: 'ANILIST:1',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '1' }]),
});

async function collect(adapter, input) {
  const rows = [];
  for await (const envelope of adapter.collect(input)) rows.push(envelope);
  return rows;
}

test('AniList adapter fetches the exact seed id and all 25-per-page character results', async () => {
  const pages = await Promise.all([
    fixture('anilist-media-page1.json'),
    fixture('anilist-characters-page2.json'),
  ]);
  const requests = [];
  const adapter = createAniListTestAdapter({
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    },
  });

  const [envelope] = await collect(adapter, { targets: [target], clock: { now: () => '2026-08-17T00:00:00.000Z' } });

  assert.equal(envelope.sourceEntityId, '1');
  assert.equal(envelope.payload.characters.length, 26);
  assert.deepEqual(requests.map(({ body }) => body.variables), [{ id: 1, page: 1 }, { id: 1, page: 2 }]);
  assert.ok(requests.every(({ url }) => url === 'https://graphql.anilist.co'));
  assert.ok(requests.every(({ body }) => body.query.includes('perPage: 25')));
  assert.ok(requests.every(({ body }) => body.query.includes('voiceActors(language: JAPANESE)')));
  assert.ok(requests.every(({ body }) => !body.query.includes('bannerImage') && !body.query.includes('image')));
});

test('AniList adapter projects only MAIN or SUPPORTING characters and Japanese voice actors without forbidden images', async () => {
  const pages = await Promise.all([
    fixture('anilist-media-page1.json'),
    fixture('anilist-characters-page2.json'),
  ]);
  const adapter = createAniListTestAdapter({
    fetchImpl: async () => new Response(JSON.stringify(pages.shift()), { status: 200 }),
  });

  const [envelope] = await collect(adapter, { targets: [target], clock: { now: () => '2026-08-17T00:00:00.000Z' } });
  const serialized = JSON.stringify(envelope.payload);

  assert.ok(envelope.payload.characters.every((row) => ['MAIN', 'SUPPORTING'].includes(row.role)));
  assert.ok(envelope.payload.characters.flatMap((row) => row.voiceActors)
    .every((actor) => actor.language === 'JAPANESE'));
  assert.deepEqual(envelope.payload.externalLinks, [{ id: 22, site: 'Official Site', url: 'https://example.test/official', type: 'STREAMING' }]);
  assert.equal('bannerImage' in envelope.payload, false);
  assert.equal(serialized.includes('forbidden-'), false);
  assert.equal(serialized.includes('"image"'), false);
});

test('AniList adapter rejects a media response with a non-target id as schema drift', async () => {
  const page = await fixture('anilist-media-page1.json');
  page.data.Media.id = 999;
  const adapter = createAniListTestAdapter({
    fetchImpl: async () => new Response(JSON.stringify(page), { status: 200 }),
  });

  await assert.rejects(collect(adapter, { targets: [target], clock: { now: () => '2026-08-17T00:00:00.000Z' } }), {
    code: 'SOURCE_SCHEMA_DRIFT',
  });
});
