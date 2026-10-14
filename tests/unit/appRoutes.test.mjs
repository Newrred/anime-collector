import assert from 'node:assert/strict';
import test from 'node:test';
import {appHeaderRoute,isSoftAppRoute} from '../../src/domain/appRoutes.js';
import {runAppNavigation} from '../../src/domain/appNavigation.js';
test('navigation classifies known pages including packaged index and subpath without a false base match',()=>{
  assert.equal(appHeaderRoute('/','/'),'home');assert.equal(appHeaderRoute('/titles/'),'titles');
  assert.equal(appHeaderRoute('/app/memory/card/index.html','/app/'),'memory-card');
  assert.equal(appHeaderRoute('/application/titles/','/app/'),null);
  assert.equal(appHeaderRoute('/app/title/','/app/'),'title');
});
test('Web program navigation preserves history policy and Native retains the packaged document',()=>{
  const calls=[],options={href:'/app/data/?task=device#backup',currentHref:'https://localhost/app/',base:'/app/',requestLeave:()=>true,clientNavigate:(...args)=>calls.push(['soft',...args]),assign:href=>calls.push(['assign',href]),replaceLocation:href=>calls.push(['replace',href])};
  runAppNavigation({...options,replace:true});assert.deepEqual(calls.pop(),['soft','https://localhost/app/data/?task=device#backup',{history:'replace'}]);
  runAppNavigation({...options,native:true});assert.deepEqual(calls.pop(),['assign','/app/data/index.html?task=device#backup']);
  runAppNavigation({...options,href:'/auth/start/'});assert.deepEqual(calls.pop(),['assign','https://localhost/auth/start/']);
});
test('cancelled intent, same URL and unsafe schemes never navigate; external URLs remain ordinary document navigation',()=>{
  const calls=[],options={currentHref:'https://localhost/',requestLeave:()=>true,clientNavigate:href=>calls.push(href),assign:href=>calls.push(href),replaceLocation:href=>calls.push(href)};
  for(const href of ['/','javascript:alert(1)','data:text/html,x'])runAppNavigation({...options,href});
  runAppNavigation({...options,href:'/data/',requestLeave:()=>false});assert.equal(calls.length,0);
  runAppNavigation({...options,href:'https://example.com/'});assert.deepEqual(calls,['https://example.com/']);
});
test('public routes can navigate softly without adding an owner header; authentication and server APIs stay separate',()=>{
  for(const path of ['/public/home/','/public/board/','/catalog/detail/']){assert.equal(isSoftAppRoute(path),true);assert.equal(appHeaderRoute(path),null);}
  for(const path of ['/auth/start/','/auth/complete/','/auth/callback/','/legal/public-sharing/','/api/private-image','/unknown/'])assert.equal(isSoftAppRoute(path),false);
});
