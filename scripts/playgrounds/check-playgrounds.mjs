#!/usr/bin/env node
// Independent integrity/routing gate for How Things Work playground articles. Node builtins only; it never imports
// model code. Payloads are parsed, not executed, except the differential and AC-generator repository factories below.
// Run from the repository root:
//   node scripts/playgrounds/check-playgrounds.mjs --site _site [--baseurl /prefix]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm, { Script } from 'node:vm';

export const TOPICS = Object.freeze(['stepper-motor', 'barometric-altimeter', 'hard-disk-drive', 'open-differential', 'ac-generator', 'euv-lithography']);
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

// open-differential only. Reads the serialized model factory and data from the generated bundle layout, scans them,
// then runs ONLY that factory in an empty vm context with a timeout for a short snapshot sanity probe: presets,
// pause/step/frame/reset and finite closed-form identities. Not the 5940-case grid, not the runtime/renderer and not
// a sandbox for untrusted code; it runs only bytes that already matched the manifest hash.
export const DIFFERENTIAL = 'open-differential';
const MODEL_FORBIDDEN = [[/\beval\s*\(/, 'eval('], [/\bnew\s+Function\b|(?<![\w$.])Function\s*\(/, 'Function'], [/\bimport\s*(?:\(|\.meta\b)|^\s*import\s/m, 'import'], [/\brequire\s*\(/, 'require('],
  [/\b(?:requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|setImmediate|requestIdleCallback)\b/, 'timers'], [/\bMath\.random\b/, 'Math.random'],
  [/\bDate\b/, 'Date'], [/\bperformance\b/, 'performance'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bglobalThis\b/, 'globalThis']];
const SNAPSHOT_KEYS = ['time', 'running', 'controls', 'status', 'readout', 'announcement', 'challenges', 'scenario', 'phase', 'busy', 'elapsed', 'duration', 'progress', 'angles', 'angularSpeeds', 'rpm', 'path', 'tractionCapacity', 'commonTorqueLimit', 'axleTorqueLimit', 'effectiveGrip', 'boundary', 'completedExperiments', 'observedGripSides'];
const ANGLE_KEYS = ['carrier', 'left', 'right', 'spiderOwn', 'leftRelative', 'rightRelative'];
const PATH_KEYS = ['centerRadiusM', 'leftRadiusM', 'rightRadiusM', 'centerSpeedMps', 'yawRate', 'groundTravelLeftM', 'groundTravelRightM', 'centerDistanceM', 'treadTravelLeftM', 'treadTravelRightM'];
const CONTROL_KEYS = ['scenario', 'carrier-rpm', 'turn-side', 'turn-radius', 'low-grip-side', 'low-grip-mu', 'reference-frame'];
const CHALLENGE_KEYS = ['straight', 'corner', 'stuck', 'both-grip-sides'];

// Stringified into the vm: must stay self-contained. Returns plain JSON text only.
function differentialProbe(createModel, dataText) {
  'use strict';
  const data = JSON.parse(dataText);
  const model = createModel(data);
  const shots = [];
  const take = (label) => {
    const snap = model.snapshot(); let frozen = true; let finite = true; let signed = true;
    const walk = (item) => {
      if (typeof item === 'number') { finite = finite && Number.isFinite(item); signed = signed && !Object.is(item, -0); }
      else if (item && typeof item === 'object') { frozen = frozen && Object.isFrozen(item); Object.values(item).forEach(walk); }
    };
    walk(snap); shots.push({ label, frozen, finite, signed, snap: JSON.stringify(snap) });
  };
  const duration = data.parameters.durationSeconds;
  take('initial');
  for (const preset of data.controls.presets) {
    model.command({ key: 'preset', value: preset.key }); take(`${preset.key}:loaded`);
    model.command({ key: 'run' }); model.advance(duration / 2); take(`${preset.key}:running`);
    model.command({ key: 'pause' }); take(`${preset.key}:paused`);
    model.advance(-1); model.advance(NaN); model.advance(1); model.command({ key: 'scenario', value: preset.values.scenario === 'stuck' ? 'straight' : 'stuck' });
    take(`${preset.key}:paused-noop`);
    model.command({ key: 'reference-frame', value: 'carrier' }); take(`${preset.key}:carrier-frame`);
    model.command({ key: 'reference-frame', value: 'world' }); model.command({ key: 'step' }); take(`${preset.key}:stepped`);
    model.command({ key: 'run' }); model.advance(duration); take(`${preset.key}:done`);
  }
  const stuck = data.controls.presets.find((preset) => preset.values.scenario === 'stuck');
  model.command({ key: 'preset', value: stuck && stuck.key }); model.command({ key: 'low-grip-mu', value: 0 }); take('zero-grip');
  model.reset(); take('reset');
  return JSON.stringify({ api: Object.keys(model).sort().join(), frozenModel: Object.isFrozen(model), inputUnchanged: JSON.stringify(data) === dataText, shots });
}

function expectDifferential(snap, data, label, earned) {
  const P = data.parameters; const c = snap.controls;
  const fail = (what) => { throw new Error(`Differential snapshot identity failed (${label}): ${what}: ${DIFFERENTIAL}`); };
  const near = (value, expected, what) => { if (typeof value !== 'number' || Math.abs(value - expected) > 1e-9 * Math.max(1, Math.abs(expected))) fail(`${what}=${value}, expected ${expected}`); };
  if (!sameKeys(snap, SNAPSHOT_KEYS) || !sameKeys(c, CONTROL_KEYS) || !sameKeys(snap.angles, ANGLE_KEYS) || !sameKeys(snap.angularSpeeds, ANGLE_KEYS) || !sameKeys(snap.rpm, ANGLE_KEYS.slice(0, 4)) || !sameKeys(snap.path, PATH_KEYS)
    || !sameKeys(snap.tractionCapacity, ['left', 'right']) || !sameKeys(snap.effectiveGrip, ['left', 'right']) || !sameKeys(snap.boundary, ['heldSide', 'imposedCarrier', 'label', 'zeroGripNote'])) fail('snapshot keys differ from the interface');
  if (JSON.stringify(snap.challenges) !== JSON.stringify(CHALLENGE_KEYS.map((key) => ({ key, done: earned.has(key) })))) fail('challenges do not match completed experiments');
  if (typeof snap.status !== 'string' || !snap.status || !Array.isArray(snap.readout) || !Array.isArray(snap.observedGripSides) || !Number.isInteger(snap.completedExperiments)) fail('shared fields malformed');
  if (snap.duration !== P.durationSeconds || snap.time !== snap.elapsed || !(snap.elapsed >= 0 && snap.elapsed <= snap.duration) || snap.scenario !== c.scenario) fail('time/scenario malformed');
  near(snap.progress, snap.elapsed / snap.duration, 'progress');
  if (!['idle', 'running', 'paused', 'done'].includes(snap.phase) || snap.busy !== ['running', 'paused'].includes(snap.phase) || snap.running !== (snap.phase === 'running')) fail('phase/busy/running inconsistent');
  const C = c['carrier-rpm']; const R = c['turn-radius']; const b = P.trackWidthM; const r = P.wheelRadiusM;
  const s = c['turn-side'] === 'left' ? 1 : -1; const corner = c.scenario === 'corner'; const stuck = c.scenario === 'stuck';
  const held = stuck ? (c['low-grip-side'] === 'left' ? 'right' : 'left') : null;
  const rpm = { carrier: C, left: corner ? C * (1 - s * b / (2 * R)) : held === 'left' ? 0 : stuck ? 2 * C : C, right: corner ? C * (1 + s * b / (2 * R)) : held === 'right' ? 0 : stuck ? 2 * C : C };
  rpm.spiderOwn = P.sideTeeth / P.spiderTeeth * (rpm.right - C);
  for (const key of ANGLE_KEYS.slice(0, 4)) { near(snap.rpm[key], rpm[key], `rpm.${key}`); near(snap.angularSpeeds[key], rpm[key] * Math.PI / 30, `angularSpeeds.${key}`); }
  near(snap.angularSpeeds.left + snap.angularSpeeds.right, 2 * snap.angularSpeeds.carrier, 'omegaL+omegaR vs 2*omegaC');
  near(snap.angularSpeeds.leftRelative, snap.angularSpeeds.left - snap.angularSpeeds.carrier, 'angularSpeeds.leftRelative');
  near(snap.angularSpeeds.rightRelative, snap.angularSpeeds.right - snap.angularSpeeds.carrier, 'angularSpeeds.rightRelative');
  for (const key of ANGLE_KEYS) near(snap.angles[key], snap.angularSpeeds[key] * snap.elapsed, `angles.${key}`);
  const v = stuck ? 0 : r * snap.angularSpeeds.carrier; const p = snap.path;
  for (const [key, expected] of [['centerRadiusM', R], ['leftRadiusM', R - s * b / 2], ['rightRadiusM', R + s * b / 2]]) if (corner) near(p[key], expected, `path.${key}`); else if (p[key] !== null) fail(`path.${key} must be null outside corner`);
  near(p.centerSpeedMps, v, 'path.centerSpeedMps'); near(p.yawRate, corner ? s * v / R : 0, 'path.yawRate'); near(p.centerDistanceM, v * snap.elapsed, 'path.centerDistanceM');
  for (const side of ['Left', 'Right']) {
    const angle = snap.angles[side.toLowerCase()];
    near(p[`treadTravel${side}M`], r * angle, `path.treadTravel${side}M`); near(p[`groundTravel${side}M`], stuck ? 0 : r * angle, `path.groundTravel${side}M`);
  }
  for (const side of ['left', 'right']) {
    near(snap.effectiveGrip[side], stuck && c['low-grip-side'] === side ? c['low-grip-mu'] : P.highGripMu, `effectiveGrip.${side}`);
    near(snap.tractionCapacity[side], snap.effectiveGrip[side] * P.normalLoadN * r, `tractionCapacity.${side}`);
  }
  near(snap.commonTorqueLimit, Math.min(snap.tractionCapacity.left, snap.tractionCapacity.right), 'commonTorqueLimit');
  near(snap.axleTorqueLimit, 2 * snap.commonTorqueLimit, 'axleTorqueLimit');
  const B = snap.boundary;
  if (B.heldSide !== held || B.imposedCarrier !== true || B.label !== data.text.boundary[c.scenario] || B.zeroGripNote !== (stuck && c['low-grip-mu'] === 0 ? data.text.zeroGripNote : '')) fail('boundary label/held side/zero-grip note differ from data');
}

export function checkDifferentialBundle(js) {
  const fail = (what) => { throw new Error(`Differential bundle ${what}: ${DIFFERENTIAL}`); };
  const model = /\nvar createModel = \((function createModel\(data\) \{[\s\S]*?\n\})\);\nvar mountRenderer = \(function mountRenderer\(/.exec(js);
  const dataLine = /\n {2}data: (\{[^\n]*\}),\n {2}createModel: createModel,\n {2}mountRenderer: mountRenderer\n\}, document\);\n\}\)\(\);\n?$/.exec(js);
  if (!model || !dataLine || js.split('var createModel = (').length !== 2 || js.split('\n  data: ').length !== 2) fail('layout differs from the generated playground bundle');
  for (const [pattern, name] of MODEL_FORBIDDEN) if (pattern.test(model[1])) fail(`model factory must not use ${name}`);
  if (/[<\u2028\u2029]/.test(dataLine[1])) fail('data escape: raw <, U+2028 or U+2029 in serialized data');
  let data;
  try { data = JSON.parse(dataLine[1]); } catch { fail('data is not JSON'); }
  if (!record(data) || data.schemaVersion !== 1 || !record(data.parameters) || !record(data.controls) || !Array.isArray(data.controls.presets) || !data.controls.presets.length || !record(data.text) || !record(data.text.boundary)) fail('data shape differs from the model interface');
  let probe;
  try { probe = JSON.parse(vm.runInNewContext(`(${differentialProbe})(${model[1]}, ${JSON.stringify(dataLine[1])})`, Object.create(null), { timeout: 1000, filename: `${DIFFERENTIAL}/createModel` })); }
  catch (error) { fail(`factory probe failed (missing definition, throw or timeout): ${error?.name}: ${error?.message}`); }
  if (probe.api !== 'advance,command,reset,snapshot' || !probe.frozenModel || !probe.inputUnchanged) fail('factory must return frozen {snapshot, advance, command, reset} and leave data unchanged');
  const P = data.parameters; const earned = new Set(); const sides = new Set(); const shots = new Map();
  for (const shot of probe.shots) {
    if (!shot.frozen || !shot.finite || !shot.signed) fail(`snapshot ${shot.label} must be deep-frozen, finite and without -0`);
    const snap = JSON.parse(shot.snap); const [key, step] = shot.label.split(':'); const preset = data.controls.presets.find((item) => item.key === key);
    if (step === 'done') {
      earned.add(snap.scenario);
      if (snap.scenario === 'stuck') sides.add(snap.controls['low-grip-side']);
      if (sides.size === 2) earned.add('both-grip-sides');
    }
    if (key === 'reset') earned.clear();
    expectDifferential(snap, data, shot.label, earned);
    const half = Math.abs(snap.elapsed - P.durationSeconds / 2) <= 1e-9;
    const ok = { loaded: snap.phase === 'idle' && snap.elapsed === 0 && CONTROL_KEYS.slice(0, 6).every((name) => snap.controls[name] === preset?.values?.[name]) && snap.controls['reference-frame'] === 'world',
      running: snap.phase === 'running' && half, paused: snap.phase === 'paused' && half,
      'paused-noop': shot.snap === shots.get(`${key}:paused`), stepped: snap.phase === 'paused' && Math.abs(snap.elapsed - P.durationSeconds / 2 - P.stepSeconds) <= 1e-9,
      'carrier-frame': snap.controls['reference-frame'] === 'carrier' && JSON.stringify({ ...snap, controls: { ...snap.controls, 'reference-frame': 'world' } }) === shots.get(`${key}:paused`),
      done: snap.phase === 'done' && snap.elapsed === P.durationSeconds && !snap.running,
      initial: snap.phase === 'idle' && snap.elapsed === 0 && JSON.stringify(snap.controls) === JSON.stringify(data.defaults),
      'zero-grip': snap.scenario === 'stuck' && snap.controls['low-grip-mu'] === 0 && snap.boundary.zeroGripNote !== '' && snap.commonTorqueLimit === 0,
      reset: shot.snap === shots.get('initial') }[step ?? key];
    if (!ok) fail(`probe step ${shot.label} broke pause/step/frame/preset/reset behaviour`);
    shots.set(shot.label, shot.snap);
  }
  if (!CHALLENGE_KEYS.every((name) => JSON.parse(shots.get('zero-grip')).challenges.some((item) => item.key === name && item.done))) fail('presets did not complete every challenge');
  return { presets: data.controls.presets.length, snapshots: probe.shots.length };
}

export const GENERATOR = 'ac-generator';
// Same trust boundary as the differential probe: parse the complete runtime, then execute only the extracted
// repository factory after payload integrity validation. A VM timeout is not an untrusted-code sandbox.
// Self-contained because this function is serialized into the empty VM; no runtime or renderer is executed.
function generatorProbe(createModel, dataText) {
  'use strict';
  const data = JSON.parse(dataText); const P = data.parameters; const model = createModel(data);
  const keys = ['speed', 'reverse', 'stopped']; const earned = new Set(); let count = 0; let snapshots = 0;
  const fail = (what) => { throw new Error(what); };
  const near = (actual, expected, label) => { if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9 * (1 + Math.abs(expected))) fail(`identity ${label}`); };
  const shape = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === [...names].sort().join();
  const freezeCheck = (value) => {
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) fail('snapshot must be finite and without -0');
    if (value && typeof value === 'object') { if (!Object.isFrozen(value)) fail('snapshot must be deep-frozen'); Object.values(value).forEach(freezeCheck); }
  };
  if (Object.keys(model).sort().join() !== 'advance,command,reset,snapshot' || !['advance', 'command', 'reset', 'snapshot'].every((key) => typeof model[key] === 'function')) fail('factory API must be {snapshot, advance, command, reset}');
  const original = JSON.stringify(data); const held = [];
  const omega = (c) => c.direction * c['shaft-rpm'] * Math.PI / 30;
  const point = (time, segment) => {
    const angleRad = segment.angleRad + segment.angularSpeedRadPerSec * (time - segment.at);
    return { time, angleRad, fluxWb: P.fieldTesla * P.areaM2 * Math.cos(angleRad), emfV: P.turns * P.fieldTesla * P.areaM2 * segment.angularSpeedRadPerSec * Math.sin(angleRad) };
  };
  function take(label, expected = {}) {
    snapshots++; const s = model.snapshot(); freezeCheck(s);
    if (!shape(s, ['time', 'controls', 'running', 'status', 'announcement', 'readout', 'challenges', 'phase', 'busy', 'elapsed', 'duration', 'progress', 'completedExperiments', 'angleRad', 'angularSpeedRadPerSec', 'shaftStopped', 'fluxWb', 'fluxLinkageWbTurn', 'emfV', 'peakEmfV', 'frequencyHz', 'periodSeconds', 'segments', 'samples', 'conditionSeconds', 'boundary'])) fail('snapshot keys differ from interface');
    if (!shape(s.controls, ['shaft-rpm', 'direction', 'initial-angle']) || !shape(s.boundary, ['label']) || s.boundary.label !== data.text.boundary || !shape(s.conditionSeconds, keys)) fail('controls/boundary/condition keys');
    const c = s.controls;
    if (![0, 30, 60, 90, 120].includes(c['shaft-rpm']) || ![1, -1].includes(c.direction) || ![0, 90, 180, 270].includes(c['initial-angle'])) fail('control domain');
    if (!['idle', 'running', 'paused', 'done'].includes(s.phase) || s.running !== (s.phase === 'running') || s.busy !== ['running', 'paused'].includes(s.phase) || s.shaftStopped !== (c['shaft-rpm'] === 0)) fail('phase/busy/shaftStopped invariants');
    if (typeof s.status !== 'string' || !s.status || !Array.isArray(s.readout) || !s.readout.every((r) => shape(r, ['key', 'label', 'text']) && typeof r.key === 'string' && typeof r.label === 'string' && typeof r.text === 'string') || !(s.announcement === null || typeof s.announcement === 'string')) fail('shared fields');
    if (new Set(s.readout.map((row) => row.key)).size !== s.readout.length) fail('readout keys must be unique');
    near(s.duration, 8, 'duration'); near(s.time, s.elapsed, 'time'); near(s.progress, s.elapsed / 8, 'progress');
    if (s.elapsed < 0 || s.elapsed > 8 || s.completedExperiments !== count) fail('elapsed/completion count');
    if (JSON.stringify(s.challenges) !== JSON.stringify(keys.map((key) => ({ key, done: earned.has(key) })))) fail('challenge earned before completion or lost');
    near(s.angularSpeedRadPerSec, omega(c), 'signed omega');
    near(s.fluxWb, P.fieldTesla * P.areaM2 * Math.cos(s.angleRad), 'flux per turn');
    near(s.fluxLinkageWbTurn, P.turns * s.fluxWb, 'flux linkage');
    near(s.emfV, P.turns * P.fieldTesla * P.areaM2 * omega(c) * Math.sin(s.angleRad), 'emf');
    near(s.peakEmfV, P.turns * P.fieldTesla * P.areaM2 * Math.abs(omega(c)), 'peak'); near(s.frequencyHz, c['shaft-rpm'] / 60, 'frequency');
    if (c['shaft-rpm'] === 0) { if (s.periodSeconds !== null) fail('stopped period'); } else near(s.periodSeconds, 60 / c['shaft-rpm'], 'period');
    if (!Array.isArray(s.segments) || !Array.isArray(s.samples)) fail('history arrays');
    const segments = s.segments; const expectedSamples = [];
    if (s.phase === 'idle') {
      if (s.elapsed !== 0 || segments.length || s.samples.length) fail('idle history must be empty');
      near(s.angleRad, c['initial-angle'] * Math.PI / 180, 'idle angle');
    } else {
      if (!segments.length || segments[0].at !== 0) fail('history starts at zero');
      near(segments[0].angleRad, c['initial-angle'] * Math.PI / 180, 'initial segment angle');
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!shape(segment, ['at', 'angleRad', 'angularSpeedRadPerSec']) || segment.at < 0 || segment.at > s.elapsed || (i && segment.at <= segments[i - 1].at)) fail('segment ordering');
        if (i) near(segment.angleRad, point(segment.at, segments[i - 1]).angleRad, 'boundary angle continuity');
      }
      const last = segments[segments.length - 1]; near(s.angleRad, point(s.elapsed, last).angleRad, 'current angle'); near(last.angularSpeedRadPerSec, omega(c), 'last segment omega');
      const times = [];
      for (let tick = 0; tick / 60 <= s.elapsed + 1e-9; tick++) times.push(tick / 60);
      for (const segment of segments.slice(1)) if (!times.some((t) => Math.abs(t - segment.at) <= 1e-9)) times.push(segment.at);
      if (!times.some((t) => Math.abs(t - s.elapsed) <= 1e-9)) times.push(s.elapsed);
      times.sort((a, b) => a - b);
      for (const time of times) {
        const boundary = segments.findIndex((segment, i) => i > 0 && Math.abs(segment.at - time) <= 1e-9);
        if (boundary > 0) { expectedSamples.push(point(segments[boundary].at, segments[boundary - 1]), point(segments[boundary].at, segments[boundary])); }
        else { let index = 0; while (index + 1 < segments.length && segments[index + 1].at < time) index++; expectedSamples.push(point(time, segments[index])); }
      }
      if (s.samples.length !== expectedSamples.length) fail('canonical history length/tail/boundary pair');
      s.samples.forEach((sample, i) => {
        if (!shape(sample, ['time', 'angleRad', 'fluxWb', 'emfV'])) fail('sample keys');
        for (const key of Object.keys(expectedSamples[i])) near(sample[key], expectedSamples[i][key], `history left/right ordering ${i}.${key}`);
      });
    }
    for (const key of keys) {
      let seconds = 0;
      segments.forEach((segment, i) => {
        const end = segments[i + 1]?.at ?? s.elapsed; const w = segment.angularSpeedRadPerSec;
        if ((key === 'speed' && Math.abs(Math.abs(w) - 4 * Math.PI) < 1e-9) || (key === 'reverse' && w < 0) || (key === 'stopped' && w === 0)) seconds += end - segment.at;
      });
      near(s.conditionSeconds[key], seconds, `conditionSeconds.${key}`);
    }
    for (const [key, value] of Object.entries(expected)) { if (typeof value === 'number') near(s[key], value, `${label}.${key}`); else if (JSON.stringify(s[key]) !== JSON.stringify(value)) fail(`${label}.${key}`); }
    held.push([s, JSON.stringify(s)]); return s;
  }
  const command = (key, value) => model.command({ key, value });
  const move = (seconds) => { for (let i = 0; i < Math.floor(seconds / 0.1 + 1e-9); i++) model.advance(0.1); const tail = seconds - Math.floor(seconds / 0.1 + 1e-9) * 0.1; if (tail > 1e-9) model.advance(tail); };
  const initial = take('initial', { phase: 'idle', elapsed: 0, controls: data.defaults });
  command('step'); if (JSON.stringify(take('idle-step')) !== JSON.stringify(initial)) fail('idle Step must be inert');
  for (const descriptor of data.controls.presets) {
    const preset = { ...descriptor, values: data.presets[descriptor.key] };
    command('preset', preset.key); take(`${preset.key}:loaded`, { phase: 'idle', controls: preset.values, elapsed: 0 });
    command('run'); take('run', { phase: 'running', elapsed: 0 });
    model.advance(100); take('clamp', { elapsed: 0.1 }); move(0.025); take('tail', { elapsed: 0.125 }); move(0.025); take('replaced-tail', { elapsed: 0.15 });
    command('pause'); const paused = take('paused', { phase: 'paused' });
    model.advance(1); model.advance(NaN); model.advance(-1); command('initial-angle', (preset.values['initial-angle'] + 90) % 360);
    if (JSON.stringify(take('paused-noop')) !== JSON.stringify(paused)) fail('Pause must freeze clock and initial angle must be locked');
    command('step'); take('stepped', { phase: 'paused', elapsed: 0.25 }); command('run'); move(7.65); command('pause'); take('before-end', { phase: 'paused', elapsed: 7.9 });
    if (preset.key === 'fast') earned.add('speed'); if (preset.key === 'reverse') earned.add('reverse'); if (preset.key === 'stopped') earned.add('stopped'); count++;
    command('step'); take('atomic-step-completion', { phase: 'done', elapsed: 8 }); model.advance(1); command('step'); take('done-inert', { phase: 'done', elapsed: 8 });
  }
  command('preset', 'baseline'); command('run'); move(0.125); const before = take('before-reverse', { elapsed: 0.125, angleRad: Math.PI / 2 + Math.PI / 4 });
  command('pause'); command('direction', -1); take('reverse-boundary', { phase: 'paused', angleRad: before.angleRad, fluxWb: before.fluxWb, emfV: -before.emfV });
  command('shaft-rpm', 120); command('shaft-rpm', 60); const collapsed = take('same-time-collapse'); if (collapsed.segments.length !== 2) fail('same-time boundary must collapse');
  command('run'); move(0.25); command('shaft-rpm', 0); const stopped = take('off-grid-stop', { elapsed: 0.375, angleRad: Math.PI / 4, emfV: 0 });
  move(0.125); take('stopped-clock-advances', { elapsed: 0.5, angleRad: stopped.angleRad, fluxWb: stopped.fluxWb, emfV: 0 });
  command('shaft-rpm', 120); const grid = take('grid-boundary'); if (grid.samples.filter((s) => Math.abs(s.time - 0.5) < 1e-9).length !== 2) fail('grid boundary must replace tick with left/right');
  command('initial-angle', 0); take('running-angle-locked', { controls: grid.controls });
  command('pause'); const valid = JSON.stringify(take('valid'));
  for (const [key, value] of [['shaft-rpm', -30], ['shaft-rpm', 15], ['shaft-rpm', Infinity], ['shaft-rpm', '60'], ['direction', 0], ['direction', '-1'], ['initial-angle', NaN], ['preset', 'missing']]) { command(key, value); if (JSON.stringify(model.snapshot()) !== valid) fail('invalid control mutated state'); }
  model.reset(); earned.clear(); count = 0; const reset = take('reset'); if (JSON.stringify({ ...reset, announcement: null }) !== JSON.stringify({ ...initial, announcement: null })) fail('reset must restore defaults and erase badges');
  if (JSON.stringify(data) !== original || original !== dataText) fail('factory must leave data unchanged');
  if (held.some(([snapshot, text]) => JSON.stringify(snapshot) !== text)) fail('old snapshot mutated');
  return JSON.stringify({ presets: data.controls.presets.length, snapshots });
}

export function checkGeneratorBundle(js) {
  const fail = (what) => { throw new Error(`Generator bundle ${what}: ${GENERATOR}`); };
  const model = /\nvar createModel = \((function createModel\(data\) \{[\s\S]*?\n\})\);\nvar mountRenderer = \(function mountRenderer\(/.exec(js);
  const dataLine = /\n {2}data: (\{[^\n]*\}),\n {2}createModel: createModel,\n {2}mountRenderer: mountRenderer\n\}, document\);\n\}\)\(\);\n?$/.exec(js);
  if (!model || !dataLine || js.split('var createModel = (').length !== 2 || js.split('\n  data: ').length !== 2) fail('layout differs from generated bundle');
  for (const [pattern, name] of MODEL_FORBIDDEN) if (pattern.test(model[1])) fail(`model factory must not use ${name}`);
  if (/[<\u2028\u2029]/.test(dataLine[1])) fail('data escape: raw <, U+2028 or U+2029');
  let data; try { data = JSON.parse(dataLine[1]); } catch { fail('data is not JSON'); }
  const params = { turns: 100, fieldTesla: 0.2, areaM2: 0.01, durationSeconds: 8, stepSeconds: 0.1, sampleSeconds: 1 / 60 };
  const controls = (rpm, direction, angle) => ({ 'shaft-rpm': rpm, direction, 'initial-angle': angle });
  const presets = { baseline: controls(60, 1, 90), fast: controls(120, 1, 90), reverse: controls(60, -1, 90), stopped: controls(0, 1, 0), 'flux-maximum': controls(60, 1, 0) };
  const equal = (a, b) => sameKeys(a, Object.keys(b)) && Object.keys(b).every((key) => a[key] === b[key]);
  if (!record(data) || data.schemaVersion !== 1 || !equal(data.parameters, params) || !equal(data.defaults, presets.baseline) || !sameKeys(data.presets, Object.keys(presets)) || !Object.keys(presets).every((key) => equal(data.presets[key], presets[key])) || !record(data.controls) || !Array.isArray(data.controls.presets) || data.controls.presets.length !== 5 || new Set(data.controls.presets.map((p) => p?.key)).size !== 5 || !data.controls.presets.every((p) => record(p) && Object.hasOwn(presets, p.key)) || !record(data.text) || typeof data.text.boundary !== 'string' || !data.text.boundary) fail('data shape differs from canonical contract');
  try { return JSON.parse(vm.runInNewContext(`(${generatorProbe})(${model[1]}, ${JSON.stringify(dataLine[1])})`, Object.create(null), { timeout: 3000, filename: `${GENERATOR}/createModel` })); }
  catch (error) { fail(`factory probe failed: ${error?.name}: ${error?.message}`); }
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
  if (slug === DIFFERENTIAL) attempt(() => {
    const js = source.get(`${base}machine.js`)?.toString('utf8');
    if (js !== undefined) checkDifferentialBundle(js);
  });
  if (slug === GENERATOR) attempt(() => {
    const js = source.get(`${base}machine.js`)?.toString('utf8');
    if (js !== undefined) checkGeneratorBundle(js);
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
