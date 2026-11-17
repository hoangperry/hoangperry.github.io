// These synthetic fixtures test the blog gate, not the real model, export, thumbnail or native UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkGeneratorBundle, validatePlaygrounds, GENERATOR, assetBase, manifestPath } from './check-playgrounds.mjs';
import { fixture, put, change, generatorBundle, GENERATOR_CONTROLS } from './fixtures/site-fixture.mjs';

const setup = (t, prefix = '') => { const value = fixture({ prefix, topics: [GENERATOR] }); t.after(() => fs.rmSync(value.root, { recursive: true, force: true })); return value; };
const article = (v) => path.join(v.site, 'how-things-work/ac-generator/index.html');
function replaceBundle(v, text, rehash = true) {
  const rel = `${assetBase(GENERATOR)}machine.js`; put(v.root, rel, text); put(v.site, rel, text);
  if (rehash) {
    const manifest = JSON.parse(fs.readFileSync(path.join(v.root, manifestPath(GENERATOR))));
    manifest.files[rel] = createHash('sha256').update(text).digest('hex');
    for (const root of [v.root, v.site]) put(root, manifestPath(GENERATOR), JSON.stringify(manifest));
  }
}

test('generator short repository-factory probe accepts synthetic layout only as a fixture', () => {
  assert.deepEqual(checkGeneratorBundle(generatorBundle()), { presets: 5, snapshots: 66 });
});

for (const prefix of ['', '/preview']) {
  test('generator isolated fixture and every disabled control at ' + (prefix || 'root'), (t) => {
    const value = setup(t, prefix); const html = fs.readFileSync(article(value), 'utf8');
    assert.match(html, /TEST FIXTURE static prose, not a real article/);
    for (const control of GENERATOR_CONTROLS) assert.ok(html.includes(`${control}>`), control);
    assert.deepEqual(validatePlaygrounds(value), { ok: true, errors: [], filesChecked: 6, routesChecked: 1 });
  });
  for (const control of GENERATOR_CONTROLS) test('generator rejects enabled ' + control + ' at ' + (prefix || 'root'), (t) => {
    const value = setup(t, prefix); change(article(value), control, control.replace(' disabled', ''));
    assert.match(validatePlaygrounds(value).errors.join('\n'), /Control enabled in static HTML: ac-generator/);
    const source = setup(t, prefix); const rel = '_includes/how-things-work/ac-generator-console.html';
    const bytes = fs.readFileSync(path.join(source.root, rel), 'utf8').replace(control, control.replace(' disabled', ''));
    put(source.root, rel, bytes);
    const manifest = JSON.parse(fs.readFileSync(path.join(source.root, manifestPath(GENERATOR))));
    manifest.files[rel] = createHash('sha256').update(bytes).digest('hex');
    for (const root of [source.root, source.site]) put(root, manifestPath(GENERATOR), JSON.stringify(manifest));
    assert.match(validatePlaygrounds(source).errors.join('\n'), /Control enabled in static include: .*ac-generator-console/);
  });
}

const readoutRow = "{ key: 'emf', label: 'TEST FIXTURE emf', text: String(current.emfV) }";
const mutations = {
  'duplicate readout key': [`readout: [${readoutRow}]`, `readout: [${readoutRow}, ${readoutRow}]`, /readout keys must be unique/],
  'missing readout text': [readoutRow, "{ key: 'emf', label: 'TEST FIXTURE emf' }", /shared fields/],
  'non-string readout text': ['text: String(current.emfV)', 'text: current.emfV', /shared fields/],
  'value-only readout': ['text: String(current.emfV)', 'value: String(current.emfV)', /shared fields/],
  'readout value alias': ['text: String(current.emfV)', 'text: String(current.emfV), value: String(current.emfV)', /shared fields/],
  'missing factory helper': ['const seconds = Math.min(dt, P.durationSeconds - elapsed);', 'const seconds = missingHelper(dt);', /ReferenceError/],
  'host clock': ['const P = data.parameters; const keys', 'const clock = Date.now(); const P = data.parameters; const keys', /must not use Date/],
  'host global': ['const P = data.parameters; const keys', 'const host = globalThis; const P = data.parameters; const keys', /must not use globalThis/],
  'endless factory': ['reset(); return Object.freeze({ command, advance, snapshot, reset });', 'for (;;) {}', /timed out/],
  'runtime layout': ['  createModel: createModel,', '  createModel: otherFactory,', /layout differs/],
  'raw data escape': ['TEST FIXTURE imposed rotation', 'TEST FIXTURE </script> imposed rotation', /data escape/],
  'non-JSON data': ['"schemaVersion":1,', '"schemaVersion":1,"extra":undefined,', /data is not JSON/],
  'noncanonical parameters': ['"turns":100,', '"turns":200,', /data shape differs/],
  'factory input mutation': ['const P = data.parameters; const keys', 'data.touched = true; const P = data.parameters; const keys', /leave data unchanged/],
  'extra API': ['Object.freeze({ command, advance, snapshot, reset });', 'Object.freeze({ command, advance, snapshot, reset, extra: 1 });', /factory API/],
  'wrong polarity': ['emfV: current.emfV,', 'emfV: -current.emfV,', /identity emf/],
  'double-counted flux': ['fluxWb: current.fluxWb,', 'fluxWb: P.turns * current.fluxWb,', /identity flux per turn/],
  'signed peak': ['Math.abs(w()), frequencyHz', 'w(), frequencyHz', /identity peak/],
  'paused means shaft stopped': ["shaftStopped: controls['shaft-rpm'] === 0", "shaftStopped: phase === 'paused' || controls['shaft-rpm'] === 0", /phase\/busy\/shaftStopped/],
  'phase running mismatch': ["running: phase === 'running'", "running: phase !== 'idle'", /phase\/busy\/shaftStopped/],
  'mutable snapshot': ['Object.freeze(value); } return value;', '} return value;', /deep-frozen/],
  'non-finite snapshot': ['progress: elapsed / P.durationSeconds', 'progress: Infinity', /finite and without -0/],
  'negative zero snapshot': ['time: elapsed, controls:', 'time: -0, controls:', /without -0/],
  'advance while paused': ["if (phase === 'running' && typeof dt", "if (busy() && typeof dt", /Pause must freeze clock/],
  'unclamped advance': ['move(Math.min(dt, 0.1));', 'move(dt);', /clamp\.elapsed|elapsed\/completion count/],
  'initial angle unlocked': ["(key === 'initial-angle' && busy())", 'false', /Pause must freeze clock|initial segment angle/],
  'boundary reversed': ['samples.push(pose(segments[boundary].at, segments[boundary - 1]), pose(segments[boundary].at, segments[boundary]))', 'samples.push(pose(segments[boundary].at, segments[boundary]), pose(segments[boundary].at, segments[boundary - 1]))', /history left\/right ordering/],
  'boundary pair missing': ['samples.push(pose(segments[boundary].at, segments[boundary - 1]), pose(segments[boundary].at, segments[boundary]))', 'samples.push(pose(segments[boundary].at, segments[boundary]))', /canonical history length/],
  'extra noncanonical tail': ['times.sort((a, b) => a - b);', 'if (elapsed > 0.02) times.push(0.01); times.sort((a, b) => a - b);', /canonical history length/],
  'same-time segment duplicated': ['segments[segments.length - 1] = next;', 'segments.push(next);', /segment ordering/],
  'control boundary angle reset': ['angleRad: angle, angularSpeedRadPerSec: w()', 'angleRad: 0, angularSpeedRadPerSec: w()', /boundary angle continuity/],
  'condition seconds not accumulated': ['conditions.speed += seconds;', 'conditions.speed = seconds;', /conditionSeconds.speed/],
  'premature preset badge': ['controls = { ...preset }; configuration();', "controls = { ...preset }; badges.speed = true; configuration();", /challenge earned before completion/],
  'reset retains badges': ['completed = 0; badges = {}; configuration();', 'completed = 0; badges = badges || {}; configuration();', /challenge earned before completion/],
};
for (const [name, [from, to, pattern]] of Object.entries(mutations)) test('generator probe rejects ' + name + ' after rehashing the fixture', (t) => {
  const value = setup(t); const bundle = generatorBundle(); assert.ok(bundle.includes(from), name);
  replaceBundle(value, bundle.replace(from, to));
  const report = validatePlaygrounds(value); assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), pattern);
  assert.ok(report.errors.some((error) => /^Generator bundle .*: ac-generator$/.test(error)), report.errors.join('\n'));
});

test('generator never executes a factory with a stale payload hash', (t) => {
  const value = setup(t);
  replaceBundle(value, generatorBundle().replace('reset(); return Object.freeze({ command, advance, snapshot, reset });', 'for (;;) {}'), false);
  const report = validatePlaygrounds(value); assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /Payload hash mismatch/);
  assert.doesNotMatch(report.errors.join('\n'), /factory probe|timed out/);
});

test('generator parses runtime syntax but never executes runtime or renderer', () => {
  const bundle = generatorBundle()
    .replace('var runtime = { boot: function () {} };', 'throw new Error("runtime must not execute"); var runtime = { boot: function () {} };')
    .replace('return { render: function () {}, dispose: function () {} };', 'throw new Error("renderer must not execute");');
  assert.equal(checkGeneratorBundle(bundle).presets, 5);
});
