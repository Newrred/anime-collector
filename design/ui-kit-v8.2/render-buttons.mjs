import {chromium} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({deviceScaleFactor:3});
const css=await readFile('design/ui-kit-v8.2/tokens.css','utf8');await mkdir('design/ui-kit-v8.2/buttons-labeled',{recursive:true});
for(const [name,label,icon,extra] of [['primary','기억 남기기','plus','primary'],['secondary','책장 꾸미기','edit',''],['ready','준비됐어요','check','success'],['retry','다시 시도','retry',''],['checking','처리 상태 확인','info',''],['disabled','이미지 준비','image','']]){
 const tone=extra==='primary'?'inverse':'ink';const bytes=await readFile(`design/ui-kit-v8.2/png/${icon}-${tone}-72.png`);
 await page.setContent(`<style>${css}body{margin:8px;font-family:'Malgun Gothic',sans-serif}button{white-space:nowrap}</style><button class="mm-button ${extra}" ${name==='disabled'?'disabled':''}><img src="data:image/png;base64,${bytes.toString('base64')}" alt="">${label}</button>`);
 await page.locator('button').screenshot({path:`design/ui-kit-v8.2/buttons-labeled/${name}@3x.png`,omitBackground:true});
}
await browser.close();console.log('6 labeled button PNG rendered at 3x');
