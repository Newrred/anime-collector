import {expect,test,type Page,type BrowserContext} from '@playwright/test';
import {installAppState} from './helpers/appState';
import {adapters,mockPublication,seedOwner} from './helpers/publicationFixture';

const USER='11111111-1111-4111-8111-111111111111';
async function sources(page:Page) {
  await installAppState(page,{locale:'en'});
  await page.route('https://**/*',r=>r.abort());
  await page.goto('/');
  return page.evaluate(async()=>{
    const {getPlatformMemoryRuntime}=await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime=await getPlatformMemoryRuntime();
    const create=async(displayTitle:string)=>runtime.createCard({titleChoice:{kind:'PRIVATE_TITLE',displayTitle},note:'Synthetic private memory',systemDesignSpec:{version:1,templateId:'memory-gradient',paletteId:'mint-dusk',patternSeed:'audit',titleLayout:'BOTTOM_LEFT',genreTokens:[]}});
    const a=await create('First shelf only'),b=await create('Second shelf only');
    const board=await runtime.createBoard({title:'Synthetic image collection',description:'Private description stays private'});
    await runtime.addCardToBoard(board.id,a.cardId);
    const {saveBookshelf}=await import('/src/features/bookshelf/bookshelfSettings.js');
    saveBookshelf('local',{shelves:[{id:'a',name:'First shelf',titleKeys:['PRIVATE:'+a.privateTitleId]},{id:'b',name:'Second shelf',titleKeys:['PRIVATE:'+b.privateTitleId]}],layoutVersion:1,sections:[{kind:'TITLE_SHELF',sourceId:'b'},{kind:'MEMORY_BOARD',sourceId:board.id},{kind:'TITLE_SHELF',sourceId:'a'}]});
    return {boardId:board.id};
  });
}
async function home(context:BrowserContext) {
  await adapters(context);
  await context.addInitScript(user=>localStorage.setItem('moemoa.e2e.mockSession.v1',JSON.stringify({user:{id:user},access_token:'local-test-token'})),USER);
  await context.route('**/__publication-test/rpc/*',r=>{
    const name=r.request().url().split('/').at(-1);
    const data=name==='list_memory_minihome_boards'?{boards:[],next:null}:name==='list_memory_minihome_shelves'?{enabled:true,shelves:[]}:name==='list_memory_relationships'||name==='list_memory_safety'?{items:[],next:null}:null;
    return r.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null})});
  });
}
test('direct shelf entry and reload display only the requested source',async({page})=>{
  await sources(page);await page.goto('/?section=TITLE_SHELF:b');
  await expect(page.locator('.collection-section-tabs').getByRole('button',{name:/Title shelf Second shelf/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
  await expect(page.locator('.bookshelf-tile')).toContainText('Second shelf only');
  await page.reload();await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
});
test('ordered typed overview and selected Board use the appropriate content controls',async({page})=>{
  const seeded=await sources(page);await page.reload();
  await expect(page.locator('.channel-section').getByText('Choose shelf',{exact:true})).toHaveCount(0);
  await expect(page.locator('.collection-owner-section')).toHaveCount(3);
  expect(await page.locator('.collection-owner-section').evaluateAll(es=>es.map(e=>e.getAttribute('data-section-kind')))).toEqual(['TITLE_SHELF','MEMORY_BOARD','TITLE_SHELF']);
  await page.goto('/?section=MEMORY_BOARD:'+seeded.boardId);
  await expect(page.locator('.collection-board .memory-boards__cards li')).toHaveCount(1);
  await expect(page.getByPlaceholder('Find a title',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Table',exact:true})).toHaveCount(0);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.cache/collection-document-audit/board-${width}.png`,fullPage:true});}
});
test('new shelf is available from the shared add menu and cancel preserves original layout',async({page})=>{
  await sources(page);await page.reload();
  const before=await page.evaluate(()=>localStorage.getItem('moemoa:bookshelf:v1:local'));
  await page.getByRole('button',{name:'+ Add group',exact:true}).click();
  await page.getByRole('button',{name:'Create title shelf',exact:true}).click();
  await expect(page.getByLabel('Shelf name',{exact:true})).toHaveValue('New shelf');
  await page.getByLabel('Shelf name',{exact:true}).fill('Not saved');
  await expect(page.getByRole('button',{name:'Following',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('moemoa:bookshelf:v1:local'))).toBe(before);
  await page.getByRole('button',{name:'+ Add group',exact:true}).click();
  await page.getByRole('button',{name:'Create title shelf',exact:true}).click();
  await page.getByLabel('Shelf name',{exact:true}).fill('New display shelf');
  await page.getByRole('checkbox',{name:'Second shelf only',exact:true}).check();
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('moemoa:bookshelf:v1:local')!));
  const newShelf=after.shelves.find((s:any)=>s.name==='New display shelf');
  expect(after.sections.slice(0,3)).toEqual(JSON.parse(before!).sections);
  expect(after.sections.at(-1)).toEqual({kind:'TITLE_SHELF',sourceId:newShelf.id});
  expect(newShelf.titleKeys).toHaveLength(1);
  await page.reload();await page.locator('.collection-section-tabs').getByRole('button',{name:/Title shelf New display shelf/}).click();
  await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
  await expect(page.locator('.bookshelf-tile')).toContainText('Second shelf only');
});

test('enabled collection routes keep legacy Board and home links in the same workspace without copying sources',async({page,context})=>{
  const seeded=await sources(page);await adapters(context);
  await context.addInitScript(()=>{(window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.collectionHome=true;});
  await context.route('**/__publication-test/rpc/*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({data:null,error:null})}));
  await page.evaluate(async()=>{const {readBookshelf,saveBookshelf}=await import('/src/features/bookshelf/bookshelfSettings.js');const current=readBookshelf('local');saveBookshelf('local',{...current,sections:current.sections.filter((s:any)=>s.kind==='TITLE_SHELF')});});
  await page.goto('/boards/?id='+seeded.boardId+'&returnTo=https://example.invalid/&token=not-a-real-token');
  await expect(page.locator('.collection-board .memory-boards__cards li')).toHaveCount(1);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).searchParams.get('section')).toBe('MEMORY_BOARD:'+seeded.boardId);
  expect(new URL(page.url()).searchParams.has('token')).toBe(false);
  await expect(page.getByRole('button',{name:'Connect this Board to collection',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Connect this Board to collection',exact:true}).click();
  await expect(page.locator('.collection-section-tabs').getByRole('button',{name:/Memory Board Synthetic image collection/})).toHaveAttribute('aria-pressed','true');
  const original=await page.evaluate(async id=>{const {getPlatformMemoryRuntime}=await import('/src/features/memory/runtime/platformMemoryRuntime.js');return (await (await getPlatformMemoryRuntime()).getBoard(id))?.items.length;},seeded.boardId);
  expect(original).toBe(1);
  await page.goto('/minihome/#following');await expect(page).toHaveURL(/\?panel=following$/);
  await expect(page.locator('.collection-task').getByRole('heading',{name:'Following',exact:true})).toBeVisible();
  await page.goto('/boards/');await expect(page).toHaveURL(/\?panel=boards$/);
  await expect(page.locator('.collection-task .memory-boards')).toBeVisible();
});
test('all collection task buttons preserve sharing input when leaving is declined',async({page,context})=>{
  await installAppState(page,{locale:'en'});await home(context);await page.goto('/?panel=sharing');
  await page.getByLabel('Public nickname',{exact:true}).fill('Unsaved synthetic owner');
  for(const name of ['Following','Safety']){
    const dialogs:string[]=[];page.once('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
    await page.getByRole('button',{name,exact:true}).click();
    expect(dialogs).toHaveLength(1);
    await expect(page.getByLabel('Public nickname',{exact:true})).toHaveValue('Unsaved synthetic owner');
  }
  await page.screenshot({path:'.cache/collection-document-audit/sharing-draft.png',fullPage:true});
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Following',exact:true}).click();
  await expect(page.getByLabel('Public nickname',{exact:true})).toHaveCount(0);
  await expect(page).toHaveURL(/panel=following/);
});

test('home status stays pending until confirmed and busy sharing blocks task switching',async({page,context})=>{
  await installAppState(page,{locale:'en'});await home(context);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await context.route('**/__publication-test/rpc/get_memory_minihome',async r=>{await gate;await r.fulfill({contentType:'application/json',body:JSON.stringify({data:{id:'55555555-5555-4555-8555-555555555555',revision:1,published:true,hidden:true,visible:false},error:null})});});
  try{
    await page.goto('/');await expect(page.locator('.collection-profile')).toContainText('Checking sharing status');
    await expect(page.locator('.collection-profile').getByText('Private collection',{exact:true})).toHaveCount(0);
    await page.goto('/?panel=sharing');
    await expect(page.locator('.memory-minihome')).toHaveAttribute('aria-busy','true');
    await expect(page.getByRole('button',{name:'Following',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Safety',exact:true})).toBeDisabled();
  }finally{release();}
  await expect(page.getByLabel('Public nickname',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Back to collection',exact:true}).click();
  await expect(page.locator('.collection-profile')).toContainText('Not currently visible to visitors');
});

test('first Board share suggests its name as a draft without selecting memories or copying private description',async({page,context})=>{
  await adapters(context);const server=mockPublication();await server.attach(context);
  await seedOwner(page);
  await expect(page.getByRole('region',{name:'Public Board',exact:true})).toBeVisible();
  await expect(page.getByLabel('Public title',{exact:true})).toHaveValue('PRIVATE BOARD NAME');
  await expect(page.getByLabel('Public description',{exact:true})).toHaveValue('');
  await expect(page.locator('.memory-publication__selection input:checked')).toHaveCount(0);
  expect(server.calls.filter(c=>c.name.startsWith('prepare_')||c.name.startsWith('publish_'))).toHaveLength(0);
  await page.getByLabel('Public title',{exact:true}).fill('Edited public name');
  await expect(page.getByLabel('Public title',{exact:true})).toHaveValue('Edited public name');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.memory-publication__selection .system-design-preview strong').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect(),p=e.closest('.memory-visual')!.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom&&r.left>=p.left&&r.right<=p.right;}))).toBe(true);
    await page.screenshot({path:`.cache/collection-document-audit/board-sharing-${width}.png`,fullPage:true});}
});

test('partial public cover failure preserves healthy images and keeps preview publication disabled',async({page,context})=>{
  await installAppState(page,{locale:'en'});await adapters(context);
  const id='55555555-5555-4555-8555-555555555555';
  const titles=[{animeId:'anime:15151515-1515-4151-8151-151515151515',title:'Healthy approved title',visual:{type:'CATALOG_COVER',revisionId:'asset:'+'a'.repeat(40)}},{animeId:'anime:17171717-1717-4171-8171-171717171717',title:'Unavailable approved title',visual:{type:'CATALOG_COVER',revisionId:'asset:'+'b'.repeat(40)}}];
  const snapshot={schemaVersion:2,nickname:'Synthetic public collection',bio:'',entries:[{kind:'TITLE_SHELF',sectionId:'shelf:source',snapshot:{schemaVersion:1,title:'Approved shelf',titles}}]};
  await context.addInitScript(()=>{(window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.collectionHome=true;(window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.resolveCover=async(t:any)=>{if(t.title.startsWith('Unavailable'))throw Error('PUBLIC_VISUAL_NOT_READY');return '/__audit-cover.svg';};});
  await context.route('**/__audit-cover.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#54767b"/></svg>'}));
  const calls:string[]=[];
  await context.route('**/__publication-test/rpc/*',r=>{
    const name=r.request().url().split('/').at(-1)!;calls.push(name);
    const data=name==='read_memory_minihome'?{id,...snapshot}:name==='list_memory_minihome_shelves'?{enabled:true,shelves:[{sourceId:'source',sourceVersion:1,name:'Approved shelf',titles:titles.map((t,i)=>({...t,titleKey:'ANILIST:'+(1313+i)}))}]}:name==='list_memory_minihome_boards'?{boards:[],next:null}:name==='prepare_memory_minihome'?{id,revision:1,reviewHash:'a'.repeat(64),policyRevision:'MOEMOA_PUBLIC_GENERAL_20261011_01',snapshot}:name==='get_memory_relationship'?{self:false,following:false,blocked:false}:null;
    return r.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null})});
  });
  await page.goto('/public/home/?id='+id+'&section=shelf%3Asource');
  await expect(page.getByRole('heading',{name:'Public collection',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Title shelf Approved shelf/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.public-title-shelf img')).toHaveCount(1);
  await expect(page.getByText('Some covers are unavailable.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Healthy approved title · title information and your own records',exact:true})).toBeVisible();
  expect(calls).not.toContain('get_memory_minihome');expect(calls).not.toContain('list_memory_minihome_shelves');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.cache/collection-document-audit/public-partial-${width}.png`,fullPage:true});}
  await context.addInitScript(user=>localStorage.setItem('moemoa.e2e.mockSession.v1',JSON.stringify({user:{id:user},access_token:'local-test-token'})),USER);
  await page.goto('/?panel=sharing');await page.getByLabel('Public nickname',{exact:true}).fill('Preview owner');
  await page.getByLabel('Approved shelf · 2',{exact:false}).check();
  await expect(page.getByLabel('Public shelf title',{exact:true})).toHaveValue('Approved shelf');
  await page.getByRole('button',{name:'Preview public home',exact:true}).click();
  await expect(page.locator('.publication-review .public-title-shelf img')).toHaveCount(1);
  await page.getByLabel('I reviewed this public home',{exact:false}).check();
  await expect(page.getByRole('button',{name:'Publish public home',exact:true})).toBeDisabled();
  expect(calls).not.toContain('publish_memory_minihome');
});
