/* How Things Work · slr-film-camera · generated machine bundle (classic script). Do not edit. */
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
  const input = data?.model;
  const keys = ['mirror-up', 'first-curtain', 'expose', 'second-curtain', 'mirror-down', 'wind', 'ready'];
  const scalarKeys = ['width', 'height', 'travelSeconds', 'exposureSeconds', 'displayScale', 'fStop',
    'viewFStop', 'iso', 'irradiance', 'pitch', 'overlap', 'mirrorDegrees', 'leverDegrees', 'takeupRadius', 'reducedCadence'];
  // Narrow bounds for trusted educational build data keep all derived arithmetic finite.
  if (!input || scalarKeys.some((key) => !Number.isFinite(input[key]) || input[key] < 1e-9 || input[key] > 1e6) ||
      !Number.isInteger(input.columns) || input.columns < 1 || input.columns > 256 ||
      !Number.isInteger(input.rows) || input.rows < 1 || input.rows > 256 ||
      !Number.isSafeInteger(input.firstFrame) || input.firstFrame < 1 ||
      !Array.isArray(input.scene) || input.scene.length !== input.columns * input.rows ||
      Array.from(input.scene).some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      !Array.isArray(input.stages) || input.stages.length !== keys.length ||
      input.stages.some((s, i) => s?.key !== keys[i] || !Number.isFinite(s.duration) || s.duration <= 0)) {
    throw new Error('invalid authored K1000 model data');
  }
  const M = Object.fromEntries(scalarKeys.map((key) => [key, input[key]]));
  const cols = input.columns;
  const rows = input.rows;
  const scene = input.scene.slice();
  const stages = input.stages.map((s) => ({ key: s.key, duration: s.duration }));
  const starts = [];
  let total = 0;
  for (const s of stages) { starts.push(total); total += s.duration; }
  // The bars also traverse the illustrative overlap outside the gate. Keep the opening
  // curtain latched throughout mirror-up; its first millimetre of travel is outside the mask.
  const shutterTravel = M.travelSeconds * (1 + M.overlap / M.width) * M.displayScale;
  const dwell = (M.exposureSeconds - M.travelSeconds) * M.displayScale;
  if (M.fStop !== 8 || M.iso !== 100 || M.exposureSeconds !== 1 / 30 ||
      M.width !== 36 || M.height !== 24 ||
      !(M.exposureSeconds > M.travelSeconds) || !(M.viewFStop < M.fStop) ||
      M.mirrorDegrees > 180 || M.overlap >= M.width || M.reducedCadence < 0.1 ||
      !Number.isFinite(total) || total > 1e6 ||
      Math.abs(stages[1].duration - shutterTravel) > 1e-12 ||
      Math.abs(stages[2].duration - dwell) > 1e-12 ||
      Math.abs(stages[3].duration - shutterTravel) > 1e-12 ||
      !Number.isFinite(M.width * M.exposureSeconds * M.displayScale) ||
      !(M.width * M.exposureSeconds * M.displayScale > 0) ||
      !Number.isFinite(M.pitch / M.takeupRadius) ||
      !Number.isFinite(M.irradiance * M.exposureSeconds)) {
    throw new Error('invalid K1000 timing, aperture, overlap or transport profile');
  }
  const L = -M.width / 2;
  const R = M.width / 2;
  const dx = M.width / cols;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fraction = (t, i) => clamp((t - starts[i]) / stages[i].duration);
  const stageAt = (t) => {
    for (let i = keys.length - 1; i >= 0; i--) if (t >= starts[i]) return i;
    return 0;
  };
  // Edges are the actual clear boundaries, rear-view x in mm. First curtain covers x<=first;
  // second covers x>=second. The gate can transmit only (first,second) intersect [L,R].
  function poseAt(t) {
    let first;
    let second;
    if (t < starts[1]) { first = R + M.overlap; second = R; }
    else if (t < starts[2]) { first = R + M.overlap - (M.width + M.overlap) * fraction(t, 1); second = R; }
    else if (t < starts[3]) { first = L; second = R; }
    else if (t < starts[4]) { first = L; second = R - (M.width + M.overlap) * fraction(t, 3); }
    else if (t < starts[5]) { first = L; second = L - M.overlap; }
    else { const w = fraction(t, 5); first = L + (M.width + M.overlap) * w; second = first - M.overlap; }
    const mirror = t < starts[1] ? M.mirrorDegrees * fraction(t, 0) :
      t < starts[4] ? M.mirrorDegrees : M.mirrorDegrees * (1 - fraction(t, 4));
    const aperture = t < starts[1] ? M.viewFStop + (M.fStop - M.viewFStop) * fraction(t, 0) :
      t < starts[4] ? M.fStop : M.fStop + (M.viewFStop - M.fStop) * fraction(t, 4);
    const wind = fraction(t, 5);
    const openFrom = Math.max(L, Math.min(R, first));
    const openTo = Math.max(L, Math.min(R, second));
    const openWidth = Math.max(0, openTo - openFrom);
    return { first, second, mirror, aperture, wind, openFrom, openTo, openWidth,
      lightPathOpen: mirror === M.mirrorDegrees && aperture === M.fStop && openWidth > 0 };
  }
  // Piecewise-linear overlap integral. Split at actual stage and column-edge crossings;
  // trapezoids are exact on every remaining linear piece, including a whole-stage step.
  function integrate(from, to) {
    let changed = false;
    for (let i = 1; i <= 3; i++) {
      const a = Math.max(from, starts[i]);
      const b = Math.min(to, starts[i] + stages[i].duration);
      if (!(b > a)) continue;
      const mid = poseAt((a + b) / 2);
      if (mid.mirror !== M.mirrorDegrees || mid.aperture !== M.fStop) continue;
      // Do not use midpoint open-width as a guard: an interval can start outside the mask
      // and later enter it. The same actual clipped edges below gate every bit of light.
      const pa = poseAt(a);
      const pb = poseAt(b);
      for (let j = 0; j < cols; j++) {
        const left = L + j * dx;
        const right = left + dx;
        const cuts = [0, 1];
        for (const edge of ['first', 'second']) {
          const delta = pb[edge] - pa[edge];
          if (delta === 0) continue;
          for (const x of [left, right]) {
            const u = (x - pa[edge]) / delta;
            if (u > 0 && u < 1) cuts.push(u);
          }
        }
        cuts.sort((x, y) => x - y);
        const widthAt = (u) => Math.max(0, Math.min(right, pa.second + (pb.second - pa.second) * u) -
          Math.max(left, pa.first + (pb.first - pa.first) * u));
        let area = 0;
        for (let k = 1; k < cuts.length; k++) {
          const u = cuts[k - 1];
          const v = cuts[k];
          area += (v - u) * (widthAt(u) + widthAt(v)) / 2;
        }
        const addition = area * (b - a) / (dx * M.displayScale * M.exposureSeconds);
        if (addition > 0) { exposure[j] += addition; changed = true; }
      }
    }
    if (changed) { exposureCache = null; doseCache = null; secondsCache = null; }
  }
  let mode = 'reader';
  let running = false;
  let complete = false;
  let time = 0;
  let cycle = 1;
  let frame = input.firstFrame;
  let exposureFrame = frame;
  let winds = 0;
  let transported = false;
  let held = null;
  let exposure = new Array(cols).fill(0);
  let exposureCache = null;
  let doseCache = null;
  let secondsCache = null;
  let snap = null;
  let cadence = 0; // private real-dt accumulator, never a second physical clock
  const exposureOf = () => exposureCache || (exposureCache = Object.freeze(exposure.slice()));
  const secondsOf = () => secondsCache || (secondsCache = Object.freeze(exposure.map((v) => v * M.exposureSeconds)));
  function doseOf() {
    if (doseCache) return doseCache;
    const out = new Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++) {
      // Scene top-left -> film bottom-right: 180-degree optical inversion, not a processed preview.
      const source = (rows - 1 - r) * cols + (cols - 1 - j);
      out[r * cols + j] = exposure[j] * scene[source] * M.irradiance;
    }
    return (doseCache = Object.freeze(out));
  }
  function moveTo(target) {
    const end = Math.min(total, target);
    if (!(end > time)) return;
    integrate(time, end);
    if (!transported && end >= starts[6]) {
      held = Object.freeze({ frame: exposureFrame, cycle, exposure: exposureOf(), physicalSeconds: secondsOf(), dose: doseOf() });
      frame += 1;
      winds += 1;
      transported = true;
    }
    time = end;
    if (time >= total) { complete = true; running = false; }
    snap = null;
  }
  function newCycle() {
    cycle += 1;
    exposureFrame = frame;
    transported = false;
    exposure = new Array(cols).fill(0);
    exposureCache = null; doseCache = null; secondsCache = null;
    time = 0;
    complete = false;
    cadence = 0;
  }
  function statusOf(i) {
    if (complete) return `Sẵn sàng: khung ${frame} chưa phơi ở cửa; ảnh tiềm ẩn khung ${exposureFrame} được giữ, chưa tráng`;
    const local = time - starts[i];
    if (i === 0) return local === 0 ? 'Đã lên cò, gương hạ, cửa phim đóng; chưa phơi' : 'Đang nâng gương và khép khẩu tới f/8; cửa phim vẫn đóng';
    if (i === 1) return local === 0 ? 'Gương đã lên, khẩu đã tới f/8; rèm đầu ở mép phải' : 'Rèm đầu đi phải sang trái nhìn từ lưng; film nhận sáng theo vùng đã mở';
    if (i === 2) return 'Cửa phim đã mở toàn bộ, gương ở vị trí chụp, khẩu f/8; tích lũy phơi thực đã đi qua';
    if (i === 3) return local === 0 ? 'Hết khoảng mở toàn cửa; rèm thứ hai ở mép phải' : 'Rèm thứ hai đi phải sang trái để kết thúc phơi từng cột';
    if (i === 4) return local === 0 ? 'Rèm thứ hai đã đóng cửa phim; gương bắt đầu hồi' : 'Cửa phim đóng; gương hạ và khẩu mở lại để ngắm';
    if (i === 5) return local === 0 ? 'Gương đã hạ, cửa phim đóng; chờ gạt cần lên phim' : 'Đang lên phim và lên cò; hai rèm hồi trái sang phải có overlap kín';
    return `Đã kéo xong khung ${exposureFrame}; khung ${frame} ở cửa, cần gạt đang trở về nghỉ`;
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
        running = false;
        cadence = 0;
        const i = stageAt(time);
        moveTo(starts[i] + stages[i].duration);
      } else return false;
      snap = null;
      return true;
    },
    advance(dt, options) {
      if (!running || mode !== 'explore' || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
      const bounded = Math.min(dt, 0.1);
      if (options?.reducedMotion === true) {
        cadence += bounded;
        if (cadence < M.reducedCadence) return;
        cadence = 0;
        const i = stageAt(time);
        moveTo(starts[i] + stages[i].duration);
      } else { cadence = 0; moveTo(time + bounded); }
    },
    snapshot() {
      if (snap) return snap;
      const i = complete ? keys.length - 1 : stageAt(time);
      const p = poseAt(time);
      const totalTransport = M.pitch * (winds - Number(transported) + p.wind);
      snap = Object.freeze({ mode, running, complete, time, stageIndex: i, stageKey: keys[i],
        status: statusOf(i), progress: time / total, cycle, frame, exposureFrame, winds, transported, held,
        mirror: p.mirror, aperture: p.aperture,
        curtains: Object.freeze({ first: p.first, second: p.second, overlap: Math.max(0, p.first - p.second) }),
        gate: Object.freeze({ from: p.openFrom, to: p.openTo, width: p.openWidth }),
        lightPathOpen: p.lightPathOpen, wind: p.wind, advance: M.pitch * p.wind, totalTransport,
        takeup: totalTransport / M.takeupRadius * 180 / Math.PI,
        lever: time < starts[6] ? M.leverDegrees * p.wind : M.leverDegrees * (1 - fraction(time, 6)),
        exposure: exposureOf(), physicalSeconds: secondsOf(), dose: doseOf(),
      });
      return snap;
    },
  };
});
var mountRenderer = (function mountRenderer(root, data, kit) {
'use strict';
const createSlrNativeProducer = (function createSlrNativeProducer(__worldText) {
'use strict';
if (__worldText !== "{\n  \"schemaVersion\": 1,\n  \"units\": \"mm-illustrative\",\n  \"disclaimer\": \"Educational K1000-referenced cutaway. All dimensions are illustrative, NOT manufacturer measurements; lens/prism interiors are not factory CAD. Only the 36x24 gate and the model profile come from the authored model.\",\n  \"width\": 960,\n  \"height\": 640,\n  \"camera\": {\n    \"azimuth\": 58,\n    \"elevation\": 12,\n    \"pad\": 40\n  },\n  \"coordinates\": {\n    \"axes\": \"+z up; +y camera front (toward subject); +x photographer-right when viewed from the BACK. Optical axis is x=0,z=0, light travels -y.\",\n    \"curtainX\": \"model curtain/gate x equals world x directly (model edges are rear-view x in mm). First curtain covers x<=first; second covers x>=second.\",\n    \"film\": \"emulsion plane y=0; gate x in [-18,18], z in [-12,12]. filmUV u=(x+18)/36, v=(12-z)/24 (rear view, latent exposure map only).\",\n    \"mirror\": \"model mirror m in [0,90] is RELATIVE. Physical hinge lift = m/90*liftDegrees about +x through mirror.pivot. Rest reflective normal (0,1,1)/sqrt2.\"\n  },\n  \"optics\": {\n    \"focal\": 50,\n    \"principalY\": 50,\n    \"flangeY\": 45.5,\n    \"filmY\": 0,\n    \"mirrorCentre\": [\n      0,\n      26,\n      0\n    ],\n    \"screenZ\": 26,\n    \"gateHalf\": [\n      18,\n      12\n    ],\n    \"irisEdgeHalf\": 0.05,\n    \"irisBladeHalf\": 0.4,\n    \"irisEdgeWidth\": 1.2,\n    \"irisSegments\": 16\n  },\n  \"mirror\": {\n    \"sUpper\": -22,\n    \"sLower\": 12,\n    \"halfWidth\": 19,\n    \"glass\": 1.2,\n    \"carrier\": 1,\n    \"pivot\": [\n      5.5,\n      14.3\n    ],\n    \"liftDegrees\": 45,\n    \"earInner\": 19.4,\n    \"earRootLength\": 2,\n    \"restPadDepth\": 1,\n    \"interfaceNote\": \"ILLUSTRATIVE mm, not factory CAD: carrier terminates at x=\\u00b119.4; outboard bored ears retain the original 2 mm root meeting carrier cap faces. Rest pad and mirror trajectory unchanged. Journal, cage bores, thrust faces and integral peened heads now explicit. Return/actuation remains blocked: existing tension strip is disconnected and differs from source coaxial return spring/roller-link topology.\",\n    \"hinge\": {\n      \"journalRadius\": 0.8,\n      \"boreHalf\": 0.81,\n      \"earOuterDiamond\": 2,\n      \"bossOuterHalf\": 1.8,\n      \"rightThrustGap\": 0.125,\n      \"headRadius\": 1.5,\n      \"headThickness\": 0.5,\n      \"note\": \"ILLUSTRATIVE mm; topology: rod through mirror ears and cage supports (K1000 repair PDF51 Fig100). Square machined bores and integral peened heads are educational ordinary-practice constructions, NOT factory CAD. Clearance-fit contract: nominal 1.62 mm across flats, H9/d9 dimensional limits (1\\u20133 mm band), MMC bore 1.62 and unchanged journal diameter 1.60, nominal flat gap 0.010 mm. Square form is disclosed, not claimed to be a factory circular bearing. Total ear axial endplay 0.125 mm, left thrust face seated. Heads recessed inside original brackets in relief pockets with 0.125 mm radial relief; shoulders x=\\u00b123.9. Dung sai minh h\\u1ecda, kh\\u00f4ng ph\\u1ea3i th\\u00f4ng s\\u1ed1 nh\\u00e0 m\\u00e1y. Not an axis-lock, multi-DOF capture or force certificate.\",\n      \"headPocketClearance\": 0.125,\n      \"nominalFitSize\": 1.62,\n      \"fit\": \"H9/d9 dimensional limits at MMC; square bore across flats, not a factory circular bearing\",\n      \"nominalBoreLimits\": [\n        1.62,\n        1.645\n      ],\n      \"journalDiameterLimits\": [\n        1.575,\n        1.6\n      ],\n      \"thrust\": {\n        \"backX\": -21.375,\n        \"seatX\": -20.875,\n        \"radius\": 1.25,\n        \"pocketHalf\": 1.375,\n        \"note\": \"ILLUSTRATIVE ordinary-practice integral turned collar, not a traced K1000 factory dimension. Shared dyadic backX seats its back on the left boss counterbore floor; shared seatX seats its end on the left ear counterbore floor. The turned shaft is partitioned at backX and seatX into left journal, 0.5 mm-thick collar and inboard/right journal, sharing finite full-disc axial interfaces. Both journals retain radius 0.8. Both counterbores have square half-width 1.375, leaving at least 0.125 mm nominal rim relief. The ear running bore remains half-width 0.81, and the right axial endplay remains 0.125 mm. These opposed axial patches resist axial motion only; they do not certify radial support, tilt capture, friction or a driven mirror.\"\n      }\n    }\n  },\n  \"shutter\": {\n    \"firstY\": 2.7,\n    \"secondY\": 2.1,\n    \"layering\": \"K1000 repair text Fig.176 (PDF 91): the opening (first) cloth runs in FRONT (+y) of the closing (second) cloth over the gate. Depth values are illustrative; only the order is source-grounded.\",\n    \"cloth\": 0.25,\n    \"barWidth\": 2.4,\n    \"barDepth\": 0.5,\n    \"halfHeight\": 14.5,\n    \"rollerRadius\": 3.2,\n    \"firstRollerX\": -27,\n    \"secondRollerX\": 27,\n    \"hardware\": {\n      \"status\": \"ILLUSTRATIVE mm. Four main axis assemblies + guide rollers + bearings/plates. Element order/sides from the K1000 repair text (PDF 89-91 OCR, Fig.173-177); positions, diameters and clearances are NOT source measurements. Only the 0.15 mm pinion endplay is a source number. Retention (illustrative, ordinary practice, not factory CAD): square-bodied bushes fill matching square plate holes and hang on a top flange (bushFlange) seated on the plate top face; each shaft is stepped (journal radius in the bushes, shaftBodyRadius between) so its lower shoulder sits on the lower bush flange; every stack element is seated (gap 0) on the one below, and the whole stack's free endplay is at the TOP under the upper bush (axialGap take-up, pinionEndplay winding). The opening pinion shaft has a larger shank (pinionShank) whose bottom face caps the lower tape end and whose top step (pinionStep) carries the upper tape end. R2a adds three integral shaft keys, open broached hub profiles and a real closing groove/split retainer; these substitute illustrative manufactured profiles for the source pin screws and E-ring, not factory CAD. firstRollerX/secondRollerX above are legacy unused keys; the drawn x positions are openingTakeupX/closingWindingX.\",\n      \"openingTakeupX\": -28,\n      \"closingWindingX\": 28,\n      \"closingTakeup\": [\n        -29.5,\n        13.6\n      ],\n      \"openingWinding\": [\n        28.5,\n        12\n      ],\n      \"plateZ\": [\n        16,\n        17.5\n      ],\n      \"tubeHalf\": 14.6,\n      \"axialGap\": 0.1,\n      \"runningClearance\": 0.05,\n      \"pinionEndplay\": 0.15,\n      \"takeupShaftRadius\": 1,\n      \"pinionShaftRadius\": 0.8,\n      \"bushOuter\": {\n        \"takeup\": 1.8,\n        \"pinion\": 1.5\n      },\n      \"guideRadius\": {\n        \"takeup\": 2.4,\n        \"winding\": 1.8\n      },\n      \"tapeEndRadius\": 1.6,\n      \"spacerOuter\": {\n        \"takeup\": 2,\n        \"small\": 1.6,\n        \"large\": 1.9\n      },\n      \"bushFlange\": {\n        \"height\": 0.3,\n        \"overhang\": 0.5\n      },\n      \"shaftBodyRadius\": {\n        \"takeup\": 1.3,\n        \"pinion\": 1.1\n      },\n      \"guideHeight\": 0.8,\n      \"lowerSpacerHeight\": 0.3,\n      \"largeSpacerHeight\": 0.2,\n      \"tapeEndHeight\": 0.8,\n      \"pinionStep\": 14.7,\n      \"pinionShank\": 1.3,\n      \"frameLeft\": {\n        \"x\": [\n          -33.5,\n          -24.6\n        ],\n        \"y\": [\n          1.7,\n          17.4\n        ]\n      },\n      \"frameRight\": {\n        \"x\": [\n          24.6,\n          31.6\n        ],\n        \"y\": [\n          1.7,\n          14.2\n        ]\n      },\n      \"columnLeft\": {\n        \"x\": [\n          -33.5,\n          -32.3\n        ],\n        \"y\": [\n          1.7,\n          3.2\n        ]\n      },\n      \"columnRight\": {\n        \"x\": [\n          30.6,\n          31.6\n        ],\n        \"y\": [\n          1.7,\n          2.9\n        ]\n      },\n      \"railBracket\": 0.4,\n      \"railLedge\": {\n        \"width\": 1,\n        \"topThickness\": 0.15\n      },\n      \"stakedLip\": {\n        \"rim\": 0.2,\n        \"overhang\": 0.3,\n        \"height\": 0.3\n      },\n      \"columnWeb\": 0.5,\n      \"closureNote\": \"ILLUSTRATIVE closure (ordinary practice, not factory CAD): each upper bush flange is captured by a staked lip of its frame casting (rim stakedLip.rim on the plate top, rolled stakedLip.overhang over the flange; lip bore clears the journal); the right frame column carries a web (columnWeb) so the winding support plate edge sits in a slot of ONE casting; both curtain rails rest on railLedge faces of the rail brackets (top ledge above the cloth edge). Axial retention is relative to the frame castings; frame-to-body screws now clamp the two frame feet to the base plate via declared static ideal tapped bores; gears remain PENDING. R2a integral torque keys and closing groove/split ring are built as disclosed in windingCouplings.\",\n      \"windingCouplings\": {\n        \"note\": \"Illustrative integral keys with finite milled-core flats and real broached open hub keyways. The keyed shaft cross-sections are inscribed octagonal profiles milled flat; journals remain analytic rounds. One manufactured shaft includes its keys through finite shared faces, not owner relabelling. Source pin-screws are not factory-reconstructed. No force, dynamic assembly or factory timing claim.\",\n        \"openingLower\": {\n          \"root\": 0.5,\n          \"outer\": 1.4,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            -15.5,\n            -14.7\n          ]\n        },\n        \"openingUpper\": {\n          \"root\": 0.4,\n          \"outer\": 1.2,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            14.7,\n            15.5\n          ]\n        },\n        \"closing\": {\n          \"root\": 0.5,\n          \"outer\": 1.5,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            -14.6,\n            14.6\n          ]\n        },\n        \"groove\": {\n          \"z\": [\n            15.4,\n            15.6\n          ],\n          \"rootRadius\": 0.8,\n          \"boreFlat\": 0.85,\n          \"note\": \"Actual reduced shaft root between two 1.1 mm radius shoulders. A connected 270-degree split retaining ring is a justified illustrative E-ring equivalent; it lies below the small upper spacer, directly above the upper guide as in PDF90. Both groove cap shoulders trap the ring axially; the narrower throat retains it radially. No spring force, installation deformation or factory CAD claim.\"\n        },\n        \"capture\": {\n          \"note\": \"New illustrative mm, not K1000 factory dimensions: integral lower and upper opening shaft collars clear counterbored spacers. Lower hub has 0.125 mm downward travel relative to seated shaft; upper hub has 0.125 mm upward travel. Existing opposite shaft shoulders stop the other direction. Ground stack pinion endplay 0.15 mm is unchanged. No glued zero-endplay joint or prescribed co-motion proof. Counterbore radial clearance is illustrative 0.06 mm, leaving a real margin above required c=0.05.\",\n          \"openingCollars\": [\n            {\n              \"z\": [\n                -15.7,\n                -15.625\n              ],\n              \"radius\": 1.3,\n              \"spacerBore\": 1.36\n            },\n            {\n              \"z\": [\n                15.625,\n                15.85\n              ],\n              \"radius\": 1.1,\n              \"spacerBore\": 1.16\n            }\n          ],\n          \"contract\": \"KEYED_SLIDING_CAPTURE_PROPOSAL_V1\",\n          \"relativeEndplay\": 0.125\n        }\n      }\n    },\n    \"tapes\": {\n      \"status\": \"UNVALIDATED_R1V2_CANDIDATE\",\n      \"illustrative\": true,\n      \"forceSimulation\": false,\n      \"thickness\": 0.125,\n      \"surfaceClearance\": 0,\n      \"lanes\": {\n        \"first\": [\n          14.75,\n          15\n        ],\n        \"second\": [\n          15.125,\n          15.375\n        ]\n      },\n      \"note\": \"Shared absolute polygon vertices define exact-contact inner wrap faces, preserved in PACK with lossless rings. Fixed octagonal guides on seated stems route tapes behind hinge-bracket corners. Slotted rails retain end supports and real stem guide faces. Skirt bore encloses complete spacer circumcircle plus existing running clearance. Illustrative dimensions; no force or factory timing claim. Each integral anchor remains on the original front face of its own bar, preserving the whole-bar depth ordering and the old optical depth envelope.\",\n      \"anchorFacesY\": {\n        \"first\": 3.1500000000000004,\n        \"second\": 2.5500000000000003\n      }\n    }\n  },\n  \"body\": {\n    \"x\": [\n      -72,\n      72\n    ],\n    \"y\": [\n      -9,\n      45.5\n    ],\n    \"z\": [\n      -36,\n      30\n    ],\n    \"wall\": 2.4\n  },\n  \"transport\": {\n    \"cassette\": [\n      -50,\n      12.6\n    ],\n    \"cassetteRadius\": 12.5,\n    \"takeup\": [\n      56,\n      10.2\n    ],\n    \"spoolRadius\": 10,\n    \"sprocket\": [\n      39,\n      6.2\n    ],\n    \"sprocketRadius\": 6.1,\n    \"pitch\": 38,\n    \"perforationPitch\": 4.75,\n    \"perforationSize\": [\n      2.8,\n      2\n    ],\n    \"perforationZ\": 14.25,\n    \"filmHalfWidth\": 17.5,\n    \"filmThickness\": 0.13,\n    \"status\": \"PENDING: straight cassette->gate->sprocket->takeup strip with real perforation voids at the model totalTransport phase; sprocket tooth engagement, spool wrap and lever-gear coupling NOT proved\"\n  },\n  \"view\": {\n    \"status\": \"Fixed report-only inspection view for ALL poses (no pose-specific zoom/pan). Camera = the 'camera' block above (front-left oblique + top: viewer in front, photographer-right side, 12 deg above: low oblique so gate rays pass UNDER the raised mirror; ray-tested).\",\n    \"section\": {\n      \"note\": \"ACTUAL cut volumes removed from camera-facing OPAQUE housing only. Optical parts (glass, mirror, iris, curtains, gate, film, cells' optical datums) are never cut. makeGeometry(s,{section:false}) gives the uncut REFERENCE body.\",\n      \"sectorParts\": [\n        \"body.front-mount-plate\",\n        \"lens.bayonet\",\n        \"lens.barrel\",\n        \"lens.rear-cell\",\n        \"lens.mid-cell\",\n        \"lens.front-cell\"\n      ],\n      \"sectorQuadrant\": \"sectors whose mid-angle has x>0 and z>0 (camera-facing upper-right quadrant of the barrel/mount ring)\",\n      \"boxCuts\": [\n        {\n          \"parts\": [\n            \"mirror-box.wall-right\"\n          ],\n          \"x\": [\n            22,\n            24.4\n          ],\n          \"y\": [\n            17,\n            43.1\n          ],\n          \"z\": [\n            -14,\n            22\n          ],\n          \"why\": \"window in mirror-box side wall open to its front edge y=43.1 (front post x22..24.4, y40..43.1, z-14..22 = 267.84 mm3 removed: ray-tested occluder of the partial-curtain bars from the fixed camera); rear post (hinge bracket, spring stud), top rail (screen ledge, raised stop) and bottom rail retained\"\n        },\n        {\n          \"parts\": [\n            \"body.deck-right\"\n          ],\n          \"x\": [\n            24.4,\n            46\n          ],\n          \"y\": [\n            -6.6,\n            43.1\n          ],\n          \"z\": [\n            28,\n            30.4\n          ],\n          \"why\": \"near half of the take-up deck; part x>=46 under the wind hub retained on the end wall\"\n        },\n        {\n          \"parts\": [\n            \"body.front-mount-plate\"\n          ],\n          \"x\": [\n            30,\n            46\n          ],\n          \"y\": [\n            43.1,\n            45.5\n          ],\n          \"z\": [\n            -30,\n            28\n          ],\n          \"why\": \"camera-facing front skin right of the mount ring\"\n        }\n      ]\n    },\n    \"material\": {\n      \"transmissive\": \"report-only fill alpha on the 6 declared transmissive parts; physical volumes unchanged\",\n      \"reflective\": \"mirror.glass opaque reflective tone\",\n      \"opaque\": \"all other parts opaque\"\n    }\n  },\n  \"mounts\": [\n    {\n      \"glass\": \"lens.rear-glass\",\n      \"cell\": \"lens.rear-cell\",\n      \"retainer\": \"lens.rear-retainer\",\n      \"openingRadius\": 12,\n      \"glassRadius\": 12.25,\n      \"pocketOuter\": 14,\n      \"y0\": 46.5,\n      \"y1\": 49,\n      \"cellY\": [\n        47.5,\n        48.6\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"lens.mid-glass\",\n      \"cell\": \"lens.mid-cell\",\n      \"retainer\": \"lens.mid-retainer\",\n      \"openingRadius\": 16,\n      \"glassRadius\": 16.25,\n      \"pocketOuter\": 18,\n      \"y0\": 54,\n      \"y1\": 58,\n      \"cellY\": [\n        55,\n        57\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"lens.front-glass\",\n      \"cell\": \"lens.front-cell\",\n      \"retainer\": \"lens.front-retainer\",\n      \"openingRadius\": 22,\n      \"glassRadius\": 22.25,\n      \"pocketOuter\": 24,\n      \"y0\": 82,\n      \"y1\": 86,\n      \"cellY\": [\n        83,\n        85\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"eyepiece.lens\",\n      \"cell\": \"eyepiece.tube\",\n      \"retainer\": \"eyepiece.retainer\",\n      \"openingRadius\": 5.5,\n      \"glassRadius\": 5.75,\n      \"pocketOuter\": 6.5,\n      \"y0\": 3,\n      \"y1\": 5.5,\n      \"cellY\": null,\n      \"z\": 38,\n      \"segments\": 12,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    }\n  ],\n  \"fasteners\": [\n    {\n      \"id\": \"body.fixing-screw-1\",\n      \"family\": \"body\",\n      \"x\": -67,\n      \"y\": -3,\n      \"threadOwner\": \"body.tapped-boss-1\",\n      \"castingSupport\": \"body.end-wall-left\",\n      \"bossX\": [\n        -69.6,\n        -64.4\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-2\",\n      \"family\": \"body\",\n      \"x\": -67,\n      \"y\": 37,\n      \"threadOwner\": \"body.tapped-boss-2\",\n      \"castingSupport\": \"body.end-wall-left\",\n      \"bossX\": [\n        -69.6,\n        -64.4\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-3\",\n      \"family\": \"body\",\n      \"x\": 67,\n      \"y\": -3,\n      \"threadOwner\": \"body.tapped-boss-3\",\n      \"castingSupport\": \"body.end-wall-right\",\n      \"bossX\": [\n        64.4,\n        69.6\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-4\",\n      \"family\": \"body\",\n      \"x\": 67,\n      \"y\": 37,\n      \"threadOwner\": \"body.tapped-boss-4\",\n      \"castingSupport\": \"body.end-wall-right\",\n      \"bossX\": [\n        64.4,\n        69.6\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"shutter.frame-fixing-screw-left\",\n      \"family\": \"shutter\",\n      \"x\": -33,\n      \"y\": 2.5,\n      \"threadOwner\": \"shutter.frame-left\",\n      \"clearanceHalf\": 0.5,\n      \"threadHalf\": 0.375,\n      \"neckRadius\": 0.3125,\n      \"headRadius\": 1.125,\n      \"threadStart\": -32,\n      \"threadTop\": -30,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"shutter.frame-fixing-screw-right\",\n      \"family\": \"shutter\",\n      \"x\": 31.125,\n      \"y\": 2.25,\n      \"threadOwner\": \"shutter.frame-right\",\n      \"clearanceHalf\": 0.5,\n      \"threadHalf\": 0.375,\n      \"neckRadius\": 0.3125,\n      \"headRadius\": 1.125,\n      \"threadStart\": -32,\n      \"threadTop\": -30,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    }\n  ],\n  \"mountsNote\": \"K2a mounted glass / body and shutter-frame fixing only. Optical model, pupil, ray samples and optics tests are unchanged. Pocket clearances are manufactured illustrative clearances, not numerical tolerances or penetration waivers.\"\n}\n") throw new Error('slr producer: WORLD bytes differ');
const __m = Object.create(null);
/* <module machine-model> */
__m["machine-model"] = (function (window) {
'use strict';
// Pentax K1000 educational causal model. Only this plain factory is bundled.
function createModel(data) {
  'use strict';
  const input = data?.model;
  const keys = ['mirror-up', 'first-curtain', 'expose', 'second-curtain', 'mirror-down', 'wind', 'ready'];
  const scalarKeys = ['width', 'height', 'travelSeconds', 'exposureSeconds', 'displayScale', 'fStop',
    'viewFStop', 'iso', 'irradiance', 'pitch', 'overlap', 'mirrorDegrees', 'leverDegrees', 'takeupRadius', 'reducedCadence'];
  // Narrow bounds for trusted educational build data keep all derived arithmetic finite.
  if (!input || scalarKeys.some((key) => !Number.isFinite(input[key]) || input[key] < 1e-9 || input[key] > 1e6) ||
      !Number.isInteger(input.columns) || input.columns < 1 || input.columns > 256 ||
      !Number.isInteger(input.rows) || input.rows < 1 || input.rows > 256 ||
      !Number.isSafeInteger(input.firstFrame) || input.firstFrame < 1 ||
      !Array.isArray(input.scene) || input.scene.length !== input.columns * input.rows ||
      Array.from(input.scene).some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      !Array.isArray(input.stages) || input.stages.length !== keys.length ||
      input.stages.some((s, i) => s?.key !== keys[i] || !Number.isFinite(s.duration) || s.duration <= 0)) {
    throw new Error('invalid authored K1000 model data');
  }
  const M = Object.fromEntries(scalarKeys.map((key) => [key, input[key]]));
  const cols = input.columns;
  const rows = input.rows;
  const scene = input.scene.slice();
  const stages = input.stages.map((s) => ({ key: s.key, duration: s.duration }));
  const starts = [];
  let total = 0;
  for (const s of stages) { starts.push(total); total += s.duration; }
  // The bars also traverse the illustrative overlap outside the gate. Keep the opening
  // curtain latched throughout mirror-up; its first millimetre of travel is outside the mask.
  const shutterTravel = M.travelSeconds * (1 + M.overlap / M.width) * M.displayScale;
  const dwell = (M.exposureSeconds - M.travelSeconds) * M.displayScale;
  if (M.fStop !== 8 || M.iso !== 100 || M.exposureSeconds !== 1 / 30 ||
      M.width !== 36 || M.height !== 24 ||
      !(M.exposureSeconds > M.travelSeconds) || !(M.viewFStop < M.fStop) ||
      M.mirrorDegrees > 180 || M.overlap >= M.width || M.reducedCadence < 0.1 ||
      !Number.isFinite(total) || total > 1e6 ||
      Math.abs(stages[1].duration - shutterTravel) > 1e-12 ||
      Math.abs(stages[2].duration - dwell) > 1e-12 ||
      Math.abs(stages[3].duration - shutterTravel) > 1e-12 ||
      !Number.isFinite(M.width * M.exposureSeconds * M.displayScale) ||
      !(M.width * M.exposureSeconds * M.displayScale > 0) ||
      !Number.isFinite(M.pitch / M.takeupRadius) ||
      !Number.isFinite(M.irradiance * M.exposureSeconds)) {
    throw new Error('invalid K1000 timing, aperture, overlap or transport profile');
  }
  const L = -M.width / 2;
  const R = M.width / 2;
  const dx = M.width / cols;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fraction = (t, i) => clamp((t - starts[i]) / stages[i].duration);
  const stageAt = (t) => {
    for (let i = keys.length - 1; i >= 0; i--) if (t >= starts[i]) return i;
    return 0;
  };
  // Edges are the actual clear boundaries, rear-view x in mm. First curtain covers x<=first;
  // second covers x>=second. The gate can transmit only (first,second) intersect [L,R].
  function poseAt(t) {
    let first;
    let second;
    if (t < starts[1]) { first = R + M.overlap; second = R; }
    else if (t < starts[2]) { first = R + M.overlap - (M.width + M.overlap) * fraction(t, 1); second = R; }
    else if (t < starts[3]) { first = L; second = R; }
    else if (t < starts[4]) { first = L; second = R - (M.width + M.overlap) * fraction(t, 3); }
    else if (t < starts[5]) { first = L; second = L - M.overlap; }
    else { const w = fraction(t, 5); first = L + (M.width + M.overlap) * w; second = first - M.overlap; }
    const mirror = t < starts[1] ? M.mirrorDegrees * fraction(t, 0) :
      t < starts[4] ? M.mirrorDegrees : M.mirrorDegrees * (1 - fraction(t, 4));
    const aperture = t < starts[1] ? M.viewFStop + (M.fStop - M.viewFStop) * fraction(t, 0) :
      t < starts[4] ? M.fStop : M.fStop + (M.viewFStop - M.fStop) * fraction(t, 4);
    const wind = fraction(t, 5);
    const openFrom = Math.max(L, Math.min(R, first));
    const openTo = Math.max(L, Math.min(R, second));
    const openWidth = Math.max(0, openTo - openFrom);
    return { first, second, mirror, aperture, wind, openFrom, openTo, openWidth,
      lightPathOpen: mirror === M.mirrorDegrees && aperture === M.fStop && openWidth > 0 };
  }
  // Piecewise-linear overlap integral. Split at actual stage and column-edge crossings;
  // trapezoids are exact on every remaining linear piece, including a whole-stage step.
  function integrate(from, to) {
    let changed = false;
    for (let i = 1; i <= 3; i++) {
      const a = Math.max(from, starts[i]);
      const b = Math.min(to, starts[i] + stages[i].duration);
      if (!(b > a)) continue;
      const mid = poseAt((a + b) / 2);
      if (mid.mirror !== M.mirrorDegrees || mid.aperture !== M.fStop) continue;
      // Do not use midpoint open-width as a guard: an interval can start outside the mask
      // and later enter it. The same actual clipped edges below gate every bit of light.
      const pa = poseAt(a);
      const pb = poseAt(b);
      for (let j = 0; j < cols; j++) {
        const left = L + j * dx;
        const right = left + dx;
        const cuts = [0, 1];
        for (const edge of ['first', 'second']) {
          const delta = pb[edge] - pa[edge];
          if (delta === 0) continue;
          for (const x of [left, right]) {
            const u = (x - pa[edge]) / delta;
            if (u > 0 && u < 1) cuts.push(u);
          }
        }
        cuts.sort((x, y) => x - y);
        const widthAt = (u) => Math.max(0, Math.min(right, pa.second + (pb.second - pa.second) * u) -
          Math.max(left, pa.first + (pb.first - pa.first) * u));
        let area = 0;
        for (let k = 1; k < cuts.length; k++) {
          const u = cuts[k - 1];
          const v = cuts[k];
          area += (v - u) * (widthAt(u) + widthAt(v)) / 2;
        }
        const addition = area * (b - a) / (dx * M.displayScale * M.exposureSeconds);
        if (addition > 0) { exposure[j] += addition; changed = true; }
      }
    }
    if (changed) { exposureCache = null; doseCache = null; secondsCache = null; }
  }
  let mode = 'reader';
  let running = false;
  let complete = false;
  let time = 0;
  let cycle = 1;
  let frame = input.firstFrame;
  let exposureFrame = frame;
  let winds = 0;
  let transported = false;
  let held = null;
  let exposure = new Array(cols).fill(0);
  let exposureCache = null;
  let doseCache = null;
  let secondsCache = null;
  let snap = null;
  let cadence = 0; // private real-dt accumulator, never a second physical clock
  const exposureOf = () => exposureCache || (exposureCache = Object.freeze(exposure.slice()));
  const secondsOf = () => secondsCache || (secondsCache = Object.freeze(exposure.map((v) => v * M.exposureSeconds)));
  function doseOf() {
    if (doseCache) return doseCache;
    const out = new Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++) {
      // Scene top-left -> film bottom-right: 180-degree optical inversion, not a processed preview.
      const source = (rows - 1 - r) * cols + (cols - 1 - j);
      out[r * cols + j] = exposure[j] * scene[source] * M.irradiance;
    }
    return (doseCache = Object.freeze(out));
  }
  function moveTo(target) {
    const end = Math.min(total, target);
    if (!(end > time)) return;
    integrate(time, end);
    if (!transported && end >= starts[6]) {
      held = Object.freeze({ frame: exposureFrame, cycle, exposure: exposureOf(), physicalSeconds: secondsOf(), dose: doseOf() });
      frame += 1;
      winds += 1;
      transported = true;
    }
    time = end;
    if (time >= total) { complete = true; running = false; }
    snap = null;
  }
  function newCycle() {
    cycle += 1;
    exposureFrame = frame;
    transported = false;
    exposure = new Array(cols).fill(0);
    exposureCache = null; doseCache = null; secondsCache = null;
    time = 0;
    complete = false;
    cadence = 0;
  }
  function statusOf(i) {
    if (complete) return `Sẵn sàng: khung ${frame} chưa phơi ở cửa; ảnh tiềm ẩn khung ${exposureFrame} được giữ, chưa tráng`;
    const local = time - starts[i];
    if (i === 0) return local === 0 ? 'Đã lên cò, gương hạ, cửa phim đóng; chưa phơi' : 'Đang nâng gương và khép khẩu tới f/8; cửa phim vẫn đóng';
    if (i === 1) return local === 0 ? 'Gương đã lên, khẩu đã tới f/8; rèm đầu ở mép phải' : 'Rèm đầu đi phải sang trái nhìn từ lưng; film nhận sáng theo vùng đã mở';
    if (i === 2) return 'Cửa phim đã mở toàn bộ, gương ở vị trí chụp, khẩu f/8; tích lũy phơi thực đã đi qua';
    if (i === 3) return local === 0 ? 'Hết khoảng mở toàn cửa; rèm thứ hai ở mép phải' : 'Rèm thứ hai đi phải sang trái để kết thúc phơi từng cột';
    if (i === 4) return local === 0 ? 'Rèm thứ hai đã đóng cửa phim; gương bắt đầu hồi' : 'Cửa phim đóng; gương hạ và khẩu mở lại để ngắm';
    if (i === 5) return local === 0 ? 'Gương đã hạ, cửa phim đóng; chờ gạt cần lên phim' : 'Đang lên phim và lên cò; hai rèm hồi trái sang phải có overlap kín';
    return `Đã kéo xong khung ${exposureFrame}; khung ${frame} ở cửa, cần gạt đang trở về nghỉ`;
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
        running = false;
        cadence = 0;
        const i = stageAt(time);
        moveTo(starts[i] + stages[i].duration);
      } else return false;
      snap = null;
      return true;
    },
    advance(dt, options) {
      if (!running || mode !== 'explore' || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
      const bounded = Math.min(dt, 0.1);
      if (options?.reducedMotion === true) {
        cadence += bounded;
        if (cadence < M.reducedCadence) return;
        cadence = 0;
        const i = stageAt(time);
        moveTo(starts[i] + stages[i].duration);
      } else { cadence = 0; moveTo(time + bounded); }
    },
    snapshot() {
      if (snap) return snap;
      const i = complete ? keys.length - 1 : stageAt(time);
      const p = poseAt(time);
      const totalTransport = M.pitch * (winds - Number(transported) + p.wind);
      snap = Object.freeze({ mode, running, complete, time, stageIndex: i, stageKey: keys[i],
        status: statusOf(i), progress: time / total, cycle, frame, exposureFrame, winds, transported, held,
        mirror: p.mirror, aperture: p.aperture,
        curtains: Object.freeze({ first: p.first, second: p.second, overlap: Math.max(0, p.first - p.second) }),
        gate: Object.freeze({ from: p.openFrom, to: p.openTo, width: p.openWidth }),
        lightPathOpen: p.lightPathOpen, wind: p.wind, advance: M.pitch * p.wind, totalTransport,
        takeup: totalTransport / M.takeupRadius * 180 / Math.PI,
        lever: time < starts[6] ? M.leverDegrees * p.wind : M.leverDegrees * (1 - fraction(time, 6)),
        exposure: exposureOf(), physicalSeconds: secondsOf(), dose: doseOf(),
      });
      return snap;
    },
  };
}

// Authored data, outside the runtime factory. All motion timing/pose dimensions except the film gate
// are illustrative; X sync 1/60 s is NOT used to infer a curtain transit time.
function modelData() {
  const travelSeconds = 0.015;
  const exposureSeconds = 1 / 30;
  const displayScale = 100;
  const width = 36;
  const overlap = 1;
  const curtainTravel = travelSeconds * (1 + overlap / width) * displayScale;
  const columns = 32;
  const rows = 20;
  const scene = Array.from({ length: columns * rows }, (_, i) => {
    const r = Math.floor(i / columns);
    const c = i % columns;
    // Self-authored asymmetric chart: gradient, dark tower, bright upper-right patch.
    if (c >= 5 && c <= 7 && r >= 6) return 0.08;
    if (c >= 24 && c <= 28 && r >= 2 && r <= 4) return 1;
    return (15 + 2 * c + r) / 100;
  });
  return {
    width, height: 24, columns, rows, scene,
    travelSeconds, exposureSeconds, displayScale, fStop: 8, viewFStop: 4, iso: 100,
    irradiance: 1, pitch: 38, overlap, mirrorDegrees: 90, leverDegrees: 160,
    takeupRadius: 10, firstFrame: 1, reducedCadence: 0.35,
    reducedPolicy: 'hold-entire-achieved-snapshot; commit-remaining-current-stage at bounded real-dt cadence; no catch-up',
    stages: [
      { key: 'mirror-up', duration: 0.8 },
      { key: 'first-curtain', duration: curtainTravel },
      { key: 'expose', duration: (exposureSeconds - travelSeconds) * displayScale },
      { key: 'second-curtain', duration: curtainTravel },
      { key: 'mirror-down', duration: 0.65 },
      { key: 'wind', duration: 2.4 },
      { key: 'ready', duration: 0.5 },
    ],
  };
}

return { "createModel": createModel, "modelData": modelData };
})(void 0);
/* </module machine-model> */
/* <module iso-kit> */
__m["iso-kit"] = (function (window) {
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

return { "AZIMUTH": AZIMUTH, "ELEVATION": ELEVATION, "ISO_CSS": ISO_CSS, "SHADES": SHADES, "axisVector": axisVector, "boxCorners": boxCorners, "cameraOf": cameraOf, "circleRing": circleRing, "coil": coil, "corners": corners, "cylinder": cylinder, "depthOf": depthOf, "dotGrid": dotGrid, "dotsSvg": dotsSvg, "extrude": extrude, "faceTextSvg": faceTextSvg, "fadeLineSvg": fadeLineSvg, "fadedSvg": fadedSvg, "figureSvg": figureSvg, "fitProjection": fitProjection, "groupSvg": groupSvg, "haloOf": haloOf, "holdStill": holdStill, "insetPlan": insetPlan, "iso": iso, "joinPaths": joinPaths, "knurl": knurl, "lineOnTop": lineOnTop, "lineSvg": lineSvg, "onTop": onTop, "pageHtml": pageHtml, "pathOf": pathOf, "planOutline": planOutline, "plateHtml": plateHtml, "pointsAt": pointsAt, "radialTicks": radialTicks, "ring": ring, "ringOf": ringOf, "ringSeam": ringSeam, "rise": rise, "roundedPlan": roundedPlan, "screenRise": screenRise, "segment": segment, "sideArc": sideArc, "sideMatrix": sideMatrix, "sideRing": sideRing, "sideSeam": sideSeam, "sideTicks": sideTicks, "slabOf": slabOf, "solidSvg": solidSvg, "topMatrix": topMatrix, "topTicks": topTicks, "towardViewer": towardViewer, "translateAlong": translateAlong, "wireSvg": wireSvg };
})(void 0);
/* </module iso-kit> */
/* <module annular-sector> */
__m["annular-sector"] = (function (window) {
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

return { "FACE_IDS": FACE_IDS, "annularSector": annularSector, "bounds": bounds, "contains": contains, "faceAreas": faceAreas, "journalContact": journalContact, "painterOrder": painterOrder, "point": point, "radial": radial, "raycast": raycast, "signedDistance": signedDistance, "surfaceAt": surfaceAt, "surfaceMesh": surfaceMesh, "surfaceSamples": surfaceSamples, "uniformPressureForUnitZ": uniformPressureForUnitZ, "validateFrame": validateFrame, "validateSector": validateSector, "validateSurfaceMesh": validateSurfaceMesh, "verifyContactNormal": verifyContactNormal };
})(void 0);
/* </module annular-sector> */
/* <module lathe> */
__m["lathe"] = (function (window) {
'use strict';
const Annular = __m["annular-sector"];
const { cameraOf, iso, pathOf } = __m["iso-kit"];

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

return { "add3": add3, "angleToward": angleToward, "annularSector": annularSector, "arcOf": arcOf, "arcPoints": arcPoints, "bandOf": bandOf, "bandOfProfile": bandOfProfile, "bandsOf": bandsOf, "circleOf": circleOf, "cross3": cross3, "curveRuns": curveRuns, "cut": cut, "disc": disc, "dot3": dot3, "dotsOf": dotsOf, "facingOf": facingOf, "fadeOf": fadeOf, "fillet": fillet, "frameAlong": frameAlong, "frameOf": frameOf, "hullOf": hullOf, "lathe": lathe, "len3": len3, "lerp3": lerp3, "lightOf": lightOf, "mul3": mul3, "outlineOf": outlineOf, "pathLength": pathLength, "pointAlong": pointAlong, "pointOf": pointOf, "prismOf": prismOf, "profileCurve": profileCurve, "radialOf": radialOf, "resample": resample, "ribsOf": ribsOf, "ringBand": ringBand, "rodOut": rodOut, "runsOf": runsOf, "saddleOf": saddleOf, "saddleStart": saddleStart, "scaleOf": scaleOf, "silhouetteOf": silhouetteOf, "silhouettePoints": silhouettePoints, "softOf": softOf, "solidOf": solidOf, "sphereOf": sphereOf, "spiral": spiral, "spokesOf": spokesOf, "stadium": stadium, "stepsFor": stepsFor, "sub3": sub3, "tangentAlong": tangentAlong, "tangentOf": tangentOf, "toneOf": toneOf, "unit3": unit3, "viewOf": viewOf };
})(void 0);
/* </module lathe> */
/* <module tube> */
__m["tube"] = (function (window) {
'use strict';
const { iso, pathOf } = __m["iso-kit"];
const G = __m["lathe"];

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

return { "crossingsOf": crossingsOf, "ringsSvg": ringsSvg, "runsOf": runsOf, "tubePieces": tubePieces, "tubeSvg": tubeSvg };
})(void 0);
/* </module tube> */
/* <module audit> */
__m["audit"] = (function (window) {
'use strict';
const Annular = __m["annular-sector"];
const annularSector = (contract, meta = {}) => {
  const shape = Annular.annularSector(contract);
  for (const key of Object.keys(meta)) if (key in shape || key === "cut") throw Error("geometry override forbidden");
  return { ...shape, ...meta };
};
const { cameraOf, roundedPlan } = __m["iso-kit"];
const { add3, sub3, mul3, dot3, len3, unit3, pathLength, resample, curveRuns, cut: cutAlong, tangentAlong } = __m["lathe"];
const { runsOf } = __m["tube"];

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


return { "annularSector": annularSector, "audit": audit, "ball": ball, "body": body, "boundsOf": boundsOf, "box": box, "cameraBasis": cameraBasis, "clearances": clearances, "coverage": coverage, "crowding": crowding, "cylinder": cylinder, "depthOrder": depthOrder, "disc": disc, "explodeStates": explodeStates, "extruded": extruded, "failures": failures, "folds": folds, "footprintOf": footprintOf, "grounded": grounded, "keyAt": keyAt, "labelOf": labelOf, "lathe": lathe, "linksOf": linksOf, "looseEnds": looseEnds, "markupBox": markupBox, "mountsOf": mountsOf, "moved": moved, "offsetOf": offsetOf, "orderKeys": orderKeys, "orientedBox": orientedBox, "overlapsOf": overlapsOf, "prefixStates": prefixStates, "prism": prism, "recorder": recorder, "report": report, "reversalsOf": reversalsOf, "ring": ring, "sameRun": sameRun, "sdf": sdf, "seats": seats, "selfOverlaps": selfOverlaps, "settle": settle, "shareOf": shareOf, "slab": slab, "slenderOf": slenderOf, "slide": slide, "solid": solid, "solidClearances": solidClearances, "springStates": springStates, "supports": supports, "terminals": terminals, "traced": traced, "tube": tube, "uniformStates": uniformStates, "wobble": wobble };
})(void 0);
/* </module audit> */
/* <module turn> */
__m["turn"] = (function (window) {
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
})(void 0);
/* </module turn> */
/* <module turn-build> */
__m["turn-build"] = (function (window) {
'use strict';
const { TURN, TURN_CSS } = __m["turn"];
const k = __m["iso-kit"];
const G = __m["lathe"];
const A = __m["audit"];

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


return { "gjk": gjk, "pack": pack, "roundedPolygon": roundedPolygon, "sampleShape": sampleShape, "separate": separate, "turning": turning };
})(void 0);
/* </module turn-build> */
/* <module mirror-return-lift> */
__m["mirror-return-lift"] = (function (window) {
'use strict';
// PDF51 topology, illustrative dimensions: coaxial return spring and roller/link drive.
// A planar open-coil torsion flexure is shown, NOT round wire, a force law or factory CAD.
const RETURN_LIFT = Object.freeze({ arm: 5, link: 8, roller: 0.5, min: 0, max: 45 });
const rad = Math.PI / 180;
function returnLiftPose(lift, pivot) {
  if (!Number.isFinite(lift) || lift < 0 || lift > 45) throw new RangeError('return/lift feasible branch is 0..45 degrees');
  const c = Math.cos(lift * rad), s = Math.sin(lift * rad);
  // The parallelogram has two fixed pivots separated by exactly 8 mm and two 5 mm arms.
  // Its link translates; neither length nor roller spacing changes with mirror phase.
  const inputPivot = [pivot[0], pivot[1] - 8];
  const input = [inputPivot[0] + 5 * c, ((inputPivot[1] + 8) + 5 * s) - 8];
  // Build the input from the lever pivot using the shared 8 mm assembly datum.
  // Associating the common datum before the rotation avoids independently rounded endpoints.
  // Forward construction starts at the LEVER pivot, not a copied mirror endpoint.
  const output = [input[0], input[1] + 8];
  return { lift, c, s, output, input, inputPivot, springDeflection: (12 + lift) * rad,
    springLaw: 'illustrative angular deflection only; no stiffness, force, material or fatigue inference' };
}
// Independent forward assembly from the INPUT roller: intersection of mirror-arm and link circles.
// It does not read a mirror pose. The positive-y branch is locked away from the toggle.
function forwardMirrorRoller(input, pivot, arm = 5, link = 8) {
  if (![...input, ...pivot, arm, link].every(Number.isFinite) || arm <= 0 || link <= 0) throw new RangeError('nonfinite/invalid linkage');
  const d = [input[0] - pivot[0], input[1] - pivot[1]], L = Math.hypot(...d);
  if (!(L > Math.abs(link - arm) && L < link + arm)) throw new RangeError('singular or infeasible circle closure');
  const a = (arm * arm - link * link + L * L) / (2 * L), h2 = arm * arm - a * a;
  if (!(h2 > 0)) throw new RangeError('linkage toggle');
  const h = Math.sqrt(h2), u = d.map(x => x / L);
  const candidates = [-1, 1].map(k => [pivot[0] + a * u[0] - k * h * u[1], pivot[1] + a * u[1] + k * h * u[0]]);
  const branch = candidates.sort((a,b) => b[0] - a[0])[0];
  if (!(branch[0] > pivot[0])) throw new RangeError('wrong assembly branch');
  return branch;
}

function makeReturnLift({ lift, pivot, movingFrame, frameOf, m, add, group }) {
  const q = returnLiftPose(lift, pivot), [y, z] = pivot;
  const fixed = frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const at = p => frameOf([0, ...p], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  let translator = null;
  const prism = (F, polygon, s0, s1) => add('prism', { F, polygon, s0, s1, group: translator, ringPrecision: 'lossless', tone: 'mid' });
  const rect = (F, a, b, c, d, x0, x1) => prism(F, [[a,c],[b,c],[b,d],[a,d]], x0, x1);
  const cylinder = (F, s0, s1, r) => add('round', { F, s0, s1, r, group: translator, tone: 'hi' });
  const part = (id, label, support, motion, fn) => m(id, label, 'mirror', support, motion, fn,
    'PDF51 topology only; illustrative dimensions. Exact material checks, not owner labels, establish engagement.');

  part('mirror.return-spring', 'Lò xo xoắn dải đồng trục; hai đầu có tai kẹp', 'mirror.return-fixed-hook', 'elastic-per-snapshot', () => {
    // Shared vertices connect every finite band sector. The aperture is never filled.
    const end = 2 * Math.PI + lift * rad, count = 28;
    const dirs = Array.from({ length: count + 1 }, (_, i) => {
      if (i === 0) return [-1, 0];
      if (i === count) return [q.c, q.s];
      const a = Math.PI + (end - Math.PI) * i / count;
      return [Math.cos(a), Math.sin(a)];
    });
    const inner = dirs.map(d => d.map(v => v * 1.75)), outer = dirs.map(d => d.map(v => v * 2));
    for (let i = 0; i < count; i++) prism(fixed, [inner[i], outer[i], outer[i+1], inner[i+1]], 18, 18.125);
    // Stepped terminal laminations share positive-area axial faces with the band; no overlapping skins.
    rect(fixed, -2, -1.75, -0.125, 0.75, 18.125, 18.25);
    rect(movingFrame, 1.75, 2, -0.125, 0.75, 18.125, 18.25);
  });
  part('mirror.return-fixed-hook', 'Kẹp móc cố định giữ tai dải lò xo', 'mirror-box.hinge-bracket-right', 'fixed', () => {
    // Mount behind/below the ear sweep, terminating on the existing drilled bracket x=22.
    rect(fixed, -2, -1.5, -2.1, -1.9, 18.5, 22);
    rect(fixed, -2.0625, -1.625, -2.1, 0.875, 18.25, 18.5);
    rect(fixed, -2.0625, -1.625, 0.125, 0.875, 18, 18.125);
    rect(fixed, -2.0625, -2, 0.25, 0.75, 18.125, 18.25);
    rect(fixed, -1.75, -1.625, 0.25, 0.75, 18.125, 18.25);
    rect(fixed, -2.0625, -1.625, 0.75, 0.875, 18.125, 18.25);
  });
  part('mirror.return-moving-hook', 'Kẹp móc quay gắn thật vào tai gương', 'mirror.ears', 'hinge:+x', () => {
    rect(movingFrame, 1.25, 2, 0.25, 0.875, 18.25, 19.4);
    rect(movingFrame, 1.625, 2.125, 0.125, 0.875, 18, 18.125);
    rect(movingFrame, 2, 2.125, 0.25, 0.75, 18.125, 18.25);
    rect(movingFrame, 1.625, 1.75, 0.25, 0.75, 18.125, 18.25);
    rect(movingFrame, 1.625, 2.125, 0.75, 0.875, 18.125, 18.25);
  });

  const L = at(q.inputPivot), LF = frameOf([0, ...q.inputPivot], [1,0,0], [0,q.c,q.s], [0,-q.s,q.c]);
  const B = at(q.output), C = at(q.input);
  part('mirror.lifting-pivot-mount', 'Giá trục cần nâng nối vách hộp', 'mirror-box.wall-right', 'fixed', () =>
    rect(L, -1, 4.5, -1, 1, 21.875, 22));
  part('mirror.lifting-pivot', 'Trục cần nâng có vai và hai mặt chặn', 'mirror.lifting-pivot-mount', 'fixed', () => {
    cylinder(L, 21, 21.125, 0.875); cylinder(L, 21.125, 21.375, 0.5);
    cylinder(L, 21.375, 21.5, 0.875); cylinder(L, 21.5, 21.875, 0.5);
  });
  part('mirror.lifting-lever', 'Cần nâng có lỗ quay; đầu vào thao tác tay minh họa', 'mirror.lifting-pivot', 'linkage:+x', () => {
    // A real clearance bore; the pivot has finite axial shoulders, not an axis-lock label.
    rect(LF, -0.875, -0.625, -0.875, 0.875, 21.125, 21.375);
    rect(LF, 0.625, 5.75, -0.875, 0.875, 21.125, 21.375);
    rect(LF, -0.625, 0.625, -0.875, -0.625, 21.125, 21.375);
    rect(LF, -0.625, 0.625, 0.625, 0.875, 21.125, 21.375);
  });
  const translationGroup = group('mirror-lifting-translator', { free: { origin: [0, ...q.output] } });
  translator = translationGroup;
  part('mirror.lifting-lever-roller', 'Con lăn đầu cần nâng', 'mirror.lifting-lever', 'linkage:+x', () => {
    cylinder(C, 21.375, 21.75, 0.5); cylinder(C, 21.75, 21.875, 0.75);
  });
  translator = null;
  part('mirror.lifting-bracket', 'Giá con lăn gắn mặt tai gương', 'mirror.ears', 'hinge:+x', () =>
    rect(movingFrame, 3.5, 5.75, -0.75, 0.75, 21, 21.375));
  translator = translationGroup;
  part('mirror.bracket-roller', 'Con lăn trên giá gương', 'mirror.lifting-bracket', 'hinge:+x', () => {
    cylinder(B, 21.375, 21.75, 0.5); cylinder(B, 21.75, 21.875, 0.75);
  });
  part('mirror.lifting-link', 'Thanh nối cứng 8 mm, hai mắt vuông tiếp tuyến con lăn', 'mirror.lifting-lever-roller', 'linkage:translation', () => {
    // Both rollers physically occupy these eyes over 0.25 mm axial engagement.
    // Tangent line contacts transmit only the tested in-plane constraint, not finite-area force.
    rect(B, -0.875, -0.5, -8.875, 0.875, 21.5, 21.75);
    rect(B, 0.5, 0.875, -8.875, 0.875, 21.5, 21.75);
    for (const [a,b] of [[-8.875,-8.5],[-7.5,-0.5],[0.5,0.875]]) rect(B, -0.5, 0.5, a, b, 21.5, 21.75);
  });
  return q;
}

return { "RETURN_LIFT": RETURN_LIFT, "forwardMirrorRoller": forwardMirrorRoller, "makeReturnLift": makeReturnLift, "returnLiftPose": returnLiftPose };
})(void 0);
/* </module mirror-return-lift> */
/* <module machine-winding-couplings> */
__m["machine-winding-couplings"] = (function (window) {
'use strict';
// Illustrative manufactured integral shaft keys and open broached hub profiles.
// One shaft body includes its keys; key/core material unions are intentional.
const keyRectangle = (a, q) => [[a.x+q.root,a.y-q.halfWidth],[a.x+q.outer,a.y-q.halfWidth],[a.x+q.outer,a.y+q.halfWidth],[a.x+q.root,a.y+q.halfWidth]];
function broachKeyway(poly,a,q,floorClearance=0) {
  const outer=a.x+q.outer,lo=a.y-q.halfWidth,hi=a.y+q.halfWidth;
  if(floorClearance!==0){
    if(!Number.isFinite(floorClearance)||floorClearance<0)throw new RangeError('keyway floor clearance must be finite and nonnegative');
    // Recess only the old floor face. Keep all original cell boundaries/vertices:
    // re-clipping their sloping seams at a new X would change stored material.
    const floor=outer+floorClearance;
    return broachKeyway(poly,a,q).flatMap(p=>recessFloorCell(p,outer,floor,lo,hi));
  }
  const clip=(p,k,v,sign)=>{const out=[];for(let i=0;i<p.length;i++){const x=p[i],y=p[(i+1)%p.length],dx=sign*(x[k]-v),dy=sign*(y[k]-v);if(dx>=0)out.push(x);if((dx<0)!==(dy<0)){const [a,b]=x[0]<y[0]||x[0]===y[0]&&x[1]<=y[1]?[x,y]:[y,x];const t=(v-a[k])/(b[k]-a[k]);out.push(a.map((z,j)=>j===k?v:z+t*(b[j]-z)));}}return out.filter((p,i)=>!p.every((v,j)=>v===out[(i+out.length-1)%out.length][j]));};
  // Disjoint convex remainder outside a notch open from the centre into the bore.
  // The zero-clearance/default partition remains byte-for-byte compatible.
  // Callers declare 2*c as a floor design datum, not a predicate tolerance.
  if(poly.every(p=>p[0]>=outer)||poly.every(p=>p[0]<=a.x)||poly.every(p=>p[1]<=lo)||poly.every(p=>p[1]>=hi))return [poly];
  const back=clip(poly,0,a.x,-1),front=clip(poly,0,a.x,1),right=clip(front,0,outer,1),left=clip(front,0,outer,-1);
  return [back,right,clip(left,1,lo,-1),clip(left,1,hi,1)].filter(p=>p.length>=3);
}

// The new rectangular recess has only stored-dyadic corners. Triangulate its
// one concave cell without adding/interpolating vertices on old exterior edges.
function recessFloorCell(poly,tip,floor,lo,hi){
  const edge=poly.findIndex((p,i)=>{const q=poly[(i+1)%poly.length];return p[0]===tip&&q[0]===tip&&Math.min(p[1],q[1])<=lo&&Math.max(p[1],q[1])>=hi;});
  if(edge<0||floor===tip)return [poly];
  const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const orientation=Math.sign(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0));
  const corners=[[floor,lo],[floor,hi]];
  if(corners.some(p=>poly.some((a,i)=>orientation*turn(a,poly[(i+1)%poly.length],p)<0)))throw new RangeError('declared keyway floor breaches its actual hub cell');
  const ascending=poly[edge][1]<poly[(edge+1)%poly.length][1];
  const notch=ascending?[[tip,lo],[floor,lo],[floor,hi],[tip,hi]]:[[tip,hi],[floor,hi],[floor,lo],[tip,lo]];
  const ring=poly.flatMap((p,i)=>i===edge?[p,...notch]:[p]).filter((p,i,all)=>!p.every((x,k)=>x===all[(i+all.length-1)%all.length][k]));
  const left=[...ring],out=[];
  while(left.length>3){
    const ear=left.findIndex((b,i)=>{const a=left[(i+left.length-1)%left.length],c=left[(i+1)%left.length];if(orientation*turn(a,b,c)<=0)return false;
      return !left.some((p,j)=>j!==i&&j!==(i+left.length-1)%left.length&&j!==(i+1)%left.length&&[turn(a,b,p),turn(b,c,p),turn(c,a,p)].every(v=>orientation*v>=0));});
    if(ear<0)throw new Error('keyway floor cell has no valid convex ear');
    out.push([left[(ear+left.length-1)%left.length],left[ear],left[(ear+1)%left.length]]);left.splice(ear,1);
  }
  out.push(left);return out;
}

// The milled shaft flat and its integral key share a finite face, not overlapping core material.
function flatShaftCore(a,q,r){const poly=Array.from({length:8},(_,i)=>{const t=Math.PI/8+i*Math.PI/4;return[a.x+r*Math.cos(t),a.y+r*Math.sin(t)];}),flat=a.x+q.root,out=[];for(let i=0;i<poly.length;i++){const p=poly[i],v=poly[(i+1)%poly.length],x=p[0]-flat,y=v[0]-flat;if(x<=0)out.push(p);if((x<0)!==(y<0)){const t=(flat-p[0])/(v[0]-p[0]);out.push([flat,p[1]+t*(v[1]-p[1])]);}}return out;}

return { "broachKeyway": broachKeyway, "flatShaftCore": flatShaftCore, "keyRectangle": keyRectangle };
})(void 0);
/* </module machine-winding-couplings> */
/* <module machine-geometry> */
__m["machine-geometry"] = (function (window) {
'use strict';
// K1000-referenced SLR cutaway geometry. All lengths are ILLUSTRATIVE mm, not manufacturer measurements.
// One coherent world: +z up, +y camera front, +x photographer-right viewed from the BACK. Optical axis x=0,z=0,
// light travels -y from the thin-lens principal plane (y=50) to the emulsion (y=0). Geometry is constructed for ONE
// achieved model snapshot (Node builder; cloth spans and film perforation phase change per snapshot). This is
// geometry evidence only; it does not decide a live DOM strategy and is not an audit receipt.
const k = __m["iso-kit"];
const G = __m["lathe"];
const A = __m["audit"];
const { turning } = __m["turn-build"];
const { createModel, modelData } = __m["machine-model"];
const { makeReturnLift } = __m["mirror-return-lift"];
const { keyRectangle, broachKeyway, flatShaftCore } = __m["machine-winding-couplings"];

const WORLD = JSON.parse(__worldText);
const W = WORLD.width, H = WORLD.height;
const B = WORLD.body, O = WORLD.optics, MI = WORLD.mirror, SH = WORLD.shutter, TR = WORLD.transport;
const P = k.fitProjection(k.boxCorners({ x: B.x[0], y: B.y[0], w: B.x[1] - B.x[0], d: 92 - B.y[0], r: 0 }, B.z[0], 48), W, H, WORLD.camera);
const RAD = Math.PI / 180;
const SQ = Math.SQRT1_2;
const deepFreeze = (v) => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; };
const UP = (x = 0, y = 0) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
// Along +y: s=y, u=x, v=-z (right-handed). Along +x: s=x, u=y, v=z.
const ALONG_Y = (x = 0, z = 0) => G.frameOf([x, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, -1]);
const ALONG_X = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

const defaultSnapshot = () => createModel({ model: modelData() }).snapshot();
const apertureRadius = (fNumber) => O.focal / (2 * fNumber);
// Explicit optical classes; every other part is OPAQUE. mirror.glass is a front-surface reflector (opaque to transmission).
const TRANSMISSIVE_PARTS = Object.freeze(['lens.rear-glass', 'lens.mid-glass', 'lens.front-glass', 'eyepiece.lens', 'screen.glass', 'prism.pentaprism']);
const opticalClass = (id) => (TRANSMISSIVE_PARTS.includes(id) ? 'transmissive' : id === 'mirror.glass' ? 'reflective' : 'opaque');
// Iris stop: thin knife edge (half-thickness irisEdgeHalf) about the principal plane, then the 0.8 mm blade stack.
// The edge polygon's INSCRIBED circle is r + drift, where drift bounds how far any gate->pupil ray moves radially
// inside the edge thickness, so every ray through the NOMINAL pupil disc at y=principalY clears the blades.
function irisStop(fNumber) {
  const r = apertureRadius(fNumber), n = O.irisSegments, cos = Math.cos(Math.PI / n);
  const drift = O.irisEdgeHalf * (Math.hypot(...O.gateHalf) + r) / O.principalY;
  const inradius = r + drift, circumradius = inradius / cos;
  const areaRadius = inradius * Math.sqrt(n * Math.tan(Math.PI / n) / Math.PI);
  return { nominalRadius: r, drift, inradius, circumradius, segments: n, edgeHalf: O.irisEdgeHalf,
    fNumberInscribed: O.focal / (2 * inradius), fNumberAreaEquivalent: O.focal / (2 * areaRadius), fNumberCircumscribed: O.focal / (2 * circumradius) };
}
const reflect = (d, n) => { const t = 2 * G.dot3(d, n); return [d[0] - t * n[0], d[1] - t * n[1], d[2] - t * n[2]]; };
// Model curtain edges are defined at the ideal focal (film) plane. A physical edge at depth y is placed on the
// chief-ray cone through the thin-lens centre, so its chief-ray shadow on the film equals the model edge.
const curtainPhysicalX = (filmX, y) => filmX * (1 - y / O.principalY);
const filmUV = (x, z) => [(x + O.gateHalf[0]) / (2 * O.gateHalf[0]), (O.gateHalf[1] - z) / (2 * O.gateHalf[1])];
const filmPointOfUV = (u, v) => [u * 2 * O.gateHalf[0] - O.gateHalf[0], O.filmY, O.gateHalf[1] - v * 2 * O.gateHalf[1]];
const totalTransport = (s) => TR.pitch * (s.winds - Number(s.transported) + s.wind);

// Shutter axis layout (ILLUSTRATIVE mm; order/sides from K1000 repair text PDF 89-91). Take-up pair at back-view -x,
// winding pair at +x. The two cloth-carrying rollers sit with a 16-gon FLAT (radius SH.rollerRadius) tangent to the
// front face of their cloth plane; the closing take-up and opening pinion axes are the camera-front members.
const HW = SH.hardware;
function shutterAxes() {
  const t = HW.takeupShaftRadius, p = HW.pinionShaftRadius, R = SH.rollerRadius, bt = HW.shaftBodyRadius.takeup, bp = HW.shaftBodyRadius.pinion;
  return deepFreeze({ // shaft = journal radius (in the bushes), body = radius between the bushes
    openingTakeup: { x: HW.openingTakeupX, y: SH.firstY + SH.cloth + R, shaft: t, body: bt, flat: R, bush: HW.bushOuter.takeup },
    closingTakeup: { x: HW.closingTakeup[0], y: HW.closingTakeup[1], shaft: t, body: bt, flat: R, bush: HW.bushOuter.takeup },
    openingWinding: { x: HW.openingWinding[0], y: HW.openingWinding[1], shaft: p, body: bp, flat: HW.tapeEndRadius, bush: HW.bushOuter.pinion },
    closingWinding: { x: HW.closingWindingX, y: SH.secondY + SH.cloth + R, shaft: p, body: bp, flat: R, bush: HW.bushOuter.pinion },
  });
}

// Achieved snapshot -> physical pose. Mirror is RELATIVE in the model (0..mirrorDegrees); physical lift is scaled.
function geometryPose(s) {
  const M = modelData();
  const lift = s.mirror / M.mirrorDegrees * MI.liftDegrees;
  const q = totalTransport(s);
  return deepFreeze({ time: s.time, stageKey: s.stageKey, mirrorRelative: s.mirror, mirrorLiftDegrees: lift,
    aperture: s.aperture, apertureRadius: apertureRadius(s.aperture),
    stopDown: (s.aperture - M.viewFStop) / (M.fStop - M.viewFStop),
    firstFilmX: s.curtains.first, secondFilmX: s.curtains.second,
    firstX: curtainPhysicalX(s.curtains.first, SH.firstY + SH.cloth / 2),
    secondX: curtainPhysicalX(s.curtains.second, SH.secondY + SH.cloth / 2),
    totalTransport: q, perforationPhase: ((q % TR.perforationPitch) + TR.perforationPitch) % TR.perforationPitch,
    leverDegrees: s.lever, frame: s.frame, exposureFrame: s.exposureFrame });
}

// Mirror rigid transform in the (y,z) plane: rotation by +lift about +x through the pivot.
function mirrorTransform(lift) {
  const c = Math.cos(lift * RAD), sn = Math.sin(lift * RAD), [qy, qz] = MI.pivot;
  const point = ([y, z]) => [qy + c * (y - qy) - sn * (z - qz), qz + sn * (y - qy) + c * (z - qz)];
  const dir = ([y, z]) => [c * y - sn * z, sn * y + c * z];
  const nRest = [SQ, SQ];
  const surf = (s) => [O.mirrorCentre[1] + s * SQ, O.mirrorCentre[2] - s * SQ];
  const n = dir(nRest);
  return { lift, point, dir, frame: G.frameOf([0, qy, qz], [1, 0, 0], [0, c, sn], [0, -sn, c]), normal: [0, n[0], n[1]], surfacePoint: (s) => point(surf(s)),
    back: (s, depth) => point([surf(s)[0] - nRest[0] * depth, surf(s)[1] - nRest[1] * depth]) };
}

function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const sectors = (ri, ro, n = 16, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + 2 * Math.PI * i / n, b = phase + 2 * Math.PI * (i + 1) / n;
  return [[ri * Math.cos(a), ri * Math.sin(a)], [ro * Math.cos(a), ro * Math.sin(a)], [ro * Math.cos(b), ro * Math.sin(b)], [ri * Math.cos(b), ri * Math.sin(b)]];
});

// Report-only inspection section: ACTUAL removed volumes of camera-facing OPAQUE housing (see world-config view.section).
const SECTION = WORLD.view.section;
const SECTOR_CUT = (i, n) => { const a = 2 * Math.PI * (i + 0.5) / n; return Math.cos(a) > 0 && -Math.sin(a) > 0; }; // ALONG_Y: x=u, z=-v
// AABB difference: pieces of box a outside cut c (up to 6 boxes); exact, no overlap.
function boxMinus(a, c) {
  const lo = [0, 1, 2].map((k) => Math.max(a[k][0], c[k][0])), hi = [0, 1, 2].map((k) => Math.min(a[k][1], c[k][1]));
  if (lo.some((v, k) => v >= hi[k])) return [a];
  const out = [], rest = a.map((r) => r.slice());
  for (let k = 0; k < 3; k++) {
    if (rest[k][0] < lo[k]) { const b = rest.map((r) => r.slice()); b[k] = [rest[k][0], lo[k]]; out.push(b); }
    if (hi[k] < rest[k][1]) { const b = rest.map((r) => r.slice()); b[k] = [hi[k], rest[k][1]]; out.push(b); }
    rest[k] = [lo[k], hi[k]];
  }
  return out;
}


// K2b-R1: finite tapes outside the cloth. Each route is the taut external hull of
// its actual polygonal guide and receiving roller; no inside-drum circular chords.
// All offsets are illustrative dimensions, not numerical predicate tolerances.
const cross2 = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Shared absolute polygon vertices are the exact RAW/PACK contact datums.
const rollerOutline=(a,r,n)=>Array.from({length:n},(_,i)=>{const t=Math.PI/n+2*Math.PI*i/n,R=r*(1/Math.cos(Math.PI/n));return [a.x+R*Math.cos(t),a.y+R*Math.sin(t)];});
const routeGuide=family=>({x:family==='first'?25.5:-25.5,y:2.9,flat:0.5,n:8});
function tapeRoutesFor(pose) {
  const ax=shutterAxes(), D=SH.tapes, routes=[];
  for (const family of ['first','second']) {
    const first=family==='first', x=first?pose.firstX:pose.secondX;
    const guide=first?ax.closingWinding:ax.openingTakeup;
    const roller=first?ax.openingWinding:ax.closingTakeup;
    const guideOwner=first?'shutter.closing-winding-guides':'shutter.opening-takeup-guides';
    const rollerOwner=first?'shutter.opening-winding-tape-ends':'shutter.closing-takeup-roller';
    const anchor=[x,D.anchorFacesY[family]], points=[{p:anchor,owner:'anchor'}];
    for(const [a,r,n,owner] of [[guide,first?HW.guideRadius.winding:HW.guideRadius.takeup,12,guideOwner],[roller,first?HW.tapeEndRadius:SH.rollerRadius,first?8:16,rollerOwner]]) {
      for(const p of rollerOutline(a,r,n))points.push({p,owner});
    }
    const q=routeGuide(family),extraOwner='shutter.'+family+'-route-guide';
    for(const p of rollerOutline(q,q.flat,q.n))points.push({p,owner:extraOwner});
    points.sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]);
    const lower=[],upper=[];
    for(const q of points){while(lower.length>=2&&cross2(lower.at(-2).p,lower.at(-1).p,q.p)<=0)lower.pop();lower.push(q);}
    for(const q of points.slice().reverse()){while(upper.length>=2&&cross2(upper.at(-2).p,upper.at(-1).p,q.p)<=0)upper.pop();upper.push(q);}
    const hull=lower.slice(0,-1).concat(upper.slice(0,-1)), at=hull.findIndex(q=>q.owner==='anchor');
    if(at<0)throw Error('bar anchor is not external to roller hull');
    const direction=first?1:-1,path=[];
    for(let j=0;j<hull.length;j++){
      const q=hull[(at+direction*j+hull.length)%hull.length];path.push(q);
      if(q.owner===rollerOwner&&q.p[1]===Math.max(...points.filter(v=>v.owner===rollerOwner).map(v=>v.p[1])))break;
    }
    if(!path.some(q=>q.owner===extraOwner)||!path.some(q=>q.owner===guideOwner)||path.at(-1).owner!==rollerOwner)throw Error('route bypasses guide/roller');
    const offsets=path.slice(0,-1).map((q,i)=>{const b=path[i+1].p,dx=b[0]-q.p[0],dy=b[1]-q.p[1],L=Math.hypot(dx,dy);return [direction*dy/L*D.thickness,-direction*dx/L*D.thickness];});
    const outer=path.map((q,i)=>{
      if(i===0){const b=path[1].p,dx=b[0]-q.p[0],dy=b[1]-q.p[1],o=offsets[0];return [q.p[0],q.p[1]+o[1]-dy/dx*o[0]];}
      if(i===path.length-1)return [q.p[0]+offsets[i-1][0],q.p[1]+offsets[i-1][1]];
      const a=path[i-1].p,b=q.p,c=path[i+1].p,u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],o=offsets[i-1],p=offsets[i];
      const den=u[0]*v[1]-u[1]*v[0];
      if(den===0)throw Error('collinear route vertex');
      const t=((p[0]-o[0])*v[1]-(p[1]-o[1])*v[0])/den;
      return [b[0]+o[0]+t*u[0],b[1]+o[1]+t*u[1]];
    });
    for(const sign of [-1,1]){
      const lane=D.lanes[family], z0=sign>0?lane[0]:-lane[1],z1=sign>0?lane[1]:-lane[0];
      routes.push({family,sign,anchor,guideOwner,rollerOwner,z0,z1,segments:path.slice(0,-1).map((q,i)=>({kind:q.owner===path[i+1].owner?'wrap':'span',surface:q.owner===path[i+1].owner?q.owner:null,polygon:[q.p,path[i+1].p,outer[i+1],outer[i]]}))});
    }
  }
  return routes;
}
const curtainTapeRoutes = snapshot => tapeRoutesFor(geometryPose(snapshot));

function makeGeometry(snapshot = defaultSnapshot(), { includeFilm = true, section = true } = {}) {
  const pose = geometryPose(snapshot);
  const recorder = A.recorder(P);
  const T = turning(P, { recorder });
  T.layer('camera'); T.stack(['camera']);
  const parts = [];
  const MOUNTS = WORLD.mounts, FIXINGS = WORLD.fasteners;
  let active = null;
  function m(id, label, assembly, support, motion, fn, note = '') {
    if (parts.some((p) => p.id === id)) throw new Error(`duplicate major part ${id}`);
    active = { id, label, assembly, support, motion, note, optical: opticalClass(id), solids: [] };
    parts.push(active); fn(); active = null;
  }
  const removed = [];
  const losslessMaterialOwners = new Set(["shutter.opening-winding-shaft","shutter.opening-winding-tape-ends","shutter.closing-winding-shaft","shutter.closing-winding-roller","shutter.opening-winding-spacers"]);
  const add = (kind, o) => {
    if (kind === 'prism' && losslessMaterialOwners.has(active.id)) {
      const { ringPrecision, frameAxisDigits, ...materialOptions } = o;
      o = { ...materialOptions, materialPrecision: 'lossless' };
    }
    const i = active.solids.length; const part = T[kind]({ layer: 'camera', tone: 'mid', owner: active.id, ...o, ...(kind === 'round' ? { fixed: false } : {}), name: i ? `${active.id}:${i}` : active.id }); active.solids.push(part.name); return part;
  };
  const rawBox = (x0, x1, y0, y1, z0, z1, o) => {
    // Preserve the closing cloth/bar literal physical contact datums with the newly broached lossless hub.
    if(['shutter.second-cloth','shutter.second-bar'].includes(active.id))o={...o,ringPrecision:'lossless'};
    // Interface boxes consume absolute face datums, not x0+(x1-x0) reconstructed endpoints.
    if (o.ringPrecision === 'lossless' || ['shutter.frame-left', 'shutter.frame-right', 'shutter.winding-support-plate', 'shutter.first-cloth', 'shutter.first-bar', 'shutter.second-cloth', 'shutter.second-bar'].includes(active.id))
      return add('prism', { F: UP(), polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], s0: z0, s1: z1, ...o });
    return add('prism', { plan: { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z: z0, h: z1 - z0, ...o });
  };
  const box = (x0, x1, y0, y1, z0, z1, o = {}) => {
    let pieces = [[[x0, x1], [y0, y1], [z0, z1]]];
    // The rail's front-opening tape channels continue through the end brackets.
    // Their rear web and all original lower support ledges remain material.
    if(['shutter.frame-left','shutter.frame-right'].includes(active.id)){
      for(const [a,b]of Object.values(SH.tapes.lanes))for(const sign of [-1,1]){const cut=[[-25,25],[SH.secondY-0.08,3.4],sign>0?[a,b]:[-b,-a]];
        if(!pieces.some(piece=>piece.every(([lo,hi],i)=>lo<cut[i][1]&&hi>cut[i][0])))continue;
        pieces=pieces.flatMap(piece=>boxMinus(piece,cut));o={...o,ringPrecision:'lossless'};
      }
    }
    const bores = FIXINGS.filter(f => active.id === 'body.base-plate' || active.id === f.threadOwner);
    for (const f of bores) {
      const h = active.id === 'body.base-plate' ? f.clearanceHalf : f.threadHalf;
      const cut = [[f.x - h, f.x + h], [f.y - h, f.y + h], [active.id === 'body.base-plate' ? -36 : -33.6, active.id === 'body.base-plate' ? -33.6 : f.threadTop]];
      // Lossless only for newly machined bore pieces; preserve the existing bearing-seat encoding.
      if (!pieces.some(b => b.every(([lo, hi], i) => lo < cut[i][1] && hi > cut[i][0]))) continue;
      pieces = pieces.flatMap(b => boxMinus(b, cut));
      o = { ...o, ringPrecision: 'lossless' };
    }
    if (section) for (const c of SECTION.boxCuts.filter((c) => c.parts.includes(active.id))) {
      const next = pieces.flatMap((b) => boxMinus(b, [c.x, c.y, c.z]));
      if (next.length !== 1 || next[0] !== pieces[0]) removed.push({ part: active.id, cut: [c.x, c.y, c.z] });
      pieces = next;
    }
    pieces = pieces.filter((b) => b.every(([a, z]) => z - a > 0.05));
    for (const [[a, b], [c, d], [e, f]] of pieces) rawBox(a, b, c, d, e, f, o);
  };
  const sectorKept = (i, n) => !(section && SECTION.sectorParts.includes(active.id) && SECTOR_CUT(i, n)) || (removed.push({ part: active.id, sector: i, of: n }), false);
  const yz = (polygon, x0, x1, o = {}) => add('prism', { F: ALONG_X, polygon: hull(polygon), s0: x0, s1: x1, ...o });
  const ringY = (ri, ro, y0, y1, o = {}, n = 16) => { sectors(ri, ro, n).forEach((poly, i) => { if (sectorKept(i, n)) add('prism', { F: ALONG_Y(), polygon: poly, s0: y0, s1: y1, ...o }); }); };
  // Optical openings keep their original polygons. Glass grows OUTWARD into a stepped pocket,
  // not inward over the pupil; cap seats and retaining rings share the actual glass end datums.
  const mountedGlass = f => add('round', { F: ALONG_Y(0, f.z), s0: f.y0, s1: f.y1, r: f.glassRadius, tone: 'hi', lit: true });
  const mountRing = (f, ri, ro, y0, y1) => sectors(ri, ro, f.segments).forEach((polygon, i) => {
    if (sectorKept(i, f.segments)) add('prism', { F: ALONG_Y(0, f.z), polygon, s0: y0, s1: y1, tone: 'lo' });
  });
  const boreRadius = f => (f.glassRadius + f.radialClearance) / Math.cos(Math.PI / f.segments);
  const lensCell = f => {
    mountRing(f, f.openingRadius, f.pocketOuter, f.y0 - f.seatThickness, f.y0);
    mountRing(f, boreRadius(f), f.pocketOuter, f.y0, f.y1 + f.retainerThickness);
    // The pocket wall surrounds the retainer through its full 0.5 mm axial engagement.
    // Matching polygonal side faces form the disclosed STATIC IDEAL retaining-ring thread.
    // Original outer support annulus still meets the barrel at the original axial range.
    ringY(f.pocketOuter, 25.5, f.cellY[0], f.cellY[1], { tone: 'lo' });
  };
  const post = (x, y, z0, z1, r, o = {}) => add('round', { F: UP(x, y), s0: z0, s1: z1, r, ...o });
  const [X0, X1] = B.x, wall = B.wall;
  const FLOOR_TOP = -17.6;

  // Body shell: real wall thickness; front skin left of the mount and the near top deck are CUT AWAY on purpose.
  m('body.base-plate', 'Đế thân dày', 'body', 'ground', 'fixed', () => box(X0, X1, -9, 43.1, -36, -33.6, { tone: 'lo' }));
  m('body.back-door', 'Nắp lưng kín sáng (đóng)', 'body', 'body.base-plate', 'fixed', () => box(X0, X1, -9, -6.6, -33.6, 28, { tone: 'lo' }));
  m('body.end-wall-left', 'Vách đầu trái (khoang cassette)', 'body', 'body.base-plate', 'fixed', () => box(X0, X0 + wall, -6.6, 43.1, -33.6, 28, { tone: 'lo' }));
  m('body.end-wall-right', 'Vách đầu phải (khoang take-up)', 'body', 'body.base-plate', 'fixed', () => box(X1 - wall, X1, -6.6, 43.1, -33.6, 28, { tone: 'lo' }));
  m('body.front-mount-plate', 'Mặt trước có lỗ họng ngàm r24 thật (nửa phải; nửa trái cắt bỏ)', 'body', 'body.base-plate', 'fixed', () => {
    ringY(24, 30, 43.1, 45.5, { tone: 'mid' });
    box(30, X1, 43.1, 45.5, -33.6, 28, { tone: 'mid' });
    box(-30, 30, 43.1, 45.5, -33.6, -30, { tone: 'mid' });
  });
  m('body.deck-right', 'Mặt trên khoang take-up', 'body', 'body.end-wall-right', 'fixed', () => box(24.4, X1, -6.6, 43.1, 28, 30.4, { tone: 'mid' }));

  // Four tapped casting bosses meet the end-wall faces and base plate. Blind bores and
  // matching square tips are the disclosed static IDEAL thread envelope used by B&W.
  // No helix, tightening, preload, stress or factory thread is represented.
  for (const f of FIXINGS.filter(f => f.family === 'body')) m(f.threadOwner, 'Boss đúc có lỗ ren tĩnh lý tưởng', 'body', f.castingSupport, 'fixed', () => {
    box(f.bossX[0], f.bossX[1], f.y - 2, f.y + 2, -33.6, -28.6, { tone: 'lo' });
  }, FIXINGS[0].jointNote);

  // Mirror box with real side walls, floor and hinge brackets.
  for (const side of [-1, 1]) {
    const lo = side < 0 ? -24.4 : 22, hi = side < 0 ? -22 : 24.4;
    m(`mirror-box.wall-${side < 0 ? 'left' : 'right'}`, 'Vách hộp gương', 'mirror-box', 'body.base-plate', 'fixed', () => box(lo, hi, 9.6, 43.1, -20, 24.6, { tone: 'lo' }));
    const [py, pz] = MI.pivot, h = MI.hinge.boreHalf, r = MI.hinge.bossOuterHalf;
    m(`mirror-box.hinge-bracket-${side < 0 ? 'left' : 'right'}`, 'Tai đỡ có lỗ thông trục bản lề', 'mirror-box', `mirror-box.wall-${side < 0 ? 'left' : 'right'}`, 'fixed', () => {
      const stock = [[lo, hi], [py - 1.8, 9.6], [pz - 2.2, pz + 2.2]];
      const H=MI.hinge, pocket=H.headRadius+H.headPocketClearance;
      const pocketX=side<0?[lo,lo+H.headThickness]:[hi-H.headThickness,hi];
      const drilled=boxMinus(stock,[[lo,hi],[py-h,py+h],[pz-h,pz+h]]);
      for (const [[a,b],[c,d],[e,f]] of drilled.flatMap(piece=>boxMinus(piece,[pocketX,[py-pocket,py+pocket],[pz-pocket,pz+pocket]])))
        box(a,b,c,d,e,f,{tone:'mid',ringPrecision:'lossless'});
    });
    m(`mirror-box.hinge-boss-${side < 0 ? 'left' : 'right'}`, 'Bạc chặn dọc trục có lỗ thông', 'mirror', `mirror-box.hinge-bracket-${side < 0 ? 'left' : 'right'}`, 'fixed', () => {
      // The left boss has a real counterbore for the integral shaft collar.
      // Its floor and the collar back consume ONE absolute axial datum, not reconstructed endpoints.
      const C = MI.hinge.thrust;
      const spans = side < 0 ? [[-22, C.backX, h], [C.backX, -21, C.pocketHalf]]
        : [[21 + MI.hinge.rightThrustGap, 22, h]];
      for (const [x0, x1, bore] of spans) for (const poly of [
        [[py-r,pz-r],[py-bore,pz-r],[py-bore,pz+r],[py-r,pz+r]],
        [[py+bore,pz-r],[py+r,pz-r],[py+r,pz+r],[py+bore,pz+r]],
        [[py-bore,pz-r],[py+bore,pz-r],[py+bore,pz-bore],[py-bore,pz-bore]],
        [[py-bore,pz+bore],[py+bore,pz+bore],[py+bore,pz+r],[py-bore,pz+r]],
      ]) yz(poly,x0,x1,{tone:'hi',ringPrecision:'lossless'});
    });
  }
  m('mirror-box.floor', 'Sàn hộp gương', 'mirror-box', 'mirror-box.wall-left', 'fixed', () => box(-22, 22, 9.6, 43.1, -20, FLOOR_TOP, { tone: 'lo' }));

  // Mirror: glass + carrier + ears built at the ACHIEVED physical lift (rigid about the hinge axis).
  const MT = mirrorTransform(pose.mirrorLiftDegrees);
  const glassDepth = MI.glass, carrierDepth = MI.glass + MI.carrier;
  const earInner = MI.earInner, earRoot = MI.sUpper + MI.earRootLength;
  m('mirror.glass', 'Gương phản xạ mặt trước (có bề dày)', 'mirror', 'mirror.carrier', 'hinge:+x', () =>
    yz([MT.surfacePoint(MI.sUpper), MT.surfacePoint(MI.sLower), MT.back(MI.sLower, glassDepth), MT.back(MI.sUpper, glassDepth)], -MI.halfWidth, MI.halfWidth, { tone: 'hi', lit: true }));
  m('mirror.carrier', 'Khung đỡ gương + gờ hai bên', 'mirror', 'mirror.hinge-shaft', 'hinge:+x', () => {
    yz([MT.back(MI.sUpper, glassDepth), MT.back(MI.sLower, glassDepth), MT.back(MI.sLower, carrierDepth), MT.back(MI.sUpper, carrierDepth)], -earInner, earInner, { tone: 'mid' });
    for (const [a, b] of [[-earInner, -MI.halfWidth], [MI.halfWidth, earInner]]) yz([MT.surfacePoint(MI.sUpper), MT.surfacePoint(MI.sLower), MT.back(MI.sLower, glassDepth), MT.back(MI.sUpper, glassDepth)], a, b, { tone: 'mid' });
  });
  const pivotRing = [[-MI.hinge.earOuterDiamond, 0], [0, -MI.hinge.earOuterDiamond], [MI.hinge.earOuterDiamond, 0], [0, MI.hinge.earOuterDiamond]].map(([dy, dz]) => [MI.pivot[0] + dy, MI.pivot[1] + dz]);
  m('mirror.ears', 'Tai gương có lỗ xuyên quanh journal', 'mirror', 'mirror.hinge-shaft', 'hinge:+x', () => {
    const restPts = [[O.mirrorCentre[1] + earRoot * SQ, -earRoot * SQ], [O.mirrorCentre[1] + earRoot * SQ - SQ * carrierDepth, -earRoot * SQ - SQ * carrierDepth], [O.mirrorCentre[1] + MI.sUpper * SQ, -MI.sUpper * SQ], ...pivotRing]
      .map(([y, z]) => [y - MI.pivot[0], z - MI.pivot[1]]);
    // Machine the ear in ONE local frame shared by all its pieces. Independently rounded
    // world-space vertices can break a nominally planar shared edge after rotation.
    // This is source construction, not decoded-frame normalization or predicate snapping.
    const clip = (poly, axis, value, sign) => {
      const out = [];
      for (let i=0;i<poly.length;i++) {
        const a=poly[i], b=poly[(i+1)%poly.length], da=sign*(a[axis]-value), db=sign*(b[axis]-value);
        if (da>=0) out.push(a);
        if ((da<0&&db>0)||(da>0&&db<0)) {
          const t=(value-a[axis])/(b[axis]-a[axis]), p=a.map((v,j)=>v+t*(b[j]-v)); p[axis]=value; out.push(p);
        }
      }
      return out;
    };
    const bored = h => {
      let rest = hull(restPts);
      const pieces = [];
      for (const [axis,value,sign] of [[0,-h,-1],[0,h,1],[1,-h,-1],[1,h,1]]) {
        const outside=clip(rest,axis,value,sign); if(outside.length>=3) pieces.push(outside);
        rest=clip(rest,axis,value,-sign);
      }
      return pieces;
    };
    const C = MI.hinge.thrust;
    const earPiece = (polygon, s0, s1) => add('prism', { F: MT.frame, polygon: hull(polygon), s0, s1, ringPrecision: 'lossless' });
    // Only the outer 0.125 mm of the left ear is counterbored. The untouched running bore
    // continues inboard of the shoulder. Its cap and the collar end share C.seatX exactly.
    for (const poly of bored(MI.hinge.boreHalf)) {
      earPiece(poly,C.seatX,-earInner);
      earPiece(poly,earInner,21);
    }
    for (const poly of bored(C.pocketHalf)) earPiece(poly,-21,C.seatX);
  });
  // Restore the original declared ear interface only now that its real axial collar patch exists.
  // The separate collar/boss/bracket/wall certificate carries the cage path; this label proves nothing.
  m('mirror.hinge-shaft', 'Trục cố định xuyên tai và gối, hai đầu tán liền', 'mirror', 'mirror.ears', 'fixed', () => {
    const F=G.frameOf([0,MI.pivot[0],MI.pivot[1]],[1,0,0],[0,1,0],[0,0,1]), H=MI.hinge;
    // One integral rivet, not independently floating collars or an owner-label joint.
    // Heads are recessed in counterbores; retaining shoulders are at ±(24.4-headThickness).
    // This keeps the axle within its support casting, rather than crossing the existing shutter drums.
    add('round',{F,s0:H.thrust.seatX,s1:24.4-H.headThickness,r:H.journalRadius,tone:'hi'});
    add('round',{F,s0:-24.4,s1:-24.4+H.headThickness,r:H.headRadius,tone:'hi'});
    add('round',{F,s0:24.4-H.headThickness,s1:24.4,r:H.headRadius,tone:'hi'});
    // One stepped turned shaft, partitioned at its actual shoulders. Finite full-disc
    // cap interfaces connect the central material without coincident internal lateral skins.
    // Both counterbores clear the collar rim; only opposed axial faces seat foreign material.
    add('round',{F,s0:H.thrust.backX,s1:H.thrust.seatX,r:H.thrust.radius,tone:'hi'});
    add('round',{F,s0:-24.4+H.headThickness,s1:H.thrust.backX,r:H.journalRadius,tone:'hi'});
  }, MI.hinge.note);
  const raised = mirrorTransform(MI.liftDegrees);
  const raisedTop = Math.max(raised.surfacePoint(MI.sUpper)[1], raised.surfacePoint(MI.sLower)[1]);
  m('mirror.rest-stop', 'Cữ dưới: gương nghỉ 45°', 'mirror', 'mirror-box.floor', 'fixed', () => {
    // Rest on the lower back edge itself: the carrier's exact extremal vertex is also the pad's top/front datum.
    // Horizontal pad under a transverse edge; no independently evaluated y+z plane or rounded intersection.
    const [y, z] = mirrorTransform(0).back(MI.sLower, carrierDepth);
    yz([[y - MI.restPadDepth, -17.6], [y, -17.6], [y, z], [y - MI.restPadDepth, z]], MI.halfWidth, 22, { tone: 'mid' });
  });
  m('mirror.raised-stop', 'Cữ trên: gương nằm ngang dưới kính ngắm', 'mirror', 'screen.ledge-right', 'fixed', () => box(19.4, 22, 36, 38, raisedTop, 24.6, { tone: 'mid' }));
  makeReturnLift({ lift: pose.mirrorLiftDegrees, pivot: MI.pivot, movingFrame: MT.frame, frameOf: G.frameOf, m, add, group: T.group });

  // Viewfinder: focusing screen at the reflected film datum z=26, ledges, pentaprism, brackets, eyepiece.
  m('screen.glass', 'Kính mờ lấy nét (mặt mờ z=26)', 'finder', 'screen.ledge-left', 'fixed', () => box(-19, 19, 12, 40, O.screenZ, O.screenZ + 1.6, { tone: 'hi', lit: true }));
  for (const side of ['left', 'right']) {
    const [a, b] = side === 'left' ? [-24.4, -18.5] : [18.5, 24.4];
    m(`screen.ledge-${side}`, 'Gờ đỡ kính mờ trên vách hộp gương', 'finder', `mirror-box.wall-${side}`, 'fixed', () => box(a, b, 9.6, 43.1, 24.6, O.screenZ, { tone: 'mid' }));
    const [c, d] = side === 'left' ? [-21, -19] : [19, 21];
    m(`prism.bracket-${side}`, 'Giá kẹp lăng kính', 'finder', `screen.ledge-${side}`, 'fixed', () => box(c, d, 20, 30, O.screenZ, 36, { tone: 'mid' }));
  }
  m('prism.pentaprism', 'Lăng kính năm mặt (mặt cắt minh họa, không vẽ đường tia mái)', 'finder', 'screen.glass', 'fixed', () =>
    yz([[14, O.screenZ + 1.6], [38, O.screenZ + 1.6], [38, 33], [26, 46], [12.4, 39]], -19, 19, { tone: 'hi', lit: true }));
  m('eyepiece.housing', 'Vỏ ngắm sau có lỗ thị kính thật', 'finder', 'body.back-door', 'fixed', () => {
    box(-24.4, -6.6, -9, -6.6, 28, 47, { tone: 'lo' }); box(6.6, 24.4, -9, -6.6, 28, 47, { tone: 'lo' });
    box(-6.6, 6.6, -9, -6.6, 28, 31.4, { tone: 'lo' }); box(-6.6, 6.6, -9, -6.6, 44.6, 47, { tone: 'lo' });
  });
  m('eyepiece.collar', 'Vành giữ ống thị kính', 'finder', 'eyepiece.housing', 'fixed', () => { for (const poly of sectors(6.5, 8.5, 12)) add('prism', { F: ALONG_Y(0, 38), polygon: poly, s0: -6.6, s1: -5.6, tone: 'mid' }); });
  const eyeMount = MOUNTS.find(f => f.glass === 'eyepiece.lens');
  m('eyepiece.tube', 'Ống thị kính có vai tựa và pocket kính thật', 'finder', 'eyepiece.collar', 'fixed', () => {
    mountRing(eyeMount, 5.5, 6.5, -10, eyeMount.y0);
    mountRing(eyeMount, boreRadius(eyeMount), 6.5, eyeMount.y0, eyeMount.y1 + eyeMount.retainerThickness);
    mountRing(eyeMount, 5.5, 6.5, eyeMount.y1 + eyeMount.retainerThickness, 11.5);
  });
  m('eyepiece.lens', 'Thấu kính thị kính có mép gá ngoài khẩu độ cũ', 'finder', 'eyepiece.tube', 'fixed', () => mountedGlass(eyeMount));
  m(eyeMount.retainer, 'Vòng chặn thị kính: khớp ren tĩnh lý tưởng', 'finder', 'eyepiece.tube', 'fixed', () => mountRing(eyeMount, 5.5, boreRadius(eyeMount), eyeMount.y1, eyeMount.y1 + eyeMount.retainerThickness), eyeMount.jointNote);

  // Lens: bayonet, barrel, glass groups at the thin-lens datum, real iris opening r=focal/(2N) and stop-down pin.
  m('lens.bayonet', 'Vành ngàm K trên ống kính', 'lens', 'body.front-mount-plate', 'fixed', () => ringY(24.5, 29, 45.5, 47.5, { tone: 'mid' }));
  m('lens.barrel', 'Ống kính có khoang thật', 'lens', 'lens.bayonet', 'fixed', () => ringY(25.5, 29, 47.5, 90, { tone: 'mid' }));
  const rearMount = MOUNTS.find(f => f.glass === 'lens.rear-glass');
  m('lens.rear-glass', 'Nhóm kính sau có mép gá ngoài khẩu độ cũ', 'lens', 'lens.rear-cell', 'fixed', () => mountedGlass(rearMount));
  m('lens.rear-cell', 'Ổ giữ nhóm sau có vai tựa hữu hạn', 'lens', 'lens.barrel', 'fixed', () => lensCell(rearMount));
  m(rearMount.retainer, 'Vòng chặn kính sau: khớp ren tĩnh lý tưởng', 'lens', 'lens.rear-cell', 'fixed', () => mountRing(rearMount, 12, boreRadius(rearMount), 49, 49 + rearMount.retainerThickness), rearMount.jointNote);
  const ri = pose.apertureRadius, IS = irisStop(snapshot.aperture), rEdge = IS.circumradius, rBlade = IS.circumradius + O.irisEdgeWidth;
  m('lens.iris', `Lá khẩu: mép mỏng nội tiếp r=${IS.inradius.toFixed(3)} ⊇ đồng tử danh nghĩa r=${ri.toFixed(3)} (f/${snapshot.aperture.toFixed(2)})`, 'lens', 'lens.barrel', 'per-snapshot', () => {
    ringY(rEdge, rBlade, O.principalY - O.irisEdgeHalf, O.principalY + O.irisEdgeHalf, { tone: 'lo' }, O.irisSegments);
    ringY(rBlade, 25.5, O.principalY - O.irisBladeHalf, O.principalY + O.irisBladeHalf, { tone: 'lo' }, O.irisSegments);
  });
  const midMount = MOUNTS.find(f => f.glass === 'lens.mid-glass');
  m('lens.mid-glass', 'Nhóm kính giữa có mép gá ngoài khẩu độ cũ', 'lens', 'lens.mid-cell', 'fixed', () => mountedGlass(midMount));
  m('lens.mid-cell', 'Ổ giữ nhóm giữa có vai tựa hữu hạn', 'lens', 'lens.barrel', 'fixed', () => lensCell(midMount));
  m(midMount.retainer, 'Vòng chặn kính giữa: khớp ren tĩnh lý tưởng', 'lens', 'lens.mid-cell', 'fixed', () => mountRing(midMount, 16, boreRadius(midMount), 58, 58 + midMount.retainerThickness), midMount.jointNote);
  const frontMount = MOUNTS.find(f => f.glass === 'lens.front-glass');
  m('lens.front-glass', 'Nhóm kính trước có mép gá ngoài khẩu độ cũ', 'lens', 'lens.front-cell', 'fixed', () => mountedGlass(frontMount));
  m('lens.front-cell', 'Ổ giữ nhóm trước có vai tựa hữu hạn', 'lens', 'lens.barrel', 'fixed', () => lensCell(frontMount));
  m(frontMount.retainer, 'Vòng chặn kính trước: khớp ren tĩnh lý tưởng', 'lens', 'lens.front-cell', 'fixed', () => mountRing(frontMount, 22, boreRadius(frontMount), 86, 86 + frontMount.retainerThickness), frontMount.jointNote);
  const leverTravel = 2 * pose.stopDown, pinX = -19 + leverTravel, pinZ = -12;
  const footV = pinZ - FLOOR_TOP;
  m('lens.stop-down-pin', 'Chốt khẩu ống kính (nhô sau ngàm)', 'lens', 'lens.bayonet', 'per-snapshot', () => add('round', { F: ALONG_Y(pinX, pinZ), s0: 42, s1: 45.5, r: 0.7, tone: 'hi' }));
  m('body.stop-down-lever', 'Cần khép khẩu thân máy (chạm chốt; liên kết tới gương CHƯA dựng)', 'lens', 'mirror-box.floor', 'per-snapshot', () =>
    // Both mating surfaces use the pin-axis frame. u=0.7 is the same stored radius as the cylinder,
    // so the sliding tangent is exact in RAW and PACK. The lever tip ends at the pin equator (v=0),
    // not 2 mm above it: its top edge pushes the cylinder along the full 1 mm axial engagement.
    // Derive the foot from the shared floor datum. This exact subtraction and lossless ring
    // preserve the finite foot patch through RAW and PACK, without changing the pin tangent.
    add('prism', { F: ALONG_Y(pinX, pinZ), ringPrecision: 'lossless', polygon: [[0.7, 0], [2.2, 0], [2.2, footV], [0.7, footV]], s0: 38, s1: 43, tone: 'mid' }));

  // Focal-plane shutter: two thin cloth curtains, leading bars INSIDE their opaque side, guides, four supported
  // axis assemblies (source order: K1000 repair text PDF 89-91; dimensions illustrative), bearings and plates.
  // Opening (first) cloth runs in FRONT of the closing (second) cloth (Fig.176): SH.firstY > SH.secondY.
  const half = SH.halfHeight;
  const firstX = pose.firstX, secondX = pose.secondX;
  const AX = shutterAxes(), leftRoller = AX.openingTakeup.x, rightRoller = AX.closingWinding.x;

  // A stem rises outside the cloth at its own y plane; only the lane-level shoe
  // reaches forward. Separate lane heights prevent one curtain's shoe crossing the other.
  const tapeAnchor=(family,x0,x1,y0,y1)=>{
    const [a,b]=SH.tapes.lanes[family];
    for(const sign of [-1,1]){
      const z0=sign>0?half:-a,z1=sign>0?a:-half;
      // The rear curtain stem stays on its own rear face until its higher lane.
      // It cannot cross the lower opening-tape lane on the way up.
      box(x0,x1,y0,family==='second'?SH.secondY:y1,z0,z1,{tone:'mid',ringPrecision:'lossless'});
      box(x0,x1,y0,SH.tapes.anchorFacesY[family],sign>0?a:-b,sign>0?b:-a,{tone:'mid',ringPrecision:'lossless'});
    }
  };
  m('shutter.first-cloth', 'Rèm vải thứ nhất (lụa phủ cao su, mặt phẳng TRƯỚC), che x≤mép', 'shutter', 'shutter.opening-takeup-roller', 'per-snapshot', () =>
    box(leftRoller, Math.max(leftRoller + 0.5, firstX - SH.barWidth), SH.firstY, SH.firstY + SH.cloth, -half, half, { tone: 'lo' }));
  m('shutter.first-bar', 'Thanh mép rèm 1 (nằm phía vải kín)', 'shutter', 'shutter.first-cloth', 'per-snapshot', () =>
    { box(firstX - SH.barWidth, firstX, SH.firstY - 0.1, SH.firstY + SH.cloth + 0.2, -half, half, { tone: 'mid' }); tapeAnchor('first',firstX-SH.barWidth,firstX,SH.firstY-0.1,SH.firstY+SH.cloth+0.2); });
  m('shutter.second-cloth', 'Rèm vải thứ hai (mặt phẳng SAU), che x≥mép', 'shutter', 'shutter.closing-winding-roller', 'per-snapshot', () =>
    box(Math.min(rightRoller - 0.5, secondX + SH.barWidth), rightRoller, SH.secondY, SH.secondY + SH.cloth, -half, half, { tone: 'lo' }));
  m('shutter.second-bar', 'Thanh mép rèm 2 (nằm phía vải kín)', 'shutter', 'shutter.second-cloth', 'per-snapshot', () =>
    { box(secondX, secondX + SH.barWidth, SH.secondY - 0.08, SH.secondY + SH.cloth + 0.2, -half, half, { tone: 'mid' }); tapeAnchor('second',secondX,secondX+SH.barWidth,SH.secondY-0.08,SH.secondY+SH.cloth+0.2); });
  for (const side of ['top', 'bottom']) {
    const z0 = side === 'top' ? half + 0.2 : -half - 1.0, z1 = z0 + 0.8;
    m(`shutter.guide-${side}`, 'Ray có rãnh stem và shoe, mặt dẫn thật và hai đầu nguyên tựa gờ khung', 'shutter', 'shutter.frame-left', 'fixed', () => {
      let stock=[[[-24.6,24.6],[1.7,3.4],[z0,z1]]];const sign=side==='top'?1:-1;
      for(const family of ['first','second']){
        const first=family==='first',y0=first?SH.firstY-0.1:SH.secondY-0.08,y1=first?SH.firstY+SH.cloth+0.2:SH.secondY,[a,b]=SH.tapes.lanes[family];
        for(const cut of [[[-23.6,23.6],[y0,y1],[z0,z1]],[[-24.6,24.6],[SH.secondY-0.08,3.4],sign>0?[a,b]:[-b,-a]]])stock=stock.flatMap(piece=>boxMinus(piece,cut));
      }
      // The inner bottom land above the first tape lane used to be only 0.05 mm
      // thick. Give this continuous web a 0.125 mm section, leaving 0.125 mm
      // to the cloth edge; the tape channel and stem guide faces stay unchanged.
      const landTop = -SH.tapes.lanes.first[0] + 0.125;
      for(const [[x0,x1],[y0,y1],[a,b]]of stock) {
        const top = side === 'bottom' && y0 === SH.secondY && y1 === SH.firstY - 0.1 && b === z1 ? landTop : b;
        rawBox(x0,x1,y0,y1,a,top,{tone:'mid',ringPrecision:'lossless'});
      }
    });
  }
  const [pz0, pz1] = HW.plateZ, TH = HW.tubeHalf, gap = HW.axialGap, c = HW.runningClearance, e = HW.pinionEndplay, FL = HW.bushFlange;
  // Axial datums: lower bush flange top face = the seat of every shaft shoulder and the bottom of every stack.
  const seat = -pz0 + FL.height, gh = HW.guideHeight, lsh = HW.lowerSpacerHeight;
  // Ring of n sector prisms about a vertical axis: bore FLAT radius rb (inscribed), outer FLAT radius ro.
  const WC = HW.windingCouplings;
  const openingKey = z => z > 0 ? WC.openingUpper : WC.openingLower;
  const ringZ = (a, rb, ro, z0, z1, n, o = {}, phase = Math.PI / n) => {
    const shared=['shutter.opening-takeup-guides','shutter.closing-winding-guides','shutter.opening-winding-tape-ends','shutter.closing-takeup-roller','shutter.closing-winding-e-ring'].includes(active.id);
    if(shared){const inner=rollerOutline(a,rb,n),outer=rollerOutline(a,ro,n);for(let i=0;i<n;i++){const j=(i+1)%n;if(active.id==='shutter.closing-winding-e-ring'&&(i===0||i===7))continue;const poly=[inner[i],outer[i],outer[j],inner[j]],key=active.id==='shutter.opening-winding-tape-ends'?openingKey(z0):active.id==='shutter.closing-winding-roller'?WC.closing:null;for(const polygon of key?broachKeyway(poly,a,key,2*c):[poly])add('prism',{F:UP(),polygon,s0:z0,s1:z1,...o,ringPrecision:'lossless'});}}
    else {
      const k = 1 / Math.cos(Math.PI / n);
      const keyed = active.id === 'shutter.closing-winding-roller';
      if (keyed && (n % 4 !== 0 || phase !== Math.PI / n)) throw new Error('closing roller flat requires the declared regular-sector topology');
      // The lower outer edge spans these two source vertices. Keep the original
      // frame and broached cells; only its endpoints share the cloth's authored Y.
      const flatIndices = [3 * n / 4 - 1, 3 * n / 4];
      const flatLocalY = SH.secondY + SH.cloth - a.y;
      // Shared source vertices include the seam. Adjacent clipped cells consume
      // canonical edge intersections from broachKeyway, never reconstructed faces.
      const vertices = r => Array.from({length:n},(_,i)=>{const t=phase+2*Math.PI*i/n;return [r*k*Math.cos(t),r*k*Math.sin(t)];});
      const inner=vertices(rb),outer=vertices(ro);
      const cells=keyed?Array.from({length:n},(_,i)=>{const j=(i+1)%n;return [inner[i],outer[i],outer[j],inner[j]];}):sectors(rb*k,ro*k,n,phase);
      cells.forEach((poly, sectorIndex) => {
        const flatSources = new Set();
        if (keyed) for (const [slot, index] of [[1, sectorIndex], [2, (sectorIndex + 1) % n]]) {
          if (flatIndices.includes(index)) flatSources.add(poly[slot]);
        }
        for (const polygon of keyed ? broachKeyway(poly, { x: 0, y: 0 }, WC.closing,2*c) : [poly]) {
          const authored = keyed ? polygon.map(p => flatSources.has(p) ? [p[0], flatLocalY] : p) : polygon;
          add('prism', { F: UP(a.x, a.y), polygon: authored, s0: z0, s1: z1, ...o, ...(keyed ? { ringPrecision: 'lossless' } : {}) });
        }
      });
    }
  };
  // Plate with square bearing holes; the square-bodied bush fills the hole face-to-face (no rotation, no line contact).
  const holedPlate = (R, z0, z1, holes) => {
    let y = R.y[0];
    for (const q of [...holes].sort((p, r) => p.y - r.y)) {
      box(R.x[0], R.x[1], y, q.y - q.h, z0, z1, { tone: 'lo' });
      box(R.x[0], q.x - q.h, q.y - q.h, q.y + q.h, z0, z1, { tone: 'lo' }); box(q.x + q.h, R.x[1], q.y - q.h, q.y + q.h, z0, z1, { tone: 'lo' });
      y = q.y + q.h;
    }
    box(R.x[0], R.x[1], y, R.y[1], z0, z1, { tone: 'lo' });
  };
  const hole = (a) => ({ x: a.x, y: a.y, h: a.bush });
  // Square ring of 4 boxes about (x, y): inner half-side ri, outer ro (joined by shared side faces).
  const squareFrame = (x, y, ri, ro, z0, z1, o) => {
    box(x - ro, x + ro, y - ro, y - ri, z0, z1, o); box(x - ro, x + ro, y + ri, y + ro, z0, z1, o);
    box(x - ro, x - ri, y - ri, y + ri, z0, z1, o); box(x + ri, x + ro, y - ri, y + ri, z0, z1, o);
  };
  const SL = HW.stakedLip, RL = HW.railLedge;
  const frame = (side, R, col, holesTop, holesBottom) => m(`shutter.frame-${side}`, side === 'left'
    ? 'Khung đúc phía take-up: tấm trên + dưới có lỗ ổ trục, mép tán giữ vành ổ trên, cột tựa đế, giá + gờ đỡ hai ray'
    : 'Khung đúc phía cuốn: tấm trên có lỗ ổ trục, mép tán giữ vành ổ trên, cột có rãnh kẹp mép tấm đỡ trục cuốn, giá + gờ đỡ hai ray', 'shutter', 'body.base-plate', 'fixed', () => {
    holedPlate(R, pz0, pz1, holesTop);
    if (holesBottom) holedPlate(R, -pz1, -pz0, holesBottom);
    // Staked lip (illustrative ordinary practice): a casting rim around each upper bush flange, rolled over the
    // flange top by SL.overhang; the lip bore (half-side flange - overhang) clears the shaft journal.
    for (const q of holesTop) {
      const hf = q.h + FL.overhang;
      squareFrame(q.x, q.y, hf, hf + SL.rim, pz1, pz1 + FL.height, { tone: 'mid' });
      squareFrame(q.x, q.y, hf - SL.overhang, hf + SL.rim, pz1 + FL.height, pz1 + FL.height + SL.height, { tone: 'mid' });
    }
    box(col.x[0], col.x[1], col.y[0], col.y[1], B.z[0] + 2.4, -pz1, { tone: 'lo' });
    box(col.x[0], col.x[1], col.y[0], col.y[1], -pz0, pz0, { tone: 'lo' });
    // Right column: a web in front of the support plate edge joins the column below and above it, so the plate edge
    // sits in a real slot of ONE casting (seated on the lower column, capped by the upper column).
    if (!holesBottom) box(col.x[0], col.x[1], col.y[0] - HW.columnWeb, col.y[0], -pz1 - 1, -pz0 + 1, { tone: 'lo' });
    // Rail brackets with -z ledges: each rail end rests on a positive-area ledge face (top ledge stays above the cloth).
    const bx = side === 'left' ? [-24.6 - HW.railBracket, -24.6] : [24.6, 24.6 + HW.railBracket];
    const lx = side === 'left' ? [bx[0], -24.6 + RL.width] : [24.6 - RL.width, bx[1]];
    box(lx[0], lx[1], 1.7, 3.4, half + 0.2 - RL.topThickness, half + 0.2, { tone: 'mid' }); box(bx[0], bx[1], 1.7, 3.4, half + 0.2, pz0, { tone: 'mid' });
    // Bottom ledge on the lower plate face; on the right it runs as a rib along the support plate to the column.
    const blx = side === 'left' ? lx : [lx[0], col.x[0]];
    box(blx[0], blx[1], 1.7, 3.4, -pz0, -half - 1.0, { tone: 'mid' }); box(bx[0], bx[1], 1.7, 3.4, -half - 1.0, -half - 0.2, { tone: 'mid' });
  });
  const { openingTakeup: OT, closingTakeup: CT, openingWinding: OW, closingWinding: CW } = AX;
  frame('left', HW.frameLeft, HW.columnLeft, [hole(OT), hole(CT)], [hole(OT), hole(CT)]);
  frame('right', HW.frameRight, HW.columnRight, [hole(OW), hole(CW)], null);
  m('shutter.winding-support-plate', 'Tấm đỡ trục cuốn (dưới; mép kẹp trong rãnh cột khung, 3 vít định vị chưa dựng) có lỗ ổ teflon', 'shutter', 'shutter.frame-right', 'fixed', () => holedPlate(HW.frameRight, -pz1, -pz0, [hole(OW), hole(CW)]));
  // Square-bodied bush with an octagonal running bore (flat radius rb): 8 convex quads between the bore octagon and
  // the square of half-side h, split on the octagon vertex rays (0, 45, ... deg) so each quad has two square points.
  const squareRing = (a, rb, h, z0, z1, o) => {
    const k = rb / Math.cos(Math.PI / 8);
    // Exact square corners/midpoints use the same absolute datums as holedPlate and squareFrame.
    // Trigonometry is only for the octagonal running bore, never for the square mounting faces.
    const square = [[h, 0], [h, h], [0, h], [-h, h], [-h, 0], [-h, -h], [0, -h], [h, -h], [h, 0]];
    const at = ([x, y]) => [a.x + x, a.y + y];
    for (let i = 0; i < 8; i++) {
      const t0 = i * Math.PI / 4, t1 = (i + 1) * Math.PI / 4;
      add('prism', { F: UP(), polygon: [at([k * Math.cos(t0), k * Math.sin(t0)]), at(square[i]), at(square[i + 1]), at([k * Math.cos(t1), k * Math.sin(t1)])], s0: z0, s1: z1, ...o });
    }
  };
  // Upper bush: body in the upper plate hole, flange ON the plate top. Lower bush: body in the lower plate hole, flange
  // ON the lower plate top (inside the frame). Both hang on their flange: positive-area seat on the plate face.
  const bushes = (list) => () => list.forEach((a) => {
    const rb = a.shaft + c, hf = a.bush + FL.overhang;
    squareRing(a, rb, a.bush, pz0, pz1, { tone: 'hi' }); squareRing(a, rb, hf, pz1, pz1 + FL.height, { tone: 'hi' });
    squareRing(a, rb, a.bush, -pz1, -pz0, { tone: 'hi' }); squareRing(a, rb, hf, -pz0, seat, { tone: 'hi' });
  });
  m('shutter.takeup-bearings', 'Ổ đỡ lỗ trên/dưới của hai trục tâm take-up (khe chạy hướng kính khai báo)', 'shutter', 'shutter.frame-left', 'fixed', bushes([OT, CT]));
  m('shutter.winding-bearings', 'Ổ teflon trên/dưới của hai trục bánh răng cuốn (khe chạy hướng kính khai báo)', 'shutter', 'shutter.frame-right', 'fixed', bushes([OW, CW]));
  // Stepped shaft (one integral piece): journal radius a.shaft runs in both bushes with radial running clearance c;
  // the body radius a.body sits between. The lower shoulder (body bottom) is SEATED on the lower bush flange top; the
  // top step is the upward stop. Opening pinion: the body ends at pinionStep and the upper journal carries the upper tape end.
  const shaft = (a, bodyTop, steps = [[bodyTop, a.body]]) => () => { // steps: [top z, radius] between the journals
    let z = -pz1;
    for (const [z1, r] of [[seat, a.shaft], ...steps, [pz1 + FL.height, a.shaft]]) { add('round', { F: UP(a.x, a.y), s0: z, s1: z1, r, tone: 'hi' }); z = z1; }
  };
  const keyedShaft = (a, top, steps, keys) => () => {
    // A turned integral shaft, partitioned at real shoulders. Counterbored spacers
    // clear these collars; no separate floating ring is joined by an owner label.
    const collars = a === OW ? WC.capture.openingCollars : [];
    let lo=-pz1;for(const [hi,r] of [[seat,a.shaft],...steps,[pz1+FL.height,a.shaft]]){
      const cuts=[...new Set([lo,...keys.flatMap(q=>q.z),...collars.flatMap(q=>q.z),hi].filter(z=>z>=lo&&z<=hi))].sort((a,b)=>a-b);
      for(let i=0;i+1<cuts.length;i++){const s0=cuts[i],s1=cuts[i+1],q=keys.find(q=>s0>=q.z[0]&&s1<=q.z[1]);
        const collar=collars.find(q=>s0>=q.z[0]&&s1<=q.z[1]);
        if(q){const local=a===CW;add('prism',{F:local?UP(a.x,a.y):UP(),polygon:flatShaftCore(local?{x:0,y:0}:a,q,r),s0,s1,ringPrecision:'lossless',tone:'hi'});}
        else add('round',{F:UP(a.x,a.y),s0,s1,r:collar?collar.radius:r,tone:'hi'});
      }lo=hi;
    }
    for(const q of keys){const local=a===CW;add('prism',{F:local?UP(a.x,a.y):UP(),polygon:keyRectangle(local?{x:0,y:0}:a,q),s0:q.z[0],s1:q.z[1],ringPrecision:'lossless',tone:'hi'});}
  };
  const onBody = (a) => a.body + c, onJournal = (a) => a.shaft + c;
  // Take-up side (back-view -x): central shafts are STATIONARY during release; the rollers spin around them (PDF89).
  // Seated stacks (bottom -> top, each element ON the one below; free endplay only at the top under the upper bush):
  // opening take-up: spacer, guide, drum, guide, spacer | closing take-up: spacer, drum, spacer.
  m('shutter.opening-takeup-shaft', 'Trục tâm cố định bậc vai (vai dưới tựa vành ổ dưới) của trống take-up rèm mở', 'shutter', 'shutter.takeup-bearings', 'fixed (tension worm not built)', shaft(OT, pz0 - gap));
  m('shutter.opening-takeup-roller', 'Trống take-up rèm mở (tựa con lăn dẫn dưới); vải rèm 1 tiếp tuyến mặt phẳng phía sau trống', 'shutter', 'shutter.opening-takeup-guides', 'spins on central shaft (wrap not modelled)', () => ringZ(OT, onBody(OT), OT.flat, -TH, TH, 16, { tone: 'mid' }));
  m('shutter.opening-takeup-guides', 'Con lăn dẫn teflon trên (theo nguồn) + dưới (suy ra từ “guide rollers” số nhiều); dưới tựa vòng đệm, trên tựa trống', 'shutter', 'shutter.opening-takeup-spacers', 'spins on central shaft', () => {
    ringZ(OT, onBody(OT), HW.guideRadius.takeup, seat + lsh, -TH, 12, { tone: 'hi' });
    ringZ(OT, onBody(OT), HW.guideRadius.takeup, TH, TH + gh, 12, { tone: 'hi' });
  });
  m('shutter.opening-takeup-spacers', `Vòng đệm dưới (tựa vành ổ) + trên (tựa con lăn dẫn; khe dọc trục ${gap} mm minh họa dưới ổ trên)`, 'shutter', 'shutter.takeup-bearings', 'rides on shaft', () => {
    ringZ(OT, onBody(OT), HW.spacerOuter.takeup, seat, seat + lsh, 8, { tone: 'lo' });
    ringZ(OT, onBody(OT), HW.spacerOuter.takeup, TH + gh, pz0 - gap, 8, { tone: 'lo' });
  });
  m('shutter.closing-takeup-shaft', 'Trục tâm cố định bậc vai (vai dưới tựa vành ổ dưới) của trống take-up rèm đóng', 'shutter', 'shutter.takeup-bearings', 'fixed (tension worm not built)', shaft(CT, pz0 - gap));
  m('shutter.closing-takeup-roller', 'Trống take-up rèm đóng (phía TRƯỚC trống mở, Fig.177; tựa vòng đệm dưới); băng kéo CHƯA dựng', 'shutter', 'shutter.closing-takeup-spacers', 'spins on central shaft (tape wrap not modelled)', () => { ringZ(CT, onBody(CT), CT.flat, -TH, TH, 16, { tone: 'mid' }); for(const sign of [-1,1]) { const [a,b]=SH.tapes.lanes.second; ringZ(CT,HW.spacerOuter.takeup/Math.cos(Math.PI/8)+HW.runningClearance,CT.flat,sign>0?TH:-b,sign>0?b:-TH,16,{tone:'mid',ringPrecision:'lossless'}); } });
  m('shutter.closing-takeup-spacers', `Ống đệm dưới (tựa vành ổ) + trên (tựa trống; khe dọc trục ${gap} mm minh họa dưới ổ trên)`, 'shutter', 'shutter.takeup-bearings', 'rides on shaft', () => {
    ringZ(CT, onBody(CT), HW.spacerOuter.takeup, seat, -TH, 8, { tone: 'lo' });
    ringZ(CT, onBody(CT), HW.spacerOuter.takeup, TH, pz0 - gap, 8, { tone: 'lo' });
  });
  // Winding side (back-view +x): two pinion shafts in teflon bearings; opening shaft closer to camera front (PDF89-90).
  // The source 0.15 mm pinion endplay is the free axial travel of each seated pinion stack, taken at the TOP.
  m('shutter.opening-winding-shaft', 'Trục bánh răng cuốn rèm mở bậc vai (không rãnh E; vai dưới tựa vành ổ; thân lớn chặn đầu băng dưới, bậc trên đỡ đầu băng trên; bánh răng CHƯA dựng)', 'shutter', 'shutter.winding-bearings', 'rotates in bearings', keyedShaft(OW, HW.pinionStep, [[seat + HW.largeSpacerHeight + HW.tapeEndHeight, OW.body], [HW.pinionStep, HW.pinionShank]], [WC.openingLower, WC.openingUpper]));
  m('shutter.opening-winding-tape-ends', 'Cụm đầu băng trên/dưới có rãnh then mở thật, ăn khớp hai then liền thân trục; minh họa, không phải pin screw nhà máy', 'shutter', 'shutter.opening-winding-spacers', 'positive integral key coupling; illustrative static profiles', () => {
    ringZ(OW, onBody(OW), HW.tapeEndRadius, seat + HW.largeSpacerHeight, seat + HW.largeSpacerHeight + HW.tapeEndHeight, 8, { tone: 'mid' });
    ringZ(OW, onJournal(OW), HW.tapeEndRadius, HW.pinionStep, HW.pinionStep + HW.tapeEndHeight, 8, { tone: 'mid' });
  });
  m('shutter.opening-winding-spacers', `Vòng đệm lớn dưới (tựa vành ổ) + vòng đệm trên (tựa đầu băng; khe dọc trục ${e} mm theo nguồn dưới ổ trên)`, 'shutter', 'shutter.winding-bearings', 'rides on shaft', () => {
    ringZ(OW, WC.capture.openingCollars[0].spacerBore, HW.spacerOuter.large, seat, seat + HW.largeSpacerHeight, 8, { tone: 'lo' });
    ringZ(OW, WC.capture.openingCollars[1].spacerBore, HW.spacerOuter.small, HW.pinionStep + HW.tapeEndHeight, pz0 - e, 8, { tone: 'lo' });
  });
  m('shutter.closing-winding-shaft', 'Trục cuốn rèm đóng một thân có then liền và rãnh vòng chặn thật; vai dưới tựa vành ổ; bánh răng CHƯA dựng', 'shutter', 'shutter.winding-bearings', 'rotates in bearings', keyedShaft(CW, pz0-e, [[WC.groove.z[0],CW.body],[WC.groove.z[1],WC.groove.rootRadius],[pz0-e,CW.body]], [WC.closing]));
  m('shutter.closing-winding-roller', 'Trống cuốn rèm đóng có rãnh then thật, tựa guide dưới; then liền trục truyền xoắn minh họa, không phải pin screw nhà máy', 'shutter', 'shutter.closing-winding-guides', 'positive integral key coupling; cloth face unchanged', () => ringZ(CW, onBody(CW), CW.flat, -TH, TH, 16, { tone: 'mid' }));
  m('shutter.closing-winding-guides', 'Con lăn dẫn teflon trên/dưới (nhỏ hơn bên take-up, PDF89); dưới tựa vòng đệm, trên tựa trống', 'shutter', 'shutter.closing-winding-retainers', 'spins on shaft', () => {
    ringZ(CW, onBody(CW), HW.guideRadius.winding, seat + lsh, -TH, 12, { tone: 'hi' });
    ringZ(CW, onBody(CW), HW.guideRadius.winding, TH, TH + gh, 12, { tone: 'hi' });
  });
  m('shutter.closing-winding-retainers', `Vòng đệm chặn dưới (tựa vành ổ) + trên (tựa vòng chặn xẻ; khe ${e} mm dưới ổ trên); vòng nhỏ trên tựa vòng chặn xẻ dưới nó, rãnh thật hai vai`, 'shutter', 'shutter.winding-bearings', 'rides on shaft', () => {
    ringZ(CW, onBody(CW), HW.spacerOuter.small, seat, seat + lsh, 8, { tone: 'lo' });
    ringZ(CW, onBody(CW), HW.spacerOuter.small, WC.groove.z[1], pz0 - e, 8, { tone: 'lo' });
  });
  m('shutter.closing-winding-e-ring','Vòng chặn xẻ 270 độ trong rãnh thật, dưới vòng đệm nhỏ; tương đương minh họa vòng E, không chứng nhận lắp đàn hồi','shutter','shutter.closing-winding-shaft','captured in machined shaft groove',()=>ringZ(CW,WC.groove.boreFlat,HW.spacerOuter.small,WC.groove.z[0],WC.groove.z[1],8,{tone:'hi'}));
  // Fixed guide heads meet their stems, whose ends meet the existing frame/support plates.
  for(const family of ['first','second']){const q=routeGuide(family),[a,b]=SH.tapes.lanes[family];
    m('shutter.'+family+'-route-guide','Guide phụ cố định tránh góc tai bản lề','shutter',family==='first'?'shutter.frame-right':'shutter.frame-left','fixed',()=>{
      const polygon=rollerOutline(q,q.flat,q.n);for(const sign of [-1,1]){
        add('prism',{F:UP(),polygon,s0:sign>0?a:-b,s1:sign>0?b:-a,ringPrecision:'lossless',tone:'hi'});
        post(q.x,q.y,sign>0?b:(family==='first'?-half-1:-pz0),sign>0?pz0:-b,0.2,{tone:'mid'});
      }
    });
  }
  const tapeRoutes=tapeRoutesFor(pose);
  for(const family of ['first','second']) m('shutter.'+family+'-tapes', 'Băng kéo rèm '+family+' qua guides, ngoài khổ vải', 'shutter', 'shutter.'+family+'-bar', 'same geometryPose(snapshot)', ()=>{
    for(const route of tapeRoutes.filter(r=>r.family===family))for(const segment of route.segments)add('prism',{F:UP(),polygon:segment.polygon,s0:route.z0,s1:route.z1,ringPrecision:'lossless',tone:'lo'});
  }, 'Illustrative taut polygonal routing; no force or factory timing claim.');

  // Gate, pressure plate and the physical film strip with real perforation voids at the model phase.
  m('gate.aperture-plate', 'Khung cửa phim 36×24 có lỗ thật', 'gate', 'shutter.frame-left', 'fixed', () => {
    box(-24, -18, 0.05, 1.6, -16, 16, { tone: 'lo' }); box(18, 24, 0.05, 1.6, -16, 16, { tone: 'lo' });
    box(-18, 18, 0.05, 1.6, 12, 16, { tone: 'lo' }); box(-18, 18, 0.05, 1.6, -16, -12, { tone: 'lo' });
  });
  m('back.pressure-plate', 'Tấm ép phim', 'back', 'back.pressure-spring', 'fixed', () => box(-22, 22, -1.4, -0.35, -15, 15, { tone: 'mid' }));
  m('back.pressure-spring', 'Lò xo lá tấm ép (gắn nắp lưng)', 'back', 'body.back-door', 'fixed', () => box(-3, 3, -6.6, -1.4, -2, 2, { tone: 'lo' }));
  const [cx, cy] = TR.cassette, [tx, ty] = TR.takeup, [sx, sy] = TR.sprocket;
  m('transport.cassette', 'Cassette 135 (minh họa)', 'transport', 'body.base-plate', 'fixed', () => post(cx, cy, -22, 22, TR.cassetteRadius, { tone: 'lo' }));
  m('transport.cassette-seat', 'Bệ cassette', 'transport', 'body.base-plate', 'fixed', () => box(cx - 10, cx + 10, cy - 6, cy + 6, -33.6, -22, { tone: 'lo' }));
  m('transport.takeup-spool', 'Lõi cuộn phim (wrap CHƯA dựng)', 'transport', 'transport.takeup-seat', 'rotates', () => post(tx, ty, -20, 20, TR.spoolRadius, { tone: 'mid' }));
  m('transport.takeup-seat', 'Bệ lõi cuộn', 'transport', 'body.base-plate', 'fixed', () => post(tx, ty, -33.6, -20, 4, { tone: 'lo' }));
  m('transport.sprocket', 'Trục răng (răng/ăn khớp PENDING)', 'transport', 'transport.sprocket-seat', 'rotates', () => post(sx, sy, -17.5, 17.5, TR.sprocketRadius, { tone: 'mid' }));
  m('transport.sprocket-seat', 'Bệ trục răng', 'transport', 'body.base-plate', 'fixed', () => post(sx, sy, -33.6, -17.5, 2.5, { tone: 'lo' }));
  m('controls.wind-hub', 'Moay-ơ cần lên phim trên mặt trên', 'controls', 'body.deck-right', 'fixed', () => post(tx, ty, 30.4, 32.4, 5, { tone: 'mid' }));
  m('controls.wind-lever', 'Cần lên phim ở góc model (bánh răng tới take-up CHƯA dựng)', 'controls', 'controls.wind-hub', 'per-snapshot', () => {
    const a = -pose.leverDegrees * RAD, rot = ([x, y]) => [tx + x * Math.cos(a) - y * Math.sin(a), ty + x * Math.sin(a) + y * Math.cos(a)];
    add('prism', { F: UP(), polygon: hull([[-3, -2], [3, -2], [2.5, -26], [-2, -26]].map(rot)), s0: 32.4, s1: 34, tone: 'hi' });
  });
  const filmParts = [];
  if (includeFilm) m('film.strip', 'Dải phim 135 liền (ảnh tiềm ẩn, KHÔNG phải ảnh dương)', 'transport', 'back.pressure-plate', 'per-snapshot', () => {
    const t = TR.filmThickness, h = TR.filmHalfWidth, pz = TR.perforationZ, [pw, ph] = TR.perforationSize, x0 = cx, x1 = tx;
    const band = (z0, z1) => box(x0, x1, -t, 0, z0, z1, { tone: 'lo' });
    band(-(pz - ph / 2), pz - ph / 2); band(pz + ph / 2, h); band(-h, -(pz + ph / 2));
    // Perforation centres move +x with the film; voids are the gaps between bridges.
    const centres = [];
    for (let c = x0 + pose.perforationPhase - TR.perforationPitch; c <= x1 + TR.perforationPitch; c += TR.perforationPitch) centres.push(c);
    for (let i = 0; i + 1 < centres.length; i++) {
      const a = Math.max(x0, centres[i] + pw / 2), b = Math.min(x1, centres[i + 1] - pw / 2);
      if (b - a > 0.05) for (const s of [-1, 1]) { const z0 = s > 0 ? pz - ph / 2 : -(pz + ph / 2); box(a, b, -t, 0, z0, z0 + ph, { tone: 'lo' }); }
    }
    filmParts.push(...centres.filter((c) => c - pw / 2 >= x0 && c + pw / 2 <= x1));
  });

  // Installed screws clamp the base plate from below into the casting bosses / shutter feet.
  // The round neck runs with declared clearance in the square clearance bore. The tip and
  // blind tapped bore have matching, exact prismatic faces: a STATIC IDEAL thread joint only.
  for (const f of FIXINGS) m(f.id, f.family === 'body' ? 'Vít cố định đế thân vào boss đúc' : 'Vít khung màn trập vào đế thân', f.family === 'body' ? 'body' : 'shutter', 'body.base-plate', 'fixed', () => {
    post(f.x, f.y, -37, -36, f.headRadius, { tone: 'hi' });
    post(f.x, f.y, -36, f.threadStart, f.neckRadius, { tone: 'hi' });
    const h = f.threadHalf;
    add('prism', { F: UP(), polygon: [[f.x-h,f.y-h],[f.x+h,f.y-h],[f.x+h,f.y+h],[f.x-h,f.y+h]], s0: f.threadStart, s1: f.threadTop, ringPrecision: 'lossless', tone: 'hi' });
  }, f.jointNote);

  const manifest = parts.map((p) => ({ ...p, solids: [...p.solids] }));
  const shapes = T.parts.flatMap((p) => p.shapes);
  return { schemaVersion: 1, T, recorder, P, W, H, pose, snapshot, parts: deepFreeze(manifest), perforationCentres: filmParts, section: { applied: section, removed },
    solidsWorld: T.parts.filter((p) => p.kind === 'prism' && p.world?.ring).map((p) => ({ name: p.name, owner: p.owner, ...p.world })),
    counts: { majorParts: manifest.length, drawParts: T.parts.length, solids: shapes.length, prismSolids: T.parts.filter((p) => p.kind === 'prism' && p.world?.ring).length } };
}

function buildGeometry(snapshot = defaultSnapshot(), { strict = true, verify = false, ...opts } = {}) {
  const g = makeGeometry(snapshot, opts);
  let built, problems = [];
  try { built = g.T.build({ strict, verify }); }
  catch (error) {
    if (!strict) throw error;
    problems = String(error.message).split('\n').slice(1).map((s) => s.trim()).filter(Boolean);
    const T2 = makeGeometry(snapshot, opts);
    built = T2.T.build({ strict: false, verify });
    Object.assign(g, T2);
  }
  return { ...g, built, order: { strict, unseparatedPairs: problems.length, unseparated: problems, tight: built.report.tight.length },
    svg: (label) => built.layerSvg('camera', { width: W, height: H, label }) };
}

// Independent exact segment vs convex extruded prism test (local slab + polygon half-planes clip).
function segmentHitsPrism(p, q, solid, eps = 1e-9) {
  const { F, ring, s0, s1 } = solid;
  const loc = (x) => { const d = G.sub3(x, F.o); return [G.dot3(d, F.a), G.dot3(d, F.u), G.dot3(d, F.v)]; };
  const a = loc(p), b = loc(q);
  let t0 = 0, t1 = 1;
  const clip = (fa, fb) => { // keep f(t) = fa + (fb-fa) t <= 0
    if (fa > eps && fb > eps) return false;
    if (fa <= eps && fb <= eps) return true;
    const t = fa / (fa - fb);
    if (fa > eps) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    return t0 <= t1;
  };
  if (!clip(s0 - a[0], s0 - b[0]) || !clip(a[0] - s1, b[0] - s1)) return false;
  const area = ring.reduce((s, r, i) => s + r[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * r[1], 0);
  for (let i = 0; i < ring.length; i++) {
    const r = ring[i], n = ring[(i + 1) % ring.length], ex = n[0] - r[0], ey = n[1] - r[1];
    const out = (pt) => (area > 0 ? 1 : -1) * -(ex * (pt[2] - r[1]) - ey * (pt[1] - r[0]));
    if (!clip(out(a), out(b))) return false;
  }
  return t1 - t0 > 1e-7;
}

return { "H": H, "P": P, "SECTION": SECTION, "TRANSMISSIVE_PARTS": TRANSMISSIVE_PARTS, "W": W, "WORLD": WORLD, "apertureRadius": apertureRadius, "boxMinus": boxMinus, "buildGeometry": buildGeometry, "curtainPhysicalX": curtainPhysicalX, "curtainTapeRoutes": curtainTapeRoutes, "defaultSnapshot": defaultSnapshot, "filmPointOfUV": filmPointOfUV, "filmUV": filmUV, "geometryPose": geometryPose, "irisStop": irisStop, "makeGeometry": makeGeometry, "mirrorTransform": mirrorTransform, "opticalClass": opticalClass, "reflect": reflect, "segmentHitsPrism": segmentHitsPrism, "shutterAxes": shutterAxes, "totalTransport": totalTransport };
})(void 0);
/* </module machine-geometry> */
return __m;
});
const createSlrNativeFactory = (function createSlrNativeFactory(mods) {
  'use strict';
  const geo = mods['machine-geometry'], TURN = mods.turn.TURN;
  const signature = value => JSON.stringify(value, (key, v) => Object.is(v, -0) ? { negativeZero: true } : v);
  const cache = new Map();
  let previousTopology = null, prepares = 0, emissions = 0, disposed = false, pairCount = -1, pairs = [], compiled = null;
  function packetOf(g) {
    const parts = g.T.parts.map(p => {
      if (!['prism', 'round'].includes(p.kind)) throw new Error(`slr packet: unsupported native primitive ${p.kind}`);
      const out = { name: p.name, kind: p.kind, group: p.group ? p.group.index : -1, layer: 0, spec: p.spec };
      if (p.tone !== 'hi') out.tone = p.tone;
      if (p.crease !== 'faint') out.crease = p.crease;
      if (p.lit) out.lit = true;
      if (p.material) out.mat = p.material;
      const details = {};
      const seams = p.kind === 'prism' ? p.localSeams : p.details.seams;
      if (seams?.length) details.seams = seams;
      if (p.details.ribs) details.ribs = p.details.ribs;
      if (Object.keys(details).length) out.details = details;
      if (p.planes.length || p.dots.length) throw new Error('slr packet: source surface details need explicit serialization');
      return out;
    });
    const ids = parts.map((p, i) => i);
    if (pairCount !== parts.length) {
      pairs = [];
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) pairs.push(i, j);
      pairCount = parts.length;
    }
    // Same declarative group fields as public turning.build; no pair campaign per frame.
    const groups = g.T.groups.map(group => ({
      name: group.name, parent: group.parent ? group.parent.index : -1, kind: group.kind,
      origin: group.origin, pivot: group.pivot, direction: group.direction, travel: group.travel,
      point: group.point, axis: group.axis, range: group.range, upright: group.upright,
      loose: group.loose || undefined,
    }));
    return { P: geo.P, groups, layers: [{ name: 'camera', parts: ids, rest: ids }], parts, routes: [], dynamic: { camera: pairs }, values: {} };
  }
  return {
    packetOf,
    build(snapshot) {
      if (disposed) throw new Error('slr native factory disposed');
      const started = performance.now(), geometry = geo.makeGeometry(snapshot), packet = packetOf(geometry);
      const topology = signature(packet.parts.map(p => [p.name, p.kind, p.spec.ring?.length ?? 0]));
      const rebuilt = previousTopology !== null && previousTopology !== topology;
      const compileTopology = !compiled || previousTopology !== topology;
      if (compileTopology) { compiled = TURN.prepare(packet, { unit: 1 }); prepares += packet.parts.length; }
      // Relationship fields come from a REAL native prepared scene. Copy only declarative public inputs;
      // never carry TURN.order's warm/GJK/rank/heap caches across a geometry change.
      const layers = compiled.layers.map(l => ({ index: l.index, name: l.name, parts: l.parts, local: l.local, rest: l.rest,
        planar: l.planar, framed: l.framed, groupPairs: l.groupPairs, dynamic: l.dynamic, free: l.free, looseAt: l.looseAt }));
      const scene = { ...compiled, data: packet, groups: packet.groups, runs: [], layers };
      const cams = TURN.cams(scene, {});
      const frames = [], seen = new Set();
      let changed = 0;
      for (const [index, part] of packet.parts.entries()) {
        if (seen.has(part.name)) throw new Error(`slr packet: duplicate ${part.name}`);
        seen.add(part.name);
        // Local specs may stay constant while their achieved group origin moves.
        const sig = signature([part, part.group < 0 ? null : packet.groups]);
        let entry = cache.get(part.name);
        if (!entry || entry.signature !== sig) {
          const one = { P: packet.P, groups: packet.groups, parts: [part], layers: [], routes: [] };
          const run = compileTopology ? compiled.runs[index] : TURN.prepare(one, { unit: 1 }).runs[0];
          if (!compileTopology) prepares++;
          const camera = part.group < 0 ? cams.world : cams[part.group];
          const frame = TURN.emit(run, camera, TURN.frame(run));
          emissions++; changed++;
          entry = { signature: sig, run, frame };
          cache.set(part.name, entry);
        }
        // Index is public packet membership, not a prescribed paint rank. Topology changes reindex all members.
        const run = { ...entry.run, index };
        scene.runs.push(run); frames.push(entry.frame);
      }
      for (const name of cache.keys()) if (!seen.has(name)) cache.delete(name);
      const stats = {};
      const orders = scene.layers.map(layer => Array.from(TURN.order(layer, frames, cams, null, stats, scene)));
      previousTopology = topology;
      return { geometry, packet, scene, frames, cams, orders, stats, changed, rebuilt, prepares, emissions, ms: performance.now() - started };
    },
    dispose() { disposed = true; cache.clear(); compiled = null; pairs = []; },
  };
});
return (function mountSlrRenderer(root, data, createProducer, createFactory) {
  'use strict';
  createFactory = createFactory || createSlrNativeFactory;
  const NS = 'http://www.w3.org/2000/svg';
  const fail = why => { throw new Error(`slr renderer: ${why}`); };
  const view = root.querySelector('[data-machine-view]');
  const caption = root.querySelector('[data-machine-scene] figcaption');
  const fallbacks = view ? Array.from(view.querySelectorAll('[data-slr-static]')) : [];
  const live = view?.querySelector('[data-slr-live]');
  if (!view || !caption || fallbacks.length !== 1 || !live) fail('view, caption, one static fallback and live layer required');
  // Precondition before constructor or any write: never clear a foreign/busy root.
  if (live.childNodes.length || caption.querySelector('[data-slr-readout]')) fail('live layer must start empty');
  if (!data || typeof data.worldText !== 'string') fail('data.worldText required');
  const mods = createProducer(data.worldText), geo = mods['machine-geometry'], TURN = mods.turn.TURN, k = mods['iso-kit'];
  const factory = createFactory(mods), doc = root.ownerDocument;
  const el = (tag, attrs = {}, parent = null) => {
    const n = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value));
    if (parent) parent.appendChild(n);
    return n;
  };
  const sceneLayer = el('g', { 'data-slr-scene': '', class: 'iso-live' });
  const readout = doc.createElement('p'); readout.setAttribute('data-slr-readout', ''); readout.setAttribute('class', 'slr-readout');
  const hiddenBefore = fallbacks.map(n => n.getAttribute('display')), priorAttrs = new Map(), groups = new Map();
  let disposed = false, committed = false, previous = null, lastBuild = null, latest = null, filmGroups = [];
  const cleanupErrors = [];
  const attempt = fn => { try { fn(); } catch (error) { cleanupErrors.push(error); } };
  const viewAttr = (key, value) => {
    if (!priorAttrs.has(key)) priorAttrs.set(key, view.getAttribute(key));
    view.setAttribute(key, String(value));
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    attempt(() => factory.dispose());
    attempt(() => { if (sceneLayer.parentNode) sceneLayer.parentNode.removeChild(sceneLayer); });
    attempt(() => { if (readout.parentNode) readout.parentNode.removeChild(readout); });
    fallbacks.forEach((n, i) => attempt(() => hiddenBefore[i] === null ? n.removeAttribute('display') : n.setAttribute('display', hiddenBefore[i])));
    for (const [key, value] of priorAttrs) attempt(() => value === null ? view.removeAttribute(key) : view.setAttribute(key, value));
    groups.clear(); filmGroups = []; latest = null;
  }
  function paintNative(build) {
    const assemblyOf = new Map(build.geometry.parts.map(p => [p.id, p.assembly]));
    const sourceOf = new Map(build.geometry.T.parts.map(p => [p.name, p]));
    const seen = new Set();
    for (const run of build.scene.runs) {
      const source = sourceOf.get(run.name), frame = build.frames[run.index];
      seen.add(run.name);
      let entry = groups.get(run.name);
      if (!entry) {
        const node = el('g', { class: 'slr-solid', 'data-solid': run.name, 'data-owner': source.owner, 'data-kind': run.kind,
          'data-assembly': assemblyOf.get(source.owner), 'data-optical': geo.opticalClass(source.owner), 'data-tone': source.tone });
        entry = { node, roles: [], signature: null }; groups.set(run.name, entry);
      }
      const topology = JSON.stringify(run.roles.map(r => [r.name, r.type]));
      if (entry.signature !== topology) {
        while (entry.node.firstChild) entry.node.removeChild(entry.node.firstChild);
        entry.roles = run.roles.map(role => {
          if (!['path', 'face', 'slot', 'xform', 'dot'].includes(role.type)) fail(`unsupported native role ${role.type}`);
          return el(role.type === 'dot' ? 'circle' : 'path', { 'data-r': role.name }, entry.node);
        });
        entry.signature = topology;
      }
      run.roles.forEach((role, i) => {
        const n = entry.roles[i];
        if (role.type === 'dot') {
          for (const [key, value] of Object.entries({ cx: Math.round(frame.cx[i] * 100) / 100, cy: Math.round(frame.cy[i] * 100) / 100, r: role.size, 'fill-opacity': frame.o[i] })) n.setAttribute(key, String(value));
        } else {
          n.setAttribute('d', role.type === 'xform' ? source.planPath : frame.d[i]);
          if (role.type === 'face') {
            n.setAttribute('class', 'iso-tn');
            const q = frame.q[i], band = Math.min(3, Math.floor(q / TURN.q)), mix = (q - TURN.q * band) / TURN.q;
            n.setAttribute('data-b', String(band));
            const style = [mix ? `--f:${mix}` : '', frame.w[i] >= 0 ? `stroke-width:${frame.w[i]}` : ''].filter(Boolean).join(';');
            if (style) n.setAttribute('style', style); else n.removeAttribute('style');
          } else {
            n.setAttribute('class', role.cls || '');
            if (role.shade !== undefined) n.setAttribute('data-shade', String(role.shade));
            if (role.tone !== undefined) n.setAttribute('data-tone', String(role.tone));
            if (role.type === 'slot') n.setAttribute('opacity', String(Math.round(frame.o[i] * 1000) / 1000));
            if (role.type === 'xform') n.setAttribute('transform', frame.t[i]);
          }
        }
      });
    }
    for (const [name, entry] of groups) if (!seen.has(name)) { if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node); groups.delete(name); }
    // This is exactly TURN.order on the same TURN.emit commands, not a second painter or caller-supplied order.
    for (const index of build.orders.flat()) sceneLayer.appendChild(groups.get(build.scene.runs[index].name).node);
  }
  const FILM = JSON.parse(data.worldText).transport;
  function paintFilm(snapshot, build) {
    for (const g of filmGroups) if (g.parentNode) g.parentNode.removeChild(g);
    filmGroups = [];
    const host = groups.get('film.strip');
    if (!host) fail('actual film.strip native item required');
    const V = build.cams.world.V, faceY = V[1] > 0 ? 0 : -FILM.filmThickness;
    const frames = [{ dose: snapshot.dose, offset: snapshot.advance, frame: snapshot.exposureFrame, role: 'exposing' }];
    if (snapshot.held && snapshot.held.frame !== snapshot.exposureFrame) frames.push({ dose: snapshot.held.dose, offset: data.model.pitch * (1 + snapshot.wind), frame: snapshot.held.frame, role: 'held' });
    let max = 0, drawn = 0;
    for (const f of frames) for (const d of f.dose) max = Math.max(max, d);
    for (const f of frames) {
      const g = el('g', { 'data-slr-film': '', 'data-frame': f.frame, 'data-frame-role': f.role, 'data-offset-mm': f.offset }, host.node);
      filmGroups.push(g);
      for (let r = 0; r < data.model.rows; r++) for (let c = 0; c < data.model.columns; c++) {
        const a = geo.filmPointOfUV(c / data.model.columns, r / data.model.rows), b = geo.filmPointOfUV((c + 1) / data.model.columns, (r + 1) / data.model.rows);
        const x0 = Math.max(FILM.cassette[0], a[0] + f.offset), x1 = Math.min(FILM.takeup[0], b[0] + f.offset);
        if (!(x1 > x0)) continue;
        const d = f.dose[r * data.model.columns + c], tone = Math.round(40 + 190 * (max > 0 ? d / max : 0));
        const points = [[x0, faceY, a[2]], [x1, faceY, a[2]], [x1, faceY, b[2]], [x0, faceY, b[2]]];
        el('path', { class: 'slr-cell', 'data-dose': d, fill: `rgb(${tone},${Math.round(tone * .72)},${Math.round(tone * .38)})`, d: k.pathOf(points.map(p => k.iso(p, geo.P)), true) }, g); drawn++;
      }
    }
    return drawn;
  }
  const fixed = (v, d) => (Object.is(v, -0) ? 0 : v).toFixed(d);
  return {
    render(snapshot, options = {}) {
      if (disposed) fail('disposed');
      try {
        if (snapshot !== previous) {
          const build = factory.build(snapshot);
          paintNative(build);
          const cells = paintFilm(snapshot, build);
          const exposureSum = snapshot.exposure.reduce((sum, value) => sum + value, 0), exposureMax = Math.max(...snapshot.exposure);
          const attrs = { 'data-snapshot-time': snapshot.time, 'data-stage': snapshot.stageKey, 'data-solids': build.packet.parts.length,
            'data-order-forced': build.stats.forced, 'data-order-unseparated': build.stats.unseparated, 'data-ordering': 'public-TURN.emit/order; sampled native release gate; real occlusion cycles disclosed',
            'data-advance': snapshot.advance, 'data-mirror': snapshot.mirror, 'data-aperture': snapshot.aperture, 'data-first': snapshot.curtains.first, 'data-second': snapshot.curtains.second,
            'data-gate-width': snapshot.gate.width, 'data-lever': snapshot.lever, 'data-film-cells': cells, 'data-changed-solids': build.changed };
          for (const [key, value] of Object.entries(attrs)) viewAttr(key, value);
          readout.textContent = `t ${fixed(snapshot.time, 3)} s · gương ${fixed(snapshot.mirror, 1)}° · f/${fixed(snapshot.aperture, 2)} · rèm ${fixed(snapshot.curtains.first, 2)}/${fixed(snapshot.curtains.second, 2)} mm · khe ${fixed(snapshot.gate.width, 2)} mm · phơi cột TB ${fixed(exposureSum / snapshot.exposure.length, 3)} (max ${fixed(exposureMax, 3)}) · kéo phim ${fixed(snapshot.advance, 2)} mm · cần ${fixed(snapshot.lever, 1)}° · khung ${snapshot.exposureFrame}→${snapshot.frame} — liều tiềm ẩn, phim chưa tráng`;
          lastBuild = { time: snapshot.time, solids: build.packet.parts.length, changed: build.changed, rebuilt: build.rebuilt, cells, ms: build.ms, prepares: build.prepares, emissions: build.emissions };
          latest = build; previous = snapshot;
        }
        viewAttr('data-slr-focus', options.focus || 'all');
        if (!committed) {
          // All native emission and item DOM creation succeeded while detached. Fallback stays until commit ends.
          if (live.childNodes.length) fail('live layer became busy before commit');
          live.appendChild(sceneLayer); caption.appendChild(readout);
          fallbacks.forEach(n => n.setAttribute('display', 'none'));
          committed = true;
        }
      } catch (error) { dispose(); throw error; }
    },
    inspect() { return { lastBuild, latest, groups: groups.size, sceneLayer, filmGroups: filmGroups.slice(), readout, disposed, committed, cleanupErrors: cleanupErrors.slice(), order: latest?.stats ?? null }; },
    dispose,
  };
})(root, data, createSlrNativeProducer, createSlrNativeFactory);
});
runtime.boot({
  slug: "slr-film-camera",
  descriptor: {"title":"Máy ảnh SLR phim 35 mm — mặt cắt minh họa","steps":[{"key":"mirror-up","title":"Gương lật lên, khẩu khép","explanation":"Gương phản xạ quay quanh trục bản lề tới góc của snapshot; chốt khép khẩu đưa iris từ f/4 xuống f/8. Cửa phim vẫn đóng."},{"key":"first-curtain","title":"Rèm đầu chạy","explanation":"Rèm vải thứ nhất cuộn đi theo đúng mép model; phần phim đã lộ bắt đầu nhận sáng theo cột."},{"key":"expose","title":"Cửa phim mở hoàn toàn","explanation":"Cả khung 36×24 mở; phơi sáng của từng cột tăng theo thời gian thực của model (đã giãn hiển thị)."},{"key":"second-curtain","title":"Rèm thứ hai đóng","explanation":"Rèm thứ hai đi cùng chiều, kết thúc phơi từng cột; tổng phơi mỗi cột gần bằng nhau."},{"key":"mirror-down","title":"Gương hạ, khẩu mở lại","explanation":"Cửa phim đã đóng; gương trở lại vị trí ngắm và iris mở về f/4."},{"key":"wind","title":"Lên phim và lên cò","explanation":"Cần gạt quay, phim dịch đúng một bước 38 mm mang theo ảnh tiềm ẩn; hai rèm hồi về có overlap kín."},{"key":"ready","title":"Sẵn sàng khung mới","explanation":"Khung mới ở cửa phim; khung vừa chụp được giữ lại dưới dạng ảnh tiềm ẩn chưa tráng."}],"controls":{"runLabel":"Chạy chu kỳ","replayLabel":"Lên khung mới và chụp lại","filmOptions":[]}},
  data: {"model":{"width":36,"height":24,"columns":32,"rows":20,"scene":[0.15,0.17,0.19,0.21,0.23,0.25,0.27,0.29,0.31,0.33,0.35,0.37,0.39,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.16,0.18,0.2,0.22,0.24,0.26,0.28,0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.17,0.19,0.21,0.23,0.25,0.27,0.29,0.31,0.33,0.35,0.37,0.39,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,1,1,1,1,1,0.75,0.77,0.79,0.18,0.2,0.22,0.24,0.26,0.28,0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,1,1,1,1,1,0.76,0.78,0.8,0.19,0.21,0.23,0.25,0.27,0.29,0.31,0.33,0.35,0.37,0.39,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,1,1,1,1,1,0.77,0.79,0.81,0.2,0.22,0.24,0.26,0.28,0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.21,0.23,0.25,0.27,0.29,0.08,0.08,0.08,0.37,0.39,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.22,0.24,0.26,0.28,0.3,0.08,0.08,0.08,0.38,0.4,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.23,0.25,0.27,0.29,0.31,0.08,0.08,0.08,0.39,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.24,0.26,0.28,0.3,0.32,0.08,0.08,0.08,0.4,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.25,0.27,0.29,0.31,0.33,0.08,0.08,0.08,0.41,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.87,0.26,0.28,0.3,0.32,0.34,0.08,0.08,0.08,0.42,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.88,0.27,0.29,0.31,0.33,0.35,0.08,0.08,0.08,0.43,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.87,0.89,0.28,0.3,0.32,0.34,0.36,0.08,0.08,0.08,0.44,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.88,0.9,0.29,0.31,0.33,0.35,0.37,0.08,0.08,0.08,0.45,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.87,0.89,0.91,0.3,0.32,0.34,0.36,0.38,0.08,0.08,0.08,0.46,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.88,0.9,0.92,0.31,0.33,0.35,0.37,0.39,0.08,0.08,0.08,0.47,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.87,0.89,0.91,0.93,0.32,0.34,0.36,0.38,0.4,0.08,0.08,0.08,0.48,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.88,0.9,0.92,0.94,0.33,0.35,0.37,0.39,0.41,0.08,0.08,0.08,0.49,0.51,0.53,0.55,0.57,0.59,0.61,0.63,0.65,0.67,0.69,0.71,0.73,0.75,0.77,0.79,0.81,0.83,0.85,0.87,0.89,0.91,0.93,0.95,0.34,0.36,0.38,0.4,0.42,0.08,0.08,0.08,0.5,0.52,0.54,0.56,0.58,0.6,0.62,0.64,0.66,0.68,0.7,0.72,0.74,0.76,0.78,0.8,0.82,0.84,0.86,0.88,0.9,0.92,0.94,0.96],"travelSeconds":0.015,"exposureSeconds":0.03333333333333333,"displayScale":100,"fStop":8,"viewFStop":4,"iso":100,"irradiance":1,"pitch":38,"overlap":1,"mirrorDegrees":90,"leverDegrees":160,"takeupRadius":10,"firstFrame":1,"reducedCadence":0.35,"reducedPolicy":"hold-entire-achieved-snapshot; commit-remaining-current-stage at bounded real-dt cadence; no catch-up","stages":[{"key":"mirror-up","duration":0.8},{"key":"first-curtain","duration":1.5416666666666665},{"key":"expose","duration":1.8333333333333333},{"key":"second-curtain","duration":1.5416666666666665},{"key":"mirror-down","duration":0.65},{"key":"wind","duration":2.4},{"key":"ready","duration":0.5}]},"worldText":"{\n  \"schemaVersion\": 1,\n  \"units\": \"mm-illustrative\",\n  \"disclaimer\": \"Educational K1000-referenced cutaway. All dimensions are illustrative, NOT manufacturer measurements; lens/prism interiors are not factory CAD. Only the 36x24 gate and the model profile come from the authored model.\",\n  \"width\": 960,\n  \"height\": 640,\n  \"camera\": {\n    \"azimuth\": 58,\n    \"elevation\": 12,\n    \"pad\": 40\n  },\n  \"coordinates\": {\n    \"axes\": \"+z up; +y camera front (toward subject); +x photographer-right when viewed from the BACK. Optical axis is x=0,z=0, light travels -y.\",\n    \"curtainX\": \"model curtain/gate x equals world x directly (model edges are rear-view x in mm). First curtain covers x\u003c=first; second covers x>=second.\",\n    \"film\": \"emulsion plane y=0; gate x in [-18,18], z in [-12,12]. filmUV u=(x+18)/36, v=(12-z)/24 (rear view, latent exposure map only).\",\n    \"mirror\": \"model mirror m in [0,90] is RELATIVE. Physical hinge lift = m/90*liftDegrees about +x through mirror.pivot. Rest reflective normal (0,1,1)/sqrt2.\"\n  },\n  \"optics\": {\n    \"focal\": 50,\n    \"principalY\": 50,\n    \"flangeY\": 45.5,\n    \"filmY\": 0,\n    \"mirrorCentre\": [\n      0,\n      26,\n      0\n    ],\n    \"screenZ\": 26,\n    \"gateHalf\": [\n      18,\n      12\n    ],\n    \"irisEdgeHalf\": 0.05,\n    \"irisBladeHalf\": 0.4,\n    \"irisEdgeWidth\": 1.2,\n    \"irisSegments\": 16\n  },\n  \"mirror\": {\n    \"sUpper\": -22,\n    \"sLower\": 12,\n    \"halfWidth\": 19,\n    \"glass\": 1.2,\n    \"carrier\": 1,\n    \"pivot\": [\n      5.5,\n      14.3\n    ],\n    \"liftDegrees\": 45,\n    \"earInner\": 19.4,\n    \"earRootLength\": 2,\n    \"restPadDepth\": 1,\n    \"interfaceNote\": \"ILLUSTRATIVE mm, not factory CAD: carrier terminates at x=\\u00b119.4; outboard bored ears retain the original 2 mm root meeting carrier cap faces. Rest pad and mirror trajectory unchanged. Journal, cage bores, thrust faces and integral peened heads now explicit. Return/actuation remains blocked: existing tension strip is disconnected and differs from source coaxial return spring/roller-link topology.\",\n    \"hinge\": {\n      \"journalRadius\": 0.8,\n      \"boreHalf\": 0.81,\n      \"earOuterDiamond\": 2,\n      \"bossOuterHalf\": 1.8,\n      \"rightThrustGap\": 0.125,\n      \"headRadius\": 1.5,\n      \"headThickness\": 0.5,\n      \"note\": \"ILLUSTRATIVE mm; topology: rod through mirror ears and cage supports (K1000 repair PDF51 Fig100). Square machined bores and integral peened heads are educational ordinary-practice constructions, NOT factory CAD. Clearance-fit contract: nominal 1.62 mm across flats, H9/d9 dimensional limits (1\\u20133 mm band), MMC bore 1.62 and unchanged journal diameter 1.60, nominal flat gap 0.010 mm. Square form is disclosed, not claimed to be a factory circular bearing. Total ear axial endplay 0.125 mm, left thrust face seated. Heads recessed inside original brackets in relief pockets with 0.125 mm radial relief; shoulders x=\\u00b123.9. Dung sai minh h\\u1ecda, kh\\u00f4ng ph\\u1ea3i th\\u00f4ng s\\u1ed1 nh\\u00e0 m\\u00e1y. Not an axis-lock, multi-DOF capture or force certificate.\",\n      \"headPocketClearance\": 0.125,\n      \"nominalFitSize\": 1.62,\n      \"fit\": \"H9/d9 dimensional limits at MMC; square bore across flats, not a factory circular bearing\",\n      \"nominalBoreLimits\": [\n        1.62,\n        1.645\n      ],\n      \"journalDiameterLimits\": [\n        1.575,\n        1.6\n      ],\n      \"thrust\": {\n        \"backX\": -21.375,\n        \"seatX\": -20.875,\n        \"radius\": 1.25,\n        \"pocketHalf\": 1.375,\n        \"note\": \"ILLUSTRATIVE ordinary-practice integral turned collar, not a traced K1000 factory dimension. Shared dyadic backX seats its back on the left boss counterbore floor; shared seatX seats its end on the left ear counterbore floor. The turned shaft is partitioned at backX and seatX into left journal, 0.5 mm-thick collar and inboard/right journal, sharing finite full-disc axial interfaces. Both journals retain radius 0.8. Both counterbores have square half-width 1.375, leaving at least 0.125 mm nominal rim relief. The ear running bore remains half-width 0.81, and the right axial endplay remains 0.125 mm. These opposed axial patches resist axial motion only; they do not certify radial support, tilt capture, friction or a driven mirror.\"\n      }\n    }\n  },\n  \"shutter\": {\n    \"firstY\": 2.7,\n    \"secondY\": 2.1,\n    \"layering\": \"K1000 repair text Fig.176 (PDF 91): the opening (first) cloth runs in FRONT (+y) of the closing (second) cloth over the gate. Depth values are illustrative; only the order is source-grounded.\",\n    \"cloth\": 0.25,\n    \"barWidth\": 2.4,\n    \"barDepth\": 0.5,\n    \"halfHeight\": 14.5,\n    \"rollerRadius\": 3.2,\n    \"firstRollerX\": -27,\n    \"secondRollerX\": 27,\n    \"hardware\": {\n      \"status\": \"ILLUSTRATIVE mm. Four main axis assemblies + guide rollers + bearings/plates. Element order/sides from the K1000 repair text (PDF 89-91 OCR, Fig.173-177); positions, diameters and clearances are NOT source measurements. Only the 0.15 mm pinion endplay is a source number. Retention (illustrative, ordinary practice, not factory CAD): square-bodied bushes fill matching square plate holes and hang on a top flange (bushFlange) seated on the plate top face; each shaft is stepped (journal radius in the bushes, shaftBodyRadius between) so its lower shoulder sits on the lower bush flange; every stack element is seated (gap 0) on the one below, and the whole stack's free endplay is at the TOP under the upper bush (axialGap take-up, pinionEndplay winding). The opening pinion shaft has a larger shank (pinionShank) whose bottom face caps the lower tape end and whose top step (pinionStep) carries the upper tape end. R2a adds three integral shaft keys, open broached hub profiles and a real closing groove/split retainer; these substitute illustrative manufactured profiles for the source pin screws and E-ring, not factory CAD. firstRollerX/secondRollerX above are legacy unused keys; the drawn x positions are openingTakeupX/closingWindingX.\",\n      \"openingTakeupX\": -28,\n      \"closingWindingX\": 28,\n      \"closingTakeup\": [\n        -29.5,\n        13.6\n      ],\n      \"openingWinding\": [\n        28.5,\n        12\n      ],\n      \"plateZ\": [\n        16,\n        17.5\n      ],\n      \"tubeHalf\": 14.6,\n      \"axialGap\": 0.1,\n      \"runningClearance\": 0.05,\n      \"pinionEndplay\": 0.15,\n      \"takeupShaftRadius\": 1,\n      \"pinionShaftRadius\": 0.8,\n      \"bushOuter\": {\n        \"takeup\": 1.8,\n        \"pinion\": 1.5\n      },\n      \"guideRadius\": {\n        \"takeup\": 2.4,\n        \"winding\": 1.8\n      },\n      \"tapeEndRadius\": 1.6,\n      \"spacerOuter\": {\n        \"takeup\": 2,\n        \"small\": 1.6,\n        \"large\": 1.9\n      },\n      \"bushFlange\": {\n        \"height\": 0.3,\n        \"overhang\": 0.5\n      },\n      \"shaftBodyRadius\": {\n        \"takeup\": 1.3,\n        \"pinion\": 1.1\n      },\n      \"guideHeight\": 0.8,\n      \"lowerSpacerHeight\": 0.3,\n      \"largeSpacerHeight\": 0.2,\n      \"tapeEndHeight\": 0.8,\n      \"pinionStep\": 14.7,\n      \"pinionShank\": 1.3,\n      \"frameLeft\": {\n        \"x\": [\n          -33.5,\n          -24.6\n        ],\n        \"y\": [\n          1.7,\n          17.4\n        ]\n      },\n      \"frameRight\": {\n        \"x\": [\n          24.6,\n          31.6\n        ],\n        \"y\": [\n          1.7,\n          14.2\n        ]\n      },\n      \"columnLeft\": {\n        \"x\": [\n          -33.5,\n          -32.3\n        ],\n        \"y\": [\n          1.7,\n          3.2\n        ]\n      },\n      \"columnRight\": {\n        \"x\": [\n          30.6,\n          31.6\n        ],\n        \"y\": [\n          1.7,\n          2.9\n        ]\n      },\n      \"railBracket\": 0.4,\n      \"railLedge\": {\n        \"width\": 1,\n        \"topThickness\": 0.15\n      },\n      \"stakedLip\": {\n        \"rim\": 0.2,\n        \"overhang\": 0.3,\n        \"height\": 0.3\n      },\n      \"columnWeb\": 0.5,\n      \"closureNote\": \"ILLUSTRATIVE closure (ordinary practice, not factory CAD): each upper bush flange is captured by a staked lip of its frame casting (rim stakedLip.rim on the plate top, rolled stakedLip.overhang over the flange; lip bore clears the journal); the right frame column carries a web (columnWeb) so the winding support plate edge sits in a slot of ONE casting; both curtain rails rest on railLedge faces of the rail brackets (top ledge above the cloth edge). Axial retention is relative to the frame castings; frame-to-body screws now clamp the two frame feet to the base plate via declared static ideal tapped bores; gears remain PENDING. R2a integral torque keys and closing groove/split ring are built as disclosed in windingCouplings.\",\n      \"windingCouplings\": {\n        \"note\": \"Illustrative integral keys with finite milled-core flats and real broached open hub keyways. The keyed shaft cross-sections are inscribed octagonal profiles milled flat; journals remain analytic rounds. One manufactured shaft includes its keys through finite shared faces, not owner relabelling. Source pin-screws are not factory-reconstructed. No force, dynamic assembly or factory timing claim.\",\n        \"openingLower\": {\n          \"root\": 0.5,\n          \"outer\": 1.4,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            -15.5,\n            -14.7\n          ]\n        },\n        \"openingUpper\": {\n          \"root\": 0.4,\n          \"outer\": 1.2,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            14.7,\n            15.5\n          ]\n        },\n        \"closing\": {\n          \"root\": 0.5,\n          \"outer\": 1.5,\n          \"halfWidth\": 0.25,\n          \"z\": [\n            -14.6,\n            14.6\n          ]\n        },\n        \"groove\": {\n          \"z\": [\n            15.4,\n            15.6\n          ],\n          \"rootRadius\": 0.8,\n          \"boreFlat\": 0.85,\n          \"note\": \"Actual reduced shaft root between two 1.1 mm radius shoulders. A connected 270-degree split retaining ring is a justified illustrative E-ring equivalent; it lies below the small upper spacer, directly above the upper guide as in PDF90. Both groove cap shoulders trap the ring axially; the narrower throat retains it radially. No spring force, installation deformation or factory CAD claim.\"\n        },\n        \"capture\": {\n          \"note\": \"New illustrative mm, not K1000 factory dimensions: integral lower and upper opening shaft collars clear counterbored spacers. Lower hub has 0.125 mm downward travel relative to seated shaft; upper hub has 0.125 mm upward travel. Existing opposite shaft shoulders stop the other direction. Ground stack pinion endplay 0.15 mm is unchanged. No glued zero-endplay joint or prescribed co-motion proof. Counterbore radial clearance is illustrative 0.06 mm, leaving a real margin above required c=0.05.\",\n          \"openingCollars\": [\n            {\n              \"z\": [\n                -15.7,\n                -15.625\n              ],\n              \"radius\": 1.3,\n              \"spacerBore\": 1.36\n            },\n            {\n              \"z\": [\n                15.625,\n                15.85\n              ],\n              \"radius\": 1.1,\n              \"spacerBore\": 1.16\n            }\n          ],\n          \"contract\": \"KEYED_SLIDING_CAPTURE_PROPOSAL_V1\",\n          \"relativeEndplay\": 0.125\n        }\n      }\n    },\n    \"tapes\": {\n      \"status\": \"UNVALIDATED_R1V2_CANDIDATE\",\n      \"illustrative\": true,\n      \"forceSimulation\": false,\n      \"thickness\": 0.125,\n      \"surfaceClearance\": 0,\n      \"lanes\": {\n        \"first\": [\n          14.75,\n          15\n        ],\n        \"second\": [\n          15.125,\n          15.375\n        ]\n      },\n      \"note\": \"Shared absolute polygon vertices define exact-contact inner wrap faces, preserved in PACK with lossless rings. Fixed octagonal guides on seated stems route tapes behind hinge-bracket corners. Slotted rails retain end supports and real stem guide faces. Skirt bore encloses complete spacer circumcircle plus existing running clearance. Illustrative dimensions; no force or factory timing claim. Each integral anchor remains on the original front face of its own bar, preserving the whole-bar depth ordering and the old optical depth envelope.\",\n      \"anchorFacesY\": {\n        \"first\": 3.1500000000000004,\n        \"second\": 2.5500000000000003\n      }\n    }\n  },\n  \"body\": {\n    \"x\": [\n      -72,\n      72\n    ],\n    \"y\": [\n      -9,\n      45.5\n    ],\n    \"z\": [\n      -36,\n      30\n    ],\n    \"wall\": 2.4\n  },\n  \"transport\": {\n    \"cassette\": [\n      -50,\n      12.6\n    ],\n    \"cassetteRadius\": 12.5,\n    \"takeup\": [\n      56,\n      10.2\n    ],\n    \"spoolRadius\": 10,\n    \"sprocket\": [\n      39,\n      6.2\n    ],\n    \"sprocketRadius\": 6.1,\n    \"pitch\": 38,\n    \"perforationPitch\": 4.75,\n    \"perforationSize\": [\n      2.8,\n      2\n    ],\n    \"perforationZ\": 14.25,\n    \"filmHalfWidth\": 17.5,\n    \"filmThickness\": 0.13,\n    \"status\": \"PENDING: straight cassette->gate->sprocket->takeup strip with real perforation voids at the model totalTransport phase; sprocket tooth engagement, spool wrap and lever-gear coupling NOT proved\"\n  },\n  \"view\": {\n    \"status\": \"Fixed report-only inspection view for ALL poses (no pose-specific zoom/pan). Camera = the 'camera' block above (front-left oblique + top: viewer in front, photographer-right side, 12 deg above: low oblique so gate rays pass UNDER the raised mirror; ray-tested).\",\n    \"section\": {\n      \"note\": \"ACTUAL cut volumes removed from camera-facing OPAQUE housing only. Optical parts (glass, mirror, iris, curtains, gate, film, cells' optical datums) are never cut. makeGeometry(s,{section:false}) gives the uncut REFERENCE body.\",\n      \"sectorParts\": [\n        \"body.front-mount-plate\",\n        \"lens.bayonet\",\n        \"lens.barrel\",\n        \"lens.rear-cell\",\n        \"lens.mid-cell\",\n        \"lens.front-cell\"\n      ],\n      \"sectorQuadrant\": \"sectors whose mid-angle has x>0 and z>0 (camera-facing upper-right quadrant of the barrel/mount ring)\",\n      \"boxCuts\": [\n        {\n          \"parts\": [\n            \"mirror-box.wall-right\"\n          ],\n          \"x\": [\n            22,\n            24.4\n          ],\n          \"y\": [\n            17,\n            43.1\n          ],\n          \"z\": [\n            -14,\n            22\n          ],\n          \"why\": \"window in mirror-box side wall open to its front edge y=43.1 (front post x22..24.4, y40..43.1, z-14..22 = 267.84 mm3 removed: ray-tested occluder of the partial-curtain bars from the fixed camera); rear post (hinge bracket, spring stud), top rail (screen ledge, raised stop) and bottom rail retained\"\n        },\n        {\n          \"parts\": [\n            \"body.deck-right\"\n          ],\n          \"x\": [\n            24.4,\n            46\n          ],\n          \"y\": [\n            -6.6,\n            43.1\n          ],\n          \"z\": [\n            28,\n            30.4\n          ],\n          \"why\": \"near half of the take-up deck; part x>=46 under the wind hub retained on the end wall\"\n        },\n        {\n          \"parts\": [\n            \"body.front-mount-plate\"\n          ],\n          \"x\": [\n            30,\n            46\n          ],\n          \"y\": [\n            43.1,\n            45.5\n          ],\n          \"z\": [\n            -30,\n            28\n          ],\n          \"why\": \"camera-facing front skin right of the mount ring\"\n        }\n      ]\n    },\n    \"material\": {\n      \"transmissive\": \"report-only fill alpha on the 6 declared transmissive parts; physical volumes unchanged\",\n      \"reflective\": \"mirror.glass opaque reflective tone\",\n      \"opaque\": \"all other parts opaque\"\n    }\n  },\n  \"mounts\": [\n    {\n      \"glass\": \"lens.rear-glass\",\n      \"cell\": \"lens.rear-cell\",\n      \"retainer\": \"lens.rear-retainer\",\n      \"openingRadius\": 12,\n      \"glassRadius\": 12.25,\n      \"pocketOuter\": 14,\n      \"y0\": 46.5,\n      \"y1\": 49,\n      \"cellY\": [\n        47.5,\n        48.6\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"lens.mid-glass\",\n      \"cell\": \"lens.mid-cell\",\n      \"retainer\": \"lens.mid-retainer\",\n      \"openingRadius\": 16,\n      \"glassRadius\": 16.25,\n      \"pocketOuter\": 18,\n      \"y0\": 54,\n      \"y1\": 58,\n      \"cellY\": [\n        55,\n        57\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"lens.front-glass\",\n      \"cell\": \"lens.front-cell\",\n      \"retainer\": \"lens.front-retainer\",\n      \"openingRadius\": 22,\n      \"glassRadius\": 22.25,\n      \"pocketOuter\": 24,\n      \"y0\": 82,\n      \"y1\": 86,\n      \"cellY\": [\n        83,\n        85\n      ],\n      \"z\": 0,\n      \"segments\": 16,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    },\n    {\n      \"glass\": \"eyepiece.lens\",\n      \"cell\": \"eyepiece.tube\",\n      \"retainer\": \"eyepiece.retainer\",\n      \"openingRadius\": 5.5,\n      \"glassRadius\": 5.75,\n      \"pocketOuter\": 6.5,\n      \"y0\": 3,\n      \"y1\": 5.5,\n      \"cellY\": null,\n      \"z\": 38,\n      \"segments\": 12,\n      \"seatThickness\": 0.5,\n      \"retainerThickness\": 0.5,\n      \"radialClearance\": 0.125,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\",\n      \"apertureNote\": \"Original opening polygon and pupil are unchanged. Only the non-optical outside rim of the glass grows into a stepped pocket; both cap contacts are exact, not clearance waivers.\"\n    }\n  ],\n  \"fasteners\": [\n    {\n      \"id\": \"body.fixing-screw-1\",\n      \"family\": \"body\",\n      \"x\": -67,\n      \"y\": -3,\n      \"threadOwner\": \"body.tapped-boss-1\",\n      \"castingSupport\": \"body.end-wall-left\",\n      \"bossX\": [\n        -69.6,\n        -64.4\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-2\",\n      \"family\": \"body\",\n      \"x\": -67,\n      \"y\": 37,\n      \"threadOwner\": \"body.tapped-boss-2\",\n      \"castingSupport\": \"body.end-wall-left\",\n      \"bossX\": [\n        -69.6,\n        -64.4\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-3\",\n      \"family\": \"body\",\n      \"x\": 67,\n      \"y\": -3,\n      \"threadOwner\": \"body.tapped-boss-3\",\n      \"castingSupport\": \"body.end-wall-right\",\n      \"bossX\": [\n        64.4,\n        69.6\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"body.fixing-screw-4\",\n      \"family\": \"body\",\n      \"x\": 67,\n      \"y\": 37,\n      \"threadOwner\": \"body.tapped-boss-4\",\n      \"castingSupport\": \"body.end-wall-right\",\n      \"bossX\": [\n        64.4,\n        69.6\n      ],\n      \"clearanceHalf\": 0.875,\n      \"threadHalf\": 0.75,\n      \"neckRadius\": 0.7,\n      \"headRadius\": 1.5,\n      \"threadStart\": -32,\n      \"threadTop\": -29.6,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"shutter.frame-fixing-screw-left\",\n      \"family\": \"shutter\",\n      \"x\": -33,\n      \"y\": 2.5,\n      \"threadOwner\": \"shutter.frame-left\",\n      \"clearanceHalf\": 0.5,\n      \"threadHalf\": 0.375,\n      \"neckRadius\": 0.3125,\n      \"headRadius\": 1.125,\n      \"threadStart\": -32,\n      \"threadTop\": -30,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    },\n    {\n      \"id\": \"shutter.frame-fixing-screw-right\",\n      \"family\": \"shutter\",\n      \"x\": 31.125,\n      \"y\": 2.25,\n      \"threadOwner\": \"shutter.frame-right\",\n      \"clearanceHalf\": 0.5,\n      \"threadHalf\": 0.375,\n      \"neckRadius\": 0.3125,\n      \"headRadius\": 1.125,\n      \"threadStart\": -32,\n      \"threadTop\": -30,\n      \"jointNote\": \"ILLUSTRATIVE static IDEAL installed thread, matching prismatic bore/envelope as B&W; no helix, assembly rotation, tightening, preload or force simulation; not factory dimensions.\"\n    }\n  ],\n  \"mountsNote\": \"K2a mounted glass / body and shutter-frame fixing only. Optical model, pupil, ray samples and optics tests are unchanged. Pocket clearances are manufactured illustrative clearances, not numerical tolerances or penetration waivers.\"\n}\n","geometrySource":"machines/slr-film-camera (Root; key-tip datum + return-lift)"},
  createModel: createModel,
  mountRenderer: mountRenderer,
  kit: kit
}, document);
})();
