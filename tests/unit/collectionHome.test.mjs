import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBookshelf, readBookshelf, saveBookshelf } from '../../src/features/bookshelf/bookshelfSettings.js';
import { minihomeSnapshot, minihomeStatus, minihomeSelection } from '../../src/features/memory/domain/minihomeView.js';
import { createMinihomeController } from '../../src/features/memory/application/createMinihomeController.js';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const title = { animeId: 'anime:' + id(3), title: 'Catalog title', visual: { type:'CATALOG_COVER',revisionId:'asset:'+'a'.repeat(40) } };
const shelf = { id: 'shelf-1', name:'Private shelf',titleKeys:['ANILIST:123'] };
test('typed layout retains existing IDs, backup JSON roundtrip and rejects newer-client data loss',()=>{
 const memoryId=id(4), model={ shelves:[shelf], layoutVersion:1, sections:[{kind:'MEMORY_BOARD',sourceId:memoryId},{kind:'TITLE_SHELF',sourceId:shelf.id}] };
 const values=new Map(), storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.deepEqual(saveBookshelf('account:a',model,storage),model);
 assert.deepEqual(readBookshelf('account:a',storage),JSON.parse(JSON.stringify(model)));
 assert.deepEqual(readBookshelf('account:b',storage),{shelves:[]});
 assert.throws(()=>saveBookshelf('account:a',{shelves:[shelf]},storage),/UNSUPPORTED/);
 assert.deepEqual(readBookshelf('account:a',storage),model);
 assert.throws(()=>normalizeBookshelf({...model,layoutVersion:2}),/UNSUPPORTED/);
 assert.throws(()=>normalizeBookshelf({...model,sections:[{kind:'UNKNOWN',sourceId:memoryId}]}),/UNSUPPORTED/);
 const withoutBoard=saveBookshelf('account:a',{...model,sections:model.sections.slice(1)},storage);
 assert.deepEqual(withoutBoard.shelves,[shelf]);
});
test('malformed stored collection cannot be silently overwritten',()=>{
 let bytes='{"shelves":[],"layoutVersion":99,"sections":[]}';
 const storage={getItem:()=>bytes,setItem:(_k,v)=>{bytes=v;}};
 assert.equal(readBookshelf('account:a',storage).loadError,'COLLECTION_READ_FAILED');
 assert.throws(()=>saveBookshelf('account:a',{shelves:[]},storage));
 assert.match(bytes,/99/);
});
test('public title shelf allows Memory0 catalog titles and strips all private metadata',()=>{
 const dto={schemaVersion:2,nickname:'Name',bio:'',entries:[{kind:'TITLE_SHELF',sectionId:'shelf:shelf-1',snapshot:{schemaVersion:1,title:'Public shelf',titles:[title]}}]};
 const input=structuredClone(dto);Object.assign(input.entries[0].snapshot.titles[0],{rating:5,watchStatus:'Completed',note:'PRIVATE',tags:['PRIVATE'],memoryCount:12});
 assert.deepEqual(minihomeSnapshot(input),dto);
 assert.throws(()=>minihomeSnapshot({...dto,schemaVersion:3}));
 const unknown=structuredClone(dto);unknown.entries[0].kind='UNKNOWN';assert.throws(()=>minihomeSnapshot(unknown));
 const dup=structuredClone(dto);dup.entries.push(dup.entries[0]);assert.throws(()=>minihomeSnapshot(dup));
});
test('owner draft survives controller load without restoring consent or a publish operation',async()=>{
 const selection={schemaVersion:2,nickname:'Saved',bio:'Selected intro',entries:[{kind:'TITLE_SHELF',sourceId:shelf.id,sourceVersion:3,title:'Public title',titles:[{titleKey:'ANILIST:123',animeId:title.animeId,revisionId:title.visual.revisionId,catalogTitle:title.title}]}]};
 const stored={id:id(1),revision:8,published:true,selection};
 let calls=0;
 const controller=createMinihomeController({userId:id(2),collectionHomeEnabled:true,getSession:async()=>({user:{id:id(2)}}),gateway:{getHome:async()=>stored,listHomeBoards:async()=>({boards:[],next:null}),listHomeShelves:async()=>({enabled:true,shelves:[{sourceId:shelf.id,sourceVersion:3,name:shelf.name,titles:[{...title,titleKey:'ANILIST:123'}]}]}),publishHome:async()=>{calls++;}}});
 await controller.load();assert.deepEqual(controller.getSnapshot().home.selection,minihomeSelection(selection));
 assert.equal(controller.getSnapshot().shelves.length,1);assert.equal(controller.getSnapshot().review,null);
 await controller.publish({consented:true,visualsReady:true});assert.equal(calls,0);
 assert.deepEqual(minihomeStatus(stored).selection,selection);
});
