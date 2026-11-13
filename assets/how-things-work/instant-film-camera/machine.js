/* How Things Work · instant-film-camera · generated machine bundle (classic script). Do not edit. */
(function () {
'use strict';
var runtime = (function createMachineRuntime() {
  'use strict';

  const MAX_DT = 0.1;
  const MODES = ['reader', 'explore'];
  const THEMES = ['dark', 'light'];
  const IDREF_ATTRS = new Set(['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'aria-details', 'aria-errormessage', 'aria-activedescendant', 'for', 'headers', 'list', 'form']);
  const HREF_ATTRS = new Set(['href', 'xlink:href']);
  const CONTROL_SELECTOR = '[data-machine-run],[data-machine-pause],[data-machine-step],[data-machine-film],[data-machine-theme],[data-machine-mode],[data-machine-collapse]';
  const READING_LINE = 0.4; // fraction of the unobscured reading area
  const TEXT = {
    ready: 'Sẵn sàng',
    running: 'Đang chạy',
    paused: 'Đã dừng',
    complete: 'Hoàn tất',
    failed: 'Không chạy được phần tương tác của mô hình. Hình máy vẫn ở dạng tĩnh và bài viết vẫn đọc được.',
    run: 'Đang chạy chu kỳ minh họa.',
    resume: 'Tiếp tục chạy từ trạng thái đã dừng.',
    replay: 'Bắt đầu chu kỳ mới: kết quả cũ đã được xóa và mô hình chạy lại từ đầu.',
    pause: 'Đã dừng. Trạng thái và kết quả được giữ nguyên.',
    done: 'Chu kỳ minh họa đã hoàn tất. Kết quả được giữ nguyên.',
    stepDone: (status) => `Từng bước: ${status}`,
    stepAfterComplete: (label) => `Chu kỳ đã hoàn tất. Từng bước không xóa kết quả; bấm “${label}” để chạy lại từ đầu.`,
    film: (label) => `Đã chọn ${label}. Mô hình dừng lại và đặt lại về đầu chu kỳ.`,
    explore: 'Đã mở chế độ tự thử. Đây vẫn là cùng một mô hình.',
    reader: 'Đã quay lại bài đọc. Mô hình dừng và giữ nguyên trạng thái.',
    hidden: 'Mô hình đã dừng khi bạn rời tab; trạng thái được giữ nguyên.',
    stage: (index, count, title) => `Bước ${index + 1}/${count} · ${title}`,
  };

  // ---------- pure helpers (unit-tested in Node) ----------

  // Frame interval policy: the first tick after any reset is 0 (no catch-up); later ticks are clamped to MAX_DT.
  function frameClock(maxDt = MAX_DT) {
    let last = null;
    return {
      reset() { last = null; },
      tick(now) {
        if (!Number.isFinite(now)) { last = null; return 0; }
        if (last === null) { last = now; return 0; }
        const dt = (now - last) / 1000;
        last = now;
        return dt > 0 ? Math.min(dt, maxDt) : 0;
      },
    };
  }

  function validateSnapshot(snapshot, stepKeys) {
    const fail = (why) => { throw new Error(`Invalid model snapshot: ${why}`); };
    if (!snapshot || typeof snapshot !== 'object') fail('not an object');
    if (!Object.isFrozen(snapshot)) fail('snapshot must be frozen');
    if (!MODES.includes(snapshot.mode)) fail(`mode ${snapshot.mode}`);
    if (typeof snapshot.running !== 'boolean' || typeof snapshot.complete !== 'boolean') fail('running/complete must be booleans');
    if (snapshot.complete && snapshot.running) fail('a complete cycle cannot be running');
    if (!(Number.isFinite(snapshot.time) && snapshot.time >= 0)) fail('time');
    if (!Number.isInteger(snapshot.stageIndex) || stepKeys[snapshot.stageIndex] !== snapshot.stageKey) fail(`stage ${snapshot.stageIndex}/${snapshot.stageKey}`);
    if (typeof snapshot.status !== 'string') fail('status');
    if (!(snapshot.progress >= 0 && snapshot.progress <= 1)) fail('progress must be within 0..1');
    return snapshot;
  }

  function rewriteIdList(value, map) {
    return value.split(/(\s+)/).map((token) => (map.has(token) ? map.get(token) : token)).join('');
  }
  function rewriteUrlRefs(value, map) {
    return value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (match, quote, id) => (map.has(id) ? `url(${quote}#${map.get(id)}${quote})` : match));
  }
  function rewriteHref(value, map) {
    const id = value.startsWith('#') ? value.slice(1) : null;
    return id !== null && map.has(id) ? `#${map.get(id)}` : value;
  }
  function rewriteAttribute(name, value, map) {
    if (IDREF_ATTRS.has(name)) return rewriteIdList(value, map);
    if (HREF_ATTRS.has(name)) return rewriteHref(value, map);
    return value.includes('url(') ? rewriteUrlRefs(value, map) : value;
  }

  // Namespace every id of the included scene/console subtrees per instance and rewrite references to them
  // anywhere in the root (authored aria-controls included). Authored story ids are not in the map, so untouched.
  // The original id is kept in data-machine-id. Returns an undo that restores the authored attributes exactly.
  function namespaceIds(root, subtrees, instanceId) {
    const changes = [];
    const set = (element, name, value) => {
      changes.push([element, name, element.getAttribute(name)]);
      element.setAttribute(name, value);
    };
    const map = new Map();
    for (const subtree of subtrees) {
      for (const element of [subtree, ...subtree.querySelectorAll('[id]')]) {
        if (!element.id || map.has(element.id)) continue;
        const original = element.getAttribute('data-machine-id') || element.id;
        if (!element.hasAttribute('data-machine-id')) set(element, 'data-machine-id', original);
        map.set(element.id, `${instanceId}--${original}`);
      }
    }
    for (const subtree of subtrees) {
      for (const element of [subtree, ...subtree.querySelectorAll('[id]')]) {
        if (map.has(element.id)) set(element, 'id', map.get(element.id));
      }
    }
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name === 'id' || attribute.name === 'data-machine-id') continue;
        const next = rewriteAttribute(attribute.name, attribute.value, map);
        if (next !== attribute.value) set(element, attribute.name, next);
      }
    }
    return {
      map,
      undo() {
        for (let i = changes.length - 1; i >= 0; i--) {
          const [element, name, value] = changes[i];
          if (value === null) element.removeAttribute(name);
          else element.setAttribute(name, value);
        }
        changes.length = 0;
      },
    };
  }

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }

  // ---------- controller: one model, one renderer, one frame owner (DOM-free) ----------

  function createController(options) {
    const { model, renderer, steps, controls } = options;
    const requestFrame = options.requestFrame;
    const cancelFrame = options.cancelFrame;
    const reducedMotion = options.reducedMotion || (() => false);
    const onView = options.onView || (() => {});
    const onFailure = options.onFailure || (() => {});
    const beforeRender = options.beforeRender || (() => {});
    const stepKeys = steps.map((step) => step.key);
    const clock = frameClock(MAX_DT);
    let mode = 'reader';
    let focus = options.focus || 'all';
    let theme = THEMES.includes(options.theme) ? options.theme : 'dark';
    let hidden = Boolean(options.hidden);
    let visible = true;
    let frameId = 0;
    let frames = 0;
    let advances = 0;
    let lastDt = 0; // dt of the last frame that advanced the model
    let failed = null;
    let disposed = false;
    let pausedByHidden = false;
    let announcement = null;
    let current = null;

    const read = () => validateSnapshot(model.snapshot(), stepKeys);
    const canAdvance = () => !disposed && !failed && mode === 'explore' && !hidden && visible && Boolean(current && current.running);

    function fail(error) {
      if (failed || disposed) return;
      failed = error instanceof Error ? error : new Error(String(error));
      if (frameId) cancelFrame(frameId);
      frameId = 0;
      clock.reset();
      onFailure(failed);
    }

    function paint() {
      beforeRender();
      renderer.render(current, { focus, theme, mode, reducedMotion: reducedMotion() });
      frames += 1;
      onView({ snapshot: current, mode, focus, theme, announcement });
      announcement = null;
    }

    function frame(now) {
      frameId = 0;
      if (disposed || failed) return;
      try {
        if (canAdvance()) {
          const wasComplete = current.complete;
          lastDt = clock.tick(now);
          advances += 1;
          model.advance(lastDt, { reducedMotion: reducedMotion() });
          current = read();
          if (!wasComplete && current.complete) announcement = TEXT.done;
        } else {
          clock.reset();
          current = read();
        }
        paint();
        if (canAdvance()) schedule();
        else clock.reset();
      } catch (error) {
        fail(error);
      }
    }

    // Suspended (hidden tab, or scene and output both offscreen): nothing schedules. Logical state, focus and theme
    // still change; the wake in setHidden/setVisible schedules one frame that paints the latest of them.
    function schedule() {
      if (!frameId && !disposed && !failed && !hidden && visible) frameId = requestFrame(frame);
    }

    function guarded(action) {
      if (disposed || failed) return false;
      try {
        const result = action();
        current = read();
        schedule();
        return result !== false;
      } catch (error) {
        fail(error);
        return false;
      }
    }

    function command(name, value) {
      return guarded(() => {
        if (mode !== 'explore') return false; // the reader never operates the machine
        const before = current;
        if (name === 'run') {
          if (before.running) return false;
          model.command('play');
          announcement = before.complete ? TEXT.replay : before.time > 0 ? TEXT.resume : TEXT.run;
          clock.reset();
        } else if (name === 'pause') {
          if (!before.running) return false;
          model.command('pause');
          announcement = TEXT.pause;
          clock.reset();
        } else if (name === 'step') {
          if (before.complete) { announcement = TEXT.stepAfterComplete(controls.replayLabel); return false; }
          model.command('step');
          const after = validateSnapshot(model.snapshot(), stepKeys);
          announcement = TEXT.stepDone(after.status) + (after.complete ? ` ${TEXT.done}` : '');
          clock.reset();
        } else if (name === 'film') {
          const option = (controls.filmOptions || []).find((item) => item.value === value);
          if (!option) return false;
          model.command('film', value);
          announcement = TEXT.film(option.label);
          clock.reset();
        } else return false;
        return true;
      });
    }

    function setMode(next) {
      if (!MODES.includes(next) || next === mode) return false;
      return guarded(() => {
        if (next === 'reader' && current.running) model.command('pause');
        model.command('mode', next);
        mode = next;
        clock.reset();
        announcement = next === 'explore' ? TEXT.explore : TEXT.reader;
      });
    }

    function setHidden(next) {
      hidden = Boolean(next);
      if (hidden) {
        guarded(() => {
          if (current.running) { model.command('pause'); pausedByHidden = true; }
          clock.reset();
        });
        if (frameId) cancelFrame(frameId);
        frameId = 0;
      } else {
        if (pausedByHidden) announcement = TEXT.hidden;
        pausedByHidden = false;
        schedule();
      }
    }

    function setVisible(next) {
      visible = Boolean(next);
      if (!visible) {
        if (frameId) cancelFrame(frameId);
        frameId = 0;
        clock.reset(); // suspended: the first frame after wake advances by 0
      } else schedule();
    }

    // Initial state: always the reader. Render synchronously once so a failing factory is caught at mount.
    model.command('mode', 'reader');
    current = read();
    paint();

    return {
      command,
      setMode,
      setHidden,
      setVisible,
      setFocus(key) {
        if (key !== 'all' && !stepKeys.includes(key)) return false;
        if (key === focus) return true;
        focus = key;
        schedule();
        return true;
      },
      setTheme(next) {
        if (!THEMES.includes(next)) return false;
        theme = next;
        schedule();
        return true;
      },
      requestUpdate() { schedule(); return !failed && !disposed; },
      snapshot() {
        return Object.freeze({
          ...current,
          runtime: Object.freeze({
            mode, focus, theme, hidden, visible, frames, advances, lastDt,
            scheduled: frameId !== 0,
            reducedMotion: reducedMotion(),
            failed: failed ? failed.message : null,
            instanceId: options.instanceId,
          }),
        });
      },
      get mode() { return mode; },
      get theme() { return theme; },
      get failed() { return failed; },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (frameId) cancelFrame(frameId);
        frameId = 0;
        if (renderer && typeof renderer.dispose === 'function') renderer.dispose();
      },
    };
  }

  // ---------- DOM mount ----------

  let instanceCount = 0;
  function nextInstanceId(doc, slug) {
    let id;
    do id = `htw-${slug}-${++instanceCount}`;
    while (doc.querySelector(`[id^="${id}--"]`));
    return id;
  }

  function mount(root, spec) {
    if (!root || root.nodeType !== 1) return null;
    if (root.htwMachine) return root.htwMachine;
    if (!root.matches(`.htw-machine[data-htw-figure="${spec.slug}"]`)) return null;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const $ = (selector) => root.querySelector(selector);
    const scene = $('[data-machine-scene]');
    const readerSlot = $('[data-machine-reader-slot]');
    const exploreSlot = $('[data-machine-explore-slot]');
    const consoleBox = $('[data-machine-console]');
    const story = $('[data-machine-story]');
    const panel = $('[data-machine-console-panel]');
    const instanceId = nextInstanceId(doc, spec.slug);
    const listeners = new AbortController();
    const on = (target, type, handler, extra) => target.addEventListener(type, handler, { ...extra, signal: listeners.signal });
    const enabled = [];
    let names = null;
    let home = null;
    let observer = null;
    let controller = null;
    let renderer = null;
    let handle = null;
    let disposed = false;

    const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
    const announce = (text) => setText($('[data-machine-announcement]'), text);

    function place(mode) {
      if (mode === 'explore') exploreSlot.append(scene);
      else if (home) home.after(scene);
      consoleBox.hidden = mode !== 'explore';
      consoleBox.inert = mode !== 'explore';
      root.dataset.mode = mode;
    }

    function disableControls() {
      for (const element of enabled) element.disabled = true;
      enabled.length = 0;
    }

    function showFailure(error) {
      root.dataset.machineRuntime = 'failed';
      disableControls();
      setText($('[data-machine-status]'), TEXT.failed);
      if (win && win.console) win.console.error(`htw-machine ${spec.slug}: runtime failed; static view kept.`, error);
    }

    function writeView(view) {
      const { snapshot, focus, theme, announcement } = view;
      const state = snapshot.complete ? 'complete' : snapshot.running ? 'running' : snapshot.time > 0 ? 'paused' : 'ready';
      if (root.dataset.machineState !== state) root.dataset.machineState = state;
      if (root.dataset.theme !== theme) root.dataset.theme = theme;
      if (root.dataset.machineFocus !== focus) root.dataset.machineFocus = focus;
      const label = { complete: TEXT.complete, running: TEXT.running, paused: TEXT.paused, ready: TEXT.ready }[state];
      setText($('[data-machine-status]'), snapshot.status ? `${label} · ${snapshot.status}` : label);
      setText($('[data-machine-stage]'), TEXT.stage(snapshot.stageIndex, spec.descriptor.steps.length, spec.descriptor.steps[snapshot.stageIndex].title));
      setText($('[data-machine-readout]'), `${Math.round(snapshot.progress * 100)}%`);
      const run = $('[data-machine-run]');
      if (run) {
        setText(run.querySelector('[data-machine-run-label]') || run, snapshot.complete ? spec.descriptor.controls.replayLabel : spec.descriptor.controls.runLabel);
        run.setAttribute('aria-disabled', String(snapshot.running));
      }
      const pause = $('[data-machine-pause]');
      if (pause) pause.setAttribute('aria-disabled', String(!snapshot.running));
      const step = $('[data-machine-step]');
      if (step) step.setAttribute('aria-disabled', String(snapshot.complete));
      for (const button of root.querySelectorAll('[data-machine-film]')) {
        if (snapshot.film !== undefined) button.setAttribute('aria-pressed', String(button.dataset.machineFilm === snapshot.film));
      }
      for (const item of root.querySelectorAll('[data-machine-step-item]')) {
        if (item.dataset.machineStepItem === snapshot.stageKey) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      }
      const themeButton = $('[data-machine-theme]');
      if (themeButton) themeButton.setAttribute('aria-pressed', String(theme === 'light'));
      if (announcement) announce(announcement);
    }

    // Passive reading: the section crossing the reading line chooses the emphasis, nothing else.
    const sections = story ? Array.from(story.querySelectorAll('[data-machine-focus]')) : [];
    let readingDirty = true;
    function chooseFocus() {
      if (!readingDirty || !controller || controller.mode !== 'reader' || !sections.length) return;
      readingDirty = false;
      const height = win.innerHeight;
      const band = readerSlot.getBoundingClientRect();
      const prose = story.getBoundingClientRect();
      const stacked = Math.min(band.right, prose.right) > Math.max(band.left, prose.left);
      const textTop = stacked ? Math.min(height * 0.65, Math.max(0, band.bottom)) : 0;
      const line = textTop + (height - textTop) * READING_LINE;
      let chosen = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) chosen = section;
        else break;
      }
      controller.setFocus(chosen.dataset.machineFocus);
    }

    function setMode(next, fromUser) {
      if (!controller || controller.failed || !controller.setMode(next)) return false;
      place(next);
      readingDirty = true;
      if (fromUser) {
        if (next === 'explore') scene.focus({ preventScroll: false });
        else {
          const opener = $('[data-machine-mode="explore"]');
          if (opener) opener.focus();
        }
      }
      return true;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      listeners.abort();
      if (observer) observer.disconnect();
      try {
        if (controller) controller.dispose();
        else if (renderer && typeof renderer.dispose === 'function') renderer.dispose();
      } catch (error) {
        if (win && win.console) win.console.error(`htw-machine ${spec.slug}: renderer dispose failed.`, error);
      }
      if (scene && home) {
        home.after(scene);
        home.remove();
      }
      if (consoleBox) { consoleBox.hidden = true; consoleBox.inert = false; }
      disableControls();
      if (names) names.undo();
      root.dataset.mode = 'reader';
      delete root.dataset.machineRuntime;
      delete root.dataset.machineState;
      delete root.dataset.machineFocus;
      delete root.dataset.machineCollapsed;
      delete root.htwMachine;
    }

    handle = Object.freeze({
      snapshot: () => (controller ? controller.snapshot() : Object.freeze({ runtime: Object.freeze({ instanceId, failed: 'not mounted' }) })),
      setMode: (next) => setMode(next, false),
      focus: (key) => Boolean(controller && controller.setFocus(key)),
      requestUpdate: () => Boolean(controller && controller.requestUpdate()),
      dispose,
    });
    Object.defineProperty(root, 'htwMachine', { value: handle, configurable: true, enumerable: false, writable: false });

    try {
      if (!scene || !scene.querySelector('[data-machine-view]') || !readerSlot || !exploreSlot || !consoleBox || !panel) {
        throw new Error('scene/view, reader slot, explore slot, console or console panel missing');
      }
      names = namespaceIds(root, [scene, panel], instanceId);
      home = doc.createComment(' htw-machine scene home ');
      if (readerSlot.contains(scene)) scene.before(home);
      else readerSlot.prepend(home);
      place('reader');
      const data = Object.freeze({ ...spec.data, instanceId });
      const model = spec.createModel(data);
      renderer = spec.mountRenderer(root, data, spec.kit);
      if (!renderer || typeof renderer.render !== 'function') throw new Error('mountRenderer must return { render }');
      const still = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
      controller = createController({
        model, renderer, instanceId,
        steps: spec.descriptor.steps,
        controls: spec.descriptor.controls,
        theme: root.dataset.theme,
        hidden: doc.visibilityState === 'hidden',
        requestFrame: (callback) => win.requestAnimationFrame(callback),
        cancelFrame: (id) => win.cancelAnimationFrame(id),
        reducedMotion: () => Boolean(still && still.matches),
        beforeRender: chooseFocus,
        onView: writeView,
        onFailure: showFailure,
      });

      on(root, 'click', (event) => {
        const target = event.target.closest(CONTROL_SELECTOR);
        if (!target || !root.contains(target) || target.closest('.htw-machine') !== root || target.disabled) return;
        if (target.hasAttribute('data-machine-run')) controller.command('run');
        else if (target.hasAttribute('data-machine-pause')) controller.command('pause');
        else if (target.hasAttribute('data-machine-step')) controller.command('step');
        else if (target.hasAttribute('data-machine-film')) controller.command('film', target.dataset.machineFilm);
        else if (target.hasAttribute('data-machine-theme')) controller.setTheme(controller.theme === 'light' ? 'dark' : 'light');
        else if (target.hasAttribute('data-machine-mode')) setMode(target.dataset.machineMode, true);
        else if (target.hasAttribute('data-machine-collapse')) {
          const collapsed = root.dataset.machineCollapsed !== 'true';
          root.dataset.machineCollapsed = String(collapsed);
          target.setAttribute('aria-expanded', String(!collapsed));
        }
      });
      on(root, 'focusin', (event) => {
        const section = event.target.closest && event.target.closest('[data-machine-focus]');
        if (section && sections.includes(section) && controller.mode === 'reader') controller.setFocus(section.dataset.machineFocus);
      });
      // Only the reader needs scroll work; explore scrolling must not schedule frames (e.g. while offscreen).
      const readLater = () => { readingDirty = true; if (controller.mode === 'reader') controller.requestUpdate(); };
      on(win, 'scroll', readLater, { passive: true });
      on(win, 'resize', readLater, { passive: true });
      on(doc, 'visibilitychange', () => controller.setHidden(doc.visibilityState === 'hidden'));
      if (still) on(still, 'change', () => controller.requestUpdate());
      if (typeof win.IntersectionObserver === 'function') {
        const seen = new Set();
        observer = new win.IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) seen.add(entry.target);
            else seen.delete(entry.target);
          }
          controller.setVisible(seen.size > 0);
        });
        observer.observe(scene);
        for (const output of root.querySelectorAll('[data-machine-output]')) if (!scene.contains(output)) observer.observe(output);
      }

      for (const element of root.querySelectorAll(CONTROL_SELECTOR)) {
        if (element.disabled) { element.disabled = false; enabled.push(element); }
      }
      if (controller.failed) throw controller.failed;
      root.dataset.machineRuntime = 'ready';
      controller.requestUpdate();
    } catch (error) {
      listeners.abort();
      if (observer) observer.disconnect();
      // The controller owns the renderer once built; if its initial paint threw, it was never assigned and the
      // mounted renderer is released directly. Either way exactly once, and a throwing dispose is only reported.
      const owner = controller || renderer;
      controller = null;
      renderer = null;
      try {
        if (owner && typeof owner.dispose === 'function') owner.dispose();
      } catch (disposeError) {
        if (win && win.console) win.console.error(`htw-machine ${spec.slug}: renderer dispose failed.`, disposeError);
      }
      if (scene && home) home.after(scene);
      if (consoleBox) { consoleBox.hidden = true; consoleBox.inert = true; }
      root.dataset.mode = 'reader';
      showFailure(error);
    }
    return handle;
  }

  // Mount every root of this topic once the article DOM exists. Pages (or tests) may mount a root added later, or
  // remount after dispose, by dispatching a bubbling `htw-machine-mount` event on it; nothing is exposed globally.
  function boot(spec, doc) {
    deepFreeze(spec.data);
    Object.freeze(spec.kit);
    const selector = `.htw-machine[data-htw-figure="${spec.slug}"]`;
    const mountAll = () => { for (const root of doc.querySelectorAll(selector)) mount(root, spec); };
    doc.addEventListener('htw-machine-mount', (event) => {
      if (event.target && event.target.nodeType === 1 && event.target.matches(selector)) mount(event.target, spec);
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mountAll, { once: true });
    else mountAll();
  }

  return { MAX_DT, TEXT, frameClock, validateSnapshot, rewriteIdList, rewriteUrlRefs, rewriteHref, rewriteAttribute, namespaceIds, deepFreeze, createController, mount, boot };
})();
var kit = {};
Object.assign(kit, (function () {
'use strict';
const AZIMUTH = 45;
const ELEVATION = 30;
const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
function cameraOf({ scale, azimuth = AZIMUTH, elevation = ELEVATION }) {
    const a = azimuth * RADIANS;
    const e = elevation * RADIANS;
    return { sinA: Math.sin(a), cosA: Math.cos(a), sinE: Math.sin(e), cosE: Math.cos(e), k: scale * UNIT };
}
function iso([x, y, z], projection) {
    const { origin } = projection;
    const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
    return [origin[0] + (x * sinA - y * cosA) * k, origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k];
}
function towardViewer(projection) {
    const { sinA, cosA } = cameraOf(projection);
    return [cosA, sinA];
}
function depthOf([x, y, z], projection) {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return (x * cosA + y * sinA) * cosE + z * sinE;
}
const tenth = (value) => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};
function pathOf(points, closed = false) {
    if (!points.length)
        return "";
    return points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");
}
const joinPaths = (paths) => paths.filter(Boolean).join("");
function roundedPlan({ x, y, w, d, r }, steps = 8) {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    const corners = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out = [];
    for (const [cx, cy, start] of corners) {
        const count = radius > 0 ? steps : 0;
        for (let step = 0; step <= count; step++) {
            const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}
function signedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index];
        const [bx, by] = points[(index + 1) % points.length];
        area += ax * by - bx * ay;
    }
    return area / 2;
}
const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);
function convexHull(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3)
        return sorted;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
            lower.pop();
        lower.push(point);
    }
    const upper = [];
    for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
            upper.pop();
        upper.push(point);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function runsOf(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0)
        return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run)
                run = [index];
            run.push((index + 1) % count);
        }
        else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run)
        runs.push(run);
    return runs;
}
function extrude(ring, z, height, projection, options = {}) {
    const convex = options.convex ?? true;
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const { sinA, cosA } = cameraOf(projection);
    const normals = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        return (counter ? [dy / length, -dx / length] : [-dy / length, dx / length]);
    });
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false))
        outline.push(pathOf(run.map((index) => top[index])));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((index) => top[index])));
        if (height > 0)
            outline.push(pathOf(run.map((index) => bottom[index])));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index])
                outline.push(pathOf([top[index], bottom[index]]));
        }
    }
    let fill;
    if (convex) {
        fill = pathOf(convexHull([...top, ...bottom]), true);
    }
    else {
        const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const next = (index + 1) % count;
            parts.push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
        fill = parts.join("");
    }
    const buckets = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const [lx, ly] = [-sinA, cosA];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const [nx, ny] = normals[index];
            const lit = (nx * lx + ny * ly + 1) / 2;
            const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
            const next = (index + 1) % count;
            buckets[shade].push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
    }
    let bevel;
    if (options.bevel && options.bevel > 0) {
        const by = options.bevel;
        const inset = ring.map(([x, y], index) => {
            const [ax, ay] = normals[(index + count - 1) % count];
            const [bx, by2] = normals[index];
            const mx = ax + bx;
            const my = ay + by2;
            const length = Math.hypot(mx, my) || 1;
            return [x - (mx / length) * by, y - (my / length) * by];
        });
        const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
        bevel = runsOf(facing, true)
            .map((run) => pathOf([top[run[0]], ...run.slice(1, -1).map((index) => insetTop[index]), top[run[run.length - 1]]]))
            .join("");
    }
    return {
        fill,
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: buckets.map((paths) => paths.join("")),
        bevel,
    };
}
const ringOf = (plan, steps = 8) => roundedPlan(plan, steps);
function slabOf(plan, z, height, projection, steps = 8, bevel = 0) {
    return extrude(ringOf(plan, steps), z, height, projection, { convex: true, bevel });
}
function circleRing(cx, cy, radius, steps = 40) {
    return Array.from({ length: steps }, (_, step) => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
}
function cylinder(cx, cy, radius, z, height, projection, steps = 32, bevel = 0) {
    return extrude(circleRing(cx, cy, radius, steps), z, height, projection, { convex: true, bevel });
}
const insetPlan = ({ x, y, w, d, r }, by) => ({ x: x + by, y: y + by, w: w - by * 2, d: d - by * 2, r: Math.max(0, r - by) });
function onTop(points, z, projection, closed = false) {
    return pathOf(points.map(([x, y]) => iso([x, y, z], projection)), closed);
}
const planOutline = (plan, z, projection, steps = 8) => onTop(ringOf(plan, steps), z, projection, true);
const lineOnTop = (from, to, z, projection) => onTop([from, to], z, projection);
const segment = (from, to, projection) => pathOf([iso(from, projection), iso(to, projection)]);
const rise = (at, from, to, projection) => segment([at[0], at[1], from], [at[0], at[1], to], projection);
const ring = (cx, cy, radius, z, projection, steps = 40) => onTop(circleRing(cx, cy, radius, steps), z, projection, true);
const pointsAt = (points, projection) => points.map((point) => iso(point, projection));
function dotGrid(x, y, columns, rows, gap, z, projection) {
    const dots = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++)
            dots.push(iso([x + column * gap, y + row * gap, z], projection));
    }
    return dots;
}
function corners({ x, y, w, d }, inset = 0) {
    return [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + inset, y + d - inset],
        [x + w - inset, y + d - inset],
    ];
}
function boxCorners({ x, y, w, d }, z0, z1) {
    const out = [];
    for (const px of [x, x + w])
        for (const py of [y, y + d])
            for (const z of [z0, z1])
                out.push([px, py, z]);
    return out;
}
function knurl(cx, cy, radius, z0, z1, count, projection, inset = 0.4) {
    const [vx, vy] = towardViewer(projection);
    const lines = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        if (nx * vx + ny * vy < 0.15)
            continue;
        lines.push(segment([cx + radius * nx, cy + radius * ny, z0 + inset], [cx + radius * nx, cy + radius * ny, z1 - inset], projection));
    }
    return lines.join("");
}
function sideArc(cx, cy, radius, z, projection, steps = 24) {
    const [vx, vy] = towardViewer(projection);
    const facing = Math.atan2(vy, vx);
    const points = [];
    for (let step = 0; step <= steps; step++) {
        const angle = facing - Math.PI / 2 + (step / steps) * Math.PI;
        points.push(iso([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z], projection));
    }
    return pathOf(points);
}
function ringSeam(ring, z, projection) {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const facing = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const [nx, ny] = counter ? [dy, -dx] : [-dy, dx];
        return nx * vx + ny * vy > 1e-9;
    });
    return runsOf(facing, true).map((run) => pathOf(run.map((index) => iso([ring[index][0], ring[index][1], z], projection)))).join("");
}
const sideSeam = (plan, z, projection, steps = 8) => ringSeam(ringOf(plan, steps), z, projection);
function sideRing(center, radius, axis, projection, steps = 20) {
    const [px, py, pz] = center;
    const points = [];
    for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        points.push(iso(axis === "x" ? [px, py + u, pz + v] : [px + u, py, pz + v], projection));
    }
    return pathOf(points, true);
}
function coil(from, to, center, radius, turns, axis, projection, perTurn = 16) {
    const count = Math.max(1, Math.round(turns * perTurn));
    const back = [];
    const front = [];
    let run = [];
    let near = null;
    for (let index = 0; index <= count; index++) {
        const share = index / count;
        const angle = share * turns * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        const along = from + (to - from) * share;
        const point = axis === "x" ? [along, center[0] + u, center[1] + v] : [center[0] + u, along, center[1] + v];
        const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];
        const facing = depthOf(normal, projection) > 0;
        const flat = iso(point, projection);
        if (near === null)
            near = facing;
        if (facing !== near) {
            run.push(flat);
            (near ? front : back).push(pathOf(run));
            run = [flat];
            near = facing;
            continue;
        }
        run.push(flat);
    }
    if (run.length > 1)
        (near ? front : back).push(pathOf(run));
    return { back: back.join(""), front: front.join("") };
}
function topTicks(from, to, step, every, edge, z, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, edge] : [edge, at];
        const b = axis === "x" ? [at, edge + length] : [edge + length, at];
        (big ? major : minor).push(lineOnTop(a, b, z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function sideTicks(from, to, step, every, face, top, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, face, top] : [face, at, top];
        const b = axis === "x" ? [at, face, top - length] : [face, at, top - length];
        (big ? major : minor).push(segment(a, b, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function radialTicks(cx, cy, radius, count, every, z, lengths, projection, from = 0, span = Math.PI * 2) {
    const minor = [];
    const major = [];
    const closed = Math.abs(span - Math.PI * 2) < 1e-9;
    const steps = closed ? count : count + 1;
    for (let index = 0; index < steps; index++) {
        const angle = from + (index / count) * span;
        const big = index % every === 0;
        const inner = radius - (big ? lengths[1] : lengths[0]);
        const sx = Math.sin(angle);
        const sy = -Math.cos(angle);
        (big ? major : minor).push(lineOnTop([cx + sx * inner, cy + sy * inner], [cx + sx * radius, cy + sy * radius], z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
const haloOf = (plan, z, height, projection) => slabOf(plan, z, height, projection).fill;
function axisVector(projection, [dx, dy, dz]) {
    const origin = iso([0, 0, 0], projection);
    const moved = iso([dx, dy, dz], projection);
    return [moved[0] - origin[0], moved[1] - origin[1]];
}
const fine = (value) => Math.round(value * 100) / 100;
function translateAlong(projection, by) {
    const [x, y] = axisVector(projection, by);
    return `translate(${fine(x)} ${fine(y)})`;
}
const thousandth = (value) => Math.round(value * 1000) / 1000;
function axesAt(at, z, projection) {
    const origin = iso([at[0], at[1], z], projection);
    const along = (point) => {
        const [px, py] = iso(point, projection);
        return [px - origin[0], py - origin[1]];
    };
    return { origin, x: along([at[0] + 1, at[1], z]), y: along([at[0], at[1] + 1, z]), z: along([at[0], at[1], z + 1]) };
}
const matrixOf = (u, v, origin) => `matrix(${thousandth(u[0])} ${thousandth(u[1])} ${thousandth(v[0])} ${thousandth(v[1])} ${thousandth(origin[0])} ${thousandth(origin[1])})`;
function holdStill(element, [dx, dy]) {
    const text = dx || dy ? `translate(${-dx} ${-dy})` : "";
    element.querySelectorAll("[data-hold]").forEach((node) => (text ? node.setAttribute("transform", text) : node.removeAttribute("transform")));
}
function topMatrix(at, z, projection, along = "x") {
    const { origin, x, y } = axesAt(at, z, projection);
    return along === "x" ? matrixOf(x, y, origin) : matrixOf([-y[0], -y[1]], x, origin);
}
function sideMatrix(at, z, projection, face) {
    const { origin, x, y, z: up } = axesAt(at, z, projection);
    const down = [-up[0], -up[1]];
    return face === "left" ? matrixOf(x, down, origin) : matrixOf([-y[0], -y[1]], down, origin);
}
function screenRise(height, projection) {
    const { cosE, k } = cameraOf(projection);
    return height * cosE * k;
}
function fitProjection(points, width, height, { pad = 24, headroom = 0, azimuth = AZIMUTH, elevation = ELEVATION } = {}) {
    const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const up = Math.min(...ys);
    const down = Math.max(...ys);
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2 - headroom) / (down - up));
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, headroom + (height - headroom) / 2 - ((up + down) / 2) * scale],
        scale,
        azimuth,
        elevation,
    };
}
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (pairs) => Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
    .join("");
function solidSvg(paths, { tone = "hi", crease = "faint", halo = false, lit = false, flat = false, className, inner = "" } = {}) {
    const parts = [];
    if (halo)
        parts.push(`<path class="iso-halo" d="${paths.fill}"/>`);
    parts.push(`<path class="iso-fill" d="${paths.fill}"/>`);
    if (!flat) {
        paths.shades.forEach((d, shade) => {
            if (d)
                parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
        });
        parts.push(`<path class="iso-top" d="${paths.top}"/>`);
    }
    if (crease !== "none" && paths.crease)
        parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`);
    if (crease !== "none" && paths.bevel)
        parts.push(`<path class="iso-line iso-bevel" data-tone="${crease}" d="${paths.bevel}"/>`);
    if (inner)
        parts.push(inner);
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
    return `<g${attrs({ class: className ? `iso-solid ${className}` : "iso-solid", "data-lit": lit ? "" : undefined, "data-seamless": paths.seamless ? "" : undefined })}>${parts.join("")}</g>`;
}
function lineSvg(d, { tone = "lo", dotted = false, dashed = false, flow = false, className, free } = {}) {
    if (!d)
        return "";
    return `<path${attrs({
        class: className ? `iso-line ${className}` : "iso-line",
        "data-tone": tone,
        "data-free": free === true ? "" : free || undefined,
        "data-dotted": dotted ? "" : undefined,
        "data-dashed": dashed ? "" : undefined,
        "data-flow": flow ? "" : undefined,
        d,
    })}/>`;
}
function dotsSvg(points, { size = 0.5, tone = "mid", pulse = false } = {}) {
    const dots = points
        .map(([x, y, alpha], index) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${alpha !== undefined && alpha < 1 ? ` fill-opacity="${Math.max(0, alpha).toFixed(2)}"` : ""}${pulse ? ` data-pulse="" style="--pulse-at:${(index * 137) % 1600}ms"` : ""}/>`)
        .join("");
    return `<g class="iso-dots" data-tone="${tone}">${dots}</g>`;
}
function fadedSvg(list, style = {}) {
    const groups = new Map();
    for (const entry of list) {
        const [d, alpha] = Array.isArray(entry) ? entry : [entry.d, entry.alpha];
        if (!d || !(alpha > 0.02))
            continue;
        const level = Math.min(1, Math.round(alpha * 20) / 20);
        groups.set(level, (groups.get(level) ?? "") + d);
    }
    return [...groups].map(([alpha, d]) => (alpha >= 1 ? lineSvg(d, style) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, style)}</g>`)).join("");
}
function fadeLineSvg(points, { fade = [0, 0], tone = "lo", className, stops = 6 } = {}) {
    if (points.length < 2)
        return "";
    const ease = (t) => t * t * (3 - 2 * t);
    const hashOf = (text) => {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++)
            hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(36);
    };
    const lengths = [0];
    for (let index = 1; index < points.length; index++)
        lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
    const at = (length) => {
        let index = 1;
        while (index < points.length - 1 && lengths[index] < length)
            index++;
        const span = lengths[index] - lengths[index - 1] || 1;
        const t = Math.max(0, Math.min(1, (length - lengths[index - 1]) / span));
        return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * t, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * t];
    };
    const pieceOf = (from, to) => [at(from), ...points.filter((_, index) => lengths[index] > from + 1e-6 && lengths[index] < to - 1e-6), at(to)];
    const total = lengths[lengths.length - 1];
    if (total < 1e-6)
        return "";
    let [start, end] = Array.isArray(fade) ? fade : [fade, fade];
    if (start + end > total) {
        const share = total / (start + end);
        start *= share;
        end *= share;
    }
    const paint = `var(--anatomy-${tone})`;
    const ramp = (piece, rising) => {
        const d = pathOf(piece);
        const [x1, y1] = piece[0];
        const [x2, y2] = piece[piece.length - 1];
        const id = `iso-fade-${hashOf(`${d}|${tone}|${rising}`)}`;
        const marks = Array.from({ length: stops + 1 }, (_, index) => {
            const t = index / stops;
            const alpha = ease(rising ? t : 1 - t);
            return `<stop offset="${t.toFixed(3)}" stop-opacity="${alpha.toFixed(3)}" style="stop-color:${paint}"/>`;
        }).join("");
        const gradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${tenth(x1)}" y1="${tenth(y1)}" x2="${tenth(x2)}" y2="${tenth(y2)}">${marks}</linearGradient>`;
        return `<defs>${gradient}</defs><path${attrs({ class: className ? `iso-line ${className}` : "iso-line", "data-tone": tone, "data-free": rising ? "start" : "end", d, style: `stroke:url(#${id})` })}/>`;
    };
    const parts = [];
    if (start > 0.05)
        parts.push(ramp(pieceOf(0, start), true));
    if (total - end - start > 0.05)
        parts.push(lineSvg(pathOf(pieceOf(start, total - end)), { tone, className }));
    if (end > 0.05)
        parts.push(ramp(pieceOf(total - end, total), false));
    return `<g class="iso-fade">${parts.join("")}</g>`;
}
function wireSvg(from, to, { via = [], tone = "lo", dotted = false, dashed = false, flow = false, ends = "both", size = 1.2 } = {}) {
    const d = pathOf([from, ...via, to]);
    const end = ([x, y]) => `<circle class="iso-wire-end" cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"/>`;
    return `<g class="iso-wire" data-tone="${tone}">${lineSvg(d, { tone, dotted, dashed, flow })}${ends === "both" || ends === "from" ? end(from) : ""}${ends === "both" || ends === "to" ? end(to) : ""}</g>`;
}
function faceTextSvg(transform, text, { size = 3, tone = "mid", anchor = "start" } = {}) {
    return `<text class="iso-face-text" data-tone="${tone}" transform="${transform}" font-size="${size}" text-anchor="${anchor}">${escape(text)}</text>`;
}
function groupSvg(children, extra = {}) {
    return `<g${attrs(extra)}>${Array.isArray(children) ? children.join("") : children}</g>`;
}
function figureSvg({ width, height, label, body, standalone = false, className }) {
    const style = standalone ? `<style>${ISO_CSS}</style>` : "";
    return `<svg${attrs({
        xmlns: "http://www.w3.org/2000/svg",
        class: `iso-svg${standalone ? " iso" : ""}${className ? ` ${className}` : ""}`,
        "data-theme": standalone || undefined,
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": label,
    })}>${style}${Array.isArray(body) ? body.join("") : body}</svg>`;
}
function swatchSvg(mark) {
    if (mark === "raised" || mark === "flat" || mark === "lit") {
        const body = mark === "flat" ? "M2 6.5 8 3.5 14 6.5 8 9.5Z" : "M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z";
        const crease = mark === "flat" ? "" : `<path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/>`;
        return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="${body}"/>${crease}</svg>`;
    }
    return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
}
function plateHtml({ fig, title, hint, readout = "", keys = [], caption, body }) {
    const corner = (name, text, extra = "") => `<span class="iso-plate-corner" data-corner="${name}"${extra}>${escape(text)}</span>`;
    const legend = keys.length || caption
        ? `<figcaption class="iso-legend">${keys.length ? `<span class="iso-keys">${keys.map((key) => `<span class="iso-key">${swatchSvg(key.mark)}${escape(key.label)}</span>`).join("")}</span>` : ""}${caption ? `<span class="iso-caption">${escape(caption)}</span>` : ""}</figcaption>`
        : "";
    return `<figure class="iso-figure"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true">${corner("fig", fig)}${title ? corner("title", title) : ""}${hint ? corner("hint", hint) : ""}${corner("readout", readout, " data-readout")}</div>${body}</div>${legend}</figure>`;
}
function pageHtml({ title, theme = "dark", body, script = "", width = 650 }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${ISO_CSS}${PAGE_CSS.replace("__WIDTH__", String(width))}</style></head><body class="iso" data-theme="${theme}"><main class="iso-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}</body></html>`;
}
const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:dark}
body[data-theme="light"]{color-scheme:light}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(__WIDTH__px,100% - 32px);margin:64px auto 96px}
`;
const ISO_CSS = `
.iso{
  --anatomy-page:#0b0b0b;--anatomy-card:#131313;--anatomy-text:#a3a3a3;--anatomy-strong:#e6e6e6;--anatomy-muted:#6e6e6e;
  --anatomy-paper:#131313;--anatomy-face:#1b1b1b;--anatomy-top:#1c1c1c;
  --anatomy-shade-0:#0f0f0f;--anatomy-shade-1:#121212;--anatomy-shade-2:#151515;--anatomy-shade-3:#181818;
  --anatomy-lit-top:#262626;--anatomy-lit-shade:#1d1d1d;
  --anatomy-hi:#d4d4d4;--anatomy-mid:#6a6a6a;--anatomy-lo:#3e3e3e;--anatomy-faint:#2a2a2a;--anatomy-lit:#ffffff;
  --anatomy-halo:#050505;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;
  --anatomy-red:#ff6b6b;--anatomy-green:#6be0a0;--anatomy-blue:#6b9bff;
  --anatomy-weight:.6px;--anatomy-ease:cubic-bezier(.32,.72,0,1);
  --anatomy-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --anatomy-lift:inset 0 1px 0 0 #ffffff0a,inset 0 0 0 1px #ffffff06,0 0 0 1px #00000026,0 1px 1px -.5px #00000014,0 3px 3px -1.5px #00000014,0 6px 6px -3px #00000014,0 12px 12px -6px #00000014;
}
.iso[data-theme="light"]{
  --anatomy-page:#f2f2ef;--anatomy-card:#fbfbfa;--anatomy-text:#57575a;--anatomy-strong:#18181a;--anatomy-muted:#8c8c90;
  --anatomy-paper:#fbfbfa;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#eeeeeb;
  --anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-lit:#000000;
  --anatomy-halo:#8a8a80;--anatomy-halo-opacity:.32;--anatomy-dot:#3a3a3e;
  --anatomy-red:#e5484d;--anatomy-green:#30a46c;--anatomy-blue:#3e63dd;
  --anatomy-lift:inset 0 1px 0 0 #ffffff,0 0 0 1px #0000000f,0 1px 1px -.5px #0000000a,0 3px 3px -1.5px #0000000a,0 6px 6px -3px #0000000a,0 12px 12px -6px #0000000a;
}
.iso-svg{display:block;width:100%;height:auto;overflow:visible}
.iso-svg path,.iso-svg circle{vector-effect:non-scaling-stroke}
.iso-fill{fill:var(--anatomy-paper);stroke:none}
.iso-solid[data-lit]>.iso-fill{fill:var(--anatomy-face)}
.iso-shade,.iso-top{stroke:none}
.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}
.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}
.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}
.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}
.iso-top{fill:var(--anatomy-top)}
.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-lit-shade)}
.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:.4;stroke-linejoin:round}
.iso-solid[data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--anatomy-shade-0)}
.iso-solid[data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--anatomy-shade-1)}
.iso-solid[data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--anatomy-shade-2)}
.iso-solid[data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--anatomy-shade-3)}
.iso-solid[data-seamless]>.iso-top{stroke:var(--anatomy-top)}
.iso-solid[data-seamless][data-lit]>.iso-top{stroke:var(--anatomy-lit-top)}
.iso-solid[data-seamless][data-lit]>.iso-shade{stroke:var(--anatomy-lit-shade)}
.iso-solid[data-lit]>.iso-edge{stroke:var(--anatomy-lit)}
.iso-halo{fill:var(--anatomy-halo);stroke:none;filter:blur(9px);opacity:var(--anatomy-halo-opacity);transform:translateY(3px)}
.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}
.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}
.iso-line[data-tone="lo"]{stroke:var(--anatomy-lo)}
.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}
.iso-line[data-tone="lit"]{stroke:var(--anatomy-lit)}
.iso-line[data-tone="red"]{stroke:var(--anatomy-red)}
.iso-line[data-tone="green"]{stroke:var(--anatomy-green)}
.iso-line[data-tone="blue"]{stroke:var(--anatomy-blue)}
.iso-line[data-dotted]{stroke-dasharray:.01 3.5;stroke-width:1}
.iso-line[data-dashed]{stroke-dasharray:3 3}
.iso-line[data-flow]{stroke-dasharray:2 6}
.iso-wire-end{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-wire[data-tone="hi"] .iso-wire-end{stroke:var(--anatomy-hi)}
.iso-wire[data-tone="mid"] .iso-wire-end{stroke:var(--anatomy-mid)}
.iso-wire[data-tone="faint"] .iso-wire-end{stroke:var(--anatomy-faint)}
.iso-wire[data-tone="lit"] .iso-wire-end{stroke:var(--anatomy-lit)}
.iso-dots circle{fill:var(--anatomy-dot);stroke:none;opacity:.32}
.iso-dots[data-tone="hi"] circle{opacity:.85}
.iso-dots[data-tone="mid"] circle{opacity:.45}
.iso-dots[data-tone="lo"] circle{opacity:.22}
.iso-dots[data-tone="faint"] circle{opacity:.12}
.iso-face-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);letter-spacing:.04em}
.iso-face-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.iso-face-text[data-tone="lo"]{fill:var(--anatomy-lo)}
.iso-face-text[data-tone="faint"]{fill:var(--anatomy-faint)}
.tb-body{fill:var(--anatomy-shade-2);stroke:none}
.tb-shine{fill:var(--anatomy-top);stroke:none}
.tb-shade{fill:var(--anatomy-shade-0);stroke:none}
.tb-ring{fill:none;stroke:var(--anatomy-lo);stroke-width:.45;stroke-linecap:butt;stroke-linejoin:round}
.tb-ring[data-tone="mid"]{stroke:var(--anatomy-mid)}
.tb-ring[data-tone="faint"]{stroke:var(--anatomy-faint)}
.tb-ring[data-tone="hi"]{stroke:var(--anatomy-hi)}
@keyframes iso-flow{to{stroke-dashoffset:-32}}
@keyframes iso-pulse{0%,100%{opacity:.18}12%{opacity:1}40%{opacity:.18}}
.iso-line[data-flow]{animation:iso-flow 1600ms linear infinite}
.iso-dots circle[data-pulse]{animation:iso-pulse 1600ms steps(1,end) infinite;animation-delay:var(--pulse-at,0ms)}
.iso-figure{margin:32px 0 36px}
.iso-plate{position:relative;padding:52px 24px;border-radius:0;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-mid);--anatomy-paper:var(--anatomy-card)}
.iso-plate-corners{position:absolute;inset:18px 20px;pointer-events:none}
.iso-plate-corner{position:absolute;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.iso-plate-corner[data-corner="fig"]{top:0;left:0;color:var(--anatomy-text)}
.iso-plate-corner[data-corner="title"]{top:0;right:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="hint"]{bottom:0;left:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="readout"]{right:0;bottom:0;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.iso-plate .iso-svg{margin:0 auto}
.iso-legend{display:grid;gap:8px;margin-top:12px;color:var(--anatomy-muted);font-size:13px;line-height:1.55}
.iso-keys{display:flex;flex-wrap:wrap;gap:6px 18px}
.iso-key{display:inline-flex;align-items:center;gap:7px}
.iso-swatch{width:16px;height:10px;flex:none;overflow:visible}
.iso-swatch path{fill:none;stroke:var(--anatomy-hi);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.iso-swatch[data-mark="raised"] path,.iso-swatch[data-mark="flat"] path{stroke:var(--anatomy-mid)}
.iso-swatch[data-mark="lit"] path{stroke:var(--anatomy-lit)}
.iso-swatch[data-mark="dim"] path{stroke:var(--anatomy-lo)}
.iso-swatch[data-mark="dotted"] path{stroke-dasharray:.01 3;stroke-width:1.4}
.iso-swatch[data-mark="dashed"] path{stroke-dasharray:3 2.5}
.iso-swatch[data-mark="red"] path{stroke:var(--anatomy-red)}
.iso-swatch[data-mark="green"] path{stroke:var(--anatomy-green)}
.iso-swatch[data-mark="blue"] path{stroke:var(--anatomy-blue)}
.iso-swatch-crease{stroke:var(--anatomy-lo)!important}
@media (max-width:560px){.iso-plate{padding:48px 12px 70px}.iso-plate-corner[data-corner="hint"]{bottom:18px}}
@media (prefers-reduced-motion:reduce){.iso-line[data-flow],.iso-dots circle[data-pulse]{animation:none}}
`;

return { "AZIMUTH": AZIMUTH, "ELEVATION": ELEVATION, "SHADES": SHADES, "cameraOf": cameraOf, "iso": iso, "towardViewer": towardViewer, "depthOf": depthOf, "pathOf": pathOf, "joinPaths": joinPaths, "roundedPlan": roundedPlan, "extrude": extrude, "ringOf": ringOf, "slabOf": slabOf, "circleRing": circleRing, "cylinder": cylinder, "insetPlan": insetPlan, "onTop": onTop, "planOutline": planOutline, "lineOnTop": lineOnTop, "segment": segment, "rise": rise, "ring": ring, "pointsAt": pointsAt, "dotGrid": dotGrid, "corners": corners, "boxCorners": boxCorners, "knurl": knurl, "sideArc": sideArc, "ringSeam": ringSeam, "sideSeam": sideSeam, "sideRing": sideRing, "coil": coil, "topTicks": topTicks, "sideTicks": sideTicks, "radialTicks": radialTicks, "haloOf": haloOf, "axisVector": axisVector, "translateAlong": translateAlong, "holdStill": holdStill, "topMatrix": topMatrix, "sideMatrix": sideMatrix, "screenRise": screenRise, "fitProjection": fitProjection, "solidSvg": solidSvg, "lineSvg": lineSvg, "dotsSvg": dotsSvg, "fadedSvg": fadedSvg, "fadeLineSvg": fadeLineSvg, "wireSvg": wireSvg, "faceTextSvg": faceTextSvg, "groupSvg": groupSvg, "figureSvg": figureSvg, "plateHtml": plateHtml, "pageHtml": pageHtml, "ISO_CSS": ISO_CSS };
})());
Object.assign(kit, (function () {
'use strict';
// Native Y-axis annular sector. Ideal analytic form; IEEE evaluation, no convex cloud.
const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const add = (a,b) => a.map((v,i)=>v+b[i]);
const mul = (a,k) => a.map(v=>v*k);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x)); // closest-point projection only
const FACE_IDS = Object.freeze(['inner','outer','s0','s1','theta0','theta1']);
const basis = {a:[0,1,0],u:[-1,0,0],v:[0,0,1]};
function validateFrame(F) {
  if (!F || !Array.isArray(F.o) || F.o.length!==3 || !F.o.every(Number.isFinite)) throw Error('finite origin required');
  for (const k of ['a','u','v']) if (!Array.isArray(F[k]) || F[k].length!==3 || !F[k].every((v,i)=>v===basis[k][i])) throw Error('only native +Y frame a=(0,1,0), u=(-1,0,0), v=(0,0,1) supported');
}
function annularSector({F,s0,s1,rIn,rOut,theta0,theta1}) {
  validateFrame(F);
  if (![s0,s1,rIn,rOut,theta0,theta1].every(Number.isFinite) || !(s1>s0 && rIn>0 && rOut>rIn && theta1>theta0 && theta1-theta0<=Math.PI && theta0>=-Math.PI && theta1<=Math.PI)) throw Error('invalid annular sector bounds/span');
  const frame=Object.fromEntries(['o','a','u','v'].map(k=>[k,Object.freeze([...F[k]])]));
  return {kind:'annular-sector',F:Object.freeze(frame),s0,s1,rIn,rOut,theta0,theta1};
}
function validateSector(S) {
  if (S.kind!=='annular-sector' || S.cut) throw Error('actual uncut native annular sector required');
  annularSector(S);
}
const radial = (S,t) => add(mul(S.F.u,Math.cos(t)),mul(S.F.v,Math.sin(t)));
const tangent = (S,t) => add(mul(S.F.u,-Math.sin(t)),mul(S.F.v,Math.cos(t)));
const point = (S,s,r,t) => add(add(S.F.o,mul(S.F.a,s)),mul(radial(S,t),r));
const local = (S,p) => {const q=sub(p,S.F.o);return [dot(q,S.F.a),dot(q,S.F.u),dot(q,S.F.v)]};
function inAngle(S,x,y,eps=0) {
  // Two actual oriented angular halfspaces, valid for spans <= pi.
  return Math.cos(S.theta0)*y-Math.sin(S.theta0)*x>=-eps && Math.cos(S.theta1)*y-Math.sin(S.theta1)*x<=eps;
}
function contains(S,p,eps=0) {
  const [s,x,y]=local(S,p),r=Math.hypot(x,y);
  return s>=S.s0-eps && s<=S.s1+eps && r>=S.rIn-eps && r<=S.rOut+eps && inAngle(S,x,y,eps);
}
function signedDistance(S,p) {
  const [s,x,y]=local(S,p),r=Math.hypot(x,y);
  const segmentDistance=t=>{const c=Math.cos(t),n=Math.sin(t),q=clamp(x*c+y*n,S.rIn,S.rOut);return Math.hypot(x-q*c,y-q*n)};
  // Exact Euclidean distance to the planar annular-sector boundary, then extrusion.
  let d=Math.min(segmentDistance(S.theta0),segmentDistance(S.theta1));
  if(inAngle(S,x,y)) d=Math.min(d,Math.abs(r-S.rIn),Math.abs(r-S.rOut));
  const inside=r>=S.rIn && r<=S.rOut && inAngle(S,x,y);
  const flat=inside?-d:d, along=Math.max(S.s0-s,s-S.s1);
  return Math.hypot(Math.max(flat,0),Math.max(along,0))+Math.min(Math.max(flat,along),0);
}
function bounds(S) {
  const ts=[S.theta0,S.theta1];
  for(const t of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]) if(t>S.theta0 && t<S.theta1) ts.push(t);
  const ps=[];for(const s of [S.s0,S.s1])for(const r of [S.rIn,S.rOut])for(const t of ts)ps.push(point(S,s,r,t));
  // Outward padding for IEEE trig and world-coordinate addition; not a contact tolerance.
  const pad=32*Number.EPSILON*Math.max(1,S.rOut,Math.abs(S.s0),Math.abs(S.s1),...S.F.o.map(Math.abs));
  return {min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))-pad),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i]))+pad)};
}
function surfaceAt(S,face,u,v) {
  if(!FACE_IDS.includes(face) || !(u>=0&&u<=1&&v>=0&&v<=1)) throw Error('invalid surface coordinates');
  const s=S.s0+(S.s1-S.s0)*u,r=S.rIn+(S.rOut-S.rIn)*v,t=S.theta0+(S.theta1-S.theta0)*v;
  if(face==='inner'||face==='outer')return {face,p:point(S,s,face==='inner'?S.rIn:S.rOut,t),normal:mul(radial(S,t),face==='inner'?-1:1)};
  if(face==='s0'||face==='s1')return {face,p:point(S,face==='s0'?S.s0:S.s1,S.rIn+(S.rOut-S.rIn)*u,t),normal:mul(S.F.a,face==='s0'?-1:1)};
  const theta=face==='theta0'?S.theta0:S.theta1;
  return {face,p:point(S,s,r,theta),normal:mul(tangent(S,theta),face==='theta0'?-1:1)};
}
function faceAreas(S) {
  const L=S.s1-S.s0,d=S.theta1-S.theta0,end=(S.rOut**2-S.rIn**2)*d/2,cut=(S.rOut-S.rIn)*L;
  return {inner:S.rIn*d*L,outer:S.rOut*d*L,s0:end,s1:end,theta0:cut,theta1:cut};
}
function surfaceSamples(S,spacing=0.6) {
  if(!(spacing>0&&Number.isFinite(spacing)))throw Error('positive finite spacing required');
  const out=[];
  for(const face of FACE_IDS){
    const width=face[0]==='s'?S.rOut-S.rIn:S.s1-S.s0;
    const height=face.startsWith('theta')?S.rOut-S.rIn:S.rOut*(S.theta1-S.theta0);
    const nu=Math.max(1,Math.ceil(width/spacing)),nv=Math.max(1,Math.ceil(height/spacing));
    for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++)out.push(surfaceAt(S,face,i/nu,j/nv));
  }return out;
}
// Analytic intersections evaluated in IEEE; eps is numeric acceptance, not area certification.
function raycast(S,origin,direction,{eps=1e-9}={}) {
  const finite3=v=>(Array.isArray(v)||ArrayBuffer.isView(v))&&v.length===3&&Array.from(v).every(Number.isFinite);
  if(!finite3(origin)||!finite3(direction)||!(Math.hypot(...direction)>0)||!(eps>=0&&Number.isFinite(eps)))throw Error('invalid ray');
  const [sc,x,y]=local(S,origin), ds=dot(direction,S.F.a), dx=dot(direction,S.F.u),dy=dot(direction,S.F.v),hits=[];
  const put=(t,face)=>{if(t<0||!Number.isFinite(t))return;const p=add(origin,mul(direction,t));if(contains(S,p,eps)) {const q=local(S,p);if(face==='theta0'||face==='theta1'){const cutAngle=face==='theta0'?S.theta0:S.theta1;if(q[1]*Math.cos(cutAngle)+q[2]*Math.sin(cutAngle)<S.rIn-eps)return;}const theta=Math.atan2(q[2],q[1]);const normal=face==='inner'?mul(radial(S,theta),-1):face==='outer'?radial(S,theta):face==='s0'?mul(S.F.a,-1):face==='s1'?S.F.a:mul(tangent(S,face==='theta0'?S.theta0:S.theta1),face==='theta0'?-1:1);hits.push({t,p,face,normal});}};
  const a=dx*dx+dy*dy,b=2*(x*dx+y*dy);
  if(a>0)for(const [r,face]of [[S.rIn,'inner'],[S.rOut,'outer']]){const c=x*x+y*y-r*r,disc=b*b-4*a*c;if(disc>=0){const root=Math.sqrt(disc);put((-b-root)/(2*a),face);put((-b+root)/(2*a),face);}}
  if(ds!==0){put((S.s0-sc)/ds,'s0');put((S.s1-sc)/ds,'s1');}
  for(const [theta,face]of [[S.theta0,'theta0'],[S.theta1,'theta1']]){const c=Math.cos(theta),n=Math.sin(theta),den=c*dy-n*dx;if(den!==0)put(-(c*y-n*x)/den,face);}
  return hits.sort((a,b)=>a.t-b.t);
}
function journalContact(shaft,S) {
  validateSector(S);
  // A full circular cylinder is invariant to its radial basis. Accept actual Instant's
  // +X/-Z basis as well as frameAlong's -X/+Z, while requiring exact +Y and orthonormality.
  const F=shaft.F;
  if(!F || !F.o?.every(Number.isFinite) || !F.a?.every((v,i)=>v===basis.a[i]) || F.a.length!==3 || !F.u || !F.v || dot(F.u,F.u)!==1 || dot(F.v,F.v)!==1 || dot(F.u,F.v)!==0 || dot(F.u,F.a)!==0 || dot(F.v,F.a)!==0)throw Error('actual orthonormal +Y cylinder frame required');
  if(shaft.kind!=='body'||shaft.cut||shaft.poly?.length!==4)throw Error('actual native full cylinder required');
  const [[a,z0],[b,R],[c,R1],[d,z1]]=shaft.poly;
  if(!(a===b&&c===d&&c>a&&z0===0&&z1===0&&R===R1&&R>0))throw Error('not a full cylinder');
  if(shaft.F.o[0]!==S.F.o[0]||shaft.F.o[2]!==S.F.o[2])throw Error('noncoaxial centres');
  if(R!==S.rIn)throw Error('radius mismatch: gap or penetration');
  const lo=Math.max(shaft.F.o[1]+a,S.F.o[1]+S.s0),hi=Math.min(shaft.F.o[1]+c,S.F.o[1]+S.s1),L=hi-lo;
  if(!(L>0))throw Error('no positive axial overlap');
  const delta=S.theta1-S.theta0,area=R*delta*L;
  if(!(area>0&&Number.isFinite(area)))throw Error('no positive contact area');
  return {kind:'analytic-conformal-contact',R,L,theta0:S.theta0,theta1:S.theta1,area,axial:[lo,hi],normalOnShaft:t=>mul(radial(S,t),-1),momentY:t=>{const r=mul(radial(S,t),R),n=mul(radial(S,t),-1);return r[2]*n[0]-r[0]*n[2]},normalConvention:'liner inner outward = inward radial on shaft'};
}
function verifyContactNormal(S,theta,n) {
  const expected=mul(radial(S,theta),-1);
  if(!Array.isArray(n)||n.length!==3||!n.every((v,i)=>v===expected[i]))throw Error('wrong normal on shaft');
  return true;
}
function uniformPressureForUnitZ(contact) {
  if(contact?.kind!=='analytic-conformal-contact'||typeof contact.momentY!=='function'||![contact.R,contact.L,contact.theta0,contact.theta1,contact.area].every(Number.isFinite)||!(contact.R>0&&contact.L>0&&contact.theta1>contact.theta0))throw Error('actual conformal contact required');
  const a=contact.theta0,b=contact.theta1,m=(a+b)/2,RL=contact.R*contact.L;
  if(!(m===Math.PI/2||m===-Math.PI/2))throw Error('nominally Z-centred arc required');
  // Evaluate the stored-angle integral, not an ideal symmetry substitution. In particular sin(Math.PI) is not zero.
  const zIntegral=RL*(Math.cos(b)-Math.cos(a));
  if(!Number.isFinite(zIntegral)||zIntegral===0)throw Error('nonzero finite Z integral required');
  const p=1/Math.abs(zIntegral),Fx=p*RL*(Math.sin(b)-Math.sin(a)),Fz=p*RL*(Math.cos(b)-Math.cos(a));
  const panels=256,step=(b-a)/panels;let momentSum=contact.momentY(a)+contact.momentY(b);
  for(let i=1;i<panels;i++)momentSum+=(i%2?4:2)*contact.momentY(a+i*step);
  const momentY=p*RL*momentSum*step/3;
  return {p,area:contact.area,Fx,Fz,momentY,idealMomentY:0,
    numericInterpretation:'IEEE stored-angle force integrals; momentY is composite-Simpson evaluation of stored radial cross products, without clamping',
    idealInterpretation:'Radial normals have identically zero Y moment in the ideal analytic form; ideal exact-angle symmetry is separate from evaluated Fx',
    momentQuadrature:{method:'composite-Simpson',panels},
    interpretation:'Z component normalized only; numerical transverse/moment residuals retained. Not a Hertz, strength, calibrated pressure or complete support certificate'};
}

function surfaceMesh(S,steps=96) {
  if(!Number.isInteger(steps)||steps<4||steps>512)throw Error('steps must be integer 4..512');
  const mesh=[];
  for(const face of FACE_IDS){
    const count=face.startsWith('theta')?1:steps;
    for(let j=0;j<count;j++){
      const v0=j/count,v1=(j+1)/count;
      const points=[[0,v0],[1,v0],[1,v1],[0,v1]].map(([u,v])=>surfaceAt(S,face,u,v).p);
      if(face==='outer'||face==='s0'||face==='theta0')points.reverse();
      mesh.push({face,points,normal:surfaceAt(S,face,0.5,(v0+v1)/2).normal});
    }
  }return mesh;
}
function validateSurfaceMesh(S,mesh,steps=96) {
  if(!Array.isArray(mesh))throw Error('surface mesh required');
  for(const facet of mesh){
    if(!Array.isArray(facet.points)||facet.points.length<3||!Array.isArray(facet.normal))throw Error('invalid surface facet');
    const a=sub(facet.points[1],facet.points[0]),b=sub(facet.points[2],facet.points[0]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    if(!(dot(cross,facet.normal)>0))throw Error('surface winding disagrees with outward normal');
  }
  const expected=surfaceMesh(S,steps);
  if(JSON.stringify(mesh)!==JSON.stringify(expected))throw Error('surface omission or altered mesh');
  return true;
}
// Orthographic BSP of planar facets. Split overlapping facets before painter traversal;
// centroid sorting alone is not valid for a concave bore. Tolerance is rendering-only.
function painterOrder(polygons,view) {
  const eps=1e-10;
  function build(polys){
    if(!polys.length)return null;
    const pivot=polys[0],n=pivot.normal,w=dot(n,pivot.points[0]),front=[],back=[],same=[];
    for(const p of polys){
      const ds=p.points.map(q=>dot(n,q)-w),pos=ds.some(d=>d>eps),neg=ds.some(d=>d<-eps);
      if(!pos&&!neg){same.push(p);continue;}
      if(!neg){front.push(p);continue;}if(!pos){back.push(p);continue;}
      const fs=[],bs=[];
      for(let i=0;i<p.points.length;i++){
        const j=(i+1)%p.points.length,a=p.points[i],b=p.points[j],da=ds[i],db=ds[j];
        if(da>=-eps)fs.push(a);if(da<=eps)bs.push(a);
        if((da>eps&&db<-eps)||(da<-eps&&db>eps)){const t=da/(da-db),q=add(a,mul(sub(b,a),t));fs.push(q);bs.push(q);}
      }
      if(fs.length>=3)front.push({...p,points:fs});if(bs.length>=3)back.push({...p,points:bs});
    }
    return {n,same,front:build(front),back:build(back)};
  }
  const result=[];
  function visit(node){if(!node)return;const near=dot(node.n,view)>=0;visit(near?node.back:node.front);result.push(...node.same);visit(near?node.front:node.back);}
  visit(build(polygons));return result;
}

return { "FACE_IDS": FACE_IDS, "validateFrame": validateFrame, "annularSector": annularSector, "validateSector": validateSector, "radial": radial, "point": point, "contains": contains, "signedDistance": signedDistance, "bounds": bounds, "surfaceAt": surfaceAt, "faceAreas": faceAreas, "surfaceSamples": surfaceSamples, "raycast": raycast, "journalContact": journalContact, "verifyContactNormal": verifyContactNormal, "uniformPressureForUnitZ": uniformPressureForUnitZ, "surfaceMesh": surfaceMesh, "validateSurfaceMesh": validateSurfaceMesh, "painterOrder": painterOrder };
})());
Object.assign(kit, (function (window) {
'use strict';
const T3_ROOT = Math.sqrt(1.6);
const T3_TAU = Math.PI * 2;
const T3_RAD = Math.PI / 180;
const T3_LB = [0, 0.2, 0.42, 0.62];
const T3_EB = [0.25, 0.5, 0.75];
const T3_SOFT = 0.035;
const T3_LEVELS = 32;
const T3_Q = 64;
const t3State = { detail: 1, exact: false };

function t3Num(v) {
  if (t3State.exact) return String(Math.round(v * 1e6) / 1e6);
  let t = Math.round(v * 100);
  if (t === 0) return "0";
  let sign = "";
  if (t < 0) {
    sign = "-";
    t = -t;
  }
  const whole = Math.floor(t / 100);
  const part = t - whole * 100;
  if (part === 0) return sign + whole;
  if (part < 10) return sign + whole + ".0" + part;
  return sign + whole + "." + (part % 10 === 0 ? part / 10 : part);
}

function t3Fix(v, scale) {
  const t = Math.round(v * scale) / scale;
  return t === 0 ? "0" : String(t);
}

function t3Path(buf, count, closed) {
  if (count < 2) return "";
  let s = "M" + t3Num(buf[0]) + " " + t3Num(buf[1]);
  for (let i = 1; i < count; i++) s += "L" + t3Num(buf[2 * i]) + " " + t3Num(buf[2 * i + 1]);
  return closed ? s + "Z" : s;
}

const t3Step = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function t3Level(score, bands) {
  let u = 0;
  for (let i = 0; i < bands.length; i++) u += t3Step(bands[i] - T3_SOFT, bands[i] + T3_SOFT, score);
  return Math.round(u * T3_Q);
}

function t3Grow(f, name, size, Kind) {
  if (!f[name] || f[name].length < size) f[name] = new Kind(Math.max(size, f[name] ? f[name].length * 2 : 16));
  return f[name];
}

function t3Box(buf, count, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = buf[2 * i];
    const y = buf[2 * i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  box[0] = x0;
  box[1] = y0;
  box[2] = x1;
  box[3] = y1;
}

function t3Unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function t3Rot(axis, degrees) {
  const [x, y, z] = t3Unit(axis);
  const c = Math.cos(degrees * T3_RAD);
  const s = Math.sin(degrees * T3_RAD);
  const C = 1 - c;
  return new Float64Array([c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]);
}

function t3Mul(A, B) {
  const out = new Float64Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return out;
}

const t3Apply = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

const T3_EYE = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function t3Camera(P, pose) {
  const a = (P.azimuth ?? 45) * T3_RAD;
  const e = (P.elevation ?? 30) * T3_RAD;
  const k = P.scale * T3_ROOT;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const se = Math.sin(e);
  const ce = Math.cos(e);
  const cam = { m: new Float64Array(6), ox: 0, oy: 0, V: [0, 0, 0], L: [0, 0, 0], k, turn: 0, R: T3_EYE, t: [0, 0, 0], lx: 0, ly: 1, sa, ca, se, ce, origin: P.origin };
  const lw = Math.hypot(sa, ca, 1.2);
  if (pose && pose.R && !(pose.turn !== undefined && pose.root)) {
    const R = pose.R;
    const t = pose.t ?? [0, 0, 0];
    const r0 = [sa * k, -ca * k, 0];
    const r1 = [ca * se * k, sa * se * k, -ce * k];
    for (let c = 0; c < 3; c++) {
      cam.m[c] = r0[0] * R[c] + r0[1] * R[3 + c] + r0[2] * R[6 + c];
      cam.m[3 + c] = r1[0] * R[c] + r1[1] * R[3 + c] + r1[2] * R[6 + c];
    }
    cam.ox = P.origin[0] + r0[0] * t[0] + r0[1] * t[1] + r0[2] * t[2];
    cam.oy = P.origin[1] + r1[0] * t[0] + r1[1] * t[1] + r1[2] * t[2];
    const V = [ca * ce, sa * ce, se];
    const L = [-sa / lw, ca / lw, 1.2 / lw];
    for (let c = 0; c < 3; c++) {
      cam.V[c] = R[c] * V[0] + R[3 + c] * V[1] + R[6 + c] * V[2];
      cam.L[c] = R[c] * L[0] + R[3 + c] * L[1] + R[6 + c] * L[2];
    }
    cam.R = R;
    cam.t = t;
  } else {
    const turn = pose ? pose.turn ?? 0 : 0;
    const pivot = pose && pose.pivot ? pose.pivot : [0, 0];
    const b = a - turn * T3_RAD;
    const sb = Math.sin(b);
    const cb = Math.cos(b);
    cam.m[0] = sb * k;
    cam.m[1] = -cb * k;
    cam.m[2] = 0;
    cam.m[3] = cb * se * k;
    cam.m[4] = sb * se * k;
    cam.m[5] = -ce * k;
    cam.ox = P.origin[0] + (pivot[0] * sa - pivot[1] * ca) * k;
    cam.oy = P.origin[1] + (pivot[0] * ca + pivot[1] * sa) * se * k;
    cam.V = [cb * ce, sb * ce, se];
    cam.L = [-sb / lw, cb / lw, 1.2 / lw];
    cam.turn = turn;
    const c = Math.cos(turn * T3_RAD);
    const s = Math.sin(turn * T3_RAD);
    cam.R = new Float64Array([c, -s, 0, s, c, 0, 0, 0, 1]);
    cam.t = [pivot[0], pivot[1], 0];
  }
  const lh = Math.hypot(cam.L[0], cam.L[1]) || 1;
  cam.lx = cam.L[0] / lh;
  cam.ly = cam.L[1] / lh;
  return cam;
}

function t3Quat(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const x = q[0] / l;
  const y = q[1] / l;
  const z = q[2] / l;
  const w = q[3] / l;
  return new Float64Array([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]);
}

function t3FreeRot(v) {
  if (v.R) return v.R instanceof Float64Array ? v.R : Float64Array.from(v.R);
  if (v.q) return t3Quat(v.q);
  if (v.axis) return t3Rot(v.axis, v.angle ?? 0);
  return T3_EYE;
}

function t3Poses(groups, values) {
  const get = (name) => (values instanceof Map ? values.get(name) : values ? values[name] : undefined) ?? 0;
  const list = [];
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index];
    const v = get(g.name);
    let parent = g.parent === undefined || g.parent === null || g.parent < 0 ? null : list[g.parent];
    let po = parent ? groups[g.parent].origin : [0, 0, 0];
    let R = T3_EYE;
    let t = [g.origin[0] - po[0], g.origin[1] - po[1], g.origin[2] - po[2]];
    if (g.kind === "turn") R = t3Rot([0, 0, 1], v);
    else if (g.kind === "hinge") R = t3Rot(g.axis, v);
    else if (g.kind === "slide") {
      const d = t3Unit(g.direction);
      t[0] += d[0] * v;
      t[1] += d[1] * v;
      t[2] += d[2] * v;
    } else if (g.kind === "free" && v && typeof v === "object") {
      R = t3FreeRot(v);
      if (v.world) {
        parent = null;
        po = [0, 0, 0];
        t = [g.origin[0], g.origin[1], g.origin[2]];
      }
      if (v.t) {
        t[0] += v.t[0];
        t[1] += v.t[1];
        t[2] += v.t[2];
      }
    }
    if (!parent) {
      const pose = { R, t, value: v };
      if (g.kind === "turn") Object.assign(pose, { turn: v, pivot: [g.origin[0], g.origin[1]], root: true });
      list.push(pose);
      continue;
    }
    const tw = t3Apply(parent.R, t);
    list.push({ R: t3Mul(parent.R, R), t: [tw[0] + parent.t[0], tw[1] + parent.t[1], tw[2] + parent.t[2]], value: v });
  }
  return list;
}

function t3PosesMap(groups, values) {
  const list = t3Poses(groups, values);
  return new Map(groups.map((g, index) => [g.name, list[index]]));
}

function t3Roles(part) {
  const roles = [];
  const spec = part.spec;
  const details = part.details ?? {};
  const add = (name, type, extra = {}) => roles.push({ name, type, ...extra });
  const tone = part.tone ?? "hi";
  const crease = part.crease ?? "faint";
  const fadedSlots = (prefix, count, cls, lineTone) => {
    for (let j = 0; j < count; j++) add(`${prefix}${j}`, "slot", { cls, tone: lineTone });
  };
  const planes = () => (part.planes ?? []).forEach((_, j) => add(`plane${j}`, "plane"));
  const dots = () => (part.dots ?? []).forEach((dot, j) => add(`c${j}`, "dot", { tone: dot.tone ?? "mid", size: dot.size ?? 0.5 }));
  const sheets = (top) => {
    for (let t = 0; t < 4; t++) add(`s${t}`, "path", { cls: "iso-shade", shade: t });
    if (top) add("s4", "path", { cls: "iso-top" });
  };
  const inner = () => {
    if ((details.seams && details.seams.length) || (details.ribs && details.ribs.seams)) add("inner", "path", { cls: "iso-line", tone: "faint" });
  };
  const ribs = () => {
    if (details.ribs) fadedSlots("r", spec.slots?.ribs ?? 6, "iso-line", details.ribs.tone ?? "lo");
  };
  if (part.kind === "prism") {
    add("fill", "path", { cls: "iso-fill" });
    const faces = spec.ring.length / 2 + (spec.up ? 0 : 2);
    for (let j = 0; j < faces; j++) add(`f${j}`, "face");
    if (spec.up) add("top", "xform", { cls: "iso-top" });
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    if (spec.bevel && crease !== "none") fadedSlots("v", spec.slots?.bevel ?? 6, "iso-line iso-bevel", crease);
    if (details.seams && details.seams.length) add("inner", "path", { cls: "iso-line", tone: "faint" });
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "round" || part.kind === "lathe") {
    add("fill", "path", { cls: "iso-fill" });
    sheets(true);
    const ends = part.kind === "round" ? spec.ends : spec.caps.map((cap) => (cap ? "flat" : "open"));
    ends.forEach((end, j) => end === "flat" && add(`k${j}`, "face"));
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    inner();
    ribs();
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "ball") {
    add("fill", "path", { cls: "iso-fill" });
    sheets(false);
    spec.flats.forEach((_, j) => add(`f${j}`, "face"));
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "tube") {
    add("body", "path", { cls: "tb-body" });
    if (spec.wide) {
      add("shine", "path", { cls: "tb-shine" });
      add("shade", "path", { cls: "tb-shade" });
    }
    if (spec.rings) fadedSlots("r", spec.slots?.ribs ?? 6, "tb-ring", spec.rings.tone ?? "lo");
    add("edges", "path", { cls: "iso-line tb-edge", tone });
  } else if (part.kind === "fixed") {
    add("move", "self");
    ribs();
    planes();
    dots();
  }
  return roles;
}

function t3Planes(list) {
  return (list ?? []).map((plane) => ({ o: plane.o, u: plane.u, v: plane.v, n: plane.n, fade: plane.fade ?? [0.04, 0.3], billboard: Boolean(plane.billboard) }));
}

function t3Dots(list) {
  return (list ?? []).map((dot) => ({ p: dot.p, n: dot.n ?? null, size: dot.size ?? 0.5, fade: dot.fade ?? [0.04, 0.42] }));
}

function t3PreparePrism(run, part) {
  const spec = part.spec;
  const n = spec.ring.length / 2;
  run.n = n;
  run.up = Boolean(spec.up);
  const ring = Float64Array.from(spec.ring);
  run.ring = ring;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = ring[2 * j] - ring[2 * i];
    const dy = ring[2 * j + 1] - ring[2 * i + 1];
    const l = Math.hypot(dx, dy) || 1;
    nx[i] = dy / l;
    ny[i] = -dx / l;
  }
  run.nx = nx;
  run.ny = ny;
  const F = spec.up ? { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] } : spec.F;
  run.F = F;
  run.s0 = spec.up ? spec.z0 : spec.s0;
  run.s1 = spec.up ? spec.z1 : spec.s1;
  const lo = new Float64Array(3 * n);
  const hi = new Float64Array(3 * n);
  const N3 = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) {
    const x = ring[2 * i];
    const y = ring[2 * i + 1];
    for (let c = 0; c < 3; c++) {
      const base = F.o[c] + F.u[c] * x + F.v[c] * y;
      lo[3 * i + c] = base + F.a[c] * run.s0;
      hi[3 * i + c] = base + F.a[c] * run.s1;
      N3[3 * i + c] = F.u[c] * nx[i] + F.v[c] * ny[i];
    }
  }
  run.lo = lo;
  run.hi = hi;
  run.N3 = N3;
  run.sharp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n;
    run.sharp[i] = nx[p] * nx[i] + ny[p] * ny[i] < Math.cos(0.35) ? 1 : 0;
  }
  if (spec.bevel) {
    const inset = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const mx = nx[p] + nx[i];
      const my = ny[p] + ny[i];
      const l = Math.hypot(mx, my) || 1;
      inset[2 * i] = ring[2 * i] - (mx / l) * spec.bevel;
      inset[2 * i + 1] = ring[2 * i + 1] - (my / l) * spec.bevel;
    }
    run.inset = inset;
  }
  run.seams = part.details && part.details.seams ? part.details.seams.slice() : null;
  run.cut = spec.cuts && spec.cuts.length ? spec.cuts : null;
}

function t3Axes(run, part) {
  if (run.kind === "ball") return run.flats.map((flat) => flat.n);
  if (run.kind === "tube") return run.tips.slice();
  if (run.kind === "prism") {
    const out = [run.F.a];
    for (let i = 0; i < run.n; i++) {
      const n = [run.N3[3 * i], run.N3[3 * i + 1], run.N3[3 * i + 2]];
      if (out.every((m) => Math.abs(m[0] * n[0] + m[1] * n[1] + m[2] * n[2]) < 0.9995)) out.push(n);
    }
    return out;
  }
  if (run.F) return [run.F.a];
  if (part.spec && part.spec.F) return [part.spec.F.a];
  return [];
}

function t3Cloud(run, part) {
  const out = [];
  const ring = (F, s, r, count) => {
    for (let j = 0; j < count; j++) {
      const c = Math.cos((j / count) * T3_TAU);
      const n = Math.sin((j / count) * T3_TAU);
      out.push(F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]), F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]), F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]));
    }
  };
  if (run.kind === "prism") {
    for (let i = 0; i < 3 * run.n; i++) out.push(run.lo[i]);
    for (let i = 0; i < 3 * run.n; i++) out.push(run.hi[i]);
  } else if (run.kind === "round") {
    ring(run.F, run.s0, run.r0, 24);
    ring(run.F, run.s1, run.r1, 24);
    for (const [end, s, r] of [[0, run.s0, run.r0], [1, run.s1, run.r1]]) {
      if (run.ends[end] !== "dome") continue;
      const sign = end ? 1 : -1;
      for (const b of [0.5, 1.0, 1.35]) ring(run.F, s + sign * r * Math.sin(b), r * Math.cos(b), 6);
      out.push(run.F.o[0] + run.F.a[0] * (s + sign * r), run.F.o[1] + run.F.a[1] * (s + sign * r), run.F.o[2] + run.F.a[2] * (s + sign * r));
    }
  } else if (run.kind === "ball") {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 64; i++) {
      const y = 1 - (2 * (i + 0.5)) / 64;
      const rad = Math.sqrt(1 - y * y);
      const w = [Math.cos(golden * i) * rad, Math.sin(golden * i) * rad, y];
      const p = [run.c[0] + run.r * w[0], run.c[1] + run.r * w[1], run.c[2] + run.r * w[2]];
      let inside = true;
      for (const flat of run.flats) if ((p[0] - run.c[0]) * flat.n[0] + (p[1] - run.c[1]) * flat.n[1] + (p[2] - run.c[2]) * flat.n[2] > flat.d + 1e-9) inside = false;
      if (inside) out.push(p[0], p[1], p[2]);
    }
    for (const flat of run.flats)
      for (let j = 0; j < 12; j++) {
        const c = Math.cos((j / 12) * T3_TAU) * flat.rho;
        const n = Math.sin((j / 12) * T3_TAU) * flat.rho;
        out.push(run.c[0] + flat.n[0] * flat.d + c * flat.u[0] + n * flat.v[0], run.c[1] + flat.n[1] * flat.d + c * flat.u[1] + n * flat.v[1], run.c[2] + flat.n[2] * flat.d + c * flat.u[2] + n * flat.v[2]);
      }
  } else if (run.kind === "lathe") {
    const lv = run.levels;
    const step = Math.max(4, Math.floor(lv.length / 4 / 8)) * 4;
    for (let i = 0; i < lv.length; i += step) ring(run.F, lv[i], lv[i + 1], 8);
    ring(run.F, lv[lv.length - 4], lv[lv.length - 3], 8);
  } else if (run.kind === "tube") {
    const b = run.body;
    const stride = Math.max(1, Math.floor(b.count / 8));
    for (let i = 0; i < b.count; i += stride) {
      const T = t3Unit([b.D3[3 * i], b.D3[3 * i + 1], b.D3[3 * i + 2]]);
      const [u, v] = t3Basis(T);
      ring({ o: [b.P3[3 * i], b.P3[3 * i + 1], b.P3[3 * i + 2]], a: T, u, v }, 0, run.r, 8);
    }
  } else if (part.cloud) for (const v of part.cloud) out.push(v);
  return Float64Array.from(out);
}

function t3Unpack(value, grouped) {
  if (!value) return new Float64Array(0);
  if (typeof value !== "string") return Float64Array.from(value);
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const size = grouped ? 10 : 8;
  const stride = grouped ? 6 : 5;
  const count = bytes.length / size;
  const out = new Float64Array(count * stride);
  for (let e = 0; e < count; e++) {
    let o = e * size;
    const at = e * stride;
    out[at] = view.getUint16(o);
    out[at + 1] = view.getUint16(o + 2);
    o += 4;
    if (grouped) {
      out[at + 2] = view.getUint16(o) - 1;
      o += 2;
    }
    let x = (view.getUint16(o) / 65535) * 2 - 1;
    let y = (view.getUint16(o + 2) / 65535) * 2 - 1;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
      const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
      const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
      x = ox;
      y = oy;
    }
    const l = Math.hypot(x, y, z) || 1;
    out[at + stride - 3] = x / l;
    out[at + stride - 2] = y / l;
    out[at + stride - 1] = z / l;
  }
  return out;
}

function t3Prepare(data, { unit = 1 } = {}) {
  const P = data.P;
  const runs = data.parts.map((part, index) => {
    const run = { index, name: part.name, kind: part.kind, group: part.group ?? -1, layer: part.layer, part, roles: t3Roles(part), planes: t3Planes(part.planes), dots: t3Dots(part.dots), unit };
    run.role = Object.fromEntries(run.roles.map((role, j) => [role.name, j]));
    if (part.kind === "prism") t3PreparePrism(run, part);
    else if (part.kind === "round") t3PrepareRound(run, part, P, unit);
    else if (part.kind === "ball") t3PrepareBall(run, part, P, unit);
    else if (part.kind === "lathe") t3PrepareLathe(run, part, P, unit);
    else if (part.kind === "tube") t3PrepareTube(run, part, data);
    else if (part.kind === "fixed") {
      run.anchor = part.spec.anchor;
      run.home = part.spec.home;
      run.box0 = part.spec.box;
      run.hull0 = Float64Array.from(part.spec.hull);
      run.F = part.spec.F ?? null;
      run.ribs = part.details && part.details.ribs ? part.details.ribs : null;
    }
    run.slots = part.spec.slots ?? {};
    run.cloud = t3Cloud(run, part);
    run.axes = t3Axes(run, part);
    const cn = run.cloud.length / 3;
    run.centroid = [0, 0, 0];
    for (let i = 0; i < cn; i++) for (let c = 0; c < 3; c++) run.centroid[c] += run.cloud[3 * i + c] / Math.max(1, cn);
    return run;
  });
  const layers = data.layers.map((layer, index) => {
    const parts = Int32Array.from(layer.parts);
    const local = new Map();
    parts.forEach((global, at) => local.set(global, at));
    const planar = t3Unpack(data.planes && data.planes[layer.name], false);
    const dynamic = Int32Array.from((data.dynamic && data.dynamic[layer.name]) ?? []);
    const free = Int32Array.from((data.free && data.free[layer.name]) ?? []);
    const framed = t3Unpack(data.framed && data.framed[layer.name], true);
    const groupPairs = [];
    const raw = (data.groupPairs && data.groupPairs[layer.name]) ?? [];
    const members = new Map();
    for (const global of parts) {
      const g = runs[global].group;
      if (!members.has(g)) members.set(g, []);
      members.get(g).push(global);
    }
    for (let p = 0; p < raw.length; p += 6) groupPairs.push({ a: Int32Array.from(members.get(raw[p]) ?? []), b: Int32Array.from(members.get(raw[p + 1]) ?? []), frame: raw[p + 2], n: [raw[p + 3], raw[p + 4], raw[p + 5]], boxA: new Float64Array(4), boxB: new Float64Array(4) });
    const looseAt = new Uint8Array(parts.length);
    for (const global of free) looseAt[local.get(global)] = 1;
    return { index, name: layer.name, parts, local, rest: Int32Array.from(layer.rest ?? layer.parts), planar, framed, groupPairs, dynamic, free, looseAt, warm: new Map() };
  });
  return { P, data, unit, groups: data.groups, runs, layers };
}

function t3Frame(run) {
  const count = run.roles.length;
  return { d: new Array(count).fill(""), q: new Int32Array(count), w: new Float64Array(count).fill(-1), t: new Array(count).fill(""), o: new Float64Array(count).fill(1), box: new Float64Array(4), hull: new Float64Array(64), hullN: 0, cx: new Float64Array(count), cy: new Float64Array(count), quads: null, quadN: 0 };
}

const t3Buf = { a: new Float64Array(1024), b: new Float64Array(1024), c: new Float64Array(1024) };

function t3Scratch(name, size) {
  if (t3Buf[name].length < size) t3Buf[name] = new Float64Array(size * 2);
  return t3Buf[name];
}

function t3SetHull(f, buf, count) {
  const hull = t3Grow(f, "hull", 2 * count, Float64Array);
  for (let i = 0; i < 2 * count; i++) hull[i] = buf[i];
  f.hullN = count;
}

function t3Faded(f, run, prefix, lines, count) {
  if (!f.fade) f.fade = {};
  const detail = t3State.detail;
  if (detail < 1) for (let i = 0; i < count; i++) lines.alpha[i] *= detail;
  if (detail < 0.01) count = 0;
  f.fade[prefix] = { key: lines.key.slice(0, count), alpha: lines.alpha.slice(0, count) };
  const slots = run.slots[prefix === "v" ? "bevel" : "ribs"] ?? 6;
  const levels = run._levels ?? (run._levels = new Array(T3_LEVELS + 1));
  for (let l = 0; l <= T3_LEVELS; l++) levels[l] = "";
  for (let i = 0; i < count; i++) {
    const alpha = lines.alpha[i];
    const level = Math.min(T3_LEVELS, Math.round(alpha * T3_LEVELS));
    if (level <= 0) continue;
    levels[level] += lines.d[i];
  }
  const present = [];
  for (let l = T3_LEVELS; l >= 1; l--) if (levels[l]) present.push([l, levels[l]]);
  while (present.length > slots) {
    let best = 1;
    let gap = Infinity;
    for (let i = 1; i < present.length; i++) {
      const g = present[i - 1][0] - present[i][0];
      if (g < gap) {
        gap = g;
        best = i;
      }
    }
    const [a, da] = present[best - 1];
    const [b, db] = present[best];
    present.splice(best - 1, 2, [(a + b) / 2, da + db]);
  }
  for (let j = 0; j < slots; j++) {
    const role = run.role[`${prefix}${j}`];
    if (role === undefined) continue;
    if (j < present.length) {
      f.d[role] = present[j][1];
      f.o[role] = present[j][0] / T3_LEVELS;
    } else {
      f.d[role] = "";
      f.o[role] = 0;
    }
  }
  return present.length;
}

const t3Lines = { d: [], alpha: [], key: [] };
const t3None = { d: [], alpha: [], key: [] };

function t3EmitPrism(run, cam, f) {
  const n = run.n;
  const m = cam.m;
  const ox = cam.ox;
  const oy = cam.oy;
  const V = cam.V;
  const L = cam.L;
  const lo = run.lo;
  const hi = run.hi;
  const N3 = run.N3;
  const bot = t3Scratch("a", 2 * n);
  const top = t3Scratch("b", 2 * n);
  for (let i = 0; i < n; i++) {
    const a = 3 * i;
    bot[2 * i] = ox + m[0] * lo[a] + m[1] * lo[a + 1] + m[2] * lo[a + 2];
    bot[2 * i + 1] = oy + m[3] * lo[a] + m[4] * lo[a + 1] + m[5] * lo[a + 2];
    top[2 * i] = ox + m[0] * hi[a] + m[1] * hi[a + 1] + m[2] * hi[a + 2];
    top[2 * i + 1] = oy + m[3] * hi[a] + m[4] * hi[a + 1] + m[5] * hi[a + 2];
  }
  const F = run.F;
  const aV = F.a[0] * V[0] + F.a[1] * V[1] + F.a[2] * V[2];
  const near = aV >= 0 ? top : bot;
  const far = aV >= 0 ? bot : top;
  const facing = run._facing ?? (run._facing = new Float64Array(n));
  for (let i = 0; i < n; i++) facing[i] = N3[3 * i] * V[0] + N3[3 * i + 1] * V[1] + N3[3 * i + 2] * V[2];
  const on = (i) => facing[((i % n) + n) % n] > 1e-9;
  let i0 = -1;
  for (let i = 0; i < n; i++)
    if (on(i) && !on(i - 1)) {
      i0 = i;
      break;
    }
  const sil = t3Scratch("c", 4 * n + 8);
  const silAt = run._silAt ?? (run._silAt = new Int32Array(2 * n + 4));
  let count = 0;
  let i1 = i0;
  const nearSet = aV >= 0 ? hi : lo;
  const farSet = aV >= 0 ? lo : hi;
  if (i0 < 0) {
    for (let i = 0; i < n; i++) {
      sil[2 * count] = near[2 * i];
      sil[2 * count + 1] = near[2 * i + 1];
      silAt[count] = i;
      count++;
    }
  } else {
    while (on(i1)) i1++;
    for (let j = i0; j <= i1; j++) {
      const i = j % n;
      sil[2 * count] = far[2 * i];
      sil[2 * count + 1] = far[2 * i + 1];
      silAt[count] = -1 - i;
      count++;
    }
    for (let j = i1; j <= i0 + n; j++) {
      const i = j % n;
      sil[2 * count] = near[2 * i];
      sil[2 * count + 1] = near[2 * i + 1];
      silAt[count] = i;
      count++;
    }
    if (count > 2 && Math.abs(sil[0] - sil[2 * count - 2]) < 1e-9 && Math.abs(sil[1] - sil[2 * count - 1]) < 1e-9) count--;
  }
  const outline = t3Path(sil, count, true);
  f.d[run.role.fill] = outline;
  if (run.cut) {
    const inPlane = (index) => {
      const at = silAt[index];
      const set = at < 0 ? farSet : nearSet;
      const v = at < 0 ? -1 - at : at;
      return run.cut.some((cut) => Math.abs(cut.n[0] * set[3 * v] + cut.n[1] * set[3 * v + 1] + cut.n[2] * set[3 * v + 2] - cut.d) < 1e-3);
    };
    const flags = new Uint8Array(count);
    const onSame = (i, j) => {
      const at = (index) => {
        const a = silAt[index];
        const set = a < 0 ? farSet : nearSet;
        const v = a < 0 ? -1 - a : a;
        return [set[3 * v], set[3 * v + 1], set[3 * v + 2]];
      };
      const p = at(i);
      const q = at(j);
      return run.cut.some((cut) => Math.abs(cut.n[0] * p[0] + cut.n[1] * p[1] + cut.n[2] * p[2] - cut.d) < 1e-3 && Math.abs(cut.n[0] * q[0] + cut.n[1] * q[1] + cut.n[2] * q[2] - cut.d) < 1e-3);
    };
    for (let j = 0; j < count; j++) flags[j] = inPlane(j) && onSame(j, (j + 1) % count) ? 1 : 0;
    f.d[run.role.edge] = t3Broken(sil, count, flags);
  } else f.d[run.role.edge] = outline;
  t3Box(sil, count, f.box);
  t3SetHull(f, sil, count);
  const quad = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    const role = run.role[`f${i}`];
    if (!(facing[i] > 1e-6)) {
      f.d[role] = "";
      continue;
    }
    const j = (i + 1) % n;
    quad[0] = top[2 * i];
    quad[1] = top[2 * i + 1];
    quad[2] = top[2 * j];
    quad[3] = top[2 * j + 1];
    quad[4] = bot[2 * j];
    quad[5] = bot[2 * j + 1];
    quad[6] = bot[2 * i];
    quad[7] = bot[2 * i + 1];
    f.d[role] = t3Path(quad, 4, true);
    let score;
    if (run.up) {
      score = (run.nx[i] * cam.lx + run.ny[i] * cam.ly + 1) / 2;
      f.q[role] = t3Level(score, T3_EB);
    } else {
      score = N3[3 * i] * L[0] + N3[3 * i + 1] * L[1] + N3[3 * i + 2] * L[2];
      f.q[role] = t3Level(score, T3_LB);
    }
    const e1 = Math.hypot(quad[2] - quad[0], quad[3] - quad[1]);
    const e2 = Math.hypot(quad[6] - quad[0], quad[7] - quad[1]);
    const area = Math.abs((quad[2] - quad[0]) * (quad[7] - quad[1]) - (quad[3] - quad[1]) * (quad[6] - quad[0]));
    const wide = area / (Math.max(e1, e2) || 1);
    f.w[role] = wide < 0.4 ? Math.round(wide * 100) / 100 : -1;
  }
  if (run.up) {
    const z = run.s1;
    f.t[run.role.top] = `matrix(${t3Fix(m[0], 1e5)} ${t3Fix(m[3], 1e5)} ${t3Fix(m[1], 1e5)} ${t3Fix(m[4], 1e5)} ${t3Fix(ox + m[2] * z, 100)} ${t3Fix(oy + m[5] * z, 100)})`;
  } else {
    for (let side = 0; side < 2; side++) {
      const role = run.role[`f${n + side}`];
      const sign = side ? 1 : -1;
      const face = sign * aV;
      if (!(face > 1e-6)) {
        f.d[role] = "";
        continue;
      }
      const ring = side ? top : bot;
      f.d[role] = t3Path(ring, n, true);
      f.q[role] = t3Level(sign * (F.a[0] * L[0] + F.a[1] * L[1] + F.a[2] * L[2]), T3_LB);
      let minor = Infinity;
      let x0 = Infinity;
      let x1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ex = ring[2 * j] - ring[2 * i];
        const ey = ring[2 * j + 1] - ring[2 * i + 1];
        const l = Math.hypot(ex, ey);
        if (l < 1e-9) continue;
        let lo2 = Infinity;
        let hi2 = -Infinity;
        for (let q = 0; q < n; q++) {
          const v = ((ring[2 * q] - ring[2 * i]) * ey - (ring[2 * q + 1] - ring[2 * i + 1]) * ex) / l;
          if (v < lo2) lo2 = v;
          if (v > hi2) hi2 = v;
        }
        minor = Math.min(minor, hi2 - lo2);
        x0 = Math.min(x0, lo2);
        x1 = Math.max(x1, hi2);
      }
      f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    }
  }
  if (run.role.crease !== undefined) {
    let crease = "";
    if (run.up) {
      if (i0 >= 0) {
        const buf = t3Scratch("a", 0);
        let c = 0;
        const rim = t3Scratch("c", 2 * n + 4);
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          rim[2 * c] = top[2 * i];
          rim[2 * c + 1] = top[2 * i + 1];
          c++;
        }
        crease = t3Path(rim, c, false);
        void buf;
      }
    } else {
      const capOn = [-aV > 1e-6, aV > 1e-6];
      const seg = new Float64Array(4);
      for (let i = 0; i < n; i++) {
        const p = (i - 1 + n) % n;
        if (run.sharp[i] && facing[i] > 1e-6 && facing[p] > 1e-6) {
          seg[0] = bot[2 * i];
          seg[1] = bot[2 * i + 1];
          seg[2] = top[2 * i];
          seg[3] = top[2 * i + 1];
          crease += t3Path(seg, 2, false);
        }
      }
      for (let side = 0; side < 2; side++) {
        if (!capOn[side] || i0 < 0) continue;
        const ring = side ? top : bot;
        const rim = t3Scratch("c", 2 * n + 4);
        let c = 0;
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          rim[2 * c] = ring[2 * i];
          rim[2 * c + 1] = ring[2 * i + 1];
          c++;
        }
        crease += t3Path(rim, c, false);
      }
    }
    f.d[run.role.crease] = crease;
  }
  if (run.inset && run.role.v0 !== undefined && t3State.detail < 0.01) f.levels = t3Faded(f, run, "v", t3None, 0);
  else if (run.inset && run.role.v0 !== undefined) {
    const lines = t3Lines;
    lines.d.length = 0;
    lines.alpha.length = 0;
  lines.key.length = 0;
    lines.key.length = 0;
    const capSide = aV >= 0 ? 1 : 0;
    const s = capSide ? run.s1 : run.s0;
    const capAlpha = run.up ? 1 : t3Step(0.02, 0.2, Math.abs(aV));
    const ins = t3Scratch("c", 2 * n);
    for (let i = 0; i < n; i++) {
      const x = run.inset[2 * i];
      const y = run.inset[2 * i + 1];
      const px = F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y;
      const py = F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y;
      const pz = F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y;
      ins[2 * i] = ox + m[0] * px + m[1] * py + m[2] * pz;
      ins[2 * i + 1] = oy + m[3] * px + m[4] * py + m[5] * pz;
    }
    const rim = capSide ? top : bot;
    const seg = new Float64Array(4);
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const ai = capAlpha * t3Step(0, 0.14, facing[i]);
      const ap = capAlpha * t3Step(0, 0.14, facing[p]);
      if (ai > 0.01) {
        const j = (i + 1) % n;
        seg[0] = ins[2 * i];
        seg[1] = ins[2 * i + 1];
        seg[2] = ins[2 * j];
        seg[3] = ins[2 * j + 1];
        lines.d.push(t3Path(seg, 2, false));
        lines.alpha.push(ai);
        lines.key.push(2 * i);
      }
      const corner = ai * (1 - ap) + ap * (1 - ai);
      if (corner > 0.01) {
        seg[0] = ins[2 * i];
        seg[1] = ins[2 * i + 1];
        seg[2] = rim[2 * i];
        seg[3] = rim[2 * i + 1];
        lines.d.push(t3Path(seg, 2, false));
        lines.alpha.push(corner);
        lines.key.push(2 * i + 1);
      }
    }
    f.levels = t3Faded(f, run, "v", lines, lines.d.length);
  }
  if (run.seams && run.role.inner !== undefined) {
    let inner = "";
    if (i0 >= 0) {
      const rim = t3Scratch("c", 2 * n + 4);
      for (const s of run.seams) {
        let c = 0;
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          const x = run.ring[2 * i];
          const y = run.ring[2 * i + 1];
          const px = F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y;
          const py = F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y;
          const pz = F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y;
          rim[2 * c] = ox + m[0] * px + m[1] * py + m[2] * pz;
          rim[2 * c + 1] = oy + m[3] * px + m[4] * py + m[5] * pz;
          c++;
        }
        inner += t3Path(rim, c, false);
      }
    }
    f.d[run.role.inner] = inner;
  }
}

function t3Broken(buf, count, skip) {
  let start = -1;
  for (let j = 0; j < count; j++)
    if (skip[(j - 1 + count) % count] && !skip[j]) {
      start = j;
      break;
    }
  if (start < 0) return skip[0] ? "" : t3Path(buf, count, true);
  let out = "";
  let run = [];
  for (let step = 0; step < count; step++) {
    const j = (start + step) % count;
    if (skip[j]) {
      if (run.length) {
        run.push((j + 0) % count);
        out += t3PathOf(run.map((i) => [buf[2 * i], buf[2 * i + 1]]), false);
        run = [];
      }
      continue;
    }
    run.push(j);
  }
  if (run.length) {
    run.push((start + count) % count);
    out += t3PathOf(run.map((i) => [buf[2 * i], buf[2 * i + 1]]), false);
  }
  return out;
}

function t3EmitPlanes(run, cam, f, sx = 0, sy = 0) {
  const m = cam.m;
  const V = cam.V;
  for (let j = 0; j < run.planes.length; j++) {
    const plane = run.planes[j];
    const role = run.role[`plane${j}`];
    const o = plane.o;
    const X = cam.ox - sx + m[0] * o[0] + m[1] * o[1] + m[2] * o[2];
    const Y = cam.oy - sy + m[3] * o[0] + m[4] * o[1] + m[5] * o[2];
    const facing = plane.n[0] * V[0] + plane.n[1] * V[1] + plane.n[2] * V[2];
    const alpha = Math.round(t3Step(plane.fade[0], plane.fade[1], facing) * 100) / 100;
    f.o[role] = alpha;
    if (plane.billboard) {
      f.t[role] = `translate(${t3Num(X)} ${t3Num(Y)})`;
      continue;
    }
    const u = plane.u;
    const v = plane.v;
    const a = m[0] * u[0] + m[1] * u[1] + m[2] * u[2];
    const b = m[3] * u[0] + m[4] * u[1] + m[5] * u[2];
    const c = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
    const d = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
    f.t[role] = `matrix(${t3Fix(a, 1e5)} ${t3Fix(b, 1e5)} ${t3Fix(c, 1e5)} ${t3Fix(d, 1e5)} ${t3Fix(X, 100)} ${t3Fix(Y, 100)})`;
  }
}

function t3EmitDots(run, cam, f, sx = 0, sy = 0) {
  const m = cam.m;
  const V = cam.V;
  for (let j = 0; j < run.dots.length; j++) {
    const dot = run.dots[j];
    const role = run.role[`c${j}`];
    const p = dot.p;
    f.cx[role] = cam.ox - sx + m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
    f.cy[role] = cam.oy - sy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
    const alpha = (dot.n ? t3Step(dot.fade[0], dot.fade[1], dot.n[0] * V[0] + dot.n[1] * V[1] + dot.n[2] * V[2]) : 1) * t3State.detail;
    f.o[role] = alpha < 0.005 ? 0 : Math.round(alpha * 100) / 100;
  }
}

function t3EmitFixed(run, cam, f) {
  const a = run.anchor;
  const m = cam.m;
  const X = cam.ox + m[0] * a[0] + m[1] * a[1] + m[2] * a[2];
  const Y = cam.oy + m[3] * a[0] + m[4] * a[1] + m[5] * a[2];
  const dx = X - run.home[0];
  const dy = Y - run.home[1];
  const rx = Math.round(dx * 100) / 100;
  const ry = Math.round(dy * 100) / 100;
  f.t[run.role.move] = rx || ry ? `translate(${t3Num(rx)} ${t3Num(ry)})` : "";
  f.shiftX = rx;
  f.shiftY = ry;
  const b = run.box0;
  f.box[0] = b[0] + rx;
  f.box[1] = b[1] + ry;
  f.box[2] = b[2] + rx;
  f.box[3] = b[3] + ry;
  const count = run.hull0.length / 2;
  const hull = t3Grow(f, "hull", 2 * count, Float64Array);
  for (let i = 0; i < count; i++) {
    hull[2 * i] = run.hull0[2 * i] + rx;
    hull[2 * i + 1] = run.hull0[2 * i + 1] + ry;
  }
  f.hullN = count;
  if (run.ribs && run.F) t3EmitRibs(run, cam, f, run.F, run.ribs, rx, ry);
  t3EmitPlanes(run, cam, f, rx, ry);
  t3EmitDots(run, cam, f, rx, ry);
}

function t3EmitRibs(run, cam, f, F, ribs, sx, sy) {
  if (t3State.detail < 0.01) {
    f.levels = t3Faded(f, run, "r", t3None, 0);
    return;
  }
  const m = cam.m;
  const V = cam.V;
  const lines = t3Lines;
  lines.d.length = 0;
  lines.alpha.length = 0;
  lines.key.length = 0;
  const { s0, s1, count, phase = 0, twist = 0, fade = [0.1, 0.55] } = ribs;
  const r0 = ribs.r0 ?? ribs.r;
  const r1 = ribs.r1 ?? r0;
  const slope = (r1 - r0) / (s1 - s0 || 1);
  const norm = Math.hypot(1, slope);
  const aV = F.a[0] * V[0] + F.a[1] * V[1] + F.a[2] * V[2];
  const uV = F.u[0] * V[0] + F.u[1] * V[1] + F.u[2] * V[2];
  const vV = F.v[0] * V[0] + F.v[1] * V[1] + F.v[2] * V[2];
  const seg = new Float64Array(4);
  const at = (s, r, t, out, index) => {
    const c = Math.cos(t);
    const n = Math.sin(t);
    const px = F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]);
    const py = F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]);
    const pz = F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]);
    out[index] = cam.ox - sx + m[0] * px + m[1] * py + m[2] * pz;
    out[index + 1] = cam.oy - sy + m[3] * px + m[4] * py + m[5] * pz;
  };
  for (let i = 0; i < count; i++) {
    const t = phase + (i / count) * T3_TAU;
    const tm = t + twist / 2;
    const facing = (Math.cos(tm) * uV + Math.sin(tm) * vV - slope * aV) / norm;
    const alpha = t3Step(fade[0], fade[1], facing);
    if (alpha * T3_LEVELS < 0.5) continue;
    at(s0, r0, t, seg, 0);
    at(s1, r1, t + twist, seg, 2);
    lines.d.push(t3Path(seg, 2, false));
    lines.alpha.push(alpha);
    lines.key.push(i);
  }
  f.levels = t3Faded(f, run, "r", lines, lines.d.length);
}


function t3Geo(F, cam) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lin = (w) => [m[0] * w[0] + m[1] * w[1] + m[2] * w[2], m[3] * w[0] + m[4] * w[1] + m[5] * w[2]];
  const O = [cam.ox + m[0] * F.o[0] + m[1] * F.o[1] + m[2] * F.o[2], cam.oy + m[3] * F.o[0] + m[4] * F.o[1] + m[5] * F.o[2]];
  const aV = dot(F.a, V);
  const uV = dot(F.u, V);
  const vV = dot(F.v, V);
  const aL = dot(F.a, L);
  const uL = dot(F.u, L);
  const vL = dot(F.v, L);
  return { O, SA: lin(F.a), SU: lin(F.u), SV: lin(F.v), aV, aL, view: { a: aV, flat: Math.hypot(uV, vV), phi: Math.atan2(vV, uV) }, light: { a: aL, flat: Math.hypot(uL, vL), phi: Math.atan2(vL, uL) } };
}

function t3At(geo, s, r, t, buf, index) {
  const c = Math.cos(t);
  const n = Math.sin(t);
  buf[index] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + n * geo.SV[0]);
  buf[index + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + n * geo.SV[1]);
}

function t3Arcs(nr, na, view, light) {
  const cuts = [];
  if (Math.abs(nr) > 1e-9) {
    const visibleCut = -(na * view.a) / (nr * view.flat);
    if (visibleCut > -1 && visibleCut < 1) {
      const d = Math.acos(visibleCut);
      cuts.push(view.phi - d, view.phi + d);
    }
    for (let b = 0; b < T3_LB.length; b++) {
      const c = (T3_LB[b] - na * light.a) / (nr * light.flat);
      if (c > -1 && c < 1) {
        const d = Math.acos(c);
        cuts.push(light.phi - d, light.phi + d);
      }
    }
  }
  for (let i = 0; i < cuts.length; i++) {
    const w = ((cuts[i] % T3_TAU) + T3_TAU) % T3_TAU;
    cuts[i] = Math.round(w * 1e9) / 1e9;
  }
  cuts.sort((a, b) => a - b);
  const sorted = [];
  for (let i = 0; i < cuts.length; i++) if (!sorted.length || cuts[i] !== sorted[sorted.length - 1]) sorted.push(cuts[i]);
  const label = (angle) => {
    const facing = nr * view.flat * Math.cos(angle - view.phi) + na * view.a;
    if (facing <= 1e-9) return -1;
    const score = nr * light.flat * Math.cos(angle - light.phi) + na * light.a;
    let tone = 0;
    while (tone < T3_LB.length && score >= T3_LB[tone]) tone++;
    return tone;
  };
  if (!sorted.length) {
    const tone = label(0);
    return tone < 0 ? [] : [{ tone, from: 0, to: T3_TAU, full: true }];
  }
  const merged = [];
  for (let index = 0; index < sorted.length; index++) {
    const from = sorted[index];
    const to = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + T3_TAU;
    const tone = label((from + to) / 2);
    const last = merged[merged.length - 1];
    if (last && last.tone === tone && Math.abs(last.to - from) < 1e-9) last.to = to;
    else merged.push({ tone, from, to });
  }
  if (merged.length > 1 && merged[0].tone === merged[merged.length - 1].tone && Math.abs(merged[merged.length - 1].to - T3_TAU - merged[0].from) < 1e-9) {
    const last = merged.pop();
    merged[0].from = last.from - T3_TAU;
  }
  const out = [];
  for (const arc of merged) if (arc.tone >= 0) out.push(arc);
  return out;
}

function t3Strip(geo, s0, r0, s1, r1, from, to, step) {
  const count = Math.max(1, Math.ceil((to - from) / step));
  const buf = t3Scratch("c", 4 * count + 8);
  for (let j = 0; j <= count; j++) {
    const t = from + ((to - from) * j) / count;
    t3At(geo, s0, r0, t, buf, 2 * j);
    t3At(geo, s1, r1, t, buf, 2 * (2 * count + 1 - j));
  }
  return t3Path(t3Oriented(buf, 2 * count + 2), 2 * count + 2, true);
}

function t3Oriented(buf, count) {
  let area = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    area += buf[2 * i] * buf[2 * j + 1] - buf[2 * j] * buf[2 * i + 1];
  }
  if (area >= 0) return buf;
  for (let i = 0, j = count - 1; i < j; i++, j--) {
    const x = buf[2 * i];
    const y = buf[2 * i + 1];
    buf[2 * i] = buf[2 * j];
    buf[2 * i + 1] = buf[2 * j + 1];
    buf[2 * j] = x;
    buf[2 * j + 1] = y;
  }
  return buf;
}

function t3Hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function t3PathOf(points, closed) {
  if (points.length < 2) return "";
  let s = "M" + t3Num(points[0][0]) + " " + t3Num(points[0][1]);
  for (let i = 1; i < points.length; i++) s += "L" + t3Num(points[i][0]) + " " + t3Num(points[i][1]);
  return closed ? s + "Z" : s;
}

function t3Basis(w) {
  const helper = Math.abs(w[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = t3Unit([helper[1] * w[2] - helper[2] * w[1], helper[2] * w[0] - helper[0] * w[2], helper[0] * w[1] - helper[1] * w[0]]);
  return [u, [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]]];
}

function t3Meet(A, a, B, b) {
  const ab = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const det = 1 - ab * ab;
  if (det < 1e-12) return [];
  const alpha = (a - b * ab) / det;
  const beta = (b - a * ab) / det;
  const base = [A[0] * alpha + B[0] * beta, A[1] * alpha + B[1] * beta, A[2] * alpha + B[2] * beta];
  const rest = 1 - (base[0] * base[0] + base[1] * base[1] + base[2] * base[2]);
  if (rest < 0) return [];
  const cr = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
  const k = Math.sqrt(rest / det);
  return [
    [base[0] + cr[0] * k, base[1] + cr[1] * k, base[2] + cr[2] * k],
    [base[0] - cr[0] * k, base[1] - cr[1] * k, base[2] - cr[2] * k],
  ];
}

const t3Tables = new Map();
function t3Table(count) {
  let table = t3Tables.get(count);
  if (!table) {
    table = new Float64Array(2 * count);
    for (let j = 0; j < count; j++) {
      table[2 * j] = Math.cos((j / count) * T3_TAU);
      table[2 * j + 1] = Math.sin((j / count) * T3_TAU);
    }
    t3Tables.set(count, table);
  }
  return table;
}

function t3Dome(cam, C, e, r, count, sheets) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const Sx = cam.ox + m[0] * C[0] + m[1] * C[1] + m[2] * C[2];
  const Sy = cam.oy + m[3] * C[0] + m[4] * C[1] + m[5] * C[2];
  const flat = (n) => [Sx + r * (m[0] * n[0] + m[1] * n[1] + m[2] * n[2]), Sy + r * (m[3] * n[0] + m[4] * n[1] + m[5] * n[2])];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const table = t3Table(count);
  const circle = (W, value, keep) => {
    const [U, Q] = t3Basis(W);
    const rad = Math.sqrt(Math.max(0, 1 - value * value));
    const out = [];
    for (let j = 0; j < count; j++) {
      const cs = table[2 * j] * rad;
      const sn = table[2 * j + 1] * rad;
      const n = [W[0] * value + U[0] * cs + Q[0] * sn, W[1] * value + U[1] * cs + Q[1] * sn, W[2] * value + U[2] * cs + Q[2] * sn];
      if (keep(n)) out.push(n);
    }
    return out;
  };
  const rim = circle(V, 0, (n) => dot(n, e) >= -1e-9).map((n) => [flat(n), dot(n, L)]);
  const base = circle(e, 0, (n) => dot(n, V) >= -1e-9).map((n) => [flat(n), dot(n, L)]);
  const corners = t3Meet(V, 0, e, 0).map((n) => [flat(n), dot(n, L)]);
  for (let tone = 0; tone < 5; tone++) {
    const tau = tone === 0 ? -Infinity : T3_LB[tone - 1];
    const candidates = [];
    for (const list of [rim, base, corners]) for (const [p, lit] of list) if (lit >= tau - 1e-9) candidates.push(p);
    if (tone > 0) {
      for (const n of circle(L, tau, (n) => dot(n, V) >= -1e-9 && dot(n, e) >= -1e-9)) candidates.push(flat(n));
      for (const n of t3Meet(L, tau, V, 0)) if (dot(n, e) >= -1e-9) candidates.push(flat(n));
      for (const n of t3Meet(L, tau, e, 0)) if (dot(n, V) >= -1e-9) candidates.push(flat(n));
    }
    if (candidates.length < 3) continue;
    const region = t3Hull(candidates);
    if (region.length >= 3) sheets[tone] += t3PathOf(region, true);
  }
}

function t3BoxOf(pts, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  box[0] = x0;
  box[1] = y0;
  box[2] = x1;
  box[3] = y1;
}

function t3Thin(points, most) {
  if (points.length <= most) return points;
  const n = points.length;
  const picks = [];
  for (let i = 0; i < most; i++) picks.push(Math.floor((i * n) / most));
  const thin = picks.map((i) => points[i]);
  let err = 0;
  for (let j = 0; j < most; j++) {
    const a = thin[j];
    const b = thin[(j + 1) % most];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const end = j + 1 < most ? picks[j + 1] : picks[0] + n;
    for (let i = picks[j] + 1; i < end; i++) {
      const p = points[i % n];
      const out = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l;
      if (Math.abs(out) > err) err = Math.abs(out);
    }
  }
  return t3Grown(thin, err);
}

function t3Grown(poly, by) {
  if (!(by > 0)) return poly;
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;
  const n = poly.length;
  const normals = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(sign * (b[1] - a[1])) / l, (-sign * (b[0] - a[0])) / l];
  });
  return poly.map((p, i) => {
    const na = normals[(i - 1 + n) % n];
    const nb = normals[i];
    const mx = na[0] + nb[0];
    const my = na[1] + nb[1];
    const dd = (mx * mx + my * my) / 2 || 1;
    return [p[0] + (mx * by) / dd, p[1] + (my * by) / dd];
  });
}

function t3HullOut(f, points, most = 32) {
  const thin = t3Thin(points, most);
  const hull = t3Grow(f, "hull", 2 * thin.length, Float64Array);
  for (let i = 0; i < thin.length; i++) {
    hull[2 * i] = thin[i][0];
    hull[2 * i + 1] = thin[i][1];
  }
  f.hullN = thin.length;
}

function t3SupportHull(geo, cam, components, dirs) {
  const table = t3Table(dirs);
  const pts = [];
  const { O, SA, SU, SV } = geo;
  for (let j = 0; j < dirs; j++) {
    const dx = table[2 * j];
    const dy = table[2 * j + 1];
    const pa = SA[0] * dx + SA[1] * dy;
    const pu = SU[0] * dx + SU[1] * dy;
    const pv = SV[0] * dx + SV[1] * dy;
    const w = Math.hypot(pu, pv);
    let best = -Infinity;
    let px = 0;
    let py = 0;
    for (let c = 0; c < components.length; c += 3) {
      const kind = components[c];
      const s = components[c + 1];
      const r = components[c + 2];
      if (kind === 0) {
        const value = s * pa + r * w;
        if (value > best) {
          best = value;
          const cs = w > 1e-12 ? pu / w : 1;
          const sn = w > 1e-12 ? pv / w : 0;
          px = O[0] + s * SA[0] + r * (cs * SU[0] + sn * SV[0]);
          py = O[1] + s * SA[1] + r * (cs * SU[1] + sn * SV[1]);
        }
      } else {
        const rk = r * cam.k;
        const value = s * pa + rk;
        if (value > best) {
          best = value;
          px = O[0] + s * SA[0] + rk * dx;
          py = O[1] + s * SA[1] + rk * dy;
        }
      }
    }
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - px) + Math.abs(last[1] - py) > 0.02) pts.push([px, py]);
  }
  if (pts.length > 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 0.02) pts.pop();
  }
  return pts;
}

function t3ArcPoints(geo, s, r, from, to, k, out, cut = false) {
  const count = Math.max(2, Math.ceil((Math.abs(to - from) * 48) / T3_TAU), Math.ceil((Math.abs(to - from) * Math.max(r, 1e-6) * k) / 1.5));
  for (let j = 0; j <= count; j++) {
    const t = from + ((to - from) * j) / count;
    const c = Math.cos(t);
    const n = Math.sin(t);
    const p = [geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + n * geo.SV[0]), geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + n * geo.SV[1])];
    if (cut) p.cut = true;
    out.push(p);
  }
}

function t3RoundOutline(run, geo, cam) {
  const k = cam.k;
  const { s0, s1, r0, r1, ends } = run;
  const domes = (ends[0] === "dome" ? 1 : 0) + (ends[1] === "dome" ? 1 : 0);
  if (domes === 2) {
    const c0 = [geo.O[0] + s0 * geo.SA[0], geo.O[1] + s0 * geo.SA[1]];
    const c1 = [geo.O[0] + s1 * geo.SA[0], geo.O[1] + s1 * geo.SA[1]];
    const rk = r0 * k;
    const dx = c1[0] - c0[0];
    const dy = c1[1] - c0[1];
    const l = Math.hypot(dx, dy);
    const count = Math.max(24, Math.ceil((Math.PI * rk) / 1.5));
    const out = [];
    if (l < 1e-6) {
      for (let j = 0; j < 2 * count; j++) {
        const t = (j / (2 * count)) * T3_TAU;
        out.push([c1[0] + rk * Math.cos(t), c1[1] + rk * Math.sin(t)]);
      }
      return out;
    }
    const beta = Math.atan2(dy, dx);
    for (let j = 0; j <= count; j++) {
      const t = beta - Math.PI / 2 + (Math.PI * j) / count;
      out.push([c1[0] + rk * Math.cos(t), c1[1] + rk * Math.sin(t)]);
    }
    for (let j = 0; j <= count; j++) {
      const t = beta + Math.PI / 2 + (Math.PI * j) / count;
      out.push([c0[0] + rk * Math.cos(t), c0[1] + rk * Math.sin(t)]);
    }
    return out;
  }
  if (domes === 1) {
    const pts = [];
    for (const [end, s, r] of [[0, s0, r0], [1, s1, r1]]) {
      t3ArcPoints(geo, s, r, 0, T3_TAU, k, pts);
      if (ends[end] !== "dome") continue;
      const sign = end ? 1 : -1;
      const c = [geo.O[0] + s * geo.SA[0], geo.O[1] + s * geo.SA[1]];
      const rk = r * k;
      const beta = Math.atan2(sign * geo.SA[1], sign * geo.SA[0]);
      const count = Math.max(24, Math.ceil((Math.PI * rk) / 1.5));
      for (let j = 0; j <= count; j++) {
        const t = beta - Math.PI / 2 + (Math.PI * j) / count;
        pts.push([c[0] + rk * Math.cos(t), c[1] + rk * Math.sin(t)]);
      }
    }
    return t3Hull(pts);
  }
  const view = geo.view;
  const out = [];
  let c;
  if (view.flat < 1e-9) c = run.na * view.a > 0 ? -2 : 2;
  else c = -(run.na * view.a) / (run.nr * view.flat);
  if (c <= -1 || c >= 1) {
    const side = c <= -1;
    const capFirst = -geo.aV > 0;
    const keepFirst = side ? !capFirst : capFirst;
    const s = keepFirst ? s0 : s1;
    const r = keepFirst ? r0 : r1;
    t3ArcPoints(geo, s, r, 0, T3_TAU, k, out, run.cutS !== null && Math.abs(run.cutS - s) < 1e-6);
    out.pop();
    return out;
  }
  const d = Math.acos(c);
  const lo = view.phi - d;
  const hi = view.phi + d;
  const cut0 = run.cutS !== null && Math.abs(run.cutS - s0) < 1e-6;
  const cut1 = run.cutS !== null && Math.abs(run.cutS - s1) < 1e-6;
  if (-geo.aV > 0) t3ArcPoints(geo, s0, r0, hi, lo + T3_TAU, k, out, cut0);
  else t3ArcPoints(geo, s0, r0, lo, hi, k, out, cut0);
  const tail = [];
  if (geo.aV > 0) t3ArcPoints(geo, s1, r1, hi, lo + T3_TAU, k, tail, cut1);
  else t3ArcPoints(geo, s1, r1, lo, hi, k, tail, cut1);
  const first = out[out.length - 1];
  const a = tail[0];
  const b = tail[tail.length - 1];
  if (Math.hypot(a[0] - first[0], a[1] - first[1]) > Math.hypot(b[0] - first[0], b[1] - first[1])) tail.reverse();
  for (const p of tail) out.push(p);
  return out;
}

function t3LatheMid(a, b) {
  const h = b.s - a.s;
  const ga = -a.na / a.nr;
  const gb = -b.na / b.nr;
  const nr = a.nr + b.nr;
  const na = a.na + b.na;
  const l = Math.hypot(nr, na) || 1;
  return { s: (a.s + b.s) / 2, r: (a.r + b.r) / 2 + (h * (ga - gb)) / 8, nr: nr / l, na: na / l };
}

function t3LatheOutline(run, geo, cam) {
  const k = cam.k;
  const view = geo.view;
  const lv = run.levels;
  const pts = [];
  const cut = (L) => (view.flat < 1e-9 ? Infinity : -(L.na * view.a) / (L.nr * view.flat));
  const inside = (L) => L.r <= 1e-9 || Math.abs(cut(L)) < 1;
  const sides = (L) => {
    if (L.r <= 1e-9) {
      const p = [geo.O[0] + L.s * geo.SA[0], geo.O[1] + L.s * geo.SA[1]];
      return [p, p];
    }
    const c = Math.max(-1, Math.min(1, cut(L)));
    const d = Math.acos(c);
    return [view.phi - d, view.phi + d].map((t) => {
      const cs = Math.cos(t);
      const sn = Math.sin(t);
      return [geo.O[0] + L.s * geo.SA[0] + L.r * (cs * geo.SU[0] + sn * geo.SV[0]), geo.O[1] + L.s * geo.SA[1] + L.r * (cs * geo.SU[1] + sn * geo.SV[1])];
    });
  };
  const span = (a, b) => {
    const pa = sides(a);
    const pb = sides(b);
    return Math.max(Math.hypot(pa[0][0] - pb[0][0], pa[0][1] - pb[0][1]), Math.hypot(pa[1][0] - pb[1][0], pa[1][1] - pb[1][1]));
  };
  const refine = (a, b, depth) => {
    if (depth >= 10 || span(a, b) < 1.2) return;
    const mid = t3LatheMid(a, b);
    refine(a, mid, depth + 1);
    pts.push(...sides(mid));
    refine(mid, b, depth + 1);
  };
  let previous = null;
  for (let i = 0; i < lv.length; i += 4) {
    const L = { s: lv[i], r: lv[i + 1], nr: lv[i + 2], na: lv[i + 3] };
    if (inside(L)) pts.push(...sides(L));
    if (previous) {
      const pin = inside(previous);
      const lin = inside(L);
      if (pin && lin) refine(previous, L, 0);
      else if (pin !== lin) {
        let a = pin ? previous : L;
        let b = pin ? L : previous;
        const start = a;
        for (let it = 0; it < 14; it++) {
          const mid = t3LatheMid(a.s < b.s ? a : b, a.s < b.s ? b : a);
          if (inside(mid)) a = mid;
          else b = mid;
        }
        pts.push(...sides(a));
        refine(start.s < a.s ? start : a, start.s < a.s ? a : start, 0);
      }
    }
    previous = L;
  }
  for (const i of [0, lv.length - 4]) if (lv[i + 1] > 1e-9) t3ArcPoints(geo, lv[i], lv[i + 1], 0, T3_TAU, k, pts);
  return t3Hull(pts);
}

function t3SeamArc(geo, s, r, slope, k, trim = 0.3) {
  const view = geo.view;
  const norm = Math.hypot(1, slope);
  let lo;
  let hi;
  if (view.flat < 1e-9) {
    if (!((-slope * view.a) / norm > 0)) return "";
    lo = view.phi;
    hi = view.phi + T3_TAU;
  } else {
    const cc = (slope * view.a) / view.flat;
    if (cc >= 1) return "";
    if (cc <= -1) {
      lo = view.phi;
      hi = view.phi + T3_TAU;
    } else {
      const d = Math.acos(cc);
      lo = view.phi - d;
      hi = view.phi + d;
    }
  }
  const full = hi - lo >= T3_TAU - 1e-9;
  const buf = t3Scratch("c", 2 * 520);
  if (!full) {
    const span = hi - lo;
    const cutAt = (from, sign) => {
      t3At(geo, s, r, from, buf, 0);
      const px = buf[0];
      const py = buf[1];
      let a = 0;
      let b = span * 0.25;
      t3At(geo, s, r, from + sign * b, buf, 0);
      if (Math.hypot(buf[0] - px, buf[1] - py) <= trim) return b;
      for (let it = 0; it < 18; it++) {
        const mid = (a + b) / 2;
        t3At(geo, s, r, from + sign * mid, buf, 0);
        if (Math.hypot(buf[0] - px, buf[1] - py) < trim) a = mid;
        else b = mid;
      }
      return (a + b) / 2;
    };
    const d0 = cutAt(lo, 1);
    const d1 = cutAt(hi, -1);
    lo += d0;
    hi -= d1;
  }
  const count = Math.min(512, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
  for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, buf, 2 * j);
  return t3Path(buf, full ? count : count + 1, full);
}

function t3RibLines(geo, F, cam, ribs, sx, sy) {
  const lines = t3Lines;
  lines.d.length = 0;
  lines.alpha.length = 0;
  lines.key.length = 0;
  const { s0, s1, count, phase = 0, twist = 0, fade = [0.1, 0.55] } = ribs;
  const r0 = ribs.r0 ?? ribs.r;
  const r1 = ribs.r1 ?? r0;
  const slope = (r1 - r0) / (s1 - s0 || 1);
  const norm = Math.hypot(1, slope);
  const view = geo.view;
  const seg = new Float64Array(4);
  for (let i = 0; i < count; i++) {
    const t = phase + (i / count) * T3_TAU;
    const tm = t + twist / 2;
    const facing = (view.flat * Math.cos(tm - view.phi) - slope * view.a) / norm;
    const alpha = t3Step(fade[0], fade[1], facing);
    if (alpha * T3_LEVELS < 0.5) continue;
    t3At(geo, s0, r0, t, seg, 0);
    t3At(geo, s1, r1, t + twist, seg, 2);
    seg[0] -= sx;
    seg[1] -= sy;
    seg[2] -= sx;
    seg[3] -= sy;
    lines.d.push(t3Path(seg, 2, false));
    lines.alpha.push(alpha);
    lines.key.push(i);
  }
  return lines;
}

function t3PrepareRound(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.F = spec.F;
  run.s0 = spec.s0;
  run.s1 = spec.s1;
  run.r0 = spec.r0;
  run.r1 = spec.r1;
  run.ends = spec.ends;
  const g = (spec.r1 - spec.r0) / (spec.s1 - spec.s0 || 1);
  const norm = Math.hypot(1, g);
  run.nr = 1 / norm;
  run.na = -g / norm;
  run.g = g;
  const rmax = Math.max(spec.r0, spec.r1);
  const around = T3_TAU * rmax * k * unit;
  run.fine = Math.max(around < 30 ? 16 : 24, Math.min(96, Math.ceil(around / 2.2)));
  run.dirs = Math.max(around < 30 ? 16 : 32, Math.min(256, Math.ceil(around / 1.5)));
  run.capCount = Math.max(around < 30 ? 16 : 24, Math.min(160, Math.ceil(around / 1.5)));
  run.domeCount = Math.max(around < 30 ? 12 : 16, Math.min(48, Math.round(run.fine * 0.75)));
  const comps = [];
  for (const [end, s, r] of [[0, spec.s0, spec.r0], [1, spec.s1, spec.r1]]) comps.push(spec.ends[end] === "dome" ? 1 : 0, s, r);
  run.components = comps;
  const details = part.details ?? {};
  run.seams = (details.seams ?? []).map((s) => ({ s, r: spec.r0 + g * (s - spec.s0), slope: g }));
  run.ribs = details.ribs ? { ...details.ribs, r0: details.ribs.r0 ?? spec.r0 + g * (details.ribs.s0 - spec.s0), r1: details.ribs.r1 ?? spec.r0 + g * (details.ribs.s1 - spec.s0) } : null;
  run.cutS = null;
  for (const cut of spec.cuts ?? []) {
    const along = cut.n[0] * spec.F.a[0] + cut.n[1] * spec.F.a[1] + cut.n[2] * spec.F.a[2];
    const sCut = (cut.d - (cut.n[0] * spec.F.o[0] + cut.n[1] * spec.F.o[1] + cut.n[2] * spec.F.o[2])) / along;
    if (Math.abs(sCut - spec.s0) < 1e-6 || Math.abs(sCut - spec.s1) < 1e-6) run.cutS = sCut;
  }
}

function t3EmitRound(run, cam, f) {
  const geo = t3Geo(run.F, cam);
  const k = cam.k;
  const step = T3_TAU / run.fine;
  const sheets = ["", "", "", "", ""];
  const { s0, s1, r0, r1 } = run;
  for (const arc of t3Arcs(run.nr, run.na, geo.view, geo.light)) sheets[arc.tone] += t3Strip(geo, s0, r0, s1, r1, arc.from, arc.to, step);
  const F = run.F;
  for (let end = 0; end < 2; end++) {
    if (run.ends[end] !== "dome") continue;
    const s = end ? s1 : s0;
    const sign = end ? 1 : -1;
    const C = [F.o[0] + F.a[0] * s, F.o[1] + F.a[1] * s, F.o[2] + F.a[2] * s];
    t3Dome(cam, C, [F.a[0] * sign, F.a[1] * sign, F.a[2] * sign], end ? r1 : r0, run.domeCount, sheets);
  }
  for (let t = 0; t < 5; t++) f.d[run.role[`s${t}`]] = sheets[t];
  const pts = t3RoundOutline(run, geo, cam);
  const outline = t3PathOf(pts, true);
  f.d[run.role.fill] = outline;
  if (run.cutS !== null) {
    const buf = new Float64Array(2 * pts.length);
    const skip = new Uint8Array(pts.length);
    pts.forEach((p, j) => {
      buf[2 * j] = p[0];
      buf[2 * j + 1] = p[1];
    });
    for (let j = 0; j < pts.length; j++) skip[j] = pts[j].cut && pts[(j + 1) % pts.length].cut ? 1 : 0;
    f.d[run.role.edge] = t3Broken(buf, pts.length, skip);
  } else f.d[run.role.edge] = outline;
  t3BoxOf(pts, f.box);
  t3HullOut(f, pts);
  const view = geo.view;
  let crease = "";
  for (let end = 0; end < 2; end++) {
    if (run.ends[end] !== "flat") continue;
    const role = run.role[`k${end}`];
    const sign = end ? 1 : -1;
    const s = end ? s1 : s0;
    const r = end ? r1 : r0;
    const face = sign * geo.aV;
    if (!(face > 1e-9)) {
      f.d[role] = "";
      continue;
    }
    const n = run.capCount;
    const buf = t3Scratch("c", 2 * n);
    const table = t3Table(n);
    for (let j = 0; j < n; j++) {
      const c = table[2 * j];
      const q = table[2 * j + 1];
      buf[2 * j] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + q * geo.SV[0]);
      buf[2 * j + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + q * geo.SV[1]);
    }
    f.d[role] = t3Path(buf, n, true);
    f.q[role] = t3Level(sign * geo.aL, T3_LB);
    const minor = 2 * r * k * Math.abs(face);
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    if (run.role.crease === undefined) continue;
    let lo;
    let hi;
    if (view.flat < 1e-9) {
      if (!(run.na * view.a > 1e-9)) continue;
      lo = 0;
      hi = T3_TAU;
    } else {
      const cc = -(run.na * view.a) / (run.nr * view.flat);
      if (cc >= 1) continue;
      if (cc <= -1) {
        lo = view.phi;
        hi = view.phi + T3_TAU;
      } else {
        const d = Math.acos(cc);
        lo = view.phi - d;
        hi = view.phi + d;
      }
    }
    const count = Math.min(400, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
    const arc = t3Scratch("c", 2 * count + 2);
    for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, arc, 2 * j);
    crease += t3Path(arc, count + 1, false);
  }
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  if (run.role.inner !== undefined) {
    let inner = "";
    for (const seam of run.seams) inner += t3SeamArc(geo, seam.s, seam.r, seam.slope, k);
    if (run.ribs && run.ribs.seams) {
      const rs = run.ribs;
      const slope = (rs.r1 - rs.r0) / (rs.s1 - rs.s0 || 1);
      if (rs.seams !== "last") inner += t3SeamArc(geo, rs.s0, rs.r0, slope, k);
      if (rs.seams !== "first") inner += t3SeamArc(geo, rs.s1, rs.r1, slope, k);
    }
    f.d[run.role.inner] = inner;
  }
  if (run.ribs) {
    const lines = t3State.detail < 0.01 ? t3None : t3RibLines(geo, run.F, cam, run.ribs, 0, 0);
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
}

function t3PrepareBall(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.c = spec.c;
  run.r = spec.r;
  run.flats = spec.flats.map((flat) => {
    const n = t3Unit(flat.n);
    const rho = Math.sqrt(Math.max(0, spec.r * spec.r - flat.d * flat.d));
    const [u, v] = t3Basis(n);
    return { n, d: flat.d, rho, u, v };
  });
  run.limb = Math.max(32, Math.min(160, Math.ceil((T3_TAU * spec.r * k * unit) / 1.5)));
  run.rimCount = run.flats.map((flat) => Math.max(20, Math.min(120, Math.ceil((T3_TAU * flat.rho * k * unit) / 1.5))));
}

function t3ClipConvex(subject, clip) {
  if (subject.length < 3 || clip.length < 3) return [];
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

function t3EmitBall(run, cam, f) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const { c, r, flats } = run;
  const Cx = cam.ox + m[0] * c[0] + m[1] * c[1] + m[2] * c[2];
  const Cy = cam.oy + m[3] * c[0] + m[4] * c[1] + m[5] * c[2];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const flat = (w) => [Cx + r * (m[0] * w[0] + m[1] * w[1] + m[2] * w[2]), Cy + r * (m[3] * w[0] + m[4] * w[1] + m[5] * w[2])];
  const inside = (w, skip = -1) => {
    for (let i = 0; i < flats.length; i++) if (i !== skip && dot(w, flats[i].n) * r > flats[i].d + 1e-7) return false;
    return true;
  };
  const [U, W] = t3Basis(V);
  const n = run.limb;
  const table = t3Table(n);
  const limb = [];
  for (let j = 0; j < n; j++) limb.push([U[0] * table[2 * j] + W[0] * table[2 * j + 1], U[1] * table[2 * j] + W[1] * table[2 * j + 1], U[2] * table[2 * j] + W[2] * table[2 * j + 1]]);
  const sil = [];
  for (const w of limb) if (inside(w)) sil.push(flat(w));
  const rims = flats.map((cut, ci) => {
    const count = run.rimCount[ci];
    const t = t3Table(count);
    const list = [];
    for (let j = 0; j < count; j++) {
      const w = [(cut.n[0] * cut.d + cut.rho * (cut.u[0] * t[2 * j] + cut.v[0] * t[2 * j + 1])) / r, (cut.n[1] * cut.d + cut.rho * (cut.u[1] * t[2 * j] + cut.v[1] * t[2 * j + 1])) / r, (cut.n[2] * cut.d + cut.rho * (cut.u[2] * t[2 * j] + cut.v[2] * t[2 * j + 1])) / r];
      list.push({ w, keep: inside(w, ci), p: flat(w) });
    }
    return list;
  });
  flats.forEach((cut, ci) => {
    for (const w of t3Meet(V, 0, cut.n, cut.d / r)) if (inside(w, ci)) sil.push(flat(w));
    rims[ci].forEach(({ keep, p }) => keep && sil.push(p));
  });
  const hull = t3Hull(sil);
  const outline = t3PathOf(hull, true);
  f.d[run.role.fill] = outline;
  f.d[run.role.edge] = outline;
  f.d[run.role.s0] = outline;
  const capOf = (threshold) => {
    const points = [];
    for (const w of limb) if (dot(w, L) >= threshold && inside(w)) points.push(flat(w));
    const radius = Math.sqrt(Math.max(0, 1 - threshold * threshold));
    const [LU, LW] = t3Basis(L);
    for (let j = 0; j < n; j++) {
      const w = [L[0] * threshold + radius * (LU[0] * table[2 * j] + LW[0] * table[2 * j + 1]), L[1] * threshold + radius * (LU[1] * table[2 * j] + LW[1] * table[2 * j + 1]), L[2] * threshold + radius * (LU[2] * table[2 * j] + LW[2] * table[2 * j + 1])];
      if (dot(w, V) >= -1e-9) points.push(flat(w));
    }
    if (dot(L, V) > threshold) points.push(flat(V));
    for (const w of t3Meet(L, threshold, V, 0)) if (inside(w)) points.push(flat(w));
    flats.forEach((cut, ci) => {
      for (const w of t3Meet(V, 0, cut.n, cut.d / r)) if (inside(w, ci) && dot(w, L) >= threshold) points.push(flat(w));
      for (const w of t3Meet(L, threshold, cut.n, cut.d / r)) if (inside(w, ci) && dot(w, V) >= -1e-9) points.push(flat(w));
      for (const { w, keep, p } of rims[ci]) if (keep && dot(w, L) >= threshold && dot(w, V) >= -1e-9) points.push(p);
    });
    if (points.length < 3) return "";
    const region = t3ClipConvex(t3Hull(points), hull);
    return region.length >= 3 ? t3PathOf(region, true) : "";
  };
  f.d[run.role.s1] = capOf(T3_LB[1]);
  f.d[run.role.s2] = capOf(T3_LB[2]);
  f.d[run.role.s3] = capOf(T3_LB[3]);
  let crease = "";
  flats.forEach((cut, ci) => {
    const role = run.role[`f${ci}`];
    const face = dot(cut.n, V);
    if (!(face > 1e-9)) {
      f.d[role] = "";
      return;
    }
    const pts = t3ClipConvex(rims[ci].map(({ p }) => p), hull);
    f.d[role] = t3PathOf(pts, true);
    f.q[role] = t3Level(dot(cut.n, L), T3_LB);
    const minor = 2 * cut.rho * cam.k * face;
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    const list = rims[ci];
    const seen = list.map(({ w, keep }) => keep && dot(w, V) > 0);
    const start = seen.indexOf(false);
    if (start < 0) {
      crease += t3PathOf(list.map(({ p }) => p), true);
      return;
    }
    let cur = null;
    for (let s = 1; s <= list.length; s++) {
      const i = (start + s) % list.length;
      if (seen[i]) (cur ??= []).push(list[i].p);
      else if (cur) {
        if (cur.length > 1) crease += t3PathOf(cur, false);
        cur = null;
      }
    }
    if (cur && cur.length > 1) crease += t3PathOf(cur, false);
  });
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of hull) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  f.box[0] = x0;
  f.box[1] = y0;
  f.box[2] = x1;
  f.box[3] = y1;
  t3HullOut(f, hull);
}

function t3PrepareLathe(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.F = spec.F;
  run.levels = spec.levels;
  run.caps = spec.caps;
  let rmax = 0;
  for (let i = 0; i < spec.levels.length; i += 4) rmax = Math.max(rmax, spec.levels[i + 1]);
  run.fine = Math.max(24, Math.min(96, Math.ceil((T3_TAU * rmax * k * unit) / 2.2)));
  run.dirs = Math.max(32, Math.min(256, Math.ceil((T3_TAU * rmax * k * unit) / 1.5)));
  run.capCount = Math.max(24, Math.min(160, Math.ceil((T3_TAU * rmax * k * unit) / 1.5)));
  const comps = [];
  for (let i = 0; i < spec.levels.length; i += 4) comps.push(0, spec.levels[i], spec.levels[i + 1]);
  run.components = comps;
  const details = part.details ?? {};
  run.seams = (details.seams ?? []).map((seam) => (typeof seam === "number" ? t3LatheSeam(spec.levels, seam) : seam));
  run.ribs = details.ribs ?? null;
}

function t3LatheSeam(levels, s) {
  for (let i = 0; i + 4 < levels.length; i += 4) {
    const sa = levels[i];
    const sb = levels[i + 4];
    if ((s - sa) * (s - sb) <= 0 && sa !== sb) {
      const t = (s - sa) / (sb - sa);
      const r = levels[i + 1] + (levels[i + 5] - levels[i + 1]) * t;
      const slope = (levels[i + 5] - levels[i + 1]) / (sb - sa);
      return { s, r, slope };
    }
  }
  return { s, r: levels[1], slope: 0 };
}

function t3LatheSheets(levels, geo, step, buckets) {
  const at = (L, t) => {
    const c = Math.cos(t);
    const n = Math.sin(t);
    return [geo.O[0] + L.s * geo.SA[0] + L.r * (c * geo.SU[0] + n * geo.SV[0]), geo.O[1] + L.s * geo.SA[1] + L.r * (c * geo.SU[1] + n * geo.SV[1])];
  };
  const arcPoints = (L, from, to) => {
    const count = Math.max(1, Math.ceil((to - from) / step));
    const out = new Array(count + 1);
    for (let index = 0; index <= count; index++) out[index] = at(L, from + ((to - from) * index) / count);
    return out;
  };
  const oriented = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area < 0 ? points.reverse() : points;
  };
  const centreOf = (arc, reference) => {
    let mid = (arc.from + arc.to) / 2 - reference;
    mid = ((mid % T3_TAU) + T3_TAU) % T3_TAU;
    return mid;
  };
  const present = [false, false, false, false, false];
  for (const L of levels) {
    const groups = [null, null, null, null, null];
    for (const arc of L.arcs) {
      if (!groups[arc.tone]) groups[arc.tone] = [];
      groups[arc.tone].push(arc);
      present[arc.tone] = true;
    }
    for (const list of groups) if (list && list.length > 1) list.sort((x, y) => centreOf(x, geo.light.phi) - centreOf(y, geo.light.phi));
    L.groups = groups;
  }
  const align = (reference, arc) => {
    const out = { ...arc };
    const centre = (reference.from + reference.to) / 2;
    while ((out.from + out.to) / 2 - centre > Math.PI) {
      out.from -= T3_TAU;
      out.to -= T3_TAU;
    }
    while (centre - (out.from + out.to) / 2 > Math.PI) {
      out.from += T3_TAU;
      out.to += T3_TAU;
    }
    return out;
  };
  const overlap = (x, y) => Math.min(x.to, y.to) - Math.max(x.from, y.from);
  const sheet = (tone, run) => {
    const chains = run[0].groups[tone].map((arc) => [arc]);
    for (let q = 1; q < run.length; q++) {
      const next = run[q].groups[tone];
      const used = new Uint8Array(next.length);
      for (const chain of chains) {
        const prev = chain[q - 1];
        let best = -1;
        let score = -Infinity;
        for (let j = 0; j < next.length; j++) {
          if (used[j]) continue;
          const value = overlap(prev, align(prev, next[j]));
          if (value > score) {
            score = value;
            best = j;
          }
        }
        used[best] = 1;
        chain.push(align(prev, next[best]));
      }
    }
    chains.forEach((chain) => {
      const last = run.length - 1;
      const points = arcPoints(run[0], chain[0].from, chain[0].to);
      for (let q = 1; q < last; q++) points.push(at(run[q], chain[q].to));
      points.push(...arcPoints(run[last], chain[last].from, chain[last].to).reverse());
      for (let q = last - 1; q >= 1; q--) points.push(at(run[q], chain[q].from));
      buckets[tone] += t3PathOf(oriented(points), true);
    });
  };
  const strip = (tone, a, b) => {
    const below = a.groups[tone] ?? [];
    const above = b.groups[tone] ?? [];
    const whole = (arc) => arc.to - arc.from >= T3_TAU - 1e-6;
    const seat = (ring, arc) => {
      const gap = T3_TAU - (arc.to - arc.from);
      return { from: arc.from - gap / 2, to: arc.to + gap / 2 };
    };
    const quad = (lo, hi) => {
      if (whole(hi) && !whole(lo)) hi = seat(hi, lo);
      else if (whole(lo) && !whole(hi)) lo = seat(lo, hi);
      const points = [...arcPoints(a, lo.from, lo.to), ...arcPoints(b, hi.from, hi.to).reverse()];
      buckets[tone] += t3PathOf(oriented(points), true);
    };
    const links = below.map(() => []);
    const back = above.map(() => []);
    below.forEach((lo, i) =>
      above.forEach((hi, j) => {
        if (overlap(lo, align(lo, hi)) > -0.05) {
          links[i].push(j);
          back[j].push(i);
        }
      }),
    );
    const doneLo = new Uint8Array(below.length);
    const doneHi = new Uint8Array(above.length);
    const share = (span, parts, flip) => {
      if (whole(span)) {
        const base = parts[0].from;
        const sorted = parts.map((arc) => {
          const shift = T3_TAU * Math.floor((arc.from - base) / T3_TAU);
          return { from: arc.from - shift, to: arc.to - shift };
        }).sort((x, y) => x.from - y.from);
        const n = sorted.length;
        const cuts = sorted.map((arc, q) => {
          const next = q + 1 < n ? sorted[q + 1].from : sorted[0].from + T3_TAU;
          return (arc.to + next) / 2;
        });
        sorted.forEach((arc, q) => {
          const piece = { from: q ? cuts[q - 1] : cuts[n - 1] - T3_TAU, to: cuts[q] };
          if (flip) quad(arc, piece);
          else quad(piece, arc);
        });
        return;
      }
      const sorted = parts.map((arc) => align(span, arc)).sort((x, y) => x.from - y.from);
      const cuts = [span.from];
      for (let q = 1; q < sorted.length; q++) cuts.push(Math.min(span.to, Math.max(span.from, (sorted[q - 1].to + sorted[q].from) / 2)));
      cuts.push(span.to);
      sorted.forEach((arc, q) => {
        const piece = { from: cuts[q], to: cuts[q + 1] };
        if (flip) quad(arc, piece);
        else quad(piece, arc);
      });
    };
    for (let j = 0; j < above.length; j++) {
      if (back[j].length < 2 || back[j].some((i) => links[i].length !== 1)) continue;
      share(above[j], back[j].map((i) => below[i]), false);
      doneHi[j] = 1;
      for (const i of back[j]) doneLo[i] = 1;
    }
    for (let i = 0; i < below.length; i++) {
      if (doneLo[i] || links[i].length < 2 || links[i].some((j) => back[j].length !== 1)) continue;
      share(below[i], links[i].map((j) => above[j]), true);
      doneLo[i] = 1;
      for (const j of links[i]) doneHi[j] = 1;
    }
    for (let i = 0; i < below.length; i++) {
      if (doneLo[i]) continue;
      const lo = below[i];
      let best = -1;
      let score = -Infinity;
      for (const j of links[i]) {
        if (doneHi[j]) continue;
        const value = overlap(lo, align(lo, above[j]));
        if (value > score) {
          score = value;
          best = j;
        }
      }
      if (best >= 0) {
        doneHi[best] = 1;
        quad(lo, align(lo, above[best]));
      } else {
        const centre = (lo.from + lo.to) / 2;
        quad(lo, { from: centre, to: centre });
      }
    }
    for (let j = 0; j < above.length; j++) {
      if (doneHi[j]) continue;
      const centre = (above[j].from + above[j].to) / 2;
      quad({ from: centre, to: centre }, above[j]);
    }
  };
  for (let tone = 0; tone < 5; tone++) {
    if (!present[tone]) continue;
    for (let q = 1; q < levels.length; q++) strip(tone, levels[q - 1], levels[q]);
  }
  void sheet;
}

function t3EmitLathe(run, cam, f) {
  const geo = t3Geo(run.F, cam);
  const k = cam.k;
  const step = T3_TAU / run.fine;
  const sheets = ["", "", "", "", ""];
  const lv = run.levels;
  const levelAt = (s, r, nr, na) => ({ s, r, nr, na, arcs: t3Arcs(nr, na, geo.view, geo.light) });
  const same = (a, b) => {
    if (a.arcs.length !== b.arcs.length) return false;
    for (let i = 0; i < a.arcs.length; i++) if (a.arcs[i].tone !== b.arcs[i].tone || Boolean(a.arcs[i].full) !== Boolean(b.arcs[i].full)) return false;
    return true;
  };
  const reach = (a, b) => Math.hypot((b.s - a.s) * Math.hypot(geo.SA[0], geo.SA[1]), (b.r - a.r) * k) + Math.abs(b.r - a.r) * k;
  const levels = [];
  const wrap = (x, ref) => x + T3_TAU * Math.round((ref - x) / T3_TAU);
  const close = (a, mid, b) => {
    const r = Math.max(a.r, b.r) * k;
    for (let i = 0; i < mid.arcs.length; i++) {
      const m = mid.arcs[i];
      if (m.full) continue;
      for (const key of ["from", "to"]) {
        const x = m[key];
        const guess = (wrap(a.arcs[i][key], x) + wrap(b.arcs[i][key], x)) / 2;
        if (Math.abs(guess - x) * r > 0.25) return false;
      }
    }
    return true;
  };
  const refine = (a, b, depth) => {
    if (depth >= 8 || reach(a, b) < 0.1) {
      levels.push(b);
      return;
    }
    const m = t3LatheMid(a, b);
    const mid = levelAt(m.s, m.r, m.nr, m.na);
    if (same(a, b) && same(a, mid) && close(a, mid, b)) {
      levels.push(b);
      return;
    }
    refine(a, mid, depth + 1);
    refine(mid, b, depth + 1);
  };
  let previous = levelAt(lv[0], lv[1], lv[2], lv[3]);
  levels.push(previous);
  for (let i = 4; i < lv.length; i += 4) {
    const next = levelAt(lv[i], lv[i + 1], lv[i + 2], lv[i + 3]);
    refine(previous, next, 0);
    previous = next;
  }
  t3LatheSheets(levels, geo, step, sheets);
  for (let t = 0; t < 5; t++) f.d[run.role[`s${t}`]] = sheets[t];
  const pts = t3LatheOutline(run, geo, cam);
  const outline = t3PathOf(pts, true);
  f.d[run.role.fill] = outline;
  f.d[run.role.edge] = outline;
  t3BoxOf(pts, f.box);
  t3HullOut(f, pts);
  let crease = "";
  const view = geo.view;
  const ends = [[0, lv[0], lv[1], -1, 4], [1, lv[lv.length - 4], lv[lv.length - 3], 1, lv.length - 8]];
  for (const [end, s, r, sign, near] of ends) {
    const role = run.role[`k${end}`];
    if (role === undefined) continue;
    const face = sign * geo.aV;
    if (!(face > 1e-9) || r <= 1e-9) {
      f.d[role] = "";
      continue;
    }
    const n = run.capCount;
    const buf = t3Scratch("c", 2 * n);
    const table = t3Table(n);
    for (let j = 0; j < n; j++) {
      const c = table[2 * j];
      const q = table[2 * j + 1];
      buf[2 * j] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + q * geo.SV[0]);
      buf[2 * j + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + q * geo.SV[1]);
    }
    f.d[role] = t3Path(buf, n, true);
    f.q[role] = t3Level(sign * geo.aL, T3_LB);
    const minor = 2 * r * k * Math.abs(face);
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    if (run.role.crease === undefined) continue;
    const nr = lv[near + 2];
    const na = lv[near + 3];
    let lo;
    let hi;
    if (view.flat < 1e-9) {
      if (!(na * view.a > 1e-9)) continue;
      lo = 0;
      hi = T3_TAU;
    } else {
      const cc = -(na * view.a) / (nr * view.flat);
      if (cc >= 1) continue;
      if (cc <= -1) {
        lo = view.phi;
        hi = view.phi + T3_TAU;
      } else {
        const d = Math.acos(cc);
        lo = view.phi - d;
        hi = view.phi + d;
      }
    }
    const count = Math.min(400, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
    const arc = t3Scratch("c", 2 * count + 2);
    for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, arc, 2 * j);
    crease += t3Path(arc, count + 1, false);
  }
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  if (run.role.inner !== undefined) {
    let inner = "";
    for (const seam of run.seams) inner += t3SeamArc(geo, seam.s, seam.r, seam.slope, k);
    f.d[run.role.inner] = inner;
  }
  if (run.ribs) {
    const lines = t3State.detail < 0.01 ? t3None : t3RibLines(geo, run.F, cam, run.ribs, 0, 0);
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
}

const T3_SHINE = (() => {
  const l = Math.hypot(-0.55, -0.835);
  return [-0.55 / l, -0.835 / l];
})();

function t3RouteOf(flat) {
  const n = flat.length / 3;
  const along = new Float64Array(n);
  for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(flat[3 * i] - flat[3 * i - 3], flat[3 * i + 1] - flat[3 * i - 2], flat[3 * i + 2] - flat[3 * i - 1]);
  return { flat, n, along, total: along[n - 1] };
}

function t3PointAlong(route, at) {
  const { flat, n, along } = route;
  if (at <= 0) return [flat[0], flat[1], flat[2]];
  if (at >= along[n - 1]) return [flat[3 * n - 3], flat[3 * n - 2], flat[3 * n - 1]];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (along[mid] <= at) lo = mid;
    else hi = mid;
  }
  const span = along[hi] - along[lo] || 1;
  const t = (at - along[lo]) / span;
  return [flat[3 * lo] + (flat[3 * hi] - flat[3 * lo]) * t, flat[3 * lo + 1] + (flat[3 * hi + 1] - flat[3 * lo + 1]) * t, flat[3 * lo + 2] + (flat[3 * hi + 2] - flat[3 * lo + 2]) * t];
}

function t3Cut(route, from, to) {
  const { flat, n, along } = route;
  const out = [];
  for (let i = 1; i < n; i++) {
    const start = along[i - 1];
    const end = along[i];
    if (end >= from && start <= to) {
      const length = end - start || 1;
      const t0 = Math.max(0, (from - start) / length);
      const t1 = Math.min(1, (to - start) / length);
      const at = (t) => [flat[3 * i - 3] + (flat[3 * i] - flat[3 * i - 3]) * t, flat[3 * i - 2] + (flat[3 * i + 1] - flat[3 * i - 2]) * t, flat[3 * i - 1] + (flat[3 * i + 2] - flat[3 * i - 1]) * t];
      if (!out.length) out.push(at(t0));
      out.push(at(t1));
    }
  }
  return out;
}

function t3TangentAlong(route, at) {
  const a = t3PointAlong(route, Math.max(0, at - 0.6));
  const b = t3PointAlong(route, Math.min(route.total, at + 0.6));
  return t3Unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}

const t3RouteCache = new WeakMap();

function t3PrepareTube(run, part, data) {
  const spec = part.spec;
  const source = data.routes[spec.route];
  let route = t3RouteCache.get(source);
  if (!route) {
    route = t3RouteOf(source.points);
    t3RouteCache.set(source, route);
  }
  const total = route.total;
  const r = source.r;
  const step = Math.max(0.05, Math.min(source.spacing, total / 4) * 0.5);
  const lead = 0.5;
  run.r = r;
  run.wide = Boolean(source.wide);
  run.hue = source.hue ?? null;
  const partOf = (start, end) => {
    const points = t3Cut(route, Math.max(0, start), Math.min(total, end));
    let walked = Math.max(0, start);
    const count = points.length;
    const P3 = new Float64Array(3 * count);
    const D3 = new Float64Array(3 * count);
    for (let i = 0; i < count; i++) {
      if (i > 0) walked += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
      const a = t3PointAlong(route, Math.max(0, Math.min(total, walked - step)));
      const b = t3PointAlong(route, Math.max(0, Math.min(total, walked + step)));
      for (let c = 0; c < 3; c++) {
        P3[3 * i + c] = points[i][c];
        D3[3 * i + c] = b[c] - a[c];
      }
    }
    return { count, P3, D3 };
  };
  const openStart = spec.open0 && spec.from > 0;
  const openEnd = spec.open1 && spec.to < total;
  run.body = partOf(openStart ? spec.from - lead : spec.from, openEnd ? spec.to + lead : spec.to);
  run.stripe = openStart || openEnd ? partOf(openStart ? spec.from - 2 * lead : spec.from, openEnd ? spec.to + 2 * lead : spec.to) : run.body;
  const ends = [!spec.open0 && (spec.from <= 1e-6 || spec.gap0), !spec.open1 && (spec.to >= total - 1e-6 || spec.gap1)];
  run.capped = [ends[0] && (spec.gap0 || spec.caps[0]), ends[1] && (spec.gap1 || spec.caps[1])];
  const P3 = run.body.P3;
  const last = run.body.count - 1;
  const vec = (i, j) => t3Unit([P3[3 * i] - P3[3 * j], P3[3 * i + 1] - P3[3 * j + 1], P3[3 * i + 2] - P3[3 * j + 2]]);
  run.tips = [vec(1, 0), vec(last, last - 1)];
  run.rings = null;
  if (source.rings) {
    const { pitch = 3, twist = 0, cross = false, fade = [0.1, 0.55], phase = 0, steps = 16 } = source.rings;
    const lo = openStart ? spec.from - 2 * lead : spec.from;
    const hi = openEnd ? spec.to + 2 * lead : spec.to;
    const margin = twist ? 0 : Math.min(pitch * 0.35, (hi - lo) / 2);
    const from = Math.max(lo, !openStart ? lo + margin : lo);
    const to = Math.min(hi, !openEnd ? hi - margin : hi);
    const segments = [];
    if (to > from) {
      const hands = twist ? (cross ? [1, -1] : [1]) : [0];
      const reach = Math.abs(twist) * r;
      const first = Math.ceil((from - reach - phase) / pitch);
      const lastIndex = Math.floor((to + reach - phase) / pitch);
      const surface = (t, theta) => {
        const at = Math.max(0, Math.min(total, t));
        return { c: t3PointAlong(route, at), T: t3TangentAlong(route, at), theta };
      };
      for (let index = first; index <= lastIndex; index++) {
        const station = phase + index * pitch;
        for (const hand of hands) {
          const samples = [];
          for (let k = 0; k <= steps; k++) {
            const theta = (k / steps) * Math.PI;
            const t = station + hand * twist * r * (k / steps - 0.5);
            samples.push({ t, theta });
          }
          for (let k = 0; k < steps; k++) {
            let a = samples[k];
            let b = samples[k + 1];
            if ((a.t < from && b.t < from) || (a.t > to && b.t > to)) continue;
            const clipTo = (x, y, edge) => ({ t: edge, theta: x.theta + ((y.theta - x.theta) * (edge - x.t)) / (y.t - x.t || 1e-9) });
            if (a.t < from) a = clipTo(a, b, from);
            if (b.t < from) b = clipTo(b, a, from);
            if (a.t > to) a = clipTo(a, b, to);
            if (b.t > to) b = clipTo(b, a, to);
            segments.push([surface(a.t, a.theta), surface(b.t, b.theta)]);
          }
        }
      }
    }
    run.rings = { segments, fade, tone: source.rings.tone ?? "lo" };
  }
}

function t3Sides(part, cam, r) {
  const m = cam.m;
  const k = cam.k;
  const n = part.count;
  const out = { n, flat: new Float64Array(2 * n), left: new Float64Array(2 * n), right: new Float64Array(2 * n), shineA: new Float64Array(2 * n), shineB: new Float64Array(2 * n), shadeA: new Float64Array(2 * n), shadeB: new Float64Array(2 * n), frames: [] };
  const half = r * k;
  for (let i = 0; i < n; i++) {
    const x = part.P3[3 * i];
    const y = part.P3[3 * i + 1];
    const z = part.P3[3 * i + 2];
    const px = cam.ox + m[0] * x + m[1] * y + m[2] * z;
    const py = cam.oy + m[3] * x + m[4] * y + m[5] * z;
    const dx = m[0] * part.D3[3 * i] + m[1] * part.D3[3 * i + 1] + m[2] * part.D3[3 * i + 2];
    const dy = m[3] * part.D3[3 * i] + m[4] * part.D3[3 * i + 1] + m[5] * part.D3[3 * i + 2];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    out.flat[2 * i] = px;
    out.flat[2 * i + 1] = py;
    out.frames.push({ p: [px, py], nx, ny, half });
    out.left[2 * i] = px + nx * half;
    out.left[2 * i + 1] = py + ny * half;
    out.right[2 * i] = px - nx * half;
    out.right[2 * i + 1] = py - ny * half;
    const toward = nx * T3_SHINE[0] + ny * T3_SHINE[1];
    const shineAt = half * 0.44 * toward;
    const shineHalf = half * 0.24;
    out.shineA[2 * i] = px + nx * (shineAt + shineHalf);
    out.shineA[2 * i + 1] = py + ny * (shineAt + shineHalf);
    out.shineB[2 * i] = px + nx * (shineAt - shineHalf);
    out.shineB[2 * i + 1] = py + ny * (shineAt - shineHalf);
    const shadeAt = -half * 0.62 * toward;
    const shadeHalf = half * 0.2;
    out.shadeA[2 * i] = px + nx * (shadeAt + shadeHalf);
    out.shadeA[2 * i + 1] = py + ny * (shadeAt + shadeHalf);
    out.shadeB[2 * i] = px + nx * (shadeAt - shadeHalf);
    out.shadeB[2 * i + 1] = py + ny * (shadeAt - shadeHalf);
  }
  return out;
}

const t3Pts = (buf, n) => {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [buf[2 * i], buf[2 * i + 1]];
  return out;
};

function t3TubeCap(cam, centre, tangent, radius, inward) {
  const V = cam.V;
  const m = cam.m;
  let n1 = [tangent[1] * V[2] - tangent[2] * V[1], tangent[2] * V[0] - tangent[0] * V[2], tangent[0] * V[1] - tangent[1] * V[0]];
  if (Math.hypot(n1[0], n1[1], n1[2]) < 1e-6) {
    const helper = Math.abs(tangent[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    n1 = [helper[1] * tangent[2] - helper[2] * tangent[1], helper[2] * tangent[0] - helper[0] * tangent[2], helper[0] * tangent[1] - helper[1] * tangent[0]];
  }
  n1 = t3Unit(n1);
  const n2 = t3Unit([tangent[1] * n1[2] - tangent[2] * n1[1], tangent[2] * n1[0] - tangent[0] * n1[2], tangent[0] * n1[1] - tangent[1] * n1[0]]);
  const steps = 28;
  const proj = (p) => [cam.ox + m[0] * p[0] + m[1] * p[1] + m[2] * p[2], cam.oy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2]];
  const ring = new Array(steps);
  for (let index = 0; index < steps; index++) {
    const angle = (index / steps) * T3_TAU;
    const cs = radius * Math.cos(angle);
    const sn = radius * Math.sin(angle);
    ring[index] = proj([centre[0] + n1[0] * cs + n2[0] * sn, centre[1] + n1[1] * cs + n2[1] * sn, centre[2] + n1[2] * cs + n2[2] * sn]);
  }
  const C = proj(centre);
  const probe = proj([centre[0] + n2[0], centre[1] + n2[1], centre[2] + n2[2]]);
  const along = (probe[0] - C[0]) * inward[0] + (probe[1] - C[1]) * inward[1];
  const from = along > 0 ? steps / 2 : 0;
  const half = (start) => Array.from({ length: steps / 2 + 1 }, (_, index) => ring[(start + index) % steps]);
  return { ring, arc: half(from), inner: half((from + steps / 2) % steps) };
}

function t3StripeEnd(half, centre, nx, ny, from, to) {
  const offset = (p) => (p[0] - centre[0]) * nx + (p[1] - centre[1]) * ny;
  const values = half.map(offset);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const points = [];
  const cross = (k, level) => {
    const t = (level - values[k]) / (values[k + 1] - values[k] || 1e-9);
    return [half[k][0] + (half[k + 1][0] - half[k][0]) * t, half[k][1] + (half[k + 1][1] - half[k][1]) * t];
  };
  for (let k = 0; k < half.length; k++) {
    if (values[k] >= lo && values[k] <= hi) points.push(half[k]);
    if (k < half.length - 1) for (const level of [lo, hi]) if ((values[k] - level) * (values[k + 1] - level) < 0) points.push(cross(k, level));
  }
  return points
    .map((p) => [p, offset(p)])
    .sort((x, y) => (from > to ? y[1] - x[1] : x[1] - y[1]))
    .map(([p]) => p);
}

function t3EmitTube(run, cam, f) {
  const r = run.r;
  const sides = t3Sides(run.body, cam, r);
  const bands = run.stripe === run.body ? sides : t3Sides(run.stripe, cam, r);
  const n = sides.n;
  const left = t3Pts(sides.left, n);
  const right = t3Pts(sides.right, n);
  const loop = left.concat(right.slice().reverse());
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = Math.sign(area);
  let body = t3PathOf(loop, true);
  let edges = t3PathOf(left, false) + t3PathOf(right, false);
  const tips = [null, null];
  const last = n - 1;
  const quads = [];
  for (let i = 0; i < last; i++) quads.push([left[i], left[i + 1], right[i + 1], right[i]]);
  for (const side of [0, 1]) {
    if (!run.capped[side]) continue;
    const at = side ? last : 0;
    const other = side ? last - 1 : 1;
    const tangent = run.tips[side];
    const outward = side ? tangent : [-tangent[0], -tangent[1], -tangent[2]];
    const inward = [sides.flat[2 * other] - sides.flat[2 * at], sides.flat[2 * other + 1] - sides.flat[2 * at + 1]];
    const centre = [run.body.P3[3 * at], run.body.P3[3 * at + 1], run.body.P3[3 * at + 2]];
    const { ring, arc, inner } = t3TubeCap(cam, centre, tangent, r, inward);
    let ringArea = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      ringArea += a[0] * b[1] - b[0] * a[1];
    }
    body += t3PathOf(Math.sign(ringArea) === sign ? ring : ring.slice().reverse(), true);
    edges += t3PathOf(arc, false);
    const V = cam.V;
    const open = outward[0] * V[0] + outward[1] * V[1] + outward[2] * V[2] > 0;
    if (open) edges += t3PathOf(inner, false);
    tips[side] = { half: open ? inner : arc, frame: sides.frames[at] };
    quads.push(ring);
  }
  f.d[run.role.body] = body;
  f.d[run.role.edges] = edges;
  if (run.wide) {
    const toward = (frame) => frame.nx * T3_SHINE[0] + frame.ny * T3_SHINE[1];
    const shineOffsets = (frame) => [frame.half * 0.44 * toward(frame) + frame.half * 0.24, frame.half * 0.44 * toward(frame) - frame.half * 0.24];
    const shadeOffsets = (frame) => [-frame.half * 0.62 * toward(frame) + frame.half * 0.2, -frame.half * 0.62 * toward(frame) - frame.half * 0.2];
    const bn = bands.n;
    const band = (A, B, offsets) => {
      const head = tips[1] ? t3StripeEnd(tips[1].half, tips[1].frame.p, tips[1].frame.nx, tips[1].frame.ny, offsets(tips[1].frame)[0], offsets(tips[1].frame)[1]) : [];
      const tail = tips[0] ? t3StripeEnd(tips[0].half, tips[0].frame.p, tips[0].frame.nx, tips[0].frame.ny, offsets(tips[0].frame)[1], offsets(tips[0].frame)[0]) : [];
      return t3PathOf([...t3Pts(A, bn), ...head, ...t3Pts(B, bn).reverse(), ...tail], true);
    };
    f.d[run.role.shine] = band(bands.shineA, bands.shineB, shineOffsets);
    f.d[run.role.shade] = band(bands.shadeA, bands.shadeB, shadeOffsets);
  }
  if (run.rings) {
    const lines = t3Lines;
    lines.d.length = 0;
    lines.alpha.length = 0;
  lines.key.length = 0;
    lines.key.length = 0;
    const V = cam.V;
    const m = cam.m;
    const seg = new Float64Array(4);
    const surface = (sample, out, index) => {
      const T = sample.T;
      let n1 = [T[1] * V[2] - T[2] * V[1], T[2] * V[0] - T[0] * V[2], T[0] * V[1] - T[1] * V[0]];
      const l1 = Math.hypot(n1[0], n1[1], n1[2]);
      if (l1 < 1e-6) return null;
      n1 = [n1[0] / l1, n1[1] / l1, n1[2] / l1];
      let n2 = t3Unit([T[1] * n1[2] - T[2] * n1[1], T[2] * n1[0] - T[0] * n1[2], T[0] * n1[1] - T[1] * n1[0]]);
      if (n2[0] * V[0] + n2[1] * V[1] + n2[2] * V[2] < 0) n2 = [-n2[0], -n2[1], -n2[2]];
      const cs = Math.cos(sample.theta);
      const sn = Math.sin(sample.theta);
      const normal = [n1[0] * cs + n2[0] * sn, n1[1] * cs + n2[1] * sn, n1[2] * cs + n2[2] * sn];
      const p = [sample.c[0] + normal[0] * r, sample.c[1] + normal[1] * r, sample.c[2] + normal[2] * r];
      out[index] = cam.ox + m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
      out[index + 1] = cam.oy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
      return normal[0] * V[0] + normal[1] * V[1] + normal[2] * V[2];
    };
    const fade = run.rings.fade;
    let index = -1;
    for (const [a, b] of run.rings.segments) {
      index++;
      const fa = surface(a, seg, 0);
      const fb = surface(b, seg, 2);
      if (fa === null || fb === null) continue;
      const alpha = fade ? t3Step(fade[0], fade[1], (fa + fb) / 2) : 1;
      if (alpha * T3_LEVELS < 0.5) continue;
      lines.d.push(t3Path(seg, 2, false));
      lines.alpha.push(alpha);
      lines.key.push(index);
    }
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
  const all = left.concat(right);
  t3BoxOf(all, f.box);
  for (const q of quads) for (const p of q) {
    if (p[0] < f.box[0]) f.box[0] = p[0];
    if (p[1] < f.box[1]) f.box[1] = p[1];
    if (p[0] > f.box[2]) f.box[2] = p[0];
    if (p[1] > f.box[3]) f.box[3] = p[1];
  }
  const list = f.quadList && f.quadList.length === quads.length ? f.quadList : (f.quadList = quads.map(() => [new Float64Array(0), 0]));
  for (let qi = 0; qi < quads.length; qi++) {
    const q = quads[qi];
    let entry = list[qi];
    if (entry[0].length < 2 * q.length) entry[0] = new Float64Array(2 * q.length);
    const buf = entry[0];
    for (let i = 0; i < q.length; i++) {
      buf[2 * i] = q[i][0];
      buf[2 * i + 1] = q[i][1];
    }
    entry[1] = q.length;
  }
  f.quadN = quads.length;
  f.quads = f.quadList;
  f.hullN = 0;
}

function t3Emit(run, cam, out) {
  const f = out ?? t3Frame(run);
  if (run.kind === "prism") t3EmitPrism(run, cam, f);
  else if (run.kind === "round") t3EmitRound(run, cam, f);
  else if (run.kind === "ball") t3EmitBall(run, cam, f);
  else if (run.kind === "lathe") t3EmitLathe(run, cam, f);
  else if (run.kind === "tube") {
    t3EmitTube(run, cam, f);
    return f;
  } else if (run.kind === "fixed") {
    t3EmitFixed(run, cam, f);
    return f;
  }
  t3EmitPlanes(run, cam, f);
  t3EmitDots(run, cam, f);
  return f;
}

function t3Overlap(a, b, pad) {
  return a[0] < b[2] - pad && b[0] < a[2] - pad && a[1] < b[3] - pad && b[1] < a[3] - pad;
}

function t3Apart(A, an, B, bn, pad) {
  for (let pass = 0; pass < 2; pass++) {
    const P = pass ? B : A;
    const pn = pass ? bn : an;
    for (let i = 0; i < pn; i++) {
      const j = (i + 1) % pn;
      const nx = P[2 * j + 1] - P[2 * i + 1];
      const ny = P[2 * i] - P[2 * j];
      const l = Math.hypot(nx, ny);
      if (l < 1e-9) continue;
      let a0 = Infinity;
      let a1 = -Infinity;
      for (let q = 0; q < an; q++) {
        const v = (A[2 * q] * nx + A[2 * q + 1] * ny) / l;
        if (v < a0) a0 = v;
        if (v > a1) a1 = v;
      }
      let b0 = Infinity;
      let b1 = -Infinity;
      for (let q = 0; q < bn; q++) {
        const v = (B[2 * q] * nx + B[2 * q + 1] * ny) / l;
        if (v < b0) b0 = v;
        if (v > b1) b1 = v;
      }
      if (a1 < b0 + pad || b1 < a0 + pad) return true;
    }
  }
  return false;
}

function t3Disjoint(fa, fb, pad) {
  const qa = fa.quadN ? fa.quads : null;
  const qb = fb.quadN ? fb.quads : null;
  if (!qa && !qb) return t3Apart(fa.hull, fa.hullN, fb.hull, fb.hullN, pad);
  const listA = qa ? fa.quadList : [[fa.hull, fa.hullN]];
  const listB = qb ? fb.quadList : [[fb.hull, fb.hullN]];
  for (const [A, an] of listA) for (const [B, bn] of listB) if (!t3Apart(A, an, B, bn, pad)) return false;
  return true;
}

function t3Support(cloud, R, t, dir, world) {
  let best = -Infinity;
  let at = 0;
  const n = cloud.length / 3;
  const dx = R[0] * dir[0] + R[3] * dir[1] + R[6] * dir[2];
  const dy = R[1] * dir[0] + R[4] * dir[1] + R[7] * dir[2];
  const dz = R[2] * dir[0] + R[5] * dir[1] + R[8] * dir[2];
  for (let i = 0; i < n; i++) {
    const v = cloud[3 * i] * dx + cloud[3 * i + 1] * dy + cloud[3 * i + 2] * dz;
    if (v > best) {
      best = v;
      at = i;
    }
  }
  const x = cloud[3 * at];
  const y = cloud[3 * at + 1];
  const z = cloud[3 * at + 2];
  world[0] = R[0] * x + R[1] * y + R[2] * z + t[0];
  world[1] = R[3] * x + R[4] * y + R[5] * z + t[1];
  world[2] = R[6] * x + R[7] * y + R[8] * z + t[2];
  return best + dir[0] * t[0] + dir[1] * t[1] + dir[2] * t[2];
}

function t3Gjk(cloudA, camA, cloudB, camB, warm, rounds = 8, hints = null) {
  let w = warm && (warm[0] || warm[1] || warm[2]) ? [warm[0], warm[1], warm[2]] : null;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  if (!w) {
    t3Support(cloudA, camA.R, camA.t, [1, 0, 0], a);
    t3Support(cloudB, camB.R, camB.t, [-1, 0, 0], b);
    w = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  }
  let margin = -Infinity;
  let best = w;
  const step = (limit) => {
    for (let it = 0; it < limit; it++) {
      const l = Math.hypot(w[0], w[1], w[2]);
      if (l < 1e-12) break;
      const n = [w[0] / l, w[1] / l, w[2] / l];
      const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
      const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
      const value = loB - hiA;
      if (value > margin) {
        margin = value;
        best = n;
      }
      const s = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ds = [w[0] - s[0], w[1] - s[1], w[2] - s[2]];
      const dd = ds[0] * ds[0] + ds[1] * ds[1] + ds[2] * ds[2];
      if (dd < 1e-14) break;
      const tt = Math.max(0, Math.min(1, (w[0] * ds[0] + w[1] * ds[1] + w[2] * ds[2]) / dd));
      w = [w[0] - ds[0] * tt, w[1] - ds[1] * tt, w[2] - ds[2] * tt];
    }
  };
  step(rounds);
  if (margin < 0) step(24);
  if (margin < 0.05 && hints) {
    if (hints.centroids) {
      const [ca, cb] = hints.centroids;
      const wa = [camA.R[0] * ca[0] + camA.R[1] * ca[1] + camA.R[2] * ca[2] + camA.t[0], camA.R[3] * ca[0] + camA.R[4] * ca[1] + camA.R[5] * ca[2] + camA.t[1], camA.R[6] * ca[0] + camA.R[7] * ca[1] + camA.R[8] * ca[2] + camA.t[2]];
      const wb = [camB.R[0] * cb[0] + camB.R[1] * cb[1] + camB.R[2] * cb[2] + camB.t[0], camB.R[3] * cb[0] + camB.R[4] * cb[1] + camB.R[5] * cb[2] + camB.t[1], camB.R[6] * cb[0] + camB.R[7] * cb[1] + camB.R[8] * cb[2] + camB.t[2]];
      const n = t3Unit([wb[0] - wa[0], wb[1] - wa[1], wb[2] - wa[2]]);
      const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
      const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
      if (loB - hiA > margin) {
        margin = loB - hiA;
        best = n;
      }
    }
    for (const [axis, cam] of hints) {
      const R = cam.R;
      const w0 = [R[0] * axis[0] + R[1] * axis[1] + R[2] * axis[2], R[3] * axis[0] + R[4] * axis[1] + R[5] * axis[2], R[6] * axis[0] + R[7] * axis[1] + R[8] * axis[2]];
      for (const sign of [1, -1]) {
        const n = [w0[0] * sign, w0[1] * sign, w0[2] * sign];
        const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
        const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
        if (loB - hiA > margin) {
          margin = loB - hiA;
          best = n;
        }
      }
    }
  }
  const l = Math.hypot(best[0], best[1], best[2]) || 1;
  return { n: [best[0] / l, best[1] / l, best[2] / l], margin };
}

function t3Order(layer, frames, cams, previous, stats, scene) {
  const parts = layer.parts;
  const count = parts.length;
  const local = layer.local;
  const rank = layer._rank ?? (layer._rank = new Int32Array(count));
  if (previous) for (let at = 0; at < count; at++) rank[local.get(previous[at])] = at;
  else for (let at = 0; at < count; at++) rank[local.get(layer.rest[at])] = at;
  let groupEdges = 0;
  if (layer.groupPairs) for (const gp of layer.groupPairs) groupEdges += gp.a.length * gp.b.length;
  const maxEdges = layer.planar.length / 5 + (layer.framed ? layer.framed.length / 6 : 0) + groupEdges + layer.dynamic.length / 2 + (layer.free ? layer.free.length * count : 0) + 1;
  const head = layer._head ?? (layer._head = new Int32Array(count));
  const next = layer._next && layer._next.length >= maxEdges ? layer._next : (layer._next = new Int32Array(maxEdges));
  const to = layer._to && layer._to.length >= maxEdges ? layer._to : (layer._to = new Int32Array(maxEdges));
  const live = layer._live && layer._live.length >= maxEdges ? layer._live : (layer._live = new Uint8Array(maxEdges));
  const indeg = layer._indeg ?? (layer._indeg = new Int32Array(count));
  head.fill(-1);
  indeg.fill(0);
  let edges = 0;
  const addEdge = (back, front) => {
    to[edges] = front;
    next[edges] = head[back];
    live[edges] = 1;
    head[back] = edges;
    indeg[front]++;
    edges++;
  };
  const runs = scene ? scene.runs : null;
  const groupOf = (global) => (runs ? runs[global].group : -1);
  const planar = layer.planar;
  for (let p = 0; p < planar.length; p += 5) {
    const i = planar[p];
    const j = planar[p + 1];
    const fi = frames[i];
    const fj = frames[j];
    if (!t3Overlap(fi.box, fj.box, -0.05)) continue;
    const g = groupOf(i);
    const V = g >= 0 ? cams[g].V : cams.world.V;
    const s = planar[p + 2] * V[0] + planar[p + 3] * V[1] + planar[p + 4] * V[2];
    if (s < 1e-7 && s > -1e-7) continue;
    const li = local.get(i);
    const lj = local.get(j);
    if (s > 0) addEdge(li, lj);
    else addEdge(lj, li);
  }
  const framed = layer.framed;
  if (framed)
    for (let p = 0; p < framed.length; p += 6) {
      const i = framed[p];
      const j = framed[p + 1];
      if (!t3Overlap(frames[i].box, frames[j].box, -0.05)) continue;
      const g = framed[p + 2];
      const V = g >= 0 ? cams[g].V : cams.world.V;
      const s = framed[p + 3] * V[0] + framed[p + 4] * V[1] + framed[p + 5] * V[2];
      if (s < 1e-7 && s > -1e-7) continue;
      const li = local.get(i);
      const lj = local.get(j);
      if (s > 0) addEdge(li, lj);
      else addEdge(lj, li);
    }
  if (layer.groupPairs)
    for (const gp of layer.groupPairs) {
      const union = (list, box) => {
        box[0] = Infinity;
        box[1] = Infinity;
        box[2] = -Infinity;
        box[3] = -Infinity;
        for (let q = 0; q < list.length; q++) {
          const b = frames[list[q]].box;
          if (b[0] < box[0]) box[0] = b[0];
          if (b[1] < box[1]) box[1] = b[1];
          if (b[2] > box[2]) box[2] = b[2];
          if (b[3] > box[3]) box[3] = b[3];
        }
      };
      union(gp.a, gp.boxA);
      union(gp.b, gp.boxB);
      if (!t3Overlap(gp.boxA, gp.boxB, -0.05)) continue;
      const V = gp.frame >= 0 ? cams[gp.frame].V : cams.world.V;
      const s = gp.n[0] * V[0] + gp.n[1] * V[1] + gp.n[2] * V[2];
      if (s < 1e-7 && s > -1e-7) continue;
      for (let x = 0; x < gp.a.length; x++) {
        const i = gp.a[x];
        const bi = frames[i].box;
        if (!t3Overlap(bi, gp.boxB, -0.05)) continue;
        for (let y = 0; y < gp.b.length; y++) {
          const j = gp.b[y];
          if (!t3Overlap(bi, frames[j].box, -0.05)) continue;
          if (s > 0) addEdge(local.get(i), local.get(j));
          else addEdge(local.get(j), local.get(i));
        }
      }
    }
  const dynamic = layer.dynamic;
  let unseparated = 0;
  let solved = 0;
  const rel = layer.rel ?? (layer.rel = new Map());
  const cross = (i, j) => {
    const ri = runs[i];
    const rj = runs[j];
    const ci = ri.group >= 0 ? cams[ri.group] : cams.world;
    const cj = rj.group >= 0 ? cams[rj.group] : cams.world;
    const A = ci.R;
    const B = cj.R;
    const dx = cj.t[0] - ci.t[0];
    const dy = cj.t[1] - ci.t[1];
    const dz = cj.t[2] - ci.t[2];
    const key = i * 65536 + j;
    let memo = rel.get(key);
    if (!memo) {
      memo = { pose: new Float64Array(12), n: [0, 0, 0], margin: -Infinity, fresh: false };
      rel.set(key, memo);
    }
    const pose = memo.pose;
    let same = memo.fresh;
    let at = 0;
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) {
        const v = A[c] * B[r] + A[3 + c] * B[3 + r] + A[6 + c] * B[6 + r];
        if (same && Math.abs(pose[at] - v) > 1e-12) same = false;
        pose[at++] = v;
      }
    for (let c = 0; c < 3; c++) {
      const v = A[c] * dx + A[3 + c] * dy + A[6 + c] * dz;
      if (same && Math.abs(pose[at] - v) > 1e-9) same = false;
      pose[at++] = v;
    }
    let nx;
    let ny;
    let nz;
    if (same) {
      const n = memo.n;
      nx = A[0] * n[0] + A[1] * n[1] + A[2] * n[2];
      ny = A[3] * n[0] + A[4] * n[1] + A[5] * n[2];
      nz = A[6] * n[0] + A[7] * n[1] + A[8] * n[2];
    } else {
      const n = memo.n;
      const warm = memo.fresh ? [A[0] * n[0] + A[1] * n[1] + A[2] * n[2], A[3] * n[0] + A[4] * n[1] + A[5] * n[2], A[6] * n[0] + A[7] * n[1] + A[8] * n[2]] : null;
      const hints = [...ri.axes.map((axis) => [axis, ci]), ...rj.axes.map((axis) => [axis, cj]), [[0, 0, 1], cams.world]];
      hints.centroids = [ri.centroid, rj.centroid];
      const hit = t3Gjk(ri.cloud, ci, rj.cloud, cj, warm, 8, hints);
      solved++;
      nx = hit.n[0];
      ny = hit.n[1];
      nz = hit.n[2];
      n[0] = A[0] * nx + A[3] * ny + A[6] * nz;
      n[1] = A[1] * nx + A[4] * ny + A[7] * nz;
      n[2] = A[2] * nx + A[5] * ny + A[8] * nz;
      memo.margin = hit.margin;
      memo.fresh = true;
    }
    if (memo.margin < -0.08) unseparated++;
    const V = cams.world.V;
    return nx * V[0] + ny * V[1] + nz * V[2];
  };
  for (let p = 0; p < dynamic.length; p += 2) {
    const i = dynamic[p];
    const j = dynamic[p + 1];
    if (!t3Overlap(frames[i].box, frames[j].box, -0.05)) continue;
    const s = cross(i, j);
    if (s < 1e-7 && s > -1e-7) continue;
    const li = local.get(i);
    const lj = local.get(j);
    if (s > 0) addEdge(li, lj);
    else addEdge(lj, li);
  }
  const loose = layer.free;
  if (loose && loose.length) {
    const isLoose = layer.looseAt;
    for (let a = 0; a < loose.length; a++) {
      const i = loose[a];
      const gi = runs[i].group;
      const bi = frames[i].box;
      for (let b = 0; b < count; b++) {
        const j = parts[b];
        if (j === i || runs[j].group === gi) continue;
        if (isLoose[b] && j < i) continue;
        if (!t3Overlap(bi, frames[j].box, -0.05)) continue;
        const s = cross(i, j);
        if (s < 1e-7 && s > -1e-7) continue;
        const li = local.get(i);
        if (s > 0) addEdge(li, b);
        else addEdge(b, li);
      }
    }
  }
  const heap = layer._heap ?? (layer._heap = new Int32Array(count));
  const done = layer._done ?? (layer._done = new Uint8Array(count));
  done.fill(0);
  let size = 0;
  const less = (a, b) => rank[a] < rank[b];
  const push = (v) => {
    let i = size++;
    heap[i] = v;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      const tmp = heap[i];
      heap[i] = heap[p];
      heap[p] = tmp;
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--size];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let s = i;
      if (l < size && less(heap[l], heap[s])) s = l;
      if (r < size && less(heap[r], heap[s])) s = r;
      if (s === i) break;
      const tmp = heap[i];
      heap[i] = heap[s];
      heap[s] = tmp;
      i = s;
    }
    return top;
  };
  for (let v = 0; v < count; v++) if (indeg[v] === 0) push(v);
  const out = new Int32Array(count);
  let placed = 0;
  let forced = 0;
  let refined = 0;
  const checked = layer._checked && layer._checked.length >= maxEdges ? layer._checked : (layer._checked = new Uint8Array(maxEdges));
  checked.fill(0, 0, edges);
  const sourcePick = () => {
    // Iterative Kosaraju: one SCC/condensation computation per empty-heap event.
    // O(V + E) time and space; no recursive call stack or repeated cycle search.
    const seen = new Uint8Array(count);
    const cursor = new Int32Array(count);
    const stack = new Int32Array(count);
    const finish = [];
    const reverseHead = new Int32Array(count).fill(-1);
    const reverseNext = new Int32Array(edges);
    const from = new Int32Array(edges);
    for (let v = 0; v < count; v++) if (!done[v]) {
      for (let e = head[v]; e >= 0; e = next[e]) if (live[e] && !done[to[e]]) {
        from[e] = v;
        reverseNext[e] = reverseHead[to[e]];
        reverseHead[to[e]] = e;
      }
    }
    for (let root = 0; root < count; root++) {
      if (done[root] || seen[root]) continue;
      let top = 0;
      stack[top++] = root;
      seen[root] = 1;
      cursor[root] = head[root];
      while (top) {
        const v = stack[top - 1];
        let e = cursor[v];
        while (e >= 0 && (!live[e] || done[to[e]] || seen[to[e]])) e = next[e];
        cursor[v] = e < 0 ? -1 : next[e];
        if (e < 0) {
          finish.push(v);
          top--;
        } else {
          const w = to[e];
          seen[w] = 1;
          cursor[w] = head[w];
          stack[top++] = w;
        }
      }
    }
    const component = new Int32Array(count).fill(-1);
    let components = 0;
    for (let at = finish.length - 1; at >= 0; at--) {
      const root = finish[at];
      if (component[root] >= 0) continue;
      let top = 0;
      stack[top++] = root;
      component[root] = components;
      while (top) {
        const v = stack[--top];
        for (let e = reverseHead[v]; e >= 0; e = reverseNext[e]) {
          const w = from[e];
          if (component[w] >= 0) continue;
          component[w] = components;
          stack[top++] = w;
        }
      }
      components++;
    }
    const incoming = new Uint8Array(components);
    for (let v = 0; v < count; v++) if (!done[v]) {
      for (let e = head[v]; e >= 0; e = next[e]) if (live[e] && !done[to[e]] && component[v] !== component[to[e]]) incoming[component[to[e]]] = 1;
    }
    let pick = -1;
    for (let v = 0; v < count; v++) if (!done[v] && !incoming[component[v]] && (pick < 0 || indeg[v] < indeg[pick] || (indeg[v] === indeg[pick] && rank[v] < rank[pick]))) pick = v;
    return pick;
  };
  while (placed < count) {
    if (size === 0) {
      // O(V + E) per event; each initial edge is tested at most once per order.
      for (let a = 0; a < count; a++) if (!done[a]) {
        for (let e = head[a]; e >= 0; e = next[e]) {
          const b = to[e];
          if (!live[e] || done[b] || checked[e]) continue;
          checked[e] = 1;
          if (t3Disjoint(frames[parts[a]], frames[parts[b]], 0.1)) {
            live[e] = 0;
            indeg[b]--;
            refined++;
            if (indeg[b] === 0) push(b);
          }
        }
      }
      if (size) continue;
      // A source component cannot be an acyclic singleton: heap is empty.
      const pick = sourcePick();
      forced++;
      indeg[pick] = 0;
      push(pick);
    }
    const v = pop();
    if (done[v]) continue;
    done[v] = 1;
    out[placed++] = parts[v];
    for (let e = head[v]; e >= 0; e = next[e]) {
      if (!live[e]) continue;
      const w = to[e];
      if (done[w]) continue;
      if (--indeg[w] === 0) push(w);
    }
  }
  if (stats) {
    stats.edges = (stats.edges ?? 0) + edges;
    stats.forced = (stats.forced ?? 0) + forced;
    stats.refined = (stats.refined ?? 0) + refined;
    stats.unseparated = (stats.unseparated ?? 0) + unseparated;
    stats.solved = (stats.solved ?? 0) + solved;
  }
  return out;
}

function t3Keep(values) {
  const n = values.length;
  const tails = [];
  const tailAt = [];
  const back = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < values[i]) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = values[i];
    tailAt[lo] = i;
    back[i] = lo > 0 ? tailAt[lo - 1] : -1;
  }
  const keep = new Uint8Array(n);
  let k = tails.length ? tailAt[tails.length - 1] : -1;
  while (k >= 0) {
    keep[k] = 1;
    k = back[k];
  }
  return keep;
}

function t3Cams(scene, values) {
  const poses = t3Poses(scene.groups, values);
  const cams = poses.map((pose) => t3Camera(scene.P, pose));
  cams.world = t3Camera(scene.P, null);
  cams.poses = poses;
  return cams;
}

function t3Mount(stage, data, { onHold = null, onFrame = null, follow = null, painter = "svg", geometryTransactions = false } = {}) {
  const sourcePacket = data;
  if (geometryTransactions) data = structuredClone(data);
  void painter;
  const layerEls = new Map([...stage.querySelectorAll("svg[data-live]")].map((svg) => [svg.dataset.live, svg]));
  const first = layerEls.values().next().value;
  const viewWidth = first && first.viewBox && first.viewBox.baseVal ? first.viewBox.baseVal.width : 0;
  const unitOf = () => {
    const width = first ? first.getBoundingClientRect().width : 0;
    return viewWidth && width ? Math.round((width / viewWidth) * 100) / 100 : 1;
  };
  let unit = unitOf();
  let scene = t3Prepare(data, { unit });
  const runs = () => scene.runs;
  const count = data.parts.length;
  const nodes = new Array(count);
  const bound = new Array(count);
  const cache = new Array(count);
  const containers = new Map();
  for (const [name, svg] of layerEls) containers.set(name, svg.querySelector(".iso-parts") ?? svg);
  for (const run of scene.runs) {
    const layer = data.layers[run.layer];
    const container = containers.get(layer.name);
    const node = container ? container.querySelector(`[data-p="${run.index}"]`) : null;
    nodes[run.index] = node;
    const map = {};
    if (node) {
      map.move = node;
      node.querySelectorAll("[data-r]").forEach((el) => (map[el.getAttribute("data-r")] = el));
    }
    bound[run.index] = run.roles.map((role) => map[role.name] ?? null);
    cache[run.index] = run.roles.map(() => ({ d: null, q: null, b: null, f: null, w: null, t: null, o: null, cx: null, cy: null }));
  }
  // Capture authored literals before the constructor writes; null, empty and compact CSS are distinct.
  const authoredStyles = geometryTransactions ? bound.map((els) => els.map((el) => el ? el.getAttribute("style") : null)) : null;
  // One detached style declaration per opt-in mounter, never appended or used as a reference scene.
  const styleScratch = geometryTransactions && first ? first.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path") : null;
  let frames = scene.runs.map((run) => t3Frame(run));
  const values = Object.fromEntries(data.groups.map((g) => [g.name, data.values ? data.values[g.name] ?? 0 : 0]));
  let lastPoses = null;
  let cams = null;
  const orders = scene.layers.map((layer) => Int32Array.from(layer.rest));
  const changes = [];
  const stats = { ms: 0, writes: 0, moved: 0, forced: 0, refined: 0, unseparated: 0, emitted: 0 };
  let writes = 0;
  const writeFaceStyle = (el, memo, q, w) => {
    let changed = 0;
    if (memo.q !== q) {
      const band = Math.min(3, Math.floor(q / T3_Q)), mix = (q - T3_Q * band) / T3_Q;
      if (memo.f !== mix) {
        if (mix) el.style.setProperty("--f", String(mix));
        else el.style.removeProperty("--f");
        memo.f = mix;
        changed++;
      }
      memo.q = q;
    }
    if (memo.w !== w) {
      if (w < 0) el.style.removeProperty("stroke-width");
      else el.style.strokeWidth = String(w);
      memo.w = w;
      changed++;
    }
    return changed;
  };
  const write = (index) => {
    const run = scene.runs[index];
    const f = frames[index];
    const els = bound[index];
    const memo = cache[index];
    for (let r = 0; r < run.roles.length; r++) {
      const el = els[r];
      if (!el) continue;
      const role = run.roles[r];
      const c = memo[r];
      const type = role.type;
      if (type === "path" || type === "face" || type === "slot") {
        const d = f.d[r];
        if (c.d !== d) {
          el.setAttribute("d", d);
          c.d = d;
          writes++;
        }
        if (type === "face") {
          const q = f.q[r];
          if (c.q !== q) {
            const band = Math.min(3, Math.floor(q / T3_Q));
            if (c.b !== band) {
              el.setAttribute("data-b", String(band));
              c.b = band;
              writes++;
            }
          }
          writes += writeFaceStyle(el, c, q, f.w[r]);
        } else if (type === "slot") {
          const o = f.o[r];
          if (c.o !== o) {
            el.setAttribute("opacity", String(Math.round(o * 1000) / 1000));
            c.o = o;
            writes++;
          }
        }
      } else if (type === "xform" || type === "self" || type === "plane") {
        const t = f.t[r];
        if (c.t !== t) {
          if (t) el.setAttribute("transform", t);
          else el.removeAttribute("transform");
          c.t = t;
          writes++;
        }
        if (type === "plane") {
          const o = f.o[r];
          if (c.o !== o) {
            el.setAttribute("opacity", String(o));
            c.o = o;
            writes++;
          }
        }
      } else if (type === "dot") {
        const x = Math.round(f.cx[r] * 100) / 100;
        const y = Math.round(f.cy[r] * 100) / 100;
        const o = f.o[r];
        if (c.cx !== x) {
          el.setAttribute("cx", String(x));
          c.cx = x;
          writes++;
        }
        if (c.cy !== y) {
          el.setAttribute("cy", String(y));
          c.cy = y;
          writes++;
        }
        if (c.o !== o) {
          el.setAttribute("fill-opacity", String(o));
          c.o = o;
          writes++;
        }
      }
    }
  };
  const samePose = (a, b) => {
    if (!a || !b) return false;
    for (let i = 0; i < 9; i++) if (a.R[i] !== b.R[i]) return false;
    return a.t[0] === b.t[0] && a.t[1] === b.t[1] && a.t[2] === b.t[2];
  };
  let lastUnit = unit;
  let moved = 0;
  const evaluate = (targetScene, targetFrames, targetValues, previousOrders, previousPoses, fresh, targetDetail) => {
    const savedDetail = t3State.detail;
    try {
      const targetCams = t3Cams(targetScene, targetValues);
      t3State.detail = targetDetail;
      const poses = targetCams.poses;
      const emitted = [];
      for (const run of targetScene.runs) {
        const g = run.group;
        const changed = fresh || (g >= 0 ? !samePose(poses[g], previousPoses[g]) : false);
        if (!changed) continue;
        t3Emit(run, g >= 0 ? targetCams[g] : targetCams.world, targetFrames[run.index]);
        emitted.push(run.index);
      }
      const orderStats = { forced: 0, refined: 0, unseparated: 0, edges: 0 };
      const targetOrders = targetScene.layers.map((layer, index) =>
        t3Order(layer, targetFrames, targetCams, previousOrders[index], orderStats, targetScene));
      return { cams: targetCams, poses, emitted, orders: targetOrders, orderStats };
    } finally {
      t3State.detail = savedDetail;
    }
  };
  const reconcile = (evaluated = null) => {
    const t0 = performance.now();
    writes = 0;
    moved = 0;
    const result = evaluated ?? evaluate(scene, frames, values, orders, lastPoses, lastUnit !== unit || !lastPoses, detail);
    cams = result.cams;
    for (const index of result.emitted) {
      write(index);
      if (result.styleLiterals) for (let r = 0; r < scene.runs[index].roles.length; r++) {
        if (scene.runs[index].roles[r].type !== "face") continue;
        const el = bound[index][r];
        if (!el) continue;
        const literal = result.styleLiterals[index][r];
        if (el.getAttribute("style") !== literal) {
          if (literal === null) el.removeAttribute("style");
          else el.setAttribute("style", literal);
          writes++;
        }
      }
    }
    const emitted = result.emitted.length;
    lastPoses = result.poses;
    lastUnit = unit;
    const orderStats = result.orderStats;
    scene.layers.forEach((layer, index) => {
      const previous = orders[index];
      const order = result.orders[index];
      let same = true;
      for (let j = 0; j < order.length; j++)
        if (order[j] !== previous[j]) {
          same = false;
          break;
        }
      if (same) return;
      const container = containers.get(layer.name);
      const position = new Map();
      previous.forEach((global, at) => position.set(global, at));
      const keep = t3Keep(Array.from(order, (global) => position.get(global)));
      let after = null;
      const shifted = [];
      for (let j = order.length - 1; j >= 0; j--) {
        const node = nodes[order[j]];
        if (!keep[j] && node && container) {
          container.insertBefore(node, after);
          moved++;
          shifted.push(scene.runs[order[j]].name);
        }
        if (node) after = node;
      }
      orders[index] = order;
      if (shifted.length) changes.push({ layer: layer.name, moved: shifted });
    });
    stats.ms = performance.now() - t0;
    stats.writes = writes;
    stats.moved = moved;
    stats.forced = orderStats.forced;
    stats.refined = orderStats.refined;
    stats.unseparated = orderStats.unseparated;
    stats.emitted = emitted;
    if (onFrame) onFrame(controller);
    return { ...stats };
  };
  // The public render entry point must not accept a caller-provided evaluated frame/order.
  const render = () => reconcile();
  let detail = 1;
  const set = (next, options) => {
    if (options && options.detail !== undefined) {
      const value = Math.max(0, Math.min(1, options.detail));
      if (value !== detail) {
        detail = value;
        lastPoses = null;
      }
    }
    if (typeof next === "number") {
      const g = data.groups.find((group) => group.kind === "turn");
      if (g) values[g.name] = next;
    } else if (next) for (const [name, value] of Object.entries(next)) values[name] = value;
    if (follow) Object.assign(values, follow({ ...values }));
    return render();
  };
  // Opt-in only: accepted geometry never aliases the caller-owned source packet.
  const failGeometry = (reason) => { throw new Error("refreshGeometry: " + reason); };
  const finiteVector = (v, n) => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === n && Array.from(v).every(Number.isFinite);
  const validateValues = (packet, next) => {
    if (!next || typeof next !== "object" || Array.isArray(next)) failGeometry("expected group values");
    for (const [name, value] of Object.entries(next)) {
      const group = packet.groups.find((g) => g.name === name);
      if (!group) failGeometry("unknown group");
      if (group.kind !== "free" || typeof value !== "object" || value === null) {
        if (!Number.isFinite(value)) failGeometry("invalid group value");
        continue;
      }
      if (Array.isArray(value) || Object.keys(value).some((key) => !["R", "q", "axis", "angle", "t", "world"].includes(key))) failGeometry("invalid free pose");
      for (const [key, n] of [["R", 9], ["q", 4], ["axis", 3], ["t", 3]])
        if (key in value && !finiteVector(value[key], n)) failGeometry("invalid free vector");
      if (("angle" in value && !Number.isFinite(value.angle)) || ("world" in value && typeof value.world !== "boolean")) failGeometry("invalid free pose scalar");
    }
  };
  const geometrySignature = (packet) => JSON.stringify({
    ...packet,
    parts: packet.parts.map((part) => {
      if (part.kind !== "prism") return part;
      const spec = { ...part.spec };
      const ring = spec.ring;
      if (!Array.isArray(ring) || ring.length < 6 || ring.length % 2 || !ring.every(Number.isFinite)) failGeometry("invalid ring");
      // Native up=1 uses z0/z1; up=0 uses F/s0/s1. Only ring and up=1 z coordinates are mutable.
      const required = spec.up ? ["z0", "z1"] : ["s0", "s1"];
      for (const key of required) if (!Object.hasOwn(spec, key) || !Number.isFinite(spec[key])) failGeometry("missing/nonfinite " + key);
      if (!spec.up && (!spec.F || ["o", "a", "u", "v"].some((key) => !finiteVector(spec.F[key], 3)))) failGeometry("invalid prism frame");
      spec.ring = { length: ring.length };
      if (spec.up) { spec.z0 = "finite"; spec.z1 = "finite"; }
      return { ...part, spec };
    }),
  });
  const fixedGeometrySignature = geometryTransactions ? geometrySignature(data) : null;
  const evaluateStyles = (targetScene, targetFrames, emitted, prior = null) => {
    if (!styleScratch) return null;
    const state = prior ?? {
      literals: authoredStyles.map((roles) => roles.slice()),
      memo: targetScene.runs.map((run) => run.roles.map(() => ({ q: null, f: null, w: null }))),
    };
    for (const index of emitted) {
      const run = targetScene.runs[index], f = targetFrames[index];
      for (let r = 0; r < run.roles.length; r++) {
        if (run.roles[r].type !== "face" || !bound[index][r]) continue;
        const literal = state.literals[index][r];
        if (literal === null) styleScratch.removeAttribute("style");
        else styleScratch.setAttribute("style", literal);
        writeFaceStyle(styleScratch, state.memo[index][r], f.q[r], f.w[r]);
        state.literals[index][r] = styleScratch.getAttribute("style");
      }
    }
    return state;
  };
  const validateComputed = (nextFrames, nextCams) => {
    const finite = (v) => {
      if (typeof v === "number") return Number.isFinite(v);
      if (typeof v === "string") return !/NaN|Infinity/.test(v);
      if (!v || typeof v !== "object") return true;
      return Object.values(v).every(finite);
    };
    if (!finite(nextFrames) || !finite(nextCams)) failGeometry("nonfinite computed frame/camera");
  };
  const refreshGeometry = (nextGroupValues, options) => {
    if (!geometryTransactions) failGeometry("mount requires geometryTransactions:true");
    const packet = structuredClone(sourcePacket);
    if (geometrySignature(packet) !== fixedGeometrySignature) failGeometry("fixed topology/metadata changed");
    const prepared = t3Prepare(packet, { unit });
    if (prepared.runs.length !== scene.runs.length || prepared.runs.some((run, i) => {
      const old = scene.runs[i];
      return run.index !== old.index || run.name !== old.name || run.group !== old.group || run.layer !== old.layer ||
        run.roles.length !== old.roles.length || run.roles.some((role, j) => role.name !== old.roles[j].name || role.type !== old.roles[j].type);
    })) failGeometry("prepared role topology changed");
    const nextFrames = prepared.runs.map((run) => t3Frame(run));
    const nextValues = Object.fromEntries(packet.groups.map((g) => [g.name, packet.values ? packet.values[g.name] ?? 0 : 0]));
    validateValues(packet, nextValues);
    if (follow) Object.assign(nextValues, follow({ ...nextValues }));
    validateValues(packet, nextValues);
    const construction = evaluate(prepared, nextFrames, nextValues, prepared.layers.map((layer) => Int32Array.from(layer.rest)), null, true, 1);
    validateComputed(nextFrames, construction.cams);
    const constructionStyles = evaluateStyles(prepared, nextFrames, construction.emitted);
    if (nextGroupValues != null) {
      validateValues(packet, nextGroupValues);
      Object.assign(nextValues, structuredClone(nextGroupValues));
    }
    if (follow) Object.assign(nextValues, follow({ ...nextValues }));
    validateValues(packet, nextValues);
    const achievedDetail = options && options.detail !== undefined ? Math.max(0, Math.min(1, options.detail)) : detail;
    if (!Number.isFinite(achievedDetail)) failGeometry("invalid detail");
    const achieved = evaluate(prepared, nextFrames, nextValues, construction.orders, construction.poses, achievedDetail !== 1, achievedDetail);
    validateComputed(nextFrames, achieved.cams);
    const achievedStyles = evaluateStyles(prepared, nextFrames, achieved.emitted, constructionStyles);
    achieved.styleLiterals = achievedStyles ? achievedStyles.literals : null;
    // Commit only after both phases validate. Existing writer/cache/bindings/LIS remain authoritative.
    data = packet;
    scene = prepared;
    frames = nextFrames;
    detail = achievedDetail;
    Object.keys(values).forEach((key) => delete values[key]);
    Object.assign(values, nextValues);
    achieved.emitted = prepared.runs.map((run) => run.index);
    return reconcile(achieved);
  };
  let unwrap = new Map();
  const angleAt = (clientX, clientY, z = 0, groupName) => {
    const svg = first;
    const box = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = vb.x + ((clientX - box.left) / box.width) * vb.width;
    const y = vb.y + ((clientY - box.top) / box.height) * vb.height;
    const c = t3Camera(scene.P, null);
    const p = (x - c.ox) / c.k;
    const q = (y - c.oy + z * c.ce * c.k) / (c.se * c.k);
    const wx = p * c.sa + q * c.ca;
    const wy = -p * c.ca + q * c.sa;
    const group = data.groups.find((g) => g.name === groupName) ?? data.groups.find((g) => g.kind === "turn");
    const pivot = group ? group.origin : [0, 0, 0];
    const raw = (Math.atan2(wy - pivot[1], wx - pivot[0]) * 180) / Math.PI;
    const key = group ? group.name : "";
    const last = unwrap.get(key);
    let angle = raw;
    if (last !== undefined) angle = last + ((((raw - last) % 360) + 540) % 360) - 180;
    unwrap.set(key, angle);
    return angle;
  };
  const observer = typeof ResizeObserver === "function" && first
    ? new ResizeObserver(() => {
        const next = unitOf();
        if (Math.abs(next - unit) < 0.05) return;
        unit = next;
        scene = t3Prepare(data, { unit });
        render();
      })
    : null;
  if (observer) observer.observe(first);
  if (follow) Object.assign(values, follow({ ...values }));
  const controller = {
    refreshGeometry,
    set,
    render,
    angleAt,
    get values() {
      return { ...values };
    },
    cover: (names, options) => t3Cover(controller, names, options),
    order: (name) => {
      const index = name === undefined ? 0 : scene.layers.findIndex((layer) => layer.name === name);
      return index < 0 ? [] : Array.from(orders[index], (global) => scene.runs[global].name);
    },
    orderIndex: (name) => {
      const index = name === undefined ? 0 : scene.layers.findIndex((layer) => layer.name === name);
      return index < 0 ? null : orders[index];
    },
    events: () => changes.splice(0, changes.length),
    stats: () => ({ ...stats }),
    frames: () => frames,
    cams: () => cams,
    scene: () => scene,
    pose: (name) => t3PoseOf(scene, cams, name),
    detach: (name) => {
      const index = scene.groups.findIndex((g) => g.name === name);
      const pose = t3PoseOf(scene, cams, name);
      const o = scene.groups[index].origin;
      return { world: true, R: pose.R, t: [pose.t[0] - o[0], pose.t[1] - o[1], pose.t[2] - o[2]] };
    },
    anchor: (name, point, direction) => t3Anchor(scene, cams, name, point, direction),
    destroy: () => {
      if (observer) observer.disconnect();
      if (typeof window !== "undefined" && window.__isoTurn && window.__isoTurn.controller === controller) delete window.__isoTurn;
    },
  };
  const hold = () => {
    if (onHold) onHold();
  };
  if (typeof window !== "undefined") {
    window.__isoTurn = {
      controller,
      set(next) {
        hold();
        return set(next);
      },
      get() {
        hold();
        return { ...values };
      },
      order(name) {
        hold();
        return controller.order(name);
      },
      events() {
        hold();
        return controller.events();
      },
      stats() {
        hold();
        return controller.stats();
      },
      layers() {
        hold();
        return scene.layers.map((layer) => layer.name);
      },
    };
  }
  render();
  return controller;
}

function t3Enclose(points, edges) {
  const hull = t3Hull(points);
  const n = hull.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) area += hull[i][0] * hull[(i + 1) % n][1] - hull[(i + 1) % n][0] * hull[i][1];
  const sign = area >= 0 ? 1 : -1;
  let lines = [];
  for (let i = 0; i < n; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    const nx = (sign * dy) / l;
    const ny = (-sign * dx) / l;
    lines.push([nx, ny, -(nx * p[0] + ny * p[1])]);
  }
  const meet = (A, B) => {
    const det = A[0] * B[1] - A[1] * B[0];
    if (Math.abs(det) < 1e-12) return null;
    return [(-A[2] * B[1] + B[2] * A[1]) / det, (-A[0] * B[2] + B[0] * A[2]) / det];
  };
  while (lines.length > edges) {
    let best = -1;
    let cost = Infinity;
    const m = lines.length;
    for (let i = 0; i < m; i++) {
      const prev = lines[(i - 1 + m) % m];
      const self = lines[i];
      const next = lines[(i + 1) % m];
      const turn = prev[0] * next[1] - prev[1] * next[0];
      if (sign * turn <= 1e-9) continue;
      const apex = meet(prev, next);
      const a = meet(prev, self);
      const b = meet(self, next);
      if (!apex || !a || !b) continue;
      const added = Math.abs((a[0] - apex[0]) * (b[1] - apex[1]) - (a[1] - apex[1]) * (b[0] - apex[0])) / 2;
      if (added < cost) {
        cost = added;
        best = i;
      }
    }
    if (best < 0) break;
    lines.splice(best, 1);
  }
  return lines;
}

function t3Cover(controller, names, { polygons = 6, edges = 10, pad = 0.3, layers = null } = {}) {
  const uCoverEdge = new Float32Array(polygons * edges * 3);
  const uCoverCount = new Float32Array(polygons);
  const scene = controller.scene();
  const frames = controller.frames();
  const sets = Array.isArray(names) ? (names.length && Array.isArray(names[0]) ? names : [names]) : [[names]];
  const candidates = [];
  const taken = new Set();
  for (const list of sets) {
    const targets = scene.runs.filter((run) => list.includes(run.name));
    if (!targets.length) continue;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const run of targets) {
      const b = frames[run.index].box;
      box[0] = Math.min(box[0], b[0]);
      box[1] = Math.min(box[1], b[1]);
      box[2] = Math.max(box[2], b[2]);
      box[3] = Math.max(box[3], b[3]);
    }
    const home = targets[0].layer;
    scene.layers.forEach((layer, index) => {
      const order = controller.orderIndex(layer.name);
      if (!order) return;
      let from = 0;
      if (index === home) {
        for (let at = 0; at < order.length; at++) if (targets.some((run) => run.index === order[at])) from = at + 1;
      } else if (!(layers && layers.includes(layer.name)) || index < home) return;
      for (let at = from; at < order.length; at++) {
        const run = scene.runs[order[at]];
        if (list.includes(run.name) || taken.has(run.index)) continue;
        const f = frames[run.index];
        const b = f.box;
        if (!(b[0] < box[2] + pad && box[0] < b[2] + pad && b[1] < box[3] + pad && box[1] < b[3] + pad)) continue;
        if (!targets.some((target) => !t3Disjoint(frames[target.index], f, -pad))) continue;
        taken.add(run.index);
        const share = (Math.min(b[2], box[2]) - Math.max(b[0], box[0])) * (Math.min(b[3], box[3]) - Math.max(b[1], box[1]));
        candidates.push({ run, f, share });
      }
    });
  }
  candidates.sort((a, b) => b.share - a.share);
  const parts = [];
  let slot = 0;
  for (const { run, f } of candidates) {
    if (slot >= polygons) break;
    const points = [];
    if (f.quadN) for (const [buf, count] of f.quadList) for (let i = 0; i < count; i++) points.push([buf[2 * i], buf[2 * i + 1]]);
    else for (let i = 0; i < f.hullN; i++) points.push([f.hull[2 * i], f.hull[2 * i + 1]]);
    const lines = t3Enclose(points, edges);
    if (!lines.length) continue;
    lines.forEach((line, e) => {
      const at = (slot * edges + e) * 3;
      uCoverEdge[at] = line[0];
      uCoverEdge[at + 1] = line[1];
      uCoverEdge[at + 2] = line[2] - pad;
    });
    uCoverCount[slot] = lines.length;
    parts.push(run.name);
    slot++;
  }
  return { uCoverEdge, uCoverCount, dropped: Math.max(0, candidates.length - slot), parts };
}

function t3PoseOf(scene, cams, name) {
  const index = scene.groups.findIndex((g) => g.name === name);
  const cam = index >= 0 && cams ? cams[index] : null;
  return { R: cam ? Array.from(cam.R) : Array.from(T3_EYE), t: cam ? [cam.t[0], cam.t[1], cam.t[2]] : [0, 0, 0] };
}

function t3Anchor(scene, cams, name, point, direction) {
  const index = name === null || name === undefined ? -1 : scene.groups.findIndex((g) => g.name === name);
  const cam = index >= 0 ? cams[index] : cams.world;
  const o = index >= 0 ? scene.groups[index].origin : [0, 0, 0];
  const R = cam.R;
  const q = [point[0] - o[0], point[1] - o[1], point[2] - o[2]];
  const world = [R[0] * q[0] + R[1] * q[1] + R[2] * q[2] + cam.t[0], R[3] * q[0] + R[4] * q[1] + R[5] * q[2] + cam.t[1], R[6] * q[0] + R[7] * q[1] + R[8] * q[2] + cam.t[2]];
  const w = cams.world;
  const screen = [w.ox + w.m[0] * world[0] + w.m[1] * world[1] + w.m[2] * world[2], w.oy + w.m[3] * world[0] + w.m[4] * world[1] + w.m[5] * world[2]];
  const out = { world, screen };
  if (direction) out.direction = [R[0] * direction[0] + R[1] * direction[1] + R[2] * direction[2], R[3] * direction[0] + R[4] * direction[1] + R[5] * direction[2], R[6] * direction[0] + R[7] * direction[1] + R[8] * direction[2]];
  return out;
}

function t3FloorOf(scene, name, R = T3_EYE) {
  const index = scene.groups.findIndex((g) => g.name === name);
  let low = Infinity;
  for (const run of scene.runs) {
    if (run.group !== index) continue;
    const c = run.cloud;
    for (let i = 0; i < c.length; i += 3) {
      const z = R[6] * c[i] + R[7] * c[i + 1] + R[8] * c[i + 2];
      if (z < low) low = z;
    }
  }
  return low;
}

function t3Compose(A, B) {
  return Array.from(t3Mul(A, B));
}

function t3PoseUniforms(controller, group, prefix = "uGroup") {
  const scene = controller.scene();
  const index = scene.groups.findIndex((g) => g.name === group);
  const cams = controller.cams();
  const cam = index >= 0 && cams ? cams[index] : null;
  const R = cam ? cam.R : T3_EYE;
  const t = cam ? cam.t : [0, 0, 0];
  const o = index >= 0 ? scene.groups[index].origin : [0, 0, 0];
  const T = [t[0] - (R[0] * o[0] + R[1] * o[1] + R[2] * o[2]), t[1] - (R[3] * o[0] + R[4] * o[1] + R[5] * o[2]), t[2] - (R[6] * o[0] + R[7] * o[1] + R[8] * o[2])];
  return { [`${prefix}X`]: [R[0], R[3], R[6]], [`${prefix}Y`]: [R[1], R[4], R[7]], [`${prefix}Z`]: [R[2], R[5], R[8]], [`${prefix}T`]: T };
}

const T3_MAT_KEYS = ["paper", "face", "top", "shade-0", "shade-1", "shade-2", "shade-3", "lit-top", "lit-shade", "hi", "mid", "lo", "faint", "dot", "lit"];
const T3_MAT_TUBE = ["body", "shine", "shade", "edge"];

const T3_MATERIALS = {
  gold: {
    light: ["#d3bb88", "#e4d2a8", "#f1e5c6", "#a1844f", "#bc9f69", "#d3bb88", "#e4d2a8", "#f8efd8", "#dfcb9c", "#4b3920", "#86693f", "#a98c5b", "#c1a676", "#4a381f", "#2a1d0c", "#cdb07a", "#f3e8cc", "#8e7044", "#4b3920"],
    dark: ["#3f3521", "#4b3f28", "#5a4c31", "#2b2416", "#352c1b", "#3f3521", "#4b3f28", "#6a5a3b", "#4f4329", "#e6d2a3", "#8a7550", "#5e4e33", "#463a26", "#e6d2a3", "#fff3d6", "#4a3e27", "#8c7853", "#251f13", "#e6d2a3"],
  },
  chrome: {
    light: ["#8e959c", "#c3c8cd", "#f7f8f9", "#a2a9b0", "#6f767d", "#454b52", "#cacfd4", "#ffffff", "#bcc2c8", "#202428", "#585e65", "#878d94", "#a9afb5", "#2a2e33", "#000000", "#8b9299", "#fbfcfd", "#3c4248", "#202428"],
    dark: ["#2a2e32", "#4a5056", "#6e757c", "#2e3236", "#24272b", "#1a1d20", "#4a5056", "#848b92", "#3a3f44", "#dfe3e7", "#7c838a", "#4d5359", "#363b40", "#e4e7ea", "#ffffff", "#34393e", "#9aa1a8", "#16191b", "#dfe3e7"],
  },
  steel: {
    light: ["#b8bdc1", "#cdd1d4", "#e5e8ea", "#8f959b", "#a4aaaf", "#b8bdc1", "#cdd1d4", "#f1f3f4", "#c6cacd", "#2b2f33", "#6b7177", "#959ba1", "#aeb3b8", "#33373b", "#000000", "#b3b8bd", "#eef0f2", "#7d8389", "#2b2f33"],
    dark: ["#2c3034", "#34393d", "#3e4348", "#1f2225", "#25292c", "#2c3034", "#34393d", "#4a5056", "#33383c", "#d0d4d8", "#727980", "#4a5056", "#33383d", "#d8dce0", "#ffffff", "#30353a", "#5c6369", "#1a1d20", "#d0d4d8"],
  },
  gunmetal: {
    light: ["#444a51", "#50575e", "#5f666e", "#2f3439", "#393f45", "#444a51", "#50575e", "#6d757d", "#4b5258", "#0f1113", "#1d2125", "#272b30", "#30353a", "#b0b5ba", "#000000", "#3d4349", "#6e757c", "#24282c", "#0f1113"],
    dark: ["#1d2125", "#22272b", "#2a2f34", "#15181b", "#191c20", "#1d2125", "#22272b", "#323840", "#20252a", "#a9b0b7", "#5c636a", "#3a4046", "#2a2f34", "#b8bec4", "#ffffff", "#1f2327", "#3a4046", "#111316", "#a9b0b7"],
  },
  rubber: {
    light: ["#2a2b2e", "#34363a", "#46484d", "#1b1c1e", "#222326", "#2a2b2e", "#34363a", "#55575c", "#2f3134", "#070708", "#111214", "#18191b", "#1f2023", "#6a6c70", "#000000", "#27282b", "#5b5d62", "#121314", "#050506"],
    dark: ["#121213", "#161618", "#1c1c1f", "#0c0c0d", "#0f0f10", "#121213", "#161618", "#232327", "#141416", "#8c8e92", "#4a4c50", "#2c2d30", "#1f2023", "#9a9ca0", "#ffffff", "#131315", "#2b2c30", "#0a0a0b", "#8c8e92"],
  },
  brass: {
    light: ["#bd9646", "#d2ad5b", "#e6c87e", "#8a6a2c", "#a47f38", "#bd9646", "#d2ad5b", "#f0d796", "#c8a252", "#3f2e0e", "#765a24", "#9a7a3c", "#b08c46", "#3a2a0c", "#1f1606", "#b8913f", "#efd795", "#7d5f26", "#3f2e0e"],
    dark: ["#3d3017", "#49391c", "#574523", "#2a210f", "#332813", "#3d3017", "#49391c", "#66522b", "#45371b", "#e9cf8a", "#8e7438", "#5e4c25", "#44371c", "#e9cf8a", "#fff0c8", "#433419", "#8a6f36", "#21190b", "#e9cf8a"],
  },
  copper: {
    light: ["#b3633e", "#c9784f", "#df9670", "#7c4128", "#9a5132", "#b3633e", "#c9784f", "#eaa985", "#be6d46", "#3a1a0c", "#6e3820", "#925037", "#a65d3f", "#3a1a0c", "#1c0b04", "#ad5f3b", "#f0b896", "#6e3720", "#3a1a0c"],
    dark: ["#3d1f13", "#492617", "#582e1c", "#2a160d", "#331a10", "#3d1f13", "#492617", "#673722", "#432215", "#eaa985", "#8f5236", "#5f3624", "#45271a", "#eaa985", "#ffe0cc", "#42221a", "#8a4c31", "#1f0f08", "#eaa985"],
  },
};

function t3MaterialCss() {
  const rules = [];
  const block = (values) => T3_MAT_KEYS.map((key, i) => `--anatomy-${key}:${values[i]}`).concat(T3_MAT_TUBE.map((key, i) => `--mat-${key}:${values[T3_MAT_KEYS.length + i]}`)).join(";");
  for (const [name, { light, dark }] of Object.entries(T3_MATERIALS)) {
    rules.push(`[data-mat="${name}"]{${block(dark)}}`);
    rules.push(`.iso[data-theme="light"] [data-mat="${name}"]{${block(light)}}`);
    rules.push(`.iso[data-theme="dark"] [data-mat="${name}"]{${block(dark)}}`);
  }
  rules.push("[data-mat] .tb-body{fill:var(--mat-body)}");
  rules.push("[data-mat] .tb-shine{fill:var(--mat-shine)}");
  rules.push("[data-mat] .tb-shade{fill:var(--mat-shade)}");
  rules.push("[data-mat] .tb-edge{stroke:var(--mat-edge)}");
  return rules.join("\n");
}

function t3Css() {
  const rules = [];
  const ramp = "--tn-0:var(--anatomy-shade-0);--tn-1:var(--anatomy-shade-1);--tn-2:var(--anatomy-shade-2);--tn-3:var(--anatomy-shade-3);--tn-4:var(--anatomy-top)";
  rules.push(`.iso-live{${ramp}}`);
  rules.push(`.iso-live [data-mat]{${ramp}}`);
  rules.push(".iso-live [data-lit]{--tn-0:var(--anatomy-lit-shade);--tn-1:var(--anatomy-lit-shade);--tn-2:var(--anatomy-lit-shade);--tn-3:var(--anatomy-lit-shade);--tn-4:var(--anatomy-lit-top)}");
  const colour = "color-mix(in srgb,var(--ta) calc(100% - var(--f,0) * 100%),var(--tb))";
  rules.push(`.iso-tn{stroke-width:.4;stroke-linejoin:round;--ta:var(--tn-0);--tb:var(--tn-1);fill:${colour};stroke:${colour}}`);
  for (let i = 1; i < 4; i++) rules.push(`.iso-tn[data-b="${i}"]{--ta:var(--tn-${i});--tb:var(--tn-${i + 1})}`);
  rules.push(t3MaterialCss());
  for (const hue of ["red", "green", "blue"]) rules.push(`.tb[data-hue="${hue}"]{--tb-ink:var(--anatomy-${hue})}`);
  rules.push(".tb[data-hue] .tb-body{fill:color-mix(in srgb,var(--tb-ink) 54%,var(--anatomy-shade-2))}");
  rules.push(".tb[data-hue] .tb-shine{fill:color-mix(in srgb,var(--tb-ink) 16%,var(--anatomy-top))}");
  rules.push(".tb[data-hue] .tb-shade{fill:color-mix(in srgb,var(--tb-ink) 30%,var(--anatomy-hi))}");
  rules.push(".tb[data-hue] .tb-edge{stroke:color-mix(in srgb,var(--tb-ink) 38%,var(--anatomy-hi))}");
  rules.push(".tb[data-hue][data-mat] .tb-body{fill:color-mix(in srgb,var(--tb-ink) 62%,var(--mat-body))}");
  rules.push(".tb[data-hue][data-mat] .tb-shine{fill:color-mix(in srgb,var(--tb-ink) 22%,var(--mat-shine))}");
  rules.push(".tb[data-hue][data-mat] .tb-shade{fill:color-mix(in srgb,var(--tb-ink) 46%,var(--mat-shade))}");
  rules.push(".tb[data-hue][data-mat] .tb-edge{stroke:color-mix(in srgb,var(--tb-ink) 30%,var(--mat-edge))}");
  rules.push(".iso-turn{position:relative}");
  rules.push(".iso-turn>.iso-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}");
  return rules.join("\n");
}

const TURN = { materials: Object.keys(T3_MATERIALS), materialCss: t3MaterialCss, rotation: (axis, degrees) => Array.from(t3Rot(axis, degrees)), quat: (q) => Array.from(t3Quat(q)), compose: t3Compose, floorOf: t3FloorOf, anchor: t3Anchor, camera: t3Camera, poses: t3PosesMap, prepare: t3Prepare, emit: t3Emit, order: t3Order, mount: t3Mount, cover: t3Cover, poseUniforms: t3PoseUniforms, css: t3Css, frame: t3Frame, cams: t3Cams, gjk: t3Gjk, hintsOf: (ri, ci, rj, cj, world) => Object.assign([...ri.axes.map((axis) => [axis, ci]), ...rj.axes.map((axis) => [axis, cj]), [[0, 0, 1], world]], { centroids: [ri.centroid, rj.centroid] }), disjoint: t3Disjoint, levels: T3_LEVELS, q: T3_Q, exact: (on) => { t3State.exact = Boolean(on); } };
const TURN_CSS = t3Css();

return { "TURN": TURN, "TURN_CSS": TURN_CSS };
})(void 0));
var createModel = (function createModel(data) {
  'use strict';
  const input = data?.model;
  const keys = ['expose', 'pick', 'roll', 'eject', 'develop', 'ready'];
  const scalarKeys = ['packetWidth', 'packetLength', 'roiWidth', 'roiFrom', 'roiTo',
    'podFrom', 'podTo', 'podRuptureAt', 'trapFrom', 'trapTo', 'nipDistance', 'exitDistance',
    'speed', 'rollerRadius', 'openingSeconds', 'holdSeconds', 'closingSeconds', 'closedDwellSeconds',
    'maturitySeconds', 'imageReagent', 'reducedCadence'];
  if (!input || scalarKeys.some((k) => !Number.isFinite(input[k]) || input[k] < 1e-6 || input[k] > 1e4) ||
      !Number.isInteger(input.rows) || input.rows < 1 || input.rows > 64 ||
      !Number.isInteger(input.columns) || input.columns < 1 || input.columns > 64 ||
      !Array.isArray(input.scene) || input.scene.length !== input.rows * input.columns * 3 ||
      Array.from(input.scene).some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
    throw new Error('invalid authored 636 model data');
  }
  const M = Object.fromEntries(scalarKeys.map((k) => [k, input[k]]));
  const rows = input.rows;
  const columns = input.columns;
  const scene = input.scene.slice(); // detach authored input, including future latent records
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const closedAt = M.openingSeconds + M.holdSeconds + M.closingSeconds;
  const motorStart = closedAt + M.closedDwellSeconds;
  const crossing = (s) => motorStart + (M.nipDistance + s) / M.speed;
  const nipEntry = crossing(0);
  const nipExit = crossing(M.packetLength);
  const exitTime = motorStart + (M.exitDistance + M.packetLength) / M.speed;
  const total = crossing(M.roiTo) + M.maturitySeconds;
  const starts = [0, motorStart, nipEntry, nipExit, exitTime, total];
  const durations = starts.map((t, i) => i < starts.length - 1 ? starts[i + 1] - t : 0);
  if (!(M.roiWidth < M.packetWidth && M.podFrom < M.podRuptureAt && M.podRuptureAt < M.podTo &&
      M.podTo < M.roiFrom && M.roiFrom < M.roiTo && M.roiTo < M.trapFrom &&
      M.trapFrom < M.trapTo && M.trapTo < M.packetLength && M.nipDistance < M.exitDistance &&
      M.imageReagent < 1 && M.reducedCadence >= 0.1 && M.reducedCadence <= 1 && total > exitTime) ||
      !Number.isFinite(total) || total > 1e5 ||
      !Array.isArray(input.stages) || input.stages.length !== keys.length ||
      Array.from(input.stages).some((s, i) => s?.key !== keys[i] || !Number.isFinite(s.duration) ||
        s.duration < 0 || (i < keys.length - 1 && s.duration === 0) ||
        Math.abs(s.duration - durations[i]) > 1e-12)) {
    throw new Error('invalid 636 card, ROI, pod, timing or transport profile');
  }
  const rowLength = (M.roiTo - M.roiFrom) / rows;
  const rowSeconds = rowLength / M.speed;
  const qEnd = M.exitDistance + M.packetLength;
  const exposureArea = M.openingSeconds / 2 + M.holdSeconds + M.closingSeconds / 2;
  const stageAt = (t) => { for (let i = keys.length - 1; i >= 0; i--) if (t >= starts[i]) return i; return 0; };
  // Exact equality at the canonical contact endpoints avoids subtraction roundoff moving
  // the leading edge outside its nip at contact. No epsilon or early event snapping.
  const qAt = (t) => t >= exitTime ? qEnd : t === nipEntry ? M.nipDistance :
    t === nipExit ? M.nipDistance + M.packetLength : Math.max(0, (t - motorStart) * M.speed);
  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  function shutterAt(t) {
    if (t < M.openingSeconds) return clamp(t / M.openingSeconds);
    if (t < M.openingSeconds + M.holdSeconds) return 1;
    if (t < closedAt) return clamp((closedAt - t) / M.closingSeconds);
    return 0;
  }
  function lightPrimitive(t) {
    if (t <= 0) return 0;
    if (t < M.openingSeconds) return t * t / (2 * M.openingSeconds);
    const opened = M.openingSeconds / 2;
    if (t < M.openingSeconds + M.holdSeconds) return opened + t - M.openingSeconds;
    const u = Math.min(M.closingSeconds, t - M.openingSeconds - M.holdSeconds);
    return opened + M.holdSeconds + u - u * u / (2 * M.closingSeconds);
  }
  // Primitive of finite smoothstep(age/T). Spatial integration, NOT a single age per row.
  function chemicalPrimitive(age) {
    if (age <= 0) return 0;
    if (age >= M.maturitySeconds) return age - M.maturitySeconds / 2;
    const x = age / M.maturitySeconds;
    return M.maturitySeconds * (x * x * x - x * x * x * x / 2);
  }
  let mode = 'reader';
  let running = false;
  let complete = false;
  let time = 0;
  let cycle = 1;
  let baseDistance = 0;
  let picks = 0;
  let outputs = 0;
  let exposures = 0;
  let podRuptures = 0;
  let picked = false;
  let ejected = false;
  let podRuptured = false;
  let exposure = 0;
  let captured = null;
  let held = null;
  let covered = new Array(rows).fill(0);
  let trapCovered = 0;
  let cadence = 0; // bounded real dt controls still commits; never chemistry time
  let snapshotCache = null;
  let latentCache = null;
  let latentExposure = -1;
  let regionCache = null;
  let spreadCache = null;
  let doseCache = null;
  let maturityCache = null;
  let ageCache = null;
  let rgbCache = Object.freeze(new Array(rows * columns * 3).fill(0.88));
  let rgbMaturity = new Array(rows).fill(0);
  let activeCache = null;
  const sheetId = () => `instant-sheet-${cycle}`;
  function frozenValues(previous, values) {
    return previous && values.every((v, i) => v === previous[i]) ? previous : Object.freeze(values);
  }
  function latentOf() {
    if (latentExposure !== exposure) {
      latentCache = frozenValues(latentCache, scene.map((v) => v * exposure));
      latentExposure = exposure;
    }
    return latentCache;
  }
  function regionsOf() {
    if (regionCache) return regionCache;
    regionCache = Object.freeze(covered.map((length, r) => {
      const from = M.roiFrom + rowLength * r;
      const to = from + rowLength;
      const spread = clamp(length / rowLength);
      if (!(length > 0)) return Object.freeze({ index: r, from, to, exposure, spread: 0, dose: 0,
        firstDoseTime: null, lastDoseTime: null, meanAgeSeconds: 0, youngestAgeSeconds: 0,
        oldestAgeSeconds: 0, maturity: 0 });
      // Only reveal timestamps of material already traversed. Analytic future crossings stay private.
      const first = Math.min(time, crossing(from));
      const last = Math.min(time, crossing(from + length));
      const oldest = Math.max(0, time - first);
      const youngest = Math.max(0, time - last);
      const maturity = youngest >= M.maturitySeconds ? spread :
        Math.max(0, Math.min(spread, (chemicalPrimitive(oldest) - chemicalPrimitive(youngest)) / rowSeconds));
      const meanAge = (oldest * oldest - youngest * youngest) / (2 * rowSeconds);
      return Object.freeze({ index: r, from, to, exposure, spread, dose: spread * M.imageReagent / rows,
        firstDoseTime: first, lastDoseTime: last, meanAgeSeconds: Math.max(0, meanAge),
        youngestAgeSeconds: youngest, oldestAgeSeconds: oldest, maturity });
    }));
    return regionCache;
  }
  function activeOf() {
    if (activeCache) return activeCache;
    const regions = regionsOf();
    if (!spreadCache) spreadCache = Object.freeze(regions.map((r) => r.spread));
    if (!doseCache) doseCache = Object.freeze(regions.map((r) => r.dose));
    maturityCache = frozenValues(maturityCache, regions.map((r) => r.maturity));
    ageCache = frozenValues(ageCache, regions.map((r) => r.meanAgeSeconds));
    if (maturityCache.some((v, i) => v !== rgbMaturity[i])) {
      const latent = latentOf();
      rgbCache = frozenValues(rgbCache, latent.map((v, i) => 0.88 + (v - 0.88) * maturityCache[Math.floor(i / (columns * 3))]));
      rgbMaturity = maturityCache.slice();
    }
    return (activeCache = Object.freeze({ sheetId: sheetId(), cycle,
      exposureOwner: exposure > 0 ? sheetId() : null,
      spreadOwner: podRuptured ? sheetId() : null, outputOwner: ejected ? sheetId() : null,
      exposure, latent: latentOf(), regions, spread: spreadCache, dose: doseCache,
      maturity: maturityCache, meanAgeSeconds: ageCache, rgb: rgbCache }));
  }
  function moveTo(target) {
    const end = Math.min(total, target);
    if (!(end > time)) return;
    const oldQ = qAt(time);
    const newQ = qAt(end);
    const nextExposure = end >= closedAt ? 1 : clamp(exposure + (lightPrimitive(end) - lightPrimitive(time)) / exposureArea);
    if (nextExposure !== exposure) exposure = nextExposure;
    if (!captured && end >= closedAt) {
      captured = Object.freeze({ sheetId: sheetId(), exposure, latent: latentOf(), capturedAt: closedAt });
      exposures += 1;
    }
    if (!picked && end > motorStart) { picked = true; picks += 1; }
    if (!podRuptured && end >= crossing(M.podRuptureAt)) { podRuptured = true; podRuptures += 1; }
    let spreadChanged = false;
    if (podRuptured && captured && newQ > oldQ) {
      const traversedFrom = Math.max(oldQ - M.nipDistance, M.podRuptureAt);
      const traversedTo = newQ - M.nipDistance;
      for (let r = 0; r < rows; r++) {
        const from = M.roiFrom + r * rowLength;
        const addition = overlap(traversedFrom, traversedTo, from, from + rowLength);
        if (addition > 0) {
          covered[r] = Math.min(rowLength, covered[r] + addition);
          // Snap to full only after the REAL far edge has passed, never on an epsilon.
          if (end >= crossing(from + rowLength)) covered[r] = rowLength;
          spreadChanged = true;
        }
      }
      trapCovered = Math.min(M.trapTo - M.trapFrom,
        trapCovered + overlap(traversedFrom, traversedTo, M.trapFrom, M.trapTo));
      if (end >= crossing(M.trapTo)) trapCovered = M.trapTo - M.trapFrom;
    }
    if (!ejected && end >= exitTime) { ejected = true; outputs += 1; }
    time = end;
    regionCache = null; activeCache = null;
    if (spreadChanged) { spreadCache = null; doseCache = null; }
    if (time >= total) {
      complete = true;
      running = false;
      held = activeOf(); // same physical sheet, NOT a second copy to render
    }
    snapshotCache = null;
  }
  function newCycle() {
    baseDistance += qEnd;
    cycle += 1;
    time = 0; complete = false; picked = false; ejected = false; podRuptured = false;
    exposure = 0; captured = null; covered = new Array(rows).fill(0); trapCovered = 0;
    latentCache = null; latentExposure = -1; regionCache = null; spreadCache = null; doseCache = null;
    maturityCache = null; ageCache = null; activeCache = null;
    rgbCache = Object.freeze(new Array(rows * columns * 3).fill(0.88));
    rgbMaturity = new Array(rows).fill(0);
    cadence = 0;
  }
  function statusOf(i) {
    if (complete) return `Tấm ${cycle} đã qua mốc khe ra và đạt mức hiện ảnh minh họa; giữ nguyên kết quả`;
    if (i === 0) {
      if (time === 0) return `Phôi mới ${cycle}, màn trập đóng; chưa phơi, chưa cấp thuốc`;
      if (time >= closedAt) return 'Màn trập đã đóng, ảnh tiềm ẩn đã ghi; động cơ chưa vận chuyển';
      return 'Màn trập đang phơi tấm trên cùng qua gương cố định; chưa kéo phim hoặc cấp thuốc';
    }
    if (i === 1) return picked ? 'Màn trập đóng; ngón đẩy đưa mép đầu tấm phim tới khe ép' : 'Màn trập đóng, ảnh tiềm ẩn đã ghi; tấm còn ở vị trí đầu hành trình đẩy';
    if (i === 2) {
      if (!podRuptured) return 'Mép đầu đã tới khe ép; túi thuốc hiện chưa vỡ, vùng ảnh chưa nhận thuốc';
      return covered.some((length) => length > 0) ? 'Túi thuốc hiện đã vỡ; những dải ảnh đã qua con lăn nhận thuốc và bắt đầu hiện' :
        'Túi thuốc hiện đã vỡ; viền đầu đang qua khe ép, vùng ảnh chưa nhận thuốc';
    }
    if (i === 3) return 'Mép cuối đã qua khe ép; tấm chưa tới mốc khe ra, phản ứng hiện ảnh vẫn tiếp tục';
    return 'Tấm đã qua mốc khe ra; ảnh đang tiếp tục hiện, chưa đạt mức hiện minh họa';
  }
  return {
    command(name, value) {
      if (name === 'mode') {
        if (value !== 'reader' && value !== 'explore') return false;
        mode = value;
        if (mode === 'reader') { running = false; cadence = 0; }
      } else if (name === 'play') {
        if (mode !== 'explore') return false;
        if (complete) newCycle();
        running = true;
      } else if (name === 'pause') { running = false; cadence = 0; }
      else if (name === 'step') {
        if (mode !== 'explore' || complete) return false;
        running = false; cadence = 0;
        const i = stageAt(time);
        moveTo(starts[i + 1]);
      } else return false;
      snapshotCache = null;
      return true;
    },
    advance(dt, options) {
      if (!running || mode !== 'explore' || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
      const bounded = Math.min(0.1, dt);
      if (options?.reducedMotion === true) {
        cadence += bounded;
        if (cadence < M.reducedCadence) return;
        cadence = 0;
        moveTo(starts[stageAt(time) + 1]);
      } else { cadence = 0; moveTo(time + bounded); }
    },
    snapshot() {
      if (snapshotCache) return snapshotCache;
      const i = stageAt(time);
      const q = qAt(time);
      const distance = baseDistance + q;
      const engaged = time >= motorStart && time < exitTime;
      const velocity = running && engaged ? M.speed : 0;
      const nipS = q - M.nipDistance;
      const pickOffset = q <= M.nipDistance ? q : M.nipDistance * (1 - clamp((q - M.nipDistance) / M.nipDistance));
      const active = activeOf();
      const deposited = active.dose.reduce((sum, v) => sum + v, 0);
      const trapped = (1 - M.imageReagent) * clamp(trapCovered / (M.trapTo - M.trapFrom));
      const remaining = Math.max(0, 1 - deposited - trapped);
      return (snapshotCache = Object.freeze({ mode, running, complete, time, stageIndex: i, stageKey: keys[i],
        status: statusOf(i), progress: time / total, cycle, sheetId: sheetId(), activeSheetCount: 1,
        shutter: Object.freeze({ transmission: shutterAt(time), closed: shutterAt(time) === 0 }),
        mirror: Object.freeze({ fixed: true }), captured,
        sheet: Object.freeze({ sheetId: sheetId(), width: M.packetWidth, length: M.packetLength, q,
          leadingX: q, trailingX: q - M.packetLength, centerX: q - M.packetLength / 2,
          nipMaterialS: nipS >= 0 && nipS <= M.packetLength ? nipS : null,
          nipCoveredLength: Math.max(0, Math.min(M.packetLength, nipS)),
          exitCoveredLength: Math.max(0, Math.min(M.packetLength, q - M.exitDistance)),
          fullyPastNip: time >= nipExit, fullyClearedExit: ejected }),
        motor: Object.freeze({ engaged, moving: velocity > 0, transportSpeed: velocity }),
        pick: Object.freeze({ engaged: picked && q < M.nipDistance, offset: pickOffset, picked }),
        rollers: Object.freeze({ radius: M.rollerRadius, distance, topAngle: distance === 0 ? 0 : -distance / M.rollerRadius,
          bottomAngle: distance / M.rollerRadius, topOmega: velocity === 0 ? 0 : -velocity / M.rollerRadius,
          bottomOmega: velocity / M.rollerRadius }),
        timingCamAngle: (cycle - 1 + q / qEnd) * 2 * Math.PI,
        pod: Object.freeze({ ruptured: podRuptured, rupturedAt: podRuptured ? crossing(M.podRuptureAt) : null }),
        reagent: Object.freeze({ initial: 1, deposited, trapped, remaining }),
        events: Object.freeze({ picks, outputs, exposures, podRuptures, picked, ejected }), active, held,
      }));
    },
  };
});
var mountRenderer = (function mountRenderer(root,data,kit){
'use strict';
function createTurnBuilders(){
'use strict';
const modules = Object.create(null);
modules["annular-sector"] = (function(window){
// Native Y-axis annular sector. Ideal analytic form; IEEE evaluation, no convex cloud.
const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const add = (a,b) => a.map((v,i)=>v+b[i]);
const mul = (a,k) => a.map(v=>v*k);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x)); // closest-point projection only
const FACE_IDS = Object.freeze(['inner','outer','s0','s1','theta0','theta1']);
const basis = {a:[0,1,0],u:[-1,0,0],v:[0,0,1]};
function validateFrame(F) {
  if (!F || !Array.isArray(F.o) || F.o.length!==3 || !F.o.every(Number.isFinite)) throw Error('finite origin required');
  for (const k of ['a','u','v']) if (!Array.isArray(F[k]) || F[k].length!==3 || !F[k].every((v,i)=>v===basis[k][i])) throw Error('only native +Y frame a=(0,1,0), u=(-1,0,0), v=(0,0,1) supported');
}
function annularSector({F,s0,s1,rIn,rOut,theta0,theta1}) {
  validateFrame(F);
  if (![s0,s1,rIn,rOut,theta0,theta1].every(Number.isFinite) || !(s1>s0 && rIn>0 && rOut>rIn && theta1>theta0 && theta1-theta0<=Math.PI && theta0>=-Math.PI && theta1<=Math.PI)) throw Error('invalid annular sector bounds/span');
  const frame=Object.fromEntries(['o','a','u','v'].map(k=>[k,Object.freeze([...F[k]])]));
  return {kind:'annular-sector',F:Object.freeze(frame),s0,s1,rIn,rOut,theta0,theta1};
}
function validateSector(S) {
  if (S.kind!=='annular-sector' || S.cut) throw Error('actual uncut native annular sector required');
  annularSector(S);
}
const radial = (S,t) => add(mul(S.F.u,Math.cos(t)),mul(S.F.v,Math.sin(t)));
const tangent = (S,t) => add(mul(S.F.u,-Math.sin(t)),mul(S.F.v,Math.cos(t)));
const point = (S,s,r,t) => add(add(S.F.o,mul(S.F.a,s)),mul(radial(S,t),r));
const local = (S,p) => {const q=sub(p,S.F.o);return [dot(q,S.F.a),dot(q,S.F.u),dot(q,S.F.v)]};
function inAngle(S,x,y,eps=0) {
  // Two actual oriented angular halfspaces, valid for spans <= pi.
  return Math.cos(S.theta0)*y-Math.sin(S.theta0)*x>=-eps && Math.cos(S.theta1)*y-Math.sin(S.theta1)*x<=eps;
}
function contains(S,p,eps=0) {
  const [s,x,y]=local(S,p),r=Math.hypot(x,y);
  return s>=S.s0-eps && s<=S.s1+eps && r>=S.rIn-eps && r<=S.rOut+eps && inAngle(S,x,y,eps);
}
function signedDistance(S,p) {
  const [s,x,y]=local(S,p),r=Math.hypot(x,y);
  const segmentDistance=t=>{const c=Math.cos(t),n=Math.sin(t),q=clamp(x*c+y*n,S.rIn,S.rOut);return Math.hypot(x-q*c,y-q*n)};
  // Exact Euclidean distance to the planar annular-sector boundary, then extrusion.
  let d=Math.min(segmentDistance(S.theta0),segmentDistance(S.theta1));
  if(inAngle(S,x,y)) d=Math.min(d,Math.abs(r-S.rIn),Math.abs(r-S.rOut));
  const inside=r>=S.rIn && r<=S.rOut && inAngle(S,x,y);
  const flat=inside?-d:d, along=Math.max(S.s0-s,s-S.s1);
  return Math.hypot(Math.max(flat,0),Math.max(along,0))+Math.min(Math.max(flat,along),0);
}
function bounds(S) {
  const ts=[S.theta0,S.theta1];
  for(const t of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]) if(t>S.theta0 && t<S.theta1) ts.push(t);
  const ps=[];for(const s of [S.s0,S.s1])for(const r of [S.rIn,S.rOut])for(const t of ts)ps.push(point(S,s,r,t));
  // Outward padding for IEEE trig and world-coordinate addition; not a contact tolerance.
  const pad=32*Number.EPSILON*Math.max(1,S.rOut,Math.abs(S.s0),Math.abs(S.s1),...S.F.o.map(Math.abs));
  return {min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))-pad),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i]))+pad)};
}
function surfaceAt(S,face,u,v) {
  if(!FACE_IDS.includes(face) || !(u>=0&&u<=1&&v>=0&&v<=1)) throw Error('invalid surface coordinates');
  const s=S.s0+(S.s1-S.s0)*u,r=S.rIn+(S.rOut-S.rIn)*v,t=S.theta0+(S.theta1-S.theta0)*v;
  if(face==='inner'||face==='outer')return {face,p:point(S,s,face==='inner'?S.rIn:S.rOut,t),normal:mul(radial(S,t),face==='inner'?-1:1)};
  if(face==='s0'||face==='s1')return {face,p:point(S,face==='s0'?S.s0:S.s1,S.rIn+(S.rOut-S.rIn)*u,t),normal:mul(S.F.a,face==='s0'?-1:1)};
  const theta=face==='theta0'?S.theta0:S.theta1;
  return {face,p:point(S,s,r,theta),normal:mul(tangent(S,theta),face==='theta0'?-1:1)};
}
function faceAreas(S) {
  const L=S.s1-S.s0,d=S.theta1-S.theta0,end=(S.rOut**2-S.rIn**2)*d/2,cut=(S.rOut-S.rIn)*L;
  return {inner:S.rIn*d*L,outer:S.rOut*d*L,s0:end,s1:end,theta0:cut,theta1:cut};
}
function surfaceSamples(S,spacing=0.6) {
  if(!(spacing>0&&Number.isFinite(spacing)))throw Error('positive finite spacing required');
  const out=[];
  for(const face of FACE_IDS){
    const width=face[0]==='s'?S.rOut-S.rIn:S.s1-S.s0;
    const height=face.startsWith('theta')?S.rOut-S.rIn:S.rOut*(S.theta1-S.theta0);
    const nu=Math.max(1,Math.ceil(width/spacing)),nv=Math.max(1,Math.ceil(height/spacing));
    for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++)out.push(surfaceAt(S,face,i/nu,j/nv));
  }return out;
}
// Analytic intersections evaluated in IEEE; eps is numeric acceptance, not area certification.
function raycast(S,origin,direction,{eps=1e-9}={}) {
  const finite3=v=>(Array.isArray(v)||ArrayBuffer.isView(v))&&v.length===3&&Array.from(v).every(Number.isFinite);
  if(!finite3(origin)||!finite3(direction)||!(Math.hypot(...direction)>0)||!(eps>=0&&Number.isFinite(eps)))throw Error('invalid ray');
  const [sc,x,y]=local(S,origin), ds=dot(direction,S.F.a), dx=dot(direction,S.F.u),dy=dot(direction,S.F.v),hits=[];
  const put=(t,face)=>{if(t<0||!Number.isFinite(t))return;const p=add(origin,mul(direction,t));if(contains(S,p,eps)) {const q=local(S,p);if(face==='theta0'||face==='theta1'){const cutAngle=face==='theta0'?S.theta0:S.theta1;if(q[1]*Math.cos(cutAngle)+q[2]*Math.sin(cutAngle)<S.rIn-eps)return;}const theta=Math.atan2(q[2],q[1]);const normal=face==='inner'?mul(radial(S,theta),-1):face==='outer'?radial(S,theta):face==='s0'?mul(S.F.a,-1):face==='s1'?S.F.a:mul(tangent(S,face==='theta0'?S.theta0:S.theta1),face==='theta0'?-1:1);hits.push({t,p,face,normal});}};
  const a=dx*dx+dy*dy,b=2*(x*dx+y*dy);
  if(a>0)for(const [r,face]of [[S.rIn,'inner'],[S.rOut,'outer']]){const c=x*x+y*y-r*r,disc=b*b-4*a*c;if(disc>=0){const root=Math.sqrt(disc);put((-b-root)/(2*a),face);put((-b+root)/(2*a),face);}}
  if(ds!==0){put((S.s0-sc)/ds,'s0');put((S.s1-sc)/ds,'s1');}
  for(const [theta,face]of [[S.theta0,'theta0'],[S.theta1,'theta1']]){const c=Math.cos(theta),n=Math.sin(theta),den=c*dy-n*dx;if(den!==0)put(-(c*y-n*x)/den,face);}
  return hits.sort((a,b)=>a.t-b.t);
}
function journalContact(shaft,S) {
  validateSector(S);
  // A full circular cylinder is invariant to its radial basis. Accept actual Instant's
  // +X/-Z basis as well as frameAlong's -X/+Z, while requiring exact +Y and orthonormality.
  const F=shaft.F;
  if(!F || !F.o?.every(Number.isFinite) || !F.a?.every((v,i)=>v===basis.a[i]) || F.a.length!==3 || !F.u || !F.v || dot(F.u,F.u)!==1 || dot(F.v,F.v)!==1 || dot(F.u,F.v)!==0 || dot(F.u,F.a)!==0 || dot(F.v,F.a)!==0)throw Error('actual orthonormal +Y cylinder frame required');
  if(shaft.kind!=='body'||shaft.cut||shaft.poly?.length!==4)throw Error('actual native full cylinder required');
  const [[a,z0],[b,R],[c,R1],[d,z1]]=shaft.poly;
  if(!(a===b&&c===d&&c>a&&z0===0&&z1===0&&R===R1&&R>0))throw Error('not a full cylinder');
  if(shaft.F.o[0]!==S.F.o[0]||shaft.F.o[2]!==S.F.o[2])throw Error('noncoaxial centres');
  if(R!==S.rIn)throw Error('radius mismatch: gap or penetration');
  const lo=Math.max(shaft.F.o[1]+a,S.F.o[1]+S.s0),hi=Math.min(shaft.F.o[1]+c,S.F.o[1]+S.s1),L=hi-lo;
  if(!(L>0))throw Error('no positive axial overlap');
  const delta=S.theta1-S.theta0,area=R*delta*L;
  if(!(area>0&&Number.isFinite(area)))throw Error('no positive contact area');
  return {kind:'analytic-conformal-contact',R,L,theta0:S.theta0,theta1:S.theta1,area,axial:[lo,hi],normalOnShaft:t=>mul(radial(S,t),-1),momentY:t=>{const r=mul(radial(S,t),R),n=mul(radial(S,t),-1);return r[2]*n[0]-r[0]*n[2]},normalConvention:'liner inner outward = inward radial on shaft'};
}
function verifyContactNormal(S,theta,n) {
  const expected=mul(radial(S,theta),-1);
  if(!Array.isArray(n)||n.length!==3||!n.every((v,i)=>v===expected[i]))throw Error('wrong normal on shaft');
  return true;
}
function uniformPressureForUnitZ(contact) {
  if(contact?.kind!=='analytic-conformal-contact'||typeof contact.momentY!=='function'||![contact.R,contact.L,contact.theta0,contact.theta1,contact.area].every(Number.isFinite)||!(contact.R>0&&contact.L>0&&contact.theta1>contact.theta0))throw Error('actual conformal contact required');
  const a=contact.theta0,b=contact.theta1,m=(a+b)/2,RL=contact.R*contact.L;
  if(!(m===Math.PI/2||m===-Math.PI/2))throw Error('nominally Z-centred arc required');
  // Evaluate the stored-angle integral, not an ideal symmetry substitution. In particular sin(Math.PI) is not zero.
  const zIntegral=RL*(Math.cos(b)-Math.cos(a));
  if(!Number.isFinite(zIntegral)||zIntegral===0)throw Error('nonzero finite Z integral required');
  const p=1/Math.abs(zIntegral),Fx=p*RL*(Math.sin(b)-Math.sin(a)),Fz=p*RL*(Math.cos(b)-Math.cos(a));
  const panels=256,step=(b-a)/panels;let momentSum=contact.momentY(a)+contact.momentY(b);
  for(let i=1;i<panels;i++)momentSum+=(i%2?4:2)*contact.momentY(a+i*step);
  const momentY=p*RL*momentSum*step/3;
  return {p,area:contact.area,Fx,Fz,momentY,idealMomentY:0,
    numericInterpretation:'IEEE stored-angle force integrals; momentY is composite-Simpson evaluation of stored radial cross products, without clamping',
    idealInterpretation:'Radial normals have identically zero Y moment in the ideal analytic form; ideal exact-angle symmetry is separate from evaluated Fx',
    momentQuadrature:{method:'composite-Simpson',panels},
    interpretation:'Z component normalized only; numerical transverse/moment residuals retained. Not a Hertz, strength, calibrated pressure or complete support certificate'};
}

function surfaceMesh(S,steps=96) {
  if(!Number.isInteger(steps)||steps<4||steps>512)throw Error('steps must be integer 4..512');
  const mesh=[];
  for(const face of FACE_IDS){
    const count=face.startsWith('theta')?1:steps;
    for(let j=0;j<count;j++){
      const v0=j/count,v1=(j+1)/count;
      const points=[[0,v0],[1,v0],[1,v1],[0,v1]].map(([u,v])=>surfaceAt(S,face,u,v).p);
      if(face==='outer'||face==='s0'||face==='theta0')points.reverse();
      mesh.push({face,points,normal:surfaceAt(S,face,0.5,(v0+v1)/2).normal});
    }
  }return mesh;
}
function validateSurfaceMesh(S,mesh,steps=96) {
  if(!Array.isArray(mesh))throw Error('surface mesh required');
  for(const facet of mesh){
    if(!Array.isArray(facet.points)||facet.points.length<3||!Array.isArray(facet.normal))throw Error('invalid surface facet');
    const a=sub(facet.points[1],facet.points[0]),b=sub(facet.points[2],facet.points[0]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    if(!(dot(cross,facet.normal)>0))throw Error('surface winding disagrees with outward normal');
  }
  const expected=surfaceMesh(S,steps);
  if(JSON.stringify(mesh)!==JSON.stringify(expected))throw Error('surface omission or altered mesh');
  return true;
}
// Orthographic BSP of planar facets. Split overlapping facets before painter traversal;
// centroid sorting alone is not valid for a concave bore. Tolerance is rendering-only.
function painterOrder(polygons,view) {
  const eps=1e-10;
  function build(polys){
    if(!polys.length)return null;
    const pivot=polys[0],n=pivot.normal,w=dot(n,pivot.points[0]),front=[],back=[],same=[];
    for(const p of polys){
      const ds=p.points.map(q=>dot(n,q)-w),pos=ds.some(d=>d>eps),neg=ds.some(d=>d<-eps);
      if(!pos&&!neg){same.push(p);continue;}
      if(!neg){front.push(p);continue;}if(!pos){back.push(p);continue;}
      const fs=[],bs=[];
      for(let i=0;i<p.points.length;i++){
        const j=(i+1)%p.points.length,a=p.points[i],b=p.points[j],da=ds[i],db=ds[j];
        if(da>=-eps)fs.push(a);if(da<=eps)bs.push(a);
        if((da>eps&&db<-eps)||(da<-eps&&db>eps)){const t=da/(da-db),q=add(a,mul(sub(b,a),t));fs.push(q);bs.push(q);}
      }
      if(fs.length>=3)front.push({...p,points:fs});if(bs.length>=3)back.push({...p,points:bs});
    }
    return {n,same,front:build(front),back:build(back)};
  }
  const result=[];
  function visit(node){if(!node)return;const near=dot(node.n,view)>=0;visit(near?node.back:node.front);result.push(...node.same);visit(near?node.front:node.back);}
  visit(build(polygons));return result;
}

return {FACE_IDS,annularSector,bounds,contains,faceAreas,journalContact,painterOrder,point,radial,raycast,signedDistance,surfaceAt,surfaceMesh,surfaceSamples,uniformPressureForUnitZ,validateFrame,validateSector,validateSurfaceMesh,verifyContactNormal};
})(void 0);
modules["iso-kit"] = (function(window){
const AZIMUTH = 45;
const ELEVATION = 30;
const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
function cameraOf({ scale, azimuth = AZIMUTH, elevation = ELEVATION }) {
    const a = azimuth * RADIANS;
    const e = elevation * RADIANS;
    return { sinA: Math.sin(a), cosA: Math.cos(a), sinE: Math.sin(e), cosE: Math.cos(e), k: scale * UNIT };
}
function iso([x, y, z], projection) {
    const { origin } = projection;
    const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
    return [origin[0] + (x * sinA - y * cosA) * k, origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k];
}
function towardViewer(projection) {
    const { sinA, cosA } = cameraOf(projection);
    return [cosA, sinA];
}
function depthOf([x, y, z], projection) {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return (x * cosA + y * sinA) * cosE + z * sinE;
}
const tenth = (value) => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};
function pathOf(points, closed = false) {
    if (!points.length)
        return "";
    return points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");
}
const joinPaths = (paths) => paths.filter(Boolean).join("");
function roundedPlan({ x, y, w, d, r }, steps = 8) {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    const corners = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out = [];
    for (const [cx, cy, start] of corners) {
        const count = radius > 0 ? steps : 0;
        for (let step = 0; step <= count; step++) {
            const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}
function signedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index];
        const [bx, by] = points[(index + 1) % points.length];
        area += ax * by - bx * ay;
    }
    return area / 2;
}
const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);
function convexHull(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3)
        return sorted;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
            lower.pop();
        lower.push(point);
    }
    const upper = [];
    for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
            upper.pop();
        upper.push(point);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function runsOf(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0)
        return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run)
                run = [index];
            run.push((index + 1) % count);
        }
        else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run)
        runs.push(run);
    return runs;
}
function extrude(ring, z, height, projection, options = {}) {
    const convex = options.convex ?? true;
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const { sinA, cosA } = cameraOf(projection);
    const normals = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        return (counter ? [dy / length, -dx / length] : [-dy / length, dx / length]);
    });
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false))
        outline.push(pathOf(run.map((index) => top[index])));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((index) => top[index])));
        if (height > 0)
            outline.push(pathOf(run.map((index) => bottom[index])));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index])
                outline.push(pathOf([top[index], bottom[index]]));
        }
    }
    let fill;
    if (convex) {
        fill = pathOf(convexHull([...top, ...bottom]), true);
    }
    else {
        const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const next = (index + 1) % count;
            parts.push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
        fill = parts.join("");
    }
    const buckets = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const [lx, ly] = [-sinA, cosA];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const [nx, ny] = normals[index];
            const lit = (nx * lx + ny * ly + 1) / 2;
            const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
            const next = (index + 1) % count;
            buckets[shade].push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
    }
    let bevel;
    if (options.bevel && options.bevel > 0) {
        const by = options.bevel;
        const inset = ring.map(([x, y], index) => {
            const [ax, ay] = normals[(index + count - 1) % count];
            const [bx, by2] = normals[index];
            const mx = ax + bx;
            const my = ay + by2;
            const length = Math.hypot(mx, my) || 1;
            return [x - (mx / length) * by, y - (my / length) * by];
        });
        const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
        bevel = runsOf(facing, true)
            .map((run) => pathOf([top[run[0]], ...run.slice(1, -1).map((index) => insetTop[index]), top[run[run.length - 1]]]))
            .join("");
    }
    return {
        fill,
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: buckets.map((paths) => paths.join("")),
        bevel,
    };
}
const ringOf = (plan, steps = 8) => roundedPlan(plan, steps);
function slabOf(plan, z, height, projection, steps = 8, bevel = 0) {
    return extrude(ringOf(plan, steps), z, height, projection, { convex: true, bevel });
}
function circleRing(cx, cy, radius, steps = 40) {
    return Array.from({ length: steps }, (_, step) => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
}
function cylinder(cx, cy, radius, z, height, projection, steps = 32, bevel = 0) {
    return extrude(circleRing(cx, cy, radius, steps), z, height, projection, { convex: true, bevel });
}
const insetPlan = ({ x, y, w, d, r }, by) => ({ x: x + by, y: y + by, w: w - by * 2, d: d - by * 2, r: Math.max(0, r - by) });
function onTop(points, z, projection, closed = false) {
    return pathOf(points.map(([x, y]) => iso([x, y, z], projection)), closed);
}
const planOutline = (plan, z, projection, steps = 8) => onTop(ringOf(plan, steps), z, projection, true);
const lineOnTop = (from, to, z, projection) => onTop([from, to], z, projection);
const segment = (from, to, projection) => pathOf([iso(from, projection), iso(to, projection)]);
const rise = (at, from, to, projection) => segment([at[0], at[1], from], [at[0], at[1], to], projection);
const ring = (cx, cy, radius, z, projection, steps = 40) => onTop(circleRing(cx, cy, radius, steps), z, projection, true);
const pointsAt = (points, projection) => points.map((point) => iso(point, projection));
function dotGrid(x, y, columns, rows, gap, z, projection) {
    const dots = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++)
            dots.push(iso([x + column * gap, y + row * gap, z], projection));
    }
    return dots;
}
function corners({ x, y, w, d }, inset = 0) {
    return [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + inset, y + d - inset],
        [x + w - inset, y + d - inset],
    ];
}
function boxCorners({ x, y, w, d }, z0, z1) {
    const out = [];
    for (const px of [x, x + w])
        for (const py of [y, y + d])
            for (const z of [z0, z1])
                out.push([px, py, z]);
    return out;
}
function knurl(cx, cy, radius, z0, z1, count, projection, inset = 0.4) {
    const [vx, vy] = towardViewer(projection);
    const lines = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        if (nx * vx + ny * vy < 0.15)
            continue;
        lines.push(segment([cx + radius * nx, cy + radius * ny, z0 + inset], [cx + radius * nx, cy + radius * ny, z1 - inset], projection));
    }
    return lines.join("");
}
function sideArc(cx, cy, radius, z, projection, steps = 24) {
    const [vx, vy] = towardViewer(projection);
    const facing = Math.atan2(vy, vx);
    const points = [];
    for (let step = 0; step <= steps; step++) {
        const angle = facing - Math.PI / 2 + (step / steps) * Math.PI;
        points.push(iso([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z], projection));
    }
    return pathOf(points);
}
function ringSeam(ring, z, projection) {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const facing = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const [nx, ny] = counter ? [dy, -dx] : [-dy, dx];
        return nx * vx + ny * vy > 1e-9;
    });
    return runsOf(facing, true).map((run) => pathOf(run.map((index) => iso([ring[index][0], ring[index][1], z], projection)))).join("");
}
const sideSeam = (plan, z, projection, steps = 8) => ringSeam(ringOf(plan, steps), z, projection);
function sideRing(center, radius, axis, projection, steps = 20) {
    const [px, py, pz] = center;
    const points = [];
    for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        points.push(iso(axis === "x" ? [px, py + u, pz + v] : [px + u, py, pz + v], projection));
    }
    return pathOf(points, true);
}
function coil(from, to, center, radius, turns, axis, projection, perTurn = 16) {
    const count = Math.max(1, Math.round(turns * perTurn));
    const back = [];
    const front = [];
    let run = [];
    let near = null;
    for (let index = 0; index <= count; index++) {
        const share = index / count;
        const angle = share * turns * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        const along = from + (to - from) * share;
        const point = axis === "x" ? [along, center[0] + u, center[1] + v] : [center[0] + u, along, center[1] + v];
        const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];
        const facing = depthOf(normal, projection) > 0;
        const flat = iso(point, projection);
        if (near === null)
            near = facing;
        if (facing !== near) {
            run.push(flat);
            (near ? front : back).push(pathOf(run));
            run = [flat];
            near = facing;
            continue;
        }
        run.push(flat);
    }
    if (run.length > 1)
        (near ? front : back).push(pathOf(run));
    return { back: back.join(""), front: front.join("") };
}
function topTicks(from, to, step, every, edge, z, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, edge] : [edge, at];
        const b = axis === "x" ? [at, edge + length] : [edge + length, at];
        (big ? major : minor).push(lineOnTop(a, b, z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function sideTicks(from, to, step, every, face, top, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, face, top] : [face, at, top];
        const b = axis === "x" ? [at, face, top - length] : [face, at, top - length];
        (big ? major : minor).push(segment(a, b, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function radialTicks(cx, cy, radius, count, every, z, lengths, projection, from = 0, span = Math.PI * 2) {
    const minor = [];
    const major = [];
    const closed = Math.abs(span - Math.PI * 2) < 1e-9;
    const steps = closed ? count : count + 1;
    for (let index = 0; index < steps; index++) {
        const angle = from + (index / count) * span;
        const big = index % every === 0;
        const inner = radius - (big ? lengths[1] : lengths[0]);
        const sx = Math.sin(angle);
        const sy = -Math.cos(angle);
        (big ? major : minor).push(lineOnTop([cx + sx * inner, cy + sy * inner], [cx + sx * radius, cy + sy * radius], z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
const haloOf = (plan, z, height, projection) => slabOf(plan, z, height, projection).fill;
function axisVector(projection, [dx, dy, dz]) {
    const origin = iso([0, 0, 0], projection);
    const moved = iso([dx, dy, dz], projection);
    return [moved[0] - origin[0], moved[1] - origin[1]];
}
const fine = (value) => Math.round(value * 100) / 100;
function translateAlong(projection, by) {
    const [x, y] = axisVector(projection, by);
    return `translate(${fine(x)} ${fine(y)})`;
}
const thousandth = (value) => Math.round(value * 1000) / 1000;
function axesAt(at, z, projection) {
    const origin = iso([at[0], at[1], z], projection);
    const along = (point) => {
        const [px, py] = iso(point, projection);
        return [px - origin[0], py - origin[1]];
    };
    return { origin, x: along([at[0] + 1, at[1], z]), y: along([at[0], at[1] + 1, z]), z: along([at[0], at[1], z + 1]) };
}
const matrixOf = (u, v, origin) => `matrix(${thousandth(u[0])} ${thousandth(u[1])} ${thousandth(v[0])} ${thousandth(v[1])} ${thousandth(origin[0])} ${thousandth(origin[1])})`;
function holdStill(element, [dx, dy]) {
    const text = dx || dy ? `translate(${-dx} ${-dy})` : "";
    element.querySelectorAll("[data-hold]").forEach((node) => (text ? node.setAttribute("transform", text) : node.removeAttribute("transform")));
}
function topMatrix(at, z, projection, along = "x") {
    const { origin, x, y } = axesAt(at, z, projection);
    return along === "x" ? matrixOf(x, y, origin) : matrixOf([-y[0], -y[1]], x, origin);
}
function sideMatrix(at, z, projection, face) {
    const { origin, x, y, z: up } = axesAt(at, z, projection);
    const down = [-up[0], -up[1]];
    return face === "left" ? matrixOf(x, down, origin) : matrixOf([-y[0], -y[1]], down, origin);
}
function screenRise(height, projection) {
    const { cosE, k } = cameraOf(projection);
    return height * cosE * k;
}
function fitProjection(points, width, height, { pad = 24, headroom = 0, azimuth = AZIMUTH, elevation = ELEVATION } = {}) {
    const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const up = Math.min(...ys);
    const down = Math.max(...ys);
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2 - headroom) / (down - up));
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, headroom + (height - headroom) / 2 - ((up + down) / 2) * scale],
        scale,
        azimuth,
        elevation,
    };
}
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (pairs) => Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
    .join("");
function solidSvg(paths, { tone = "hi", crease = "faint", halo = false, lit = false, flat = false, className, inner = "" } = {}) {
    const parts = [];
    if (halo)
        parts.push(`<path class="iso-halo" d="${paths.fill}"/>`);
    parts.push(`<path class="iso-fill" d="${paths.fill}"/>`);
    if (!flat) {
        paths.shades.forEach((d, shade) => {
            if (d)
                parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
        });
        parts.push(`<path class="iso-top" d="${paths.top}"/>`);
    }
    if (crease !== "none" && paths.crease)
        parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`);
    if (crease !== "none" && paths.bevel)
        parts.push(`<path class="iso-line iso-bevel" data-tone="${crease}" d="${paths.bevel}"/>`);
    if (inner)
        parts.push(inner);
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
    return `<g${attrs({ class: className ? `iso-solid ${className}` : "iso-solid", "data-lit": lit ? "" : undefined, "data-seamless": paths.seamless ? "" : undefined })}>${parts.join("")}</g>`;
}
function lineSvg(d, { tone = "lo", dotted = false, dashed = false, flow = false, className, free } = {}) {
    if (!d)
        return "";
    return `<path${attrs({
        class: className ? `iso-line ${className}` : "iso-line",
        "data-tone": tone,
        "data-free": free === true ? "" : free || undefined,
        "data-dotted": dotted ? "" : undefined,
        "data-dashed": dashed ? "" : undefined,
        "data-flow": flow ? "" : undefined,
        d,
    })}/>`;
}
function dotsSvg(points, { size = 0.5, tone = "mid", pulse = false } = {}) {
    const dots = points
        .map(([x, y, alpha], index) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${alpha !== undefined && alpha < 1 ? ` fill-opacity="${Math.max(0, alpha).toFixed(2)}"` : ""}${pulse ? ` data-pulse="" style="--pulse-at:${(index * 137) % 1600}ms"` : ""}/>`)
        .join("");
    return `<g class="iso-dots" data-tone="${tone}">${dots}</g>`;
}
function fadedSvg(list, style = {}) {
    const groups = new Map();
    for (const entry of list) {
        const [d, alpha] = Array.isArray(entry) ? entry : [entry.d, entry.alpha];
        if (!d || !(alpha > 0.02))
            continue;
        const level = Math.min(1, Math.round(alpha * 20) / 20);
        groups.set(level, (groups.get(level) ?? "") + d);
    }
    return [...groups].map(([alpha, d]) => (alpha >= 1 ? lineSvg(d, style) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, style)}</g>`)).join("");
}
function fadeLineSvg(points, { fade = [0, 0], tone = "lo", className, stops = 6 } = {}) {
    if (points.length < 2)
        return "";
    const ease = (t) => t * t * (3 - 2 * t);
    const hashOf = (text) => {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++)
            hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(36);
    };
    const lengths = [0];
    for (let index = 1; index < points.length; index++)
        lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
    const at = (length) => {
        let index = 1;
        while (index < points.length - 1 && lengths[index] < length)
            index++;
        const span = lengths[index] - lengths[index - 1] || 1;
        const t = Math.max(0, Math.min(1, (length - lengths[index - 1]) / span));
        return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * t, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * t];
    };
    const pieceOf = (from, to) => [at(from), ...points.filter((_, index) => lengths[index] > from + 1e-6 && lengths[index] < to - 1e-6), at(to)];
    const total = lengths[lengths.length - 1];
    if (total < 1e-6)
        return "";
    let [start, end] = Array.isArray(fade) ? fade : [fade, fade];
    if (start + end > total) {
        const share = total / (start + end);
        start *= share;
        end *= share;
    }
    const paint = `var(--anatomy-${tone})`;
    const ramp = (piece, rising) => {
        const d = pathOf(piece);
        const [x1, y1] = piece[0];
        const [x2, y2] = piece[piece.length - 1];
        const id = `iso-fade-${hashOf(`${d}|${tone}|${rising}`)}`;
        const marks = Array.from({ length: stops + 1 }, (_, index) => {
            const t = index / stops;
            const alpha = ease(rising ? t : 1 - t);
            return `<stop offset="${t.toFixed(3)}" stop-opacity="${alpha.toFixed(3)}" style="stop-color:${paint}"/>`;
        }).join("");
        const gradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${tenth(x1)}" y1="${tenth(y1)}" x2="${tenth(x2)}" y2="${tenth(y2)}">${marks}</linearGradient>`;
        return `<defs>${gradient}</defs><path${attrs({ class: className ? `iso-line ${className}` : "iso-line", "data-tone": tone, "data-free": rising ? "start" : "end", d, style: `stroke:url(#${id})` })}/>`;
    };
    const parts = [];
    if (start > 0.05)
        parts.push(ramp(pieceOf(0, start), true));
    if (total - end - start > 0.05)
        parts.push(lineSvg(pathOf(pieceOf(start, total - end)), { tone, className }));
    if (end > 0.05)
        parts.push(ramp(pieceOf(total - end, total), false));
    return `<g class="iso-fade">${parts.join("")}</g>`;
}
function wireSvg(from, to, { via = [], tone = "lo", dotted = false, dashed = false, flow = false, ends = "both", size = 1.2 } = {}) {
    const d = pathOf([from, ...via, to]);
    const end = ([x, y]) => `<circle class="iso-wire-end" cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"/>`;
    return `<g class="iso-wire" data-tone="${tone}">${lineSvg(d, { tone, dotted, dashed, flow })}${ends === "both" || ends === "from" ? end(from) : ""}${ends === "both" || ends === "to" ? end(to) : ""}</g>`;
}
function faceTextSvg(transform, text, { size = 3, tone = "mid", anchor = "start" } = {}) {
    return `<text class="iso-face-text" data-tone="${tone}" transform="${transform}" font-size="${size}" text-anchor="${anchor}">${escape(text)}</text>`;
}
function groupSvg(children, extra = {}) {
    return `<g${attrs(extra)}>${Array.isArray(children) ? children.join("") : children}</g>`;
}
function figureSvg({ width, height, label, body, standalone = false, className }) {
    const style = standalone ? `<style>${ISO_CSS}</style>` : "";
    return `<svg${attrs({
        xmlns: "http://www.w3.org/2000/svg",
        class: `iso-svg${standalone ? " iso" : ""}${className ? ` ${className}` : ""}`,
        "data-theme": standalone || undefined,
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": label,
    })}>${style}${Array.isArray(body) ? body.join("") : body}</svg>`;
}
function swatchSvg(mark) {
    if (mark === "raised" || mark === "flat" || mark === "lit") {
        const body = mark === "flat" ? "M2 6.5 8 3.5 14 6.5 8 9.5Z" : "M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z";
        const crease = mark === "flat" ? "" : `<path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/>`;
        return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="${body}"/>${crease}</svg>`;
    }
    return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
}
function plateHtml({ fig, title, hint, readout = "", keys = [], caption, body }) {
    const corner = (name, text, extra = "") => `<span class="iso-plate-corner" data-corner="${name}"${extra}>${escape(text)}</span>`;
    const legend = keys.length || caption
        ? `<figcaption class="iso-legend">${keys.length ? `<span class="iso-keys">${keys.map((key) => `<span class="iso-key">${swatchSvg(key.mark)}${escape(key.label)}</span>`).join("")}</span>` : ""}${caption ? `<span class="iso-caption">${escape(caption)}</span>` : ""}</figcaption>`
        : "";
    return `<figure class="iso-figure"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true">${corner("fig", fig)}${title ? corner("title", title) : ""}${hint ? corner("hint", hint) : ""}${corner("readout", readout, " data-readout")}</div>${body}</div>${legend}</figure>`;
}
function pageHtml({ title, theme = "dark", body, script = "", width = 650 }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${ISO_CSS}${PAGE_CSS.replace("__WIDTH__", String(width))}</style></head><body class="iso" data-theme="${theme}"><main class="iso-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}</body></html>`;
}
const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:dark}
body[data-theme="light"]{color-scheme:light}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(__WIDTH__px,100% - 32px);margin:64px auto 96px}
`;
const ISO_CSS = `
.iso{
  --anatomy-page:#0b0b0b;--anatomy-card:#131313;--anatomy-text:#a3a3a3;--anatomy-strong:#e6e6e6;--anatomy-muted:#6e6e6e;
  --anatomy-paper:#131313;--anatomy-face:#1b1b1b;--anatomy-top:#1c1c1c;
  --anatomy-shade-0:#0f0f0f;--anatomy-shade-1:#121212;--anatomy-shade-2:#151515;--anatomy-shade-3:#181818;
  --anatomy-lit-top:#262626;--anatomy-lit-shade:#1d1d1d;
  --anatomy-hi:#d4d4d4;--anatomy-mid:#6a6a6a;--anatomy-lo:#3e3e3e;--anatomy-faint:#2a2a2a;--anatomy-lit:#ffffff;
  --anatomy-halo:#050505;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;
  --anatomy-red:#ff6b6b;--anatomy-green:#6be0a0;--anatomy-blue:#6b9bff;
  --anatomy-weight:.6px;--anatomy-ease:cubic-bezier(.32,.72,0,1);
  --anatomy-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --anatomy-lift:inset 0 1px 0 0 #ffffff0a,inset 0 0 0 1px #ffffff06,0 0 0 1px #00000026,0 1px 1px -.5px #00000014,0 3px 3px -1.5px #00000014,0 6px 6px -3px #00000014,0 12px 12px -6px #00000014;
}
.iso[data-theme="light"]{
  --anatomy-page:#f2f2ef;--anatomy-card:#fbfbfa;--anatomy-text:#57575a;--anatomy-strong:#18181a;--anatomy-muted:#8c8c90;
  --anatomy-paper:#fbfbfa;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#eeeeeb;
  --anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-lit:#000000;
  --anatomy-halo:#8a8a80;--anatomy-halo-opacity:.32;--anatomy-dot:#3a3a3e;
  --anatomy-red:#e5484d;--anatomy-green:#30a46c;--anatomy-blue:#3e63dd;
  --anatomy-lift:inset 0 1px 0 0 #ffffff,0 0 0 1px #0000000f,0 1px 1px -.5px #0000000a,0 3px 3px -1.5px #0000000a,0 6px 6px -3px #0000000a,0 12px 12px -6px #0000000a;
}
.iso-svg{display:block;width:100%;height:auto;overflow:visible}
.iso-svg path,.iso-svg circle{vector-effect:non-scaling-stroke}
.iso-fill{fill:var(--anatomy-paper);stroke:none}
.iso-solid[data-lit]>.iso-fill{fill:var(--anatomy-face)}
.iso-shade,.iso-top{stroke:none}
.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}
.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}
.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}
.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}
.iso-top{fill:var(--anatomy-top)}
.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-lit-shade)}
.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:.4;stroke-linejoin:round}
.iso-solid[data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--anatomy-shade-0)}
.iso-solid[data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--anatomy-shade-1)}
.iso-solid[data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--anatomy-shade-2)}
.iso-solid[data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--anatomy-shade-3)}
.iso-solid[data-seamless]>.iso-top{stroke:var(--anatomy-top)}
.iso-solid[data-seamless][data-lit]>.iso-top{stroke:var(--anatomy-lit-top)}
.iso-solid[data-seamless][data-lit]>.iso-shade{stroke:var(--anatomy-lit-shade)}
.iso-solid[data-lit]>.iso-edge{stroke:var(--anatomy-lit)}
.iso-halo{fill:var(--anatomy-halo);stroke:none;filter:blur(9px);opacity:var(--anatomy-halo-opacity);transform:translateY(3px)}
.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}
.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}
.iso-line[data-tone="lo"]{stroke:var(--anatomy-lo)}
.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}
.iso-line[data-tone="lit"]{stroke:var(--anatomy-lit)}
.iso-line[data-tone="red"]{stroke:var(--anatomy-red)}
.iso-line[data-tone="green"]{stroke:var(--anatomy-green)}
.iso-line[data-tone="blue"]{stroke:var(--anatomy-blue)}
.iso-line[data-dotted]{stroke-dasharray:.01 3.5;stroke-width:1}
.iso-line[data-dashed]{stroke-dasharray:3 3}
.iso-line[data-flow]{stroke-dasharray:2 6}
.iso-wire-end{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-wire[data-tone="hi"] .iso-wire-end{stroke:var(--anatomy-hi)}
.iso-wire[data-tone="mid"] .iso-wire-end{stroke:var(--anatomy-mid)}
.iso-wire[data-tone="faint"] .iso-wire-end{stroke:var(--anatomy-faint)}
.iso-wire[data-tone="lit"] .iso-wire-end{stroke:var(--anatomy-lit)}
.iso-dots circle{fill:var(--anatomy-dot);stroke:none;opacity:.32}
.iso-dots[data-tone="hi"] circle{opacity:.85}
.iso-dots[data-tone="mid"] circle{opacity:.45}
.iso-dots[data-tone="lo"] circle{opacity:.22}
.iso-dots[data-tone="faint"] circle{opacity:.12}
.iso-face-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);letter-spacing:.04em}
.iso-face-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.iso-face-text[data-tone="lo"]{fill:var(--anatomy-lo)}
.iso-face-text[data-tone="faint"]{fill:var(--anatomy-faint)}
.tb-body{fill:var(--anatomy-shade-2);stroke:none}
.tb-shine{fill:var(--anatomy-top);stroke:none}
.tb-shade{fill:var(--anatomy-shade-0);stroke:none}
.tb-ring{fill:none;stroke:var(--anatomy-lo);stroke-width:.45;stroke-linecap:butt;stroke-linejoin:round}
.tb-ring[data-tone="mid"]{stroke:var(--anatomy-mid)}
.tb-ring[data-tone="faint"]{stroke:var(--anatomy-faint)}
.tb-ring[data-tone="hi"]{stroke:var(--anatomy-hi)}
@keyframes iso-flow{to{stroke-dashoffset:-32}}
@keyframes iso-pulse{0%,100%{opacity:.18}12%{opacity:1}40%{opacity:.18}}
.iso-line[data-flow]{animation:iso-flow 1600ms linear infinite}
.iso-dots circle[data-pulse]{animation:iso-pulse 1600ms steps(1,end) infinite;animation-delay:var(--pulse-at,0ms)}
.iso-figure{margin:32px 0 36px}
.iso-plate{position:relative;padding:52px 24px;border-radius:0;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-mid);--anatomy-paper:var(--anatomy-card)}
.iso-plate-corners{position:absolute;inset:18px 20px;pointer-events:none}
.iso-plate-corner{position:absolute;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.iso-plate-corner[data-corner="fig"]{top:0;left:0;color:var(--anatomy-text)}
.iso-plate-corner[data-corner="title"]{top:0;right:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="hint"]{bottom:0;left:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="readout"]{right:0;bottom:0;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.iso-plate .iso-svg{margin:0 auto}
.iso-legend{display:grid;gap:8px;margin-top:12px;color:var(--anatomy-muted);font-size:13px;line-height:1.55}
.iso-keys{display:flex;flex-wrap:wrap;gap:6px 18px}
.iso-key{display:inline-flex;align-items:center;gap:7px}
.iso-swatch{width:16px;height:10px;flex:none;overflow:visible}
.iso-swatch path{fill:none;stroke:var(--anatomy-hi);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.iso-swatch[data-mark="raised"] path,.iso-swatch[data-mark="flat"] path{stroke:var(--anatomy-mid)}
.iso-swatch[data-mark="lit"] path{stroke:var(--anatomy-lit)}
.iso-swatch[data-mark="dim"] path{stroke:var(--anatomy-lo)}
.iso-swatch[data-mark="dotted"] path{stroke-dasharray:.01 3;stroke-width:1.4}
.iso-swatch[data-mark="dashed"] path{stroke-dasharray:3 2.5}
.iso-swatch[data-mark="red"] path{stroke:var(--anatomy-red)}
.iso-swatch[data-mark="green"] path{stroke:var(--anatomy-green)}
.iso-swatch[data-mark="blue"] path{stroke:var(--anatomy-blue)}
.iso-swatch-crease{stroke:var(--anatomy-lo)!important}
@media (max-width:560px){.iso-plate{padding:48px 12px 70px}.iso-plate-corner[data-corner="hint"]{bottom:18px}}
@media (prefers-reduced-motion:reduce){.iso-line[data-flow],.iso-dots circle[data-pulse]{animation:none}}
`;

return {AZIMUTH,ELEVATION,ISO_CSS,SHADES,axisVector,boxCorners,cameraOf,circleRing,coil,corners,cylinder,depthOf,dotGrid,dotsSvg,extrude,faceTextSvg,fadeLineSvg,fadedSvg,figureSvg,fitProjection,groupSvg,haloOf,holdStill,insetPlan,iso,joinPaths,knurl,lineOnTop,lineSvg,onTop,pageHtml,pathOf,planOutline,plateHtml,pointsAt,radialTicks,ring,ringOf,ringSeam,rise,roundedPlan,screenRise,segment,sideArc,sideMatrix,sideRing,sideSeam,sideTicks,slabOf,solidSvg,topMatrix,topTicks,towardViewer,translateAlong,wireSvg};
})(void 0);
modules["lathe"] = (function(window){
const Annular = modules["annular-sector"];
const { cameraOf, iso, pathOf } = modules["iso-kit"];
const TAU = Math.PI * 2;
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a) => {
  const length = len3(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function viewOf(P) {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return [cosA * cosE, sinA * cosE, sinE];
}

function lightOf(P) {
  const { sinA, cosA } = cameraOf(P);
  return unit3([-sinA, cosA, LIGHT_UP]);
}

const scaleOf = (P) => cameraOf(P).k;

function bandOf(score) {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
}

const toneOf = (normal, P) => bandOf(dot3(unit3(normal), lightOf(P)));

function frameAlong(o, a) {
  const axis = unit3(a);
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3(cross3(helper, axis));
  const v = cross3(axis, u);
  return { o, a: axis, u, v };
}

const frameOf = (o, a, u, v) => ({ o, a, u, v });

function pointOf(F, s, r, angle) {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [
    F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]),
    F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]),
    F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]),
  ];
}

const radialOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [c * F.u[0] + n * F.v[0], c * F.u[1] + n * F.v[1], c * F.u[2] + n * F.v[2]];
};

const tangentOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [-n * F.u[0] + c * F.v[0], -n * F.u[1] + c * F.v[1], -n * F.u[2] + c * F.v[2]];
};

const angleToward = (F, direction) => Math.atan2(dot3(direction, F.v), dot3(direction, F.u));

function hullTagged(points) {
  const sorted = [...points].sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a.p[0] - o.p[0]) * (b.p[1] - o.p[1]) - (a.p[1] - o.p[1]) * (b.p[0] - o.p[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-9) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-9) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const hullOf = (points) => hullTagged(points.map((p) => ({ p }))).map(({ p }) => p);

function runsOf(flags) {
  const count = flags.length;
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  const runs = [];
  let run = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index]) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

function groupsOf(keys) {
  const count = keys.length;
  const out = [];
  const start = keys.findIndex((key, index) => key !== keys[(index + count - 1) % count]);
  if (start < 0) {
    if (keys[0] !== null) out.push({ key: keys[0], run: Array.from({ length: count + 1 }, (_, index) => index % count) });
    return out;
  }
  let current = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const key = keys[index];
    if (current && current.key === key) {
      current.run.push((index + 1) % count);
      continue;
    }
    if (current && current.key !== null) out.push(current);
    current = { key, run: [index, (index + 1) % count] };
  }
  if (current && current.key !== null) out.push(current);
  return out;
}

const stepsFor = (radius, least = 16, most = 112, scale = 0) => Math.max(least, Math.min(most, scale ? Math.ceil((TAU * radius * scale) / 3) : Math.round((radius * 1.3) / 4) * 4));

function chains(edges) {
  const out = [];
  let current = null;
  for (const [a, b, keep] of edges) {
    if (!keep) {
      if (current) out.push(current);
      current = null;
      continue;
    }
    if (!current) current = [a];
    current.push(b);
  }
  if (current) out.push(current);
  if (out.length > 1 && edges[0][2] && edges[edges.length - 1][2]) {
    const last = out.pop();
    out[0] = [...last, ...out[0].slice(1)];
  }
  return out;
}

function labelledArcs(nr, na, view, light, gr = nr, ga = na) {
  const cuts = [];
  if (Math.abs(gr) > 1e-9) {
    const visibleCut = -(ga * view.a) / (gr * view.flat);
    if (visibleCut > -1 && visibleCut < 1) {
      const d = Math.acos(visibleCut);
      cuts.push(view.phi - d, view.phi + d);
    }
  }
  if (Math.abs(nr) > 1e-9) {
    for (const threshold of BANDS) {
      const c = (threshold - na * light.a) / (nr * light.flat);
      if (c > -1 && c < 1) {
        const d = Math.acos(c);
        cuts.push(light.phi - d, light.phi + d);
      }
    }
  }
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const sorted = [...new Set(cuts.map((angle) => Math.round(wrap(angle) * 1e9) / 1e9))].sort((a, b) => a - b);
  const label = (angle) => {
    const facing = gr * view.flat * Math.cos(angle - view.phi) + ga * view.a;
    if (facing <= 1e-9) return -1;
    return bandOf(nr * light.flat * Math.cos(angle - light.phi) + na * light.a);
  };
  if (!sorted.length) {
    const tone = label(0);
    return tone < 0 ? [] : [{ tone, from: 0, to: TAU, full: true }];
  }
  const arcs = sorted.map((from, index) => {
    const to = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + TAU;
    return { tone: label((from + to) / 2), from, to };
  });
  const merged = [];
  for (const arc of arcs) {
    const last = merged[merged.length - 1];
    if (last && last.tone === arc.tone && Math.abs(last.to - arc.from) < 1e-9) last.to = arc.to;
    else merged.push({ ...arc });
  }
  if (merged.length > 1 && merged[0].tone === merged[merged.length - 1].tone && Math.abs(merged[merged.length - 1].to - TAU - merged[0].from) < 1e-9) {
    const last = merged.pop();
    merged[0].from = last.from - TAU;
  }
  return merged.filter((arc) => arc.tone >= 0);
}

function hermiteSlopes(run) {
  const n = run.length - 1;
  const h = Array.from({ length: n }, (_, j) => run[j + 1][0] - run[j][0]);
  const delta = h.map((value, j) => (run[j + 1][1] - run[j][1]) / value);
  const d = new Array(n + 1).fill(0);
  const end = (h0, h1, d0, d1) => {
    let value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(value) !== Math.sign(d0)) value = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > Math.abs(3 * d0)) value = 3 * d0;
    return value;
  };
  if (n === 1) d[0] = d[1] = delta[0];
  else {
    d[0] = end(h[0], h[1], delta[0], delta[1]);
    d[n] = end(h[n - 1], h[n - 2], delta[n - 1], delta[n - 2]);
  }
  for (let k = 1; k < n; k++) {
    if (delta[k - 1] * delta[k] <= 0) continue;
    const w1 = 2 * h[k] + h[k - 1];
    const w2 = h[k] + 2 * h[k - 1];
    d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
  }
  return d;
}

function curveRuns(meridian) {
  const m = meridian.length;
  const segments = new Array(m - 1).fill(null);
  let start = 0;
  while (start < m - 1) {
    let end = start + 1;
    while (end < m - 1 && meridian[end][2] && Math.abs(meridian[end + 1][0] - meridian[end][0]) > 1e-9 && Math.abs(meridian[end][0] - meridian[end - 1][0]) > 1e-9) end++;
    const run = meridian.slice(start, end + 1);
    const n = run.length - 1;
    if (n >= 2 && run.every((point, j) => j === 0 || Math.abs(point[0] - run[j - 1][0]) > 1e-9)) {
      const d = hermiteSlopes(run);
      for (let j = 0; j < n; j++) {
        const [s0, r0] = run[j];
        const [s1, r1] = run[j + 1];
        const hj = s1 - s0;
        const d0 = d[j];
        const d1 = d[j + 1];
        const radius = (s) => {
          const t = (s - s0) / hj;
          return (2 * t ** 3 - 3 * t ** 2 + 1) * r0 + (t ** 3 - 2 * t ** 2 + t) * hj * d0 + (-2 * t ** 3 + 3 * t ** 2) * r1 + (t ** 3 - t ** 2) * hj * d1;
        };
        const slope = (s) => {
          const t = (s - s0) / hj;
          return ((6 * t ** 2 - 6 * t) * r0 + (6 * t - 6 * t ** 2) * r1) / hj + (3 * t ** 2 - 4 * t + 1) * d0 + (3 * t ** 2 - 2 * t) * d1;
        };
        segments[start + j] = { radius, slope };
      }
    }
    start = end;
  }
  return segments;
}

function curved(meridian, P, segments, { error = 0.2, depth = 6 } = {}) {
  const k = scaleOf(P);
  const out = [meridian[0]];
  for (let i = 0; i < meridian.length - 1; i++) {
    const curve = segments[i];
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    if (curve) {
      const split = (a, b, level) => {
        const mid = (a + b) / 2;
        const chord = (curve.radius(a) + curve.radius(b)) / 2;
        if (level < depth && Math.abs(curve.radius(mid) - chord) * k > error) {
          split(a, mid, level + 1);
          out.push([mid, curve.radius(mid), 1]);
          split(mid, b, level + 1);
        }
      };
      split(s0, s1, 0);
    }
    out.push(meridian[i + 1]);
  }
  return out;
}

function smoothRows(meridian, F, P, { rows = 6, slope = null, radius = null, steps = 48, error = 0.35, depth: deepest = 8, fineness = 0.1 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const view = { a: dot3(F.a, V), flat: Math.hypot(dot3(F.u, V), dot3(F.v, V)), phi: Math.atan2(dot3(F.v, V), dot3(F.u, V)) };
  const light = { a: dot3(F.a, L), flat: Math.hypot(dot3(F.u, L), dot3(F.v, L)), phi: Math.atan2(dot3(F.v, L), dot3(F.u, L)) };
  const m = meridian.length;
  const faces = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr) || 1;
    faces.push([ds / length, -dr / length]);
  }
  const splines = slope ? null : curveRuns(meridian);
  const vertexNormal = (k, own) => {
    if (k <= 0 || k >= m - 1 || !meridian[k][2]) return own;
    const a = faces[k - 1];
    const b = faces[k];
    const x = a[0] + b[0];
    const y = a[1] + b[1];
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const normalAt = (i, u) => {
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    const sign = Math.sign(s1 - s0) || 1;
    const g = slope ? slope(s) : splines[i] ? splines[i].slope(s) : null;
    if (g !== null) {
      const length = Math.hypot(1, g);
      return [sign / length, (-sign * g) / length];
    }
    const a = vertexNormal(i, faces[i]);
    const b = vertexNormal(i + 1, faces[i]);
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const pointAt = (i, u, angle) => {
    const [s0, r0] = meridian[i];
    const [s1, r1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    return iso(pointOf(F, s, radius ? radius(s) : splines && splines[i] ? splines[i].radius(s) : r0 + (r1 - r0) * u, angle), P);
  };
  const buckets = [[], [], [], [], []];
  const fine = TAU / Math.max(24, Math.min(192, steps * 1.5));
  const arcPoints = (i, u, from, to) => {
    const count = Math.max(1, Math.ceil((to - from) / fine));
    return Array.from({ length: count + 1 }, (_, index) => pointAt(i, u, from + ((to - from) * index) / count));
  };
  const centreOf = (arc, reference) => {
    let mid = (arc.from + arc.to) / 2 - reference;
    mid = ((mid % TAU) + TAU) % TAU;
    return mid;
  };
  const levelOf = (i, u) => {
    const [nr, na] = normalAt(i, u);
    const groups = new Map();
    for (const arc of labelledArcs(nr, na, view, light, faces[i][0], faces[i][1])) {
      if (!groups.has(arc.tone)) groups.set(arc.tone, []);
      groups.get(arc.tone).push(arc);
    }
    for (const list of groups.values()) list.sort((x, y) => centreOf(x, light.phi) - centreOf(y, light.phi));
    return { i, u, groups };
  };
  const same = (x, y) => {
    if (x.groups.size !== y.groups.size) return false;
    for (const [tone, list] of x.groups) if ((y.groups.get(tone) ?? []).length !== list.length) return false;
    return true;
  };
  const align = (reference, arc) => {
    const out = { ...arc };
    const centre = (reference.from + reference.to) / 2;
    while ((out.from + out.to) / 2 - centre > Math.PI) {
      out.from -= TAU;
      out.to -= TAU;
    }
    while (centre - (out.from + out.to) / 2 > Math.PI) {
      out.from += TAU;
      out.to += TAU;
    }
    return out;
  };
  const strayOf = (i, a, mid, b) => {
    let worst = 0;
    for (const [tone, list] of mid.groups) {
      list.forEach((arc, index) => {
        const lo = align(arc, a.groups.get(tone)[index]);
        const hi = align(arc, b.groups.get(tone)[index]);
        for (const key of ["from", "to"]) {
          const p = pointAt(i, mid.u, arc[key]);
          const p0 = pointAt(i, a.u, lo[key]);
          const p1 = pointAt(i, b.u, hi[key]);
          worst = Math.max(worst, Math.hypot(p[0] - (p0[0] + p1[0]) / 2, p[1] - (p0[1] + p1[1]) / 2));
        }
      });
    }
    return worst;
  };
  const sheet = (tone, levels) => {
    levels[0].groups.get(tone).forEach((arc, index) => {
      const chain = [arc];
      for (let k = 1; k < levels.length; k++) chain.push(align(chain[k - 1], levels[k].groups.get(tone)[index]));
      const last = levels.length - 1;
      const points = [...arcPoints(levels[0].i, levels[0].u, chain[0].from, chain[0].to)];
      for (let k = 1; k < last; k++) points.push(pointAt(levels[k].i, levels[k].u, chain[k].to));
      points.push(...arcPoints(levels[last].i, levels[last].u, chain[last].from, chain[last].to).reverse());
      for (let k = last - 1; k >= 1; k--) points.push(pointAt(levels[k].i, levels[k].u, chain[k].from));
      buckets[tone].push(pathOf(oriented(points), true));
    });
  };
  const overlap = (x, y) => Math.min(x.to, y.to) - Math.max(x.from, y.from);
  const strip = (tone, a, b) => {
    const below = a.groups.get(tone) ?? [];
    const above = (b.groups.get(tone) ?? []).map((arc) => ({ arc, used: false }));
    const quad = (lo, hi) => {
      const points = [...arcPoints(a.i, a.u, lo.from, lo.to), ...arcPoints(b.i, b.u, hi.from, hi.to).reverse()];
      buckets[tone].push(pathOf(oriented(points), true));
    };
    for (const arc of below) {
      let best = null;
      let score = -Infinity;
      for (const entry of above) {
        if (entry.used) continue;
        const aligned = align(arc, entry.arc);
        const value = overlap(arc, aligned);
        if (value > score) (score = value), (best = entry);
      }
      if (best && score > -0.05) {
        best.used = true;
        quad(arc, align(arc, best.arc));
      } else {
        const centre = (arc.from + arc.to) / 2;
        quad(arc, { from: centre, to: centre });
      }
    }
    for (const entry of above) {
      if (entry.used) continue;
      const centre = (entry.arc.from + entry.arc.to) / 2;
      quad({ from: centre, to: centre }, entry.arc);
    }
  };
  const k = scaleOf(P);
  let run = [];
  const flush = () => {
    const tones = [...new Set(run.flatMap((level) => [...level.groups.keys()]))].sort((x, y) => x - y);
    for (const tone of tones) {
      const countOf = (level) => (level.groups.get(tone) ?? []).length;
      let start = 0;
      for (let at = 1; at <= run.length; at++) {
        if (at < run.length && countOf(run[at - 1]) === countOf(run[at])) continue;
        if (at - 1 > start && countOf(run[start])) sheet(tone, run.slice(start, at));
        if (at < run.length) strip(tone, run[at - 1], run[at]);
        start = at;
      }
    }
    run = [];
  };
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    if (Math.abs(ds) < 1e-9) {
      flush();
      continue;
    }
    const count = Math.max(1, rows);
    const reach = (Math.hypot(ds, meridian[i + 1][1] - meridian[i][1]) * k) / count;
    const limit = Math.max(1, Math.min(deepest, Math.ceil(Math.log2(Math.max(2, reach / fineness)))));
    const coarse = Array.from({ length: count + 1 }, (_, index) => levelOf(i, index / count));
    run.push(coarse[0]);
    const refine = (a, b, depth) => {
      const mid = levelOf(i, (a.u + b.u) / 2);
      const split = depth < limit && (!same(a, b) || !same(a, mid) || (depth < 6 && strayOf(i, a, mid, b) > error));
      if (!split) {
        run.push(b);
        return;
      }
      refine(a, mid, depth + 1);
      refine(mid, b, depth + 1);
    };
    for (let index = 1; index <= count; index++) refine(coarse[index - 1], coarse[index], 0);
  }
  flush();
  return buckets;
}

function sideOf(meridian) {
  const m = meridian.length;
  let first = 0;
  let last = m - 1;
  if (meridian[0][1] <= 1e-9) first = 1;
  if (meridian[m - 1][1] <= 1e-9) last = m - 2;
  const side = meridian.slice(first, last + 1);
  for (let index = 1; index < side.length; index++) if (side[index][0] - side[index - 1][0] <= 1e-9) return null;
  return side.length >= 3 ? side : null;
}

function surfaceOf(side, F, P, rims, { samples = 96, slope = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const facing = Math.atan2(dot3(F.v, V), dot3(F.u, V));
  const [left, right] = silhouettePoints(side, F, P, { samples, slope });
  if (left.length <= samples || right.length <= samples) return null;
  const s0 = side[0][0];
  const s1 = side[side.length - 1][0];
  const angleOf = (point) => angleToward(F, sub3(point, add3(F.o, mul3(F.a, dot3(sub3(point, F.o), F.a)))));
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const arc = (s, r, from, to, through) => {
    let sweep = wrap(to - from);
    if (wrap(through - from) > sweep) sweep -= TAU;
    const count = Math.max(4, Math.ceil(Math.abs(sweep) / (TAU / 96)), Math.ceil((Math.abs(sweep) * r * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, index) => iso(pointOf(F, s, r, from + (sweep * index) / count), P));
  };
  const r0 = side[0][1];
  const r1 = side[side.length - 1][1];
  const bottom = -aV > 0 ? facing + Math.PI : facing;
  const top = aV > 0 ? facing + Math.PI : facing;
  const L = left.map((point) => iso(point, P));
  const R = right.map((point) => iso(point, P));
  const topArc = arc(s1, r1, angleOf(left[left.length - 1]), angleOf(right[right.length - 1]), top);
  const bottomArc = arc(s0, r0, angleOf(right[0]), angleOf(left[0]), bottom);
  const keepFirst = rims === "all" || rims === "first" || rims === "ends";
  const keepLast = rims === "all" || rims === "last" || rims === "ends";
  const fill = pathOf([...L, ...topArc, ...[...R].reverse(), ...bottomArc], true);
  const outline = [pathOf(L), pathOf(R), keepLast ? pathOf(topArc) : "", keepFirst ? pathOf(bottomArc) : ""].join("");
  const hull = hullOf([...arc(s0, r0, 0, TAU - 1e-6, Math.PI), ...arc(s1, r1, 0, TAU - 1e-6, Math.PI), ...L, ...R]);
  let gap = 0;
  for (const p of [...L, ...R]) {
    let best = Infinity;
    for (let index = 0; index < hull.length; index++) {
      const a = hull[index];
      const b = hull[(index + 1) % hull.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t));
    }
    gap = Math.max(gap, best);
  }
  return { fill, outline, gap };
}

const softOf = (meridian) => meridian.some((point) => Boolean(point[2]));

function lathe(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, bevel = 0, rims = "all", smooth: asked = "auto", waist = 0.5 } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const V = viewOf(P);
  const L = lightOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const aL = dot3(F.a, L);
  const uL = dot3(F.u, L);
  const vL = dot3(F.v, L);
  const n = steps;
  const m = meridian.length;
  const rings = meridian.map(([s, r]) => Array.from({ length: n }, (_, j) => iso(pointOf(F, s, r, (j / n) * TAU), P)));
  const midC = [];
  const midS = [];
  for (let j = 0; j < n; j++) {
    const t = ((j + 0.5) / n) * TAU;
    midC.push(Math.cos(t));
    midS.push(Math.sin(t));
  }
  const seen = [];
  const tones = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr);
    const row = [];
    const toneRow = [];
    for (let j = 0; j < n; j++) {
      if (length < 1e-9) {
        row.push(false);
        toneRow.push(0);
        continue;
      }
      const facing = ds * (midC[j] * uV + midS[j] * vV) - dr * aV;
      const lit = (ds * (midC[j] * uL + midS[j] * vL) - dr * aL) / length;
      row.push(facing > 1e-6 * length);
      toneRow.push(bandOf(lit));
    }
    seen.push(row);
    tones.push(toneRow);
  }
  const buckets = [[], [], [], [], []];
  const all = [];
  const smoothed = smooth ? smoothRows(meridian, F, P, { steps, ...(smooth === true ? {} : smooth) }) : null;
  if (smoothed) smoothed.forEach((list, tone) => list.forEach((d) => (buckets[tone].push(d), all.push(d))));
  for (let i = 0; i < m - 1; i++) {
    if (smoothed && Math.abs(meridian[i + 1][0] - meridian[i][0]) > 1e-9) continue;
    const keys = seen[i].map((visible, j) => (visible ? tones[i][j] : null));
    for (const { key, run } of groupsOf(keys)) {
      const a = run.map((j) => rings[i][j]);
      const b = run.map((j) => rings[i + 1][j]).reverse();
      const d = pathOf(oriented([...a, ...b]), true);
      buckets[key].push(d);
      all.push(d);
    }
  }
  const phi = Math.atan2(vV, uV);
  const flatV = Math.hypot(uV, vV);
  const rangeOf = (i) => {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    if (Math.hypot(ds, dr) < 1e-9) return null;
    if (Math.abs(ds) < 1e-9 || flatV < 1e-9) return -dr * aV > 1e-9 ? [-1, 1] : null;
    const c = (dr * aV) / (ds * flatV);
    return ds > 0 ? [Math.max(-1, c), 1] : [-1, Math.min(1, c)];
  };
  const arcsOf = (ranges) => {
    if (ranges.some((range) => !range)) return [];
    const lo = Math.max(...ranges.map(([x]) => x));
    const hi = Math.min(...ranges.map(([, x]) => x));
    if (lo >= hi - 1e-9) return [];
    const near = Math.acos(Math.min(1, hi));
    const far = Math.acos(Math.max(-1, lo));
    if (hi >= 1 && lo <= -1) return [[phi, phi + TAU]];
    if (hi >= 1) return [[phi - far, phi + far]];
    if (lo <= -1) return [[phi + near, phi + TAU - near]];
    return [[phi + near, phi + far], [phi - far, phi - near]];
  };
  const along = (s, r, [from, to]) => {
    const count = Math.max(2, Math.ceil(((to - from) * Math.max(r, 1e-6) * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, j) => iso(pointOf(F, s, r, from + ((to - from) * j) / count), P));
  };
  const creases = [];
  for (let i = 1; i < m - 1; i++) {
    if (meridian[i][2] || meridian[i][1] <= 1e-9) continue;
    for (const arc of arcsOf([rangeOf(i - 1), rangeOf(i)])) creases.push(pathOf(along(meridian[i][0], meridian[i][1], arc)));
  }
  let bevelPath = "";
  if (bevel > 0 && m > 2) {
    const ends = [];
    if (meridian[0][1] <= 1e-9) ends.push([0, 1, 1]);
    if (meridian[m - 1][1] <= 1e-9) ends.push([m - 2, m - 2, m - 3]);
    for (const [cap, rim, side] of ends) {
      const [s, r] = meridian[rim];
      for (const arc of arcsOf([rangeOf(cap), rangeOf(side)])) {
        const inset = along(s, Math.max(0, r - bevel), arc);
        const edge = along(s, r, arc);
        bevelPath += pathOf([edge[0], ...inset.slice(1, -1), edge[edge.length - 1]]);
      }
    }
  }
  const { fill: fillPath, outline } = outlineOf(meridian, F, P, { steps: n, fill, hole, rims, smooth, waist, all });
  return {
    fill: fillPath,
    outline,
    crease: creases.join(""),
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    bevel: bevelPath || undefined,
    seamless: Boolean(smoothed),
  };
}

function shapeOf(meridian, P, smooth) {
  if (smooth && smooth.radius) {
    const segments = meridian.slice(0, -1).map(([s0], index) => (Math.abs(meridian[index + 1][0] - s0) > 1e-9 ? { radius: smooth.radius, slope: smooth.slope } : null));
    return curved(meridian, P, segments);
  }
  const curves = smooth && !smooth.slope ? curveRuns(meridian) : null;
  return curves && curves.some(Boolean) ? curved(meridian, P, curves) : meridian;
}

function outlineOf(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, rims = "all", smooth: asked = "auto", waist = 0.5, all = null } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const n = steps;
  let fillPath;
  let outline;
  const shape = shapeOf(meridian, P, smooth);
  const side = fill === "auto" || fill === "surface" ? sideOf(shape) : null;
  const surface = side && !hole ? surfaceOf(side, F, P, rims, { slope: smooth && smooth.slope ? smooth.slope : null }) : null;
  if (surface && (fill === "surface" || surface.gap > waist)) {
    fillPath = surface.fill;
    outline = surface.outline;
  } else if (fill === "hull" || fill === "auto" || fill === "surface") {
    const most = Math.max(...shape.map(([, r]) => r));
    const around = Math.min(320, Math.max(n, Math.ceil((TAU * most * scaleOf(P)) / 1.5)));
    const tagged = [];
    shape.forEach(([s, r], index) => {
      for (let j = 0; j < around; j++) tagged.push({ p: iso(pointOf(F, s, r, (j / around) * TAU), P), ring: index });
    });
    const hull = hullTagged(tagged);
    const holePath = hole ? pathOf(Array.from({ length: around }, (_, j) => iso(pointOf(F, hole[0], hole[1], (j / around) * TAU), P)), true) : "";
    fillPath = pathOf(hull.map(({ p }) => p), true) + holePath;
    if (rims === "all") {
      outline = pathOf(hull.map(({ p }) => p), true) + holePath;
    } else {
      const keepFirst = rims === "first" || rims === "ends";
      const keepLast = rims === "last" || rims === "ends";
      const edges = hull.map((a, index) => {
        const b = hull[(index + 1) % hull.length];
        const same = a.ring === b.ring;
        const keep = !same || (a.ring !== 0 && a.ring !== shape.length - 1) || (keepFirst && a.ring === 0) || (keepLast && a.ring === shape.length - 1);
        return [a.p, b.p, keep];
      });
      outline = chains(edges).map((points) => pathOf(points)).join("") + holePath;
    }
  } else {
    fillPath = all ? all.join("") : (({ shades, top }) => [...shades, top].join(""))(lathe(meridian, F, P, { steps: n, fill: "auto", hole, rims, smooth, waist }));
    outline = "";
  }
  return { fill: fillPath, outline };
}

const signedArea = (points) => points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);

const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);

const saddleStart = (R, a, angle) => Math.sqrt(Math.max(0, R * R - a * a * Math.cos(angle) ** 2));

function saddleOf(F, a, start, s1, P, { steps = stepsFor(a, 24) } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const n = steps;
  const angle = (j) => (j / n) * TAU;
  const from = typeof start === "function" ? start : (t) => saddleStart(start, a, t);
  const low = Array.from({ length: n }, (_, j) => iso(pointOf(F, from(angle(j)), a, angle(j)), P));
  const high = Array.from({ length: n }, (_, j) => iso(pointOf(F, s1, a, angle(j)), P));
  const seen = [];
  const tones = [];
  for (let j = 0; j < n; j++) {
    const normal = radialOf(F, angle(j + 0.5));
    seen.push(dot3(normal, V) > 1e-6);
    tones.push(bandOf(dot3(normal, L)));
  }
  const buckets = [[], [], [], [], []];
  const fills = [];
  const keys = seen.map((visible, j) => (visible ? tones[j] : null));
  for (const { key, run } of groupsOf(keys)) {
    const d = pathOf(oriented([...run.map((j) => low[j]), ...run.map((j) => high[j]).reverse()]), true);
    buckets[key].push(d);
    fills.push(d);
  }
  const capSeen = dot3(F.a, V) > 1e-6;
  if (capSeen) {
    const d = pathOf(oriented(high), true);
    buckets[bandOf(dot3(F.a, L))].push(d);
    fills.push(d);
  }
  const front = runsOf(seen);
  const back = runsOf(seen.map((visible) => !visible));
  const edges = [];
  for (const run of front) {
    edges.push(pathOf(run.map((j) => low[j])));
    edges.push(pathOf([low[run[0]], high[run[0]]]), pathOf([low[run[run.length - 1]], high[run[run.length - 1]]]));
  }
  for (const run of capSeen ? back : front) edges.push(pathOf(run.map((j) => high[j])));
  return {
    fill: fills.join(""),
    outline: edges.join(""),
    crease: capSeen ? front.map((run) => pathOf(run.map((j) => high[j]))).join("") : "",
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    seamless: true,
  };
}

function prismOf(F, polygon, s0, s1, P) {
  const V = viewOf(P);
  const L = lightOf(P);
  const ring = oriented(polygon.map(([x, y]) => [x, y]));
  const n = ring.length;
  const at = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
  const low = ring.map((point) => iso(at(s0, point), P));
  const high = ring.map((point) => iso(at(s1, point), P));
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[(j + 1) % n];
    const normal = unit3(add3(mul3(F.u, y1 - y0), mul3(F.v, -(x1 - x0))));
    const visible = dot3(normal, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[bandOf(dot3(normal, L))].push(pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true));
  }
  const ends = [[s0, low, mul3(F.a, -1)], [s1, high, F.a]];
  const capSeen = ends.map(([, , normal]) => dot3(normal, V) > 1e-6);
  ends.forEach(([, points, normal], index) => capSeen[index] && buckets[bandOf(dot3(normal, L))].push(pathOf(points, true)));
  const hull = hullOf([...low, ...high]);
  const creases = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    const a = [ring[j][0] - ring[prev][0], ring[j][1] - ring[prev][1]];
    const b = [ring[(j + 1) % n][0] - ring[j][0], ring[(j + 1) % n][1] - ring[j][1]];
    const sharp = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1) < Math.cos(0.35);
    if (sharp && seen[j] && seen[prev]) creases.push(pathOf([low[j], high[j]]));
    ends.forEach(([, points], index) => capSeen[index] && seen[j] && creases.push(pathOf([points[j], points[(j + 1) % n]])));
  }
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: creases.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

function stadium(r0, r1, offset, steps = 32) {
  const circle = (cx, r) => Array.from({ length: steps }, (_, index) => [cx + r * Math.cos((index / steps) * TAU), r * Math.sin((index / steps) * TAU)]);
  return hullOf([...circle(0, r0), ...circle(offset, r1)]);
}

function sphereOf(centre, r, P, { steps = 48 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const F = frameAlong(centre, V);
  const flat = (p) => iso(p, P);
  const rim = Array.from({ length: steps }, (_, index) => pointOf(F, 0, r, (index / steps) * TAU));
  const outline = pathOf(rim.map(flat), true);
  const capOf = (threshold) => {
    const points = rim.filter((p) => dot3(sub3(p, centre), L) / r >= threshold).map(flat);
    const c = dot3(L, V);
    const LF = frameAlong(add3(centre, mul3(L, r * threshold)), L);
    const radius = r * Math.sqrt(Math.max(0, 1 - threshold * threshold));
    for (let index = 0; index < steps; index++) {
      const p = pointOf(LF, 0, radius, (index / steps) * TAU);
      if (dot3(sub3(p, centre), V) >= -1e-9) points.push(flat(p));
    }
    if (c > threshold) points.push(flat(add3(centre, mul3(V, r))));
    return points.length > 2 ? pathOf(hullOf(points), true) : "";
  };
  const shades = [outline, capOf(BANDS[1]), capOf(BANDS[2]), capOf(BANDS[3])];
  return { fill: outline, outline, crease: "", top: "", shades, seamless: true };
}

const disc = (s0, s1, r, F, P, options = {}) =>
  lathe(
    [
      [s0, 0],
      [s0, r],
      [s1, r],
      [s1, 0],
    ],
    F,
    P,
    { steps: stepsFor(r, 32, 160, scaleOf(P)), ...options },
  );

const ringBand = (s0, s1, rIn, rOut, F, P, options = {}) =>
  lathe(
    [
      [s0, rIn],
      [s0, rOut],
      [s1, rOut],
      [s1, rIn],
    ],
    F,
    P,
    { steps: stepsFor(rOut, 32, 160, scaleOf(P)), hole: null, ...options },
  );

function solidOf(profile, F, P, options = {}) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  const meridian = [[first[0], 0], ...profile, [last[0], 0]];
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(meridian, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function bandOfProfile(profile, F, P, options = {}) {
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(profile, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function silhouettePoints(profile, F, P, { samples = 72, slope: given = null, radius = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const facing = Math.atan2(vV, uV);
  const flat = Math.hypot(uV, vV) || 1e-9;
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const radiusAt = radius ?? ((s) => {
    let index = 1;
    while (index < profile.length - 1 && profile[index][0] < s) index++;
    const [sa, ra] = profile[index - 1];
    const [sb, rb] = profile[index];
    return ra + ((rb - ra) * (s - sa)) / (sb - sa || 1);
  });
  const side = (sign) => {
    const points = [];
    for (let step = 0; step <= samples; step++) {
      const s = s0 + ((s1 - s0) * step) / samples;
      const h = (s1 - s0) / samples / 2 || 0.01;
      const slope = given ? given(s) : (radiusAt(Math.min(s1, s + h)) - radiusAt(Math.max(s0, s - h))) / (Math.min(s1, s + h) - Math.max(s0, s - h) || 1);
      const c = (slope * aV) / flat;
      if (Math.abs(c) > 1) continue;
      points.push(pointOf(F, s, radiusAt(s), facing + sign * Math.acos(c)));
    }
    return points;
  };
  return [side(1), side(-1)];
}

const silhouetteOf = (profile, F, P, options = {}) =>
  silhouettePoints(profile, F, P, options)
    .map((points) => pathOf(points.map((point) => iso(point, P))))
    .join("");

function profileCurve(profile, { slope = null, radius = null } = {}) {
  for (let index = 1; index < profile.length; index++) if (profile[index][0] - profile[index - 1][0] <= 1e-9) throw new Error(`profileCurve: s must rise along the profile (point ${index} at s = ${profile[index][0]})`);
  const segments = curveRuns(profile);
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const find = (s) => {
    let lo = 0;
    let hi = profile.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (profile[mid][0] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const linear = (index, s) => {
    const [sa, ra] = profile[index];
    const [sb, rb] = profile[index + 1];
    return [ra + ((rb - ra) * (s - sa)) / (sb - sa), (rb - ra) / (sb - sa)];
  };
  const radiusAt = radius ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].radius(at) : linear(index, at)[0];
  });
  const slopeAt = slope ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].slope(at) : linear(index, at)[1];
  });
  return { s0, s1, radius: radiusAt, slope: slopeAt, analytic: Boolean(slope && radius) };
}

function bandsOf(profile, cuts, F, P, { slope = null, radius = null, steps, rows = 6, rims = "none", fill = "auto", samples = 72 } = {}) {
  const curve = profileCurve(profile, { slope, radius });
  const { s0, s1 } = curve;
  const stops = [s0, ...[...new Set(cuts)].filter((s) => s > s0 + 1e-6 && s < s1 - 1e-6).sort((a, b) => a - b), s1];
  const most = Math.max(...profile.map(([, r]) => r), ...stops.map((s) => curve.radius(s)));
  const n = steps ?? stepsFor(most, 32, 160, scaleOf(P));
  const knot = (s, soft) => (soft ? [s, curve.radius(s), 1] : [s, curve.radius(s)]);
  const meridianOf = (a, b) => [knot(a), ...profile.filter(([s]) => s > a + 1e-9 && s < b - 1e-9).map(([s, , soft]) => knot(s, soft)), knot(b)];
  const shading = { slope: curve.slope, radius: curve.radius, rows };
  const bands = stops.slice(0, -1).map((a, index) => {
    const b = stops[index + 1];
    const meridian = meridianOf(a, b);
    const paths = lathe(meridian, F, P, { steps: n, rims, fill, smooth: shading });
    const seam = index < stops.length - 2 ? arcOf(F, b, curve.radius(b), P, { slope: curve.slope(b) }) : "";
    return { s0: a, s1: b, profile: meridian, paths: { ...paths, outline: "" }, outline: paths.outline, seam };
  });
  const sidesOf = (from = s0, to = s1, { ends = false, count = samples } = {}) => {
    const span = [Math.max(s0, from), Math.min(s1, to)];
    const dense = Array.from({ length: count + 1 }, (_, index) => knot(span[0] + ((span[1] - span[0]) * index) / count, true));
    const points = silhouettePoints(dense, F, P, { samples: count, slope: curve.slope, radius: curve.radius });
    const rim = (s) => arcOf(F, s, curve.radius(s), P, { slope: curve.slope(s) });
    const rimsAt = ends === true ? span : ends === "first" ? [span[0]] : ends === "last" ? [span[1]] : [];
    return { d: points.map((list) => pathOf(list.map((point) => iso(point, P)))).join("") + rimsAt.map(rim).join(""), points };
  };
  return { bands, sidesOf, radius: curve.radius, slope: curve.slope, steps: n, s0, s1 };
}

function arcOf(F, s, r, P, { slope = 0, steps = 0, least = 0.02, inward = false, from = 0, to = TAU, trim = 0.3 } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const flat = Math.hypot(uV, vV);
  const phi = Math.atan2(vV, uV);
  const norm = Math.hypot(1, slope);
  const full = Math.abs(to - from - TAU) < 1e-9;
  let visible;
  if (flat < 1e-9) visible = (inward ? slope * aV / norm > least : -slope * aV / norm > least) ? [[phi, phi + TAU]] : [];
  else if (inward) {
    const c = (slope * aV - least * norm) / flat;
    visible = c <= -1 ? [] : c >= 1 ? [[phi, phi + TAU]] : [[phi + Math.acos(c), phi + TAU - Math.acos(c)]];
  } else {
    const c = (least * norm + slope * aV) / flat;
    visible = c >= 1 ? [] : c <= -1 ? [[phi, phi + TAU]] : [[phi - Math.acos(c), phi + Math.acos(c)]];
  }
  const at = (t) => iso(pointOf(F, s, r, t), P);
  const speed = (t) => {
    const a = at(t - 1e-3);
    const b = at(t + 1e-3);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 2e-3;
  };
  const count = (span) => Math.max(2, Math.ceil(((steps || stepsFor(r, 24, 112)) * span) / TAU), Math.ceil((span * r * scaleOf(P)) / 1.5));
  const out = [];
  for (const [a, b] of visible) {
    if (b - a >= TAU - 1e-9 && full) {
      const n = count(TAU);
      out.push(pathOf(Array.from({ length: n }, (_, j) => at(from + (j / n) * TAU)), true));
      continue;
    }
    const pieces = full ? [[a, b, true, true]] : [];
    if (!full)
      for (let turn = -2; turn <= 2; turn++) {
        const lo = Math.max(a + turn * TAU, from);
        const hi = Math.min(b + turn * TAU, to);
        if (hi - lo > 1e-6) pieces.push([lo, hi, lo > from + 1e-9, hi < to - 1e-9]);
      }
    for (const [lo, hi, limb0, limb1] of pieces) {
      const span = hi - lo;
      const cut0 = limb0 && trim > 0 ? Math.min(span * 0.25, trim / (speed(lo) || 1)) : 0;
      const cut1 = limb1 && trim > 0 ? Math.min(span * 0.25, trim / (speed(hi) || 1)) : 0;
      const t0 = lo + cut0;
      const t1 = hi - cut1;
      const n = count(t1 - t0);
      out.push(pathOf(Array.from({ length: n + 1 }, (_, j) => at(t0 + ((t1 - t0) * j) / n))));
    }
  }
  return out.join("");
}

function circleOf(F, s, r, P, steps = 0) {
  const count = steps || stepsFor(r, 24, 112);
  return pathOf(
    Array.from({ length: count }, (_, j) => iso(pointOf(F, s, r, (j / count) * TAU), P)),
    true,
  );
}

function spokesOf(F, s, r0, r1, count, P, { phase = 0, sweep = 0, from = 0, to = TAU } = {}) {
  const lines = [];
  for (let index = 0; index < count; index++) {
    const t = phase + from + (index / count) * (to - from);
    lines.push(pathOf([iso(pointOf(F, s, r0, t), P), iso(pointOf(F, s, r1, t + sweep), P)]));
  }
  return lines.join("");
}

const fadeOf = (value, [lo, hi]) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1e-9)));
  return t * t * (3 - 2 * t);
};

function ribsOf(F, s0, s1, r, count, P, { phase = 0, twist = 0, least = 0.12, r1 = r, fade = null, seams = false } = {}) {
  const V = viewOf(P);
  const lines = [];
  const slope = (r1 - r) / (s1 - s0 || 1);
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    const radial = radialOf(F, t + twist / 2);
    const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
    const facing = dot3(normal, V);
    const d = pathOf([iso(pointOf(F, s0, r, t), P), iso(pointOf(F, s1, r1, t + twist), P)]);
    if (fade) {
      const alpha = fadeOf(facing, fade);
      if (alpha > 0.02) lines.push({ d, alpha });
      continue;
    }
    if (facing < least) continue;
    lines.push(d);
  }
  const ends = seams ? [seams === "last" ? "" : arcOf(F, s0, r, P, { slope }), seams === "first" ? "" : arcOf(F, s1, r1, P, { slope })].filter(Boolean) : [];
  if (fade) return [...lines, ...ends.map((d) => ({ d, alpha: 1 }))];
  return [...lines, ...ends].join("");
}

function rodOut(F, from, to, r, P, { stroke = 0, ...options } = {}) {
  const pad = 0.35 / scaleOf(P);
  const ring = (s) => Array.from({ length: 48 }, (_, index) => iso(pointOf(F, s, r + pad, (index / 48) * TAU), P));
  return {
    paths: disc(from - stroke, to, r, F, P, options),
    clip: pathOf(hullOf([...ring(from), ...ring(to + stroke)]), true),
    from,
    to,
    stroke,
    reach: to + stroke,
  };
}

function dotsOf(F, s, r, count, P, { phase = 0, slope = 0, least = 0.08, all = false, fade = null } = {}) {
  const V = viewOf(P);
  const out = [];
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    let alpha = 1;
    if (!all) {
      const radial = radialOf(F, t);
      const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
      const facing = dot3(normal, V);
      if (fade) alpha = fadeOf(facing, fade);
      else if (facing < least) continue;
      if (alpha <= 0.02) continue;
    }
    const [x, y] = iso(pointOf(F, s, r, t), P);
    out.push(alpha < 1 ? [x, y, alpha] : [x, y]);
  }
  return out;
}

function facingOf(F, angle, P, slope = 0) {
  const radial = radialOf(F, angle);
  return dot3(unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]), viewOf(P));
}

function fillet(points, radius, perArc = 7, { P = null, tube = 0, margin = 1.3 } = {}) {
  if (points.length < 3) return points.map((p) => [...p]);
  const V = P && tube ? viewOf(P) : null;
  const out = [[...points[0]]];
  for (let index = 1; index < points.length - 1; index++) {
    const prev = points[index - 1];
    const here = points[index];
    const next = points[index + 1];
    const into = unit3(sub3(here, prev));
    const outOf = unit3(sub3(next, here));
    const cosTurn = Math.max(-1, Math.min(1, dot3(into, outOf)));
    const turn = Math.acos(cosTurn);
    if (turn < 1e-3) {
      out.push([...here]);
      continue;
    }
    const room = Math.min(len3(sub3(here, prev)), len3(sub3(next, here))) * 0.48;
    const facing = V ? Math.abs(dot3(unit3(cross3(into, outOf)), V)) : 1;
    const bend = V ? Math.max(radius, (margin * tube) / (0.7 * Math.max(0.05, facing) ** 2)) : radius;
    const cut = Math.min(bend * Math.tan(turn / 2), room);
    const a = sub3(here, mul3(into, cut));
    const b = add3(here, mul3(outOf, cut));
    const count = Math.max(2, Math.ceil((perArc * turn) / (Math.PI / 2)));
    for (let step = 0; step <= count; step++) {
      const t = step / count;
      const p0 = lerp3(a, here, t);
      const p1 = lerp3(here, b, t);
      out.push(lerp3(p0, p1, t));
    }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

function resample(points, spacing) {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + len3(sub3(points[index], points[index - 1])));
  const total = lengths[lengths.length - 1];
  const count = Math.max(1, Math.round(total / spacing));
  const out = [];
  let segment = 1;
  for (let step = 0; step <= count; step++) {
    const at = (total * step) / count;
    while (segment < points.length - 1 && lengths[segment] < at) segment++;
    const a = points[segment - 1];
    const b = points[segment];
    const span = lengths[segment] - lengths[segment - 1] || 1;
    out.push(lerp3(a, b, Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span))));
  }
  return out;
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += len3(sub3(points[index], points[index - 1]));
  return total;
}

function cut(points, from, to) {
  const out = [];
  let walked = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const length = len3(sub3(b, a));
    const start = walked;
    const end = walked + length;
    if (end >= from && start <= to) {
      const t0 = Math.max(0, (from - start) / (length || 1));
      const t1 = Math.min(1, (to - start) / (length || 1));
      if (!out.length) out.push(lerp3(a, b, t0));
      out.push(lerp3(a, b, t1));
    }
    walked = end;
  }
  return out;
}

const pointAlong = (points, at) => {
  const piece = cut(points, at, at + 0.01);
  return piece[0] ?? points[points.length - 1];
};

function tangentAlong(points, at) {
  const total = pathLength(points);
  const a = pointAlong(points, Math.max(0, at - 0.6));
  const b = pointAlong(points, Math.min(total, at + 0.6));
  return unit3(sub3(b, a));
}

function spiral(F, s, r0, r1, a0, a1, steps = 28) {
  const out = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    out.push(pointOf(F, s, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t));
  }
  return out;
}

function arcPoints(F, s, r, a0, a1, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => pointOf(F, s, r, a0 + ((a1 - a0) * index) / steps));
}

// Opt-in native primitive. Each patch is a genuine opaque kit solid, not a painted hole.
// Returns ordered native paths, not one merged shade bucket that could repaint a cavity.
function annularSector(contract, P, {steps = 96} = {}) {
  const shape=Annular.annularSector(contract);
  if(!Number.isInteger(steps)||steps<4||steps>512)throw Error('steps must be integer 4..512');
  const mesh=Annular.surfaceMesh(shape,steps),V=viewOf(P);
  const visible=mesh.filter(p=>dot3(p.normal,V)>0);
  const ordered=Annular.painterOrder(visible,V);
  const patches=ordered.map(p=>{
    const d=pathOf(p.points.map(q=>iso(q,P)),true),tone=toneOf(p.normal,P);
    return {face:p.face,points:p.points,normal:p.normal,paths:{fill:d,outline:'',crease:'',top:tone===4?d:'',shades:[0,1,2,3].map(k=>k===tone?d:''),seamless:true}};
  });
  return {shape,mesh,patches,approximation:{angularSteps:steps,sagitta:shape.rOut*(1-Math.cos((shape.theta1-shape.theta0)/(2*steps))),svgCoordinateQuantization:0.05,contactCertificate:false}};
}

return {add3,angleToward,annularSector,arcOf,arcPoints,bandOf,bandOfProfile,bandsOf,circleOf,cross3,curveRuns,cut,disc,dot3,dotsOf,facingOf,fadeOf,fillet,frameAlong,frameOf,hullOf,lathe,len3,lerp3,lightOf,mul3,outlineOf,pathLength,pointAlong,pointOf,prismOf,profileCurve,radialOf,resample,ribsOf,ringBand,rodOut,runsOf,saddleOf,saddleStart,scaleOf,silhouetteOf,silhouettePoints,softOf,solidOf,sphereOf,spiral,spokesOf,stadium,stepsFor,sub3,tangentAlong,tangentOf,toneOf,unit3,viewOf};
})(void 0);
modules["tube"] = (function(window){
const { iso, pathOf } = modules["iso-kit"];
const G = modules["lathe"];
const LIGHT = (() => {
  const length = Math.hypot(-0.55, -0.835);
  return [-0.55 / length, -0.835 / length];
})();

const poly = (points, closed = true) => pathOf(points, closed);

const area = (points) => points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);

function sideOf(frames) {
  const out = { left: [], right: [], shineA: [], shineB: [], shadeA: [], shadeB: [] };
  for (const { p, nx, ny, half } of frames) {
    out.left.push([p[0] + nx * half, p[1] + ny * half]);
    out.right.push([p[0] - nx * half, p[1] - ny * half]);
    const toward = nx * LIGHT[0] + ny * LIGHT[1];
    const shineAt = half * 0.44 * toward;
    const shineHalf = half * 0.24;
    out.shineA.push([p[0] + nx * (shineAt + shineHalf), p[1] + ny * (shineAt + shineHalf)]);
    out.shineB.push([p[0] + nx * (shineAt - shineHalf), p[1] + ny * (shineAt - shineHalf)]);
    const shadeAt = -half * 0.62 * toward;
    const shadeHalf = half * 0.2;
    out.shadeA.push([p[0] + nx * (shadeAt + shadeHalf), p[1] + ny * (shadeAt + shadeHalf)]);
    out.shadeB.push([p[0] + nx * (shadeAt - shadeHalf), p[1] + ny * (shadeAt - shadeHalf)]);
  }
  return out;
}

function capOf(centre, tangent, radius, inward, P) {
  const V = G.viewOf(P);
  let n1 = G.cross3(tangent, V);
  if (G.len3(n1) < 1e-6) n1 = G.frameAlong([0, 0, 0], tangent).u;
  n1 = G.unit3(n1);
  const n2 = G.unit3(G.cross3(tangent, n1));
  const steps = 28;
  const ring = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return iso(G.add3(centre, G.add3(G.mul3(n1, radius * Math.cos(angle)), G.mul3(n2, radius * Math.sin(angle)))), P);
  });
  const c = iso(centre, P);
  const probe = iso(G.add3(centre, n2), P);
  const along = (probe[0] - c[0]) * inward[0] + (probe[1] - c[1]) * inward[1];
  const from = along > 0 ? steps / 2 : 0;
  const half = (start) => Array.from({ length: steps / 2 + 1 }, (_, index) => ring[(start + index) % steps]);
  return { ring, arc: half(from), inner: half((from + steps / 2) % steps) };
}

function stripeEnd(half, centre, nx, ny, from, to) {
  const offset = (p) => (p[0] - centre[0]) * nx + (p[1] - centre[1]) * ny;
  const values = half.map(offset);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const points = [];
  const cross = (k, level) => {
    const t = (level - values[k]) / (values[k + 1] - values[k] || 1e-9);
    return [half[k][0] + (half[k + 1][0] - half[k][0]) * t, half[k][1] + (half[k + 1][1] - half[k][1]) * t];
  };
  for (let k = 0; k < half.length; k++) {
    if (values[k] >= lo && values[k] <= hi) points.push(half[k]);
    if (k < half.length - 1) for (const level of [lo, hi]) if ((values[k] - level) * (values[k + 1] - level) < 0) points.push(cross(k, level));
  }
  const order = points.map((p) => offset(p));
  const sorted = points.map((p, index) => [p, order[index]]).sort((x, y) => (from > to ? y[1] - x[1] : x[1] - y[1]));
  return sorted.map(([p]) => p);
}

function spansOf(total, gaps, breaks, maxLength, closed) {
  const cuts = gaps
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(total, Math.max(a, b))])
    .filter(([a, b]) => b - a > 1e-6)
    .sort((x, y) => x[0] - y[0]);
  const runs = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at + 1e-6) runs.push([at, a, at > 0, true]);
    at = Math.max(at, b);
  }
  if (total > at + 1e-6) runs.push([at, total, at > 0, cuts.length > 0 && cuts[cuts.length - 1][1] >= total - 1e-6]);
  const pieces = [];
  for (const [from, to, gapStart, gapEnd] of runs) {
    const stops = [from, ...breaks.filter((b) => b > from + 1e-6 && b < to - 1e-6).sort((x, y) => x - y), to];
    for (let index = 0; index < stops.length - 1; index++) {
      const a = stops[index];
      const b = stops[index + 1];
      const count = Math.max(1, Math.ceil((b - a) / maxLength - 1e-9));
      for (let c = 0; c < count; c++) {
        pieces.push({
          from: a + ((b - a) * c) / count,
          to: a + ((b - a) * (c + 1)) / count,
          open0: !(index === 0 && c === 0),
          open1: !(index === stops.length - 2 && c === count - 1),
          gap0: index === 0 && c === 0 && gapStart,
          gap1: index === stops.length - 2 && c === count - 1 && gapEnd,
        });
      }
    }
  }
  if (closed && !cuts.length && pieces.length) {
    pieces[0].open0 = true;
    pieces[pieces.length - 1].open1 = true;
  }
  return pieces;
}

function runsOf(total, gaps = []) {
  const cuts = gaps
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(total, Math.max(a, b))])
    .filter(([a, b]) => b - a > 1e-6)
    .sort((x, y) => x[0] - y[0]);
  const runs = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at + 1e-6) runs.push([at, a]);
    at = Math.max(at, b);
  }
  if (total > at + 1e-6) runs.push([at, total]);
  return runs;
}

function crossingsOf(points, centre, axis, radius) {
  const n = G.unit3(axis);
  const out = [];
  let walked = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const length = G.len3(G.sub3(b, a));
    const da = G.dot3(G.sub3(a, centre), n);
    const db = G.dot3(G.sub3(b, centre), n);
    if ((da <= 0 && db > 0) || (da >= 0 && db < 0)) {
      const t = da / (da - db);
      const p = G.lerp3(a, b, t);
      if (G.len3(G.sub3(p, centre)) <= radius) out.push(walked + t * length);
    }
    walked += length;
  }
  return out;
}

function ringsOf(dense, total, radiusAt, P, span, { pitch = 3, twist = 0, cross = false, fade = [0.1, 0.55], phase = 0, steps = 16 } = {}) {
  const V = G.viewOf(P);
  const [lo, hi] = span;
  const margin = twist ? 0 : Math.min(pitch * 0.35, (hi - lo) / 2);
  const from = Math.max(lo, span.real0 ? lo + margin : lo);
  const to = Math.min(hi, span.real1 ? hi - margin : hi);
  if (to <= from) return [];
  const out = [];
  const hands = twist ? (cross ? [1, -1] : [1]) : [0];
  const reach = Math.abs(twist) * Math.max(...[0, 0.5, 1].map(radiusAt));
  const first = Math.ceil((from - reach - phase) / pitch);
  const last = Math.floor((to + reach - phase) / pitch);
  const surface = (t, theta) => {
    const at = Math.max(0, Math.min(total, t));
    const c = G.pointAlong(dense, at);
    const T = G.tangentAlong(dense, at);
    let n1 = G.cross3(T, V);
    if (G.len3(n1) < 1e-6) return null;
    n1 = G.unit3(n1);
    let n2 = G.unit3(G.cross3(T, n1));
    if (G.dot3(n2, V) < 0) n2 = G.mul3(n2, -1);
    const r = radiusAt(at / (total || 1));
    const normal = G.add3(G.mul3(n1, Math.cos(theta)), G.mul3(n2, Math.sin(theta)));
    return { p: iso(G.add3(c, G.mul3(normal, r)), P), facing: G.dot3(normal, V), r };
  };
  for (let index = first; index <= last; index++) {
    const station = phase + index * pitch;
    for (const hand of hands) {
      const samples = [];
      for (let step = 0; step <= steps; step++) {
        const theta = (step / steps) * Math.PI;
        const t = station + hand * twist * radiusAt(Math.max(0, Math.min(1, station / (total || 1)))) * (step / steps - 0.5);
        samples.push({ t, theta });
      }
      for (let step = 0; step < steps; step++) {
        let a = samples[step];
        let b = samples[step + 1];
        if ((a.t < from && b.t < from) || (a.t > to && b.t > to)) continue;
        const clipTo = (x, y, edge) => ({ t: edge, theta: x.theta + ((y.theta - x.theta) * (edge - x.t)) / (y.t - x.t || 1e-9) });
        if (a.t < from) a = clipTo(a, b, from);
        if (b.t < from) b = clipTo(b, a, from);
        if (a.t > to) a = clipTo(a, b, to);
        if (b.t > to) b = clipTo(b, a, to);
        const pa = surface(a.t, a.theta);
        const pb = surface(b.t, b.theta);
        if (!pa || !pb) continue;
        const alpha = fade ? G.fadeOf((pa.facing + pb.facing) / 2, fade) : 1;
        if (alpha <= 0.02) continue;
        out.push({ d: pathOf([pa.p, pb.p]), alpha });
      }
    }
  }
  return out;
}

function tubePieces(points3, radius, P, { maxLength = 30, spacing = 2.2, closed = false, breaks = [], gaps = [], caps = true, stripes = "auto", rings = null } = {}) {
  const dense = G.resample(points3, spacing);
  const total = G.pathLength(dense);
  const radiusAt = typeof radius === "function" ? radius : () => radius;
  const k = G.scaleOf(P);
  const wide = stripes === "auto" ? Math.max(...Array.from({ length: 33 }, (_, index) => radiusAt(index / 32))) * k > 1.3 : Boolean(stripes);
  const lead = 0.5;
  const out = [];
  const looped = closed && !gaps.length;
  const wrap = (at) => (looped ? ((at % total) + total) % total : Math.max(0, Math.min(total, at)));
  const step = Math.max(0.05, Math.min(spacing, total / 4) * 0.5);
  const frameAt = (at, p, width) => {
    const a = iso(G.pointAlong(dense, wrap(at - step)), P);
    const b = iso(G.pointAlong(dense, wrap(at + step)), P);
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const length = Math.hypot(tx, ty) || 1;
    tx /= length;
    ty /= length;
    return { p, nx: -ty, ny: tx, half: width };
  };
  const partOf = (start, end) => {
    let points = G.cut(dense, Math.max(0, start), Math.min(total, end));
    if (looped && start < 0) points = [...G.cut(dense, total + start, total), ...points.slice(1)];
    if (looped && end > total) points = [...points, ...G.cut(dense, 0, end - total).slice(1)];
    let walked = looped ? start : Math.max(0, start);
    const along = points.map((point, index) => {
      if (index > 0) walked += G.len3(G.sub3(point, points[index - 1]));
      return walked;
    });
    const flat = points.map((point) => iso(point, P));
    const widths = along.map((at) => radiusAt(looped ? wrap(at) / total : Math.min(1, Math.max(0, at / total))) * k);
    const frames = flat.map((p, index) => frameAt(along[index], p, widths[index]));
    return { points, flat, widths, frames };
  };
  for (const piece of spansOf(total, gaps, breaks, maxLength, closed)) {
    const openStart = piece.open0 && (piece.from > 0 || looped);
    const openEnd = piece.open1 && (piece.to < total || looped);
    const body = partOf(openStart ? piece.from - lead : piece.from, openEnd ? piece.to + lead : piece.to);
    if (body.points.length < 2) continue;
    const stripe = openStart || openEnd ? partOf(openStart ? piece.from - 2 * lead : piece.from, openEnd ? piece.to + 2 * lead : piece.to) : body;
    const { points: part, flat, widths, frames } = body;
    const sides = sideOf(frames);
    const bands = stripe === body ? sides : sideOf(stripe.frames);
    let bodyPath = poly([...sides.left, ...sides.right.slice().reverse()]);
    let edges = pathOf(sides.left) + pathOf(sides.right);
    const ends = [!piece.open0 && !looped && (piece.from <= 1e-6 || piece.gap0), !piece.open1 && !looped && (piece.to >= total - 1e-6 || piece.gap1)];
    const capped = [ends[0] && (piece.gap0 || [caps].flat()[0]), ends[1] && (piece.gap1 || [caps].flat().at(-1))];
    const sign = Math.sign(area([...sides.left, ...sides.right.slice().reverse()]));
    const tips = [null, null];
    [0, 1].forEach((side) => {
      if (!capped[side]) return;
      const at = side ? part.length - 1 : 0;
      const other = side ? part.length - 2 : 1;
      const tangent = G.unit3(G.sub3(part[side ? at : other], part[side ? other : at]));
      const outward = side ? tangent : G.mul3(tangent, -1);
      const inward = [flat[other][0] - flat[at][0], flat[other][1] - flat[at][1]];
      const { ring, arc, inner } = capOf(part[at], tangent, widths[at] / k, inward, P);
      const oriented = Math.sign(area(ring)) === sign ? ring : ring.slice().reverse();
      bodyPath += poly(oriented);
      edges += pathOf(arc);
      const open = G.dot3(outward, G.viewOf(P)) > 0;
      if (open) edges += pathOf(inner);
      tips[side] = { half: open ? inner : arc, frame: frames[at] };
    });
    const band = (a, b, offsets) => {
      const head = tips[1] ? stripeEnd(tips[1].half, tips[1].frame.p, tips[1].frame.nx, tips[1].frame.ny, offsets(tips[1].frame)[0], offsets(tips[1].frame)[1]) : [];
      const tail = tips[0] ? stripeEnd(tips[0].half, tips[0].frame.p, tips[0].frame.nx, tips[0].frame.ny, offsets(tips[0].frame)[1], offsets(tips[0].frame)[0]) : [];
      return poly([...a, ...head, ...b.slice().reverse(), ...tail]);
    };
    const toward = ({ nx, ny }) => nx * LIGHT[0] + ny * LIGHT[1];
    const shineOffsets = (frame) => [frame.half * 0.44 * toward(frame) + frame.half * 0.24, frame.half * 0.44 * toward(frame) - frame.half * 0.24];
    const shadeOffsets = (frame) => [-frame.half * 0.62 * toward(frame) + frame.half * 0.2, -frame.half * 0.62 * toward(frame) - frame.half * 0.2];
    const ringSpan = Object.assign([openStart ? piece.from - 2 * lead : piece.from, openEnd ? piece.to + 2 * lead : piece.to], { real0: !openStart, real1: !openEnd });
    out.push({
      rings: rings ? ringsOf(dense, total, radiusAt, P, ringSpan, rings) : [],
      ringTone: rings?.tone ?? "lo",
      mid: G.pointAlong(dense, (piece.from + piece.to) / 2),
      body: bodyPath,
      shine: band(bands.shineA, bands.shineB, shineOffsets),
      shade: band(bands.shadeA, bands.shadeB, shadeOffsets),
      edges,
      wide,
      points: part,
      radii: widths.map((width) => width / k),
      ends,
      from: piece.from,
      to: piece.to,
    });
  }
  return out;
}

function ringsSvg(rings, tone = "lo") {
  const groups = new Map();
  for (const { d, alpha } of rings ?? []) {
    const level = Math.min(1, Math.round(alpha * 20) / 20);
    if (level <= 0) continue;
    groups.set(level, (groups.get(level) ?? "") + d);
  }
  return [...groups].map(([alpha, d]) => `<path class="tb-ring" data-tone="${tone}" d="${d}"${alpha < 1 ? ` opacity="${alpha.toFixed(2)}"` : ""}/>`).join("");
}

function tubeSvg(piece, { tone = "hi" } = {}) {
  const shine = piece.wide ? `<path class="tb-shine" d="${piece.shine}"/><path class="tb-shade" d="${piece.shade}"/>` : "";
  return `<g class="tb"><path class="tb-body" d="${piece.body}"/>${shine}${ringsSvg(piece.rings, piece.ringTone)}<path class="iso-line tb-edge" data-tone="${tone}" d="${piece.edges}"/></g>`;
}

return {crossingsOf,ringsSvg,runsOf,tubePieces,tubeSvg};
})(void 0);
modules["audit"] = (function(window){
const Annular = modules["annular-sector"];
const annularSector = (contract, meta = {}) => {
  const shape = Annular.annularSector(contract);
  for (const key of Object.keys(meta)) if (key in shape || key === "cut") throw Error("geometry override forbidden");
  return { ...shape, ...meta };
};
const { cameraOf, roundedPlan } = modules["iso-kit"];
const { add3, sub3, mul3, dot3, len3, unit3, pathLength, resample, curveRuns, cut:cutAlong, tangentAlong } = modules["lathe"];
const { runsOf } = modules["tube"];
const BIG = 1e9;

function body(F, poly, meta = {}) {
  return { kind: "body", F, poly: poly.map(([s, r]) => [s, Math.max(0, r)]), ...meta };
}

function traced(meridian, { radius = null, error = 0.02, depth = 6 } = {}) {
  const segments = radius ? null : curveRuns(meridian);
  const out = [[meridian[0][0], meridian[0][1]]];
  for (let index = 0; index < meridian.length - 1; index++) {
    const [s0] = meridian[index];
    const [s1, r1] = meridian[index + 1];
    const along = Math.abs(s1 - s0) > 1e-9;
    const at = along && radius ? radius : along && segments[index] ? segments[index].radius : null;
    if (at) {
      const split = (a, b, level) => {
        const mid = (a + b) / 2;
        if (level >= depth) return;
        const ra = at(a);
        const rb = at(b);
        const deviation = Math.max(...[0.25, 0.5, 0.75].map((t) => Math.abs(at(a + (b - a) * t) - (ra + (rb - ra) * t))));
        if (deviation <= error) return;
        split(a, mid, level + 1);
        out.push([mid, at(mid)]);
        split(mid, b, level + 1);
      };
      split(s0, s1, 0);
    }
    out.push([s1, r1]);
  }
  return out;
}

function lathe(F, meridian, { radius = null, ...meta } = {}) {
  return body(F, traced(meridian, { radius }), meta);
}

function solid(F, profile, { radius = null, ...meta } = {}) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  return body(F, traced([[first[0], 0], ...profile, [last[0], 0]], { radius: radius && ((s) => radius(Math.max(first[0], Math.min(last[0], s)))) }), meta);
}

function prism(F, polygon, s0, s1, meta = {}) {
  return { kind: "prism", F, poly: polygon.map(([x, y]) => [x, y]), s0: Math.min(s0, s1), s1: Math.max(s0, s1), ...meta };
}

const FLOOR = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };

const extruded = (ring, z, height, meta = {}) => prism(FLOOR, ring, z, z + height, meta);

const slab = (plan, z, height, meta = {}, steps = 8) => extruded(roundedPlan(plan, steps), z, height, meta);

const cylinder = (cx, cy, r, z, height, meta = {}) => disc({ o: [cx, cy, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, z, z + height, r, meta);

const disc = (F, s0, s1, r, meta = {}) => body(F, [[s0, 0], [s0, r], [s1, r], [s1, 0]], meta);

const ring = (F, s0, s1, rIn, rOut, meta = {}) => body(F, [[s0, rIn], [s0, rOut], [s1, rOut], [s1, rIn]], meta);

function box(min, max, meta = {}) {
  const centre = mul3(add3(min, max), 0.5);
  return { kind: "box", o: centre, axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], half: mul3(sub3(max, min), 0.5), ...meta };
}

const orientedBox = (centre, axes, half, meta = {}) => ({ kind: "box", o: centre, axes: axes.map(unit3), half, ...meta });

const ball = (at, r, meta = {}) => ({ kind: "ball", o: at, r, ...meta });

function tube(points, radius, meta = {}) {
  const total = pathLength(points) || 1;
  let walked = 0;
  const radii = Array.isArray(radius)
    ? radius
    : points.map((point, index) => {
        if (index > 0) walked += len3(sub3(point, points[index - 1]));
        return typeof radius === "function" ? radius(walked / total) : radius;
      });
  return { kind: "tube", points, radii, round: meta.round ?? [false, false], ...meta };
}

const slide = (F, from, to, r, meta = {}) => ({ ...disc(F, from, to, r, meta), slide: { from, to, r } });

function moved(shape, offset) {
  if (!offset || (!offset[0] && !offset[1] && !offset[2])) return shape;
  if (shape.slide) {
    const { from, to, r } = shape.slide;
    const reach = Math.max(from + 1e-3, to + dot3(offset, shape.F.a));
    return { ...shape, poly: [[from, 0], [from, r], [reach, r], [reach, 0]], slide: { from, to: reach, r }, _b: undefined, _f: undefined };
  }
  const cut = shape.cut ? (Array.isArray(shape.cut) ? shape.cut.map((one) => moved(one, offset)) : moved(shape.cut, offset)) : undefined;
  if (shape.kind === "body" || shape.kind === "prism" || shape.kind === "annular-sector") return { ...shape, cut, F: { ...shape.F, o: add3(shape.F.o, offset) }, _b: undefined, _f: undefined };
  if (shape.kind === "tube") return { ...shape, cut, points: shape.points.map((p) => add3(p, offset)), tips: shape.tips && shape.tips.map((tip) => tip && add3(tip, offset)), _b: undefined };
  return { ...shape, cut, o: add3(shape.o, offset), _b: undefined };
}

function polyDistance(poly, s, r) {
  let best = BIG;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [s0, r0] = poly[j];
    const [s1, r1] = poly[i];
    const ds = s1 - s0;
    const dr = r1 - r0;
    const span = ds * ds + dr * dr;
    const t = span > 0 ? Math.max(0, Math.min(1, ((s - s0) * ds + (r - r0) * dr) / span)) : 0;
    const es = s - s0 - ds * t;
    const er = r - r0 - dr * t;
    const d = es * es + er * er;
    if (d < best && (r0 > 1e-9 || r1 > 1e-9)) best = d;
    if (r0 > r !== r1 > r && s < s0 + ((r - r0) * ds) / (dr || 1e-12)) inside = !inside;
  }
  const d = Math.sqrt(best);
  return inside ? -d : d;
}

function polygonDistance(poly, x, y) {
  let best = BIG;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[j];
    const [x1, y1] = poly[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const span = dx * dx + dy * dy;
    const t = span > 0 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / span)) : 0;
    const ex = x - x0 - dx * t;
    const ey = y - y0 - dy * t;
    const d = ex * ex + ey * ey;
    if (d < best) best = d;
    if (y0 > y !== y1 > y && x < x0 + ((y - y0) * dx) / (dy || 1e-12)) inside = !inside;
  }
  const d = Math.sqrt(best);
  return inside ? -d : d;
}

function cappedSegment(p, a, b, r, endRadius = r) {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const px = p[0] - a[0];
  const py = p[1] - a[1];
  const pz = p[2] - a[2];
  const baba = bx * bx + by * by + bz * bz || 1e-12;
  const paba = px * bx + py * by + pz * bz;
  if (endRadius !== r) {
    const length = Math.sqrt(baba);
    const along = paba / length;
    const radial = Math.hypot(px - bx * paba / baba, py - by * paba / baba, pz - bz * paba / baba);
    return polyDistance([[0, 0], [0, r], [length, endRadius], [length, 0]], along, radial);
  }
  const x = Math.hypot(px * baba - bx * paba, py * baba - by * paba, pz * baba - bz * paba) - r * baba;
  const y = Math.abs(paba - baba * 0.5) - baba * 0.5;
  const x2 = x * x;
  const y2 = y * y * baba;
  const d = Math.max(x, y) < 0 ? -Math.min(x2, y2) : (x > 0 ? x2 : 0) + (y > 0 ? y2 : 0);
  return (Math.sign(d) * Math.sqrt(Math.abs(d))) / baba;
}

function segmentPoint(p, a, b) {
  const ba = sub3(b, a);
  const pa = sub3(p, a);
  const t = Math.max(0, Math.min(1, dot3(pa, ba) / (dot3(ba, ba) || 1e-12)));
  return { d: len3(sub3(pa, mul3(ba, t))), t };
}

function sdf(shape, p) {
  const d = baseSdf(shape, p);
  return shape.cut ? Math.max(d, -cutDistance(shape, p)) : d;
}

function cutDistance(shape, p) {
  if (!Array.isArray(shape.cut)) return sdf(shape.cut, p);
  let best = BIG;
  for (const cut of shape.cut) best = Math.min(best, sdf(cut, p));
  return best;
}

function baseSdf(shape, p) {
  if (shape.kind === "annular-sector") return Annular.signedDistance(shape, p);
  if (shape.kind === "body") {
    const { F } = shape;
    const q = sub3(p, F.o);
    const s = dot3(q, F.a);
    const x = dot3(q, F.u);
    const y = dot3(q, F.v);
    return polyDistance(shape.poly, s, Math.hypot(x, y));
  }
  if (shape.kind === "ball") {
    let d = len3(sub3(p, shape.o)) - shape.r;
    if (shape.flats) for (const [nx, ny, nz, cut] of shape.flats) d = Math.max(d, nx * (p[0] - shape.o[0]) + ny * (p[1] - shape.o[1]) + nz * (p[2] - shape.o[2]) - cut);
    return d;
  }
  if (shape.kind === "prism") {
    const { F } = shape;
    const q = sub3(p, F.o);
    const s = dot3(q, F.a);
    const flat = polygonDistance(shape.poly, dot3(q, F.u), dot3(q, F.v));
    const along = Math.max(shape.s0 - s, s - shape.s1);
    return Math.hypot(Math.max(flat, 0), Math.max(along, 0)) + Math.min(Math.max(flat, along), 0);
  }
  if (shape.kind === "box") {
    const q = sub3(p, shape.o);
    const d = shape.axes.map((axis, index) => Math.abs(dot3(q, axis)) - shape.half[index]);
    const outside = Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0), Math.max(d[2], 0));
    return outside + Math.min(Math.max(d[0], d[1], d[2]), 0);
  }
  const { points, radii, round } = shape;
  let best = BIG;
  const last = points.length - 1;
  for (let index = 0; index < last; index++) {
    const d = cappedSegment(p, points[index], points[index + 1], radii[index], radii[index + 1]);
    if (d < best) best = d;
  }
  if (round[0]) best = Math.min(best, len3(sub3(p, points[0])) - radii[0]);
  if (round[1]) best = Math.min(best, len3(sub3(p, points[last])) - radii[last]);
  return best;
}

function boundsOf(shape) {
  if (shape.kind === "annular-sector") return Annular.bounds(shape);
  if (shape._b) return shape._b;
  let min;
  let max;
  if (shape.kind === "body") {
    const { F, poly } = shape;
    const s0 = Math.min(...poly.map(([s]) => s));
    const s1 = Math.max(...poly.map(([s]) => s));
    const rm = Math.max(...poly.map(([, r]) => r));
    const a = add3(F.o, mul3(F.a, s0));
    const b = add3(F.o, mul3(F.a, s1));
    const spread = [0, 1, 2].map((i) => rm * Math.sqrt(Math.max(0, 1 - F.a[i] * F.a[i])));
    min = [0, 1, 2].map((i) => Math.min(a[i], b[i]) - spread[i]);
    max = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + spread[i]);
  } else if (shape.kind === "ball") {
    min = shape.o.map((v) => v - shape.r);
    max = shape.o.map((v) => v + shape.r);
  } else if (shape.kind === "prism") {
    const { F } = shape;
    min = [BIG, BIG, BIG];
    max = [-BIG, -BIG, -BIG];
    for (const s of [shape.s0, shape.s1])
      for (const [x, y] of shape.poly) {
        const p = add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)));
        for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]));
      }
  } else if (shape.kind === "box") {
    const extent = [0, 1, 2].map((i) => shape.axes.reduce((sum, axis, j) => sum + Math.abs(axis[i]) * shape.half[j], 0));
    min = shape.o.map((v, i) => v - extent[i]);
    max = shape.o.map((v, i) => v + extent[i]);
  } else {
    min = [BIG, BIG, BIG];
    max = [-BIG, -BIG, -BIG];
    shape.points.forEach((p, index) => {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i] - shape.radii[index]);
        max[i] = Math.max(max[i], p[i] + shape.radii[index]);
      }
    });
  }
  shape._b = { min, max };
  return shape._b;
}

function cameraBasis(P) {
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  return { R: [sinA, -cosA, 0], D: [cosA * sinE, sinA * sinE, -cosE], V: [cosA * cosE, sinA * cosE, sinE], k, origin: P.origin };
}

function screenBox(shape, cam, offset) {
  const { min, max } = boundsOf(shape);
  let x0 = BIG;
  let y0 = BIG;
  let x1 = -BIG;
  let y1 = -BIG;
  const visit = (p) => {
    const x = cam.origin[0] + dot3(p, cam.R) * cam.k;
    const y = cam.origin[1] + dot3(p, cam.D) * cam.k;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  if (shape.kind === "tube") {
    shape.points.forEach((p, index) => {
      const r = shape.radii[index];
      const q = add3(p, offset);
      visit(add3(q, mul3(cam.R, r)));
      visit(add3(q, mul3(cam.R, -r)));
      visit(add3(q, mul3(cam.D, r)));
      visit(add3(q, mul3(cam.D, -r)));
    });
  } else {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) visit(add3([x, y, z], offset));
  }
  return [x0, y0, x1, y1];
}

function spanOf(c, V, min, max) {
  let t0 = -BIG;
  let t1 = BIG;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(V[i]) < 1e-12) {
      if (c[i] < min[i] || c[i] > max[i]) return null;
      continue;
    }
    let a = (min[i] - c[i]) / V[i];
    let b = (max[i] - c[i]) / V[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  return t0 <= t1 ? [t0, t1] : null;
}

function tubeDistance(shape, p, segments) {
  const { points, radii, round } = shape;
  const last = points.length - 1;
  let best = BIG;
  for (const index of segments) {
    const d = cappedSegment(p, points[index], points[index + 1], radii[index], radii[index + 1]);
    if (d < best) best = d;
    for (const [joint, flag] of [[0, round[0]], [last, round[1]]]) {
      if (!flag || (joint !== index && joint !== index + 1)) continue;
      const q = points[joint];
      const e = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - radii[joint];
      if (e < best) best = e;
    }
  }
  return best;
}

function bodyDepth(shape, c, V, eps) {
  const { F, poly } = shape;
  if (!shape._f || shape._f.view.some((value, index) => value !== V[index])) {
    const s = poly.map(([value]) => value);
    shape._f = { view: [...V], aV: dot3(F.a, V), uV: dot3(F.u, V), vV: dot3(F.v, V), s0: Math.min(...s), s1: Math.max(...s), rm: Math.max(...poly.map(([, r]) => r)) };
  }
  const { aV, uV, vV, s0, s1, rm } = shape._f;
  const q = [c[0] - F.o[0], c[1] - F.o[1], c[2] - F.o[2]];
  const sc = dot3(q, F.a);
  const xc = dot3(q, F.u);
  const yc = dot3(q, F.v);
  let lo = -BIG;
  let hi = BIG;
  if (Math.abs(aV) > 1e-9) {
    const a = (s0 - sc) / aV;
    const b = (s1 - sc) / aV;
    lo = Math.min(a, b);
    hi = Math.max(a, b);
  } else if (sc < s0 || sc > s1) return null;
  const qa = uV * uV + vV * vV;
  if (qa > 1e-12) {
    const qb = 2 * (xc * uV + yc * vV);
    const qc = xc * xc + yc * yc - rm * rm;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    lo = Math.max(lo, (-qb - root) / (2 * qa));
    hi = Math.min(hi, (-qb + root) / (2 * qa));
  } else if (xc * xc + yc * yc > rm * rm) return null;
  if (lo > hi) return null;
  let t = hi + eps;
  for (let step = 0; step < 160 && t >= lo - eps; step++) {
    let d = polyDistance(poly, sc + t * aV, Math.hypot(xc + t * uV, yc + t * vV));
    if (shape.cut) d = Math.max(d, -cutDistance(shape, [c[0] + V[0] * t, c[1] + V[1] * t, c[2] + V[2] * t]));
    if (d < eps) return t;
    t -= Math.max(d, eps * 0.5);
  }
  return null;
}

function rayDepth(shape, c, V, eps, segments) {
  if (shape.kind === "body") return bodyDepth(shape, c, V, eps);
  const span = spanOf(c, V, boundsOf(shape).min, boundsOf(shape).max);
  if (!span) return null;
  let t = span[1] + eps;
  for (let step = 0; step < 160 && t >= span[0] - eps; step++) {
    const p = [c[0] + V[0] * t, c[1] + V[1] * t, c[2] + V[2] * t];
    const d = segments ? tubeDistance(shape, p, segments) : sdf(shape, p);
    if (d < eps) return t;
    t -= Math.max(d, eps * 0.5);
  }
  return null;
}

function flatDistance(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const span = dx * dx + dy * dy;
  const t = span > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / span)) : 0;
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}

const shareOf = (item, state) => (typeof state === "number" ? state : state.shares[item.ride ?? item.piece] ?? 0);

const offsetOf = (item, state) => mul3(item.move ?? [0, 0, 0], shareOf(item, state));

const labelOf = (state) => (typeof state === "number" ? `share ${Math.round(state * 1000) / 1000}` : state.label);

function springStates(order, { stagger = 0.035, stiffness = 64, damping = 14.2, substeps = 4, fps = 60, settle = 1e-3, stride = 1, reversals = [] } = {}) {
  const out = [];
  const scripts = [[true], [false], ...reversals.flatMap((at) => [[true, at], [false, at]])];
  for (const [on, back] of scripts) {
    const springs = Object.fromEntries(order.map((id) => [id, { x: on ? 0 : 1, v: 0, target: on ? 0 : 1, pending: null }]));
    const toggle = (value, clock) => {
      const goal = value ? 1 : 0;
      let index = 0;
      for (const id of value ? order : [...order].reverse()) {
        if (springs[id].target === goal) springs[id].pending = null;
        else springs[id].pending = { value: goal, at: clock + index++ * stagger };
      }
    };
    const name = back === undefined ? (on ? "apart" : "together") : `${on ? "apart" : "together"}, back at ${back.toFixed(2)} s,`;
    const dt = 1 / fps;
    let clock = 0;
    let goal = on ? 1 : 0;
    toggle(on, 0);
    for (let frame = 0; frame < 100000; frame++) {
      if (back !== undefined && clock < back && clock + dt >= back) toggle(!on, back), (goal = on ? 0 : 1);
      clock += dt;
      for (const spring of Object.values(springs)) {
        if (spring.pending && clock >= spring.pending.at) (spring.target = spring.pending.value), (spring.pending = null);
        for (let index = 0; index < substeps; index++) {
          const h = dt / substeps;
          spring.v += ((spring.target - spring.x) * stiffness - spring.v * damping) * h;
          spring.x += spring.v * h;
        }
      }
      const settled = (back === undefined || clock >= back) && Object.values(springs).every((spring) => !spring.pending && Math.abs(spring.x - goal) < settle && Math.abs(spring.v) < settle);
      if (settled) break;
      if ((frame + 1) % stride === 0) out.push({ label: `${name} ${clock.toFixed(3)} s`, shares: Object.fromEntries(Object.entries(springs).map(([id, spring]) => [id, spring.x])) });
    }
  }
  return out;
}

const uniformStates = (count = 10) => Array.from({ length: count + 1 }, (_, index) => index / count);

const reversalsOf = (order, stagger = 0.035, margin = 0.008) => order.flatMap((_, index) => [index * stagger - margin, index * stagger + margin]).filter((at) => at > 0);

function prefixStates(order, { shares = [0.25, 0.5, 0.75, 1] } = {}) {
  const out = [];
  for (let count = 1; count < order.length; count++)
    for (const s of shares)
      out.push({ label: `first ${count - 1} out, ${order[count - 1]} at ${s}`, shares: Object.fromEntries(order.map((id, index) => [id, index < count - 1 ? 1 : index === count - 1 ? s : 0])) });
  return out;
}

function rasterOf(item, cam, step, offset) {
  const shapes = item.shapes.map((shape) => moved(shape, offset));
  const flat = (p) => [cam.origin[0] + dot3(p, cam.R) * cam.k, cam.origin[1] + dot3(p, cam.D) * cam.k];
  const boxes = shapes.map((shape) => screenBox(shape, cam, [0, 0, 0]));
  const guides = shapes.map((shape) => {
    if (shape.kind === "tube") {
      const points = shape.points.map(flat);
      const widths = shape.radii.map((r) => r * cam.k);
      const boxes = new Float64Array((points.length - 1) * 4);
      for (let i = 0; i < points.length - 1; i++) {
        const pad = Math.max(widths[i], widths[i + 1]) + step * 0.5;
        boxes[i * 4] = Math.min(points[i][0], points[i + 1][0]) - pad;
        boxes[i * 4 + 1] = Math.max(points[i][0], points[i + 1][0]) + pad;
        boxes[i * 4 + 2] = Math.min(points[i][1], points[i + 1][1]) - pad;
        boxes[i * 4 + 3] = Math.max(points[i][1], points[i + 1][1]) + pad;
      }
      return { points, widths, boxes };
    }
    if (shape.kind === "body") {
      const s = shape.poly.map(([value]) => value);
      return { axis: [flat(add3(shape.F.o, mul3(shape.F.a, Math.min(...s)))), flat(add3(shape.F.o, mul3(shape.F.a, Math.max(...s))))], reach: Math.max(...shape.poly.map(([, r]) => r)) * cam.k };
    }
    return null;
  });
  const x0 = Math.floor(Math.min(...boxes.map((b) => b[0])) / step);
  const y0 = Math.floor(Math.min(...boxes.map((b) => b[1])) / step);
  const x1 = Math.ceil(Math.max(...boxes.map((b) => b[2])) / step);
  const y1 = Math.ceil(Math.max(...boxes.map((b) => b[3])) / step);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return { x0, y0, x1, y1, w, h, boxes, shapes, guides, depth: null };
}

function depthAt(raster, cam, step, cx, cy) {
  if (!raster.depth) {
    raster.depth = new Float32Array(raster.w * raster.h);
    raster.done = new Uint8Array(raster.w * raster.h);
  }
  const cell = (cy - raster.y0) * raster.w + (cx - raster.x0);
  if (raster.done[cell]) return raster.depth[cell];
  const x = cx * step;
  const y = cy * step;
  const c = add3(mul3(cam.R, (x - cam.origin[0]) / cam.k), mul3(cam.D, (y - cam.origin[1]) / cam.k));
  let best = NaN;
  for (let index = 0; index < raster.shapes.length; index++) {
    const shape = raster.shapes[index];
    const b = raster.boxes[index];
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    const guide = raster.guides[index];
    let segments = null;
    if (shape.kind === "tube") {
      segments = [];
      const boxes = guide.boxes;
      for (let i = 0; i < guide.points.length - 1; i++) {
        if (x < boxes[i * 4] || x > boxes[i * 4 + 1] || y < boxes[i * 4 + 2] || y > boxes[i * 4 + 3]) continue;
        if (flatDistance(x, y, guide.points[i], guide.points[i + 1]) <= Math.max(guide.widths[i], guide.widths[i + 1]) + step * 0.5) segments.push(i);
      }
      if (!segments.length) continue;
    } else if (shape.kind === "body" && flatDistance(x, y, guide.axis[0], guide.axis[1]) > guide.reach + step) continue;
    const t = rayDepth(shape, c, cam.V, 0.02, segments);
    if (t !== null && !(t <= best)) best = t;
  }
  raster.depth[cell] = best;
  raster.done[cell] = 1;
  return best;
}

function regionOf(flags, gw, gh, value, step) {
  const n = gw * gh;
  const on = new Uint8Array(n);
  let all = 0;
  let inner = 0;
  for (let cell = 0; cell < n; cell++) if (flags[cell] === value) (on[cell] = 1), all++;
  if (!all) return { all, inner, area: 0 };
  const grow = new Uint8Array(n);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const cell = y * gw + x;
      if (on[cell] && x > 0 && x < gw - 1 && y > 0 && y < gh - 1 && on[cell - 1] && on[cell + 1] && on[cell - gw] && on[cell + gw]) inner++;
      if (on[cell] || (x > 0 && on[cell - 1]) || (x < gw - 1 && on[cell + 1]) || (y > 0 && on[cell - gw]) || (y < gh - 1 && on[cell + gw])) grow[cell] = 1;
    }
  const shut = new Uint8Array(n);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const cell = y * gw + x;
      shut[cell] = on[cell] || (grow[cell] && (x === 0 || grow[cell - 1]) && (x === gw - 1 || grow[cell + 1]) && (y === 0 || grow[cell - gw]) && (y === gh - 1 || grow[cell + gw])) ? 1 : 0;
    }
  const core = new Uint8Array(n);
  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) {
      const cell = y * gw + x;
      core[cell] = shut[cell] && shut[cell - 1] && shut[cell + 1] && shut[cell - gw] && shut[cell + gw] ? 1 : 0;
    }
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let largest = 0;
  for (let start = 0; start < n; start++) {
    if (!core[start] || seen[start]) continue;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const cell = stack[--top];
      size++;
      const x = cell % gw;
      const y = (cell - x) / gw;
      const visit = (next) => {
        if (core[next] && !seen[next]) (seen[next] = 1), (stack[top++] = next);
      };
      if (x > 0) visit(cell - 1);
      if (x < gw - 1) visit(cell + 1);
      if (y > 0) visit(cell - gw);
      if (y < gh - 1) visit(cell + gw);
    }
    if (size > largest) largest = size;
  }
  return { all, inner, area: largest * step * step };
}

function measure(ra, rb, dx, dy, dz, cam, step, tolerance, least) {
  if (ra.x1 < rb.x0 + dx || rb.x1 + dx < ra.x0 || ra.y1 < rb.y0 + dy || rb.y1 + dy < ra.y0) return null;
  const ix0 = Math.max(ra.x0, rb.x0 + dx);
  const ix1 = Math.min(ra.x1, rb.x1 + dx);
  const iy0 = Math.max(ra.y0, rb.y0 + dy);
  const iy1 = Math.min(ra.y1, rb.y1 + dy);
  const gw = ix1 - ix0 + 1;
  const gh = iy1 - iy0 + 1;
  const flags = new Int8Array(gw * gh);
  const worst = [0, 0];
  const at = [null, null];
  let any = false;
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      const ta = depthAt(ra, cam, step, x, y);
      if (Number.isNaN(ta)) continue;
      const tb = depthAt(rb, cam, step, x - dx, y - dy) + dz;
      if (Number.isNaN(tb)) continue;
      const cell = (y - iy0) * gw + (x - ix0);
      if (ta > tb + tolerance) {
        flags[cell] = 1;
        any = true;
        if (ta - tb > worst[0]) (worst[0] = ta - tb), (at[0] = [x * step, y * step]);
      } else if (tb > ta + tolerance) {
        flags[cell] = -1;
        any = true;
        if (tb - ta > worst[1]) (worst[1] = tb - ta), (at[1] = [x * step, y * step]);
      }
    }
  }
  if (!any) return null;
  const front = [regionOf(flags, gw, gh, 1, step), regionOf(flags, gw, gh, -1, step)];
  if (front[0].area < least && front[1].area < least) return null;
  return front.map((region, side) => ({ ...region, depth: worst[side], at: at[side] }));
}

function overlapsOf(items, P, { step = 0.25, tolerance = 0.3, least = 0.25, states = [0], skip = () => false } = {}) {
  const cam = cameraBasis(P);
  const live = items.map((item, index) => ({ item, index })).filter(({ item }) => item.shapes && item.shapes.length);
  const homes = live.map(() => null);
  let uid = 0;
  const stamp = (raster) => Object.assign(raster, { uid: uid++ });
  const home = (index) => homes[index] ?? (homes[index] = stamp(rasterOf(live[index].item, cam, step, [0, 0, 0])));
  const sliding = live.map(({ item }) => item.shapes.some((shape) => shape.slide));
  const slid = new Map();
  const rasterAt = (index, offset) => {
    if (!sliding[index]) return home(index);
    const id = `${index}|${offset.map((v) => v.toFixed(2)).join(",")}`;
    if (!slid.has(id)) slid.set(id, stamp(rasterOf(live[index].item, cam, step, offset)));
    return slid.get(id);
  };
  const shiftOf = (offset) => ({ gx: Math.round((dot3(offset, cam.R) * cam.k) / step), gy: Math.round((dot3(offset, cam.D) * cam.k) / step), dz: dot3(offset, cam.V) });
  const memo = new Map();
  const pairs = [];
  for (const state of states) {
    const offsets = live.map(({ item }) => offsetOf(item, state));
    const shifts = live.map((_, index) => (sliding[index] ? { gx: 0, gy: 0, dz: 0 } : shiftOf(offsets[index])));
    for (let a = 0; a < live.length; a++) {
      const ra = rasterAt(a, offsets[a]);
      const sa = shifts[a];
      for (let b = a + 1; b < live.length; b++) {
        const rb = rasterAt(b, offsets[b]);
        const sb = shifts[b];
        if (ra.x1 + sa.gx < rb.x0 + sb.gx || rb.x1 + sb.gx < ra.x0 + sa.gx || ra.y1 + sa.gy < rb.y0 + sb.gy || rb.y1 + sb.gy < ra.y0 + sa.gy) continue;
        if (skip(live[a].item, live[b].item)) continue;
        const dx = sb.gx - sa.gx;
        const dy = sb.gy - sa.gy;
        const dz = sb.dz - sa.dz;
        const id = `${ra.uid}|${rb.uid}|${dx},${dy},${dz.toFixed(3)}`;
        let hit = memo.get(id);
        if (hit === undefined) {
          hit = measure(ra, rb, dx, dy, dz, cam, step, tolerance, least);
          memo.set(id, hit);
        }
        if (!hit) continue;
        pairs.push({ state, a: live[a].index, b: live[b].index, front: hit.map((side) => ({ ...side, at: side.at && [side.at[0] + sa.gx * step, side.at[1] + sa.gy * step] })) });
      }
    }
  }
  return { pairs, least, states, step, V: cam.V };
}

const liftOf = (item, V) => dot3(item.move ?? [0, 0, 0], V);

const keyAt = (item, state, V) => item.key + liftOf(item, V) * shareOf(item, state);

function orderKeys(items, overlaps, { gap = 0.02, rounds = 0 } = {}) {
  const { pairs, least, V } = overlaps;
  const start = items.map((item) => item.key);
  const strongest = new Map();
  const cycles = [];
  for (const pair of pairs) {
    const aFront = pair.front[0].area >= least;
    const bFront = pair.front[1].area >= least;
    if (aFront && bFront) {
      cycles.push(pair);
      continue;
    }
    const [front, back] = aFront ? [pair.a, pair.b] : [pair.b, pair.a];
    const weight = pair.front[aFront ? 0 : 1].area;
    const need = gap + shareOf(items[back], pair.state) * liftOf(items[back], V) - shareOf(items[front], pair.state) * liftOf(items[front], V);
    const id = `${front}|${back}`;
    const prior = strongest.get(id);
    if (!prior) strongest.set(id, { front, back, weight, pair, need });
    else {
      prior.weight = Math.max(prior.weight, weight);
      if (need > prior.need) (prior.need = need), (prior.pair = pair);
    }
  }
  const rules = [...strongest.values()];
  const limit = rounds || items.length + 1;
  const dropped = [];
  let keys = start.slice();
  let active = rules.slice();
  for (let attempt = 0; attempt < 400; attempt++) {
    keys = start.slice();
    const by = new Array(items.length).fill(null);
    let changed = true;
    let round = 0;
    let last = -1;
    for (; changed && round < limit; round++) {
      changed = false;
      for (const rule of active) {
        if (keys[rule.front] - keys[rule.back] >= rule.need - 1e-9) continue;
        keys[rule.front] = keys[rule.back] + rule.need;
        by[rule.front] = rule;
        last = rule.front;
        changed = true;
      }
    }
    if (!changed) break;
    const seen = new Map();
    let node = last;
    let step = 0;
    while (node !== -1 && by[node] && !seen.has(node) && step < items.length * 2) {
      seen.set(node, step++);
      node = by[node].back;
    }
    const loop = [];
    if (node !== -1 && seen.has(node)) {
      let walk = node;
      do {
        loop.push(by[walk]);
        walk = by[walk].back;
      } while (walk !== node && loop.length <= items.length);
    }
    const candidates = loop.length ? loop : active.filter((rule) => keys[rule.front] - keys[rule.back] < rule.need - 1e-9);
    if (!candidates.length) break;
    const victim = candidates.reduce((low, rule) => (rule.weight < low.weight ? rule : low));
    dropped.push(victim);
    active = active.filter((rule) => rule !== victim);
  }
  return { keys, rules: rules.length, cycles, dropped };
}

function depthOrder(items, P, options = {}) {
  const overlaps = options.overlaps ?? overlapsOf(items, P, options);
  const { pairs, least, states, V } = overlaps;
  const allow = options.allow ?? [];
  const dropped = new Set((options.solved?.dropped ?? []).map((rule) => `${rule.front}|${rule.back}`));
  const missing = items.filter((item) => !item.shapes || !item.shapes.length).map((item) => item.name);
  const ranks = new Map();
  for (const state of states) {
    const order = items.map((item, index) => ({ index, key: keyAt(item, state, V) })).sort((x, y) => x.key - y.key || x.index - y.index);
    const rank = new Int32Array(items.length);
    order.forEach(({ index }, position) => (rank[index] = position));
    ranks.set(state, rank);
  }
  const rest = options.rest ?? states.filter((state) => state === 0 || state === 1);
  const problems = [];
  const passing = [];
  for (const pair of pairs) {
    const rank = ranks.get(pair.state);
    const aFirst = rank[pair.a] < rank[pair.b];
    const wrong = pair.front[aFirst ? 0 : 1];
    const right = pair.front[aFirst ? 1 : 0];
    if (wrong.area < least) continue;
    const front = items[aFirst ? pair.a : pair.b];
    const back = items[aFirst ? pair.b : pair.a];
    const excused = allow.find(([x, y]) => (matches([x], front.name) && matches([y], back.name)) || (matches([y], front.name) && matches([x], back.name)));
    const entry = {
      state: pair.state,
      label: labelOf(pair.state),
      front: front.name,
      back: back.name,
      frontKey: keyAt(front, pair.state, V),
      backKey: keyAt(back, pair.state, V),
      cells: wrong.all,
      area: wrong.area,
      against: right.area,
      cycle: right.area >= least,
      depth: wrong.depth,
      at: wrong.at,
    };
    const front_ = aFirst ? pair.a : pair.b;
    const back_ = aFirst ? pair.b : pair.a;
    entry.unorderable = !rest.includes(pair.state) && dropped.has(`${front_}|${back_}`);
    const replayed = typeof pair.state !== "number";
    (!excused && (rest.includes(pair.state) || replayed || (!entry.cycle && !entry.unorderable)) ? problems : passing).push(entry);
  }
  return { problems, passing, missing };
}

function samplesOf(shape, spacing) {
  const dense = resample(shape.points, spacing);
  const total = pathLength(shape.points) || 1;
  const lengths = [0];
  for (let index = 1; index < shape.points.length; index++) lengths.push(lengths[index - 1] + len3(sub3(shape.points[index], shape.points[index - 1])));
  const radiusAt = (at) => {
    let index = 1;
    while (index < lengths.length - 1 && lengths[index] < at) index++;
    const span = lengths[index] - lengths[index - 1] || 1;
    const t = Math.max(0, Math.min(1, (at - lengths[index - 1]) / span));
    return shape.radii[index - 1] + (shape.radii[index] - shape.radii[index - 1]) * t;
  };
  const step = total / Math.max(1, dense.length - 1);
  return dense.map((p, index) => {
    const t = unit3(sub3(dense[Math.min(dense.length - 1, index + 1)], dense[Math.max(0, index - 1)]));
    return { p, t, along: index * step, edge: Math.min(index * step, total - index * step), r: radiusAt(index * step) };
  });
}

const overlaps = (a, b, pad) => a.min.every((v, i) => v - pad <= b.max[i] && b.min[i] - pad <= a.max[i]);

function centreline(shape, p) {
  let best = { d: BIG, r: 0 };
  for (let index = 0; index < shape.points.length - 1; index++) {
    const { d, t } = segmentPoint(p, shape.points[index], shape.points[index + 1]);
    if (d < best.d) best = { d, r: shape.radii[index] + (shape.radii[index + 1] - shape.radii[index]) * t };
  }
  return best;
}

const matches = (list, name) =>
  (list ?? []).some((entry) => {
    if (typeof entry === "function") return entry(name);
    if (entry.endsWith("*")) return name.startsWith(entry.slice(0, -1));
    return name === entry || name.startsWith(entry + ".") || name.startsWith(entry + ":") || name.startsWith(entry + "#");
  });

const sameOffset = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-6;

const placed = (shape, state) => (state === undefined || !shape.move ? shape : moved(shape, offsetOf(shape, state)));

const offsetAt = (shape, state) => (state === undefined || !shape.move ? [0, 0, 0] : offsetOf(shape, state));

function tipDistance(other, p) {
  if (other.kind === "tube") {
    const { d, r } = centreline(other, p);
    return d - r;
  }
  return sdf(other, p);
}

function rimOf(tube, index) {
  const tip = tube.tips[index];
  const axis = tube.tipAxes ? tube.tipAxes[index] : unit3(index ? sub3(tube.points[tube.points.length - 1], tube.points[tube.points.length - 2]) : sub3(tube.points[1], tube.points[0]));
  const radius = tube.tipRims ? tube.tipRims[index] : tube.radii[index ? tube.radii.length - 1 : 0];
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3([helper[1] * axis[2] - helper[2] * axis[1], helper[2] * axis[0] - helper[0] * axis[2], helper[0] * axis[1] - helper[1] * axis[0]]);
  const v = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  return Array.from({ length: 12 }, (_, k) => add3(tip, add3(mul3(u, radius * Math.cos((k * Math.PI) / 6)), mul3(v, radius * Math.sin((k * Math.PI) / 6)))));
}

function mountsOf(tubes, solids, { tolerance = 0.15 } = {}) {
  const byName = new Map(tubes.map((tube) => [tube.name, tube]));
  const out = new Map();
  for (const tube of tubes) {
    const found = [null, null];
    (tube.tips ?? []).forEach((tip, index) => {
      if (!tip) return;
      const rim = rimOf(tube, index);
      let best = null;
      const consider = (other) => {
        if (other === tube || (other.owner && other.owner === tube.owner) || other.name === tube.owner || other.anchor === false) return;
        const { min, max } = boundsOf(other);
        if (!overlaps({ min: tip, max: tip }, { min, max }, 3 + (tube.tipRims ? tube.tipRims[index] : 0))) return;
        const ds = rim.map((p) => tipDistance(other, p));
        const score = (Math.abs(tipDistance(other, tip)) + ds.reduce((sum, d) => sum + Math.abs(d), 0) / ds.length) / 2;
        if (!best || score < best.score) best = { shape: other, score, d: tipDistance(other, tip), high: Math.max(...ds), low: Math.min(...ds) };
      };
      solids.forEach(consider);
      tubes.forEach(consider);
      if (best && byName.get(best.shape.owner) && best.shape.kind !== "tube") best.host = byName.get(best.shape.owner);
      found[index] = best && { ...best, tip, landed: best.high <= tolerance && best.low >= -tolerance };
    });
    out.set(tube, found);
  }
  return out;
}

function ringAround(sample, r) {
  const axis = sample.t;
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3([helper[1] * axis[2] - helper[2] * axis[1], helper[2] * axis[0] - helper[0] * axis[2], helper[0] * axis[1] - helper[1] * axis[0]]);
  const v = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  return Array.from({ length: 12 }, (_, k) => add3(sample.p, add3(mul3(u, r * Math.cos((k * Math.PI) / 6)), mul3(v, r * Math.sin((k * Math.PI) / 6)))));
}

function clearances(tubes, solids, { ratio = 0.5, least = 0.2, spacing = 0.5, touching = -0.05, through = -0.1, state, only, mounts = mountsOf(tubes, solids) } = {}) {
  const gapOf = (r) => Math.max(least, ratio * r);
  const problems = new Map();
  const note = (tube, other, kind, clearance, need, sample) => {
    if (only && kind !== only) return;
    const id = `${tube.name}|${other.name}`;
    const prior = problems.get(id);
    if (prior && prior.clearance <= clearance) {
      prior.from = Math.min(prior.from, sample.along);
      prior.to = Math.max(prior.to, sample.along);
      return;
    }
    problems.set(id, { tube: tube.name, other: other.name, kind, clearance, need, at: sample.p, from: prior ? Math.min(prior.from, sample.along) : sample.along, to: prior ? Math.max(prior.to, sample.along) : sample.along, length: pathLength(tube.points), state: state === undefined ? "" : labelOf(state) });
  };
  const poseOf = new Map([...tubes, ...solids].map((shape) => [shape, placed(shape, state)]));
  const offsets = new Map([...tubes, ...solids].map((shape) => [shape, offsetAt(shape, state)]));
  const widest = new Map(tubes.map((tube) => [tube, poseOf.get(tube).radii.reduce((r, next) => Math.max(r, next), 0)]));
  const together = (a, b) => len3(sub3(offsets.get(a), offsets.get(b))) < 0.05;
  const runsBy = new Map();
  for (const tube of tubes) runsBy.set(tube.owner, [...(runsBy.get(tube.owner) ?? []), tube]);
  const tipsOf = (owner) => (runsBy.get(owner) ?? []).flatMap((run) => (mounts.get(run) ?? []).filter(Boolean).map((mount) => ({ run, mount })));
  const seatedOn = (shape, owner) => shape && shape.cut && [shape.cut].flat().some((cut) => cut.owner === owner);
  const zone = (r) => r + gapOf(r) + 1;
  const ownerOf = (other) => other.owner ?? other.name;
  const related = (tube, other, sample) => {
    if (seatedOn(other, tube.owner)) return true;
    const tips = tipsOf(tube.owner);
    const near = (entry) => len3(sub3(sample.p, add3(entry.mount.tip, offsets.get(entry.run)))) <= zone(sample.r) + (entry.run.tipRims ? Math.max(...entry.run.tipRims) : 0);
    for (const entry of tips) {
      if (!near(entry) || !together(tube, entry.mount.shape)) continue;
      const mount = entry.mount.shape;
      if (mount === other || (entry.mount.host && (entry.mount.host === other || other.owner === entry.mount.host.owner))) return true;
      if (tipsOf(ownerOf(other)).some((theirs) => theirs.mount.shape === mount)) return true;
    }
    for (const entry of tipsOf(ownerOf(other))) {
      const mount = entry.mount.shape;
      const lands = mount.owner === tube.owner || seatedOn(mount, tube.owner);
      if (!lands || !together(entry.run, tube)) continue;
      if (len3(sub3(sample.p, add3(entry.mount.tip, offsets.get(entry.run)))) <= zone(sample.r) + (entry.run.tipRims ? Math.max(...entry.run.tipRims) : 0) + sample.r) return true;
    }
    return false;
  };
  const nearTip = (tube, sample) => {
    const at = (tube.offset ?? 0) + sample.along;
    const total = tube.total ?? pathLength(tube.points);
    const tips = mounts.get(tube) ?? [null, null];
    return (tips[0] && at <= zone(sample.r)) || (tips[1] && total - at <= zone(sample.r));
  };
  const clearanceTo = (other, sample) => {
    if (sample.edge >= sample.r) return sdf(other, sample.p) - sample.r;
    return Math.min(...ringAround(sample, sample.r).map((q) => sdf(other, q)));
  };
  for (const tube of tubes) {
    const posed = poseOf.get(tube);
    const samples = samplesOf(posed, spacing);
    const tb = boundsOf(posed);
    for (const shape of solids) {
      if (shape.owner && shape.owner === tube.owner) continue;
      if (matches(tube.touch, shape.name) || matches(shape.touch, tube.name)) continue;
      const other = poseOf.get(shape);
      const ob = boundsOf(other);
      if (!overlaps(tb, ob, Math.max(4, gapOf(widest.get(tube))))) continue;
      for (const sample of samples) {
        if (!overlaps({ min: sample.p, max: sample.p }, ob, sample.r + Math.max(3, gapOf(sample.r)))) continue;
        const gap = gapOf(sample.r);
        const clearance = clearanceTo(other, sample);
        if (clearance >= gap) continue;
        if (related(tube, shape, sample)) continue;
        if (nearTip(tube, sample) && clearance >= through) continue;
        note(tube, shape, clearance < 0 ? "through" : "close", clearance, gap, sample);
      }
    }
  }
  for (let a = 0; a < tubes.length; a++) {
    const ta = poseOf.get(tubes[a]);
    const samples = samplesOf(ta, spacing);
    for (let b = 0; b < tubes.length; b++) {
      if (a === b) continue;
      const tb = poseOf.get(tubes[b]);
      if (tubes[a].owner && tubes[a].owner === tubes[b].owner && tubes[a].joined) continue;
      if (matches(tubes[a].touch, tubes[b].name) || matches(tubes[b].touch, tubes[a].name)) continue;
      const bundled = tubes[a].bundle && tubes[a].bundle === tubes[b].bundle;
      const widestB = widest.get(tubes[b]);
      const envelope = bundled ? 3 : Math.max(3, gapOf(Math.min(widest.get(tubes[a]), widestB)));
      if (!overlaps(boundsOf(ta), boundsOf(tb), envelope)) continue;
      for (const sample of samples) {
        const envelope = bundled ? 3 : Math.max(3, gapOf(Math.min(sample.r, widestB)));
        if (!overlaps({ min: sample.p, max: sample.p }, boundsOf(tb), sample.r + envelope)) continue;
        const clearance = sample.edge >= sample.r ? sdf(tb, sample.p) - sample.r : Math.min(...ringAround(sample, sample.r).map((q) => sdf(tb, q)));
        const r = centreline(tb, sample.p).r;
        const gap = bundled ? touching : gapOf(Math.min(sample.r, r));
        if (clearance >= gap) continue;
        if (related(tubes[a], tubes[b], sample)) continue;
        if (nearTip(tubes[a], sample) && clearance >= through) continue;
        if (a > b && problems.has(`${tubes[b].name}|${tubes[a].name}`)) continue;
        note(tubes[a], tubes[b], clearance < 0 ? "through" : "close", clearance, gap, sample);
      }
    }
  }
  const seen = new Set();
  return [...problems.values()]
    .sort((x, y) => x.clearance - y.clearance)
    .filter((c) => {
      const id = [c.tube, c.other].sort().join("|");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function terminals(tubes, solids, { tolerance = 0.15, mounts = mountsOf(tubes, solids, { tolerance }) } = {}) {
  const out = [];
  for (const tube of tubes) {
    (mounts.get(tube) ?? []).forEach((mount, index) => {
      if (!tube.tips || !tube.tips[index] || (mount && mount.landed)) return;
      out.push({ tube: tube.name, end: index ? "end" : "start", at: tube.tips[index], d: mount ? mount.d : Infinity, high: mount ? mount.high : Infinity, low: mount ? mount.low : -Infinity, nearest: mount ? mount.shape.name : "nothing" });
    });
  }
  return out;
}

function looseEnds(tubes, solids, { state = 1, tolerance = 0.15 } = {}) {
  const out = [];
  for (const tube of tubes) {
    const offset = offsetAt(tube, state);
    (tube.tips ?? []).forEach((tip, index) => {
      if (!tip) return;
      const hit = solids.some((shape) => {
        if ((shape.owner && shape.owner === tube.owner) || shape.name === tube.owner) return false;
        if (!sameOffset(offsetAt(shape, state), offset)) return false;
        const { min, max } = boundsOf(shape);
        return overlaps({ min: tip, max: tip }, { min, max }, 1) && sdf(shape, tip) <= tolerance;
      });
      if (!hit) out.push({ tube: tube.name, end: index ? "end" : "start", at: add3(tip, offset), state: labelOf(state), free: Boolean(tube.free && tube.free[index]) });
    });
  }
  return out;
}

function surfaceOf(shape, spacing = 0.6) {
  if (shape.kind === "annular-sector") return Annular.surfaceSamples(shape, spacing).map(({p}) => p);
  const points = [];
  if (shape.kind === "body") {
    const { F, poly } = shape;
    const u = F.u ?? unit3(Math.abs(F.a[2]) > 0.9 ? [1, 0, 0] : [-F.a[1], F.a[0], 0]);
    const v = F.v ?? [F.a[1] * u[2] - F.a[2] * u[1], F.a[2] * u[0] - F.a[0] * u[2], F.a[0] * u[1] - F.a[1] * u[0]];
    for (let i = 0; i < poly.length - 1; i++) {
      const [s0, r0] = poly[i];
      const [s1, r1] = poly[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(s1 - s0, r1 - r0) / spacing));
      for (let j = 0; j <= steps; j++) {
        const s = s0 + ((s1 - s0) * j) / steps;
        const r = r0 + ((r1 - r0) * j) / steps;
        const around = Math.max(1, Math.min(160, Math.ceil((2 * Math.PI * r) / spacing)));
        for (let k = 0; k < around; k++) {
          const t = (k / around) * 2 * Math.PI;
          points.push(add3(add3(F.o, mul3(F.a, s)), add3(mul3(u, r * Math.cos(t)), mul3(v, r * Math.sin(t)))));
        }
      }
    }
  } else if (shape.kind === "box") {
    for (let axis = 0; axis < 3; axis++)
      for (const sign of [-1, 1]) {
        const o1 = (axis + 1) % 3;
        const o2 = (axis + 2) % 3;
        const n1 = Math.max(1, Math.ceil((2 * shape.half[o1]) / spacing));
        const n2 = Math.max(1, Math.ceil((2 * shape.half[o2]) / spacing));
        for (let i = 0; i <= n1; i++)
          for (let j = 0; j <= n2; j++) {
            const c = [0, 0, 0];
            c[axis] = sign * shape.half[axis];
            c[o1] = -shape.half[o1] + (2 * shape.half[o1] * i) / n1;
            c[o2] = -shape.half[o2] + (2 * shape.half[o2] * j) / n2;
            points.push(add3(shape.o, add3(add3(mul3(shape.axes[0], c[0]), mul3(shape.axes[1], c[1])), mul3(shape.axes[2], c[2]))));
          }
      }
  } else if (shape.kind === "prism") {
    const { F, poly, s0, s1 } = shape;
    const at = (s, x, y) => add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)));
    const rows = Math.max(1, Math.ceil((s1 - s0) / spacing));
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x0, y0] = poly[j];
      const [x1, y1] = poly[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / spacing));
      for (let k = 0; k < steps; k++)
        for (let row = 0; row <= rows; row++) points.push(at(s0 + ((s1 - s0) * row) / rows, x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps));
    }
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += spacing)
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += spacing) if (polygonDistance(poly, x, y) < 0) points.push(at(s0, x, y), at(s1, x, y));
  } else if (shape.kind === "ball") {
    const count = Math.max(24, Math.min(600, Math.ceil((4 * Math.PI * shape.r * shape.r) / (spacing * spacing))));
    for (let i = 0; i < count; i++) {
      const z = 1 - (2 * (i + 0.5)) / count;
      const ring = Math.sqrt(1 - z * z);
      const t = i * 2.399963;
      points.push(add3(shape.o, mul3([ring * Math.cos(t), ring * Math.sin(t), z], shape.r)));
    }
    if (shape.flats) {
      const kept = points.filter((p) => shape.flats.every(([nx, ny, nz, cut]) => nx * (p[0] - shape.o[0]) + ny * (p[1] - shape.o[1]) + nz * (p[2] - shape.o[2]) <= cut + 1e-9));
      points.length = 0;
      points.push(...kept);
      for (const [nx, ny, nz, cut] of shape.flats) {
        const n = [nx, ny, nz];
        const helper = Math.abs(nz) > 0.9 ? [1, 0, 0] : [0, 0, 1];
        const u = unit3([helper[1] * nz - helper[2] * ny, helper[2] * nx - helper[0] * nz, helper[0] * ny - helper[1] * nx]);
        const v = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]];
        const rho = Math.sqrt(Math.max(0, shape.r * shape.r - cut * cut));
        const centre = add3(shape.o, mul3(n, cut));
        for (let x = -rho; x <= rho; x += spacing)
          for (let y = -rho; y <= rho; y += spacing) {
            if (x * x + y * y > rho * rho) continue;
            const p = add3(centre, add3(mul3(u, x), mul3(v, y)));
            if (shape.flats.every(([mx, my, mz, other]) => mx * (p[0] - shape.o[0]) + my * (p[1] - shape.o[1]) + mz * (p[2] - shape.o[2]) <= other + 1e-6)) points.push(p);
          }
      }
    }
  } else {
    for (const sample of samplesOf(shape, spacing)) points.push(...ringAround(sample, sample.r));
  }
  return shape.cut ? points.filter((p) => cutDistance(shape, p) >= -1e-3) : points;
}

const seatedOn = (shape, host) => Boolean(shape.seated && shape.cut && [shape.cut].flat().some((cut) => cut === host || (cut.name && cut.name === host.name)));

const grounded = (shape) => Boolean(shape.ground) || (shape.name ?? "").startsWith("stand.");

function supports(solids, tubes, { ground = grounded, touch = 0.15, sunk = 0.5 } = {}) {
  const nodes = [...solids, ...tubes.filter((tube) => !tube.limp)];
  const surfaces = nodes.map((shape) => surfaceOf(shape));
  const links = nodes.map(() => []);
  const deep = [];
  for (let a = 0; a < nodes.length; a++) {
    const ba = boundsOf(nodes[a]);
    for (let b = a + 1; b < nodes.length; b++) {
      const bb = boundsOf(nodes[b]);
      if (!overlaps(ba, bb, touch + 0.05)) continue;
      const same = (nodes[a].owner && (nodes[a].owner === nodes[b].owner || nodes[a].owner === nodes[b].name)) || (nodes[b].owner && nodes[b].owner === nodes[a].name);
      let gap = BIG;
      for (const p of surfaces[a]) gap = Math.min(gap, sdf(nodes[b], p));
      for (const p of surfaces[b]) gap = Math.min(gap, sdf(nodes[a], p));
      if (gap <= touch) links[a].push(b), links[b].push(a);
      const solidPair = nodes[a].kind !== "tube" && nodes[b].kind !== "tube";
      if (solidPair && !same && gap < -sunk && !seatedOn(nodes[a], nodes[b]) && !seatedOn(nodes[b], nodes[a])) deep.push({ a: nodes[a].name, b: nodes[b].name, depth: -gap });
    }
  }
  const held = new Uint8Array(nodes.length);
  const queue = [];
  nodes.forEach((shape, index) => ground(shape) && ((held[index] = 1), queue.push(index)));
  while (queue.length) {
    const index = queue.pop();
    for (const next of links[index]) if (!held[next]) (held[next] = 1), queue.push(next);
  }
  const loose = nodes.filter((_, index) => !held[index] && nodes[index].kind !== "tube").map((shape) => shape.name);
  const hanging = nodes.filter((_, index) => !held[index] && nodes[index].kind === "tube").map((shape) => shape.name);
  return { loose, hanging, sunk: deep.sort((x, y) => y.depth - x.depth) };
}

function folds(routes, P, { fold = 140, turn = 110, pinch = 2, items = null } = {}) {
  const cam = cameraBasis(P);
  const entries = items ? entriesOf(items, cam) : null;
  const shown = (name, p) => !entries || frontAt(entries, cam, cam.origin[0] + dot3(p, cam.R) * cam.k, cam.origin[1] + dot3(p, cam.D) * cam.k) === name;
  const flat = (p) => [dot3(p, cam.R) * cam.k, dot3(p, cam.D) * cam.k];
  const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1)))) * 180) / Math.PI;
  const out = [];
  for (const { name, points, r } of routes) {
    const step = Math.max(0.25, r * 0.5);
    const dense = resample(points, step);
    const screen = dense.map(flat);
    const reach = Math.max(2, Math.round((4 * r) / step));
    const width = r * cam.k;
    let worst = null;
    for (const span of [1.5, 3, 6]) {
      const near = Math.max(1, Math.round((span * r) / step));
      for (let i = near; i < dense.length - near; i++) {
        const p0 = screen[i - near];
        const p1 = screen[i];
        const p2 = screen[i + near];
        const a = [p1[0] - p0[0], p1[1] - p0[1]];
        const b = [p2[0] - p1[0], p2[1] - p1[1]];
        const c = [p2[0] - p0[0], p2[1] - p0[1]];
        const la = Math.hypot(a[0], a[1]);
        const lb = Math.hypot(b[0], b[1]);
        if (la < width * 0.3 || lb < width * 0.3) continue;
        const bend = angle(a, b);
        const area = Math.abs(a[0] * b[1] - a[1] * b[0]) / 2;
        const radius = area > 1e-9 ? (la * lb * Math.hypot(c[0], c[1])) / (4 * area) : Infinity;
        if (bend > 90 && radius < pinch * width && (!worst || radius < worst.radius) && shown(name, dense[i])) worst = { name, kind: "pinch", flatTurn: bend, radius, width, at: dense[i], index: i };
      }
    }
    if (worst) {
      let toStart = 0;
      for (let i = 1; i <= worst.index; i++) toStart += Math.hypot(screen[i][0] - screen[i - 1][0], screen[i][1] - screen[i - 1][1]);
      let toEnd = 0;
      for (let i = worst.index + 1; i < screen.length; i++) toEnd += Math.hypot(screen[i][0] - screen[i - 1][0], screen[i][1] - screen[i - 1][1]);
      if (Math.min(toStart, toEnd) > 3 * width) out.push(worst);
    }
    for (let i = reach; i < dense.length - reach; i++) {
      const a = [screen[i][0] - screen[i - reach][0], screen[i][1] - screen[i - reach][1]];
      const b = [screen[i + reach][0] - screen[i][0], screen[i + reach][1] - screen[i][1]];
      if (Math.hypot(a[0], a[1]) < 1e-6 || Math.hypot(b[0], b[1]) < 1e-6) continue;
      const flatTurn = angle(a, b);
      const A3 = sub3(dense[i], dense[i - reach]);
      const B3 = sub3(dense[i + reach], dense[i]);
      const realTurn = (Math.acos(Math.max(-1, Math.min(1, dot3(A3, B3) / (len3(A3) * len3(B3) || 1)))) * 180) / Math.PI;
      if (flatTurn > fold && realTurn < turn && shown(name, dense[i])) {
        out.push({ name, kind: "fold", flatTurn, realTurn, at: dense[i] });
        i += 2 * reach;
      }
    }
  }
  return out;
}

function linksOf(tubes, mounts) {
  const links = new Map();
  const link = (a, b) => {
    if (!a || !b || a === b) return;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a).add(b);
    links.get(b).add(a);
  };
  const ownerOf = (shape) => shape.owner ?? shape.name;
  const seats = new Map();
  for (const tube of tubes)
    for (const mount of mounts.get(tube) ?? []) {
      if (!mount) continue;
      const host = ownerOf(mount.shape);
      link(tube.owner, host);
      if (!seats.has(host)) seats.set(host, []);
      seats.get(host).push(tube.owner);
      if (mount.shape.cut) for (const cut of [mount.shape.cut].flat()) link(tube.owner, ownerOf(cut));
    }
  for (const owners of seats.values()) for (const a of owners) for (const b of owners) link(a, b);
  return links;
}

const entriesOf = (items, cam) => items.flatMap((item) => (item.shapes ?? []).map((shape) => ({ shape, box: screenBox(shape, cam, [0, 0, 0]).map((v, i) => v + (i < 2 ? -1 : 1)), owner: item.route ?? shape.owner ?? item.name, bundle: shape.bundle ?? null, item: item.name })));

function frontEntry(entries, cam, x, y) {
  const c = add3(mul3(cam.R, (x - cam.origin[0]) / cam.k), mul3(cam.D, (y - cam.origin[1]) / cam.k));
  let best = -BIG;
  let who = null;
  for (const entry of entries) {
    const { shape, box } = entry;
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
    const t = rayDepth(shape, c, cam.V, 0.02, null);
    if (t !== null && t > best) (best = t), (who = entry);
  }
  return who;
}

function frontAt(entries, cam, x, y) {
  const entry = frontEntry(entries, cam, x, y);
  return entry ? entry.owner : null;
}

const belongs = (entry, name, bundle) => Boolean(entry) && (entry.owner === name || entry.item === name || (bundle && entry.bundle === bundle));

function slenderOf(solids, { ratio = 4, least = 0.3 } = {}) {
  const out = [];
  const axisLine = (centre, axis, half, r, shape) => {
    out.push({ name: shape.owner ?? shape.name, solid: shape.name, owners: new Set([shape.name, shape.owner].filter(Boolean)), points: [add3(centre, mul3(axis, -half)), add3(centre, mul3(axis, half))], r, move: shape.move, ride: shape.ride, piece: shape.piece, rod: true });
  };
  for (const shape of solids) {
    if (!shape || shape.kind === "tube" || shape.kind === "ball" || shape.fitting) continue;
    if (shape.kind === "body") {
      const s = shape.poly.map(([value]) => value);
      const s0 = Math.min(...s);
      const s1 = Math.max(...s);
      const r = Math.max(...shape.poly.map(([, value]) => value));
      if (r >= least && s1 - s0 >= ratio * r) axisLine(add3(shape.F.o, mul3(shape.F.a, (s0 + s1) / 2)), shape.F.a, (s1 - s0) / 2, r, shape);
      continue;
    }
    let axes;
    let half;
    let centre;
    if (shape.kind === "prism") {
      const xs = shape.poly.map(([x]) => x);
      const ys = shape.poly.map(([, y]) => y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      axes = [shape.F.u, shape.F.v, shape.F.a];
      half = [(x1 - x0) / 2, (y1 - y0) / 2, (shape.s1 - shape.s0) / 2];
      centre = add3(shape.F.o, add3(add3(mul3(shape.F.u, (x0 + x1) / 2), mul3(shape.F.v, (y0 + y1) / 2)), mul3(shape.F.a, (shape.s0 + shape.s1) / 2)));
    } else if (shape.kind === "box") {
      axes = shape.axes;
      half = shape.half;
      centre = shape.o;
    } else continue;
    const order = [0, 1, 2].sort((a, b) => half[b] - half[a]);
    const r = half[order[1]];
    if (r >= least && half[order[0]] >= ratio * r) axisLine(centre, axes[order[0]], half[order[0]], r, shape);
  }
  return out;
}

function crowding(routes, P, { gap = 1, bend = 30, links = new Map(), items = null, allow = [], state, clear = 2, rods = [] } = {}) {
  const cam = cameraBasis(P);
  const shift = (thing) => (state === undefined ? [0, 0, 0] : offsetOf(thing, state));
  const entries = items ? entriesOf(items.map((item) => ({ ...item, shapes: (item.shapes ?? []).map((shape) => moved(shape, shift(item))) })), cam) : null;
  const bundles = new Map(routes.map((route) => [route.name, route.bundle]));
  const shown = (owner, x, y, rod) => {
    if (!entries) return true;
    const entry = frontEntry(entries, cam, x, y);
    if (rod) return Boolean(entry) && (entry.shape.name === rod.solid || (!entry.shape.name && entry.item === rod.solid));
    return belongs(entry, owner, bundles.get(owner));
  };
  const flat = (p) => [cam.origin[0] + dot3(p, cam.R) * cam.k, cam.origin[1] + dot3(p, cam.D) * cam.k];
  const lines = [...routes, ...rods].map((route) => {
    const step = Math.max(0.25, route.r * 0.5);
    const offset = shift(route);
    const dense = resample(route.points.map((p) => add3(p, offset)), step);
    return { ...route, step, dense, screen: dense.map(flat), width: route.r * cam.k };
  });
  const marksOf = (line) => {
    const out = [];
    const reach = Math.max(2, Math.round((2 * line.r) / line.step));
    const last = line.dense.length - 1;
    for (let i = 0; i <= last; i++) {
      if (i <= reach || i >= last - reach) {
        out.push({ i, where: i <= reach ? "start" : "end" });
        continue;
      }
      const A = sub3(line.dense[i], line.dense[i - reach]);
      const B = sub3(line.dense[i + reach], line.dense[i]);
      const turn = (Math.acos(Math.max(-1, Math.min(1, dot3(A, B) / (len3(A) * len3(B) || 1)))) * 180) / Math.PI;
      if (turn > bend) out.push({ i, where: "bend" });
    }
    return out;
  };
  const found = new Map();
  for (const a of lines) {
    if (a.rod) continue;
    const marks = marksOf(a);
    for (const b of lines) {
      if (a === b || (a.bundle && a.bundle === b.bundle) || links.get(a.name)?.has(b.name)) continue;
      if (b.rod && [...b.owners].some((name) => name === a.name || links.get(a.name)?.has(name))) continue;
      if (allow.some(([x, y]) => [b.name, b.solid].filter(Boolean).some((name) => (matches([x], a.name) && matches([y], name)) || (matches([y], a.name) && matches([x], name))))) continue;
      for (const { i, where } of marks) {
        const [x, y] = a.screen[i];
        let best = { d: BIG, j: -1 };
        for (let j = 0; j < b.screen.length; j++) {
          const d = Math.hypot(b.screen[j][0] - x, b.screen[j][1] - y);
          if (d < best.d) best = { d, j };
        }
        const touch = best.d - a.width - b.width;
        if (touch >= gap) continue;
        if (where !== "bend" && touch <= -2 * Math.min(a.width, b.width)) {
          const tip = a.screen[where === "start" ? 0 : a.screen.length - 1];
          let clearTip = BIG;
          for (const q of b.screen) clearTip = Math.min(clearTip, Math.hypot(q[0] - tip[0], q[1] - tip[1]));
          const reachB = Math.max(2, Math.round((2 * b.r) / b.step));
          const j0 = Math.max(0, best.j - reachB);
          const j1 = Math.min(b.dense.length - 1, best.j + reachB);
          const straight = j1 - j0 >= 2 && dot3(unit3(sub3(b.dense[best.j], b.dense[j0])), unit3(sub3(b.dense[j1], b.dense[best.j]))) > Math.cos((bend * Math.PI) / 180);
          if (straight && clearTip > b.width + a.width + 1) continue;
        }
        const [bx, by] = b.screen[best.j];
        const u = [(bx - x) / (best.d || 1), (by - y) / (best.d || 1)];
        const inA = Math.max(0.2, a.width - 0.35);
        const inB = Math.max(0.2, b.width - 0.35);
        if (!shown(a.name, x + u[0] * inA, y + u[1] * inA)) continue;
        if (b.rod) {
          if (!shown(b.name, bx - u[0] * inB, by - u[1] * inB, b) && !shown(b.name, bx + u[0] * inB, by + u[1] * inB, b)) continue;
        } else if (!shown(b.name, bx - u[0] * inB, by - u[1] * inB)) continue;
        const depth = Math.abs(dot3(sub3(a.dense[i], b.dense[best.j]), cam.V));
        const need = 2 * (a.r + b.r);
        const id = [a.name, b.name].sort().join("|");
        const prior = found.get(id);
        if (!prior || Math.abs(touch) < Math.abs(prior.gap)) found.set(id, { a: a.name, b: b.rod ? `${b.solid} (rod)` : b.name, where, gap: touch, depth, need, screen: [x, y], at: a.dense[i], state: state === undefined ? "" : labelOf(state) });
      }
    }
  }
  if (entries)
    for (const fitting of entries.filter((entry) => entry.shape.fitting && entry.shape.kind === "body")) {
      const { shape } = fitting;
      const reach = Math.max(...shape.poly.map(([, r]) => r));
      const [x, y] = flat(shape.F.o);
      for (const b of lines) {
        if (b.rod) continue;
        if ((fitting.bundle && b.bundle === fitting.bundle) || b.name === fitting.owner || links.get(fitting.owner)?.has(b.name)) continue;
        if (allow.some(([p, q]) => (matches([p], fitting.item) && matches([q], b.name)) || (matches([q], fitting.item) && matches([p], b.name)))) continue;
        let best = { d: BIG, j: -1 };
        for (let j = 0; j < b.screen.length; j++) {
          const d = Math.hypot(b.screen[j][0] - x, b.screen[j][1] - y);
          if (d < best.d) best = { d, j };
        }
        const touch = best.d - reach * cam.k - b.width;
        if (touch >= clear) continue;
        const front = frontEntry(entries, cam, x, y);
        if (!(front === fitting || belongs(front, fitting.owner, fitting.bundle))) continue;
        const id = [fitting.item, b.name].sort().join("|");
        const prior = found.get(id);
        if (!prior || Math.abs(touch) < Math.abs(prior.gap)) found.set(id, { a: fitting.item, b: b.name, where: "fitting", gap: touch, depth: Math.abs(dot3(sub3(shape.F.o, b.dense[best.j]), cam.V)), need: 0, screen: [x, y], at: shape.F.o, state: state === undefined ? "" : labelOf(state) });
      }
    }
  return [...found.values()].sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap));
}

const multiply = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

function matrixOf(text) {
  let m = [1, 0, 0, 1, 0, 0];
  if (!text) return m;
  for (const [, kind, args] of text.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const v = (args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    let n = [1, 0, 0, 1, 0, 0];
    if (kind === "matrix" && v.length === 6) n = v;
    else if (kind === "translate") n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (kind === "scale") n = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    else if (kind === "rotate") {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0];
      n = multiply(multiply([1, 0, 0, 1, cx, cy], [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    }
    else if (kind === "skewX") n = [1, 0, Math.tan((v[0] ?? 0) * Math.PI / 180), 1, 0, 0];
    else if (kind === "skewY") n = [1, Math.tan((v[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0];
    m = multiply(m, n);
  }
  return m;
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

const attributeOf = (attrs, name) => {
  const hit = [...attrs.matchAll(/(?:^|\s)([^\s=/>]+)\s*=\s*(["'])([\s\S]*?)\2/g)].find((match) => match[1] === name);
  if (!hit) return null;
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return hit[3].replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (all, code) => {
    if (code[0] !== "#") return named[code];
    const value = code[1] === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : all;
  });
};

function pointsOfShape(tag, attrs) {
  const get = (name) => attributeOf(attrs, name);
  const num = (name) => Number(get(name) ?? 0);
  if (tag === "path") {
    const d = get("d") ?? "";
    const out = [];
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    for (const [, command, args] of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
      const v = (args.match(NUMBER) ?? []).map(Number);
      const rel = command === command.toLowerCase();
      const C = command.toUpperCase();
      const pair = (i) => [v[i] + (rel ? x : 0), v[i + 1] + (rel ? y : 0)];
      const take = (p) => {
        out.push(p);
        return p;
      };
      if (C === "H") for (const value of v) [x] = take([value + (rel ? x : 0), y]);
      else if (C === "V") for (const value of v) [, y] = take([x, value + (rel ? y : 0)]);
      else if (C === "A") for (let i = 0; i + 6 < v.length; i += 7) [x, y] = take([v[i + 5] + (rel ? x : 0), v[i + 6] + (rel ? y : 0)]);
      else if (C === "Z") {
        x = sx;
        y = sy;
      } else {
        const width = C === "C" ? 6 : C === "S" || C === "Q" ? 4 : 2;
        for (let i = 0; i + 1 < v.length; i += width) {
          for (let j = 0; j < width; j += 2) out.push(pair(i + j));
          [x, y] = pair(i + width - 2);
          if (C === "M" && i === 0) {
            sx = x;
            sy = y;
          }
        }
      }
    }
    return out;
  }
  if (tag === "circle" || tag === "ellipse") {
    const r = Number(get("r") ?? get("rx") ?? 0);
    const ry = Number(get("r") ?? get("ry") ?? 0);
    return [[num("cx") - r, num("cy") - ry], [num("cx") + r, num("cy") + ry]];
  }
  if (tag === "line") return [[num("x1"), num("y1")], [num("x2"), num("y2")]];
  if (tag === "rect") return cornersOfBox([num("x"), num("y"), num("x") + num("width"), num("y") + num("height")]);
  if (tag === "polyline" || tag === "polygon") {
    const v = (get("points") ?? "").match(NUMBER)?.map(Number) ?? [];
    const out = [];
    for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]);
    return out;
  }
  return [];
}

const boxOfPoints = (points, m) => {
  let box = null;
  for (const [x, y] of points) {
    const px = m[0] * x + m[2] * y + m[4];
    const py = m[1] * x + m[3] * y + m[5];
    box = box ? [Math.min(box[0], px), Math.min(box[1], py), Math.max(box[2], px), Math.max(box[3], py)] : [px, py, px, py];
  }
  return box;
};
const cornersOfBox = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const boxOfShape = (tag, attrs, m) => {
  if (tag !== "circle" && tag !== "ellipse") return boxOfPoints(pointsOfShape(tag, attrs), m);
  const num = (name) => Number(attributeOf(attrs, name) ?? 0);
  const rx = tag === "circle" ? num("r") : num("rx");
  const ry = tag === "circle" ? rx : num("ry");
  const x = m[0] * num("cx") + m[2] * num("cy") + m[4];
  const y = m[1] * num("cx") + m[3] * num("cy") + m[5];
  const dx = Math.hypot(m[0] * rx, m[2] * ry);
  const dy = Math.hypot(m[1] * rx, m[3] * ry);
  return [x - dx, y - dy, x + dx, y + dy];
};
const unionBox = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
const meetBox = (a, b) => {
  if (!a || !b) return a ?? null;
  const box = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return box[0] <= box[2] && box[1] <= box[3] ? box : null;
};
const areaOf = (box) => (box ? Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]) : 0);

function markupBox(svg) {
  const tags = [...svg.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g)];
  const clips = new Map();
  let clipId = null;
  for (const [, close, tag, attrs, self] of tags) {
    if (tag === "clipPath" && !close) {
      const id = attributeOf(attrs, "id");
      if (id) clips.set(id, null);
      clipId = self ? null : id;
      continue;
    }
    if (clipId) {
      if (tag === "clipPath" && close) {
        clipId = null;
        continue;
      }
      clips.set(clipId, unionBox(clips.get(clipId), boxOfShape(tag, attrs, matrixOf(attributeOf(attrs, "transform")))));
    }
  }
  const stack = [{ m: [1, 0, 0, 1, 0, 0], clip: null, skip: false }];
  let box = null;
  for (const [, close, tag, attrs, self] of tags) {
    const top = stack[stack.length - 1];
    if (close) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const m = multiply(top.m, matrixOf(attributeOf(attrs, "transform")));
    const ref = ((attributeOf(attrs, "clip-path") ?? "").match(/url\(#([^)]*)\)/) ?? [])[1];
    const own = ref && clips.get(ref) ? boxOfPoints(cornersOfBox(clips.get(ref)), m) : null;
    const clip = own ? meetBox(top.clip ?? own, own) : top.clip;
    const empty = ref && clips.has(ref) && (!own || areaOf(own) === 0 || (top.clip && (!clip || areaOf(clip) === 0)));
    const frame = { m, clip, skip: Boolean(empty) || top.skip || ["defs", "clipPath", "mask", "linearGradient", "radialGradient", "pattern", "text", "title"].includes(tag) || (attributeOf(attrs, "class") ?? "").includes("iso-halo") };
    if (!frame.skip) {
      const shape = boxOfShape(tag, attrs, m);
      if (shape) box = unionBox(box, frame.clip ? meetBox(shape, frame.clip) : shape);
    }
    if (!self) stack.push(frame);
  }
  return box;
}

function footprintOf(shape, cam) {
  const flat = (p) => [cam.origin[0] + dot3(p, cam.R) * cam.k, cam.origin[1] + dot3(p, cam.D) * cam.k];
  if (shape.kind === "body") {
    const { F } = shape;
    const points = [];
    for (const [s, r] of shape.poly) {
      if (r <= 0) {
        points.push(flat(add3(F.o, mul3(F.a, s))));
        continue;
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        points.push(flat(add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, r * Math.cos(a)), mul3(F.v, r * Math.sin(a))))));
      }
    }
    return boxOfPoints(points, [1, 0, 0, 1, 0, 0]);
  }
  if (shape.kind === "prism") {
    const { F } = shape;
    const points = [];
    for (const s of [shape.s0, shape.s1]) for (const [x, y] of shape.poly) points.push(flat(add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)))));
    return boxOfPoints(points, [1, 0, 0, 1, 0, 0]);
  }
  const [x0, y0, x1, y1] = screenBox(shape, cam, [0, 0, 0]);
  return [x0, y0, x1, y1];
}

function coverage(items, P, { least = 0.6, pad = 1, allow = [] } = {}) {
  const cam = cameraBasis(P);
  const out = [];
  for (const item of items) {
    if (typeof item.svg !== "string" || !item.shapes || !item.shapes.length || matches(allow, item.name)) continue;
    const drawn = markupBox(item.svg);
    if (!drawn) continue;
    const grow = (box) => [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad];
    const shapes = item.shapes.map((shape) => footprintOf(shape, cam)).reduce(unionBox, null);
    const share = areaOf(meetBox(grow(drawn), grow(shapes))) / (areaOf(grow(drawn)) || 1);
    if (share < least) out.push({ name: item.name, share, drawn, shapes });
  }
  return out.sort((a, b) => a.share - b.share);
}

function selfOverlaps(items, P, { entries: given = null, fold = 0.25, least = 0.5 } = {}) {
  const cam = cameraBasis(P);
  const entries = given ?? entriesOf(items, cam);
  const flat = (p) => [cam.origin[0] + dot3(p, cam.R) * cam.k, cam.origin[1] + dot3(p, cam.D) * cam.k];
  const out = [];
  for (const item of items) {
    if (!item.route || !item.shapes || !item.shapes.length || item.shapes[0].kind !== "tube") continue;
    const shape = item.shapes[0];
    const r = shape.radii.reduce((sum, value) => sum + value, 0) / shape.radii.length;
    const dense = resample(shape.points, Math.max(0.1, r * 0.2));
    const screen = dense.map(flat);
    const n = screen.length;
    if (n < 4) continue;
    const width = r * cam.k;
    const span = 3;
    const normals = screen.map((_, i) => {
      const a = screen[Math.max(0, i - span)];
      const b = screen[Math.min(n - 1, i + span)];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    });
    let worst = null;
    for (const side of [1, -1]) {
      const edge = screen.map((p, i) => [p[0] + side * normals[i][0] * width, p[1] + side * normals[i][1] * width]);
      for (let i = span; i < n - span - 1; i++) {
        const along = [screen[i + 1][0] - screen[i][0], screen[i + 1][1] - screen[i][1]];
        const step = [edge[i + 1][0] - edge[i][0], edge[i + 1][1] - edge[i][1]];
        const length = Math.hypot(along[0], along[1]);
        if (length < 1e-6) continue;
        const forward = (step[0] * along[0] + step[1] * along[1]) / length;
        if (forward > -fold * length) continue;
        const x = (screen[i][0] + screen[i + 1][0]) / 2;
        const y = (screen[i][1] + screen[i + 1][1]) / 2;
        const front = frontEntry(entries, cam, x, y);
        if (front && front.owner !== item.route && front.item !== item.name) continue;
        const radius = Math.abs(forward / length - 1) > 1e-6 ? width / Math.abs(1 - forward / length) : Infinity;
        if (width - radius < least) continue;
        if (!worst || radius < worst.radius) worst = { name: item.name, route: item.route, radius, width, at: dense[i], screen: [x, y] };
      }
    }
    if (worst) out.push(worst);
  }
  return out;
}

function solidClearances(solids, { state, sunk = 0.5, spacing = 0.6, cell = 4 } = {}) {
  const stretched = new Set();
  const list = solids.filter((shape) => shape.kind !== "tube").map((shape) => {
    if (!(shape.slide && state !== undefined && shape.move)) return shape;
    const next = { ...moved(shape, offsetOf(shape, state)), move: undefined };
    if (next.slide.to !== shape.slide.to) stretched.add(next);
    return next;
  });
  if (!solidClearances.cache) solidClearances.cache = new WeakMap();
  const cache = solidClearances.cache;
  const gridOf = (shape) => {
    let samples = cache.get(shape);
    if (!samples) cache.set(shape, samples = new Map());
    const key = `${spacing}:${cell}`;
    let grid = samples.get(key);
    if (grid) return grid;
    grid = new Map();
    for (const p of surfaceOf(shape, spacing)) {
      const key = p.map((v) => Math.floor(v / cell)).join(",");
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }
    samples.set(key, grid);
    return grid;
  };
  const pointsIn = (shape, box) => {
    const grid = gridOf(shape);
    const lo = box.min.map((v) => Math.floor(v / cell));
    const hi = box.max.map((v) => Math.floor(v / cell));
    const out = [];
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > grid.size) {
      for (const points of grid.values()) for (const p of points) if (p.every((v, i) => v >= box.min[i] && v <= box.max[i])) out.push(p);
      return out;
    }
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const points = grid.get(`${x},${y},${z}`);
          if (points) for (const p of points) if (p.every((v, i) => v >= box.min[i] && v <= box.max[i])) out.push(p);
        }
    return out;
  };
  const offsets = list.map((shape) => offsetAt(shape, state));
  const bounds = list.map((shape) => boundsOf(shape));
  const found = [];
  for (let a = 0; a < list.length; a++)
    for (let b = a + 1; b < list.length; b++) {
      const rel = sub3(offsets[a], offsets[b]);
      if (Math.abs(rel[0]) + Math.abs(rel[1]) + Math.abs(rel[2]) < 1e-6 && !stretched.has(list[a]) && !stretched.has(list[b])) continue;
      const box = { min: [0, 1, 2].map((i) => Math.max(bounds[a].min[i] + rel[i], bounds[b].min[i])), max: [0, 1, 2].map((i) => Math.min(bounds[a].max[i] + rel[i], bounds[b].max[i])) };
      if (box.min.some((v, i) => v > box.max[i] - sunk)) continue;
      if (seatedOn(list[a], list[b]) || seatedOn(list[b], list[a])) continue;
      let worst = -sunk;
      let at = null;
      const local = { min: sub3(box.min, rel), max: sub3(box.max, rel) };
      for (const p of pointsIn(list[a], local)) {
        const d = sdf(list[b], add3(p, rel));
        if (d < worst) (worst = d), (at = add3(p, offsets[a]));
      }
      for (const p of pointsIn(list[b], box)) {
        const d = sdf(list[a], sub3(p, rel));
        if (d < worst) (worst = d), (at = add3(p, offsets[b]));
      }
      if (at) found.push({ tube: list[a].name, other: list[b].name, kind: "through", solid: true, clearance: worst, need: -sunk, at, from: 0, to: 0, length: 0, state: state === undefined ? "" : labelOf(state) });
    }
  return found.sort((x, y) => x.clearance - y.clearance);
}

function wobble(solids, { samples = 20 } = {}) {
  const out = [];
  for (const shape of solids) {
    const profile = shape.curve;
    if (!profile) continue;
    const segments = curveRuns(profile);
    let run = [];
    const flush = () => {
      if (run.length) {
        const values = [];
        for (const index of run) {
          const [s0] = profile[index];
          const [s1] = profile[index + 1];
          for (let j = values.length ? 1 : 0; j <= samples; j++) {
            const s = s0 + ((s1 - s0) * j) / samples;
            values.push([s, segments[index].slope(s)]);
          }
        }
        const scale = Math.max(1, ...values.map(([, g]) => Math.abs(g))) * 1e-6;
        const turns = [];
        let last = 0;
        for (let i = 1; i < values.length; i++) {
          const d = values[i][1] - values[i - 1][1];
          if (Math.abs(d) <= scale) continue;
          const sign = Math.sign(d);
          if (last && sign !== last) turns.push(Math.round(values[i - 1][0] * 100) / 100);
          last = sign;
        }
        if (turns.length) out.push({ name: shape.name, at: turns, from: profile[run[0]][0], to: profile[run[run.length - 1] + 1][0] });
      }
      run = [];
    };
    segments.forEach((segment, index) => (segment ? run.push(index) : flush()));
    flush();
  }
  return out;
}

function seats(solids) {
  const out = [];
  for (const shape of solids) {
    if (!shape.seated || !shape.cut) continue;
    for (const host of [shape.cut].flat()) {
      const mine = mul3(shape.move ?? [0, 0, 0], 1);
      const theirs = mul3(host.move ?? [0, 0, 0], 1);
      if ((shape.ride ?? shape.piece) === (host.ride ?? host.piece) && sameOffset(mine, theirs)) continue;
      out.push({ name: shape.name, host: host.name, piece: shape.ride ?? shape.piece, hostPiece: host.ride ?? host.piece });
    }
  }
  return out;
}

function report({ clearance = [], depth = { problems: [], missing: [] }, terminals: ends, folds: bends, supports: held, loose, apart, flight, crowding: crowded, self, wobble: wobbly, seats: seated, cover: covered } = {}, { limit = 4000 } = {}) {
  const lines = [];
  const f = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const p3 = (p) => `[${p.map((v) => v.toFixed(1)).join(", ")}]`;
  const clash = (c) => (c.solid ? `  solid   ${c.state ? c.state + "  " : ""}${c.tube}  ×  ${c.other}   sunk ${f(-c.clearance)} deep   at ${p3(c.at)}` : `  ${c.kind.padEnd(7)} ${c.state ? c.state + "  " : ""}${c.tube}  ×  ${c.other}   clearance ${f(c.clearance)} < ${f(c.need)}   along ${f(c.from)}–${f(c.to)} of ${f(c.length)}   at ${p3(c.at)}`);
  lines.push(`clearance: ${clearance.length} problem${clearance.length === 1 ? "" : "s"}`);
  for (const c of clearance.slice(0, limit)) lines.push(clash(c));
  if (apart) {
    lines.push(`clearance apart: ${apart.length} problem${apart.length === 1 ? "" : "s"}`);
    for (const c of apart.slice(0, limit)) lines.push(clash(c));
  }
  if (ends) {
    lines.push(`terminals: ${ends.length} end${ends.length === 1 ? "" : "s"} not on a mount`);
    for (const e of ends.slice(0, limit)) lines.push(`  ${e.tube} ${e.end}  ${Number.isFinite(e.d) ? f(e.d) : "∞"} from ${e.nearest} (rim ${Number.isFinite(e.high) ? `${f(e.low)}…${f(e.high)}` : "-"})   at ${p3(e.at)}`);
  }
  if (loose) {
    const hanging = loose.filter((e) => !e.free);
    lines.push(`loose ends: ${hanging.length}`);
    for (const e of hanging.slice(0, limit)) lines.push(`  ${e.state}  ${e.tube} ${e.end} touches nothing that moves with it   at ${p3(e.at)}`);
  }
  if (bends) {
    lines.push(`screen folds: ${bends.length}`);
    for (const b of bends.slice(0, limit))
      lines.push(b.kind === "pinch" ? `  ${b.name}  turns ${b.flatTurn.toFixed(0)}° on screen round a ${f(b.radius)} px bend, under ${f(b.width * 2)} px for a ${f(b.width)} px tube   at ${p3(b.at)}` : `  ${b.name}  turns ${b.flatTurn.toFixed(0)}° on screen for ${b.realTurn.toFixed(0)}° in 3D   at ${p3(b.at)}`);
  }
  if (held) {
    const hanging = held.hanging ?? [];
    lines.push(`support: ${held.loose.length} unsupported solid${held.loose.length === 1 ? "" : "s"} · ${hanging.length} hanging tube${hanging.length === 1 ? "" : "s"} · ${held.sunk.length} sunk pair${held.sunk.length === 1 ? "" : "s"}`);
    for (const name of held.loose.slice(0, limit)) lines.push(`  loose   ${name}`);
    for (const name of hanging.slice(0, limit)) lines.push(`  hanging ${name}`);
    for (const d of held.sunk.slice(0, limit)) lines.push(`  sunk    ${d.a} × ${d.b}   ${f(d.depth)} deep`);
  }
  lines.push(`depth order: ${depth.problems.length} problem${depth.problems.length === 1 ? "" : "s"}`);
  for (const d of depth.problems.slice(0, limit))
    lines.push(`  ${d.cycle ? "cycle " : "order "} ${d.label}  ${d.front} (k ${f(d.frontKey)}) is in front of ${d.back} (k ${f(d.backKey)}) but drawn first   ${f(d.area)} px²${d.against ? ` (${f(d.against)} px² the other way)` : ""}, up to ${f(d.depth)} nearer, at ${d.at.map((v) => v.toFixed(1)).join(",")}`);
  if (flight) {
    lines.push(`through in mid-flight: ${flight.length} pair${flight.length === 1 ? "" : "s"}`);
    for (const c of flight.slice(0, limit)) lines.push(clash(c));
  }
  if (self) {
    lines.push(`self-overlap: ${self.length} chunk${self.length === 1 ? "" : "s"} whose outline crosses itself on screen`);
    for (const c of self.slice(0, limit)) lines.push(`  ${c.name}  its outline folds back on screen: the line turns on a ${f(c.radius)} px radius, under its ${f(c.width)} px half-width   at ${p3(c.at)}, screen ${c.screen.map((v) => v.toFixed(1)).join(",")}`);
  }
  if (wobbly) {
    lines.push(`wobble: ${wobbly.length} smoothed profile${wobbly.length === 1 ? "" : "s"} whose slope turns between its ends`);
    for (const w of wobbly.slice(0, limit)) lines.push(`  ${w.name}  dr/ds turns at s = ${w.at.join(", ")} on the run ${f(w.from)}–${f(w.to)}; give it an analytic profile and smooth.slope`);
  }
  if (seated) {
    lines.push(`saddles off their host apart: ${seated.length}`);
    for (const d of seated.slice(0, limit)) lines.push(`  ${d.name} (${d.piece}) is cut to ${d.host} (${d.hostPiece}); apart, its cut base is on show`);
  }
  if (covered) {
    lines.push(`stand-in shapes: ${covered.length} item${covered.length === 1 ? "" : "s"} whose recorded shape covers too little of what it draws`);
    for (const c of covered.slice(0, limit)) lines.push(`  ${c.name}  its shapes cover ${Math.round(c.share * 100)}% of its drawing (drawn ${c.drawn.map((v) => v.toFixed(0)).join(",")}, recorded ${c.shapes.map((v) => v.toFixed(0)).join(",")}); record the true shape of what you draw`);
  }
  if (crowded) {
    lines.push(`crowding: ${crowded.length} pair${crowded.length === 1 ? "" : "s"} where a bend or end touches another line on screen`);
    for (const c of crowded.slice(0, limit)) lines.push(`  ${c.state ? c.state + "  " : ""}${c.a} ${c.where}  ×  ${c.b}   outlines ${c.gap < 0 ? `overlap ${f(-c.gap)}` : `${f(c.gap)} apart`} px, ${f(c.depth)} apart in depth   at screen ${c.screen.map((v) => v.toFixed(1)).join(",")}`);
  }
  if (depth.passing && depth.passing.length) {
    const pairs = (list) => new Set(list.map((d) => [d.front, d.back].sort().join("|"))).size;
    lines.push(`in passing (uniform explode states only, not failing): ${pairs(depth.passing.filter((d) => d.cycle))} interlocked pairs, ${pairs(depth.passing.filter((d) => !d.cycle))} pairs no linear key can order`);
    for (const d of depth.passing.slice(0, limit)) lines.push(`  ${d.cycle ? "cycle " : "unorderable"} ${d.label}  ${d.front} / ${d.back}   ${f(d.area)} px²`);
  }
  if (depth.missing.length) lines.push(`items with no shape: ${depth.missing.length}  ${depth.missing.slice(0, 20).join(", ")}`);
  if (loose && loose.some((e) => e.free)) {
    const free = loose.filter((e) => e.free);
    lines.push(`free ends apart (marked free, not failing): ${free.length}`);
    for (const e of free.slice(0, limit)) lines.push(`  ${e.tube} ${e.end}   at ${p3(e.at)}`);
  }
  return lines.join("\n");
}

const failures = ({ clearance = [], depth = { problems: [], missing: [] }, terminals: ends = [], folds: bends = [], supports: held = { loose: [], sunk: [] }, loose = [], apart = [], flight = [], crowding: crowded = [], self = [], wobble: wobbly = [], seats: seated = [], cover: covered = [] }) =>
  covered.length + clearance.length + apart.length + flight.length + crowded.length + ends.length + loose.filter((e) => !e.free).length + bends.length + held.loose.length + (held.hanging ?? []).length + held.sunk.length + depth.problems.length + depth.missing.length + self.length + wobbly.length + seated.length;

const sameRun = (a, b) => Boolean(a.route) && a.route === b.route && Math.abs(a.chunk - b.chunk) <= 1;

function recorder(P, { order = [], spring = {}, ground = grounded } = {}) {
  const V = cameraBasis(P).V;
  const counts = new Map();
  const R = { P, V, order, spring, ground, items: [], solids: [], tubes: [], routes: [], settled: null };
  R.nameFor = (base) => {
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  };
  R.solid = (shape) => {
    R.solids.push(shape);
    return shape;
  };
  R.put = ({ at = null, bias = 0, key, name, piece = "", move = [0, 0, 0], ride, shapes = [], ...rest } = {}) => {
    const item = { ...rest, piece, ride: ride ?? piece, key: key ?? (at ? dot3(at, V) : 0) + bias, move, shapes, name: name ?? R.nameFor(`${piece || "item"}.item`) };
    for (const shape of shapes) (shape.move = item.move), (shape.ride = item.ride), (shape.piece = piece);
    R.items.push(item);
    return item;
  };
  R.route = (name, points, radius, { owner = name, touch, bundle, limp = false, gaps = [], closed = false, ends = [true, true], rims, free = [false, false], piece = "", move = [0, 0, 0], ride = piece } = {}) => {
    const total = pathLength(points);
    const radiusOf = typeof radius === "function" ? radius : () => radius;
    const runs = runsOf(total, gaps);
    const recorded = runs.map(([from, to], index) => ({
      ...tube(cutAlong(points, from, to), (t) => radiusOf((from + (to - from) * t) / total), { name, owner, touch, bundle, limp, joined: true }),
      tips: closed ? [null, null] : [index === 0 && ends[0] ? points[0] : null, index === runs.length - 1 && ends[1] ? points[points.length - 1] : null],
      tipAxes: [tangentAlong(points, 0), tangentAlong(points, total)],
      tipRims: rims ?? [radiusOf(0), radiusOf(1)],
      free: [index === 0 && free[0], index === runs.length - 1 && free[1]],
      offset: from,
      total,
      move,
      ride,
      piece,
    }));
    R.tubes.push(...recorded);
    R.routes.push({ name, points, r: radiusOf(0.5), bundle, move, ride, piece });
    return recorded;
  };
  return R;
}

function explodeStates(order = [], spring = {}, { uniform = 10, stride = 4 } = {}) {
  if (!order.length) return { depth: [0], frames: [], apart: false };
  const reversals = reversalsOf(order, spring.stagger ?? 0.035);
  const prefix = prefixStates(order);
  return {
    depth: [...uniformStates(uniform), ...springStates(order, { ...spring, stride, reversals }), ...prefix],
    frames: [...springStates(order, { ...spring, reversals }), ...prefix],
    apart: true,
  };
}

function settle(R, P = R.P, { states = explodeStates(R.order, R.spring).depth, skip = sameRun, ...options } = {}) {
  const items = R.items.slice();
  const overlaps = overlapsOf(items, P, { states, skip, ...options });
  const solved = orderKeys(items, overlaps);
  items.forEach((item, index) => (item.key = solved.keys[index]));
  R.settled = { items, overlaps, solved, states };
  return R.settled;
}

const worstOf = (lists) => [...lists.flat().reduce((all, c) => (all.has(`${c.tube}|${c.other}`) && all.get(`${c.tube}|${c.other}`).clearance <= c.clearance ? all : all.set(`${c.tube}|${c.other}`, c)), new Map()).values()].sort((x, y) => x.clearance - y.clearance);

function audit(R, P = R.P, { allow = [], crowd = [], cover = [], ground = R.ground, frames = explodeStates(R.order, R.spring).frames, apart = R.order.length > 0 } = {}) {
  const { items, overlaps, solved } = R.settled ?? settle(R, P);
  const mounts = mountsOf(R.tubes, R.solids);
  const links = linksOf(R.tubes, mounts);
  return {
    clearance: clearances(R.tubes, R.solids, { mounts }),
    apart: apart ? [...clearances(R.tubes, R.solids, { state: 1, mounts, only: "through" }), ...solidClearances(R.solids, { state: 1 })] : [],
    flight: worstOf(frames.map((state) => [...clearances(R.tubes, R.solids, { state, mounts, only: "through" }), ...solidClearances(R.solids, { state })])),
    crowding: (apart ? [0, 1] : [0]).flatMap((state) => crowding(R.routes, P, { links, items, allow: crowd, state, rods: slenderOf(R.solids) })),
    cover: coverage(items, P, { allow: cover }),
    terminals: terminals(R.tubes, R.solids, { mounts }),
    loose: looseEnds(R.tubes, R.solids, { state: 1 }),
    folds: folds(R.routes, P, { items }),
    self: selfOverlaps(items, P),
    wobble: wobble(R.solids),
    seats: seats(R.solids),
    supports: supports(R.solids, R.tubes, { ground }),
    depth: depthOrder(items, P, { overlaps, solved, allow }),
  };
}


return {annularSector,audit,ball,body,boundsOf,box,cameraBasis,clearances,coverage,crowding,cylinder,depthOrder,disc,explodeStates,extruded,failures,folds,footprintOf,grounded,keyAt,labelOf,lathe,linksOf,looseEnds,markupBox,mountsOf,moved,offsetOf,orderKeys,orientedBox,overlapsOf,prefixStates,prism,recorder,report,reversalsOf,ring,sameRun,sdf,seats,selfOverlaps,settle,shareOf,slab,slenderOf,slide,solid,solidClearances,springStates,supports,terminals,traced,tube,uniformStates,wobble};
})(void 0);
modules["turn"] = (function(window){
const T3_ROOT = Math.sqrt(1.6);
const T3_TAU = Math.PI * 2;
const T3_RAD = Math.PI / 180;
const T3_LB = [0, 0.2, 0.42, 0.62];
const T3_EB = [0.25, 0.5, 0.75];
const T3_SOFT = 0.035;
const T3_LEVELS = 32;
const T3_Q = 64;
const t3State = { detail: 1, exact: false };

function t3Num(v) {
  if (t3State.exact) return String(Math.round(v * 1e6) / 1e6);
  let t = Math.round(v * 100);
  if (t === 0) return "0";
  let sign = "";
  if (t < 0) {
    sign = "-";
    t = -t;
  }
  const whole = Math.floor(t / 100);
  const part = t - whole * 100;
  if (part === 0) return sign + whole;
  if (part < 10) return sign + whole + ".0" + part;
  return sign + whole + "." + (part % 10 === 0 ? part / 10 : part);
}

function t3Fix(v, scale) {
  const t = Math.round(v * scale) / scale;
  return t === 0 ? "0" : String(t);
}

function t3Path(buf, count, closed) {
  if (count < 2) return "";
  let s = "M" + t3Num(buf[0]) + " " + t3Num(buf[1]);
  for (let i = 1; i < count; i++) s += "L" + t3Num(buf[2 * i]) + " " + t3Num(buf[2 * i + 1]);
  return closed ? s + "Z" : s;
}

const t3Step = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function t3Level(score, bands) {
  let u = 0;
  for (let i = 0; i < bands.length; i++) u += t3Step(bands[i] - T3_SOFT, bands[i] + T3_SOFT, score);
  return Math.round(u * T3_Q);
}

function t3Grow(f, name, size, Kind) {
  if (!f[name] || f[name].length < size) f[name] = new Kind(Math.max(size, f[name] ? f[name].length * 2 : 16));
  return f[name];
}

function t3Box(buf, count, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = buf[2 * i];
    const y = buf[2 * i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  box[0] = x0;
  box[1] = y0;
  box[2] = x1;
  box[3] = y1;
}

function t3Unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function t3Rot(axis, degrees) {
  const [x, y, z] = t3Unit(axis);
  const c = Math.cos(degrees * T3_RAD);
  const s = Math.sin(degrees * T3_RAD);
  const C = 1 - c;
  return new Float64Array([c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]);
}

function t3Mul(A, B) {
  const out = new Float64Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return out;
}

const t3Apply = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

const T3_EYE = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function t3Camera(P, pose) {
  const a = (P.azimuth ?? 45) * T3_RAD;
  const e = (P.elevation ?? 30) * T3_RAD;
  const k = P.scale * T3_ROOT;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const se = Math.sin(e);
  const ce = Math.cos(e);
  const cam = { m: new Float64Array(6), ox: 0, oy: 0, V: [0, 0, 0], L: [0, 0, 0], k, turn: 0, R: T3_EYE, t: [0, 0, 0], lx: 0, ly: 1, sa, ca, se, ce, origin: P.origin };
  const lw = Math.hypot(sa, ca, 1.2);
  if (pose && pose.R && !(pose.turn !== undefined && pose.root)) {
    const R = pose.R;
    const t = pose.t ?? [0, 0, 0];
    const r0 = [sa * k, -ca * k, 0];
    const r1 = [ca * se * k, sa * se * k, -ce * k];
    for (let c = 0; c < 3; c++) {
      cam.m[c] = r0[0] * R[c] + r0[1] * R[3 + c] + r0[2] * R[6 + c];
      cam.m[3 + c] = r1[0] * R[c] + r1[1] * R[3 + c] + r1[2] * R[6 + c];
    }
    cam.ox = P.origin[0] + r0[0] * t[0] + r0[1] * t[1] + r0[2] * t[2];
    cam.oy = P.origin[1] + r1[0] * t[0] + r1[1] * t[1] + r1[2] * t[2];
    const V = [ca * ce, sa * ce, se];
    const L = [-sa / lw, ca / lw, 1.2 / lw];
    for (let c = 0; c < 3; c++) {
      cam.V[c] = R[c] * V[0] + R[3 + c] * V[1] + R[6 + c] * V[2];
      cam.L[c] = R[c] * L[0] + R[3 + c] * L[1] + R[6 + c] * L[2];
    }
    cam.R = R;
    cam.t = t;
  } else {
    const turn = pose ? pose.turn ?? 0 : 0;
    const pivot = pose && pose.pivot ? pose.pivot : [0, 0];
    const b = a - turn * T3_RAD;
    const sb = Math.sin(b);
    const cb = Math.cos(b);
    cam.m[0] = sb * k;
    cam.m[1] = -cb * k;
    cam.m[2] = 0;
    cam.m[3] = cb * se * k;
    cam.m[4] = sb * se * k;
    cam.m[5] = -ce * k;
    cam.ox = P.origin[0] + (pivot[0] * sa - pivot[1] * ca) * k;
    cam.oy = P.origin[1] + (pivot[0] * ca + pivot[1] * sa) * se * k;
    cam.V = [cb * ce, sb * ce, se];
    cam.L = [-sb / lw, cb / lw, 1.2 / lw];
    cam.turn = turn;
    const c = Math.cos(turn * T3_RAD);
    const s = Math.sin(turn * T3_RAD);
    cam.R = new Float64Array([c, -s, 0, s, c, 0, 0, 0, 1]);
    cam.t = [pivot[0], pivot[1], 0];
  }
  const lh = Math.hypot(cam.L[0], cam.L[1]) || 1;
  cam.lx = cam.L[0] / lh;
  cam.ly = cam.L[1] / lh;
  return cam;
}

function t3Quat(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const x = q[0] / l;
  const y = q[1] / l;
  const z = q[2] / l;
  const w = q[3] / l;
  return new Float64Array([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]);
}

function t3FreeRot(v) {
  if (v.R) return v.R instanceof Float64Array ? v.R : Float64Array.from(v.R);
  if (v.q) return t3Quat(v.q);
  if (v.axis) return t3Rot(v.axis, v.angle ?? 0);
  return T3_EYE;
}

function t3Poses(groups, values) {
  const get = (name) => (values instanceof Map ? values.get(name) : values ? values[name] : undefined) ?? 0;
  const list = [];
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index];
    const v = get(g.name);
    let parent = g.parent === undefined || g.parent === null || g.parent < 0 ? null : list[g.parent];
    let po = parent ? groups[g.parent].origin : [0, 0, 0];
    let R = T3_EYE;
    let t = [g.origin[0] - po[0], g.origin[1] - po[1], g.origin[2] - po[2]];
    if (g.kind === "turn") R = t3Rot([0, 0, 1], v);
    else if (g.kind === "hinge") R = t3Rot(g.axis, v);
    else if (g.kind === "slide") {
      const d = t3Unit(g.direction);
      t[0] += d[0] * v;
      t[1] += d[1] * v;
      t[2] += d[2] * v;
    } else if (g.kind === "free" && v && typeof v === "object") {
      R = t3FreeRot(v);
      if (v.world) {
        parent = null;
        po = [0, 0, 0];
        t = [g.origin[0], g.origin[1], g.origin[2]];
      }
      if (v.t) {
        t[0] += v.t[0];
        t[1] += v.t[1];
        t[2] += v.t[2];
      }
    }
    if (!parent) {
      const pose = { R, t, value: v };
      if (g.kind === "turn") Object.assign(pose, { turn: v, pivot: [g.origin[0], g.origin[1]], root: true });
      list.push(pose);
      continue;
    }
    const tw = t3Apply(parent.R, t);
    list.push({ R: t3Mul(parent.R, R), t: [tw[0] + parent.t[0], tw[1] + parent.t[1], tw[2] + parent.t[2]], value: v });
  }
  return list;
}

function t3PosesMap(groups, values) {
  const list = t3Poses(groups, values);
  return new Map(groups.map((g, index) => [g.name, list[index]]));
}

function t3Roles(part) {
  const roles = [];
  const spec = part.spec;
  const details = part.details ?? {};
  const add = (name, type, extra = {}) => roles.push({ name, type, ...extra });
  const tone = part.tone ?? "hi";
  const crease = part.crease ?? "faint";
  const fadedSlots = (prefix, count, cls, lineTone) => {
    for (let j = 0; j < count; j++) add(`${prefix}${j}`, "slot", { cls, tone: lineTone });
  };
  const planes = () => (part.planes ?? []).forEach((_, j) => add(`plane${j}`, "plane"));
  const dots = () => (part.dots ?? []).forEach((dot, j) => add(`c${j}`, "dot", { tone: dot.tone ?? "mid", size: dot.size ?? 0.5 }));
  const sheets = (top) => {
    for (let t = 0; t < 4; t++) add(`s${t}`, "path", { cls: "iso-shade", shade: t });
    if (top) add("s4", "path", { cls: "iso-top" });
  };
  const inner = () => {
    if ((details.seams && details.seams.length) || (details.ribs && details.ribs.seams)) add("inner", "path", { cls: "iso-line", tone: "faint" });
  };
  const ribs = () => {
    if (details.ribs) fadedSlots("r", spec.slots?.ribs ?? 6, "iso-line", details.ribs.tone ?? "lo");
  };
  if (part.kind === "prism") {
    add("fill", "path", { cls: "iso-fill" });
    const faces = spec.ring.length / 2 + (spec.up ? 0 : 2);
    for (let j = 0; j < faces; j++) add(`f${j}`, "face");
    if (spec.up) add("top", "xform", { cls: "iso-top" });
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    if (spec.bevel && crease !== "none") fadedSlots("v", spec.slots?.bevel ?? 6, "iso-line iso-bevel", crease);
    if (details.seams && details.seams.length) add("inner", "path", { cls: "iso-line", tone: "faint" });
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "round" || part.kind === "lathe") {
    add("fill", "path", { cls: "iso-fill" });
    sheets(true);
    const ends = part.kind === "round" ? spec.ends : spec.caps.map((cap) => (cap ? "flat" : "open"));
    ends.forEach((end, j) => end === "flat" && add(`k${j}`, "face"));
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    inner();
    ribs();
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "ball") {
    add("fill", "path", { cls: "iso-fill" });
    sheets(false);
    spec.flats.forEach((_, j) => add(`f${j}`, "face"));
    if (crease !== "none") add("crease", "path", { cls: "iso-line iso-crease", tone: crease });
    planes();
    add("edge", "path", { cls: "iso-line iso-edge", tone });
    dots();
  } else if (part.kind === "tube") {
    add("body", "path", { cls: "tb-body" });
    if (spec.wide) {
      add("shine", "path", { cls: "tb-shine" });
      add("shade", "path", { cls: "tb-shade" });
    }
    if (spec.rings) fadedSlots("r", spec.slots?.ribs ?? 6, "tb-ring", spec.rings.tone ?? "lo");
    add("edges", "path", { cls: "iso-line tb-edge", tone });
  } else if (part.kind === "fixed") {
    add("move", "self");
    ribs();
    planes();
    dots();
  }
  return roles;
}

function t3Planes(list) {
  return (list ?? []).map((plane) => ({ o: plane.o, u: plane.u, v: plane.v, n: plane.n, fade: plane.fade ?? [0.04, 0.3], billboard: Boolean(plane.billboard) }));
}

function t3Dots(list) {
  return (list ?? []).map((dot) => ({ p: dot.p, n: dot.n ?? null, size: dot.size ?? 0.5, fade: dot.fade ?? [0.04, 0.42] }));
}

function t3PreparePrism(run, part) {
  const spec = part.spec;
  const n = spec.ring.length / 2;
  run.n = n;
  run.up = Boolean(spec.up);
  const ring = Float64Array.from(spec.ring);
  run.ring = ring;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = ring[2 * j] - ring[2 * i];
    const dy = ring[2 * j + 1] - ring[2 * i + 1];
    const l = Math.hypot(dx, dy) || 1;
    nx[i] = dy / l;
    ny[i] = -dx / l;
  }
  run.nx = nx;
  run.ny = ny;
  const F = spec.up ? { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] } : spec.F;
  run.F = F;
  run.s0 = spec.up ? spec.z0 : spec.s0;
  run.s1 = spec.up ? spec.z1 : spec.s1;
  const lo = new Float64Array(3 * n);
  const hi = new Float64Array(3 * n);
  const N3 = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) {
    const x = ring[2 * i];
    const y = ring[2 * i + 1];
    for (let c = 0; c < 3; c++) {
      const base = F.o[c] + F.u[c] * x + F.v[c] * y;
      lo[3 * i + c] = base + F.a[c] * run.s0;
      hi[3 * i + c] = base + F.a[c] * run.s1;
      N3[3 * i + c] = F.u[c] * nx[i] + F.v[c] * ny[i];
    }
  }
  run.lo = lo;
  run.hi = hi;
  run.N3 = N3;
  run.sharp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n;
    run.sharp[i] = nx[p] * nx[i] + ny[p] * ny[i] < Math.cos(0.35) ? 1 : 0;
  }
  if (spec.bevel) {
    const inset = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const mx = nx[p] + nx[i];
      const my = ny[p] + ny[i];
      const l = Math.hypot(mx, my) || 1;
      inset[2 * i] = ring[2 * i] - (mx / l) * spec.bevel;
      inset[2 * i + 1] = ring[2 * i + 1] - (my / l) * spec.bevel;
    }
    run.inset = inset;
  }
  run.seams = part.details && part.details.seams ? part.details.seams.slice() : null;
  run.cut = spec.cuts && spec.cuts.length ? spec.cuts : null;
}

function t3Axes(run, part) {
  if (run.kind === "ball") return run.flats.map((flat) => flat.n);
  if (run.kind === "tube") return run.tips.slice();
  if (run.kind === "prism") {
    const out = [run.F.a];
    for (let i = 0; i < run.n; i++) {
      const n = [run.N3[3 * i], run.N3[3 * i + 1], run.N3[3 * i + 2]];
      if (out.every((m) => Math.abs(m[0] * n[0] + m[1] * n[1] + m[2] * n[2]) < 0.9995)) out.push(n);
    }
    return out;
  }
  if (run.F) return [run.F.a];
  if (part.spec && part.spec.F) return [part.spec.F.a];
  return [];
}

function t3Cloud(run, part) {
  const out = [];
  const ring = (F, s, r, count) => {
    for (let j = 0; j < count; j++) {
      const c = Math.cos((j / count) * T3_TAU);
      const n = Math.sin((j / count) * T3_TAU);
      out.push(F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]), F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]), F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]));
    }
  };
  if (run.kind === "prism") {
    for (let i = 0; i < 3 * run.n; i++) out.push(run.lo[i]);
    for (let i = 0; i < 3 * run.n; i++) out.push(run.hi[i]);
  } else if (run.kind === "round") {
    ring(run.F, run.s0, run.r0, 24);
    ring(run.F, run.s1, run.r1, 24);
    for (const [end, s, r] of [[0, run.s0, run.r0], [1, run.s1, run.r1]]) {
      if (run.ends[end] !== "dome") continue;
      const sign = end ? 1 : -1;
      for (const b of [0.5, 1.0, 1.35]) ring(run.F, s + sign * r * Math.sin(b), r * Math.cos(b), 6);
      out.push(run.F.o[0] + run.F.a[0] * (s + sign * r), run.F.o[1] + run.F.a[1] * (s + sign * r), run.F.o[2] + run.F.a[2] * (s + sign * r));
    }
  } else if (run.kind === "ball") {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 64; i++) {
      const y = 1 - (2 * (i + 0.5)) / 64;
      const rad = Math.sqrt(1 - y * y);
      const w = [Math.cos(golden * i) * rad, Math.sin(golden * i) * rad, y];
      const p = [run.c[0] + run.r * w[0], run.c[1] + run.r * w[1], run.c[2] + run.r * w[2]];
      let inside = true;
      for (const flat of run.flats) if ((p[0] - run.c[0]) * flat.n[0] + (p[1] - run.c[1]) * flat.n[1] + (p[2] - run.c[2]) * flat.n[2] > flat.d + 1e-9) inside = false;
      if (inside) out.push(p[0], p[1], p[2]);
    }
    for (const flat of run.flats)
      for (let j = 0; j < 12; j++) {
        const c = Math.cos((j / 12) * T3_TAU) * flat.rho;
        const n = Math.sin((j / 12) * T3_TAU) * flat.rho;
        out.push(run.c[0] + flat.n[0] * flat.d + c * flat.u[0] + n * flat.v[0], run.c[1] + flat.n[1] * flat.d + c * flat.u[1] + n * flat.v[1], run.c[2] + flat.n[2] * flat.d + c * flat.u[2] + n * flat.v[2]);
      }
  } else if (run.kind === "lathe") {
    const lv = run.levels;
    const step = Math.max(4, Math.floor(lv.length / 4 / 8)) * 4;
    for (let i = 0; i < lv.length; i += step) ring(run.F, lv[i], lv[i + 1], 8);
    ring(run.F, lv[lv.length - 4], lv[lv.length - 3], 8);
  } else if (run.kind === "tube") {
    const b = run.body;
    const stride = Math.max(1, Math.floor(b.count / 8));
    for (let i = 0; i < b.count; i += stride) {
      const T = t3Unit([b.D3[3 * i], b.D3[3 * i + 1], b.D3[3 * i + 2]]);
      const [u, v] = t3Basis(T);
      ring({ o: [b.P3[3 * i], b.P3[3 * i + 1], b.P3[3 * i + 2]], a: T, u, v }, 0, run.r, 8);
    }
  } else if (part.cloud) for (const v of part.cloud) out.push(v);
  return Float64Array.from(out);
}

function t3Unpack(value, grouped) {
  if (!value) return new Float64Array(0);
  if (typeof value !== "string") return Float64Array.from(value);
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const size = grouped ? 10 : 8;
  const stride = grouped ? 6 : 5;
  const count = bytes.length / size;
  const out = new Float64Array(count * stride);
  for (let e = 0; e < count; e++) {
    let o = e * size;
    const at = e * stride;
    out[at] = view.getUint16(o);
    out[at + 1] = view.getUint16(o + 2);
    o += 4;
    if (grouped) {
      out[at + 2] = view.getUint16(o) - 1;
      o += 2;
    }
    let x = (view.getUint16(o) / 65535) * 2 - 1;
    let y = (view.getUint16(o + 2) / 65535) * 2 - 1;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
      const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
      const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
      x = ox;
      y = oy;
    }
    const l = Math.hypot(x, y, z) || 1;
    out[at + stride - 3] = x / l;
    out[at + stride - 2] = y / l;
    out[at + stride - 1] = z / l;
  }
  return out;
}

function t3Prepare(data, { unit = 1 } = {}) {
  const P = data.P;
  const runs = data.parts.map((part, index) => {
    const run = { index, name: part.name, kind: part.kind, group: part.group ?? -1, layer: part.layer, part, roles: t3Roles(part), planes: t3Planes(part.planes), dots: t3Dots(part.dots), unit };
    run.role = Object.fromEntries(run.roles.map((role, j) => [role.name, j]));
    if (part.kind === "prism") t3PreparePrism(run, part);
    else if (part.kind === "round") t3PrepareRound(run, part, P, unit);
    else if (part.kind === "ball") t3PrepareBall(run, part, P, unit);
    else if (part.kind === "lathe") t3PrepareLathe(run, part, P, unit);
    else if (part.kind === "tube") t3PrepareTube(run, part, data);
    else if (part.kind === "fixed") {
      run.anchor = part.spec.anchor;
      run.home = part.spec.home;
      run.box0 = part.spec.box;
      run.hull0 = Float64Array.from(part.spec.hull);
      run.F = part.spec.F ?? null;
      run.ribs = part.details && part.details.ribs ? part.details.ribs : null;
    }
    run.slots = part.spec.slots ?? {};
    run.cloud = t3Cloud(run, part);
    run.axes = t3Axes(run, part);
    const cn = run.cloud.length / 3;
    run.centroid = [0, 0, 0];
    for (let i = 0; i < cn; i++) for (let c = 0; c < 3; c++) run.centroid[c] += run.cloud[3 * i + c] / Math.max(1, cn);
    return run;
  });
  const layers = data.layers.map((layer, index) => {
    const parts = Int32Array.from(layer.parts);
    const local = new Map();
    parts.forEach((global, at) => local.set(global, at));
    const planar = t3Unpack(data.planes && data.planes[layer.name], false);
    const dynamic = Int32Array.from((data.dynamic && data.dynamic[layer.name]) ?? []);
    const free = Int32Array.from((data.free && data.free[layer.name]) ?? []);
    const framed = t3Unpack(data.framed && data.framed[layer.name], true);
    const groupPairs = [];
    const raw = (data.groupPairs && data.groupPairs[layer.name]) ?? [];
    const members = new Map();
    for (const global of parts) {
      const g = runs[global].group;
      if (!members.has(g)) members.set(g, []);
      members.get(g).push(global);
    }
    for (let p = 0; p < raw.length; p += 6) groupPairs.push({ a: Int32Array.from(members.get(raw[p]) ?? []), b: Int32Array.from(members.get(raw[p + 1]) ?? []), frame: raw[p + 2], n: [raw[p + 3], raw[p + 4], raw[p + 5]], boxA: new Float64Array(4), boxB: new Float64Array(4) });
    const looseAt = new Uint8Array(parts.length);
    for (const global of free) looseAt[local.get(global)] = 1;
    return { index, name: layer.name, parts, local, rest: Int32Array.from(layer.rest ?? layer.parts), planar, framed, groupPairs, dynamic, free, looseAt, warm: new Map() };
  });
  return { P, data, unit, groups: data.groups, runs, layers };
}

function t3Frame(run) {
  const count = run.roles.length;
  return { d: new Array(count).fill(""), q: new Int32Array(count), w: new Float64Array(count).fill(-1), t: new Array(count).fill(""), o: new Float64Array(count).fill(1), box: new Float64Array(4), hull: new Float64Array(64), hullN: 0, cx: new Float64Array(count), cy: new Float64Array(count), quads: null, quadN: 0 };
}

const t3Buf = { a: new Float64Array(1024), b: new Float64Array(1024), c: new Float64Array(1024) };

function t3Scratch(name, size) {
  if (t3Buf[name].length < size) t3Buf[name] = new Float64Array(size * 2);
  return t3Buf[name];
}

function t3SetHull(f, buf, count) {
  const hull = t3Grow(f, "hull", 2 * count, Float64Array);
  for (let i = 0; i < 2 * count; i++) hull[i] = buf[i];
  f.hullN = count;
}

function t3Faded(f, run, prefix, lines, count) {
  if (!f.fade) f.fade = {};
  const detail = t3State.detail;
  if (detail < 1) for (let i = 0; i < count; i++) lines.alpha[i] *= detail;
  if (detail < 0.01) count = 0;
  f.fade[prefix] = { key: lines.key.slice(0, count), alpha: lines.alpha.slice(0, count) };
  const slots = run.slots[prefix === "v" ? "bevel" : "ribs"] ?? 6;
  const levels = run._levels ?? (run._levels = new Array(T3_LEVELS + 1));
  for (let l = 0; l <= T3_LEVELS; l++) levels[l] = "";
  for (let i = 0; i < count; i++) {
    const alpha = lines.alpha[i];
    const level = Math.min(T3_LEVELS, Math.round(alpha * T3_LEVELS));
    if (level <= 0) continue;
    levels[level] += lines.d[i];
  }
  const present = [];
  for (let l = T3_LEVELS; l >= 1; l--) if (levels[l]) present.push([l, levels[l]]);
  while (present.length > slots) {
    let best = 1;
    let gap = Infinity;
    for (let i = 1; i < present.length; i++) {
      const g = present[i - 1][0] - present[i][0];
      if (g < gap) {
        gap = g;
        best = i;
      }
    }
    const [a, da] = present[best - 1];
    const [b, db] = present[best];
    present.splice(best - 1, 2, [(a + b) / 2, da + db]);
  }
  for (let j = 0; j < slots; j++) {
    const role = run.role[`${prefix}${j}`];
    if (role === undefined) continue;
    if (j < present.length) {
      f.d[role] = present[j][1];
      f.o[role] = present[j][0] / T3_LEVELS;
    } else {
      f.d[role] = "";
      f.o[role] = 0;
    }
  }
  return present.length;
}

const t3Lines = { d: [], alpha: [], key: [] };
const t3None = { d: [], alpha: [], key: [] };

function t3EmitPrism(run, cam, f) {
  const n = run.n;
  const m = cam.m;
  const ox = cam.ox;
  const oy = cam.oy;
  const V = cam.V;
  const L = cam.L;
  const lo = run.lo;
  const hi = run.hi;
  const N3 = run.N3;
  const bot = t3Scratch("a", 2 * n);
  const top = t3Scratch("b", 2 * n);
  for (let i = 0; i < n; i++) {
    const a = 3 * i;
    bot[2 * i] = ox + m[0] * lo[a] + m[1] * lo[a + 1] + m[2] * lo[a + 2];
    bot[2 * i + 1] = oy + m[3] * lo[a] + m[4] * lo[a + 1] + m[5] * lo[a + 2];
    top[2 * i] = ox + m[0] * hi[a] + m[1] * hi[a + 1] + m[2] * hi[a + 2];
    top[2 * i + 1] = oy + m[3] * hi[a] + m[4] * hi[a + 1] + m[5] * hi[a + 2];
  }
  const F = run.F;
  const aV = F.a[0] * V[0] + F.a[1] * V[1] + F.a[2] * V[2];
  const near = aV >= 0 ? top : bot;
  const far = aV >= 0 ? bot : top;
  const facing = run._facing ?? (run._facing = new Float64Array(n));
  for (let i = 0; i < n; i++) facing[i] = N3[3 * i] * V[0] + N3[3 * i + 1] * V[1] + N3[3 * i + 2] * V[2];
  const on = (i) => facing[((i % n) + n) % n] > 1e-9;
  let i0 = -1;
  for (let i = 0; i < n; i++)
    if (on(i) && !on(i - 1)) {
      i0 = i;
      break;
    }
  const sil = t3Scratch("c", 4 * n + 8);
  const silAt = run._silAt ?? (run._silAt = new Int32Array(2 * n + 4));
  let count = 0;
  let i1 = i0;
  const nearSet = aV >= 0 ? hi : lo;
  const farSet = aV >= 0 ? lo : hi;
  if (i0 < 0) {
    for (let i = 0; i < n; i++) {
      sil[2 * count] = near[2 * i];
      sil[2 * count + 1] = near[2 * i + 1];
      silAt[count] = i;
      count++;
    }
  } else {
    while (on(i1)) i1++;
    for (let j = i0; j <= i1; j++) {
      const i = j % n;
      sil[2 * count] = far[2 * i];
      sil[2 * count + 1] = far[2 * i + 1];
      silAt[count] = -1 - i;
      count++;
    }
    for (let j = i1; j <= i0 + n; j++) {
      const i = j % n;
      sil[2 * count] = near[2 * i];
      sil[2 * count + 1] = near[2 * i + 1];
      silAt[count] = i;
      count++;
    }
    if (count > 2 && Math.abs(sil[0] - sil[2 * count - 2]) < 1e-9 && Math.abs(sil[1] - sil[2 * count - 1]) < 1e-9) count--;
  }
  const outline = t3Path(sil, count, true);
  f.d[run.role.fill] = outline;
  if (run.cut) {
    const inPlane = (index) => {
      const at = silAt[index];
      const set = at < 0 ? farSet : nearSet;
      const v = at < 0 ? -1 - at : at;
      return run.cut.some((cut) => Math.abs(cut.n[0] * set[3 * v] + cut.n[1] * set[3 * v + 1] + cut.n[2] * set[3 * v + 2] - cut.d) < 1e-3);
    };
    const flags = new Uint8Array(count);
    const onSame = (i, j) => {
      const at = (index) => {
        const a = silAt[index];
        const set = a < 0 ? farSet : nearSet;
        const v = a < 0 ? -1 - a : a;
        return [set[3 * v], set[3 * v + 1], set[3 * v + 2]];
      };
      const p = at(i);
      const q = at(j);
      return run.cut.some((cut) => Math.abs(cut.n[0] * p[0] + cut.n[1] * p[1] + cut.n[2] * p[2] - cut.d) < 1e-3 && Math.abs(cut.n[0] * q[0] + cut.n[1] * q[1] + cut.n[2] * q[2] - cut.d) < 1e-3);
    };
    for (let j = 0; j < count; j++) flags[j] = inPlane(j) && onSame(j, (j + 1) % count) ? 1 : 0;
    f.d[run.role.edge] = t3Broken(sil, count, flags);
  } else f.d[run.role.edge] = outline;
  t3Box(sil, count, f.box);
  t3SetHull(f, sil, count);
  const quad = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    const role = run.role[`f${i}`];
    if (!(facing[i] > 1e-6)) {
      f.d[role] = "";
      continue;
    }
    const j = (i + 1) % n;
    quad[0] = top[2 * i];
    quad[1] = top[2 * i + 1];
    quad[2] = top[2 * j];
    quad[3] = top[2 * j + 1];
    quad[4] = bot[2 * j];
    quad[5] = bot[2 * j + 1];
    quad[6] = bot[2 * i];
    quad[7] = bot[2 * i + 1];
    f.d[role] = t3Path(quad, 4, true);
    let score;
    if (run.up) {
      score = (run.nx[i] * cam.lx + run.ny[i] * cam.ly + 1) / 2;
      f.q[role] = t3Level(score, T3_EB);
    } else {
      score = N3[3 * i] * L[0] + N3[3 * i + 1] * L[1] + N3[3 * i + 2] * L[2];
      f.q[role] = t3Level(score, T3_LB);
    }
    const e1 = Math.hypot(quad[2] - quad[0], quad[3] - quad[1]);
    const e2 = Math.hypot(quad[6] - quad[0], quad[7] - quad[1]);
    const area = Math.abs((quad[2] - quad[0]) * (quad[7] - quad[1]) - (quad[3] - quad[1]) * (quad[6] - quad[0]));
    const wide = area / (Math.max(e1, e2) || 1);
    f.w[role] = wide < 0.4 ? Math.round(wide * 100) / 100 : -1;
  }
  if (run.up) {
    const z = run.s1;
    f.t[run.role.top] = `matrix(${t3Fix(m[0], 1e5)} ${t3Fix(m[3], 1e5)} ${t3Fix(m[1], 1e5)} ${t3Fix(m[4], 1e5)} ${t3Fix(ox + m[2] * z, 100)} ${t3Fix(oy + m[5] * z, 100)})`;
  } else {
    for (let side = 0; side < 2; side++) {
      const role = run.role[`f${n + side}`];
      const sign = side ? 1 : -1;
      const face = sign * aV;
      if (!(face > 1e-6)) {
        f.d[role] = "";
        continue;
      }
      const ring = side ? top : bot;
      f.d[role] = t3Path(ring, n, true);
      f.q[role] = t3Level(sign * (F.a[0] * L[0] + F.a[1] * L[1] + F.a[2] * L[2]), T3_LB);
      let minor = Infinity;
      let x0 = Infinity;
      let x1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ex = ring[2 * j] - ring[2 * i];
        const ey = ring[2 * j + 1] - ring[2 * i + 1];
        const l = Math.hypot(ex, ey);
        if (l < 1e-9) continue;
        let lo2 = Infinity;
        let hi2 = -Infinity;
        for (let q = 0; q < n; q++) {
          const v = ((ring[2 * q] - ring[2 * i]) * ey - (ring[2 * q + 1] - ring[2 * i + 1]) * ex) / l;
          if (v < lo2) lo2 = v;
          if (v > hi2) hi2 = v;
        }
        minor = Math.min(minor, hi2 - lo2);
        x0 = Math.min(x0, lo2);
        x1 = Math.max(x1, hi2);
      }
      f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    }
  }
  if (run.role.crease !== undefined) {
    let crease = "";
    if (run.up) {
      if (i0 >= 0) {
        const buf = t3Scratch("a", 0);
        let c = 0;
        const rim = t3Scratch("c", 2 * n + 4);
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          rim[2 * c] = top[2 * i];
          rim[2 * c + 1] = top[2 * i + 1];
          c++;
        }
        crease = t3Path(rim, c, false);
        void buf;
      }
    } else {
      const capOn = [-aV > 1e-6, aV > 1e-6];
      const seg = new Float64Array(4);
      for (let i = 0; i < n; i++) {
        const p = (i - 1 + n) % n;
        if (run.sharp[i] && facing[i] > 1e-6 && facing[p] > 1e-6) {
          seg[0] = bot[2 * i];
          seg[1] = bot[2 * i + 1];
          seg[2] = top[2 * i];
          seg[3] = top[2 * i + 1];
          crease += t3Path(seg, 2, false);
        }
      }
      for (let side = 0; side < 2; side++) {
        if (!capOn[side] || i0 < 0) continue;
        const ring = side ? top : bot;
        const rim = t3Scratch("c", 2 * n + 4);
        let c = 0;
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          rim[2 * c] = ring[2 * i];
          rim[2 * c + 1] = ring[2 * i + 1];
          c++;
        }
        crease += t3Path(rim, c, false);
      }
    }
    f.d[run.role.crease] = crease;
  }
  if (run.inset && run.role.v0 !== undefined && t3State.detail < 0.01) f.levels = t3Faded(f, run, "v", t3None, 0);
  else if (run.inset && run.role.v0 !== undefined) {
    const lines = t3Lines;
    lines.d.length = 0;
    lines.alpha.length = 0;
  lines.key.length = 0;
    lines.key.length = 0;
    const capSide = aV >= 0 ? 1 : 0;
    const s = capSide ? run.s1 : run.s0;
    const capAlpha = run.up ? 1 : t3Step(0.02, 0.2, Math.abs(aV));
    const ins = t3Scratch("c", 2 * n);
    for (let i = 0; i < n; i++) {
      const x = run.inset[2 * i];
      const y = run.inset[2 * i + 1];
      const px = F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y;
      const py = F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y;
      const pz = F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y;
      ins[2 * i] = ox + m[0] * px + m[1] * py + m[2] * pz;
      ins[2 * i + 1] = oy + m[3] * px + m[4] * py + m[5] * pz;
    }
    const rim = capSide ? top : bot;
    const seg = new Float64Array(4);
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const ai = capAlpha * t3Step(0, 0.14, facing[i]);
      const ap = capAlpha * t3Step(0, 0.14, facing[p]);
      if (ai > 0.01) {
        const j = (i + 1) % n;
        seg[0] = ins[2 * i];
        seg[1] = ins[2 * i + 1];
        seg[2] = ins[2 * j];
        seg[3] = ins[2 * j + 1];
        lines.d.push(t3Path(seg, 2, false));
        lines.alpha.push(ai);
        lines.key.push(2 * i);
      }
      const corner = ai * (1 - ap) + ap * (1 - ai);
      if (corner > 0.01) {
        seg[0] = ins[2 * i];
        seg[1] = ins[2 * i + 1];
        seg[2] = rim[2 * i];
        seg[3] = rim[2 * i + 1];
        lines.d.push(t3Path(seg, 2, false));
        lines.alpha.push(corner);
        lines.key.push(2 * i + 1);
      }
    }
    f.levels = t3Faded(f, run, "v", lines, lines.d.length);
  }
  if (run.seams && run.role.inner !== undefined) {
    let inner = "";
    if (i0 >= 0) {
      const rim = t3Scratch("c", 2 * n + 4);
      for (const s of run.seams) {
        let c = 0;
        for (let j = i0; j <= i1; j++) {
          const i = j % n;
          const x = run.ring[2 * i];
          const y = run.ring[2 * i + 1];
          const px = F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y;
          const py = F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y;
          const pz = F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y;
          rim[2 * c] = ox + m[0] * px + m[1] * py + m[2] * pz;
          rim[2 * c + 1] = oy + m[3] * px + m[4] * py + m[5] * pz;
          c++;
        }
        inner += t3Path(rim, c, false);
      }
    }
    f.d[run.role.inner] = inner;
  }
}

function t3Broken(buf, count, skip) {
  let start = -1;
  for (let j = 0; j < count; j++)
    if (skip[(j - 1 + count) % count] && !skip[j]) {
      start = j;
      break;
    }
  if (start < 0) return skip[0] ? "" : t3Path(buf, count, true);
  let out = "";
  let run = [];
  for (let step = 0; step < count; step++) {
    const j = (start + step) % count;
    if (skip[j]) {
      if (run.length) {
        run.push((j + 0) % count);
        out += t3PathOf(run.map((i) => [buf[2 * i], buf[2 * i + 1]]), false);
        run = [];
      }
      continue;
    }
    run.push(j);
  }
  if (run.length) {
    run.push((start + count) % count);
    out += t3PathOf(run.map((i) => [buf[2 * i], buf[2 * i + 1]]), false);
  }
  return out;
}

function t3EmitPlanes(run, cam, f, sx = 0, sy = 0) {
  const m = cam.m;
  const V = cam.V;
  for (let j = 0; j < run.planes.length; j++) {
    const plane = run.planes[j];
    const role = run.role[`plane${j}`];
    const o = plane.o;
    const X = cam.ox - sx + m[0] * o[0] + m[1] * o[1] + m[2] * o[2];
    const Y = cam.oy - sy + m[3] * o[0] + m[4] * o[1] + m[5] * o[2];
    const facing = plane.n[0] * V[0] + plane.n[1] * V[1] + plane.n[2] * V[2];
    const alpha = Math.round(t3Step(plane.fade[0], plane.fade[1], facing) * 100) / 100;
    f.o[role] = alpha;
    if (plane.billboard) {
      f.t[role] = `translate(${t3Num(X)} ${t3Num(Y)})`;
      continue;
    }
    const u = plane.u;
    const v = plane.v;
    const a = m[0] * u[0] + m[1] * u[1] + m[2] * u[2];
    const b = m[3] * u[0] + m[4] * u[1] + m[5] * u[2];
    const c = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
    const d = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
    f.t[role] = `matrix(${t3Fix(a, 1e5)} ${t3Fix(b, 1e5)} ${t3Fix(c, 1e5)} ${t3Fix(d, 1e5)} ${t3Fix(X, 100)} ${t3Fix(Y, 100)})`;
  }
}

function t3EmitDots(run, cam, f, sx = 0, sy = 0) {
  const m = cam.m;
  const V = cam.V;
  for (let j = 0; j < run.dots.length; j++) {
    const dot = run.dots[j];
    const role = run.role[`c${j}`];
    const p = dot.p;
    f.cx[role] = cam.ox - sx + m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
    f.cy[role] = cam.oy - sy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
    const alpha = (dot.n ? t3Step(dot.fade[0], dot.fade[1], dot.n[0] * V[0] + dot.n[1] * V[1] + dot.n[2] * V[2]) : 1) * t3State.detail;
    f.o[role] = alpha < 0.005 ? 0 : Math.round(alpha * 100) / 100;
  }
}

function t3EmitFixed(run, cam, f) {
  const a = run.anchor;
  const m = cam.m;
  const X = cam.ox + m[0] * a[0] + m[1] * a[1] + m[2] * a[2];
  const Y = cam.oy + m[3] * a[0] + m[4] * a[1] + m[5] * a[2];
  const dx = X - run.home[0];
  const dy = Y - run.home[1];
  const rx = Math.round(dx * 100) / 100;
  const ry = Math.round(dy * 100) / 100;
  f.t[run.role.move] = rx || ry ? `translate(${t3Num(rx)} ${t3Num(ry)})` : "";
  f.shiftX = rx;
  f.shiftY = ry;
  const b = run.box0;
  f.box[0] = b[0] + rx;
  f.box[1] = b[1] + ry;
  f.box[2] = b[2] + rx;
  f.box[3] = b[3] + ry;
  const count = run.hull0.length / 2;
  const hull = t3Grow(f, "hull", 2 * count, Float64Array);
  for (let i = 0; i < count; i++) {
    hull[2 * i] = run.hull0[2 * i] + rx;
    hull[2 * i + 1] = run.hull0[2 * i + 1] + ry;
  }
  f.hullN = count;
  if (run.ribs && run.F) t3EmitRibs(run, cam, f, run.F, run.ribs, rx, ry);
  t3EmitPlanes(run, cam, f, rx, ry);
  t3EmitDots(run, cam, f, rx, ry);
}

function t3EmitRibs(run, cam, f, F, ribs, sx, sy) {
  if (t3State.detail < 0.01) {
    f.levels = t3Faded(f, run, "r", t3None, 0);
    return;
  }
  const m = cam.m;
  const V = cam.V;
  const lines = t3Lines;
  lines.d.length = 0;
  lines.alpha.length = 0;
  lines.key.length = 0;
  const { s0, s1, count, phase = 0, twist = 0, fade = [0.1, 0.55] } = ribs;
  const r0 = ribs.r0 ?? ribs.r;
  const r1 = ribs.r1 ?? r0;
  const slope = (r1 - r0) / (s1 - s0 || 1);
  const norm = Math.hypot(1, slope);
  const aV = F.a[0] * V[0] + F.a[1] * V[1] + F.a[2] * V[2];
  const uV = F.u[0] * V[0] + F.u[1] * V[1] + F.u[2] * V[2];
  const vV = F.v[0] * V[0] + F.v[1] * V[1] + F.v[2] * V[2];
  const seg = new Float64Array(4);
  const at = (s, r, t, out, index) => {
    const c = Math.cos(t);
    const n = Math.sin(t);
    const px = F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]);
    const py = F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]);
    const pz = F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]);
    out[index] = cam.ox - sx + m[0] * px + m[1] * py + m[2] * pz;
    out[index + 1] = cam.oy - sy + m[3] * px + m[4] * py + m[5] * pz;
  };
  for (let i = 0; i < count; i++) {
    const t = phase + (i / count) * T3_TAU;
    const tm = t + twist / 2;
    const facing = (Math.cos(tm) * uV + Math.sin(tm) * vV - slope * aV) / norm;
    const alpha = t3Step(fade[0], fade[1], facing);
    if (alpha * T3_LEVELS < 0.5) continue;
    at(s0, r0, t, seg, 0);
    at(s1, r1, t + twist, seg, 2);
    lines.d.push(t3Path(seg, 2, false));
    lines.alpha.push(alpha);
    lines.key.push(i);
  }
  f.levels = t3Faded(f, run, "r", lines, lines.d.length);
}


function t3Geo(F, cam) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lin = (w) => [m[0] * w[0] + m[1] * w[1] + m[2] * w[2], m[3] * w[0] + m[4] * w[1] + m[5] * w[2]];
  const O = [cam.ox + m[0] * F.o[0] + m[1] * F.o[1] + m[2] * F.o[2], cam.oy + m[3] * F.o[0] + m[4] * F.o[1] + m[5] * F.o[2]];
  const aV = dot(F.a, V);
  const uV = dot(F.u, V);
  const vV = dot(F.v, V);
  const aL = dot(F.a, L);
  const uL = dot(F.u, L);
  const vL = dot(F.v, L);
  return { O, SA: lin(F.a), SU: lin(F.u), SV: lin(F.v), aV, aL, view: { a: aV, flat: Math.hypot(uV, vV), phi: Math.atan2(vV, uV) }, light: { a: aL, flat: Math.hypot(uL, vL), phi: Math.atan2(vL, uL) } };
}

function t3At(geo, s, r, t, buf, index) {
  const c = Math.cos(t);
  const n = Math.sin(t);
  buf[index] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + n * geo.SV[0]);
  buf[index + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + n * geo.SV[1]);
}

function t3Arcs(nr, na, view, light) {
  const cuts = [];
  if (Math.abs(nr) > 1e-9) {
    const visibleCut = -(na * view.a) / (nr * view.flat);
    if (visibleCut > -1 && visibleCut < 1) {
      const d = Math.acos(visibleCut);
      cuts.push(view.phi - d, view.phi + d);
    }
    for (let b = 0; b < T3_LB.length; b++) {
      const c = (T3_LB[b] - na * light.a) / (nr * light.flat);
      if (c > -1 && c < 1) {
        const d = Math.acos(c);
        cuts.push(light.phi - d, light.phi + d);
      }
    }
  }
  for (let i = 0; i < cuts.length; i++) {
    const w = ((cuts[i] % T3_TAU) + T3_TAU) % T3_TAU;
    cuts[i] = Math.round(w * 1e9) / 1e9;
  }
  cuts.sort((a, b) => a - b);
  const sorted = [];
  for (let i = 0; i < cuts.length; i++) if (!sorted.length || cuts[i] !== sorted[sorted.length - 1]) sorted.push(cuts[i]);
  const label = (angle) => {
    const facing = nr * view.flat * Math.cos(angle - view.phi) + na * view.a;
    if (facing <= 1e-9) return -1;
    const score = nr * light.flat * Math.cos(angle - light.phi) + na * light.a;
    let tone = 0;
    while (tone < T3_LB.length && score >= T3_LB[tone]) tone++;
    return tone;
  };
  if (!sorted.length) {
    const tone = label(0);
    return tone < 0 ? [] : [{ tone, from: 0, to: T3_TAU, full: true }];
  }
  const merged = [];
  for (let index = 0; index < sorted.length; index++) {
    const from = sorted[index];
    const to = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + T3_TAU;
    const tone = label((from + to) / 2);
    const last = merged[merged.length - 1];
    if (last && last.tone === tone && Math.abs(last.to - from) < 1e-9) last.to = to;
    else merged.push({ tone, from, to });
  }
  if (merged.length > 1 && merged[0].tone === merged[merged.length - 1].tone && Math.abs(merged[merged.length - 1].to - T3_TAU - merged[0].from) < 1e-9) {
    const last = merged.pop();
    merged[0].from = last.from - T3_TAU;
  }
  const out = [];
  for (const arc of merged) if (arc.tone >= 0) out.push(arc);
  return out;
}

function t3Strip(geo, s0, r0, s1, r1, from, to, step) {
  const count = Math.max(1, Math.ceil((to - from) / step));
  const buf = t3Scratch("c", 4 * count + 8);
  for (let j = 0; j <= count; j++) {
    const t = from + ((to - from) * j) / count;
    t3At(geo, s0, r0, t, buf, 2 * j);
    t3At(geo, s1, r1, t, buf, 2 * (2 * count + 1 - j));
  }
  return t3Path(t3Oriented(buf, 2 * count + 2), 2 * count + 2, true);
}

function t3Oriented(buf, count) {
  let area = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    area += buf[2 * i] * buf[2 * j + 1] - buf[2 * j] * buf[2 * i + 1];
  }
  if (area >= 0) return buf;
  for (let i = 0, j = count - 1; i < j; i++, j--) {
    const x = buf[2 * i];
    const y = buf[2 * i + 1];
    buf[2 * i] = buf[2 * j];
    buf[2 * i + 1] = buf[2 * j + 1];
    buf[2 * j] = x;
    buf[2 * j + 1] = y;
  }
  return buf;
}

function t3Hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function t3PathOf(points, closed) {
  if (points.length < 2) return "";
  let s = "M" + t3Num(points[0][0]) + " " + t3Num(points[0][1]);
  for (let i = 1; i < points.length; i++) s += "L" + t3Num(points[i][0]) + " " + t3Num(points[i][1]);
  return closed ? s + "Z" : s;
}

function t3Basis(w) {
  const helper = Math.abs(w[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = t3Unit([helper[1] * w[2] - helper[2] * w[1], helper[2] * w[0] - helper[0] * w[2], helper[0] * w[1] - helper[1] * w[0]]);
  return [u, [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]]];
}

function t3Meet(A, a, B, b) {
  const ab = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const det = 1 - ab * ab;
  if (det < 1e-12) return [];
  const alpha = (a - b * ab) / det;
  const beta = (b - a * ab) / det;
  const base = [A[0] * alpha + B[0] * beta, A[1] * alpha + B[1] * beta, A[2] * alpha + B[2] * beta];
  const rest = 1 - (base[0] * base[0] + base[1] * base[1] + base[2] * base[2]);
  if (rest < 0) return [];
  const cr = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
  const k = Math.sqrt(rest / det);
  return [
    [base[0] + cr[0] * k, base[1] + cr[1] * k, base[2] + cr[2] * k],
    [base[0] - cr[0] * k, base[1] - cr[1] * k, base[2] - cr[2] * k],
  ];
}

const t3Tables = new Map();
function t3Table(count) {
  let table = t3Tables.get(count);
  if (!table) {
    table = new Float64Array(2 * count);
    for (let j = 0; j < count; j++) {
      table[2 * j] = Math.cos((j / count) * T3_TAU);
      table[2 * j + 1] = Math.sin((j / count) * T3_TAU);
    }
    t3Tables.set(count, table);
  }
  return table;
}

function t3Dome(cam, C, e, r, count, sheets) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const Sx = cam.ox + m[0] * C[0] + m[1] * C[1] + m[2] * C[2];
  const Sy = cam.oy + m[3] * C[0] + m[4] * C[1] + m[5] * C[2];
  const flat = (n) => [Sx + r * (m[0] * n[0] + m[1] * n[1] + m[2] * n[2]), Sy + r * (m[3] * n[0] + m[4] * n[1] + m[5] * n[2])];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const table = t3Table(count);
  const circle = (W, value, keep) => {
    const [U, Q] = t3Basis(W);
    const rad = Math.sqrt(Math.max(0, 1 - value * value));
    const out = [];
    for (let j = 0; j < count; j++) {
      const cs = table[2 * j] * rad;
      const sn = table[2 * j + 1] * rad;
      const n = [W[0] * value + U[0] * cs + Q[0] * sn, W[1] * value + U[1] * cs + Q[1] * sn, W[2] * value + U[2] * cs + Q[2] * sn];
      if (keep(n)) out.push(n);
    }
    return out;
  };
  const rim = circle(V, 0, (n) => dot(n, e) >= -1e-9).map((n) => [flat(n), dot(n, L)]);
  const base = circle(e, 0, (n) => dot(n, V) >= -1e-9).map((n) => [flat(n), dot(n, L)]);
  const corners = t3Meet(V, 0, e, 0).map((n) => [flat(n), dot(n, L)]);
  for (let tone = 0; tone < 5; tone++) {
    const tau = tone === 0 ? -Infinity : T3_LB[tone - 1];
    const candidates = [];
    for (const list of [rim, base, corners]) for (const [p, lit] of list) if (lit >= tau - 1e-9) candidates.push(p);
    if (tone > 0) {
      for (const n of circle(L, tau, (n) => dot(n, V) >= -1e-9 && dot(n, e) >= -1e-9)) candidates.push(flat(n));
      for (const n of t3Meet(L, tau, V, 0)) if (dot(n, e) >= -1e-9) candidates.push(flat(n));
      for (const n of t3Meet(L, tau, e, 0)) if (dot(n, V) >= -1e-9) candidates.push(flat(n));
    }
    if (candidates.length < 3) continue;
    const region = t3Hull(candidates);
    if (region.length >= 3) sheets[tone] += t3PathOf(region, true);
  }
}

function t3BoxOf(pts, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  box[0] = x0;
  box[1] = y0;
  box[2] = x1;
  box[3] = y1;
}

function t3Thin(points, most) {
  if (points.length <= most) return points;
  const n = points.length;
  const picks = [];
  for (let i = 0; i < most; i++) picks.push(Math.floor((i * n) / most));
  const thin = picks.map((i) => points[i]);
  let err = 0;
  for (let j = 0; j < most; j++) {
    const a = thin[j];
    const b = thin[(j + 1) % most];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const end = j + 1 < most ? picks[j + 1] : picks[0] + n;
    for (let i = picks[j] + 1; i < end; i++) {
      const p = points[i % n];
      const out = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l;
      if (Math.abs(out) > err) err = Math.abs(out);
    }
  }
  return t3Grown(thin, err);
}

function t3Grown(poly, by) {
  if (!(by > 0)) return poly;
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;
  const n = poly.length;
  const normals = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(sign * (b[1] - a[1])) / l, (-sign * (b[0] - a[0])) / l];
  });
  return poly.map((p, i) => {
    const na = normals[(i - 1 + n) % n];
    const nb = normals[i];
    const mx = na[0] + nb[0];
    const my = na[1] + nb[1];
    const dd = (mx * mx + my * my) / 2 || 1;
    return [p[0] + (mx * by) / dd, p[1] + (my * by) / dd];
  });
}

function t3HullOut(f, points, most = 32) {
  const thin = t3Thin(points, most);
  const hull = t3Grow(f, "hull", 2 * thin.length, Float64Array);
  for (let i = 0; i < thin.length; i++) {
    hull[2 * i] = thin[i][0];
    hull[2 * i + 1] = thin[i][1];
  }
  f.hullN = thin.length;
}

function t3SupportHull(geo, cam, components, dirs) {
  const table = t3Table(dirs);
  const pts = [];
  const { O, SA, SU, SV } = geo;
  for (let j = 0; j < dirs; j++) {
    const dx = table[2 * j];
    const dy = table[2 * j + 1];
    const pa = SA[0] * dx + SA[1] * dy;
    const pu = SU[0] * dx + SU[1] * dy;
    const pv = SV[0] * dx + SV[1] * dy;
    const w = Math.hypot(pu, pv);
    let best = -Infinity;
    let px = 0;
    let py = 0;
    for (let c = 0; c < components.length; c += 3) {
      const kind = components[c];
      const s = components[c + 1];
      const r = components[c + 2];
      if (kind === 0) {
        const value = s * pa + r * w;
        if (value > best) {
          best = value;
          const cs = w > 1e-12 ? pu / w : 1;
          const sn = w > 1e-12 ? pv / w : 0;
          px = O[0] + s * SA[0] + r * (cs * SU[0] + sn * SV[0]);
          py = O[1] + s * SA[1] + r * (cs * SU[1] + sn * SV[1]);
        }
      } else {
        const rk = r * cam.k;
        const value = s * pa + rk;
        if (value > best) {
          best = value;
          px = O[0] + s * SA[0] + rk * dx;
          py = O[1] + s * SA[1] + rk * dy;
        }
      }
    }
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - px) + Math.abs(last[1] - py) > 0.02) pts.push([px, py]);
  }
  if (pts.length > 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 0.02) pts.pop();
  }
  return pts;
}

function t3ArcPoints(geo, s, r, from, to, k, out, cut = false) {
  const count = Math.max(2, Math.ceil((Math.abs(to - from) * 48) / T3_TAU), Math.ceil((Math.abs(to - from) * Math.max(r, 1e-6) * k) / 1.5));
  for (let j = 0; j <= count; j++) {
    const t = from + ((to - from) * j) / count;
    const c = Math.cos(t);
    const n = Math.sin(t);
    const p = [geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + n * geo.SV[0]), geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + n * geo.SV[1])];
    if (cut) p.cut = true;
    out.push(p);
  }
}

function t3RoundOutline(run, geo, cam) {
  const k = cam.k;
  const { s0, s1, r0, r1, ends } = run;
  const domes = (ends[0] === "dome" ? 1 : 0) + (ends[1] === "dome" ? 1 : 0);
  if (domes === 2) {
    const c0 = [geo.O[0] + s0 * geo.SA[0], geo.O[1] + s0 * geo.SA[1]];
    const c1 = [geo.O[0] + s1 * geo.SA[0], geo.O[1] + s1 * geo.SA[1]];
    const rk = r0 * k;
    const dx = c1[0] - c0[0];
    const dy = c1[1] - c0[1];
    const l = Math.hypot(dx, dy);
    const count = Math.max(24, Math.ceil((Math.PI * rk) / 1.5));
    const out = [];
    if (l < 1e-6) {
      for (let j = 0; j < 2 * count; j++) {
        const t = (j / (2 * count)) * T3_TAU;
        out.push([c1[0] + rk * Math.cos(t), c1[1] + rk * Math.sin(t)]);
      }
      return out;
    }
    const beta = Math.atan2(dy, dx);
    for (let j = 0; j <= count; j++) {
      const t = beta - Math.PI / 2 + (Math.PI * j) / count;
      out.push([c1[0] + rk * Math.cos(t), c1[1] + rk * Math.sin(t)]);
    }
    for (let j = 0; j <= count; j++) {
      const t = beta + Math.PI / 2 + (Math.PI * j) / count;
      out.push([c0[0] + rk * Math.cos(t), c0[1] + rk * Math.sin(t)]);
    }
    return out;
  }
  if (domes === 1) {
    const pts = [];
    for (const [end, s, r] of [[0, s0, r0], [1, s1, r1]]) {
      t3ArcPoints(geo, s, r, 0, T3_TAU, k, pts);
      if (ends[end] !== "dome") continue;
      const sign = end ? 1 : -1;
      const c = [geo.O[0] + s * geo.SA[0], geo.O[1] + s * geo.SA[1]];
      const rk = r * k;
      const beta = Math.atan2(sign * geo.SA[1], sign * geo.SA[0]);
      const count = Math.max(24, Math.ceil((Math.PI * rk) / 1.5));
      for (let j = 0; j <= count; j++) {
        const t = beta - Math.PI / 2 + (Math.PI * j) / count;
        pts.push([c[0] + rk * Math.cos(t), c[1] + rk * Math.sin(t)]);
      }
    }
    return t3Hull(pts);
  }
  const view = geo.view;
  const out = [];
  let c;
  if (view.flat < 1e-9) c = run.na * view.a > 0 ? -2 : 2;
  else c = -(run.na * view.a) / (run.nr * view.flat);
  if (c <= -1 || c >= 1) {
    const side = c <= -1;
    const capFirst = -geo.aV > 0;
    const keepFirst = side ? !capFirst : capFirst;
    const s = keepFirst ? s0 : s1;
    const r = keepFirst ? r0 : r1;
    t3ArcPoints(geo, s, r, 0, T3_TAU, k, out, run.cutS !== null && Math.abs(run.cutS - s) < 1e-6);
    out.pop();
    return out;
  }
  const d = Math.acos(c);
  const lo = view.phi - d;
  const hi = view.phi + d;
  const cut0 = run.cutS !== null && Math.abs(run.cutS - s0) < 1e-6;
  const cut1 = run.cutS !== null && Math.abs(run.cutS - s1) < 1e-6;
  if (-geo.aV > 0) t3ArcPoints(geo, s0, r0, hi, lo + T3_TAU, k, out, cut0);
  else t3ArcPoints(geo, s0, r0, lo, hi, k, out, cut0);
  const tail = [];
  if (geo.aV > 0) t3ArcPoints(geo, s1, r1, hi, lo + T3_TAU, k, tail, cut1);
  else t3ArcPoints(geo, s1, r1, lo, hi, k, tail, cut1);
  const first = out[out.length - 1];
  const a = tail[0];
  const b = tail[tail.length - 1];
  if (Math.hypot(a[0] - first[0], a[1] - first[1]) > Math.hypot(b[0] - first[0], b[1] - first[1])) tail.reverse();
  for (const p of tail) out.push(p);
  return out;
}

function t3LatheMid(a, b) {
  const h = b.s - a.s;
  const ga = -a.na / a.nr;
  const gb = -b.na / b.nr;
  const nr = a.nr + b.nr;
  const na = a.na + b.na;
  const l = Math.hypot(nr, na) || 1;
  return { s: (a.s + b.s) / 2, r: (a.r + b.r) / 2 + (h * (ga - gb)) / 8, nr: nr / l, na: na / l };
}

function t3LatheOutline(run, geo, cam) {
  const k = cam.k;
  const view = geo.view;
  const lv = run.levels;
  const pts = [];
  const cut = (L) => (view.flat < 1e-9 ? Infinity : -(L.na * view.a) / (L.nr * view.flat));
  const inside = (L) => L.r <= 1e-9 || Math.abs(cut(L)) < 1;
  const sides = (L) => {
    if (L.r <= 1e-9) {
      const p = [geo.O[0] + L.s * geo.SA[0], geo.O[1] + L.s * geo.SA[1]];
      return [p, p];
    }
    const c = Math.max(-1, Math.min(1, cut(L)));
    const d = Math.acos(c);
    return [view.phi - d, view.phi + d].map((t) => {
      const cs = Math.cos(t);
      const sn = Math.sin(t);
      return [geo.O[0] + L.s * geo.SA[0] + L.r * (cs * geo.SU[0] + sn * geo.SV[0]), geo.O[1] + L.s * geo.SA[1] + L.r * (cs * geo.SU[1] + sn * geo.SV[1])];
    });
  };
  const span = (a, b) => {
    const pa = sides(a);
    const pb = sides(b);
    return Math.max(Math.hypot(pa[0][0] - pb[0][0], pa[0][1] - pb[0][1]), Math.hypot(pa[1][0] - pb[1][0], pa[1][1] - pb[1][1]));
  };
  const refine = (a, b, depth) => {
    if (depth >= 10 || span(a, b) < 1.2) return;
    const mid = t3LatheMid(a, b);
    refine(a, mid, depth + 1);
    pts.push(...sides(mid));
    refine(mid, b, depth + 1);
  };
  let previous = null;
  for (let i = 0; i < lv.length; i += 4) {
    const L = { s: lv[i], r: lv[i + 1], nr: lv[i + 2], na: lv[i + 3] };
    if (inside(L)) pts.push(...sides(L));
    if (previous) {
      const pin = inside(previous);
      const lin = inside(L);
      if (pin && lin) refine(previous, L, 0);
      else if (pin !== lin) {
        let a = pin ? previous : L;
        let b = pin ? L : previous;
        const start = a;
        for (let it = 0; it < 14; it++) {
          const mid = t3LatheMid(a.s < b.s ? a : b, a.s < b.s ? b : a);
          if (inside(mid)) a = mid;
          else b = mid;
        }
        pts.push(...sides(a));
        refine(start.s < a.s ? start : a, start.s < a.s ? a : start, 0);
      }
    }
    previous = L;
  }
  for (const i of [0, lv.length - 4]) if (lv[i + 1] > 1e-9) t3ArcPoints(geo, lv[i], lv[i + 1], 0, T3_TAU, k, pts);
  return t3Hull(pts);
}

function t3SeamArc(geo, s, r, slope, k, trim = 0.3) {
  const view = geo.view;
  const norm = Math.hypot(1, slope);
  let lo;
  let hi;
  if (view.flat < 1e-9) {
    if (!((-slope * view.a) / norm > 0)) return "";
    lo = view.phi;
    hi = view.phi + T3_TAU;
  } else {
    const cc = (slope * view.a) / view.flat;
    if (cc >= 1) return "";
    if (cc <= -1) {
      lo = view.phi;
      hi = view.phi + T3_TAU;
    } else {
      const d = Math.acos(cc);
      lo = view.phi - d;
      hi = view.phi + d;
    }
  }
  const full = hi - lo >= T3_TAU - 1e-9;
  const buf = t3Scratch("c", 2 * 520);
  if (!full) {
    const span = hi - lo;
    const cutAt = (from, sign) => {
      t3At(geo, s, r, from, buf, 0);
      const px = buf[0];
      const py = buf[1];
      let a = 0;
      let b = span * 0.25;
      t3At(geo, s, r, from + sign * b, buf, 0);
      if (Math.hypot(buf[0] - px, buf[1] - py) <= trim) return b;
      for (let it = 0; it < 18; it++) {
        const mid = (a + b) / 2;
        t3At(geo, s, r, from + sign * mid, buf, 0);
        if (Math.hypot(buf[0] - px, buf[1] - py) < trim) a = mid;
        else b = mid;
      }
      return (a + b) / 2;
    };
    const d0 = cutAt(lo, 1);
    const d1 = cutAt(hi, -1);
    lo += d0;
    hi -= d1;
  }
  const count = Math.min(512, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
  for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, buf, 2 * j);
  return t3Path(buf, full ? count : count + 1, full);
}

function t3RibLines(geo, F, cam, ribs, sx, sy) {
  const lines = t3Lines;
  lines.d.length = 0;
  lines.alpha.length = 0;
  lines.key.length = 0;
  const { s0, s1, count, phase = 0, twist = 0, fade = [0.1, 0.55] } = ribs;
  const r0 = ribs.r0 ?? ribs.r;
  const r1 = ribs.r1 ?? r0;
  const slope = (r1 - r0) / (s1 - s0 || 1);
  const norm = Math.hypot(1, slope);
  const view = geo.view;
  const seg = new Float64Array(4);
  for (let i = 0; i < count; i++) {
    const t = phase + (i / count) * T3_TAU;
    const tm = t + twist / 2;
    const facing = (view.flat * Math.cos(tm - view.phi) - slope * view.a) / norm;
    const alpha = t3Step(fade[0], fade[1], facing);
    if (alpha * T3_LEVELS < 0.5) continue;
    t3At(geo, s0, r0, t, seg, 0);
    t3At(geo, s1, r1, t + twist, seg, 2);
    seg[0] -= sx;
    seg[1] -= sy;
    seg[2] -= sx;
    seg[3] -= sy;
    lines.d.push(t3Path(seg, 2, false));
    lines.alpha.push(alpha);
    lines.key.push(i);
  }
  return lines;
}

function t3PrepareRound(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.F = spec.F;
  run.s0 = spec.s0;
  run.s1 = spec.s1;
  run.r0 = spec.r0;
  run.r1 = spec.r1;
  run.ends = spec.ends;
  const g = (spec.r1 - spec.r0) / (spec.s1 - spec.s0 || 1);
  const norm = Math.hypot(1, g);
  run.nr = 1 / norm;
  run.na = -g / norm;
  run.g = g;
  const rmax = Math.max(spec.r0, spec.r1);
  const around = T3_TAU * rmax * k * unit;
  run.fine = Math.max(around < 30 ? 16 : 24, Math.min(96, Math.ceil(around / 2.2)));
  run.dirs = Math.max(around < 30 ? 16 : 32, Math.min(256, Math.ceil(around / 1.5)));
  run.capCount = Math.max(around < 30 ? 16 : 24, Math.min(160, Math.ceil(around / 1.5)));
  run.domeCount = Math.max(around < 30 ? 12 : 16, Math.min(48, Math.round(run.fine * 0.75)));
  const comps = [];
  for (const [end, s, r] of [[0, spec.s0, spec.r0], [1, spec.s1, spec.r1]]) comps.push(spec.ends[end] === "dome" ? 1 : 0, s, r);
  run.components = comps;
  const details = part.details ?? {};
  run.seams = (details.seams ?? []).map((s) => ({ s, r: spec.r0 + g * (s - spec.s0), slope: g }));
  run.ribs = details.ribs ? { ...details.ribs, r0: details.ribs.r0 ?? spec.r0 + g * (details.ribs.s0 - spec.s0), r1: details.ribs.r1 ?? spec.r0 + g * (details.ribs.s1 - spec.s0) } : null;
  run.cutS = null;
  for (const cut of spec.cuts ?? []) {
    const along = cut.n[0] * spec.F.a[0] + cut.n[1] * spec.F.a[1] + cut.n[2] * spec.F.a[2];
    const sCut = (cut.d - (cut.n[0] * spec.F.o[0] + cut.n[1] * spec.F.o[1] + cut.n[2] * spec.F.o[2])) / along;
    if (Math.abs(sCut - spec.s0) < 1e-6 || Math.abs(sCut - spec.s1) < 1e-6) run.cutS = sCut;
  }
}

function t3EmitRound(run, cam, f) {
  const geo = t3Geo(run.F, cam);
  const k = cam.k;
  const step = T3_TAU / run.fine;
  const sheets = ["", "", "", "", ""];
  const { s0, s1, r0, r1 } = run;
  for (const arc of t3Arcs(run.nr, run.na, geo.view, geo.light)) sheets[arc.tone] += t3Strip(geo, s0, r0, s1, r1, arc.from, arc.to, step);
  const F = run.F;
  for (let end = 0; end < 2; end++) {
    if (run.ends[end] !== "dome") continue;
    const s = end ? s1 : s0;
    const sign = end ? 1 : -1;
    const C = [F.o[0] + F.a[0] * s, F.o[1] + F.a[1] * s, F.o[2] + F.a[2] * s];
    t3Dome(cam, C, [F.a[0] * sign, F.a[1] * sign, F.a[2] * sign], end ? r1 : r0, run.domeCount, sheets);
  }
  for (let t = 0; t < 5; t++) f.d[run.role[`s${t}`]] = sheets[t];
  const pts = t3RoundOutline(run, geo, cam);
  const outline = t3PathOf(pts, true);
  f.d[run.role.fill] = outline;
  if (run.cutS !== null) {
    const buf = new Float64Array(2 * pts.length);
    const skip = new Uint8Array(pts.length);
    pts.forEach((p, j) => {
      buf[2 * j] = p[0];
      buf[2 * j + 1] = p[1];
    });
    for (let j = 0; j < pts.length; j++) skip[j] = pts[j].cut && pts[(j + 1) % pts.length].cut ? 1 : 0;
    f.d[run.role.edge] = t3Broken(buf, pts.length, skip);
  } else f.d[run.role.edge] = outline;
  t3BoxOf(pts, f.box);
  t3HullOut(f, pts);
  const view = geo.view;
  let crease = "";
  for (let end = 0; end < 2; end++) {
    if (run.ends[end] !== "flat") continue;
    const role = run.role[`k${end}`];
    const sign = end ? 1 : -1;
    const s = end ? s1 : s0;
    const r = end ? r1 : r0;
    const face = sign * geo.aV;
    if (!(face > 1e-9)) {
      f.d[role] = "";
      continue;
    }
    const n = run.capCount;
    const buf = t3Scratch("c", 2 * n);
    const table = t3Table(n);
    for (let j = 0; j < n; j++) {
      const c = table[2 * j];
      const q = table[2 * j + 1];
      buf[2 * j] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + q * geo.SV[0]);
      buf[2 * j + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + q * geo.SV[1]);
    }
    f.d[role] = t3Path(buf, n, true);
    f.q[role] = t3Level(sign * geo.aL, T3_LB);
    const minor = 2 * r * k * Math.abs(face);
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    if (run.role.crease === undefined) continue;
    let lo;
    let hi;
    if (view.flat < 1e-9) {
      if (!(run.na * view.a > 1e-9)) continue;
      lo = 0;
      hi = T3_TAU;
    } else {
      const cc = -(run.na * view.a) / (run.nr * view.flat);
      if (cc >= 1) continue;
      if (cc <= -1) {
        lo = view.phi;
        hi = view.phi + T3_TAU;
      } else {
        const d = Math.acos(cc);
        lo = view.phi - d;
        hi = view.phi + d;
      }
    }
    const count = Math.min(400, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
    const arc = t3Scratch("c", 2 * count + 2);
    for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, arc, 2 * j);
    crease += t3Path(arc, count + 1, false);
  }
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  if (run.role.inner !== undefined) {
    let inner = "";
    for (const seam of run.seams) inner += t3SeamArc(geo, seam.s, seam.r, seam.slope, k);
    if (run.ribs && run.ribs.seams) {
      const rs = run.ribs;
      const slope = (rs.r1 - rs.r0) / (rs.s1 - rs.s0 || 1);
      if (rs.seams !== "last") inner += t3SeamArc(geo, rs.s0, rs.r0, slope, k);
      if (rs.seams !== "first") inner += t3SeamArc(geo, rs.s1, rs.r1, slope, k);
    }
    f.d[run.role.inner] = inner;
  }
  if (run.ribs) {
    const lines = t3State.detail < 0.01 ? t3None : t3RibLines(geo, run.F, cam, run.ribs, 0, 0);
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
}

function t3PrepareBall(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.c = spec.c;
  run.r = spec.r;
  run.flats = spec.flats.map((flat) => {
    const n = t3Unit(flat.n);
    const rho = Math.sqrt(Math.max(0, spec.r * spec.r - flat.d * flat.d));
    const [u, v] = t3Basis(n);
    return { n, d: flat.d, rho, u, v };
  });
  run.limb = Math.max(32, Math.min(160, Math.ceil((T3_TAU * spec.r * k * unit) / 1.5)));
  run.rimCount = run.flats.map((flat) => Math.max(20, Math.min(120, Math.ceil((T3_TAU * flat.rho * k * unit) / 1.5))));
}

function t3ClipConvex(subject, clip) {
  if (subject.length < 3 || clip.length < 3) return [];
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

function t3EmitBall(run, cam, f) {
  const m = cam.m;
  const V = cam.V;
  const L = cam.L;
  const { c, r, flats } = run;
  const Cx = cam.ox + m[0] * c[0] + m[1] * c[1] + m[2] * c[2];
  const Cy = cam.oy + m[3] * c[0] + m[4] * c[1] + m[5] * c[2];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const flat = (w) => [Cx + r * (m[0] * w[0] + m[1] * w[1] + m[2] * w[2]), Cy + r * (m[3] * w[0] + m[4] * w[1] + m[5] * w[2])];
  const inside = (w, skip = -1) => {
    for (let i = 0; i < flats.length; i++) if (i !== skip && dot(w, flats[i].n) * r > flats[i].d + 1e-7) return false;
    return true;
  };
  const [U, W] = t3Basis(V);
  const n = run.limb;
  const table = t3Table(n);
  const limb = [];
  for (let j = 0; j < n; j++) limb.push([U[0] * table[2 * j] + W[0] * table[2 * j + 1], U[1] * table[2 * j] + W[1] * table[2 * j + 1], U[2] * table[2 * j] + W[2] * table[2 * j + 1]]);
  const sil = [];
  for (const w of limb) if (inside(w)) sil.push(flat(w));
  const rims = flats.map((cut, ci) => {
    const count = run.rimCount[ci];
    const t = t3Table(count);
    const list = [];
    for (let j = 0; j < count; j++) {
      const w = [(cut.n[0] * cut.d + cut.rho * (cut.u[0] * t[2 * j] + cut.v[0] * t[2 * j + 1])) / r, (cut.n[1] * cut.d + cut.rho * (cut.u[1] * t[2 * j] + cut.v[1] * t[2 * j + 1])) / r, (cut.n[2] * cut.d + cut.rho * (cut.u[2] * t[2 * j] + cut.v[2] * t[2 * j + 1])) / r];
      list.push({ w, keep: inside(w, ci), p: flat(w) });
    }
    return list;
  });
  flats.forEach((cut, ci) => {
    for (const w of t3Meet(V, 0, cut.n, cut.d / r)) if (inside(w, ci)) sil.push(flat(w));
    rims[ci].forEach(({ keep, p }) => keep && sil.push(p));
  });
  const hull = t3Hull(sil);
  const outline = t3PathOf(hull, true);
  f.d[run.role.fill] = outline;
  f.d[run.role.edge] = outline;
  f.d[run.role.s0] = outline;
  const capOf = (threshold) => {
    const points = [];
    for (const w of limb) if (dot(w, L) >= threshold && inside(w)) points.push(flat(w));
    const radius = Math.sqrt(Math.max(0, 1 - threshold * threshold));
    const [LU, LW] = t3Basis(L);
    for (let j = 0; j < n; j++) {
      const w = [L[0] * threshold + radius * (LU[0] * table[2 * j] + LW[0] * table[2 * j + 1]), L[1] * threshold + radius * (LU[1] * table[2 * j] + LW[1] * table[2 * j + 1]), L[2] * threshold + radius * (LU[2] * table[2 * j] + LW[2] * table[2 * j + 1])];
      if (dot(w, V) >= -1e-9) points.push(flat(w));
    }
    if (dot(L, V) > threshold) points.push(flat(V));
    for (const w of t3Meet(L, threshold, V, 0)) if (inside(w)) points.push(flat(w));
    flats.forEach((cut, ci) => {
      for (const w of t3Meet(V, 0, cut.n, cut.d / r)) if (inside(w, ci) && dot(w, L) >= threshold) points.push(flat(w));
      for (const w of t3Meet(L, threshold, cut.n, cut.d / r)) if (inside(w, ci) && dot(w, V) >= -1e-9) points.push(flat(w));
      for (const { w, keep, p } of rims[ci]) if (keep && dot(w, L) >= threshold && dot(w, V) >= -1e-9) points.push(p);
    });
    if (points.length < 3) return "";
    const region = t3ClipConvex(t3Hull(points), hull);
    return region.length >= 3 ? t3PathOf(region, true) : "";
  };
  f.d[run.role.s1] = capOf(T3_LB[1]);
  f.d[run.role.s2] = capOf(T3_LB[2]);
  f.d[run.role.s3] = capOf(T3_LB[3]);
  let crease = "";
  flats.forEach((cut, ci) => {
    const role = run.role[`f${ci}`];
    const face = dot(cut.n, V);
    if (!(face > 1e-9)) {
      f.d[role] = "";
      return;
    }
    const pts = t3ClipConvex(rims[ci].map(({ p }) => p), hull);
    f.d[role] = t3PathOf(pts, true);
    f.q[role] = t3Level(dot(cut.n, L), T3_LB);
    const minor = 2 * cut.rho * cam.k * face;
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    const list = rims[ci];
    const seen = list.map(({ w, keep }) => keep && dot(w, V) > 0);
    const start = seen.indexOf(false);
    if (start < 0) {
      crease += t3PathOf(list.map(({ p }) => p), true);
      return;
    }
    let cur = null;
    for (let s = 1; s <= list.length; s++) {
      const i = (start + s) % list.length;
      if (seen[i]) (cur ??= []).push(list[i].p);
      else if (cur) {
        if (cur.length > 1) crease += t3PathOf(cur, false);
        cur = null;
      }
    }
    if (cur && cur.length > 1) crease += t3PathOf(cur, false);
  });
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of hull) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  f.box[0] = x0;
  f.box[1] = y0;
  f.box[2] = x1;
  f.box[3] = y1;
  t3HullOut(f, hull);
}

function t3PrepareLathe(run, part, P, unit) {
  const spec = part.spec;
  const k = P.scale * T3_ROOT;
  run.F = spec.F;
  run.levels = spec.levels;
  run.caps = spec.caps;
  let rmax = 0;
  for (let i = 0; i < spec.levels.length; i += 4) rmax = Math.max(rmax, spec.levels[i + 1]);
  run.fine = Math.max(24, Math.min(96, Math.ceil((T3_TAU * rmax * k * unit) / 2.2)));
  run.dirs = Math.max(32, Math.min(256, Math.ceil((T3_TAU * rmax * k * unit) / 1.5)));
  run.capCount = Math.max(24, Math.min(160, Math.ceil((T3_TAU * rmax * k * unit) / 1.5)));
  const comps = [];
  for (let i = 0; i < spec.levels.length; i += 4) comps.push(0, spec.levels[i], spec.levels[i + 1]);
  run.components = comps;
  const details = part.details ?? {};
  run.seams = (details.seams ?? []).map((seam) => (typeof seam === "number" ? t3LatheSeam(spec.levels, seam) : seam));
  run.ribs = details.ribs ?? null;
}

function t3LatheSeam(levels, s) {
  for (let i = 0; i + 4 < levels.length; i += 4) {
    const sa = levels[i];
    const sb = levels[i + 4];
    if ((s - sa) * (s - sb) <= 0 && sa !== sb) {
      const t = (s - sa) / (sb - sa);
      const r = levels[i + 1] + (levels[i + 5] - levels[i + 1]) * t;
      const slope = (levels[i + 5] - levels[i + 1]) / (sb - sa);
      return { s, r, slope };
    }
  }
  return { s, r: levels[1], slope: 0 };
}

function t3LatheSheets(levels, geo, step, buckets) {
  const at = (L, t) => {
    const c = Math.cos(t);
    const n = Math.sin(t);
    return [geo.O[0] + L.s * geo.SA[0] + L.r * (c * geo.SU[0] + n * geo.SV[0]), geo.O[1] + L.s * geo.SA[1] + L.r * (c * geo.SU[1] + n * geo.SV[1])];
  };
  const arcPoints = (L, from, to) => {
    const count = Math.max(1, Math.ceil((to - from) / step));
    const out = new Array(count + 1);
    for (let index = 0; index <= count; index++) out[index] = at(L, from + ((to - from) * index) / count);
    return out;
  };
  const oriented = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area < 0 ? points.reverse() : points;
  };
  const centreOf = (arc, reference) => {
    let mid = (arc.from + arc.to) / 2 - reference;
    mid = ((mid % T3_TAU) + T3_TAU) % T3_TAU;
    return mid;
  };
  const present = [false, false, false, false, false];
  for (const L of levels) {
    const groups = [null, null, null, null, null];
    for (const arc of L.arcs) {
      if (!groups[arc.tone]) groups[arc.tone] = [];
      groups[arc.tone].push(arc);
      present[arc.tone] = true;
    }
    for (const list of groups) if (list && list.length > 1) list.sort((x, y) => centreOf(x, geo.light.phi) - centreOf(y, geo.light.phi));
    L.groups = groups;
  }
  const align = (reference, arc) => {
    const out = { ...arc };
    const centre = (reference.from + reference.to) / 2;
    while ((out.from + out.to) / 2 - centre > Math.PI) {
      out.from -= T3_TAU;
      out.to -= T3_TAU;
    }
    while (centre - (out.from + out.to) / 2 > Math.PI) {
      out.from += T3_TAU;
      out.to += T3_TAU;
    }
    return out;
  };
  const overlap = (x, y) => Math.min(x.to, y.to) - Math.max(x.from, y.from);
  const sheet = (tone, run) => {
    const chains = run[0].groups[tone].map((arc) => [arc]);
    for (let q = 1; q < run.length; q++) {
      const next = run[q].groups[tone];
      const used = new Uint8Array(next.length);
      for (const chain of chains) {
        const prev = chain[q - 1];
        let best = -1;
        let score = -Infinity;
        for (let j = 0; j < next.length; j++) {
          if (used[j]) continue;
          const value = overlap(prev, align(prev, next[j]));
          if (value > score) {
            score = value;
            best = j;
          }
        }
        used[best] = 1;
        chain.push(align(prev, next[best]));
      }
    }
    chains.forEach((chain) => {
      const last = run.length - 1;
      const points = arcPoints(run[0], chain[0].from, chain[0].to);
      for (let q = 1; q < last; q++) points.push(at(run[q], chain[q].to));
      points.push(...arcPoints(run[last], chain[last].from, chain[last].to).reverse());
      for (let q = last - 1; q >= 1; q--) points.push(at(run[q], chain[q].from));
      buckets[tone] += t3PathOf(oriented(points), true);
    });
  };
  const strip = (tone, a, b) => {
    const below = a.groups[tone] ?? [];
    const above = b.groups[tone] ?? [];
    const whole = (arc) => arc.to - arc.from >= T3_TAU - 1e-6;
    const seat = (ring, arc) => {
      const gap = T3_TAU - (arc.to - arc.from);
      return { from: arc.from - gap / 2, to: arc.to + gap / 2 };
    };
    const quad = (lo, hi) => {
      if (whole(hi) && !whole(lo)) hi = seat(hi, lo);
      else if (whole(lo) && !whole(hi)) lo = seat(lo, hi);
      const points = [...arcPoints(a, lo.from, lo.to), ...arcPoints(b, hi.from, hi.to).reverse()];
      buckets[tone] += t3PathOf(oriented(points), true);
    };
    const links = below.map(() => []);
    const back = above.map(() => []);
    below.forEach((lo, i) =>
      above.forEach((hi, j) => {
        if (overlap(lo, align(lo, hi)) > -0.05) {
          links[i].push(j);
          back[j].push(i);
        }
      }),
    );
    const doneLo = new Uint8Array(below.length);
    const doneHi = new Uint8Array(above.length);
    const share = (span, parts, flip) => {
      if (whole(span)) {
        const base = parts[0].from;
        const sorted = parts.map((arc) => {
          const shift = T3_TAU * Math.floor((arc.from - base) / T3_TAU);
          return { from: arc.from - shift, to: arc.to - shift };
        }).sort((x, y) => x.from - y.from);
        const n = sorted.length;
        const cuts = sorted.map((arc, q) => {
          const next = q + 1 < n ? sorted[q + 1].from : sorted[0].from + T3_TAU;
          return (arc.to + next) / 2;
        });
        sorted.forEach((arc, q) => {
          const piece = { from: q ? cuts[q - 1] : cuts[n - 1] - T3_TAU, to: cuts[q] };
          if (flip) quad(arc, piece);
          else quad(piece, arc);
        });
        return;
      }
      const sorted = parts.map((arc) => align(span, arc)).sort((x, y) => x.from - y.from);
      const cuts = [span.from];
      for (let q = 1; q < sorted.length; q++) cuts.push(Math.min(span.to, Math.max(span.from, (sorted[q - 1].to + sorted[q].from) / 2)));
      cuts.push(span.to);
      sorted.forEach((arc, q) => {
        const piece = { from: cuts[q], to: cuts[q + 1] };
        if (flip) quad(arc, piece);
        else quad(piece, arc);
      });
    };
    for (let j = 0; j < above.length; j++) {
      if (back[j].length < 2 || back[j].some((i) => links[i].length !== 1)) continue;
      share(above[j], back[j].map((i) => below[i]), false);
      doneHi[j] = 1;
      for (const i of back[j]) doneLo[i] = 1;
    }
    for (let i = 0; i < below.length; i++) {
      if (doneLo[i] || links[i].length < 2 || links[i].some((j) => back[j].length !== 1)) continue;
      share(below[i], links[i].map((j) => above[j]), true);
      doneLo[i] = 1;
      for (const j of links[i]) doneHi[j] = 1;
    }
    for (let i = 0; i < below.length; i++) {
      if (doneLo[i]) continue;
      const lo = below[i];
      let best = -1;
      let score = -Infinity;
      for (const j of links[i]) {
        if (doneHi[j]) continue;
        const value = overlap(lo, align(lo, above[j]));
        if (value > score) {
          score = value;
          best = j;
        }
      }
      if (best >= 0) {
        doneHi[best] = 1;
        quad(lo, align(lo, above[best]));
      } else {
        const centre = (lo.from + lo.to) / 2;
        quad(lo, { from: centre, to: centre });
      }
    }
    for (let j = 0; j < above.length; j++) {
      if (doneHi[j]) continue;
      const centre = (above[j].from + above[j].to) / 2;
      quad({ from: centre, to: centre }, above[j]);
    }
  };
  for (let tone = 0; tone < 5; tone++) {
    if (!present[tone]) continue;
    for (let q = 1; q < levels.length; q++) strip(tone, levels[q - 1], levels[q]);
  }
  void sheet;
}

function t3EmitLathe(run, cam, f) {
  const geo = t3Geo(run.F, cam);
  const k = cam.k;
  const step = T3_TAU / run.fine;
  const sheets = ["", "", "", "", ""];
  const lv = run.levels;
  const levelAt = (s, r, nr, na) => ({ s, r, nr, na, arcs: t3Arcs(nr, na, geo.view, geo.light) });
  const same = (a, b) => {
    if (a.arcs.length !== b.arcs.length) return false;
    for (let i = 0; i < a.arcs.length; i++) if (a.arcs[i].tone !== b.arcs[i].tone || Boolean(a.arcs[i].full) !== Boolean(b.arcs[i].full)) return false;
    return true;
  };
  const reach = (a, b) => Math.hypot((b.s - a.s) * Math.hypot(geo.SA[0], geo.SA[1]), (b.r - a.r) * k) + Math.abs(b.r - a.r) * k;
  const levels = [];
  const wrap = (x, ref) => x + T3_TAU * Math.round((ref - x) / T3_TAU);
  const close = (a, mid, b) => {
    const r = Math.max(a.r, b.r) * k;
    for (let i = 0; i < mid.arcs.length; i++) {
      const m = mid.arcs[i];
      if (m.full) continue;
      for (const key of ["from", "to"]) {
        const x = m[key];
        const guess = (wrap(a.arcs[i][key], x) + wrap(b.arcs[i][key], x)) / 2;
        if (Math.abs(guess - x) * r > 0.25) return false;
      }
    }
    return true;
  };
  const refine = (a, b, depth) => {
    if (depth >= 8 || reach(a, b) < 0.1) {
      levels.push(b);
      return;
    }
    const m = t3LatheMid(a, b);
    const mid = levelAt(m.s, m.r, m.nr, m.na);
    if (same(a, b) && same(a, mid) && close(a, mid, b)) {
      levels.push(b);
      return;
    }
    refine(a, mid, depth + 1);
    refine(mid, b, depth + 1);
  };
  let previous = levelAt(lv[0], lv[1], lv[2], lv[3]);
  levels.push(previous);
  for (let i = 4; i < lv.length; i += 4) {
    const next = levelAt(lv[i], lv[i + 1], lv[i + 2], lv[i + 3]);
    refine(previous, next, 0);
    previous = next;
  }
  t3LatheSheets(levels, geo, step, sheets);
  for (let t = 0; t < 5; t++) f.d[run.role[`s${t}`]] = sheets[t];
  const pts = t3LatheOutline(run, geo, cam);
  const outline = t3PathOf(pts, true);
  f.d[run.role.fill] = outline;
  f.d[run.role.edge] = outline;
  t3BoxOf(pts, f.box);
  t3HullOut(f, pts);
  let crease = "";
  const view = geo.view;
  const ends = [[0, lv[0], lv[1], -1, 4], [1, lv[lv.length - 4], lv[lv.length - 3], 1, lv.length - 8]];
  for (const [end, s, r, sign, near] of ends) {
    const role = run.role[`k${end}`];
    if (role === undefined) continue;
    const face = sign * geo.aV;
    if (!(face > 1e-9) || r <= 1e-9) {
      f.d[role] = "";
      continue;
    }
    const n = run.capCount;
    const buf = t3Scratch("c", 2 * n);
    const table = t3Table(n);
    for (let j = 0; j < n; j++) {
      const c = table[2 * j];
      const q = table[2 * j + 1];
      buf[2 * j] = geo.O[0] + s * geo.SA[0] + r * (c * geo.SU[0] + q * geo.SV[0]);
      buf[2 * j + 1] = geo.O[1] + s * geo.SA[1] + r * (c * geo.SU[1] + q * geo.SV[1]);
    }
    f.d[role] = t3Path(buf, n, true);
    f.q[role] = t3Level(sign * geo.aL, T3_LB);
    const minor = 2 * r * k * Math.abs(face);
    f.w[role] = minor < 0.4 ? Math.round(minor * 100) / 100 : -1;
    if (run.role.crease === undefined) continue;
    const nr = lv[near + 2];
    const na = lv[near + 3];
    let lo;
    let hi;
    if (view.flat < 1e-9) {
      if (!(na * view.a > 1e-9)) continue;
      lo = 0;
      hi = T3_TAU;
    } else {
      const cc = -(na * view.a) / (nr * view.flat);
      if (cc >= 1) continue;
      if (cc <= -1) {
        lo = view.phi;
        hi = view.phi + T3_TAU;
      } else {
        const d = Math.acos(cc);
        lo = view.phi - d;
        hi = view.phi + d;
      }
    }
    const count = Math.min(400, Math.max(4, Math.ceil(((hi - lo) * r * k) / 1.5)));
    const arc = t3Scratch("c", 2 * count + 2);
    for (let j = 0; j <= count; j++) t3At(geo, s, r, lo + ((hi - lo) * j) / count, arc, 2 * j);
    crease += t3Path(arc, count + 1, false);
  }
  if (run.role.crease !== undefined) f.d[run.role.crease] = crease;
  if (run.role.inner !== undefined) {
    let inner = "";
    for (const seam of run.seams) inner += t3SeamArc(geo, seam.s, seam.r, seam.slope, k);
    f.d[run.role.inner] = inner;
  }
  if (run.ribs) {
    const lines = t3State.detail < 0.01 ? t3None : t3RibLines(geo, run.F, cam, run.ribs, 0, 0);
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
}

const T3_SHINE = (() => {
  const l = Math.hypot(-0.55, -0.835);
  return [-0.55 / l, -0.835 / l];
})();

function t3RouteOf(flat) {
  const n = flat.length / 3;
  const along = new Float64Array(n);
  for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(flat[3 * i] - flat[3 * i - 3], flat[3 * i + 1] - flat[3 * i - 2], flat[3 * i + 2] - flat[3 * i - 1]);
  return { flat, n, along, total: along[n - 1] };
}

function t3PointAlong(route, at) {
  const { flat, n, along } = route;
  if (at <= 0) return [flat[0], flat[1], flat[2]];
  if (at >= along[n - 1]) return [flat[3 * n - 3], flat[3 * n - 2], flat[3 * n - 1]];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (along[mid] <= at) lo = mid;
    else hi = mid;
  }
  const span = along[hi] - along[lo] || 1;
  const t = (at - along[lo]) / span;
  return [flat[3 * lo] + (flat[3 * hi] - flat[3 * lo]) * t, flat[3 * lo + 1] + (flat[3 * hi + 1] - flat[3 * lo + 1]) * t, flat[3 * lo + 2] + (flat[3 * hi + 2] - flat[3 * lo + 2]) * t];
}

function t3Cut(route, from, to) {
  const { flat, n, along } = route;
  const out = [];
  for (let i = 1; i < n; i++) {
    const start = along[i - 1];
    const end = along[i];
    if (end >= from && start <= to) {
      const length = end - start || 1;
      const t0 = Math.max(0, (from - start) / length);
      const t1 = Math.min(1, (to - start) / length);
      const at = (t) => [flat[3 * i - 3] + (flat[3 * i] - flat[3 * i - 3]) * t, flat[3 * i - 2] + (flat[3 * i + 1] - flat[3 * i - 2]) * t, flat[3 * i - 1] + (flat[3 * i + 2] - flat[3 * i - 1]) * t];
      if (!out.length) out.push(at(t0));
      out.push(at(t1));
    }
  }
  return out;
}

function t3TangentAlong(route, at) {
  const a = t3PointAlong(route, Math.max(0, at - 0.6));
  const b = t3PointAlong(route, Math.min(route.total, at + 0.6));
  return t3Unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}

const t3RouteCache = new WeakMap();

function t3PrepareTube(run, part, data) {
  const spec = part.spec;
  const source = data.routes[spec.route];
  let route = t3RouteCache.get(source);
  if (!route) {
    route = t3RouteOf(source.points);
    t3RouteCache.set(source, route);
  }
  const total = route.total;
  const r = source.r;
  const step = Math.max(0.05, Math.min(source.spacing, total / 4) * 0.5);
  const lead = 0.5;
  run.r = r;
  run.wide = Boolean(source.wide);
  run.hue = source.hue ?? null;
  const partOf = (start, end) => {
    const points = t3Cut(route, Math.max(0, start), Math.min(total, end));
    let walked = Math.max(0, start);
    const count = points.length;
    const P3 = new Float64Array(3 * count);
    const D3 = new Float64Array(3 * count);
    for (let i = 0; i < count; i++) {
      if (i > 0) walked += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
      const a = t3PointAlong(route, Math.max(0, Math.min(total, walked - step)));
      const b = t3PointAlong(route, Math.max(0, Math.min(total, walked + step)));
      for (let c = 0; c < 3; c++) {
        P3[3 * i + c] = points[i][c];
        D3[3 * i + c] = b[c] - a[c];
      }
    }
    return { count, P3, D3 };
  };
  const openStart = spec.open0 && spec.from > 0;
  const openEnd = spec.open1 && spec.to < total;
  run.body = partOf(openStart ? spec.from - lead : spec.from, openEnd ? spec.to + lead : spec.to);
  run.stripe = openStart || openEnd ? partOf(openStart ? spec.from - 2 * lead : spec.from, openEnd ? spec.to + 2 * lead : spec.to) : run.body;
  const ends = [!spec.open0 && (spec.from <= 1e-6 || spec.gap0), !spec.open1 && (spec.to >= total - 1e-6 || spec.gap1)];
  run.capped = [ends[0] && (spec.gap0 || spec.caps[0]), ends[1] && (spec.gap1 || spec.caps[1])];
  const P3 = run.body.P3;
  const last = run.body.count - 1;
  const vec = (i, j) => t3Unit([P3[3 * i] - P3[3 * j], P3[3 * i + 1] - P3[3 * j + 1], P3[3 * i + 2] - P3[3 * j + 2]]);
  run.tips = [vec(1, 0), vec(last, last - 1)];
  run.rings = null;
  if (source.rings) {
    const { pitch = 3, twist = 0, cross = false, fade = [0.1, 0.55], phase = 0, steps = 16 } = source.rings;
    const lo = openStart ? spec.from - 2 * lead : spec.from;
    const hi = openEnd ? spec.to + 2 * lead : spec.to;
    const margin = twist ? 0 : Math.min(pitch * 0.35, (hi - lo) / 2);
    const from = Math.max(lo, !openStart ? lo + margin : lo);
    const to = Math.min(hi, !openEnd ? hi - margin : hi);
    const segments = [];
    if (to > from) {
      const hands = twist ? (cross ? [1, -1] : [1]) : [0];
      const reach = Math.abs(twist) * r;
      const first = Math.ceil((from - reach - phase) / pitch);
      const lastIndex = Math.floor((to + reach - phase) / pitch);
      const surface = (t, theta) => {
        const at = Math.max(0, Math.min(total, t));
        return { c: t3PointAlong(route, at), T: t3TangentAlong(route, at), theta };
      };
      for (let index = first; index <= lastIndex; index++) {
        const station = phase + index * pitch;
        for (const hand of hands) {
          const samples = [];
          for (let k = 0; k <= steps; k++) {
            const theta = (k / steps) * Math.PI;
            const t = station + hand * twist * r * (k / steps - 0.5);
            samples.push({ t, theta });
          }
          for (let k = 0; k < steps; k++) {
            let a = samples[k];
            let b = samples[k + 1];
            if ((a.t < from && b.t < from) || (a.t > to && b.t > to)) continue;
            const clipTo = (x, y, edge) => ({ t: edge, theta: x.theta + ((y.theta - x.theta) * (edge - x.t)) / (y.t - x.t || 1e-9) });
            if (a.t < from) a = clipTo(a, b, from);
            if (b.t < from) b = clipTo(b, a, from);
            if (a.t > to) a = clipTo(a, b, to);
            if (b.t > to) b = clipTo(b, a, to);
            segments.push([surface(a.t, a.theta), surface(b.t, b.theta)]);
          }
        }
      }
    }
    run.rings = { segments, fade, tone: source.rings.tone ?? "lo" };
  }
}

function t3Sides(part, cam, r) {
  const m = cam.m;
  const k = cam.k;
  const n = part.count;
  const out = { n, flat: new Float64Array(2 * n), left: new Float64Array(2 * n), right: new Float64Array(2 * n), shineA: new Float64Array(2 * n), shineB: new Float64Array(2 * n), shadeA: new Float64Array(2 * n), shadeB: new Float64Array(2 * n), frames: [] };
  const half = r * k;
  for (let i = 0; i < n; i++) {
    const x = part.P3[3 * i];
    const y = part.P3[3 * i + 1];
    const z = part.P3[3 * i + 2];
    const px = cam.ox + m[0] * x + m[1] * y + m[2] * z;
    const py = cam.oy + m[3] * x + m[4] * y + m[5] * z;
    const dx = m[0] * part.D3[3 * i] + m[1] * part.D3[3 * i + 1] + m[2] * part.D3[3 * i + 2];
    const dy = m[3] * part.D3[3 * i] + m[4] * part.D3[3 * i + 1] + m[5] * part.D3[3 * i + 2];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    out.flat[2 * i] = px;
    out.flat[2 * i + 1] = py;
    out.frames.push({ p: [px, py], nx, ny, half });
    out.left[2 * i] = px + nx * half;
    out.left[2 * i + 1] = py + ny * half;
    out.right[2 * i] = px - nx * half;
    out.right[2 * i + 1] = py - ny * half;
    const toward = nx * T3_SHINE[0] + ny * T3_SHINE[1];
    const shineAt = half * 0.44 * toward;
    const shineHalf = half * 0.24;
    out.shineA[2 * i] = px + nx * (shineAt + shineHalf);
    out.shineA[2 * i + 1] = py + ny * (shineAt + shineHalf);
    out.shineB[2 * i] = px + nx * (shineAt - shineHalf);
    out.shineB[2 * i + 1] = py + ny * (shineAt - shineHalf);
    const shadeAt = -half * 0.62 * toward;
    const shadeHalf = half * 0.2;
    out.shadeA[2 * i] = px + nx * (shadeAt + shadeHalf);
    out.shadeA[2 * i + 1] = py + ny * (shadeAt + shadeHalf);
    out.shadeB[2 * i] = px + nx * (shadeAt - shadeHalf);
    out.shadeB[2 * i + 1] = py + ny * (shadeAt - shadeHalf);
  }
  return out;
}

const t3Pts = (buf, n) => {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [buf[2 * i], buf[2 * i + 1]];
  return out;
};

function t3TubeCap(cam, centre, tangent, radius, inward) {
  const V = cam.V;
  const m = cam.m;
  let n1 = [tangent[1] * V[2] - tangent[2] * V[1], tangent[2] * V[0] - tangent[0] * V[2], tangent[0] * V[1] - tangent[1] * V[0]];
  if (Math.hypot(n1[0], n1[1], n1[2]) < 1e-6) {
    const helper = Math.abs(tangent[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    n1 = [helper[1] * tangent[2] - helper[2] * tangent[1], helper[2] * tangent[0] - helper[0] * tangent[2], helper[0] * tangent[1] - helper[1] * tangent[0]];
  }
  n1 = t3Unit(n1);
  const n2 = t3Unit([tangent[1] * n1[2] - tangent[2] * n1[1], tangent[2] * n1[0] - tangent[0] * n1[2], tangent[0] * n1[1] - tangent[1] * n1[0]]);
  const steps = 28;
  const proj = (p) => [cam.ox + m[0] * p[0] + m[1] * p[1] + m[2] * p[2], cam.oy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2]];
  const ring = new Array(steps);
  for (let index = 0; index < steps; index++) {
    const angle = (index / steps) * T3_TAU;
    const cs = radius * Math.cos(angle);
    const sn = radius * Math.sin(angle);
    ring[index] = proj([centre[0] + n1[0] * cs + n2[0] * sn, centre[1] + n1[1] * cs + n2[1] * sn, centre[2] + n1[2] * cs + n2[2] * sn]);
  }
  const C = proj(centre);
  const probe = proj([centre[0] + n2[0], centre[1] + n2[1], centre[2] + n2[2]]);
  const along = (probe[0] - C[0]) * inward[0] + (probe[1] - C[1]) * inward[1];
  const from = along > 0 ? steps / 2 : 0;
  const half = (start) => Array.from({ length: steps / 2 + 1 }, (_, index) => ring[(start + index) % steps]);
  return { ring, arc: half(from), inner: half((from + steps / 2) % steps) };
}

function t3StripeEnd(half, centre, nx, ny, from, to) {
  const offset = (p) => (p[0] - centre[0]) * nx + (p[1] - centre[1]) * ny;
  const values = half.map(offset);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const points = [];
  const cross = (k, level) => {
    const t = (level - values[k]) / (values[k + 1] - values[k] || 1e-9);
    return [half[k][0] + (half[k + 1][0] - half[k][0]) * t, half[k][1] + (half[k + 1][1] - half[k][1]) * t];
  };
  for (let k = 0; k < half.length; k++) {
    if (values[k] >= lo && values[k] <= hi) points.push(half[k]);
    if (k < half.length - 1) for (const level of [lo, hi]) if ((values[k] - level) * (values[k + 1] - level) < 0) points.push(cross(k, level));
  }
  return points
    .map((p) => [p, offset(p)])
    .sort((x, y) => (from > to ? y[1] - x[1] : x[1] - y[1]))
    .map(([p]) => p);
}

function t3EmitTube(run, cam, f) {
  const r = run.r;
  const sides = t3Sides(run.body, cam, r);
  const bands = run.stripe === run.body ? sides : t3Sides(run.stripe, cam, r);
  const n = sides.n;
  const left = t3Pts(sides.left, n);
  const right = t3Pts(sides.right, n);
  const loop = left.concat(right.slice().reverse());
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = Math.sign(area);
  let body = t3PathOf(loop, true);
  let edges = t3PathOf(left, false) + t3PathOf(right, false);
  const tips = [null, null];
  const last = n - 1;
  const quads = [];
  for (let i = 0; i < last; i++) quads.push([left[i], left[i + 1], right[i + 1], right[i]]);
  for (const side of [0, 1]) {
    if (!run.capped[side]) continue;
    const at = side ? last : 0;
    const other = side ? last - 1 : 1;
    const tangent = run.tips[side];
    const outward = side ? tangent : [-tangent[0], -tangent[1], -tangent[2]];
    const inward = [sides.flat[2 * other] - sides.flat[2 * at], sides.flat[2 * other + 1] - sides.flat[2 * at + 1]];
    const centre = [run.body.P3[3 * at], run.body.P3[3 * at + 1], run.body.P3[3 * at + 2]];
    const { ring, arc, inner } = t3TubeCap(cam, centre, tangent, r, inward);
    let ringArea = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      ringArea += a[0] * b[1] - b[0] * a[1];
    }
    body += t3PathOf(Math.sign(ringArea) === sign ? ring : ring.slice().reverse(), true);
    edges += t3PathOf(arc, false);
    const V = cam.V;
    const open = outward[0] * V[0] + outward[1] * V[1] + outward[2] * V[2] > 0;
    if (open) edges += t3PathOf(inner, false);
    tips[side] = { half: open ? inner : arc, frame: sides.frames[at] };
    quads.push(ring);
  }
  f.d[run.role.body] = body;
  f.d[run.role.edges] = edges;
  if (run.wide) {
    const toward = (frame) => frame.nx * T3_SHINE[0] + frame.ny * T3_SHINE[1];
    const shineOffsets = (frame) => [frame.half * 0.44 * toward(frame) + frame.half * 0.24, frame.half * 0.44 * toward(frame) - frame.half * 0.24];
    const shadeOffsets = (frame) => [-frame.half * 0.62 * toward(frame) + frame.half * 0.2, -frame.half * 0.62 * toward(frame) - frame.half * 0.2];
    const bn = bands.n;
    const band = (A, B, offsets) => {
      const head = tips[1] ? t3StripeEnd(tips[1].half, tips[1].frame.p, tips[1].frame.nx, tips[1].frame.ny, offsets(tips[1].frame)[0], offsets(tips[1].frame)[1]) : [];
      const tail = tips[0] ? t3StripeEnd(tips[0].half, tips[0].frame.p, tips[0].frame.nx, tips[0].frame.ny, offsets(tips[0].frame)[1], offsets(tips[0].frame)[0]) : [];
      return t3PathOf([...t3Pts(A, bn), ...head, ...t3Pts(B, bn).reverse(), ...tail], true);
    };
    f.d[run.role.shine] = band(bands.shineA, bands.shineB, shineOffsets);
    f.d[run.role.shade] = band(bands.shadeA, bands.shadeB, shadeOffsets);
  }
  if (run.rings) {
    const lines = t3Lines;
    lines.d.length = 0;
    lines.alpha.length = 0;
  lines.key.length = 0;
    lines.key.length = 0;
    const V = cam.V;
    const m = cam.m;
    const seg = new Float64Array(4);
    const surface = (sample, out, index) => {
      const T = sample.T;
      let n1 = [T[1] * V[2] - T[2] * V[1], T[2] * V[0] - T[0] * V[2], T[0] * V[1] - T[1] * V[0]];
      const l1 = Math.hypot(n1[0], n1[1], n1[2]);
      if (l1 < 1e-6) return null;
      n1 = [n1[0] / l1, n1[1] / l1, n1[2] / l1];
      let n2 = t3Unit([T[1] * n1[2] - T[2] * n1[1], T[2] * n1[0] - T[0] * n1[2], T[0] * n1[1] - T[1] * n1[0]]);
      if (n2[0] * V[0] + n2[1] * V[1] + n2[2] * V[2] < 0) n2 = [-n2[0], -n2[1], -n2[2]];
      const cs = Math.cos(sample.theta);
      const sn = Math.sin(sample.theta);
      const normal = [n1[0] * cs + n2[0] * sn, n1[1] * cs + n2[1] * sn, n1[2] * cs + n2[2] * sn];
      const p = [sample.c[0] + normal[0] * r, sample.c[1] + normal[1] * r, sample.c[2] + normal[2] * r];
      out[index] = cam.ox + m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
      out[index + 1] = cam.oy + m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
      return normal[0] * V[0] + normal[1] * V[1] + normal[2] * V[2];
    };
    const fade = run.rings.fade;
    let index = -1;
    for (const [a, b] of run.rings.segments) {
      index++;
      const fa = surface(a, seg, 0);
      const fb = surface(b, seg, 2);
      if (fa === null || fb === null) continue;
      const alpha = fade ? t3Step(fade[0], fade[1], (fa + fb) / 2) : 1;
      if (alpha * T3_LEVELS < 0.5) continue;
      lines.d.push(t3Path(seg, 2, false));
      lines.alpha.push(alpha);
      lines.key.push(index);
    }
    f.levels = t3Faded(f, run, "r", lines, lines.d.length);
  }
  const all = left.concat(right);
  t3BoxOf(all, f.box);
  for (const q of quads) for (const p of q) {
    if (p[0] < f.box[0]) f.box[0] = p[0];
    if (p[1] < f.box[1]) f.box[1] = p[1];
    if (p[0] > f.box[2]) f.box[2] = p[0];
    if (p[1] > f.box[3]) f.box[3] = p[1];
  }
  const list = f.quadList && f.quadList.length === quads.length ? f.quadList : (f.quadList = quads.map(() => [new Float64Array(0), 0]));
  for (let qi = 0; qi < quads.length; qi++) {
    const q = quads[qi];
    let entry = list[qi];
    if (entry[0].length < 2 * q.length) entry[0] = new Float64Array(2 * q.length);
    const buf = entry[0];
    for (let i = 0; i < q.length; i++) {
      buf[2 * i] = q[i][0];
      buf[2 * i + 1] = q[i][1];
    }
    entry[1] = q.length;
  }
  f.quadN = quads.length;
  f.quads = f.quadList;
  f.hullN = 0;
}

function t3Emit(run, cam, out) {
  const f = out ?? t3Frame(run);
  if (run.kind === "prism") t3EmitPrism(run, cam, f);
  else if (run.kind === "round") t3EmitRound(run, cam, f);
  else if (run.kind === "ball") t3EmitBall(run, cam, f);
  else if (run.kind === "lathe") t3EmitLathe(run, cam, f);
  else if (run.kind === "tube") {
    t3EmitTube(run, cam, f);
    return f;
  } else if (run.kind === "fixed") {
    t3EmitFixed(run, cam, f);
    return f;
  }
  t3EmitPlanes(run, cam, f);
  t3EmitDots(run, cam, f);
  return f;
}

function t3Overlap(a, b, pad) {
  return a[0] < b[2] - pad && b[0] < a[2] - pad && a[1] < b[3] - pad && b[1] < a[3] - pad;
}

function t3Apart(A, an, B, bn, pad) {
  for (let pass = 0; pass < 2; pass++) {
    const P = pass ? B : A;
    const pn = pass ? bn : an;
    for (let i = 0; i < pn; i++) {
      const j = (i + 1) % pn;
      const nx = P[2 * j + 1] - P[2 * i + 1];
      const ny = P[2 * i] - P[2 * j];
      const l = Math.hypot(nx, ny);
      if (l < 1e-9) continue;
      let a0 = Infinity;
      let a1 = -Infinity;
      for (let q = 0; q < an; q++) {
        const v = (A[2 * q] * nx + A[2 * q + 1] * ny) / l;
        if (v < a0) a0 = v;
        if (v > a1) a1 = v;
      }
      let b0 = Infinity;
      let b1 = -Infinity;
      for (let q = 0; q < bn; q++) {
        const v = (B[2 * q] * nx + B[2 * q + 1] * ny) / l;
        if (v < b0) b0 = v;
        if (v > b1) b1 = v;
      }
      if (a1 < b0 + pad || b1 < a0 + pad) return true;
    }
  }
  return false;
}

function t3Disjoint(fa, fb, pad) {
  const qa = fa.quadN ? fa.quads : null;
  const qb = fb.quadN ? fb.quads : null;
  if (!qa && !qb) return t3Apart(fa.hull, fa.hullN, fb.hull, fb.hullN, pad);
  const listA = qa ? fa.quadList : [[fa.hull, fa.hullN]];
  const listB = qb ? fb.quadList : [[fb.hull, fb.hullN]];
  for (const [A, an] of listA) for (const [B, bn] of listB) if (!t3Apart(A, an, B, bn, pad)) return false;
  return true;
}

function t3Support(cloud, R, t, dir, world) {
  let best = -Infinity;
  let at = 0;
  const n = cloud.length / 3;
  const dx = R[0] * dir[0] + R[3] * dir[1] + R[6] * dir[2];
  const dy = R[1] * dir[0] + R[4] * dir[1] + R[7] * dir[2];
  const dz = R[2] * dir[0] + R[5] * dir[1] + R[8] * dir[2];
  for (let i = 0; i < n; i++) {
    const v = cloud[3 * i] * dx + cloud[3 * i + 1] * dy + cloud[3 * i + 2] * dz;
    if (v > best) {
      best = v;
      at = i;
    }
  }
  const x = cloud[3 * at];
  const y = cloud[3 * at + 1];
  const z = cloud[3 * at + 2];
  world[0] = R[0] * x + R[1] * y + R[2] * z + t[0];
  world[1] = R[3] * x + R[4] * y + R[5] * z + t[1];
  world[2] = R[6] * x + R[7] * y + R[8] * z + t[2];
  return best + dir[0] * t[0] + dir[1] * t[1] + dir[2] * t[2];
}

function t3Gjk(cloudA, camA, cloudB, camB, warm, rounds = 8, hints = null) {
  let w = warm && (warm[0] || warm[1] || warm[2]) ? [warm[0], warm[1], warm[2]] : null;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  if (!w) {
    t3Support(cloudA, camA.R, camA.t, [1, 0, 0], a);
    t3Support(cloudB, camB.R, camB.t, [-1, 0, 0], b);
    w = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  }
  let margin = -Infinity;
  let best = w;
  const step = (limit) => {
    for (let it = 0; it < limit; it++) {
      const l = Math.hypot(w[0], w[1], w[2]);
      if (l < 1e-12) break;
      const n = [w[0] / l, w[1] / l, w[2] / l];
      const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
      const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
      const value = loB - hiA;
      if (value > margin) {
        margin = value;
        best = n;
      }
      const s = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ds = [w[0] - s[0], w[1] - s[1], w[2] - s[2]];
      const dd = ds[0] * ds[0] + ds[1] * ds[1] + ds[2] * ds[2];
      if (dd < 1e-14) break;
      const tt = Math.max(0, Math.min(1, (w[0] * ds[0] + w[1] * ds[1] + w[2] * ds[2]) / dd));
      w = [w[0] - ds[0] * tt, w[1] - ds[1] * tt, w[2] - ds[2] * tt];
    }
  };
  step(rounds);
  if (margin < 0) step(24);
  if (margin < 0.05 && hints) {
    if (hints.centroids) {
      const [ca, cb] = hints.centroids;
      const wa = [camA.R[0] * ca[0] + camA.R[1] * ca[1] + camA.R[2] * ca[2] + camA.t[0], camA.R[3] * ca[0] + camA.R[4] * ca[1] + camA.R[5] * ca[2] + camA.t[1], camA.R[6] * ca[0] + camA.R[7] * ca[1] + camA.R[8] * ca[2] + camA.t[2]];
      const wb = [camB.R[0] * cb[0] + camB.R[1] * cb[1] + camB.R[2] * cb[2] + camB.t[0], camB.R[3] * cb[0] + camB.R[4] * cb[1] + camB.R[5] * cb[2] + camB.t[1], camB.R[6] * cb[0] + camB.R[7] * cb[1] + camB.R[8] * cb[2] + camB.t[2]];
      const n = t3Unit([wb[0] - wa[0], wb[1] - wa[1], wb[2] - wa[2]]);
      const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
      const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
      if (loB - hiA > margin) {
        margin = loB - hiA;
        best = n;
      }
    }
    for (const [axis, cam] of hints) {
      const R = cam.R;
      const w0 = [R[0] * axis[0] + R[1] * axis[1] + R[2] * axis[2], R[3] * axis[0] + R[4] * axis[1] + R[5] * axis[2], R[6] * axis[0] + R[7] * axis[1] + R[8] * axis[2]];
      for (const sign of [1, -1]) {
        const n = [w0[0] * sign, w0[1] * sign, w0[2] * sign];
        const hiA = t3Support(cloudA, camA.R, camA.t, n, a);
        const loB = -t3Support(cloudB, camB.R, camB.t, [-n[0], -n[1], -n[2]], b);
        if (loB - hiA > margin) {
          margin = loB - hiA;
          best = n;
        }
      }
    }
  }
  const l = Math.hypot(best[0], best[1], best[2]) || 1;
  return { n: [best[0] / l, best[1] / l, best[2] / l], margin };
}

function t3Order(layer, frames, cams, previous, stats, scene) {
  const parts = layer.parts;
  const count = parts.length;
  const local = layer.local;
  const rank = layer._rank ?? (layer._rank = new Int32Array(count));
  if (previous) for (let at = 0; at < count; at++) rank[local.get(previous[at])] = at;
  else for (let at = 0; at < count; at++) rank[local.get(layer.rest[at])] = at;
  let groupEdges = 0;
  if (layer.groupPairs) for (const gp of layer.groupPairs) groupEdges += gp.a.length * gp.b.length;
  const maxEdges = layer.planar.length / 5 + (layer.framed ? layer.framed.length / 6 : 0) + groupEdges + layer.dynamic.length / 2 + (layer.free ? layer.free.length * count : 0) + 1;
  const head = layer._head ?? (layer._head = new Int32Array(count));
  const next = layer._next && layer._next.length >= maxEdges ? layer._next : (layer._next = new Int32Array(maxEdges));
  const to = layer._to && layer._to.length >= maxEdges ? layer._to : (layer._to = new Int32Array(maxEdges));
  const live = layer._live && layer._live.length >= maxEdges ? layer._live : (layer._live = new Uint8Array(maxEdges));
  const indeg = layer._indeg ?? (layer._indeg = new Int32Array(count));
  head.fill(-1);
  indeg.fill(0);
  let edges = 0;
  const addEdge = (back, front) => {
    to[edges] = front;
    next[edges] = head[back];
    live[edges] = 1;
    head[back] = edges;
    indeg[front]++;
    edges++;
  };
  const runs = scene ? scene.runs : null;
  const groupOf = (global) => (runs ? runs[global].group : -1);
  const planar = layer.planar;
  for (let p = 0; p < planar.length; p += 5) {
    const i = planar[p];
    const j = planar[p + 1];
    const fi = frames[i];
    const fj = frames[j];
    if (!t3Overlap(fi.box, fj.box, -0.05)) continue;
    const g = groupOf(i);
    const V = g >= 0 ? cams[g].V : cams.world.V;
    const s = planar[p + 2] * V[0] + planar[p + 3] * V[1] + planar[p + 4] * V[2];
    if (s < 1e-7 && s > -1e-7) continue;
    const li = local.get(i);
    const lj = local.get(j);
    if (s > 0) addEdge(li, lj);
    else addEdge(lj, li);
  }
  const framed = layer.framed;
  if (framed)
    for (let p = 0; p < framed.length; p += 6) {
      const i = framed[p];
      const j = framed[p + 1];
      if (!t3Overlap(frames[i].box, frames[j].box, -0.05)) continue;
      const g = framed[p + 2];
      const V = g >= 0 ? cams[g].V : cams.world.V;
      const s = framed[p + 3] * V[0] + framed[p + 4] * V[1] + framed[p + 5] * V[2];
      if (s < 1e-7 && s > -1e-7) continue;
      const li = local.get(i);
      const lj = local.get(j);
      if (s > 0) addEdge(li, lj);
      else addEdge(lj, li);
    }
  if (layer.groupPairs)
    for (const gp of layer.groupPairs) {
      const union = (list, box) => {
        box[0] = Infinity;
        box[1] = Infinity;
        box[2] = -Infinity;
        box[3] = -Infinity;
        for (let q = 0; q < list.length; q++) {
          const b = frames[list[q]].box;
          if (b[0] < box[0]) box[0] = b[0];
          if (b[1] < box[1]) box[1] = b[1];
          if (b[2] > box[2]) box[2] = b[2];
          if (b[3] > box[3]) box[3] = b[3];
        }
      };
      union(gp.a, gp.boxA);
      union(gp.b, gp.boxB);
      if (!t3Overlap(gp.boxA, gp.boxB, -0.05)) continue;
      const V = gp.frame >= 0 ? cams[gp.frame].V : cams.world.V;
      const s = gp.n[0] * V[0] + gp.n[1] * V[1] + gp.n[2] * V[2];
      if (s < 1e-7 && s > -1e-7) continue;
      for (let x = 0; x < gp.a.length; x++) {
        const i = gp.a[x];
        const bi = frames[i].box;
        if (!t3Overlap(bi, gp.boxB, -0.05)) continue;
        for (let y = 0; y < gp.b.length; y++) {
          const j = gp.b[y];
          if (!t3Overlap(bi, frames[j].box, -0.05)) continue;
          if (s > 0) addEdge(local.get(i), local.get(j));
          else addEdge(local.get(j), local.get(i));
        }
      }
    }
  const dynamic = layer.dynamic;
  let unseparated = 0;
  let solved = 0;
  const rel = layer.rel ?? (layer.rel = new Map());
  const cross = (i, j) => {
    const ri = runs[i];
    const rj = runs[j];
    const ci = ri.group >= 0 ? cams[ri.group] : cams.world;
    const cj = rj.group >= 0 ? cams[rj.group] : cams.world;
    const A = ci.R;
    const B = cj.R;
    const dx = cj.t[0] - ci.t[0];
    const dy = cj.t[1] - ci.t[1];
    const dz = cj.t[2] - ci.t[2];
    const key = i * 65536 + j;
    let memo = rel.get(key);
    if (!memo) {
      memo = { pose: new Float64Array(12), n: [0, 0, 0], margin: -Infinity, fresh: false };
      rel.set(key, memo);
    }
    const pose = memo.pose;
    let same = memo.fresh;
    let at = 0;
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) {
        const v = A[c] * B[r] + A[3 + c] * B[3 + r] + A[6 + c] * B[6 + r];
        if (same && Math.abs(pose[at] - v) > 1e-12) same = false;
        pose[at++] = v;
      }
    for (let c = 0; c < 3; c++) {
      const v = A[c] * dx + A[3 + c] * dy + A[6 + c] * dz;
      if (same && Math.abs(pose[at] - v) > 1e-9) same = false;
      pose[at++] = v;
    }
    let nx;
    let ny;
    let nz;
    if (same) {
      const n = memo.n;
      nx = A[0] * n[0] + A[1] * n[1] + A[2] * n[2];
      ny = A[3] * n[0] + A[4] * n[1] + A[5] * n[2];
      nz = A[6] * n[0] + A[7] * n[1] + A[8] * n[2];
    } else {
      const n = memo.n;
      const warm = memo.fresh ? [A[0] * n[0] + A[1] * n[1] + A[2] * n[2], A[3] * n[0] + A[4] * n[1] + A[5] * n[2], A[6] * n[0] + A[7] * n[1] + A[8] * n[2]] : null;
      const hints = [...ri.axes.map((axis) => [axis, ci]), ...rj.axes.map((axis) => [axis, cj]), [[0, 0, 1], cams.world]];
      hints.centroids = [ri.centroid, rj.centroid];
      const hit = t3Gjk(ri.cloud, ci, rj.cloud, cj, warm, 8, hints);
      solved++;
      nx = hit.n[0];
      ny = hit.n[1];
      nz = hit.n[2];
      n[0] = A[0] * nx + A[3] * ny + A[6] * nz;
      n[1] = A[1] * nx + A[4] * ny + A[7] * nz;
      n[2] = A[2] * nx + A[5] * ny + A[8] * nz;
      memo.margin = hit.margin;
      memo.fresh = true;
    }
    if (memo.margin < -0.08) unseparated++;
    const V = cams.world.V;
    return nx * V[0] + ny * V[1] + nz * V[2];
  };
  for (let p = 0; p < dynamic.length; p += 2) {
    const i = dynamic[p];
    const j = dynamic[p + 1];
    if (!t3Overlap(frames[i].box, frames[j].box, -0.05)) continue;
    const s = cross(i, j);
    if (s < 1e-7 && s > -1e-7) continue;
    const li = local.get(i);
    const lj = local.get(j);
    if (s > 0) addEdge(li, lj);
    else addEdge(lj, li);
  }
  const loose = layer.free;
  if (loose && loose.length) {
    const isLoose = layer.looseAt;
    for (let a = 0; a < loose.length; a++) {
      const i = loose[a];
      const gi = runs[i].group;
      const bi = frames[i].box;
      for (let b = 0; b < count; b++) {
        const j = parts[b];
        if (j === i || runs[j].group === gi) continue;
        if (isLoose[b] && j < i) continue;
        if (!t3Overlap(bi, frames[j].box, -0.05)) continue;
        const s = cross(i, j);
        if (s < 1e-7 && s > -1e-7) continue;
        const li = local.get(i);
        if (s > 0) addEdge(li, b);
        else addEdge(b, li);
      }
    }
  }
  const heap = layer._heap ?? (layer._heap = new Int32Array(count));
  const done = layer._done ?? (layer._done = new Uint8Array(count));
  done.fill(0);
  let size = 0;
  const less = (a, b) => rank[a] < rank[b];
  const push = (v) => {
    let i = size++;
    heap[i] = v;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      const tmp = heap[i];
      heap[i] = heap[p];
      heap[p] = tmp;
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--size];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let s = i;
      if (l < size && less(heap[l], heap[s])) s = l;
      if (r < size && less(heap[r], heap[s])) s = r;
      if (s === i) break;
      const tmp = heap[i];
      heap[i] = heap[s];
      heap[s] = tmp;
      i = s;
    }
    return top;
  };
  for (let v = 0; v < count; v++) if (indeg[v] === 0) push(v);
  const out = new Int32Array(count);
  let placed = 0;
  let forced = 0;
  let refined = 0;
  const checked = layer._checked && layer._checked.length >= maxEdges ? layer._checked : (layer._checked = new Uint8Array(maxEdges));
  checked.fill(0, 0, edges);
  const sourcePick = () => {
    // Iterative Kosaraju: one SCC/condensation computation per empty-heap event.
    // O(V + E) time and space; no recursive call stack or repeated cycle search.
    const seen = new Uint8Array(count);
    const cursor = new Int32Array(count);
    const stack = new Int32Array(count);
    const finish = [];
    const reverseHead = new Int32Array(count).fill(-1);
    const reverseNext = new Int32Array(edges);
    const from = new Int32Array(edges);
    for (let v = 0; v < count; v++) if (!done[v]) {
      for (let e = head[v]; e >= 0; e = next[e]) if (live[e] && !done[to[e]]) {
        from[e] = v;
        reverseNext[e] = reverseHead[to[e]];
        reverseHead[to[e]] = e;
      }
    }
    for (let root = 0; root < count; root++) {
      if (done[root] || seen[root]) continue;
      let top = 0;
      stack[top++] = root;
      seen[root] = 1;
      cursor[root] = head[root];
      while (top) {
        const v = stack[top - 1];
        let e = cursor[v];
        while (e >= 0 && (!live[e] || done[to[e]] || seen[to[e]])) e = next[e];
        cursor[v] = e < 0 ? -1 : next[e];
        if (e < 0) {
          finish.push(v);
          top--;
        } else {
          const w = to[e];
          seen[w] = 1;
          cursor[w] = head[w];
          stack[top++] = w;
        }
      }
    }
    const component = new Int32Array(count).fill(-1);
    let components = 0;
    for (let at = finish.length - 1; at >= 0; at--) {
      const root = finish[at];
      if (component[root] >= 0) continue;
      let top = 0;
      stack[top++] = root;
      component[root] = components;
      while (top) {
        const v = stack[--top];
        for (let e = reverseHead[v]; e >= 0; e = reverseNext[e]) {
          const w = from[e];
          if (component[w] >= 0) continue;
          component[w] = components;
          stack[top++] = w;
        }
      }
      components++;
    }
    const incoming = new Uint8Array(components);
    for (let v = 0; v < count; v++) if (!done[v]) {
      for (let e = head[v]; e >= 0; e = next[e]) if (live[e] && !done[to[e]] && component[v] !== component[to[e]]) incoming[component[to[e]]] = 1;
    }
    let pick = -1;
    for (let v = 0; v < count; v++) if (!done[v] && !incoming[component[v]] && (pick < 0 || indeg[v] < indeg[pick] || (indeg[v] === indeg[pick] && rank[v] < rank[pick]))) pick = v;
    return pick;
  };
  while (placed < count) {
    if (size === 0) {
      // O(V + E) per event; each initial edge is tested at most once per order.
      for (let a = 0; a < count; a++) if (!done[a]) {
        for (let e = head[a]; e >= 0; e = next[e]) {
          const b = to[e];
          if (!live[e] || done[b] || checked[e]) continue;
          checked[e] = 1;
          if (t3Disjoint(frames[parts[a]], frames[parts[b]], 0.1)) {
            live[e] = 0;
            indeg[b]--;
            refined++;
            if (indeg[b] === 0) push(b);
          }
        }
      }
      if (size) continue;
      // A source component cannot be an acyclic singleton: heap is empty.
      const pick = sourcePick();
      forced++;
      indeg[pick] = 0;
      push(pick);
    }
    const v = pop();
    if (done[v]) continue;
    done[v] = 1;
    out[placed++] = parts[v];
    for (let e = head[v]; e >= 0; e = next[e]) {
      if (!live[e]) continue;
      const w = to[e];
      if (done[w]) continue;
      if (--indeg[w] === 0) push(w);
    }
  }
  if (stats) {
    stats.edges = (stats.edges ?? 0) + edges;
    stats.forced = (stats.forced ?? 0) + forced;
    stats.refined = (stats.refined ?? 0) + refined;
    stats.unseparated = (stats.unseparated ?? 0) + unseparated;
    stats.solved = (stats.solved ?? 0) + solved;
  }
  return out;
}

function t3Keep(values) {
  const n = values.length;
  const tails = [];
  const tailAt = [];
  const back = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < values[i]) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = values[i];
    tailAt[lo] = i;
    back[i] = lo > 0 ? tailAt[lo - 1] : -1;
  }
  const keep = new Uint8Array(n);
  let k = tails.length ? tailAt[tails.length - 1] : -1;
  while (k >= 0) {
    keep[k] = 1;
    k = back[k];
  }
  return keep;
}

function t3Cams(scene, values) {
  const poses = t3Poses(scene.groups, values);
  const cams = poses.map((pose) => t3Camera(scene.P, pose));
  cams.world = t3Camera(scene.P, null);
  cams.poses = poses;
  return cams;
}

function t3Mount(stage, data, { onHold = null, onFrame = null, follow = null, painter = "svg", geometryTransactions = false } = {}) {
  const sourcePacket = data;
  if (geometryTransactions) data = structuredClone(data);
  void painter;
  const layerEls = new Map([...stage.querySelectorAll("svg[data-live]")].map((svg) => [svg.dataset.live, svg]));
  const first = layerEls.values().next().value;
  const viewWidth = first && first.viewBox && first.viewBox.baseVal ? first.viewBox.baseVal.width : 0;
  const unitOf = () => {
    const width = first ? first.getBoundingClientRect().width : 0;
    return viewWidth && width ? Math.round((width / viewWidth) * 100) / 100 : 1;
  };
  let unit = unitOf();
  let scene = t3Prepare(data, { unit });
  const runs = () => scene.runs;
  const count = data.parts.length;
  const nodes = new Array(count);
  const bound = new Array(count);
  const cache = new Array(count);
  const containers = new Map();
  for (const [name, svg] of layerEls) containers.set(name, svg.querySelector(".iso-parts") ?? svg);
  for (const run of scene.runs) {
    const layer = data.layers[run.layer];
    const container = containers.get(layer.name);
    const node = container ? container.querySelector(`[data-p="${run.index}"]`) : null;
    nodes[run.index] = node;
    const map = {};
    if (node) {
      map.move = node;
      node.querySelectorAll("[data-r]").forEach((el) => (map[el.getAttribute("data-r")] = el));
    }
    bound[run.index] = run.roles.map((role) => map[role.name] ?? null);
    cache[run.index] = run.roles.map(() => ({ d: null, q: null, b: null, f: null, w: null, t: null, o: null, cx: null, cy: null }));
  }
  // Capture authored literals before the constructor writes; null, empty and compact CSS are distinct.
  const authoredStyles = geometryTransactions ? bound.map((els) => els.map((el) => el ? el.getAttribute("style") : null)) : null;
  // One detached style declaration per opt-in mounter, never appended or used as a reference scene.
  const styleScratch = geometryTransactions && first ? first.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path") : null;
  let frames = scene.runs.map((run) => t3Frame(run));
  const values = Object.fromEntries(data.groups.map((g) => [g.name, data.values ? data.values[g.name] ?? 0 : 0]));
  let lastPoses = null;
  let cams = null;
  const orders = scene.layers.map((layer) => Int32Array.from(layer.rest));
  const changes = [];
  const stats = { ms: 0, writes: 0, moved: 0, forced: 0, refined: 0, unseparated: 0, emitted: 0 };
  let writes = 0;
  const writeFaceStyle = (el, memo, q, w) => {
    let changed = 0;
    if (memo.q !== q) {
      const band = Math.min(3, Math.floor(q / T3_Q)), mix = (q - T3_Q * band) / T3_Q;
      if (memo.f !== mix) {
        if (mix) el.style.setProperty("--f", String(mix));
        else el.style.removeProperty("--f");
        memo.f = mix;
        changed++;
      }
      memo.q = q;
    }
    if (memo.w !== w) {
      if (w < 0) el.style.removeProperty("stroke-width");
      else el.style.strokeWidth = String(w);
      memo.w = w;
      changed++;
    }
    return changed;
  };
  const write = (index) => {
    const run = scene.runs[index];
    const f = frames[index];
    const els = bound[index];
    const memo = cache[index];
    for (let r = 0; r < run.roles.length; r++) {
      const el = els[r];
      if (!el) continue;
      const role = run.roles[r];
      const c = memo[r];
      const type = role.type;
      if (type === "path" || type === "face" || type === "slot") {
        const d = f.d[r];
        if (c.d !== d) {
          el.setAttribute("d", d);
          c.d = d;
          writes++;
        }
        if (type === "face") {
          const q = f.q[r];
          if (c.q !== q) {
            const band = Math.min(3, Math.floor(q / T3_Q));
            if (c.b !== band) {
              el.setAttribute("data-b", String(band));
              c.b = band;
              writes++;
            }
          }
          writes += writeFaceStyle(el, c, q, f.w[r]);
        } else if (type === "slot") {
          const o = f.o[r];
          if (c.o !== o) {
            el.setAttribute("opacity", String(Math.round(o * 1000) / 1000));
            c.o = o;
            writes++;
          }
        }
      } else if (type === "xform" || type === "self" || type === "plane") {
        const t = f.t[r];
        if (c.t !== t) {
          if (t) el.setAttribute("transform", t);
          else el.removeAttribute("transform");
          c.t = t;
          writes++;
        }
        if (type === "plane") {
          const o = f.o[r];
          if (c.o !== o) {
            el.setAttribute("opacity", String(o));
            c.o = o;
            writes++;
          }
        }
      } else if (type === "dot") {
        const x = Math.round(f.cx[r] * 100) / 100;
        const y = Math.round(f.cy[r] * 100) / 100;
        const o = f.o[r];
        if (c.cx !== x) {
          el.setAttribute("cx", String(x));
          c.cx = x;
          writes++;
        }
        if (c.cy !== y) {
          el.setAttribute("cy", String(y));
          c.cy = y;
          writes++;
        }
        if (c.o !== o) {
          el.setAttribute("fill-opacity", String(o));
          c.o = o;
          writes++;
        }
      }
    }
  };
  const samePose = (a, b) => {
    if (!a || !b) return false;
    for (let i = 0; i < 9; i++) if (a.R[i] !== b.R[i]) return false;
    return a.t[0] === b.t[0] && a.t[1] === b.t[1] && a.t[2] === b.t[2];
  };
  let lastUnit = unit;
  let moved = 0;
  const evaluate = (targetScene, targetFrames, targetValues, previousOrders, previousPoses, fresh, targetDetail) => {
    const savedDetail = t3State.detail;
    try {
      const targetCams = t3Cams(targetScene, targetValues);
      t3State.detail = targetDetail;
      const poses = targetCams.poses;
      const emitted = [];
      for (const run of targetScene.runs) {
        const g = run.group;
        const changed = fresh || (g >= 0 ? !samePose(poses[g], previousPoses[g]) : false);
        if (!changed) continue;
        t3Emit(run, g >= 0 ? targetCams[g] : targetCams.world, targetFrames[run.index]);
        emitted.push(run.index);
      }
      const orderStats = { forced: 0, refined: 0, unseparated: 0, edges: 0 };
      const targetOrders = targetScene.layers.map((layer, index) =>
        t3Order(layer, targetFrames, targetCams, previousOrders[index], orderStats, targetScene));
      return { cams: targetCams, poses, emitted, orders: targetOrders, orderStats };
    } finally {
      t3State.detail = savedDetail;
    }
  };
  const reconcile = (evaluated = null) => {
    const t0 = performance.now();
    writes = 0;
    moved = 0;
    const result = evaluated ?? evaluate(scene, frames, values, orders, lastPoses, lastUnit !== unit || !lastPoses, detail);
    cams = result.cams;
    for (const index of result.emitted) {
      write(index);
      if (result.styleLiterals) for (let r = 0; r < scene.runs[index].roles.length; r++) {
        if (scene.runs[index].roles[r].type !== "face") continue;
        const el = bound[index][r];
        if (!el) continue;
        const literal = result.styleLiterals[index][r];
        if (el.getAttribute("style") !== literal) {
          if (literal === null) el.removeAttribute("style");
          else el.setAttribute("style", literal);
          writes++;
        }
      }
    }
    const emitted = result.emitted.length;
    lastPoses = result.poses;
    lastUnit = unit;
    const orderStats = result.orderStats;
    scene.layers.forEach((layer, index) => {
      const previous = orders[index];
      const order = result.orders[index];
      let same = true;
      for (let j = 0; j < order.length; j++)
        if (order[j] !== previous[j]) {
          same = false;
          break;
        }
      if (same) return;
      const container = containers.get(layer.name);
      const position = new Map();
      previous.forEach((global, at) => position.set(global, at));
      const keep = t3Keep(Array.from(order, (global) => position.get(global)));
      let after = null;
      const shifted = [];
      for (let j = order.length - 1; j >= 0; j--) {
        const node = nodes[order[j]];
        if (!keep[j] && node && container) {
          container.insertBefore(node, after);
          moved++;
          shifted.push(scene.runs[order[j]].name);
        }
        if (node) after = node;
      }
      orders[index] = order;
      if (shifted.length) changes.push({ layer: layer.name, moved: shifted });
    });
    stats.ms = performance.now() - t0;
    stats.writes = writes;
    stats.moved = moved;
    stats.forced = orderStats.forced;
    stats.refined = orderStats.refined;
    stats.unseparated = orderStats.unseparated;
    stats.emitted = emitted;
    if (onFrame) onFrame(controller);
    return { ...stats };
  };
  // The public render entry point must not accept a caller-provided evaluated frame/order.
  const render = () => reconcile();
  let detail = 1;
  const set = (next, options) => {
    if (options && options.detail !== undefined) {
      const value = Math.max(0, Math.min(1, options.detail));
      if (value !== detail) {
        detail = value;
        lastPoses = null;
      }
    }
    if (typeof next === "number") {
      const g = data.groups.find((group) => group.kind === "turn");
      if (g) values[g.name] = next;
    } else if (next) for (const [name, value] of Object.entries(next)) values[name] = value;
    if (follow) Object.assign(values, follow({ ...values }));
    return render();
  };
  // Opt-in only: accepted geometry never aliases the caller-owned source packet.
  const failGeometry = (reason) => { throw new Error("refreshGeometry: " + reason); };
  const finiteVector = (v, n) => (Array.isArray(v) || ArrayBuffer.isView(v)) && v.length === n && Array.from(v).every(Number.isFinite);
  const validateValues = (packet, next) => {
    if (!next || typeof next !== "object" || Array.isArray(next)) failGeometry("expected group values");
    for (const [name, value] of Object.entries(next)) {
      const group = packet.groups.find((g) => g.name === name);
      if (!group) failGeometry("unknown group");
      if (group.kind !== "free" || typeof value !== "object" || value === null) {
        if (!Number.isFinite(value)) failGeometry("invalid group value");
        continue;
      }
      if (Array.isArray(value) || Object.keys(value).some((key) => !["R", "q", "axis", "angle", "t", "world"].includes(key))) failGeometry("invalid free pose");
      for (const [key, n] of [["R", 9], ["q", 4], ["axis", 3], ["t", 3]])
        if (key in value && !finiteVector(value[key], n)) failGeometry("invalid free vector");
      if (("angle" in value && !Number.isFinite(value.angle)) || ("world" in value && typeof value.world !== "boolean")) failGeometry("invalid free pose scalar");
    }
  };
  const geometrySignature = (packet) => JSON.stringify({
    ...packet,
    parts: packet.parts.map((part) => {
      if (part.kind !== "prism") return part;
      const spec = { ...part.spec };
      const ring = spec.ring;
      if (!Array.isArray(ring) || ring.length < 6 || ring.length % 2 || !ring.every(Number.isFinite)) failGeometry("invalid ring");
      // Native up=1 uses z0/z1; up=0 uses F/s0/s1. Only ring and up=1 z coordinates are mutable.
      const required = spec.up ? ["z0", "z1"] : ["s0", "s1"];
      for (const key of required) if (!Object.hasOwn(spec, key) || !Number.isFinite(spec[key])) failGeometry("missing/nonfinite " + key);
      if (!spec.up && (!spec.F || ["o", "a", "u", "v"].some((key) => !finiteVector(spec.F[key], 3)))) failGeometry("invalid prism frame");
      spec.ring = { length: ring.length };
      if (spec.up) { spec.z0 = "finite"; spec.z1 = "finite"; }
      return { ...part, spec };
    }),
  });
  const fixedGeometrySignature = geometryTransactions ? geometrySignature(data) : null;
  const evaluateStyles = (targetScene, targetFrames, emitted, prior = null) => {
    if (!styleScratch) return null;
    const state = prior ?? {
      literals: authoredStyles.map((roles) => roles.slice()),
      memo: targetScene.runs.map((run) => run.roles.map(() => ({ q: null, f: null, w: null }))),
    };
    for (const index of emitted) {
      const run = targetScene.runs[index], f = targetFrames[index];
      for (let r = 0; r < run.roles.length; r++) {
        if (run.roles[r].type !== "face" || !bound[index][r]) continue;
        const literal = state.literals[index][r];
        if (literal === null) styleScratch.removeAttribute("style");
        else styleScratch.setAttribute("style", literal);
        writeFaceStyle(styleScratch, state.memo[index][r], f.q[r], f.w[r]);
        state.literals[index][r] = styleScratch.getAttribute("style");
      }
    }
    return state;
  };
  const validateComputed = (nextFrames, nextCams) => {
    const finite = (v) => {
      if (typeof v === "number") return Number.isFinite(v);
      if (typeof v === "string") return !/NaN|Infinity/.test(v);
      if (!v || typeof v !== "object") return true;
      return Object.values(v).every(finite);
    };
    if (!finite(nextFrames) || !finite(nextCams)) failGeometry("nonfinite computed frame/camera");
  };
  const refreshGeometry = (nextGroupValues, options) => {
    if (!geometryTransactions) failGeometry("mount requires geometryTransactions:true");
    const packet = structuredClone(sourcePacket);
    if (geometrySignature(packet) !== fixedGeometrySignature) failGeometry("fixed topology/metadata changed");
    const prepared = t3Prepare(packet, { unit });
    if (prepared.runs.length !== scene.runs.length || prepared.runs.some((run, i) => {
      const old = scene.runs[i];
      return run.index !== old.index || run.name !== old.name || run.group !== old.group || run.layer !== old.layer ||
        run.roles.length !== old.roles.length || run.roles.some((role, j) => role.name !== old.roles[j].name || role.type !== old.roles[j].type);
    })) failGeometry("prepared role topology changed");
    const nextFrames = prepared.runs.map((run) => t3Frame(run));
    const nextValues = Object.fromEntries(packet.groups.map((g) => [g.name, packet.values ? packet.values[g.name] ?? 0 : 0]));
    validateValues(packet, nextValues);
    if (follow) Object.assign(nextValues, follow({ ...nextValues }));
    validateValues(packet, nextValues);
    const construction = evaluate(prepared, nextFrames, nextValues, prepared.layers.map((layer) => Int32Array.from(layer.rest)), null, true, 1);
    validateComputed(nextFrames, construction.cams);
    const constructionStyles = evaluateStyles(prepared, nextFrames, construction.emitted);
    if (nextGroupValues != null) {
      validateValues(packet, nextGroupValues);
      Object.assign(nextValues, structuredClone(nextGroupValues));
    }
    if (follow) Object.assign(nextValues, follow({ ...nextValues }));
    validateValues(packet, nextValues);
    const achievedDetail = options && options.detail !== undefined ? Math.max(0, Math.min(1, options.detail)) : detail;
    if (!Number.isFinite(achievedDetail)) failGeometry("invalid detail");
    const achieved = evaluate(prepared, nextFrames, nextValues, construction.orders, construction.poses, achievedDetail !== 1, achievedDetail);
    validateComputed(nextFrames, achieved.cams);
    const achievedStyles = evaluateStyles(prepared, nextFrames, achieved.emitted, constructionStyles);
    achieved.styleLiterals = achievedStyles ? achievedStyles.literals : null;
    // Commit only after both phases validate. Existing writer/cache/bindings/LIS remain authoritative.
    data = packet;
    scene = prepared;
    frames = nextFrames;
    detail = achievedDetail;
    Object.keys(values).forEach((key) => delete values[key]);
    Object.assign(values, nextValues);
    achieved.emitted = prepared.runs.map((run) => run.index);
    return reconcile(achieved);
  };
  let unwrap = new Map();
  const angleAt = (clientX, clientY, z = 0, groupName) => {
    const svg = first;
    const box = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = vb.x + ((clientX - box.left) / box.width) * vb.width;
    const y = vb.y + ((clientY - box.top) / box.height) * vb.height;
    const c = t3Camera(scene.P, null);
    const p = (x - c.ox) / c.k;
    const q = (y - c.oy + z * c.ce * c.k) / (c.se * c.k);
    const wx = p * c.sa + q * c.ca;
    const wy = -p * c.ca + q * c.sa;
    const group = data.groups.find((g) => g.name === groupName) ?? data.groups.find((g) => g.kind === "turn");
    const pivot = group ? group.origin : [0, 0, 0];
    const raw = (Math.atan2(wy - pivot[1], wx - pivot[0]) * 180) / Math.PI;
    const key = group ? group.name : "";
    const last = unwrap.get(key);
    let angle = raw;
    if (last !== undefined) angle = last + ((((raw - last) % 360) + 540) % 360) - 180;
    unwrap.set(key, angle);
    return angle;
  };
  const observer = typeof ResizeObserver === "function" && first
    ? new ResizeObserver(() => {
        const next = unitOf();
        if (Math.abs(next - unit) < 0.05) return;
        unit = next;
        scene = t3Prepare(data, { unit });
        render();
      })
    : null;
  if (observer) observer.observe(first);
  if (follow) Object.assign(values, follow({ ...values }));
  const controller = {
    refreshGeometry,
    set,
    render,
    angleAt,
    get values() {
      return { ...values };
    },
    cover: (names, options) => t3Cover(controller, names, options),
    order: (name) => {
      const index = name === undefined ? 0 : scene.layers.findIndex((layer) => layer.name === name);
      return index < 0 ? [] : Array.from(orders[index], (global) => scene.runs[global].name);
    },
    orderIndex: (name) => {
      const index = name === undefined ? 0 : scene.layers.findIndex((layer) => layer.name === name);
      return index < 0 ? null : orders[index];
    },
    events: () => changes.splice(0, changes.length),
    stats: () => ({ ...stats }),
    frames: () => frames,
    cams: () => cams,
    scene: () => scene,
    pose: (name) => t3PoseOf(scene, cams, name),
    detach: (name) => {
      const index = scene.groups.findIndex((g) => g.name === name);
      const pose = t3PoseOf(scene, cams, name);
      const o = scene.groups[index].origin;
      return { world: true, R: pose.R, t: [pose.t[0] - o[0], pose.t[1] - o[1], pose.t[2] - o[2]] };
    },
    anchor: (name, point, direction) => t3Anchor(scene, cams, name, point, direction),
    destroy: () => {
      if (observer) observer.disconnect();
      if (typeof window !== "undefined" && window.__isoTurn && window.__isoTurn.controller === controller) delete window.__isoTurn;
    },
  };
  const hold = () => {
    if (onHold) onHold();
  };
  if (typeof window !== "undefined") {
    window.__isoTurn = {
      controller,
      set(next) {
        hold();
        return set(next);
      },
      get() {
        hold();
        return { ...values };
      },
      order(name) {
        hold();
        return controller.order(name);
      },
      events() {
        hold();
        return controller.events();
      },
      stats() {
        hold();
        return controller.stats();
      },
      layers() {
        hold();
        return scene.layers.map((layer) => layer.name);
      },
    };
  }
  render();
  return controller;
}

function t3Enclose(points, edges) {
  const hull = t3Hull(points);
  const n = hull.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) area += hull[i][0] * hull[(i + 1) % n][1] - hull[(i + 1) % n][0] * hull[i][1];
  const sign = area >= 0 ? 1 : -1;
  let lines = [];
  for (let i = 0; i < n; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    const nx = (sign * dy) / l;
    const ny = (-sign * dx) / l;
    lines.push([nx, ny, -(nx * p[0] + ny * p[1])]);
  }
  const meet = (A, B) => {
    const det = A[0] * B[1] - A[1] * B[0];
    if (Math.abs(det) < 1e-12) return null;
    return [(-A[2] * B[1] + B[2] * A[1]) / det, (-A[0] * B[2] + B[0] * A[2]) / det];
  };
  while (lines.length > edges) {
    let best = -1;
    let cost = Infinity;
    const m = lines.length;
    for (let i = 0; i < m; i++) {
      const prev = lines[(i - 1 + m) % m];
      const self = lines[i];
      const next = lines[(i + 1) % m];
      const turn = prev[0] * next[1] - prev[1] * next[0];
      if (sign * turn <= 1e-9) continue;
      const apex = meet(prev, next);
      const a = meet(prev, self);
      const b = meet(self, next);
      if (!apex || !a || !b) continue;
      const added = Math.abs((a[0] - apex[0]) * (b[1] - apex[1]) - (a[1] - apex[1]) * (b[0] - apex[0])) / 2;
      if (added < cost) {
        cost = added;
        best = i;
      }
    }
    if (best < 0) break;
    lines.splice(best, 1);
  }
  return lines;
}

function t3Cover(controller, names, { polygons = 6, edges = 10, pad = 0.3, layers = null } = {}) {
  const uCoverEdge = new Float32Array(polygons * edges * 3);
  const uCoverCount = new Float32Array(polygons);
  const scene = controller.scene();
  const frames = controller.frames();
  const sets = Array.isArray(names) ? (names.length && Array.isArray(names[0]) ? names : [names]) : [[names]];
  const candidates = [];
  const taken = new Set();
  for (const list of sets) {
    const targets = scene.runs.filter((run) => list.includes(run.name));
    if (!targets.length) continue;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const run of targets) {
      const b = frames[run.index].box;
      box[0] = Math.min(box[0], b[0]);
      box[1] = Math.min(box[1], b[1]);
      box[2] = Math.max(box[2], b[2]);
      box[3] = Math.max(box[3], b[3]);
    }
    const home = targets[0].layer;
    scene.layers.forEach((layer, index) => {
      const order = controller.orderIndex(layer.name);
      if (!order) return;
      let from = 0;
      if (index === home) {
        for (let at = 0; at < order.length; at++) if (targets.some((run) => run.index === order[at])) from = at + 1;
      } else if (!(layers && layers.includes(layer.name)) || index < home) return;
      for (let at = from; at < order.length; at++) {
        const run = scene.runs[order[at]];
        if (list.includes(run.name) || taken.has(run.index)) continue;
        const f = frames[run.index];
        const b = f.box;
        if (!(b[0] < box[2] + pad && box[0] < b[2] + pad && b[1] < box[3] + pad && box[1] < b[3] + pad)) continue;
        if (!targets.some((target) => !t3Disjoint(frames[target.index], f, -pad))) continue;
        taken.add(run.index);
        const share = (Math.min(b[2], box[2]) - Math.max(b[0], box[0])) * (Math.min(b[3], box[3]) - Math.max(b[1], box[1]));
        candidates.push({ run, f, share });
      }
    });
  }
  candidates.sort((a, b) => b.share - a.share);
  const parts = [];
  let slot = 0;
  for (const { run, f } of candidates) {
    if (slot >= polygons) break;
    const points = [];
    if (f.quadN) for (const [buf, count] of f.quadList) for (let i = 0; i < count; i++) points.push([buf[2 * i], buf[2 * i + 1]]);
    else for (let i = 0; i < f.hullN; i++) points.push([f.hull[2 * i], f.hull[2 * i + 1]]);
    const lines = t3Enclose(points, edges);
    if (!lines.length) continue;
    lines.forEach((line, e) => {
      const at = (slot * edges + e) * 3;
      uCoverEdge[at] = line[0];
      uCoverEdge[at + 1] = line[1];
      uCoverEdge[at + 2] = line[2] - pad;
    });
    uCoverCount[slot] = lines.length;
    parts.push(run.name);
    slot++;
  }
  return { uCoverEdge, uCoverCount, dropped: Math.max(0, candidates.length - slot), parts };
}

function t3PoseOf(scene, cams, name) {
  const index = scene.groups.findIndex((g) => g.name === name);
  const cam = index >= 0 && cams ? cams[index] : null;
  return { R: cam ? Array.from(cam.R) : Array.from(T3_EYE), t: cam ? [cam.t[0], cam.t[1], cam.t[2]] : [0, 0, 0] };
}

function t3Anchor(scene, cams, name, point, direction) {
  const index = name === null || name === undefined ? -1 : scene.groups.findIndex((g) => g.name === name);
  const cam = index >= 0 ? cams[index] : cams.world;
  const o = index >= 0 ? scene.groups[index].origin : [0, 0, 0];
  const R = cam.R;
  const q = [point[0] - o[0], point[1] - o[1], point[2] - o[2]];
  const world = [R[0] * q[0] + R[1] * q[1] + R[2] * q[2] + cam.t[0], R[3] * q[0] + R[4] * q[1] + R[5] * q[2] + cam.t[1], R[6] * q[0] + R[7] * q[1] + R[8] * q[2] + cam.t[2]];
  const w = cams.world;
  const screen = [w.ox + w.m[0] * world[0] + w.m[1] * world[1] + w.m[2] * world[2], w.oy + w.m[3] * world[0] + w.m[4] * world[1] + w.m[5] * world[2]];
  const out = { world, screen };
  if (direction) out.direction = [R[0] * direction[0] + R[1] * direction[1] + R[2] * direction[2], R[3] * direction[0] + R[4] * direction[1] + R[5] * direction[2], R[6] * direction[0] + R[7] * direction[1] + R[8] * direction[2]];
  return out;
}

function t3FloorOf(scene, name, R = T3_EYE) {
  const index = scene.groups.findIndex((g) => g.name === name);
  let low = Infinity;
  for (const run of scene.runs) {
    if (run.group !== index) continue;
    const c = run.cloud;
    for (let i = 0; i < c.length; i += 3) {
      const z = R[6] * c[i] + R[7] * c[i + 1] + R[8] * c[i + 2];
      if (z < low) low = z;
    }
  }
  return low;
}

function t3Compose(A, B) {
  return Array.from(t3Mul(A, B));
}

function t3PoseUniforms(controller, group, prefix = "uGroup") {
  const scene = controller.scene();
  const index = scene.groups.findIndex((g) => g.name === group);
  const cams = controller.cams();
  const cam = index >= 0 && cams ? cams[index] : null;
  const R = cam ? cam.R : T3_EYE;
  const t = cam ? cam.t : [0, 0, 0];
  const o = index >= 0 ? scene.groups[index].origin : [0, 0, 0];
  const T = [t[0] - (R[0] * o[0] + R[1] * o[1] + R[2] * o[2]), t[1] - (R[3] * o[0] + R[4] * o[1] + R[5] * o[2]), t[2] - (R[6] * o[0] + R[7] * o[1] + R[8] * o[2])];
  return { [`${prefix}X`]: [R[0], R[3], R[6]], [`${prefix}Y`]: [R[1], R[4], R[7]], [`${prefix}Z`]: [R[2], R[5], R[8]], [`${prefix}T`]: T };
}

const T3_MAT_KEYS = ["paper", "face", "top", "shade-0", "shade-1", "shade-2", "shade-3", "lit-top", "lit-shade", "hi", "mid", "lo", "faint", "dot", "lit"];
const T3_MAT_TUBE = ["body", "shine", "shade", "edge"];

const T3_MATERIALS = {
  gold: {
    light: ["#d3bb88", "#e4d2a8", "#f1e5c6", "#a1844f", "#bc9f69", "#d3bb88", "#e4d2a8", "#f8efd8", "#dfcb9c", "#4b3920", "#86693f", "#a98c5b", "#c1a676", "#4a381f", "#2a1d0c", "#cdb07a", "#f3e8cc", "#8e7044", "#4b3920"],
    dark: ["#3f3521", "#4b3f28", "#5a4c31", "#2b2416", "#352c1b", "#3f3521", "#4b3f28", "#6a5a3b", "#4f4329", "#e6d2a3", "#8a7550", "#5e4e33", "#463a26", "#e6d2a3", "#fff3d6", "#4a3e27", "#8c7853", "#251f13", "#e6d2a3"],
  },
  chrome: {
    light: ["#8e959c", "#c3c8cd", "#f7f8f9", "#a2a9b0", "#6f767d", "#454b52", "#cacfd4", "#ffffff", "#bcc2c8", "#202428", "#585e65", "#878d94", "#a9afb5", "#2a2e33", "#000000", "#8b9299", "#fbfcfd", "#3c4248", "#202428"],
    dark: ["#2a2e32", "#4a5056", "#6e757c", "#2e3236", "#24272b", "#1a1d20", "#4a5056", "#848b92", "#3a3f44", "#dfe3e7", "#7c838a", "#4d5359", "#363b40", "#e4e7ea", "#ffffff", "#34393e", "#9aa1a8", "#16191b", "#dfe3e7"],
  },
  steel: {
    light: ["#b8bdc1", "#cdd1d4", "#e5e8ea", "#8f959b", "#a4aaaf", "#b8bdc1", "#cdd1d4", "#f1f3f4", "#c6cacd", "#2b2f33", "#6b7177", "#959ba1", "#aeb3b8", "#33373b", "#000000", "#b3b8bd", "#eef0f2", "#7d8389", "#2b2f33"],
    dark: ["#2c3034", "#34393d", "#3e4348", "#1f2225", "#25292c", "#2c3034", "#34393d", "#4a5056", "#33383c", "#d0d4d8", "#727980", "#4a5056", "#33383d", "#d8dce0", "#ffffff", "#30353a", "#5c6369", "#1a1d20", "#d0d4d8"],
  },
  gunmetal: {
    light: ["#444a51", "#50575e", "#5f666e", "#2f3439", "#393f45", "#444a51", "#50575e", "#6d757d", "#4b5258", "#0f1113", "#1d2125", "#272b30", "#30353a", "#b0b5ba", "#000000", "#3d4349", "#6e757c", "#24282c", "#0f1113"],
    dark: ["#1d2125", "#22272b", "#2a2f34", "#15181b", "#191c20", "#1d2125", "#22272b", "#323840", "#20252a", "#a9b0b7", "#5c636a", "#3a4046", "#2a2f34", "#b8bec4", "#ffffff", "#1f2327", "#3a4046", "#111316", "#a9b0b7"],
  },
  rubber: {
    light: ["#2a2b2e", "#34363a", "#46484d", "#1b1c1e", "#222326", "#2a2b2e", "#34363a", "#55575c", "#2f3134", "#070708", "#111214", "#18191b", "#1f2023", "#6a6c70", "#000000", "#27282b", "#5b5d62", "#121314", "#050506"],
    dark: ["#121213", "#161618", "#1c1c1f", "#0c0c0d", "#0f0f10", "#121213", "#161618", "#232327", "#141416", "#8c8e92", "#4a4c50", "#2c2d30", "#1f2023", "#9a9ca0", "#ffffff", "#131315", "#2b2c30", "#0a0a0b", "#8c8e92"],
  },
  brass: {
    light: ["#bd9646", "#d2ad5b", "#e6c87e", "#8a6a2c", "#a47f38", "#bd9646", "#d2ad5b", "#f0d796", "#c8a252", "#3f2e0e", "#765a24", "#9a7a3c", "#b08c46", "#3a2a0c", "#1f1606", "#b8913f", "#efd795", "#7d5f26", "#3f2e0e"],
    dark: ["#3d3017", "#49391c", "#574523", "#2a210f", "#332813", "#3d3017", "#49391c", "#66522b", "#45371b", "#e9cf8a", "#8e7438", "#5e4c25", "#44371c", "#e9cf8a", "#fff0c8", "#433419", "#8a6f36", "#21190b", "#e9cf8a"],
  },
  copper: {
    light: ["#b3633e", "#c9784f", "#df9670", "#7c4128", "#9a5132", "#b3633e", "#c9784f", "#eaa985", "#be6d46", "#3a1a0c", "#6e3820", "#925037", "#a65d3f", "#3a1a0c", "#1c0b04", "#ad5f3b", "#f0b896", "#6e3720", "#3a1a0c"],
    dark: ["#3d1f13", "#492617", "#582e1c", "#2a160d", "#331a10", "#3d1f13", "#492617", "#673722", "#432215", "#eaa985", "#8f5236", "#5f3624", "#45271a", "#eaa985", "#ffe0cc", "#42221a", "#8a4c31", "#1f0f08", "#eaa985"],
  },
};

function t3MaterialCss() {
  const rules = [];
  const block = (values) => T3_MAT_KEYS.map((key, i) => `--anatomy-${key}:${values[i]}`).concat(T3_MAT_TUBE.map((key, i) => `--mat-${key}:${values[T3_MAT_KEYS.length + i]}`)).join(";");
  for (const [name, { light, dark }] of Object.entries(T3_MATERIALS)) {
    rules.push(`[data-mat="${name}"]{${block(dark)}}`);
    rules.push(`.iso[data-theme="light"] [data-mat="${name}"]{${block(light)}}`);
    rules.push(`.iso[data-theme="dark"] [data-mat="${name}"]{${block(dark)}}`);
  }
  rules.push("[data-mat] .tb-body{fill:var(--mat-body)}");
  rules.push("[data-mat] .tb-shine{fill:var(--mat-shine)}");
  rules.push("[data-mat] .tb-shade{fill:var(--mat-shade)}");
  rules.push("[data-mat] .tb-edge{stroke:var(--mat-edge)}");
  return rules.join("\n");
}

function t3Css() {
  const rules = [];
  const ramp = "--tn-0:var(--anatomy-shade-0);--tn-1:var(--anatomy-shade-1);--tn-2:var(--anatomy-shade-2);--tn-3:var(--anatomy-shade-3);--tn-4:var(--anatomy-top)";
  rules.push(`.iso-live{${ramp}}`);
  rules.push(`.iso-live [data-mat]{${ramp}}`);
  rules.push(".iso-live [data-lit]{--tn-0:var(--anatomy-lit-shade);--tn-1:var(--anatomy-lit-shade);--tn-2:var(--anatomy-lit-shade);--tn-3:var(--anatomy-lit-shade);--tn-4:var(--anatomy-lit-top)}");
  const colour = "color-mix(in srgb,var(--ta) calc(100% - var(--f,0) * 100%),var(--tb))";
  rules.push(`.iso-tn{stroke-width:.4;stroke-linejoin:round;--ta:var(--tn-0);--tb:var(--tn-1);fill:${colour};stroke:${colour}}`);
  for (let i = 1; i < 4; i++) rules.push(`.iso-tn[data-b="${i}"]{--ta:var(--tn-${i});--tb:var(--tn-${i + 1})}`);
  rules.push(t3MaterialCss());
  for (const hue of ["red", "green", "blue"]) rules.push(`.tb[data-hue="${hue}"]{--tb-ink:var(--anatomy-${hue})}`);
  rules.push(".tb[data-hue] .tb-body{fill:color-mix(in srgb,var(--tb-ink) 54%,var(--anatomy-shade-2))}");
  rules.push(".tb[data-hue] .tb-shine{fill:color-mix(in srgb,var(--tb-ink) 16%,var(--anatomy-top))}");
  rules.push(".tb[data-hue] .tb-shade{fill:color-mix(in srgb,var(--tb-ink) 30%,var(--anatomy-hi))}");
  rules.push(".tb[data-hue] .tb-edge{stroke:color-mix(in srgb,var(--tb-ink) 38%,var(--anatomy-hi))}");
  rules.push(".tb[data-hue][data-mat] .tb-body{fill:color-mix(in srgb,var(--tb-ink) 62%,var(--mat-body))}");
  rules.push(".tb[data-hue][data-mat] .tb-shine{fill:color-mix(in srgb,var(--tb-ink) 22%,var(--mat-shine))}");
  rules.push(".tb[data-hue][data-mat] .tb-shade{fill:color-mix(in srgb,var(--tb-ink) 46%,var(--mat-shade))}");
  rules.push(".tb[data-hue][data-mat] .tb-edge{stroke:color-mix(in srgb,var(--tb-ink) 30%,var(--mat-edge))}");
  rules.push(".iso-turn{position:relative}");
  rules.push(".iso-turn>.iso-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}");
  return rules.join("\n");
}

const TURN = { materials: Object.keys(T3_MATERIALS), materialCss: t3MaterialCss, rotation: (axis, degrees) => Array.from(t3Rot(axis, degrees)), quat: (q) => Array.from(t3Quat(q)), compose: t3Compose, floorOf: t3FloorOf, anchor: t3Anchor, camera: t3Camera, poses: t3PosesMap, prepare: t3Prepare, emit: t3Emit, order: t3Order, mount: t3Mount, cover: t3Cover, poseUniforms: t3PoseUniforms, css: t3Css, frame: t3Frame, cams: t3Cams, gjk: t3Gjk, hintsOf: (ri, ci, rj, cj, world) => Object.assign([...ri.axes.map((axis) => [axis, ci]), ...rj.axes.map((axis) => [axis, cj]), [[0, 0, 1], world]], { centroids: [ri.centroid, rj.centroid] }), disjoint: t3Disjoint, levels: T3_LEVELS, q: T3_Q, exact: (on) => { t3State.exact = Boolean(on); } };
const TURN_CSS = t3Css();

return {TURN,TURN_CSS};
})(void 0);
modules["turn-build"] = (function(window){
const { TURN, TURN_CSS } = modules["turn"];
const k = modules["iso-kit"];
const G = modules["lathe"];
const A = modules["audit"];
const TAU = Math.PI * 2;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r3 = (v) => Math.round(v * 1e3) / 1e3;
const pack3 = (value) => JSON.parse(JSON.stringify(value, (key, v) => (typeof v === "number" ? r3(v) : v instanceof Float64Array || v instanceof Float32Array ? Array.from(v, r3) : v)));
const pack = (value) => JSON.parse(JSON.stringify(value, (key, v) => (typeof v === "number" ? r4(v) : v instanceof Float64Array || v instanceof Float32Array ? Array.from(v, r4) : v)));
// Encoding policy belongs to native prism identities, not geometry or serialized ABI fields.
const precisePrismFrames = new WeakSet();
const losslessPrismRings = new WeakSet();
// QA candidate: preserves created finite binary64 native F/ring/s0/s1 values
// in this producer runtime, not authored-input identity or cross-engine libm
// determinism. JSON loses the -0 sign. Not a decoded-frame reconstruction API;
// cuts/bevel/details keep old policy; contact/full-render claims remain UNKNOWN.
// Material policy is per part, never an ABI field.
const losslessPrismMaterials = new WeakSet();

function packPrismParts(parts, sourceParts) {
  const axes = new WeakSet();
  const rings = new WeakSet();
  const materialArrays = new WeakSet();
  const materialSpecs = new WeakSet();
  let staged = null;
  sourceParts.forEach((part, index) => {
    const frame6 = precisePrismFrames.has(part);
    const lossless = losslessPrismRings.has(part);
    const material = losslessPrismMaterials.has(part);
    if (!frame6 && !lossless && !material) return;
    const item = parts[index];
    const spec = { ...item.spec };
    if (material) {
      spec.F = { ...spec.F };
      for (const key of ["o", "a", "u", "v"]) {
        spec.F[key] = Array.from(spec.F[key]);
        materialArrays.add(spec.F[key]);
      }
      spec.ring = Array.from(spec.ring);
      materialArrays.add(spec.ring);
      materialSpecs.add(spec);
    }
    if (frame6 && spec.F) {
      spec.F = { ...spec.F, a: Array.from(spec.F.a), u: Array.from(spec.F.u), v: Array.from(spec.F.v) };
      for (const axis of [spec.F.a, spec.F.u, spec.F.v]) axes.add(axis);
    }
    if (lossless) {
      spec.ring = Array.from(spec.ring);
      rings.add(spec.ring);
    }
    if (!material && !lossless && !spec.F) return;
    if (!staged) staged = parts.slice();
    staged[index] = { ...item, spec };
  });
  if (!staged) return pack3(parts);
  return JSON.parse(JSON.stringify(staged, function (key, value) {
    if (typeof value === "number") {
      if (materialArrays.has(this) || (materialSpecs.has(this) && (key === "s0" || key === "s1"))) return value;
      return rings.has(this) ? value : axes.has(this) ? Math.round(value * 1e6) / 1e6 : r3(value);
    }
    return value instanceof Float64Array || value instanceof Float32Array ? Array.from(value, r3) : value;
  }));
}

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function octOf(n) {
  const l = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) || 1;
  let x = n[0] / l;
  let y = n[1] / l;
  if (n[2] < 0) {
    const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    x = ox;
    y = oy;
  }
  return [Math.round((x * 0.5 + 0.5) * 65535), Math.round((y * 0.5 + 0.5) * 65535)];
}

function packPairs(byLayer, stride, grouped) {
  const out = {};
  for (const [name, list] of Object.entries(byLayer)) {
    const count = list.length / stride;
    const bytes = new Uint8Array(count * (grouped ? 10 : 8));
    const view = new DataView(bytes.buffer);
    for (let e = 0; e < count; e++) {
      const at = e * stride;
      let o = e * (grouped ? 10 : 8);
      view.setUint16(o, list[at]);
      view.setUint16(o + 2, list[at + 1]);
      o += 4;
      if (grouped) {
        view.setUint16(o, list[at + 2] + 1);
        o += 2;
      }
      const [u, v] = octOf(list.slice(at + stride - 3, at + stride));
      view.setUint16(o, u);
      view.setUint16(o + 2, v);
    }
    out[name] = Buffer.from(bytes).toString("base64");
  }
  return out;
}

function signedArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function convexOrThrow(ring, name) {
  const points = ring.filter((p, i) => Math.hypot(p[0] - ring[(i + ring.length - 1) % ring.length][0], p[1] - ring[(i + ring.length - 1) % ring.length][1]) > 1e-9);
  const n = points.length;
  let sign = 0;
  let turned = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c = points[(i + 2) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) continue;
    if (!sign) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) throw new Error(`turning: part ${name} is not convex; split it into convex pieces`);
    turned += Math.atan2(cross, (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]));
  }
  if (sign && Math.abs(Math.abs(turned) - TAU) > 1e-6) throw new Error(`turning: part ${name} is not convex; split it into convex pieces`);
}

function roundedPolygon(polygon, radius = 0, steps = 4) {
  const ordered = signedArea(polygon) < 0 ? polygon.slice().reverse() : polygon.slice();
  if (!(radius > 0)) return ordered.map(([x, y]) => [x, y]);
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 1e-9;
  const poly = ordered.filter((p, i) => i === 0 || !same(p, ordered[i - 1]));
  while (poly.length > 1 && same(poly[0], poly[poly.length - 1])) poly.pop();
  if (poly.length < 3) return poly.map(([x, y]) => [x, y]);
  const n = poly.length;
  const normals = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const na = normals[(i - 1 + n) % n];
    const nb = normals[i];
    const denom = 1 + na[0] * nb[0] + na[1] * nb[1];
    const c = [poly[i][0] - (radius * (na[0] + nb[0])) / denom, poly[i][1] - (radius * (na[1] + nb[1])) / denom];
    const a0 = Math.atan2(na[1], na[0]);
    let a1 = Math.atan2(nb[1], nb[0]);
    while (a1 < a0 - 1e-9) a1 += TAU;
    for (let s = 0; s <= steps; s++) {
      const t = a0 + ((a1 - a0) * s) / steps;
      out.push([c[0] + radius * Math.cos(t), c[1] + radius * Math.sin(t)]);
    }
  }
  return out;
}

const fine = (v) => {
  const t = Math.round(v * 1000) / 1000;
  return t === 0 ? "0" : String(t);
};
const finePath = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${fine(x)} ${fine(y)}`).join("") + "Z";

const dot3 = G.dot3;
const sub3 = G.sub3;
const add3 = G.add3;
const mul3 = G.mul3;

function marginOf(n, A, B) {
  let hiA = -Infinity;
  for (const a of A) {
    const v = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    if (v > hiA) hiA = v;
  }
  let loB = Infinity;
  for (const b of B) {
    const v = n[0] * b[0] + n[1] * b[1] + n[2] * b[2];
    if (v < loB) loB = v;
  }
  return { margin: loB - hiA, d: (loB + hiA) / 2 };
}

function closest(A, B, rounds = 200) {
  let w = sub3(B[0], A[0]);
  for (let it = 0; it < rounds; it++) {
    const l = G.len3(w);
    if (l < 1e-12) break;
    let hi = -Infinity;
    let a = A[0];
    for (const p of A) {
      const v = dot3(p, w);
      if (v > hi) {
        hi = v;
        a = p;
      }
    }
    let lo = Infinity;
    let b = B[0];
    for (const p of B) {
      const v = dot3(p, w);
      if (v < lo) {
        lo = v;
        b = p;
      }
    }
    const s = sub3(b, a);
    const ds = sub3(w, s);
    const dd = dot3(ds, ds);
    if (dd < 1e-14) break;
    const t = Math.max(0, Math.min(1, dot3(w, ds) / dd));
    const next = sub3(w, mul3(ds, t));
    if (G.len3(sub3(next, w)) < 1e-10) break;
    w = next;
  }
  return w;
}

function gjk(A, B, warm = null) {
  const w = warm && G.len3(warm) > 1e-9 ? warm : closest(A, B);
  const n = G.unit3(G.len3(w) > 1e-12 ? w : [0, 0, 1]);
  const { margin, d } = marginOf(n, A, B);
  return { n, d, margin };
}

function quickSeparate(A, B, hints = []) {
  const centre = (list) => mul3(list.reduce((sum, p) => add3(sum, p), [0, 0, 0]), 1 / list.length);
  const candidates = [sub3(centre(B), centre(A)), ...hints.flatMap((h) => [h, mul3(h, -1)])].filter((n) => G.len3(n) > 1e-9).map(G.unit3);
  let best = null;
  for (const n of candidates) {
    const { margin } = marginOf(n, A, B);
    if (!best || margin > best.margin) best = { n, margin };
  }
  if (best.margin >= 0.1) return best;
  let { n, margin } = best;
  for (const step of [0.3, 0.1, 0.03]) {
    for (let round = 0; round < 12; round++) {
      const F = G.frameAlong([0, 0, 0], n);
      let improved = false;
      for (let j = 0; j < 8; j++) {
        const t = (j / 8) * TAU;
        const trial = G.unit3(add3(n, add3(mul3(F.u, step * Math.cos(t)), mul3(F.v, step * Math.sin(t)))));
        const value = marginOf(trial, A, B).margin;
        if (value > margin + 1e-9) {
          margin = value;
          n = trial;
          improved = true;
        }
      }
      if (!improved) break;
    }
  }
  return { n, margin };
}

function separate(A, B, hints = []) {
  const centre = (list) => mul3(list.reduce((s, p) => add3(s, p), [0, 0, 0]), 1 / list.length);
  const candidates = [sub3(centre(B), centre(A)), closest(A, B), ...hints.flatMap((h) => [h, mul3(h, -1)])].filter((n) => G.len3(n) > 1e-9).map(G.unit3);
  let best = null;
  for (const n of candidates) {
    const { margin } = marginOf(n, A, B);
    if (!best || margin > best.margin) best = { n, margin };
  }
  let { n, margin } = best;
  for (const step of [0.3, 0.1, 0.03, 0.01, 0.003, 0.001]) {
    for (let round = 0; round < 40; round++) {
      const F = G.frameAlong([0, 0, 0], n);
      let improved = false;
      for (let j = 0; j < 8; j++) {
        const t = (j / 8) * TAU;
        const trial = G.unit3(add3(n, add3(mul3(F.u, step * Math.cos(t)), mul3(F.v, step * Math.sin(t)))));
        const value = marginOf(trial, A, B).margin;
        if (value > margin + 1e-9) {
          margin = value;
          n = trial;
          improved = true;
        }
      }
      if (!improved) break;
    }
  }
  return { n, d: marginOf(n, A, B).d, margin };
}

function frameFrom(F) {
  const a = G.unit3(F.a);
  let u = F.u ? G.unit3(sub3(F.u, mul3(a, dot3(F.u, a)))) : null;
  if (!u || G.len3(u) < 1e-9) u = G.frameAlong([0, 0, 0], a).u;
  const v = F.v && Math.abs(dot3(G.cross3(a, u), F.v)) > 0.999 ? G.unit3(F.v) : G.cross3(a, u);
  return { o: F.o.slice(), a, u, v };
}

function sampleShape(shape, count = 48) {
  const out = [];
  if (shape.kind === "body") {
    const F = frameFrom(shape.F);
    for (const [s, r] of shape.poly) {
      if (r < 1e-9) {
        out.push(G.pointOf(F, s, 0, 0));
        continue;
      }
      for (let j = 0; j < count; j++) out.push(G.pointOf(F, s, r, (j / count) * TAU));
    }
  } else if (shape.kind === "prism") {
    const F = shape.F;
    for (const s of [shape.s0, shape.s1]) for (const [x, y] of shape.poly) out.push(add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y))));
  } else if (shape.kind === "ball") {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const total = Math.max(count * 3, 96);
    for (let i = 0; i < total; i++) {
      const y = 1 - (2 * (i + 0.5)) / total;
      const rad = Math.sqrt(1 - y * y);
      const t = golden * i;
      const n = [Math.cos(t) * rad, Math.sin(t) * rad, y];
      if ((shape.flats ?? []).some(([nx, ny, nz, d]) => nx * n[0] * shape.r + ny * n[1] * shape.r + nz * n[2] * shape.r > d + 1e-9)) continue;
      out.push(add3(shape.o, mul3(n, shape.r)));
    }
    for (const [nx, ny, nz, d] of shape.flats ?? []) {
      const F = G.frameAlong(add3(shape.o, mul3([nx, ny, nz], d)), [nx, ny, nz]);
      const rho = Math.sqrt(Math.max(0, shape.r * shape.r - d * d));
      for (let j = 0; j < count; j++) {
        const p = G.pointOf(F, 0, rho, (j / count) * TAU);
        if ((shape.flats ?? []).every(([mx, my, mz, e]) => mx * (p[0] - shape.o[0]) + my * (p[1] - shape.o[1]) + mz * (p[2] - shape.o[2]) <= e + 1e-6)) out.push(p);
      }
    }
  } else if (shape.kind === "box") {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(add3(shape.o, add3(add3(mul3(shape.axes[0], sx * shape.half[0]), mul3(shape.axes[1], sy * shape.half[1])), mul3(shape.axes[2], sz * shape.half[2]))));
  } else if (shape.kind === "tube") {
    const pts = shape.points;
    for (let i = 0; i < pts.length; i++) {
      const t = G.unit3(sub3(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
      const F = G.frameAlong(pts[i], t);
      const ring = Math.max(8, Math.round(count / 4));
      for (let j = 0; j < ring; j++) out.push(G.pointOf(F, 0, shape.radii[i], (j / ring) * TAU));
    }
  }
  return out;
}

function hull2(points) {
  return G.hullOf(points);
}

function thinCloud(points, most = 64) {
  if (points.length <= most) return points;
  const out = [];
  const step = points.length / most;
  for (let i = 0; i < most; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

function turning(P, { recorder = null, scale = 1 } = {}) {
  const T = { P, R: recorder, scale, groups: [], layers: [], order: [], parts: [], built: null };
  const groupOf = (g) => {
    if (g === undefined || g === null) return null;
    if (typeof g !== "string") return g;
    const group = T.groups.find((x) => x.name === g);
    if (!group) throw new Error(`turning: unknown group ${g}`);
    return group;
  };
  const layerOf = (l) => (typeof l === "string" ? T.layers.find((x) => x.name === l) : l);
  const origin = (group) => (group ? group.origin : [0, 0, 0]);
  const local = (group, p) => sub3(p, origin(group));
  T.group = (name, options = {}) => {
    if (T.groups.some((group) => group.name === name)) throw new Error(`turning: duplicate group ${name}`);
    const parent = groupOf(options.parent);
    const po = origin(parent);
    let kind;
    let spec;
    if (options.turn) {
      kind = "turn";
      const pivot = options.turn.pivot ?? [0, 0];
      spec = { origin: [pivot[0], pivot[1], 0], pivot: [pivot[0], pivot[1]], range: options.turn.range ?? null };
    } else if (options.slide) {
      kind = "slide";
      spec = { origin: po.slice(), direction: G.unit3(options.slide.direction), travel: options.slide.travel ?? 0, range: [0, options.slide.travel ?? 0] };
    } else if (options.hinge) {
      kind = "hinge";
      spec = { origin: options.hinge.point.slice(), point: options.hinge.point.slice(), axis: G.unit3(options.hinge.axis), range: options.hinge.range ?? [0, 0] };
    } else if (options.free) {
      kind = "free";
      const at = options.free.origin ?? po;
      spec = { origin: at.slice(), range: null };
    } else throw new Error(`turning: group ${name} needs turn, slide, hinge or free`);
    const upright = kind !== "free" && (parent ? parent.upright : true) && (kind !== "hinge" || Math.abs(spec.axis[2]) > 0.9999);
    const loose = kind === "free" || Boolean(parent && parent.loose);
    const group = { name, index: T.groups.length, parent, kind, upright, loose, ...spec };
    T.groups.push(group);
    return group;
  };
  T.layer = (name) => {
    const layer = { name, index: T.layers.length, live: true };
    T.layers.push(layer);
    return layer;
  };
  T.stack = (names) => {
    T.order = names.slice();
    return T;
  };
  const common = (options, kind) => {
    if (kind !== "prism" && "materialPrecision" in options) throw new Error("turning: materialPrecision is only supported for native prisms");
    const group = groupOf(options.group);
    const layer = layerOf(options.layer ?? T.layers[0]);
    if (!layer) throw new Error(`turning: part ${options.name} has no live layer`);
    const name = options.name ?? `${kind}#${T.parts.length}`;
    const material = options.material ?? null;
    if (material && !TURN.materials.includes(material)) throw new Error(`turning: part ${name} has material ${material}; use one of ${TURN.materials.join(", ")}`);
    return { id: T.parts.length, name, kind, group, layer, owner: options.owner, tone: options.tone ?? "hi", crease: options.crease ?? "faint", lit: Boolean(options.lit), material, details: options.details ?? {}, shapes: [], planes: [], dots: [], samples: [], hints: [] };
  };
  const record = (part, shape) => {
    shape.name = shape.name ?? part.name;
    if (part.owner && !shape.owner) shape.owner = part.owner;
    part.shapes.push(shape);
    if (T.R) T.R.solid(shape);
    return shape;
  };
  const toLocalDots = (part, F, list) => {
    for (const dot of list ?? []) {
      const [s, x, y] = dot.at;
      const p = add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)));
      part.dots.push({ p: local(part.group, p), n: dot.normal ? G.unit3(dot.normal) : null, size: dot.size ?? 0.5, tone: dot.tone ?? "mid", fade: dot.fade ?? [0.04, 0.42] });
    }
  };
  // Only split may supply an existing native material frame. Public creation
  // still normalizes authored input once; partitioning preserves its stored bits.
  const prismWithFrame = (options, inheritedFrame = null) => {
    if ("materialPrecision" in options) {
      if (options.materialPrecision !== "lossless") throw new Error("turning: prism materialPrecision must be lossless");
      if ("frameAxisDigits" in options || "ringPrecision" in options) throw new Error("turning: prism materialPrecision conflicts with frameAxisDigits or ringPrecision");
      if (options.group !== undefined && options.group !== null) throw new Error("turning: lossless material requires an ungrouped prism");
    }
    if ("frameAxisDigits" in options && options.frameAxisDigits !== 3 && options.frameAxisDigits !== 6) throw new Error("turning: prism frameAxisDigits must be 3 or 6");
    if ("ringPrecision" in options && options.ringPrecision !== "lossless") throw new Error("turning: prism ringPrecision must be lossless");
    const part = common(options, "prism");
    if (options.materialPrecision === "lossless") losslessPrismMaterials.add(part);
    if (options.ringPrecision === "lossless") losslessPrismRings.add(part);
    if (options.frameAxisDigits === 6) precisePrismFrames.add(part);
    let F;
    let ring;
    let s0;
    let s1;
    if (options.plan) {
      F = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
      ring = k.roundedPlan(options.plan, options.steps ?? 4);
      s0 = options.z ?? options.s0 ?? 0;
      s1 = options.h !== undefined ? s0 + options.h : options.s1;
    } else {
      F = inheritedFrame
        ? { o: inheritedFrame.o.slice(), a: inheritedFrame.a.slice(), u: inheritedFrame.u.slice(), v: inheritedFrame.v.slice() }
        : frameFrom(options.F);
      ring = roundedPolygon(options.polygon, options.round ?? 0, options.steps ?? 4);
      s0 = options.s0;
      s1 = options.s1;
    }
    if (s1 < s0) [s0, s1] = [s1, s0];
    if (signedArea(ring) < 0) ring = ring.slice().reverse();
    convexOrThrow(ring, part.name);
    const bevel = options.bevel ?? part.details.bevel ?? 0;
    const losslessMaterial = losslessPrismMaterials.has(part);
    if (losslessMaterial && ![...F.o, ...F.a, ...F.u, ...F.v, ...ring.flat(), s0, s1].every(Number.isFinite)) throw new Error("turning: lossless material requires finite native frame, ring and endpoints");
    const upright = !losslessMaterial && Math.abs(F.a[2]) > 0.9999 && (!part.group || part.group.upright);
    record(part, A.prism(F, ring, s0, s1, { name: part.name }));
    const corner = (s, [x, y]) => add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)));
    part.world = { F, ring, s0, s1 };
    if (upright) {
      const flip = F.a[2] < 0;
      const pts = ring.map((p) => local(part.group, corner(flip ? s1 : s0, p)));
      let xy = pts.map(([x, y]) => [x, y]);
      if (signedArea(xy) < 0) xy = xy.reverse();
      const z0 = pts[0][2];
      const z1 = z0 + (s1 - s0);
      part.spec = { up: 1, ring: xy.flat(), z0, z1, bevel };
      part.planPath = finePath(xy);
      part.localSeams = (part.details.seams ?? []).map((s) => (flip ? z1 - (s - s0) : z0 + (s - s0)));
    } else {
      const FL = { o: losslessMaterial ? F.o.slice() : local(part.group, F.o), a: F.a, u: F.u, v: F.v };
      part.spec = { up: 0, F: FL, ring: ring.flat(), s0, s1, bevel };
      part.localSeams = (part.details.seams ?? []).slice();
    }
    toLocalDots(part, F, part.details.dots);
    for (const s of [s0, s1]) for (const p of ring) part.samples.push(local(part.group, corner(s, p)));
    part.hints.push(F.a);
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > 1e-6) part.hints.push(G.unit3(add3(mul3(F.u, (b[1] - a[1]) / l), mul3(F.v, -(b[0] - a[0]) / l))));
    }
    T.parts.push(part);
    return part;
  };
  T.prism = (options) => prismWithFrame(options);
  const detailParts = (part, F, radiusAt, ends) => {
    const details = part.details ?? {};
    for (const bolt of details.bolts ?? []) {
      const { s, r, count, phase = 0, size = 0.5, tone = "mid", fade = [0.04, 0.42] } = bolt;
      const atEnd = ends ? (Math.abs(s - ends[0]) < 1e-6 ? -1 : Math.abs(s - ends[1]) < 1e-6 ? 1 : 0) : 0;
      const onCap = atEnd !== 0 && (!radiusAt || r < radiusAt(s) - 1e-6);
      const slope = radiusAt ? (radiusAt(s + 1e-3) - radiusAt(s - 1e-3)) / 2e-3 : 0;
      for (let j = 0; j < count; j++) {
        const t = phase + (j / count) * TAU;
        const p = G.pointOf(F, s, r, t);
        const radial = G.radialOf(F, t);
        const n = onCap ? mul3(F.a, atEnd) : G.unit3(sub3(radial, mul3(F.a, slope)));
        part.dots.push({ p: local(part.group, p), n, size, tone, fade });
      }
    }
    toLocalDots(part, F, details.dots);
    for (const ring of details.rings ?? []) {
      const [s, x, y] = ring.at;
      const o = add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y)));
      const n = G.unit3(ring.normal ?? F.a);
      const B = G.frameAlong([0, 0, 0], n);
      const steps = Math.max(12, Math.ceil((TAU * ring.r * k.cameraOf(P).k) / 1.2));
      const pts = Array.from({ length: steps }, (_, j) => [ring.r * Math.cos((j / steps) * TAU), ring.r * Math.sin((j / steps) * TAU)]);
      T.plane({ part, o, u: B.u, v: B.v, normal: n, fade: ring.fade ?? [0.04, 0.3], svg: `<path class="iso-line" data-tone="${ring.tone ?? "lo"}" d="${finePath(pts)}"/>` });
    }
    for (const rule of details.rules ?? []) {
      const pts = rule.points.map(([s, x, y]) => add3(add3(F.o, mul3(F.a, s)), add3(mul3(F.u, x), mul3(F.v, y))));
      let n = rule.normal ? G.unit3(rule.normal) : null;
      if (!n) {
        for (let i = 2; i < pts.length && !n; i++) {
          const c = G.cross3(sub3(pts[1], pts[0]), sub3(pts[i], pts[0]));
          if (G.len3(c) > 1e-9) n = G.unit3(c);
        }
        n = n ?? F.a;
      }
      const B = G.frameAlong([0, 0, 0], n);
      const o = pts[0];
      const flat = pts.map((p) => [dot3(sub3(p, o), B.u), dot3(sub3(p, o), B.v)]);
      const d = flat.map(([x, y], i) => `${i ? "L" : "M"}${fine(x)} ${fine(y)}`).join("");
      const free = rule.free === true ? ' data-free=""' : rule.free ? ` data-free="${rule.free}"` : "";
      T.plane({ part, o, u: B.u, v: B.v, normal: n, fade: rule.fade ?? [0.04, 0.3], svg: `<path class="iso-line" data-tone="${rule.tone ?? "lo"}"${free} d="${d}"/>` });
    }
  };
  T.round = (options) => {
    if ("materialPrecision" in options) common(options, "round");
    const F = frameFrom(options.F);
    const r0 = Array.isArray(options.r) ? options.r[0] : options.r0 ?? options.r;
    const r1 = Array.isArray(options.r) ? options.r[1] : options.r1 ?? options.r;
    let s0 = options.s0;
    let s1 = options.s1;
    const ends = (options.ends ?? ["flat", "flat"]).slice();
    if (s1 < s0) throw new Error(`turning: round ${options.name} needs s0 < s1`);
    ends.forEach((end, j) => {
      if (end === "dome" && Math.abs(r0 - r1) > 1e-9) throw new Error(`turning: round ${options.name} can only have a dome where the end radius equals the side's (a capsule)`);
    });
    const profile = [];
    const arc = (sAt, sign, r) => Array.from({ length: 9 }, (_, j) => (j / 8) * (Math.PI / 2)).map((b) => [sAt + sign * r * Math.cos(b), r * Math.sin(b), 1]);
    if (ends[0] === "dome") profile.push(...arc(s0, -1, r0).slice(0, -1).map((p, j) => (j === 0 ? [p[0], 0] : p)), [s0, r0, 1]);
    else profile.push([s0, r0]);
    if (ends[1] === "dome") profile.push([s1, r1, 1], ...arc(s1, 1, r1).reverse().slice(1).map((p, j, list) => (j === list.length - 1 ? [p[0], 0] : p)));
    else profile.push([s1, r1]);
    const vertical = Math.abs(F.a[2]) > 0.9999;
    const groupOk = !options.group || groupOf(options.group).upright;
    const radiusAt = (s) => r0 + ((r1 - r0) * (Math.max(s0, Math.min(s1, s)) - s0)) / (s1 - s0 || 1);
    if (vertical && groupOk && options.fixed !== false) {
      const meridian = [[profile[0][0], 0], ...profile.filter((p) => p[1] > 1e-9), [profile[profile.length - 1][0], 0]];
      const seams = (options.details?.seams ?? []).map((sv) => G.arcOf(F, sv, radiusAt(sv), P, { slope: (r1 - r0) / (s1 - s0 || 1), least: 0 })).join("");
      const paths = G.lathe(meridian, F, P, ends.includes("dome") ? { smooth: true } : {});
      const svg = k.solidSvg(paths, { tone: options.tone ?? "hi", crease: options.crease ?? "faint", lit: options.lit, inner: seams ? k.lineSvg(seams, { tone: "faint" }) : "" });
      const ribs = options.details?.ribs ? { ...options.details.ribs, r0: options.details.ribs.r0 ?? radiusAt(options.details.ribs.s0), r1: options.details.ribs.r1 ?? radiusAt(options.details.ribs.s1) } : undefined;
      const part = T.fixed({ ...options, svg, anchor: G.pointOf(F, s0, 0, 0), F, details: { ...(options.details ?? {}), ribs, seams: undefined }, shapes: [A.solid(F, profile, { name: options.name })], skipDetails: true });
      part.round = { F, s0, s1, r0, r1, ends };
      detailParts(part, F, radiusAt, [s0, s1]);
      return part;
    }
    const part = common(options, "round");
    record(part, A.solid(F, profile, { name: part.name }));
    part.world = { F, s0, s1, r0, r1, ends, profile };
    part.spec = { F: { o: local(part.group, F.o), a: F.a, u: F.u, v: F.v }, s0, s1, r0, r1, ends };
    detailParts(part, F, radiusAt, [s0, s1]);
    const ring = (s, r, count = 48) => Array.from({ length: count }, (_, j) => G.pointOf(F, s, r, (j / count) * TAU));
    const pts = [...ring(s0, r0), ...ring(s1, r1)];
    for (const [end, sAt, r] of [[0, s0, r0], [1, s1, r1]]) {
      if (ends[end] !== "dome") continue;
      const sign = end ? 1 : -1;
      for (let j = 1; j <= 6; j++) {
        const b = (j / 6) * (Math.PI / 2);
        if (j === 6) pts.push(add3(F.o, mul3(F.a, sAt + sign * r)));
        else pts.push(...ring(sAt + sign * r * Math.sin(b), r * Math.cos(b), 32));
      }
    }
    part.samples = pts.map((p) => local(part.group, p));
    part.hints.push(F.a);
    T.parts.push(part);
    return part;
  };
  T.ball = (options) => {
    if ("materialPrecision" in options) common(options, "ball");
    const c = options.c;
    const r = options.r;
    const flats = (options.flats ?? []).map(({ n, d }) => ({ n: G.unit3(n), d }));
    const shape = A.ball(c, r, { name: options.name, flats: flats.map(({ n, d }) => [n[0], n[1], n[2], d]) });
    if (!flats.length && options.fixed !== false) {
      const svg = k.solidSvg(G.sphereOf(c, r, P, { steps: 48 }), { tone: options.tone ?? "hi", crease: options.crease ?? "faint", lit: options.lit });
      return T.fixed({ ...options, svg, anchor: c, shapes: [shape] });
    }
    const part = common(options, "ball");
    record(part, shape);
    part.world = { c, r, flats };
    part.spec = { c: local(part.group, c), r, flats };
    part.samples = sampleShape(shape, 48).map((p) => local(part.group, p));
    for (const { n } of flats) part.hints.push(n);
    detailParts(part, G.frameAlong(c, flats.length ? flats[0].n : [0, 0, 1]), null, null);
    T.parts.push(part);
    return part;
  };
  T.lathe = (options) => {
    if ("materialPrecision" in options) common(options, "lathe");
    const F = frameFrom(options.F);
    const profile = options.profile;
    const curve = G.profileCurve(profile.map(([sv, rv]) => [sv, rv]), { slope: options.slope ?? null, radius: options.radius ?? null });
    const kk = k.cameraOf(P).k;
    const knots = [curve.s0];
    const split = (a, b, level) => {
      const mid = (a + b) / 2;
      if (level < 7 && (Math.abs(curve.radius(mid) - (curve.radius(a) + curve.radius(b)) / 2) * kk > 0.1 || b - a > 4)) {
        split(a, mid, level + 1);
        knots.push(mid);
        split(mid, b, level + 1);
      }
    };
    const stops = [curve.s0, ...profile.map(([sv]) => sv).filter((sv) => sv > curve.s0 && sv < curve.s1), curve.s1];
    for (let i = 0; i < stops.length - 1; i++) {
      split(stops[i], stops[i + 1], 0);
      knots.push(stops[i + 1]);
    }
    for (let i = 1; i < knots.length - 1; i++) {
      const a = curve.radius(knots[i - 1]);
      const b = curve.radius(knots[i]);
      const c = curve.radius(knots[i + 1]);
      const h0 = knots[i] - knots[i - 1];
      const h1 = knots[i + 1] - knots[i];
      if ((c - b) / h1 - (b - a) / h0 > 1e-6) throw new Error(`turning: lathe ${options.name} is not convex near s = ${knots[i].toFixed(2)} (r(s) must be concave); split it`);
    }
    const levels = [];
    for (const sv of knots) {
      const g = curve.slope(sv);
      const norm = Math.hypot(1, g);
      levels.push(sv, curve.radius(sv), 1 / norm, -g / norm);
    }
    const caps = [curve.radius(curve.s0) > 1e-6, curve.radius(curve.s1) > 1e-6];
    const shape = A.solid(F, profile.map(([sv, rv]) => [sv, rv, 1]), { name: options.name, radius: curve.radius });
    const vertical = Math.abs(F.a[2]) > 0.9999;
    const groupOk = !options.group || groupOf(options.group).upright;
    if (vertical && groupOk && options.fixed !== false) {
      const meridian = [[curve.s0, 0], ...knots.map((sv) => [sv, curve.radius(sv), 1]), [curve.s1, 0]];
      meridian[1] = [meridian[1][0], meridian[1][1]];
      meridian[meridian.length - 2] = [meridian[meridian.length - 2][0], meridian[meridian.length - 2][1]];
      const seams = (options.details?.seams ?? []).map((sv) => G.arcOf(F, sv, curve.radius(sv), P, { slope: curve.slope(sv), least: 0 })).join("");
      const svg = k.solidSvg(G.lathe(meridian, F, P, { smooth: { slope: curve.slope, radius: curve.radius } }), { tone: options.tone ?? "hi", crease: options.crease ?? "faint", lit: options.lit, inner: seams ? k.lineSvg(seams, { tone: "faint" }) : "" });
      const part = T.fixed({ ...options, svg, anchor: G.pointOf(F, curve.s0, 0, 0), F, details: { ...(options.details ?? {}), seams: undefined }, shapes: [shape], skipDetails: true });
      detailParts(part, F, curve.radius, [curve.s0, curve.s1]);
      return part;
    }
    const part = common(options, "lathe");
    record(part, shape);
    part.spec = { F: { o: local(part.group, F.o), a: F.a, u: F.u, v: F.v }, levels, caps };
    part.world = { F, profile, curve, knots };
    const pts = [];
    for (const sv of knots) for (let j = 0; j < 32; j++) pts.push(G.pointOf(F, sv, curve.radius(sv), (j / 32) * TAU));
    part.samples = pts.map((p) => local(part.group, p));
    part.hints.push(F.a);
    detailParts(part, F, curve.radius, [curve.s0, curve.s1]);
    T.parts.push(part);
    return part;
  };
  T.routes = [];
  T.tube = (options) => {
    // Reject before route/recorder writes, including empty routes with no chunks.
    if ("materialPrecision" in options) common(options, "tube");
    const { route, r, chunk = 6, turn = 20, gaps = [], breaks = [], caps = true, rings = null, hue = null, spacing = 0.8, owner, touch, bundle, rims, free } = options;
    const group = groupOf(options.group);
    const name = options.name ?? `tube#${T.routes.length}`;
    const dense = G.resample(route, spacing);
    const total = G.pathLength(dense);
    const turnBreaks = [];
    let walked = 0;
    let bent = 0;
    for (let i = 1; i < dense.length - 1; i++) {
      walked += G.len3(sub3(dense[i], dense[i - 1]));
      const a = G.unit3(sub3(dense[i], dense[i - 1]));
      const b = G.unit3(sub3(dense[i + 1], dense[i]));
      bent += (Math.acos(Math.max(-1, Math.min(1, dot3(a, b)))) * 180) / Math.PI;
      if (bent > turn) {
        turnBreaks.push(walked);
        bent = 0;
      }
    }
    const allBreaks = [...breaks, ...turnBreaks].sort((x, y) => x - y);
    const pieces = spansOf(total, gaps, allBreaks, chunk);
    const wide = r * k.cameraOf(P).k > 1.3;
    const routeIndex = T.routes.length;
    const capList = [caps].flat();
    T.routes.push({ name, group, points: dense.map((p) => local(group, p)), r, spacing, wide, hue, rings, world: route, gaps, breaks: allBreaks, chunk, caps });
    if (T.R) T.R.route(name, route, r, { gaps, limp: options.limp ?? true, owner: owner ?? name, touch, bundle, rims, free });
    const chunks = pieces.map((piece, index) => {
      const part = common({ ...options, name: `${name}:${index}` }, "tube");
      part.route = name;
      part.chunk = index;
      part.hue = hue;
      part.spec = { route: routeIndex, from: piece.from, to: piece.to, open0: piece.open0, open1: piece.open1, gap0: piece.gap0, gap1: piece.gap1, caps: [capList[0], capList[capList.length - 1]], wide, rings: rings ? { tone: rings.tone ?? "lo" } : null };
      const core = G.cut(dense, piece.from, piece.to);
      part.shapes.push(A.tube(core, r, { name: part.name, owner: owner ?? name }));
      part.world = { route, r, index };
      for (let i = 0; i < core.length; i++) {
        const t = G.unit3(sub3(core[Math.min(core.length - 1, i + 1)], core[Math.max(0, i - 1)]));
        const F = G.frameAlong(core[i], t);
        for (let j = 0; j < 10; j++) part.samples.push(local(group, G.pointOf(F, 0, r, (j / 10) * TAU)));
      }
      part.hints.push(G.unit3(sub3(core[1], core[0])), G.unit3(sub3(core[core.length - 1], core[core.length - 2])));
      T.parts.push(part);
      return part;
    });
    return { name, chunks, total, dense };
  };
  T.fixed = (options) => {
    const part = common(options, "fixed");
    const anchor = options.anchor;
    for (const shape of options.shapes ?? []) record(part, shape);
    const world = part.shapes.flatMap((shape) => sampleShape(shape, 48));
    const flat = world.map((p) => k.iso(p, P));
    const hull = options.hull ?? hull2(flat);
    const box = A.markupBox(options.svg) ?? [Math.min(...hull.map((p) => p[0])), Math.min(...hull.map((p) => p[1])), Math.max(...hull.map((p) => p[0])), Math.max(...hull.map((p) => p[1]))];
    part.svg = options.svg;
    const F = options.F ? frameFrom(options.F) : null;
    part.spec = { anchor: local(part.group, anchor), home: k.iso(anchor, P), box: [box[0] - 0.5, box[1] - 0.5, box[2] + 0.5, box[3] + 0.5], hull: hull.flat(), F: F ? { o: local(part.group, F.o), a: F.a, u: F.u, v: F.v } : null };
    if (F && !options.skipDetails) detailParts(part, F, null, null);
    part.samples = world.map((p) => local(part.group, p));
    if (F) part.hints.push(F.a);
    T.parts.push(part);
    return part;
  };
  T.item = (options) => {
    const part = common(options, "item");
    const cloud = options.cloud ?? [[0, 0, 0]];
    part.spec = { item: 1 };
    part.cloud = cloud.map((p) => local(part.group, p)).flat();
    part.samples = cloud.map((p) => local(part.group, p));
    T.parts.push(part);
    return part;
  };
  T.plane = ({ part, o, u, v, svg, fade = [0.04, 0.3], normal = null }) => {
    const U = G.unit3(u);
    const W = G.unit3(v);
    const n = normal ? G.unit3(normal) : G.unit3(G.cross3(U, W));
    part.planes.push({ o: local(part.group, o), u: U, v: W, n, fade, svg });
    return part;
  };
  T.billboard = ({ part, at, normal, svg, fade = [0.04, 0.3] }) => {
    part.planes.push({ o: local(part.group, at), u: [1, 0, 0], v: [0, 1, 0], n: G.unit3(normal), fade, svg, billboard: true });
    return part;
  };
  const drop = (part) => {
    T.parts.splice(T.parts.indexOf(part), 1);
    T.parts.forEach((p, index) => (p.id = index));
  };
  T.split = (part, { n, d }) => {
    if (losslessPrismMaterials.has(part) && part.group !== null) throw new Error("turning: lossless material requires an ungrouped prism");
    const N = G.unit3(n);
    if (part.kind === "prism") {
      const { F, ring, s0, s1 } = part.world;
      const along = dot3(N, F.a);
      const base = { name: part.name, owner: part.owner, group: part.group, layer: part.layer, tone: part.tone, crease: part.crease, lit: part.lit, material: part.material, details: { ...part.details }, bevel: part.spec.bevel };
      if (precisePrismFrames.has(part)) base.frameAxisDigits = 6;
      if (losslessPrismRings.has(part)) base.ringPrecision = "lossless";
      if (losslessPrismMaterials.has(part)) base.materialPrecision = "lossless";
      let halves;
      if (Math.abs(Math.abs(along) - 1) < 1e-6) {
        const sCut = (d - dot3(N, F.o)) / along;
        if (!(sCut > s0 + 1e-6 && sCut < s1 - 1e-6)) throw new Error(`turning: split plane misses ${part.name}`);
        halves = [{ s0, s1: sCut }, { s0: sCut, s1 }].map((span) => ({ ...base, F, polygon: ring, s0: span.s0, s1: span.s1 }));
      } else if (Math.abs(along) < 1e-6) {
        const nu = dot3(N, F.u);
        const nv = dot3(N, F.v);
        const c = d - dot3(N, F.o);
        const side = (p) => nu * p[0] + nv * p[1] - c;
        const clip = (sign) => {
          const out = [];
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            const sa = sign * side(a);
            const sb = sign * side(b);
            if (sa <= 0) out.push(a);
            if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
              const t = sa / (sa - sb);
              out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
          }
          return out;
        };
        halves = [clip(1), clip(-1)].map((polygon) => ({ ...base, F, polygon, s0, s1 }));
        if (halves.some((h) => h.polygon.length < 3)) throw new Error(`turning: split plane misses ${part.name}`);
      } else throw new Error(`turning: a prism can only be split by a plane along or across its axis (${part.name})`);
      part.dead = true;
      if (T.R) T.R.solids.splice(T.R.solids.indexOf(part.shapes[0]), 1);
      const made = halves.map((h, index) => prismWithFrame({ ...h, name: `${part.name}.${index ? "b" : "a"}`, round: 0, details: index ? { ...h.details, dots: [] } : h.details }, F));
      for (const half of made) {
        half.spec.cuts = [...(part.spec.cuts ?? []), { n: N, d: d - dot3(N, half.group ? half.group.origin : [0, 0, 0]) }];
        half.hints.unshift(N);
      }
      drop(part);
      return made;
    }
    if (part.kind === "round" || (part.kind === "fixed" && part.round)) {
      const { F, s0, s1, r0, r1, ends } = part.round ?? part.world;
      const along = dot3(N, F.a);
      if (Math.abs(Math.abs(along) - 1) > 1e-6) throw new Error(`turning: a round can only be split across its axis (${part.name})`);
      const sCut = (d - dot3(N, F.o)) / along;
      if (!(sCut > s0 + 1e-6 && sCut < s1 - 1e-6)) throw new Error(`turning: split plane misses ${part.name}`);
      const rAt = r0 + ((r1 - r0) * (sCut - s0)) / (s1 - s0);
      part.dead = true;
      if (T.R) T.R.solids.splice(T.R.solids.indexOf(part.shapes[0]), 1);
      const base = { owner: part.owner, group: part.group, layer: part.layer, tone: part.tone, crease: part.crease, lit: part.lit, material: part.material, F, fixed: false };
      const made = [
        T.round({ ...base, name: `${part.name}.a`, s0, s1: sCut, r: [r0, rAt], ends: [ends[0], "open"], details: part.details }),
        T.round({ ...base, name: `${part.name}.b`, s0: sCut, s1, r: [rAt, r1], ends: ["open", ends[1]] }),
      ];
      for (const half of made) {
        half.spec.cuts = [...(part.spec.cuts ?? []), { n: N, d: d - dot3(N, half.group ? half.group.origin : [0, 0, 0]) }];
        half.hints.unshift(N);
      }
      drop(part);
      return made;
    }
    throw new Error(`turning: split supports prisms and rounds (${part.name})`);
  };
  T.build = (options = {}) => build(T, options);
  return T;
}

function spansOf(total, gaps, breaks, maxLength) {
  const cuts = gaps
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(total, Math.max(a, b))])
    .filter(([a, b]) => b - a > 1e-6)
    .sort((x, y) => x[0] - y[0]);
  const runs = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at + 1e-6) runs.push([at, a, at > 0, true]);
    at = Math.max(at, b);
  }
  if (total > at + 1e-6) runs.push([at, total, at > 0, cuts.length > 0 && cuts[cuts.length - 1][1] >= total - 1e-6]);
  const pieces = [];
  for (const [from, to, gapStart, gapEnd] of runs) {
    const stops = [from, ...breaks.filter((b) => b > from + 1e-6 && b < to - 1e-6).sort((x, y) => x - y), to];
    for (let index = 0; index < stops.length - 1; index++) {
      const a = stops[index];
      const b = stops[index + 1];
      const count = Math.max(1, Math.ceil((b - a) / maxLength - 1e-9));
      for (let c = 0; c < count; c++) {
        pieces.push({
          from: a + ((b - a) * c) / count,
          to: a + ((b - a) * (c + 1)) / count,
          open0: !(index === 0 && c === 0),
          open1: !(index === stops.length - 2 && c === count - 1),
          gap0: index === 0 && c === 0 && gapStart,
          gap1: index === stops.length - 2 && c === count - 1 && gapEnd,
        });
      }
    }
  }
  return pieces;
}

function groupData(T) {
  return T.groups.map((g) => ({
    name: g.name,
    parent: g.parent ? g.parent.index : -1,
    kind: g.kind,
    origin: g.origin,
    pivot: g.pivot,
    direction: g.direction,
    travel: g.travel,
    point: g.point,
    axis: g.axis,
    range: g.range,
    upright: g.upright,
    loose: g.loose || undefined,
  }));
}

function partData(part) {
  const details = {};
  const seams = part.kind === "prism" ? part.localSeams : part.kind === "fixed" ? null : part.details.seams;
  if (seams && seams.length) details.seams = seams;
  if (part.details.ribs) details.ribs = part.details.ribs;
  const out = { name: part.name, kind: part.kind, group: part.group ? part.group.index : -1, layer: part.layer.index };
  if (part.tone !== "hi") out.tone = part.tone;
  if (part.crease !== "faint") out.crease = part.crease;
  if (part.lit) out.lit = true;
  if (part.material) out.mat = part.material;
  out.spec = part.spec;
  if (Object.keys(details).length) out.details = details;
  if (part.planes.length) out.planes = part.planes.map(({ o, u, v, n, fade, billboard }) => ({ o, u, v, n, fade, billboard }));
  if (part.dots.length) out.dots = part.dots.map(({ p, n, size, tone, fade }) => ({ p, n, size, tone, fade }));
  if (part.kind === "item") out.cloud = part.cloud;
  return out;
}

function statesOf(T, poses) {
  if (typeof poses === "function") poses = poses();
  if (Array.isArray(poses) && poses.length) return poses;
  const out = [];
  for (let deg = 0; deg < 360; deg += 2) out.push(Object.fromEntries(T.groups.map((g) => [g.name, g.kind === "turn" ? deg : g.range ? g.range[0] + ((g.range[1] - g.range[0]) * (deg % 90)) / 90 : 0])));
  return out;
}

function tumbleStates(T, group, count = 160) {
  let root = group;
  while (root && root.kind !== "free") root = root.parent;
  if (!root) return [];
  let seed = 977;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = rand();
    const a = rand() * TAU;
    const b = rand() * TAU;
    const q = [Math.sqrt(1 - u) * Math.sin(a), Math.sqrt(1 - u) * Math.cos(a), Math.sqrt(u) * Math.sin(b), Math.sqrt(u) * Math.cos(b)];
    const values = { [root.name]: { q } };
    for (const g of T.groups) if (g.kind === "hinge" && g.loose) values[g.name] = g.range[0] + (g.range[1] - g.range[0]) * rand();
    out.push(values);
  }
  return out;
}

function groupStates(T, group, states, { tumble = false } = {}) {
  if (!group) return [{}];
  let chain = [];
  for (let g = group; g; g = g.parent) chain.push(g);
  if (group.loose) return tumble ? [...states, ...tumbleStates(T, group)] : states.length ? states : [{}];
  if (chain.length === 1 && group.kind === "turn") return Array.from({ length: 360 }, (_, deg) => ({ [group.name]: deg }));
  if (chain.length === 1) {
    const [lo, hi] = group.range ?? [0, 0];
    return Array.from({ length: 33 }, (_, i) => ({ [group.name]: lo + ((hi - lo) * i) / 32 }));
  }
  return states;
}

function sweptGroups(T, layer, states, scene) {
  const V = G.viewOf(T.P);
  const cam = k.cameraOf(T.P);
  const byGroup = new Map();
  for (const part of T.parts) {
    if (part.layer !== layer || part.dead) continue;
    const key = part.group ? part.group.index : -1;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(part);
  }
  const out = [];
  for (const [key, parts] of byGroup) {
    const group = key >= 0 ? T.groups[key] : null;
    const local = parts.flatMap((part) => part.samples);
    const root = group && group.kind === "turn" && !group.parent;
    const list = root ? Array.from({ length: 72 }, (_, i) => ({ [group.name]: i * 5 })) : group ? groupStates(T, group, states) : [{}];
    let zmin = Infinity;
    let zmax = -Infinity;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    const cloud = [];
    const stride = Math.max(1, Math.floor((local.length * list.length) / 4000));
    let counter = 0;
    for (const values of list) {
      const cams = TURN.cams(scene, values);
      const c = key >= 0 ? cams[key] : cams.world;
      for (const q of local) {
        const p = [c.R[0] * q[0] + c.R[1] * q[1] + c.R[2] * q[2] + c.t[0], c.R[3] * q[0] + c.R[4] * q[1] + c.R[5] * q[2] + c.t[1], c.R[6] * q[0] + c.R[7] * q[1] + c.R[8] * q[2] + c.t[2]];
        if (p[2] < zmin) zmin = p[2];
        if (p[2] > zmax) zmax = p[2];
        const [x, y] = k.iso(p, T.P);
        if (x < box[0]) box[0] = x;
        if (y < box[1]) box[1] = y;
        if (x > box[2]) box[2] = x;
        if (y > box[3]) box[3] = y;
        if (counter++ % stride === 0) cloud.push(p);
      }
    }
    let radius = 0;
    let envelope = cloud;
    if (root) {
      const slices = new Map();
      for (const q of local) {
        const band = Math.floor(q[2]);
        slices.set(band, Math.max(slices.get(band) ?? 0, Math.hypot(q[0], q[1])));
        radius = Math.max(radius, Math.hypot(q[0], q[1]));
      }
      envelope = [];
      for (const [band, r] of slices)
        for (const z of [band, band + 1])
          for (let j = 0; j < 48; j++) envelope.push([group.origin[0] + r * Math.cos((j / 48) * TAU), group.origin[1] + r * Math.sin((j / 48) * TAU), Math.max(zmin, Math.min(zmax, z))]);
      const pad = radius * cam.k;
      const c = k.iso([group.origin[0], group.origin[1], 0], T.P);
      box[0] = Math.min(box[0], c[0] - pad);
      box[2] = Math.max(box[2], c[0] + pad);
    }
    out.push({ key, group, parts, root, radius, zmin, zmax, box, envelope, V });
  }
  return out;
}

function relation(points, box, swept, P) {
  const V = G.viewOf(P);
  let zmin = Infinity;
  let zmax = -Infinity;
  for (const p of points) {
    zmin = Math.min(zmin, p[2]);
    zmax = Math.max(zmax, p[2]);
  }
  if (zmax <= swept.zmin + 1e-6) return { side: "behind", rule: "horizontal plane" };
  if (zmin >= swept.zmax - 1e-6) return { side: "front", rule: "horizontal plane" };
  if (swept.root) {
    const a = ((P.azimuth ?? 45) * Math.PI) / 180;
    const along = points.map((p) => (p[0] - swept.group.origin[0]) * Math.cos(a) + (p[1] - swept.group.origin[1]) * Math.sin(a));
    if (Math.max(...along) <= -swept.radius) return { side: "behind", rule: "cylinder" };
    if (Math.min(...along) >= swept.radius) return { side: "front", rule: "cylinder" };
  }
  if (box && (box[2] < swept.box[0] - 1 || swept.box[2] < box[0] - 1 || box[3] < swept.box[1] - 1 || swept.box[3] < box[1] - 1)) return { side: "apart", rule: "never overlap" };
  const hit = separate(points, swept.envelope, [[0, 0, 1], [Math.cos(((P.azimuth ?? 45) * Math.PI) / 180), Math.sin(((P.azimuth ?? 45) * Math.PI) / 180), 0]]);
  if (hit.margin >= -0.08) return { side: dot3(hit.n, V) > 0 ? "behind" : "front", rule: "swept envelope", margin: hit.margin };
  return null;
}

function proveLayers(T, statics, states, scene) {
  const order = T.order.length ? T.order : T.layers.map((layer) => layer.name);
  const rank = new Map(order.map((name, index) => [name, index]));
  const problems = [];
  const proofs = [];
  const swept = new Map(T.layers.map((layer) => [layer.name, sweptGroups(T, layer, states, scene)]));
  for (const layer of T.layers) if (!rank.has(layer.name)) problems.push(`live layer ${layer.name} is missing from T.stack`);
  for (const item of statics) {
    if (!item.shapes || !item.shapes.length) continue;
    const layerName = item.layer;
    if (!rank.has(layerName)) {
      problems.push(`static ${item.name} has layer ${layerName ?? "(none)"}, which is not in T.stack`);
      continue;
    }
    const points = item.shapes.flatMap((shape) => sampleShape(shape, 24));
    const flat = points.map((p) => k.iso(p, T.P));
    const box = [Math.min(...flat.map((p) => p[0])), Math.min(...flat.map((p) => p[1])), Math.max(...flat.map((p) => p[0])), Math.max(...flat.map((p) => p[1]))];
    for (const layer of T.layers) {
      const want = rank.get(layerName) < rank.get(layer.name) ? "behind" : "front";
      for (const group of swept.get(layer.name)) {
        const proof = relation(points, box, group, T.P);
        const label = `${item.name} × ${layer.name}${group.group ? `/${group.group.name}` : ""}`;
        if (!proof) {
          const zs = points.map((p) => p[2]);
          const top = Math.max(...zs);
          const bottom = Math.min(...zs);
          const where = top > group.zmax + 1e-6 ? `at z = ${group.zmax.toFixed(2)}` : bottom < group.zmin - 1e-6 ? `at z = ${group.zmin.toFixed(2)}` : `into a piece behind and a piece in front of ${group.group ? `the ${group.group.name} axis` : "the layer"}`;
          problems.push(`static ${item.name} interleaves live layer ${layer.name}: split ${item.name} ${where}, or move it`);
          continue;
        }
        if (proof.side !== "apart" && proof.side !== want) {
          problems.push(`static ${item.name} is ${proof.side === "behind" ? "behind" : "in front of"} live layer ${layer.name} (${proof.rule}) but its layer ${layerName} is ${want === "behind" ? "under" : "over"} it: move it to a layer ${proof.side === "behind" ? "under" : "over"} ${layer.name}`);
          continue;
        }
        proofs.push({ static: item.name, layer: layer.name, group: group.group ? group.group.name : "world", rule: proof.rule, side: proof.side });
        void label;
      }
    }
  }
  const live = T.layers.slice().sort((a, b) => rank.get(a.name) - rank.get(b.name));
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++)
      for (const lower of swept.get(live[i].name))
        for (const upper of swept.get(live[j].name)) {
          let ok = lower.zmax <= upper.zmin + 1e-6 ? "horizontal plane" : null;
          if (!ok && (lower.box[2] < upper.box[0] - 1 || upper.box[2] < lower.box[0] - 1 || lower.box[3] < upper.box[1] - 1 || upper.box[3] < lower.box[1] - 1)) ok = "never overlap";
          if (!ok) {
            const hit = separate(lower.envelope, upper.envelope, [[0, 0, 1]]);
            if (hit.margin >= -0.08 && dot3(hit.n, G.viewOf(T.P)) > 0) ok = "swept envelope";
          }
          if (!ok) problems.push(`live layer ${live[i].name} interleaves live layer ${live[j].name} (${lower.group ? lower.group.name : "world"} × ${upper.group ? upper.group.name : "world"}): move parts between them or reorder T.stack`);
          else proofs.push({ static: `layer ${live[i].name}`, layer: live[j].name, group: upper.group ? upper.group.name : "world", rule: ok, side: "behind" });
        }
  return { problems, proofs };
}

function build(T, { statics = [], verify = false, poses = null, strict = true, fullClouds = false } = {}) {
  for (const part of T.parts) {
    if (losslessPrismMaterials.has(part) && part.group !== null) throw new Error("turning: lossless material requires an ungrouped prism");
  }
  const P = T.P;
  const started = Date.now();
  const states = statesOf(T, poses);
  const groups = groupData(T);
  const parts = T.parts.map(partData);
  const sweep = (layerParts, list) => {
    const data = { P, groups, layers: T.layers.map((layer) => ({ name: layer.name, parts: [], rest: [] })), parts };
    const scene = TURN.prepare(data, { unit: T.scale });
    const frames = scene.runs.map((run) => TURN.frame(run));
    return { scene, frames, data };
  };
  void sweep;
  const routes = T.routes.map((route) => ({ points: route.points.flat().map(r4), r: route.r, spacing: route.spacing, wide: route.wide, hue: route.hue, rings: route.rings }));
  const scratch = { P, groups, layers: T.layers.map((layer) => ({ name: layer.name, parts: [], rest: [] })), parts, routes };
  let scene = TURN.prepare(scratch, { unit: T.scale });
  const slotNeed = parts.map(() => ({ bevel: 0, ribs: 0 }));
  const sampleCams = new Map();
  const camsFor = (group) => {
    const key = group ? group.index : -1;
    if (!sampleCams.has(key)) {
      const list = groupStates(T, group, states, { tumble: true }).map((values) => TURN.cams(scene, values));
      sampleCams.set(key, list);
    }
    return sampleCams.get(key);
  };
  T.parts.forEach((part, index) => {
    const run = scene.runs[index];
    const needs = part.kind === "item" ? false : part.kind === "prism" ? Boolean(part.spec.bevel) : part.kind === "tube" ? Boolean(part.spec.rings) : Boolean(part.details.ribs);
    if (!needs) return;
    const g = part.group ? part.group.index : -1;
    const wide = { ...run, slots: { bevel: 64, ribs: 64 }, role: { ...run.role } };
    for (let j = 0; j < 64; j++) {
      wide.role[`v${j}`] = 1000 + j;
      wide.role[`r${j}`] = 2000 + j;
    }
    const f = TURN.frame(run);
    f.d = new Array(3000).fill("");
    f.o = new Float64Array(3000);
    f.q = new Int32Array(3000);
    f.w = new Float64Array(3000);
    f.t = new Array(3000).fill("");
    f.cx = new Float64Array(3000);
    f.cy = new Float64Array(3000);
    let most = 0;
    for (const cams of camsFor(part.group)) {
      TURN.emit(wide, g >= 0 ? cams[g] : cams.world, f);
      most = Math.max(most, f.levels ?? 0);
    }
    slotNeed[index][part.kind === "prism" ? "bevel" : "ribs"] = Math.max(1, most);
  });
  parts.forEach((data, index) => {
    data.spec = slotNeed[index].bevel || slotNeed[index].ribs ? { ...data.spec, slots: slotNeed[index] } : { ...data.spec };
  });
  scene = TURN.prepare({ ...scratch, parts }, { unit: T.scale });
  const centre = (list) => mul3(list.reduce((s, p) => add3(s, p), [0, 0, 0]), 1 / Math.max(1, list.length));
  const spheres = T.parts.map((part) => {
    const c = centre(part.samples);
    let r = 0;
    for (const p of part.samples) r = Math.max(r, G.len3(sub3(p, c)));
    return { c, r };
  });
  const planes = {};
  const dynamic = {};
  const free = {};
  let stateCamList = null;
  const stateCams = () => stateCamList ?? (stateCamList = states.map((values) => TURN.cams(scene, values)));
  const boxCache = new Map();
  const boxesOf = (part, list, key) => {
    const id = `${part.id}|${key}`;
    if (boxCache.has(id)) return boxCache.get(id);
    const local = thinCloud(part.samples, 40);
    const out = new Float64Array(4 * list.length + 1);
    const steps = [];
    list.forEach((cams, at) => {
      const c = part.group ? cams[part.group.index] : cams.world;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const q of local) {
        const x = c.ox + c.m[0] * q[0] + c.m[1] * q[1] + c.m[2] * q[2];
        const y = c.oy + c.m[3] * q[0] + c.m[4] * q[1] + c.m[5] * q[2];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (at) steps.push(Math.max(Math.abs(x0 - out[4 * at - 4]), Math.abs(y0 - out[4 * at - 3]), Math.abs(x1 - out[4 * at - 2]), Math.abs(y1 - out[4 * at - 1])));
      out.set([x0, y0, x1, y1], 4 * at);
    });
    steps.sort((x, y) => x - y);
    out[4 * list.length] = steps.length ? steps[Math.floor(steps.length * 0.95)] : 0;
    boxCache.set(id, out);
    return out;
  };
  const boxesMeet = (a, b, list, key) => {
    const A = boxesOf(a, list, key);
    const B = boxesOf(b, list, key);
    const pad = 1.5 + A[4 * list.length] + B[4 * list.length];
    for (let i = 0; i < list.length; i++) {
      const o = 4 * i;
      if (A[o] < B[o + 2] + pad && B[o] < A[o + 2] + pad && A[o + 1] < B[o + 3] + pad && B[o + 1] < A[o + 3] + pad) return true;
    }
    return false;
  };
  let framedCount = 0;
  const framedAll = {};
  const groupPairsAll = {};
  const ancestors = (g) => {
    const out = [];
    for (let x = g; x; x = x.parent) out.push(x);
    return out;
  };
  const commonOf = (g1, g2) => {
    const list = ancestors(g1);
    for (let x = g2; x; x = x.parent) if (list.includes(x)) return x;
    return null;
  };
  const sampleStates = () => {
    const all = stateCams();
    const count = Math.min(all.length, 24);
    return Array.from({ length: count }, (_, i) => all[Math.floor((i * all.length) / count)]);
  };
  const toFrame = (dir, from, frame) => {
    if (from === frame) return dir;
    const cams = sampleStates()[0] ?? TURN.cams(scene, {});
    const Rf = from ? cams[from.index].R : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const w = [Rf[0] * dir[0] + Rf[1] * dir[1] + Rf[2] * dir[2], Rf[3] * dir[0] + Rf[4] * dir[1] + Rf[5] * dir[2], Rf[6] * dir[0] + Rf[7] * dir[1] + Rf[8] * dir[2]];
    const Rc = frame ? cams[frame.index].R : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    return [Rc[0] * w[0] + Rc[3] * w[1] + Rc[6] * w[2], Rc[1] * w[0] + Rc[4] * w[1] + Rc[7] * w[2], Rc[2] * w[0] + Rc[5] * w[1] + Rc[8] * w[2]];
  };
  const cloudCache = new Map();
  const framedCloud = (part, frame) => {
    const key = `${part.id}|${frame ? frame.index : -1}`;
    if (cloudCache.has(key)) return cloudCache.get(key);
    const local = thinCloud(part.samples, 32);
    const out = [];
    for (const cams of sampleStates()) {
      const c = part.group ? cams[part.group.index] : cams.world;
      const f = frame ? cams[frame.index] : cams.world;
      for (const q of local) {
        const p = [c.R[0] * q[0] + c.R[1] * q[1] + c.R[2] * q[2] + c.t[0] - f.t[0], c.R[3] * q[0] + c.R[4] * q[1] + c.R[5] * q[2] + c.t[1] - f.t[1], c.R[6] * q[0] + c.R[7] * q[1] + c.R[8] * q[2] + c.t[2] - f.t[2]];
        out.push([f.R[0] * p[0] + f.R[3] * p[1] + f.R[6] * p[2], f.R[1] * p[0] + f.R[4] * p[1] + f.R[7] * p[2], f.R[2] * p[0] + f.R[5] * p[1] + f.R[8] * p[2]]);
      }
    }
    cloudCache.set(key, out);
    return out;
  };
  const skip = {};
  const problems = [];
  const margins = [];
  const planesByName = new Map();
  const layerData = [];
  for (const layer of T.layers) {
    const members = T.parts.filter((part) => part.layer === layer);
    const plan = [];
    const dyn = [];
    const framed = [];
    const skipped = [];
    const pairsOfGroups = [];
    const settled = new Set();
    const byGroup = new Map();
    for (const part of members) {
      if (part.group && part.group.loose) continue;
      const key = part.group ? part.group.index : -1;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(part);
    }
    const keys = [...byGroup.keys()];
    if (states.length)
      for (let x = 0; x < keys.length; x++)
        for (let y = x + 1; y < keys.length; y++) {
          const A = byGroup.get(keys[x]);
          const B = byGroup.get(keys[y]);
          const ga = keys[x] >= 0 ? T.groups[keys[x]] : null;
          const gb = keys[y] >= 0 ? T.groups[keys[y]] : null;
          const common = commonOf(ga, gb);
          const ca = A.flatMap((part) => framedCloud(part, common).filter((_, i) => fullClouds || i % 2 === 0));
          const cb = B.flatMap((part) => framedCloud(part, common).filter((_, i) => fullClouds || i % 2 === 0));
          const hit = quickSeparate(ca, cb, [[0, 0, 1], ...A.flatMap((part) => part.hints).slice(0, 6).map((h) => toFrame(h, ga, common)), ...B.flatMap((part) => part.hints).slice(0, 6).map((h) => toFrame(h, gb, common))]);
          if (hit.margin < 0.1) continue;
          pairsOfGroups.push(keys[x], keys[y], common ? common.index : -1, hit.n[0], hit.n[1], hit.n[2]);
          settled.add(`${keys[x]}|${keys[y]}`);
          settled.add(`${keys[y]}|${keys[x]}`);
        }
    groupPairsAll[layer.name] = pairsOfGroups;
    for (let x = 0; x < members.length; x++)
      for (let y = x + 1; y < members.length; y++) {
        const a = members[x];
        const b = members[y];
        if (a.route && a.route === b.route && Math.abs(a.chunk - b.chunk) <= 1) {
          skipped.push(a.id, b.id);
          continue;
        }
        const sa = spheres[a.id];
        const sb = spheres[b.id];
        if (a.group === b.group) {
          const g = a.group ? a.group.index : -1;
          const reach = G.len3(sub3(sb.c, sa.c)) + sa.r + sb.r;
          let near = false;
          void reach;
          if (a.group && a.group.loose) near = G.len3(sub3(sb.c, sa.c)) < sa.r + sb.r + 1;
          else near = boxesMeet(a, b, camsFor(a.group), `g${g}`);
          if (!near) continue;
          const hit = separate(a.samples, b.samples, [[0, 0, 1], ...a.hints, ...b.hints]);
          margins.push({ a: a.name, b: b.name, margin: hit.margin });
          const o = a.group ? a.group.origin : [0, 0, 0];
          planesByName.set(`${a.name}|${b.name}`, { n: hit.n, d: hit.d + dot3(hit.n, o) });
          if (hit.margin < -0.08) {
            problems.push(`interlock ${a.name} × ${b.name} ${hit.margin.toFixed(2)}: split, flats or a flush contact`);
            if (strict) continue;
          }
          plan.push(a.id, b.id, hit.n[0], hit.n[1], hit.n[2]);
        } else if ((a.group && a.group.loose) || (b.group && b.group.loose)) {
          continue;
        } else if (settled.has(`${a.group ? a.group.index : -1}|${b.group ? b.group.index : -1}`)) {
          continue;
        } else {
          const near = !states.length || boxesMeet(a, b, stateCams(), "states");
          if (!near) continue;
          const common = commonOf(a.group, b.group);
          const ca = framedCloud(a, common);
          const cb = framedCloud(b, common);
          const hit = quickSeparate(ca, cb, [[0, 0, 1], ...a.hints, ...b.hints].map((h) => toFrame(h, a.group, common)).concat([[0, 0, 1], ...b.hints.map((h) => toFrame(h, b.group, common))]));
          if (hit.margin >= 0.1) {
            framed.push(a.id, b.id, common ? common.index : -1, hit.n[0], hit.n[1], hit.n[2]);
            framedCount++;
          } else dyn.push(a.id, b.id);
        }
      }
    planes[layer.name] = plan;
    dynamic[layer.name] = dyn;
    framedAll[layer.name] = framed;
    free[layer.name] = members.filter((part) => part.group && part.group.loose).map((part) => part.id);
    skip[layer.name] = skipped;
    layerData.push({ name: layer.name, parts: members.map((part) => part.id), rest: [] });
  }
  if (problems.length && strict) throw new Error(`turning: ${problems.length} pair${problems.length === 1 ? "" : "s"} with no separating plane\n  ${problems.join("\n  ")}`);
  const layered = proveLayers(T, statics, states, scene);
  if (layered.problems.length) throw new Error(`turning: ${layered.problems.length} layer problem${layered.problems.length === 1 ? "" : "s"}\n  ${layered.problems.join("\n  ")}`);
  const values = Object.fromEntries(T.groups.map((g) => [g.name, g.kind === "free" ? null : 0]));
  const data = { P, groups, layers: layerData, parts, routes, planes: packPairs(planes, 5, false), framed: packPairs(framedAll, 6, true), groupPairs: pack(groupPairsAll), dynamic, free, skip, values };
  const clouds = T.parts.map((part) => thinCloud(part.samples, 64));
  data.parts.forEach((p, index) => {
    if (p.kind === "fixed") p.cloud = clouds[index].flat().map(r4);
  });
  const packed = { ...pack({ ...data, parts: [] }), parts: packPrismParts(data.parts, T.parts) };
  scene = TURN.prepare(packed, { unit: T.scale });
  const cams = TURN.cams(scene, values);
  const frames = scene.runs.map((run) => TURN.emit(run, run.group >= 0 ? cams[run.group] : cams.world, TURN.frame(run)));
  const V = G.viewOf(P);
  scene.layers.forEach((layer, index) => {
    const provisional = Int32Array.from(Array.from(layer.parts).sort((i, j) => dot3(spheres[i].c, V) - dot3(spheres[j].c, V)));
    const order = TURN.order(layer, frames, cams, provisional, {}, scene);
    packed.layers[index].rest = Array.from(order);
    layer.rest = order;
  });
  const markup = {};
  scene.layers.forEach((layer, index) => {
    markup[layer.name] = `<g class="iso-parts" data-layer="${esc(layer.name)}">${packed.layers[index].rest.map((i) => partMarkup(T.parts[i], scene.runs[i], frames[i])).join("")}</g>`;
  });
  const report = {
    parts: T.parts.length,
    groups: T.groups.length,
    layers: T.layers.map((layer) => ({ name: layer.name, parts: packed.layers[layer.index].parts.length, planar: planes[layer.name].length / 5, framed: framedAll[layer.name].length / 6, groupPairs: groupPairsAll[layer.name].length / 6, dynamic: dynamic[layer.name].length / 2, skip: skipped(skip[layer.name]) })),
    tight: margins.filter((m) => m.margin < 0).sort((a, b) => a.margin - b.margin),
    margins,
    proofs: layered.proofs,
    seconds: (Date.now() - started) / 1000,
  };
  const out = { svg: markup, data: packed, css: TURN_CSS, report, scene, frames, planesByName };
  out.layerSvg = (name, { width, height, label = "" }) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-live iso-layer" data-live="${esc(name)}" viewBox="0 0 ${width} ${height}" aria-hidden="true"${label ? ` aria-label="${esc(label)}"` : ""}>${markup[name]}</svg>`;
  if (verify) out.verify = verifyData(T, statics);
  T.built = out;
  T.data = packed;
  return out;
}

const skipped = (list) => list.length / 2;

function attrs(pairs) {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([key, v]) => ` ${key}="${esc(v)}"`)
    .join("");
}

function roleMarkup(part, run, f, r) {
  const role = run.roles[r];
  if (role.type === "path") return `<path${attrs({ class: role.cls, "data-shade": role.shade === undefined ? undefined : String(role.shade), "data-tone": role.tone, "data-r": role.name, d: f.d[r] })}/>`;
  if (role.type === "face") {
    const q = f.q[r];
    const band = Math.min(3, Math.floor(q / TURN.q));
    const mix = (q - TURN.q * band) / TURN.q;
    const style = [mix ? `--f:${mix}` : "", f.w[r] >= 0 ? `stroke-width:${f.w[r]}` : ""].filter(Boolean).join(";");
    return `<path${attrs({ class: "iso-tn", "data-r": role.name, "data-b": band ? String(band) : undefined, style: style || undefined, d: f.d[r] })}/>`;
  }
  if (role.type === "slot") return `<path${attrs({ class: role.cls, "data-tone": role.tone, "data-r": role.name, opacity: String(Math.round(f.o[r] * 1000) / 1000), d: f.d[r] })}/>`;
  if (role.type === "xform") return `<path${attrs({ class: role.cls, "data-r": role.name, transform: f.t[r], d: part.planPath })}/>`;
  if (role.type === "plane") {
    const index = Number(role.name.slice(5));
    return `<g${attrs({ "data-r": role.name, transform: f.t[r], opacity: String(f.o[r]) })}>${part.planes[index].svg}</g>`;
  }
  return "";
}

function dotsMarkup(part, run, f) {
  let out = "";
  let open = null;
  run.roles.forEach((role, r) => {
    if (role.type !== "dot") return;
    if (open !== role.tone) {
      if (open !== null) out += "</g>";
      out += `<g class="iso-dots" data-tone="${role.tone}">`;
      open = role.tone;
    }
    out += `<circle data-r="${role.name}" cx="${Math.round(f.cx[r] * 100) / 100}" cy="${Math.round(f.cy[r] * 100) / 100}" r="${role.size}" fill-opacity="${f.o[r]}"/>`;
  });
  return open !== null ? out + "</g>" : out;
}

function partMarkup(part, run, f) {
  if (part.kind === "item") return `<g class="iso-item" data-p="${run.index}" data-name="${esc(part.name)}"></g>`;
  const head = (cls, extra = {}) => `<g${attrs({ class: cls, "data-p": String(run.index), "data-name": part.name, "data-mat": part.material ?? undefined, "data-lit": part.lit ? "" : undefined, ...extra })}>`;
  const inner = run.roles.map((role, r) => (role.type === "dot" || role.type === "self" ? "" : roleMarkup(part, run, f, r))).join("");
  if (part.kind === "tube") return head("tb", { "data-hue": part.hue ?? undefined }) + inner + "</g>";
  if (part.kind === "fixed") {
    const at = part.svg.lastIndexOf('<path class="iso-line iso-edge"');
    const body = at >= 0 ? part.svg.slice(0, at) + inner + part.svg.slice(at) : part.svg + inner;
    return head("iso-part", { transform: f.t[run.role.move] || undefined }) + body + dotsMarkup(part, run, f) + "</g>";
  }
  return head("iso-solid", { "data-seamless": part.kind === "round" || part.kind === "ball" || part.kind === "lathe" ? "" : undefined }) + inner + dotsMarkup(part, run, f) + "</g>";
}

function verifyData(T, statics = []) {
  const order = T.order.length ? T.order : T.layers.map((layer) => layer.name);
  const live = new Set(T.layers.map((layer) => layer.name));
  const staticLayers = order.filter((name) => !live.has(name));
  const liveShapes = new Set(T.parts.flatMap((part) => part.shapes));
  return {
    parts: T.parts.map((part) => ({ name: part.name, group: part.group ? part.group.index : -1, layer: part.layer.index, shapes: part.shapes.map((shape) => localShape(shape, part.group)) })),
    statics: statics.filter((item) => item.shapes && item.shapes.length && staticLayers.includes(item.layer)).map((item) => ({ name: item.name, rank: staticLayers.indexOf(item.layer), shapes: item.shapes.filter((shape) => !liveShapes.has(shape)).map((shape) => localShape(shape, null)) })),
  };
}

function localShape(shape, group) {
  const o = group ? group.origin : [0, 0, 0];
  const out = { kind: shape.kind };
  if (shape.F) out.F = { o: sub3(shape.F.o, o), a: shape.F.a, u: shape.F.u, v: shape.F.v };
  for (const key of ["poly", "s0", "s1", "r", "radii", "flats"]) if (shape[key] !== undefined) out[key] = shape[key];
  if (shape.o && shape.kind !== "body" && shape.kind !== "prism") out.o = sub3(shape.o, o);
  if (shape.points) out.points = shape.points.map((p) => sub3(p, o));
  if (shape.axes) out.axes = shape.axes;
  if (shape.half) out.half = shape.half;
  return pack(out);
}


return {gjk,pack,roundedPolygon,sampleShape,separate,turning};
})(void 0);
return modules['turn-build'];
}
const createInstantNativeFactory=(function createInstantNativeFactory(data, kit) {
  'use strict';
  const fail = (why) => { throw new Error(`instant native factory: ${why}`); };
  if (!data || !data.world || !data.model || !data.native) fail('data.world/model/native required');
  if (!kit || typeof kit.roundedPlan !== 'function' || typeof kit.fitProjection !== 'function' || typeof kit.surfaceMesh !== 'function') fail('iso-kit and annular-sector kit fragments required');
  const WORLD = data.world, MODEL = data.model, k = kit;
  // <verbatim geometry-base.mjs>
  const W = WORLD.width, H = WORLD.height;
  const SH = WORLD.sheet, NP = WORLD.nip, RL = WORLD.rollers, FR = WORLD.frame, PK = WORLD.pick;
  const R = MODEL.rollerRadius; // model value, never a look choice
  const XN = MODEL.nipDistance, XE = MODEL.exitDistance, L = MODEL.packetLength, HW = MODEL.packetWidth / 2;
  const HALF_GAP = NP.gap / 2, ZC = HALF_GAP + R; // top roller centre +ZC, bottom -ZC
  const r3 = (v) => Math.round(v * 1e3) / 1e3; // same rounding as the kit's pack3 for TURN part data
  const box = (x, y, z) => [x, y, z];
  const corners = (b) => { const o = []; for (const x of b.x) for (const y of b.y) for (const z of b.z) o.push([x, y, z]); return o; };
  const P = k.fitProjection(corners({ x: FR.base.x, y: FR.base.y, z: [FR.base.z[0], FR.endplate.z[1]] }), W, H, WORLD.camera);
  const deepFreeze = (v) => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; };
  const ALONG_Y = Object.freeze({ o: [0, 0, 0], a: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] });
  const xz = (pts) => pts.map(([x, z]) => [z, x]);
  const ROLLER_F = (z) => ({ o: [XN, 0, z], a: [0, 1, 0], u: [1, 0, 0] });
  const halfGap = (u) => Math.abs(u) >= R ? Infinity : HALF_GAP + R - Math.sqrt(R * R - u * u);
  const slopeAt = (u) => u / Math.sqrt(R * R - u * u);
  const TANGENTS = (() => {
    const n = Math.round(NP.tangentHalfSpan / NP.tangentStep);
    return Array.from({ length: 2 * n + 1 }, (_, i) => { const u = (i - n) * NP.tangentStep; return { u, h: halfGap(u), m: slopeAt(u) }; });
  })();
  const tangentKinks = TANGENTS.slice(1).map((b, i) => { const a = TANGENTS[i]; return XN + (b.h - a.h + a.m * a.u - b.m * b.u) / (a.m - b.m); });
  const envelope = (x) => TANGENTS.reduce((best, t) => Math.max(best, t.h + t.m * (x - XN - t.u)), -Infinity);
  const bump = (s, a, b, r) => s <= a || s >= b ? 0 : s < a + r ? (s - a) / r : s > b - r ? (b - s) / r : 1;
  const STRIPS = Object.freeze([
    { key: 'side-neg', y: [-HW, -SH.podHalfWidth], mid: false },
    { key: 'mid', y: [-SH.podHalfWidth, SH.podHalfWidth], mid: true },
    { key: 'side-pos', y: [SH.podHalfWidth, HW], mid: false }]);
  function naturalHalf(s, mid, passed) {
    const base = SH.baseThickness / 2;
    if (!mid) return base;
    if (!passed) return base + (SH.podThickness / 2 - base) * bump(s, MODEL.podFrom, MODEL.podTo, SH.podRamp);
    return base + (SH.trapPassedThickness / 2 - base) * bump(s, MODEL.trapFrom, MODEL.trapTo, SH.trapRamp);
  }
  const rowLength = (MODEL.roiTo - MODEL.roiFrom) / MODEL.rows;
  const materialKinks = () => {
    const r = SH.podRamp, t = SH.trapRamp, M = MODEL;
    const k0 = [0, L, M.podFrom, M.podFrom + r, M.podTo - r, M.podTo, M.podRuptureAt, M.trapFrom, M.trapFrom + t, M.trapTo - t, M.trapTo];
    for (let i = 0; i <= M.rows; i++) k0.push(M.roiFrom + i * rowLength);
    return k0;
  };
  function geometryPose(s) {
    const sh = s.sheet;
    return deepFreeze({ time: s.time, cycle: s.cycle, stageKey: s.stageKey, sheetId: s.sheetId, q: sh.q,
      leadingX: sh.leadingX, trailingX: sh.trailingX, nipMaterialS: sh.nipMaterialS, nipCoveredLength: sh.nipCoveredLength,
      rollerDistance: s.rollers.distance, topAngle: s.rollers.topAngle, bottomAngle: s.rollers.bottomAngle,
      topOmega: s.rollers.topOmega, bottomOmega: s.rollers.bottomOmega, radius: s.rollers.radius,
      pickOffset: s.pick.offset, pickEngaged: s.pick.engaged, shutterClosed: s.shutter.closed, motorEngaged: s.motor.engaged,
      podRuptured: s.pod.ruptured, ejected: s.events.ejected, outputs: s.events.outputs, complete: s.complete,
      capturedId: s.captured?.sheetId ?? null, heldId: s.held?.sheetId ?? null,
      spread: s.active.spread.slice(), maturity: s.active.maturity.slice(), exposure: s.active.exposure });
  }
  function stripProfile(pose, strip) {
    const q = pose.q, x0 = q - L, x1 = q, m = NP.contactClearanceMargin;
    const xs = new Set([x0, x1]);
    for (const s of materialKinks()) xs.add(q - s);
    if (XN > x0 && XN < x1) xs.add(XN);
    for (const kx of tangentKinks) xs.add(kx);
    const sorted = [...xs].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (!(b > a)) continue; // keep every positive fragment; exact collinear merge absorbs splits
      const passed = (a + b) / 2 > XN;
      const N = (x) => naturalHalf(q - x, strip.mid, passed), Tm = (x) => envelope(x) - m;
      const da = N(a) - Tm(a), db = N(b) - Tm(b);
      const cuts = [a];
      if (da * db < 0) cuts.push(a + (b - a) * da / (da - db));
      cuts.push(b);
      for (let j = 0; j + 1 < cuts.length; j++) {
        const u = cuts[j], v = cuts[j + 1];
        if (!(v > u)) continue;
        const mid = (u + v) / 2, compressed = Tm(mid) < N(mid);
        const f = (x) => compressed ? Tm(x) : N(x);
        segs.push({ x0: u, x1: v, f0: f(u), f1: f(v), passed, compressed });
      }
    }
    return segs;
  }
  function dosedAt(pose, s0, s1) {
    if (!pose.podRuptured) return false;
    const nipS = pose.nipMaterialS ?? (pose.q - XN >= L ? L : -Infinity);
    const sm = (s0 + s1) / 2;
    if (!(sm < nipS) || sm < MODEL.podRuptureAt) return false;
    if (sm >= MODEL.roiFrom && sm < MODEL.roiTo) {
      const r = Math.min(MODEL.rows - 1, Math.floor((sm - MODEL.roiFrom) / rowLength));
      const from = MODEL.roiFrom + r * rowLength;
      return sm < from + pose.spread[r] * rowLength;
    }
    return sm >= MODEL.trapFrom && sm < MODEL.trapTo;
  }
  function classRanges(pose, strip, profile = stripProfile) {
    const out = [];
    for (const g of profile(pose, strip)) {
      const s0 = pose.q - g.x1, s1 = pose.q - g.x0;
      const dosed = dosedAt(pose, s0, s1);
      const roi = (s0 + s1) / 2 >= MODEL.roiFrom && (s0 + s1) / 2 < MODEL.roiTo;
      const key = `${g.passed}|${g.compressed}|${dosed}|${roi}`;
      const run = out.at(-1);
      if (run && run.key === key && Math.abs(run.f1 - g.f0) < 1e-12 &&
          Math.abs((run.f1 - run.f0) / (run.x1 - run.x0) - (g.f1 - g.f0) / (g.x1 - g.x0)) < 1e-12) {
        run.x1 = g.x1; run.f1 = g.f1; run.s0 = s0;
      } else out.push({ x0: g.x0, x1: g.x1, f0: g.f0, f1: g.f1, s0, s1, passed: g.passed, compressed: g.compressed, dosed, roi, key });
    }
    return out;
  }
  function packCanonical(ranges, strip) {
    const V = [{ x: ranges[0].x0, f: ranges[0].f0 }, ...ranges.map((r) => ({ x: r.x1, f: r.f1 }))], n = V.length - 1;
    const slope = (i) => (i < 0 || i >= n) ? 0 : (V[i + 1].f - V[i].f) / (V[i + 1].x - V[i].x);
    const jump = (i) => (i === 0 || i === n) ? Infinity : Math.abs(slope(i) - slope(i - 1));
    const keep = [];
    for (let i = 0; i <= n;) {
      let j = i; while (j + 1 <= n && r3(V[j + 1].x) === r3(V[i].x)) j++;
      let best = i, bestDev = Infinity;
      for (let c = i; c <= j; c++) {
        let dev = 0; for (let k = i; k <= j; k++) if (k !== c) dev = Math.max(dev, jump(k) * Math.abs(V[k].x - V[c].x));
        if (c === 0 || c === n) dev = -1; // strip ends are never moved
        if (dev < bestDev) { best = c; bestDev = dev; }
      }
      const removed = []; for (let k = i; k <= j; k++) if (k !== best) removed.push({ x: V[k].x, f: V[k].f, slopeJump: jump(k), deviationBound: jump(k) * Math.abs(V[k].x - V[best].x) });
      keep.push({ i: best, removed });
      i = j + 1;
    }
    const out = [];
    for (let a = 0; a + 1 < keep.length; a++) {
      const ka = keep[a].i, kb = keep[a + 1].i, own = ranges.slice(ka, kb).map(({ key, ...r }) => r);
      const dom = own.reduce((m, r) => (r.x1 - r.x0 > m.x1 - m.x0 ? r : m));
      const removed = [...keep[a].removed.filter((v) => v.x > V[ka].x), ...keep[a + 1].removed.filter((v) => v.x < V[kb].x)];
      out.push({ strip: strip.key, y: strip.y, x0: V[ka].x, x1: V[kb].x, f0: V[ka].f, f1: V[kb].f, s0: own.at(-1).s0, s1: own[0].s1,
        passed: dom.passed, compressed: dom.compressed, dosed: own.every((r) => r.dosed), roi: dom.roi, ranges: own, removedVertices: removed });
    }
    return out;
  }
  function validateNativeProfile(records, nipValues = null) {
    if (!Array.isArray(records) || records.length === 0) throw new Error('native profile is empty');
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (![r.x0, r.x1, r.f0, r.f1].every(Number.isFinite) || !(r.x1 > r.x0) || !(r.f0 > 0 && r.f1 > 0))
        throw new Error('native profile has invalid finite positive-width material');
      if (i && (records[i - 1].x1 !== r.x0 || !Object.is(records[i - 1].f1, r.f0)))
        throw new Error('native profile endpoint discontinuity');
      if (nipValues && (r.x0 === XN || r.x1 === XN)) {
        const [unpassed, passed] = nipValues();
        if (!Number.isFinite(unpassed) || !Number.isFinite(passed) || !Object.is(unpassed, passed))
          throw new Error('native profile one-sided XN discontinuity');
      }
    }
    return records;
  }
  function nativeStripProfile(pose, strip) {
    const value = (x, passed) => Math.min(naturalHalf(pose.q - x, strip.mid, passed), envelope(x) - NP.contactClearanceMargin);
    const records = stripProfile(pose, strip).map((r) => ({ ...r, f0: value(r.x0, r.passed), f1: value(r.x1, r.passed) }));
    return validateNativeProfile(records, () => [value(XN, false), value(XN, true)]);
  }
  function nativeSheetSlabs(pose) {
    return STRIPS.flatMap((strip) => {
      const ranges = classRanges(pose, strip, nativeStripProfile);
      validateNativeProfile(ranges);
      return packCanonical(ranges, strip);
    });
  }
  const slabPolygon = (b) => [[b.x0, -b.f0], [b.x1, -b.f1], [b.x1, b.f1], [b.x0, b.f0]];
  // </verbatim geometry-base.mjs>
  // <verbatim ../vendor/anatomy/kit/turn-build.mjs>
  function signedArea(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }
  function roundedPolygon(polygon, radius = 0, steps = 4) {
    const ordered = signedArea(polygon) < 0 ? polygon.slice().reverse() : polygon.slice();
    if (!(radius > 0)) return ordered.map(([x, y]) => [x, y]);
    const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 1e-9;
    const poly = ordered.filter((p, i) => i === 0 || !same(p, ordered[i - 1]));
    while (poly.length > 1 && same(poly[0], poly[poly.length - 1])) poly.pop();
    if (poly.length < 3) return poly.map(([x, y]) => [x, y]);
    const n = poly.length;
    const normals = poly.map((a, i) => {
      const b = poly[(i + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    });
    const out = [];
    for (let i = 0; i < n; i++) {
      const na = normals[(i - 1 + n) % n];
      const nb = normals[i];
      const denom = 1 + na[0] * nb[0] + na[1] * nb[1];
      const c = [poly[i][0] - (radius * (na[0] + nb[0])) / denom, poly[i][1] - (radius * (na[1] + nb[1])) / denom];
      const a0 = Math.atan2(na[1], na[0]);
      let a1 = Math.atan2(nb[1], nb[0]);
      while (a1 < a0 - 1e-9) a1 += TAU;
      for (let s = 0; s <= steps; s++) {
        const t = a0 + ((a1 - a0) * s) / steps;
        out.push([c[0] + radius * Math.cos(t), c[1] + radius * Math.sin(t)]);
      }
    }
    return out;
  }
  // </verbatim ../vendor/anatomy/kit/turn-build.mjs>
  // <verbatim ../vendor/anatomy/kit/audit.mjs>
  function prism(F, polygon, s0, s1, meta = {}) {
    return { kind: "prism", F, poly: polygon.map(([x, y]) => [x, y]), s0: Math.min(s0, s1), s1: Math.max(s0, s1), ...meta };
  }
  // </verbatim ../vendor/anatomy/kit/audit.mjs>


  // One authored Hero source, namespaced for classic-bundle .toString() isolation.
  const modelData = () => MODEL;
  const heroModule = (() => {
  // <verbatim camera-hero-geometry.mjs>
  // CANDIDATE full-camera APPARATUS envelope around the existing native NIP rig (Polaroid 636 / 600 integral).
  // Static solids only. Every dimension here is ILLUSTRATIVE (mm-illustrative world of world-config.json), NOT factory
  // CAD. Optical/film/pod/roller physics stay in machine-model.mjs + geometry-base.mjs + bearing-geometry.mjs and are
  // NOT touched: this module only ADDS owners named `hero.*` and never edits, moves or re-authors any rig solid.
  //
  // Optical/mechanical topology (reference basis, see docs/machines/instant-film-camera.md, section Hero):
  //  - US4226519 col.9 / PDF11 (Fig.4): objective lens 120 + shutter 122 on the FRONT of main housing 104; light crosses
  //    the upper exposure chamber 116, hits inclined mirror 124 on inclined wall 118 of an open-bottom light-shielding
  //    cone, reflects DOWN through pack exposure aperture 50 onto the forwardmost (top) film unit. Pack chamber 114 is in
  //    the LOWER housing; door section 106 pivots DOWN on pins 108 and carries roller bracket 112 / rollers 126,128;
  //    exit slot 130 in the door front with a roller-type shade; cone flange 134 bears on the pack forward wall;
  //    support rails 138 and ramp spring contacts 140 locate the pack; pick enters container slot 52 at the trailing end.
  //  - Polaroid 636 repair manual (I1): Cone levered forward out of Body; Base Block on the top shoulders of the Cone
  //    carries the Lens Mounting Plate/shutter; Viewfinder on the Cone; taking mirror visible with front door open;
  //    front door release button, door hinges on both sides, door pawl; pack spring; swing-up strobe housing; eyecup;
  //    lighten/darken control; S1 exposure button; film shade. Gear/drive side is ambiguous in the manual -> UNKNOWN.
  // World axes as the model: +x toward the front exit slot, +y roller axis, +z up; film image face is +z.
  
  const Y_FRAME = Object.freeze({ o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] });
  const frame = () => ({ o: Y_FRAME.o.slice(), a: Y_FRAME.a.slice(), u: Y_FRAME.u.slice(), v: Y_FRAME.v.slice() });
  
  // Illustrative layout constants (NOT factory dimensions). Exposed for tests/docs.
  const HERO = Object.freeze({
    label: 'CANDIDATE 636 HERO APPARATUS / illustrative envelope, NOT factory CAD',
    front: 31, frontInner: 28, rear: -112.5, roofTop: 76, roofBottom: 72,
    wallFar: [-61, -58], cutRimNear: [58, 61],
    // central ray: lens axis z=37 along -x, fixed 45 deg mirror on plane z = x + MIRROR_C, ROI centre at x=-52 (q=0)
    lensAxisZ: 37, lensStopX: 26, mirrorC: 89, mirrorThickness: 1.5, inclinedWallThickness: 2,
    roiCentreX: -52, packTop: 4, apertureX: [-87, -17], apertureY: [-35, 35],
    // I4 pick-link through-slot in the pack roof (ILLUSTRATIVE): swept stem x[-103,-90.5], y[-2,2] for pick.offset 0..12;
    // the 0.5 mm geometric margin per side is an illustrative choice, not a collision tolerance.
    pickSlot: Object.freeze({ x: Object.freeze([-103.5, -90]), y: Object.freeze([-2.5, 2.5]) }),
    camera: Object.freeze({ azimuth: 55, elevation: 18, pad: 30, headroom: 30, height: 820 }),
    cutaway: Object.freeze(['near (+y) body side wall', 'near (+y) cone side wall', 'near (+y) pack side wall',
      'near (+y) door cheek', 'cone top wall for y > -4', 'roof for y > 42']),
  });
  
  const SQ2 = Math.SQRT2;
  // Prism extruded along +y with a convex polygon in (x,z).
  function yPrism(name, owner, poly, y0, y1) {
    if (!(y1 > y0)) throw new Error(`hero ${name}: empty y span`);
    return { kind: 'prism', F: frame(), poly: poly.map(([x, z]) => [x, z]), s0: y0, s1: y1, name, owner };
  }
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const box = (name, owner, x, y, z) => yPrism(name, owner, rect(x[0], x[1], z[0], z[1]), y[0], y[1]);
  // Full cylinder body, renderer contract poly [[s0,0],[s0,r],[s1,r],[s1,0]].
  function cylX(name, owner, x0, x1, y, z, r) { return { kind: 'body', F: { o: [0, y, z], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, poly: [[x0, 0], [x0, r], [x1, r], [x1, 0]], name, owner }; }
  function cylY(name, owner, y0, y1, x, z, r) { return { kind: 'body', F: { o: [x, 0, z], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, poly: [[y0, 0], [y0, r], [y1, r], [y1, 0]], name, owner }; }
  
  // Inner offset of a convex ccw polygon by d (intersection of offset edge lines).
  function offsetConvex(poly, d) {
    const n = poly.length, lines = [];
    for (let i = 0; i < n; i++) {
      const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % n], l = Math.hypot(x1 - x0, z1 - z0);
      const nx = -(z1 - z0) / l, nz = (x1 - x0) / l; // inward for ccw
      lines.push({ p: [x0 + nx * d, z0 + nz * d], t: [(x1 - x0) / l, (z1 - z0) / l] });
    }
    return lines.map((b, i) => {
      const a = lines[(i + n - 1) % n], den = a.t[0] * b.t[1] - a.t[1] * b.t[0];
      const s = ((b.p[0] - a.p[0]) * b.t[1] - (b.p[1] - a.p[1]) * b.t[0]) / den;
      return [a.p[0] + a.t[0] * s, a.p[1] + a.t[1] * s];
    });
  }
  const signedArea2 = (p) => p.reduce((m, [x, z], i) => { const [x1, z1] = p[(i + 1) % p.length]; return m + x * z1 - x1 * z; }, 0) / 2;
  function isConvexCcw(p) {
    if (!(signedArea2(p) > 0)) return false;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) return false;
    }
    return true;
  }
  
  // Owner -> stable render role and reference basis. Explicit table; unknown owners are rejected by roleTable().
  const HERO_OWNERS = Object.freeze({
    'hero.body.shell': ['hero-shell', 'I1 Body (hardbody moulding); outline illustrative'],
    'hero.body.cut-rim': ['hero-cut', 'cutaway section rim of the removed near body wall; display of a cut, not a part'],
    'hero.body.front-plate': ['hero-shell', 'I1 front plate/lens panel; I3 lens on front of housing 104'],
    'hero.door.housing': ['hero-door', 'I3 door section 106 with exit slot 130; I1 front door'],
    'hero.door.hinge': ['hero-hinge', 'I3 pins 108 (door pivots downward); I1 door hinges both sides'],
    'hero.door.latch': ['hero-latch', 'I3 latch member (not shown in patent); I1 front door release/latch'],
    'hero.door.shade': ['hero-door', 'I3 roller-type shade 132 over exit slot; I1 Film Shade (housing only)'],
    'hero.lens.base-block': ['hero-lens-housing', 'I1 Shutter Base Block on Cone shoulders'],
    'hero.lens.mounting-plate': ['hero-lens-housing', 'I1 Lens Mounting Plate'],
    'hero.lens.barrel': ['hero-lens-housing', 'I3 objective lens assembly 120 (barrel illustrative)'],
    'hero.lens.element': ['hero-glass', 'I3 objective lens 120 (single illustrative element; prescription UNKNOWN)'],
    'hero.lens.closeup': ['hero-glass', 'I1 Close-Up lens (636 CloseUp), parked shuttle, illustrative'],
    'hero.lens.photocell-window': ['hero-glass', 'I1 photometrics filters on Lens Mounting Plate (window only)'],
    'hero.cone.wall': ['hero-cone', 'I3 open-bottom light-shielding cone, inclined wall 118; I1 Cone'],
    'hero.cone.flange': ['hero-cone', 'I3 cone peripheral flange 134 bearing on pack forward wall'],
    'hero.cone.catch': ['hero-cone', 'I1 Cone held by catches inside the Body'],
    'hero.mirror.taking': ['hero-mirror', 'I1 taking mirror (fixed); I3 inclined mirror 124'],
    'hero.mirror.clip': ['hero-fastener', 'illustrative mirror retaining clips (I1 mirror cover/light seal exists)'],
    'hero.pack.shell': ['hero-pack', 'I3 film container 28: forward wall + exposure aperture 50, slot 52, exit slot 82'],
    'hero.pack.stack': ['hero-film-stack', 'I3 film units 32 below the forwardmost unit (count illustrative)'],
    'hero.pack.platen': ['hero-pack', 'I3 spring platen under the stack'],
    'hero.pack.platen-spring': ['hero-spring', 'I3 platen spring (shape illustrative)'],
    'hero.pack.battery': ['hero-pack', 'I1 600 pack battery; I3 battery 36 under platen'],
    'hero.camera.pack-rails': ['hero-frame', 'I3 support rails 138 at bottom of chamber 114'],
    'hero.camera.spring-contacts': ['hero-spring', 'I3 ramp-like spring contacts 140; I1 pack spring'],
    'hero.drive.cover-envelope': ['hero-drive', 'I1 Gear Drive Cover exists; side UNKNOWN; gears/motor NOT built here'],
    'hero.viewfinder.housing': ['hero-viewfinder', 'I1 Viewfinder housing on Cone, eyecup/retainer'],
    'hero.viewfinder.glass': ['hero-glass', 'I1 viewfinder front window'],
    'hero.strobe.housing': ['hero-strobe', 'I1 swing-up strobe housing (erected), flash window'],
    'hero.strobe.hinge': ['hero-hinge', 'I1 fold-down strobe hinge (illustrative pin)'],
    'hero.control.buttons': ['hero-control', 'I1 S1 exposure button, door release, lighten/darken tab'],
    'hero.fastener.screws': ['hero-fastener', 'illustrative screw heads on the front plate'],
  });
  
  // Build every hero solid. Pure, deterministic, finite; no rig solid is created or changed.
  function heroSolids() {
    const out = [], H = HERO;
    const add = (s) => { out.push(s); return s; };
    const named = (owner) => { let i = 0; return () => `${owner}:${i++}`; };
  
    // ---- body shell: far wall (two convex pieces + door cheek seam), roof, rear slope cover ----
    const sh = named('hero.body.shell'), O = 'hero.body.shell';
    const slopeC = 118.5; // outer rear slope z = x + 118.5 (parallel to the mirror plane, clears the pack), illustrative
    add(yPrism(sh(), O, [[H.rear, -20], [-10, -20], [-10, H.roofTop], [H.roofTop - slopeC, H.roofTop], [H.rear, H.rear + slopeC]], ...H.wallFar));
    add(yPrism(sh(), O, rect(-10, H.front, 21, H.roofTop), ...H.wallFar));
    add(yPrism(sh(), O, [[H.roofBottom - slopeC, H.roofBottom], [H.front, H.roofBottom], [H.front, H.roofTop], [H.roofTop - slopeC, H.roofTop]], -58, 42));
    // rear slope cover (3 mm along x) behind the mirror wall, from the rear foot to the roof (shares the roof edge)
    add(yPrism(sh(), O, [[H.rear, H.rear + slopeC], [H.rear + 3, H.rear + slopeC], [H.roofBottom - slopeC + 3, H.roofBottom], [H.roofBottom - slopeC, H.roofBottom]], -58, 42));
    add(box(sh(), O, [H.rear, H.rear + 3], [-58, 42], [-20, H.rear + slopeC]));
    // ---- near cut rim: ring partition of the outer profile (display of the cut face, integral to the shell) ----
    const profile = [[H.rear, -20], [H.front, -20], [H.front, H.roofTop], [H.roofTop - slopeC, H.roofTop], [H.rear, H.rear + slopeC]];
    const inner = offsetConvex(profile, 3.5), cr = named('hero.body.cut-rim');
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length, quad = [profile[i], profile[j], inner[j], inner[i]];
      if (i === 0) continue; // bottom edge: the base is the ground, the door/pack bottoms are open below
      add(yPrism(cr(), 'hero.body.cut-rim', quad, ...H.cutRimNear));
    }
    // ---- front plate around the lens opening (|y|<11, 26<z<48) ----
    const fp = named('hero.body.front-plate'), FP = 'hero.body.front-plate', fx = [H.frontInner, H.front];
    add(box(fp(), FP, fx, [-58, 58], [22, 26]));
    add(box(fp(), FP, fx, [-58, 58], [48, H.roofBottom]));
    add(box(fp(), FP, fx, [-58, -11], [26, 48]));
    add(box(fp(), FP, fx, [11, 58], [26, 48]));
  
    // ---- door section: front wall with exit slot (z -0.9..1.2) notched for the rig exit tray rails |y| 36..40 ----
    const dh = named('hero.door.housing'), DH = 'hero.door.housing';
    add(box(dh(), DH, fx, [-58, 58], [1.2, 21.5]));
    for (const y of [[-58, -40], [-36, 36], [40, 58]]) add(box(dh(), DH, fx, y, [-20, -0.9]));
    add(box(dh(), DH, [-10, H.front], H.wallFar, [-20, 20])); // far door cheek (seam to body at z 20..21)
    add(box(dh(), DH, [-8, H.frontInner], [-58, 42], [20, 21.5])); // door top hood over the roller bracket
    const hg = named('hero.door.hinge');
    for (const y of [[-58, -41], [-35, 35], [41, 58]]) add(cylY(hg(), 'hero.door.hinge', y[0], y[1], 32.5, -18.5, 1.4));
    const la = named('hero.door.latch');
    add(box(la(), 'hero.door.latch', [24, H.frontInner], [-6, 6], [21.5, 24])); // body catch behind front plate
    add(box(la(), 'hero.door.latch', [25, H.frontInner], [-5, 5], [17, 20])); // door tongue (rests on hood line)
    add(box('hero.door.shade:0', 'hero.door.shade', [H.front, 36], [-46, 46], [1.4, 5])); // shade housing over slot
  
    // ---- lens / shutter: base block frame, mounting plate ring, barrel, element ----
    // I2 ILLUSTRATIVE choice: base-block opening widened minimally +-7 -> +-7.25 mm (+0.25 mm/side) to clear g=1 bundle at x=18.
    const bb = named('hero.lens.base-block'), BB = 'hero.lens.base-block', zc = H.lensAxisZ, hb = 7.25;
    add(box(bb(), BB, [18, H.frontInner], [-14, 14], [zc + hb, zc + 13]));
    add(box(bb(), BB, [18, H.frontInner], [-14, 14], [zc - 13, zc - hb]));
    add(box(bb(), BB, [18, H.frontInner], [-14, -hb], [zc - hb, zc + hb]));
    add(box(bb(), BB, [18, H.frontInner], [hb, 14], [zc - hb, zc + hb]));
    const mp = named('hero.lens.mounting-plate'), MP = 'hero.lens.mounting-plate';
    add(box(mp(), MP, fx, [-11, 11], [zc + 8, 48]));
    add(box(mp(), MP, fx, [-11, 11], [26, zc - 8]));
    add(box(mp(), MP, fx, [-11, -8], [zc - 8, zc + 8]));
    add(box(mp(), MP, fx, [8, 11], [zc - 8, zc + 8]));
    add(cylX('hero.lens.barrel:0', 'hero.lens.barrel', H.frontInner, 38, 0, zc, 7.9));
    add(cylX('hero.lens.barrel:1', 'hero.lens.barrel', 38, 40, 0, zc, 6.8));
    add(cylX('hero.lens.element:0', 'hero.lens.element', 40, 41.2, 0, zc, 5.6));
    add(box('hero.lens.closeup:0', 'hero.lens.closeup', [H.front, 33], [-36, -19], [zc - 7, zc + 7]));
    add(box('hero.lens.photocell-window:0', 'hero.lens.photocell-window', [H.front, 32], [13, 23], [50, 56]));
  
    // ---- cone: far side wall, front wall (lens aperture), top wall (far half), inclined wall + mirror ----
    const mc = H.mirrorC, mBack = mc + H.mirrorThickness * SQ2, wOut = mBack + H.inclinedWallThickness * SQ2;
    const topLine = (x) => 52 + (x - 18) * (-8 / 52); // illustrative cone roof line above the upper ray (exact slope -2/13)
    // I2 ILLUSTRATIVE choices: (1) xTopIn = -34 (18 - 13*4, topLine = 60) and xTopB = -31.5625 (18 - 13*61/16, topLine = 59.625)
    // place the roof/inclined-wall junction on exact dyadic points of 2x + 13z = 712, resolving the 2.6e-15 mm binary64 rounding
    // overlap hero.cone.wall:6 ~ hero.cone.wall:7 into exact BOUNDARY_CONTACT; (2) cone.wall:2-5 opening widened minimally from
    // |y|<7, |z-37|<7 to |y|<7.5, |z-37|<7.5 (+0.5 mm/side) to clear the g=1 bundle (+-8674/1157 ~= +-7.496975 mm) at x=16.
    const xTopIn = -34, xTopB = -31.5625, hc = 7.5;
    const cw = named('hero.cone.wall'), CW = 'hero.cone.wall';
    // far side wall in two convex pieces; the front piece starts above the door hood (z 22)
    add(yPrism(cw(), CW, [[H.packTop - wOut, H.packTop], [-8, H.packTop], [-8, topLine(-8)], [xTopIn, topLine(xTopIn)]], -46, -44));
    add(yPrism(cw(), CW, [[-8, 22], [18, 22], [18, 52], [-8, topLine(-8)]], -46, -44));
    add(box(cw(), CW, [16, 18], [-44, 44], [zc + hc, 52]));
    add(box(cw(), CW, [16, 18], [-44, 44], [22, zc - hc]));
    add(box(cw(), CW, [16, 18], [-44, -hc], [zc - hc, zc + hc]));
    add(box(cw(), CW, [16, 18], [hc, 44], [zc - hc, zc + hc]));
    add(yPrism(cw(), CW, [[xTopIn, topLine(xTopIn)], [18, 52], [18, 54], [xTopIn, topLine(xTopIn) + 2]], -44, -4));
    // inclined wall 118 between z = x + mBack and z = x + wOut, from the pack top up to the cone roof line
    add(yPrism(cw(), CW, [[H.packTop - mBack, H.packTop], [xTopB, topLine(xTopB)], [xTopIn, topLine(xTopIn)], [H.packTop - wOut, H.packTop]], -44, 44));
    // flange 134 on the pack forward wall around the aperture
    const fl = named('hero.cone.flange'), FL = 'hero.cone.flange';
    add(box(fl(), FL, [H.apertureX[1], -8], [-44, 44], [H.packTop, H.packTop + 1.2]));
    add(box(fl(), FL, [-85.5, H.apertureX[1]], [-44, H.apertureY[0]], [H.packTop, H.packTop + 1.2]));
    add(box(fl(), FL, [-85.5, H.apertureX[1]], [H.apertureY[1], 44], [H.packTop, H.packTop + 1.2]));
    const ct = named('hero.cone.catch');
    add(box(ct(), 'hero.cone.catch', [16, 18], [4, 8], [52, H.roofBottom]));
    add(box(ct(), 'hero.cone.catch', [16, 18], [26, 30], [52, H.roofBottom]));
    // taking mirror on plane z = x + mc (reflective face normal (1,0,-1)/sqrt2), lower/upper ends from the ray fit
    const m0 = 5.5 - mc, m1 = 58 - mc, d = H.mirrorThickness / SQ2;
    add(yPrism('hero.mirror.taking:0', 'hero.mirror.taking', [[m0, m0 + mc], [m1, m1 + mc], [m1 - d, m1 + mc + d], [m0 - d, m0 + mc + d]], -38, 38));
    const cl = named('hero.mirror.clip');
    // lower-end clips only, outside the ray footprint (lowest ray hit x=-82.1) and above the flange
    for (const y of [[-30, -24], [24, 30]]) add(yPrism(cl(), 'hero.mirror.clip', [[m0 - 1, m0 - 1 + mc], [m0, m0 + mc], [m0 - d, m0 + mc + d], [m0 - 1 - d, m0 - 1 + mc + d]], ...y));
  
    // ---- film pack (illustrative 600-type cutaway): forward wall + aperture, far side, trailing slot, bottom ----
    const ps = named('hero.pack.shell'), PS = 'hero.pack.shell', [ax0, ax1] = H.apertureX, [ay0, ay1] = H.apertureY;
    // Roof x[-106,ax0] is partitioned around HERO.pickSlot (exact complement, no other cut): :0 keeps the -y part and its
    // name; the +y part and the two slot end pieces are appended after the last pack-shell piece so other names stay put.
    const [sx0, sx1] = H.pickSlot.x, [sy0, sy1] = H.pickSlot.y;
    add(box(ps(), PS, [-106, ax0], [-46, sy0], [3, H.packTop]));
    add(box(ps(), PS, [ax1, -7], [-46, 46], [3, H.packTop]));
    add(box(ps(), PS, [ax0, ax1], [-46, ay0], [3, H.packTop]));
    add(box(ps(), PS, [ax0, ax1], [ay1, 46], [3, H.packTop]));
    add(box(ps(), PS, [-106, -7], [-48, -46], [-18.5, H.packTop])); // far side wall
    for (const y of [[-46, -7], [7, 46]]) add(box(ps(), PS, [-108, -106], y, [-18.5, H.packTop])); // trailing wall, pick slot 52
    add(box(ps(), PS, [-9, -7], [-46, 46], [1.6, 3])); // leading wall above exit slot 82
    for (const y of [[-46, -40], [-36, 36], [40, 46]]) add(box(ps(), PS, [-9, -7], y, [-17, -1.4])); // below the slot
    for (const [x, y] of [[[-106, -9], [-46, -40]], [[-106, -9], [40, 46]], [[-86, -9], [-36, 36]], [[-106, -86], [-36, -7]], [[-106, -86], [7, 36]]])
      add(box(ps(), PS, x, y, [-18.5, -17]));
    add(box(ps(), PS, [-106, ax0], [sy1, 46], [3, H.packTop]));
    add(box(ps(), PS, [-106, sx0], [sy0, sy1], [3, H.packTop]));
    add(box(ps(), PS, [sx1, ax0], [sy0, sy1], [3, H.packTop]));
    const st = named('hero.pack.stack');
    for (let k = 0; k < 7; k++) {
      const z = [-3.2 - 0.8 * (k + 1), -3.2 - 0.8 * k];
      add(box(st(), 'hero.pack.stack', [-85.5, -10], [-35, 35], z));
      add(box(st(), 'hero.pack.stack', [-100, -86], [-35, -7], z));
      add(box(st(), 'hero.pack.stack', [-100, -86], [7, 35], z));
    }
    const zStack = -3.2 - 0.8 * 7;
    add(box('hero.pack.platen:0', 'hero.pack.platen', [-84, -12], [-34, 34], [zStack - 1.2, zStack]));
    const sp = named('hero.pack.platen-spring'), zBat = -15, zPl = zStack - 1.2, seg = 4, dz = (zPl - zBat) / seg;
    for (const x0 of [-72, -36]) for (let i = 0; i < seg; i++) {
      const a = x0 + (i % 2 ? 4 : 0), b = x0 + (i % 2 ? 0 : 4), z0 = zBat + dz * i, z1 = z0 + dz;
      add(yPrism(sp(), 'hero.pack.platen-spring', [[a, z0], [a + 2.5, z0], [b + 2.5, z1], [b, z1]], -20, 20));
    }
    add(box('hero.pack.battery:0', 'hero.pack.battery', [-80, -20], [-30, 30], [-17, zBat]));
    const pr = named('hero.camera.pack-rails');
    for (const y of [[-30, -26], [26, 30]]) add(box(pr(), 'hero.camera.pack-rails', [-84, -12], y, [-20, -18.5]));
    const sc = named('hero.camera.spring-contacts');
    for (const y of [[-24, -18], [18, 24]]) add(yPrism(sc(), 'hero.camera.spring-contacts', [[-104, -20], [-96, -20], [-98, -18.5], [-102, -18.5]], ...y));
  
    // ---- drive cover envelope (gear side UNKNOWN; no gears/motor claimed here) ----
    add(box('hero.drive.cover-envelope:0', 'hero.drive.cover-envelope', [-40, -12], [-57, -50], [-20, 0]));
  
    // ---- viewfinder and strobe on the roof ----
    const vf = named('hero.viewfinder.housing');
    add(box(vf(), 'hero.viewfinder.housing', [-14, H.front], [16, 40], [H.roofTop, 84]));
    add(box(vf(), 'hero.viewfinder.housing', [-22, -14], [18, 38], [H.roofTop, 86]));
    add(box('hero.viewfinder.glass:0', 'hero.viewfinder.glass', [H.front, 32], [18, 38], [77, 83]));
    const sb = named('hero.strobe.housing');
    add(box(sb(), 'hero.strobe.housing', [-6, 30], [-50, 8], [H.roofTop, 92]));
    add(box(sb(), 'hero.strobe.housing', [30, 31.5], [-46, 4], [80, 90]));
    add(cylY('hero.strobe.hinge:0', 'hero.strobe.hinge', -48, 6, -8, 78, 2));
  
    // ---- controls and fasteners on the front plate ----
    const bt = named('hero.control.buttons');
    add(box(bt(), 'hero.control.buttons', [H.front, 34], [-52, -40], [58, 66])); // S1 exposure button
    add(box(bt(), 'hero.control.buttons', [H.front, 33], [-8, 8], [22.5, 25.5])); // door release
    add(box(bt(), 'hero.control.buttons', [H.front, 32], [24, 40], [51, 55])); // lighten/darken tab
    const sw = named('hero.fastener.screws');
    for (const y of [-16, 16]) for (const z of [29, 45]) add(cylX(sw(), 'hero.fastener.screws', H.front, H.front + 0.9, y, z, 1.3));
    for (const y of [-50, 50]) add(cylX(sw(), 'hero.fastener.screws', H.front, H.front + 0.9, y, 68, 1.3));
  
    for (const s of out) {
      if (!HERO_OWNERS[s.owner]) throw new Error(`hero owner ${s.owner} has no declared role/basis`);
      if (s.kind === 'prism' && !isConvexCcw(s.poly)) throw new Error(`hero ${s.name}: polygon is not convex ccw`);
      const finite = JSON.stringify(s.F) + JSON.stringify(s.poly) + s.s0 + s.s1;
      if (/null|NaN|Infinity/.test(finite)) throw new Error(`hero ${s.name}: nonfinite`);
    }
    return out;
  }
  
  function heroParts() {
    return Object.entries(HERO_OWNERS).map(([id, [role, basis]]) => ({ id, role, basis, illustrative: true }));
  }
  // </verbatim camera-hero-geometry.mjs>
    return {heroSolids,HERO_OWNERS};
  })();
  const shutterModule = (() => {
  // <verbatim camera-shutter-geometry.mjs>
  // CANDIDATE dynamic shutter mechanism for the 636 hero: two scanning blades, walking beam, inertia, solenoid plunger
  // yoke on the beam's fourth pin, shutter latch and the S5 actuator, posed ONLY from the achieved snapshot's
  // shutter.transmission and the phase that snapshot.time + the model's own opening/hold seconds imply (no extra clock).
  // Every dimension is ILLUSTRATIVE (not factory CAD).
  // Reference basis (Polaroid 636 repair manual, Dec 1995; PDF page = printed page + 6):
  //  - PDF58 Fig.21/22: removing the Inertia / Walking Beam assembly and the Shutter Latch.
  //  - PDF63 step 35 + Fig.31/32: blades over a 3/32" (2.4 mm) dowel; MOLDED PIN on the Base Block through the blade
  //    slots. Bottom, middle and top blades are listed; the middle plate's role is NOT stated -> NOT built (UNKNOWN).
  //  - PDF64 step 37 + Fig.33: the Inertia/Walking Beam engages FOUR pins: in the blades, the Solenoid Plunger Yoke and
  //    the Base Block pivot. Fig.34 / step 38: the Shutter Latch mates with the S5 actuator.
  //  - p.4-5 steps 4-5: the solenoid releases the beam from the latch, spring action OPENS the blades, the solenoid pulls
  //    them closed. Opening Blade Spring between a rack notch and the Base Block (Fig.18/38).
  // Construction choices NOT in the manual (declared): V-edge apertures meeting apex-to-apex at g=0 (zero dead travel),
  // transverse link slots, radial yoke slot in the beam, square press-fit holes, running clearance 3/256 mm, dyadic
  // dimensions so staked/loaded line contacts are exact where the frame is axis-aligned, straight coil envelopes,
  // box solenoid case/coil, latch shape, S5 actuator/case shape, inertia as a block pressed on the beam.
  // World: +x toward the lens (front), +y roller axis, +z up. Shutter plane coordinates (y, z - axisZ).
  
  const SHUTTER = Object.freeze({
    axisZ: 37, pivot: Object.freeze([17, 0]), arm: 12, halfMax: 5, quantum: 2 ** -40, fullArea: 50, clear: 3 / 256,
    x: Object.freeze({ base: 26.4, bladeB: Object.freeze([26.4, 26.7]), bladeA: Object.freeze([26.7, 27]), beam: Object.freeze([27, 27.6]),
      pinA: Object.freeze([26.7, 27.6]), pinB: Object.freeze([26.45, 27.6]), spring: Object.freeze([27.1, 27.5]), front: Object.freeze([27.6, 27.95]),
      rod: Object.freeze([27.7, 27.95]), yokePin: Object.freeze([27.1, 27.95]), inertiaSpring: Object.freeze([27.65, 27.95]) }),
    pinR: 0.5, hookR: 0.375, hook: Object.freeze([3, 5]), anchor: Object.freeze([26.4, 5]), anchorR: 0.4, springHalfWidth: 0.25, springEndGap: 0.05,
    yokeV: -6, latchPivot: Object.freeze([25.5, 9.25]), latchRelease: Object.freeze([0.9375, 0.3125]), s5Travel: 0.5,
  });
  
  // Phase of the achieved snapshot: g plus snapshot.time against the model's own opening/hold seconds. g = 0 before the
  // hold end is the cocked (latched) state, g = 0 after it is the solenoid-held closed state.
  function shutterPhase(snapshot, model) {
    const g = snapshot.shutter.transmission, t = snapshot.time, open = model.openingSeconds, hold = open + model.holdSeconds;
    if (g === 0) return t < hold ? 'latched' : 'closed';
    if (t < open) return 'opening';
    if (t < hold) { if (g !== 1) throw new Error(`shutter: hold phase with g=${g}`); return 'holding'; }
    return 'closing';
  }
  
  // Achieved g + phase -> mechanism pose. Rhombus half-diagonal e = halfMax*sqrt(g) (area 2e^2 = fullArea*g). The
  // blades are driven through running clearance d = clear = 3/256 mm: spring-driven phases (latched/opening/holding) load the
  // link pins on the opening side, solenoid-driven phases (closing/closed) on the closing side. Blade apex =
  // arm*sin(theta) + (1 - sigma)*clear; the opening-side sine e/arm is quantised DOWN to 2^-40 (realised apex <= e: never
  // more light than the law) and the loaded-side shift (1 - sigma)*clear/arm is exact; cos is quantised down until c^2 + s^2 <= 1 exactly.
  function shutterPose(transmission, phase) {
    const S = SHUTTER, q = S.quantum, g = transmission;
    if (typeof g !== 'number' || !(g >= 0 && g <= 1)) throw new Error(`shutter: transmission ${g} outside [0,1]`);
    if (!['latched', 'opening', 'holding', 'closing', 'closed'].includes(phase)) throw new Error(`shutter: phase ${phase}`);
    if ((g === 0) !== (phase === 'latched' || phase === 'closed')) throw new Error(`shutter: phase ${phase} with g=${g}`);
    const sigma = phase === 'closing' || phase === 'closed' ? -1 : 1, lag = (1 - sigma) * S.clear;
    // clear/arm = 2^-10 is a whole number of grid steps, so the loaded-side shift is exact and the apex is phase-free
    const s = Math.floor(S.halfMax * Math.sqrt(g) / S.arm / q) * q - lag / S.arm, a = BigInt(s / q);
    let c = Math.floor(Math.sqrt(1 - s * s) / q) * q;
    while (a * a + BigInt(c / q) ** 2n > 1n << 80n) c -= q; // exact integer test on the 2^-40 grid
    const travel = S.arm * s, half = travel + lag, area = half > 0 ? 2 * half * half : 0;
    const yoke = S.pivot[0] + Math.round(S.yokeV * s / c / q) * q;
    return { transmission: g, phase, sigma, s, c, theta: Math.atan2(s, c), travel, half, area, fraction: area / S.fullArea,
      open: half > 0, latched: phase === 'latched', yoke };
  }
  
  // Moving rigid solids for one pose. Blade frames sit on the LOADED pin side (pin centre -/+ clear), so the loaded slot
  // wall is exactly one radius from the pin centre and the free wall 2*clear away.
  function shutterMovingSolids(pose) {
    const S = SHUTTER, Z = S.axisZ, s = pose.s, c = pose.c, pu = S.pivot[0], pv = S.pivot[1], L = S.arm, X = S.x, d = S.clear, w = 0.5 + d;
    const ax = () => [1, 0, 0], ey = () => [0, 1, 0], ez = () => [0, 0, 1];
    const r = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const out = [];
    const plate = (owner, o, u, v, polys, x) => polys.forEach((poly, i) => out.push({ kind: 'prism', F: { o, a: ax(), u: u(), v: v() }, poly, s0: x[0], s1: x[1], name: `${owner}:${i}`, owner }));
    const yA = pu + L * s - pose.sigma * d, yB = pu - L * s + pose.sigma * d, la = d - 17, rb = -17 - d;
    plate('hero.shutter.blade-a', [0, yA, Z], ey, ez, [
      [[la, 0], [-9, 0], [-9, 8], [la - 8, 8]], [[la - 8, -8], [-9, -8], [-9, 0], [la, 0]],
      r(-9, -w, 2, 14), r(w, 2.5, 2, 14), r(-w, w, 2, 9.8), r(-w, w, 12.6, 14),
      r(-26, -23.7, -11.4, -8), r(-23.7, -16.3, -11.4, -10.52), r(-23.7, -16.3, -9.48, -8), r(-16.3, -13, -11.4, -8)], X.bladeA);
    plate('hero.shutter.blade-b', [0, yB, Z], ey, ez, [
      [[-25, 0], [rb, 0], [rb + 8, 8], [-25, 8]], [[-25, -8], [rb + 8, -8], [rb, 0], [-25, 0]],
      r(-25, -17.7, -12.8, -8), r(-17.7, -10.3, -12.8, -10.52), r(-17.7, -10.3, -9.48, -8), r(-10.3, -w, -12.8, -8),
      r(-w, w, -12.8, -12.6), r(w, 2.5, -12.8, -8)], X.bladeB);
    const U = () => [0, c, -s], V = () => [0, s, c];
    plate('hero.shutter.walking-beam', [0, pu, Z + pv], U, V, [
      r(-1.4, -0.62, -0.62, 0.62), r(0.62, 1.4, -0.62, 0.62),
      r(-1.4, 1.4, 0.62, 11.5), r(-1.4, -0.5, 11.5, 12.5), r(0.5, 1.4, 11.5, 12.5), r(-1.4, 1.4, 12.5, 13),
      r(-1.4, 1.4, -5.4, -0.62), r(-1.4, -w, -7.6, -5.4), r(w, 1.4, -7.6, -5.4), r(-1.4, 1.4, -11.5, -7.6),
      r(-1.4, -0.5, -12.5, -11.5), r(0.5, 1.4, -12.5, -11.5), r(-1.4, 1.4, -13, -12.5), r(1.4, 2.625, 4.5, 5.5)], X.beam);
    // inertia block pressed on the beam face (rigid with the beam); its +u face is the latch tooth
    plate('hero.shutter.inertia', [0, pu, Z + pv], U, V, [r(-1.4, 2.625, 6, 9)], X.front);
    const pin = (name, owner, o, rad, x, u = U, v = V) => out.push({ kind: 'body', F: { o, a: ax(), u: u(), v: v() }, poly: [[x[0], 0], [x[0], rad], [x[1], rad], [x[1], 0]], name, owner });
    pin('hero.shutter.link-pins:0', 'hero.shutter.link-pins', [0, pu + L * s, Z + pv + L * c], S.pinR, X.pinA);
    pin('hero.shutter.link-pins:1', 'hero.shutter.link-pins', [0, pu - L * s, Z + pv - L * c], S.pinR, X.pinB);
    const hy = pu + (S.hook[0] * c + S.hook[1] * s), hz = Z + pv + (S.hook[1] * c - S.hook[0] * s);
    pin('hero.shutter.hook-post:0', 'hero.shutter.hook-post', [0, hy, hz], S.hookR, X.beam);
    // solenoid plunger: yoke plate + rod translate along y; the yoke pin (beam's fourth pin) rides the beam's radial slot
    const yz = Z + pv + S.yokeV;
    plate('hero.shutter.plunger', [0, pose.yoke, yz], ey, ez, [r(-1, -0.5, -0.8, 0.8), r(0.5, 1, -0.8, 0.8), r(-0.5, 0.5, -0.8, -0.5), r(-0.5, 0.5, 0.5, 0.8)], X.front);
    plate('hero.shutter.plunger-rod', [0, pose.yoke, yz], ey, ez, [r(1, 6.5, -0.4, 0.4)], X.rod);
    pin('hero.shutter.yoke-pin:0', 'hero.shutter.yoke-pin', [0, pose.yoke, yz], S.pinR, X.yokePin, ey, ez);
    // shutter latch: latched = axis frame, shifted +clear (loaded onto its pivot pin by the inertia tooth); released =
    // declared quantised swing frame about the unloaded pivot centre (hook lifted off the tooth, tail off S5)
    const [lc, ls] = pose.latched ? [1, 0] : S.latchRelease, lo = [0, S.latchPivot[0] + (pose.latched ? d : 0), Z + S.latchPivot[1]];
    plate('hero.shutter.latch', lo, () => [0, lc, -ls], () => [0, ls, lc], [r(-1.2, -w, -1.2, 1.2), r(w, 1.2, -1.2, 1.2), r(-w, w, -1.2, -w), r(-w, w, w, 1.2),
      r(-5, -1.2, -0.75, 0.25), r(-5.875 - d, -5, -1.5, -0.5), r(-0.375, 0.375, 1.2, 6)], X.front);
    // S5 actuator: pressed against the S5 case by the latch tail when latched; extended by s5Travel when released
    const sy = S.latchPivot[0] + d - 1.875 + (pose.latched ? 0 : S.s5Travel);
    plate('hero.shutter.s5-actuator', [0, sy, Z + 14.25], ey, ez, [r(0, 1.5, 0, 1)], X.front);
    // opening spring: straight coil envelope from the hook post to the base-block anchor; end loops are not modelled
    const ay = S.anchor[0], az = Z + S.anchor[1], dy = ay - hy, dz = az - hz, len = Math.hypot(dy, dz), ty = dy / len, tz = dz / len;
    const g0 = S.hookR + S.springEndGap, g1 = S.anchorR + S.springEndGap, hw = S.springHalfWidth;
    const p0 = [hy + ty * g0, hz + tz * g0], p1 = [ay - ty * g1, az - tz * g1];
    const ring = [[p0[0] + tz * hw, p0[1] - ty * hw], [p1[0] + tz * hw, p1[1] - ty * hw], [p1[0] - tz * hw, p1[1] + ty * hw], [p0[0] - tz * hw, p0[1] + ty * hw]];
    const area2 = ring.reduce((m, [a, b], i) => { const [a1, b1] = ring[(i + 1) % 4]; return m + a * b1 - a1 * b; }, 0);
    out.push({ kind: 'prism', F: { o: [0, 0, 0], a: ax(), u: ey(), v: ez() }, poly: area2 < 0 ? ring.reverse() : ring, s0: X.spring[0], s1: X.spring[1], name: 'hero.shutter.opening-spring:0', owner: 'hero.shutter.opening-spring' });
    // inertia spring: coil envelope below the inertia block, clear of every body (role, rate and ends UNKNOWN)
    plate('hero.shutter.inertia-spring', [0, pu, Z + pv], U, V, [r(-0.25, 0.25, 1.5, 5.95)], X.inertiaSpring);
    return out;
  }
  
  // ---- Node-only (not spliced): owners, static shutter material, hero static replacement ----
  const SHUTTER_MOVING_OWNERS = Object.freeze(['hero.shutter.blade-a', 'hero.shutter.blade-b', 'hero.shutter.walking-beam',
    'hero.shutter.inertia', 'hero.shutter.link-pins', 'hero.shutter.hook-post', 'hero.shutter.plunger', 'hero.shutter.plunger-rod',
    'hero.shutter.yoke-pin', 'hero.shutter.latch', 'hero.shutter.s5-actuator', 'hero.shutter.opening-spring', 'hero.shutter.inertia-spring']);
  const SHUTTER_OWNERS = Object.freeze({
    'hero.shutter.blade-a': ['hero-shutter-blade', 'I1 Fig.31 top shutter blade (beam-linked); V-edge aperture outline illustrative'],
    'hero.shutter.blade-b': ['hero-shutter-blade', 'I1 Fig.31 bottom shutter blade (beam-linked); V-edge aperture outline illustrative'],
    'hero.shutter.walking-beam': ['hero-shutter-beam', 'I1 Fig.21/32/33 Walking Beam with radial yoke slot (slot illustrative)'],
    'hero.shutter.inertia': ['hero-shutter-beam', 'I1 Fig.21/33 inertia on the walking beam (block illustrative; its face is the latch tooth)'],
    'hero.shutter.link-pins': ['hero-shutter-pin', 'I1 Fig.33 blade pins engaged by the walking beam (press-fit in beam, illustrative)'],
    'hero.shutter.hook-post': ['hero-shutter-pin', 'I1 Fig.18/38 rack notch on the beam carrying the opening spring end (illustrative post)'],
    'hero.shutter.plunger': ['hero-shutter-pin', 'I1 Fig.33 Solenoid Plunger Yoke (plate illustrative)'],
    'hero.shutter.plunger-rod': ['hero-shutter-pin', 'I1 solenoid plunger (rod illustrative)'],
    'hero.shutter.yoke-pin': ['hero-shutter-pin', 'I1 Fig.33 yoke pin = fourth pin engaged by the walking beam'],
    'hero.shutter.latch': ['hero-shutter-beam', 'I1 Fig.22/34 Shutter Latch (shape illustrative)'],
    'hero.shutter.s5-actuator': ['hero-control', 'I1 Fig.34 S5 actuator mated by the latch (shape illustrative)'],
    'hero.shutter.opening-spring': ['hero-spring', 'I1 Fig.18/38 Opening Blade Spring (rate/preload UNKNOWN; end loops not modelled)'],
    'hero.shutter.inertia-spring': ['hero-spring', 'I1 Fig.21 inertia spring (role/rate/ends UNKNOWN; envelope only)'],
    'hero.shutter.pivot-pin': ['hero-shutter-pin', 'I1 Fig.33 Base Block pivot point for the walking beam (headed pin illustrative)'],
    'hero.shutter.guide-pin': ['hero-shutter-pin', 'I1 Fig.31 molded pin on the Base Block through the blade slots'],
    'hero.shutter.anchor-post': ['hero-shutter-pin', 'I1 Fig.18 opening spring anchor on the Base Block (post illustrative)'],
    'hero.shutter.retaining-rails': ['hero-frame', 'illustrative axial retention standing in for the Lens Mounting Plate cover (I1 Fig.20)'],
    'hero.shutter.solenoid-case': ['hero-frame', 'I1 shutter solenoid case and mount (box form illustrative)'],
    'hero.shutter.solenoid-coil': ['hero-control', 'I1 shutter solenoid coil (winding envelope; no electrical model)'],
    'hero.shutter.latch-pivot': ['hero-shutter-pin', 'I1 Fig.22 latch pivot on the Base Block (pin illustrative)'],
    'hero.shutter.s5-case': ['hero-control', 'I1 Fig.34 S5 switch body: actuator stop and guide plate (illustrative)'],
  });
  
  const xBox = (name, owner, x, y, z) => ({ kind: 'prism', F: { o: [0, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    poly: [[y[0], z[0]], [y[1], z[0]], [y[1], z[1]], [y[0], z[1]]], s0: x[0], s1: x[1], name, owner });
  const xPin = (name, owner, y, z, rad, x) => ({ kind: 'body', F: { o: [0, y, z], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    poly: [[x[0], 0], [x[0], rad], [x[1], rad], [x[1], 0]], name, owner });
  
  // Static shutter material. The Base Block is re-authored for this candidate: its front face is recessed to x=26.4 to
  // form the blade well and it is widened to carry the pivot, anchor and rails (the 121-solid hero block was solid to
  // x=28 and left no place for blades). I2 ILLUSTRATIVE choice: optical opening widened minimally from |y|<7, |z-37|<7
  // to |y|<7.25, |z-37|<7.25 (+0.25 mm/side) so the g=1 pupil bundle (+-8134/1157 ~= +-7.03025 mm at x=18) passes without
  // vignetting while keeping the z=Z+7.25 bar seam strictly below retaining-rails:0 (z in [Z+7.3, Z+8]).
  function shutterStaticSolids() {
    const S = SHUTTER, Z = S.axisZ, xb = [18, S.x.base], hb = 7.25, out = [];
    const BB = 'hero.lens.base-block';
    out.push(xBox(`${BB}:0`, BB, xb, [-18, 27], [24, Z - hb]), xBox(`${BB}:1`, BB, xb, [-18, 27], [Z + hb, 54]),
      xBox(`${BB}:2`, BB, xb, [-18, -hb], [Z - hb, Z + hb]), xBox(`${BB}:3`, BB, xb, [hb, 27], [Z - hb, Z + hb]));
    out.push(xPin('hero.shutter.pivot-pin:0', 'hero.shutter.pivot-pin', S.pivot[0], Z + S.pivot[1], 0.6, [S.x.base, S.x.beam[1]]),
      xPin('hero.shutter.pivot-pin:1', 'hero.shutter.pivot-pin', S.pivot[0], Z + S.pivot[1], 1.2, [S.x.beam[1], 28]));
    out.push(xPin('hero.shutter.guide-pin:0', 'hero.shutter.guide-pin', 0, Z - 10, 0.5, [S.x.base, S.x.bladeA[1]]));
    out.push(xPin('hero.shutter.anchor-post:0', 'hero.shutter.anchor-post', S.anchor[0], Z + S.anchor[1], S.anchorR, [S.x.base, S.x.beam[1]]));
    const RR = 'hero.shutter.retaining-rails', top = [Z + 7.3, Z + 8], bottom = [Z - 11.4, Z - 10.9];
    out.push(xBox(`${RR}:0`, RR, [S.x.base, S.x.beam[1]], [-17, -14.1], top), xBox(`${RR}:1`, RR, [S.x.bladeA[1], S.x.beam[1]], [-14.1, 7.5], top),
      xBox(`${RR}:2`, RR, [S.x.base, S.x.beam[1]], [-17, -14.1], bottom), xBox(`${RR}:3`, RR, [S.x.bladeA[1], S.x.beam[1]], [-14.1, 4], bottom));
    // solenoid: back wall/mount on the base block face, floor (plunger slide face), side walls; coil envelope inside
    const SC = 'hero.shutter.solenoid-case', CO = 'hero.shutter.solenoid-coil', zs = Z + S.yokeV;
    out.push(xBox(`${SC}:0`, SC, [S.x.base, 28.2], [25, 25.5], [zs - 1.6, zs + 1.6]), xBox(`${SC}:1`, SC, [27.6, 27.7], [19, 25], [zs - 1.6, zs + 1.6]),
      xBox(`${SC}:2`, SC, [27.7, 28.2], [19, 25], [zs + 1.2, zs + 1.6]), xBox(`${SC}:3`, SC, [27.7, 28.2], [19, 25], [zs - 1.6, zs - 1.2]));
    out.push(xBox(`${CO}:0`, CO, [27.7, 28.2], [19.5, 24.5], [zs + 0.6, zs + 1.2]), xBox(`${CO}:1`, CO, [27.7, 28.2], [19.5, 24.5], [zs - 1.2, zs - 0.6]));
    // latch pivot pin; S5 case: actuator stop block + guide plate, both on the base block face
    out.push(xPin('hero.shutter.latch-pivot:0', 'hero.shutter.latch-pivot', S.latchPivot[0], Z + S.latchPivot[1], 0.5, [S.x.base, 28]));
    const S5 = 'hero.shutter.s5-case', sy = S.latchPivot[0] + S.clear - 1.875;
    out.push(xBox(`${S5}:0`, S5, [S.x.base, 28], [22.6, sy], [Z + 14.1, Z + 15.4]), xBox(`${S5}:1`, S5, [S.x.base, 27.6], [sy, 26], [Z + 14.1, Z + 15.4]));
    return out;
  }
  
  // Hero statics with the shutter: the 121 base hero solids minus the 4 old base-block boxes, with front-plate:3 narrowed
  // to y>=26 (declared display window over the beam), plus the static shutter material above.
  const SHUTTER_REPLACED = Object.freeze(['hero.lens.base-block:0', 'hero.lens.base-block:1', 'hero.lens.base-block:2', 'hero.lens.base-block:3', 'hero.body.front-plate:3']);
  function shutterHeroStatics(base) {
    const out = [];
    for (const s of base) {
      if (s.owner === 'hero.lens.base-block') continue;
      if (s.name === 'hero.body.front-plate:3') {
        const poly = s.poly.map(([x, z]) => [x, z]);
        if (!(s.s0 === 11 && s.s1 === 58)) throw new Error('front-plate:3 is not the expected y 11..58 piece');
        out.push({ ...s, F: { o: s.F.o.slice(), a: s.F.a.slice(), u: s.F.u.slice(), v: s.F.v.slice() }, poly, s0: 26 });
        continue;
      }
      out.push(s);
    }
    return [...out, ...shutterStaticSolids()];
  }
  // </verbatim camera-shutter-geometry.mjs>
    return {shutterHeroStatics,shutterMovingSolids,shutterPose,shutterPhase,SHUTTER_OWNERS};
  })();
  const objectiveModule = (() => {
  // <verbatim camera-objective-geometry.mjs>
  // CANDIDATE hollow objective for the 636 hero + dynamic shutter candidate. Replaces ONLY the opaque full-cylinder
  // barrel (hero.lens.barrel:0/1) and the undersized element disc (hero.lens.element:0) of shutterHeroStatics().
  // Every dimension is ILLUSTRATIVE mm (not factory CAD). Barrel and retainer are FACETED: each section is a ring of
  // eight convex +x prisms between two dyadic octagons (vertical/horizontal flats + 45 deg flats), adjacent quads share
  // their radial edge exactly. This is NOT an analytic tube and makes no annular-sector claim.
  // Optical idealization (declared, see camera-objective-audit.mjs): pupil = shutter rhombus in the blade A/B interface
  // plane x = 26.7; single thin lens with all power at the element REAR face x = 40, flat faces, no curvature, no
  // refraction inside the glass slab; image space = straight lines from the pupil to the unfolded virtual film rectangle
  // (mirror plane z = x + 89, ROI y +-32, z 5..69 at x = -89); object focus at infinity.
  // Bore sizes are derived from that bundle with declared clearances (0.125..0.33 mm), not an oversized hole.
  // Element radius grows 5.6 -> 10.75 because the old disc could not pass the full field at full aperture (declared).
  // World: +x toward the front, +y roller axis, +z up; ring coordinates are (y, z).
  
  const OBJECTIVE = Object.freeze({
    axisZ: 37,
    // [owner/name, x0, x1, inner [flat, diagonal], outer [flat, diagonal]]; octagon {|y|,|z-37| <= flat, |y|+|z-37| <= diagonal}
    sections: Object.freeze([
      Object.freeze(['hero.lens.barrel', 28, 31, Object.freeze([6.5, 7.75]), Object.freeze([8, 11.25])]), // spigot in mounting-plate bore (flats on the 8 mm bore)
      Object.freeze(['hero.lens.barrel', 31, 32, Object.freeze([7, 8.5]), Object.freeze([11, 16])]), // flange on the mounting plate front face x=31
      Object.freeze(['hero.lens.barrel', 32, 40, Object.freeze([9.5, 13.25]), Object.freeze([11, 16])]), // tube; front face x=40 = glass seat
      Object.freeze(['hero.lens.barrel', 40, 41.2, Object.freeze([10.875, 15.25]), Object.freeze([12.5, 17.5])]), // glass cell wall
      Object.freeze(['hero.lens.retainer', 41.2, 42, Object.freeze([10, 14.25]), Object.freeze([12.5, 17.5])]), // front retainer ring on glass rim
    ]),
    glass: Object.freeze({ x: Object.freeze([40, 41.2]), r: 10.75 }),
    pupilX: 26.7, virtualX: -89, roi: Object.freeze({ y: Object.freeze([-32, 32]), z: Object.freeze([5, 69]) }), lensX: 40,
  });
  
  const OBJECTIVE_REPLACED = Object.freeze(['hero.lens.barrel:0', 'hero.lens.barrel:1', 'hero.lens.element:0']);
  const OBJECTIVE_OWNERS = Object.freeze({
    'hero.lens.barrel': ['hero-objective-barrel', 'I3 objective lens assembly 120: hollow FACETED barrel (8-quad rings), illustrative; drawn see-through (display only, collider unchanged)'],
    'hero.lens.element': ['hero-objective-glass', 'I3 objective lens 120: single flat disc, thin-lens power idealized at rear face; prescription UNKNOWN; optically transmitting, material collider'],
    'hero.lens.retainer': ['hero-objective-barrel', 'illustrative front retaining ring on the element rim (not dimensioned in I1/I3)'],
    // display role override only (solid unchanged): from the 55 deg camera the opaque plate face hides the +y half of the rhombus
    'hero.lens.mounting-plate': ['hero-objective-barrel', 'I1 Lens Mounting Plate; drawn see-through as a declared cutaway view (collider unchanged)'],
  });
  
  // Dyadic octagon, ccw, centred on (0, zc): flats at |y|,|z| = f, diagonal flats |y|+|z| = d (requires f < d < 2f).
  function octagon(f, d, zc) {
    if (!(f < d && d < 2 * f)) throw new Error(`objective: octagon ${f}/${d} is not a convex 8-gon`);
    const h = d - f;
    return [[f, -h], [f, h], [h, f], [-h, f], [-f, h], [-f, -h], [-h, -f], [h, -f]].map(([y, z]) => [y, zc + z]);
  }
  const XF = () => ({ o: [0, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });
  
  function objectiveSolids() {
    const O = OBJECTIVE, out = [], count = {};
    for (const [owner, x0, x1, inner, outer] of O.sections) {
      const a = octagon(inner[0], inner[1], O.axisZ), b = octagon(outer[0], outer[1], O.axisZ);
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8, k = (count[owner] = (count[owner] ?? -1) + 1);
        out.push({ kind: 'prism', F: XF(), poly: [a[i], b[i], b[j], a[j]].map((p) => p.slice()), s0: x0, s1: x1, name: `${owner}:${k}`, owner });
      }
    }
    const g = O.glass;
    out.push({ kind: 'body', F: { o: [0, 0, O.axisZ], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, poly: [[g.x[0], 0], [g.x[0], g.r], [g.x[1], g.r], [g.x[1], 0]], name: 'hero.lens.element:0', owner: 'hero.lens.element' });
    return out;
  }
  
  // Shutter-candidate hero statics with the opaque barrel/element replaced; every other solid kept by identity and order.
  function objectiveHeroStatics(shutterStatics) {
    const kept = shutterStatics.filter((s) => !OBJECTIVE_REPLACED.includes(s.name));
    if (shutterStatics.length - kept.length !== OBJECTIVE_REPLACED.length) throw new Error('objective: replaced solids not found exactly once');
    if (kept.some((s) => s.owner === 'hero.lens.barrel' || s.owner === 'hero.lens.element')) throw new Error('objective: stray barrel/element solid');
    return [...kept, ...objectiveSolids()];
  }
  // </verbatim camera-objective-geometry.mjs>
    return {objectiveHeroStatics,OBJECTIVE_OWNERS};
  })();
  const driveModule = (() => {
  // <verbatim camera-drivetrain-geometry.mjs>
  // I3 ILLUSTRATIVE, not factory CAD or an involute/load-transfer certificate.
  // References: 636 service manual p6, p67 Fig47/48 (PDF73), p68 Fig49/50 (PDF74),
  // p69 step62, p71 steps66/67/69 Fig54 (PDF77). Full choice reasons are in the I3 ledger.
  // The conflicting left/right labels are resolved as -y, retaining the I2 far-side cover.
  const DRIVE = Object.freeze({mark: 'ILLUSTRATIVE', module: 0.4, side: '-y', motorToCam: 324,
    teeth: Object.freeze({motor: 10, plasticWheel: 30, plasticPinion: 10, metal5: 10, timing: 40}),
    note: 'clearance tooth silhouettes inside pitch circles; kinematic illustration, not engaged tooth/load proof'});
  const DRIVE_OWNERS = Object.freeze({
    'hero.drive.motor': ['hero-drive', 'ILLUSTRATIVE motor can and snapshot-driven rotor'],
    'hero.drive.gear1': ['hero-drive', 'ILLUSTRATIVE plastic compound 30/10'],
    'hero.drive.gear2': ['hero-drive', 'ILLUSTRATIVE plastic compound 30/10'],
    'hero.drive.gear3': ['hero-drive', 'ILLUSTRATIVE plastic compound 30/10'],
    'hero.drive.gear4': ['hero-drive', 'ILLUSTRATIVE plastic compound 30/10'],
    'hero.drive.gear5': ['hero-drive', 'ILLUSTRATIVE metal gear 10'],
    'hero.drive.timing': ['hero-drive', 'ILLUSTRATIVE timing wheel 40 and eccentric cam'],
    'hero.drive.pick': ['hero-drive', 'ILLUSTRATIVE sliding pick carriage; existing nip finger retained'],
    'hero.drive.counter': ['hero-drive', 'ILLUSTRATIVE twelve-detent exposure counter'],
    'hero.drive.latch': ['hero-drive', 'ILLUSTRATIVE reload/release linkage; shutter law untouched'],
  });
  function drivetrainSolids(snapshot) {
    const angle = snapshot.timingCamAngle, offset = snapshot.pick.offset, outputs = snapshot.events.outputs;
    if (![angle, offset, outputs, snapshot.shutter.transmission].every(Number.isFinite)) throw Error('invalid drivetrain snapshot');
    const out = [], seq = {};
    const frame = (x, z, theta = 0) => ({o: [x, 0, z], a: [0, 1, 0], u: [Math.cos(theta), 0, Math.sin(theta)], v: [-Math.sin(theta), 0, Math.cos(theta)]});
    const add = (owner, F, poly, y0, y1) => { const i = seq[owner] || 0; seq[owner] = i + 1;
      out.push({kind: 'prism', F, poly, s0: y0, s1: y1, name: `${owner}:${i}`, owner}); };
    const rect = (x0, x1, z0, z1) => [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
    // Faceted convex core plus disjoint outward tooth quads, all exact authored native prisms.
    // No proxy cylinders and no hidden collision exemptions. Gaps are declared, not healed.
    const gear = (owner, x, z, n, y0, y1, theta) => {
      const r = 0.4 * n * 0.43, outer = 0.4 * n * 0.47;
      const ring = Array.from({length:n}, (_,i) => [r*Math.cos(i*2*Math.PI/n),r*Math.sin(i*2*Math.PI/n)]);
      add(owner, frame(x,z,theta), ring, y0,y1);
      for(let i=0;i<n;i++) {
        const a=ring[i],b=ring[(i+1)%n], t0=(i+0.3)*2*Math.PI/n,t1=(i+0.7)*2*Math.PI/n;
        add(owner,frame(x,z,theta),[a,[outer*Math.cos(t0),outer*Math.sin(t0)],[outer*Math.cos(t1),outer*Math.sin(t1)],b],y0,y1);
      }
    };
    // Four plastic compounds + metal #5 + timing wheel, as Fig47. Chosen 3^4*1*4=324.
    add('hero.drive.motor',frame(-15,17),rect(-3,3,-4,4),-57,-56.5);
    gear('hero.drive.motor',-15,17,10,-56,-55.5,angle*324);
    const xs=[-24,-33,-42,-51],ratios=[-108,36,-12,4];
    for(let i=0;i<4;i++) {
      const owner=`hero.drive.gear${i+1}`,y=-56+i;
      gear(owner,xs[i],17,30,y,y+0.5,angle*ratios[i]);
      gear(owner,xs[i],17,10,y+1,y+1.5,angle*ratios[i]);
    }
    gear('hero.drive.gear5',-56,17,10,-52,-51.5,-angle*4);
    gear('hero.drive.timing',-67.5,17,40,-52,-51.5,angle);
    add('hero.drive.timing',frame(-67.5,17,angle),rect(1,4,-1,1),-51,-50.5);
    // Pick carriage and integral nose in the side bay. Nip finger remains byte-identical I2 material.
    add('hero.drive.pick',frame(offset,0),rect(-105,-76,6,7),-50,-49.5);
    add('hero.drive.pick',frame(offset,0),rect(-105,-103,4.5,6),-50,-49.5);
    const counterAngle=-outputs*2*Math.PI/12;
    gear('hero.drive.counter',-84,25,12,-54,-53.5,counterAngle);
    add('hero.drive.counter',frame(-84,25,counterAngle),rect(0,0.5,0,1),-53,-52.5);
    // Release follows achieved shutter opening; reload follows the existing timing cam, no timer/state.
    const release=snapshot.shutter.transmission>0?1:0, reload=(1-Math.cos(angle))/2;
    add('hero.drive.latch',frame(-34+release,31),rect(-3,3,-0.5,0.5),-53,-52.5);
    add('hero.drive.latch',frame(-34,33+reload),rect(-1,1,-0.5,0.5),-53,-52.5);
    return out;
  }
  // </verbatim camera-drivetrain-geometry.mjs>
    return {drivetrainSolids,DRIVE_OWNERS};
  })();
  const filmPathModule = (() => {
  // <verbatim camera-filmpath-geometry.mjs>
  // I4 ILLUSTRATIVE: every added presence, coordinate, thickness and clearance is not factory CAD.
  // References: 636 manual p6 motor/pick/roller delivery, p33 paragraph43 darkslide loading cycle,
  // p64 step51 and p67-69 steps58/60/64 pawls; p13 Film Shade; PDF73 Fig48, PDF74 Fig50.
  // The ledger records all dimensions and why. No pick, drive, optics or model law is redefined.
  const FILMPATH = Object.freeze({mark: 'ILLUSTRATIVE', schema: 'instant-filmpath-i4-v1',
    sheetOwner: 'sheet.integral', pickOwner: 'pick.finger', drivePickOwner: 'hero.drive.pick',
    route: 'existing top sheet -> existing pick -> model nipDistance -> model exitDistance -> door slot x28..31',
    ejectPush: 'I3 carriage nose -> crossbar -> stem through pack-roof slot -> pick.finger push face on sheet trailing face; consumes pick.offset only; rollers deliver after nip; no return spring/hold-down',
    darkslide: 'removed loading-cycle specimen, exploded +y; never a second active sheet or a photographic cycle',
    pawls: 'closed-door, loaded-pack pose only; no invented photo-cycle oscillation',
    shade: 'clearance tongue extends with achieved sheet.q, retracts on achieved fullyClearedExit; not spring-force proof'});
  const FILMPATH_OWNERS = Object.freeze({
    'hero.filmpath.guides': ['hero-frame', 'ILLUSTRATIVE pack-to-nip and slot side guides'],
    'hero.filmpath.eject-link': ['hero-drive', 'ILLUSTRATIVE rigid crossbar+stem joining I3 pick nose to core pick.finger; no replacement finger'],
    'hero.filmpath.pack-pawl': ['hero-latch', 'ILLUSTRATIVE loaded pack pawl, leg down'],
    'hero.filmpath.door-pawl': ['hero-latch', 'ILLUSTRATIVE closed door pawl and spring silhouette'],
    'hero.filmpath.shade': ['hero-door', 'ILLUSTRATIVE rolling shade tongue, existing housing retained'],
    'hero.filmpath.darkslide': ['hero-pack', 'ILLUSTRATIVE removed darkslide specimen in declared exploded view'],
  });
  function filmPathSolids(snapshot) {
    const q = snapshot.sheet.q, offset = snapshot.pick.offset, length = snapshot.sheet.length, width = snapshot.sheet.width;
    if (![q, offset, length, width].every(Number.isFinite) || length <= 0 || width <= 0 ||
        typeof snapshot.sheet.fullyClearedExit !== 'boolean') throw Error('invalid film-path snapshot');
    const out = [], seq = {};
    const add = (owner, x0, x1, y0, y1, z0, z1) => {
      const i = seq[owner] || 0; seq[owner] = i + 1;
      out.push({kind: 'prism', F: {o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1]},
        poly: [[x0,z0],[x1,z0],[x1,z1],[x0,z1]], s0: y0, s1: y1, name: `${owner}:${i}`, owner});
    };
    // Open central corridor: the sole active sheet remains the unchanged NIP material.
    // Side guides stop before both roller circles, resume after them and cross the existing door slot.
    for (const [x0,x1] of [[-100,-10],[-6,6.5],[18,36]]) {
      add('hero.filmpath.guides',x0,x1,-43,-42,-0.5,0.5);
      add('hero.filmpath.guides',x0,x1,42,43,-0.5,0.5);
    }
    // Rigid link, NOT a second pick: crossbar shares the y=-49.5 face of the I3 nose (x-105..-103, z4.5..5) and the z=4.5
    // face of the stem; the stem drops through the pack-roof slot (camera-hero-geometry HERO.pickSlot) onto the z=1.6 top
    // face of pick.finger (x-103..-102.5 of the finger). All offsets are the same model pick.offset; no clearance/epsilon.
    add('hero.filmpath.eject-link',-105+offset,-102.5+offset,-49.5,2,4.5,5);
    add('hero.filmpath.eject-link',-103+offset,-102.5+offset,-2,2,1.6,4.5);
    // Manual requires a down pack-pawl leg and a door-pawl spring under the pack pawl.
    // Fixed loaded/closed configuration, not an electrical interlock or door-opening simulation.
    add('hero.filmpath.pack-pawl',-8,-7,-53.5,-53,4.5,9);
    add('hero.filmpath.pack-pawl',-8,-5,-53.5,-53,9,9.5);
    add('hero.filmpath.door-pawl',-5,-1,-53.5,-53,9.5,10);
    add('hero.filmpath.door-pawl',-5.5,-5,-53.5,-53,10,11);
    // Thin shade runs above the sheet and below the 1.2 door-slot roof; no penetration tolerance.
    const extension = snapshot.sheet.fullyClearedExit ? 0 : Math.max(0,Math.min(32,q-31));
    add('hero.filmpath.shade',31,32+extension,-34,34,1.0625,1.125);
    // 636 p33: darkslide is ejected at pack load, shutter closed, counter set to10. This model is
    // a photo cycle, so the removed specimen stays outside the film corridor at y>=66 (exploded).
    add('hero.filmpath.darkslide',-length,0,66,66+width,0,0.25);
    return out;
  }
  // </verbatim camera-filmpath-geometry.mjs>
    return {filmPathSolids,FILMPATH_OWNERS};
  })();
  const pickPawlModule = (() => {
  // <verbatim camera-pick-pawl-mechanics.mjs>
  // DTOs are actual tube/body/prism/annular-sector material, not audit proxies. No collider exemptions or rounding.
  // REPAIR 261112-0148: hold-down rebuilt above the sheet (no posts through film/pack); pawl wire solved from a FREE
  // reference with elastic legs against rigid seats; true bores are native annular-sector pairs, not filled cylinders.
  // Full-scene native/material/strength acceptance remains BLOCK; see PICK_PAWL.gates.
  const ppFreeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(ppFreeze); Object.freeze(value); }
    return value;
  };
  const PICK_PAWL = ppFreeze({
    schema: 'instant-pick-pawl-a-v2-repair', units: 'mm N rad', illustrative: true,
    pick: { d: .25, D: 4, turns: 72, freeSpan: 30.5, endAxial: 6.5, freeAxial: 24,
      installedSpan: 32.5, stroke: 12, initialTension: 0, G: 69000,
      fixedEye: [-108.5,-54.5,3.5], movingEye: [-76,-54.5,3.5], eyeRadius: .5, pinRadius: .375,
      segmentsPerTurn: 24 },
    // Set A constants E/b/h/L/delta/count/mu/otherDrag unchanged. Mount geometry below is an authored repair delta.
    hold: { E: 193000, b: 3, h: .08, L: 8, delta: .2, count: 4, mu: .05, otherDrag: .002,
      pickX: [-103,-100], fingerTop: 1.6, roofUnderside: 3, guideX: [-103,-88], cells: 16,
      // tier 0 lower/outer, tier 1 upper/inner; root = |y| of clamped root face, mid = root centreline z (natural, straight leaf)
      tiers: [{root: 4.75, mid: 2, wingY: [3.75,4.75], guideOuter: 13.75},
        {root: 3.75, mid: 2.4, wingY: [2.75,3.75], guideOuter: 12}],
      railTop: -2.2 },
    pawl: { E: 193000, d: .25, D: 2, turns: 10, legs: [5,5], arborDiameter: 1.4,
      pivot: [-5.5,-55.5,9.5], freeDeg: -10, closedDeg: 0, benchDeg: [0,10],
      wireY: [-56.75,-54.25], legSegments: 20,
      // Rigid seats (authored). Face = poly edge 0->1 through `point`, tilted `tiltDeg` from vertical toward +x;
      // seat material on its +x side; moving seat is in the pawl frame. Tilt keeps the leg diverging from the
      // face away from the tip (tip-load cantilever is convex toward the load), so the tip is the bearing point.
      fixedSeat: {point: [-5.25,4.4], tiltDeg: 12, z: [3.9,5], backX: -4.75},
      movingSeat: {point: [-4.375,14.4], tiltDeg: -2, z: [13.5,14.8], backX: -4.125} },
    gates: { RootAdoption: false, fullMechanics: false, mechanicalAcceptance: false,
      materialAccepted: false, nativeAcceptance: false, publication: false, phaseTaskChange: 0 },
    limits: ['Quasistatic rates only, no inertia/corner impulse/fatigue/strength certification.',
      'Tube faceting and binary64 arclength residual are disclosed, not healed or volume-fitted.',
      'Whole-scene collisions, exact stored material union and native painter order are BLOCK.',
      'Selected friction/drag are authored assumptions, not measured factory properties.',
      'Pawl leg/seat contact is a Newton solution of linear-beam equations; residual is disclosed, not an exact contact certificate.']
  });
  const PICK_PAWL_OWNERS = ppFreeze({
    'pick.finger': ['pick','unchanged physical finger, integral manufactured pick component'],
    'hero.pick-pawl.chain': ['hero-drive','one manufactured connected carriage/nose/crossbar/stem/attachment'],
    'hero.pick-pawl.return-wire': ['hero-spring','set A constant-length polyline wire with real eyes'],
    'hero.pick-pawl.fixed-anchor': ['hero-frame','frame-backed pin and boss'],
    'hero.pick-pawl.moving-pin': ['hero-fastener','carriage pin and shoulder'],
    'hero.pick-pawl.hold-leaf': ['hero-spring','four installed cantilevers carried by the pick, tips preloaded DOWN by fixed guides'],
    'hero.pick-pawl.hold-wing': ['hero-drive','manufactured pick wings above the sheet carrying the leaf roots'],
    'hero.pick-pawl.hold-guide': ['hero-frame','fixed upper guide rails hung from the pack roof behind the aperture'],
    'hero.pick-pawl.pawl-wire': ['hero-spring','torsion body plus two elastic legs solved against rigid seats'],
    'hero.pick-pawl.pawl-hinge': ['hero-hinge','arbor, bored fork, axial heads, base roots'],
    'hero.pick-pawl.pawl': ['hero-latch','bored hub, pack leg and door hook, single manufactured component'],
    'hero.pick-pawl.pawl-seats': ['hero-frame','fixed spring seat and positive pack/door catches'],
    'hero.pick-pawl.bench': ['hero-control','BENCH ONLY opening fixture, absent in photograph cycle']
  });
  const PICK_PAWL_REPLACED = ppFreeze(['pick.finger','hero.drive.pick',
    'hero.filmpath.eject-link','hero.filmpath.pack-pawl','hero.filmpath.door-pawl']);
  const ppWingNames = [0,1].flatMap(side=>[0,1].map(tier=>`hold.wing.${side}.${tier}`));
  const ppRect = (x0,x1,z0,z1) => [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  function ppBox(name,owner,x,y,z,component='fixed') {
    return {kind:'prism', name, owner, component, F:{o:[0,0,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]},
      poly:ppRect(x[0],x[1],z[0],z[1]),s0:y[0],s1:y[1]};
  }
  function ppBody(name,owner,x,z,y0,y1,inner,outer,component='fixed') {
    if(inner!==0)throw Error('bored bodies must use native annular sectors');
    return {kind:'body',name,owner,component,F:{o:[x,0,z],a:[0,1,0],u:[1,0,0],v:[0,0,-1]},
      poly:[[y0,inner],[y0,outer],[y1,outer],[y1,inner]]};
  }
  // True bore = two native +Y annular sectors (vendor contract: a=(0,1,0), u=(-1,0,0), v=(0,0,1), span <= pi).
  // The pair is exactly the annulus; no filled cylinder, convex cloud or JSON->RAW reconstruction.
  function ppAnnulus(name,owner,x,z,y0,y1,rIn,rOut,component='fixed') {
    return [[-Math.PI,0,'lower'],[0,Math.PI,'upper']].map(([theta0,theta1,half])=>({kind:'annular-sector',name:`${name}.${half}`,owner,component,
      F:{o:[x,0,z],a:[0,1,0],u:[-1,0,0],v:[0,0,1]},s0:y0,s1:y1,rIn,rOut,theta0,theta1}));
  }
  function ppTube(name,owner,points,r,component='elastic') {
    return {kind:'tube',name,owner,component,points,radii:points.map(()=>r),round:[false,false]};
  }
  function pickPawlPathLength(points) {
    let length=0; for(let i=1;i<points.length;i++) length+=Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]));
    return length;
  }
  // Polygonal centreline is the stored geometry. Chord rule, not smooth-helix arc pretending to be stored material.
  function ppSpringRadius(axial) {
    const P=PICK_PAWL.pick, n=P.turns*P.segmentsPerTurn, c=2*n*Math.sin(Math.PI/P.segmentsPerTurn);
    const length=(r,a)=>Math.hypot(c*r,a)+2*Math.hypot(P.endAxial/2,r-P.eyeRadius);
    const target=length(P.D/2,P.freeAxial);let lo=0,hi=P.D/2;
    for(let i=0;i<100;i++) {const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;
      if(length(mid,axial)>target)hi=mid;else lo=mid;}
    const radius=(lo+hi)/2;
    return {radius,target,analyticStoredLength:length(radius,axial),residual:length(radius,axial)-target,bracket:[lo,hi]};
  }
  // ---- hold-down leaf/guide shared datum. Installed tip is DOWN by delta from the free straight leaf. ----
  function pickPawlLeafProfile(side,tier) {
    const H=PICK_PAWL.hold,T=H.tiers[tier],sign=side?1:-1,w=u=>u*u*(3-u)/2;
    return Array.from({length:H.cells+1},(_,i)=>{const u=i/H.cells;
      return {u,y:sign*(T.root+H.L*u),z:T.mid-H.delta*w(u),freeZ:T.mid};});
  }
  function ppLeafReaction(side,tier) {
    const H=PICK_PAWL.hold,p=pickPawlLeafProfile(side,tier),a=p[H.cells-1],b=p[H.cells];
    const dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dy,dz);let ny=-dz/len,nz=dy/len;if(nz<0){ny=-ny;nz=-nz;}
    const leafK=H.E*H.b*H.h**3/(4*H.L**3),P=leafK*H.delta,N=P/nz;
    // Leaf presses guide along +n; guide presses leaf (and so the pick) along -n. Vertical part equals beam tip load P.
    return {side,tier,leafK,beamTipLoad:P,normal:[0,ny,nz],normalForce:N,forceOnPick:[0,-N*ny,-N*nz],slidingArea:H.b*len};
  }
  // ---- pawl torsion spring: FREE reference + body twist + elastic legs + rigid seats ----
  const ppCross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  function ppLeg(root,t0,f,Fperp,EI,L,m) {
    const s=ppCross(t0,f)>0?1:-1,l=L/m,pts=[root.slice()];let p=root;
    for(let j=0;j<m;j++){const sm=(j+.5)*l,phi=s*Fperp*(L*sm-sm*sm/2)/EI,c=Math.cos(phi),n=Math.sin(phi);
      const d=[c*t0[0]-n*t0[1],n*t0[0]+c*t0[1]];p=[p[0]+l*d[0],p[1]+l*d[1]];pts.push(p);}
    return pts;
  }
  // Seat face from authored point/tilt: a,b = stored face vertices (z bounds), n = unit normal pointing to the leg side.
  function ppSeatFace(S) {
    const t=S.tiltDeg*Math.PI/180,e=[Math.sin(t),Math.cos(t)],at=z=>[S.point[0]+(z-S.point[1])*e[0]/e[1],z];
    return {a:at(S.z[0]),b:at(S.z[1]),n:[-e[1],e[0]],e};
  }
  function ppSeatPoly(S) {const f=ppSeatFace(S);return [f.a,f.b,[S.backX,S.z[1]],[S.backX,S.z[0]]];}
  function ppPawlEval(x,alpha) {
    const T=PICK_PAWL.pawl,[thS,thE,M]=x,cx=T.pivot[0],cz=T.pivot[2],r=T.d/2,L=T.legs[0],n=T.turns*24;
    const EI=T.E*Math.PI*T.d**4/64,freeSpan=2*Math.PI*T.turns,span=thE-thS;
    const R=T.D*Math.sin(Math.PI/24)/(2*Math.sin(span/(2*n)));
    const sF=ppSeatFace(T.fixedSeat),sM=ppSeatFace(T.movingSeat),ca=Math.cos(alpha),sa=Math.sin(alpha);
    const fFix=sF.n,fMov=[ca*sM.n[0]-sa*sM.n[1],sa*sM.n[0]+ca*sM.n[1]];
    const rootF=[cx+R*Math.cos(thS),cz+R*Math.sin(thS)],tF=[Math.sin(thS),-Math.cos(thS)];
    const rootM=[cx+R*Math.cos(thE),cz+R*Math.sin(thE)],tM=[-Math.sin(thE),Math.cos(thE)];
    const arm=(tip,f)=>Math.abs(ppCross([tip[0]-cx,tip[1]-cz],f));
    // Two passes: arm from straight leg, then from bent leg (fixed-point on geometry, disclosed).
    let legF=ppLeg(rootF,tF,fFix,0,EI,L,T.legSegments),legM=ppLeg(rootM,tM,fMov,0,EI,L,T.legSegments),FF=0,FM=0;
    for(let k=0;k<2;k++){FF=M/arm(legF.at(-1),fFix);FM=M/arm(legM.at(-1),fMov);
      legF=ppLeg(rootF,tF,fFix,FF*Math.abs(ppCross(tF,fFix)),EI,L,T.legSegments);
      legM=ppLeg(rootM,tM,fMov,FM*Math.abs(ppCross(tM,fMov)),EI,L,T.legSegments);}
    const tipF=legF.at(-1),tipM=legM.at(-1),c=Math.cos(alpha),s=Math.sin(alpha);
    const tipMpawl=[cx+c*(tipM[0]-cx)+s*(tipM[1]-cz),cz-s*(tipM[0]-cx)+c*(tipM[1]-cz)];
    const dist=(f,p)=>(p[0]-f.a[0])*f.n[0]+(p[1]-f.a[1])*f.n[1];
    const residual=[span-freeSpan-M*Math.PI*T.D*T.turns/EI,dist(sF,tipF)-r,dist(sM,tipMpawl)-r];
    return {thetaStart:thS,thetaEnd:thE,span,freeSpan,bodyTwist:span-freeSpan,radius:R,moment:M,legF,legM,
      tipForce:{fixed:FF,moving:FM},residual,EI};
  }
  function ppPawlSolve(alpha) {
    const T=PICK_PAWL.pawl,free=T.freeDeg*Math.PI/180,keff=T.E*T.d**4/(64*T.D*(T.turns+(T.legs[0]+T.legs[1])/(3*Math.PI*T.D)));
    let x=[free,free+2*Math.PI*T.turns+(alpha-free),keff*(alpha-free)],best=null,stall=0;
    const norm=e=>Math.max(...e.map(Math.abs));
    for(let it=0;it<60&&stall<4;it++){
      const f=ppPawlEval(x,alpha);const e=norm(f.residual);
      if(!best||e<best.err){best={x:x.slice(),err:e,f,iterations:it};stall=0;}else stall++;
      if(e===0)break;
      const J=[0,1,2].map(j=>{const h=1e-7*Math.max(1,Math.abs(x[j])),xx=x.slice();xx[j]+=h;
        return ppPawlEval(xx,alpha).residual.map((v,i)=>(v-f.residual[i])/h);});
      // Solve J^T columns: A[i][j]=d r_i / d x_j
      const A=[0,1,2].map(i=>[0,1,2].map(j=>J[j][i])),b=f.residual.map(v=>-v);
      for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
        [A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
        for(let r=c+1;r<3;r++){const k=A[r][c]/A[c][c];for(let q=c;q<3;q++)A[r][q]-=k*A[c][q];b[r]-=k*b[c];}}
      const dx=[0,0,0];for(let c=2;c>=0;c--){let v=b[c];for(let q=c+1;q<3;q++)v-=A[c][q]*dx[q];dx[c]=v/A[c][c];}
      x=x.map((v,j)=>v+dx[j]);
    }
    return {...best.f,maxAbsResidual:best.err,iterations:best.iterations,keff,
      setALawTorque:keff*(alpha-free),method:'Newton, forward-difference Jacobian; best iterate kept; NO acceptance tolerance'};
  }
  function ppPawlStateFrom(solved,alpha,mode) {
    const T=PICK_PAWL.pawl,twist=(T.closedDeg-T.freeDeg)*Math.PI/180;
    return {mode,angle:alpha,twist:mode==='BENCH_ONLY'?twist+alpha:twist,k:solved.keff,torque:-solved.moment,
      tipForce:-solved.tipForce.moving,
      reference:{freeBodySpan:solved.freeSpan,freeMovingLegAngle:T.freeDeg*Math.PI/180,installedBodySpan:solved.span,
        bodyTwist:solved.bodyTwist,thetaStart:solved.thetaStart,thetaEnd:solved.thetaEnd,coilRadius:solved.radius},
      solver:{residual:solved.residual,maxAbsResidual:solved.maxAbsResidual,iterations:solved.iterations,method:solved.method,
        setALawTorque:-solved.setALawTorque,solvedMinusSetALaw:solved.moment-solved.setALawTorque}};
  }
  function pickPawlState(snapshot) {
    const q=snapshot?.sheet?.q, o=snapshot?.pick?.offset, time=snapshot?.time;
    if (![q,o,time].every(Number.isFinite)||q<0||q>124||o<0||o>12) throw Error('invalid achieved snapshot');
    // Existing model uses this exact binary64 arithmetic. Do not replace it with a rounded q law.
    const expected=q<=12?q:12*(1-Math.max(0,Math.min(1,(q-12)/12)));
    if (!Object.is(o,expected)) throw Error('pick/q achieved snapshot incoherent');
    const P=PICK_PAWL.pick,H=PICK_PAWL.hold;
    const k=P.G*P.d**4/(8*P.D**3*P.turns), extension=2+o, axial=P.freeAxial+extension;
    const spring=ppSpringRadius(axial), leafK=H.E*H.b*H.h**3/(4*H.L**3);
    const holdForce=-H.count*leafK*H.delta, returnForce=-k*extension;
    const leaves=[0,1].flatMap(tier=>[0,1].map(side=>ppLeafReaction(side,tier)));
    const guideNormal=leaves.reduce((s,l)=>s+l.normalForce,0),netY=leaves.reduce((s,l)=>s+l.forceOnPick[1],0);
    const railNormal=-leaves.reduce((s,l)=>s+l.forceOnPick[2],0);
    const resist=H.mu*(guideNormal+railNormal)+H.otherDrag;
    return ppFreeze({time,q,offset:o,pick:{fixedEye:P.fixedEye.slice(),movingEye:[-76+o,-54.5,3.5],
      span:P.installedSpan+o,extension,k,force:[returnForce,0,0],axial,pitch:axial/P.turns,...spring},
      hold:{leafK,delta:H.delta,perLeafForce:-leafK*H.delta,force:[0,netY,holdForce],leaves,guideNormal,railNormal,
        frictionInterfaces:['leaf tips sliding on fixed guide faces','finger bottom sliding on U pick.rail'],
        resistance:resist,minimumReturnMargin:-returnForce-resist},
      pawl:ppPawlStateFrom(ppPawlSolve(0),0,'PHOTO_CLOSED_STATIC')});
  }
  function ppReturnWire(state) {
    const P=PICK_PAWL.pick,s=state.pick,n=P.turns*P.segmentsPerTurn,r=s.radius;
    const left=P.fixedEye,right=s.movingEye,a=left[0]+P.endAxial/2,b=right[0]-P.endAxial/2;
    const body=Array.from({length:n+1},(_,i)=>[a+(b-a)*i/n,left[1],left[2]]);
    for(let i=0;i<=n;i++){const th=2*Math.PI*(i%P.segmentsPerTurn)/P.segmentsPerTurn;
      body[i][1]+=r*Math.sin(th);body[i][2]+=r*Math.cos(th);}
    const eye=(centre)=>{
      // Formed rounded-square eye: four straight inner load faces at +/-0.375 (run-01 of B: chord eye intruded).
      const p=[[0,.5],[.25,.5]];
      for(const [cx,cz,start] of [[.25,.25,Math.PI/2],[.25,-.25,0],[-.25,-.25,-Math.PI/2],[-.25,.25,-Math.PI]]) {
        const first=[cx+.25*Math.cos(start),cz+.25*Math.sin(start)];
        if(p.at(-1)[0]!==first[0]||p.at(-1)[1]!==first[1])p.push(first);
        for(let i=1;i<=8;i++){const th=start-Math.PI*i/16;p.push([cx+.25*Math.cos(th),cz+.25*Math.sin(th)]);}
      }
      p.push([0,.5]);return p.map(([x,z])=>[centre[0]+x,centre[1],centre[2]+z]);
    };
    const l=eye(left),rr=eye(right);
    return [ppTube('return.body','hero.pick-pawl.return-wire',body,P.d/2),
      ppTube('return.eye.fixed','hero.pick-pawl.return-wire',l,P.d/2),
      ppTube('return.eye.moving','hero.pick-pawl.return-wire',rr,P.d/2),
      ppTube('return.tail.fixed','hero.pick-pawl.return-wire',[l[0],body[0]],P.d/2),
      ppTube('return.tail.moving','hero.pick-pawl.return-wire',[body.at(-1),rr[0]],P.d/2)];
  }
  function ppPickChain(o) {
    const B=(name,x,y,z,owner='hero.pick-pawl.chain')=>ppBox(name,owner,x.map(v=>v+o),y,z,'pick');
    return [B('finger',[-103,-100],[-5,5],[-2.2,1.6],'pick.finger'),
      B('stem',[-103,-102.5],[-2,2],[1.6,4.5]), B('crossbar',[-105,-102.5],[-49.5,2],[4.5,5]),
      B('nose',[-105,-103],[-50,-49.5],[4.5,6]),B('carriage',[-105,-76],[-50,-49.5],[6,7]),
      B('attachment',[-76.5,-75.5],[-54,-49.5],[3,6]),B('attachment-neck',[-76.5,-75.5],[-50,-49.5],[6,7])];
  }
  function ppAnchors(o) {
    const F='hero.pick-pawl.fixed-anchor',M='hero.pick-pawl.moving-pin';
    return [ppBody('return.fixed.pin',F,-108.5,3.5,-55,-54,0,.375),
      ppBox('return.fixed.boss',F,[-109,-108],[-58,-55],[3,4]),
      ppBox('return.fixed.post',F,[-109,-108],[-58,-57],[-19.5,3]),
      ppBox('return.fixed.foot',F,[-109,-107],[-58,-57],[-20,-19.5]),
      ppBody('return.fixed.head',F,-108.5,3.5,-54,-53.75,0,.625),
      ppBody('return.moving.pin',M,-76+o,3.5,-55,-54,0,.375,'pick'),
      ppBody('return.moving.head',M,-76+o,3.5,-55.25,-55,0,.625,'pick')];
  }
  // Wings, leaves and guides all live in z(1.6,3): above the finger top/sheet and below the pack-roof underside.
  // Nothing runs through film, pack stack or base. Leaves stay in x[-103,-100]+o, i.e. always behind the sheet trailing face.
  function ppHoldDown(o) {
    const H=PICK_PAWL.hold,out=[],x=H.pickX.map(v=>v+o);
    for(let side=0;side<2;side++) {
      const sign=side?1:-1,ys=([a,b])=>sign>0?[a,b]:[-b,-a];
      for(let tier=0;tier<2;tier++) {
        const T=H.tiers[tier],p=pickPawlLeafProfile(side,tier);
        out.push(ppBox(`hold.wing.${side}.${tier}`,'hero.pick-pawl.hold-wing',x,ys(T.wingY),[H.fingerTop,T.mid+H.h/2],'pick'));
        for(let i=0;i<H.cells;i++) {
          const a=p[i],b=p[i+1];
          out.push({kind:'prism',name:`leaf.${side}.${tier}.${i}`,owner:'hero.pick-pawl.hold-leaf',component:`leaf.${side}.${tier}`,
            F:{o:[0,0,0],a:[1,0,0],u:[0,1,0],v:[0,0,1]},
            poly:[[a.y,a.z-H.h/2],[b.y,b.z-H.h/2],[b.y,b.z+H.h/2],[a.y,a.z+H.h/2]],s0:x[0],s1:x[1]});
        }
        // Guide underside IS the last leaf cell's installed top face (same two stored vertices): positive-area sliding contact.
        const a=p[H.cells-1],b=p[H.cells],outer=sign*T.guideOuter;
        out.push({kind:'prism',name:`hold.guide.${side}.${tier}`,owner:'hero.pick-pawl.hold-guide',component:'fixed',
          F:{o:[0,0,0],a:[1,0,0],u:[0,1,0],v:[0,0,1]},
          poly:[[a.y,a.z+H.h/2],[b.y,b.z+H.h/2],[outer,b.z+H.h/2],[outer,H.roofUnderside],[a.y,H.roofUnderside]],
          s0:H.guideX[0],s1:H.guideX[1]});
      }
    }
    return out;
  }
  function ppRotatePawl(s,angle) {
    const c=Math.cos(angle),t=Math.sin(angle),cx=-5.5,cz=9.5;
    const point=p=>[cx+c*(p[0]-cx)-t*(p[2]-cz),p[1],cz+t*(p[0]-cx)+c*(p[2]-cz)];
    if(s.kind==='annular-sector') {
      // The lower+upper pair is a full annulus about the pivot axis: rotation leaves the stored point SET unchanged.
      if(s.F.o[0]!==cx||s.F.o[2]!==cz)throw Error('only pivot-coaxial annuli are rotation invariant');
      return s;
    }
    if(s.kind==='prism'||s.kind==='body') {
      const F=s.F,vec=v=>[c*v[0]-t*v[2],v[1],t*v[0]+c*v[2]];
      return {...s,F:{o:point(F.o),a:vec(F.a),u:vec(F.u),v:vec(F.v)}};
    }
    return {...s,points:s.points.map(point)};
  }
  function ppPawl(alpha=0,bench=false) {
    const out=[],P=PICK_PAWL.pawl,F='hero.pick-pawl.pawl-hinge',B='hero.pick-pawl.pawl',S='hero.pick-pawl.pawl-seats';
    out.push(ppBody('pawl.arbor',F,-5.5,9.5,-58,-51.5,0,.7));
    // Deliberate inside-camera mount: full head bears on cheek y=-58, no pocket or epsilon.
    out.push(ppBody('pawl.head.left',F,-5.5,9.5,-58,-57.5,0,1));
    out.push(ppBody('pawl.head.right',F,-5.5,9.5,-51.5,-51,0,1));
    out.push(ppBody('pawl.hub.capture.left',F,-5.5,9.5,-54.125,-54,0,.9));
    out.push(ppBody('pawl.hub.capture.right',F,-5.5,9.5,-53,-52.875,0,.9));
    // Shorten the fixed left fork/post at its outside end to meet the relocated head at -57.5,
    // not overlap its flange. Arbor, inner fork plane and spring/seat solver are unchanged.
    for(const [i,y] of [[0,[-57.5,-57]],[1,[-52.5,-51.5]]]) {
      out.push(...ppAnnulus(`pawl.fork.${i}`,F,-5.5,9.5,...y,.76,1.5));
      out.push(ppBox(`pawl.fork.post.${i}`,F,[-6.5,-4.5],y,[-20,8.5]));
    }
    const moving=[...ppAnnulus('pawl.bored.hub',B,-5.5,9.5,-54,-53,.76,1.25,'pawl'),
      ppBox('pawl.pack.leg',B,[-8,-7],[-54,-53],[4.5,9],'pawl'),
      // Keep the connected bridge/hook outside the real bore, not across its centre.
      ppBox('pawl.pack.bridge',B,[-8,-6.25],[-54,-53],[9,9.5],'pawl'),
      ppBox('pawl.door.hook',B,[-4.75,-1],[-54,-53],[9.5,10],'pawl'),
      ppBox('pawl.leg.arm',B,[-5,-4.125],[-54,-53],[10.25,13.5],'pawl'),
      {...ppBox('pawl.moving.seat',B,[0,1],[-54.5,-53],[0,1],'pawl'),poly:ppSeatPoly(P.movingSeat)}];
    out.push(...moving.map(s=>alpha===0?s:ppRotatePawl(s,alpha)));
    out.push(ppBox('pawl.pack.catch',S,[-9,-8],[-54,-53],[4.5,6]));
    out.push(ppBox('pawl.pack.catch.bridge',S,[-9,-8],[-53,-48.5],[4.5,6]));
    // Fixed boundary strap: bridge face y=-48.5; actual pack far wall face y=-48, z<=4.
    // No root material inside the existing wall; fixture/fastener strength remains BLOCK.
    out.push(ppBox('pawl.pack.catch.root',S,[-9,-8],[-48.5,-48],[3,6]));
    out.push(ppBox('pawl.door.catch',S,[-1,0],[-54,-53],[9.5,10]));
    out.push(ppBox('pawl.door.catch.root',S,[-1,0],[-58,-54],[9.5,10])); // flush on actual U door cheek y=-58
    // Fixed leg now leaves the body along the -tangent (B's +tangent leg re-traced the first coil: wire self-overlap).
    out.push({...ppBox('pawl.fixed.seat',S,[0,1],[-57,-56.5],[0,1]),poly:ppSeatPoly(P.fixedSeat)});
    out.push(ppBox('pawl.fixed.seat.back',S,[-5,P.fixedSeat.backX],[-57,-56.5],[-20,P.fixedSeat.z[0]]));
    const sol=ppPawlSolve(alpha),n=P.turns*24,[y0,y1]=P.wireY;
    const body=Array.from({length:n+1},(_,i)=>{const th=sol.thetaStart+sol.span*i/n;
      return [-5.5+sol.radius*Math.cos(th),y0+(y1-y0)*i/n,9.5+sol.radius*Math.sin(th)];});
    out.push(ppTube('pawl.coil','hero.pick-pawl.pawl-wire',body,P.d/2));
    // Leg polylines share the coil end vertices exactly (same stored point objects' values).
    out.push(ppTube('pawl.fixed.leg','hero.pick-pawl.pawl-wire',[body[0],...sol.legF.slice(1).map(p=>[p[0],y0,p[1]])],P.d/2));
    out.push(ppTube('pawl.moving.leg','hero.pick-pawl.pawl-wire',[body.at(-1),...sol.legM.slice(1).map(p=>[p[0],y1,p[1]])],P.d/2));
    if(bench)out.push(ppBox('BENCH ONLY opening actuator','hero.pick-pawl.bench',[-3,-2],[-57,-56],[15,16]));
    return out;
  }
  function pickPawlSolids(snapshot,benchOptions) {
    const state=pickPawlState(snapshot);
    if(benchOptions && (benchOptions.mode!=='BENCH_ONLY'||!Number.isFinite(benchOptions.openingDeg)||benchOptions.openingDeg<0||benchOptions.openingDeg>10))
      throw Error('separately labeled BENCH_ONLY opening 0..10 required');
    const angle=(benchOptions?.openingDeg??0)*Math.PI/180;
    return [...ppPickChain(state.offset),...ppReturnWire(state),...ppAnchors(state.offset),...ppHoldDown(state.offset),...ppPawl(angle,!!benchOptions)];
  }
  function pickPawlBenchState(snapshot,openingDeg) {
    pickPawlState(snapshot);
    if(!Number.isFinite(openingDeg)||openingDeg<0||openingDeg>10)throw Error('bench domain');
    const alpha=openingDeg*Math.PI/180;
    return ppPawlStateFrom(ppPawlSolve(alpha),alpha,'BENCH_ONLY');
  }
  // Exact AABB joins for the ACTUAL axis-aligned manufactured pieces, not names-as-bonds.
  function pickPawlBounds(s) {
    if(s.kind!=='prism')throw Error('box prism required');
    const points=s.poly.flatMap(p=>[s.s0,s.s1].map(a=>s.F.o.map((v,j)=>v+s.F.a[j]*a+s.F.u[j]*p[0]+s.F.v[j]*p[1])));
    return [0,1,2].map(j=>[Math.min(...points.map(p=>p[j])),Math.max(...points.map(p=>p[j]))]);
  }
  function pickPawlJoin(a,b) {
    const A=pickPawlBounds(a),B=pickPawlBounds(b),spans=A.map((v,j)=>Math.min(v[1],B[j][1])-Math.max(v[0],B[j][0]));
    const zeros=spans.filter(v=>v===0).length;
    return {spans,connected:spans.every(v=>v>=0)&&zeros<=1,kind:zeros===1?'positive-area shared manufactured face':'positive-volume manufactured union'};
  }
  function ppSameData(a,b) {
    if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);
    if(Array.isArray(a)!==Array.isArray(b))return false;
    const ak=Reflect.ownKeys(a),bk=Reflect.ownKeys(b);
    return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&ppSameData(a[k],b[k]));
  }
  // Failure list is intentionally data, never an automatic acceptance of an untested native/material gate.
  function inspectPickPawl(snapshot,solids=pickPawlSolids(snapshot),state=pickPawlState(snapshot)) {
    const errors=[],byName=new Map(),H=PICK_PAWL.hold;
    for(const s of solids) {
      if(byName.has(s.name))errors.push('duplicate name '+s.name);byName.set(s.name,s);
      if(!Object.hasOwn(PICK_PAWL_OWNERS,s.owner))errors.push('unknown owner '+s.owner);
      if(!['prism','body','tube','annular-sector'].includes(s.kind))errors.push('unsupported solid '+s.name);
      if(s.kind==='body'&&s.poly[0][1]!==0)errors.push('bored body must be native annular sectors '+s.name);
      if(s.kind==='prism'&&s.F.a[1]===1&&Math.min(...s.poly.map(p=>p[1]))<-20)errors.push('support below base datum '+s.name);
    }
    const expected=pickPawlSolids(snapshot),names=new Set(expected.map(s=>s.name));
    for(const s of expected) {
      if(!byName.has(s.name))errors.push('missing '+s.name);
      else if(byName.get(s.name).owner!==s.owner)errors.push('wrong owner assignment '+s.name);
    }
    for(const s of solids)if(!names.has(s.name))errors.push('extra '+s.name);
    const parts=PICK_PAWL_RIGID_COMPONENTS.pick.parts,pieces=parts.map(name=>byName.get(name)).filter(Boolean),seen=new Set(pieces.length?[pieces[0].name]:[]);
    for(let i=0;i<pieces.length;i++)for(const a of pieces)for(const b of pieces)
      if(seen.has(a.name)&&pickPawlJoin(a,b).connected)seen.add(b.name);
    if(pieces.length!==parts.length||seen.size!==parts.length)errors.push('disconnected manufactured pick body');
    for(const s of pieces)if(s.component!=='pick')errors.push('wrong rigid transform component '+s.name);
    const contacts=[],finger=byName.get('finger');
    // Physical (not label) supports: every hold-down solid must stay in the slab z(fingerTop, roofUnderside], off the stem slot.
    for(const s of solids.filter(s=>/^(hold\.|leaf\.)/.test(s.name))) {
      const [bx,by,bz]=pickPawlBounds(s);
      if(bz[0]<H.fingerTop||bz[1]>H.roofUnderside)errors.push('hold-down leaves the above-sheet slab '+s.name);
      if(by[0]<2.5&&by[1]>-2.5)errors.push('hold-down occludes stem/roof slot '+s.name);
      if(bx[1]>-88)errors.push('hold-down enters optical aperture x>-88 '+s.name);
    }
    for(let side=0;side<2;side++)for(let tier=0;tier<2;tier++) {
      const wing=byName.get(`hold.wing.${side}.${tier}`),root=byName.get(`leaf.${side}.${tier}.0`),
        last=byName.get(`leaf.${side}.${tier}.${H.cells-1}`),guide=byName.get(`hold.guide.${side}.${tier}`);
      if(wing&&finger){const j=pickPawlJoin(wing,finger),b=pickPawlBounds(wing);contacts.push({name:`wing.${side}.${tier}/finger`,...j});
        if(!j.connected||j.kind!=='positive-area shared manufactured face'||b[2][0]!==H.fingerTop)errors.push('wing not joined to finger '+side+'.'+tier);}
      if(wing&&root){const j=pickPawlJoin(root,wing);contacts.push({name:`leaf.${side}.${tier}/wing`,...j});
        if(!j.connected||j.kind!=='positive-area shared manufactured face'||root.component!==`leaf.${side}.${tier}`||root.s0!==wing.poly[0][0])errors.push('leaf root not joined to wing '+side+'.'+tier);}
      if(guide&&last) {
        const share=Object.is(guide.poly[0][0],last.poly[3][0])&&Object.is(guide.poly[0][1],last.poly[3][1])&&
          Object.is(guide.poly[1][0],last.poly[2][0])&&Object.is(guide.poly[1][1],last.poly[2][1]);
        const cover=guide.s0<=last.s0&&guide.s1>=last.s1,area=(last.s1-last.s0)*Math.hypot(last.poly[2][0]-last.poly[3][0],last.poly[2][1]-last.poly[3][1]);
        contacts.push({name:`leaf.${side}.${tier}/guide`,sharedFace:share,covered:cover,area});
        if(!share||!cover||!(area>0))errors.push('leaf/guide sliding contact missing '+side+'.'+tier);
        if(Math.max(...guide.poly.map(p=>p[1]))!==H.roofUnderside||guide.s0<-106||guide.s1>-87)errors.push('guide not hung from pack roof '+side+'.'+tier);
      } else errors.push('guide/leaf missing '+side+'.'+tier);
    }
    for(const [a,b] of [['pawl.pack.leg','pawl.pack.catch'],['pawl.door.hook','pawl.door.catch']]) {
      if(byName.has(a)&&byName.has(b)){const join=pickPawlJoin(byName.get(a),byName.get(b));contacts.push({name:a+'/'+b,...join});if(!join.connected||join.kind!=='positive-area shared manufactured face')errors.push('positive pawl load seat missing '+a);}
    }
    const reference=pickPawlState(snapshot);
    if(!(state.pick.force[0]<0)||state.pick.extension!==2+snapshot.pick.offset||!Object.is(state.pick.force[0],reference.pick.force[0]))errors.push('return force direction/preload');
    if(state.hold.force[2]!==reference.hold.force[2]||!(state.hold.force[2]<0)||state.hold.force[1]!==0)errors.push('hold-down preload');
    if(!(state.hold.minimumReturnMargin>0)||state.hold.railNormal!==reference.hold.railNormal||state.hold.guideNormal!==reference.hold.guideNormal)errors.push('hold-down reaction/friction budget');
    for(const l of state.hold.leaves)if(!(l.normal[2]>0)||!(l.forceOnPick[2]<0))errors.push('wrong hold-down contact law '+l.side+'.'+l.tier);
    if(state.pawl.angle!==0||state.pawl.twist!==Math.PI/18||!(state.pawl.torque<0))errors.push('improper photo-cycle pawl motion/preload');
    const ref=state.pawl.reference;
    if(!ref||!(ref.bodyTwist>0)||ref.freeBodySpan!==2*Math.PI*PICK_PAWL.pawl.turns||!(ref.installedBodySpan>ref.freeBodySpan)||
      !Object.is(ref.bodyTwist,reference.pawl.reference.bodyTwist))errors.push('pawl free/closed preload reference lost');
    for(const name of ['return.fixed.pin','return.fixed.boss','return.fixed.post','return.moving.pin','pawl.arbor','pawl.fixed.seat','pawl.moving.seat',
      'pawl.fixed.leg','pawl.moving.leg','pawl.coil','pawl.fork.0.lower','pawl.fork.0.upper','pawl.fork.1.lower','pawl.fork.1.upper',
      ...[0,1].flatMap(s=>[0,1].map(t=>`hold.guide.${s}.${t}`))]) {
      const a=byName.get(name),b=expected.find(s=>s.name===name);
      if(a&&!ppSameData(a,b))errors.push('anchor/seat/leg/guide displaced '+name);
    }
    for(const name of ['return.body','return.tail.fixed','return.tail.moving','return.eye.fixed','return.eye.moving']) {
      const a=byName.get(name),b=expected.find(s=>s.name===name);
      if(a&&!ppSameData(a,b))errors.push('wire geometry/arclength changed '+name);
    }
    return {errors,contacts,returnChain:{members:pieces.map(s=>s.name),reachable:[...seen]},
      scope:'exact stored box contacts + inventory/preload/reaction controls; NOT full-scene continuous/native/material acceptance'};
  }
  // Integrator receives already built U solids. Shade and every unrelated collider survive unchanged.
  function composePickPawl(snapshot,baselineSolids) {
    if(!Array.isArray(baselineSolids))throw Error('actual baseline solids required');
    const present=new Set(baselineSolids.map(s=>s.owner));
    for(const owner of PICK_PAWL_REPLACED)if(!present.has(owner))throw Error('missing replacement owner '+owner);
    return [...baselineSolids.filter(s=>!PICK_PAWL_REPLACED.includes(s.owner)),...pickPawlSolids(snapshot)];
  }
  // </verbatim camera-pick-pawl-mechanics.mjs>
    return {composePickPawl,PICK_PAWL_OWNERS,PICK_PAWL_REPLACED};
  })();
  const shadeModule = (() => {
  // <verbatim shade-spool-b.mjs>
  // I4 shade topology B (ILLUSTRATIVE engineering, NOT Polaroid 636 factory data).
  // Authority: explicit user selection 'Cho phép chuyển sang màn cuốn có lò xo hồi riêng (đề xuất)'.
  // Documented topology class: US3938167A / US3940774A curtain 114 + roller 116 + separate spring 118 + downturned lip 120
  // (different embodiment from self-coiling curtain 88). Every dimension/force parameter below is an authored design choice.
  // Browser-safe: no Node imports. Pure functions of the achieved core snapshot (time, q); no renderer timer or pose cache.
  
  const TAU = 2 * Math.PI;
  const HOME_CASE_FRONT = 45, JAW_LENGTH = 2;
  const MD = modelData();
  // Same expressions as createModel (machine-model.mjs) so qAt is bit-identical to the core clock.
  const MOTOR_START = MD.openingSeconds + MD.holdSeconds + MD.closingSeconds + MD.closedDwellSeconds;
  const crossing = (s) => MOTOR_START + (MD.nipDistance + s) / MD.speed;
  const NIP_ENTRY = crossing(0), NIP_EXIT = crossing(MD.packetLength);
  const EXIT_TIME = MOTOR_START + (MD.exitDistance + MD.packetLength) / MD.speed;
  const Q_END = MD.exitDistance + MD.packetLength;
  const qAt = (t) => t >= EXIT_TIME ? Q_END : t === NIP_ENTRY ? MD.nipDistance :
    t === NIP_EXIT ? MD.nipDistance + MD.packetLength : Math.max(0, (t - MOTOR_START) * MD.speed);
  
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  
  const SHADE_SPOOL = deepFreeze({
    schema: 'instant-i4-shade-spool-b-datum-v1', mark: 'ILLUSTRATIVE_AUTHORED_DESIGN_NOT_FACTORY_636',
    units: 'mm, N, s, rad, g (force = g*mm/s^2*1e-6)',
    pet: { width: 84, length: 80, thickness: 0.05, E: 3800, density: 1.39e-3, idealVolume: 336,
      naturalCurvature: 0, note: 'flat natural state (DELTA from selected set A self-coil law); opacity = ideal optical boundary assumption' },
    filmHalfThickness: 0.4, // world-config sheet.baseThickness/2 outside the rollers; cross-checked in tests against geometry-base
    spool: { centre: [37, 6.2], r0: 4.0, pitch: 0.06, hubOuter: 3.973, hubInner: 2.5, y: [-42.5, 42.5],
      pocketAngle: Math.PI / 2, pocketDepth: 0.5, capY: 1, capBore: 1.1, sectors: 96, density: 1.41e-3 },
    axle: { inscribed: 1.0, n: 16, y: [-44.6, 44.6] },
    pin: { centre: [42, 2.525], radius: 1.5, n: 48, y: [-46.6, 46.6], bracketY: [44.6, 46.6] },
    bandZ: 1.0,
    caseY: [42.6, 44.6], caseTopZ: [11.2, 12.2], rearX: [31, 32], frontX: [44, HOME_CASE_FRONT], frontZ: [1.1, 11.2], plate: { x: [31, HOME_CASE_FRONT], z: [0.7, 0.95] },
    clip: { homeX: HOME_CASE_FRONT + JAW_LENGTH, jawLength: JAW_LENGTH, endRecess: 0.2, topJaw: [1.025, 2.0], bottomJaw: [0.7, 0.975], hingeDX: 0.3, hingeZ: 0.8,
      fingerHalf: 0.3, fingerLength: 2.4, fingerY: 30, earY: [30.2, 31.2], earZ: [0.5, 1.1],
      toe: { outerX: 0.4, rise: 0.8, note: 'AUTHORED shared-datum toe wedge (local (-WF,-LF),(-outerX,-LF),(-WF,-LF+rise)); hingeZ = 2*film half-thickness, outerX = half-thickness, rise = 2*half-thickness; released support pose = designed quarter turn' }, hingePin: 0.15, fingerBore: 0.18,
      density: 2.7e-3 },
    stop: { retainedBeyondPocket: 5.0, nutPitch: 0.5, nutY0: 6, nutLength: 2, collarLength: 1, nutBore: 1.1, nutOuter: 2.45, collarOuter: 2.0 },
    spring: { wire: 0.3, meanD: 4.0, coils: 100, freePitch: 0.35, E: 193000, preloadTorque: 1.6, y0: -40, segmentsPerCoil: 8,
      note: 'enclosed return spring inside the visible hollow hub/case; spring wire and anchors intentionally hidden (release-bar simplification); generic E only, no strength certification' },
    bias: { preloadTorque: 1.7, rate: 0.3, note: 'hinge torsion bias on hook; solid geometry NOT modeled' },
    friction: { hookOnFilm: 0.25, petOnPin: 0.15, note: 'authored coefficients, not measurements' },
    damping: { cLinear: 0.0002, note: 'authored c_linear mapped to hub rotation by c_rot = c_linear * r(home)^2' },
    integration: { step: 2e-5, method: 'fixed-step RK4 from release; event located by linear interpolation inside the crossing step' },
  });
  const P = SHADE_SPOOL, PET = P.pet, SP = P.spool, CL = P.clip, ST = P.stop, SG = P.spring;
  const T_PET = PET.thickness, HT = T_PET / 2, EI = PET.E * PET.width * T_PET ** 3 / 12;
  const A_SP = SP.pitch / TAU, PHI_C = SP.pocketAngle, DEPTH = SP.pocketDepth;
  const [CX, CZ] = SP.centre, [PX, PZ] = P.pin.centre, RHO = P.pin.radius + HT;
  // Pin facets inscribed in rp*cos(pi/96): 96-per-turn band wrap chords cannot cut the pin (finite-discretization gap, not healing).
  const PIN_VERTEX_R = P.pin.radius * Math.cos(Math.PI / 96);
  if (PZ - RHO !== P.bandZ) throw Error('pin bottom must define band centre z');
  
  const SHADE_SPOOL_OWNERS = deepFreeze({
    'hero.shade-b.case': ['hero-door', 'fixed hollow case: rear/top/front walls, side walls with axle bores, feed plate, pin brackets'],
    'hero.shade-b.axle': ['hero-door', 'fixed axle, faceted 16-gon pressed in side-wall bores (outside band y+-42)'],
    'hero.shade-b.guide-pin': ['hero-door', 'fixed feed guide pin; band wraps under it; ideal line contact on inscribed facets'],
    'hero.shade-b.hub': ['hero-shade', 'rotating hollow hub tube with root pocket and bored end caps'],
    'hero.shade-b.hub-clamp': ['hero-shade', 'clamp keeper filling pocket above PET root'],
    'hero.shade-b.band': ['hero-shade', 'PET 84x80x0.05 constant material, wound Archimedean spiral + free span + pin wrap + flat run'],
    'hero.shade-b.limit-nut': ['hero-shade', 'multi-turn limit nut keyed to hub (key/thread not modeled)'],
    'hero.shade-b.stop-collar': ['hero-door', 'fixed collar on axle: true material-length stop'],
    'hero.shade-b.clip-carrier': ['hero-shade', 'jaws clamping band end + hinge ears'],
    'hero.shade-b.hinge-pin': ['hero-shade', 'hook hinge pin fixed in ears'],
    'hero.shade-b.hook': ['hero-shade', 'downturned biased hook; captures film leading face; opens geometrically after stop'],
  });
  const SHADE_SPOOL_REPLACED_OWNERS = Object.freeze(['hero.filmpath.shade', 'hero.door.shade']);
  
  // ---------------- spiral (hub frame) ----------------
  const r = (f) => f >= 0 ? SP.r0 + A_SP * f : SP.r0 + A_SP * f - DEPTH * (f / PHI_C) ** 2;
  const dr = (f) => f >= 0 ? A_SP : A_SP - 2 * DEPTH * f / PHI_C ** 2;
  const ddr = (f) => f >= 0 ? 0 : -2 * DEPTH / PHI_C ** 2;
  const speed = (f) => Math.hypot(r(f), dr(f));
  const curvature = (f) => { const a = r(f), b = dr(f), c = ddr(f); return (a * a + 2 * b * b - a * c) / (a * a + b * b) ** 1.5; };
  function gaussNodes(n) {
    const x = [], w = [];
    for (let i = 1; i <= n; i++) {
      let z = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (z === z1) break;
      }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    return { x, w };
  }
  const GL = gaussNodes(16);
  const gauss = (fn, a, b) => { let s = 0; const m = (a + b) / 2, h = (b - a) / 2; for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * fn(m + h * GL.x[i]); return s * h; };
  const ROOT_LENGTH = gauss(speed, -PHI_C, 0); // finite quadrature (residual reported by tests)
  const Gs = (rr) => { const q = Math.hypot(rr, A_SP); return 0.5 * (rr * q + A_SP * A_SP * Math.log(rr + q)); };
  function arcFromRoot(f) { return f >= 0 ? ROOT_LENGTH + (Gs(r(f)) - Gs(SP.r0)) / A_SP : gauss(speed, -PHI_C, f); }
  const PANEL = Math.PI / 8;
  function panelIntegral(fn, a, b) { // fixed absolute panel grid so the integral is smooth in b
    let s = 0, x = a;
    while (x < b) { const nx = Math.min(b, a + (Math.floor((x - a) / PANEL + 1e-12) + 1) * PANEL); s += gauss(fn, x, nx); x = nx; }
    return s;
  }
  const bendEnergy = (fd) => 0.5 * EI * panelIntegral((f) => curvature(f) ** 2 * speed(f), -PHI_C, fd);
  const bendEnergyRate = (fd) => 0.5 * EI * curvature(fd) ** 2 * speed(fd);
  const woundPolar = (fd) => { // integral r^2 ds ~ integral r^3 dphi (relative (a/r)^2 approximation, see handoff)
    const rootPart = gauss((f) => r(f) ** 2 * speed(f), -PHI_C, 0);
    return rootPart + (r(fd) ** 4 - SP.r0 ** 4) / (4 * A_SP);
  };
  
  // ---------------- departure tangency and length constraint ----------------
  function departure(fd) {
    const rr = r(fd), rp = dr(fd);
    const g = (al) => {
      const c = Math.cos(al), s = Math.sin(al), Px = CX + rr * c, Pz = CZ + rr * s;
      const tx = rp * c - rr * s, tz = rp * s + rr * c, n = Math.hypot(tx, tz);
      return ((PX - Px) * (-tz / n) + (PZ - Pz) * (tx / n)) - RHO;
    };
    let lo = -2.9, hi = -0.6, glo = g(lo), ghi = g(hi);
    if (!(glo * ghi < 0)) throw Error('departure tangency not bracketed');
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (m === lo || m === hi) break; const gm = g(m); if ((gm < 0) === (glo < 0)) { lo = m; glo = gm; } else hi = m; }
    const al = (lo + hi) / 2, c = Math.cos(al), s = Math.sin(al);
    const Px = CX + rr * c, Pz = CZ + rr * s, tx0 = rp * c - rr * s, tz0 = rp * s + rr * c, n = Math.hypot(tx0, tz0), tx = tx0 / n, tz = tz0 / n;
    const Qx = PX + RHO * tz, Qz = PZ - RHO * tx; // Cp - rho * leftNormal
    const free = (Qx - Px) * tx + (Qz - Pz) * tz, beta = -Math.atan2(tz, tx);
    const X = PET.length - arcFromRoot(fd) - free - RHO * beta + CL.endRecess + PX;
    return { fd, alpha: al, psi: al - fd, P: [Px, Pz], T: [tx, tz], Q: [Qx, Qz], free, beta, X, residual: g(al) };
  }
  function bisect(fn, lo, hi, target) { // fn monotone; returns arg with fn(arg) = target
    let flo = fn(lo) - target; const fhi = fn(hi) - target;
    if (!(flo * fhi <= 0)) throw Error('bisection not bracketed');
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (m === lo || m === hi) break; const fm = fn(m) - target; if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
    return (lo + hi) / 2;
  }
  const FD_HOME = bisect((f) => departure(f).X, 0, 40, CL.homeX);
  const FD_STOP = bisect(arcFromRoot, 0, 40, ROOT_LENGTH + ST.retainedBeyondPocket);
  const HOME = departure(FD_HOME), STOP = departure(FD_STOP);
  // One manufactured home datum: jaw rear = fixed case front, not the residual of a spiral bisection.
  // The departure solver still reports its length residual; no epsilon, snapping or changed q clock.
  const X_HOME = CL.homeX, X_STOP = STOP.X, PSI_HOME = HOME.psi, PSI_MAX = STOP.psi - PSI_HOME;
  if (X_HOME - CL.jawLength !== P.frontX[1] || P.plate.x[1] !== P.frontX[1]) throw Error('shared jaw/case home datum');
  const K_SPRING = SG.E * SG.wire ** 4 / (64 * SG.meanD * SG.coils), PSI_PRE = SG.preloadTorque / K_SPRING;
  const springAngle = (psi) => psi - PSI_HOME + PSI_PRE; // added wind angle relative to free spring
  const springTorque = (psi) => K_SPRING * springAngle(psi);
  const potential = (d) => 0.5 * K_SPRING * springAngle(d.psi) ** 2 + bendEnergy(d.fd);
  const fdOfX = (X) => X === X_HOME ? FD_HOME : X === X_STOP ? FD_STOP : bisect((f) => departure(f).X, FD_STOP, FD_HOME, X);
  
  // ---------------- hook geometry and release ----------------
  const ZT = P.filmHalfThickness, WF = CL.fingerHalf, LF = CL.fingerLength, ZH = CL.hingeZ;
  // Shared datum (authored): film top ZT is the protected stock half-thickness; hinge axis at 2*ZT; toe apex local (-ZT,-LF).
  const TOE_X = CL.toe.outerX, TOE_RISE = CL.toe.rise;
  if (ZH !== 2 * ZT || TOE_X !== ZT || TOE_RISE !== 2 * ZT || !(TOE_X > WF) || !(LF - TOE_RISE > ZH + ZT)) throw Error('hook datum construction');
  // Rigid manufactured profile (local hinge frame). Stem is convex and carries the toe attachment vertex TOE_C; toe is a separate convex cell.
  const TOE_A = [-WF, -LF], TOE_B = [-TOE_X, -LF], TOE_C = [-WF, -LF + TOE_RISE];
  const STEM_LOCAL = [[-WF, -LF], [WF, -LF], ...Array.from({ length: 9 }, (_, i) => [WF * Math.cos(Math.PI * i / 8), WF * Math.sin(Math.PI * i / 8)]), TOE_C];
  const TOE_LOCAL = [TOE_A, TOE_B, TOE_C];
  // Designed discrete constraint pose (NOT a snap of a computed angle): toe apex on film top, exact quarter-turn operator [0,-1;1,0].
  const SUPPORT_POSE = Object.freeze({ theta: Math.PI / 2, c: 0, s: 1, constraint: 'toe-apex-quarter-turn-support' });
  const THETA_REL = SUPPORT_POSE.theta; // nominal label of the designed pose only
  const XH_STOP = X_STOP + CL.hingeDX;
  const Q_REL = XH_STOP - TOE_B[1]; // toe apex world x at the support pose = release (leading edge escapes the profile at the apex)
  // Opening: film leading-top corner (q, ZT) in the hinge frame, D = q - XH_STOP, p = R(-t)(D, ZT-ZH).
  // Branch F (stem face local x=-WF, z in [-LF+rise, 0]) then branch H (toe flank TOE_C -> TOE_B). D(t) per branch is explicit.
  const DFACE = (t) => (-WF - (ZT - ZH) * Math.sin(t)) / Math.cos(t);
  const [HNX, HNZ] = [TOE_B[1] - TOE_C[1], TOE_C[0] - TOE_B[0]]; // flank outward normal (film side), unnormalised
  const DFLANK = (t) => { const c = Math.cos(t), s = Math.sin(t), dz = ZT - ZH;
    return (HNX * (TOE_C[0] - dz * s) + HNZ * (TOE_C[1] - dz * c)) / (HNX * c - HNZ * s); };
  const THETA_C = bisect((t) => ZH + TOE_C[0] * Math.sin(t) + TOE_C[1] * Math.cos(t), 0, Math.PI / 2 - 1e-3, ZT); // TOE_C reaches film top
  const Q_C = XH_STOP + DFACE(THETA_C);
  const openingTheta = (q) => q === X_STOP ? 0 : q < Q_C ? bisect(DFACE, 0, THETA_C, q - XH_STOP) : bisect(DFLANK, THETA_C, Math.PI / 2, q - XH_STOP);
  const openingBranch = (q) => q < Q_C ? 'stem-face' : 'toe-flank';
  const biasTorque = (th) => P.bias.preloadTorque + P.bias.rate * th;
  let T_REL = MOTOR_START, hiT = EXIT_TIME;
  if (!(Q_REL < Q_END)) throw Error('derived release beyond qEnd');
  for (;;) { const m = (T_REL + hiT) / 2; if (m === T_REL || m === hiT) break; if (qAt(m) >= Q_REL) hiT = m; else T_REL = m; }
  T_REL = hiT; // smallest probed double with qAt(t) >= Q_REL: release iff time >= T_REL iff q >= Q_REL
  
  // ---------------- masses (from authored solids) ----------------
  const area = (poly) => poly.reduce((m, [x, z], i) => { const [x1, z1] = poly[(i + 1) % poly.length]; return m + x * z1 - x1 * z; }, 0) / 2;
  const polar = (poly, cx, cz) => poly.reduce((m, [x0, z0], i) => { // second polar moment about (cx,cz)
    const [x1, z1] = poly[(i + 1) % poly.length], a0 = x0 - cx, b0 = z0 - cz, a1 = x1 - cx, b1 = z1 - cz, c = a0 * b1 - a1 * b0;
    return m + c * (a0 * a0 + a0 * a1 + a1 * a1 + b0 * b0 + b0 * b1 + b1 * b1) / 12; }, 0);
  const vol = (s) => Math.abs(area(s.poly)) * (s.s1 - s.s0);
  const PET_LINEAR = PET.density * PET.width * T_PET; // g per mm
  
  // ---------------- solids ----------------
  const YF = () => ({ o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] });
  const prism = (owner, name, poly, y0, y1) => ({ kind: 'prism', F: YF(), poly: poly.map((p) => [p[0], p[1]]), s0: y0, s1: y1, name, owner });
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const ngon = (cx, cz, R, n, rot = 0) => Array.from({ length: n }, (_, i) => [cx + R * Math.cos(rot + TAU * i / n), cz + R * Math.sin(rot + TAU * i / n)]);
  function rayHit(outline, cx, cz, ang) { // ray from inside point to convex ccw outline
    const dx = Math.cos(ang), dz = Math.sin(ang); let best = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-15) continue;
      const t = ((ax - cx) * ez - (az - cz) * ex) / den, u = ((ax - cx) * dz - (az - cz) * dx) / den;
      if (t > 0 && u >= -1e-12 && u <= 1 + 1e-12) best = Math.min(best, t); // vertex-through rays: construction tolerance only
    }
    if (!Number.isFinite(best)) throw Error('bored piece ray missed outline');
    return [cx + dx * best, cz + dz * best];
  }
  // Annulus-sector pieces between a regular bore n-gon (vertex radius boreR/cos(pi/n), chords tangent to boreR) and a convex outline.
  function boredPieces(outline, cx, cz, boreR, n, rot = 0, sharedBore = null) {
    const ri = boreR / Math.cos(Math.PI / n), out = [];
    // Reuse the manufactured bore vertices, including the closed seam, instead of independent sin(2*pi).
    const bore = sharedBore ?? ngon(cx,cz,ri,n,rot);
    const angOf = ([x, z]) => Math.atan2(z - cz, x - cx);
    for (let i = 0; i < n; i++) {
      const a = rot + TAU * i / n, b = rot + TAU * (i + 1) / n, poly = [bore[i].slice(), rayHit(outline, cx, cz, a)];
      const corners = outline.map((p) => [p, ((angOf(p) - a) % TAU + TAU) % TAU]).filter(([, d]) => d > 1e-12 && d < b - a - 1e-12).sort((u, v) => u[1] - v[1]);
      for (const [p] of corners) poly.push(p);
      poly.push(rayHit(outline, cx, cz, b), bore[(i + 1) % n].slice());
      out.push(poly);
    }
    return out;
  }
  const toWorld = (f, psi, off = 0) => { // hub-frame spiral point offset along left normal (toward centre is +)
    const al = f + psi, c = Math.cos(al), s = Math.sin(al), rr = r(f), rp = dr(f);
    const tx = rp * c - rr * s, tz = rp * s + rr * c, n = Math.hypot(tx, tz);
    const x = CX + rr * c, z = CZ + rr * s; return [x - off * tz / n, z + off * tx / n];
  };
  const rot2 = (cx, cz, th) => ([x, z]) => { const c = Math.cos(th), s = Math.sin(th); return [cx + x * c - z * s, cz + x * s + z * c]; };
  
  function bandAndHub(d, X, psi) {
    const out = [], segs = [], y0 = -PET.width / 2, y1 = PET.width / 2;
    const nTurnSeg = SP.sectors, step = TAU / nTurnSeg;
    // The root-pocket interface uses the SAME finite grid as its mating hub wall.
    // This is a shared manufactured face, not two independently accumulated approximations to a curve.
    const grid = Array.from({length:25},(_,k)=>-PHI_C+PHI_C*k/24);
    for (let k = 1; k * step < d.fd; k++) grid.push(k * step);
    if (grid.at(-1) !== d.fd) grid.push(d.fd);
    // band: spiral cells (left normal points to centre: inner face = +HT, outer face = -HT)
    for (let i = 0; i + 1 < grid.length; i++) {
      const a = grid[i], b = grid[i + 1];
      const poly = [toWorld(a, psi, HT), toWorld(a, psi, -HT), toWorld(b, psi, -HT), toWorld(b, psi, HT)];
      segs.push({ u0: arcFromRoot(a), u1: arcFromRoot(b), poly, kind: 'wound' });
    }
    const [tx, tz] = d.T, nx = -tz, nz = tx; // left normal (toward pin/spool centres)
    const P0 = d.P, Q0 = d.Q, U0 = arcFromRoot(d.fd);
    segs.push({ u0: U0, u1: U0 + d.free, kind: 'free', poly: [[P0[0] + HT * nx, P0[1] + HT * nz], [P0[0] - HT * nx, P0[1] - HT * nz], [Q0[0] - HT * nx, Q0[1] - HT * nz], [Q0[0] + HT * nx, Q0[1] + HT * nz]] });
    const nw = Math.max(1, Math.ceil(d.beta / (TAU / 96))), g0 = Math.atan2(tz, tx);
    for (let i = 0; i < nw; i++) {
      const ga = g0 + d.beta * i / nw, gb = g0 + d.beta * (i + 1) / nw;
      const pt = (g, rr) => [PX + rr * Math.sin(g), PZ - rr * Math.cos(g)]; // point under pin for tangent direction g
      const ua = U0 + d.free + RHO * (ga - g0), ub = U0 + d.free + RHO * (gb - g0);
      segs.push({ u0: ua, u1: ub, kind: 'wrap', poly: [pt(ga, RHO - HT), pt(ga, RHO + HT), pt(gb, RHO + HT), pt(gb, RHO - HT)] });
    }
    const uw = U0 + d.free + RHO * d.beta, xe = X - CL.endRecess;
    segs.push({ u0: uw, u1: PET.length, kind: 'flat', poly: rect(PX, xe, P.bandZ - HT, P.bandZ + HT) });
    segs.forEach((s, i) => out.push({ ...prism('hero.shade-b.band', `hero.shade-b.band:${i}`, s.poly, y0, y1), material: { u0: s.u0, u1: s.u1, kind: s.kind } }));
    // hub: annular sectors from bore polygon to outer contour (pocket follows PET inner face; elsewhere circle hubOuter)
    const inner = (ang) => [CX + SP.hubInner * Math.cos(ang), CZ + SP.hubInner * Math.sin(ang)];
    const contour = [];
    for (let k = 0; k <= 24; k++) { const f = -PHI_C + PHI_C * k / 24; contour.push(toWorld(f, psi, HT)); }
    const startA = psi, endA = psi + TAU - PHI_C;
    for (let k = 1; k < 72; k++) { const ang = startA + (endA - startA) * k / 72; contour.push([CX + SP.hubOuter * Math.cos(ang), CZ + SP.hubOuter * Math.sin(ang)]); }
    const ang = ([x, z]) => Math.atan2(z - CZ, x - CX);
    // pocket wall at the root end: along root-end normal from PET inner face up to the hub circle
    const rootOuter = toWorld(-PHI_C, psi, -HT), rootInner = contour[0];
    if (!(((ang(rootInner) - ang(rootOuter)) % TAU + TAU) % TAU < 0.1)) throw Error('root end orientation');
    const wallTop = [CX + SP.hubOuter * Math.cos(ang(rootOuter)), CZ + SP.hubOuter * Math.sin(ang(rootOuter))]; // radial pocket wall through root outer corner
    contour.push(wallTop);
    const ring = contour; // ccw sequence starting at pocket root, closing back at wall
    const hubY0 = SP.y[0], hubY1 = SP.y[1];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const poly = a === wallTop ? [inner(ang(rootOuter)), rootOuter, rootInner, inner(ang(rootInner))] : [inner(ang(a)), a, b, inner(ang(b))]; // pocket floor under root end
      if (b === wallTop) {
        // Share the actual band/clamp rootOuter corner, not an atan2/sin reconstructed plane.
        // Triangles preserve the finite manufactured boundary even when radial collinearity rounds.
        const ia = inner(ang(a)), ir = inner(ang(rootOuter));
        [[ia,a,wallTop],[ia,wallTop,rootOuter],[ia,rootOuter,ir]].forEach((cell,j)=>
          out.push(prism("hero.shade-b.hub", `hero.shade-b.hub:${i}.${j}`, cell, hubY0, hubY1)));
      } else out.push(prism("hero.shade-b.hub", `hero.shade-b.hub:${i}`, poly, hubY0, hubY1));
    }
    // clamp keeper: between root outer face and hub circle while the face lies below the circle by >= 0.05
    for (let k = 0; k < 24; k++) {
      const fa = -PHI_C + PHI_C * k / 24, fb = -PHI_C + PHI_C * (k + 1) / 24, oa = toWorld(fa, psi, -HT), ob = toWorld(fb, psi, -HT);
      const rad = (p) => Math.hypot(p[0] - CX, p[1] - CZ);
      if (SP.hubOuter - rad(ob) < 0.05) break;
      const ca = k === 0 ? wallTop : [CX + SP.hubOuter * Math.cos(ang(oa)), CZ + SP.hubOuter * Math.sin(ang(oa))], cb = [CX + SP.hubOuter * Math.cos(ang(ob)), CZ + SP.hubOuter * Math.sin(ang(ob))];
      out.push(prism('hero.shade-b.hub-clamp', `hero.shade-b.hub-clamp:${k}`, [oa, ob, cb, ca], -PET.width / 2, PET.width / 2));
    }
    // bored end caps (rotate with hub)
    const capOut = ring.filter((p, i) => ang(p) !== ang(ring[(i + 1) % ring.length])).map((p) => inner(ang(p))); // shares tube inner vertices
    boredPieces(capOut, CX, CZ, SP.capBore, 16, psi).forEach((poly, i) => {
      out.push(prism('hero.shade-b.hub', `hero.shade-b.hub:cap0-${i}`, poly, hubY0, hubY0 + SP.capY));
      out.push(prism('hero.shade-b.hub', `hero.shade-b.hub:cap1-${i}`, poly, hubY1 - SP.capY, hubY1));
    });
    return { solids: out, segs };
  }
  
  function fixedSolids() {
    const out = [], push = (o, poly, y0, y1) => out.push(prism(o, `${o}:${out.filter((s) => s.owner === o).length}`, poly, y0, y1));
    const C = 'hero.shade-b.case', [cy0, cy1] = P.caseY;
    push(C, rect(P.rearX[0], P.rearX[1], 1.2, P.caseTopZ[0]), -cy0, cy0);
    push(C, rect(P.rearX[0], P.frontX[1], P.caseTopZ[0], P.caseTopZ[1]), -cy1, cy1);
    push(C, rect(P.frontX[0], P.frontX[1], P.frontZ[0], P.frontZ[1]), -cy1, cy1);
    push(C, rect(P.plate.x[0], P.plate.x[1], P.plate.z[0], P.plate.z[1]), -cy0, cy0);
    const side = [[31, 0.7], [36, 0.7], [44, 6.0], [44, 11.2], [31, 11.2]];
    for (const [y0, y1] of [[-cy1, -cy0], [cy0, cy1]]) boredPieces(side, CX, CZ, P.axle.inscribed, P.axle.n).forEach((p) => push(C, p, y0, y1));
    const br = rect(39, 44.5, 0.8, 6.5), guideBore = ngon(PX,PZ,PIN_VERTEX_R,P.pin.n);
    // Authored matching polygonal bore and pin: shared faces rather than ulp-dependent point fits.
    // Pin vertex radius stays below the band inner radius; only bracket bore/clocking changes.
    for (const [y0, y1] of [[-P.pin.bracketY[1], -P.pin.bracketY[0]], P.pin.bracketY]) boredPieces(br, PX, PZ, PIN_VERTEX_R, P.pin.n, 0, guideBore).forEach((p) => push(C, p, y0, y1));
    push('hero.shade-b.axle', ngon(CX, CZ, P.axle.inscribed / Math.cos(Math.PI / P.axle.n), P.axle.n), ...P.axle.y);
    push('hero.shade-b.guide-pin', guideBore, ...P.pin.y);
    const yc = ST.nutY0 + ST.nutLength + ST.nutPitch * PSI_MAX / TAU;
    boredPieces(ngon(CX, CZ, ST.collarOuter, 16), CX, CZ, P.axle.inscribed, P.axle.n).forEach((p) => push('hero.shade-b.stop-collar', p, yc, yc + ST.collarLength));
    return out;
  }
  const FIXED = deepFreeze(fixedSolids());
  
  function springSolids(psi) {
    // The return spring is enclosed by the actual hollow hub/end caps and fixed housing.
    // Do not emit the dropped square-wire or experimental round-wire/weld-bridge hardware.
    const add = springAngle(psi), Phi = TAU * SG.coils + add;
    return { solids: [], hidden: true, housingOwners: ['hero.shade-b.hub', 'hero.shade-b.case'],
      coilRadius: SG.meanD / 2 * (TAU * SG.coils) / Phi,
      pitch: (SG.freePitch * SG.coils + SG.wire) / (Phi / TAU), bodyLength: SG.freePitch * SG.coils + SG.wire,
      addedAngle: add, totalTurns: Phi / TAU };
  }
  
  const hookPose = (theta) => typeof theta === 'object' ? theta : { theta, c: Math.cos(theta), s: Math.sin(theta), constraint: 'opening-root' };
  // Exact-axis ray hit for the local profile: a hit on an axis-aligned face carries that face's authored coordinate.
  function localRayHit(outline, ang) {
    const dx = Math.cos(ang), dz = Math.sin(ang); let best = Infinity, hit = null;
    for (let i = 0; i < outline.length; i++) {
      const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-15) continue;
      const t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den;
      if (t > 0 && u >= -1e-12 && u <= 1 + 1e-12 && t < best) { best = t; hit = ax === bx ? [ax, dz * t] : az === bz ? [dx * t, az] : [dx * t, dz * t]; }
    }
    if (!hit) throw Error('hook ray missed outline');
    return hit;
  }
  function localBoredPieces(outline, boreR, n) { // rays fixed in the hook frame: the cell partition is rigid across poses
    const ri = boreR / Math.cos(Math.PI / n), out = [], angOf = ([x, z]) => Math.atan2(z, x);
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n, b = TAU * (i + 1) / n, poly = [[ri * Math.cos(a), ri * Math.sin(a)], localRayHit(outline, a)];
      const corners = outline.map((p) => [p, ((angOf(p) - a) % TAU + TAU) % TAU]).filter(([, d]) => d > 1e-12 && d < b - a - 1e-12).sort((u, v) => u[1] - v[1]);
      for (const [p] of corners) poly.push(p);
      poly.push(localRayHit(outline, b), [ri * Math.cos(b), ri * Math.sin(b)]);
      out.push(poly);
    }
    return out;
  }
  const HOOK_CELLS_LOCAL = deepFreeze([...localBoredPieces(STEM_LOCAL, CL.fingerBore, 12), TOE_LOCAL]);
  function clipSolids(X, theta) {
    const out = [], xh = X + CL.hingeDX, zh = ZH, y = CL.fingerY;
    const push = (o, poly, y0, y1) => out.push(prism(o, `${o}:${out.filter((s) => s.owner === o).length}`, poly, y0, y1));
    const K = 'hero.shade-b.clip-carrier', x0 = X - CL.jawLength;
    push(K, rect(x0, X, CL.topJaw[0], CL.topJaw[1]), -PET.width / 2, PET.width / 2);
    push(K, rect(x0, X, CL.bottomJaw[0], CL.bottomJaw[1]), -PET.width / 2, PET.width / 2);
    const ear = rect(X, X + 2 * CL.hingeDX, CL.earZ[0], CL.earZ[1]);
    for (const [y0, y1] of [[-CL.earY[1], -CL.earY[0]], CL.earY]) boredPieces(ear, xh, zh, CL.hingePin, 12).forEach((p) => push(K, p, y0, y1));
    push('hero.shade-b.hinge-pin', ngon(xh, zh, CL.hingePin / Math.cos(Math.PI / 12), 12), -CL.earY[1], CL.earY[1]);
    const { c, s } = hookPose(theta), place = ([x, z]) => [xh + x * c - z * s, zh + x * s + z * c]; // one common rigid transform
    HOOK_CELLS_LOCAL.forEach((p) => push('hero.shade-b.hook', p.map(place), -y, y));
    return out;
  }
  function nutSolids(psi) {
    const y0 = ST.nutY0 + ST.nutPitch * (psi - PSI_HOME) / TAU;
    return boredPieces(ngon(CX, CZ, ST.nutOuter, 16, psi), CX, CZ, ST.nutBore, 16, psi).map((p, i) => prism('hero.shade-b.limit-nut', `hero.shade-b.limit-nut:${i}`, p, y0, y0 + ST.nutLength));
  }
  
  // ---------------- dynamics after release (generalised coordinate fd) ----------------
  const CARRIER_MASS = clipSolids(X_HOME, 0).reduce((m, s) => m + vol(s), 0) * CL.density;
  const HUB_POLAR = bandAndHub(HOME, X_HOME, PSI_HOME).solids.filter((s) => s.owner === 'hero.shade-b.hub' || s.owner === 'hero.shade-b.hub-clamp')
    .reduce((m, s) => m + Math.abs(polar(s.poly, CX, CZ)) * (s.s1 - s.s0), 0) * SP.density; // g mm^2
  const C_ROT = P.damping.cLinear * r(FD_HOME) ** 2; // N mm s / rad
  function restNormal() { // hook resting on film top after release: bias moment = N*(dx + mu*|dz|)
    const dx = TOE_B[0] * SUPPORT_POSE.c - TOE_B[1] * SUPPORT_POSE.s, dz = ZH - ZT; // toe apex lever at the designed pose (= LF)
    return biasTorque(THETA_REL) / (dx + P.friction.hookOnFilm * dz);
  }
  const N_REST = restNormal(), F_DRAG = P.friction.hookOnFilm * N_REST;
  function local3(fd) {
    const h = 1e-6, a = departure(fd - h), b = departure(fd), c = departure(fd + h);
    const Xp = (c.X - a.X) / (2 * h), Xpp = (c.X - 2 * b.X + a.X) / (h * h), Pp = (c.psi - a.psi) / (2 * h), Ppp = (c.psi - 2 * b.psi + a.psi) / (h * h);
    const freeLen = PET.length - arcFromRoot(fd);
    const mLin = CARRIER_MASS + PET_LINEAR * freeLen, J = HUB_POLAR + PET_LINEAR * woundPolar(fd);
    const m = (mLin * Xp * Xp + J * Pp * Pp) * 1e-6, dmLin = -PET_LINEAR * speed(fd), dJ = PET_LINEAR * r(fd) ** 2 * speed(fd);
    const mp = (dmLin * Xp * Xp + 2 * mLin * Xp * Xpp + dJ * Pp * Pp + 2 * J * Pp * Ppp) * 1e-6;
    const Vp = K_SPRING * springAngle(b.psi) * Pp + bendEnergyRate(fd);
    return { d: b, Xp, Pp, m, mp, Vp };
  }
  function rhs(fd, w) {
    const L = local3(fd);
    const Q = -L.Vp - C_ROT * L.Pp * L.Pp * w + F_DRAG * L.Xp; // drag acts +x on carrier while the film slides beneath
    return [w, (Q - 0.5 * L.mp * w * w) / L.m];
  }
  function rewindState(tau) {
    if (!(Number.isFinite(tau) && tau >= 0)) throw Error('rewind time must be finite and >= 0');
    const h = P.integration.step; let t = 0, f = FD_STOP, w = 0;
    while (t < tau) {
      const dt = Math.min(h, tau - t);
      const k1 = rhs(f, w), k2 = rhs(f + dt / 2 * k1[0], w + dt / 2 * k1[1]), k3 = rhs(f + dt / 2 * k2[0], w + dt / 2 * k2[1]), k4 = rhs(f + dt * k3[0], w + dt * k3[1]);
      const nf = f + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), nw = w + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if (nf >= FD_HOME) { const frac = (FD_HOME - f) / (nf - f), tImpact = t + frac * dt, wImpact = w + frac * (nw - w);
        return { fd: FD_HOME, w: 0, home: true, tImpact, wImpact, steps: Math.ceil(t / h) + 1 }; }
      f = nf; w = nw; t += dt;
    }
    return { fd: f, w, home: false, tImpact: null, wImpact: null, steps: Math.ceil(tau / h) };
  }
  
  // ---------------- public state ----------------
  function validateCoreSnapshot(s) {
    const sh = s?.sheet;
    if (!s || !sh || !Number.isFinite(s.time) || !Number.isFinite(sh.q) || !Number.isInteger(s.cycle) || s.cycle < 1) throw Error('invalid core snapshot');
    if (sh.length !== MD.packetLength || sh.width !== MD.packetWidth || sh.leadingX !== sh.q) throw Error('core sheet altered');
    if (!Object.is(qAt(s.time), sh.q)) throw Error('core snapshot q is not the model clock law q(time)');
    return s;
  }
  function shadeSpoolState(snapshot) {
    const s = validateCoreSnapshot(snapshot), q = s.sheet.q, time = s.time;
    let phase, X, theta = 0, fd, w = 0, rewind = null, contact;
    if (q < X_HOME) { phase = 'home-free'; X = X_HOME; fd = FD_HOME; contact = { film: false, gap: X_HOME - q, homeStop: true }; }
    else if (q < X_STOP) { phase = 'engaged-payout'; X = q; fd = fdOfX(X); contact = { film: 'face', homeStop: q === X_HOME, stop: false }; }
    else if (time < T_REL) { phase = 'stop-opening'; X = X_STOP; fd = FD_STOP; theta = openingTheta(q); contact = { film: 'corner-line', stop: true }; }
    else { phase = 'released-rewind'; rewind = rewindState(time - T_REL); fd = rewind.fd; w = rewind.w; theta = SUPPORT_POSE; contact = { film: 'toe-apex-on-top-line', stop: false, homeStop: rewind.home }; }
    const d = departure(fd); if (phase !== 'engaged-payout' && phase !== 'stop-opening' && phase !== 'home-free') X = rewind.home ? X_HOME : d.X;
    const psi = d.psi, Xp = local3(fd).Xp;
    return deepFreeze({ schema: SHADE_SPOOL.schema, time, cycle: s.cycle, q, phase, clipX: X, fd, psi, spoolTurnsFromHome: (psi - PSI_HOME) / TAU,
      hookTheta: typeof theta === 'object' ? theta.theta : theta, hookPose: typeof theta === 'object' ? theta.constraint : phase === 'stop-opening' ? `opening-root:${openingBranch(q)}` : 'hanging-zero', clipVelocity: w * Xp, spoolOmega: w * local3(fd).Pp, springTorque: springTorque(psi), rewind, contact,
      outsideLength: PET.length - arcFromRoot(fd), woundLength: arcFromRoot(fd), departure: d,
      flags: { RootAdoption: false, mechanicalAcceptance: false, materialAccepted: false, nativeAcceptance: false, publication: false, phaseTaskChange: 0 } });
  }
  function shadeSpoolSolids(snapshot) {
    const st = shadeSpoolState(snapshot), d = st.departure;
    const bh = bandAndHub(d, st.clipX, st.psi);
    return [...FIXED.map((s) => ({ ...s, F: YF(), poly: s.poly.map((p) => p.slice()) })), ...bh.solids, ...nutSolids(st.psi), ...springSolids(st.psi).solids, ...clipSolids(st.clipX, st.hookPose === SUPPORT_POSE.constraint ? SUPPORT_POSE : st.hookTheta)];
  }
  function replaceShadeOwners(solids, snapshot) {
    for (const o of SHADE_SPOOL_REPLACED_OWNERS) if (!solids.some((s) => s.owner === o)) throw Error(`legacy owner ${o} missing`);
    return [...solids.filter((s) => !SHADE_SPOOL_REPLACED_OWNERS.includes(s.owner)), ...shadeSpoolSolids(snapshot)];
  }
  const shadeSpoolInternals = Object.freeze({ r, dr, curvature, departure, arcFromRoot, bendEnergy, springSolids, clipSolids, bandAndHub, nutSolids, fixedSolids: () => FIXED,
    openingTheta, openingBranch, biasTorque, local3, potential, qAt, hookPose, SUPPORT_POSE, HOOK_CELLS_LOCAL, TOE_LOCAL, STEM_LOCAL, DFACE, DFLANK,
    derived: deepFreeze({ THETA_C, Q_C, ROOT_LENGTH, FD_HOME, FD_STOP, X_HOME, X_STOP, PSI_HOME, PSI_MAX, K_SPRING, PSI_PRE, THETA_REL, Q_REL, T_REL, XH_STOP,
      CARRIER_MASS, HUB_POLAR, C_ROT, N_REST, F_DRAG, EI, MOTOR_START, EXIT_TIME, Q_END, HOME_FREE: HOME.free, HOME_BETA: HOME.beta, STOP_FREE: STOP.free, STOP_BETA: STOP.beta }) });
  function shadeSpoolReplacementManifest() {
    return deepFreeze({ schema: 'instant-i4-shade-spool-b-replacement-v1', removeOwners: [...SHADE_SPOOL_REPLACED_OWNERS], addOwners: Object.keys(SHADE_SPOOL_OWNERS),
      preserveOwners: ['sheet.integral', 'pick.finger', 'hero.filmpath.guides', 'hero.filmpath.eject-link', 'hero.filmpath.pack-pawl', 'hero.filmpath.door-pawl', 'hero.filmpath.darkslide'],
      integration: 'Replace BOTH legacy owners in Node packet and browser factory; add explicit owner roles/inventory/splice; U stays read-only. No integrated factory/parity claim.',
      RootAdoption: false, mechanicalAcceptance: false, materialAccepted: false, nativeAcceptance: false, publication: false, phaseTaskChange: 0 });
  }
  // </verbatim shade-spool-b.mjs>
    return {replaceShadeOwners,shadeSpoolState,SHADE_SPOOL_OWNERS,SHADE_SPOOL_REPLACED_OWNERS};
  })();
  const compositionModule = (() => {
    const {heroSolids,HERO_OWNERS} = heroModule;
    const {shutterHeroStatics,shutterMovingSolids,shutterPose,shutterPhase,SHUTTER_OWNERS} = shutterModule;
    const {objectiveHeroStatics,OBJECTIVE_OWNERS} = objectiveModule;
    const {drivetrainSolids,DRIVE_OWNERS} = driveModule;
    const {filmPathSolids,FILMPATH_OWNERS} = filmPathModule;
    const {composePickPawl,PICK_PAWL_OWNERS,PICK_PAWL_REPLACED} = pickPawlModule;
    const {replaceShadeOwners,shadeSpoolState,SHADE_SPOOL_OWNERS,SHADE_SPOOL_REPLACED_OWNERS} = shadeModule;
  // <verbatim camera-hero-composition.mjs>
  // Full illustrative 636 apparatus on the existing native NIP rig. Browser-pure; no second model/clock.
  // Renderer adoption/native draw order are a separate release step. Source builders receive ONE achieved snapshot.
  
  const HERO_ROLES = Object.freeze({...HERO_OWNERS,...SHUTTER_OWNERS,...OBJECTIVE_OWNERS,
    ...DRIVE_OWNERS,...FILMPATH_OWNERS,...PICK_PAWL_OWNERS,...SHADE_SPOOL_OWNERS});
  const HERO_REPLACED_OWNERS = Object.freeze([...PICK_PAWL_REPLACED,...SHADE_SPOOL_REPLACED_OWNERS]);
  
  // Fixed educational section on the camera-facing (-y) side. This changes the
  // stored housing solids, not opacity, visibility or colliders. Mechanical owners
  // are never selected. Retain the +y half and a real lower lip of the drive cover.
  // The complete shade case is structural: its front wall/feed plate carry the
  // home carrier over the full film width, so it is excluded from the section.
  function educationalCutaway(solids) {
    const housings=new Set(['hero.body.shell','hero.body.front-plate','hero.door.housing',
      'hero.lens.base-block','hero.lens.mounting-plate','hero.cone.wall','hero.pack.shell']);
    return solids.flatMap(s=>{
      // Educational longitudinal section of the objective, not runtime opacity.
      // Keep the +y half and its real axial shoulder faces; the near half otherwise
      // hides the shutter aperture from the camera-facing cutaway side. A shared
      // 32-station full-circle equivalent is an inscribed material approximation.
      if(s.kind==='body'&&['hero.lens.barrel','hero.lens.element'].includes(s.owner)) {
        const radius=Math.max(...s.poly.map(p=>p[1]));
        const poly=Array.from({length:17},(_,i)=>{
          const t=-Math.PI/2+i*Math.PI/16;
          return [i===0||i===16?0:radius*Math.cos(t),radius*Math.sin(t)];
        });
        return [{...s,kind:'prism',poly,s0:s.poly[0][0],s1:s.poly[2][0]}];
      }
      if(s.owner==='hero.drive.cover-envelope') {
        return [{...s,poly:s.poly.map(([x,z])=>[x,Math.min(z,-19)])}];
      }
      if(!housings.has(s.owner))return [s];
      if(s.kind!=='prism')throw Error('cutaway expects housing prism '+s.name);
      if(s.F.a[1]===1) {
        if(s.s1<=0)return [];
        return [{...s,s0:Math.max(0,s.s0)}];
      }
      if(s.F.a[1]!==0)throw Error('cutaway axis '+s.name);
      const poly=[],y=p=>s.F.o[1]+s.F.u[1]*p[0]+s.F.v[1]*p[1];
      for(let i=0;i<s.poly.length;i++) {
        const a=s.poly[i],b=s.poly[(i+1)%s.poly.length],ya=y(a),yb=y(b);
        if(ya>=0)poly.push(a);
        if(ya<0&&yb>0||ya>0&&yb<0){const t=ya/(ya-yb);poly.push(a.map((v,k)=>v+t*(b[k]-v)));}
      }
      return poly.length>=3?[{...s,poly}]:[];
    });
  }
  
  function composeHeroGeometry(snapshot, rig) {
    if (rig.snapshot !== snapshot) throw Error('Hero requires the actual rig achieved snapshot');
    const statics = objectiveHeroStatics(shutterHeroStatics(heroSolids()));
    const shutter = shutterPose(snapshot.shutter.transmission,shutterPhase(snapshot,modelData()));
    const moving = shutterMovingSolids(shutter), drive = drivetrainSolids(snapshot), filmPath = filmPathSolids(snapshot);
    const source = [...rig.recorder.solids,...statics,...moving,...drive,...filmPath];
    const solids = educationalCutaway(replaceShadeOwners(composePickPawl(snapshot,source),snapshot));
    const names = new Set();
    for (const s of solids) {
      if (names.has(s.name)) throw Error('duplicate Hero raw shape '+s.name);
      names.add(s.name);
      if (s.owner.startsWith('hero.') && !Object.hasOwn(HERO_ROLES,s.owner)) throw Error('unknown Hero owner '+s.owner);
      if (HERO_REPLACED_OWNERS.includes(s.owner) && s.owner !== 'pick.finger') throw Error('stale Hero owner '+s.owner);
    }
    const owners = [...new Set(solids.map(s=>s.owner))];
    return {...rig, solids, recorder: {...rig.recorder,solids}, snapshot,
      scope: 'ILLUSTRATIVE Polaroid-636-style Hero; native renderer/order pending; not factory CAD',
      parts: owners.map(id=>rig.parts.find(p=>p.id===id) ?? {id,label:HERO_ROLES[id][1],role:HERO_ROLES[id][0]}),
      hero: {schema:'instant-hero-composition-v1',shutter,shade:shadeSpoolState(snapshot),
        cutaway:'mặt cắt minh họa: housing and objective near -y halves removed at y=0 except structural shade case; objective semicircle has 16 chord edges; drive cover retains lower lip z=-19',
        returnSpring:'enclosed in visible hub/case; wire and anchors intentionally hidden',
        rendererAccepted:false,continuousCollisionProof:false,materialStrengthAccepted:false},
      sourceBoundaries: {nip:rig.recorder.solids,heroStatic:statics,shutterMoving:moving,drive,filmPath},
    };
  }
  // </verbatim camera-hero-composition.mjs>
    return {composeHeroGeometry};
  })();

  // ---- runtime serialization contract: JSON values + explicit negative-zero paths (JSON alone loses -0) ----
  const packet = data.native;
  const hero = packet.schema === 'instant-native-hero-v2';
  if (!hero && packet.schema !== 'instant-native-scene-v1') fail(`unsupported packet ${packet.schema}`);
  function thaw(value, path, zeros) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(`nonfinite ${path}`);
      if (zeros.has(path)) { if (value !== 0) fail(`signed-zero path ${path} is not zero`); zeros.delete(path); return -0; }
      return value;
    }
    if (Array.isArray(value)) return value.map((item, i) => thaw(item, `${path}/${i}`, zeros));
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = thaw(value[key], `${path}/${key}`, zeros);
      return out;
    }
    return value;
  }
  const zeros = new Set(packet.negativeZeroPaths);
  if (zeros.size !== packet.negativeZeroPaths.length) fail('duplicate signed-zero path');
  const material = thaw(packet.material, '', zeros);
  if (zeros.size) fail(`unused signed-zero paths ${[...zeros].join(',')}`);
  const SUPPORTED = { prism: true, body: true, tube: true, 'annular-sector': true };
  const staticSolids = hero ? material.rig : [...material.before, ...material.after];
  const names = new Set();
  for (const s of staticSolids) {
    if (!SUPPORTED[s.kind]) fail(`unsupported native kind ${s.kind}`);
    if (typeof s.name !== 'string' || typeof s.owner !== 'string' || names.has(s.name)) fail(`missing or duplicate identity ${s.name}`);
    if (s.cut) fail(`cut material ${s.name} unsupported`);
    if (s.kind === 'annular-sector') k.validateSector(s); // vendor analytic contract, no tessellated substitute
    names.add(s.name);
  }
  const roles = packet.roles;
  const roleOf = (owner) => { for (const [role, owners] of Object.entries(roles)) if (owners.includes(owner)) return role; return fail(`owner ${owner} has no stable role`); };
  for (const s of staticSolids) roleOf(s.owner);
  const frameCopy = (F) => ({ o: F.o.slice(), a: F.a.slice(), u: F.u.slice(), v: F.v.slice() });

  // Rig sheet/finger updater; Hero builders then replace the finger and compose ALL moving apparatus.
  // The wrapper mirrors makeBaseGeometry's TURN prism record
  // (plan / F+polygon branch, endpoint swap, orientation, A.prism, owner) using the spliced vendor helpers.
  function record(F, ring, s0, s1, name, owner) {
    if (s1 < s0) [s0, s1] = [s1, s0];
    if (signedArea(ring) < 0) ring = ring.slice().reverse();
    const shape = prism(F, ring, s0, s1, { name });
    shape.owner = owner;
    return shape;
  }
  function fingerSolid(pose) {
    const [fw, fh] = PK.finger, fx = -L + pose.pickOffset, pickGap = 0.002;
    const x = [fx - fw - pickGap, fx - pickGap], y = [-PK.width / 2, PK.width / 2], z = [PK.railZ[1], fh];
    const plan = { x: x[0], y: y[0], w: x[1] - x[0], d: y[1] - y[0], r: 0 };
    const s0 = z[0], h = z[1] - z[0];
    return record(frameCopy(packet.frames.finger), k.roundedPlan(plan, 4), s0, s0 + h, 'pick.finger', 'pick.finger');
  }
  function sheetSolids(slabs) {
    return slabs.map((b, i) => {
      const name = i ? `sheet.integral:${i}` : 'sheet.integral';
      b.name = name;
      return record(frameCopy(packet.frames.sheet), roundedPolygon(xz(slabPolygon(b)), 0, 4), b.y[0], b.y[1], name, 'sheet.integral');
    });
  }
  // Achieved snapshot -> actual ordered native inventory. No targets, clocks or cached poses.
  function build(snapshot) {
    const pose = geometryPose(snapshot);
    if (pose.radius !== R) fail('snapshot roller radius differs from model data');
    const slabs = nativeSheetSlabs(pose);
    const finger = fingerSolid(pose), sheet = sheetSolids(slabs);
    if (!hero) return { pose, slabs, solids: [...material.before, finger, ...sheet, ...material.after] };
    const solids = packet.rigSequence.flatMap((entry) => entry === 'finger' ? [finger] : entry === 'sheet' ? sheet : [material.rig[entry]]);
    const geometry = compositionModule.composeHeroGeometry(snapshot, { snapshot, pose, slabs, solids,
      recorder: { solids }, parts: packet.rigParts, representation: packet.source.representation });
    const seen = new Set();
    for (const s of geometry.solids) {
      if (!SUPPORTED[s.kind] || s.cut) fail('unsupported Hero material ' + s.name);
      if (seen.has(s.name)) fail('duplicate Hero identity ' + s.name);
      seen.add(s.name); roleOf(s.owner);
      if (s.kind === 'annular-sector') k.validateSector(s);
    }
    return geometry;
  }
  return Object.freeze({ build, roleOf, P: hero ? packet.renderProjection : P, W, H: hero ? 620 : H, R, XN, XE, L, HW, ZC, NP, SH, RL, PK, STRIPS, MODEL, WORLD,
    staticSolids: Object.freeze(staticSolids), signedZeroCount: packet.negativeZeroPaths.length });
});
const ringContours=(function ringContours(ri, ro, n) {
  const unit = Array.from({ length: n }, (_, i) => {
    // Cardinal stations are exact authored axes, not libm cos(pi/2) residues.
    if (i === 0) return [1, 0];
    if (i === n / 4) return [0, 1];
    if (i === n / 2) return [-1, 0];
    if (i === 3 * n / 4) return [0, -1];
    // Evaluate reflected stations through the same first-quadrant angle.
    // This is regular-polygon symmetry, not a coordinate tolerance or snapping.
    const j = i <= n / 2 ? i : n - i;
    const t = Math.min(j, n / 2 - j) * (2 * Math.PI / n);
    return [(j <= n / 4 ? 1 : -1) * Math.cos(t), (i <= n / 2 ? 1 : -1) * Math.sin(t)];
  });
  return [ri, ro].map(r => unit.map(([x, y]) => [r * x, r * y]));
});
const parallelRingTiles=(function parallelRingTiles(inner, outer) {
  const levels = [...new Set([...inner, ...outer].map(p => p[1]))].sort((a, b) => a - b);
  const crossSection = (ring, y) => {
    const points = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a[1] === y) points.push(a);
      if (Math.min(a[1], b[1]) < y && y < Math.max(a[1], b[1])) {
        const t = (y - a[1]) / (b[1] - a[1]);
        points.push([a[0] + (b[0] - a[0]) * t, y]);
      }
    }
    if (!points.length) return null;
    points.sort((a, b) => a[0] - b[0]);
    return [points[0], points.at(-1)];
  };
  const stations = levels.map(y => ({ outer: crossSection(outer, y), inner: crossSection(inner, y) }));
  const tiles = [];
  const add = points => {
    const ring = points.filter((p, i) => !points.slice(0, i).some(q => q[0] === p[0] && q[1] === p[1]));
    if (ring.length >= 3) tiles.push(ring);
  };
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i];
    if (a.inner && b.inner) {
      add([a.outer[0], a.inner[0], b.inner[0], b.outer[0]]);
      add([a.inner[1], a.outer[1], b.outer[1], b.inner[1]]);
    } else {
      // Collinear bore endpoints retain the identical shared subedges at the caps.
      add([a.outer[0], ...(a.inner ?? []), a.outer[1], b.outer[1], ...(b.inner ? b.inner.slice().reverse() : []), b.outer[0]]);
    }
  }
  return tiles;
});
const prismStrips=(function prismStrips(polygons) {
  // Sweep obliquely rather than along an authored symmetry axis. Trigonometric
  // vertices on nominally equal horizontal levels can differ by one ulp and
  // otherwise manufacture near-zero-width cells. This is a camera-independent
  // shear, not a tolerance, deletion of material or ordering hint.
  const shear=0.123456789,originals=new Map(),restored=new Map();
  polygons=polygons.map(poly=>poly.map(p=>{
    const q=[p[0],p[1]+shear*p[0]];originals.set(JSON.stringify(q),p);return q;
  }));
  const restore=p=>{
    const key=JSON.stringify(p);
    if(!restored.has(key))restored.set(key,originals.get(key)||[p[0],p[1]-shear*p[0]]);
    return restored.get(key);
  };
  const levels=[...new Set(polygons.flatMap(p=>p.map(v=>v[1])))].sort((a,b)=>a-b);
  const edges=new Map(),rings=polygons.map(poly=>poly.map((a,i)=>{
    const b=poly[(i+1)%poly.length],ka=JSON.stringify(a),kb=JSON.stringify(b),key=[ka,kb].sort().join('|');
    if(!edges.has(key))edges.set(key,ka<kb?[a,b]:[b,a]);
    return edges.get(key);
  }));
  const hits=new Map();
  const at=(edge,y)=>{
    let row=hits.get(edge);if(!row)hits.set(edge,row=new Map());
    if(!row.has(y)) {
      const [a,b]=edge;
      row.set(y,a[1]===y?a:b[1]===y?b:[a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y]);
    }
    return row.get(y);
  };
  const out=[];
  for(let i=1;i<levels.length;i++) {
    const lo=levels[i-1],hi=levels[i],mid=lo+(hi-lo)/2;
    const intervals=rings.flatMap(ring=>{
      const active=ring.filter(([a,b])=>a[1]!==b[1]&&Math.min(a[1],b[1])<=lo&&hi<=Math.max(a[1],b[1]))
        .sort((a,b)=>at(a,mid)[0]-at(b,mid)[0]);
      return active.length>=2?[{left:active[0],right:active.at(-1)}]:[];
    }).sort((a,b)=>at(a.left,mid)[0]-at(b.left,mid)[0]);
    const merged=[];
    for(const interval of intervals) {
      const last=merged.at(-1);
      if(last&&at(interval.left,mid)[0]<=at(last.right,mid)[0]) {
        if(at(interval.right,mid)[0]>at(last.right,mid)[0])last.right=interval.right;
      } else merged.push({...interval});
    }
    for(const {left,right} of merged) {
      const poly=[at(left,lo),at(right,lo),at(right,hi),at(left,hi)]
        .filter((p,j,a)=>!a.slice(0,j).some(q=>q[0]===p[0]&&q[1]===p[1]));
      if(poly.length>=3)out.push(poly.map(restore));
    }
  }
  return out;
});
const tubePrismChain=(function tubePrismChain(s) {
  const r=s.radii[0],w=r/Math.sqrt(3),vertices=new Map(),leaves=[],paths=[];
  const intern=p=>{const k=JSON.stringify(p);if(!vertices.has(k))vertices.set(k,p);return vertices.get(k);};
  const frame=(axis,u,v)=>({o:[0,0,0],a:[0,1,2].map(i=>+(i===axis)),u:[0,1,2].map(i=>+(i===u)),v:[0,1,2].map(i=>+(i===v))});
  function ribbon(points,axis,u,v,level) {
    points=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
    const normals=points.slice(1).map((p,i)=>{const a=points[i],l=Math.hypot(p[0]-a[0],p[1]-a[1]);return [-(p[1]-a[1])/l,(p[0]-a[0])/l];});
    const stations=points.map((p,i)=>{
      const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)],d=1+a[0]*b[0]+a[1]*b[1];
      if(!(d>0))throw Error('reversing tube chain '+s.name);
      const m=[w*(a[0]+b[0])/d,w*(a[1]+b[1])/d];
      return [-1,1].map(sign=>[p[0]+sign*m[0],p[1]+sign*m[1]]);
    });
    const lo=level-w,hi=level+w,F=frame(axis,u,v);
    const cells=stations.slice(1).map((p,i)=>[stations[i][0],p[0],p[1],stations[i][1]]);
    for(const poly of s.name.startsWith('return.eye.')?prismStrips(cells):cells) {
      const world=poly.flatMap(p=>[lo,hi].map(a=>{const q=[];q[axis]=a;q[u]=p[0];q[v]=p[1];return intern(q);}));
      leaves.push({F,poly,s0:lo,s1:hi,vertices:world});
    }
    paths.push(points.map(p=>{const q=[];q[axis]=level;q[u]=p[0];q[v]=p[1];return q;}));
  }
  if(s.name==='return.body'||s.name==='pawl.coil') {
    const axis=s.name==='return.body'?0:1,u=s.name==='return.body'?1:0,v=2;
    const points=s.points,centre=[u,v].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2);
    // The authored pawl coil is not an integer number of turns. Its exact datum
    // is shared with its arbor; do not infer a drifting bounding-box centre.
    if(s.name==='pawl.coil'){centre[0]=-5.5;centre[1]=9.5;}
    const radius=Math.hypot(points[0][u]-centre[0],points[0][v]-centre[1]);
    const angles=[];
    for(const p of points){let t=Math.atan2(p[u]-centre[0],p[v]-centre[1]);if(angles.length){while(t-angles.at(-1)>Math.PI)t-=2*Math.PI;while(t-angles.at(-1)<-Math.PI)t+=2*Math.PI;}angles.push(t);}
    const direction=Math.sign(angles.at(-1)-angles[0]),start=direction*angles[0],end=direction*angles.at(-1),gap=Math.PI/12;
    const bridges=[];
    for(let k=Math.ceil((start+gap)/(2*Math.PI));k*2*Math.PI+gap<end;k++)bridges.push(k*2*Math.PI);
    const boundaries=[start,...bridges.flatMap(t=>[t-gap,t+gap]),end];
    const axial=t=>points[0][axis]+(points.at(-1)[axis]-points[0][axis])*(t-start)/(end-start);
    const levels=Array.from({length:bridges.length+1},(_,i)=>i===0?points[0][axis]:i===bridges.length?points.at(-1)[axis]:axial((boundaries[2*i]+boundaries[2*i+1])/2));
    const circle=ringContours(radius,radius,24)[0];
    const station=j=>{const p=circle[((2*j%24)+24)%24];return [centre[0]+direction*p[1],centre[1]+p[0]];};
    const margin=w/2;
    const sides=bridges.map(()=>({before:[centre[0]-direction*radius*Math.sin(gap),centre[1]+radius*Math.cos(gap)],after:[centre[0]+direction*radius*Math.sin(gap),centre[1]+radius*Math.cos(gap)]}));
    for(let i=0;i<levels.length;i++) {
      const a=boundaries[2*i],b=boundaries[2*i+1],path=[];
      const first=i?sides[i-1].after:[points[0][u],points[0][v]],last=i<bridges.length?sides[i].before:[points.at(-1)[u],points.at(-1)[v]];
      if(i){const p=first.slice();p[0]-=direction*margin;path.push(p);}
      path.push(first);
      for(let j=Math.floor(a/(Math.PI/6))+1;j*Math.PI/6<b;j++)path.push(station(j));
      path.push(last);
      if(i<bridges.length){const p=last.slice();p[0]+=direction*margin;path.push(p);}
      ribbon(path,axis,u,v,levels[i]);
      if(i<bridges.length) {
        const a=sides[i].before.slice(),c=sides[i].after.slice();a[0]+=direction*margin;c[0]-=direction*margin;
        const quarter=(c[0]-a[0])/4;
        // This dogleg is in the main-axis/tangent plane, extruded radially.
        // Its two end faces are exactly the planar turn's square end faces.
        ribbon([[levels[i],a[0]],[levels[i],a[0]+quarter],[levels[i+1],c[0]-quarter],[levels[i+1],c[0]]],v,axis,u,a[1]);
      }
    }
  } else {
    const axis=[0,1,2].find(k=>s.points.every(p=>p[k]===s.points[0][k]));
    if(axis===undefined)throw Error('nonplanar nonhelical tube '+s.name);
    const [u,v]=[0,1,2].filter(k=>k!==axis);
    ribbon(s.points.map(p=>[p[u],p[v]]),axis,u,v,s.points[0][axis]);
  }
  return {leaves,vertices:[...vertices.values()],paths,halfWidth:w,radius:r};
});
const annularTiles=(function annularTiles(s) {
  const n=24, [inner,outer]=ringContours(s.rIn,s.rOut,n);
  const index=t=>((Math.round(t*n/(2*Math.PI))%n)+n)%n;
  const a=outer[index(s.theta0)],b=outer[index(s.theta1)];
  const normals=[[-a[1],a[0]],[b[1],-b[0]]];
  const intersections=new Map();
  function clip(poly,normal,plane) {
    const out=[],d=p=>normal[0]*p[0]+normal[1]*p[1];
    for(let i=0;i<poly.length;i++) {
      const p=poly[i],q=poly[(i+1)%poly.length],dp=d(p),dq=d(q);
      if(dp>=0)out.push(p);
      if((dp<0&&dq>0)||(dp>0&&dq<0)) {
        const keys=[JSON.stringify(p),JSON.stringify(q)].sort(),key=plane+keys.join('|');
        let hit=intersections.get(key);
        if(!hit) {
          const [u,v]=JSON.stringify(p)===keys[0]?[p,q]:[q,p],du=d(u),dv=d(v),t=du/(du-dv);
          hit=u.map((x,k)=>x+(v[k]-x)*t);intersections.set(key,hit);
        }
        out.push(hit);
      }
    }
    return out.filter((p,i)=>!out.slice(0,i).some(q=>p[0]===q[0]&&p[1]===q[1]));
  }
  return parallelRingTiles(inner,outer).map(poly=>normals.reduce((p,n,i)=>clip(p,n,i),poly))
    .filter(p=>p.length>=3&&Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-v[1]*w[0];},0))>0)
    .map(p=>{
      // Keep every shared subedge, but start the cap at a genuine corner.
      // The public affine-depth witness takes its cap normal from the first triple.
      const i=p.findIndex((a,j)=>{const b=p[(j+1)%p.length],c=p[(j+2)%p.length];return Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-8;});
      if(i<0)throw Error('degenerate annular strip '+s.name);
      return p.slice(i).concat(p.slice(0,i));
    });
});
const makeTurnGeometry=(function makeTurnGeometry(geometry,P,turning) {
  const solids=[],T=turning(P);T.layer('instant');
  const origin=new Map(),sourceByName=new Map();
  function prism(s,name,polygon,F=s.F,s0=s.s0,s1=s.s1) {
    const part=T.prism({name,owner:s.owner,F,polygon,s0,s1,materialPrecision:'lossless'});
    solids.push({...part.shapes[0],owner:s.owner});
    origin.set(name,s.name);sourceByName.set(name,s);return part;
  }
  const stripOwners=new Set(['hero.shade-b.hook',
    'hero.drive.gear1','hero.drive.gear2','hero.drive.gear3','hero.drive.gear4','hero.drive.gear5',
    'hero.drive.motor','hero.drive.timing','hero.drive.counter']);
  const stripFrame={o:[0,0,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]};
  const stripPolygon=s=>s.poly.map(p=>[0,2].map(k=>s.F.o[k]+s.F.u[k]*p[0]+s.F.v[k]*p[1]));
  const groups=new Map();
  for(const s of geometry.solids)if(s.kind==='prism'&&stripOwners.has(s.owner)) {
    const key=JSON.stringify([s.owner,s.F,s.s0,s.s1]);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);
  }
  const pawl=geometry.solids.filter(s=>s.owner==='hero.pick-pawl.pawl');
  const pawlFrame={o:[0,0,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]};
  const pawlPolygons=pawl.flatMap(s=>(s.kind==='annular-sector'?annularTiles(s):[s.poly]).map(poly=>poly.map(p=>[0,2].map(k=>s.F.o[k]+s.F.u[k]*p[0]+s.F.v[k]*p[1]))));
  for(const s of geometry.solids) {
    if(s.owner==='hero.pick-pawl.pawl') {
      if(s!==pawl[0])continue;
      prismStrips(pawlPolygons).forEach((poly,i)=>prism({...s,sourceNames:pawl.map(p=>p.name)},`${s.name}.parallel.${i}`,poly,pawlFrame,s.s0,s.s1));
    }
    else if(s.kind==='prism'&&s.owner==='hero.shade-b.clip-carrier') {
      // Preserve every exact contacting bore/band boundary: no new rounded
      // intersection is allowed on a foreign-owner mating edge.
      const poly=s.poly.filter((p,i,a)=>!a.slice(0,i).some(q=>p[0]===q[0]&&p[1]===q[1]));
      for(let i=1;i+1<poly.length;i++) {
        const a=poly[0],b=poly[i],c=poly[i+1];
        if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])!==0)prism(s,`${s.name}.leaf.${i}`,[a,b,c]);
      }
    }
    else if(s.kind==='prism'&&stripOwners.has(s.owner)) {
      const group=groups.get(JSON.stringify([s.owner,s.F,s.s0,s.s1]));
      if(group[0]!==s)continue;
      prismStrips(group.map(stripPolygon)).forEach((poly,i)=>prism({...s,sourceNames:group.map(p=>p.name)},`${s.name}.parallel.${i}`,poly,stripFrame));
    }
    else if(s.kind==='prism')prism(s,s.name,s.poly);
    else if(s.kind==='annular-sector')annularTiles(s).forEach((poly,i)=>prism(s,`${s.name}.strip.${i}`,poly));
    else if(s.kind==='body') {
      if(s.poly.length!==4||s.poly[0][1]!==0||s.poly[3][1]!==0||s.poly[1][1]!==s.poly[2][1])throw Error('not a full cylinder '+s.name);
      const part=T.round({name:s.name,owner:s.owner,F:s.F,s0:s.poly[0][0],s1:s.poly[2][0],r:s.poly[1][1],fixed:false});
      solids.push({...part.shapes[0],owner:s.owner});
      origin.set(s.name,s.name);sourceByName.set(s.name,s);
    } else if(s.kind==='tube') {
      if(s.round.some(Boolean)||s.radii.some(r=>r!==s.radii[0]))throw Error('unsupported varying/rounded tube '+s.name);
      // Shared full joint faces are internal material faces, not exposed tube
      // caps. The only exposed cross-sections occur at the genuine route ends.
      tubePrismChain(s).leaves.forEach((leaf,i)=>prism(s,`${s.name}.chain.${i}`,leaf.poly,leaf.F,leaf.s0,leaf.s1));
    } else throw Error('unsupported Instant material '+s.kind);
  }
  // World-fixed material stays in the world frame. Moving assemblies use an
  // explicit free rigid frame per epoch. Flexures/film are authored afresh, not
  // incorrectly treated as a whole-cycle rigid body. Their individual convex
  // cells still have exact immutable specs within the epoch.
  const moving=new Set(['pick.finger','sheet.integral','roller.top','roller.bottom',
    'hero.shutter.blade-a','hero.shutter.blade-b','hero.shutter.walking-beam','hero.shutter.inertia',
    'hero.shutter.link-pins','hero.shutter.hook-post','hero.shutter.plunger','hero.shutter.plunger-rod',
    'hero.shutter.yoke-pin','hero.shutter.opening-spring','hero.shutter.inertia-spring','hero.drive.latch',
    'hero.drive.motor','hero.drive.gear1','hero.drive.gear2','hero.drive.gear3','hero.drive.gear4',
    'hero.drive.gear5','hero.drive.timing','hero.drive.counter','hero.pick-pawl.chain',
    'hero.pick-pawl.return-wire','hero.pick-pawl.moving-pin','hero.pick-pawl.hold-wing','hero.pick-pawl.hold-leaf',
    'hero.shade-b.band','hero.shade-b.hub','hero.shade-b.hub-clamp','hero.shade-b.limit-nut',
    'hero.shade-b.clip-carrier','hero.shade-b.hinge-pin','hero.shade-b.hook']);
  const rigidGroups=[],groupOf=new Map();
  const parts=T.parts.map(p=>{
    const owner=sourceByName.get(p.name).owner;
    if(moving.has(owner)&&!groupOf.has(owner)) {
      groupOf.set(owner,rigidGroups.length);
      rigidGroups.push({name:owner,parent:-1,kind:'free',origin:[0,0,0]});
    }
    return {name:p.name,kind:p.kind,group:groupOf.get(owner)??-1,layer:0,spec:p.spec};
  });
  // Conservative fixed-camera broad phase only: include every potentially
  // overlapping pair, in the original lexicographic order. There are no depth,
  // owner, SCC or rank exemptions. The 1 px outward pad exceeds native path
  // quantization; an exhaustive all-pairs regression checks native frame boxes.
  const rad=Math.PI/180,a=(P.azimuth??45)*rad,e=(P.elevation??30)*rad,k=P.scale*Math.sqrt(1.6);
  const m=[[Math.sin(a)*k,-Math.cos(a)*k,0],[Math.cos(a)*Math.sin(e)*k,Math.sin(a)*Math.sin(e)*k,-Math.cos(e)*k]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const hulls=[];
  const convex=points=>{
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
    return half(points).slice(0,-1).concat(half(points.slice().reverse()).slice(0,-1));
  };
  const boxes=parts.map(part=>{
    const s=part.spec,F=s.F,box=[Infinity,Infinity,-Infinity,-Infinity],points=[];
    const point=p=>{const q=m.map((row,c)=>P.origin[c]+dot(row,p));points.push(q);q.forEach((v,c)=>{box[c]=Math.min(box[c],v);box[c+2]=Math.max(box[c+2],v);});};
    if(part.kind==='prism')for(let i=0;i<s.ring.length;i+=2)for(const z of [s.s0,s.s1])
      point(F.o.map((o,c)=>o+F.a[c]*z+F.u[c]*s.ring[i]+F.v[c]*s.ring[i+1]));
    else if(part.kind==='round')for(const [z,r] of [[s.s0,s.r0],[s.s1,s.r1]]) {
      const p=F.o.map((o,c)=>o+F.a[c]*z);
      m.forEach((row,c)=>{const q=P.origin[c]+dot(row,p),extent=r*Math.hypot(dot(row,F.u),dot(row,F.v));box[c]=Math.min(box[c],q-extent);box[c+2]=Math.max(box[c+2],q+extent);});
    } else throw Error('unsupported broad-phase primitive '+part.kind);
    hulls.push(part.kind==='prism'?convex(points):null);
    return box.map((x,i)=>x+(i<2?-1:1));
  });
  // A separating axis between two convex prism silhouettes proves they cannot
  // occlude one another. Retain a 0.2 px gap margin; curved bodies use only AABB.
  // This is projection-only broad phase, never a depth/order prescription.
  const separated=(a,b)=>{
    if(!a||!b)return false;
    const outside=(poly,other)=>poly.some((p,i)=>{
      const q=poly[(i+1)%poly.length],dx=q[0]-p[0],dy=q[1]-p[1],margin=.2*Math.hypot(dx,dy);
      return other.every(v=>dx*(v[1]-p[1])-dy*(v[0]-p[0]) < -margin);
    });
    return outside(a,b)||outside(b,a);
  };
  const pairs=[];
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++) {
    const a=boxes[i],b=boxes[j];
    if(a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3]&&!separated(hulls[i],hulls[j]))pairs.push(i,j);
  }
  const ids=parts.map((_,i)=>i),packet={P,groups:rigidGroups,parts,layers:[{name:'instant',parts:ids,rest:ids}],routes:T.routes.map(r=>({name:r.name,group:-1,points:r.points.flat(),r:r.r,spacing:r.spacing,wide:r.wide,hue:r.hue,rings:r.rings})),dynamic:{instant:pairs},values:{}};
  return {geometry,T,solids,packet,origin,sourceByName};
});
const createInstantTurnRuntime=(function createInstantTurnRuntime(TURN) {
  const signature=value=>JSON.stringify(value,(key,v)=>Object.is(v,-0)?{negativeZero:true}:v);
  let cache=new Map(),previous=null;
  return {
    build(build) {
      const packet=build.packet,start=performance.now(),metrics={};
      const stamp=()=>performance.now();let at=stamp();
      // Compile declarative relationships once for this geometry epoch. Per-part
      // prepared surfaces are cached separately, including signed-zero identity.
      const scene=TURN.prepare(packet,{unit:1});
      const cams=TURN.cams(scene,{}),next=new Map(),frames=[],unchanged=new Set();
      let prepares=0,emissions=0;
      scene.runs=packet.parts.map((part,index)=>{
        const sig=signature([packet.P,part,part.group<0?null:packet.groups[part.group]]);
        let entry=cache.get(part.name);
        if(!entry||entry.signature!==sig) {
          const run=scene.runs[index];prepares++;
          const frame=TURN.emit(run,run.group<0?cams.world:cams[run.group],TURN.frame(run));emissions++;
          entry={signature:sig,run,frame};
        } else unchanged.add(part.name);
        next.set(part.name,entry);frames.push(entry.frame);
        return {...entry.run,index,part};
      });
      metrics.prepareEmitMs=stamp()-at;at=stamp();
      // Native relative-pose witnesses are valid only for identical cloud AND
      // axes/frame inputs. Reindex by names after every topology change. This
      // retains static relationships, never warm-starts changed geometry.
      if(previous) {
        const indices=new Map(packet.parts.map((p,i)=>[p.name,i]));
        scene.layers.forEach((layer,k)=>{
          layer.rel=new Map();
          for(const [key,memo] of previous.scene.layers[k]?.rel||[]) {
            const i=Math.floor(key/65536),j=key%65536;
            const a=previous.packet.parts[i]?.name,b=previous.packet.parts[j]?.name;
            if(unchanged.has(a)&&unchanged.has(b))layer.rel.set(indices.get(a)*65536+indices.get(b),memo);
          }
        });
      }
      metrics.reuseMs=stamp()-at;at=stamp();
      const stats={},orders=scene.layers.map(layer=>Array.from(TURN.order(layer,frames,cams,null,stats,scene)));
      metrics.orderMs=stamp()-at;metrics.totalMs=stamp()-start;
      Object.assign(build,{scene,frames,cams,orders,stats,metrics,prepares,emissions,unchanged:unchanged.size});
      cache=next;previous=build;return build;
    },
    dispose(){cache.clear();previous=null;},
  };
});
return (function mountInstantRenderer(root,data,kit,createFactory,convert,builders) {
  'use strict';
  const NS='http://www.w3.org/2000/svg',TURN=kit.TURN;
  const fail=why=>{throw Error('instant renderer: '+why);};
  const view=root.querySelector('[data-machine-view]'),caption=root.querySelector('[data-machine-scene] figcaption');
  const fallback=view?Array.from(view.querySelectorAll('[data-instant-static]')):[],live=view&&view.querySelector('[data-instant-live]');
  if(!view||!caption||fallback.length!==1||!live)fail('view, caption, static fallback and live layer required');
  if(live.childNodes.length)fail('live layer must start empty (no ghost material)');
  const factory=createFactory(data,kit),runtime=createInstantTurnRuntime(TURN),doc=root.ownerDocument,P=data.native.renderProjection;
  const hidden=fallback[0].getAttribute('display'),readout=doc.createElement('p');readout.setAttribute('data-instant-readout','');readout.setAttribute('class','ins-readout');
  const el=(tag,attrs={},parent=null)=>{const n=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(parent)parent.appendChild(n);return n;};
  let previous=null,latest=null,stage=null,controller=null,disposed=false,cells=[];
  const fixed=(v,n=3)=>(Object.is(v,-0)?0:v).toFixed(n).replace('.', ',');
  function dispose() {
    if(disposed)return;disposed=true;
    try{if(controller)controller.destroy();}finally{
      if(stage&&stage.parentNode)stage.parentNode.removeChild(stage);
      if(readout.parentNode)readout.parentNode.removeChild(readout);
      if(hidden===null)fallback[0].removeAttribute('display');else fallback[0].setAttribute('display',hidden);
      runtime.dispose();latest=null;controller=null;cells=[];
    }
  }
  function paintImage(snapshot,build,groups) {
    const M=data.model,rows=M.rows,columns=M.columns,rowLength=(M.roiTo-M.roiFrom)/rows,cellWidth=M.roiWidth/columns;
    const byName=new Map(build.geometry.slabs.map(s=>[s.name,s]));cells=[];
    for(const [name,g] of groups) {
      const b=byName.get(name);if(!b)continue;
      const f=x=>b.f0+(b.f1-b.f0)*(x-b.x0)/(b.x1-b.x0);
      for(let r=0;r<rows;r++) {
        const s0=M.roiFrom+r*rowLength,x0=Math.max(b.x0,snapshot.sheet.q-s0-rowLength),x1=Math.min(b.x1,snapshot.sheet.q-s0);
        if(!(x1>x0))continue;
        for(let c=0;c<columns;c++) {
          const y0=Math.max(b.y[0],-M.roiWidth/2+c*cellWidth),y1=Math.min(b.y[1],-M.roiWidth/2+(c+1)*cellWidth);if(!(y1>y0))continue;
          const i=r*columns+c,to255=v=>Math.round(255*Math.max(0,Math.min(1,v))),rgb=snapshot.active.rgb;
          const node=el('path',{class:'ins-cell','data-row':r,'data-column':c,'data-slab':name,'data-spread':snapshot.active.spread[r],
            fill:`rgb(${to255(rgb[3*i])},${to255(rgb[3*i+1])},${to255(rgb[3*i+2])})`,
            d:kit.pathOf([[x0,y0,f(x0)],[x1,y0,f(x1)],[x1,y1,f(x1)],[x0,y1,f(x0)]].map(p=>kit.iso(p,P)),true)},g);
          cells.push(node);
        }
      }
    }
  }
  return {
    render(snapshot,options={}) {
      if(disposed)fail('disposed');view.setAttribute('data-instant-focus',options.focus||'all');if(snapshot===previous)return;
      const started=performance.now(),geometry=factory.build(snapshot),built=performance.now();
      const build=runtime.build(convert(geometry,P,builders.turning)),packet=build.packet;
      build.metrics.rawMs=built-started;build.metrics.convertAndNativeMs=performance.now()-built;
      const domStarted=performance.now();
      const pending=el('g',{'data-instant-scene':''});
      const svg=el('svg',{'data-live':'instant',viewBox:`0 0 ${data.world.width} 620`,width:data.world.width,height:620},pending);
      // The same public prepared roles and emitted frames used by TURN.order.
      // Keep epoch construction detached so all existing rollback contracts hold.
      const groups=new Map();
      for(const run of build.scene.runs) {
        const s=build.sourceByName.get(run.name),g=el('g',{'data-p':run.index,'data-solid':run.name,'data-owner':s.owner,'data-source-solid':s.name,
          'data-role':factory.roleOf(s.owner),'data-kind':packet.parts[run.index].kind,class:'ins-solid'},svg);groups.set(run.name,g);
        const frame=build.frames[run.index];
        run.roles.forEach((role,i)=>{
          if(!['path','face','slot'].includes(role.type))fail('unsupported public role '+role.type);
          const node=el('path',{'data-r':role.name,class:'ins-f','data-shade':role.shade===undefined?3:Math.min(4,role.shade),d:frame.d[i]},g);
          if(role.type==='face') {
            const q=frame.q[i],band=Math.min(3,Math.floor(q/TURN.q)),mix=(q-TURN.q*band)/TURN.q;
            node.setAttribute('data-b',String(band));
            const style=[mix?`--f:${mix}`:'',frame.w[i]>=0?`stroke-width:${frame.w[i]}`:''].filter(Boolean).join(';');
            if(style)node.setAttribute('style',style);
          } else if(role.type==='slot')node.setAttribute('opacity',String(Math.round(frame.o[i]*1000)/1000));
        });
      }
      let next=null;
      const displayBefore=fallback[0].getAttribute('display');
      try {
        // Exact public native order; no caller-authored paint rank or overlay.
        for(const index of build.orders.flat())svg.appendChild(groups.get(build.scene.runs[index].name));
        build.groups=groups;paintImage(snapshot,build,groups);
        live.appendChild(pending);if(!readout.parentNode)caption.appendChild(readout);fallback[0].setAttribute('display','none');
      } catch(error) {
        if(next)next.destroy();if(pending.parentNode)pending.parentNode.removeChild(pending);
        if(!stage&&readout.parentNode)readout.parentNode.removeChild(readout);
        if(fallback[0].getAttribute('display')!==displayBefore) {
          if(displayBefore===null)fallback[0].removeAttribute('display');else fallback[0].setAttribute('display',displayBefore);
        }
        throw error;
      }
      if(controller)controller.destroy();if(stage&&stage.parentNode)stage.parentNode.removeChild(stage);
      build.metrics.domMs=performance.now()-domStarted;build.metrics.renderMs=performance.now()-started;
      stage=pending;controller=next;latest=build;previous=snapshot;
      try {
      const pose=geometry.pose,maturity=snapshot.active.maturity.reduce((a,b)=>a+b,0)/snapshot.active.maturity.length;
      for(const [key,value] of Object.entries({'snapshot-time':snapshot.time,q:pose.q,'sheet-id':snapshot.sheet.sheetId,stage:snapshot.stageKey,
        solids:build.solids.length,'render-ms':build.metrics.renderMs,'native-ms':build.metrics.totalMs,'dom-ms':build.metrics.domMs,'order-ms':build.metrics.orderMs,'emitted':build.emissions,sectors:geometry.solids.filter(s=>s.kind==='annular-sector').length,'sheet-slabs':geometry.slabs.length,'order-cycles':build.stats.forced,'top-angle':pose.topAngle}))view.setAttribute('data-'+key,String(value));
      readout.textContent=`Thời gian: ${fixed(snapshot.time)} s · Quãng kéo: ${fixed(pose.q)} mm · Góc con lăn dưới: ${fixed(pose.bottomAngle)} rad · Túi thuốc hiện: ${snapshot.pod.ruptured?'đã vỡ':'còn kín'} · Mức hiện trung bình: ${fixed(maturity*100,1)} %`;
      } catch(error) { dispose(); throw error; }
    },
    inspect(){return {latest,sceneLayer:stage,controller,lastBuild:latest?{time:previous.time,solids:latest.solids.length}:null,
      cycles:latest?.stats.forced||0,groups:latest?.packet.parts.length||0,filmCells:cells.length};},
    dispose,
  };
})(root,data,kit,createInstantNativeFactory,makeTurnGeometry,createTurnBuilders());
});
runtime.boot({
  slug: "instant-film-camera",
  descriptor: {"title":"Máy ảnh lấy liền kiểu 636","steps":[{"key":"expose","title":"Phơi tấm trên cùng","explanation":"Màn trập mở rồi đóng, cho ánh sáng qua gương cố định tới tấm phim trên cùng. Tấm còn đứng yên và ghi ảnh tiềm ẩn."},{"key":"pick","title":"Ngón đẩy đưa phim vào khe ép","explanation":"Sau khi màn trập đóng, động cơ và bánh răng kéo ngón đẩy. Ngón này đẩy mép cuối, đưa mép đầu tấm phim vào giữa hai con lăn."},{"key":"roll","title":"Hai con lăn trải thuốc hiện","explanation":"Hai con lăn kéo và ép tấm phim, làm vỡ túi thuốc hiện ở mép đầu. Thuốc được trải giữa các lớp; những vùng đã qua khe ép bắt đầu hiện ảnh."},{"key":"eject","title":"Tấm phim đi ra khe","explanation":"Mép cuối đã qua cặp con lăn; tấm phim tiến tới mốc khe ra minh họa. Tấm chắn sáng che đường ra, còn phản ứng hiện ảnh vẫn tiếp tục."},{"key":"develop","title":"Ảnh tiếp tục hiện","explanation":"Tấm phim ngừng dịch chuyển, nhưng ảnh vẫn hiện dần theo thời gian. Ảnh chưa hoàn chỉnh khi vừa ra khe; màu và thời gian ở đây chỉ là minh họa."},{"key":"ready","title":"Đạt mức hiện minh họa","explanation":"Chu kỳ dừng và giữ nguyên kết quả. Chỉ nút “Chạy lại với phôi mới” mới bắt đầu một tấm khác."}],"controls":{"runLabel":"Chạy chu kỳ","replayLabel":"Chạy lại với phôi mới","filmOptions":[]}},
  data: {"model":{"packetWidth":80,"packetLength":100,"roiWidth":64,"roiFrom":20,"roiTo":84,"podFrom":4,"podTo":12,"podRuptureAt":8,"trapFrom":90,"trapTo":98,"nipDistance":12,"exitDistance":24,"speed":40,"rollerRadius":5,"openingSeconds":0.1,"holdSeconds":0.4,"closingSeconds":0.2,"closedDwellSeconds":0.1,"maturitySeconds":5,"imageReagent":0.8,"reducedCadence":0.35,"rows":24,"columns":24,"scene":[0.18,0.16,0.28,0.2,0.17,0.29,0.22,0.18,0.3,0.24,0.19,0.31,0.26,0.2,0.32,0.28,0.21,0.33,0.3,0.22,0.34,0.32,0.23,0.35,0.34,0.24,0.36,0.36,0.25,0.37,0.38,0.26,0.38,0.4,0.27,0.39,0.42,0.28,0.4,0.44,0.29,0.41,0.46,0.3,0.42,0.48,0.31,0.43,0.5,0.32,0.44,0.52,0.33,0.45,0.54,0.34,0.46,0.56,0.35,0.47,0.58,0.36,0.48,0.6,0.37,0.49,0.62,0.38,0.5,0.64,0.39,0.51,0.19,0.18,0.29,0.21,0.19,0.3,0.23,0.2,0.31,0.25,0.21,0.32,0.27,0.22,0.33,0.29,0.23,0.34,0.31,0.24,0.35,0.33,0.25,0.36,0.35,0.26,0.37,0.37,0.27,0.38,0.39,0.28,0.39,0.41,0.29,0.4,0.43,0.3,0.41,0.45,0.31,0.42,0.47,0.32,0.43,0.49,0.33,0.44,0.51,0.34,0.45,0.53,0.35,0.46,0.55,0.36,0.47,0.57,0.37,0.48,0.59,0.38,0.49,0.61,0.39,0.5,0.63,0.4,0.51,0.65,0.41,0.52,0.2,0.2,0.3,0.22,0.21,0.31,0.24,0.22,0.32,0.26,0.23,0.33,0.28,0.24,0.34,0.3,0.25,0.35,0.32,0.26,0.36,0.34,0.27,0.37,0.36,0.28,0.38,0.38,0.29,0.39,0.4,0.3,0.4,0.42,0.31,0.41,0.44,0.32,0.42,0.46,0.33,0.43,0.48,0.34,0.44,0.5,0.35,0.45,0.52,0.36,0.46,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.64,0.42,0.52,0.66,0.43,0.53,0.21,0.22,0.31,0.23,0.23,0.32,0.25,0.24,0.33,0.27,0.25,0.34,0.29,0.26,0.35,0.31,0.27,0.36,0.33,0.28,0.37,0.35,0.29,0.38,0.37,0.3,0.39,0.39,0.31,0.4,0.41,0.32,0.41,0.43,0.33,0.42,0.45,0.34,0.43,0.47,0.35,0.44,0.49,0.36,0.45,0.51,0.37,0.46,0.53,0.38,0.47,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.65,0.44,0.53,0.67,0.45,0.54,0.22,0.24,0.32,0.24,0.25,0.33,0.26,0.26,0.34,0.28,0.27,0.35,0.3,0.28,0.36,0.32,0.29,0.37,0.34,0.3,0.38,0.36,0.31,0.39,0.38,0.32,0.4,0.4,0.33,0.41,0.42,0.34,0.42,0.44,0.35,0.43,0.46,0.36,0.44,0.48,0.37,0.45,0.5,0.38,0.46,0.52,0.39,0.47,0.54,0.4,0.48,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.66,0.46,0.54,0.68,0.47,0.55,0.23,0.26,0.33,0.25,0.27,0.34,0.27,0.28,0.35,0.29,0.29,0.36,0.31,0.3,0.37,0.33,0.31,0.38,0.35,0.32,0.39,0.37,0.33,0.4,0.39,0.34,0.41,0.41,0.35,0.42,0.43,0.36,0.43,0.45,0.37,0.44,0.47,0.38,0.45,0.49,0.39,0.46,0.51,0.4,0.47,0.53,0.41,0.48,0.55,0.42,0.49,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.95,0.64,0.15,0.67,0.48,0.55,0.69,0.49,0.56,0.24,0.28,0.34,0.26,0.29,0.35,0.28,0.3,0.36,0.3,0.31,0.37,0.32,0.32,0.38,0.34,0.33,0.39,0.36,0.34,0.4,0.38,0.35,0.41,0.4,0.36,0.42,0.42,0.37,0.43,0.44,0.38,0.44,0.46,0.39,0.45,0.48,0.4,0.46,0.5,0.41,0.47,0.52,0.42,0.48,0.54,0.43,0.49,0.56,0.44,0.5,0.58,0.45,0.51,0.6,0.46,0.52,0.62,0.47,0.53,0.64,0.48,0.54,0.66,0.49,0.55,0.68,0.5,0.56,0.7,0.51,0.57,0.25,0.3,0.35,0.27,0.31,0.36,0.29,0.32,0.37,0.31,0.33,0.38,0.33,0.34,0.39,0.35,0.35,0.4,0.37,0.36,0.41,0.39,0.37,0.42,0.41,0.38,0.43,0.43,0.39,0.44,0.45,0.4,0.45,0.47,0.41,0.46,0.49,0.42,0.47,0.51,0.43,0.48,0.53,0.44,0.49,0.55,0.45,0.5,0.57,0.46,0.51,0.59,0.47,0.52,0.61,0.48,0.53,0.63,0.49,0.54,0.65,0.5,0.55,0.67,0.51,0.56,0.69,0.52,0.57,0.71,0.53,0.58,0.26,0.32,0.36,0.28,0.33,0.37,0.3,0.34,0.38,0.32,0.35,0.39,0.34,0.36,0.4,0.36,0.37,0.41,0.38,0.38,0.42,0.4,0.39,0.43,0.42,0.4,0.44,0.44,0.41,0.45,0.46,0.42,0.46,0.48,0.43,0.47,0.5,0.44,0.48,0.52,0.45,0.49,0.54,0.46,0.5,0.56,0.47,0.51,0.58,0.48,0.52,0.6,0.49,0.53,0.62,0.5,0.54,0.64,0.51,0.55,0.66,0.52,0.56,0.68,0.53,0.57,0.7,0.54,0.58,0.72,0.55,0.59,0.27,0.34,0.37,0.29,0.35,0.38,0.31,0.36,0.39,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.39,0.4,0.43,0.41,0.41,0.44,0.43,0.42,0.45,0.45,0.43,0.46,0.47,0.44,0.47,0.49,0.45,0.48,0.51,0.46,0.49,0.53,0.47,0.5,0.55,0.48,0.51,0.57,0.49,0.52,0.59,0.5,0.53,0.61,0.51,0.54,0.63,0.52,0.55,0.65,0.53,0.56,0.67,0.54,0.57,0.69,0.55,0.58,0.71,0.56,0.59,0.73,0.57,0.6,0.28,0.36,0.38,0.3,0.37,0.39,0.32,0.38,0.4,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.4,0.42,0.44,0.42,0.43,0.45,0.44,0.44,0.46,0.46,0.45,0.47,0.48,0.46,0.48,0.5,0.47,0.49,0.52,0.48,0.5,0.54,0.49,0.51,0.56,0.5,0.52,0.58,0.51,0.53,0.6,0.52,0.54,0.62,0.53,0.55,0.64,0.54,0.56,0.66,0.55,0.57,0.68,0.56,0.58,0.7,0.57,0.59,0.72,0.58,0.6,0.74,0.59,0.61,0.29,0.38,0.39,0.31,0.39,0.4,0.33,0.4,0.41,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.41,0.44,0.45,0.43,0.45,0.46,0.45,0.46,0.47,0.47,0.47,0.48,0.49,0.48,0.49,0.51,0.49,0.5,0.53,0.5,0.51,0.55,0.51,0.52,0.57,0.52,0.53,0.59,0.53,0.54,0.61,0.54,0.55,0.63,0.55,0.56,0.65,0.56,0.57,0.67,0.57,0.58,0.69,0.58,0.59,0.71,0.59,0.6,0.73,0.6,0.61,0.75,0.61,0.62,0.3,0.4,0.4,0.32,0.41,0.41,0.34,0.42,0.42,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.42,0.46,0.46,0.44,0.47,0.47,0.46,0.48,0.48,0.48,0.49,0.49,0.5,0.5,0.5,0.52,0.51,0.51,0.54,0.52,0.52,0.56,0.53,0.53,0.58,0.54,0.54,0.6,0.55,0.55,0.62,0.56,0.56,0.64,0.57,0.57,0.66,0.58,0.58,0.68,0.59,0.59,0.7,0.6,0.6,0.72,0.61,0.61,0.74,0.62,0.62,0.76,0.63,0.63,0.31,0.42,0.41,0.33,0.43,0.42,0.35,0.44,0.43,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.43,0.48,0.47,0.45,0.49,0.48,0.47,0.5,0.49,0.49,0.51,0.5,0.51,0.52,0.51,0.53,0.53,0.52,0.55,0.54,0.53,0.57,0.55,0.54,0.59,0.56,0.55,0.61,0.57,0.56,0.63,0.58,0.57,0.65,0.59,0.58,0.67,0.6,0.59,0.69,0.61,0.6,0.71,0.62,0.61,0.73,0.63,0.62,0.75,0.64,0.63,0.77,0.65,0.64,0.32,0.44,0.42,0.34,0.45,0.43,0.36,0.46,0.44,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.44,0.5,0.48,0.46,0.51,0.49,0.48,0.52,0.5,0.5,0.53,0.51,0.52,0.54,0.52,0.54,0.55,0.53,0.56,0.56,0.54,0.58,0.57,0.55,0.6,0.58,0.56,0.62,0.59,0.57,0.64,0.6,0.58,0.66,0.61,0.59,0.68,0.62,0.6,0.7,0.63,0.61,0.72,0.64,0.62,0.74,0.65,0.63,0.76,0.66,0.64,0.78,0.67,0.65,0.33,0.46,0.43,0.35,0.47,0.44,0.37,0.48,0.45,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.45,0.52,0.49,0.47,0.53,0.5,0.49,0.54,0.51,0.51,0.55,0.52,0.53,0.56,0.53,0.55,0.57,0.54,0.57,0.58,0.55,0.59,0.59,0.56,0.61,0.6,0.57,0.63,0.61,0.58,0.65,0.62,0.59,0.67,0.63,0.6,0.69,0.64,0.61,0.71,0.65,0.62,0.73,0.66,0.63,0.75,0.67,0.64,0.77,0.68,0.65,0.79,0.69,0.66,0.34,0.48,0.44,0.36,0.49,0.45,0.38,0.5,0.46,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.46,0.54,0.5,0.48,0.55,0.51,0.5,0.56,0.52,0.52,0.57,0.53,0.54,0.58,0.54,0.56,0.59,0.55,0.58,0.6,0.56,0.6,0.61,0.57,0.62,0.62,0.58,0.64,0.63,0.59,0.66,0.64,0.6,0.68,0.65,0.61,0.7,0.66,0.62,0.72,0.67,0.63,0.74,0.68,0.64,0.76,0.69,0.65,0.78,0.7,0.66,0.8,0.71,0.67,0.35,0.5,0.45,0.37,0.51,0.46,0.39,0.52,0.47,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.47,0.56,0.51,0.49,0.57,0.52,0.51,0.58,0.53,0.53,0.59,0.54,0.55,0.6,0.55,0.57,0.61,0.56,0.59,0.62,0.57,0.61,0.63,0.58,0.63,0.64,0.59,0.65,0.65,0.6,0.67,0.66,0.61,0.69,0.67,0.62,0.71,0.68,0.63,0.73,0.69,0.64,0.75,0.7,0.65,0.77,0.71,0.66,0.79,0.72,0.67,0.81,0.73,0.68,0.36,0.52,0.46,0.38,0.53,0.47,0.4,0.54,0.48,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.48,0.58,0.52,0.5,0.59,0.53,0.52,0.6,0.54,0.54,0.61,0.55,0.56,0.62,0.56,0.58,0.63,0.57,0.6,0.64,0.58,0.62,0.65,0.59,0.64,0.66,0.6,0.66,0.67,0.61,0.68,0.68,0.62,0.7,0.69,0.63,0.72,0.7,0.64,0.74,0.71,0.65,0.76,0.72,0.66,0.78,0.73,0.67,0.8,0.74,0.68,0.82,0.75,0.69,0.37,0.54,0.47,0.39,0.55,0.48,0.41,0.56,0.49,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.49,0.6,0.53,0.51,0.61,0.54,0.53,0.62,0.55,0.55,0.63,0.56,0.57,0.64,0.57,0.59,0.65,0.58,0.61,0.66,0.59,0.63,0.67,0.6,0.65,0.68,0.61,0.67,0.69,0.62,0.69,0.7,0.63,0.71,0.71,0.64,0.73,0.72,0.65,0.75,0.73,0.66,0.77,0.74,0.67,0.79,0.75,0.68,0.81,0.76,0.69,0.83,0.77,0.7,0.38,0.56,0.48,0.4,0.57,0.49,0.42,0.58,0.5,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.5,0.62,0.54,0.52,0.63,0.55,0.54,0.64,0.56,0.56,0.65,0.57,0.58,0.66,0.58,0.6,0.67,0.59,0.62,0.68,0.6,0.64,0.69,0.61,0.66,0.7,0.62,0.68,0.71,0.63,0.7,0.72,0.64,0.72,0.73,0.65,0.74,0.74,0.66,0.76,0.75,0.67,0.78,0.76,0.68,0.8,0.77,0.69,0.82,0.78,0.7,0.84,0.79,0.71,0.39,0.58,0.49,0.41,0.59,0.5,0.43,0.6,0.51,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.51,0.64,0.55,0.53,0.65,0.56,0.55,0.66,0.57,0.57,0.67,0.58,0.59,0.68,0.59,0.61,0.69,0.6,0.63,0.7,0.61,0.65,0.71,0.62,0.67,0.72,0.63,0.69,0.73,0.64,0.71,0.74,0.65,0.73,0.75,0.66,0.75,0.76,0.67,0.77,0.77,0.68,0.79,0.78,0.69,0.81,0.79,0.7,0.83,0.8,0.71,0.85,0.81,0.72,0.4,0.6,0.5,0.42,0.61,0.51,0.44,0.62,0.52,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.52,0.66,0.56,0.54,0.67,0.57,0.56,0.68,0.58,0.58,0.69,0.59,0.6,0.7,0.6,0.62,0.71,0.61,0.64,0.72,0.62,0.66,0.73,0.63,0.68,0.74,0.64,0.7,0.75,0.65,0.72,0.76,0.66,0.74,0.77,0.67,0.76,0.78,0.68,0.78,0.79,0.69,0.8,0.8,0.7,0.82,0.81,0.71,0.84,0.82,0.72,0.86,0.83,0.73,0.41,0.62,0.51,0.43,0.63,0.52,0.45,0.64,0.53,0.12,0.18,0.3,0.12,0.18,0.3,0.12,0.18,0.3,0.53,0.68,0.57,0.55,0.69,0.58,0.57,0.7,0.59,0.59,0.71,0.6,0.61,0.72,0.61,0.63,0.73,0.62,0.65,0.74,0.63,0.67,0.75,0.64,0.69,0.76,0.65,0.71,0.77,0.66,0.73,0.78,0.67,0.75,0.79,0.68,0.77,0.8,0.69,0.79,0.81,0.7,0.81,0.82,0.71,0.83,0.83,0.72,0.85,0.84,0.73,0.87,0.85,0.74],"stages":[{"key":"expose","duration":0.7999999999999999},{"key":"pick","duration":0.29999999999999993},{"key":"roll","duration":2.5},{"key":"eject","duration":0.30000000000000027},{"key":"develop","duration":4.299999999999999},{"key":"ready","duration":0}],"units":"illustrative mm, canonical educational s, rad, normalized reagent and RGB","reducedPolicy":"hold entire achieved snapshot; commit remaining current stage at 0.35 s bounded real-dt cadence; no catch-up","orientation":"x transport, y shaft, z up; material s from leading toward trailing, x=q-s; displayed ROI orientation illustrative"},"world":{"schemaVersion":1,"label":"NIP PROOF RIG / NOT COMPLETE 636 camera","units":"mm-illustrative","disclaimer":"Static nip/roller/sheet contact proof rig referenced to the Polaroid 636 fixed-focus hardbody with historical 600 integral film. Every rig dimension below is ILLUSTRATIVE, not factory CAD, not a 600-film calibration. Roller radius, nip/exit stations, sheet length/width and pod/ROI/trap intervals are read from machine-model.mjs modelData(), never from this file.","width":1280,"height":300,"camera":{"azimuth":90,"elevation":1,"pad":28,"note":"One fixed near-roller-axis inspection view from +y for every pose; sees the +y sheet edge through the fixed gap-stop window."},"sheet":{"baseThickness":0.8,"podThickness":2,"podRamp":1,"podHalfWidth":34,"trapPassedThickness":1.2,"trapRamp":1,"note":"Illustrative compressible laminate. Unpassed pod is thicker; material that has passed the nip keeps the base thickness except the trap, which holds excess reagent. Not fluid CFD, not a mass/volume claim."},"nip":{"gap":0.6,"contactClearanceMargin":0.0015,"tangentStep":0.1,"tangentHalfSpan":3,"note":"Illustrative stop-set gap between the two hard rollers. Inside the contact patch the sheet is deformed to lie between margin and margin+tangent sag+pack rounding BELOW the true circle; penetration tolerance is exactly zero."},"rollers":{"halfLength":44,"axleRadius":1.5,"boreClearance":0.05,"bearingSectors":16,"axleEnd":55,"collar":[52,53],"collarRadius":2.4,"journal":{"outerHalf":2,"shoulderHalf":1.75,"y":[49,51],"note":"Legacy-only four-pad proof parameters for legacy-turn-proof.mjs; not accepted production journal material. Current native bearing-geometry.mjs uses two annular sectors R1.5..2 per bearing at +/-Y49..51, with integral keys, signed shoulders/captures and actual collar carriers. Static illustrative geometry, no force/strength/factory calibration."}},"frame":{"base":{"x":[-108,132],"y":[-62,62],"z":[-23,-20]},"endplate":{"x":[2,27],"y":[48,52],"z":[-20,20],"window":4,"slotClearance":0.1,"capZ":16,"viewWindow":{"z":[-0.45,0.65],"note":"Fixed through-window in the gap-stop bridge, x full span between side webs; constant for all poses."},"lipSeat":{"depth":2,"thickness":0.4,"note":"Illustrative integral ledges cast on the inner face of each endplate side web, under the entry and exit lips. x = lip x span intersected with the one side web it butts; top = exact lip bottom datum; y = [web inner face - depth, web inner face] (mirrored), must stay outside the film width. Geometric +z seat only; no force, strength or factory claim."}},"spring":{"thickness":0.4,"legs":5,"legHalfX":3.2,"y":[48.5,51.5],"note":"Illustrative continuous serpentine leaf spring (one strip); qualitative preload, no force calibration."},"entryRail":{"x":[-104,6.5],"y":[36,40]},"exitTray":{"x":[17.5,130],"y":[36,40]},"entryLip":{"x":[-6,7],"z":[1.15,2.6],"halfWidth":48},"exitLip":{"x":[17.5,27],"z":[0.75,2.5],"halfWidth":48}},"pick":{"finger":[3,1.6],"y":0,"width":10,"railZ":[-3.2,-2.2],"note":"Simple core pick reference driven by model pick.offset; full pick/timing gear train PENDING, no factory ratio."}},"native":{"schema":"instant-native-hero-v2","renderProjection":{"origin":[651.8293823544435,382.0395689461372],"scale":2.283324067482238,"azimuth":-55,"elevation":24},"renderViewBox":[208,50,840,570],"serialization":"JSON values + negativeZeroPaths; Hero rebuilt from verbatim production builders","material":{"rig":[{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[132,-62],[132,62],[-108,62],[-108,-62]],"s0":-23,"s1":-20,"name":"rig.base","owner":"rig.base"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[8,48],[8,52],[2,52],[2,48]],"s0":-20,"s1":20,"name":"rig.endplates","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[27,48],[27,52],[16,52],[16,48]],"s0":-20,"s1":20,"name":"rig.endplates:1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,48],[16,52],[8,52],[8,48]],"s0":-20,"s1":-9.3,"name":"rig.endplates:2","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,48],[16,52],[8,52],[8,48]],"s0":-1.2999999999999998,"s1":-0.44999999999999996,"name":"rig.endplates:3","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,48],[16,52],[8,52],[8,48]],"s0":0.65,"s1":1.2999999999999998,"name":"rig.endplates:4","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,48],[16,52],[8,52],[8,48]],"s0":16,"s1":20,"name":"rig.endplates:5","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[8,-52],[8,-48],[2,-48],[2,-52]],"s0":-20,"s1":20,"name":"rig.endplates:6","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[27,-52],[27,-48],[16,-48],[16,-52]],"s0":-20,"s1":20,"name":"rig.endplates:7","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,-52],[16,-48],[8,-48],[8,-52]],"s0":-20,"s1":-9.3,"name":"rig.endplates:8","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,-52],[16,-48],[8,-48],[8,-52]],"s0":-1.2999999999999998,"s1":-0.44999999999999996,"name":"rig.endplates:9","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,-52],[16,-48],[8,-48],[8,-52]],"s0":0.65,"s1":1.2999999999999998,"name":"rig.endplates:10","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[16,-52],[16,-48],[8,-48],[8,-52]],"s0":16,"s1":20,"name":"rig.endplates:11","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[7,46],[7,48],[2,48],[2,46]],"s0":0.7499999999999999,"s1":1.15,"name":"rig.endplates:12","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[7,-48],[7,-46],[2,-46],[2,-48]],"s0":0.7499999999999999,"s1":1.15,"name":"rig.endplates:13","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[27,46],[27,48],[17.5,48],[17.5,46]],"s0":0.35,"s1":0.75,"name":"rig.endplates:14","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[27,-48],[27,-46],[17.5,-46],[17.5,-48]],"s0":0.35,"s1":0.75,"name":"rig.endplates:15","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[9.7,8.8],[9.7,15],[9.3,15.4],[9.3,8.8]],"s0":48.5,"s1":51.5,"name":"rig.springs","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[9.7,15],[10.875,15],[11.275,15.4],[9.3,15.4]],"s0":48.5,"s1":51.5,"name":"rig.springs:1","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[10.875,15],[10.875,8.6],[11.275,9],[11.275,15.4]],"s0":48.5,"s1":51.5,"name":"rig.springs:2","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[10.875,8.6],[12.85,8.6],[12.45,9],[11.275,9]],"s0":48.5,"s1":51.5,"name":"rig.springs:3","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[12.85,8.6],[12.85,15],[12.45,15.4],[12.45,9]],"s0":48.5,"s1":51.5,"name":"rig.springs:4","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[12.85,15],[14.025,15],[14.425,15.4],[12.45,15.4]],"s0":48.5,"s1":51.5,"name":"rig.springs:5","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[14.025,15],[14.025,8.6],[14.425,9],[14.425,15.4]],"s0":48.5,"s1":51.5,"name":"rig.springs:6","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[14.025,8.6],[16,8.6],[15.6,9],[14.425,9]],"s0":48.5,"s1":51.5,"name":"rig.springs:7","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[16,8.6],[16,15.2],[15.6,15.2],[15.6,9]],"s0":48.5,"s1":51.5,"name":"rig.springs:8","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[9.7,8.8],[9.7,15],[9.3,15.4],[9.3,8.8]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:9","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[9.7,15],[10.875,15],[11.275,15.4],[9.3,15.4]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:10","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[10.875,15],[10.875,8.6],[11.275,9],[11.275,15.4]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:11","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[10.875,8.6],[12.85,8.6],[12.45,9],[11.275,9]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:12","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[12.85,8.6],[12.85,15],[12.45,15.4],[12.45,9]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:13","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[12.85,15],[14.025,15],[14.425,15.4],[12.45,15.4]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:14","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[14.025,15],[14.025,8.6],[14.425,9],[14.425,15.4]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:15","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[14.025,8.6],[16,8.6],[15.6,9],[14.425,9]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:16","owner":"rig.springs"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[16,8.6],[16,15.2],[15.6,15.2],[15.6,9]],"s0":-51.5,"s1":-48.5,"name":"rig.springs:17","owner":"rig.springs"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-44,0],[-44,5],[44,5],[44,0]],"name":"roller.top","owner":"roller.top"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[44,0],[44,1.5],[52,1.5],[52,0]],"name":"roller.top.shaft","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[52,0],[52,2.4],[53,2.4],[53,0]],"name":"roller.top.shaft:1","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[53,0],[53,1.5],[55,1.5],[55,0]],"name":"roller.top.shaft:2","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-52,0],[-52,1.5],[-44,1.5],[-44,0]],"name":"roller.top.shaft:3","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-53,0],[-53,2.4],[-52,2.4],[-52,0]],"name":"roller.top.shaft:4","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-55,0],[-55,1.5],[-53,1.5],[-53,0]],"name":"roller.top.shaft:5","owner":"roller.top.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-44,0],[-44,5],[44,5],[44,0]],"name":"roller.bottom","owner":"roller.bottom"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[44,0],[44,1.5],[52,1.5],[52,0]],"name":"roller.bottom.shaft","owner":"roller.bottom.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[52,0],[52,2.4],[53,2.4],[53,0]],"name":"roller.bottom.shaft:1","owner":"roller.bottom.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[53,0],[53,1.5],[55,1.5],[55,0]],"name":"roller.bottom.shaft:2","owner":"roller.bottom.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-52,0],[-52,1.5],[-44,1.5],[-44,0]],"name":"roller.bottom.shaft:3","owner":"roller.bottom.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-53,0],[-53,2.4],[-52,2.4],[-52,0]],"name":"roller.bottom.shaft:4","owner":"roller.bottom.shaft"},{"kind":"body","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[1,0,0],"v":[0,0,-1]},"poly":[[-55,0],[-55,1.5],[-53,1.5],[-53,0]],"name":"roller.bottom.shaft:5","owner":"roller.bottom.shaft"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[-104,36],[6.5,36],[6.5,40],[-104,40]],"s0":-20,"s1":-0.4,"name":"rig.entry-rails","owner":"rig.entry-rails"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[-104,-40],[6.5,-40],[6.5,-36],[-104,-36]],"s0":-20,"s1":-0.4,"name":"rig.entry-rails:1","owner":"rig.entry-rails"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[17.5,36],[130,36],[130,40],[17.5,40]],"s0":-20,"s1":-0.4,"name":"rig.exit-tray","owner":"rig.exit-tray"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[17.5,-40],[130,-40],[130,-36],[17.5,-36]],"s0":-20,"s1":-0.4,"name":"rig.exit-tray:1","owner":"rig.exit-tray"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[7,-48],[7,48],[-6,48],[-6,-48]],"s0":1.15,"s1":2.6,"name":"rig.entry-lip","owner":"rig.entry-lip"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[27,-48],[27,48],[17.5,48],[17.5,-48]],"s0":0.75,"s1":2.5,"name":"rig.exit-lip","owner":"rig.exit-lip"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]},"poly":[[-109,-6],[-86,-6],[-86,6],[-109,6]],"s0":-20,"s1":-2.2,"name":"pick.rail","owner":"pick.rail"},{"kind":"annular-sector","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":-51,"s1":-49,"rIn":1.5,"rOut":2,"theta0":-2.356194490192345,"theta1":-0.7853981633974483,"name":"bearing.top.-1.liner.-1","owner":"bearing.top.-1.integral-liner.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,13.237436867076458],[3.885786437626905,13.414213562373096],[3.885786437626905,15],[4.062563132923541,15]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta0","owner":"bearing.top.-1.integral-liner.-1","interface":{"liner":"bearing.top.-1.liner.-1","face":"theta0","r":[1.75,2],"theta":-2.356194490192345,"y":[-51,-49],"endpoints":[[13.237436867076458,-51,4.062563132923541],[13.414213562373096,-51,3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.585786437626905,14.25],[3.585786437626905,15],[3.885786437626905,15],[3.885786437626905,14.25]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta0.socket.below","owner":"bearing.top.-1","key":"bearing.top.-1.liner.-1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,14.25],[4.062563132923541,15],[4.362563132923541,15],[4.362563132923541,14.25]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta0.socket.above","owner":"bearing.top.-1","key":"bearing.top.-1.liner.-1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,14.25],[3.885786437626905,15],[4.062563132923541,15],[4.062563132923541,14.25]],"s0":-52,"s1":-51,"name":"bearing.top.-1.liner.-1.key.theta0.axial.0","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,14.25],[3.885786437626905,15],[4.062563132923541,15],[4.062563132923541,14.25]],"s0":-49,"s1":-48,"name":"bearing.top.-1.liner.-1.key.theta0.axial.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,9],[3.885786437626905,9],[3.885786437626905,10.585786437626904],[4.062563132923541,10.762563132923542]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta1","owner":"bearing.top.-1.integral-liner.-1","interface":{"liner":"bearing.top.-1.liner.-1","face":"theta1","r":[1.75,2],"theta":-0.7853981633974483,"y":[-51,-49],"endpoints":[[10.762563132923542,-51,4.062563132923541],[10.585786437626904,-51,3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.585786437626905,9],[3.585786437626905,9.75],[3.885786437626905,9.75],[3.885786437626905,9]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta1.socket.below","owner":"bearing.top.-1","key":"bearing.top.-1.liner.-1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,9],[4.062563132923541,9.75],[4.362563132923541,9.75],[4.362563132923541,9]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.-1.key.theta1.socket.above","owner":"bearing.top.-1","key":"bearing.top.-1.liner.-1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,9],[3.885786437626905,9.75],[4.062563132923541,9.75],[4.062563132923541,9]],"s0":-52,"s1":-51,"name":"bearing.top.-1.liner.-1.key.theta1.axial.0","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,9],[3.885786437626905,9.75],[4.062563132923541,9.75],[4.062563132923541,9]],"s0":-49,"s1":-48,"name":"bearing.top.-1.liner.-1.key.theta1.axial.1","owner":"bearing.top.-1"},{"kind":"annular-sector","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":-51,"s1":-49,"rIn":1.5,"rOut":2,"theta0":0.7853981633974483,"theta1":2.356194490192345,"name":"bearing.top.-1.liner.1","owner":"bearing.top.-1.integral-liner.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,10.762563132923542],[6.714213562373095,10.585786437626904],[6.714213562373095,9],[6.537436867076458,9]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta0","owner":"bearing.top.-1.integral-liner.1","interface":{"liner":"bearing.top.-1.liner.1","face":"theta0","r":[1.75,2],"theta":0.7853981633974483,"y":[-51,-49],"endpoints":[[10.762563132923542,-51,6.537436867076458],[10.585786437626904,-51,6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.237436867076458,9],[6.237436867076458,9.75],[6.537436867076458,9.75],[6.537436867076458,9]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta0.socket.below","owner":"bearing.top.-1","key":"bearing.top.-1.liner.1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.714213562373095,9],[6.714213562373095,9.75],[7.014213562373095,9.75],[7.014213562373095,9]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta0.socket.above","owner":"bearing.top.-1","key":"bearing.top.-1.liner.1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,9],[6.537436867076458,9.75],[6.714213562373095,9.75],[6.714213562373095,9]],"s0":-52,"s1":-51,"name":"bearing.top.-1.liner.1.key.theta0.axial.0","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,9],[6.537436867076458,9.75],[6.714213562373095,9.75],[6.714213562373095,9]],"s0":-49,"s1":-48,"name":"bearing.top.-1.liner.1.key.theta0.axial.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,13.414213562373096],[6.537436867076458,13.237436867076458]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta1","owner":"bearing.top.-1.integral-liner.1","interface":{"liner":"bearing.top.-1.liner.1","face":"theta1","r":[1.75,2],"theta":2.356194490192345,"y":[-51,-49],"endpoints":[[13.237436867076458,-51,6.537436867076458],[13.414213562373096,-51,6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.237436867076458,14.25],[6.237436867076458,15],[6.537436867076458,15],[6.537436867076458,14.25]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta1.socket.below","owner":"bearing.top.-1","key":"bearing.top.-1.liner.1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.714213562373095,14.25],[6.714213562373095,15],[7.014213562373095,15],[7.014213562373095,14.25]],"s0":-51,"s1":-49,"name":"bearing.top.-1.liner.1.key.theta1.socket.above","owner":"bearing.top.-1","key":"bearing.top.-1.liner.1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,14.25],[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,14.25]],"s0":-52,"s1":-51,"name":"bearing.top.-1.liner.1.key.theta1.axial.0","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,14.25],[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,14.25]],"s0":-49,"s1":-48,"name":"bearing.top.-1.liner.1.key.theta1.axial.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,8.1],[1.2999999999999998,9],[9.3,9],[9.3,8.1]],"s0":-52,"s1":-48,"name":"bearing.top.-1.wall.-1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[5.05,9],[5.05,10.25],[5.55,10.25],[5.55,9]],"s0":-52,"s1":-51,"name":"bearing.top.-1.thrust.-1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,15.9],[9.3,15.9],[9.3,15]],"s0":-52,"s1":-48,"name":"bearing.top.-1.wall.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[5.05,13.75],[5.05,15],[5.55,15],[5.55,13.75]],"s0":-52,"s1":-51,"name":"bearing.top.-1.thrust.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,9],[1.2999999999999998,15],[2.8,15],[2.8,9]],"s0":-52,"s1":-48,"name":"bearing.top.-1.bridge.-1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[7.8,9],[7.8,15],[9.3,15],[9.3,9]],"s0":-52,"s1":-48,"name":"bearing.top.-1.bridge.1","owner":"bearing.top.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,7],[1.2999999999999998,9],[9.3,9],[9.3,7]],"s0":-53,"s1":-52,"name":"bearing.top.-1.cheek.-1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,7],[1.2999999999999998,9],[9.3,9],[9.3,7]],"s0":-48,"s1":-47,"name":"bearing.top.-1.cheek.-1.1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,17],[9.3,17],[9.3,15]],"s0":-53,"s1":-52,"name":"bearing.top.-1.cheek.1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,17],[9.3,17],[9.3,15]],"s0":-48,"s1":-47,"name":"bearing.top.-1.cheek.1.1","owner":"rig.endplates"},{"kind":"annular-sector","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":49,"s1":51,"rIn":1.5,"rOut":2,"theta0":-2.356194490192345,"theta1":-0.7853981633974483,"name":"bearing.top.1.liner.-1","owner":"bearing.top.1.integral-liner.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,13.237436867076458],[3.885786437626905,13.414213562373096],[3.885786437626905,15],[4.062563132923541,15]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta0","owner":"bearing.top.1.integral-liner.-1","interface":{"liner":"bearing.top.1.liner.-1","face":"theta0","r":[1.75,2],"theta":-2.356194490192345,"y":[49,51],"endpoints":[[13.237436867076458,49,4.062563132923541],[13.414213562373096,49,3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.585786437626905,14.25],[3.585786437626905,15],[3.885786437626905,15],[3.885786437626905,14.25]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta0.socket.below","owner":"bearing.top.1","key":"bearing.top.1.liner.-1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,14.25],[4.062563132923541,15],[4.362563132923541,15],[4.362563132923541,14.25]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta0.socket.above","owner":"bearing.top.1","key":"bearing.top.1.liner.-1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,14.25],[3.885786437626905,15],[4.062563132923541,15],[4.062563132923541,14.25]],"s0":48,"s1":49,"name":"bearing.top.1.liner.-1.key.theta0.axial.0","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,14.25],[3.885786437626905,15],[4.062563132923541,15],[4.062563132923541,14.25]],"s0":51,"s1":52,"name":"bearing.top.1.liner.-1.key.theta0.axial.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,9],[3.885786437626905,9],[3.885786437626905,10.585786437626904],[4.062563132923541,10.762563132923542]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta1","owner":"bearing.top.1.integral-liner.-1","interface":{"liner":"bearing.top.1.liner.-1","face":"theta1","r":[1.75,2],"theta":-0.7853981633974483,"y":[49,51],"endpoints":[[10.762563132923542,49,4.062563132923541],[10.585786437626904,49,3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.585786437626905,9],[3.585786437626905,9.75],[3.885786437626905,9.75],[3.885786437626905,9]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta1.socket.below","owner":"bearing.top.1","key":"bearing.top.1.liner.-1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[4.062563132923541,9],[4.062563132923541,9.75],[4.362563132923541,9.75],[4.362563132923541,9]],"s0":49,"s1":51,"name":"bearing.top.1.liner.-1.key.theta1.socket.above","owner":"bearing.top.1","key":"bearing.top.1.liner.-1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,9],[3.885786437626905,9.75],[4.062563132923541,9.75],[4.062563132923541,9]],"s0":48,"s1":49,"name":"bearing.top.1.liner.-1.key.theta1.axial.0","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[3.885786437626905,9],[3.885786437626905,9.75],[4.062563132923541,9.75],[4.062563132923541,9]],"s0":51,"s1":52,"name":"bearing.top.1.liner.-1.key.theta1.axial.1","owner":"bearing.top.1"},{"kind":"annular-sector","F":{"o":[12,0,5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":49,"s1":51,"rIn":1.5,"rOut":2,"theta0":0.7853981633974483,"theta1":2.356194490192345,"name":"bearing.top.1.liner.1","owner":"bearing.top.1.integral-liner.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,10.762563132923542],[6.714213562373095,10.585786437626904],[6.714213562373095,9],[6.537436867076458,9]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta0","owner":"bearing.top.1.integral-liner.1","interface":{"liner":"bearing.top.1.liner.1","face":"theta0","r":[1.75,2],"theta":0.7853981633974483,"y":[49,51],"endpoints":[[10.762563132923542,49,6.537436867076458],[10.585786437626904,49,6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.237436867076458,9],[6.237436867076458,9.75],[6.537436867076458,9.75],[6.537436867076458,9]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta0.socket.below","owner":"bearing.top.1","key":"bearing.top.1.liner.1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.714213562373095,9],[6.714213562373095,9.75],[7.014213562373095,9.75],[7.014213562373095,9]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta0.socket.above","owner":"bearing.top.1","key":"bearing.top.1.liner.1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,9],[6.537436867076458,9.75],[6.714213562373095,9.75],[6.714213562373095,9]],"s0":48,"s1":49,"name":"bearing.top.1.liner.1.key.theta0.axial.0","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,9],[6.537436867076458,9.75],[6.714213562373095,9.75],[6.714213562373095,9]],"s0":51,"s1":52,"name":"bearing.top.1.liner.1.key.theta0.axial.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,13.414213562373096],[6.537436867076458,13.237436867076458]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta1","owner":"bearing.top.1.integral-liner.1","interface":{"liner":"bearing.top.1.liner.1","face":"theta1","r":[1.75,2],"theta":2.356194490192345,"y":[49,51],"endpoints":[[13.237436867076458,49,6.537436867076458],[13.414213562373096,49,6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.237436867076458,14.25],[6.237436867076458,15],[6.537436867076458,15],[6.537436867076458,14.25]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta1.socket.below","owner":"bearing.top.1","key":"bearing.top.1.liner.1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.714213562373095,14.25],[6.714213562373095,15],[7.014213562373095,15],[7.014213562373095,14.25]],"s0":49,"s1":51,"name":"bearing.top.1.liner.1.key.theta1.socket.above","owner":"bearing.top.1","key":"bearing.top.1.liner.1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,14.25],[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,14.25]],"s0":48,"s1":49,"name":"bearing.top.1.liner.1.key.theta1.axial.0","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[6.537436867076458,14.25],[6.537436867076458,15],[6.714213562373095,15],[6.714213562373095,14.25]],"s0":51,"s1":52,"name":"bearing.top.1.liner.1.key.theta1.axial.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,8.1],[1.2999999999999998,9],[9.3,9],[9.3,8.1]],"s0":48,"s1":52,"name":"bearing.top.1.wall.-1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[5.05,9],[5.05,10.25],[5.55,10.25],[5.55,9]],"s0":51,"s1":52,"name":"bearing.top.1.thrust.-1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,15.9],[9.3,15.9],[9.3,15]],"s0":48,"s1":52,"name":"bearing.top.1.wall.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[5.05,13.75],[5.05,15],[5.55,15],[5.55,13.75]],"s0":51,"s1":52,"name":"bearing.top.1.thrust.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,9],[1.2999999999999998,15],[2.8,15],[2.8,9]],"s0":48,"s1":52,"name":"bearing.top.1.bridge.-1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[7.8,9],[7.8,15],[9.3,15],[9.3,9]],"s0":48,"s1":52,"name":"bearing.top.1.bridge.1","owner":"bearing.top.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,7],[1.2999999999999998,9],[9.3,9],[9.3,7]],"s0":47,"s1":48,"name":"bearing.top.1.cheek.-1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,7],[1.2999999999999998,9],[9.3,9],[9.3,7]],"s0":52,"s1":53,"name":"bearing.top.1.cheek.-1.1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,17],[9.3,17],[9.3,15]],"s0":47,"s1":48,"name":"bearing.top.1.cheek.1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[1.2999999999999998,15],[1.2999999999999998,17],[9.3,17],[9.3,15]],"s0":52,"s1":53,"name":"bearing.top.1.cheek.1.1","owner":"rig.endplates"},{"kind":"annular-sector","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":-51,"s1":-49,"rIn":1.5,"rOut":2,"theta0":-2.356194490192345,"theta1":-0.7853981633974483,"name":"bearing.bottom.-1.liner.-1","owner":"bearing.bottom.-1.integral-liner.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,13.237436867076458],[-6.714213562373095,13.414213562373096],[-6.714213562373095,15],[-6.537436867076458,15]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta0","owner":"bearing.bottom.-1.integral-liner.-1","interface":{"liner":"bearing.bottom.-1.liner.-1","face":"theta0","r":[1.75,2],"theta":-2.356194490192345,"y":[-51,-49],"endpoints":[[13.237436867076458,-51,-6.537436867076458],[13.414213562373096,-51,-6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-7.014213562373095,14.25],[-7.014213562373095,15],[-6.714213562373095,15],[-6.714213562373095,14.25]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta0.socket.below","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.-1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,14.25],[-6.537436867076458,15],[-6.237436867076458,15],[-6.237436867076458,14.25]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta0.socket.above","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.-1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,14.25],[-6.714213562373095,15],[-6.537436867076458,15],[-6.537436867076458,14.25]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.liner.-1.key.theta0.axial.0","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,14.25],[-6.714213562373095,15],[-6.537436867076458,15],[-6.537436867076458,14.25]],"s0":-49,"s1":-48,"name":"bearing.bottom.-1.liner.-1.key.theta0.axial.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,9],[-6.714213562373095,9],[-6.714213562373095,10.585786437626904],[-6.537436867076458,10.762563132923542]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta1","owner":"bearing.bottom.-1.integral-liner.-1","interface":{"liner":"bearing.bottom.-1.liner.-1","face":"theta1","r":[1.75,2],"theta":-0.7853981633974483,"y":[-51,-49],"endpoints":[[10.762563132923542,-51,-6.537436867076458],[10.585786437626904,-51,-6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-7.014213562373095,9],[-7.014213562373095,9.75],[-6.714213562373095,9.75],[-6.714213562373095,9]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta1.socket.below","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.-1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,9],[-6.537436867076458,9.75],[-6.237436867076458,9.75],[-6.237436867076458,9]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.-1.key.theta1.socket.above","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.-1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,9],[-6.714213562373095,9.75],[-6.537436867076458,9.75],[-6.537436867076458,9]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.liner.-1.key.theta1.axial.0","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,9],[-6.714213562373095,9.75],[-6.537436867076458,9.75],[-6.537436867076458,9]],"s0":-49,"s1":-48,"name":"bearing.bottom.-1.liner.-1.key.theta1.axial.1","owner":"bearing.bottom.-1"},{"kind":"annular-sector","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":-51,"s1":-49,"rIn":1.5,"rOut":2,"theta0":0.7853981633974483,"theta1":2.356194490192345,"name":"bearing.bottom.-1.liner.1","owner":"bearing.bottom.-1.integral-liner.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,10.762563132923542],[-3.885786437626905,10.585786437626904],[-3.885786437626905,9],[-4.062563132923541,9]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta0","owner":"bearing.bottom.-1.integral-liner.1","interface":{"liner":"bearing.bottom.-1.liner.1","face":"theta0","r":[1.75,2],"theta":0.7853981633974483,"y":[-51,-49],"endpoints":[[10.762563132923542,-51,-4.062563132923541],[10.585786437626904,-51,-3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.362563132923541,9],[-4.362563132923541,9.75],[-4.062563132923541,9.75],[-4.062563132923541,9]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta0.socket.below","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-3.885786437626905,9],[-3.885786437626905,9.75],[-3.585786437626905,9.75],[-3.585786437626905,9]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta0.socket.above","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,9],[-4.062563132923541,9.75],[-3.885786437626905,9.75],[-3.885786437626905,9]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.liner.1.key.theta0.axial.0","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,9],[-4.062563132923541,9.75],[-3.885786437626905,9.75],[-3.885786437626905,9]],"s0":-49,"s1":-48,"name":"bearing.bottom.-1.liner.1.key.theta0.axial.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,13.414213562373096],[-4.062563132923541,13.237436867076458]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta1","owner":"bearing.bottom.-1.integral-liner.1","interface":{"liner":"bearing.bottom.-1.liner.1","face":"theta1","r":[1.75,2],"theta":2.356194490192345,"y":[-51,-49],"endpoints":[[13.237436867076458,-51,-4.062563132923541],[13.414213562373096,-51,-3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.362563132923541,14.25],[-4.362563132923541,15],[-4.062563132923541,15],[-4.062563132923541,14.25]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta1.socket.below","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-3.885786437626905,14.25],[-3.885786437626905,15],[-3.585786437626905,15],[-3.585786437626905,14.25]],"s0":-51,"s1":-49,"name":"bearing.bottom.-1.liner.1.key.theta1.socket.above","owner":"bearing.bottom.-1","key":"bearing.bottom.-1.liner.1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,14.25],[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,14.25]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.liner.1.key.theta1.axial.0","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,14.25],[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,14.25]],"s0":-49,"s1":-48,"name":"bearing.bottom.-1.liner.1.key.theta1.axial.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,8.1],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,8.1]],"s0":-52,"s1":-48,"name":"bearing.bottom.-1.wall.-1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-5.55,9],[-5.55,10.25],[-5.05,10.25],[-5.05,9]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.thrust.-1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,15.9],[-1.2999999999999998,15.9],[-1.2999999999999998,15]],"s0":-52,"s1":-48,"name":"bearing.bottom.-1.wall.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-5.55,13.75],[-5.55,15],[-5.05,15],[-5.05,13.75]],"s0":-52,"s1":-51,"name":"bearing.bottom.-1.thrust.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,9],[-9.3,15],[-7.8,15],[-7.8,9]],"s0":-52,"s1":-48,"name":"bearing.bottom.-1.bridge.-1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-2.8,9],[-2.8,15],[-1.2999999999999998,15],[-1.2999999999999998,9]],"s0":-52,"s1":-48,"name":"bearing.bottom.-1.bridge.1","owner":"bearing.bottom.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,7],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,7]],"s0":-53,"s1":-52,"name":"bearing.bottom.-1.cheek.-1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,7],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,7]],"s0":-48,"s1":-47,"name":"bearing.bottom.-1.cheek.-1.1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,17],[-1.2999999999999998,17],[-1.2999999999999998,15]],"s0":-53,"s1":-52,"name":"bearing.bottom.-1.cheek.1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,17],[-1.2999999999999998,17],[-1.2999999999999998,15]],"s0":-48,"s1":-47,"name":"bearing.bottom.-1.cheek.1.1","owner":"rig.endplates"},{"kind":"annular-sector","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":49,"s1":51,"rIn":1.5,"rOut":2,"theta0":-2.356194490192345,"theta1":-0.7853981633974483,"name":"bearing.bottom.1.liner.-1","owner":"bearing.bottom.1.integral-liner.-1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,13.237436867076458],[-6.714213562373095,13.414213562373096],[-6.714213562373095,15],[-6.537436867076458,15]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta0","owner":"bearing.bottom.1.integral-liner.-1","interface":{"liner":"bearing.bottom.1.liner.-1","face":"theta0","r":[1.75,2],"theta":-2.356194490192345,"y":[49,51],"endpoints":[[13.237436867076458,49,-6.537436867076458],[13.414213562373096,49,-6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-7.014213562373095,14.25],[-7.014213562373095,15],[-6.714213562373095,15],[-6.714213562373095,14.25]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta0.socket.below","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.-1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,14.25],[-6.537436867076458,15],[-6.237436867076458,15],[-6.237436867076458,14.25]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta0.socket.above","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.-1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,14.25],[-6.714213562373095,15],[-6.537436867076458,15],[-6.537436867076458,14.25]],"s0":48,"s1":49,"name":"bearing.bottom.1.liner.-1.key.theta0.axial.0","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,14.25],[-6.714213562373095,15],[-6.537436867076458,15],[-6.537436867076458,14.25]],"s0":51,"s1":52,"name":"bearing.bottom.1.liner.-1.key.theta0.axial.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,9],[-6.714213562373095,9],[-6.714213562373095,10.585786437626904],[-6.537436867076458,10.762563132923542]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta1","owner":"bearing.bottom.1.integral-liner.-1","interface":{"liner":"bearing.bottom.1.liner.-1","face":"theta1","r":[1.75,2],"theta":-0.7853981633974483,"y":[49,51],"endpoints":[[10.762563132923542,49,-6.537436867076458],[10.585786437626904,49,-6.714213562373095]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-7.014213562373095,9],[-7.014213562373095,9.75],[-6.714213562373095,9.75],[-6.714213562373095,9]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta1.socket.below","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.-1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.537436867076458,9],[-6.537436867076458,9.75],[-6.237436867076458,9.75],[-6.237436867076458,9]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.-1.key.theta1.socket.above","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.-1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,9],[-6.714213562373095,9.75],[-6.537436867076458,9.75],[-6.537436867076458,9]],"s0":48,"s1":49,"name":"bearing.bottom.1.liner.-1.key.theta1.axial.0","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-6.714213562373095,9],[-6.714213562373095,9.75],[-6.537436867076458,9.75],[-6.537436867076458,9]],"s0":51,"s1":52,"name":"bearing.bottom.1.liner.-1.key.theta1.axial.1","owner":"bearing.bottom.1"},{"kind":"annular-sector","F":{"o":[12,0,-5.3],"a":[0,1,0],"u":[-1,0,0],"v":[0,0,1]},"s0":49,"s1":51,"rIn":1.5,"rOut":2,"theta0":0.7853981633974483,"theta1":2.356194490192345,"name":"bearing.bottom.1.liner.1","owner":"bearing.bottom.1.integral-liner.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,10.762563132923542],[-3.885786437626905,10.585786437626904],[-3.885786437626905,9],[-4.062563132923541,9]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta0","owner":"bearing.bottom.1.integral-liner.1","interface":{"liner":"bearing.bottom.1.liner.1","face":"theta0","r":[1.75,2],"theta":0.7853981633974483,"y":[49,51],"endpoints":[[10.762563132923542,49,-4.062563132923541],[10.585786437626904,49,-3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.362563132923541,9],[-4.362563132923541,9.75],[-4.062563132923541,9.75],[-4.062563132923541,9]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta0.socket.below","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.1.key.theta0","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-3.885786437626905,9],[-3.885786437626905,9.75],[-3.585786437626905,9.75],[-3.585786437626905,9]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta0.socket.above","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.1.key.theta0","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,9],[-4.062563132923541,9.75],[-3.885786437626905,9.75],[-3.885786437626905,9]],"s0":48,"s1":49,"name":"bearing.bottom.1.liner.1.key.theta0.axial.0","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,9],[-4.062563132923541,9.75],[-3.885786437626905,9.75],[-3.885786437626905,9]],"s0":51,"s1":52,"name":"bearing.bottom.1.liner.1.key.theta0.axial.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,13.414213562373096],[-4.062563132923541,13.237436867076458]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta1","owner":"bearing.bottom.1.integral-liner.1","interface":{"liner":"bearing.bottom.1.liner.1","face":"theta1","r":[1.75,2],"theta":2.356194490192345,"y":[49,51],"endpoints":[[13.237436867076458,49,-4.062563132923541],[13.414213562373096,49,-3.885786437626905]],"area":0.5,"kind":"integral-shared-radial-face"}},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.362563132923541,14.25],[-4.362563132923541,15],[-4.062563132923541,15],[-4.062563132923541,14.25]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta1.socket.below","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.1.key.theta1","direction":1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-3.885786437626905,14.25],[-3.885786437626905,15],[-3.585786437626905,15],[-3.585786437626905,14.25]],"s0":49,"s1":51,"name":"bearing.bottom.1.liner.1.key.theta1.socket.above","owner":"bearing.bottom.1","key":"bearing.bottom.1.liner.1.key.theta1","direction":-1},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,14.25],[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,14.25]],"s0":48,"s1":49,"name":"bearing.bottom.1.liner.1.key.theta1.axial.0","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-4.062563132923541,14.25],[-4.062563132923541,15],[-3.885786437626905,15],[-3.885786437626905,14.25]],"s0":51,"s1":52,"name":"bearing.bottom.1.liner.1.key.theta1.axial.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,8.1],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,8.1]],"s0":48,"s1":52,"name":"bearing.bottom.1.wall.-1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-5.55,9],[-5.55,10.25],[-5.05,10.25],[-5.05,9]],"s0":51,"s1":52,"name":"bearing.bottom.1.thrust.-1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,15.9],[-1.2999999999999998,15.9],[-1.2999999999999998,15]],"s0":48,"s1":52,"name":"bearing.bottom.1.wall.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-5.55,13.75],[-5.55,15],[-5.05,15],[-5.05,13.75]],"s0":51,"s1":52,"name":"bearing.bottom.1.thrust.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,9],[-9.3,15],[-7.8,15],[-7.8,9]],"s0":48,"s1":52,"name":"bearing.bottom.1.bridge.-1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-2.8,9],[-2.8,15],[-1.2999999999999998,15],[-1.2999999999999998,9]],"s0":48,"s1":52,"name":"bearing.bottom.1.bridge.1","owner":"bearing.bottom.1"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,7],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,7]],"s0":47,"s1":48,"name":"bearing.bottom.1.cheek.-1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,7],[-9.3,9],[-1.2999999999999998,9],[-1.2999999999999998,7]],"s0":52,"s1":53,"name":"bearing.bottom.1.cheek.-1.1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,17],[-1.2999999999999998,17],[-1.2999999999999998,15]],"s0":47,"s1":48,"name":"bearing.bottom.1.cheek.1.-1","owner":"rig.endplates"},{"kind":"prism","F":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"poly":[[-9.3,15],[-9.3,17],[-1.2999999999999998,17],[-1.2999999999999998,15]],"s0":52,"s1":53,"name":"bearing.bottom.1.cheek.1.1","owner":"rig.endplates"}]},"negativeZeroPaths":["/rig/56/F/v/1","/rig/67/F/v/1","/rig/88/F/v/1","/rig/99/F/v/1","/rig/120/F/v/1","/rig/131/F/v/1","/rig/152/F/v/1","/rig/163/F/v/1"],"rigSequence":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,"finger","sheet",56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183],"frames":{"sheet":{"o":[0,0,0],"a":[0,1,0],"u":[0,0,1],"v":[1,0,0]},"finger":{"o":[0,0,0],"a":[0,0,1],"u":[1,0,0],"v":[0,1,0]}},"rigParts":[{"id":"rig.base","label":"Đế cứng của rig (minh họa, không phải vỏ 636)"},{"id":"rig.endplates","label":"Hai tấm đầu có cửa sổ ổ dưới và rãnh dẫn ổ trên"},{"id":"rig.springs","label":"Lò xo lá serpentine liền một dải, tựa nắp tấm đầu và ổ trên (minh họa, không hiệu chuẩn N)"},{"id":"roller.top","label":"Roller trên (bị ép bằng lò xo)"},{"id":"roller.top.shaft","label":"Trục trên xuyên ổ, đầu có vai chặn"},{"id":"roller.bottom","label":"Roller dưới (dẫn động; gear train PENDING)"},{"id":"roller.bottom.shaft","label":"Trục dưới xuyên ổ, đầu có vai chặn"},{"id":"rig.entry-rails","label":"Ray đỡ lối vào dưới hai mép tấm"},{"id":"rig.exit-tray","label":"Ray khay ra (đỡ tấm sau khe; phụ kiện rig)"},{"id":"rig.entry-lip","label":"Môi dẫn trên lối vào (hở trên pod)"},{"id":"rig.exit-lip","label":"Môi trên khe ra tại exitDistance"},{"id":"pick.rail","label":"Ray pick lõi (tham chiếu; gear train PENDING)"},{"id":"pick.finger","label":"Ngón pick theo pick.offset của model"},{"id":"sheet.integral","label":"Một tấm integral instant-sheet-1 (độ dày hữu hạn, nén tại nip)"},{"id":"bearing.top.-1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.top.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.top.-1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.top.1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.top.1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.top.1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.-1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.-1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.1","label":"Native keyed annular bearing (illustrative integral material)"},{"id":"bearing.bottom.1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)"}],"roles":{"frame":["rig.base","rig.endplates","rig.entry-rails","rig.exit-tray","rig.entry-lip","rig.exit-lip"],"spring":["rig.springs"],"roller":["roller.top","roller.bottom"],"shaft":["roller.top.shaft","roller.bottom.shaft"],"bearing-liner":["bearing.top.-1.integral-liner.-1","bearing.top.-1.integral-liner.1","bearing.top.1.integral-liner.-1","bearing.top.1.integral-liner.1","bearing.bottom.-1.integral-liner.-1","bearing.bottom.-1.integral-liner.1","bearing.bottom.1.integral-liner.-1","bearing.bottom.1.integral-liner.1"],"bearing-carrier":["bearing.top.-1","bearing.top.1","bearing.bottom.-1","bearing.bottom.1"],"pick":["pick.rail","pick.finger"],"sheet":["sheet.integral"],"hero-shell":["hero.body.shell","hero.body.front-plate"],"hero-cut":["hero.body.cut-rim"],"hero-door":["hero.door.housing","hero.shade-b.case","hero.shade-b.axle","hero.shade-b.guide-pin","hero.shade-b.stop-collar"],"hero-hinge":["hero.door.hinge","hero.strobe.hinge","hero.pick-pawl.pawl-hinge"],"hero-latch":["hero.door.latch","hero.pick-pawl.pawl"],"hero-objective-barrel":["hero.lens.mounting-plate","hero.lens.barrel","hero.lens.retainer"],"hero-glass":["hero.lens.closeup","hero.lens.photocell-window","hero.viewfinder.glass"],"hero-cone":["hero.cone.wall","hero.cone.flange","hero.cone.catch"],"hero-mirror":["hero.mirror.taking"],"hero-fastener":["hero.mirror.clip","hero.fastener.screws","hero.pick-pawl.moving-pin"],"hero-pack":["hero.pack.shell","hero.pack.platen","hero.pack.battery","hero.filmpath.darkslide"],"hero-film-stack":["hero.pack.stack"],"hero-spring":["hero.pack.platen-spring","hero.camera.spring-contacts","hero.shutter.opening-spring","hero.shutter.inertia-spring","hero.pick-pawl.return-wire","hero.pick-pawl.hold-leaf","hero.pick-pawl.pawl-wire"],"hero-frame":["hero.camera.pack-rails","hero.shutter.retaining-rails","hero.shutter.solenoid-case","hero.filmpath.guides","hero.pick-pawl.fixed-anchor","hero.pick-pawl.hold-guide","hero.pick-pawl.pawl-seats"],"hero-drive":["hero.drive.cover-envelope","hero.drive.motor","hero.drive.gear1","hero.drive.gear2","hero.drive.gear3","hero.drive.gear4","hero.drive.gear5","hero.drive.timing","hero.drive.counter","hero.drive.latch","hero.pick-pawl.chain","hero.pick-pawl.hold-wing"],"hero-viewfinder":["hero.viewfinder.housing"],"hero-strobe":["hero.strobe.housing"],"hero-control":["hero.control.buttons","hero.shutter.solenoid-coil","hero.shutter.s5-case","hero.shutter.s5-actuator"],"hero-lens-housing":["hero.lens.base-block"],"hero-shutter-pin":["hero.shutter.pivot-pin","hero.shutter.guide-pin","hero.shutter.anchor-post","hero.shutter.latch-pivot","hero.shutter.link-pins","hero.shutter.hook-post","hero.shutter.plunger","hero.shutter.plunger-rod","hero.shutter.yoke-pin"],"hero-objective-glass":["hero.lens.element"],"hero-shutter-blade":["hero.shutter.blade-a","hero.shutter.blade-b"],"hero-shutter-beam":["hero.shutter.walking-beam","hero.shutter.inertia","hero.shutter.latch"],"hero-shade":["hero.shade-b.band","hero.shade-b.hub","hero.shade-b.hub-clamp","hero.shade-b.limit-nut","hero.shade-b.clip-carrier","hero.shade-b.hinge-pin","hero.shade-b.hook"]},"parts":[{"id":"rig.base","label":"Đế cứng của rig (minh họa, không phải vỏ 636)","role":"frame"},{"id":"rig.endplates","label":"Hai tấm đầu có cửa sổ ổ dưới và rãnh dẫn ổ trên","role":"frame"},{"id":"rig.springs","label":"Lò xo lá serpentine liền một dải, tựa nắp tấm đầu và ổ trên (minh họa, không hiệu chuẩn N)","role":"spring"},{"id":"roller.top","label":"Roller trên (bị ép bằng lò xo)","role":"roller"},{"id":"roller.top.shaft","label":"Trục trên xuyên ổ, đầu có vai chặn","role":"shaft"},{"id":"roller.bottom","label":"Roller dưới (dẫn động; gear train PENDING)","role":"roller"},{"id":"roller.bottom.shaft","label":"Trục dưới xuyên ổ, đầu có vai chặn","role":"shaft"},{"id":"rig.entry-rails","label":"Ray đỡ lối vào dưới hai mép tấm","role":"frame"},{"id":"rig.exit-tray","label":"Ray khay ra (đỡ tấm sau khe; phụ kiện rig)","role":"frame"},{"id":"rig.entry-lip","label":"Môi dẫn trên lối vào (hở trên pod)","role":"frame"},{"id":"rig.exit-lip","label":"Môi trên khe ra tại exitDistance","role":"frame"},{"id":"pick.rail","label":"Ray pick lõi (tham chiếu; gear train PENDING)","role":"pick"},{"id":"sheet.integral","label":"Một tấm integral instant-sheet-1 (độ dày hữu hạn, nén tại nip)","role":"sheet"},{"id":"bearing.top.-1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.top.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-carrier"},{"id":"bearing.top.-1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.top.1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.top.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-carrier"},{"id":"bearing.top.1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.bottom.-1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.bottom.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-carrier"},{"id":"bearing.bottom.-1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.bottom.1.integral-liner.-1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"bearing.bottom.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-carrier"},{"id":"bearing.bottom.1.integral-liner.1","label":"Native keyed annular bearing (illustrative integral material)","role":"bearing-liner"},{"id":"hero.body.shell","label":"I1 Body (hardbody moulding); outline illustrative","role":"hero-shell"},{"id":"hero.body.cut-rim","label":"cutaway section rim of the removed near body wall; display of a cut, not a part","role":"hero-cut"},{"id":"hero.body.front-plate","label":"I1 front plate/lens panel; I3 lens on front of housing 104","role":"hero-shell"},{"id":"hero.door.housing","label":"I3 door section 106 with exit slot 130; I1 front door","role":"hero-door"},{"id":"hero.door.hinge","label":"I3 pins 108 (door pivots downward); I1 door hinges both sides","role":"hero-hinge"},{"id":"hero.door.latch","label":"I3 latch member (not shown in patent); I1 front door release/latch","role":"hero-latch"},{"id":"hero.lens.mounting-plate","label":"I1 Lens Mounting Plate; drawn see-through as a declared cutaway view (collider unchanged)","role":"hero-objective-barrel"},{"id":"hero.lens.closeup","label":"I1 Close-Up lens (636 CloseUp), parked shuttle, illustrative","role":"hero-glass"},{"id":"hero.lens.photocell-window","label":"I1 photometrics filters on Lens Mounting Plate (window only)","role":"hero-glass"},{"id":"hero.cone.wall","label":"I3 open-bottom light-shielding cone, inclined wall 118; I1 Cone","role":"hero-cone"},{"id":"hero.cone.flange","label":"I3 cone peripheral flange 134 bearing on pack forward wall","role":"hero-cone"},{"id":"hero.cone.catch","label":"I1 Cone held by catches inside the Body","role":"hero-cone"},{"id":"hero.mirror.taking","label":"I1 taking mirror (fixed); I3 inclined mirror 124","role":"hero-mirror"},{"id":"hero.mirror.clip","label":"illustrative mirror retaining clips (I1 mirror cover/light seal exists)","role":"hero-fastener"},{"id":"hero.pack.shell","label":"I3 film container 28: forward wall + exposure aperture 50, slot 52, exit slot 82","role":"hero-pack"},{"id":"hero.pack.stack","label":"I3 film units 32 below the forwardmost unit (count illustrative)","role":"hero-film-stack"},{"id":"hero.pack.platen","label":"I3 spring platen under the stack","role":"hero-pack"},{"id":"hero.pack.platen-spring","label":"I3 platen spring (shape illustrative)","role":"hero-spring"},{"id":"hero.pack.battery","label":"I1 600 pack battery; I3 battery 36 under platen","role":"hero-pack"},{"id":"hero.camera.pack-rails","label":"I3 support rails 138 at bottom of chamber 114","role":"hero-frame"},{"id":"hero.camera.spring-contacts","label":"I3 ramp-like spring contacts 140; I1 pack spring","role":"hero-spring"},{"id":"hero.drive.cover-envelope","label":"I1 Gear Drive Cover exists; side UNKNOWN; gears/motor NOT built here","role":"hero-drive"},{"id":"hero.viewfinder.housing","label":"I1 Viewfinder housing on Cone, eyecup/retainer","role":"hero-viewfinder"},{"id":"hero.viewfinder.glass","label":"I1 viewfinder front window","role":"hero-glass"},{"id":"hero.strobe.housing","label":"I1 swing-up strobe housing (erected), flash window","role":"hero-strobe"},{"id":"hero.strobe.hinge","label":"I1 fold-down strobe hinge (illustrative pin)","role":"hero-hinge"},{"id":"hero.control.buttons","label":"I1 S1 exposure button, door release, lighten/darken tab","role":"hero-control"},{"id":"hero.fastener.screws","label":"illustrative screw heads on the front plate","role":"hero-fastener"},{"id":"hero.lens.base-block","label":"I1 Shutter Base Block on Cone shoulders","role":"hero-lens-housing"},{"id":"hero.shutter.pivot-pin","label":"I1 Fig.33 Base Block pivot point for the walking beam (headed pin illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.guide-pin","label":"I1 Fig.31 molded pin on the Base Block through the blade slots","role":"hero-shutter-pin"},{"id":"hero.shutter.anchor-post","label":"I1 Fig.18 opening spring anchor on the Base Block (post illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.retaining-rails","label":"illustrative axial retention standing in for the Lens Mounting Plate cover (I1 Fig.20)","role":"hero-frame"},{"id":"hero.shutter.solenoid-case","label":"I1 shutter solenoid case and mount (box form illustrative)","role":"hero-frame"},{"id":"hero.shutter.solenoid-coil","label":"I1 shutter solenoid coil (winding envelope; no electrical model)","role":"hero-control"},{"id":"hero.shutter.latch-pivot","label":"I1 Fig.22 latch pivot on the Base Block (pin illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.s5-case","label":"I1 Fig.34 S5 switch body: actuator stop and guide plate (illustrative)","role":"hero-control"},{"id":"hero.lens.barrel","label":"I3 objective lens assembly 120: hollow FACETED barrel (8-quad rings), illustrative; drawn see-through (display only, collider unchanged)","role":"hero-objective-barrel"},{"id":"hero.lens.retainer","label":"illustrative front retaining ring on the element rim (not dimensioned in I1/I3)","role":"hero-objective-barrel"},{"id":"hero.lens.element","label":"I3 objective lens 120: single flat disc, thin-lens power idealized at rear face; prescription UNKNOWN; optically transmitting, material collider","role":"hero-objective-glass"},{"id":"hero.shutter.blade-a","label":"I1 Fig.31 top shutter blade (beam-linked); V-edge aperture outline illustrative","role":"hero-shutter-blade"},{"id":"hero.shutter.blade-b","label":"I1 Fig.31 bottom shutter blade (beam-linked); V-edge aperture outline illustrative","role":"hero-shutter-blade"},{"id":"hero.shutter.walking-beam","label":"I1 Fig.21/32/33 Walking Beam with radial yoke slot (slot illustrative)","role":"hero-shutter-beam"},{"id":"hero.shutter.inertia","label":"I1 Fig.21/33 inertia on the walking beam (block illustrative; its face is the latch tooth)","role":"hero-shutter-beam"},{"id":"hero.shutter.link-pins","label":"I1 Fig.33 blade pins engaged by the walking beam (press-fit in beam, illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.hook-post","label":"I1 Fig.18/38 rack notch on the beam carrying the opening spring end (illustrative post)","role":"hero-shutter-pin"},{"id":"hero.shutter.plunger","label":"I1 Fig.33 Solenoid Plunger Yoke (plate illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.plunger-rod","label":"I1 solenoid plunger (rod illustrative)","role":"hero-shutter-pin"},{"id":"hero.shutter.yoke-pin","label":"I1 Fig.33 yoke pin = fourth pin engaged by the walking beam","role":"hero-shutter-pin"},{"id":"hero.shutter.latch","label":"I1 Fig.22/34 Shutter Latch (shape illustrative)","role":"hero-shutter-beam"},{"id":"hero.shutter.s5-actuator","label":"I1 Fig.34 S5 actuator mated by the latch (shape illustrative)","role":"hero-control"},{"id":"hero.shutter.opening-spring","label":"I1 Fig.18/38 Opening Blade Spring (rate/preload UNKNOWN; end loops not modelled)","role":"hero-spring"},{"id":"hero.shutter.inertia-spring","label":"I1 Fig.21 inertia spring (role/rate/ends UNKNOWN; envelope only)","role":"hero-spring"},{"id":"hero.drive.motor","label":"ILLUSTRATIVE motor can and snapshot-driven rotor","role":"hero-drive"},{"id":"hero.drive.gear1","label":"ILLUSTRATIVE plastic compound 30/10","role":"hero-drive"},{"id":"hero.drive.gear2","label":"ILLUSTRATIVE plastic compound 30/10","role":"hero-drive"},{"id":"hero.drive.gear3","label":"ILLUSTRATIVE plastic compound 30/10","role":"hero-drive"},{"id":"hero.drive.gear4","label":"ILLUSTRATIVE plastic compound 30/10","role":"hero-drive"},{"id":"hero.drive.gear5","label":"ILLUSTRATIVE metal gear 10","role":"hero-drive"},{"id":"hero.drive.timing","label":"ILLUSTRATIVE timing wheel 40 and eccentric cam","role":"hero-drive"},{"id":"hero.drive.counter","label":"ILLUSTRATIVE twelve-detent exposure counter","role":"hero-drive"},{"id":"hero.drive.latch","label":"ILLUSTRATIVE reload/release linkage; shutter law untouched","role":"hero-drive"},{"id":"hero.filmpath.guides","label":"ILLUSTRATIVE pack-to-nip and slot side guides","role":"hero-frame"},{"id":"hero.filmpath.darkslide","label":"ILLUSTRATIVE removed darkslide specimen in declared exploded view","role":"hero-pack"},{"id":"pick.finger","label":"Ngón pick theo pick.offset của model","role":"pick"},{"id":"hero.pick-pawl.chain","label":"one manufactured connected carriage/nose/crossbar/stem/attachment","role":"hero-drive"},{"id":"hero.pick-pawl.return-wire","label":"set A constant-length polyline wire with real eyes","role":"hero-spring"},{"id":"hero.pick-pawl.fixed-anchor","label":"frame-backed pin and boss","role":"hero-frame"},{"id":"hero.pick-pawl.moving-pin","label":"carriage pin and shoulder","role":"hero-fastener"},{"id":"hero.pick-pawl.hold-wing","label":"manufactured pick wings above the sheet carrying the leaf roots","role":"hero-drive"},{"id":"hero.pick-pawl.hold-leaf","label":"four installed cantilevers carried by the pick, tips preloaded DOWN by fixed guides","role":"hero-spring"},{"id":"hero.pick-pawl.hold-guide","label":"fixed upper guide rails hung from the pack roof behind the aperture","role":"hero-frame"},{"id":"hero.pick-pawl.pawl-hinge","label":"arbor, bored fork, axial heads, base roots","role":"hero-hinge"},{"id":"hero.pick-pawl.pawl","label":"bored hub, pack leg and door hook, single manufactured component","role":"hero-latch"},{"id":"hero.pick-pawl.pawl-seats","label":"fixed spring seat and positive pack/door catches","role":"hero-frame"},{"id":"hero.pick-pawl.pawl-wire","label":"torsion body plus two elastic legs solved against rigid seats","role":"hero-spring"},{"id":"hero.shade-b.case","label":"fixed hollow case: rear/top/front walls, side walls with axle bores, feed plate, pin brackets","role":"hero-door"},{"id":"hero.shade-b.axle","label":"fixed axle, faceted 16-gon pressed in side-wall bores (outside band y+-42)","role":"hero-door"},{"id":"hero.shade-b.guide-pin","label":"fixed feed guide pin; band wraps under it; ideal line contact on inscribed facets","role":"hero-door"},{"id":"hero.shade-b.stop-collar","label":"fixed collar on axle: true material-length stop","role":"hero-door"},{"id":"hero.shade-b.band","label":"PET 84x80x0.05 constant material, wound Archimedean spiral + free span + pin wrap + flat run","role":"hero-shade"},{"id":"hero.shade-b.hub","label":"rotating hollow hub tube with root pocket and bored end caps","role":"hero-shade"},{"id":"hero.shade-b.hub-clamp","label":"clamp keeper filling pocket above PET root","role":"hero-shade"},{"id":"hero.shade-b.limit-nut","label":"multi-turn limit nut keyed to hub (key/thread not modeled)","role":"hero-shade"},{"id":"hero.shade-b.clip-carrier","label":"jaws clamping band end + hinge ears","role":"hero-shade"},{"id":"hero.shade-b.hinge-pin","label":"hook hinge pin fixed in ears","role":"hero-shade"},{"id":"hero.shade-b.hook","label":"downturned biased hook; captures film leading face; opens geometrically after stop","role":"hero-shade"}],"hero":{"schema":"instant-hero-composition-v1","shutter":{"transmission":0,"phase":"latched","sigma":1,"s":0,"c":1,"theta":0,"travel":0,"half":0,"area":0,"fraction":0,"open":false,"latched":true,"yoke":17},"shade":{"schema":"instant-i4-shade-spool-b-datum-v1","time":0,"cycle":1,"q":0,"phase":"home-free","clipX":47,"fd":15.523667983352745,"psi":-17.289526599408077,"spoolTurnsFromHome":0,"hookTheta":0,"hookPose":"hanging-zero","clipVelocity":0,"spoolOmega":0,"springTorque":1.6,"rewind":null,"contact":{"film":false,"gap":47,"homeStop":true},"outsideLength":10.714979448738006,"woundLength":69.285020551262,"departure":{"fd":15.523667983352745,"alpha":-1.7658586160553331,"psi":-17.289526599408077,"P":[36.19595639561642,2.1304287830646214],"T":[0.9805868064139845,-0.19608547903101592],"Q":[41.7009696444777,1.0296051202186736],"free":5.613998896225383,"beta":0.1973642967298817,"X":46.99999999999955,"residual":8.881784197001252e-16},"flags":{"RootAdoption":false,"mechanicalAcceptance":false,"materialAccepted":false,"nativeAcceptance":false,"publication":false,"phaseTaskChange":0}},"cutaway":"mặt cắt minh họa: housing and objective near -y halves removed at y=0 except structural shade case; objective semicircle has 16 chord edges; drive cover retains lower lip z=-19","returnSpring":"enclosed in visible hub/case; wire and anchors intentionally hidden","rendererAccepted":false,"continuousCollisionProof":false,"materialStrengthAccepted":false},"runtime":{"fullHero":true,"oneSnapshot":true,"nativeOrderAccepted":false},"source":{"scope":"ILLUSTRATIVE Polaroid-636-style Hero; native renderer/order pending; not factory CAD","representation":"native annular-sector/prism/body material; no convex TURN cloud","snapshotTime":0,"orderAccepted":false,"cutaway":"authored open near-side body; no runtime hiding of native owners"}}},
  createModel: createModel,
  mountRenderer: mountRenderer,
  kit: kit
}, document);
})();
