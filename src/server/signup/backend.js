import {createClient} from '@supabase/supabase-js';
import {reject} from './security.js';

export function createSignupBackend(env=process.env) {
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(12000)})}};
  const service=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,options);
  async function rpc(name,args) {
    const {data,error}=await service.rpc(name,args);
    if(error)reject();
    return data;
  }
  return {
    async policy(){const {data,error}=await client.rpc('get_simple_signup_policy');if(error||!data)reject();return data;},
    admit(identity,d){return rpc('issue_simple_signup_admission',{p_subject:identity.subject,p_email_hash:identity.emailHash,p_declaration:d});},
    async signIn(token,nonce,accessToken){
      const {data,error}=await client.auth.signInWithIdToken({provider:'google',token,nonce,access_token:accessToken});
      if(error||!data?.session||!data?.user?.id)reject();
      return {userId:data.user.id,session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}};
    },
    finalize(admission,userId){return rpc('finish_simple_signup_admission',{p_id:admission,p_user_id:userId});},
    abandon(admission){return rpc('abandon_simple_signup_admission',{p_id:admission});},
    storeHandoff(id,cipher){return rpc('store_simple_signup_handoff',{p_key_hash:id,p_cipher:cipher});},
    consumeHandoff(id){return rpc('consume_simple_signup_handoff',{p_key_hash:id});},
  };
}
