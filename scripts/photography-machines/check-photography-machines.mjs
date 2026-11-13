#!/usr/bin/env node
// Independent integrity/routing gate. Node only; never imports model code or reruns audits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

export const TOPICS = Object.freeze(['drum-scanner', 'slr-film-camera', 'bw-enlarger', 'slide-projector', 'swing-lens-panorama', 'instant-film-camera']);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameKeys = (value, names) => record(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
export function payloadPaths(slug) {
  return [`_includes/how-things-work/${slug}-scene.html`, `_includes/how-things-work/${slug}-console.html`, ...['machine.js', 'machine.css', 'thumbnail.webp', 'NOTICE.txt'].map((name) => `assets/how-things-work/${slug}/${name}`)];
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
  if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Unsafe relative path');
  try {
    const absolute = noLinks(path.join(root, rel));
    if (!fs.lstatSync(absolute).isFile()) throw new Error('Not a regular file');
    return fs.readFileSync(absolute);
  } catch (error) { throw new Error(`Cannot read ${rel}: ${error.code ?? error.message}`); }
}
function basePath(value) {
  if (value === '' || value === '/') return '';
  if (typeof value !== 'string' || !value.startsWith('/') || /[?#\\]|\/\//.test(value) || value.split('/').some((part) => part === '.' || part === '..')) throw new Error('Invalid baseurl');
  return value.replace(/\/+$/, '');
}
function attributes(tag) {
  const result = {};
  for (const match of tag.replace(/^<\/?[\w:-]+/, '').replace(/\/?>$/, '').matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) result[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? '').replaceAll('&amp;', '&');
  return result;
}
const tags = (html, name = '[a-z][\\w:-]*') => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => ({ tag: match[0], index: match.index, attrs: attributes(match[0]) }));
const has = (tag, key) => Object.hasOwn(tag.attrs, key);
const clean = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (tag) => /^<script\b/i.test(tag) && /\bsrc\s*=/i.test(tag) ? tag.replace(/>[\s\S]*<\//, '></') : '');
const url = (value = '') => value.split(/[?#]/, 1)[0];
function rootContent(html, root) {
  let depth = 1;
  const tail = html.slice(root.index + root.tag.length);
  for (const match of tail.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return tail.slice(0, match.index);
  }
  return '';
}
// Independent SVG-only structure check: nested live layers are one view, not
// additional machines. Keep this gate self-contained; never import model code.
function checkSceneSvg(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  let depth = 0; let roots = 0; let views = 0; let scenes = 0; let start = 0;
  for (const match of source.matchAll(/<\/?[a-z][\w:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const tag = match[0]; const name = /^<\/?([\w:-]+)/.exec(tag)[1].toLowerCase();
    if (/^<\//.test(tag)) {
      if (name === 'svg') {
        if (--depth < 0) throw new Error('Unbalanced SVG');
        if (depth === 0) checkSafeSvg(source.slice(start, match.index + tag.length));
      }
      continue;
    }
    const attrs = attributes(tag);
    if (Object.hasOwn(attrs, 'data-machine-view')) {
      views++;
      if (name !== 'svg' || depth !== 0) throw new Error('Machine view must be the outer SVG');
    }
    if (Object.hasOwn(attrs, 'data-machine-scene')) {
      scenes++;
      if (depth || name === 'svg') throw new Error('Nested machine scene');
    }
    if (depth && Object.keys(attrs).some((key) => /^data-machine-console(?:-|$)/.test(key))) throw new Error('Console in scene SVG');
    if (name === 'svg') {
      if (depth++ === 0) { roots++; start = match.index; }
      if (/\/\s*>$/.test(tag)) { depth--; checkSafeSvg(tag); }
    }
  }
  if (depth || roots !== 1 || views !== 1 || scenes !== 1) throw new Error('Expected one scene/outer SVG/machine view');
}
function checkSafeSvg(svg) {
  if (/<(?:script|style|foreignObject|html|head|body|iframe|animate\w*|set)\b|\bon\w+\s*=|javascript:/i.test(svg)) throw new Error('Unsafe scene SVG');
  for (const match of svg.matchAll(/(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) if (!/^#[\w:.-]+$/.test(match[1] ?? match[2] ?? match[3])) throw new Error('External SVG reference');
  for (const match of svg.matchAll(/url\(([^)]*)\)/gi)) if (!/^#[\w:.-]+$/.test(match[1].trim().replace(/^["']|["']$/g, ''))) throw new Error('External SVG URL');
}
function checkLeaks(site) {
  noLinks(site);
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in site: ${child}`);
      if (child.startsWith('scripts/photography-machines') || entry.name === '.htw-photography-txn' || entry.name === 'fixtures' || /check-photography-machines(?:\.test)?\.mjs$/.test(entry.name)) throw new Error(`Private validator/fixture/journal leaked: ${child}`);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), child);
    }
  };
  walk(site);
}
export function validatePhotographyMachines({ root = process.cwd(), site = path.join(root, '_site'), baseurl = '', infrastructureOnly = false } = {}) {
  const errors = [];
  let filesChecked = 0; let routesChecked = 0;
  const attempt = (action) => { try { return action(); } catch (error) { errors.push(error.message); return undefined; } };
  root = path.resolve(root); site = path.resolve(site);
  const prefix = attempt(() => basePath(baseurl));
  attempt(() => {
    const config = read(root, '_config.yml').toString('utf8');
    if (!/exclude:[^\n]*scripts\/photography-machines/.test(config)) throw new Error('Missing validator directory exclusion');
    if (fs.existsSync(path.join(root, '.htw-photography-txn'))) throw new Error('Transaction remnant exists');
  });
  attempt(() => checkLeaks(site));
  if (!infrastructureOnly && prefix !== undefined) {
    const hub = attempt(() => clean(read(site, 'how-things-work/index.html').toString('utf8')));
    const home = attempt(() => clean(read(site, 'index.html').toString('utf8')));
    for (const slug of TOPICS) {
      const base = `assets/how-things-work/${slug}/`;
      const paths = payloadPaths(slug);
      const source = new Map();
      const manifest = attempt(() => {
        const manifestBytes = read(root, `${base}manifest.json`);
        const value = JSON.parse(manifestBytes);
        if (!sameKeys(value, ['schemaVersion', 'topic', 'sourceDigest', 'files']) || value.schemaVersion !== 1 || value.topic !== slug || !hash(value.sourceDigest) || !sameKeys(value.files, paths) || !Object.values(value.files).every(hash)) throw new Error(`Malformed manifest: ${slug}`);
        if (sha(read(site, `${base}manifest.json`)) !== sha(manifestBytes)) throw new Error(`Built manifest mismatch: ${slug}`);
        return value;
      });
      if (manifest) for (const rel of paths) attempt(() => {
        const bytes = read(root, rel); filesChecked++; source.set(rel, bytes);
        if (sha(bytes) !== manifest.files[rel]) throw new Error(`Payload hash mismatch: ${rel}`);
        if (!rel.endsWith('.webp') && /\/Users\/|\/home\//.test(bytes.toString('utf8'))) throw new Error(`Home path leak: ${rel}`);
        if (rel.startsWith('assets/') && sha(read(site, rel)) !== manifest.files[rel]) throw new Error(`Built asset mismatch: ${rel}`);
      });
      for (const rel of paths.slice(0, 2)) attempt(() => {
        if (!source.has(rel)) return;
        const html = source.get(rel).toString('utf8');
        if (!html.startsWith('{% raw %}\n') || !html.endsWith('\n{% endraw %}\n') || (html.match(/{%/g) ?? []).length !== 2 || /\n[\t ]*\n|<(?:html|head|body)\b/i.test(html)) throw new Error(`Unsafe Liquid/whitespace include: ${rel}`);
        if (rel.endsWith('-scene.html')) {
          try { checkSafeSvg(html); checkSceneSvg(html); } catch (error) { throw new Error(`Scene fallback invalid: ${slug}: ${error.message}`); }
        }
        if (rel.endsWith('-console.html') && tags(html, 'svg').length) throw new Error(`Duplicate console SVG: ${slug}`);
      });
      attempt(() => {
        const js = source.get(`${base}machine.js`)?.toString('utf8') ?? '';
        const executable = js.replace(/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/, '');
        if (!/^;?\s*\(\s*(?:function\b|\([^)]*\)\s*=>)/.test(executable) || /\bimport\s*(?:\(|\.meta)/.test(js)) throw new Error(`Not classic IIFE: ${slug}`);
        new Script(js); // Parse only; never execute destination code.
        const css = source.get(`${base}machine.css`)?.toString('utf8') ?? '';
        const scope = `.htw-machine[data-htw-figure="${slug}"]`;
        const strippedCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
        if (!strippedCss.includes('{') || /@(?:import|font-face)|url\s*\(/i.test(strippedCss)) throw new Error(`Unsafe CSS: ${slug}`);
        for (const match of strippedCss.matchAll(/([^{}]+)\{/g)) {
          const selector = match[1].trim();
          if (/^@(?:media|supports)\b/.test(selector)) continue;
          if (!selector.split(',').every((part) => !/[+~]/.test(part) && part.trim().startsWith(scope) && /^(?:$|[\s.:#\[>])/.test(part.trim().slice(scope.length)))) throw new Error(`Unscoped CSS: ${slug}`);
        }
        const thumbnail = source.get(`${base}thumbnail.webp`);
        if (!thumbnail || thumbnail.length < 20 || thumbnail.toString('ascii', 0, 4) !== 'RIFF' || thumbnail.toString('ascii', 8, 12) !== 'WEBP' || thumbnail.readUInt32LE(4) + 8 !== thumbnail.length) throw new Error(`Invalid thumbnail container: ${slug}`);
        if (!/MIT License/.test(source.get(`${base}NOTICE.txt`)?.toString('utf8') ?? '')) throw new Error(`Missing MIT notice: ${slug}`);
      });
      const article = attempt(() => clean(read(site, `how-things-work/${slug}/index.html`).toString('utf8')));
      if (article) {
        routesChecked++;
        const elements = tags(article);
        const roots = elements.filter((tag) => has(tag, 'data-htw-figure'));
        if (roots.length !== 1 || roots[0].attrs['data-htw-figure'] !== slug || !/^<div\b/i.test(roots[0].tag)) errors.push(`Expected one topic root: ${slug}`);
        else {
          const content = rootContent(article, roots[0]);
          const nodes = tags(content);
          for (const slot of ['data-machine-scene', 'data-machine-view', 'data-machine-console', 'data-machine-reader-slot', 'data-machine-explore-slot', 'data-machine-story', 'data-machine-output']) if (nodes.filter((tag) => has(tag, slot)).length !== 1 || elements.filter((tag) => has(tag, slot)).length !== 1) errors.push(`Expected one ${slot}: ${slug}`);
          if (nodes.filter((tag) => has(tag, 'data-machine-view')).length !== 1 || !/<p\b[^>]*>[^<]*\S/i.test(content)) errors.push(`Static SVG/prose fallback missing: ${slug}`);
          attempt(() => { try { checkSceneSvg(content); } catch (error) { throw new Error(`Built scene invalid: ${slug}: ${error.message}`); } });
          for (const control of ['data-machine-run', 'data-machine-pause', 'data-machine-step']) if (!nodes.some((tag) => has(tag, control) && has(tag, 'disabled'))) errors.push(`Fallback control not disabled: ${slug}/${control}`);
        }
        const modelScripts = tags(article, 'script').filter((tag) => /\/assets\/how-things-work\/[^/]+\/[^/]+\.js$/.test(url(tag.attrs.src)));
        if (modelScripts.length !== 1 || url(modelScripts[0].attrs.src) !== `${prefix}/${base}machine.js` || modelScripts[0].attrs.type === 'module') errors.push(`Wrong topic script/baseurl: ${slug}`);
        const modelStyles = tags(article, 'link').filter((tag) => tag.attrs.rel === 'stylesheet' && /\/assets\/how-things-work\/[^/]+\/[^/]+\.css$/.test(url(tag.attrs.href)));
        if (modelStyles.length !== 1 || url(modelStyles[0].attrs.href) !== `${prefix}/${base}machine.css`) errors.push(`Wrong topic CSS/baseurl: ${slug}`);
      }
      if (hub) {
        if (!tags(hub, 'a').some((tag) => url(tag.attrs.href) === `${prefix}/how-things-work/${slug}/`)) errors.push(`Missing hub route/baseurl: ${slug}`);
        if (!tags(hub, 'img').some((tag) => url(tag.attrs.src) === `${prefix}/${base}thumbnail.webp`)) errors.push(`Missing hub thumbnail/baseurl: ${slug}`);
      }
    }
    for (const [name, html] of [['hub', hub], ['home', home]]) if (html && (tags(html).some((tag) => has(tag, 'data-htw-figure') && TOPICS.includes(tag.attrs['data-htw-figure'])) || tags(html, 'script').some((tag) => TOPICS.some((slug) => url(tag.attrs.src).endsWith(`/assets/how-things-work/${slug}/machine.js`))))) errors.push(`Machine runtime leaks into ${name}`);
  }
  return { ok: errors.length === 0, errors, filesChecked, routesChecked, infrastructureOnly };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  try {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (['--root', '--site', '--baseurl'].includes(args[i]) && args[i + 1] !== undefined) options[args[i].slice(2)] = args[++i];
      else if (args[i] === '--infrastructure-only') options.infrastructureOnly = true;
      else throw new Error('Unknown validator argument');
    }
    const report = validatePhotographyMachines(options); console.log(JSON.stringify(report)); if (!report.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
