import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validatePhotographyMachines, TOPICS } from './check-photography-machines.mjs';
import { fixture, put, snapshot } from './fixtures/site-fixture.mjs';
const setup = (t, options) => { const value = fixture(options); t.after(() => fs.rmSync(value.root, { recursive: true })); return value; };
const article = (value, slug = TOPICS[0]) => path.join(value.site, `how-things-work/${slug}/index.html`);
function change(file, from, to) { fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to)); }
function replacePayload(value, rel, bytes) {
  put(value.root, rel, bytes); put(value.site, rel, bytes);
  const manifestRel = `assets/how-things-work/${TOPICS[0]}/manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(path.join(value.root, manifestRel)));
  manifest.files[rel] = createHash('sha256').update(bytes).digest('hex');
  put(value.root, manifestRel, JSON.stringify(manifest)); put(value.site, manifestRel, JSON.stringify(manifest));
}

test('standalone validator verifies six fixture packages/routes and is nonwriting', (t) => {
  const value = setup(t); const before = snapshot(value.root);
  const report = validatePhotographyMachines(value); assert.equal(report.ok, true, report.errors.join('\n')); assert.equal(report.routesChecked, 6); assert.equal(report.filesChecked, 36);
  assert.deepEqual(snapshot(value.root), before);
});
test('validator accepts one view with two nested live SVG layers in source and built article', (t) => {
  const value = setup(t, { nestedSvg: true, prefix: '/test-blog' });
  const before = snapshot(value.root); const report = validatePhotographyMachines(value);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.routesChecked, 6); assert.deepEqual(snapshot(value.root), before);
});
for (const mutation of ['sibling-svg', 'extra-view', 'scene-clone', 'console-clone', 'script', 'handler', 'style', 'external', 'animation']) test(`nested SVG validator rejects ${mutation}`, (t) => {
  const value = setup(t, { nestedSvg: true }); const slug = TOPICS[0];
  const rel = `_includes/how-things-work/${slug}-scene.html`;
  let scene = fs.readFileSync(path.join(value.root, rel), 'utf8');
  const additions = {
    'sibling-svg': '<svg></svg>', 'extra-view': '<g data-machine-view></g>',
    'scene-clone': '<figure data-machine-scene><svg data-machine-view></svg></figure>',
    script: '<script>alert(1)</script>', handler: '<g onload="alert(1)"></g>',
    style: '<style>body{display:none}</style>', external: '<image href="https://example.invalid/x"/>', animation: '<animate attributeName="x"/>',
  };
  if (mutation === 'console-clone') {
    const consoleRel = `_includes/how-things-work/${slug}-console.html`;
    replacePayload(value, consoleRel, '{% raw %}\n<section data-machine-console><svg data-machine-view></svg></section>\n{% endraw %}\n');
  } else {
    const addition = additions[mutation];
    scene = scene.replace('</figure>', `${addition}</figure>`);
    replacePayload(value, rel, scene);
    change(article(value), '</figure>', `${addition}</figure>`);
  }
  const report = validatePhotographyMachines(value);
  assert.equal(report.ok, false, mutation);
});
test('baseurl prefix works; wrong prefix and traversal fail', (t) => {
  const value = setup(t, { prefix: '/test-blog' }); assert.equal(validatePhotographyMachines(value).ok, true);
  assert.equal(validatePhotographyMachines({ ...value, baseurl: '' }).ok, false);
  assert.equal(validatePhotographyMachines({ ...value, baseurl: '/../escape' }).ok, false);
});
test('infrastructure-only checks exclusion/leakage without inventing six articles; final gate fails missing articles', (t) => {
  const value = setup(t, { infrastructureOnly: true });
  assert.equal(validatePhotographyMachines({ ...value, infrastructureOnly: true }).ok, true);
  const full = validatePhotographyMachines(value); assert.equal(full.ok, false); assert.ok(full.errors.some((error) => error.includes('how-things-work/drum-scanner/index.html')));
});
for (const mutation of ['hash', 'built-hash', 'built-manifest', 'manifest-traversal', 'wrong-topic', 'missing-route', 'duplicate-root', 'duplicate-script', 'foreign-script', 'c41-script', 'module-script', 'invalid-classic', 'global-css', 'invalid-thumbnail', 'wrong-css', 'missing-scene', 'enabled-fallback', 'liquid', 'whitespace', 'hub-link', 'hub-runtime', 'home-runtime']) test(`validator rejects ${mutation}`, (t) => {
  const value = setup(t); const slug = TOPICS[0]; const base = `assets/how-things-work/${slug}/`;
  if (mutation === 'hash') put(value.root, `${base}machine.js`, 'tampered');
  if (mutation === 'built-hash') put(value.site, `${base}machine.js`, 'tampered');
  if (mutation === 'built-manifest') put(value.site, `${base}manifest.json`, '{}');
  if (mutation === 'invalid-classic') replacePayload(value, `${base}machine.js`, '(() => {})(); export const invalidClassic = true;');
  if (mutation === 'global-css') replacePayload(value, `${base}machine.css`, `.htw-machine[data-htw-figure="${slug}"] svg {color:red;} body {display:none;}`);
  if (mutation === 'invalid-thumbnail') replacePayload(value, `${base}thumbnail.webp`, 'not an image');
  if (mutation === 'manifest-traversal') { const file = path.join(value.root, `${base}manifest.json`); const m = JSON.parse(fs.readFileSync(file)); m.files['../escape'] = 'a'.repeat(64); fs.writeFileSync(file, JSON.stringify(m)); }
  if (mutation === 'wrong-topic') change(path.join(value.root, `${base}manifest.json`), '"topic":"drum-scanner"', '"topic":"slide-projector"');
  if (mutation === 'missing-route') fs.unlinkSync(article(value));
  if (mutation === 'duplicate-root') change(article(value), '</body>', `<div data-htw-figure="${slug}"></div></body>`);
  if (mutation === 'duplicate-script') change(article(value), '</body>', `<script src="/${base}machine.js"></script></body>`);
  if (mutation === 'foreign-script') change(article(value), `${base}machine.js`, 'assets/how-things-work/slr-film-camera/machine.js');
  if (mutation === 'c41-script') change(article(value), '</body>', '<script src="/assets/how-things-work/c-41/c41.js"></script></body>');
  if (mutation === 'module-script') change(article(value), '<script src=', '<script type="module" src=');
  if (mutation === 'wrong-css') change(article(value), `${base}machine.css`, 'assets/how-things-work/slr-film-camera/machine.css');
  if (mutation === 'missing-scene') change(article(value), 'data-machine-view', 'data-not-machine-view');
  if (mutation === 'enabled-fallback') change(article(value), 'data-machine-run disabled', 'data-machine-run');
  if (mutation === 'liquid') change(path.join(value.root, `_includes/how-things-work/${slug}-scene.html`), '{% raw %}', '{% assign unsafe = 1 %}');
  if (mutation === 'whitespace') change(path.join(value.root, `_includes/how-things-work/${slug}-scene.html`), '\n<figure', '\n   \n<figure');
  if (mutation === 'hub-link') change(path.join(value.site, 'how-things-work/index.html'), `/how-things-work/${slug}/`, '/wrong/');
  if (mutation === 'hub-runtime') fs.appendFileSync(path.join(value.site, 'how-things-work/index.html'), `<script src="/${base}machine.js"></script>`);
  if (mutation === 'home-runtime') fs.appendFileSync(path.join(value.site, 'index.html'), `<script src="/${base}machine.js"></script>`);
  const report = validatePhotographyMachines(value); assert.equal(report.ok, false, mutation);
});
for (const mutation of ['exclude', 'validator-leak', 'fixture-leak', 'journal-leak', 'source-remnant', 'symlink']) test(`infrastructure gate rejects ${mutation}`, (t) => {
  const value = setup(t, { infrastructureOnly: true });
  if (mutation === 'exclude') put(value.root, '_config.yml', 'exclude: []\n');
  if (mutation === 'validator-leak') put(value.site, 'scripts/photography-machines/check-photography-machines.mjs', 'private');
  if (mutation === 'fixture-leak') put(value.site, 'fixtures/private.json', '{}');
  if (mutation === 'journal-leak') put(value.site, '.htw-photography-txn/private.json', '{}');
  if (mutation === 'source-remnant') put(value.root, '.htw-photography-txn/private.json', '{}');
  if (mutation === 'symlink') fs.symlinkSync(path.join(value.root, '_config.yml'), path.join(value.site, 'leak'));
  const report = validatePhotographyMachines({ ...value, infrastructureOnly: true }); assert.equal(report.ok, false, mutation);
});
