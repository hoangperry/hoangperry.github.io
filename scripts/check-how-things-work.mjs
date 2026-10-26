#!/usr/bin/env node
// Static integrity/routing check. Does not build, write, or access the model repository.
import { readFileSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ASSET = 'assets/how-things-work/c-41/';
const MANIFEST = `${ASSET}manifest.json`;
const PAYLOADS = [
  '_includes/how-things-work/c-41-scene.html',
  '_includes/how-things-work/c-41-console.html',
  `${ASSET}c41.js`, `${ASSET}c41.css`, `${ASSET}thumbnail.webp`, `${ASSET}NOTICE.txt`,
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function readInside(root, path) {
  if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\') || path.split('/').some((p) => !p || p === '.' || p === '..')) {
    throw new Error(`Unsafe relative path: ${path}`);
  }
  const realRoot = realpathSync(root);
  let current = realRoot;
  for (const part of path.split('/')) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${path}`);
  }
  const rel = relative(realRoot, realpathSync(current));
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path escapes root: ${path}`);
  if (!lstatSync(current).isFile()) throw new Error(`Not a regular file: ${path}`);
  return readFileSync(current);
}
function basePath(value) {
  if (value === '' || value === '/') return '';
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('//') || /[?#\\]/.test(value) || value.split('/').some((p) => p === '..' || p === '.')) {
    throw new Error('baseurl must be empty or a root-relative prefix');
  }
  return value.replace(/\/+$/, '');
}
const cleanHtml = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (tag) => tag.startsWith('<script') && /\bsrc\s*=/i.test(tag) ? tag.replace(/>[\s\S]*<\//, '></') : '');
function attributes(tag) {
  const result = {};
  const body = tag.replace(/^<\/?[\w:-]+/, '').replace(/\/?>$/, '');
  for (const match of body.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? '').replaceAll('&amp;', '&');
  }
  return result;
}
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => ({ tag: m[0], index: m.index, attrs: attributes(m[0]) }));
const urlPath = (value = '') => value.split(/[?#]/, 1)[0];
function machineCount(html) {
  return tags(html, 'svg').filter(({ attrs }) => {
    const classes = (attrs.class ?? '').split(/\s+/);
    return classes.includes('fp-svg') && classes.includes('op-svg');
  }).length;
}
function rootSegment(html, rootTag) {
  let depth = 1;
  const tail = html.slice(rootTag.index + rootTag.tag.length);
  for (const tag of tail.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return tail.slice(0, tag.index);
  }
  return '';
}

export function validateHowThingsWork({ root = process.cwd(), site, baseurl = '' } = {}) {
  const errors = [];
  let filesChecked = 0; let routesChecked = 0;
  const report = () => ({ ok: errors.length === 0, errors, filesChecked, routesChecked });
  root = resolve(root);
  let prefix;
  try { prefix = basePath(baseurl); readInside(root, '_config.yml'); }
  catch (error) { errors.push(error.message); return report(); }
  let manifest;
  try { manifest = JSON.parse(readInside(root, MANIFEST).toString('utf8')); }
  catch (error) { errors.push(`Manifest missing/invalid: ${error.message}`); return report(); }
  if (!isRecord(manifest) || manifest.schemaVersion !== 1) errors.push('Invalid manifest schemaVersion; expected 1');
  if (!isRecord(manifest) || manifest.topic !== 'c-41') errors.push('Invalid manifest topic; expected c-41');
  if (!isRecord(manifest) || !isHash(manifest.sourceDigest)) errors.push('Invalid manifest sourceDigest');
  if (!isRecord(manifest) || !isRecord(manifest.files)) {
    errors.push('Manifest files must be a payload path/hash map'); return report();
  }
  const expected = [...PAYLOADS].sort();
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(expected)) errors.push('Payload path whitelist must contain exactly the six expected files');
  const source = new Map();
  for (const path of PAYLOADS) {
    if (!isHash(manifest.files[path])) { errors.push(`Invalid hash for payload ${path}`); continue; }
    try {
      const bytes = readInside(root, path); filesChecked++;
      source.set(path, bytes);
      if (sha(bytes) !== manifest.files[path]) errors.push(`Hash mismatch: ${path}`);
      if (!path.endsWith('.webp') && bytes.toString('utf8').includes('/Users/')) errors.push(`Nonportable home path in payload: ${path}`);
    } catch (error) { errors.push(`Payload missing/unsafe ${path}: ${error.message}`); }
  }
  for (const path of PAYLOADS.filter((p) => p.endsWith('.html'))) {
    const bytes = source.get(path); if (!bytes) continue;
    const text = bytes.toString('utf8');
    if (!/^\s*{%-?\s*raw\s*-?%}/.test(text) || !/{%-?\s*endraw\s*-?%}\s*$/.test(text)
      || (text.match(/{%-?\s*raw\s*-?%}/g) ?? []).length !== 1 || (text.match(/{%-?\s*endraw\s*-?%}/g) ?? []).length !== 1) errors.push(`Unsafe Liquid raw wrapper: ${path}`);
    if (/<(?:html|head|body)\b/i.test(text)) errors.push(`Whole HTML document in include: ${path}`);
    if (path.endsWith('-scene.html') && machineCount(text) !== 1) errors.push('Scene include must contain exactly one machine SVG');
    if (path.endsWith('-console.html') && /<svg\b/i.test(text)) errors.push('Console include must not contain a second SVG scene');
  }
  for (const path of [`${ASSET}c41.js`, `${ASSET}c41.css`]) {
    if (/^\s*---(?:\r?\n|$)/.test(source.get(path)?.toString('utf8') ?? '')) errors.push(`Static asset must not have front matter: ${path}`);
  }
  if (!site) return report();
  site = resolve(site);
  const hubUrl = `${prefix}/how-things-work/`;
  const articleUrl = `${hubUrl}c-41/`;
  const expectedJs = `${prefix}/${ASSET}c41.js`;
  const expectedCss = `${prefix}/${ASSET}c41.css`;
  const expectedThumbnail = `${prefix}/${ASSET}thumbnail.webp`;
  const built = {};
  for (const [name, path] of Object.entries({ hub: 'how-things-work/index.html', article: 'how-things-work/c-41/index.html', home: 'index.html', photography: 'photography/index.html' })) {
    try { built[name] = cleanHtml(readInside(site, path).toString('utf8')); if (name === 'hub' || name === 'article') routesChecked++; }
    catch (error) { errors.push(`Built route missing/unsafe ${path}: ${error.message}`); }
  }
  for (const path of PAYLOADS.filter((p) => p.startsWith('assets/'))) {
    try { if (sha(readInside(site, path)) !== manifest.files[path]) errors.push(`Built asset hash/copy mismatch: ${path}`); }
    catch (error) { errors.push(`Built asset missing/unsafe ${path}: ${error.message}`); }
  }
  const hrefs = (html = '') => tags(html, 'a').map(({ attrs }) => urlPath(attrs.href));
  const scripts = (html = '') => tags(html, 'script').map(({ attrs }) => urlPath(attrs.src));
  if (built.hub) {
    if (!hrefs(built.hub).includes(articleUrl)) errors.push('Hub navigation link to C-41 is missing or has wrong baseurl');
    if (!tags(built.hub, 'img').some(({ attrs }) => urlPath(attrs.src) === expectedThumbnail)) errors.push('Hub thumbnail asset missing or wrong baseurl');
    if (scripts(built.hub).some((path) => path.endsWith(`/${ASSET}c41.js`)) || machineCount(built.hub)) errors.push('Hub/library must not load the machine bundle or live SVG');
  }
  if (built.article) {
    const html = built.article;
    if (machineCount(html) !== 1) errors.push('Article must contain one single machine SVG');
    const elements = tags(html, '[a-z][\\w:-]*');
    const roots = elements.filter(({ attrs }) => attrs['data-htw-figure'] === 'c-41');
    if (roots.length !== 1 || !/^<div\b/i.test(roots[0].tag)) errors.push('Article must contain exactly one machine div root');
    else {
      const segment = rootSegment(html, roots[0]);
      const inside = tags(segment, '[a-z][\\w:-]*');
      if (!segment || machineCount(segment) !== 1 || inside.filter(({ attrs }) => attrs.id === 'operation').length !== 1) errors.push('Machine scene and console must share one scoped root');
      for (const slot of ['data-htw-scene', 'data-htw-reader-slot', 'data-htw-explore-slot', 'data-htw-explore-controls', 'data-htw-story']) {
        if (inside.filter(({ attrs }) => Object.hasOwn(attrs, slot)).length !== 1) errors.push(`Required mount slot must appear once: ${slot}`);
      }
    }
    if (elements.filter(({ attrs }) => attrs.id === 'operation').length !== 1) errors.push('Article must contain exactly one operation console');
    const modelScripts = scripts(html).filter((path) => path.endsWith(`/${ASSET}c41.js`));
    if (modelScripts.length !== 1) errors.push('Article bootstrap script must appear exactly once');
    if (modelScripts[0] !== expectedJs) errors.push('Article model script asset has wrong baseurl prefix');
    if (!tags(html, 'link').some(({ attrs }) => urlPath(attrs.href) === expectedCss && attrs.rel === 'stylesheet')) errors.push('Article model CSS asset missing or wrong baseurl');
    if (!hrefs(html).includes(hubUrl)) errors.push('Article return navigation to hub is missing or has wrong baseurl');
    if (!/^vi(?:-|$)/.test(tags(html, 'html')[0]?.attrs.lang ?? '')) errors.push('Article language must be Vietnamese');
    if (/{[{%]/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))) errors.push('Unrendered Liquid/raw delimiter in article HTML');
  }
  if (built.home && !hrefs(built.home).includes(hubUrl)) errors.push('Profile/home navigation link to library is missing or wrong baseurl');
  if (built.photography && !hrefs(built.photography).includes(articleUrl)) errors.push('Photography cross-link to C-41 is missing or wrong baseurl');
  for (const path of ['scripts/check-how-things-work.mjs', 'scripts/check-how-things-work.test.mjs']) {
    if (existsSync(join(site, path))) errors.push(`Validation script/checker must be excluded from public output: ${path}`);
  }
  return report();
}

function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/check-how-things-work.mjs [--site <output-dir>] [--baseurl <prefix>]'); return;
    }
    if (!['--site', '--baseurl'].includes(argv[i]) || argv[i + 1] === undefined || argv[i + 1].startsWith('--') || (argv[i] === '--site' && !argv[i + 1])) {
      console.error(`Invalid or missing argument: ${argv[i]}`); process.exitCode = 2; return;
    }
    options[argv[i] === '--site' ? 'site' : 'baseurl'] = argv[++i];
  }
  const result = validateHowThingsWork(options);
  if (!result.ok) {
    for (const error of result.errors) console.error(`How Things Work: ${error}`);
    process.exitCode = 1;
  } else console.log(`How Things Work: valid (${result.filesChecked} payloads, ${result.routesChecked} routes)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
