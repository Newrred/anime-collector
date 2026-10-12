import {expect,test} from '@playwright/test';
import {adapters,mockPublication,seedOwner} from './helpers/publicationFixture';
import {seedTitleCollection} from './helpers/titleCollectionFixture';

for(const width of [1440,390,320])test(`refinement keeps title data and prioritizes visuals at ${width}px`,async({page})=>{
  await seedTitleCollection(page);await page.setViewportSize({width,height:900});await page.goto('/titles/');
  await expect(page.locator('[data-title-key]')).toHaveCount(3);
  await expect(page.locator('.title-album-card button')).toHaveCount(0);
  await expect(page.locator('.title-album-card .btn')).toHaveCount(0);
  const single=await page.locator('[data-title-key="PRIVATE:private-one"] .title-album-card__preview').boundingBox();
  const triple=await page.locator('[data-title-key="ANILIST:154587"] .title-album-card__preview').first().boundingBox();
  expect(single!.width).toBeGreaterThan(triple!.width*2.5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/memory/new/');
  await expect(page.locator('.top-nav__memory-action')).toHaveCount(0);
  const input=await page.locator('#memory-title-input').boundingBox();
  expect(input!.y).toBeLessThan(650);
  await page.goto('/data/');
  await expect(page.locator('#manual-tools')).toBeHidden();
  const backup=page.getByRole('button',{name:'파일 백업',exact:true});await backup.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#manual-tools')).toBeVisible();
  await expect(page.locator('.sync-card')).toBeHidden();
  await page.getByRole('button',{name:'이 기기',exact:true}).click();
  await expect(page.locator('.status-panel')).toBeVisible();
  await page.goto('/data/#manual-tools');
  await expect(page.locator('#manual-tools')).toBeVisible();
  await page.goto('/data/#account-privacy');
  await expect(page.getByRole('button',{name:'개인정보',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('switching minihome tasks preserves edits and follows deep links',async({page,context})=>{
  await adapters(context);const backend=mockPublication();await backend.attach(context);await seedOwner(page);
  await page.goto('/minihome/');await page.getByLabel('Public nickname',{exact:true}).fill('Retained synthetic draft');
  await page.getByLabel('Public introduction',{exact:true}).fill('This draft must survive task switching.');
  const nav=page.getByRole('navigation',{name:'Minihome tasks'});
  await nav.getByRole('button',{name:'Following',exact:true}).click();
  await expect(page.getByLabel('Public nickname',{exact:true})).toBeHidden();
  await expect(page.getByRole('heading',{name:'My following',exact:true})).toBeVisible();
  await nav.getByRole('button',{name:'Edit home',exact:true}).click();
  await expect(page.getByLabel('Public nickname',{exact:true})).toHaveValue('Retained synthetic draft');
  await expect(page.getByRole('textbox',{name:'Public introduction',exact:true})).toHaveValue('This draft must survive task switching.');
  await page.getByLabel('Public nickname',{exact:true}).fill('');await page.getByRole('textbox',{name:'Public introduction',exact:true}).fill('');
  await page.goto('/minihome/#following');await expect(page.getByRole('heading',{name:'My following',exact:true})).toBeVisible();
  await expect(nav.getByRole('button',{name:'Following',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('invalid public links have an exit, transient failures have retry',async({page,context})=>{
  await adapters(context);const backend=mockPublication();await backend.attach(context);
  for(const surface of ['board','home']) {
    await page.goto(`/public/${surface}/?id=invalid`);
    await expect(page.getByRole('button',{name:'Try again',exact:true})).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Return to Collection →',exact:true})).toBeVisible();
  }
  expect(backend.calls.some(call=>call.name.startsWith('read_memory_'))).toBe(false);
  backend.control.readError=true;
  await page.goto('/public/board/?id=22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
  backend.control.readError=false;await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('link',{name:'Return to Collection →',exact:true})).toBeVisible();
});

test('help distinguishes enabled sharing and keeps long information optional',async({page,context})=>{
  await adapters(context);await page.goto('/help/');
  await expect(page.locator('.help-center__notice-body').first()).toBeHidden();
  await page.locator('.help-center__card > summary').filter({hasText:'Minihome'}).click();
  await expect(page.locator('.help-center__card[open]')).toContainText('Accounts that complete signup verification');
  await expect(page.locator('.help-center__card[open]')).not.toContainText('not yet generally available');
});

test('moderator access denial does not offer repeated refresh',async({page,context})=>{
  await adapters(context);const backend=mockPublication();await backend.attach(context);await seedOwner(page);
  await context.route('**/__publication-test/rpc/list_memory_pending_content',route=>route.fulfill({json:{data:null,error:{message:'MODERATOR_REQUIRED'}}}));
  await page.goto('/moderation/');
  await expect(page.getByRole('alert')).toContainText('This account cannot review public content');
  await expect(page.getByRole('button',{name:'Refresh review queue',exact:true})).toHaveCount(0);
});

test('a guest home explains sign-in without empty relationship and safety tasks',async({page,context})=>{
  await adapters(context);await page.goto('/minihome/');
  await expect(page.getByText('Sign in to choose your public home.',{exact:false})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Minihome tasks'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Account',exact:true})).toBeVisible();
});
