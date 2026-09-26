import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import sharp from 'sharp';
import {createPublicImageHandler} from '../../src/server/publicImages/handler.js';
import {rpc,resolveViewerImage} from '../../src/server/publicImages/supabaseImageBackend.js';
import {imageHash} from '../../src/server/publicImages/processImage.js';
const [socket,psql]=process.argv.slice(2);
assert.match(socket??'',/^\/tmp\/moemoa-private-image-test\.[A-Za-z0-9]+$/);
assert.match(psql??'',/^\/usr\/lib\/postgresql\/\d+\/bin\/psql$/);
const q=value=>`'${String(value).replaceAll("'","''")}'`;
function query(sql){
 const r=spawnSync('wsl.exe',['-u','postgres','-e',psql,'-h',socket,'-p','55438','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:15000,windowsHide:true});
 if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr.match(/ERROR:\s+([A-Z_]+)/)?.[1]??'SQL_FAILED');return r.stdout.trim();
}
const U='88888888-8888-4888-8888-888888888888',S='33333333-3333-4333-8333-333333333333';
const publication=query("select id from private.memory_publications where board_id='55555555-5555-4555-8555-555555555550'");
const asset=query("select id from private.memory_public_assets where operation_id='44444444-4444-4444-8444-444444444442'");
const bytes=await sharp({create:{width:24,height:20,channels:3,background:'#abcabc'}}).webp().toBuffer();
const expectedPath=query(`select object_prefix||'/full.webp' from private.memory_public_assets where id=${q(asset)}`);
query(`update private.memory_public_assets set full_hash=${q(imageHash(bytes))},full_bytes=${bytes.length} where id=${q(asset)};
update private.memory_resource_policies set enabled=true,paused=false,daily_limit=100000000 where scope in ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');`);
const restore=()=>query(`update private.memory_eligibility_evidence set state='GRANTED',expires_at=clock_timestamp()+interval '1 hour' where user_id=${q(U)} and purpose='MATURE_VIEW';
insert into auth.sessions(id,user_id) values(${q(S)},${q(U)}) on conflict(id) do update set user_id=excluded.user_id,not_after=null;`);
const allowed=new Set(['resolve_memory_viewer_image','resolve_memory_public_image','authorize_memory_image_delivery']);
let gets=0,changeDuringGet='';
const service={auth:{
 getClaims:async token=>({data:{claims:token==='synthetic-viewer'?{sub:U,session_id:S,role:'authenticated',exp:Math.floor(Date.now()/1000)+300}:null}}),
 getUser:async()=>({data:{user:{id:U,is_anonymous:false}}}),
},async rpc(name,args){
 assert.ok(allowed.has(name));for(const key of Object.keys(args))assert.match(key,/^p_[a-z_]+$/);
 try{return {data:JSON.parse(query(`set role service_role;select coalesce(to_jsonb(public.${name}(${Object.entries(args).map(([key,value])=>`${key}=>${q(value)}`).join(',')})),'null'::jsonb);`))};}
 catch(error){return {error:{message:error.message}};}
}};
const backend={rpc:(name,args)=>rpc(service,name,args),viewerImage:(token,args)=>resolveViewerImage(service,token,args),
 async get(path){assert.equal(path,expectedPath);gets++;
  if(changeDuringGet==='revoke')query(`update private.memory_eligibility_evidence set state='REVOKED' where user_id=${q(U)} and purpose='MATURE_VIEW'`);
  if(changeDuringGet==='logout')query(`delete from auth.sessions where id=${q(S)}`);
  return bytes;
 }};
const server=createServer(createPublicImageHandler({enabled:true,authenticatedViewersEnabled:true,createBackend:()=>backend}));
server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}/api/public-image?publication=${publication}&asset=${asset}&variant=full`;
const headers={Authorization:'Bearer synthetic-viewer'};
try{
 restore();
 let response=await fetch(url,{headers});assert.equal(response.status,200);
 const delivered=Buffer.from(await response.arrayBuffer());assert.equal(imageHash(delivered),imageHash(bytes));assert.equal(delivered.length,bytes.length);
 assert.match(response.headers.get('cache-control'),/no-store/);
 console.log('PASS: mature actual HTTP to SQL resolves and delivers exact synthetic WebP bytes');
 response=await fetch(url);assert.equal(response.status,404);assert.equal(gets,1);
 console.log('PASS: anonymous mature HTTP request is denied by real SQL before Storage');
 for(const change of ['revoke','logout']){
  restore();changeDuringGet=change;
  response=await fetch(url,{headers});assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'NOT_FOUND'});
  console.log(`PASS: mature HTTP suppresses bytes after actual SQL ${change} during Storage read`);
 }
 assert.equal(gets,3);
 const usage=Number(query("select used from private.memory_resource_usage where actor='00000000-0000-0000-0000-000000000000' and scope='IMAGE_DELIVERY_BYTES'"));
 assert.equal(usage,3*2097152);
 console.log('PASS: denied-after-read mature responses retain charged delivery budget');
}finally{await new Promise(resolve=>server.close(resolve));}
