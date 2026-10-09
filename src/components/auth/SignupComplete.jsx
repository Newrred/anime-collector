import {useEffect,useState,useRef} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {clearPendingSignup} from '../../features/auth/simpleSignup.js';
import {resolveWebOAuthNext} from '../../features/auth/webOAuth.js';

export default function SignupComplete({enabled=false}) {
  const [error,setError]=useState(''), started=useRef(false);
  useEffect(()=>{
    if(started.current)return;started.current=true;
    const run=async()=>{
      const query=new URLSearchParams(location.search);
      history.replaceState(null,'',location.pathname);
      clearPendingSignup(sessionStorage);
      if(query.has('error')||!enabled||!supabase){setError(query.get('error')==='GOOGLE_CANCELLED'?'cancelled':'failed');return;}
      try {
        const response=await fetch('/api/signup?action=session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
        const value=await response.json();
        if(!response.ok||!value.session?.access_token||!value.session?.refresh_token)throw new Error();
        const {error:sessionError}=await supabase.auth.setSession(value.session);
        if(sessionError)throw new Error();
        location.replace(resolveWebOAuthNext({rawNext:value.next,origin:location.origin}));
      }catch{setError('failed');}
    };
    run().catch(()=>setError('failed'));
  },[enabled]);
  return <section className="signup-panel"><span>MOEMOA</span><h1>계정 연결 · Sign in</h1>
    {error?<><p role="alert">{error==='cancelled'?'Google 로그인을 취소했습니다. / Sign-in cancelled.':'연결이 완료되지 않았습니다. 다시 시작해 주세요. / Please start sign-in again.'}</p>
      <a href="/auth/start/">다시 시작 · Start again</a></>:<p role="status">계정을 연결하고 있습니다… / Completing sign-in…</p>}
    <p><a href="/data/">돌아가기 · Go back</a></p></section>;
}
