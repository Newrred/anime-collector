import {test,expect} from '@playwright/test';
test.skip(process.env.MOEMOA_SIMPLE_SIGNUP_E2E !== '1', 'Run with scripts/run-simple-signup-e2e.mjs (isolated mock backend).');
// Synthetic mock policy only: these values do not activate countries or assert legal eligibility.
// In particular, FR15/DE16 are injected exceptions, not automatic GDPR signup thresholds.
const policy={enabled:true,version:'simple-signup-2026-10-09',termsVersion:'terms-2026-10-09-draft',privacyVersion:'privacy-2026-10-09-draft',countries:[{country:'KR',minimumAge:14},{country:'PH',minimumAge:13},{country:'TH',minimumAge:13},{country:'US',minimumAge:13},{country:'GB',minimumAge:13},{country:'FR',minimumAge:15},{country:'DE',minimumAge:16}]};
const account='11111111-1111-4111-8111-111111111111';
const token=[{alg:'HS256',typ:'JWT'},{sub:account,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
async function mockBackend(page:any,{failSession=false,signupPolicy=policy}={}) {
 const calls:any[]=[];
 await page.route('**/api/signup?**',async(route:any)=>{
  const req=route.request(),action=new URL(req.url()).searchParams.get('action');calls.push({path:action,body:req.postData(),url:req.url()});
  if(action==='start')return route.fulfill({json:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'}});
  if(action==='session')return route.fulfill(failSession?{status:503,json:{error:'SIGNUP_DETAILS_EXPIRED'}}:{json:{session:{access_token:token,refresh_token:'test-refresh'},next:'/terms/'}});
  return route.fulfill({status:404});
 });
 await page.route('https://accounts.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Mock Google handoff</p>'}));
 await page.route('http://127.0.0.1:54399/**',async(route:any)=>{
  const request=route.request(),url=new URL(request.url());calls.push({path:url.pathname,body:request.postData(),url:request.url()});
  if(url.pathname.endsWith('/get_simple_signup_policy')) return route.fulfill({json:signupPolicy});
  if(url.pathname==='/auth/v1/authorize')return route.fulfill({contentType:'text/html',body:'<p>Mock Google handoff</p>'});
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:{id:account,email:'fixture@example.test',app_metadata:{provider:'google'},user_metadata:{}}}});
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:{id:account,email:'fixture@example.test'}});
  return route.fulfill({status:404,json:{message:'unmocked'}});
 });
 return calls;
}
async function fill(page:any,country='KR',dob='2000-10-09') {
 await expect(page.locator('#signup-country')).toBeEnabled();
 await page.selectOption('#signup-country',country);
 await page.fill('#signup-birthday',dob);
 await page.getByRole('checkbox').check();
 await expect(page.getByRole('button',{name:'Google로 계속'})).toBeEnabled();
}

test('new PH test documents keep one explicit checkbox, correct versions and mobile layout',async({page},info)=>{
 const signupPolicy={...policy,version:'simple-signup-2026-10-10-test',termsVersion:'terms-2026-10-10-test',privacyVersion:'privacy-2026-10-10-test'};
 const calls=await mockBackend(page,{signupPolicy});await page.setViewportSize({width:320,height:780});
 await page.goto('/auth/start/');await fill(page,'PH');
 const form=page.locator('.signup-panel form');
 await expect(form.getByRole('checkbox')).toHaveCount(1);await expect(form.locator('input,select,textarea')).toHaveCount(3);
 await expect(form.locator('.signup-consent')).toContainText('가입 연령 정보 처리');
 await expect(form.getByRole('link',{name:'이용약관',exact:true})).toHaveAttribute('href','/legal/terms-2026-10-10-test/');
 await expect(form.getByRole('link',{name:'가입 연령 정보 처리',exact:true})).toHaveAttribute('href','/legal/privacy-2026-10-10-test/#age-processing');
 await expect(form.getByText('테스트용 가입 문서입니다.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('signup-ph-new-documents-320.png'),fullPage:true});
 await page.selectOption('#signup-country','KR');await expect(page.getByRole('checkbox')).not.toBeChecked();
 await expect(form.locator('#signup-age-processing')).toHaveCount(0);
 await fill(page,'PH');await page.getByRole('button',{name:'Google로 계속'}).click();await expect(page).toHaveURL(/accounts.google.com/);
 const value=JSON.parse(calls.find(c=>c.path==='start').body).declaration;
 expect(value).toMatchObject({country:'PH',accepted:true,policyVersion:signupPolicy.version,termsVersion:signupPolicy.termsVersion,privacyVersion:signupPolicy.privacyVersion});
 expect(JSON.stringify(value)).not.toContain('2000-10-09');
 for(const name of ['terms','privacy']) {
  await page.goto(`/legal/${name}-2026-10-10-test/`);
  await expect(page.getByText('테스트용 가입 문서 · 운영 미적용',{exact:true})).toBeVisible();
  await expect(page.locator('input,select,textarea')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('below-age and missing terms stay before Google; Korean and English layouts fit mobile',async({page},info)=>{
 const calls=await mockBackend(page);await page.setViewportSize({width:390,height:844});
 await page.goto('/auth/start/');
 // Wait for the mocked policy and initial client hydration, not the loading button label.
 await expect(page.locator('#signup-country')).toBeEnabled({timeout:15000});
 await expect(page.locator('#signup-birthday')).toHaveValue('');
 await expect(page.getByRole('checkbox')).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Google로 계속'})).toBeDisabled();
 for(const country of ['KR','PH','TH','US','GB']) {
  await page.selectOption('#signup-country',country);
  await expect(page.locator('#signup-birthday-help')).not.toContainText(/\d+\s*세|age\s*\d+/);
 }
 await fill(page,'KR','2020-10-09');
 await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page.getByRole('alert')).toContainText('최소 가입 연령');
 expect(calls.some(c=>c.path==='start')).toBe(false);
 await page.fill('#signup-birthday','2000-10-09');await page.getByRole('checkbox').uncheck();
 await page.getByRole('button',{name:'Google로 계속'}).click();await expect(page.getByRole('alert')).toContainText('동의');
 await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toContainText('Keep your memories');
 await expect(page.locator('#signup-birthday-help')).toContainText('without sending your full birth date');
 await expect(page.locator('#signup-birthday-help')).not.toContainText(/age\s*\d+/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('signup-mobile.png'),fullPage:true});
});

test('synthetic FR13 policy keeps one terms checkbox and starts Google without DOB or extra verification fields',async({page})=>{
 // This mock checks policy-driven behavior, not whether FR13 may be enabled in production.
 const signupPolicy={...policy,countries:policy.countries.map(row=>row.country==='FR'?{...row,minimumAge:13}:row)};
 const fixedTime=new Date('2026-10-09T12:00:00Z');
 await page.clock.setFixedTime(fixedTime);
 const calls=await mockBackend(page,{signupPolicy});await page.goto('/auth/start/?next=/archive/');
 const form=page.locator('.signup-panel form');
 await expect(form.getByRole('checkbox')).toHaveCount(1);
 // Exact field inventory also rejects new minor/guardian/verification inputs of any type.
 await expect(form.locator('input,select,textarea')).toHaveCount(3);
 await expect(form.locator('select')).toHaveCount(1);
 await expect(form.locator('input[type="date"]')).toHaveCount(1);
 await expect(form.locator('input[type="email"],input[type="file"],input[type="tel"],input[type="password"]')).toHaveCount(0);
 await fill(page,'FR','2014-10-01');
 await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page.getByRole('alert')).toContainText('최소 가입 연령');
 expect(calls.filter(c=>c.path==='start')).toHaveLength(0);
 await page.fill('#signup-birthday','2013-10-01');
 await expect(form.getByRole('checkbox')).toHaveCount(1);
 await expect(form.locator('input,select,textarea')).toHaveCount(3);
 await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page).toHaveURL(/accounts.google.com/);
 const starts=calls.filter(c=>c.path==='start');expect(starts).toHaveLength(1);
 const payload=JSON.parse(starts[0].body);
 expect(Object.keys(payload).sort()).toEqual(['declaration','next']);
 expect(Object.keys(payload.declaration).sort()).toEqual(['accepted','age','country','createdAt','declaredOn','policyVersion','privacyVersion','termsVersion','version']);
 expect(payload).toMatchObject({declaration:{version:1,country:'FR',age:13,accepted:true,createdAt:fixedTime.getTime(),policyVersion:policy.version,termsVersion:policy.termsVersion,privacyVersion:policy.privacyVersion},next:'/archive/'});
 expect(JSON.stringify(starts)).not.toContain('2013-10-01');
 expect(JSON.stringify(starts)).not.toContain('2014-10-01');
});

test('country availability is shown before DOB; changing country clears details and consent',async({page})=>{
 const calls=await mockBackend(page);await page.goto('/auth/start/');
 await expect(page.locator('#signup-country')).toBeEnabled();
 await expect(page.locator('#signup-birthday')).toBeDisabled();
 await page.selectOption('#signup-country','CH');
 await expect(page.getByRole('status')).toContainText('이 국가의 가입 기준을 확인 중');
 await expect(page.locator('#signup-birthday')).toBeDisabled();
 await expect(page.getByRole('checkbox')).toBeDisabled();
 await expect(page.getByRole('button',{name:'Google로 계속'})).toBeDisabled();
 await page.getByRole('button',{name:'English',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Signup requirements for this country are being reviewed.');
 await page.getByRole('button',{name:'한국어',exact:true}).click();
 await fill(page,'KR');
 await page.selectOption('#signup-country','PH');
 await expect(page.locator('#signup-birthday')).toHaveValue('');
 await expect(page.getByRole('checkbox')).not.toBeChecked();
 await expect(page.locator('#signup-birthday')).toBeEnabled();
 await expect(page.getByRole('status')).toBeEmpty();
 expect(calls.some(c=>c.path==='start')).toBe(false);
 await fill(page,'PH');await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page).toHaveURL(/accounts.google.com/);
 expect(JSON.parse(calls.find(c=>c.path==='start').body).declaration.country).toBe('PH');
});

for(const scenario of [
 {name:'disabled policy',signupPolicy:{...policy,enabled:false},message:'지금은 새 가입을 준비 중'},
 {name:'changed documents',signupPolicy:{...policy,privacyVersion:'privacy-future'},message:'가입 기준이 변경'},
]) test(`${scenario.name} prevents personal input and Google requests`,async({page})=>{
 const calls=await mockBackend(page,{signupPolicy:scenario.signupPolicy});await page.goto('/auth/start/');
 await expect(page.getByRole('status')).toContainText(scenario.message);
 await page.selectOption('#signup-country','KR');
 await expect(page.locator('#signup-birthday')).toBeDisabled();
 await expect(page.getByRole('checkbox')).toBeDisabled();
 await expect(page.getByRole('button',{name:'Google로 계속'})).toBeDisabled();
 expect(calls.some(c=>c.path==='start')).toBe(false);
});

test('revision review cannot collect acceptance or replace the documents linked by signup',async({page},info)=>{
 const calls=await mockBackend(page);await page.setViewportSize({width:390,height:844});
 await page.goto('/legal/review/');
 await expect(page.getByRole('heading',{level:1})).toContainText('개정 검토');
 await expect(page.getByText('Review draft — not effective and not used for signup acceptance.')).toBeVisible();
 await expect(page.locator('#retention')).toContainText('6시간 이내 삭제 보장이 아니며');
 await expect(page.locator('#retention')).toContainText('테스트 환경에만 적용');
 await expect(page.locator('#retention')).toContainText('not a 6-hour deletion guarantee');
 await expect(page.locator('#quick-privacy')).toContainText('does not receive your Google password');
 await expect(page.locator('#quick-privacy a')).toHaveAttribute('href','mailto:godburgundy@gmail.com');
 for(const region of ['KR','PH','TH','US','EUROPE']) await expect(page.locator(`#region-${region}`)).toHaveCount(1);
 await expect(page.locator('#regions')).toContainText('not a finalized availability list or an acceptance form');
 await expect(page.locator('#signup-candidate')).toContainText('Keep one terms checkbox');
 await expect(page.locator('#signup-candidate')).toContainText('not a change to current availability');
 await expect(page.locator('#terms')).toContainText('You must be at least 13');
 await expect(page.locator('#terms')).toContainText('or 14 in Korea');
 await expect(page.locator('#terms')).toContainText('If the law requires parental permission');
 await expect(page.locator('#terms')).toContainText('무료');
 await expect(page.locator('#terms')).toContainText('미성년자');
 const ageCandidate=page.locator('#age-processing-candidate');
 await expect(ageCandidate).toContainText('This wording is not effective');
 await expect(ageCandidate).toContainText('This page collects no consent');
 await expect(ageCandidate).toContainText('이용약관과 위 가입 연령 정보 처리에 동의합니다');
 await expect(ageCandidate).toContainText('10 minutes');
 await expect(ageCandidate).toContainText('5 minutes');
 await expect(ageCandidate).toContainText('2 minutes');
 await expect(ageCandidate).toContainText('permitted device-only use remains available');
 await expect(ageCandidate.locator('a[href="#retention"]')).toHaveCount(2);
 await expect(page.locator('#privacy')).toContainText('Providers’ essential access logs are separate');
 for(const name of ['Pinterest','Instagram','TikTok']) await expect(page.locator('#service-examples').getByRole('heading',{name,exact:true})).toBeVisible();
 await expect(page.locator('#service-examples')).toContainText('current full terms were inaccessible');
 await expect(page.locator('#service-examples')).toContainText('2026-11-12');
 await expect(page.locator('#age-reference')).not.toHaveAttribute('open','');
 await expect(page.locator('#age-reference')).toContainText('Denmark (DK)');
 await expect(page.locator('#age-reference')).toContainText('Slovenia (SI)');
 await expect(page.locator('#age-reference')).toContainText('They are not MOEMOA availability rules');
 expect(await page.locator('form,input').count()).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('legal-review-mobile.png')});
 for(const width of [320,1280]) {
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#signup-candidate').screenshot({path:info.outputPath(`signup-candidate-${width}.png`)});
  await ageCandidate.screenshot({path:info.outputPath(`age-processing-candidate-${width}.png`)});
 }
 await page.getByRole('link',{name:'10/9 이용약관',exact:true}).click();
 await expect(page).toHaveURL(/\/legal\/terms-2026-10-09-draft\/$/);
 await expect(page.getByText('버전: terms-2026-10-09-draft', {exact:true})).toBeVisible();
 await page.goto('/auth/start/');
 await expect(page.getByRole('link',{name:'이용약관',exact:true})).toHaveAttribute('href','/legal/terms-2026-10-09-draft/');
 await expect(page.getByRole('link',{name:'개인정보 처리 안내',exact:true})).toHaveAttribute('href','/legal/privacy-2026-10-09-draft/');
 await page.goto('/legal/privacy-2026-10-09-draft/');
 const archivedPrivacy=await page.locator('main').innerText();
 await page.goto('/privacy/');
 expect(await page.locator('main').innerText()).toBe(archivedPrivacy);
 await expect(page.getByText('버전: privacy-2026-10-09-draft', {exact:true})).toBeVisible();
 expect(calls.some(c=>c.path==='start')).toBe(false);
});
test('simple Google handoff and completion restore session without DOB or tokens in URLs',async({page},info)=>{
 const calls=await mockBackend(page);await page.goto('/auth/start/?next=/terms/');await fill(page);
 await page.screenshot({path:info.outputPath('signup-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Google로 계속'}).click();await expect(page).toHaveURL(/accounts.google.com/);
 const start=calls.find(c=>c.path==='start');expect(JSON.parse(start.body)).toMatchObject({declaration:{country:'KR',accepted:true,termsVersion:'terms-2026-10-09-draft',privacyVersion:'privacy-2026-10-09-draft'},next:'/terms/'});expect(start.body).not.toContain('2000-10-09');
 await page.goto('/auth/complete/');await expect(page).toHaveURL(/\/terms\/$/);
 expect(calls.filter(c=>c.path==='session')).toHaveLength(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('moemoa.signup.pending.v1'))).toBeNull();
});
test('lost or expired handoff provides a safe restart without exposing session',async({page})=>{
 const calls=await mockBackend(page,{failSession:true});await page.goto('/auth/complete/');
 await expect(page.getByRole('alert')).toContainText('다시 시작');
 expect(calls.filter(c=>c.path==='session')).toHaveLength(1);
 expect(calls.filter(c=>c.path==='/auth/v1/token')).toHaveLength(0);
 await page.getByRole('link',{name:'다시 시작 · Start again'}).click();await expect(page).toHaveURL(/\/auth\/start\/$/);
});
test('provider cancellation clears pending declaration and URL payload',async({page})=>{
 const calls=await mockBackend(page);await page.goto('/auth/start/');await fill(page);await page.getByRole('button',{name:'Google로 계속'}).click();await expect(page).toHaveURL(/accounts.google.com/);
 await page.goto('/auth/complete/?error=GOOGLE_CANCELLED&error_description=private-provider-detail');
 await expect(page.getByRole('alert')).toContainText('cancelled');expect(page.url()).not.toContain('private-provider-detail');
 expect(await page.evaluate(()=>sessionStorage.getItem('moemoa.signup.pending.v1'))).toBeNull();
 expect(calls.some(c=>c.path==='session')).toBe(false);
});
