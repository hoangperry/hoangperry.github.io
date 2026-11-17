#!/usr/bin/env node
// Independent integrity/routing gate for How Things Work playground articles. Node builtins only; it never imports
// model code, never executes payloads and never writes. Run from the repository root:
//   node scripts/playgrounds/check-playgrounds.mjs --site _site [--baseurl /prefix]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

export const TOPICS = Object.freeze(['stepper-motor', 'barometric-altimeter', 'hard-disk-drive']);
export const FIXTURE_MARKER = '.htw-playground-test-fixture';
const MANIFEST_KEYS = ['schemaVersion', 'topic', 'kind', 'sourceDigest', 'files'];
const CONTROL_TAGS = 'button|input|select|textarea';
const MIN_THUMBNAIL = { width: 320, height: 200 };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameKeys = (value, names) => record(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());

export const assetBase = (slug) => `assets/how-things-work/${slug}/`;
export const manifestPath = (slug) => `${assetBase(slug)}manifest.json`;
export function payloadPaths(slug) {
  return [`_includes/how-things-work/${slug}-scene.html`, `_includes/how-things-work/${slug}-console.html`, ...['machine.js', 'machine.css', 'thumbnail.webp', 'NOTICE.txt'].map((name) => `${assetBase(slug)}${name}`)];
}

function noLinks(absolute) {
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink not allowed');
  }
  return absolute;
}
function read(root, rel) {
  if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe relative path: ${rel}`);
  try {
    const absolute = noLinks(path.join(root, rel));
    if (!fs.lstatSync(absolute).isFile()) throw new Error('Not a regular file');
    return fs.readFileSync(absolute);
  } catch (error) { throw new Error(`Cannot read ${rel}: ${error.code ?? error.message}`); }
}
function basePath(value) {
  if (value === '' || value === '/') return '';
  if (typeof value !== 'string' || !value.startsWith('/') || /[?#\\\s]|\/\//.test(value) || value.split('/').some((part) => part === '.' || part === '..')) throw new Error('Invalid baseurl: must be empty or a root-relative prefix');
  return value.replace(/\/+$/, '');
}
function attributes(tag) {
  const result = {};
  for (const match of tag.replace(/^<\/?[\w:-]+/, '').replace(/\/?>$/, '').matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) result[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? '').replaceAll('&amp;', '&');
  return result;
}
const tags = (html, name = '[a-z][\\w:-]*') => [...html.matchAll(new RegExp(`<(?:${name})\\b(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi'))].map((match) => ({ tag: match[0], index: match.index, name: /^<([\w:-]+)/.exec(match[0])[1].toLowerCase(), attrs: attributes(match[0]) }));
const has = (tag, key) => Object.hasOwn(tag.attrs, key);
const clean = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (tag) => /^<script\b/i.test(tag) && /\bsrc\s*=/i.test(tag) ? tag.replace(/>[\s\S]*<\//, '></') : '');
const url = (value = '') => value.split(/[?#]/, 1)[0];
const topicAsset = (value, ext) => new RegExp(`/assets/how-things-work/[^/]+/[^/]+\\.${ext}$`).test(url(value));

function rootContent(html, root) {
  let depth = 1;
  const tail = html.slice(root.index + root.tag.length);
  for (const match of tail.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return tail.slice(0, match.index);
  }
  throw new Error('Unclosed topic root');
}
function checkSafeSvg(svg) {
  if (/<(?:script|style|foreignObject|html|head|body|iframe|animate\w*|set)\b|\bon\w+\s*=|javascript:/i.test(svg)) throw new Error('Unsafe scene SVG');
  for (const match of svg.matchAll(/(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) if (!/^#[\w:.-]+$/.test(match[1] ?? match[2] ?? match[3])) throw new Error('External SVG reference');
  for (const match of svg.matchAll(/url\(([^)]*)\)/gi)) if (!/^#[\w:.-]+$/.test(match[1].trim().replace(/^["']|["']$/g, ''))) throw new Error('External SVG URL');
}
// One scene figure holding exactly one outer SVG, which is the data-machine-view; no console inside the SVG.
function checkScene(html) {
  let depth = 0; let roots = 0; let views = 0; let scenes = 0; let start = 0;
  for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?[a-z][\w:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const tag = match[0]; const name = /^<\/?([\w:-]+)/.exec(tag)[1].toLowerCase();
    if (/^<\//.test(tag)) {
      if (name === 'svg' && --depth < 0) throw new Error('Unbalanced SVG');
      if (name === 'svg' && depth === 0) checkSafeSvg(html.slice(start, match.index + tag.length));
      continue;
    }
    const attrs = attributes(tag);
    if (Object.hasOwn(attrs, 'data-machine-view')) { views++; if (name !== 'svg' || depth !== 0) throw new Error('Machine view must be the outer SVG'); }
    if (Object.hasOwn(attrs, 'data-machine-scene')) { scenes++; if (depth || name === 'svg') throw new Error('Nested machine scene'); }
    if (depth && Object.keys(attrs).some((key) => /^data-machine-console(?:-|$)/.test(key))) throw new Error('Console in scene SVG');
    if (name === 'svg' && depth++ === 0) { roots++; start = match.index; if (/\/\s*>$/.test(tag)) { depth--; checkSafeSvg(tag); } }
  }
  if (depth || roots !== 1 || views !== 1 || scenes !== 1) throw new Error('Expected one scene, one outer SVG and one machine view');
}
function enabledControls(html) {
  return tags(html, CONTROL_TAGS).filter((tag) => !has(tag, 'disabled') && tag.attrs.type !== 'hidden').map((tag) => tag.tag.slice(0, 80));
}
// RIFF/WEBP container with a VP8, VP8L or VP8X first chunk; returns its pixel size.
export function webpSize(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid WebP container');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  if (chunk === 'VP8L' && bytes[20] === 0x2f) { const bits = bytes.readUInt32LE(21); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) }; }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  throw new Error('Unknown WebP bitstream');
}
function checkLeaks(root, site) {
  noLinks(site);
  if (fs.existsSync(path.join(root, FIXTURE_MARKER))) throw new Error('Repository root is labelled as a TEST fixture');
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in site: ${child}`);
      if (child === 'scripts/playgrounds' || child.startsWith('scripts/playgrounds/') || entry.name === 'fixtures' || entry.name.startsWith('.htw-playground') || /^check-playgrounds(?:\.test)?\.mjs$/.test(entry.name)) throw new Error(`Private validator/fixture/journal leaked: ${child}`);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), child);
    }
  };
  walk(site);
}

function checkSource(root, slug, attempt) {
  const base = assetBase(slug); const paths = payloadPaths(slug); const source = new Map();
  let files = 0;
  const manifest = attempt(() => {
    const value = JSON.parse(read(root, manifestPath(slug)));
    if (!sameKeys(value, MANIFEST_KEYS) || value.schemaVersion !== 1 || value.topic !== slug || value.kind !== 'playground' || !hash(value.sourceDigest) || !sameKeys(value.files, paths) || !Object.values(value.files).every(hash)) throw new Error(`Malformed playground manifest: ${slug}`);
    return value;
  });
  if (!manifest) return { files };
  for (const rel of paths) attempt(() => {
    const bytes = read(root, rel); files++;
    if (sha(bytes) !== manifest.files[rel]) throw new Error(`Payload hash mismatch: ${rel}`);
    if (!rel.endsWith('.webp') && /\/Users\/|\/home\/|[A-Z]:\\Users\\|file:\/\//.test(bytes.toString('utf8'))) throw new Error(`Local path leak: ${rel}`);
    source.set(rel, bytes);
  });
  for (const rel of paths.slice(0, 2)) attempt(() => {
    if (!source.has(rel)) return;
    const html = source.get(rel).toString('utf8');
    if (!html.startsWith('{% raw %}\n') || !html.endsWith('\n{% endraw %}\n') || (html.match(/{%/g) ?? []).length !== 2 || (html.match(/%}/g) ?? []).length !== 2 || /\n[\t ]*\n|<(?:html|head|body)\b/i.test(html)) throw new Error(`Unsafe Liquid/whitespace include: ${rel}`);
    if (rel.endsWith('-scene.html')) {
      try { checkScene(html); } catch (error) { throw new Error(`Scene include invalid: ${slug}: ${error.message}`); }
      if (tags(html).some((tag) => Object.keys(tag.attrs).some((key) => /^data-machine-console(?:-|$)/.test(key)))) throw new Error(`Console in scene include: ${slug}`);
    } else {
      if (tags(html, 'svg').length || tags(html, '[a-z][\\w:-]*').some((tag) => has(tag, 'data-machine-scene') || has(tag, 'data-machine-view'))) throw new Error(`Second scene/SVG in console include: ${slug}`);
      if (tags(html, '[a-z][\\w:-]*').filter((tag) => has(tag, 'data-machine-console-panel')).length !== 1) throw new Error(`Expected one console panel: ${slug}`);
      for (const control of ['data-machine-run', 'data-machine-pause', 'data-machine-step', 'data-machine-reset']) if (tags(html, 'button').filter((tag) => has(tag, control)).length !== 1) throw new Error(`Expected one ${control}: ${slug}`);
    }
    const enabled = enabledControls(html);
    if (enabled.length) throw new Error(`Control enabled in static include: ${rel}: ${enabled[0]}`);
  });
  attempt(() => {
    const js = source.get(`${base}machine.js`)?.toString('utf8');
    if (js === undefined) return;
    const executable = js.replace(/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/, '');
    if (!/^;?\s*\(\s*(?:function\b|\([^)]*\)\s*=>)/.test(executable) || !/\}\s*\)\s*\(\s*\)\s*;?\s*$/.test(executable) || /\bimport\s*(?:\(|\.meta)|^\s*(?:import|export)\b/m.test(js) || /^\s*---(?:\r?\n|$)/.test(js)) throw new Error(`Not a classic IIFE bundle: ${slug}`);
    new Script(js, { filename: `${slug}/machine.js` }); // Parse only; never execute payload code.
  });
  attempt(() => {
    const css = source.get(`${base}machine.css`)?.toString('utf8');
    if (css === undefined) return;
    const scope = `.htw-machine[data-htw-figure="${slug}"]`;
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    if (!stripped.includes('{') || /^\s*---(?:\r?\n|$)/.test(css) || /@(?:import|font-face|keyframes)|url\s*\(/i.test(stripped)) throw new Error(`Unsafe CSS: ${slug}`);
    for (const match of stripped.matchAll(/([^{}]+)\{/g)) {
      const selector = match[1].trim();
      if (/^@(?:media|supports|container)\b/.test(selector)) continue;
      if (!selector.split(',').every((part) => !/[+~]/.test(part) && part.trim().startsWith(scope) && /^(?:$|[\s.:#[>])/.test(part.trim().slice(scope.length)))) throw new Error(`Unscoped CSS: ${slug}: ${selector.slice(0, 80)}`);
    }
  });
  attempt(() => {
    const thumbnail = source.get(`${base}thumbnail.webp`);
    if (!thumbnail) return;
    const size = webpSize(thumbnail);
    if (size.width < MIN_THUMBNAIL.width || size.height < MIN_THUMBNAIL.height) throw new Error(`Thumbnail too small: ${slug}: ${size.width}x${size.height}`);
  });
  attempt(() => {
    const notice = source.get(`${base}NOTICE.txt`)?.toString('utf8');
    if (notice !== undefined && !notice.includes(`Topic: ${slug}`)) throw new Error(`NOTICE does not name its topic: ${slug}`);
  });
  return { manifest, files };
}

function checkArticle(html, slug, prefix, errors) {
  const base = assetBase(slug);
  const elements = tags(html);
  const roots = elements.filter((tag) => has(tag, 'data-htw-figure'));
  if (roots.length !== 1 || roots[0].attrs['data-htw-figure'] !== slug || roots[0].name !== 'div' || !(roots[0].attrs.class ?? '').split(/\s+/).includes('htw-machine')) { errors.push(`Expected one .htw-machine div root: ${slug}`); return; }
  let content;
  try { content = rootContent(html, roots[0]); } catch (error) { errors.push(`${error.message}: ${slug}`); return; }
  const inside = tags(content);
  for (const slot of ['data-machine-scene', 'data-machine-view', 'data-machine-console', 'data-machine-console-panel', 'data-machine-reader-slot', 'data-machine-explore-slot', 'data-machine-story']) {
    if (inside.filter((tag) => has(tag, slot)).length !== 1 || elements.filter((tag) => has(tag, slot)).length !== 1) errors.push(`Expected one ${slot} inside the root: ${slug}`);
  }
  try { checkScene(content); } catch (error) { errors.push(`Built scene invalid: ${slug}: ${error.message}`); }
  const consoles = inside.filter((tag) => has(tag, 'data-machine-console'));
  if (consoles.length === 1 && !(has(consoles[0], 'hidden') && has(consoles[0], 'inert'))) errors.push(`Console must start hidden and inert: ${slug}`);
  if (!/<p\b[^>]*>[^<]*\S/i.test(content)) errors.push(`Static prose fallback missing: ${slug}`);
  const enabled = enabledControls(content);
  if (enabled.length) errors.push(`Control enabled in static HTML: ${slug}: ${enabled[0]}`);
  for (const control of ['data-machine-run', 'data-machine-pause', 'data-machine-step', 'data-machine-reset']) if (inside.filter((tag) => has(tag, control) && has(tag, 'disabled')).length !== 1) errors.push(`Expected one disabled ${control}: ${slug}`);
  const ids = elements.map((tag) => tag.attrs.id).filter(Boolean);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) errors.push(`Duplicate id in article: ${slug}: ${duplicate}`);
  const scripts = tags(html, 'script').filter((tag) => topicAsset(tag.attrs.src, 'js'));
  if (scripts.length !== 1 || url(scripts[0].attrs.src) !== `${prefix}/${base}machine.js` || (scripts[0].attrs.type && scripts[0].attrs.type !== 'text/javascript')) errors.push(`Article must load only its own classic script with the baseurl: ${slug}`);
  const styles = tags(html, 'link').filter((tag) => (tag.attrs.rel ?? '').split(/\s+/).includes('stylesheet') && topicAsset(tag.attrs.href, 'css'));
  if (styles.length !== 1 || url(styles[0].attrs.href) !== `${prefix}/${base}machine.css`) errors.push(`Article must load only its own topic CSS with the baseurl: ${slug}`);
  if (!tags(html, 'a').some((tag) => url(tag.attrs.href) === `${prefix}/how-things-work/`)) errors.push(`Article return link to the hub missing or wrong baseurl: ${slug}`);
  if (!/^vi(?:-|$)/.test(tags(html, 'html')[0]?.attrs.lang ?? '')) errors.push(`Article language must be Vietnamese: ${slug}`);
  if (/{%|%}|{{|}}/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))) errors.push(`Unrendered Liquid/raw delimiter in article: ${slug}`);
}

function checkHub(hub, slug, prefix, errors) {
  const route = `${prefix}/how-things-work/${slug}/`;
  const thumbnail = `${prefix}/${assetBase(slug)}thumbnail.webp`;
  const links = [...hub.matchAll(/<a\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/a\s*>/gi)].filter((match) => url(attributes(/^<a\b[^>]*>/i.exec(match[0])[0]).href) === route);
  if (links.length !== 1) errors.push(`Hub must link once to the route with the baseurl: ${slug}`);
  else if (!tags(links[0][0], 'img').some((tag) => url(tag.attrs.src) === thumbnail)) errors.push(`Hub entry thumbnail missing or wrong baseurl: ${slug}`);
}

export function validatePlaygrounds({ root = process.cwd(), site = path.join(root, '_site'), baseurl = '', topics = TOPICS } = {}) {
  const errors = [];
  let filesChecked = 0; let routesChecked = 0;
  const attempt = (action) => { try { return action(); } catch (error) { errors.push(error.message); return undefined; } };
  root = path.resolve(root); site = path.resolve(site);
  const prefix = attempt(() => basePath(baseurl));
  attempt(() => {
    const config = read(root, '_config.yml').toString('utf8');
    const exclude = config.split('\n').find((line) => /^exclude:/.test(line)) ?? '';
    if (!/['"]scripts\/playgrounds['"]/.test(exclude)) throw new Error('Missing scripts/playgrounds exclusion in _config.yml');
  });
  attempt(() => checkLeaks(root, site));
  if (prefix === undefined) return { ok: false, errors, filesChecked, routesChecked };
  const hub = attempt(() => clean(read(site, 'how-things-work/index.html').toString('utf8')));
  const home = attempt(() => clean(read(site, 'index.html').toString('utf8')));
  for (const slug of topics) {
    const { manifest, files } = checkSource(root, slug, attempt);
    filesChecked += files;
    if (manifest) {
      attempt(() => { if (!read(site, manifestPath(slug)).equals(read(root, manifestPath(slug)))) throw new Error(`Built manifest mismatch: ${slug}`); });
      for (const rel of payloadPaths(slug).filter((p) => p.startsWith('assets/'))) attempt(() => { if (sha(read(site, rel)) !== manifest.files[rel]) throw new Error(`Built asset mismatch: ${rel}`); });
    }
    const article = attempt(() => clean(read(site, `how-things-work/${slug}/index.html`).toString('utf8')));
    if (article) { routesChecked++; checkArticle(article, slug, prefix, errors); }
    if (hub) checkHub(hub, slug, prefix, errors);
  }
  for (const [name, html] of [['hub', hub], ['home', home]]) {
    if (!html) continue;
    if (tags(html).some((tag) => has(tag, 'data-htw-figure') && topics.includes(tag.attrs['data-htw-figure']))) errors.push(`Playground root leaks into ${name}`);
    if (tags(html, 'script').some((tag) => topics.some((slug) => url(tag.attrs.src).includes(`/${assetBase(slug)}`)))) errors.push(`Playground runtime leaks into ${name}`);
    if (tags(html, 'link').some((tag) => topics.some((slug) => url(tag.attrs.href).endsWith(`/${assetBase(slug)}machine.css`)))) errors.push(`Playground CSS leaks into ${name}`);
  }
  return { ok: errors.length === 0, errors, filesChecked, routesChecked };
}

export function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (['--root', '--site', '--baseurl'].includes(argv[i]) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') && !(argv[i] !== '--baseurl' && !argv[i + 1])) options[argv[i].slice(2)] = argv[++i];
    else { console.error(`Invalid or missing argument: ${argv[i]}\nUsage: node scripts/playgrounds/check-playgrounds.mjs --site <_site> [--baseurl <prefix>]`); return 2; }
  }
  if (!options.site) { console.error('--site is required'); return 2; }
  const report = validatePlaygrounds(options);
  if (!report.ok) { for (const error of report.errors) console.error(`Playgrounds: ${error}`); return 1; }
  console.log(`Playgrounds: valid (${report.filesChecked} payloads, ${report.routesChecked} routes)`);
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
