import {expect,test,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {seedTitleCollection} from '../helpers/titleCollectionFixture';
import {adapters,mockPublication,seedOwner,choose,publishSelected} from '../helpers/publicationFixture';

test.skip(!process.env.MOEMOA_COMPARISON_PHASE,'Explicit, synthetic local comparison only.');
const phase=process.env.MOEMOA_COMPARISON_PHASE!;
const output=process.env.MOEMOA_COMPARISON_DIR!;
const pub='22222222-2222-4222-8222-222222222222';
const caseId='66666666-6666-4666-8666-666666666666';

async function capture(page:Page,name:string,width:number,theme='light') {
  await page.evaluate(async()=>{
    await document.fonts.ready;
    for(const image of document.images)image.loading='eager';
    await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});})));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  mkdirSync(join(output,'screens'),{recursive:true});
  const key=`${name}-${width}-${theme}`;
  await page.screenshot({path:join(output,'screens',`${phase}-${key}.png`),fullPage:true,animations:'disabled'});
  const metrics=await page.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight,
    visibleButtons:Array.from(document.querySelectorAll('button')).filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).length}));
  writeFileSync(join(output,'screens',`${phase}-${key}.json`),JSON.stringify({phase,key,name,theme,...metrics},null,2));
}

for(const width of [1440,390])test(`same fixture comparison at ${width}px`,async({page,context})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:900});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();
  });
  await seedTitleCollection(page);
  await page.goto('/titles/');await expect(page.locator('[data-title-key]')).toHaveCount(3);
  await capture(page,'titles-memory',width);
  if(width<700)await page.getByRole('button',{name:'정보와 탐색 펼치기'}).click();
  await page.getByRole('radio',{name:'표지 보기',exact:true}).click();
  await capture(page,'titles-poster',width);
  await page.goto('/memory/new/');await expect(page.locator('#memory-title-input')).toBeVisible();
  await capture(page,'composer',width);
  await page.goto('/data/');await expect(page.locator('.sync-card')).toBeVisible();
  await capture(page,'data-account',width);
  if(phase==='after')await page.getByRole('button',{name:'이 기기',exact:true}).click();
  await capture(page,'data-device',width);
  if(phase==='after')await page.getByRole('button',{name:'파일 백업',exact:true}).click();
  await capture(page,'data-backups',width);
  await page.goto('/help/');await expect(page.locator('.help-center')).toBeVisible();
  await capture(page,'help',width);
  await page.goto('/tier/');await expect(page.locator('.tier-summary-card')).toBeVisible();
  await capture(page,'tier',width);
  await page.goto('/public/board/?id=invalid');await expect(page.locator('.public-page-state')).toBeVisible();
  await capture(page,'public-invalid',width);
  // Same saved English preference; baseline signup ignores it, refinement inherits it.
  await page.addInitScript(()=>localStorage.setItem('ui:locale:v1',JSON.stringify('en')));
  await context.route('http://127.0.0.1:54399/**',route=>route.fulfill({json:{enabled:true,version:'simple-signup-2026-10-10',termsVersion:'terms-2026-10-10',privacyVersion:'privacy-2026-10-10',countries:[{country:'KR',minimumAge:14},{country:'US',minimumAge:13},{country:'TH',minimumAge:13}]}}));
  await page.goto('/auth/start/');await expect(page.locator('#signup-country')).toBeEnabled();
  await capture(page,'signup',width);
  await page.addInitScript(()=>localStorage.setItem('ui:theme:v1',JSON.stringify('dark')));
  await page.goto('/memory/new/');await expect(page.locator('#memory-title-input')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await capture(page,'composer',width,'dark');
  await page.goto('/help/');await expect(page.locator('.help-center')).toBeVisible();
  await capture(page,'help',width,'dark');
  await page.goto('/data/');await expect(page.locator('.sync-card')).toBeVisible();
  await capture(page,'data-account',width,'dark');
});

for(const width of [1440,390])test(`same synthetic owner and review comparison at ${width}px`,async({page,context})=>{
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  await page.setViewportSize({width,height:900});
  await adapters(context);const backend=mockPublication();await backend.attach(context);
  await context.route('**/__publication-test/rpc/list_memory_safety',route=>route.fulfill({json:{data:{items:[
    {id:caseId,targetId:pub,targetKind:'board',type:'NOTICE',action:'HIDE',reason:'Synthetic example: a reported card is temporarily hidden while its context is reviewed.',appealed:false},
    {id:'77777777-7777-4777-8777-777777777777',targetId:pub,targetKind:'board',type:'REPORT',status:'CLOSED'}],next:null},error:null}}));
  await seedOwner(page);
  page.on('dialog',dialog=>dialog.accept());
  await choose(page,true);await capture(page,'board-selection',width);
  await page.getByRole('button',{name:'Preview selected memories',exact:true}).click();
  await expect(page.getByLabel('I have reviewed these memories',{exact:false})).toBeVisible();
  await capture(page,'board-preview',width);
  await page.getByRole('button',{name:'Back to selection',exact:true}).click();await publishSelected(page);
  await page.getByRole('link',{name:'My public home',exact:true}).click();
  await page.getByLabel('Public nickname',{exact:true}).fill('A small collection');
  await page.getByLabel('Public introduction',{exact:true}).fill('Synthetic example: moments worth keeping.');
  await page.getByLabel('Display this Board',{exact:true}).check();
  await capture(page,'minihome-edit',width);
  await page.goto('/minihome/#following');
  await expect(page.getByRole('heading',{name:'My following',exact:true})).toBeVisible();
  await capture(page,'minihome-following',width);
  await page.goto('/minihome/#safety');await expect(page.getByText('Public content hidden',{exact:true})).toBeVisible();
  await capture(page,'minihome-safety',width);
  if(phase==='after'){
    await page.locator('.safety-notice > details > summary').click();
    await page.getByRole('button',{name:'Request appeal',exact:true}).click();
  }
  await page.getByLabel('Appeal reason',{exact:true}).fill('Synthetic example: please review the context again.');
  await capture(page,'safety-appeal',width);
  await context.route('**/__publication-test/rpc/list_memory_pending_content',route=>route.fulfill({json:{data:{items:[],next:null},error:null}}));
  await context.route('**/__publication-test/rpc/list_memory_moderation',route=>route.fulfill({json:{data:{items:[{id:caseId,target:pub,kind:'board',reviewType:'REPORT',status:'RECEIVED',category:'OTHER',revision:0,targetRevision:0,note:'Synthetic report example.',appeals:[]}],next:null},error:null}}));
  await context.route('**/__publication-test/rpc/read_memory_moderation_audit',route=>route.fulfill({json:{data:[],error:null}}));
  // Discard only synthetic test draft before the next screenshot route.
  await page.goto('/moderation/');
  await page.getByRole('button',{name:'Reports',exact:true}).click();
  await expect(page.getByRole('button',{name:new RegExp(caseId.slice(0,8))})).toBeVisible();
  await capture(page,'moderation',width);
  await page.getByRole('button',{name:new RegExp(caseId.slice(0,8))}).click();
  await expect(page.getByLabel('Report action',{exact:true})).toBeVisible();
  await capture(page,'moderation-detail',width);
});
