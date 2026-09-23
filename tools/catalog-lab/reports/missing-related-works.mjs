import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {identityTitleKey} from '../pipeline/title-identity-signals.mjs';

// Offline evidence audit: an absent provider ID alone never proves a missing work.
export function auditMissingRelatedWorks(snapshot, reviews) {
  const rows=snapshot.data.catalog_anime_search;
  const ids=new Set(rows.filter(x=>x.anilist_id!=null).map(x=>String(x.anilist_id)));
  const titles=new Map();
  for(const row of rows) for(const title of [row.preferred_title,...row.search_aliases.map(x=>x.value)]) {
    const key=identityTitleKey(title); if(!titles.has(key))titles.set(key,new Set()); titles.get(key).add(row.anime_id);
  }
  const byAnime=new Map(rows.map(x=>[x.anime_id,x]));
  const reviewByAnime=new Map(reviews.records.map(x=>[x.animeId,x]));
  const missing=new Map(); let checkedRelations=0;
  for(const detail of snapshot.data.catalog_anime_details) {
    const source=byAnime.get(detail.anime_id); if(!source)continue;
    const excluded=new Set((reviewByAnime.get(detail.anime_id)?.excludedTitles||[]).map(x=>identityTitleKey(x.value)));
    for(const relation of detail.payload.relations||[]) {
      const match=/^anilist:(\d+)$/.exec(relation.targetId||'');
      if(!match||!['TV','TV_SHORT','MOVIE','OVA','ONA','SPECIAL','MUSIC'].includes(relation.format))continue;
      checkedRelations++;
      if(ids.has(match[1]))continue;
      const key=identityTitleKey(relation.title);
      const titleMatches=[...(titles.get(key)||[])].filter(x=>x!==source.anime_id);
      if(!missing.has(match[1]))missing.set(match[1],{anilistId:Number(match[1]),title:relation.title,format:relation.format,sources:[],possibleExistingAnimeIds:[],removedAliasMatch:false});
      const item=missing.get(match[1]);
      item.sources.push({animeId:source.anime_id,title:source.preferred_title,type:relation.type});
      item.possibleExistingAnimeIds=[...new Set([...item.possibleExistingAnimeIds,...titleMatches])];
      item.removedAliasMatch ||= excluded.has(key);
    }
  }
  const candidates=[...missing.values()].map(x=>({...x,priority:x.possibleExistingAnimeIds.length?'CHECK_EXISTING_IDENTITY':x.removedAliasMatch?'REMOVED_ALIAS_WITHOUT_TARGET':x.sources.some(s=>['SEQUEL','PREQUEL'].includes(s.type))&&x.format==='TV'?'TV_SEASON_GAP':'OTHER_RELATED_WORK'})).sort((a,b)=>a.anilistId-b.anilistId);
  return {release:snapshot.release.id,catalogCount:rows.length,checkedRelations,counts:Object.fromEntries(['REMOVED_ALIAS_WITHOUT_TARGET','TV_SEASON_GAP','CHECK_EXISTING_IDENTITY','OTHER_RELATED_WORK'].map(k=>[k,candidates.filter(x=>x.priority===k).length])),limitations:['Known stored relations only; not a complete universe of anime','Absent external ID requires title/identity review','No automatic insertion; unreleased works and unrelated formats require separate review'],candidates};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [snapshotPath,reviewsPath,out]=process.argv.slice(2);
  const result=auditMissingRelatedWorks(JSON.parse(await fs.readFile(snapshotPath,'utf8')),JSON.parse(await fs.readFile(reviewsPath,'utf8')));
  await fs.writeFile(out,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({...result,candidates:result.candidates.filter(x=>x.priority==='REMOVED_ALIAS_WITHOUT_TARGET')}));
}
