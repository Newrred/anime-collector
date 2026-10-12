import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_SHARING_POLICY_REVISION as revision, publicSharingNoticeHref as href } from '../../src/features/memory/domain/publicSharingPolicy.js';
test('notice resolves only the exact immutable revision, including a subpath deployment',()=>{
 assert.equal(href(revision),'/legal/public-sharing-2026-10-11/');
 assert.equal(href(revision,'/moemoa'),'/moemoa/legal/public-sharing-2026-10-11/');
 assert.equal(href(revision,'/moemoa/'),'/moemoa/legal/public-sharing-2026-10-11/');
 for(const unknown of [null,undefined,'','UNAPPROVED','TEST_ONLY','https://other.example/policy',revision+' '])assert.equal(href(unknown),null);
});
