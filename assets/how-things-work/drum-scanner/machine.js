/* How Things Work · drum-scanner · generated machine bundle (classic script). Do not edit. */
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
var createModel = (function createModel(data) {
  'use strict';
  const world = data.world;
  const W = world.film.width;
  const H = world.film.height;
  const N = W * H;
  const TAU = Math.PI * 2;
  const OMEGA = TAU / world.motion.illustrativePeriodSeconds; // illustrative, not a device speed
  const STAGE_SECONDS = 0.018; // illustrative hand-off time between the five stages of one point
  const REDUCED_STILL = 0.08; // reduced motion: one causal event per 80 ms of visible time
  const START_THETA = 0.3;
  const HOME_X = 0;
  const KEYS = ['light', 'rgb', 'pmt', 'adc', 'write'];
  const FILMS = ['positive', 'negative'];
  const MODES = ['reader', 'explore'];
  // Educational negative: an orange mask (base) times a density term 10^(-D) written as exp(-k·v). This is a
  // log/density illustration, not a calibrated C-41 inversion and not a naive 1 - RGB.
  const BASE = [0.82, 0.48, 0.25];
  const DENSITY = 1.3;
  const ADC_MAX = 4095; // 12 bit per channel, as published for the Howtek 4500 reference
  const R_SURFACE = world.drum.radius + 0.12;
  const CY = world.drum.centre[1];
  const CZ = world.drum.centre[2];
  const PICKUP = world.pickup;

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const phi = (row) => world.film.phiTop + ((row + 0.5) / H) * (world.film.phiBottom - world.film.phiTop);
  const localX = (col) => world.film.x0 + ((col + 0.5) / W) * (world.film.x1 - world.film.x0);
  // Drum angle at which source point `seq` (column-major: one column per turn) faces the pickup.
  const target = (seq) => (Math.floor(seq / H) + 1) * TAU - phi(seq % H);
  const frozen = (list) => Object.freeze(list.slice());

  // Synthetic self-authored 24 x 16 landscape (the same artwork as the approved preview).
  const positive = new Array(N * 4).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const v = y / (H - 1);
      let c = [0.19 + 0.25 * (1 - v), 0.33 + 0.25 * (1 - v), 0.48 + 0.27 * (1 - v)];
      if (Math.hypot((u - 0.28) * 1.4, v - 0.28) < 0.135) c = [0.98, 0.73, 0.39];
      if (v > 0.55 + 0.09 * Math.sin(u * 8)) c = [0.24, 0.41, 0.35];
      if (v > 0.72 + 0.055 * Math.sin(u * 13)) c = [0.13 + 0.1 * u, 0.27 + 0.08 * u, 0.23];
      if (u > 0.68 && u < 0.72 && v > 0.34 && v < 0.75) c = [0.28, 0.22, 0.17];
      if (Math.hypot((u - 0.7) * 1.3, (v - 0.38) * 0.8) < 0.13) c = [0.15, 0.3, 0.23];
      if (u > 0.39 && u < 0.59 && v > 0.61 && v < 0.75) c = [0.78, 0.37, 0.25];
      if (v > 0.53 && v < 0.62 && Math.abs(u - 0.49) < (v - 0.51) * 1.2) c = [0.36, 0.23, 0.2];
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) positive[i + k] = Math.round(c[k] * 255);
      positive[i + 3] = 255;
    }
  }

  // Acquisition (light through the film -> PMT analog level -> 12-bit ADC) and, separately, interpretation.
  function sampleAt(index, kind) {
    if (!Number.isInteger(index) || index < 0 || index >= N) throw new RangeError('Invalid source pixel');
    if (!FILMS.includes(kind)) throw new RangeError('Invalid film');
    const p = [0, 1, 2].map((k) => positive[index * 4 + k]);
    const light = p.map((v, k) => (kind === 'positive' ? v / 255 : BASE[k] * Math.exp((-DENSITY * v) / 255)));
    const adc = light.map((v) => Math.round(v * ADC_MAX));
    const out = adc.map((v, k) => Math.round(clamp(kind === 'positive' ? v / ADC_MAX : -Math.log(Math.max(v / ADC_MAX, 1e-8) / BASE[k]) / DENSITY) * 255));
    return Object.freeze({ positive: frozen(p), light: frozen(light), adc: frozen(adc), out: frozen(out) });
  }

  // What the film itself looks like on the drum (transmitted light), cached once per film type.
  const filmImages = {};
  for (const kind of FILMS) {
    const rgba = new Array(N * 4).fill(255);
    for (let i = 0; i < N; i++) {
      const light = sampleAt(i, kind).light;
      for (let k = 0; k < 3; k++) rgba[i * 4 + k] = Math.round(light[k] * 255);
    }
    filmImages[kind] = Object.freeze(rgba);
  }
  const EMPTY = Object.freeze(new Array(N * 4).fill(0));

  // Carriage pose follows the drum angle: it homes once, holds still while a column's 16 points pass the pickup,
  // then the lead screw moves it to the next column only while the blank part of the drum passes.
  function carriageAt(theta) {
    const first = -localX(0);
    const t0 = target(0);
    if (theta < t0) {
      const t = clamp((theta - START_THETA) / (t0 - 0.1 - START_THETA));
      if (t >= 1) return first;
      return HOME_X + (first - HOME_X) * smooth(t);
    }
    const col = Math.min(W - 1, Math.max(0, Math.floor((theta - TAU + phi(0) + 1e-10) / TAU)));
    if (col === W - 1) return -localX(col);
    const start = (col + 1) * TAU - phi(H - 1) + 0.1;
    const end = (col + 2) * TAU - phi(0) - 0.1;
    const t = clamp((theta - start) / (end - start));
    if (t <= 0) return -localX(col);
    if (t >= 1) return -localX(col + 1);
    return -localX(col) + (localX(col) - localX(col + 1)) * smooth(t);
  }

  let mode = 'reader';
  let film = 'positive';
  let running = false;
  let complete = false;
  let time = 0;
  let theta = START_THETA;
  let carriageX = HOME_X;
  let next = 0;
  let filled = 0;
  let sample = null;
  let stageIndex = 0;
  let budget = 0;
  let still = false; // render policy: Từng bước/reduced motion show the aligned acquisition still of the held point
  let cycle = 0;
  let raw = new Array(N * 4).fill(0);
  let view = new Array(N * 4).fill(0);
  let images = null;
  let captures = Object.freeze([]);
  let cached = null;

  function reset(kind) {
    film = kind;
    running = false;
    complete = false;
    time = 0;
    theta = START_THETA;
    carriageX = HOME_X;
    next = 0;
    filled = 0;
    sample = null;
    stageIndex = 0;
    budget = 0;
    still = false;
    cycle += 1;
    raw = new Array(N * 4).fill(0);
    view = new Array(N * 4).fill(0);
    captures = Object.freeze([]);
    images = Object.freeze({ film: filmImages[film], raw: EMPTY, view: EMPTY, written: 0, cycle });
    cached = null;
  }

  function rotate(h) {
    if (!(h > 0)) return;
    time += h;
    theta += OMEGA * h;
    carriageX = carriageAt(theta);
  }

  // The source point is captured only when it really reaches the pickup: the drum angle is the crossing angle
  // and the carriage pose at that angle must place the point at the pickup's x. Anything else is an error.
  function capture() {
    const seq = next;
    const column = Math.floor(seq / H);
    const row = seq % H;
    const index = row * W + column;
    theta = target(seq);
    carriageX = carriageAt(theta);
    const angle = theta + phi(row);
    const point = [carriageX + localX(column), CY + R_SURFACE * Math.cos(angle), CZ + R_SURFACE * Math.sin(angle)];
    const miss = Math.hypot(point[0] - PICKUP[0], point[1] - (PICKUP[1] + 0.12), point[2] - PICKUP[2]);
    if (miss > 1e-6) throw new Error('Source point is not at the pickup; refusing to capture');
    sample = Object.freeze({ ...sampleAt(index, film), sequence: seq, index, column, row, theta, carriageX, time, world: frozen(point), film });
    stageIndex = 0;
    next = seq + 1;
  }

  function write() {
    const a = sample;
    if (!a || filled !== a.sequence) throw new Error('Duplicate or out-of-order write');
    for (let k = 0; k < 3; k++) {
      raw[a.index * 4 + k] = Math.round((a.adc[k] / ADC_MAX) * 255);
      view[a.index * 4 + k] = a.out[k];
    }
    raw[a.index * 4 + 3] = 255;
    view[a.index * 4 + 3] = 255;
    filled += 1;
    captures = Object.freeze([...captures, a]);
    images = Object.freeze({ film: filmImages[film], raw: frozen(raw), view: frozen(view), written: filled, cycle });
    if (filled === N) {
      running = false;
      complete = true;
    }
  }

  // Delay until the next causal event: the next stage of the held point, or the next point reaching the pickup.
  function nextEvent() {
    if (complete) return null;
    const stage = sample && stageIndex < 4 ? Math.max(0, sample.time + (stageIndex + 1) * STAGE_SECONDS - time) : Infinity;
    const arrive = next < N ? Math.max(0, (target(next) - theta) / OMEGA) : Infinity;
    if (stage === Infinity && arrive === Infinity) return null;
    if (stage !== Infinity && arrive < stage) throw new Error('A point reached the pickup before the previous point was written');
    return stage <= arrive ? { kind: 'stage', delay: stage } : { kind: 'capture', delay: arrive };
  }

  function fire(event) {
    if (event.kind === 'capture') capture();
    else {
      stageIndex += 1;
      if (stageIndex === 4) write();
    }
  }

  // Exactly one event, integrating the canonical interval that leads to it.
  function oneEvent() {
    const event = nextEvent();
    if (!event) return false;
    rotate(event.delay);
    fire(event);
    cached = null;
    return true;
  }

  function point() {
    return sample ? `Điểm (${sample.column}, ${sample.row})` : '';
  }

  function statusText() {
    if (complete) return `Đủ ${N}/${N} điểm. Ảnh đã ghi xong; bấm “Quét lại” để bắt đầu lượt mới.`;
    if (!sample) return running ? 'Trống đang quay đưa điểm đầu tiên tới cửa đọc; chưa lấy mẫu.' : 'Chưa lấy mẫu. Điểm đầu tiên của phim chưa tới cửa đọc.';
    const s = sample;
    if (stageIndex === 0) return `${point()} đã tới cửa đọc: ánh sáng đi qua đúng điểm phim này.`;
    if (stageIndex === 1) return `${point()}: bộ tách chia ánh sáng thành ba kênh R, G, B.`;
    if (stageIndex === 2) return `${point()}: ba PMT cho tín hiệu tương tự ${s.light.map((v) => v.toFixed(3)).join(' / ')} (mức tương đối).`;
    if (stageIndex === 3) return `${point()}: ADC 12 bit lượng hóa thành ${s.adc.join(' / ')}.`;
    const tail = s.row === H - 1 && next < N ? ' Tiếp theo, phần trống ngoài ảnh đi qua cửa đọc và vít me dịch bàn trống sang cột kế tiếp.' : '';
    return `Đã ghi ${point().toLowerCase()} vào ảnh · ${filled}/${N}.${tail}`;
  }

  function command(name, value) {
    if (name === 'mode') {
      if (!MODES.includes(value)) throw new RangeError('Invalid mode');
      if (value !== mode) {
        mode = value;
        running = false;
        budget = 0;
        cached = null;
      }
      return;
    }
    if (name === 'film') {
      if (!FILMS.includes(value)) throw new RangeError('Invalid film');
      reset(value); // explicit, announced: pauses and starts a new cycle without mixing old points
      return;
    }
    if (name === 'pause') {
      running = false;
      budget = 0;
      cached = null;
      return;
    }
    if (name !== 'play' && name !== 'step') throw new RangeError('Invalid scanner command');
    if (mode !== 'explore') return; // the reader never operates the machine
    if (name === 'play') {
      if (running) return;
      if (complete) reset(film); // explicit replay only
      running = true;
      budget = 0;
      cached = null;
      return;
    }
    // step: one causal stage; a completed cycle is kept as it is (no silent reset)
    if (complete) return;
    running = false;
    budget = 0;
    still = true;
    oneEvent();
  }

  function advance(dt, options) {
    if (!running || mode !== 'explore' || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
    const h = Math.min(0.1, dt);
    const reduced = Boolean(options && options.reducedMotion);
    cached = null;
    if (reduced) {
      // Same events as continuous play, shown as stills of each completed event.
      budget += h;
      still = true;
      while (running && budget >= REDUCED_STILL - 1e-12) {
        budget -= REDUCED_STILL;
        if (!oneEvent()) running = false;
      }
      return;
    }
    budget = 0;
    still = false;
    let remaining = h;
    while (running && remaining > 0) {
      const event = nextEvent();
      if (!event) { running = false; break; }
      if (event.delay > remaining) {
        rotate(remaining);
        remaining = 0;
      } else {
        rotate(event.delay);
        remaining -= event.delay;
        fire(event);
      }
    }
  }

  function snapshot() {
    if (cached) return cached;
    const column = sample ? sample.column : 0;
    const row = sample ? sample.row : 0;
    // The integrated drum keeps turning during the 4 x 18 ms stage hand-offs. Stills (Từng bước, reduced motion)
    // show the pose at which the held point was captured; physicalTheta/physicalCarriageX keep the integrated pose.
    const hold = still && sample !== null;
    cached = Object.freeze({
      mode,
      running,
      complete,
      time,
      stageIndex,
      stageKey: KEYS[stageIndex],
      status: statusText(),
      progress: filled / N,
      film,
      theta: hold ? sample.theta : theta,
      carriageX: hold ? sample.carriageX : carriageX,
      pose: hold ? 'acquisition-still' : 'integrated',
      physicalTheta: theta,
      physicalCarriageX: carriageX,
      started: sample !== null,
      pixelIndex: sample ? sample.index : 0,
      column,
      row,
      filled,
      total: N,
      cycle,
      betweenColumns: Boolean(sample) && stageIndex === 4 && Math.abs(carriageX + localX(column)) > 1e-3,
      sample,
      captures,
      images,
    });
    return cached;
  }

  reset('positive');
  return Object.freeze({ command, advance, snapshot, sampleAt: (index, kind) => sampleAt(index, kind || film) });
});
var mountRenderer = (function mountRenderer(root, data, kit) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KEYS = ['light', 'rgb', 'pmt', 'adc', 'write'];
  const doc = root.ownerDocument;
  const scene = root.querySelector('[data-machine-scene]');
  const view = scene ? scene.querySelector('[data-machine-view]') : null;
  if (!view) throw new Error('drum-scanner: scene view missing');
  const part = (id) => view.querySelector('[data-machine-id="' + id + '"]');
  const host = part('hero-rotary-surface');
  const capHost = part('hero-cap-surface');
  const moving = Array.from(view.querySelectorAll('[data-hero-motion="carriage"]'));
  const outputHost = root.querySelector('[data-machine-output]');
  if (!host || !capHost || moving.length === 0) throw new Error('drum-scanner: apparatus parts missing');
  const AXIS = data.screen.axes[0];
  const W = data.world.film.width;
  const H = data.world.film.height;

  // ---------------------------------------------------------------- rotary surface (world projection)
  function mountSurface(config) {
    const TAU = Math.PI * 2;
    const world = config.world;
    const drum = world.drum;
    const film = world.film;
    const cy = drum.centre[1];
    const cz = drum.centre[2];
    const R = drum.radius + 0.12;
    const COLS = film.width;
    const ROWS = film.height;
    const X0 = film.x0;
    const X1 = film.x1;
    const PT = film.phiTop;
    const PB = film.phiBottom;
    const PICKUP = world.pickup;
    const OX = config.screen.origin[0];
    const OY = config.screen.origin[1];
    const AX = config.screen.axes;
    const viewLength = Math.hypot(config.view[0], config.view[1], config.view[2]) || 1;
    const VIEW = config.view.map((c) => c / viewLength);
    const LATERAL = Math.hypot(VIEW[1], VIEW[2]);
    const ALPHA0 = Math.atan2(VIEW[2], VIEW[1]);
    const STRIPS = 64;
    const SAMPLE = 0.02;
    const OVERLAP = 0.05;
    const ID = config.idPrefix;
    const REBATE = { dx: 1.8, dphi: 0.035 };
    const TAPE = [
      { lo: PT - 0.03, hi: PT + 0.075, edge: PT + 0.075 },
      { lo: PB - 0.075, hi: PB + 0.03, edge: PB - 0.075 },
    ];
    const TAPE_X = [X0 - 5, X1 + 5];
    const CAL = { phi: Math.PI, half: 0.075, x0: -84, x1: 84, steps: 10, stepX0: 50, stepX1: 82 };
    const CAP_SIDE = VIEW[0] > 1e-9 ? 1 : VIEW[0] < -1e-9 ? -1 : 0;
    const CAP_X = Number.isFinite(config.capFaceX) ? config.capFaceX : CAP_SIDE > 0 ? drum.s1 : drum.s0;
    const surfaceHost = config.host;
    const capSlot = config.capHost;
    const created = [];

    const round = (n) => Math.round(n * 100) / 100;
    const fix = (n) => Number(n.toFixed(4));
    const wrap = (a) => ((a % TAU) + TAU) % TAU;
    const project = (p) => [
      OX + p[0] * AX[0][0] + p[1] * AX[1][0] + p[2] * AX[2][0],
      OY + p[0] * AX[0][1] + p[1] * AX[1][1] + p[2] * AX[2][1],
    ];
    const surface = (x, phi, theta, radius) => [x, cy + (radius || R) * Math.cos(theta + phi), cz + (radius || R) * Math.sin(theta + phi)];
    const facing = (alpha) => VIEW[1] * Math.cos(alpha) + VIEW[2] * Math.sin(alpha);
    const phiOf = (v) => PT + v * (PB - PT);
    const vOf = (phi) => (PT - phi) / (PT - PB);
    const pointsPath = (points) => 'M' + points.map((p) => round(p[0]) + ' ' + round(p[1])).join('L') + 'Z';

    function visibleSpans(lo, hi, theta) {
      if (LATERAL < 1e-9 || hi <= lo) return [];
      const relative = theta + lo - ALPHA0;
      const base = relative - Math.floor((relative + Math.PI) / TAU) * TAU;
      const width = hi - lo;
      const spans = [];
      for (let turn = 0; turn <= 2; turn++) {
        const start = Math.max(base, turn * TAU - Math.PI / 2);
        const end = Math.min(base + width, turn * TAU + Math.PI / 2);
        if (end > start) spans.push([lo + (start - base), lo + (end - base)]);
      }
      return spans;
    }

    function patchPath(xa, xb, lo, hi, theta, carriage, radius) {
      let d = '';
      for (const [a, b] of visibleSpans(lo, hi, theta)) {
        const n = Math.max(1, Math.ceil((b - a) / SAMPLE));
        const points = [];
        for (let i = 0; i <= n; i++) points.push(project(surface(carriage + xa, a + ((b - a) * i) / n, theta, radius)));
        for (let i = n; i >= 0; i--) points.push(project(surface(carriage + xb, a + ((b - a) * i) / n, theta, radius)));
        d += pointsPath(points);
      }
      return d;
    }

    function make(tag, attrs, parent) {
      const node = doc.createElementNS(NS, tag);
      for (const key in attrs) node.setAttribute(key, String(attrs[key]));
      const into = parent || surfaceHost;
      into.appendChild(node);
      if (into === surfaceHost || into === capSlot) created.push(node);
      return node;
    }

    surfaceHost.setAttribute('data-surface', 'rotary');
    const defs = make('defs', {});
    const texture = make('image', { id: ID + '-tex', x: 0, y: 0, width: COLS, height: ROWS, preserveAspectRatio: 'none', 'image-rendering': 'pixelated' }, defs);
    if (texture.style) texture.style.imageRendering = 'pixelated';

    function gradient(name, shade) {
      const node = make('linearGradient', { id: ID + '-' + name, gradientUnits: 'userSpaceOnUse' }, defs);
      const unit = Math.hypot(AX[0][0], AX[0][1]) || 1;
      const normal = [-AX[0][1] / unit, AX[0][0] / unit];
      const centre = project([0, cy, cz]);
      const samples = [];
      for (let i = 0; i <= 64; i++) {
        const alpha = ALPHA0 - Math.PI / 2 + (Math.PI * i) / 64;
        const p = project([0, cy + R * Math.cos(alpha), cz + R * Math.sin(alpha)]);
        samples.push({ offset: (p[0] - centre[0]) * normal[0] + (p[1] - centre[1]) * normal[1], alpha });
      }
      const reach = Math.max(...samples.map((s) => Math.abs(s.offset))) || 1;
      node.setAttribute('x1', round(centre[0] - normal[0] * reach));
      node.setAttribute('y1', round(centre[1] - normal[1] * reach));
      node.setAttribute('x2', round(centre[0] + normal[0] * reach));
      node.setAttribute('y2', round(centre[1] + normal[1] * reach));
      samples.sort((a, b) => a.offset - b.offset);
      for (const s of samples) {
        const [colour, opacity] = shade(s.alpha);
        make('stop', { offset: fix(Math.min(1, Math.max(0, (s.offset + reach) / (2 * reach)))), 'stop-color': colour, 'stop-opacity': fix(opacity) }, node);
      }
    }
    const LIGHT = (() => {
      const l = [-0.3, 0.45, 0.84];
      const h = [l[0] + VIEW[0], l[1] + VIEW[1], l[2] + VIEW[2]];
      const n = Math.hypot(h[0], h[1], h[2]);
      return h.map((c) => c / n);
    })();
    // Stationary lighting: depends on the absolute angle only, so it stays fixed while the print turns.
    gradient('limb', (alpha) => ['#000', 0.5 * Math.pow(1 - Math.max(0, facing(alpha)) / (LATERAL || 1), 2)]);
    gradient('gloss', (alpha) => ['#fff', 0.2 * Math.pow(Math.max(0, LIGHT[1] * Math.cos(alpha) + LIGHT[2] * Math.sin(alpha)), 36)]);

    const filmLayer = make('g', { class: 'hrs-film' });
    const rebate = make('path', { class: 'hrs-rebate', fill: '#14110f' }, filmLayer);
    const backing = make('path', { class: 'hrs-backing', fill: '#444' }, filmLayer);
    const strips = [];
    for (let k = 0; k < STRIPS; k++) {
      const clip = make('clipPath', { id: ID + '-c' + k, clipPathUnits: 'userSpaceOnUse' }, defs);
      const rect = make('rect', { x: -0.02, y: 0, width: COLS + 0.04, height: 0 }, clip);
      const group = make('g', { 'clip-path': 'url(#' + ID + '-c' + k + ')', display: 'none', 'data-strip': k }, filmLayer);
      make('use', { href: '#' + ID + '-tex' }, group);
      strips.push({ rect, group, shown: false });
    }
    const tapeLayer = make('g', { class: 'hrs-tape' });
    const tapeBody = make('path', { fill: '#efe6c4', 'fill-opacity': 0.42 }, tapeLayer);
    const tapeEdge = make('path', { fill: '#cbbd8d', 'fill-opacity': 0.75 }, tapeLayer);
    const calLayer = make('g', { class: 'hrs-calibration' });
    const calBase = make('path', { fill: '#f3f2ec' }, calLayer);
    const calSteps = [];
    for (let i = 0; i < CAL.steps; i++) {
      const level = Math.round(236 - (i * 214) / (CAL.steps - 1));
      calSteps.push(make('path', { fill: 'rgb(' + level + ',' + level + ',' + level + ')' }, calLayer));
    }
    const calTicks = make('path', { fill: '#25231f' }, calLayer);
    const limb = make('path', { class: 'hrs-limb', fill: 'url(#' + ID + '-limb)', 'pointer-events': 'none' });
    const gloss = make('path', { class: 'hrs-gloss', fill: 'url(#' + ID + '-gloss)', 'pointer-events': 'none' });
    const rimTicks = make('path', { class: 'hrs-rim-ticks', fill: '#0d0e10', 'fill-opacity': 0.85 });
    const capMarks = make('path', { class: 'hrs-cap-marks', fill: '#0b0c0e', 'fill-opacity': 0.9 }, capSlot);
    const capIndex = make('path', { class: 'hrs-cap-index', fill: '#f1efe6' }, capSlot);
    const markerCell = make('path', { class: 'hrs-marker-cell', fill: 'none', stroke: '#fff', 'stroke-width': 0.9, 'stroke-linejoin': 'round', display: 'none' });
    const markerDot = make('circle', { class: 'hrs-marker-dot', r: 1.4, fill: '#fff', stroke: '#111', 'stroke-width': 0.5, display: 'none' });

    let canvas = null;
    let textureSource = null;
    let textureUpdates = 0;
    let filmKind = null;
    let last = null;

    function updateTexture(rgba) {
      if (!canvas) {
        canvas = doc.createElement('canvas');
        canvas.width = COLS;
        canvas.height = ROWS;
      }
      const context = canvas.getContext('2d');
      const pixels = context.createImageData(COLS, ROWS);
      pixels.data.set(rgba);
      context.putImageData(pixels, 0, 0);
      texture.setAttribute('href', canvas.toDataURL('image/png'));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < rgba.length; i += 4) { r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; }
      const n = rgba.length / 4;
      backing.setAttribute('fill', 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')');
      textureUpdates++;
    }

    function render(state) {
      const theta = Number(state.theta);
      const carriage = Number(state.carriageX);
      if (!Number.isFinite(theta) || !Number.isFinite(carriage)) throw new Error('render: theta and carriageX must be finite');
      const rgba = state.filmRgba;
      if (!rgba || rgba.length !== COLS * ROWS * 4) throw new Error('render: filmRgba must hold ' + COLS * ROWS * 4 + ' bytes');
      if (rgba !== textureSource) {
        updateTexture(rgba);
        textureSource = rgba;
      }
      const kind = state.film === 'negative' ? 'negative' : 'positive';
      if (kind !== filmKind) {
        filmKind = kind;
        rebate.setAttribute('fill', kind === 'negative' ? '#c9732f' : '#14110f');
        surfaceHost.setAttribute('data-film', kind);
      }
      surfaceHost.setAttribute('data-theta', String(theta));
      surfaceHost.setAttribute('data-carriage-x', String(carriage));

      let visibleStrips = 0;
      let maxChordErrorPx = 0;
      const stripInfo = [];
      for (let k = 0; k < STRIPS; k++) {
        const strip = strips[k];
        const v0 = k / STRIPS;
        const v1 = (k + 1) / STRIPS;
        const lo = phiOf(v1);
        const hi = phiOf(v0);
        const spans = visibleSpans(lo, hi, theta);
        if (!spans.length) {
          if (strip.shown) { strip.group.setAttribute('display', 'none'); strip.shown = false; }
          continue;
        }
        const [a, b] = spans[0];
        const va = b >= hi - 1e-10 ? v0 : vOf(b);
        const vb = a <= lo + 1e-10 ? v1 : vOf(a);
        const ta = va * ROWS;
        const tb = vb * ROWS;
        if (tb - ta < 1e-7) {
          if (strip.shown) { strip.group.setAttribute('display', 'none'); strip.shown = false; }
          continue;
        }
        const p00 = project(surface(carriage + X0, phiOf(va), theta));
        const p10 = project(surface(carriage + X1, phiOf(va), theta));
        const p01 = project(surface(carriage + X0, phiOf(vb), theta));
        const m = [
          (p10[0] - p00[0]) / COLS,
          (p10[1] - p00[1]) / COLS,
          (p01[0] - p00[0]) / (tb - ta),
          (p01[1] - p00[1]) / (tb - ta),
        ];
        m.push(p00[0] - m[2] * ta, p00[1] - m[3] * ta);
        strip.group.setAttribute('transform', 'matrix(' + m.map(fix).join(' ') + ')');
        const padA = va === v0 && k > 0 ? OVERLAP : 0;
        const padB = vb === v1 && k < STRIPS - 1 ? OVERLAP : 0;
        strip.rect.setAttribute('y', fix(ta - padA));
        strip.rect.setAttribute('height', fix(tb - ta + padA + padB));
        if (!strip.shown) { strip.group.setAttribute('display', 'inline'); strip.shown = true; }
        const mid = project(surface(carriage + X0, phiOf((va + vb) / 2), theta));
        maxChordErrorPx = Math.max(maxChordErrorPx, Math.hypot(mid[0] - (p00[0] + p01[0]) / 2, mid[1] - (p00[1] + p01[1]) / 2));
        visibleStrips++;
        stripInfo.push({ k, va, vb, matrix: m.slice() });
      }
      backing.setAttribute('d', patchPath(X0, X1, PB, PT, theta, carriage));
      const rebateD = patchPath(X0 - REBATE.dx, X1 + REBATE.dx, PB - REBATE.dphi, PT + REBATE.dphi, theta, carriage);
      rebate.setAttribute('d', rebateD);

      // Tape across the leading and trailing film edges, on the same surface (slightly proud of the film).
      let tapeD = '';
      let tapeEdgeD = '';
      for (const t of TAPE) {
        tapeD += patchPath(TAPE_X[0], TAPE_X[1], t.lo, t.hi, theta, carriage, R + 0.08);
        const e0 = t.edge > PT ? t.edge - 0.008 : t.edge;
        tapeEdgeD += patchPath(TAPE_X[0], TAPE_X[1], e0, e0 + 0.008, theta, carriage, R + 0.08);
        for (const xEnd of TAPE_X) {
          const inward = xEnd < 0 ? 0.7 : -0.7;
          tapeEdgeD += patchPath(Math.min(xEnd, xEnd + inward), Math.max(xEnd, xEnd + inward), t.lo, t.hi, theta, carriage, R + 0.08);
        }
      }
      tapeBody.setAttribute('d', tapeD);
      tapeEdge.setAttribute('d', tapeEdgeD);

      // White calibration strip half a turn from the film, with a step wedge and scribe marks (it turns with the drum).
      const calLo = CAL.phi - CAL.half;
      const calHi = CAL.phi + CAL.half;
      const calD = patchPath(CAL.x0, CAL.x1, calLo, calHi, theta, carriage);
      calBase.setAttribute('d', calD);
      const stepWidth = (CAL.stepX1 - CAL.stepX0) / CAL.steps;
      for (let i = 0; i < CAL.steps; i++) {
        const xa = CAL.stepX0 + i * stepWidth;
        calSteps[i].setAttribute('d', patchPath(xa, xa + stepWidth, calLo + 0.018, calHi - 0.018, theta, carriage));
      }
      let tickD = '';
      for (let x = CAL.x0 + 4; x <= CAL.stepX0 - 4; x += 6) {
        const major = Math.round((x - CAL.x0 - 4) / 6) % 5 === 0;
        tickD += patchPath(x - 0.25, x + 0.25, calHi - (major ? 0.07 : 0.04), calHi - 0.008, theta, carriage);
      }
      calTicks.setAttribute('d', tickD);

      const shadeD = rebateD + tapeD + calD;
      limb.setAttribute('d', shadeD);
      gloss.setAttribute('d', shadeD);

      // Rim ticks stay disabled in production: they would sit outside the audited swept bounds.
      let rimD = '';
      for (const [end, dir] of (config.rimMarks === false ? [] : [[drum.s0, 1], [drum.s1, -1]])) {
        for (let i = 0; i < 72; i++) {
          const psi = (i * TAU) / 72;
          const len = i % 6 === 0 ? 5.5 : 3.2;
          const xa = end + dir * 1;
          const xb = end + dir * (1 + len);
          rimD += patchPath(Math.min(xa, xb), Math.max(xa, xb), psi - 0.007, psi + 0.007, theta, carriage);
        }
      }
      rimTicks.setAttribute('d', rimD);

      // Witness marks on the real cap face. The cap slot sits inside the translated cap, so its own translation
      // is cancelled here: the marks are already projected in world coordinates (no double translation).
      let capD = '';
      let indexD = '';
      let capIndexScreen = null;
      capSlot.setAttribute('transform', 'translate(' + -carriage * AX[0][0] + ' ' + -carriage * AX[0][1] + ')');
      if (CAP_SIDE !== 0) {
        const capPoint = (rho, psi) => project([carriage + CAP_X, cy + rho * Math.cos(theta + psi), cz + rho * Math.sin(theta + psi)]);
        for (let i = 0; i < 48; i++) {
          const psi = (i * TAU) / 48;
          const inner = i % 6 === 0 ? 0.6 : 0.72;
          const w = i % 6 === 0 ? 0.012 : 0.008;
          capD += pointsPath([capPoint(drum.radius * inner, psi - w), capPoint(drum.radius * 0.9, psi - w * 0.8), capPoint(drum.radius * 0.9, psi + w * 0.8), capPoint(drum.radius * inner, psi + w)]);
        }
        const centre = (PT + PB) / 2;
        indexD = pointsPath([capPoint(drum.radius * 0.93, centre - 0.045), capPoint(drum.radius * 0.93, centre + 0.045), capPoint(drum.radius * 0.66, centre)]);
        capIndexScreen = capPoint(drum.radius * 0.84, centre);
      }
      capMarks.setAttribute('d', capD);
      capIndex.setAttribute('d', indexD);

      // Held source point: the same projection as the strips, at the cell centre.
      const index = Math.max(0, Math.min(COLS * ROWS - 1, Math.trunc(Number(state.pixelIndex) || 0)));
      const column = index % COLS;
      const row = Math.floor(index / COLS);
      const u = (column + 0.5) / COLS;
      const v = (row + 0.5) / ROWS;
      const localX = X0 + u * (X1 - X0);
      const localPhi = phiOf(v);
      const markerWorld = surface(carriage + localX, localPhi, theta);
      const markerScreen = project(markerWorld);
      const markerFacing = facing(theta + localPhi);
      const markerVisible = Boolean(state.started) && markerFacing > 0;
      const cellW = (X1 - X0) / COLS;
      if (markerVisible) {
        markerCell.setAttribute('d', patchPath(X0 + column * cellW, X0 + (column + 1) * cellW, phiOf((row + 1) / ROWS), phiOf(row / ROWS), theta, carriage, R + 0.1));
        markerDot.setAttribute('cx', round(markerScreen[0]));
        markerDot.setAttribute('cy', round(markerScreen[1]));
      }
      markerCell.setAttribute('display', markerVisible ? 'inline' : 'none');
      markerDot.setAttribute('display', markerVisible ? 'inline' : 'none');

      last = {
        theta,
        thetaWrapped: wrap(theta),
        carriageX: carriage,
        film: kind,
        pixelIndex: index,
        column,
        row,
        marker: {
          world: markerWorld,
          screen: markerScreen,
          facing: markerFacing,
          visible: markerVisible,
          radius: Math.hypot(markerWorld[1] - cy, markerWorld[2] - cz),
          pickupDistance: Math.hypot(markerWorld[0] - PICKUP[0], markerWorld[1] - PICKUP[1], markerWorld[2] - PICKUP[2]),
        },
        strips: { count: STRIPS, visible: visibleStrips, maxChordErrorPx, items: stripInfo },
        calibration: { visible: calD !== '', facing: facing(theta + CAL.phi), screen: project(surface(carriage, CAL.phi, theta)) },
        cap: { x: CAP_SIDE ? carriage + CAP_X : null, indexScreen: capIndexScreen },
        texture: { updates: textureUpdates },
      };
    }

    function dispose() {
      for (const node of created) node.remove();
      created.length = 0;
      capSlot.removeAttribute('transform');
      for (const name of ['data-surface', 'data-film', 'data-theta', 'data-carriage-x']) surfaceHost.removeAttribute(name);
    }

    return { render, dispose, inspect: () => (last ? JSON.parse(JSON.stringify(last)) : null) };
  }

  const surface = mountSurface({
    world: data.world,
    screen: data.screen,
    view: data.view,
    rimMarks: data.rimMarks,
    capFaceX: data.capFaceX,
    idPrefix: data.instanceId + '--rs',
    host,
    capHost,
  });

  // ---------------------------------------------------------------- output panel (console)
  const outputNodes = [];
  const el = (tag, attrs, parent, text) => {
    const node = doc.createElement(tag);
    for (const key in attrs) node.setAttribute(key, String(attrs[key]));
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };
  let canvases = null;
  let trace = null;
  if (outputHost) {
    const panel = el('div', { class: 'ds-output' });
    const grid = el('div', { class: 'ds-images' }, panel);
    const figure = (caption, label) => {
      const box = el('figure', { class: 'ds-sample' }, grid);
      const canvas = el('canvas', { width: W, height: H, role: 'img', 'aria-label': label }, box);
      el('figcaption', {}, box, caption);
      return canvas;
    };
    canvases = {
      film: figure('Phim trải phẳng · ô viền là điểm đang xét', 'Ảnh phim mẫu tổng hợp và vị trí điểm đang đọc'),
      raw: figure('1. Dữ liệu ADC đọc từ phim', 'Các điểm RGB vừa số hóa, chưa diễn giải âm bản'),
      view: figure('2. Ảnh diễn giải để xem', 'Ảnh minh họa sau diễn giải, tạo dần từ các điểm đã ghi'),
    };
    const box = el('div', { class: 'ds-trace' }, panel);
    const head = el('p', { class: 'ds-trace-head' }, box, 'Chưa lấy mẫu');
    const list = el('dl', {}, box);
    const row = (label) => { el('dt', {}, list, label); return el('dd', {}, list, '—'); };
    trace = { head, light: row('Ánh sáng qua phim R / G / B'), pmt: row('Tín hiệu PMT tương đối'), adc: row('ADC 12 bit / kênh'), count: row('Điểm đã ghi') };
    el('p', { class: 'ds-note' }, box, 'Mẫu 24 × 16 để nhìn từng ô, không phải độ phân giải của máy thật. Các con số là dữ liệu minh họa tự tạo, không phải phép đo PMT; diễn giải âm bản ở đây là minh họa mật độ, không phải hiệu chuẩn màu C‑41.');
    outputHost.appendChild(panel);
    outputNodes.push(panel);
  }

  function paint(canvas, rgba, marker) {
    const context = canvas.getContext('2d');
    if (!context) return;
    const pixels = context.createImageData(W, H);
    pixels.data.set(rgba);
    context.putImageData(pixels, 0, 0);
    if (marker !== undefined) {
      const x = marker % W;
      const y = Math.floor(marker / W);
      context.strokeStyle = '#112016';
      context.lineWidth = 0.4;
      context.strokeRect(x + 0.12, y + 0.12, 0.76, 0.76);
      context.strokeStyle = '#fff9ce';
      context.lineWidth = 0.16;
      context.strokeRect(x + 0.12, y + 0.12, 0.76, 0.76);
    }
  }
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  let lastKey = '';
  let lastImages = null;
  let lastSource = '';
  return {
    render(snapshot, options) {
      const focus = options && options.focus ? options.focus : 'all';
      const mode = options && options.mode ? options.mode : snapshot.mode;
      const stage = mode === 'reader' ? KEYS.indexOf(focus) : snapshot.started ? snapshot.stageIndex : -1;
      const key = [snapshot.theta, snapshot.carriageX, snapshot.film, snapshot.pixelIndex, snapshot.started, snapshot.stageIndex, snapshot.filled, snapshot.cycle, stage].join('|');
      if (key === lastKey) return;
      lastKey = key;
      const transform = 'translate(' + AXIS[0] * snapshot.carriageX + ' ' + AXIS[1] * snapshot.carriageX + ')';
      for (const node of moving) node.setAttribute('transform', transform);
      surface.render({ theta: snapshot.theta, carriageX: snapshot.carriageX, film: snapshot.film, filmRgba: snapshot.images.film, pixelIndex: snapshot.pixelIndex, started: snapshot.started });
      view.setAttribute('data-stage', stage >= 0 ? String(stage) : 'none');
      view.setAttribute('data-carriage-x', snapshot.carriageX.toFixed(3));
      if (!canvases) return;
      if (snapshot.images !== lastImages) {
        paint(canvases.raw, snapshot.images.raw);
        paint(canvases.view, snapshot.images.view);
        lastImages = snapshot.images;
        lastSource = '';
      }
      const source = snapshot.cycle + '|' + snapshot.pixelIndex + '|' + snapshot.started;
      if (source !== lastSource) {
        paint(canvases.film, snapshot.images.film, snapshot.started ? snapshot.pixelIndex : undefined);
        lastSource = source;
      }
      const s = snapshot.sample;
      setText(trace.head, s ? 'Điểm đã lấy (' + s.column + ', ' + s.row + ') · ' + (snapshot.film === 'negative' ? 'âm bản màu' : 'dương bản') : 'Chưa lấy mẫu');
      setText(trace.light, s ? s.light.map((v) => v.toFixed(3)).join(' / ') : '—');
      setText(trace.pmt, s && snapshot.stageIndex >= 2 ? s.light.map((v) => v.toFixed(3)).join(' / ') : '—');
      setText(trace.adc, s && snapshot.stageIndex >= 3 ? s.adc.join(' / ') : '—');
      setText(trace.count, snapshot.filled + ' / ' + snapshot.total);
    },
    dispose() {
      surface.dispose();
      for (const node of moving) node.removeAttribute('transform');
      view.removeAttribute('data-stage');
      view.removeAttribute('data-carriage-x');
      for (const node of outputNodes) node.remove();
      outputNodes.length = 0;
      lastKey = '';
      lastImages = null;
    },
    inspect: () => surface.inspect(),
  };
});
runtime.boot({
  slug: "drum-scanner",
  descriptor: {"title":"Máy scan trống PMT","steps":[{"key":"light","title":"Ánh sáng qua điểm phim","explanation":"Trống quay đưa đúng điểm phim tới cửa đọc đứng yên; ánh sáng từ đèn trục đi qua điểm đó. Chỉ lúc điểm thật tới cửa đọc mới lấy mẫu."},{"key":"rgb","title":"Tách RGB","explanation":"Bộ tách và lọc quang học chia ánh sáng của điểm vừa đọc thành ba kênh đỏ, lục, lam."},{"key":"pmt","title":"PMT tạo tín hiệu tương tự","explanation":"Ba ống nhân quang (PMT) biến ánh sáng mỗi kênh thành tín hiệu điện tương tự. Hình chỉ hiện mức tương đối, chưa phải số."},{"key":"adc","title":"ADC 12 bit","explanation":"Bộ chuyển đổi tương tự–số lượng hóa mỗi kênh thành một số từ 0 đến 4095. Đây là dữ liệu đọc thô, chưa diễn giải âm bản."},{"key":"write","title":"Ghi điểm ảnh","explanation":"Ba số được ghi vào đúng ô của điểm vừa đọc. Năm khâu mới ghi một điểm; 384 điểm tạo ảnh mẫu 24 × 16."}],"controls":{"runLabel":"Quét","replayLabel":"Quét lại","filmOptions":[{"value":"positive","label":"Dương bản slide"},{"value":"negative","label":"Âm bản màu C‑41"}]}},
  data: {"world":{"width":980,"height":640,"drum":{"centre":[0,-20,112],"radius":44,"innerRadius":42,"s0":-100,"s1":100},"film":{"x0":-76,"x1":76,"phiTop":1.15,"phiBottom":-1.15,"width":24,"height":16},"motion":{"firstCarriageX":72.83333333333333,"lastCarriageX":-72.83333333333333,"illustrativePeriodSeconds":6},"pickup":[0,24,112],"units":"Illustrative world units, not measured factory internals","reference":"Howtek ScanMaster 4500 User Guide HTM092 Revision D: figures 2-1/2-2, 3-1, chapter 4-8 drive belt, 4-10 leadscrew and drum carriage. Optical/ADC placement is explanatory, not verified factory layout."},"screen":{"origin":[514.9211908181151,401.830567640436],"axes":[[1.2774003317778124,0.3393263329650722],[-0.6230297704528311,0.6957220840273521],[0,-1.191950554364439]]},"view":[0.36764897864848245,0.7537921132756882,0.5446390350150271],"capFaceX":110,"rimMarks":false,"travel":72.83333333333333},
  createModel: createModel,
  mountRenderer: mountRenderer,
  kit: kit
}, document);
})();
