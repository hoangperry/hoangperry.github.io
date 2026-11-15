import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePlaygrounds, TOPICS, assetBase, manifestPath, FIXTURE_MARKER } from './check-playgrounds.mjs';
import { fixture, put, change, snapshot, webp } from './fixtures/site-fixture.mjs';

const VALIDATOR = fileURLToPath(new URL('./check-playgrounds.mjs', import.meta.url));
const slug = TOPICS[0];
const base = assetBase(slug);
const scene = `_includes/how-things-work/${slug}-scene.html`;
const consoleInclude = `_includes/how-things-work/${slug}-console.html`;
const setup = (t, options) => { const value = fixture(options); t.after(() => fs.rmSync(value.root, { recursive: true, force: true })); return value; };
const article = (value) => path.join(value.site, `how-things-work/${slug}/index.html`);
const hub = (value) => path.join(value.site, 'how-things-work/index.html');
// Rewrites a payload in source (and site for assets) and re-hashes the manifest, so only the targeted rule can fail.
function replacePayload(value, rel, bytes) {
  put(value.root, rel, bytes); if (rel.startsWith('assets/')) put(value.site, rel, bytes);
  const manifest = JSON.parse(fs.readFileSync(path.join(value.root, manifestPath(slug))));
  manifest.files[rel] = createHash('sha256').update(bytes).digest('hex');
  const text = JSON.stringify(manifest); put(value.root, manifestPath(slug), text); put(value.site, manifestPath(slug), text);
}
function editPayload(value, rel, from, to) { replacePayload(value, rel, fs.readFileSync(path.join(value.root, rel), 'utf8').replace(from, to)); }
function editManifest(value, edit) {
  const manifest = JSON.parse(fs.readFileSync(path.join(value.root, manifestPath(slug)))); edit(manifest);
  const text = JSON.stringify(manifest); put(value.root, manifestPath(slug), text); put(value.site, manifestPath(slug), text);
}
const rejects = (value, pattern, options = {}) => {
  const report = validatePlaygrounds({ ...value, ...options });
  assert.equal(report.ok, false, 'expected a failure');
  assert.match(report.errors.join('\n'), pattern);
};

test('valid fixture passes at root and under a baseurl, without writing', (t) => {
  for (const prefix of ['', '/preview']) {
    const value = setup(t, { prefix }); const before = snapshot(value.root);
    const report = validatePlaygrounds(value);
    assert.deepEqual(report.errors, []); assert.equal(report.ok, true);
    assert.equal(report.filesChecked, 6); assert.equal(report.routesChecked, 1);
    assert.deepEqual(snapshot(value.root), before);
  }
});

test('baseurl: wrong prefix, traversal and query are rejected', (t) => {
  const value = setup(t, { prefix: '/preview' });
  rejects(value, /baseurl/, { baseurl: '' });
  rejects(value, /Invalid baseurl/, { baseurl: '/../escape' });
  rejects(value, /Invalid baseurl/, { baseurl: '/preview?x=1' });
  const rootBuild = setup(t);
  rejects(rootBuild, /baseurl/, { baseurl: '/preview' });
});

const MUTATIONS = {
  'manifest-kind': [(v) => editManifest(v, (m) => { m.kind = 'machine'; }), /Malformed playground manifest/],
  'manifest-extra-key': [(v) => editManifest(v, (m) => { m.extra = 1; }), /Malformed playground manifest/],
  'manifest-traversal': [(v) => editManifest(v, (m) => { m.files['../escape'] = 'a'.repeat(64); }), /Malformed playground manifest/],
  'manifest-topic': [(v) => editManifest(v, (m) => { m.topic = 'slide-projector'; }), /Malformed playground manifest/],
  'source-hash': [(v) => put(v.root, `${base}machine.js`, '(function () {})();\n'), /Payload hash mismatch/],
  'source-include-hash': [(v) => put(v.root, scene, '{% raw %}\n<p>x</p>\n{% endraw %}\n'), /Payload hash mismatch/],
  'built-asset': [(v) => put(v.site, `${base}machine.css`, 'tampered'), /Built asset mismatch/],
  'built-manifest': [(v) => put(v.site, manifestPath(slug), '{}'), /Built manifest mismatch/],
  'missing-built-asset': [(v) => fs.unlinkSync(path.join(v.site, `${base}thumbnail.webp`)), /thumbnail\.webp/],
  'local-path': [(v) => editPayload(v, `${base}NOTICE.txt`, 'TEST FIXTURE ONLY.', '/Users/someone/x'), /Local path leak/],
  'not-iife': [(v) => replacePayload(v, `${base}machine.js`, 'var x = 1;\n'), /classic IIFE/],
  'module-syntax': [(v) => replacePayload(v, `${base}machine.js`, '(function () {})();\nexport const x = 1;\n'), /classic IIFE/],
  'dynamic-import': [(v) => replacePayload(v, `${base}machine.js`, '(function () { import("x"); })();\n'), /classic IIFE/],
  'unparsable-js': [(v) => replacePayload(v, `${base}machine.js`, '(function () { var = ; })();\n'), /SyntaxError|Unexpected/],
  'global-css': [(v) => replacePayload(v, `${base}machine.css`, `.htw-machine[data-htw-figure="${slug}"] svg {} body { display: none; }\n`), /Unscoped CSS/],
  'other-topic-css': [(v) => replacePayload(v, `${base}machine.css`, '.htw-machine[data-htw-figure="slide-projector"] svg {}\n'), /Unscoped CSS/],
  'css-import': [(v) => replacePayload(v, `${base}machine.css`, `@import "x.css";\n.htw-machine[data-htw-figure="${slug}"] svg {}\n`), /Unsafe CSS/],
  'invalid-thumbnail': [(v) => replacePayload(v, `${base}thumbnail.webp`, 'not an image'), /Invalid WebP/],
  'tiny-thumbnail': [(v) => replacePayload(v, `${base}thumbnail.webp`, webp(16, 16)), /Thumbnail too small/],
  'liquid-include': [(v) => editPayload(v, scene, '{% raw %}', '{% assign unsafe = 1 %}'), /Unsafe Liquid/],
  'unwrapped-include': [(v) => editPayload(v, consoleInclude, '{% raw %}\n', ''), /Unsafe Liquid/],
  'blank-line-include': [(v) => editPayload(v, scene, '\n<figure', '\n  \n<figure'), /Unsafe Liquid\/whitespace/],
  'scene-two-svgs': [(v) => editPayload(v, scene, '</figure>', '<svg></svg></figure>'), /Scene include invalid/],
  'scene-script': [(v) => editPayload(v, scene, '</svg>', '<script>alert(1)</script></svg>'), /Unsafe scene SVG/],
  'scene-external-ref': [(v) => editPayload(v, scene, 'url(#fx-clip)', 'url(https://example.invalid/x)'), /External SVG/],
  'console-svg': [(v) => editPayload(v, consoleInclude, '</div>', '<svg data-machine-view></svg></div>'), /Second scene\/SVG/],
  'include-enabled-control': [(v) => editPayload(v, consoleInclude, 'data-machine-reset disabled', 'data-machine-reset'), /Control enabled in static include/],
  'missing-route': [(v) => fs.unlinkSync(article(v)), /how-things-work\/stepper-motor\/index\.html/],
  'duplicate-root': [(v) => change(article(v), '<script src=', `<div class="htw-machine" data-htw-figure="${slug}"></div><script src=`), /Expected one \.htw-machine div root/],
  'duplicate-scene': [(v) => change(article(v), '<div data-machine-explore-slot></div>', '<div data-machine-explore-slot><figure data-machine-scene></figure></div>'), /data-machine-scene|Built scene invalid/],
  'missing-view': [(v) => change(article(v), 'data-machine-view=""', 'data-not-view=""'), /data-machine-view/],
  'duplicate-console': [(v) => change(article(v), '<div data-machine-explore-slot></div>', '<div data-machine-explore-slot></div><div data-machine-console hidden inert></div>'), /Expected one data-machine-console /],
  'console-visible': [(v) => change(article(v), 'data-machine-console hidden inert', 'data-machine-console'), /hidden and inert/],
  'enabled-button': [(v) => change(article(v), 'data-machine-run disabled', 'data-machine-run'), /Control enabled in static HTML/],
  'enabled-range': [(v) => { const file = article(v); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('step="1" disabled>', 'step="1">')); }, /Control enabled in static HTML/],
  'enabled-mode-button': [(v) => change(article(v), 'data-machine-mode="explore" disabled', 'data-machine-mode="explore"'), /Control enabled in static HTML/],
  'duplicate-id': [(v) => change(article(v), 'id="fx-try"', 'id="fx-step"'), /Duplicate id/],
  'second-topic-script': [(v) => change(article(v), '</body>', '<script src="/assets/how-things-work/slide-projector/machine.js"></script></body>'), /only its own classic script/],
  'c41-script': [(v) => change(article(v), '</body>', '<script src="/assets/how-things-work/c-41/c41.js"></script></body>'), /only its own classic script/],
  'module-script': [(v) => change(article(v), '<script src=', '<script type="module" src='), /only its own classic script/],
  'missing-script': [(v) => change(article(v), `<script src="/${base}machine.js"></script>`, ''), /only its own classic script/],
  'second-topic-css': [(v) => change(article(v), '</head>', '<link rel="stylesheet" href="/assets/how-things-work/slide-projector/machine.css"></head>'), /only its own topic CSS/],
  'missing-hub-return': [(v) => change(article(v), '<a href="/how-things-work/">How Things Work</a>', ''), /return link/],
  'wrong-lang': [(v) => change(article(v), '<html lang="vi">', '<html lang="en">'), /Vietnamese/],
  'unrendered-liquid': [(v) => change(article(v), 'TEST FIXTURE static prose', '{% include x.html %} prose'), /Unrendered Liquid/],
  'hub-link-missing': [(v) => change(hub(v), `href="/how-things-work/${slug}/"`, 'href="/wrong/"'), /Hub must link once/],
  'hub-thumbnail-missing': [(v) => change(hub(v), `<img src="/${base}thumbnail.webp" alt="">`, '<img src="/assets/how-things-work/c-41/thumbnail.webp" alt="">'), /Hub entry thumbnail/],
  'hub-runtime': [(v) => fs.appendFileSync(hub(v), `<script src="/${base}machine.js"></script>`), /runtime leaks into hub/],
  'hub-css': [(v) => change(hub(v), '</head>', `<link rel="stylesheet" href="/${base}machine.css"></head>`), /CSS leaks into hub/],
  'hub-root': [(v) => fs.appendFileSync(hub(v), `<div data-htw-figure="${slug}"></div>`), /root leaks into hub/],
  'home-runtime': [(v) => fs.appendFileSync(path.join(v.site, 'index.html'), `<script src="/${base}machine.js"></script>`), /runtime leaks into home/],
  'exclude-missing': [(v) => put(v.root, '_config.yml', "exclude: ['scripts/photography-machines']\n"), /scripts\/playgrounds exclusion/],
  'validator-leak': [(v) => put(v.site, 'scripts/playgrounds/check-playgrounds.mjs', 'private'), /leaked: scripts\/playgrounds/],
  'fixture-leak': [(v) => put(v.site, 'fixtures/site-fixture.mjs', 'private'), /leaked: fixtures/],
  'marker-leak': [(v) => put(v.site, `assets/${FIXTURE_MARKER}`, 'TEST FIXTURE ONLY\n'), /leaked/],
  'root-is-fixture': [(v) => put(v.root, FIXTURE_MARKER, 'TEST FIXTURE ONLY\n'), /labelled as a TEST fixture/],
  'site-symlink': [(v) => fs.symlinkSync(path.join(v.root, '_config.yml'), path.join(v.site, 'leak')), /Symlink in site/],
};
for (const [name, [mutate, pattern]] of Object.entries(MUTATIONS)) test(`rejects ${name}`, (t) => {
  const value = setup(t); mutate(value); rejects(value, pattern);
});

test('baseurl build rejects unprefixed asset and hub URLs', (t) => {
  const value = setup(t, { prefix: '/preview' });
  change(article(value), `/preview/${base}machine.js`, `/${base}machine.js`);
  change(hub(value), `/preview/${base}thumbnail.webp`, `/${base}thumbnail.webp`);
  const errors = validatePlaygrounds(value).errors.join('\n');
  assert.match(errors, /only its own classic script/); assert.match(errors, /Hub entry thumbnail/);
});

test('CLI: exit 0 on a valid site, 1 on a broken one, 2 on bad arguments', (t) => {
  const value = setup(t, { prefix: '/preview' });
  const run = (...args) => spawnSync(process.execPath, [VALIDATOR, ...args], { cwd: value.root, encoding: 'utf8' });
  const ok = run('--site', value.site, '--baseurl', '/preview');
  assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /Playgrounds: valid \(6 payloads, 1 routes\)/);
  assert.equal(run('--site', value.site).status, 1);
  assert.equal(run('--site', value.site, '--force').status, 2);
  assert.equal(run('--baseurl', '/preview').status, 2);
  const rootBuild = setup(t);
  const empty = spawnSync(process.execPath, [VALIDATOR, '--site', '_site', '--baseurl', ''], { cwd: rootBuild.root, encoding: 'utf8' });
  assert.equal(empty.status, 0, empty.stderr);
});
