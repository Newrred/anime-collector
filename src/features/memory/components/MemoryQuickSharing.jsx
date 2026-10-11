import { useEffect, useRef, useState } from 'react';
import { getPlatformMemoryRuntime } from '../runtime/platformMemoryRuntime.js';
import { getPlatformMemoryAccountRuntime } from '../runtime/platformMemoryAccountRuntime.js';
import { getPublicationServices } from '../runtime/platformPublication.js';
import { privateImageTransfer, privateImageUiEnabled } from '../runtime/platformPrivateImages.js';
import { createSimpleCardSharing } from '../application/simpleCardSharing.js';
import { publicationError } from './publicationCopy.js';
import { publicationLink } from '../domain/publicationView.js';
import PublicSignupNotice from './PublicSignupNotice.jsx';
import './memory-publication.css';

async function decodeBlob(blob) {
  const url=URL.createObjectURL(blob);
  try { const img=new Image(); img.src=url; await img.decode(); if(!img.naturalWidth) throw new Error('decode'); }
  finally { URL.revokeObjectURL(url); }
}
export default function MemoryQuickSharing({card,locale,base,disabled}) {
  const ko=locale==='ko', services=getPublicationServices();
  const [state,set]=useState({loading:true,busy:false,published:null,visible:false,consented:false,source:null,bundle:null,error:null,link:null,done:false});
  const [rights,setRights]=useState('USER_ORIGINAL');
  const active=useRef(null),driver=useRef(null),url=useRef(null),generation=useRef(0);
  const patch=value=>set(s=>({...s,...value}));
  const checkOwner=async()=>{if((await services.getSession())?.user?.id!==card.ownerId.slice(8)) throw Object.assign(new Error(),{code:'AUTH_REQUIRED'});};
  useEffect(()=>{
    let alive=true; const request=new AbortController(); active.current=request;
    const timer=setTimeout(()=>request.abort(),20000);
    services.gateway.cardSharing(card.id,{signal:request.signal}).then(async result=>{
      await checkOwner();
      if(!result || typeof result.published!=='boolean') throw new Error('invalid');
      if(alive) patch({loading:false,published:result.published,visible:result.published,readable:result.visible,restricted:result.restricted,error:null});
    }).catch(e=>{if(alive)patch({loading:false,error:e.code||'PUBLICATION_REQUEST_FAILED'});}).finally(()=>{clearTimeout(timer);if(active.current===request)active.current=null;});
    return ()=>{alive=false;generation.current++;request.abort();active.current?.abort();driver.current?.dispose();if(url.current)URL.revokeObjectURL(url.current);};
  },[card.id,card.ownerId,services]);
  const choose=async visible=>{
    if(state.busy || driver.current?.hasPendingPublish())return;
    const turn=++generation.current;active.current?.abort();
    patch({visible,consented:false,source:null,error:null,done:false});
    if(!visible)return;
    const abort=new AbortController();active.current=abort;const timer=setTimeout(()=>abort.abort(),30000);
    patch({busy:true});
    try {
      await checkOwner();const runtime=await getPlatformMemoryRuntime(),bundle=await runtime.getCard(card.id);
      if(bundle?.card.ownerId!==card.ownerId)throw Object.assign(new Error(),{code:'AUTH_REQUIRED'});
      let source={key:bundle.asset.id},blob;
      if(!['SYSTEM_DESIGN','CATALOG_COVER'].includes(bundle.asset.imageType)) {
        // Only read existing bytes here. No preparation/upload before explicit consent and Save.
        if(privateImageUiEnabled() && import.meta.env.PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1==='1') {
          try {
            const transfer=privateImageTransfer(runtime,bundle),policy=await transfer.policy(abort.signal);
            if(policy.representation){blob=await transfer.read(abort.signal);const latest=await transfer.policy(abort.signal);
              if(latest.representation?.id!==policy.representation.id || latest.representation?.mainHash!==policy.representation.mainHash)throw new Error('changed');
              source={key:policy.representation.mainHash,privateRepresentation:{id:policy.representation.id,hash:policy.representation.mainHash}};}
          } catch(e){ blob=null; if(abort.signal.aborted)throw e; }
        }
        if(!blob){blob=await runtime.imageIntake.getOriginal(bundle.asset.localRef);source={key:bundle.asset.id+':'+bundle.asset.sync?.remoteVersion,file:blob};}
        if(!(blob instanceof Blob)||!blob.size)throw Object.assign(new Error(),{code:'ORIGINAL_IMAGE_UNAVAILABLE'});
        await decodeBlob(blob);
      }
      await checkOwner();if(abort.signal.aborted||turn!==generation.current)return;
      if(url.current)URL.revokeObjectURL(url.current);url.current=blob?URL.createObjectURL(blob):null;
      patch({bundle,source:{...source,src:url.current}});
    }catch(e){if(turn===generation.current)patch({error:e.code||'PUBLIC_VISUAL_NOT_READY'});}
    finally{clearTimeout(timer);if(turn===generation.current){active.current=null;patch({busy:false});}}
  };
  const save=async event=>{
    event.preventDefault();if(state.busy||disabled)return;
    patch({busy:true,error:null,done:false});const turn=generation.current;
    try {
      const runtime=await getPlatformMemoryRuntime();await checkOwner();
      if(!driver.current)driver.current=createSimpleCardSharing({cardId:card.id,ownerId:card.ownerId,runtime,services,
        syncBoard:async()=>{const account=await getPlatformMemoryAccountRuntime();await account.syncNow();},
        decodeReview:async review=>{
          const abort=new AbortController(); const timer=setTimeout(()=>abort.abort(),20000);
          try { await Promise.race([(async()=>{for(const c of review.snapshot.cards){
            if(c.visual.type==='USER_IMAGE')await decodeBlob(await services.previewImage(c.visual.assetId,abort.signal));
            else if(c.visual.type==='CATALOG_COVER'){const img=new Image();img.src=await services.resolveCover(c,abort.signal);await img.decode();}
          }})(),new Promise((_,reject)=>abort.signal.addEventListener("abort",()=>reject(Object.assign(new Error(),{code:"PUBLIC_VISUAL_NOT_READY"})),{once:true}))]); } finally {clearTimeout(timer);abort.abort();}
        }});
      const result=await driver.current.save({visible:state.visible,consented:state.consented,source:state.source,rightsBasis:rights,bundle:state.bundle});
      if(turn!==generation.current)return;
      patch({published:result.published,readable:result.visible,done:true,consented:false,link:result.id?publicationLink(result.id,base):null});
    }catch(e){if(turn===generation.current)patch({error:e.code||'PUBLICATION_REQUEST_FAILED',...(['PREVIEW_CHANGED','CONSENT_MISMATCH','SOURCE_IMAGE_MISMATCH','PUBLICATION_CONFLICT'].includes(e.code)?{consented:false,source:null}:{})});}
    finally{if(turn===generation.current)patch({busy:false});}
  };
  const pending=driver.current?.hasPendingPublish();
  const serviceVisual=["CATALOG_COVER","SYSTEM_DESIGN"].includes(state.bundle?.asset.imageType);
  return <form className="memory-quick-sharing" onSubmit={save} aria-label={ko?'이 기억 공개 설정':'Memory visibility'} aria-busy={state.busy||state.loading}>
    <p role="status">{state.loading?(ko?'공개 상태 확인 중…':'Checking visibility…'):state.published===null?(ko?'공개 상태를 확인하지 못했어요.':'Visibility could not be checked.'):state.published?(state.readable?(ko?'공개 중':'Public'):(ko?'게시됨 · 현재 열람 제한':'Published · visibility restricted')):(ko?'비공개':'Private')}</p>
    <fieldset disabled={disabled||state.busy||state.loading||state.published===null||pending} className="memory-quick-sharing__choice"><legend>{ko?'공개 범위':'Visibility'}</legend>
      <label><input type="radio" name="memory-visibility" checked={!state.visible} onChange={()=>choose(false)}/>{ko?'비공개':'Private'}</label>
      <label><input type="radio" name="memory-visibility" checked={state.visible} onChange={()=>choose(true)}/>{ko?'공개':'Public'}</label>
    </fieldset>
    {state.visible && <>
      <p>{ko?'이 기억의 작품명과 이미지만 공개해요. 감상과 태그는 비공개로 남아요.':'Only this memory’s title and image will be public. Reflections and tags stay private.'}</p>
      {state.source?.src && <img className="memory-quick-sharing__preview" src={state.source.src} alt={state.bundle.title.displayTitle}/>}
      {state.bundle && <strong>{state.bundle.title.displayTitle}</strong>}
      {!state.source && !state.busy && <button type="button" className="btn btn--subtle" onClick={()=>choose(true)}>{ko?'공개할 이미지 확인':'Load image to share'}</button>}
      {!serviceVisual && <details><summary>{ko?'다른 공개 권한으로 게시':'Use a different rights basis'}</summary>
        <select aria-label={ko?'이미지 공개 권한':'Image rights'} value={rights} disabled={state.busy||pending} onChange={e=>{setRights(e.target.value);patch({consented:false});}}>
          <option value="USER_ORIGINAL">{ko?'직접 만든 이미지':'My own creation'}</option><option value="EXISTING_APPROVAL">{ko?'별도 공개 승인을 받은 이미지':'Separately approved image'}</option>
        </select>
        <p>{ko?'애니 캡처·타인의 팬아트는 별도 승인이 필요해요.':'Anime screenshots and other people’s fanart need separate approval.'}</p>
      </details>}
      <label className="memory-publication__check"><input type="checkbox" checked={state.consented} disabled={state.busy||!state.source||pending} onChange={e=>patch({consented:e.target.checked})}/>
        {serviceVisual?(ko?'표시된 작품명과 이미지의 공개 및 신고·검토·삭제 정책에 동의합니다. 성인용·불법·권리침해 콘텐츠는 공개하지 않습니다.':'I agree to publish the displayed title and visual and to the reporting, review and removal policy. I will not publish adult, illegal or rights-infringing content.'):rights==='USER_ORIGINAL'?(ko?'직접 만든 이미지이며 공개할 권한이 있습니다. 성인용·불법·권리침해 콘텐츠가 아니며, 표시된 내용의 공개 및 신고·검토·삭제 정책에 동의합니다.':'I created this image and may publish it. It contains no adult, illegal or rights-infringing content. I agree to publish the displayed content and to the reporting, review and removal policy.'):(ko?'별도 공개 승인을 받은 이미지입니다. 성인용·불법·권리침해 콘텐츠가 아니며, 표시된 내용의 공개 및 신고·검토·삭제 정책에 동의합니다.':'This image has separate public-use approval. It contains no adult, illegal or rights-infringing content. I agree to publish the displayed content and to the reporting, review and removal policy.')}
      </label>
    </>}
    {!state.visible && <p>{ko?'비공개로 저장하면 모든 공개 보드·미니홈에서 이 기억의 사본을 내립니다. 원본은 유지돼요.':'Saving as private removes this memory from all public Boards and homes. Your original stays.'}</p>}
    {state.error && <p role="alert">{publicationError(state.error,locale)}</p>}
    <PublicSignupNotice error={state.error} locale={locale} base={base}/>
    {pending && <p>{ko?'게시 결과를 확인 중이에요. 같은 내용으로 다시 시도해 주세요.':'The publication result is unconfirmed. Retry the same content.'}</p>}
    <button className="btn" type="submit" disabled={disabled||state.busy||state.loading||state.published===null||(state.visible&&(!state.source||!state.consented))}>{state.busy?(ko?'저장 중…':'Saving…'):pending?(ko?'다시 시도':'Retry save'):(ko?'저장':'Save visibility')}</button>
    {state.done && <p role="status">{state.published?(state.readable?(ko?'공개로 저장했어요.':'Saved as public.'):(ko?'게시 내용을 저장했지만 현재 공개 열람은 제한되어 있어요.':'Publication saved, but public viewing is currently restricted.')):(ko?'비공개로 저장했어요.':'Saved as private.')}</p>}
    {state.link && <a href={state.link} data-astro-reload>{ko?'공개 화면 보기 →':'View public memory →'}</a>}
  </form>;
}
