import { processPublicImage, imageHash, INPUT_LIMIT, OUTPUT_LIMIT, PublicImageError } from "./processImage.js";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SAFE_PATH = /^[a-f0-9-]{36}\/(full|thumb)\.webp$/;
const requiredId = (value) => { if(!UUID.test(value || "")) throw new PublicImageError("INVALID_REQUEST"); return value; };
const tokenOf = (req) => /^Bearer ([^\s]+)$/.exec(req.headers.authorization || "")?.[1];
const pathsFor = (prefix) => { requiredId(prefix); return [`${prefix}/full.webp`,`${prefix}/thumb.webp`]; };
async function inputBytes(req) {
  const length = Number(req.headers["content-length"]);
  if (Number.isFinite(length) && length > INPUT_LIMIT) throw new PublicImageError("IMAGE_SIZE_LIMIT",413);
  if (Buffer.isBuffer(req.body)) { if(req.body.length > INPUT_LIMIT) throw new PublicImageError("IMAGE_SIZE_LIMIT",413); return req.body; }
  if (req.body != null) throw new PublicImageError("INVALID_BINARY_BODY");
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>INPUT_LIMIT) throw new PublicImageError("IMAGE_SIZE_LIMIT",413); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}

export function createPublicImageHandler({ enabled=false, createBackend, allowedOrigins=[], transform=processPublicImage }) {
  return async (req,res) => {
    res.setHeader("Cache-Control","no-store, max-age=0");
    res.setHeader("CDN-Cache-Control","no-store");
    res.setHeader("Vercel-CDN-Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Vary","Origin");
    try {
      if(!enabled) throw new PublicImageError("PUBLIC_IMAGE_DISABLED",503);
      const origin=req.headers.origin;
      if(origin && !allowedOrigins.includes(origin)) throw new PublicImageError("ORIGIN_NOT_ALLOWED",403);
      if(origin) res.setHeader("Access-Control-Allow-Origin",origin);
      if(req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type, X-Moemoa-Asset, X-Moemoa-Version, X-Moemoa-Operation, X-Moemoa-Consent");
        res.statusCode=204; res.end(); return;
      }
      if(!["GET","POST"].includes(req.method)) throw new PublicImageError("METHOD_NOT_ALLOWED",405);
      const backend=createBackend();
      if(req.method === "POST") {
        if(req.headers["content-type"]?.split(";")[0] !== "application/octet-stream") throw new PublicImageError("INVALID_BINARY_BODY");
        const user=await backend.user(tokenOf(req));
        const asset=requiredId(req.headers["x-moemoa-asset"]), operation=requiredId(req.headers["x-moemoa-operation"]);
        const version=Number(req.headers["x-moemoa-version"]), consent=req.headers["x-moemoa-consent"];
        if(!Number.isSafeInteger(version) || version<1 || typeof consent!=="string" || consent.length<1 || consent.length>120) throw new PublicImageError("INVALID_REQUEST");
        const reservation=await user.rpc("reserve_memory_public_asset",{p_asset_id:asset,p_source_version:version,p_operation_id:operation,p_policy_revision:consent});
        if(reservation.state === "READY") { res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({id:reservation.id,state:"READY"})); return; }
        const paths=pathsFor(reservation.prefix);
        try {
          await user.rpc("authorize_memory_image_attempt",{});
          const bytes=await inputBytes(req);
          if(imageHash(bytes)!==reservation.sourceHash) throw new PublicImageError("SOURCE_IMAGE_MISMATCH");
          const output=await transform(bytes);
          await backend.put(paths[0],output.full);
          await backend.put(paths[1],output.thumb);
          await backend.rpc("complete_memory_public_asset",{p_id:reservation.id,p_full_hash:output.fullHash,p_thumb_hash:output.thumbHash,
            p_full_bytes:output.full.length,p_thumb_bytes:output.thumb.length,p_width:output.width,p_height:output.height});
        } catch(error) {
          // READY can be committed even when the final HTTP response is lost. Never delete on an ambiguous commit.
          await backend.rpc("fail_memory_public_asset",{p_id:reservation.id}).catch(()=>{});
          // Cleanup worker rechecks state/references before removing private objects.
          throw error;
        }
        res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({id:reservation.id,state:"READY"})); return;
      }
      const query=new URL(req.url,"https://local.invalid").searchParams;
      for(const key of query.keys()) {
        if(!["asset","variant","publication","preview"].includes(key) || query.getAll(key).length!==1) throw new PublicImageError("INVALID_REQUEST");
      }
      if(query.has("preview") && query.get("preview")!=="1") throw new PublicImageError("INVALID_REQUEST");
      if(query.has("preview") && query.has("publication")) throw new PublicImageError("INVALID_REQUEST");
      const asset=requiredId(query.get("asset")), variant=query.get("variant") || "thumb";
      if(!["full","thumb"].includes(variant)) throw new PublicImageError("INVALID_REQUEST");
      let resolve;
      if(query.get("preview") === "1") {
        const user=await backend.user(tokenOf(req));
        resolve=()=>user.rpc("resolve_memory_image_preview",{p_asset_id:asset,p_variant:variant});
      } else {
        const publication=requiredId(query.get("publication"));
        resolve=()=>backend.rpc("resolve_memory_public_image",{p_publication_id:publication,p_asset_id:asset,p_variant:variant});
      }
      const reference=await resolve();
      if(!reference) throw new PublicImageError("NOT_FOUND",404);
      if(!SAFE_PATH.test(reference.path)) throw new PublicImageError("IMAGE_SERVICE_FAILED",503);
      // Reserve the maximum permitted response size before touching Storage.
      await backend.rpc("authorize_memory_image_delivery",{p_bytes:OUTPUT_LIMIT});
      const bytes=await backend.get(reference.path);
      if(bytes.length>OUTPUT_LIMIT || imageHash(bytes)!==reference.hash) throw new PublicImageError("IMAGE_SERVICE_FAILED",503);
      const latest=await resolve();
      if(!latest || latest.path!==reference.path || latest.hash!==reference.hash) throw new PublicImageError("NOT_FOUND",404);
      res.setHeader("Content-Type","image/webp");
      res.setHeader("Content-Length",bytes.length);
      res.end(bytes);
    } catch(error) {
      const safe=error instanceof PublicImageError ? error : new PublicImageError("IMAGE_SERVICE_FAILED",503);
      res.statusCode=safe.status; res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({error:safe.code}));
    }
  };
}

export async function cleanupPublicImages(backend) {
  const pending=await backend.rpc("claim_memory_image_cleanup",{p_limit:50});
  let deleted=0,failed=0;
  for(const row of pending) {
    try { await backend.remove(pathsFor(row.prefix)); await backend.rpc("complete_memory_image_cleanup",{p_id:row.id}); deleted++; }
    catch { failed++; }
  }
  return { deleted,failed };
}
