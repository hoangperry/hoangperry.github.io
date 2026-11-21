/* How Things Work · phase-detect-af · generated playground bundle (classic script). Do not edit. */
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
    paused: 'Không chạy',
    failed: 'Không chạy được phần tương tác. Hình vẫn ở dạng tĩnh và bài viết vẫn đọc được.',
    run: 'Đang chạy mô phỏng.',
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

    function read(repeatAnnouncement = false) {
      const next = validateSnapshot(model.snapshot(), index);
      if (next.announcement && (repeatAnnouncement || next.announcement !== lastModelNote)) modelNotes.push(next.announcement);
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
        if (key === 'run' || key === 'step') {
          if (before.running) return false;
          const refused = model.command({ key }) === false;
          const after = read(refused);
          if (refused || (key === 'run' && !after.running)) return false;
          runtimeNote = key === 'run' ? TEXT.run : TEXT.step(after.status);
          clock.reset();
        } else if (key === 'pause') {
          if (!before.running) return false;
          model.command({ key: 'pause' });
          runtimeNote = TEXT.pause;
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
  const { pupilHalfSpan, stepSeconds } = data.parameters;
  const [range, sceneControl, orderControl] = data.controls.groups[0].controls;
  const ticksPerDelta = Math.round(1 / range.step);
  const scenes = new Set(sceneControl.options.map(({ value }) => value));
  const orders = new Set(orderControl.options.map(({ value }) => value));
  const presets = new Map(Object.entries(data.presets).map(([key, values]) => [key, Object.freeze({ ...values })]));
  const defaults = presets.get('near-plane');
  const challenges = Object.freeze([]);
  const epsilon = 1e-12;
  const point = (x, level) => Object.freeze({ x, level });
  const flatSignal = Object.freeze([point(-7, 0.5), point(7, 0.5)]);
  const edgeSignal = (x) => Object.freeze([
    point(x - 7, 0.125), point(x - 0.5, 0.125), point(x + 0.5, 0.875), point(x + 7, 0.875),
  ]);
  const phaseText = {
    idle: 'Đang đọc một mặt đo tĩnh.',
    running: 'Đang hiệu chỉnh lý tưởng, mỗi lần một nấc.',
    paused: 'Đã dừng; giữ nguyên mặt đo.',
    done: 'Đã dừng tại mặt hội tụ.',
  };
  const format = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}`;
  const item = (key, label, text) => Object.freeze({ key, label, text });
  let controls = defaults;
  let time = 0;
  let nextEvent = stepSeconds;
  let phase = 'idle';
  let announcement = '';
  let optics, readout, cached;

  function edgeAt(signal) {
    for (let i = 1; i < signal.length; i++) {
      const before = signal[i - 1], after = signal[i];
      if (before.level < 0.5 && after.level >= 0.5) {
        return before.x + (after.x - before.x) * (0.5 - before.level) / (after.level - before.level);
      }
    }
    return null;
  }

  function measure() {
    if (optics) return optics;
    const delta = controls.defocus;
    const swapped = controls['pupil-order'] === 'swapped';
    const leftRayX = pupilHalfSpan * delta;
    const rightRayX = leftRayX === 0 ? 0 : -leftRayX;
    const signalLeft = controls.scene === 'flat' ? flatSignal : edgeSignal(leftRayX);
    const signalRight = controls.scene === 'flat' || delta === 0 ? signalLeft : edgeSignal(rightRayX);
    const signalA = swapped ? signalRight : signalLeft;
    const signalB = swapped ? signalLeft : signalRight;
    const edgeA = edgeAt(signalA);
    const edgeB = edgeAt(signalB);
    const shift = edgeA === null || edgeB === null ? null : edgeB - edgeA;
    // Undo the label convention before selecting a correction. Swapping names is not moving the lens.
    const normalizedShift = swapped && shift !== null ? -shift : shift;
    const correction = normalizedShift === null ? null : normalizedShift === 0 ? 'none' : normalizedShift > 0 ? 'increase' : 'decrease';
    const stage = shift === null ? 'unidentifiable' : delta < 0 ? 'before-focus' : delta > 0 ? 'after-focus' : 'in-focus';
    const result = shift === null ? 'Không đủ chi tiết' : `Δx = ${format(shift)}`;
    const direction = correction === null ? 'Không xác định hướng chỉnh' : correction === 'none' ? 'Đã đúng nét' :
      correction === 'increase' ? 'Tăng δ về 0' : 'Giảm δ về 0';
    readout = Object.freeze([
      item('defocus', 'δ · Lệch mặt hội tụ', format(delta)),
      item('edge-a', 'xA · Vị trí cạnh A', edgeA === null ? '—' : `${format(edgeA)} đv. hình`),
      item('edge-b', 'xB · Vị trí cạnh B', edgeB === null ? '—' : `${format(edgeB)} đv. hình`),
      item('shift', 'Δx = xB − xA', shift === null ? result : `${format(shift)} đv. hình`),
      item('correction', 'Hiệu chỉnh lý tưởng', direction),
    ]);
    optics = Object.freeze({
      leftRayX, rightRayX, signalA, signalB, edgeA, edgeB, shift, correction, stage, result, direction,
      reading: shift === null ? `${result} · Không có hướng chỉnh` : `${result} đv. hình · ${direction}`,
    });
    return optics;
  }

  function snapshot() {
    if (!cached) {
      const measured = measure();
      cached = Object.freeze({
        running: phase === 'running', phase, time, controls, optics: measured, readout, challenges,
        status: `${phaseText[phase]} ${measured.direction}.`, announcement,
      });
    }
    return cached;
  }

  function setControls(next) {
    controls = next;
    optics = null;
    cached = null;
  }

  function setStatic(next) {
    setControls(next);
    time = 0;
    nextEvent = stepSeconds;
    phase = 'idle';
    announcement = '';
    return true;
  }

  function reset() {
    return setStatic(defaults);
  }

  function canCorrect() {
    const { correction, direction } = measure();
    if (correction === 'increase' || correction === 'decrease') return true;
    const note = correction === null ? 'Không đủ chi tiết; không tiến hành hiệu chỉnh.' : `${direction}; không cần hiệu chỉnh.`;
    if (announcement !== note) {
      announcement = note;
      cached = null;
    }
    return false;
  }

  function adjustOnce() {
    const direction = measure().correction === 'increase' ? 1 : -1;
    const ticks = Math.round(controls.defocus * ticksPerDelta) + direction;
    setControls(Object.freeze({ ...controls, defocus: ticks / ticksPerDelta }));
    time = nextEvent;
    nextEvent += stepSeconds;
    if (ticks === 0) {
      phase = 'done';
      announcement = 'Hai cạnh trùng vị trí. Độ lệch bằng 0.';
    }
  }

  function command(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'preset') return presets.has(value) ? setStatic(presets.get(value)) : false;
    if (key === 'run' || key === 'step') {
      if (phase === 'running' || !canCorrect()) return false;
      phase = key === 'run' ? 'running' : 'paused';
      announcement = '';
      cached = null;
      if (key === 'step') adjustOnce();
      return true;
    }
    if (key === 'pause') {
      if (phase !== 'running') return false;
      phase = 'paused';
      announcement = '';
      cached = null;
      return true;
    }
    let normalized = value;
    if (key === range.key) {
      if (!Number.isFinite(value) || value < range.min - epsilon || value > range.max + epsilon) return false;
      const ticks = Math.round(value * ticksPerDelta);
      normalized = ticks === 0 ? 0 : ticks / ticksPerDelta;
      if (Math.abs(normalized - value) > epsilon) return false;
    } else if (key === sceneControl.key) {
      if (!scenes.has(value)) return false;
    } else if (key === orderControl.key) {
      if (!orders.has(value)) return false;
    } else return false;
    if (controls[key] === normalized) return false;
    return setStatic(Object.freeze({ ...controls, [key]: normalized }));
  }

  function advance(dt) {
    if (phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return false;
    let target = time + dt;
    if (target === time) return false;
    // Preserve the boundary (and exact zero) across different partitions of the same elapsed time.
    while (phase === 'running' && nextEvent - target <= epsilon) {
      if (Math.abs(target - nextEvent) <= epsilon) target = nextEvent;
      adjustOnce();
    }
    if (phase === 'running') time = target;
    cached = null;
    return true;
  }

  return { command, advance, snapshot, reset };
});
var mountRenderer = (function mountRenderer(root, data) {
    const renderer = (function mountRenderer(root, data) {
  const svg = root.querySelector('[data-machine-id="af-svg"]');
  const reading = root.querySelector('[data-camera-reading]');
  if (!svg) throw new Error('Cannot find the phase-difference illustration');
  const marks = new Map(Array.from(svg.querySelectorAll('[data-af-mark]'), (node) => [node.getAttribute('data-af-mark'), node]));
  const labels = new Map(Array.from(svg.querySelectorAll('[data-af-text]'), (node) => [node.getAttribute('data-af-text'), node]));
  const bench = svg.querySelector('.af-bench-motion');
  const benchPlane = marks.get('plate-plane');
  const benchTravel = benchPlane?.getAttribute('data-af-plate-travel')?.split(' ').map(Number);
  const benchIntercept = benchPlane?.getAttribute('data-af-plate-intercept')?.split(' ').map(Number);
  const translation = (vector, amount) => `translate(${vector.map((n) => Math.round(n * amount * 100) / 100).join(' ')})`;
  const originalAttrs = new Map();
  const originalTexts = new Map();
  const { pupilZ, focusZ, axisY, rayScale, plotCenterX, plotScale, plotBottomY, plotHeight } = data.geometry;
  const xAt = (x) => plotCenterX + x * plotScale;
  const yAt = (level) => plotBottomY - level * plotHeight;
  const trace = (signal) => signal.map(({ x, level }, i) => `${i ? 'L' : 'M'}${xAt(x)} ${yAt(level)}`).join('');
  let previousOptics;

  function attr(node, key, value) {
    if (!node) return;
    const old = node.getAttribute(key);
    const next = String(value);
    if (old === next) return;
    let properties = originalAttrs.get(node);
    if (!properties) { properties = new Map(); originalAttrs.set(node, properties); }
    if (!properties.has(key)) properties.set(key, old);
    node.setAttribute(key, next);
  }
  const mark = (key, property, value) => attr(marks.get(key), property, value);

  function text(node, value) {
    if (!node || node.textContent === value) return;
    if (!originalTexts.has(node)) originalTexts.set(node, node.textContent);
    node.textContent = value;
  }

  return {
    render({ controls, optics }, { focus = 'all' } = {}) {
      attr(svg, 'data-af-focus', focus);
      if (previousOptics === optics) return;
      previousOptics = optics;
      const order = controls['pupil-order'];
      const swapped = order === 'swapped';
      attr(svg, 'data-af-order', order);
      attr(svg, 'data-camera-stage', optics.stage);
      mark('plane', 'transform', `translate(${focusZ + (focusZ - pupilZ) * controls.defocus} 0)`);
      mark('ray-left', 'transform', `translate(0 ${axisY - optics.leftRayX * rayScale})`);
      mark('ray-right', 'transform', `translate(0 ${axisY - optics.rightRayX * rayScale})`);
      const left = swapped ? 'B' : 'A';
      const right = swapped ? 'A' : 'B';
      text(labels.get('pupil-left'), left);
      text(labels.get('diode-left'), left);
      text(labels.get('pupil-right'), right);
      text(labels.get('diode-right'), right);
      mark('signal-a', 'd', trace(optics.signalA));
      mark('signal-b', 'd', trace(optics.signalB));
      const hasEdges = optics.shift !== null;
      if (benchTravel && benchIntercept) {
        attr(bench, 'data-af-plate-contrast', hasEdges);
        attr(benchPlane, 'transform', translation(benchTravel, controls.defocus));
        mark('plate-hit-left', 'transform', translation(benchIntercept, optics.leftRayX));
        mark('plate-hit-right', 'transform', translation(benchIntercept, optics.rightRayX));
        text(labels.get('plate-pupil-left'), left);
        text(labels.get('plate-pupil-right'), right);
      }
      mark('edges', 'display', hasEdges ? 'inline' : 'none');
      if (hasEdges) {
        const midY = yAt(0.5);
        const xA = xAt(optics.edgeA);
        const xB = xAt(optics.edgeB);
        mark('edge-guides', 'd', `M${xA} ${midY}V${plotBottomY}M${xB} ${midY}V${plotBottomY}`);
        mark('edge-a', 'cx', xA);
        mark('edge-b', 'x', xB - 3.5);
      }
      text(labels.get('result'), hasEdges ? `${optics.result} đv. hình` : optics.result);
      text(labels.get('direction'), optics.direction);
      if (reading) text(reading, optics.reading);
    },
    dispose() {
      for (const [node, properties] of originalAttrs) for (const [key, value] of properties) {
        if (value === null) node.removeAttribute(key);
        else node.setAttribute(key, value);
      }
      for (const [node, value] of originalTexts) node.textContent = value;
    },
  };
})(root, data);
    const dock = root.querySelector('[data-camera-transport]');
    const transport = root.querySelector('[data-machine-console-panel] .htw-machine-controls');
    const run = transport?.querySelector('[data-machine-run]');
    if (!dock || !run) return renderer;
    const scene = dock.closest('[data-machine-scene]');
    const focusPlayback = () => {
      if (root.getAttribute('data-mode') !== 'explore') return;
      run.focus({ preventScroll: true });
      dock.scrollIntoView({ block: 'center', behavior: 'instant' });
    };
    scene.addEventListener('focus', focusPlayback);
    const home = transport.parentNode;
    const next = transport.nextSibling;
    dock.prepend(transport);
    return {
      render: renderer.render,
      dispose() {
        try { renderer.dispose(); }
        finally {
          scene.removeEventListener('focus', focusPlayback);
          home.insertBefore(transport, next);
        }
      },
    };
  });
runtime.boot({
  slug: "phase-detect-af",
  descriptor: {"title":"Máy ảnh biết phải lấy nét về hướng nào bằng cách nào?","controls":{"groups":[{"key":"measurement","label":"Mặt đo và mẫu sáng","controls":[{"type":"range","key":"defocus","label":"δ · Lệch mặt hội tụ","min":-0.25,"max":0.25,"step":0.05,"unit":"(tỷ lệ)"},{"type":"segmented","key":"scene","label":"Mẫu sáng","options":[{"value":"edge","label":"Cạnh tương phản"},{"value":"flat","label":"Mảng phẳng"}]},{"type":"segmented","key":"pupil-order","label":"Gán nhãn hai nửa khẩu độ","options":[{"value":"normal","label":"A = Trái"},{"value":"swapped","label":"A = Phải"}]}]}],"presets":[{"key":"near-plane","label":"Trước mặt hội tụ"},{"key":"aligned","label":"Đúng mặt hội tụ"},{"key":"far-plane","label":"Sau mặt hội tụ"},{"key":"flat-tone","label":"Mảng phẳng"}],"challenges":[]}},
  data: {"parameters":{"pupilHalfSpan":4,"stepSeconds":0.5},"geometry":{"pupilZ":68,"focusZ":320,"axisY":145,"rayScale":17,"plotCenterX":233,"plotScale":30,"plotBottomY":473,"plotHeight":108},"presets":{"near-plane":{"defocus":-0.25,"scene":"edge","pupil-order":"normal"},"aligned":{"defocus":0,"scene":"edge","pupil-order":"normal"},"far-plane":{"defocus":0.25,"scene":"edge","pupil-order":"normal"},"flat-tone":{"defocus":-0.25,"scene":"flat","pupil-order":"normal"}},"controls":{"groups":[{"key":"measurement","label":"Mặt đo và mẫu sáng","controls":[{"type":"range","key":"defocus","label":"δ · Lệch mặt hội tụ","min":-0.25,"max":0.25,"step":0.05,"unit":"(tỷ lệ)"},{"type":"segmented","key":"scene","label":"Mẫu sáng","options":[{"value":"edge","label":"Cạnh tương phản"},{"value":"flat","label":"Mảng phẳng"}]},{"type":"segmented","key":"pupil-order","label":"Gán nhãn hai nửa khẩu độ","options":[{"value":"normal","label":"A = Trái"},{"value":"swapped","label":"A = Phải"}]}]}],"presets":[{"key":"near-plane","label":"Trước mặt hội tụ"},{"key":"aligned","label":"Đúng mặt hội tụ"},{"key":"far-plane","label":"Sau mặt hội tụ"},{"key":"flat-tone","label":"Mảng phẳng"}],"challenges":[]}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
