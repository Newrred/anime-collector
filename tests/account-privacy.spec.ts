import {test,expect} from '@playwright/test';
test.skip(process.env.MOEMOA_SIMPLE_SIGNUP_E2E!=='1','Run the isolated signup/privacy runner.');
const owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,email:'fixture@example.test',role:'authenticated',aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};
const token=[{alg:'HS256',typ:'JWT'},{sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const oldReceipt={policyVersion:'simple-signup-2026-10-09',termsVersion:'terms-2026-10-09-draft',privacyVersion:'privacy-2026-10-09-draft',country:'PH',recordedAt:'2026-10-09T10:00:00Z'};
const newReceipt={policyVersion:'simple-signup-2026-10-10-test',termsVersion:'terms-2026-10-10-test',privacyVersion:'privacy-2026-10-10-test',country:'PH',recordedAt:'2026-10-10T10:00:00Z'};
async function setup(page:any,{receipts=[newReceipt,oldReceipt],failDelete=false,failLogout=false,failReceipts=false}={}) {
 const calls:any[]=[];
 await page.addInitScript(({session})=>{
  localStorage.setItem('sb-127-auth-token',JSON.stringify(session));
  localStorage.setItem('ui:locale:v1',JSON.stringify('ko'));
  localStorage.setItem('account-privacy-test-unrelated','keep');
 },{session});
 await page.route('http://127.0.0.1:54399/**',async(route:any)=>{
  const req=route.request(),path=new URL(req.url()).pathname;calls.push({path,body:req.postData()});
  if(path==='/auth/v1/user')return route.fulfill({json:user});
  if(path==='/auth/v1/logout')return route.fulfill(failLogout?{status:503,json:{msg:'unavailable'}}:{status:204,body:''});
  if(path.endsWith('/get_my_simple_signup_receipts'))return route.fulfill(failReceipts?{status:503,json:{message:'private provider data'}}:{json:{receipts}});
  if(path.endsWith('/get_simple_signup_policy'))return route.fulfill({json:{enabled:false}});
  return route.fulfill({json:[]});
 });
 await page.route('**/api/account-delete',async(route:any)=>{
  calls.push({path:'delete',body:route.request().postData(),authorization:route.request().headers().authorization});
  return route.fulfill(failDelete?{status:503,json:{error:'ACCOUNT_DELETE_FAILED'}}:{json:{deleted:true}});
 });
 await page.goto('/data/');await expect(page.locator('#account-privacy')).toBeVisible({timeout:15000});
 return calls;
}

test('own receipt history keeps old and new documents distinct; only new PH receipt indicates processing consent',async({page},info)=>{
 await page.setViewportSize({width:320,height:780});const calls=await setup(page);
 const panel=page.locator('#account-privacy');
 await expect(panel.getByRole('link',{name:'동의한 이용약관'})).toHaveCount(2);
 await expect(panel.getByRole('link',{name:'동의한 이용약관'}).nth(0)).toHaveAttribute('href','/legal/terms-2026-10-10-test/');
 await expect(panel.getByRole('link',{name:'동의한 이용약관'}).nth(1)).toHaveAttribute('href','/legal/terms-2026-10-09-draft/');
 await expect(panel.locator('li').nth(0)).toContainText('가입 연령 정보 처리 동의');
 await expect(panel.locator('li').nth(1)).not.toContainText('가입 연령 정보 처리 동의');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();
 await expect(panel.getByRole('heading',{name:'이 계정을 탈퇴할까요?'})).toBeVisible();
 await expect(panel).toContainText('Google 계정 자체는 삭제하지 않습니다.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.screenshot({path:info.outputPath('account-delete-confirm-320.png')});
 await panel.getByRole('button',{name:'취소',exact:true}).click();
 expect(calls.filter(c=>c.path==='delete')).toHaveLength(0);
});

test('confirmed cloud deletion signs out and preserves unrelated local data',async({page})=>{
 const calls=await setup(page);const panel=page.locator('#account-privacy');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();
 await panel.getByRole('button',{name:'이 계정 삭제',exact:true}).click();
 await expect(page.getByRole('heading',{name:'계정을 삭제했습니다',exact:true})).toBeVisible();
 await expect(page.locator('#account-privacy')).toHaveCount(0);
 expect(calls.filter(c=>c.path==='delete')).toHaveLength(1);
 expect(JSON.parse(calls.find(c=>c.path==='delete').body)).toEqual({expectedUserId:owner,confirmed:true});
 expect(calls.find(c=>c.path==='delete').authorization).toBe(`Bearer ${token}`);
 expect(await page.evaluate(()=>localStorage.getItem('account-privacy-test-unrelated'))).toBe('keep');
 expect(await page.evaluate(()=>localStorage.getItem('sb-127-auth-token'))).toBeNull();
});

test('failed deletion keeps the account signed in and never reports completion',async({page})=>{
 const calls=await setup(page,{failDelete:true});const panel=page.locator('#account-privacy');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();await panel.getByRole('button',{name:'이 계정 삭제',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('탈퇴 완료를 확인하지 못했습니다.');
 await expect(page.getByRole('heading',{name:'계정을 삭제했습니다',exact:true})).toHaveCount(0);
 expect(calls.some(c=>c.path==='/auth/v1/logout')).toBe(false);
 expect(await page.evaluate(()=>localStorage.getItem('sb-127-auth-token'))).not.toBeNull();
 const previousReads=calls.filter(c=>c.path==='/auth/v1/user').length;
 await panel.getByRole('button',{name:'취소',exact:true}).click();
 await expect(panel.getByRole('button',{name:'계정 탈퇴',exact:true})).toBeVisible();
 expect(calls.filter(c=>c.path==='/auth/v1/user').length).toBeGreaterThan(previousReads);
});

test('logout failure after successful cloud deletion does not offer another deletion',async({page})=>{
 const calls=await setup(page,{failLogout:true});const panel=page.locator('#account-privacy');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();await panel.getByRole('button',{name:'이 계정 삭제',exact:true}).click();
 await expect(page.getByRole('heading',{name:'계정을 삭제했습니다',exact:true})).toBeVisible();
 await expect(panel.getByRole('alert')).toContainText('계정은 삭제됐지만');
 await expect(panel.getByRole('button',{name:'이 계정 삭제',exact:true})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'로그아웃 다시 시도'})).toBeVisible();
 expect(calls.filter(c=>c.path==='delete')).toHaveLength(1);
});

test('unknown receipt versions never become server-provided links or new consent',async({page})=>{
 await setup(page,{receipts:[{...newReceipt,termsVersion:'https://evil.test/stolen'}]});
 const panel=page.locator('#account-privacy');await expect(panel).toContainText('이 버전의 문서 링크는 준비 중');
 await expect(panel.locator('a[href*="evil.test"]')).toHaveCount(0);
 await expect(panel).not.toContainText('가입 연령 정보 처리 동의');
});

test('receipt lookup failure does not prevent deletion or expose provider errors',async({page})=>{
 await setup(page,{failReceipts:true});const panel=page.locator('#account-privacy');
 await expect(panel).toContainText('가입 기록을 불러오지 못했습니다.');
 await expect(panel).not.toContainText('private provider data');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();
 await expect(panel.getByRole('button',{name:'이 계정 삭제',exact:true})).toBeEnabled();
});

test('switching accounts during confirmation discards the old target and never deletes it',async({page})=>{
 const calls=await setup(page);const panel=page.locator('#account-privacy');
 await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();
 const other={...user,id:'22222222-2222-4222-8222-222222222222',email:'other@example.test'};
 const otherToken=[{alg:'HS256',typ:'JWT'},{sub:other.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await page.route('http://127.0.0.1:54399/auth/v1/user',route=>route.fulfill({json:other}));
 await page.evaluate(async({otherToken})=>{
  const {supabase}=await import('/src/lib/supabaseClient.js');
  await supabase.auth.setSession({access_token:otherToken,refresh_token:'other-refresh'});
 },{otherToken});
 await expect(panel).toContainText('other@example.test');
 await expect(panel.getByRole('button',{name:'계정 탈퇴',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'이 계정 삭제',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'계정을 삭제했습니다',exact:true})).toHaveCount(0);
 expect(calls.filter(c=>c.path==='delete')).toHaveLength(0);
});
