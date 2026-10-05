import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDesignPrototypeServer, startDesignPrototypeServer, parseArguments, requestFilePath } from '../scripts/serve-design-prototypes.mjs';
import { checkDesignPrototypes, localReferences } from '../scripts/check-design-prototypes.mjs';

const cli = fileURLToPath(new URL('../scripts/serve-design-prototypes.mjs', import.meta.url));

async function fixture(t) {
  const temporaryParent = await realpath(tmpdir());
  const temporary = await mkdtemp(path.join(temporaryParent, 'moemoa-design-test-'));
  const root = path.join(temporary, 'portable checkout');
  await mkdir(root);
  await mkdir(path.join(root, 'nested'));
  await writeFile(path.join(root, 'moemoa-film-grid.html'), '<!doctype html><title>Design fixture</title>');
  await writeFile(path.join(root, 'style.css'), 'body{color:black}');
  await writeFile(path.join(root, 'hello world.css'), 'body{color:white}');
  await writeFile(path.join(root, 'app.js'), '(()=>{})();');
  await writeFile(path.join(root, 'data.json'), '{"fictional":true}');
  await writeFile(path.join(root, 'image.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(path.join(root, '.env'), 'NEVER SERVE');
  await writeFile(path.join(root, 'README.md'), 'not a web asset');
  await writeFile(path.join(temporary, 'outside.json'), '{"mustNotLeak":true}');
  t.after(async () => {
    const cleanupTarget = await realpath(temporary);
    if (!path.isAbsolute(cleanupTarget) || cleanupTarget !== path.resolve(temporary)
      || path.dirname(cleanupTarget) !== temporaryParent
      || !path.basename(cleanupTarget).startsWith('moemoa-design-test-')) {
      throw new Error('Refusing cleanup outside the exact temporary test directory');
    }
    await rm(cleanupTarget, { recursive: true, force: true });
  });
  return { root, temporary };
}

async function serving(t) {
  const paths = await fixture(t);
  const server = await startDesignPrototypeServer({ root: paths.root, port: 0 });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return { ...paths, server, port: server.address().port };
}

function get(port, target, { method = 'GET', host } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: target, method, headers: host ? { Host: host } : {} }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('importable factory does not listen and CLI accepts only a bounded port', async (t) => {
  const { root } = await fixture(t);
  const server = await createDesignPrototypeServer({ root });
  assert.equal(server.listening, false);
  assert.deepEqual(parseArguments([]), { port: 4348 });
  assert.deepEqual(parseArguments(['--port', '4349']), { port: 4349 });
  for (const args of [['--host', '0.0.0.0'], ['--root', '/'], ['--port', '0'], ['--port', '65536'], ['--port', '3.5'], ['--port', '-1'], ['--port', '4x'], ['--port']]) assert.throws(() => parseArguments(args));
  assert.equal(spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync(process.execPath, [cli, '--host', '0.0.0.0'], { encoding: 'utf8' }).status, 1);
});

test('loopback root, query, MIME, HEAD and no-store responses', async (t) => {
  const { server, port } = await serving(t);
  assert.equal(server.address().address, '127.0.0.1');
  const home = await get(port, '/?start=empty');
  assert.equal(home.status, 200);
  assert.match(home.body.toString(), /Design fixture/);
  assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(home.headers['cache-control'], 'no-store');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  for (const [name, mime] of [['style.css', 'text/css'], ['app.js', 'text/javascript'], ['data.json', 'application/json'], ['image.png', 'image/png'], ['hello%20world.css', 'text/css']]) {
    const response = await get(port, `/${name}?v=1`);
    assert.equal(response.status, 200, name);
    assert.ok(response.headers['content-type'].startsWith(mime));
    const head = await get(port, `/${name}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], response.headers['content-length']);
  }
});

test('raw traversal, encoded separators, malformed input and forbidden files are blocked', async (t) => {
  const { root, port } = await serving(t);
  await mkdir(path.join(root, 'directory.html'));
  for (const target of ['/../outside.json', '/nested/../../outside.json', '/%2e%2e/outside.json', '/nested/./app.js', '/.env', '/README.md']) {
    const response = await get(port, target);
    assert.equal(response.status, 403, target);
    assert.doesNotMatch(response.body.toString(), /mustNotLeak|NEVER SERVE/);
  }
  for (const target of ['/%2e%2e%2foutside.json', '/%252e%252e/outside.json', '/nested\\..\\outside.json', '/%5coutside.json', '/%00.html', '/bad%XX.html', '//outside.json', '/C:/outside.json']) assert.equal((await get(port, target)).status, 400, target);
  for (const target of ['/missing.html', '/directory.html']) assert.equal((await get(port, target)).status, 404, target);
  assert.equal((await get(port, '/nested/')).status, 403);
  assert.throws(() => requestFilePath('http://example.com/file.html'));
  const head = await get(port, '/missing.html', { method: 'HEAD' });
  assert.equal(head.status, 404);
  assert.equal(head.body.length, 0);
});

test('methods and non-loopback Host are rejected', async (t) => {
  const { port } = await serving(t);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await get(port, '/', { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
  assert.equal((await get(port, '/', { host: 'attacker.example' })).status, 403);
  assert.equal((await get(port, '/', { host: `localhost:${port}` })).status, 200);
});

test('symlink or Windows junction escape cannot serve external bytes', async (t) => {
  const { root, temporary, port } = await serving(t);
  const outside = path.join(temporary, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'leak.json'), '{"mustNotLeak":true}');
  try { await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS denied creating a test link'); return; } throw error; }
  const response = await get(port, '/linked/leak.json');
  assert.equal(response.status, 403);
  assert.doesNotMatch(response.body.toString(), /mustNotLeak/);
});

test('busy port fails without changing host or choosing an unexpected port', async (t) => {
  const { root, port } = await serving(t);
  await assert.rejects(startDesignPrototypeServer({ root, port }), { code: 'EADDRINUSE' });
});

test('checker follows literal HTML/CSS/JS references and executes known DOM-free fixtures', async (t) => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'moemoa-film-grid.html'), '<link href="style.css"><script src="app.js"></script><img src="image.png"><a href="#home">Home</a><script>const okay = 1;</script>');
  await writeFile(path.join(root, 'style.css'), '@import "nested/other.css"; body{background:url(image.png)}');
  await writeFile(path.join(root, 'nested', 'other.css'), 'body{color:blue}');
  await writeFile(path.join(root, 'app.js'), '(()=>{function checkModel(){if(2+2!==4)throw Error("fixture");}checkModel(); if(typeof document === "undefined") return; const image="image.png";})();');
  const result = await checkDesignPrototypes({ root });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.dependencyCount, 6);
  assert.deepEqual(result.fixtures, ['app.js']);
  assert.deepEqual(localReferences('<a href="https://example.com/"></a><img src="data:,"><a href="other.html?start=empty#home"></a>', '.html'), ['other.html?start=empty#home']);
  assert.deepEqual(localReferences('<img src="film-logo-01.png"><script>image.src = "film-logo-" + number + ".png";</script>', '.html'), ['film-logo-01.png']);
  assert.deepEqual(localReferences('<style>.icon{background:url(&quot;data:image/svg+xml,%3Csvg/%3E&quot;)}</style><iframe data-srcdoc="&lt;img src=&quot;image.png&quot;&gt;"></iframe>', '.html'), ['image.png']);
  assert.deepEqual(localReferences('<button id="choose01"></button><button id="choose02"></button><script>image.src="film-logo-"+id+".png";</script>', '.html'), ['film-logo-01.png', 'film-logo-02.png']);
  await writeFile(path.join(root, 'chooser.html'), '<button id="choose02"></button><script>image.src="film-logo-"+id+".png";</script>');
  const missingChoice = await checkDesignPrototypes({ root });
  assert.equal(missingChoice.ok, false);
  assert.ok(missingChoice.errors.some((error) => error.includes('film-logo-02.png: missing file')));
});

test('checker reports missing/escaping references, syntax, fixture and checksum failures', async (t) => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'moemoa-film-grid.html'), '<img src="missing.png"><script>const =;</script>');
  await writeFile(path.join(root, 'style.css'), 'body{background:url(../outside.json)}');
  await writeFile(path.join(root, 'app.js'), '(()=>{function checkModel(){throw Error("fixture failed");}checkModel(); if(typeof document === "undefined") return;})();');
  let result = await checkDesignPrototypes({ root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('missing.png')));
  assert.ok(result.errors.some((e) => e.includes('escapes')));
  assert.ok(result.errors.some((e) => e.includes('syntax failed')));
  assert.ok(result.errors.some((e) => e.includes('fixture failed')));
  await writeFile(path.join(root, 'portable-manifest.json'), JSON.stringify({ files: [{ path: 'data.json', sha256: '0'.repeat(64) }] }));
  result = await checkDesignPrototypes({ root });
  assert.ok(result.errors.some((e) => e.includes('Checksum mismatch')));
});

test('optional manifest validates checksum and byte count without requiring network', async (t) => {
  const { root } = await fixture(t);
  const content = Buffer.from('{"fictional":true}');
  await writeFile(path.join(root, 'portable-manifest.json'), JSON.stringify({ files: [{ path: 'data.json', sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length }] }));
  const result = await checkDesignPrototypes({ root });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.manifestChecked, 1);
});
