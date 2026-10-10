import test from 'node:test';
import assert from 'node:assert/strict';
import { filesFromTransfer, isEditablePasteTarget } from '../../src/features/memory/application/imageTransferFiles.js';

const file = (name='image.png',type='image/png') => new File(['synthetic'],name,{type,lastModified:1});
const item = value => ({kind:'file',getAsFile:()=>value});
const element = (tagName,attrs={},parentElement=null) => ({tagName,parentElement,getAttribute:name=>Object.hasOwn(attrs,name)?attrs[name]:null});

test('transfer reads file items once and does not merge duplicate FileList wrappers',()=>{
 const selected=file(),otherWrapper=file();
 assert.deepEqual(filesFromTransfer({items:[item(selected),item(selected)],files:[otherWrapper]}),[selected]);
});
test('transfer falls back to FileList when file items are absent, null or unreadable',()=>{
 const selected=file();
 for(const items of [undefined,[],[{kind:'string',getAsFile:()=>assert.fail('text must not be read')}],[item(null)],[{kind:'file',getAsFile:()=>{throw Error('unreadable');}}]]){
  assert.deepEqual(filesFromTransfer({items,files:[selected,selected]}),[selected]);
 }
 assert.deepEqual(filesFromTransfer(null),[]);
});
test('transfer preserves unsupported MIME files and distinct files with equal metadata',()=>{
 const svg=file('drawing.svg','image/svg+xml'),gif=file('animated.gif','image/gif');
 const first=file(),second=file();
 assert.deepEqual(filesFromTransfer({items:[item(svg),item(gif),item(first),item(second)]}),[svg,gif,first,second]);
 assert.deepEqual(filesFromTransfer({files:[svg,gif]}),[svg,gif]);
});
test('text, HTML and URLs alone produce no files without accessing their contents',()=>{
 const transfer={items:[{kind:'string',type:'text/html',getAsFile:()=>assert.fail('string item')},{kind:'string',type:'text/uri-list'}],
  getData:()=>assert.fail('text/URL must not be read')};
 assert.deepEqual(filesFromTransfer(transfer),[]);
});
test('editable paste target recognizes controls and inherited contenteditable',()=>{
 for(const tag of ['INPUT','textarea','SELECT'])assert.equal(isEditablePasteTarget(element(tag)),true);
 for(const value of ['', 'true', 'TRUE', 'plaintext-only']){
  const editor=element('DIV',{contenteditable:value});
  assert.equal(isEditablePasteTarget(element('SPAN',{},editor)),true);
 }
 assert.equal(isEditablePasteTarget({nodeType:3,parentNode:element('DIV',{contenteditable:'true'})}),true);
 assert.equal(isEditablePasteTarget({isContentEditable:true}),true);
});
test('editable paste guard follows slots and shadow hosts and ignores ordinary regions',()=>{
 const editor=element('DIV',{contenteditable:'true'});
 assert.equal(isEditablePasteTarget({assignedSlot:element('SLOT',{},editor)}),true);
 assert.equal(isEditablePasteTarget({getRootNode:()=>({host:editor})}),true);
 assert.equal(isEditablePasteTarget(element('DIV',{contenteditable:'false'})),false);
 assert.equal(isEditablePasteTarget(element('BUTTON')),false);
 assert.equal(isEditablePasteTarget(null),false);
 const cycle={};cycle.parentNode=cycle;
 assert.equal(isEditablePasteTarget(cycle),false);
});
