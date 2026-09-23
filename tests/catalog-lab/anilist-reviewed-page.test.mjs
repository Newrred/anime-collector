import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewedAniListPageEnvelope} from '../../tools/catalog-lab/sources/anilist-reviewed-page.mjs';
import {normalizeSourceRecord} from '../../tools/catalog-lab/pipeline/normalize.mjs';
import {sha256} from '../../tools/catalog-lab/lib/hash.mjs';
const capture=()=>({method:'REVIEWED_PUBLIC_RENDERED_PAGE',pageUrl:'https://anilist.co/anime/109261/Go-toubun-no-Hanayome-/',capturedAt:'2026-09-07T00:00:00.000Z',reviewedBy:'Test reviewer',observedTitle:'Go-toubun no Hanayome ∬',media:{id:109261,idMal:null,title:{romaji:'Go-toubun no Hanayome ∬',english:null,native:null},synonyms:[],format:'TV',status:'FINISHED',startDate:{year:2021,month:1,day:8},endDate:{year:2021,month:3,day:26},season:'WINTER',seasonYear:2021,episodes:12,source:'MANGA',genres:[],coverImage:{extraLarge:null,large:null,medium:null},studios:{nodes:[]},relations:{edges:[]},externalLinks:[],characters:[]}});
function record(envelope){const {fetchedAt,...core}=envelope;const sourceRecordId=sha256(core);return {...envelope,sourceRecordId,payloadHash:sha256(envelope.payload),fetchStatus:'FETCHED',rawPayloadRef:`raw/anilist/anilist-109261/${sourceRecordId}.json`};}
test('reviewed page preserves source method and marks omitted fields as not collected',()=>{
 const e=createReviewedAniListPageEnvelope(capture());assert.match(e.requestFingerprint,/^reviewed-page:https:\/\/anilist.co/);
 const n=normalizeSourceRecord(record(e));assert.equal(n.episodeCount,12);assert.equal(n.fieldStates.characters,'NOT_FETCHED');assert.equal(n.fieldStates.castings,'NOT_FETCHED');
 const api={...e,parserVersion:'anilist-test-v1'};assert.equal(normalizeSourceRecord(record(api)).fieldStates.characters,'SOURCE_NOT_AVAILABLE');
});
test('reviewed page rejects mismatched id, title, host and unreviewed observations',()=>{
 for(const change of [{pageUrl:'https://anilist.co/anime/103572/Other/'},{pageUrl:'https://example.com/anime/109261/x/'},{observedTitle:'First season'},{reviewedBy:''},{method:'API'}])assert.throws(()=>createReviewedAniListPageEnvelope({...capture(),...change}));
});

