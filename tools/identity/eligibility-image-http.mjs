import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createPrivateImageHandler,cleanupPrivateImages } from '../../src/server/privateImages/handler.js';
import { privateRpc } from '../../src/server/privateImages/supabaseBackend.js';
import { PrivateImageError,hash } from '../../src/server/privateImages/processImage.js';
import { pngBytes } from '../../tests/catalog-lab/fixtures/cover-valid-images.mjs';
const [socket,psql]=process.argv.slice(2);
assert.match(socket??'',/^\/tmp\/moemoa-private-image-test\.[A-Za-z0-9]+$/);
assert.match(psql??'',/^\/usr\/lib\/postgresql\/\d+\/bin\/psql$/);
const q=value=>typeof value==='boolean'?String(value):`'${String(value).replaceAll("'","''")}'`;
function query(sql) {
 const r=spawnSync('wsl.exe',['-u','postgres','-e',psql,'-h',socket,'-p','55438','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:15000,windowsHide:true});
 if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr.match(/ERROR:\s+([A-Z_]+)/)?.[1]??'SQL_FAILED');return r.stdout.trim();
}
const A='77777777-7777-4777-8777-777777777777',asset='66666666-6666-4666-8666-666666666662',card='66666666-6666-4666-8666-666666666661';
const grant=()=>query(`update private.memory_eligibility_evidence set state='GRANTED',expires_at=clock_timestamp()+interval '1 hour' where user_id=${q(A)}`);
const revoke=()=>query(`update private.memory_eligibility_evidence set state='REVOKED' where user_id=${q(A)}`);
query(`insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at) values(${q(card)},${q(A)},'anime:66666666-6666-4666-8666-666666666661','Synthetic HTTP','DRAFT',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at) values(${q(asset)},${q(A)},${q(card)},'USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now());
update private.memory_private_media_policy set read_bytes_per_month=100000000,global_read_bytes_per_month=100000000;`);
const userRpcs=new Set(['get_memory_private_image_policy','authorize_memory_private_image_attempt','read_memory_private_image','cancel_memory_private_image']);
const serviceRpcs=new Set(['reserve_memory_private_image','complete_memory_private_image','claim_memory_private_image_cleanup','complete_memory_private_image_cleanup']);
const rpc=(role,name,args)=>privateRpc({async rpc(){
 assert.ok((role==='authenticated'?userRpcs:serviceRpcs).has(name));
 for(const key of Object.keys(args))assert.match(key,/^p_[a-z_]+$/);
 try{return {data:JSON.parse(query(`set role ${role};set "request.jwt.claim.sub"=${q(A)};select coalesce(to_jsonb(public.${name}(${Object.entries(args).map(([key,value])=>`${key}=>${q(value)}`).join(',')})),'null'::jsonb);`))};}
 catch(error){return {error:{message:error.message}};}
}},name,args);
const objects=new Map();let revokeOnPut=true,dropResponse=false,puts=0;
const backend={
 async user(token){if(token!=='synthetic-A')throw new PrivateImageError('AUTH_REQUIRED',401);return {id:A,rpc:(n,a)=>rpc('authenticated',n,a)};},
 rpc:(n,a)=>rpc('service_role',n,a),
 async put(path,bytes){objects.set(path,bytes);puts++;if(revokeOnPut&&path.endsWith('thumb.webp'))revoke();},
 async get(path){assert.ok(objects.has(path));return objects.get(path);},
 async remove(paths){for(const path of paths)objects.delete(path);}
};
const handler=createPrivateImageHandler({enabled:true,createBackend:()=>backend});
const server=createServer((req,res)=>{
 if(dropResponse&&req.method==='POST')res.end=()=>{res.destroy();return res;};
 handler(req,res);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}/api/private-image`,source=Buffer.from(pngBytes),original=hash(source);
let operation='66666666-6666-4666-8666-666666666663';
const headers=()=>({Authorization:'Bearer synthetic-A','Content-Type':'application/octet-stream','X-Moemoa-Asset':asset,'X-Moemoa-Version':'1','X-Moemoa-Operation':operation,'X-Moemoa-Consent':'ELIGIBILITY_LOCAL'});
try {
 grant();
 const rejected=await fetch(base,{method:'POST',headers:headers(),body:source});
 assert.equal(rejected.status,403);assert.deepEqual(await rejected.json(),{error:'ELIGIBILITY_REQUIRED'});
 assert.equal(query(`select state from private.memory_private_media where operation_id=${q(operation)}`),'PREPARING');assert.equal(objects.size,2);
 console.log('PASS: actual HTTP/SQL upload revoked after bytes preserves PREPARING and returns eligibility 403');
 const counted=Number(query(`select main_bytes+thumb_bytes from private.memory_private_media where operation_id=${q(operation)}`));
 assert.equal([...objects.values()].reduce((sum,bytes)=>sum+bytes.length,0),counted);
 assert.equal(hash(source),original);
 console.log('PASS: SQL reserved sizes equal actual encoded buffers and source hash remains unchanged');
 assert.equal((await fetch(base,{method:'DELETE',headers:headers()})).status,200);assert.equal(objects.size,2);
 query(`update private.memory_private_media set cleanup_after=clock_timestamp()-interval '1 second' where operation_id=${q(operation)}`);
 await cleanupPrivateImages(backend);
 assert.equal(objects.size,0);assert.equal(query(`select state from private.memory_private_media where operation_id=${q(operation)}`),'DELETED');
 console.log('PASS: explicit HTTP cancel plus real SQL cleanup removes test buffers and settles manifest');
 grant();revokeOnPut=false;dropResponse=true;operation='66666666-6666-4666-8666-666666666664';
 await assert.rejects(fetch(base,{method:'POST',headers:headers(),body:source}));
 assert.equal(query(`select state from private.memory_private_media where operation_id=${q(operation)}`),'READY');
 revoke();const before=puts;
 const response=await fetch(`${base}?asset=${asset}&version=1&policy=1`,{headers:headers()});assert.equal(response.status,200);
 const policy=await response.json();assert.equal(policy.representation.state,'READY');
 const image=await fetch(`${base}?asset=${asset}&version=1`,{headers:headers()});assert.equal(image.status,200);
 const bytes=Buffer.from(await image.arrayBuffer());assert.equal(hash(bytes),policy.representation.mainHash);assert.equal(bytes.length,policy.representation.mainBytes);assert.equal(puts,before);
 console.log('PASS: lost completion response recovers READY and actual image bytes by GET after eligibility revocation');
} finally {await new Promise(resolve=>server.close(resolve));}
