import {readFile,writeFile} from 'node:fs/promises';
const dest='design/channel-study-v8.4/';
let html=await readFile('design/bookshelf-detail-v8.3/index.html','utf8');
html=html.replace('href="detail.css"','href="../bookshelf-detail-v8.3/detail.css"><link rel="stylesheet" href="channel.css"');
html=html.replace(/<div class="preview-bar">[\s\S]*?<header class="site-header">/,'<header class="site-header">');
html=html.replace('상세 시안 08.3','구조 시안 08.4').replace('src="bookshelf.js"','src="channel.js"');
html=html.replace('<nav class="main-nav"','<button class="channel-global-search" type="button" id="channel-global-search">내 기록 검색 <kbd>/</kbd></button><nav class="main-nav"');
let js=await readFile('design/bookshelf-detail-v8.3/bookshelf.js','utf8');
const start=js.indexOf('  function renderBookshelf(model)'),end=js.indexOf('  function positionShelfPanel',start);
if(start<0||end<0)throw Error('source boundaries');
let block=await readFile(dest+'render-home.txt','utf8');
block=block.replace(`<span class="crumb-separator">/</span><span>'+esc(model.name||'나의 필름책장')+'</span>`, `'+(state.activeShelf==='all'?'':'<span class="crumb-separator">/</span><span>'+esc(model.shelves.find(s=>s.id===state.activeShelf)?.name||'')+'</span>')+'`);
js=js.slice(0,start)+block+'\n'+js.slice(end);
js=js.replace('  function renderShelfCaption(title)',`  let channelView = new URLSearchParams(location.search).get('view') === 'table' ? 'table' : 'grid';
  let channelExpanded = false, channelQuery = '', channelSearchOpen = false;
  function renderShelfCaption(title)`);
// A native-sized cover lives inside a square stage. The source visual is never cropped.
js=js.replace('class="shelf-cover"','class="shelf-cover"');
const hook=`
  app.addEventListener('click',event=>{
   const control=event.target.closest('[data-channel-action]');if(!control)return;
   const action=control.dataset.channelAction;
   if(action==='info'){channelExpanded=!channelExpanded;render({focusId:'channel-info-toggle'});}
   if(action==='view'){channelView=control.dataset.view;const u=new URL(location.href);u.searchParams.set('view',channelView);history.pushState({},'',u);render({focusId:'channel-view-'+channelView});}
   if(action==='search'){channelSearchOpen=!channelSearchOpen;if(!channelSearchOpen)channelQuery='';render({focusId:channelSearchOpen?'channel-query':'channel-search-toggle'});}
   if(action==='clear'){channelQuery='';render({focusId:'channel-query'});}
  });
  app.addEventListener('input',event=>{if(event.target.id==='channel-query'){const position=event.target.selectionStart;channelQuery=event.target.value;render({focusId:'channel-query'});document.getElementById('channel-query')?.setSelectionRange(position,position);}});
  window.addEventListener('popstate',()=>{channelView=new URLSearchParams(location.search).get('view')==='table'?'table':'grid';render();});
  document.getElementById('channel-global-search').onclick=()=>{channelSearchOpen=true;state.page='home';state.id='';if(location.hash!=='#home')location.hash='home';render({focusId:'channel-query'});};
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();document.getElementById('channel-global-search').click();}});
`;
js=js.replace('  function renderShelfCaption(title)',hook+'\n  function renderShelfCaption(title)');
const copy=await readFile('src/components/library/libraryCopy.js','utf8');
const sourceOptions=Object.fromEntries(['AFFINITY_OPTIONS','REASON_TAG_OPTIONS'].map(key=>[key,JSON.parse(copy.match(new RegExp('export const '+key+' = (\\[[^;]+\\]);'))[1])]));
const tabs='  const serviceFacetOptions='+JSON.stringify(sourceOptions)+';\n'+await readFile(dest+'render-facets.txt','utf8')+'\n'+await readFile(dest+'render-tabs.txt','utf8');
js=js.replace('if (state.page === "titles") controls.view = "album";', 'if (state.page === "titles") controls.view = "poster";');
for(const name of ['renderTitles','renderMemories','renderMemoryResults','renderTitleResults']){
 const a=js.indexOf('  function '+name+'('),b=js.indexOf('\n  function ',a+3);
 if(a<0||b<0)throw Error('tab boundary '+name);
 js=js.slice(0,a)+js.slice(b);
}
js=js.replace('  function renderTitle() {',tabs+'\n  function renderTitle() {');
js=js.replace('function archiveItems(){const items=searchedMemories();','function archiveItems(){const items=searchedMemories().filter(matchesArchiveFacets);');
js=js.replaceAll('${searchedMemories().length}개의 기억','${archiveItems().length}개의 기억');
js=js.replace('document.getElementById("memory-results").innerHTML = renderMemoryResults();', 'document.getElementById("memory-results").innerHTML = renderMemoryResults(); app.querySelector(".archive-facets").outerHTML=renderArchiveFacets();');
js=js.replace('${views}</div></section>', '${views}</div>${page===\'memories\'?renderArchiveFacets():\'\'}</section>');
js=js.replace('channel-home channel-tab ${expanded?', 'channel-home channel-tab ${page===\'memories\'?\'has-facets\':\'\'} ${expanded?');
js=js.replace('memoryControls.query = ""; render({ focusId: "memory-search" });','memoryControls.query = ""; activeFacets={tag:"",character:"",affinity:""}; render({ focusId: "memory-search" });');
js=js.replace("channelSearchOpen=true;state.page='home';", "if(state.page==='titles'||state.page==='memories'){tabExpanded[state.page]=true;render({focusId:state.page==='titles'?'title-search':'memory-search'});return;}channelSearchOpen=true;state.page='home';");
const detailMarkup=await readFile(dest+'render-detail.txt','utf8');
const detailStart=js.indexOf('    memoryDialog.innerHTML = `'),detailEnd=js.indexOf('\n    memoryDialog.setAttribute',detailStart);
if(detailStart<0||detailEnd<0)throw Error('detail boundary');
js=js.slice(0,detailStart)+detailMarkup+js.slice(detailEnd);
await writeFile(dest+'index.html',html);await writeFile(dest+'channel.js',js);
console.log('Channel structure built from V8 RAM model');
