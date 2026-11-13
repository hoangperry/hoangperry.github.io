// TEST FIXTURE ONLY. Creates temporary test pages; never writes real blog pages.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { TOPICS, payloadPaths } from '../check-photography-machines.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function put(root, rel, bytes) { const target = path.join(root, rel); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
export function fixture({ prefix = '', infrastructureOnly = false, nestedSvg = false } = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'photography-validator-test-'));
  const site = path.join(root, '_site'); fs.mkdirSync(site);
  put(root, '_config.yml', "exclude: ['scripts/check-how-things-work.mjs','scripts/photography-machines']\n");
  put(site, 'index.html', '<html><body>TEST FIXTURE home</body></html>');
  put(site, 'how-things-work/index.html', '<html><body>TEST FIXTURE infrastructure</body></html>');
  if (!infrastructureOnly) {
    let hub = '<h1>TEST FIXTURE ONLY</h1>';
    for (const slug of TOPICS) {
      const base = `assets/how-things-work/${slug}/`;
      const paths = payloadPaths(slug);
      const svg = `<svg data-machine-view>${nestedSvg ? '<svg data-live="back"><rect width="1"/></svg><svg data-live="front"><path d="M0 0"/></svg>' : '<rect width="1"/>'}</svg>`;
      const contents = [`{% raw %}\n<figure data-machine-scene>${svg}</figure>\n{% endraw %}\n`, '{% raw %}\n<section data-machine-console><p>TEST FIXTURE console</p></section>\n{% endraw %}\n', '(() => { "use strict"; /* TEST FIXTURE ONLY */ })();\n', `.htw-machine[data-htw-figure="${slug}"] svg { width: 100%; }\n`, Buffer.concat([Buffer.from('RIFF'), Buffer.from([14, 0, 0, 0]), Buffer.from('WEBPVP8L'), Buffer.from([2, 0, 0, 0, 0x2f, 0])]), 'MIT License\nTEST FIXTURE notice\n'];
      const files = {};
      paths.forEach((rel, i) => { put(root, rel, contents[i]); files[rel] = sha(contents[i]); if (rel.startsWith('assets/')) put(site, rel, contents[i]); });
      put(root, `${base}manifest.json`, `${JSON.stringify({ schemaVersion: 1, topic: slug, sourceDigest: 'a'.repeat(64), files })}\n`);
      put(site, `${base}manifest.json`, fs.readFileSync(path.join(root, `${base}manifest.json`)));
      const article = `<html><head><link rel="stylesheet" href="${prefix}/${base}machine.css"></head><body><h1>TEST FIXTURE ONLY — not a real article</h1><div class="htw-machine" data-htw-figure="${slug}"><div data-machine-reader-slot><figure data-machine-scene>${svg}</figure></div><div data-machine-explore-slot></div><section data-machine-story><p>Synthetic static fallback, not photography content.</p></section><section data-machine-console><output data-machine-output></output><button data-machine-run disabled>Test</button><button data-machine-pause disabled>Pause</button><button data-machine-step disabled>Step</button></section></div><script src="${prefix}/${base}machine.js" defer></script></body></html>`;
      put(site, `how-things-work/${slug}/index.html`, article);
      hub += `<a href="${prefix}/how-things-work/${slug}/">TEST ${slug}</a><img src="${prefix}/${base}thumbnail.webp" alt="TEST FIXTURE">`;
    }
    put(site, 'how-things-work/index.html', hub);
  }
  return { root, site, baseurl: prefix };
}
export function snapshot(root) {
  const result = {};
  function walk(rel = '') {
    for (const name of fs.readdirSync(path.join(root, rel)).sort()) {
      const child = rel ? `${rel}/${name}` : name; const file = path.join(root, child); const stat = fs.lstatSync(file);
      result[child] = [stat.mtimeMs, stat.isFile() ? fs.readFileSync(file).toString('base64') : 'directory'];
      if (stat.isDirectory()) walk(child);
    }
  }
  walk(); return result;
}
