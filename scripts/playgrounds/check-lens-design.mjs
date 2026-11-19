// The lens lab is an independent multi-view editor, not a single-scene machine.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { webpSize } from './check-playgrounds.mjs';

const [site, baseurl = '', ...extra] = process.argv.slice(2);
assert.ok(site && !extra.length, 'Usage: node scripts/playgrounds/check-lens-design.mjs <site> [baseurl]');
const listen = baseurl === '/' ? '' : baseurl.replace(/\/$/, '');
assert.match(listen, /^(?:\/[\w.-]+)*$/);
assert.ok(!listen.split('/').some((part) => part === '.' || part === '..'));
const asset = 'assets/how-things-work/lens-design/';
const route = 'how-things-work/lens-design/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = ['_includes/how-things-work/lens-design-lab.html', ...['lab.js', 'lab.css', 'thumbnail.webp'].map((name) => asset + name)];
const manifestFile = `${asset}manifest.json`;
const original = readFileSync(manifestFile);
const manifest = JSON.parse(original);
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.topic, 'lens-design');
assert.deepEqual(Object.keys(manifest.files), files, 'Unexpected lens lab assets');
const revision = hash(JSON.stringify(manifest.files)).slice(0, 16);
for (const file of files) {
  const bytes = readFileSync(file);
  assert.equal(hash(bytes), manifest.files[file], `${file} differs from its manifest`);
  if (file.startsWith(asset)) assert.equal(hash(readFileSync(join(site, file))), manifest.files[file], `Jekyll altered ${file}`);
  if (file.endsWith('.js')) new Script(bytes.toString('utf8'), { filename: file });
  if (file.endsWith('.webp')) {
    const { width, height } = webpSize(bytes);
    assert.ok(width >= 320 && height >= 200, 'Thumbnail is too small');
  }
}
assert.deepEqual(readFileSync(join(site, manifestFile)), original);

const article = readFileSync(join(site, route, 'index.html'), 'utf8');
const hub = readFileSync(join(site, 'how-things-work/index.html'), 'utf8');
const href = (file) => `${listen}/${file}`;
assert.equal(article.split('id="lens-design-lab"').length - 1, 1, 'Lens lab must have one root');
assert.equal(article.split(`src="${href(`${asset}lab.js?v=${revision}`)}"`).length - 1, 1, 'Lens script link or revision is broken');
assert.ok(article.includes(`href="${href(`${asset}lab.css?v=${revision}`)}"`), 'Lens stylesheet link or revision is broken');
assert.ok(article.includes('id="lens-controls" hidden') && article.includes('id="lesson-title"'), 'Static article or JS opt-in state is missing');
assert.ok(article.includes(`href="${href('how-things-work/')}"`), 'Missing link back to the library');
assert.ok(article.includes(`src="${href(`${asset}thumbnail.webp`)}"`), 'Missing no-JS diagram');
assert.equal(hub.split(`href="${href(route)}"`).length - 1, 1, 'Library must link to the new article once');
assert.ok(hub.includes(`src="${href(`${asset}thumbnail.webp`)}"`), 'Library thumbnail missing');
assert.ok(!hub.includes(`${asset}lab.js`) && !hub.includes('id="lens-design-lab"'), 'The library must not mount the lab');
assert.ok(!existsSync(join(site, 'scripts/playgrounds/check-lens-design.mjs')), 'Validation script leaked to the public site');
console.log(`Lens design: article, hub and ${files.length} payloads verified (${revision})`);
