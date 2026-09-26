// Windows Node -> disposable WSL PostgreSQL. No hosted URL, token or user data.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SupabasePublicationGateway } from '../../src/features/memory/adapters/supabase/SupabasePublicationGateway.js';

const [socket, psql] = process.argv.slice(2);
assert.match(socket ?? '', /^\/tmp\/moemoa-publication-test\.[A-Za-z0-9]+$/);
assert.match(psql ?? '', /^\/usr\/lib\/postgresql\/\d+\/bin\/psql$/);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const quote = value => value === null ? 'null' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  const result = spawnSync('wsl.exe', ['-u', 'postgres', '-e', psql, '-h', socket, '-p', '55437', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.match(/ERROR:\s+([A-Z_]+)/)?.[1] ?? 'LOCAL_SQL_FAILED');
  return result.stdout.trim();
}
const allowed = new Set(['list_memory_pending_content', 'open_memory_content_review', 'get_memory_content_review', 'resolve_memory_content_appeal', 'list_memory_moderation']);
function gateway(user) {
  return new SupabasePublicationGateway({ async rpc(name, args) {
    assert.ok(allowed.has(name));
    for (const key of Object.keys(args)) assert.match(key, /^p_[a-z_]+$/);
    try {
      const sql = `begin; set local role authenticated; set local request.jwt.claim.sub=${quote(user)}; select public.${name}(${Object.entries(args).map(([key, value]) => `${key} => ${quote(value)}`).join(',')}); commit;`;
      return { data: JSON.parse(query(sql)), error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  } });
}
query(`update private.memory_publication_settings set content_policy_revision='TEST_ONLY_CONTENT';
update private.memory_minihomes set published_selection=jsonb_build_object('nickname','Gateway integration fixture','bio','Synthetic review','entries','[]'::jsonb) where user_id=${quote(A)};`);
const target = query(`select id from private.memory_minihomes where user_id=${quote(A)}`);
assert.match(target, /^[a-f0-9-]{36}$/);
const owner = gateway(A), other = gateway(B);
const pending = await owner.pendingContent('home');
assert.ok(pending.items.some(item => item.id === target));
console.log('PASS: actual app gateway reads database-generated pending home queue');
const review = await owner.openContentReview('home', target);
assert.equal(review.target, target);
assert.equal(review.snapshot.nickname, 'Gateway integration fixture');
assert.equal(review.contentRevision, 0);
assert.equal((await owner.contentReview(review.id)).reviewHash, review.reviewHash);
console.log('PASS: actual app gateway opens exact database review package');
const saved = await owner.resolveContentReview(review, 'GENERAL');
assert.equal(saved.id, review.id);
assert.equal(saved.status, 'CLOSED');
assert.equal(saved.contentRevision, 1);
assert.ok(!(await owner.pendingContent('home')).items.some(item => item.id === target));
console.log('PASS: gateway classification arguments match real SQL and remove reviewed target');
query(`update private.memory_minihomes set published_selection=jsonb_set(published_selection,'{bio}','"Synthetic newer bio"') where id=${quote(target)}`);
const changed = await owner.openContentReview('home', target);
query(`update private.memory_minihomes set published_selection=jsonb_set(published_selection,'{bio}','"Synthetic latest bio"') where id=${quote(target)}`);
await assert.rejects(owner.resolveContentReview(changed, 'GENERAL'), { code: 'PUBLICATION_CONFLICT' });
console.log('PASS: gateway preserves actual database stale-review rejection');
await assert.rejects(other.pendingContent('home'), { code: 'MODERATOR_REQUIRED' });
await assert.rejects(other.openContentReview('home', target), { code: 'MODERATOR_REQUIRED' });
console.log('PASS: gateway preserves actual database non-moderator denial');
if (process.argv[4] === '1') {
  const { runContentReviewBrowser } = await import('./content-review-browser.mjs');
  await runContentReviewBrowser({ user: A, rpc: owner.client.rpc, verify: () => {
    assert.equal(query(`select rating||':'||revision from private.memory_home_content_reviews where home_id=${quote(target)}`), 'MATURE:2');
  } });
}
