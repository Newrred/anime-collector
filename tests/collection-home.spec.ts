import { expect, test } from '@playwright/test';
import { installAppState } from './helpers/appState';
import { adapters } from './helpers/publicationFixture';
const USER='11111111-1111-4111-8111-111111111111', HOME='55555555-5555-4555-8555-555555555555';
const animeId='anime:15151515-1515-4151-8151-151515151515', revisionId='asset:'+'c'.repeat(40);
const cover='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%235f6c91"/%3E%3C/svg%3E';

test('an unavailable saved Board can be explicitly deselected before a fresh title shelf preview',async({page,context})=>{
 await installAppState(page,{locale:'en'});await adapters(context);
 const gone='88888888-8888-4888-8888-888888888888';
 const saved={nickname:'Existing owner',bio:'',entries:[{publicationId:gone}]};
 let prepared:any=null,rejected=0,publishes=0;
 await context.addInitScript(({user,cover})=>{
  localStorage.setItem('moemoa.e2e.mockSession.v1',JSON.stringify({user:{id:user},access_token:'local-test-token'}));
  (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.collectionHome=true;
  (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.resolveCover=async()=>cover;
 },{user:USER,cover});
 await context.route('**/__publication-test/rpc/*',async route=>{
  const name=route.request().url().split('/').at(-1),args=route.request().postDataJSON();let data:any=null,error:any=null;
  if(name==='get_memory_minihome')data={id:HOME,revision:4,published:true,visible:false,selection:saved};
  if(name==='list_memory_minihome_boards')data={boards:[],next:null};
  if(name==='list_memory_minihome_shelves')data={enabled:true,shelves:[{sourceId:'shelf-a',sourceVersion:1,name:'Archive test',titles:[{titleKey:'ANILIST:1313',animeId,title:'Catalog only title',visual:{type:'CATALOG_COVER',revisionId}}]}]};
  if(name==='prepare_memory_minihome'){
   prepared=args.p_selection;
   if(prepared.entries.some((e:any)=>e.publicationId===gone)){rejected++;error={message:'PUBLICATION_UNAVAILABLE'};}
   else data={id:HOME,revision:5,reviewHash:'a'.repeat(64),policyRevision:'MOEMOA_PUBLIC_GENERAL_20261011_01',snapshot:{schemaVersion:2,nickname:prepared.nickname,bio:prepared.bio,entries:[{kind:'TITLE_SHELF',sectionId:'shelf:shelf-a',snapshot:{schemaVersion:1,title:prepared.entries[0].title,titles:[{animeId,title:'Catalog only title',visual:{type:'CATALOG_COVER',revisionId}}]}}]}};
  }
  if(name==='publish_memory_minihome')publishes++;
  await route.fulfill({contentType:'application/json',body:JSON.stringify({data,error})});
 });
 await page.goto('/?panel=sharing');
 await expect(page.locator('.collection-sharing-order')).toContainText('Existing public Board · check source');
 await page.getByLabel('Archive test · 1',{exact:true}).check();
 await page.getByLabel('Public shelf title',{exact:true}).fill('Title preview');
 await page.getByRole('button',{name:'Preview public home',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();expect(rejected).toBe(1);
 await page.locator('.collection-sharing-order li').filter({hasText:'Existing public Board · check source'}).getByRole('button',{name:'Remove selection',exact:true}).click();
 await expect(page.getByLabel('Public shelf title',{exact:true})).toHaveValue('Title preview');
 await page.getByRole('button',{name:'Preview public home',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Title preview',exact:true})).toBeVisible();
 await expect(page.getByLabel('I reviewed this public home',{exact:false})).not.toBeChecked();
 expect(prepared.entries).toHaveLength(1);expect(prepared.entries[0].kind).toBe('TITLE_SHELF');expect(publishes).toBe(0);expect(saved.entries[0].publicationId).toBe(gone);
});

test('one owner Collection renders an existing shelf and explicitly connected Board; unlink keeps originals', async ({ page }) => {
  await installAppState(page,{locale:'ko'});
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/');
  const sources=await page.evaluate(async()=>{
    const {getPlatformMemoryRuntime}=await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime=await getPlatformMemoryRuntime();
    const card=await runtime.createCard({titleChoice:{kind:'PRIVATE_TITLE',displayTitle:'합성 작품'},note:'보드의 기억',systemDesignSpec:{version:1,templateId:'memory-gradient',paletteId:'mint-dusk',patternSeed:'collection',titleLayout:'BOTTOM_LEFT',genreTokens:[]}});
    const board=await runtime.createBoard({title:'장면 모음',description:'선택한 기억'});
    await runtime.addCardToBoard(board.id,card.cardId);
    const owner=await runtime.initialize();
    const {saveBookshelf}=await import('/src/features/bookshelf/bookshelfSettings.js');
    saveBookshelf("local",{shelves:[{id:'existing-shelf',name:'다시 볼 작품',titleKeys:['PRIVATE:'+card.privateTitleId]}]});
    return {boardId:board.id,ownerId:owner.id,cardId:card.cardId};
  });
  await page.reload();
  await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
  await expect(page.locator('.collection-groups').getByRole('button',{name:'작품 선반 다시 볼 작품'})).toBeVisible();
  await page.getByRole('button',{name:'+ 이미지 보드 연결',exact:true}).click();
  await page.getByLabel('컬렉션에 놓을 이미지 보드').selectOption(sources.boardId);
  await page.getByRole('button',{name:'컬렉션에 연결',exact:true}).click();
  await expect(page.locator('.collection-board .memory-boards__cards li')).toHaveCount(1);
  const boardEditor=page.locator('.collection-board');
  await boardEditor.locator('.memory-boards__section-heading button[aria-expanded]').click();
  await boardEditor.locator('.memory-boards__title-input').fill('아직 저장하지 않은 이름');
  await expect(page.locator('.collection-groups').getByRole('button',{name:'전체',exact:true})).toBeDisabled();
  await boardEditor.locator('.memory-boards__section-heading button[aria-expanded]').click();
  await expect(page.locator('.collection-groups').getByRole('button',{name:'전체',exact:true})).toBeEnabled();
  await boardEditor.locator('.memory-boards__section-heading button[aria-expanded]').click();
  await boardEditor.locator('.memory-boards__title-input').fill('장면 모음 · 편집');
  await boardEditor.locator('.memory-boards__edit button[type=submit]').click();
  await expect(page.locator('.collection-groups').getByRole('button',{name:'이미지 보드 장면 모음 · 편집'})).toBeVisible();
  await page.locator('.collection-groups').getByRole('button',{name:'전체',exact:true}).click();
  await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
  await expect(page.locator('.collection-board-overview .board-collection')).toHaveCount(1);
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.collection-board-overview').scrollIntoViewIfNeeded();
    await expect(page.locator('.collection-board-overview .memory-visual')).toHaveCount(1);
    await page.screenshot({path:`.cache/collection-home-realignment-20261013/owner-${width}.png`,fullPage:true});
  }
  await page.reload();
  await expect(page.locator('.collection-board-overview .board-collection')).toHaveCount(1);
  await page.locator('.collection-groups').getByRole('button',{name:'이미지 보드 장면 모음 · 편집'}).click();
  await page.getByRole('button',{name:'컬렉션에서만 빼기 · 원본 유지',exact:true}).click();
  await expect(page.locator('.collection-board-overview .board-collection')).toHaveCount(0);
  const original=await page.evaluate(async id=>{
    const {getPlatformMemoryRuntime}=await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    return (await getPlatformMemoryRuntime()).getBoard(id);
  },sources.boardId);
  expect(original?.items[0].bundle.card.id).toBe(sources.cardId);
  await page.getByRole('button',{name:'공개 설정',exact:true}).click();
  await expect(page.locator('.collection-task')).toContainText('현재 환경에서는 공개 설정이 비활성화되어 있습니다.');
  await expect(page.locator('.bookshelf-tile')).toHaveCount(0);
});

test('typed public shelf hydrates, needs fresh consent, publishes, and visitor never loads private sources',async({page,context})=>{
 await installAppState(page,{locale:'en'});await adapters(context);
 const title={animeId,title:'Catalog only title',visual:{type:'CATALOG_COVER',revisionId}};
 const saved={schemaVersion:2,nickname:'Existing owner',bio:'Public bio',entries:[{kind:'TITLE_SHELF',sourceId:'shelf-a',sourceVersion:4,title:'Public favorites',titles:[{titleKey:'ANILIST:1313',animeId,revisionId,catalogTitle:title.title}]}]};
 let selection:any=saved, published:any=null, preview:any=null, revision=4, calls:string[]=[], brokenCover=false;
 await context.addInitScript(({user,cover})=>{
  localStorage.setItem('moemoa.e2e.mockSession.v1',JSON.stringify({user:{id:user},access_token:'local-test-token'}));
  (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.collectionHome=true;
  (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__.resolveCover=async()=>'/__collection-cover.svg?t='+Date.now();
 },{user:USER,cover});
 await context.route('**/__collection-cover.svg*',route=>route.fulfill({status:brokenCover?404:200,headers:{'Cache-Control':'no-store'},contentType:'image/svg+xml',body:brokenCover?'':`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#5f6c91"/></svg>`}));
 await context.route('**/__publication-test/rpc/*',async route=>{
  const name=route.request().url().split('/').at(-1)!;calls.push(name);const args=route.request().postDataJSON();let data:any=null;
  if(name==='get_memory_minihome')data={id:HOME,revision,published:Boolean(published),visible:Boolean(published),selection};
  if(name==='list_memory_minihome_boards')data={boards:[],next:null};
  if(name==='list_memory_minihome_shelves')data={enabled:true,shelves:[{sourceId:'shelf-a',sourceVersion:4,name:'PRIVATE SHELF NAME',titles:[{...title,titleKey:'ANILIST:1313'}]}]};
  if(name==='prepare_memory_minihome'){selection=args.p_selection;revision++;preview={schemaVersion:2,nickname:selection.nickname,bio:selection.bio,entries:[{kind:'TITLE_SHELF',sectionId:'shelf:shelf-a',snapshot:{schemaVersion:1,title:selection.entries[0].title,titles:[title]}}]};data={id:HOME,revision,reviewHash:'a'.repeat(64),policyRevision:'MOEMOA_PUBLIC_GENERAL_20261011_01',snapshot:preview};}
  if(name==='publish_memory_minihome'){published=preview;revision++;data={id:HOME,revision,published:true,visible:true};}
  if(name==='read_memory_minihome')data=published?{id:HOME,...published}:null;
  if(name==='get_memory_relationship')data={self:true,following:false,blocked:false};
  await route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null})});
 });
 await page.goto('/?panel=sharing');
 await expect(page.getByLabel('Public nickname',{exact:true})).toHaveValue('Existing owner');
 await expect(page.getByLabel('Public shelf title',{exact:true})).toHaveValue('Public favorites');
 expect(calls.filter(c=>c==='publish_memory_minihome')).toHaveLength(0);
 brokenCover=true;
 await page.getByRole('button',{name:'Preview public home',exact:true}).click();
 await expect(page.getByRole('button',{name:'Publish public home',exact:true})).toBeDisabled();
 await page.getByLabel('I reviewed this public home',{exact:false}).check();
 await expect(page.getByRole('button',{name:'Publish public home',exact:true})).toBeDisabled();
 await expect(page.getByText('Some covers are unavailable.',{exact:true})).toBeVisible();
 brokenCover=false;
 await page.getByRole('button',{name:'Back to selection',exact:true}).click();
 await page.getByRole('button',{name:'Preview public home',exact:true}).click();
 await expect(page.getByLabel('I reviewed this public home',{exact:false})).not.toBeChecked();
 await page.getByLabel('I reviewed this public home',{exact:false}).check();
 await expect(page.getByRole('button',{name:'Publish public home',exact:true})).toBeEnabled();
 await page.screenshot({path:'.cache/collection-home-realignment-20261013/sharing-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Publish public home',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open public home',exact:true})).toBeVisible();
 const before=calls.length;
 await page.goto('/public/home/?id='+HOME);
 await expect(page.getByRole('heading',{name:'Public favorites',exact:true})).toBeVisible();
 await expect(page.getByText('Catalog only title',{exact:true})).toBeVisible();
 await expect(page.getByText('PRIVATE SHELF NAME',{exact:true})).toHaveCount(0);
 expect(calls.slice(before)).not.toContain('get_memory_minihome');
 expect(calls.slice(before)).not.toContain('list_memory_minihome_shelves');
 await page.screenshot({path:'.cache/collection-home-realignment-20261013/public-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.cache/collection-home-realignment-20261013/public-mobile.png',fullPage:true});
});
