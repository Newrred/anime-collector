const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function publicImageUrl(publicationId,assetId,variant="thumb") {
  if(!UUID.test(publicationId || "") || !UUID.test(assetId || "") || !["thumb","full"].includes(variant)) throw new Error("INVALID_PUBLIC_IMAGE");
  return `/api/public-image?publication=${publicationId}&asset=${assetId}&variant=${variant}`;
}
export function publicDesignStyle(visual) {
  if(visual?.type!=="SYSTEM_DESIGN" || visual.rendererVersion!==1 || !/^[a-f0-9]{8}$/.test(visual.patternToken || "")) throw new Error("INVALID_PUBLIC_DESIGN");
  return { "--design-hue":parseInt(visual.patternToken.slice(0,2),16),"--design-angle":`${parseInt(visual.patternToken.slice(2,4),16)%180}deg` };
}
