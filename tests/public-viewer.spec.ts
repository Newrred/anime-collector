import {test,expect} from '@playwright/test';
import sharp from 'sharp';
const A='11111111-1111-4111-8111-111111111111',B='99999999-9999-4999-8999-999999999999';
const P='22222222-2222-4222-8222-222222222222',H='55555555-5555-4555-8555-555555555555';
for(const kind of ['board','home']) for(const pending of [false,true]) {
 test(`viewer ${kind} ${pending?'switch during image':'logout after decode'} clears content`,async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(({A,P,H})=>{
   localStorage.setItem('ui:locale:v1',JSON.stringify('en'));
   localStorage.setItem('moemoa.e2e.mockSession.v1',JSON.stringify({user:{id:A},access_token:'synthetic-A'}));
   const revoked:string[]=[];(window as any).__viewerRevoked=revoked;
   const original=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{revoked.push(url);original(url);};
   const snapshot={schemaVersion:1,title:'A-only board',description:'',cards:[{id:'33333333-3333-4333-8333-333333333333',title:'A-only image',visual:{type:'USER_IMAGE',assetId:'44444444-4444-4444-8444-444444444444'}}]};
   (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__={authenticatedViewers:true,client:{rpc(name:string){
    const active=JSON.parse(localStorage.getItem('moemoa.e2e.mockSession.v1')||'null')?.user?.id===A;
    const data=name==='read_memory_publication'?(active?{id:P,...snapshot}:null)
      : name==='read_memory_minihome'?(active?{id:H,nickname:'A-only home',bio:'',entries:[{publicationId:P,snapshot}]}:null)
      :name==='get_memory_relationship'?{self:false,following:false,blocked:false}
      :name==='list_memory_safety'?{items:[],next:null}:null;
    const query:any={abortSignal(){return query;},then(resolve:any,reject:any){return Promise.resolve({data,error:null}).then(resolve,reject);}};return query;
   }}};
  },{A,P,H});
  const bytes=await sharp({create:{width:24,height:20,channels:3,background:'#aabbcc'}}).webp().toBuffer();
  let requests=0,release:()=>void=()=>{};
  const hold=new Promise<void>(resolve=>{release=resolve;});
  await context.route('**/api/public-image?*',async route=>{
   requests++;expect(route.request().headers().authorization).toBe('Bearer synthetic-A');
   if(pending)await hold;
   await route.fulfill({contentType:'image/webp',body:bytes}).catch(()=>{});
  });
  try {
   await page.goto(`/public/${kind}/?id=${kind==='board'?P:H}`);
   await expect.poll(()=>requests).toBeGreaterThan(0);
   let blob='';
   if(!pending){
    const image=page.getByRole('img',{name:'A-only image'});
    await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(24);
    blob=await image.getAttribute('src')||'';expect(blob.startsWith('blob:')).toBe(true);
   }
   await page.evaluate(async({pending,B})=>{
    const auth=await import('/src/repositories/mockAuthStorage.js');
    if(pending)auth.writeMockAuthSession({user:{id:B},access_token:'synthetic-B'});
    else auth.clearMockAuthSession();
   },{pending,B});
   await expect(page.getByRole('heading',{name:'A-only board'})).toHaveCount(0);
   await expect(page.getByRole('img',{name:'A-only image'})).toHaveCount(0);
   release();
   if(pending){await page.waitForTimeout(150);await expect(page.getByRole('img',{name:'A-only image'})).toHaveCount(0);}
   else await expect.poll(()=>page.evaluate(url=>(window as any).__viewerRevoked.includes(url),blob)).toBe(true);
   await expect(page.locator('vite-error-overlay')).toHaveCount(0);
   expect(errors).toEqual([]);
  } finally {release();}
 });
}
