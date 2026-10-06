import {chromium} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const b=await chromium.launch();const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const results=[];const url='http://127.0.0.1:4351/bookshelf-detail-v8.3/index.html#home';
for(const width of [1440,390,320]){
 await p.setViewportSize({width,height:1000});await p.goto('about:blank');await p.goto(url);await p.locator('.shelf-cover').first().waitFor();
 const before=await p.locator('.shelf-cover').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})));
 await p.screenshot({path:`design/bookshelf-detail-v8.3/home-${width}.png`,fullPage:true});
 await p.locator('.shelf-cover').first().click();await p.waitForTimeout(220);const after=await p.locator('.shelf-cover').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('grid shift');
 await p.screenshot({path:`design/bookshelf-detail-v8.3/film-${width}.png`,fullPage:true});
 if(!await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('overflow film '+width);
 await p.locator('.shelf-panel-cover').click();await p.waitForTimeout(100);if(!p.url().includes('/bookshelf-detail-v8.3/index.html#title/'))throw Error('route escaped');
 await p.locator('.brand').click();await p.locator('.shelf-menu summary').click();await p.screenshot({path:`design/bookshelf-detail-v8.3/menu-${width}.png`,fullPage:true});
 await p.keyboard.press('Escape');if(await p.locator('.shelf-menu').getAttribute('open')!==null)throw Error('menu escape');
 await p.locator('.shelf-menu summary').click();await p.locator('#shelf-edit').click();await p.locator('#shelf-name').fill('나의 새 책장');await p.screenshot({path:`design/bookshelf-detail-v8.3/editor-${width}.png`,fullPage:true});
 if(!await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('overflow editor '+width);
 await p.locator('#shelf-cancel').click();if(await p.locator('.desk-toolbar h1').innerText()==='나의 새 책장')throw Error('cancel applied');
 await p.locator('.shelf-menu summary').click();await p.locator('#shelf-edit').click();await p.locator('#shelf-name').fill('나의 새 책장');await p.locator('#shelf-apply').click();if(await p.locator('.desk-toolbar h1').innerText()!=='나의 새 책장')throw Error('apply');
 results.push({width,grid:'unchanged',overflow:0,menuEscape:true,editCancelApply:true,routeContained:true});
}
await p.emulateMedia({reducedMotion:'reduce'});if(await p.locator('.button').first().evaluate(e=>getComputedStyle(e).transitionDuration)!=='0s')throw Error('motion');await b.close();if(errors.length)throw Error(errors.join('\n'));await writeFile('design/bookshelf-detail-v8.3/verification.json',JSON.stringify({results,pageErrors:errors,reducedMotion:true,scope:'Desktop Chromium; prototype RAM only'},null,2));console.log(results);
