// TEST FIXTURE ONLY. Creates a temporary repository root and built site with synthetic playground payloads; it never
// writes real blog pages and its bytes are not a real article, bundle or thumbnail.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { TOPICS, payloadPaths, assetBase, manifestPath } from '../check-playgrounds.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function put(root, rel, bytes) { const target = path.join(root, rel); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
export function change(file, from, to) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`TEST FIXTURE: pattern not found: ${from}`);
  fs.writeFileSync(file, text.replace(from, to));
}

// Minimal lossless WebP header (VP8L) of the requested pixel size; enough for the container/size check only.
export function webp(width = 640, height = 400) {
  const bytes = Buffer.alloc(32);
  bytes.write('RIFF', 0, 'ascii'); bytes.writeUInt32LE(24, 4); bytes.write('WEBPVP8L', 8, 'ascii'); bytes.writeUInt32LE(12, 16);
  bytes[20] = 0x2f; bytes.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
  return bytes;
}

const sceneHtml = (slug) => `<figure class="htw-machine-scene" id="${slug}-scene" data-machine-scene tabindex="-1">\n<button type="button" data-machine-theme disabled>TEST theme</button>\n<svg viewBox="0 0 10 10" role="img" aria-label="TEST FIXTURE" data-machine-view=""><defs><clipPath id="fx-clip"><rect width="1" height="1"/></clipPath></defs><rect width="1" height="1" clip-path="url(#fx-clip)"/></svg>\n<figcaption data-machine-status>TEST FIXTURE static</figcaption>\n</figure>`;
// HDD-shaped controls exercise static disabled-control guards, not model behavior or generated ABI acceptance.
const hddControls = () => [
  ...[['head-track', 7], ['target-track', 7], ['target-sector', 11], ['start-angle', 359]].map(([key, max]) => `<input type="range" id="hard-disk-drive-control-${key}" data-playground-key="${key}" data-playground-range min="0" max="${max}" step="1" disabled>`),
  ...[5400, 7200, 10000].map((rpm) => `<button type="button" data-playground-key="rpm" data-playground-option="${rpm}" aria-pressed="false" disabled>TEST ${rpm} RPM</button>`),
  ...['same-track', 'far-seek', 'just-missed', 'fast-spindle'].map((key) => `<button type="button" data-playground-preset="${key}" disabled>TEST preset ${key}</button>`),
].join('\n');
const consoleHtml = (slug) => `<div class="htw-machine-console-panel" id="${slug}-console" data-machine-console-panel>\n<button type="button" data-machine-run disabled>Chạy</button>\n<button type="button" data-machine-pause disabled>Dừng</button>\n<button type="button" data-machine-step disabled>Từng bước</button>\n<button type="button" data-machine-reset disabled>Đặt lại</button>\n${slug === 'hard-disk-drive' ? hddControls() : `<button type="button" data-playground-key="phaseA" data-playground-option="1" aria-pressed="false" disabled>+</button>\n<input type="range" id="${slug}-control-rate" data-playground-key="rate" data-playground-range min="1" max="100" step="1" disabled>`}\n</div>`;

export function fixture({ prefix = '', topics = TOPICS } = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'playground-validator-test-'));
  const site = path.join(root, '_site'); fs.mkdirSync(site);
  put(root, '_config.yml', "exclude: ['scripts/check-how-things-work.mjs','scripts/photography-machines','scripts/playgrounds']\n");
  put(site, 'index.html', `<html lang="vi"><body><a href="${prefix}/how-things-work/">TEST FIXTURE home</a></body></html>`);
  let hub = `<html lang="vi"><head><link rel="stylesheet" href="${prefix}/css/how-things-work.css"></head><body><h1>TEST FIXTURE ONLY</h1><ol>`;
  hub += `<li><a href="${prefix}/how-things-work/c-41/"><img src="${prefix}/assets/how-things-work/c-41/thumbnail.webp" alt=""></a></li>`;
  for (const slug of topics) {
    const base = assetBase(slug);
    const contents = [
      `{% raw %}\n${sceneHtml(slug)}\n{% endraw %}\n`,
      `{% raw %}\n${consoleHtml(slug)}\n{% endraw %}\n`,
      `/* TEST FIXTURE ONLY: not a playground */\n(function () {\n'use strict';\nvar fixture = ${JSON.stringify(slug)};\n})();\n`,
      `.htw-machine[data-htw-figure="${slug}"] .htw-machine-scene { width: 100%; }\n@media (max-width: 600px) { .htw-machine[data-htw-figure="${slug}"] svg { width: 100%; } }\n`,
      webp(),
      `How Things Work playground: TEST FIXTURE\nTopic: ${slug}\nGenerated file: TEST FIXTURE ONLY.\n`,
    ];
    const files = {};
    payloadPaths(slug).forEach((rel, index) => { put(root, rel, contents[index]); files[rel] = sha(contents[index]); if (rel.startsWith('assets/')) put(site, rel, contents[index]); });
    const manifest = `${JSON.stringify({ schemaVersion: 1, topic: slug, kind: 'playground', sourceDigest: sha(`TEST FIXTURE ONLY: ${slug}`), files }, null, 2)}\n`;
    put(root, manifestPath(slug), manifest); put(site, manifestPath(slug), manifest);
    const article = `<!doctype html><html lang="vi"><head><link rel="stylesheet" href="${prefix}/css/how-things-work.css"><link rel="stylesheet" href="${prefix}/${base}machine.css"></head><body>`
      + `<a href="${prefix}/how-things-work/">How Things Work</a>`
      + `<div class="htw-machine" data-htw-figure="${slug}" data-theme="dark" data-mode="reader"><div class="htw-reading"><div class="htw-reader-slot" data-machine-reader-slot>\n${sceneHtml(slug)}\n`
      + `<button type="button" data-machine-collapse aria-controls="${slug}-scene" disabled>TEST</button></div>`
      + `<div class="htw-story" data-machine-story><section id="fx-step" data-machine-focus="all"><p>TEST FIXTURE static prose, not a real article.</p></section></div></div>`
      + `<section id="fx-try"><button type="button" data-machine-mode="explore" disabled>TEST explore</button><div data-machine-explore-slot></div>`
      + `<div data-machine-console hidden inert><button type="button" data-machine-mode="reader" disabled>TEST reader</button>\n${consoleHtml(slug)}\n</div></section></div>`
      + `<script src="${prefix}/${base}machine.js"></script></body></html>`;
    put(site, `how-things-work/${slug}/index.html`, article);
    hub += `<li><a class="htw-entry-link" href="${prefix}/how-things-work/${slug}/"><span><img src="${prefix}/${base}thumbnail.webp" alt=""></span><span>TEST ${slug}</span></a></li>`;
  }
  put(site, 'how-things-work/index.html', `${hub}</ol></body></html>`);
  return { root, site, baseurl: prefix, topics: Object.freeze([...topics]) };
}

// Path → [mtime, bytes] for every entry; used to prove the validator never writes.
export function snapshot(root) {
  const result = {};
  const walk = (rel = '') => {
    for (const name of fs.readdirSync(path.join(root, rel)).sort()) {
      const child = rel ? `${rel}/${name}` : name; const file = path.join(root, child); const stat = fs.lstatSync(file);
      result[child] = [stat.mtimeMs, stat.isFile() ? fs.readFileSync(file).toString('base64') : 'directory'];
      if (stat.isDirectory()) walk(child);
    }
  };
  walk(); return result;
}
