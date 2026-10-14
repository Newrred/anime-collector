import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionLegacyHref} from '../../src/features/bookshelf/collectionLegacyRoute.js';

test('legacy home tasks use a fixed local route and omit unrelated query values',()=>{
  assert.equal(collectionLegacyHref({kind:'home',hash:'#following',search:'?token=secret&returnTo=https://bad.invalid'}),'/?panel=following');
  assert.equal(collectionLegacyHref({kind:'home',hash:'#safety'}),'/?panel=safety');
  assert.equal(collectionLegacyHref({kind:'home',hash:'#unknown'}),'/?panel=sharing');
});
test('legacy board links preserve the selected source and reject ambiguous or oversized IDs',()=>{
  assert.equal(new URL(collectionLegacyHref({kind:'boards',search:'?id=source-a&returnTo=https://bad.invalid'}),'http://localhost').searchParams.get('section'),'MEMORY_BOARD:source-a');
  for(const search of ['','?id=a&id=b','?id='+'a'.repeat(81)])assert.equal(collectionLegacyHref({kind:'boards',search}),'/?panel=boards');
});
test('a subpath is retained while a protocol-relative base cannot leave the local site',()=>{
  assert.equal(collectionLegacyHref({kind:'home',base:'/app/'}),'/app/?panel=sharing');
  for(const base of ['//bad.invalid/','/\\bad.invalid/','/\n/bad.invalid/','/?returnTo=x'])assert.equal(collectionLegacyHref({kind:'home',base}),'/?panel=sharing');
});
