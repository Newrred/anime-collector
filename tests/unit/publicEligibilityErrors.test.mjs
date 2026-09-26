import test from 'node:test';
import assert from 'node:assert/strict';
import { rpc } from '../../src/server/publicImages/supabaseImageBackend.js';
import { SupabasePublicationGateway } from '../../src/features/memory/adapters/supabase/SupabasePublicationGateway.js';
import { prepareSelectedPublicImage } from '../../src/features/memory/application/preparePublicImage.js';

test('public eligibility denial survives RPC and image preparation without claiming a retry', async () => {
  for (const [code,status] of [['ELIGIBILITY_REQUIRED',403],['ELIGIBILITY_EXPIRED',403],['ELIGIBILITY_POLICY_CHANGED',409],['ELIGIBILITY_POLICY_UNAVAILABLE',503]]) {
    const client={rpc:async()=>({error:{message:code}})};
    await assert.rejects(rpc(client,'complete_memory_public_asset',{}),error=>error.code===code&&error.status===status);
    const gateway=new SupabasePublicationGateway(client);
    await assert.rejects(gateway.read('synthetic'),error=>error.code===code);
    const original=new Blob(['synthetic']);
    await assert.rejects(prepareSelectedPublicImage({sourceAssetId:'synthetic',sourceVersion:1,operationId:'stable-operation',
      accessToken:'synthetic',policyRevision:'local',consented:true,readOriginal:async()=>original,
      fetchImpl:async(_url,options)=>{
        assert.equal(options.body,original);
        assert.equal(options.headers['X-Moemoa-Operation'],'stable-operation');
        return new Response(JSON.stringify({error:code}),{status});
      }}),error=>error.code===code&&error.retryable===false);
  }
});

test('public RPC and publication gateway still sanitize unknown errors', async()=>{
  const client={rpc:async()=>({error:{message:'secret internal detail'}})};
  await assert.rejects(rpc(client,'synthetic',{}),error=>error.code==='IMAGE_SERVICE_FAILED');
  await assert.rejects(new SupabasePublicationGateway(client).read('synthetic'),error=>error.code==='PUBLICATION_REQUEST_FAILED');
});
