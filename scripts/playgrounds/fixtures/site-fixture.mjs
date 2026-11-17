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
// Open-differential-shaped controls exercise the same static disabled-control guards; not the generated console ABI.
export const DIFFERENTIAL_CONTROLS = Object.freeze([
  ...['straight', 'corner', 'stuck'].map((value) => `data-playground-key="scenario" data-playground-option="&quot;${value}&quot;" aria-pressed="false" disabled`),
  ...[['carrier-rpm', 6, 30, 6], ['turn-radius', 2, 10, 1], ['low-grip-mu', 0, 0.2, 0.02]].map(([key, min, max, step]) => `data-playground-key="${key}" data-playground-range min="${min}" max="${max}" step="${step}" disabled`),
  ...[['turn-side', 'left'], ['turn-side', 'right'], ['low-grip-side', 'left'], ['low-grip-side', 'right'], ['reference-frame', 'world'], ['reference-frame', 'carrier']].map(([key, value]) => `data-playground-key="${key}" data-playground-option="&quot;${value}&quot;" aria-pressed="false" disabled`),
  ...['straight', 'left-corner', 'right-corner', 'low-grip-left', 'low-grip-right'].map((key) => `data-playground-preset="${key}" disabled`),
]);
const differentialControls = () => DIFFERENTIAL_CONTROLS.map((attrs) => (/data-playground-range/.test(attrs) ? `<input type="range" ${attrs}>` : `<button type="button" ${attrs}>TEST</button>`)).join('\n');

// TEST FIXTURE ONLY: a synthetic closed-form factory in the generated bundle layout, so the validator's
// open-differential probe has something to run. It is not the real model, data, physics or runtime acceptance.
function createModel(data) {
  'use strict';
  const P = data.parameters; const T = data.text; const duration = P.durationSeconds;
  const presets = {}; for (const preset of data.controls.presets) presets[preset.key] = preset.values;
  const ratio = P.sideTeeth / P.spiderTeeth;
  const KEYS = ['straight', 'corner', 'stuck', 'both-grip-sides'];
  let controls, elapsed, started, running, completed, sides, done;
  const busy = () => started && elapsed < duration;
  function reset() { controls = { ...data.defaults }; elapsed = 0; started = false; running = false; completed = 0; sides = []; done = {}; }
  function finish() {
    elapsed = duration; running = false; completed += 1; done[controls.scenario] = true;
    if (controls.scenario === 'stuck' && !sides.includes(controls['low-grip-side'])) sides = [...sides, controls['low-grip-side']];
    if (sides.length === 2) done['both-grip-sides'] = true;
  }
  function move(seconds) { if (elapsed + seconds >= duration - 1e-12) finish(); else elapsed += seconds; }
  function advance(dt) { if (running && busy() && typeof dt === 'number' && dt > 0 && Number.isFinite(dt)) move(dt); }
  function command({ key, value }) {
    if (key === 'reset') reset();
    else if (key === 'preset' && presets[value]) { controls = { ...presets[value], 'reference-frame': controls['reference-frame'] }; elapsed = 0; started = false; running = false; }
    else if (key === 'run') { if (!busy()) { started = true; elapsed = 0; } running = true; }
    else if (key === 'pause') running = false;
    else if (key === 'step') { if (!running && busy()) move(P.stepSeconds); }
    else if (key === 'reference-frame') controls = { ...controls, [key]: value };
    else if (!busy() && key in controls) { controls = { ...controls, [key]: value }; elapsed = 0; started = false; running = false; }
  }
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function snapshot() {
    const c = controls; const stuck = c.scenario === 'stuck'; const corner = c.scenario === 'corner';
    const s = c['turn-side'] === 'left' ? 1 : -1; const R = c['turn-radius']; const b = P.trackWidthM; const r = P.wheelRadiusM;
    const k = corner ? s * b / (2 * R) : 0;
    const heldSide = stuck ? (c['low-grip-side'] === 'left' ? 'right' : 'left') : null;
    const rpmC = c['carrier-rpm'];
    const rpmL = stuck ? (heldSide === 'left' ? 0 : 2 * rpmC) : rpmC * (1 - k);
    const rpmR = stuck ? (heldSide === 'right' ? 0 : 2 * rpmC) : rpmC * (1 + k);
    const rpm = { carrier: rpmC, left: rpmL, right: rpmR, spiderOwn: ratio * (rpmR - rpmC) };
    const w = { carrier: rpmC * Math.PI / 30, left: rpmL * Math.PI / 30, right: rpmR * Math.PI / 30, spiderOwn: rpm.spiderOwn * Math.PI / 30 };
    w.leftRelative = w.left - w.carrier; w.rightRelative = w.right - w.carrier;
    const angles = {}; for (const name of Object.keys(w)) angles[name] = w[name] * elapsed + 0;
    const v = stuck ? 0 : r * w.carrier;
    const grip = { left: stuck && c['low-grip-side'] === 'left' ? c['low-grip-mu'] : P.highGripMu, right: stuck && c['low-grip-side'] === 'right' ? c['low-grip-mu'] : P.highGripMu };
    const capacity = { left: grip.left * P.normalLoadN * r, right: grip.right * P.normalLoadN * r };
    const common = Math.min(capacity.left, capacity.right);
    const phase = !started ? 'idle' : busy() ? (running ? 'running' : 'paused') : 'done';
    return freeze({
      time: elapsed, running, controls: { ...c }, status: `TEST FIXTURE ${phase}`, readout: [], announcement: null,
      challenges: KEYS.map((key) => ({ key, done: Boolean(done[key]) })), scenario: c.scenario, phase, busy: Boolean(busy()),
      elapsed, duration, progress: elapsed / duration, angles, angularSpeeds: w, rpm,
      path: { centerRadiusM: corner ? R : null, leftRadiusM: corner ? R - s * b / 2 : null, rightRadiusM: corner ? R + s * b / 2 : null, centerSpeedMps: v, yawRate: corner ? s * v / R : 0,
        groundTravelLeftM: stuck ? 0 : r * angles.left, groundTravelRightM: stuck ? 0 : r * angles.right, centerDistanceM: v * elapsed, treadTravelLeftM: r * angles.left, treadTravelRightM: r * angles.right },
      tractionCapacity: capacity, commonTorqueLimit: common, axleTorqueLimit: 2 * common, effectiveGrip: grip,
      boundary: { heldSide, imposedCarrier: true, label: T.boundary[c.scenario], zeroGripNote: stuck && c['low-grip-mu'] === 0 ? T.zeroGripNote : '' },
      completedExperiments: completed, observedGripSides: [...sides],
    });
  }
  reset();
  return Object.freeze({ snapshot, advance, command, reset });
}
const physical = (scenario, side, low) => ({ scenario, 'carrier-rpm': 12, 'turn-side': side, 'turn-radius': 3, 'low-grip-side': low, 'low-grip-mu': 0.06 });
export const DIFFERENTIAL_DATA = Object.freeze({
  schemaVersion: 1,
  parameters: { wheelRadiusM: 0.3, trackWidthM: 1.5, normalLoadN: 3000, highGripMu: 0.8, sideTeeth: 24, spiderTeeth: 12, durationSeconds: 8, stepSeconds: 0.1 },
  defaults: { ...physical('corner', 'left', 'left'), 'reference-frame': 'world' },
  controls: { groups: [], challenges: ['straight', 'corner', 'stuck', 'both-grip-sides'].map((key) => ({ key, label: `TEST ${key}` })),
    presets: [['straight', 'straight', 'left', 'left'], ['left-corner', 'corner', 'left', 'left'], ['right-corner', 'corner', 'right', 'left'], ['low-grip-left', 'stuck', 'left', 'left'], ['low-grip-right', 'stuck', 'left', 'right']].map(([key, ...values]) => ({ key, label: `TEST ${key}`, values: physical(...values) })) },
  text: { boundary: { straight: 'TEST FIXTURE straight boundary', corner: 'TEST FIXTURE corner boundary', stuck: 'TEST FIXTURE held axle boundary' }, zeroGripNote: 'TEST FIXTURE zero grip note' },
});
export const differentialBundle = () => `/* TEST FIXTURE ONLY: synthetic open-differential bundle layout, not a playground */\n(function () {\n'use strict';\nvar runtime = { boot: function () {} };\n`
  + `var createModel = (${createModel});\nvar mountRenderer = (function mountRenderer(root, data) { return { render: function () {}, dispose: function () {} }; });\n`
  + `runtime.boot({\n  slug: "open-differential",\n  descriptor: {"title":"TEST FIXTURE"},\n  data: ${JSON.stringify(DIFFERENTIAL_DATA)},\n  createModel: createModel,\n  mountRenderer: mountRenderer\n}, document);\n})();\n`;

const consoleHtml = (slug) => `<div class="htw-machine-console-panel" id="${slug}-console" data-machine-console-panel>\n<button type="button" data-machine-run disabled>Chạy</button>\n<button type="button" data-machine-pause disabled>Dừng</button>\n<button type="button" data-machine-step disabled>Từng bước</button>\n<button type="button" data-machine-reset disabled>Đặt lại</button>\n${slug === 'hard-disk-drive' ? hddControls() : slug === 'open-differential' ? differentialControls() : `<button type="button" data-playground-key="phaseA" data-playground-option="1" aria-pressed="false" disabled>+</button>\n<input type="range" id="${slug}-control-rate" data-playground-key="rate" data-playground-range min="1" max="100" step="1" disabled>`}\n</div>`;

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
      slug === 'open-differential' ? differentialBundle() : `/* TEST FIXTURE ONLY: not a playground */\n(function () {\n'use strict';\nvar fixture = ${JSON.stringify(slug)};\n})();\n`,
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
