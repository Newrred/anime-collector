import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch(),rows=[];
for(const width of [1440,390,320]){
 const p=await b.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4351/channel-study-v8.4/index.html#home');
 await expect(p.locator('.desk-toolbar h1')).toHaveText('MOEMOA/내 책장');
 await p.locator('#channel-info-toggle').click();await p.locator('#shelf-tab-s1').click();await expect(p.locator('.desk-toolbar h1')).toContainText('오래 남은 작품');
 await p.locator('#shelf-tab-s2').click();await expect(p.locator('.desk-toolbar h1')).toContainText('다시 꺼내 볼 작품');
 await p.locator('#shelf-tab-all').click();await expect(p.locator('.desk-toolbar h1')).not.toContainText('오래 머무는');
 await p.locator('nav [data-page=memories]').click();await p.locator('#facet-tag-0').click();await expect(p.locator('.channel-item')).toHaveCount(7);
 await p.locator('#facet-character-0').click();await expect(p.locator('.channel-item')).toHaveCount(6);
 await p.locator('#facet-affinity-1').click();await expect(p.locator('.channel-item')).toHaveCount(0);await expect(p.getByText('찾는 기억이 없어요')).toBeVisible();
 await p.locator('#facet-affinity-0').click();await expect(p.locator('.channel-item')).toHaveCount(6);
 await p.locator('#channel-global-search').click();await p.locator('#memory-search').fill('아무 말');await expect(p.locator('.channel-item')).toHaveCount(1);await expect(p.locator('.archive-facets [role=status]')).toHaveText('1개의 기억');
 await p.locator('[data-tab-action=memory-view][data-view=table]').click();await expect(p.locator('.channel-table tbody tr')).toHaveCount(1);
 await p.locator('[data-tab-action=memory-view][data-view=grid]').click();await p.locator('[data-action=memory-reset]').first().click();await expect(p.locator('.channel-item')).toHaveCount(18);
 await p.locator('#facet-character-0').click();await p.locator('[data-clear-facets]').click();await expect(p.locator('.channel-item')).toHaveCount(18);
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`design/channel-study-v8.4/facets-${width}.png`,fullPage:true});
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow||errors.length)throw Error(JSON.stringify({overflow,errors}));
 rows.push({width,shelfBreadcrumb:true,tag:7,character:6,incompatible:0,searchAndTable:1,reset:18,overflow,errors});await p.close();
}
await b.close();await writeFile('design/channel-study-v8.4/facets-verification.json',JSON.stringify(rows,null,2));console.log(rows);
