import { createPublicationController } from './createPublicationController.js';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export async function cardSharingBoardId(cardId) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('moemoa:card-sharing:v1:' + cardId)));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes.slice(0,16)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
export function assertSimplePreview(review, bundle, title, preparedImageId) {
  const s = review?.snapshot, c = s?.cards?.[0], a = bundle.asset;
  if (!s || s.title !== title || s.description !== '' || s.cards.length !== 1 || c.title !== bundle.title.displayTitle
    || Object.keys(c).some(k=>!['id','title','visual','animeId'].includes(k))) fail('PREVIEW_CHANGED');
  if (a.imageType === 'CATALOG_COVER') {
    if (c.visual.type !== 'CATALOG_COVER' || c.visual.revisionId !== a.catalogCoverRef?.catalogCoverRevisionId) fail('PREVIEW_CHANGED');
  } else if (a.imageType === 'SYSTEM_DESIGN') {
    if (c.visual.type !== 'SYSTEM_DESIGN') fail('PREVIEW_CHANGED');
  } else if (!preparedImageId || c.visual.type !== 'USER_IMAGE' || c.visual.assetId !== preparedImageId) fail('PREVIEW_CHANGED');
}
// Reuse the same controller after an unknown publish outcome; never issue a new review/operation for a retry.
export function createSimpleCardSharing({ cardId, ownerId, runtime, services, syncBoard, decodeReview,
  boardIdFor = cardSharingBoardId, makeController = createPublicationController }) {
  let controller, detail, disposed=false, busy=false, pending=null, privateRequest=null;
  const auth = async () => {
    if (disposed || (await services.getSession())?.user?.id !== ownerId.slice(8)) fail('AUTH_REQUIRED');
  };
  const checked = async task => { await auth(); await task; await auth(); const s=controller.getSnapshot(); if(s.error) fail(s.error); return s; };
  return {
    async save({ visible, consented, source, rightsBasis, bundle }) {
      if (busy) fail('REQUEST_IN_PROGRESS'); busy=true;
      try {
        await auth();
        if (!visible) {
          if (pending) fail('PUBLICATION_REQUEST_FAILED');
          privateRequest=new AbortController();
          const timer=setTimeout(()=>privateRequest?.abort(),20000);
          try { await services.gateway.makeCardPrivate(cardId,{signal:privateRequest.signal}); await auth(); }
          finally { clearTimeout(timer); privateRequest=null; }
          return { published:false };
        }
        if (!consented || !source || bundle.card.id !== cardId || bundle.card.ownerId !== ownerId) fail('REVIEW_REQUIRED');
        const consentPolicyRevision=services.policyRevision;
        const title=bundle.title.displayTitle.trim().slice(0,80);
        const key=JSON.stringify([bundle.card.sync?.remoteVersion,bundle.asset.id,bundle.asset.sync?.remoteVersion,source.key,rightsBasis,title]);
        if (pending && pending !== key) fail('PREVIEW_CHANGED');
        if (!controller) {
          const boardId=await boardIdFor(cardId); await auth();
          detail=await runtime.getBoard(boardId); await auth();
          if (!detail) { await runtime.createBoard({ id:boardId,title }); await auth(); detail=await runtime.getBoard(boardId); }
          if (detail.board.ownerId !== ownerId || detail.items.some(i=>i.bundle.card.id !== cardId)) fail('PUBLICATION_CONFLICT');
          if (!detail.items.length) { await runtime.addCardToBoard(boardId,cardId); await auth(); }
          await syncBoard(); await auth(); detail=await runtime.getBoard(boardId);
          controller=makeController({ boardId,ownerId,gateway:services.gateway,getSession:services.getSession,
            getBoard:id=>runtime.getBoard(id),policyRevision:services.policyRevision });
        }
        if (!pending) {
          await syncBoard(); await auth();
          const current=await runtime.getBoard(detail.board.id);
          const latest=current?.items.find(i=>i.bundle.card.id===cardId)?.bundle;
          if (!latest || latest.card.sync?.remoteVersion !== bundle.card.sync?.remoteVersion || latest.asset.id !== bundle.asset.id || latest.asset.sync?.remoteVersion !== bundle.asset.sync?.remoteVersion || latest.title.displayTitle !== bundle.title.displayTitle) fail("PREVIEW_CHANGED");
          if (!['SYSTEM_DESIGN','CATALOG_COVER'].includes(bundle.asset.imageType)) {
            await checked(controller.upload({cardId,file:source.file,privateRepresentation:source.privateRepresentation,consented,rightsBasis}));
          }
          const s=await checked(controller.prepare({ title,description:'',cards:[{cardId,fields:[]}] }));
          if (!consentPolicyRevision || s.review?.policyRevision !== consentPolicyRevision) fail('CONSENT_MISMATCH');
          assertSimplePreview(s.review,bundle,title,s.preparedImages?.[cardId]);
          await decodeReview(s.review); await auth();
          pending=key;
        }
        const s=await checked(controller.publish({consented:true,visualsReady:true}));
        pending=null;
        return { published:true,visible:s.publication.visible === true,id:s.publication.id };
      } catch(error) {
        // A definitive stale/restricted review cannot be reused; transport failures retain the exact operation.
        if (controller && !controller.getSnapshot().review) pending=null;
        throw error;
      } finally { busy=false; }
    },
    hasPendingPublish:()=>Boolean(pending),
    dispose(){ disposed=true; privateRequest?.abort(); controller?.dispose(); },
  };
}
