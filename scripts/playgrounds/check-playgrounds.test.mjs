import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePlaygrounds, checkDifferentialBundle, TOPICS, DIFFERENTIAL, assetBase, manifestPath, payloadPaths, FIXTURE_MARKER } from './check-playgrounds.mjs';
import { fixture, put, change, snapshot, webp, differentialBundle, DIFFERENTIAL_CONTROLS } from './fixtures/site-fixture.mjs';

const VALIDATOR = fileURLToPath(new URL('./check-playgrounds.mjs', import.meta.url));
const EXPECTED_TOPICS = ['stepper-motor', 'barometric-altimeter', 'hard-disk-drive', 'open-differential', 'ac-generator', 'euv-lithography'];
const setup = (t, options) => { const value = fixture(options); t.after(() => fs.rmSync(value.root, { recursive: true, force: true })); return value; };
const articlePath = (value, slug) => path.join(value.site, 'how-things-work', slug, 'index.html');
const hub = (value) => path.join(value.site, 'how-things-work/index.html');
// Re-hash the chosen topic only, so schema/semantic mutations do not fail merely on integrity.
function replacePayload(value, slug, rel, bytes) {
  assert.ok(payloadPaths(slug).includes(rel), 'payload must belong to the selected topic');
  put(value.root, rel, bytes); if (rel.startsWith('assets/')) put(value.site, rel, bytes);
  editManifest(value, slug, (manifest) => { manifest.files[rel] = createHash('sha256').update(bytes).digest('hex'); });
}
function editPayload(value, slug, rel, from, to) {
  const text = fs.readFileSync(path.join(value.root, rel), 'utf8');
  assert.ok(text.includes(from), 'payload mutation must match');
  replacePayload(value, slug, rel, text.replace(from, to));
}
function editManifest(value, slug, edit) {
  const manifest = JSON.parse(fs.readFileSync(path.join(value.root, manifestPath(slug)))); edit(manifest);
  const text = JSON.stringify(manifest); put(value.root, manifestPath(slug), text); put(value.site, manifestPath(slug), text);
}
const rejects = (value, pattern, options = {}) => {
  const report = validatePlaygrounds({ ...value, ...options });
  assert.equal(report.ok, false, 'expected a failure');
  assert.match(report.errors.join('\n'), pattern);
  return report;
};

test('blog registry explicitly covers all six playgrounds through EUV lithography', () => {
  assert.deepEqual(TOPICS, EXPECTED_TOPICS);
  assert.ok(Object.isFrozen(TOPICS));
});

for (const prefix of ['', '/preview']) {
  test('all six topics pass at ' + (prefix || 'root') + ': 36 payloads and 6 routes, without writing', (t) => {
    const value = setup(t, { prefix }); const before = snapshot(value.root);
    assert.deepEqual(value.topics, EXPECTED_TOPICS);
    for (const slug of EXPECTED_TOPICS) {
      for (const rel of [...payloadPaths(slug), manifestPath(slug)]) assert.ok(fs.existsSync(path.join(value.root, rel)), rel);
      assert.ok(fs.existsSync(articlePath(value, slug)));
    }
    const report = validatePlaygrounds({ root: value.root, site: value.site, baseurl: prefix });
    assert.deepEqual(report.errors, []); assert.equal(report.ok, true);
    assert.equal(report.filesChecked, 36); assert.equal(report.routesChecked, 6);
    assert.deepEqual(snapshot(value.root), before);
  });
}

// Synthetic open-differential controls and bundle are only a validator boundary. The probe below runs a TEST FIXTURE
// factory, so these tests prove the gate's reactions, not the real model, physics, generated ABI or native UI.
for (const prefix of ['', '/preview']) test('open differential isolated fixture keeps every control disabled at ' + (prefix || 'root'), (t) => {
  const value = setup(t, { prefix, topics: [DIFFERENTIAL] });
  const html = fs.readFileSync(articlePath(value, DIFFERENTIAL), 'utf8');
  assert.match(html, /TEST FIXTURE static prose, not a real article/);
  for (const control of DIFFERENTIAL_CONTROLS) assert.ok(html.includes(`${control}>`), control);
  assert.deepEqual(validatePlaygrounds(value), { ok: true, errors: [], filesChecked: 6, routesChecked: 1 });
  for (const control of DIFFERENTIAL_CONTROLS) {
    const articleFixture = setup(t, { prefix, topics: [DIFFERENTIAL] });
    change(articlePath(articleFixture, DIFFERENTIAL), control, control.replace(' disabled', ''));
    rejects(articleFixture, /Control enabled in static HTML: open-differential/);
    const sourceFixture = setup(t, { prefix, topics: [DIFFERENTIAL] });
    editPayload(sourceFixture, DIFFERENTIAL, '_includes/how-things-work/open-differential-console.html', control, control.replace(' disabled', ''));
    rejects(sourceFixture, /Control enabled in static include: .*open-differential-console/);
  }
});

test('open differential probe on the synthetic bundle is a short sanity run, not the parameter grid', () => {
  assert.deepEqual(checkDifferentialBundle(differentialBundle()), { presets: 5, snapshots: 38 });
});

const FACTORY_RATIO = 'const ratio = P.sideTeeth / P.spiderTeeth;';
const AXLE = 'axleTorqueLimit: 2 * common,';
const differentialMutations = {
  'missing factory definition': [FACTORY_RATIO, 'const ratio = sideTeethHelper(P);', /factory probe failed.*ReferenceError/],
  'Date in factory': ['const busy = () => started && elapsed < duration;', 'const busy = () => started && elapsed < duration; const clock = Date.now();', /must not use Date/],
  'globalThis in factory': [FACTORY_RATIO, `${FACTORY_RATIO} const global = globalThis;`, /must not use globalThis/],
  'endless factory': ['  reset();\n  return Object.freeze(', '  for (;;) {}\n  reset();\n  return Object.freeze(', /factory probe failed.*timed out/],
  'raw < in serialized data': ['TEST FIXTURE straight boundary', 'TEST FIXTURE </script> boundary', /data escape/],
  'data not JSON': ['"schemaVersion":1,', '"schemaVersion":1,"note":undefined,', /data is not JSON/],
  'bundle layout': ['  createModel: createModel,', '  model: createModel,', /layout differs/],
  'extra factory API': ['return Object.freeze({ snapshot, advance, command, reset });', 'return Object.freeze({ snapshot, advance, command, reset, extra: 1 });', /frozen \{snapshot/],
  'factory writes data': [FACTORY_RATIO, `${FACTORY_RATIO} data.touched = true;`, /leave data unchanged/],
  'spider ratio inverted': [FACTORY_RATIO, 'const ratio = P.spiderTeeth / P.sideTeeth;', /identity failed.*rpm\.spiderOwn/],
  'mean speed broken': ['rpmC * (1 + k)', 'rpmC * (1 + 2 * k)', /identity failed.*rpm\.right/],
  'held side swapped': ["(c['low-grip-side'] === 'left' ? 'right' : 'left')", "(c['low-grip-side'] === 'left' ? 'left' : 'right')", /identity failed \(low-grip-left/],
  'ground travel in stuck': ['groundTravelLeftM: stuck ? 0 : r * angles.left', 'groundTravelLeftM: r * angles.left', /identity failed.*groundTravelLeftM/],
  'actualTorque field': [AXLE, `${AXLE} actualTorque: common,`, /snapshot keys differ/],
  'axle limit not twice common': [AXLE, 'axleTorqueLimit: common,', /identity failed.*axleTorqueLimit/],
  'zero-grip note missing': ["stuck && c['low-grip-mu'] === 0 ? T.zeroGripNote : ''", "''", /identity failed \(zero-grip\): boundary/],
  'snapshot not frozen': ['Object.freeze(value); } return value;', '} return value;', /deep-frozen/],
  'non-finite progress': ['progress: elapsed / duration', 'progress: elapsed / 0', /deep-frozen, finite/],
  'negative zero angle': ['w[name] * elapsed + 0;', 'w[name] * elapsed;', /without -0/],
  'advance while paused': ['function advance(dt) { if (running && busy()', 'function advance(dt) { if (busy()', /paused-noop broke/],
  'physical key while busy': ['else if (!busy() && key in controls)', 'else if (key in controls)', /paused-noop broke/],
  'frame changes time': ["else if (key === 'reference-frame') controls = { ...controls, [key]: value };", "else if (key === 'reference-frame') { controls = { ...controls, [key]: value }; elapsed = 0; }", /carrier-frame broke/],
  'preset earns a badge': ["controls = { ...presets[value], 'reference-frame': controls['reference-frame'] };", "controls = { ...presets[value], 'reference-frame': controls['reference-frame'] }; done[presets[value].scenario] = true;", /challenges do not match/],
  'reset keeps badges': ['completed = 0; sides = []; done = {}; }', 'completed = 0; sides = []; done = done || {}; }', /identity failed \(reset\): challenges/],
  'done short of duration': ['elapsed = duration; running = false;', 'elapsed = duration - 1e-6; running = false;', /done broke/],
};
for (const [name, [from, to, pattern]] of Object.entries(differentialMutations)) test('open differential probe rejects ' + name, (t) => {
  const value = setup(t, { topics: [DIFFERENTIAL] });
  editPayload(value, DIFFERENTIAL, `${assetBase(DIFFERENTIAL)}machine.js`, from, to);
  const report = rejects(value, pattern);
  assert.equal(report.errors.length, 1, report.errors.join('\n'));
  assert.match(report.errors[0], /^Differential .*: open-differential$/);
});

// Synthetic HDD controls are only a validator boundary; no runtime, science or native UI acceptance is claimed.
for (const prefix of ['', '/preview']) {
  test('HDD isolated fixture has disabled request/RPM/preset controls at ' + (prefix || 'root'), (t) => {
    const value = setup(t, { prefix, topics: ['hard-disk-drive'] });
    const html = fs.readFileSync(articlePath(value, 'hard-disk-drive'), 'utf8');
    assert.match(html, /TEST FIXTURE static prose, not a real article/);
    for (const [key, max] of [['head-track', 7], ['target-track', 7], ['target-sector', 11], ['start-angle', 359]]) {
      assert.ok(html.includes(`data-playground-key="${key}" data-playground-range min="0" max="${max}" step="1" disabled>`));
    }
    for (const rpm of [5400, 7200, 10000]) assert.ok(html.includes(`data-playground-key="rpm" data-playground-option="${rpm}" aria-pressed="false" disabled>`));
    for (const key of ['same-track', 'far-seek', 'just-missed', 'fast-spindle']) assert.ok(html.includes(`data-playground-preset="${key}" disabled>`));
    assert.deepEqual(validatePlaygrounds(value), { ok: true, errors: [], filesChecked: 6, routesChecked: 1 });
  });

  const controls = [
    ...[['head-track', 7], ['target-track', 7], ['target-sector', 11], ['start-angle', 359]].map(([key, max]) => `data-playground-key="${key}" data-playground-range min="0" max="${max}" step="1" disabled`),
    ...[5400, 7200, 10000].map((rpm) => `data-playground-key="rpm" data-playground-option="${rpm}" aria-pressed="false" disabled`),
    ...['same-track', 'far-seek', 'just-missed', 'fast-spindle'].map((key) => `data-playground-preset="${key}" disabled`),
  ];
  for (const control of controls) test('HDD rejects enabled ' + control + ' at ' + (prefix || 'root'), (t) => {
    const articleFixture = setup(t, { prefix, topics: ['hard-disk-drive'] });
    change(articlePath(articleFixture, 'hard-disk-drive'), control, control.replace(' disabled', ''));
    rejects(articleFixture, /Control enabled in static HTML: hard-disk-drive/);
    const sourceFixture = setup(t, { prefix, topics: ['hard-disk-drive'] });
    editPayload(sourceFixture, 'hard-disk-drive', '_includes/how-things-work/hard-disk-drive-console.html', control, control.replace(' disabled', ''));
    rejects(sourceFixture, /Control enabled in static include: .*hard-disk-drive-console/);
  });
}

test('baseurl: wrong prefix, traversal and query are rejected', (t) => {
  const value = setup(t, { prefix: '/preview' });
  rejects(value, /baseurl/, { baseurl: '' });
  rejects(value, /Invalid baseurl/, { baseurl: '/../escape' });
  rejects(value, /Invalid baseurl/, { baseurl: '/preview?x=1' });
  const rootBuild = setup(t);
  rejects(rootBuild, /baseurl/, { baseurl: '/preview' });
});

function topicMutations(slug) {
  const base = assetBase(slug);
  const scene = '_includes/how-things-work/' + slug + '-scene.html';
  const consoleInclude = '_includes/how-things-work/' + slug + '-console.html';
  const article = (value) => articlePath(value, slug);
  const otherSlug = EXPECTED_TOPICS.find((topic) => topic !== slug);
  return {
    'manifest-kind': [(v) => editManifest(v, slug, (m) => { m.kind = 'machine'; }), /Malformed playground manifest/],
    'manifest-extra-key': [(v) => editManifest(v, slug, (m) => { m.extra = 1; }), /Malformed playground manifest/],
    'manifest-traversal': [(v) => editManifest(v, slug, (m) => { m.files['../escape'] = 'a'.repeat(64); }), /Malformed playground manifest/],
    'manifest-topic': [(v) => editManifest(v, slug, (m) => { m.topic = 'slide-projector'; }), /Malformed playground manifest/],
    'source-hash': [(v) => put(v.root, `${base}machine.js`, '(function () {})();\n'), /Payload hash mismatch/],
    'source-include-hash': [(v) => put(v.root, scene, '{% raw %}\n<p>x</p>\n{% endraw %}\n'), /Payload hash mismatch/],
    'built-asset': [(v) => put(v.site, `${base}machine.css`, 'tampered'), /Built asset mismatch/],
    'built-manifest': [(v) => put(v.site, manifestPath(slug), '{}'), /Built manifest mismatch/],
    'missing-built-asset': [(v) => fs.unlinkSync(path.join(v.site, `${base}thumbnail.webp`)), /thumbnail\.webp/],
    'local-path': [(v) => editPayload(v, slug, `${base}NOTICE.txt`, 'TEST FIXTURE ONLY.', '/Users/someone/x'), /Local path leak/],
    'not-iife': [(v) => replacePayload(v, slug, `${base}machine.js`, 'var x = 1;\n'), /classic IIFE/],
    'module-syntax': [(v) => replacePayload(v, slug, `${base}machine.js`, '(function () {})();\nexport const x = 1;\n'), /classic IIFE/],
    'dynamic-import': [(v) => replacePayload(v, slug, `${base}machine.js`, '(function () { import("x"); })();\n'), /classic IIFE/],
    'unparsable-js': [(v) => replacePayload(v, slug, `${base}machine.js`, '(function () { var = ; })();\n'), /SyntaxError|Unexpected/],
    'global-css': [(v) => replacePayload(v, slug, `${base}machine.css`, `.htw-machine[data-htw-figure="${slug}"] svg {} body { display: none; }\n`), /Unscoped CSS/],
    'other-topic-css': [(v) => replacePayload(v, slug, `${base}machine.css`, '.htw-machine[data-htw-figure="slide-projector"] svg {}\n'), /Unscoped CSS/],
    'css-import': [(v) => replacePayload(v, slug, `${base}machine.css`, `@import "x.css";\n.htw-machine[data-htw-figure="${slug}"] svg {}\n`), /Unsafe CSS/],
    'invalid-thumbnail': [(v) => replacePayload(v, slug, `${base}thumbnail.webp`, 'not an image'), /Invalid WebP/],
    'tiny-thumbnail': [(v) => replacePayload(v, slug, `${base}thumbnail.webp`, webp(16, 16)), /Thumbnail too small/],
    'liquid-include': [(v) => editPayload(v, slug, scene, '{% raw %}', '{% assign unsafe = 1 %}'), /Unsafe Liquid/],
    'unwrapped-include': [(v) => editPayload(v, slug, consoleInclude, '{% raw %}\n', ''), /Unsafe Liquid/],
    'blank-line-include': [(v) => editPayload(v, slug, scene, '\n<figure', '\n  \n<figure'), /Unsafe Liquid\/whitespace/],
    'scene-two-svgs': [(v) => editPayload(v, slug, scene, '</figure>', '<svg></svg></figure>'), /Scene include invalid/],
    'scene-script': [(v) => editPayload(v, slug, scene, '</svg>', '<script>alert(1)</script></svg>'), /Unsafe scene SVG/],
    'scene-external-ref': [(v) => editPayload(v, slug, scene, 'url(#fx-clip)', 'url(https://example.invalid/x)'), /External SVG/],
    'console-svg': [(v) => editPayload(v, slug, consoleInclude, '</div>', '<svg data-machine-view></svg></div>'), /Second scene\/SVG/],
    'include-enabled-control': [(v) => editPayload(v, slug, consoleInclude, 'data-machine-reset disabled', 'data-machine-reset'), /Control enabled in static include/],
    'missing-route': [(v) => fs.unlinkSync(article(v)), new RegExp(`${slug}/index\\.html`)],
    'duplicate-root': [(v) => change(article(v), '<script src=', `<div class="htw-machine" data-htw-figure="${slug}"></div><script src=`), /Expected one \.htw-machine div root/],
    'duplicate-scene': [(v) => change(article(v), '<div data-machine-explore-slot></div>', '<div data-machine-explore-slot><figure data-machine-scene></figure></div>'), /data-machine-scene|Built scene invalid/],
    'missing-view': [(v) => change(article(v), 'data-machine-view=""', 'data-not-view=""'), /data-machine-view/],
    'duplicate-console': [(v) => change(article(v), '<div data-machine-explore-slot></div>', '<div data-machine-explore-slot></div><div data-machine-console hidden inert></div>'), /Expected one data-machine-console /],
    'console-visible': [(v) => change(article(v), 'data-machine-console hidden inert', 'data-machine-console'), /hidden and inert/],
    'enabled-button': [(v) => change(article(v), 'data-machine-run disabled', 'data-machine-run'), /Control enabled in static HTML/],
    'enabled-range': [(v) => { const step = slug === 'ac-generator' ? 30 : 1; change(article(v), `step="${step}" disabled>`, `step="${step}">`); }, /Control enabled in static HTML/],
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
    'manifest-schema': [(v) => editManifest(v, slug, (m) => { m.schemaVersion = 2; }), /Malformed playground manifest/],
    'manifest-digest': [(v) => editManifest(v, slug, (m) => { m.sourceDigest = 'stale'; }), /Malformed playground manifest/],
    'manifest-files-missing': [(v) => editManifest(v, slug, (m) => { delete m.files[scene]; }), /Malformed playground manifest/],
    'manifest-files-extra': [(v) => editManifest(v, slug, (m) => { m.files[base + 'extra.js'] = 'a'.repeat(64); }), /Malformed playground manifest/],
    'missing-source-manifest': [(v) => fs.unlinkSync(path.join(v.root, manifestPath(slug))), new RegExp(slug + '/manifest\\.json')],
    'missing-built-manifest': [(v) => fs.unlinkSync(path.join(v.site, manifestPath(slug))), new RegExp(slug + '/manifest\\.json')],
    'stale-route-from-other-topic': [(v) => put(v.site, 'how-things-work/' + slug + '/index.html', fs.readFileSync(articlePath(v, otherSlug))), /Expected one \.htw-machine div root/],
    'registered-topic-script': [(v) => change(article(v), '</body>', '<script src="/' + assetBase(otherSlug) + 'machine.js"></script></body>'), /only its own classic script/],
    'registered-topic-css': [(v) => change(article(v), '</head>', '<link rel="stylesheet" href="/' + assetBase(otherSlug) + 'machine.css"></head>'), /only its own topic CSS/],
    'home-css': [(v) => fs.appendFileSync(path.join(v.site, 'index.html'), '<link rel="stylesheet" href="/' + base + 'machine.css">'), /CSS leaks into home/],
    'home-root': [(v) => fs.appendFileSync(path.join(v.site, 'index.html'), '<div data-htw-figure="' + slug + '"></div>'), /root leaks into home/],
  };
}
for (const slug of EXPECTED_TOPICS) {
  for (const [name, [mutate, pattern]] of Object.entries(topicMutations(slug))) test(slug + ': rejects ' + name, (t) => {
    const value = setup(t); mutate(value); rejects(value, pattern);
  });

  for (const rel of payloadPaths(slug)) {
    test(slug + ': rejects missing source payload ' + rel, (t) => {
      const value = setup(t); fs.unlinkSync(path.join(value.root, rel));
      const report = rejects(value, /Cannot read/);
      assert.ok(report.errors.some((error) => error.includes(rel)), rel);
    });
    test(slug + ': rejects stale source payload ' + rel, (t) => {
      const value = setup(t); fs.appendFileSync(path.join(value.root, rel), 'STALE TEST FIXTURE');
      const report = rejects(value, /Payload hash mismatch/);
      assert.ok(report.errors.some((error) => error.includes(rel)), rel);
    });
    if (rel.startsWith('assets/')) {
      test(slug + ': rejects missing built payload ' + rel, (t) => {
        const value = setup(t); fs.unlinkSync(path.join(value.site, rel));
        const report = rejects(value, /Cannot read/);
        assert.ok(report.errors.some((error) => error.includes(rel)), rel);
      });
      test(slug + ': rejects stale built payload ' + rel, (t) => {
        const value = setup(t); fs.appendFileSync(path.join(value.site, rel), 'STALE TEST FIXTURE');
        const report = rejects(value, /Built asset mismatch/);
        assert.ok(report.errors.some((error) => error.includes(rel)), rel);
      });
    }
  }

  test(slug + ': baseurl rejects unprefixed asset and hub URLs', (t) => {
    const value = setup(t, { prefix: '/preview' }); const base = assetBase(slug);
    change(articlePath(value, slug), '/preview/' + base + 'machine.js', '/' + base + 'machine.js');
    change(hub(value), '/preview/' + base + 'thumbnail.webp', '/' + base + 'thumbnail.webp');
    const errors = validatePlaygrounds(value).errors.join('\n');
    assert.match(errors, /only its own classic script/); assert.match(errors, /Hub entry thumbnail/);
    assert.ok(errors.split('\n').every((error) => error.includes(slug)), errors);
  });

  for (const prefix of ['', '/preview']) test(slug + ': explicit single-topic API at ' + (prefix || 'root'), (t) => {
    const value = setup(t, { prefix, topics: [slug] });
    assert.deepEqual(value.topics, [slug]);
    const report = validatePlaygrounds(value);
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.equal(report.filesChecked, 6); assert.equal(report.routesChecked, 1);
    // The production/default registry must not silently accept an omitted registered topic.
    const defaultReport = rejects(value, /Cannot read/, { topics: TOPICS });
    assert.ok(defaultReport.errors.some((error) => error.includes(EXPECTED_TOPICS.find((topic) => topic !== slug))));
  });
}

for (const prefix of ['', '/preview']) test('CLI six topics at ' + (prefix || 'root') + ': exit 0/1/2 and 36 payloads/6 routes', (t) => {
  const value = setup(t, { prefix });
  const run = (...args) => spawnSync(process.execPath, [VALIDATOR, ...args], { cwd: value.root, encoding: 'utf8', timeout: 5000 });
  const ok = run('--site', value.site, '--baseurl', prefix);
  assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /Playgrounds: valid \(36 payloads, 6 routes\)/);
  if (prefix) assert.equal(run('--site', value.site).status, 1);
  assert.equal(run('--site', value.site, '--force').status, 2);
  assert.equal(run('--baseurl', prefix).status, 2);
  const relative = run('--site', '_site', '--baseurl', prefix);
  assert.equal(relative.status, 0, relative.stderr);
  assert.match(relative.stdout, /Playgrounds: valid \(36 payloads, 6 routes\)/);
  fs.unlinkSync(articlePath(value, 'barometric-altimeter'));
  const broken = run('--site', value.site, '--baseurl', prefix);
  assert.equal(broken.status, 1, broken.stderr); assert.match(broken.stderr, /barometric-altimeter\/index\.html/);
});
