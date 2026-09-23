import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMissingRelatedWorks} from '../../tools/catalog-lab/reports/missing-related-works.mjs';
const rows=[{anime_id:'a',anilist_id:1,preferred_title:'Nisekoi',search_aliases:[]}];
const reviews={records:[{animeId:'a',excludedTitles:[{value:'Nisekoi:'}]}]};
function snapshot(extraRows=[],relations=[{targetId:'anilist:2',title:'Nisekoi:',type:'SEQUEL',format:'TV'}]) { return {release:{id:'test'},data:{catalog_anime_search:[...rows,...extraRows],catalog_anime_details:[{anime_id:'a',payload:{relations}}]}}; }
test('removed sequel alias is prioritized without collapsing punctuation into the parent',()=>{
  const result=auditMissingRelatedWorks(snapshot(),reviews);
  assert.equal(result.candidates[0].priority,'REMOVED_ALIAS_WITHOUT_TARGET');
  assert.equal(result.counts.REMOVED_ALIAS_WITHOUT_TARGET,1);
});
test('restored external ID disappears; title-only match requires identity review',()=>{
  assert.equal(auditMissingRelatedWorks(snapshot([{anime_id:'b',anilist_id:2,preferred_title:'Nisekoi:',search_aliases:[]}]),reviews).candidates.length,0);
  assert.equal(auditMissingRelatedWorks(snapshot([{anime_id:'b',anilist_id:null,preferred_title:'Nisekoi:',search_aliases:[]}]),reviews).candidates[0].priority,'CHECK_EXISTING_IDENTITY');
});
test('manga relations are excluded and repeated relations share one candidate',()=>{
  const r={targetId:'anilist:2',title:'Nisekoi:',type:'SEQUEL',format:'TV'};
  const result=auditMissingRelatedWorks(snapshot([],[r,r,{targetId:'anilist:3',title:'Manga',type:'ADAPTATION',format:'UNKNOWN'}]),reviews);
  assert.equal(result.candidates.length,1);assert.equal(result.checkedRelations,2);
});
