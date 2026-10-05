import { readdir, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_ROOT, DEFAULT_PAGE, MIME_TYPES, isWithinRoot, safeFile } from './serve-design-prototypes.mjs';

const staticExtension = /\.(?:html|css|m?js|json|png|jpe?g|webp|gif|svg|ico|avif)(?:[?#].*)?$/i;

function decodeHtmlEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()];
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

export function localReferences(source, extension) {
  // srcdoc stores a second HTML document as entity-encoded attribute text.
  if (extension === '.html') source = decodeHtmlEntities(source);
  const refs = new Set();
  const add = (value) => {
    value = value.trim().replaceAll('&amp;', '&');
    if (!value || value.startsWith('#') || /^(?:https?:|data:|mailto:|tel:|blob:|\/\/)/i.test(value) || value.includes('${')) return;
    refs.add(value);
  };
  if (extension === '.html') {
    // Restrict attributes to tags: a script's image.src = 'prefix-' is not a URL.
    for (const tag of source.matchAll(/<[a-z][^>]*>/gi)) {
      for (const match of tag[0].matchAll(/\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gs)) add(match[2]);
      for (const match of tag[0].matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gs)) {
        if (!match[2].trim().startsWith('data:')) for (const entry of match[2].split(',')) add(entry.trim().split(/\s+/)[0]);
      }
    }
    // This archived chooser has a finite, visible set of numeric button IDs.
    // Resolve only that known concatenation, not arbitrary JS expressions.
    if (/["']film-logo-["']\s*\+\s*id\s*\+\s*["']\.png["']/.test(source)) {
      const choices = [...source.matchAll(/\bid\s*=\s*["']choose(\d+)["']/g)];
      if (!choices.length) throw new Error('Dynamic film-logo chooser has no statically declared choices');
      for (const choice of choices) add(`film-logo-${choice[1]}.png`);
    }
  }
  for (const match of source.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)) add(match[2]);
  for (const match of source.matchAll(/@import\s+(["'])(.*?)\1/g)) add(match[2]);
  // Include literal JS asset names and inline script/template asset references.
  if (['.js', '.mjs', '.html'].includes(extension)) {
    for (const match of source.matchAll(/(["'`])([^\s"'`<>]+)\1/g)) {
      const name = match[2].split(/[?#]/, 1)[0].split('/').at(-1);
      if (name && !name.startsWith('.') && staticExtension.test(match[2])) add(match[2]);
    }
  }
  return [...refs];
}

async function listFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Linked file/directory is not portable: ${name}`);
    if (entry.isDirectory()) files.push(...await listFiles(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

function syntaxCheck(source, filename, module = false) {
  const result = spawnSync(process.execPath, ['--check', `--input-type=${module ? 'module' : 'commonjs'}`], {
    input: source, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`${filename}: JavaScript syntax failed\n${result.error?.message || result.stderr}`);
}

export async function checkDesignPrototypes({ root = DEFAULT_ROOT, runFixtures = true } = {}) {
  root = await realpath(root);
  const files = await listFiles(root);
  const errors = [], external = new Set(), fixtures = [], syntax = [], dependencies = [];
  if (!files.includes(DEFAULT_PAGE)) errors.push(`Missing default page: ${DEFAULT_PAGE}`);
  for (const file of files.filter((name) => /\.(html|css|m?js)$/i.test(name))) {
    const extension = path.extname(file).toLowerCase();
    const source = await readFile(path.join(root, file), 'utf8');
    for (const url of decodeHtmlEntities(source).matchAll(/https?:\/\/[^\s"'<>`)]+/g)) external.add(url[0].replace(/;+$/, ''));
    for (const ref of localReferences(source, extension)) {
      try {
        const pathname = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
        if (!pathname) continue;
        if (/[\\\u0000-\u001f\u007f:]/.test(pathname)) throw new Error('nonportable local path');
        const absolute = pathname.startsWith('/') ? path.resolve(root, `.${pathname}`) : path.resolve(root, path.dirname(file), pathname);
        if (!isWithinRoot(root, absolute)) throw new Error('path escapes prototype directory');
        if (!Object.hasOwn(MIME_TYPES, path.extname(absolute).toLowerCase())) throw new Error('file type not served');
        const relative = path.relative(root, absolute);
        await safeFile(root, relative);
        dependencies.push({ from: file, to: relative });
      } catch (error) { errors.push(`${file} → ${ref}: ${error.code === 'ENOENT' ? 'missing file' : error.message}`); }
    }
    try {
      if (['.js', '.mjs'].includes(extension)) {
        syntaxCheck(source, file, extension === '.mjs');
        syntax.push(file);
        if (runFixtures && /checkModel\(\);\s*if\s*\(typeof document === ["']undefined["']\) return;/.test(source)) {
          new Script(source, { filename: file }).runInNewContext({ console: { log() {}, warn() {}, error() {} } }, { timeout: 2000 });
          fixtures.push(file);
        }
      } else if (extension === '.html') {
        let index = 0;
        for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
          if (/\bsrc\s*=/.test(match[1]) || /type\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(match[1])) continue;
          syntaxCheck(match[2], `${file} inline script ${++index}`, /type\s*=\s*["']module["']/i.test(match[1]));
        }
      }
    } catch (error) { errors.push(error.message); }
  }
  let manifestChecked = 0;
  if (files.includes('portable-manifest.json')) {
    try {
      const manifest = JSON.parse(await readFile(path.join(root, 'portable-manifest.json'), 'utf8'));
      if (!Array.isArray(manifest.files)) throw new Error('manifest.files must be an array');
      const seen = new Set();
      for (const entry of manifest.files) {
        if (!entry || typeof entry.path !== 'string' || !/^[a-f\d]{64}$/i.test(entry.sha256 || '')) throw new Error('manifest entry requires path and sha256');
        if (seen.has(entry.path)) throw new Error(`Duplicate manifest path: ${entry.path}`);
        seen.add(entry.path);
        if (path.isAbsolute(entry.path) || entry.path.includes('\\') || entry.path.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Invalid manifest path: ${entry.path}`);
        const content = await readFile(await safeFile(root, entry.path));
        if (createHash('sha256').update(content).digest('hex') !== entry.sha256.toLowerCase()) throw new Error(`Checksum mismatch: ${entry.path}`);
        if (entry.bytes !== undefined && content.length !== entry.bytes) throw new Error(`Byte count mismatch: ${entry.path}`);
        manifestChecked++;
      }
    } catch (error) { errors.push(`portable-manifest.json: ${error.message}`); }
  }
  return { ok: errors.length === 0, fileCount: files.length, dependencyCount: dependencies.length, syntax, fixtures, manifestChecked, externalReferencesNotFetched: [...external].sort(), errors,
    limits: 'Literal HTML/CSS/JS references (including decoded srcdoc), the film-logo-{id}.png chooser resolved from declared chooseNN buttons, and known DOM-free checkModel fixtures only. Other dynamic expressions are not proven by this static check; browser rendering and external resources require separate verification.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 2) throw new Error('Usage: node scripts/check-design-prototypes.mjs');
    const result = await checkDesignPrototypes();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(`Design check failed: ${error.message}`); process.exitCode = 1; }
}
