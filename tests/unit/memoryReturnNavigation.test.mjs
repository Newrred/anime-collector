import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMemoryReturn, memoryReturnHref, addMemoryReturn } from '../../src/domain/search/memoryReturnNavigation.js';
import { quickLogFingerprint } from '../../src/domain/quickLogDraft.js';
test('Memory returns preserve supported filters while excluding external, auth and nested returns', () => {
  for (const value of ['https://evil.test/', '//evil.test/archive/', '/auth/callback/?code=secret', '/memory/new/', '/other/archive/', '/archive/\\evil']) assert.equal(safeMemoryReturn(value), null);
  assert.equal(safeMemoryReturn('/archive/?q=foo&sort=updated&access_token=secret&returnTo=bad'), '/archive/?q=foo&sort=updated');
  assert.equal(safeMemoryReturn('/app/boards/index.html?id=board', '/app/'), '/app/boards/index.html?id=board');
  assert.equal(safeMemoryReturn('/boards/?id=board', '/app/'), null);
  assert.equal(memoryReturnHref('?returnTo=https://evil.test&returnY=9'), '/archive/');
  assert.equal(memoryReturnHref('?returnTo=%2Fboards%2F%3Fid%3Dx&returnY=400'), '/boards/?id=x&restoreY=400');
});
test('only Memory detail and composer links receive a safe source context', () => {
  const value = addMemoryReturn('/memory/card/?id=card', 'https://local.test/archive/?q=foo', 450);
  const parsed = new URL(value, 'https://local.test');
  assert.equal(parsed.searchParams.get('returnTo'), '/archive/?q=foo');
  assert.equal(parsed.searchParams.get('returnY'), '450');
  assert.equal(addMemoryReturn('https://evil.test/memory/card/', 'https://local.test/archive/'), 'https://evil.test/memory/card/');
  assert.equal(addMemoryReturn('/data/', 'https://local.test/archive/'), '/data/');
});
test('quick log dirty comparison includes character metadata and ignores unselected leftovers', () => {
  const draft = { mode: 'create', note: '' };
  const initial = quickLogFingerprint(draft, [1], 1, { 1: { reasonTags: ['a', 'b'] } });
  assert.equal(initial, quickLogFingerprint(draft, [1], 1, { 1: { reasonTags: ['b', 'a'] }, 2: { note: 'leftover' } }));
  assert.notEqual(initial, quickLogFingerprint({ ...draft, note: 'changed' }, [1], 1, { 1: { reasonTags: ['a', 'b'] } }));
  assert.notEqual(initial, quickLogFingerprint(draft, [1], 1, { 1: { reasonTags: ['a', 'b'], note: 'changed' } }));
});
