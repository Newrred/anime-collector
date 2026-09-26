const identity=session=>`${session?.user?.id||''}:${session?.access_token||''}`;
const unchanged=async(getSession,before,signal)=>{
  const current=await getSession();
  if(signal?.aborted || identity(current)!==identity(before)) throw new Error('VIEWER_CHANGED');
};
export function createPublicationViewer({getSession,subscribeSession,getGateway,anonymousReader,fetchImpl=globalThis.fetch}) {
  return {
    reader:Object.fromEntries(['read','readAuthor','readHome'].map(method=>[method,async(id,options={})=>{
      const session=await getSession();
      const gateway=session?.access_token ? await getGateway() : anonymousReader;
      await unchanged(getSession,session,options.signal);
      const result=await gateway[method](id,options);
      await unchanged(getSession,session,options.signal);
      return result;
    }])),
    async readImage(publicationId,assetId,signal) {
      const session=await getSession();
      const response=await fetchImpl(`/api/public-image?publication=${encodeURIComponent(publicationId)}&asset=${encodeURIComponent(assetId)}&variant=full`,{
        signal,cache:'no-store',headers:session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{},
      });
      if(!response.ok || response.headers.get('content-type')?.split(';')[0]!=='image/webp') throw new Error('PUBLIC_VISUAL_NOT_READY');
      const blob=await response.blob();
      await unchanged(getSession,session,signal);
      if(!blob.size || blob.size>2*1024*1024) throw new Error('PUBLIC_VISUAL_NOT_READY');
      return blob;
    },
    async subscribeViewer(callback) {
      let current=identity(await getSession());
      const changed=session=>{
        const next=identity(session);
        if(next!==current) {current=next;callback();}
      };
      const unsubscribe=await subscribeSession(changed);
      try {changed(await getSession());} catch(error) {unsubscribe();throw error;}
      return unsubscribe;
    },
  };
}
