import {expect,test,type Page} from '@playwright/test';
async function start(page:Page,path='/') {
  await page.addInitScript(()=>{localStorage.setItem('ui:locale:v1',JSON.stringify('en'));(window as any).__navigationWindow=crypto.randomUUID();});
  await page.route('https://**/*',r=>r.abort());await page.goto(path);await expect(page.locator('.top-nav')).toHaveCount(1);
  await page.evaluate(()=>{(window as any).__navigationHeader=document.querySelector('.top-nav');});
  return page.evaluate(()=>(window as any).__navigationWindow);
}
async function retained(page:Page,marker:string){expect(await page.evaluate(()=>(window as any).__navigationWindow)).toBe(marker);expect(await page.evaluate(()=>(window as any).__navigationHeader===document.querySelector('.top-nav'))).toBe(true);}
async function dataButton(page:Page){await page.locator('.auth-trigger:visible').click();await expect(page.locator('.auth-sheet__data-link')).toBeEnabled();return page.locator('.auth-sheet__data-link');}

test('primary navigation preserves document and the same header',async({page})=>{
  const marker=await start(page);let documents=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++;});
  await page.locator('.top-nav__links--routes').getByRole('link',{name:'Titles',exact:true}).click();await expect(page).toHaveURL(/\/titles\/$/);await expect(page.locator('.title-collection h1')).toBeVisible();await retained(page,marker);
  await expect(page.locator('.top-nav__links--routes').getByRole('link',{name:'Titles',exact:true})).toHaveAttribute('aria-current','page');
  await page.locator('.top-nav__links--routes').getByRole('link',{name:'Memories',exact:true}).click();await expect(page).toHaveURL(/\/archive\/$/);await expect(page.locator('.memory-archive')).toBeVisible();await retained(page,marker);
  await page.goBack();await expect(page).toHaveURL(/\/titles\/$/);await expect(page.locator('.title-collection h1')).toBeVisible();await retained(page,marker);
  await page.goForward();await expect(page).toHaveURL(/\/archive\/$/);await retained(page,marker);expect(documents).toBe(0);
});
test('clicking the same address keeps the current content and header',async({page})=>{
  const marker=await start(page,'/titles/');await expect(page.locator('.title-collection h1')).toBeVisible();
  await page.evaluate(()=>{(window as any).__navigationContent=document.querySelector('.title-collection');});
  await page.locator('.top-nav__links--routes').getByRole('link',{name:'Titles',exact:true}).click();await page.waitForTimeout(150);await retained(page,marker);
  expect(await page.evaluate(()=>(window as any).__navigationContent===document.querySelector('.title-collection'))).toBe(true);
});
test('account button uses the same document instead of reloading it',async({page})=>{
  const marker=await start(page);await (await dataButton(page)).click();await expect(page).toHaveURL(/\/data\/$/);await expect(page.locator('.data-grid')).toBeVisible();await retained(page,marker);
  await expect(page.locator('.data-menu-panel--manage')).toHaveCount(0);
});
test('slow page preparation leaves the current page and header visible',async({page})=>{
  const marker=await start(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r);let requested!:()=>void;const started=new Promise<void>(r=>requested=r);
  await page.route('**/titles/',async r=>{if(r.request().resourceType()==='fetch'){requested();await gate;}await r.continue();});
  const click=page.locator('.top-nav__links--routes').getByRole('link',{name:'Titles',exact:true}).click({noWaitAfter:true});await started;
  await expect(page.locator('.bookshelf-page')).toBeVisible();await expect(page.locator('[data-app-content]')).toHaveAttribute('inert','');await retained(page,marker);release();await click;await expect(page).toHaveURL(/\/titles\/$/);await expect(page.locator('.title-collection h1')).toBeVisible();await expect(page.locator('[data-app-content]')).not.toHaveAttribute('inert','');await retained(page,marker);
});
test('unsaved shelf blocks programmatic navigation and rejected Back without losing URL or input',async({page})=>{
  const marker=await start(page,'/titles/');await page.locator('.top-nav__links--routes').getByRole('link',{name:'Collection',exact:true}).click();await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button',{name:'Create title shelf',exact:true}).click();await page.getByLabel('Shelf name',{exact:true}).fill('Synthetic retained draft');
  await page.locator('.top-nav__brand').click();await page.locator('.bookshelf-page .channel-heading h1 a').click();
  await expect(page.getByLabel('Shelf name',{exact:true})).toHaveValue('Synthetic retained draft');await retained(page,marker);
  let dialogs=0;const decline=async(d:any)=>{dialogs++;await d.dismiss();};page.on('dialog',decline);
  await (await dataButton(page)).click();await expect(page.getByLabel('Shelf name',{exact:true})).toHaveValue('Synthetic retained draft');await expect(page).toHaveURL(/\/$/);expect(dialogs).toBe(1);
  await page.goBack();await expect.poll(()=>dialogs).toBe(2);await expect(page).toHaveURL(/\/$/);await expect(page.getByLabel('Shelf name',{exact:true})).toHaveValue('Synthetic retained draft');await retained(page,marker);
  page.off('dialog',decline);page.once('dialog',d=>d.accept());await page.goBack();await expect(page).toHaveURL(/\/titles\/$/);await expect(page.locator('.title-collection h1')).toBeVisible();await retained(page,marker);
});
test('theme and language remain applied with a single menu after repeated soft navigation',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('ui:locale:v1',JSON.stringify('ko'));localStorage.setItem('ui:theme:v1',JSON.stringify('dark'));(window as any).__navigationWindow=crypto.randomUUID();});
  await page.route('https://**/*',r=>r.abort());await page.goto('/');await expect(page.locator('.top-nav')).toHaveCount(1);await page.evaluate(()=>{(window as any).__navigationHeader=document.querySelector('.top-nav');});const marker=await page.evaluate(()=>(window as any).__navigationWindow);
  for(const [label,path] of [['작품','titles/'],['기억','archive/'],['컬렉션','']]){await page.locator('.top-nav__links--routes').getByRole('link',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp('/'+path+'$'));await expect(page.locator('html')).toHaveAttribute('lang','ko');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await retained(page,marker);}
  await page.getByRole('button',{name:/언어/}).first().click();await page.locator('.data-menu-locale-option').filter({hasText:'EN'}).click();
  await expect(page.locator('.bookshelf-page .channel-header')).toContainText('Collection');await expect(page.locator('html')).toHaveAttribute('lang','en');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.cache/navigation-stability/menu-${width}.png`,fullPage:true});}
});
test('a newer destination cancels slow preparation without discarding the header',async({page})=>{
  const marker=await start(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r);let requested!:()=>void;const started=new Promise<void>(r=>requested=r);
  await page.route('**/titles/',async r=>{if(r.request().resourceType()==='fetch'){requested();await gate;}await r.continue().catch(()=>{});});
  await page.locator('.top-nav__links--routes').getByRole('link',{name:'Titles',exact:true}).click({noWaitAfter:true});await started;
  await page.locator('.top-nav__links--routes').getByRole('link',{name:'Memories',exact:true}).click();await expect(page).toHaveURL(/\/archive\/$/);release();await page.waitForTimeout(100);await expect(page).toHaveURL(/\/archive\/$/);await retained(page,marker);await expect(page.locator('[data-app-content]')).not.toHaveAttribute('inert','');
});
