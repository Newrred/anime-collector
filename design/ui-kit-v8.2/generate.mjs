import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const icons={
 'arrow-right':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
 'arrow-left':'<path d="M20 12H5m6-6-6 6 6 6"/>',
 'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
 'chevron-down':'<path d="m6 9 6 6 6-6"/>',
 'chevron-up':'<path d="m6 15 6-6 6 6"/>',
 'chevron-left':'<path d="m15 6-6 6 6 6"/>',
 'chevron-right':'<path d="m9 6 6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14" stroke-width="2.5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
 edit:'<path d="m14 5 5 5M4 20l1-6L16 3l5 5L10 19Z"/>',
 shelf:'<path d="M3 20h18"/><rect x="4" y="5" width="6" height="12" rx="1.5"/><path d="m13 5 5-1 3 12-5 1Z"/><path d="M6.5 8h1m8-.5 1-.2"/>',
 film:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 4v16M17 4v16M3 8h4m-4 4h4m-4 4h4m10-8h4m-4 4h4m-4 4h4"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',
 heart:'<path d="M12 20 4 12C-1 5 7 0 12 7c5-7 13-2 8 5Z"/>',
 share:'<path d="M12 15V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
 report:'<path d="M5 21V3m0 1h14l-3 5 3 5H5"/>',
 retry:'<path d="M20 9a8 8 0 1 0 0 7M20 3v6h-6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
 spinner:'<path d="M12 3a9 9 0 1 1-9 9"/>',
 trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};
const colors={ink:'#252525',muted:'#686862',inverse:'#ffffff',accent:'#e60068'};
const records=[];
await mkdir(root+'svg',{recursive:true});await mkdir(root+'png',{recursive:true});await mkdir(root+'buttons',{recursive:true});
for(const [name,body] of Object.entries(icons)){
 const svg=c=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
 await writeFile(root+`svg/${name}.svg`,svg('currentColor'));
 for(const [tone,color] of Object.entries(colors))for(const size of [24,48,72]){
  const file=`png/${name}-${tone}-${size}.png`;
  await sharp(Buffer.from(svg(color))).resize(size,size).png().toFile(root+file);
  const m=await sharp(root+file).metadata();if(m.width!==size||!m.hasAlpha)throw Error(file);
  records.push({file,size,tone,name});
 }
}
for(const [state,bg,fg] of [['default','#252525','#ffffff'],['hover','#3b3b39','#ffffff'],['pressed','#141414','#ffffff'],['disabled','#ecece8','#94948e'],['success','#edf4ef','#356547']]){
 const body=state==='success'?icons.check:icons.plus;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="132" height="44"><rect width="132" height="44" rx="3" fill="${bg}"/><g transform="translate(16 10)" fill="none" stroke="${fg}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</g><path d="M53 17h54M53 25h38" stroke="${fg}" stroke-width="3" stroke-linecap="round"/></svg>`;
 await sharp(Buffer.from(svg)).resize(396,132).png().toFile(root+`buttons/primary-${state}@3x.png`);
}
await writeFile(root+'manifest.json',JSON.stringify({version:'v8.2',method:'Original geometric SVG rendered with existing sharp; no AI raster generation',icons:Object.keys(icons),colors,pngCount:records.length,buttonSpecimens:5,records},null,2));
console.log(`${Object.keys(icons).length} icons; ${records.length} alpha PNG verified; 5 button specimens (placeholder lines, not baked text)`);
