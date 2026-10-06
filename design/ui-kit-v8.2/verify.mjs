import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=[];
for(const width of [1440,320]){
 await page.setViewportSize({width,height:1000});
 await page.goto('http://127.0.0.1:4351/ui-kit-v8.2/index.html');await page.locator('.icon').last().waitFor();
 if(await page.locator('.icon').count()!==28)throw Error('icon count');
 if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('overflow kit');
 await page.screenshot({path:`design/ui-kit-v8.2/kit-${width}.png`,fullPage:true});
 await page.selectOption('#outcome','unknown');await page.click('#prepare');await page.getByRole('button',{name:'처리 상태 확인',exact:true}).waitFor();await page.click('#prepare');await page.getByRole('button',{name:'다시 체험하기',exact:true}).waitFor();
 await page.selectOption('#outcome','error');await page.click('#prepare');await page.getByRole('button',{name:'다시 시도',exact:true}).waitFor();
 await page.selectOption('#outcome','success');await page.click('#prepare');await page.getByRole('button',{name:'다시 체험하기',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4351/ui-kit-v8.2/v8-refined.html#home');await page.locator('.shelf-cover').first().waitFor();
 const before=await page.locator('.shelf-cover').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})));
 await page.locator('.shelf-cover').first().click();await page.waitForTimeout(250);
 const after=await page.locator('.shelf-cover').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('grid moved');
 if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('overflow v8');
 await page.screenshot({path:`design/ui-kit-v8.2/refined-${width}.png`,fullPage:true});checks.push({width,icons:28,overflow:0,states:['success','failure','unknown-query'],coverGeometry:'unchanged'});
}
await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.locator('.button').first().evaluate(e=>getComputedStyle(e).transitionDuration);if(reduced!=='0s')throw Error('motion');
await browser.close();if(errors.length)throw Error(errors.join('\n'));await writeFile('design/ui-kit-v8.2/verification.json',JSON.stringify({checks,reducedMotion:reduced,pageErrors:errors,limits:'Desktop Chromium simulation; no real phone, backend, production or full service testing'},null,2));console.log(JSON.stringify({checks,reducedMotion:reduced,pageErrors:errors}));
