import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateImageReadCache } from '../../src/features/memory/adapters/platform/privateImageReadCache.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
test('photo bytes survive a page instance but expire and stay bounded', async () => {
  const store = storage(); let clock = 0;
  const options = { storage: () => store, now: () => clock, ttl: 100, maxChars: 230 };
  const a = createPrivateImageReadCache(options); a.setOwner('A');
  await a.put('A', 'one', new Blob(['a'.repeat(60)]));
  const b = createPrivateImageReadCache(options);
  assert.equal(await b.get('A', 'one').text(), 'a'.repeat(60));
  await b.put('A', 'two', new Blob(['b'.repeat(60)]));
  assert.equal(b.get('A', 'one'), null);
  assert.ok(b.get('A', 'two'));
  clock = 100; assert.equal(b.get('A', 'two'), null);
});
test('account change and logout clear bytes including an encoding still in flight', async () => {
  const cache = createPrivateImageReadCache({ storage: () => store }); const store = storage();
  cache.setOwner('A'); await cache.put('A', 'one', new Blob(['private']));
  cache.setOwner('B'); assert.equal(cache.get('A', 'one'), null);
  cache.setOwner('A'); assert.equal(cache.get('A', 'one'), null);
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const pending = cache.put('A', 'late', { arrayBuffer: () => waiting });
  cache.clear(); release(new Uint8Array([1]).buffer); await pending;
  assert.equal(cache.get('A', 'late'), null);
});
test('unavailable session storage does not break image reads', async () => {
  const cache = createPrivateImageReadCache({ storage: () => { throw new Error('blocked'); } });
  cache.setOwner('A'); await cache.put('A', 'one', new Blob(['bytes']));
  assert.equal(cache.get('A', 'one'), null); cache.clear();
});
