/* How Things Work · stepper-motor · generated playground bundle (classic script). Do not edit. */
(function () {
'use strict';
var runtime = (function createPlaygroundRuntime() {
  'use strict';

  const MAX_DT = 0.1;
  const MODES = ['reader', 'explore'];
  const THEMES = ['dark', 'light'];
  const IDREF_ATTRS = new Set(['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'aria-details', 'aria-errormessage', 'aria-activedescendant', 'for', 'headers', 'list', 'form']);
  const HREF_ATTRS = new Set(['href', 'xlink:href']);
  const CONTROL_SELECTOR = '[data-machine-run],[data-machine-pause],[data-machine-step],[data-machine-reset],[data-machine-preset],[data-playground-key],[data-machine-theme],[data-machine-mode],[data-machine-collapse]';
  const READING_LINE = 0.4; // fraction of the unobscured reading area
  const TEXT = {
    ready: 'Sẵn sàng',
    running: 'Đang chạy',
    paused: 'Đã dừng',
    failed: 'Không chạy được phần tương tác. Hình vẫn ở dạng tĩnh và bài viết vẫn đọc được.',
    run: 'Đang chạy mô phỏng.',
    resume: 'Tiếp tục chạy từ trạng thái đã dừng.',
    pause: 'Đã dừng. Trạng thái được giữ nguyên.',
    step: (status) => (status ? `Từng bước: ${status}` : 'Đã đi một bước.'),
    reset: 'Đã đặt lại về trạng thái ban đầu.',
    preset: (label) => `Đã chọn cấu hình mẫu “${label}”.`,
    explore: 'Đã mở chế độ tự thử. Đây vẫn là cùng một mô hình.',
    reader: 'Đã quay lại bài đọc. Mô hình dừng và giữ nguyên trạng thái.',
    hidden: 'Mô hình đã dừng khi bạn rời tab; trạng thái được giữ nguyên.',
    challengeDone: 'Đã xong',
    challengeTodo: 'Chưa xong',
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

  // Control values are JSON-safe primitives, compared by their JSON text (the form they take in data attributes).
  const sameValue = (a, b) => a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
  function parseValue(text) {
    if (typeof text !== 'string') return undefined;
    try {
      return JSON.parse(text);
    } catch (error) {
      return undefined; // not a value this runtime emitted; the command is rejected by the caller
    }
  }

  // Vietnamese number text for range values: decimals follow the declared step, comma separator, never "-0".
  function formatNumber(value, step) {
    const text = String(step);
    const exponent = /e-(\d+)$/.exec(text);
    const decimals = Math.min(20, exponent ? Number(exponent[1]) : (text.split('.')[1] || '').length);
    let fixed = value.toFixed(decimals);
    if (Number(fixed) === 0) fixed = (0).toFixed(decimals);
    return fixed.replace('.', ',');
  }

  function indexControls(controls) {
    const byKey = new Map();
    const valueKeys = [];
    for (const group of controls.groups) {
      for (const control of group.controls) {
        byKey.set(control.key, control);
        if (control.type !== 'button') valueKeys.push(control.key);
      }
    }
    return {
      byKey,
      valueKeys,
      presets: new Map(controls.presets.map((preset) => [preset.key, preset.label])),
      challengeKeys: controls.challenges.map((challenge) => challenge.key),
    };
  }

  function acceptsValue(control, value) {
    if (control.type === 'range') return typeof value === 'number' && Number.isFinite(value) && value >= control.min && value <= control.max;
    if (control.type === 'button') return sameValue(control.value, value);
    return control.options.some((option) => sameValue(option.value, value));
  }

  // Contract v1 snapshot shape, checked against the declared controls and challenges on every read.
  function validateSnapshot(snapshot, index) {
    const fail = (why) => { throw new Error(`Invalid model snapshot: ${why}`); };
    const frozenArray = (value) => Array.isArray(value) && Object.isFrozen(value);
    if (!snapshot || typeof snapshot !== 'object') fail('not an object');
    if (!Object.isFrozen(snapshot)) fail('snapshot must be frozen');
    if (!(Number.isFinite(snapshot.time) && snapshot.time >= 0)) fail('time must be a finite number ≥ 0');
    if (typeof snapshot.running !== 'boolean') fail('running must be a boolean');
    const controls = snapshot.controls;
    if (!controls || typeof controls !== 'object' || Array.isArray(controls) || !Object.isFrozen(controls)) fail('controls must be a frozen object');
    for (const key of index.valueKeys) {
      if (!Object.prototype.hasOwnProperty.call(controls, key)) fail(`controls.${key} is missing`);
      if (!acceptsValue(index.byKey.get(key), controls[key])) fail(`controls.${key} holds an undeclared value ${JSON.stringify(controls[key])}`);
    }
    if (typeof snapshot.status !== 'string') fail('status must be a string');
    if (!frozenArray(snapshot.readout)) fail('readout must be a frozen array');
    const readoutKeys = new Set();
    for (const item of snapshot.readout) {
      if (!item || !Object.isFrozen(item) || typeof item.key !== 'string' || typeof item.label !== 'string' || typeof item.text !== 'string') fail('readout items are frozen { key, label, text } strings');
      if (readoutKeys.has(item.key)) fail(`duplicate readout key ${item.key}`);
      readoutKeys.add(item.key);
    }
    if (!(snapshot.announcement === null || typeof snapshot.announcement === 'string')) fail('announcement must be a string or null');
    if (!frozenArray(snapshot.challenges)) fail('challenges must be a frozen array');
    const listed = snapshot.challenges.map((item) => {
      if (!item || !Object.isFrozen(item) || typeof item.key !== 'string' || typeof item.done !== 'boolean') fail('challenge items are frozen { key, done }');
      return item.key;
    });
    if (listed.length !== index.challengeKeys.length || new Set(listed).size !== listed.length || index.challengeKeys.some((key) => !listed.includes(key))) {
      fail('challenges must list every declared challenge exactly once');
    }
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

  // Same id policy as the machine runtime (a parity test runs both): every id of the scene and console panel becomes
  // `<instanceId>--<original>`, the original stays in data-machine-id, references anywhere in the root are rewritten,
  // authored story ids are untouched. Returns an undo that restores the authored attributes exactly.
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
    const { model, renderer } = options;
    const index = indexControls(options.controls);
    const focusKeys = new Set(['all', ...(options.focusKeys || [])]);
    const requestFrame = options.requestFrame;
    const cancelFrame = options.cancelFrame;
    const reducedMotion = options.reducedMotion || (() => false);
    const onView = options.onView || (() => {});
    const onFailure = options.onFailure || (() => {});
    const beforeRender = options.beforeRender || (() => {});
    const clock = frameClock(MAX_DT);
    let mode = 'reader';
    let focus = 'all';
    let theme = THEMES.includes(options.theme) ? options.theme : 'dark';
    let hidden = Boolean(options.hidden);
    let visible = true;
    let frameId = 0;
    let frames = 0; // renderer paints
    let advances = 0;
    let lastDt = 0; // dt of the last frame that advanced the model
    let failed = null;
    let disposed = false;
    let pausedByHidden = false;
    let current = null;
    // Announcements: one runtime event text (user action, mode, hidden tab) followed by the model's own texts.
    // snapshot.announcement is harvested only when it changes between reads, so idle re-reads never repeat it.
    let runtimeNote = null;
    let modelNotes = [];
    let lastModelNote = null;

    if (!model || ['snapshot', 'advance', 'command', 'reset'].some((name) => typeof model[name] !== 'function')) {
      throw new Error('createModel must return { snapshot, advance, command, reset }');
    }

    function read() {
      const next = validateSnapshot(model.snapshot(), index);
      if (next.announcement && next.announcement !== lastModelNote) modelNotes.push(next.announcement);
      lastModelNote = next.announcement;
      current = next;
      return next;
    }

    function takeAnnouncement() {
      const parts = [runtimeNote, ...modelNotes].filter(Boolean);
      runtimeNote = null;
      modelNotes = [];
      return parts.length ? parts.join(' ') : null;
    }

    const view = () => ({ snapshot: current, mode, focus, theme, announcement: takeAnnouncement() });
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
      renderer.render(current, { reducedMotion: Boolean(reducedMotion()), focus, theme });
      frames += 1;
      onView(view());
    }

    function frame(now) {
      frameId = 0;
      if (disposed || failed) return;
      try {
        if (canAdvance()) {
          lastDt = clock.tick(now);
          advances += 1;
          model.advance(lastDt, { reducedMotion: Boolean(reducedMotion()) });
        } else clock.reset();
        read();
        paint();
        if (canAdvance()) schedule();
        else clock.reset();
      } catch (error) {
        fail(error);
      }
    }

    // Suspended (hidden tab, or scene and outputs offscreen): nothing schedules. Logical state, focus and theme still
    // change; the wake in setHidden/setVisible schedules one frame that paints the latest of them.
    function schedule() {
      if (!frameId && !disposed && !failed && !hidden && visible) frameId = requestFrame(frame);
    }

    // A user action: run it, read the achieved snapshot, write the DOM state (controls, status, announcement)
    // synchronously so focus and assistive technology get immediate feedback even while the loop is suspended, then
    // ask for a frame. Writing DOM text never advances time and never calls the renderer.
    function act(action) {
      if (disposed || failed) return false;
      try {
        const result = action();
        read();
        onView(view());
        schedule();
        return result !== false;
      } catch (error) {
        fail(error);
        return false;
      }
    }

    function command(key, value) {
      return act(() => {
        if (mode !== 'explore') return false; // the reader never operates the playground
        const before = current;
        if (key === 'run') {
          if (before.running) return false;
          model.command({ key: 'run' });
          runtimeNote = before.time > 0 ? TEXT.resume : TEXT.run;
          clock.reset();
        } else if (key === 'pause') {
          if (!before.running) return false;
          model.command({ key: 'pause' });
          runtimeNote = TEXT.pause;
          clock.reset();
        } else if (key === 'step') {
          if (before.running) return false;
          model.command({ key: 'step' });
          runtimeNote = TEXT.step(read().status); // the achieved state, never a guess from the previous one
          clock.reset();
        } else if (key === 'reset') {
          model.command({ key: 'reset' });
          runtimeNote = TEXT.reset;
          clock.reset();
        } else if (key === 'preset') {
          if (!index.presets.has(value)) return false;
          model.command({ key: 'preset', value });
          runtimeNote = TEXT.preset(index.presets.get(value));
          clock.reset();
        } else {
          const control = index.byKey.get(key);
          if (!control || !acceptsValue(control, value)) return false;
          // Value changes keep the clock: dragging a slider while running must not stall time with dt-0 frames.
          model.command({ key, value });
        }
        return true;
      });
    }

    function setMode(next) {
      if (!MODES.includes(next) || next === mode) return false;
      return act(() => {
        if (next === 'reader' && current.running) model.command({ key: 'pause' });
        mode = next;
        clock.reset();
        runtimeNote = next === 'explore' ? TEXT.explore : TEXT.reader;
      });
    }

    function setHidden(next) {
      hidden = Boolean(next);
      if (disposed || failed) return;
      if (hidden) {
        try {
          if (current.running) {
            model.command({ key: 'pause' });
            read();
            pausedByHidden = true;
          }
        } catch (error) {
          fail(error);
        }
        clock.reset();
        if (frameId) cancelFrame(frameId);
        frameId = 0;
      } else {
        if (pausedByHidden) runtimeNote = TEXT.hidden; // spoken on return: nobody hears a hidden tab
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

    // Initial state: always the reader. Read and render synchronously once so a failing factory is caught at mount.
    read();
    modelNotes = [];
    paint();

    return {
      command,
      setMode,
      setHidden,
      setVisible,
      setFocus(key) {
        if (!focusKeys.has(key)) return false;
        if (key === focus) return true;
        focus = key;
        schedule();
        return true;
      },
      setTheme(next) {
        if (!THEMES.includes(next)) return false;
        return act(() => { theme = next; });
      },
      requestUpdate() { schedule(); return !failed && !disposed; },
      snapshot() {
        return Object.freeze({
          ...current,
          runtime: Object.freeze({
            mode, focus, theme, hidden, visible, frames, advances, lastDt,
            scheduled: frameId !== 0,
            reducedMotion: Boolean(reducedMotion()),
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
    const $$ = (selector) => Array.from(root.querySelectorAll(selector));
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
    const authored = new Map(); // element -> authored attribute values and text this runtime overwrote
    let names = null;
    let home = null;
    let observer = null;
    let controller = null;
    let renderer = null;
    let reported = false;
    let disposed = false;
    let index = null;
    let ui = null;

    function remember(element) {
      let entry = authored.get(element);
      if (!entry) { entry = { attrs: new Map(), text: undefined }; authored.set(element, entry); }
      return entry;
    }
    function setAttr(element, name, value) {
      if (!element) return;
      const entry = remember(element);
      if (!entry.attrs.has(name)) entry.attrs.set(name, element.getAttribute(name));
      if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
    function setText(element, text) {
      if (!element) return;
      const entry = remember(element);
      if (entry.text === undefined) entry.text = element.textContent;
      if (element.textContent !== text) element.textContent = text;
    }
    function restoreAuthored() {
      for (const [element, entry] of authored) {
        if (entry.text !== undefined && element.textContent !== entry.text) element.textContent = entry.text;
        for (const [name, value] of entry.attrs) {
          if (value === null) element.removeAttribute(name);
          else element.setAttribute(name, value);
        }
      }
      authored.clear();
    }

    function place(mode) {
      if (mode === 'explore') exploreSlot.append(scene);
      else if (home) home.after(scene);
      consoleBox.hidden = mode !== 'explore';
      consoleBox.inert = mode !== 'explore';
      setAttr(root, 'data-mode', mode);
    }

    function disableControls() {
      for (const element of enabled) element.disabled = true;
      enabled.length = 0;
    }

    function showFailure(error) {
      setAttr(root, 'data-machine-runtime', 'failed');
      disableControls();
      setText($('[data-machine-status]'), TEXT.failed);
      if (reported) return;
      reported = true;
      if (win && win.console) win.console.error(`htw-playground ${spec.slug}: runtime failed; static view kept.`, error);
    }

    // Elements the writer touches, collected once after namespacing (the nodes never change while mounted). The
    // console include and the descriptor come from the same artifact; any mismatch fails the mount loudly.
    function collect() {
      for (const element of $$('[data-playground-key]')) {
        const control = index.byKey.get(element.getAttribute('data-playground-key'));
        const kind = element.hasAttribute('data-playground-range') ? 'range' : element.hasAttribute('data-playground-option') ? 'option' : 'button';
        const value = kind === 'option' ? parseValue(element.getAttribute('data-playground-option')) : kind === 'button' ? parseValue(element.getAttribute('data-playground-value')) : undefined;
        const matches = control && (kind === 'range' ? control.type === 'range'
          : kind === 'option' ? (control.type === 'toggle3' || control.type === 'segmented') && acceptsValue(control, value)
            : control.type === 'button' && acceptsValue(control, value));
        if (!matches) throw new Error(`console control ${element.getAttribute('data-playground-key')} does not match the declared controls`);
      }
      return {
        status: $('[data-machine-status]'),
        readout: $('[data-machine-readout]'),
        announcer: $('[data-machine-announcement]'),
        run: $('[data-machine-run]'),
        pause: $('[data-machine-pause]'),
        step: $('[data-machine-step]'),
        theme: $('[data-machine-theme]'),
        options: $$('[data-playground-option]').map((element) => ({ element, key: element.getAttribute('data-playground-key'), value: parseValue(element.getAttribute('data-playground-option')) })),
        ranges: $$('input[data-playground-range]').map((element) => {
          const key = element.getAttribute('data-playground-key');
          const output = $$('[data-playground-output]').find((node) => node.getAttribute('data-playground-output') === key);
          return { element, key, control: index.byKey.get(key), text: output ? output.querySelector('[data-playground-value-text]') : null };
        }),
        challenges: $$('[data-machine-challenge]').map((element) => ({ element, key: element.getAttribute('data-machine-challenge'), state: element.querySelector('[data-machine-challenge-state]') })),
        readoutRows: new Map(),
        readoutKeys: null,
      };
    }

    function writeReadout(items) {
      if (!ui.readout) return;
      const keys = items.map((item) => item.key).join('\u0000');
      if (keys !== ui.readoutKeys) {
        setText(ui.readout, '');
        ui.readoutRows.clear();
        for (const item of items) {
          const row = doc.createElement('div');
          row.setAttribute('class', 'htw-playground-readout-row');
          row.setAttribute('data-readout-key', item.key);
          const term = doc.createElement('dt');
          const value = doc.createElement('dd');
          row.append(term, value);
          ui.readout.append(row);
          ui.readoutRows.set(item.key, { term, value });
        }
        ui.readoutKeys = keys;
      }
      for (const item of items) {
        const row = ui.readoutRows.get(item.key);
        if (row.term.textContent !== item.label) row.term.textContent = item.label;
        if (row.value.textContent !== item.text) row.value.textContent = item.text;
      }
    }

    // The only DOM writer. Every control state is derived from the snapshot; nothing is kept in parallel.
    function writeView({ snapshot, focus, theme, announcement }) {
      const state = snapshot.running ? 'running' : snapshot.time > 0 ? 'paused' : 'ready';
      setAttr(root, 'data-machine-state', state);
      setAttr(root, 'data-theme', theme);
      setAttr(root, 'data-machine-focus', focus);
      const label = TEXT[state];
      setText(ui.status, snapshot.status ? `${label} · ${snapshot.status}` : label);
      writeReadout(snapshot.readout);
      // During a session unavailable actions use aria-disabled, never `disabled`, so keyboard focus is not dropped.
      setAttr(ui.run, 'aria-disabled', String(snapshot.running));
      setAttr(ui.pause, 'aria-disabled', String(!snapshot.running));
      setAttr(ui.step, 'aria-disabled', String(snapshot.running));
      for (const option of ui.options) setAttr(option.element, 'aria-pressed', String(sameValue(snapshot.controls[option.key], option.value)));
      for (const range of ui.ranges) {
        const value = snapshot.controls[range.key];
        if (typeof value !== 'number') continue;
        const text = formatNumber(value, range.control.step);
        if (range.element.value !== String(value)) range.element.value = String(value);
        setAttr(range.element, 'aria-valuetext', `${text} ${range.control.unit}`);
        setText(range.text, text);
      }
      const done = new Map(snapshot.challenges.map((item) => [item.key, item.done]));
      for (const challenge of ui.challenges) {
        const finished = done.get(challenge.key) === true;
        setAttr(challenge.element, 'data-done', String(finished));
        setText(challenge.state, finished ? TEXT.challengeDone : TEXT.challengeTodo);
      }
      setAttr(ui.theme, 'aria-pressed', String(theme === 'light'));
      if (announcement && ui.announcer) {
        // A repeated identical text would not be spoken again; alternate a trailing no-break space.
        setText(ui.announcer, ui.announcer.textContent === announcement ? `${announcement}\u00a0` : announcement);
      }
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
      controller.setFocus(chosen.getAttribute('data-machine-focus'));
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
        if (win && win.console) win.console.error(`htw-playground ${spec.slug}: renderer dispose failed.`, error);
      }
      if (scene && home) {
        home.after(scene);
        home.remove();
      }
      if (consoleBox) { consoleBox.hidden = true; consoleBox.inert = false; }
      disableControls();
      if (ui) for (const range of ui.ranges) range.element.value = range.element.defaultValue;
      restoreAuthored();
      if (names) names.undo();
      delete root.htwMachine;
    }

    const handle = Object.freeze({
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
      index = indexControls(spec.descriptor.controls);
      names = namespaceIds(root, [scene, panel], instanceId);
      ui = collect();
      home = doc.createComment(' htw-playground scene home ');
      if (readerSlot.contains(scene)) scene.before(home);
      else readerSlot.prepend(home);
      place('reader');
      const data = Object.freeze({ ...spec.data, instanceId });
      const model = spec.createModel(data);
      renderer = spec.mountRenderer(root, data);
      if (!renderer || typeof renderer.render !== 'function') throw new Error('mountRenderer must return { render, dispose }');
      const still = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
      controller = createController({
        model, renderer, instanceId,
        controls: spec.descriptor.controls,
        focusKeys: sections.map((section) => section.getAttribute('data-machine-focus')),
        theme: root.getAttribute('data-theme'),
        hidden: doc.visibilityState === 'hidden',
        requestFrame: (callback) => win.requestAnimationFrame(callback),
        cancelFrame: (id) => win.cancelAnimationFrame(id),
        reducedMotion: () => Boolean(still && still.matches),
        beforeRender: chooseFocus,
        onView: writeView,
        onFailure: showFailure,
      });

      on(root, 'click', (event) => {
        const target = event.target && event.target.closest ? event.target.closest(CONTROL_SELECTOR) : null;
        if (!target || !root.contains(target) || target.closest('.htw-machine') !== root || target.disabled) return;
        if (target.hasAttribute('data-playground-range')) return; // sliders report through `input`
        if (target.hasAttribute('data-machine-run')) controller.command('run');
        else if (target.hasAttribute('data-machine-pause')) controller.command('pause');
        else if (target.hasAttribute('data-machine-step')) controller.command('step');
        else if (target.hasAttribute('data-machine-reset')) controller.command('reset');
        else if (target.hasAttribute('data-machine-preset')) controller.command('preset', target.getAttribute('data-machine-preset'));
        else if (target.hasAttribute('data-playground-option')) controller.command(target.getAttribute('data-playground-key'), parseValue(target.getAttribute('data-playground-option')));
        else if (target.hasAttribute('data-playground-value')) controller.command(target.getAttribute('data-playground-key'), parseValue(target.getAttribute('data-playground-value')));
        else if (target.hasAttribute('data-machine-theme')) controller.setTheme(controller.theme === 'light' ? 'dark' : 'light');
        else if (target.hasAttribute('data-machine-mode')) setMode(target.getAttribute('data-machine-mode'), true);
        else if (target.hasAttribute('data-machine-collapse')) {
          const collapsed = root.getAttribute('data-machine-collapsed') !== 'true';
          setAttr(root, 'data-machine-collapsed', String(collapsed));
          setAttr(target, 'aria-expanded', String(!collapsed));
        }
      });
      on(root, 'input', (event) => {
        const target = event.target;
        if (!target || !target.hasAttribute || !target.hasAttribute('data-playground-range') || target.closest('.htw-machine') !== root || target.disabled) return;
        controller.command(target.getAttribute('data-playground-key'), Number(target.value));
      });
      on(root, 'focusin', (event) => {
        const section = event.target && event.target.closest ? event.target.closest('[data-machine-focus]') : null;
        if (section && sections.includes(section) && controller.mode === 'reader') controller.setFocus(section.getAttribute('data-machine-focus'));
      });
      // Only the reader needs scroll work; explore scrolling must not schedule frames (e.g. while offscreen).
      const readLater = () => { readingDirty = true; if (controller.mode === 'reader') controller.requestUpdate(); };
      on(win, 'scroll', readLater, { passive: true });
      on(win, 'resize', readLater, { passive: true });
      on(doc, 'visibilitychange', () => controller.setHidden(doc.visibilityState === 'hidden'));
      if (still && typeof still.addEventListener === 'function') on(still, 'change', () => controller.requestUpdate());
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
        for (const output of $$('[data-machine-output]')) if (!scene.contains(output)) observer.observe(output);
      }

      for (const element of $$(CONTROL_SELECTOR)) {
        if (element.disabled) { element.disabled = false; enabled.push(element); }
      }
      if (controller.failed) throw controller.failed;
      setAttr(root, 'data-machine-runtime', 'ready');
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
        if (win && win.console) win.console.error(`htw-playground ${spec.slug}: renderer dispose failed.`, disposeError);
      }
      if (scene && home) home.after(scene);
      if (consoleBox) { consoleBox.hidden = true; consoleBox.inert = true; }
      setAttr(root, 'data-mode', 'reader');
      showFailure(error);
    }
    return handle;
  }

  // Mount every root of this topic once the article DOM exists. Pages (or tests) may mount a root added later, or
  // remount after dispose, by dispatching a bubbling `htw-machine-mount` event on it; nothing is exposed globally.
  function boot(spec, doc) {
    deepFreeze(spec.data);
    deepFreeze(spec.descriptor);
    const selector = `.htw-machine[data-htw-figure="${spec.slug}"]`;
    const mountAll = () => { for (const root of doc.querySelectorAll(selector)) mount(root, spec); };
    doc.addEventListener('htw-machine-mount', (event) => {
      if (event.target && event.target.nodeType === 1 && event.target.matches(selector)) mount(event.target, spec);
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mountAll, { once: true });
    else mountAll();
  }

  return {
    MAX_DT, TEXT, frameClock, sameValue, parseValue, formatNumber, indexControls, acceptsValue, validateSnapshot,
    rewriteIdList, rewriteUrlRefs, rewriteHref, rewriteAttribute, namespaceIds, deepFreeze, createController, mount, boot,
  };
})();
var createModel = (function createModel(data) {
  'use strict';
  const P = data.params;
  const HZ = P.substepHz;
  const H = 1 / HZ;
  const POLES = P.polePairs;
  const MICRO = P.microstepsPerFullStep;
  const CYCLE = 4 * MICRO; // microsteps per electrical cycle
  const HALF = CYCLE / 2;
  const QUARTER = CYCLE / 4;
  const REV = CYCLE * POLES; // microsteps per mechanical revolution
  const RAD_PER_MICRO = (2 * Math.PI) / CYCLE; // electrical
  const DEG_PER_MICRO = 360 / CYCLE / POLES; // mechanical
  const R = P.resistance;
  const L = P.inductance;
  const K = P.torqueConstant;
  const J = P.inertia;
  const B = P.viscousDamping;
  const T_BEARING = P.bearingFriction;
  const SETTLE = Math.round(P.stepSettleSeconds * HZ);
  const HIST_EVERY = P.historyEverySubsteps;
  const HIST_CAP = Math.round((P.historySeconds * HZ) / HIST_EVERY);
  const REST_OMEGA = P.restOmega;
  const STICK_OMEGA = P.stickOmega;
  const STATIC_RATIO = P.staticFrictionRatio; // breakaway (static) friction / sliding friction
  const SLIP_STATUS_SUBSTEPS = Math.round(P.slipStatusSeconds * HZ);
  const FAST_RATE = P.fastNoSlipRate;
  const FAST_SUBSTEPS = Math.round(P.fastNoSlipSeconds * HZ);
  const TURN_TOL = P.oneTurnToleranceDeg;
  const HALF_TOL = P.halfStepToleranceDeg;
  const TIE_OFFSET_MICRO = P.unstableOffsetDeg / (360 / CYCLE); // electrical, in microsteps
  const MAX_DT = 0.1;
  const BUDGET_EPS = 1e-6; // substeps; absorbs float noise when different dt splits sum to the same grid time

  const DRIVES = ['manual', 'wave', 'full', 'half', 'micro'];
  const PULSE = { wave: MICRO, full: MICRO, half: MICRO / 2, micro: 1 }; // microsteps per pulse
  const PULSES_PER_FULL = { wave: 1, full: 1, half: 2, micro: MICRO };
  const GRID = { wave: [MICRO, 0], full: [MICRO, MICRO / 2], half: [MICRO / 2, 0], micro: [1, 0] }; // [spacing, offset]
  // Coil signs for the eight 45° field sectors (A along 0°, B along 90°).
  const PATTERN = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const COS = [];
  const SIN = [];
  for (let m = 0; m < CYCLE; m++) {
    const c = Math.cos(m * RAD_PER_MICRO);
    const s = Math.sin(m * RAD_PER_MICRO);
    COS.push(Math.abs(c) < 1e-12 ? 0 : c);
    SIN.push(Math.abs(s) < 1e-12 ? 0 : s);
  }
  const DRIVE_TEXT = { wave: 'một cuộn', full: 'hai cuộn', half: 'nửa bước', micro: 'vi bước' };

  const RANGES = {};
  for (const group of data.controls.groups) {
    for (const control of group.controls) if (control.type === 'range') RANGES[control.key] = control;
  }
  const PRESETS = {};
  for (const preset of data.controls.presets) PRESETS[preset.key] = preset;
  const DEFAULT_PRESET = data.controls.presets[0].key;
  const CHALLENGES = data.controls.challenges.map((c) => c.key);
  const CHALLENGE_LABEL = {};
  for (const c of data.controls.challenges) CHALLENGE_LABEL[c.key] = c.label;

  const mod = (a, m) => ((a % m) + m) % m;
  const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const toNumber = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  function clampRange(key, raw) {
    const spec = RANGES[key];
    const v = toNumber(raw);
    if (!Number.isFinite(v)) return null;
    const stepped = spec.min + Math.round((Math.min(spec.max, Math.max(spec.min, v)) - spec.min) / spec.step) * spec.step;
    return Math.min(spec.max, Math.max(spec.min, Number(stepped.toFixed(6))));
  }

  // Vietnamese number text: comma decimal, dot thousands, U+2212 minus, never "−0".
  function fmt(x, digits, trim) {
    const f = Math.pow(10, digits);
    const r = Math.round(Math.abs(x) * f) / f;
    let text = r.toFixed(digits);
    if (trim && text.indexOf('.') >= 0) text = text.replace(/0+$/, '').replace(/\.$/, '');
    const parts = text.split('.');
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (x < 0 && r !== 0 ? '\u2212' : '') + int + (parts.length > 1 ? ',' + parts[1] : '');
  }

  // ---- state ----
  let controls;
  let running;
  let n; // integer substep counter: time = n / HZ exactly
  let budget; // pending fractional substeps
  let theta; // mechanical angle, rad, unwrapped
  let omega;
  let iA;
  let iB;
  let openA; // phase disconnected and its current has decayed to zero
  let openB;
  let stuck; // rotor held by static friction
  let cmd; // controller's commanded electrical position, integer microsteps (its open-loop belief)
  let cmdStart;
  let lost; // net electrical cycles the rotor is behind the belief (signed)
  let slips; // slip events counted so far
  let slipGuard; // direction of the last slip until the rotor settles near the new reference (hysteresis)
  let lastSlipN;
  let energized;
  let acc; // integer pulse accumulator (Bresenham) so auto pulses land on the substep grid
  let base; // challenge baseline: reset, preset or drive change
  let fastClean;
  let done;
  let pendingEvents;
  let announcement;
  let hist;
  let histCount;
  let histHead;
  let histSlip;
  let cached;

  function frictionTorque() {
    return T_BEARING + controls.load;
  }
  function rotorMicro() {
    return (POLES * theta) / RAD_PER_MICRO;
  }
  function torqueAt(th, a, b) {
    return K * (-a * Math.sin(POLES * th) + b * Math.cos(POLES * th));
  }
  // Nearest grid point (spacing, offset) to x in microsteps; exact ties go the selected direction.
  function nearestOnGrid(x, spacing, offset) {
    const k = (x - offset) / spacing;
    const lo = Math.floor(k);
    const dLo = k - lo;
    let pick;
    if (Math.abs(dLo - 0.5) < 1e-9) pick = controls.direction > 0 ? lo + 1 : lo;
    else pick = dLo < 0.5 ? lo : lo + 1;
    return offset + pick * spacing;
  }
  // Coil signs the controller is applying (−1/0/1), for manual drive and the switch display of auto drives.
  function patternSigns() {
    if (controls.drive === 'manual') return [controls.phaseA, controls.phaseB];
    return PATTERN[mod(Math.round(cmd / (MICRO / 2)), 8)];
  }
  function applied() {
    const V = controls.voltage;
    if (controls.drive === 'micro') {
      const m = mod(cmd, CYCLE);
      return { uA: V * COS[m], uB: V * SIN[m], drvA: true, drvB: true };
    }
    const s = patternSigns();
    if (controls.drive === 'manual') return { uA: s[0] * V, uB: s[1] * V, drvA: s[0] !== 0, drvB: s[1] !== 0 };
    // Sequences keep both coils connected to the driver: an idle coil sits at 0 V (shorted), not disconnected.
    return { uA: s[0] * V, uB: s[1] * V, drvA: true, drvB: true };
  }
  function syncSwitches() {
    if (controls.drive === 'manual') return;
    const s = patternSigns();
    controls.phaseA = s[0];
    controls.phaseB = s[1];
  }
  function rebase() {
    base = { cmd, pulses: 0, slips };
  }

  // Manual field: unwrap the chosen coil pattern nearest to the rotor (a person watches the rotor).
  function placeManual() {
    const pa = controls.phaseA;
    const pb = controls.phaseB;
    energized = pa !== 0 || pb !== 0;
    if (!energized) return;
    const sector = mod(Math.round((Math.atan2(pb, pa) / (Math.PI / 4))), 8);
    const x = rotorMicro();
    const ref = nearestOnGrid(x, CYCLE, sector * (MICRO / 2));
    cmd = ref + CYCLE * lost;
    // A rotor resting exactly against the new field sits on an unstable balance that friction can hold forever.
    // Stand-in for the tiny vibrations of a real motor: offset it slightly toward the side chosen above.
    const d = ref - x;
    if (stuck && Math.abs(d) > HALF - TIE_OFFSET_MICRO) {
      theta = ((ref - sign(d) * (HALF - TIE_OFFSET_MICRO)) * RAD_PER_MICRO) / POLES;
    }
  }

  function setDrive(next) {
    const prev = controls.drive;
    if (next === prev) return;
    const wasEnergized = energized;
    controls.drive = next;
    acc = 0;
    if (next === 'manual') {
      placeManual();
    } else {
      const grid = GRID[next];
      if (wasEnergized) {
        cmd = nearestOnGrid(cmd, grid[0], grid[1]);
      } else {
        cmd = nearestOnGrid(rotorMicro(), grid[0], grid[1]) + CYCLE * lost;
      }
      energized = true;
      syncSwitches();
    }
    rebase();
  }

  function pulse() {
    cmd += controls.direction * PULSE[controls.drive];
    base.pulses += 1;
    syncSwitches();
  }

  // ---- physics ----
  const k1 = new Float64Array(4);
  const k2 = new Float64Array(4);
  const k3 = new Float64Array(4);
  const k4 = new Float64Array(4);
  function deriv(th, w, a, b, u, frozen, fric, out) {
    const s = Math.sin(POLES * th);
    const c = Math.cos(POLES * th);
    out[2] = u.fixA ? 0 : (u.uA - R * a + K * w * s) / L; // −e_A = +k ω sin pθ
    out[3] = u.fixB ? 0 : (u.uB - R * b - K * w * c) / L;
    if (frozen) {
      out[0] = 0;
      out[1] = 0;
    } else {
      out[0] = w;
      out[1] = (K * (-a * s + b * c) - B * w - fric) / J;
    }
  }

  function substep() {
    if (running && controls.drive !== 'manual') {
      acc += controls.rate * PULSES_PER_FULL[controls.drive];
      while (acc >= HZ) {
        acc -= HZ;
        pulse();
      }
    }
    const drive = applied();
    const V = controls.voltage;
    // An unpowered coil: its stored current decays through the driver's diodes into the supply, then it is open.
    const u = {
      uA: drive.drvA ? drive.uA : -V * sign(iA),
      uB: drive.drvB ? drive.uB : -V * sign(iB),
      fixA: !drive.drvA && openA,
      fixB: !drive.drvB && openB,
    };
    if (drive.drvA) openA = false;
    if (drive.drvB) openB = false;
    const tc = frictionTorque();
    const ts = tc * STATIC_RATIO;
    let dir;
    if (stuck) {
      const t = torqueAt(theta, iA, iB);
      if (Math.abs(t) <= ts) dir = 0;
      else {
        stuck = false;
        dir = sign(t);
      }
    } else dir = sign(omega);
    const frozen = dir === 0;
    if (frozen) omega = 0;
    const fric = tc * dir;
    const a0 = iA;
    const b0 = iB;
    deriv(theta, omega, iA, iB, u, frozen, fric, k1);
    deriv(theta + 0.5 * H * k1[0], omega + 0.5 * H * k1[1], iA + 0.5 * H * k1[2], iB + 0.5 * H * k1[3], u, frozen, fric, k2);
    deriv(theta + 0.5 * H * k2[0], omega + 0.5 * H * k2[1], iA + 0.5 * H * k2[2], iB + 0.5 * H * k2[3], u, frozen, fric, k3);
    deriv(theta + H * k3[0], omega + H * k3[1], iA + H * k3[2], iB + H * k3[3], u, frozen, fric, k4);
    const w6 = H / 6;
    theta += w6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    omega += w6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    iA += w6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    iB += w6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    // Decaying coil reaches zero inside this substep: it is now open.
    if (!drive.drvA && !openA && (a0 === 0 || sign(iA) !== sign(a0))) {
      iA = 0;
      openA = true;
    }
    if (!drive.drvB && !openB && (b0 === 0 || sign(iB) !== sign(b0))) {
      iB = 0;
      openB = true;
    }
    // Stick zone (Karnopp): a rotor that reverses inside this substep, or creeps slower than stickOmega while the
    // coil torque cannot beat static friction, is held still; breakaway is re-checked at the next substep.
    if (frozen || sign(omega) !== dir || (Math.abs(omega) < STICK_OMEGA && Math.abs(torqueAt(theta, iA, iB)) <= ts)) {
      omega = 0;
      stuck = true;
    }
    n += 1;
    detectSlip();
    updateChallenges();
    if (n % HIST_EVERY === 0) record();
  }

  // Count crossings of the electrical-cycle boundary, then shift the reference by a cycle.
  // Four full steps per counted event is a cumulative convention, NOT the instantaneous angular error.
  function detectSlip() {
    if (!energized) return;
    let err = rotorMicro() - (cmd - CYCLE * lost);
    for (let guard = 0; guard < 64; guard++) {
      if (err < -(HALF + (slipGuard === -1 ? QUARTER : 0))) {
        lost += 1;
        err += CYCLE;
        slipGuard = 1;
      } else if (err > HALF + (slipGuard === 1 ? QUARTER : 0)) {
        lost -= 1;
        err -= CYCLE;
        slipGuard = -1;
      } else break;
      slips += 1;
      lastSlipN = n;
      histSlip = 1;
      fastClean = 0;
      if (slips === 1) pendingEvents.push(`Vừa ghi nhận một sự kiện trượt, quy đổi thành ${4 * POLES} bước. Đây không phải độ lệch góc tức thời; bộ điều khiển vẫn tiếp tục đếm lệnh.`);
    }
    if (slipGuard !== 0 && Math.abs(err) < QUARTER) slipGuard = 0;
  }

  function atRest() {
    return stuck || Math.abs(omega) <= REST_OMEGA;
  }
  function challengeMet(key) {
    const drive = controls.drive;
    const deg = (theta * 180) / Math.PI;
    if (key === 'oneTurn') {
      // four full pulses one way since the baseline = one commanded revolution; the shaft must have followed it
      return (drive === 'wave' || drive === 'full') && base.pulses === 4 && Math.abs(cmd - base.cmd) === REV &&
        slips === base.slips && atRest() && Math.abs(deg - cmd * DEG_PER_MICRO) <= TURN_TOL;
    }
    if (key === 'halfStepStop') {
      // commanded to 45° by a half or micro pulse, and the shaft actually rests there
      return (drive === 'half' || drive === 'micro') && base.pulses >= 1 && mod(cmd, REV) * DEG_PER_MICRO === 45 &&
        atRest() && Math.abs(mod(deg, 360) - 45) <= HALF_TOL;
    }
    if (key === 'makeItSlip') return slips >= 1;
    if (key === 'fastNoSlip') return fastClean >= FAST_SUBSTEPS;
    return false;
  }
  function updateChallenges() {
    if (running && controls.drive !== 'manual' && controls.rate >= FAST_RATE) fastClean += 1;
    else if (running) fastClean = 0;
    for (const key of CHALLENGES) {
      if (done[key]) continue;
      if (challengeMet(key)) {
        done[key] = true;
        pendingEvents.push(`Hoàn thành thử thách: ${CHALLENGE_LABEL[key]}.`);
      }
    }
  }

  function record() {
    const i = histHead;
    hist.t[i] = n / HZ;
    hist.iA[i] = iA;
    hist.iB[i] = iB;
    hist.commandedDeg[i] = cmd * DEG_PER_MICRO;
    hist.actualDeg[i] = (theta * 180) / Math.PI;
    hist.slip[i] = histSlip;
    histSlip = 0;
    histHead = (histHead + 1) % HIST_CAP;
    histCount = Math.min(HIST_CAP, histCount + 1);
  }

  function runSubsteps(count) {
    for (let s = 0; s < count; s++) substep();
  }

  // ---- lifecycle ----
  // A preset keeps finished challenges so a reader can collect all of them; only reset (and the first load) clears them.
  function load(presetKey, message, keepChallenges) {
    const preset = PRESETS[presetKey];
    const v = preset.values;
    controls = {
      phaseA: v.phaseA,
      phaseB: v.phaseB,
      drive: v.drive,
      direction: v.direction,
      rate: v.rate,
      load: v.load,
      voltage: v.voltage,
    };
    running = false;
    n = 0;
    budget = 0;
    omega = 0;
    stuck = true;
    lost = 0;
    slips = 0;
    slipGuard = 0;
    lastSlipN = -Infinity;
    acc = 0;
    fastClean = 0;
    if (!keepChallenges || !done) {
      done = {};
      for (const key of CHALLENGES) done[key] = false;
    }
    theta = (preset.startDeg * Math.PI) / 180;
    if (controls.drive === 'manual') {
      cmd = 0;
      placeManual();
    } else {
      const grid = GRID[controls.drive];
      cmd = nearestOnGrid(rotorMicro(), grid[0], grid[1]);
      energized = true;
      syncSwitches();
    }
    cmdStart = cmd;
    // Holding steady state: energized coils already carry V/R, unpowered coils are open.
    const drive = applied();
    iA = drive.drvA ? drive.uA / R : 0;
    iB = drive.drvB ? drive.uB / R : 0;
    openA = !drive.drvA;
    openB = !drive.drvB;
    rebase();
    hist = { t: new Float64Array(HIST_CAP), iA: new Float64Array(HIST_CAP), iB: new Float64Array(HIST_CAP), commandedDeg: new Float64Array(HIST_CAP), actualDeg: new Float64Array(HIST_CAP), slip: new Uint8Array(HIST_CAP) };
    histCount = 0;
    histHead = 0;
    histSlip = 0;
    record();
    pendingEvents = [message];
    flush();
  }

  function flush() {
    announcement = pendingEvents.length ? pendingEvents.join(' ') : null;
    pendingEvents = [];
    cached = null;
  }

  function reset() {
    load(DEFAULT_PRESET, 'Đã đặt lại động cơ về cấu hình mặc định và dừng.');
  }

  function advance(dt) {
    if (!running || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
    budget += Math.min(dt, MAX_DT) * HZ;
    const count = Math.floor(budget + BUDGET_EPS);
    budget -= count;
    runSubsteps(count);
    flush();
  }

  function setPhase(key, raw) {
    const v = toNumber(raw);
    if (v !== -1 && v !== 0 && v !== 1) return false;
    if (controls.drive !== 'manual') setDrive('manual');
    controls[key] = v;
    placeManual();
    return true;
  }

  function command(input) {
    if (!input || typeof input !== 'object') return;
    const key = input.key;
    const value = input.value;
    let changed = true;
    if (key === 'run') running = true;
    else if (key === 'pause') running = false;
    else if (key === 'reset') return reset();
    else if (key === 'preset') {
      if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(PRESETS, value)) return;
      return load(value, `Đã chọn cấu hình mẫu “${PRESETS[value].label}”. Bấm Chạy để bắt đầu.`, true);
    } else if (key === 'step') {
      running = false;
      if (controls.drive !== 'manual') pulse();
      runSubsteps(SETTLE);
    } else if (key === 'phaseA' || key === 'phaseB') changed = setPhase(key, value);
    else if (key === 'drive') {
      if (typeof value !== 'string' || DRIVES.indexOf(value) < 0) return;
      setDrive(value);
    } else if (key === 'direction') {
      const v = toNumber(value);
      if (v !== 1 && v !== -1) return;
      controls.direction = v;
    } else if (key === 'rate' || key === 'load' || key === 'voltage') {
      const v = clampRange(key, value);
      if (v === null) return;
      controls[key] = v;
    } else changed = false;
    if (changed) flush();
  }

  // ---- snapshot ----
  function statusText(deg) {
    const drive = controls.drive;
    const moving = !atRest();
    const angle = `${fmt(mod(Math.round(deg), 360), 0)}°`;
    // "Recently slipped" spans at least two electrical cycles of commands, so a stalled rotor at a slow rate
    // (one slip per cycle) is never described as keeping up between two slips.
    const slipWindow = Math.max(SLIP_STATUS_SUBSTEPS, Math.round((2 * 4 * HZ) / controls.rate));
    if (slips > 0 && n - lastSlipN < slipWindow) {
      return `Rotor không theo kịp: đã ghi nhận ${fmt(slips, 0)} sự kiện trượt, quy đổi thành ${fmt(4 * POLES * slips, 0)} bước. Xem độ lệch góc thật trên đồ thị.`;
    }
    if (drive === 'manual') {
      if (!energized) {
        return moving ? 'Hai cuộn dây đều tắt. Rotor quay trơn và chậm dần vì ma sát.' : 'Hai cuộn dây đều tắt. Rotor nằm yên và có thể xoay tự do.';
      }
      const parts = [];
      if (controls.phaseA) parts.push(`cuộn A chiều ${controls.phaseA > 0 ? 'thuận' : 'ngược'}`);
      if (controls.phaseB) parts.push(`cuộn B chiều ${controls.phaseB > 0 ? 'thuận' : 'ngược'}`);
      const coils = parts.join(' và ');
      const head = coils.charAt(0).toUpperCase() + coils.slice(1);
      return moving ? `${head} đang có điện. Rotor bị hút về phía cực từ đang bật.` : `${head} đang có điện. Rotor đứng yên ở ${angle} và giữ chặt vị trí đó.`;
    }
    const way = controls.direction > 0 ? 'thuận' : 'ngược';
    if (running) {
      return `Kiểu ${DRIVE_TEXT[drive]}, ${fmt(controls.rate, 0)} bước đủ mỗi giây theo chiều ${way}. Rotor theo kịp từng bước.`;
    }
    return `Cuộn dây vẫn có điện nên rotor được giữ ở ${angle}. Bấm Chạy hoặc Từng bước.`;
  }

  function historyOut() {
    const cols = ['t', 'iA', 'iB', 'commandedDeg', 'actualDeg', 'slip'];
    const out = { capacity: HIST_CAP, everySeconds: HIST_EVERY / HZ };
    const start = mod(histHead - histCount, HIST_CAP);
    for (const col of cols) {
      const arr = new Array(histCount);
      for (let j = 0; j < histCount; j++) arr[j] = hist[col][(start + j) % HIST_CAP];
      out[col] = Object.freeze(arr);
    }
    return Object.freeze(out);
  }

  function snapshot() {
    if (cached) return cached;
    const deg = (theta * 180) / Math.PI;
    const drive = applied();
    const uA = drive.drvA ? drive.uA : 0;
    const uB = drive.drvB ? drive.uB : 0;
    const torque = torqueAt(theta, iA, iB);
    const commandedSteps = (cmd - cmdStart) / MICRO;
    const time = n / HZ;
    const clean = (x) => (x === 0 ? 0 : x); // drop −0
    const readout = [
      { key: 'commandedSteps', label: 'Bước đã ra lệnh', text: fmt(commandedSteps, 2, true) },
      { key: 'angle', label: 'Góc trục thật', text: `${fmt(mod(Math.round(deg * 10) / 10, 360), 1)}°` },
      { key: 'slippedSteps', label: 'Bước trượt quy đổi', text: fmt(4 * POLES * slips, 0) },
      { key: 'currentA', label: 'Dòng cuộn A', text: `${fmt(iA, 2)} A` },
      { key: 'currentB', label: 'Dòng cuộn B', text: `${fmt(iB, 2)} A` },
      { key: 'torque', label: 'Mô-men', text: `${fmt(torque, 2)} N·m` },
      { key: 'time', label: 'Thời gian', text: `${fmt(time, 1)} s` },
    ].map((row) => Object.freeze(row));
    cached = Object.freeze({
      time,
      running,
      controls: Object.freeze({ ...controls }),
      status: statusText(deg),
      readout: Object.freeze(readout),
      announcement,
      challenges: Object.freeze(CHALLENGES.map((key) => Object.freeze({ key, done: done[key] }))),
      drive: controls.drive,
      direction: controls.direction,
      energized,
      theta: clean(theta),
      thetaDeg: clean(deg),
      thetaWrappedDeg: clean(mod(deg, 360)),
      omega: clean(omega),
      iA: clean(iA),
      iB: clean(iB),
      uA: clean(uA),
      uB: clean(uB),
      torque: clean(torque),
      electricalCommand: clean(cmd * (360 / CYCLE)),
      commandedDeg: clean(cmd * DEG_PER_MICRO),
      commandedSteps: clean(commandedSteps),
      slips,
      slippedSteps: 4 * POLES * slips,
      history: historyOut(),
    });
    return cached;
  }

  reset();
  announcement = null;
  return Object.freeze({ snapshot, advance, command, reset });
});
var mountRenderer = (function mountRenderer(root, data) {
  'use strict';
  const G = data.scene;
  const P = data.params;
  const R = P.resistance;
  const PERIOD = 360 / P.polePairs; // mechanical degrees of one electrical cycle
  const scene = root.querySelector('[data-machine-scene]');
  const view = scene ? scene.querySelector('[data-machine-view]') : null;
  if (!view) throw new Error('stepper renderer: scene view missing');
  const IDS = ['sm-rotor', 'sm-rotor-n-label', 'sm-rotor-s-label', 'sm-field', 'sm-pointer', 'sm-pointer-line', 'sm-ghost', 'sm-ghost-line', 'sm-lag',
    'sm-trace-a', 'sm-trace-b', 'sm-trace-error', 'sm-slip-lines', 'sm-slip-marks', 'sm-current-max', 'sm-current-min'];
  const POLES = ['a1', 'b1', 'a2', 'b2'];
  for (const pole of POLES) IDS.push(`sm-coil-${pole}`, `sm-sign-${pole}`, `sm-face-${pole}`, `sm-pole-${pole}`);
  const el = {};
  for (const id of IDS) {
    const node = view.querySelector(`[data-machine-id="${id}"]`);
    if (!node) throw new Error(`stepper renderer: part ${id} missing`);
    el[id] = node;
  }

  // Last written values are cached per node, so an unchanged value never touches the DOM. The authored value is
  // read once, on the first write, so dispose() restores the static scene exactly.
  const written = new Map();
  const authoredAttrs = new Map();
  const authoredText = new Map();
  function slot(node) {
    let entry = written.get(node);
    if (!entry) { entry = new Map(); written.set(node, entry); }
    return entry;
  }
  function set(node, name, value) {
    const entry = slot(node);
    if (entry.get(name) === value) return;
    if (!entry.has(name)) {
      let saved = authoredAttrs.get(node);
      if (!saved) { saved = new Map(); authoredAttrs.set(node, saved); }
      saved.set(name, node.getAttribute(name));
    }
    entry.set(name, value);
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  function text(node, value) {
    const entry = slot(node);
    if (entry.get('#text') === value) return;
    if (!entry.has('#text')) authoredText.set(node, node.textContent);
    entry.set('#text', value);
    if (node.textContent !== value) node.textContent = value;
  }

  const num = (value) => {
    const fixed = Math.round(value * 10) / 10;
    return String(fixed === 0 ? 0 : fixed);
  };
  const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
  const mod = (value, m) => ((value % m) + m) % m;
  const wrapError = (deg) => mod(deg + PERIOD / 2, PERIOD) - PERIOD / 2; // [−period/2, period/2)
  const rotate = (deg) => `rotate(${num(mod(deg, 360))} ${G.cx} ${G.cy})`;
  const at = (radius, deg) => {
    const a = (deg * Math.PI) / 180;
    return [G.cx + radius * Math.sin(a), G.cy - radius * Math.cos(a)];
  };
  const amps = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','));

  function drawCoils(snapshot, iMax) {
    const phases = { a: snapshot.iA, b: snapshot.iB };
    for (const pole of POLES) {
      const current = phases[pole.charAt(0)];
      const level = clamp(Math.abs(current) / iMax, 0, 1);
      const dir = level < 0.02 ? 'off' : current > 0 ? 'pos' : 'neg';
      set(el[`sm-coil-${pole}`], 'data-dir', dir);
      // Intensity follows |i| on a slightly convex curve, so a half-risen current reads clearly weaker than a full one.
      set(el[`sm-coil-${pole}`], 'fill-opacity', dir === 'off' ? '0' : String(Math.round((0.12 + 0.88 * Math.pow(level, 1.5)) * 100) / 100));
      set(el[`sm-sign-${pole}`], 'data-dir', dir);
      text(el[`sm-sign-${pole}`], dir === 'pos' ? '+' : dir === 'neg' ? '\u2212' : '');
      // The pole a positive phase current turns into S faces the rotor's N; its partner across the bore is N.
      const first = pole.charAt(1) === '1';
      const face = level < 0.12 ? 'off' : (current > 0) === first ? 's' : 'n';
      set(el[`sm-face-${pole}`], 'data-face', face);
      set(el[`sm-pole-${pole}`], 'data-face', face);
      text(el[`sm-face-${pole}`], face === 'off' ? '' : face.toUpperCase());
    }
  }

  function drawRotor(snapshot) {
    const theta = snapshot.thetaDeg;
    set(el['sm-rotor'], 'transform', rotate(theta));
    set(el['sm-pointer'], 'transform', rotate(theta));
    set(el['sm-pointer-line'], 'transform', rotate(theta));
    const [nx, ny] = at(G.rotorLabelRadius, theta);
    const [sx, sy] = at(G.rotorLabelRadius, theta + 180);
    set(el['sm-rotor-n-label'], 'x', num(nx));
    set(el['sm-rotor-n-label'], 'y', num(ny + 5));
    set(el['sm-rotor-s-label'], 'x', num(sx));
    set(el['sm-rotor-s-label'], 'y', num(sy + 5));
  }

  // Stator field along (iA, iB): A+ points to 0°, B+ to 90°; the arrow is one filled outline with a halo stroke.
  function drawField(snapshot, iMax) {
    const magnitude = clamp(Math.hypot(snapshot.iA, snapshot.iB) / (iMax * Math.SQRT2), 0, 1);
    if (magnitude < 0.06) {
      set(el['sm-field'], 'visibility', 'hidden');
      return;
    }
    const angle = (Math.atan2(snapshot.iB, snapshot.iA) * 180) / Math.PI / P.polePairs;
    const length = G.fieldMin + (G.fieldMax - G.fieldMin) * magnitude;
    const a = (angle * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const head = 9;
    const pts = [[0, -2], [length - head, -2], [length - head, -6], [length, 0], [length - head, 6], [length - head, 2], [0, 2]];
    const d = pts.map(([u, v], index) => `${index ? 'L' : 'M'}${num(G.cx + u * ux - v * uy)} ${num(G.cy + u * uy + v * ux)}`).join('') + 'Z';
    set(el['sm-field'], 'd', d);
    set(el['sm-field'], 'visibility', 'visible');
  }

  // Commanded angle (the controller's open-loop belief) as a dashed ghost, and the lag arc from it to the shaft.
  function drawCommand(snapshot) {
    const shown = snapshot.energized ? 'visible' : 'hidden';
    set(el['sm-ghost'], 'visibility', shown);
    set(el['sm-ghost-line'], 'visibility', shown);
    if (!snapshot.energized) {
      set(el['sm-lag'], 'd', '');
      return;
    }
    const commanded = snapshot.commandedDeg;
    set(el['sm-ghost'], 'transform', rotate(commanded));
    set(el['sm-ghost-line'], 'transform', rotate(commanded));
    const error = wrapError(snapshot.thetaDeg - commanded);
    if (Math.abs(error) < 1.5) {
      set(el['sm-lag'], 'd', '');
      return;
    }
    const [x0, y0] = at(G.scaleRadius, commanded);
    const [x1, y1] = at(G.scaleRadius, commanded + error);
    set(el['sm-lag'], 'd', `M${num(x0)} ${num(y0)}A${G.scaleRadius} ${G.scaleRadius} 0 0 ${error > 0 ? 1 : 0} ${num(x1)} ${num(y1)}`);
    set(el['sm-lag'], 'data-level', Math.abs(error) > 90 ? 'large' : 'small'); // beyond one full step: about to slip
  }

  // Graph strip: the newest history sample sits at the right edge; polylines and paths are rewritten in place.
  function drawGraph(snapshot, iMax) {
    const h = snapshot.history;
    const count = h.t.length;
    const x0 = G.plotX0;
    const x1 = G.plotX1;
    const span = x1 - x0;
    const c = G.current;
    const e = G.error;
    const cMid = (c.top + c.bottom) / 2;
    const cHalf = (c.bottom - c.top) / 2;
    const eMid = (e.top + e.bottom) / 2;
    const eHalf = (e.bottom - e.top) / 2;
    const full = iMax * G.currentHeadroom;
    const end = count ? h.t[count - 1] : 0;
    const a = [];
    const b = [];
    const err = [];
    const lines = [];
    const marks = [];
    let previous = null;
    for (let k = 0; k < count; k++) {
      const x = num(x1 - ((end - h.t[k]) / G.windowSeconds) * span);
      a.push(`${x},${num(cMid - clamp(h.iA[k] / full, -1, 1) * cHalf)}`);
      b.push(`${x},${num(cMid - clamp(h.iB[k] / full, -1, 1) * cHalf)}`);
      const error = wrapError(h.actualDeg[k] - h.commandedDeg[k]);
      // A wrap past ±180° is a jump, not a slope: start a new sub-path instead of drawing a vertical stroke.
      err.push(`${previous === null || Math.abs(error - previous) > PERIOD / 2 ? 'M' : 'L'}${x} ${num(eMid - (error / (PERIOD / 2)) * eHalf)}`);
      previous = error;
      if (h.slip[k]) {
        lines.push(`M${x} ${e.top}V${e.bottom}`);
        marks.push(`M${num(Number(x) - 5)} ${e.top + 1}h10l-5 8z`);
      }
    }
    set(el['sm-trace-a'], 'points', a.join(' '));
    set(el['sm-trace-b'], 'points', b.join(' '));
    set(el['sm-trace-error'], 'd', err.join(''));
    set(el['sm-slip-lines'], 'd', lines.join(''));
    set(el['sm-slip-marks'], 'd', marks.join(''));
    text(el['sm-current-max'], `+${amps(iMax)} A`);
    text(el['sm-current-min'], `\u2212${amps(iMax)} A`);
  }

  let lastSnapshot = null;
  let lastFocus = null;
  return {
    render(snapshot, options) {
      const focus = options && typeof options.focus === 'string' ? options.focus : 'all';
      if (snapshot === lastSnapshot && focus === lastFocus) return;
      set(view, 'data-sm-focus', focus);
      lastFocus = focus;
      if (snapshot === lastSnapshot) return;
      lastSnapshot = snapshot;
      const iMax = snapshot.controls.voltage / R;
      drawCoils(snapshot, iMax);
      drawRotor(snapshot);
      drawField(snapshot, iMax);
      drawCommand(snapshot);
      drawGraph(snapshot, iMax);
    },
    dispose() {
      for (const [node, saved] of authoredAttrs) {
        for (const [name, value] of saved) {
          if (value === null) node.removeAttribute(name);
          else node.setAttribute(name, value);
        }
      }
      for (const [node, value] of authoredText) node.textContent = value;
      authoredAttrs.clear();
      authoredText.clear();
      written.clear();
      lastSnapshot = null;
      lastFocus = null;
    },
  };
});
runtime.boot({
  slug: "stepper-motor",
  descriptor: {"title":"Động cơ bước quay từng nấc thế nào?","controls":{"groups":[{"key":"manual","label":"Tự cấp điện","controls":[{"type":"toggle3","key":"phaseA","label":"Cuộn A","options":[{"value":-1,"label":"−"},{"value":0,"label":"Tắt"},{"value":1,"label":"+"}]},{"type":"toggle3","key":"phaseB","label":"Cuộn B","options":[{"value":-1,"label":"−"},{"value":0,"label":"Tắt"},{"value":1,"label":"+"}]}]},{"key":"auto","label":"Chạy tự động","controls":[{"type":"segmented","key":"drive","label":"Kiểu kích","options":[{"value":"manual","label":"Tự cấp điện"},{"value":"wave","label":"Một cuộn"},{"value":"full","label":"Hai cuộn"},{"value":"half","label":"Nửa bước"},{"value":"micro","label":"Vi bước"}]},{"type":"segmented","key":"direction","label":"Chiều quay","options":[{"value":1,"label":"Thuận"},{"value":-1,"label":"Ngược"}]},{"type":"range","key":"rate","label":"Tốc độ","min":1,"max":100,"step":1,"unit":"bước đủ/giây"}]},{"key":"strength","label":"Thử sức động cơ","controls":[{"type":"range","key":"load","label":"Tải","min":0,"max":0.3,"step":0.01,"unit":"N·m"},{"type":"range","key":"voltage","label":"Điện áp nguồn","min":3,"max":24,"step":1,"unit":"V"}]}],"presets":[{"key":"default","label":"Mặc định"},{"key":"manual","label":"Tự cấp điện"},{"key":"half","label":"Nửa bước"},{"key":"micro","label":"Vi bước"},{"key":"tooFast","label":"Bước quá nhanh"},{"key":"highVoltage","label":"Điện áp cao"}],"challenges":[{"key":"oneTurn","label":"Quay đúng một vòng bằng 4 bước đủ, không trượt"},{"key":"halfStepStop","label":"Dừng rotor ở 45° bằng nửa bước hoặc vi bước"},{"key":"makeItSlip","label":"Làm động cơ trượt bước"},{"key":"fastNoSlip","label":"Chạy 40 bước/giây trong 2 giây mà không trượt"}]}},
  data: {"version":1,"params":{"substepHz":4000,"polePairs":1,"microstepsPerFullStep":8,"resistance":2,"inductance":0.05,"torqueConstant":0.2,"inertia":0.0002,"viscousDamping":0.0002,"bearingFriction":0.005,"stepSettleSeconds":0.3,"historySeconds":2,"historyEverySubsteps":20,"restOmega":0.5,"stickOmega":0.001,"staticFrictionRatio":1.1,"slipStatusSeconds":0.5,"unstableOffsetDeg":5,"fastNoSlipRate":40,"fastNoSlipSeconds":2,"oneTurnToleranceDeg":5,"halfStepToleranceDeg":3},"controls":{"groups":[{"key":"manual","label":"Tự cấp điện","controls":[{"type":"toggle3","key":"phaseA","label":"Cuộn A","options":[{"value":-1,"label":"−"},{"value":0,"label":"Tắt"},{"value":1,"label":"+"}]},{"type":"toggle3","key":"phaseB","label":"Cuộn B","options":[{"value":-1,"label":"−"},{"value":0,"label":"Tắt"},{"value":1,"label":"+"}]}]},{"key":"auto","label":"Chạy tự động","controls":[{"type":"segmented","key":"drive","label":"Kiểu kích","options":[{"value":"manual","label":"Tự cấp điện"},{"value":"wave","label":"Một cuộn"},{"value":"full","label":"Hai cuộn"},{"value":"half","label":"Nửa bước"},{"value":"micro","label":"Vi bước"}]},{"type":"segmented","key":"direction","label":"Chiều quay","options":[{"value":1,"label":"Thuận"},{"value":-1,"label":"Ngược"}]},{"type":"range","key":"rate","label":"Tốc độ","min":1,"max":100,"step":1,"unit":"bước đủ/giây"}]},{"key":"strength","label":"Thử sức động cơ","controls":[{"type":"range","key":"load","label":"Tải","min":0,"max":0.3,"step":0.01,"unit":"N·m"},{"type":"range","key":"voltage","label":"Điện áp nguồn","min":3,"max":24,"step":1,"unit":"V"}]}],"presets":[{"key":"default","label":"Mặc định","startDeg":45,"values":{"drive":"full","direction":1,"rate":8,"load":0.01,"voltage":6,"phaseA":1,"phaseB":1}},{"key":"manual","label":"Tự cấp điện","startDeg":30,"values":{"drive":"manual","direction":1,"rate":8,"load":0.01,"voltage":6,"phaseA":0,"phaseB":0}},{"key":"half","label":"Nửa bước","startDeg":0,"values":{"drive":"half","direction":1,"rate":4,"load":0.01,"voltage":6,"phaseA":1,"phaseB":0}},{"key":"micro","label":"Vi bước","startDeg":0,"values":{"drive":"micro","direction":1,"rate":4,"load":0.01,"voltage":6,"phaseA":1,"phaseB":0}},{"key":"tooFast","label":"Bước quá nhanh","startDeg":45,"values":{"drive":"full","direction":1,"rate":40,"load":0.01,"voltage":6,"phaseA":1,"phaseB":1}},{"key":"highVoltage","label":"Điện áp cao","startDeg":45,"values":{"drive":"full","direction":1,"rate":40,"load":0.01,"voltage":24,"phaseA":1,"phaseB":1}}],"challenges":[{"key":"oneTurn","label":"Quay đúng một vòng bằng 4 bước đủ, không trượt"},{"key":"halfStepStop","label":"Dừng rotor ở 45° bằng nửa bước hoặc vi bước"},{"key":"makeItSlip","label":"Làm động cơ trượt bước"},{"key":"fastNoSlip","label":"Chạy 40 bước/giây trong 2 giây mà không trượt"}]},"scene":{"width":480,"height":630,"cx":240,"cy":192,"rotorRadius":50,"rotorLabelRadius":37,"shaftRadius":8,"boreRadius":56,"yokeInner":106,"yokeOuter":128,"scaleRadius":138,"labelRadius":163,"pointerTip":149,"fieldMin":15,"fieldMax":28,"plotX0":58,"plotX1":466,"current":{"top":404,"bottom":484},"error":{"top":516,"bottom":604},"currentHeadroom":1.25,"windowSeconds":2}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
