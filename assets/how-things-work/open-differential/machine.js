/* How Things Work · open-differential · generated playground bundle (classic script). Do not edit. */
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
    if (snapshot.stepUnavailableReason != null && typeof snapshot.stepUnavailableReason !== 'string') fail('stepUnavailableReason must be text');
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
    if (map.size > 0) {
      for (const subtree of subtrees) {
        for (const element of [subtree, ...subtree.querySelectorAll('[id]')]) {
          if (map.has(element.id)) set(element, 'id', map.get(element.id));
        }
      }
      for (const element of [root, ...root.querySelectorAll('*')]) {
        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.name;
          if (name === 'id' || name === 'data-machine-id') continue;
          const next = rewriteAttribute(name, attribute.value, map);
          if (next !== attribute.value) set(element, name, next);
        }
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
    let stepReason;
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
      stepReason = options.stepReasons ? (options.stepReasons[next.phase] ?? null) : next.stepUnavailableReason;
      return next;
    }

    function takeAnnouncement() {
      const parts = [runtimeNote, ...modelNotes].filter(Boolean);
      runtimeNote = null;
      modelNotes = [];
      return parts.length ? parts.join(' ') : null;
    }

    const view = () => ({ snapshot: current, mode, focus, theme, stepReason, announcement: takeAnnouncement() });
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
          if (key === 'step' && stepReason) {
            runtimeNote = stepReason;
            return false;
          }
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
    function writeView({ snapshot, focus, theme, stepReason, announcement }) {
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
      setAttr(ui.step, 'aria-disabled', String(snapshot.running || Boolean(stepReason)));
      if (stepReason !== undefined) setAttr(ui.step, 'title', stepReason || '');
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
        if (next === 'explore') {
          if (typeof renderer.focusExplore === 'function') renderer.focusExplore();
          else scene.focus({ preventScroll: false });
        } else {
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
        stepReasons: data.stepUnavailableByPhase,
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
  const fail = (why) => { throw new Error(`Invalid open-differential data: ${why}`); };
  const isPlain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (!isPlain(data)) fail('data must be a plain object');
  if (data.schemaVersion !== 1) fail('schemaVersion must be 1');
  // Private plain copy of only what the model reads (composer-added data.scene is ignored); input is never written.
  const config = JSON.parse(JSON.stringify({ parameters: data.parameters, defaults: data.defaults, controls: data.controls, text: data.text }));
  const FRAME = 'reference-frame';
  const PHYSICAL = ['scenario', 'carrier-rpm', 'turn-side', 'turn-radius', 'low-grip-side', 'low-grip-mu'];
  const KEYS = [...PHYSICAL, FRAME];
  const CHOICES = { scenario: ['straight', 'corner', 'stuck'], 'turn-side': ['left', 'right'], 'low-grip-side': ['left', 'right'], [FRAME]: ['world', 'carrier'] };
  const CHALLENGES = ['straight', 'corner', 'stuck', 'both-grip-sides'];
  const SCENARIO_TEXT = { straight: 'đi thẳng', corner: 'vào cua', stuck: 'bàn thử một trục bị giữ' };
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const sameKeys = (object, keys) => isPlain(object) && Object.keys(object).length === keys.length && keys.every((key) => has(object, key));
  const text = (value) => typeof value === 'string' && value.trim() !== '';

  // ---------- data validation ----------
  const P = config.parameters;
  const parameterKeys = ['wheelRadiusM', 'trackWidthM', 'normalLoadN', 'highGripMu', 'sideTeeth', 'spiderTeeth', 'durationSeconds', 'stepSeconds'];
  if (!sameKeys(P, parameterKeys)) fail(`parameters must have exactly ${parameterKeys.join(', ')}`);
  for (const key of parameterKeys) if (typeof P[key] !== 'number' || !Number.isFinite(P[key]) || !(P[key] > 0)) fail(`parameters.${key} must be a finite number > 0`);
  for (const key of ['sideTeeth', 'spiderTeeth']) if (!Number.isInteger(P[key])) fail(`parameters.${key} must be an integer`);
  if (!(P.stepSeconds <= P.durationSeconds)) fail('parameters.stepSeconds must not exceed durationSeconds');

  const C = config.controls;
  if (!isPlain(C) || !Array.isArray(C.groups) || !Array.isArray(C.presets) || !Array.isArray(C.challenges)) fail('controls needs groups, presets and challenges arrays');
  const descriptors = {};
  for (const group of C.groups) {
    if (!isPlain(group) || !Array.isArray(group.controls)) fail('every control group needs a controls array');
    for (const control of group.controls) {
      if (!isPlain(control) || !KEYS.includes(control.key)) fail(`undeclared control ${JSON.stringify(control && control.key)}`);
      if (has(descriptors, control.key)) fail(`duplicate control ${control.key}`);
      descriptors[control.key] = control;
    }
  }
  const decimalsOf = (number) => {
    const string = String(number);
    const exponent = /e-(\d+)$/.exec(string);
    return Math.min(20, exponent ? Number(exponent[1]) : (string.split('.')[1] || '').length);
  };
  const ranges = {};
  for (const key of KEYS) {
    const control = descriptors[key];
    if (!control) fail(`control ${key} is missing`);
    if (has(CHOICES, key)) {
      const values = Array.isArray(control.options) ? control.options.map((option) => option && option.value) : [];
      if (control.type !== 'segmented' || values.length !== CHOICES[key].length || !CHOICES[key].every((value) => values.includes(value))) {
        fail(`control ${key} must be segmented with exactly ${CHOICES[key].join('/')}`);
      }
    } else {
      const { min, max, step } = control;
      if (control.type !== 'range' || ![min, max, step].every((value) => typeof value === 'number' && Number.isFinite(value)) || !(min < max) || !(step > 0)) fail(`control ${key} must be a finite range`);
      const count = (max - min) / step;
      if (Math.abs(count - Math.round(count)) > 1e-9) fail(`control ${key} range is not a whole number of steps`);
      ranges[key] = { min, max, step, decimals: Math.max(decimalsOf(step), decimalsOf(min)) };
    }
  }
  if (!(ranges['carrier-rpm'].min > 0)) fail('carrier-rpm must stay above 0');
  if (!(ranges['turn-radius'].min > P.trackWidthM / 2)) fail('turn-radius must stay above half the track width');
  if (!(ranges['low-grip-mu'].min >= 0 && ranges['low-grip-mu'].max < P.highGripMu)) fail('low-grip-mu must lie in [0, highGripMu)');

  // Exact step alignment: the accepted value must equal its own canonical grid point, never a nearby float.
  function parse(key, raw) {
    if (has(CHOICES, key)) return typeof raw === 'string' && CHOICES[key].includes(raw) ? raw : null;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const { min, max, step, decimals } = ranges[key];
    if (raw < min || raw > max) return null;
    const grid = Number((min + Math.round((raw - min) / step) * step).toFixed(decimals));
    return raw === grid ? grid : null;
  }
  function checkValues(values, keys, what) {
    if (!sameKeys(values, keys)) fail(`${what} must have exactly ${keys.join(', ')}`);
    const result = {};
    for (const key of keys) {
      result[key] = parse(key, values[key]);
      if (result[key] === null) fail(`${what}.${key} holds an invalid value ${JSON.stringify(values[key])}`);
    }
    return result;
  }
  const defaults = checkValues(config.defaults, KEYS, 'defaults');
  const presets = new Map();
  for (const preset of C.presets) {
    if (!isPlain(preset) || !text(preset.key) || !text(preset.label)) fail('presets need key and label');
    if (presets.has(preset.key)) fail(`duplicate preset ${preset.key}`);
    // Presets carry physical values only: the presentation frame is preserved across presets.
    presets.set(preset.key, checkValues(preset.values, PHYSICAL, `preset ${preset.key}`));
  }
  const challengeKeys = C.challenges.map((item) => (isPlain(item) ? item.key : null));
  if (challengeKeys.length !== CHALLENGES.length || !CHALLENGES.every((key) => challengeKeys.includes(key))) fail(`challenges must be exactly ${CHALLENGES.join(', ')}`);
  const T = config.text;
  if (!isPlain(T) || !isPlain(T.boundary) || !CHOICES.scenario.every((key) => text(T.boundary[key])) || !text(T.zeroGripNote)) fail('text.boundary.{straight,corner,stuck} and text.zeroGripNote are required');

  // ---------- state ----------
  const r = P.wheelRadiusM, b = P.trackWidthM, N = P.normalLoadN, duration = P.durationSeconds;
  const ratio = P.sideTeeth / P.spiderTeeth;
  let controls, experiment, elapsed, correction, running, completedExperiments, observedGripSides, done, announcement, cached;

  function seal(value) {
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        const item = value[key];
        if (typeof item === 'number') {
          if (!Number.isFinite(item)) throw new Error(`open-differential snapshot ${key} is not finite`);
          if (item === 0) value[key] = 0; // never -0
        } else seal(item);
      }
      Object.freeze(value);
    }
    return value;
  }

  const busy = () => experiment && elapsed < duration;
  const touch = () => { announcement = null; cached = null; };
  function loadPhysical(values) {
    controls = { ...values, [FRAME]: controls[FRAME] };
    experiment = false; elapsed = 0; correction = 0; running = false;
    touch();
  }
  function reset() {
    controls = { ...defaults };
    experiment = false; elapsed = 0; correction = 0; running = false;
    completedExperiments = 0; observedGripSides = [];
    done = Object.fromEntries(CHALLENGES.map((key) => [key, false]));
    touch();
  }
  function start() {
    experiment = true; elapsed = 0; correction = 0; running = true;
    touch();
  }
  function complete() {
    running = false;
    completedExperiments += 1;
    const scenario = controls.scenario;
    done[scenario] = true;
    if (scenario === 'stuck') {
      const side = controls['low-grip-side'];
      if (!observedGripSides.includes(side)) observedGripSides = [...observedGripSides, side];
      if (observedGripSides.length === 2) done['both-grip-sides'] = true;
    }
    announcement = `Đã hoàn tất trọn ${duration} s thí nghiệm ${SCENARIO_TEXT[scenario]}; hình dừng để đọc kết quả.`;
  }
  // One compensated (Kahan) elapsed source; completion lands exactly on the declared duration.
  function move(seconds) {
    const remaining = duration - elapsed;
    if (seconds >= remaining) {
      elapsed = duration; correction = 0;
      complete();
    } else {
      const delta = seconds - correction;
      const next = elapsed + delta;
      correction = (next - elapsed) - delta;
      elapsed = next;
      announcement = null;
      if (elapsed >= duration) { elapsed = duration; correction = 0; complete(); }
    }
    cached = null;
  }
  function advance(dt) {
    if (!running || !busy() || typeof dt !== 'number' || !Number.isFinite(dt) || !(dt > 0)) return;
    move(dt);
  }
  function command(input) {
    if (!isPlain(input) || typeof input.key !== 'string') return;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'preset') {
      if (typeof value === 'string' && presets.has(value)) loadPhysical(presets.get(value));
      return;
    }
    if (key === 'run') {
      if (!busy()) start();
      else if (!running) { running = true; touch(); }
      return;
    }
    if (key === 'pause') {
      if (running) { running = false; touch(); }
      return;
    }
    if (key === 'step') {
      if (!running && busy()) move(Math.min(P.stepSeconds, duration - elapsed));
      return;
    }
    if (key === FRAME) {
      // Presentation only: accepted while busy, never touches time, angles, path or badges.
      const next = parse(FRAME, value);
      if (next !== null && next !== controls[FRAME]) { controls = { ...controls, [FRAME]: next }; cached = null; }
      return;
    }
    if (!PHYSICAL.includes(key) || busy()) return;
    const next = parse(key, value);
    if (next === null || next === controls[key]) return;
    const physical = {};
    for (const name of PHYSICAL) physical[name] = controls[name];
    loadPhysical({ ...physical, [key]: next });
  }

  // ---------- closed-form state ----------
  function kinematics(values) {
    const scenario = values.scenario;
    const rpmC = values['carrier-rpm'];
    let rpmL = rpmC, rpmR = rpmC, heldSide = null;
    let centerRadiusM = null, leftRadiusM = null, rightRadiusM = null, yawSign = 0;
    if (scenario === 'corner') {
      // s = +1 left turn, -1 right turn; both rear tracks are concentric circles R -/+ s*b/2 without slip.
      const s = values['turn-side'] === 'left' ? 1 : -1;
      const R = values['turn-radius'];
      const k = s * b / (2 * R);
      rpmL = rpmC * (1 - k); rpmR = rpmC * (1 + k);
      centerRadiusM = R; leftRadiusM = R - s * b / 2; rightRadiusM = R + s * b / 2; yawSign = s;
    } else if (scenario === 'stuck') {
      // External held boundary on the grippy side; omegaL + omegaR = 2 omegaC gives 2 omegaC on the low-grip side.
      heldSide = values['low-grip-side'] === 'left' ? 'right' : 'left';
      rpmL = heldSide === 'left' ? 0 : 2 * rpmC;
      rpmR = heldSide === 'right' ? 0 : 2 * rpmC;
    }
    const rpmS = ratio * (rpmR - rpmC);
    const w = (rpm) => rpm * Math.PI / 30;
    const speeds = { carrier: w(rpmC), left: w(rpmL), right: w(rpmR), spiderOwn: w(rpmS), leftRelative: w(rpmL - rpmC), rightRelative: w(rpmR - rpmC) };
    const centerSpeedMps = scenario === 'stuck' ? 0 : r * speeds.carrier;
    const yawRate = scenario === 'corner' ? yawSign * centerSpeedMps / centerRadiusM : 0;
    const muLow = values['low-grip-mu'];
    const effectiveGrip = {
      left: scenario === 'stuck' && values['low-grip-side'] === 'left' ? muLow : P.highGripMu,
      right: scenario === 'stuck' && values['low-grip-side'] === 'right' ? muLow : P.highGripMu,
    };
    const tractionCapacity = { left: effectiveGrip.left * N * r, right: effectiveGrip.right * N * r };
    const commonTorqueLimit = Math.min(tractionCapacity.left, tractionCapacity.right);
    return { scenario, rpm: { carrier: rpmC, left: rpmL, right: rpmR, spiderOwn: rpmS }, speeds, heldSide,
      centerRadiusM, leftRadiusM, rightRadiusM, centerSpeedMps, yawRate, effectiveGrip, tractionCapacity,
      commonTorqueLimit, axleTorqueLimit: 2 * commonTorqueLimit, zeroGrip: scenario === 'stuck' && muLow === 0 };
  }

  function number(value, decimals = 2, signed = false) {
    let string = value.toFixed(decimals);
    if (Number(string) === 0) return '0';
    if (string.includes('.')) string = string.replace(/0+$/, '').replace(/\.$/, '');
    return `${signed && value > 0 ? '+' : ''}${string}`.replace('-', '−').replace('.', ',');
  }

  function phase() {
    if (!experiment) return 'idle';
    if (busy()) return running ? 'running' : 'paused';
    return 'done';
  }

  function snapshot() {
    if (cached) return cached;
    const k = kinematics(controls);
    const t = elapsed;
    const angles = {};
    for (const key of Object.keys(k.speeds)) angles[key] = k.speeds[key] * t; // closed form, unwrapped
    const stuck = k.scenario === 'stuck';
    const path = {
      centerRadiusM: k.centerRadiusM, leftRadiusM: k.leftRadiusM, rightRadiusM: k.rightRadiusM,
      centerSpeedMps: k.centerSpeedMps, yawRate: k.yawRate,
      groundTravelLeftM: stuck ? 0 : r * angles.left, groundTravelRightM: stuck ? 0 : r * angles.right,
      centerDistanceM: k.centerSpeedMps * t,
      treadTravelLeftM: r * angles.left, treadTravelRightM: r * angles.right,
    };
    const state = phase();
    const scenarioText = SCENARIO_TEXT[k.scenario];
    const status = {
      idle: `Sẵn sàng: Chạy mở một thí nghiệm ${scenarioText} độc lập từ t = 0 s, mọi góc bằng 0.`,
      running: `Đang chạy thí nghiệm ${scenarioText}: ${number(t, 1)} / ${number(duration)} s mô phỏng.`,
      paused: `Đã tạm dừng ở ${number(t, 1)} s mô phỏng; Chạy để tiếp tục, Từng bước đi thêm ${number(P.stepSeconds)} s.`,
      done: `Đã xong ${number(duration)} s thí nghiệm ${scenarioText}; hình dừng để đọc kết quả.`,
    }[state];
    const held = (side) => (k.heldSide === side ? ' · bị giữ đứng yên' : '');
    const pathText = k.scenario === 'corner'
      ? `Vệt trái ${number(k.leftRadiusM)} m · vệt phải ${number(k.rightRadiusM)} m`
      : stuck ? 'Bàn thử: xe không di chuyển trên mặt đất' : 'Đi thẳng: hai vệt bánh song song';
    const readout = [
      { key: 'carrier', label: 'Vỏ vi sai (tốc độ áp đặt)', text: `${number(k.rpm.carrier)} RPM` },
      { key: 'left', label: 'Trục bánh trái', text: `${number(k.rpm.left)} RPM${held('left')}` },
      { key: 'right', label: 'Trục bánh phải', text: `${number(k.rpm.right)} RPM${held('right')}` },
      { key: 'relative', label: 'Bánh răng bán trục so với vỏ (trái / phải)', text: `${number(k.rpm.left - k.rpm.carrier, 2, true)} / ${number(k.rpm.right - k.rpm.carrier, 2, true)} RPM` },
      { key: 'spider-orbit', label: 'Bánh răng hành tinh đi theo vỏ quanh trục cầu', text: `${number(k.rpm.carrier)} RPM` },
      { key: 'spider-own', label: 'Bánh răng hành tinh tự quay quanh chốt', text: `${number(k.rpm.spiderOwn, 2, true)} RPM` },
      { key: 'path', label: 'Quỹ đạo', text: pathText },
      { key: 'ground', label: 'Quãng đường trên mặt đất (trái / phải)', text: `${number(path.groundTravelLeftM)} / ${number(path.groundTravelRightM)} m` },
      { key: 'tread', label: 'Mặt lốp đi qua do tự quay rθ (trái / phải)', text: `${number(path.treadTravelLeftM)} / ${number(path.treadTravelRightM)} m` },
      { key: 'capacity', label: 'Trần bám từng bánh µNr (trái / phải)', text: `${number(k.tractionCapacity.left, 1)} / ${number(k.tractionCapacity.right, 1)} Nm` },
      { key: 'common-limit', label: 'Trần mô-men chung mỗi phía (giới hạn, không phải mô-men thực)', text: `${number(k.commonTorqueLimit, 1)} Nm` },
      { key: 'axle-limit', label: 'Trần mô-men cả cầu (giới hạn)', text: `${number(k.axleTorqueLimit, 1)} Nm` },
      { key: 'time', label: 'Thời gian mô phỏng', text: `${number(t)} / ${number(duration)} s` },
    ];
    cached = seal({
      time: t, running, controls: { ...controls }, status, readout, announcement,
      challenges: CHALLENGES.map((key) => ({ key, done: done[key] })),
      scenario: k.scenario, phase: state, busy: Boolean(busy()), elapsed: t, duration, progress: t / duration,
      angles, angularSpeeds: { ...k.speeds }, rpm: { ...k.rpm }, path,
      tractionCapacity: { ...k.tractionCapacity }, commonTorqueLimit: k.commonTorqueLimit, axleTorqueLimit: k.axleTorqueLimit,
      effectiveGrip: { ...k.effectiveGrip },
      boundary: { heldSide: k.heldSide, imposedCarrier: true, label: T.boundary[k.scenario], zeroGripNote: k.zeroGrip ? T.zeroGripNote : '' },
      completedExperiments, observedGripSides: [...observedGripSides],
    });
    return cached;
  }

  controls = {};
  reset();
  return Object.freeze({ snapshot, advance, command, reset });
});
var mountRenderer = (function mountRenderer(root, data) {
  'use strict';
  const S = data.scene;
  const P = data.parameters;
  if (!S || !P || !data.defaults) throw new Error('open-differential renderer: missing scene, parameters or defaults data');
  const svg = root.querySelector('[data-machine-id="od-svg"]');
  if (!svg) throw new Error('open-differential renderer: missing od-svg');
  const scene = svg.closest('[data-machine-scene]');
  const caption = scene && root.contains(scene) ? scene.querySelector('.htw-machine-caption') : null;
  if (!caption) throw new Error('open-differential renderer: missing figure caption');
  const FRAME = 'reference-frame';
  const focusKeys = ['all', 'carrier', 'side-gears', 'straight', 'corner', 'spider', 'grip', 'torque', 'limits'];

  // The one pure view transform, identical line by line to scene/differential-drawing.mjs (tested).
  function viewModel(s, S, highGripMu) {
    const num = (n) => String(Number(n.toFixed(3)));
    const deg = (radians) => {
      let value = Number(((((radians * 180 / Math.PI) % 360) + 360) % 360).toFixed(3));
      if (value >= 360) value -= 360;
      return String(value);
    };
    const fmt = (value, decimals = 2, signed = false) => {
      let text = value.toFixed(decimals);
      if (Number(text) === 0) return '0';
      if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
      return `${signed && value > 0 ? '+' : ''}${text}`.replace('-', '−').replace('.', ',');
    };
    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const name = (side) => (side === 'left' ? 'trái' : 'phải');
    const carrierFrame = s.controls['reference-frame'] === 'carrier';
    const held = s.boundary.heldSide;
    const grip = (side) => (s.effectiveGrip[side] < highGripMu - 1e-9 ? 'low' : 'high');
    const D = S.dials;
    const rotate = (key, angle) => `rotate(${deg(angle)} ${D[key].x} ${D[key].y})`;
    const relRpm = (radPerSecond) => radPerSecond * 30 / Math.PI;
    const attrs = [];
    const texts = [];
    const a = (id, attr, value) => attrs.push([id, attr, String(value)]);
    const t = (id, value) => texts.push([id, value]);

    // Back view (body frame, never rotates): grip patches, µ labels and the external held-axle clamp.
    for (const side of ['left', 'right']) {
      a(`od-road-${side}`, 'data-grip', grip(side));
      a(`od-wheel-${side}`, 'data-held', held === side);
      a(`od-held-${side}`, 'data-hidden', held !== side);
      a(`od-band-held-${side}`, 'data-hidden', held !== side);
      t(`od-mu-${side}`, `µ ${fmt(s.effectiveGrip[side])} · ${grip(side) === 'low' ? 'trơn' : 'bám'}`);
    }

    // Two short scenario lines under the wheels, measured against the car body. The full boundary sentence and the
    // µ = 0 note are long prose: they go to renderer-owned caption paragraphs (captions below), never truncated.
    const B = S.band;
    const maxChars = Math.floor((B.x1 - B.x0) / (S.fontSize * S.charEm));
    let band;
    if (s.scenario === 'stuck') {
      const lowSide = held === 'left' ? 'right' : 'left';
      band = [`Bàn thử · bánh ${name(lowSide)} ít bám: ${fmt(s.rpm[lowSide])} RPM`, `trục ${name(held)} bị giữ: ${fmt(s.rpm[held])} RPM so với thân xe`];
    } else if (s.scenario === 'corner') {
      band = [`Cua ${name(s.controls['turn-side'])} · bán kính tâm cầu ${fmt(s.path.centerRadiusM)} m`, `vệt bánh trái ${fmt(s.path.leftRadiusM)} m · vệt bánh phải ${fmt(s.path.rightRadiusM)} m`];
    } else {
      band = ['Đi thẳng · hai vệt bánh song song', `trái ${fmt(s.rpm.left)} · phải ${fmt(s.rpm.right)} · vỏ ${fmt(s.rpm.carrier)} RPM so với thân xe`];
    }
    for (const line of band) if (line.length > maxChars) throw new Error(`open-differential view: "${line}" exceeds ${maxChars} characters`);
    band.forEach((line, i) => t(`od-band-${i}`, line));
    t('od-desc', `${S.description} ${band.join(' ')}`);
    const captions = [['boundary', s.boundary.label], ['zero-grip', s.boundary.zeroGripNote]];

    // Linked same-view dials. The carrier frame is presentation only: it subtracts the carrier angle for display and
    // says so; the imposed carrier rate and the spider orbit are always quoted against the car body.
    t('od-dial-heading', carrierFrame
      ? `Số đo so với vỏ · vỏ ${fmt(s.rpm.carrier)} RPM so với thân xe`
      : `Số đo so với thân xe · vỏ áp đặt ${fmt(s.rpm.carrier)} RPM`);
    a('od-dial-left', 'transform', rotate('left', carrierFrame ? s.angles.leftRelative : s.angles.left));
    a('od-dial-carrier', 'transform', rotate('carrier', carrierFrame ? 0 : s.angles.carrier));
    a('od-dial-right', 'transform', rotate('right', carrierFrame ? s.angles.rightRelative : s.angles.right));
    t('od-dial-left-text', `trái ${carrierFrame ? fmt(relRpm(s.angularSpeeds.leftRelative), 2, true) : fmt(s.rpm.left)} RPM`);
    t('od-dial-carrier-text', `vỏ ${carrierFrame ? '0' : fmt(s.rpm.carrier)} RPM`);
    t('od-dial-right-text', `phải ${carrierFrame ? fmt(relRpm(s.angularSpeeds.rightRelative), 2, true) : fmt(s.rpm.right)} RPM`);
    t('od-spider-orbit-text', `spider đi quỹ đạo ${fmt(s.rpm.carrier)} RPM so với thân xe`);
    // Own-axis spin is the same quantity in both frames (it is measured against the carrier by definition).
    a('od-spider-own', 'transform', `rotate(${deg(s.angles.spiderOwn)} ${S.spiderDial.x} ${S.spiderDial.y})`);
    t('od-spider-own-text', `${fmt(s.rpm.spiderOwn, 2, true)} RPM so với vỏ`);

    // Speed ruler (body frame): one rigid lever from left to right; the carrier marker lands on its midpoint.
    const R = S.ruler;
    const x = (rpm) => R.x0 + (R.x1 - R.x0) * clamp01(rpm / R.maxRpm);
    const xl = x(s.rpm.left);
    const xr = x(s.rpm.right);
    const xc = x(s.rpm.carrier);
    const leftFirst = s.rpm.left <= s.rpm.right;
    a('od-mark-left', 'transform', `translate(${num(xl)} 0)`);
    a('od-mark-right', 'transform', `translate(${num(xr)} 0)`);
    a('od-mark-carrier', 'transform', `translate(${num(xc)} 0)`);
    a('od-beam', 'x1', num(Math.min(xl, xr)));
    a('od-beam', 'x2', num(Math.max(xl, xr)));
    a('od-mark-left-text', 'x', num(leftFirst ? xl - R.gap : xl + R.gap));
    a('od-mark-left-text', 'text-anchor', leftFirst ? 'end' : 'start');
    a('od-mark-right-text', 'x', num(leftFirst ? xr + R.gap : xr - R.gap));
    a('od-mark-right-text', 'text-anchor', leftFirst ? 'start' : 'end');
    a('od-mark-carrier-text', 'x', num(xc));
    t('od-equation', `${fmt(s.rpm.left)} + ${fmt(s.rpm.right)} = 2 × ${fmt(s.rpm.carrier)} RPM`);

    // Traction CEILINGS (limits), never actual shaft torque or power.
    const C = S.capacity;
    const width = (nm) => (C.x1 - C.x0) * clamp01(nm / C.maxNm);
    for (const side of ['left', 'right']) {
      a(`od-cap-${side}`, 'width', num(width(s.tractionCapacity[side])));
      t(`od-cap-${side}-text`, `${fmt(s.tractionCapacity[side], 1)} Nm`);
    }
    const xCommon = num(C.x0 + width(s.commonTorqueLimit));
    a('od-common', 'x1', xCommon);
    a('od-common', 'x2', xCommon);
    t('od-limit-text', `trần chung mỗi bên ${fmt(s.commonTorqueLimit, 1)} Nm · cả cầu ${fmt(s.axleTorqueLimit, 1)} Nm`);

    const svg = [
      ['data-od-scenario', s.scenario], ['data-od-phase', s.phase], ['data-od-busy', String(s.busy === true)],
      ['data-od-frame', carrierFrame ? 'carrier' : 'world'], ['data-od-held', held || 'none'],
    ];
    return { svg, attrs, texts, captions };
  }

  const nodes = new Map();
  function part(id) {
    let node = nodes.get(id);
    if (!node) {
      node = svg.querySelector(`[data-machine-id="${id}"]`);
      if (!node) throw new Error(`open-differential renderer: missing ${id}`);
      nodes.set(id, node);
    }
    return node;
  }

  // Renderer-owned caption paragraphs inside this figure's own figcaption: the full boundary sentence and the
  // µ = 0 note stay visible next to the drawing as wrapping native text. Removed again on dispose.
  const doc = root.ownerDocument;
  const paragraphs = new Map();
  for (const kind of ['boundary', 'zero-grip']) {
    const p = doc.createElement('p');
    p.setAttribute('class', 'od-caption');
    p.setAttribute('data-od-caption', kind);
    p.hidden = true;
    paragraphs.set(kind, p);
  }
  caption.prepend(...paragraphs.values());

  // Physical inputs of THIS instance only. The presentation frame, presets, reset and transport stay usable.
  const physical = Object.keys(data.defaults).filter((key) => key !== FRAME);
  const owner = (node) => (node && node.closest ? node.closest('.htw-machine') : null);
  const scope = owner(root);
  const inputs = Array.from(root.querySelectorAll('[data-playground-key]'))
    .filter((node) => physical.includes(node.getAttribute('data-playground-key')) && owner(node) === scope);
  const locked = new Set();
  function lock(busy) {
    if (busy) {
      for (const node of inputs) if (!node.disabled) { node.disabled = true; locked.add(node); }
    } else {
      for (const node of locked) node.disabled = false;
      locked.clear();
    }
  }

  const savedAttrs = new Map();
  const savedText = new Map();
  let disposed = false;
  function set(node, name, value) {
    const text = String(value);
    let authored = savedAttrs.get(node);
    if (!authored) { authored = new Map(); savedAttrs.set(node, authored); }
    if (!authored.has(name)) authored.set(name, node.getAttribute(name));
    if (node.getAttribute(name) !== text) node.setAttribute(name, text);
  }
  function write(node, text) {
    if (!savedText.has(node)) savedText.set(node, node.textContent);
    if (node.textContent !== text) node.textContent = text;
  }

  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const SIX = ['carrier', 'left', 'right', 'spiderOwn', 'leftRelative', 'rightRelative'];
  function check(s) {
    const fail = (why) => { throw new Error(`open-differential renderer: ${why}`); };
    if (!s || typeof s !== 'object') fail('missing snapshot');
    if (!['straight', 'corner', 'stuck'].includes(s.scenario)) fail(`unknown scenario ${s.scenario}`);
    if (!['idle', 'running', 'paused', 'done'].includes(s.phase)) fail(`unknown phase ${s.phase}`);
    if (!s.controls || !['world', 'carrier'].includes(s.controls[FRAME])) fail('invalid reference frame');
    for (const group of ['angles', 'angularSpeeds']) for (const key of SIX) if (!s[group] || !finite(s[group][key])) fail(`nonfinite ${group}.${key}`);
    for (const key of ['carrier', 'left', 'right', 'spiderOwn']) if (!s.rpm || !finite(s.rpm[key])) fail(`nonfinite rpm.${key}`);
    for (const side of ['left', 'right']) {
      if (!s.tractionCapacity || !finite(s.tractionCapacity[side]) || s.tractionCapacity[side] < 0) fail(`invalid tractionCapacity.${side}`);
      if (!s.effectiveGrip || !finite(s.effectiveGrip[side])) fail(`nonfinite effectiveGrip.${side}`);
    }
    if (!finite(s.commonTorqueLimit) || !finite(s.axleTorqueLimit)) fail('nonfinite torque limit');
    const b = s.boundary;
    if (!b || typeof b.label !== 'string' || !b.label.trim() || typeof b.zeroGripNote !== 'string') fail('missing boundary text');
    if ((s.scenario === 'stuck') !== (b.heldSide === 'left' || b.heldSide === 'right') || (s.scenario !== 'stuck' && b.heldSide !== null)) fail('invalid boundary.heldSide');
    if (s.scenario === 'corner' && !(s.path && ['centerRadiusM', 'leftRadiusM', 'rightRadiusM'].every((key) => finite(s.path[key])))) fail('nonfinite corner path');
  }

  return {
    render(snapshot, view = {}) {
      if (disposed) return;
      check(snapshot);
      const vm = viewModel(snapshot, S, P.highGripMu); // may throw: still before any write
      const attrWrites = vm.attrs.map(([id, name, value]) => [part(id), name, value]);
      const textWrites = vm.texts.map(([id, value]) => [part(id), value]);
      for (const [name, value] of vm.svg) set(svg, name, value);
      set(svg, 'data-od-focus', focusKeys.includes(view.focus) ? view.focus : 'all');
      set(svg, 'data-od-reduced-motion', view.reducedMotion ? 'true' : 'false');
      for (const [node, name, value] of attrWrites) set(node, name, value);
      for (const [node, value] of textWrites) write(node, value);
      for (const [kind, text] of vm.captions) {
        const p = paragraphs.get(kind);
        if (p.textContent !== text) p.textContent = text;
        if (p.hidden !== !text) p.hidden = !text;
        if (p.getAttribute('data-od-scenario') !== snapshot.scenario) p.setAttribute('data-od-scenario', snapshot.scenario);
      }
      lock(snapshot.busy === true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // A failed runtime has already disabled its controls; never re-enable them from here.
      if (root.getAttribute('data-machine-runtime') !== 'failed') lock(false);
      locked.clear();
      for (const p of paragraphs.values()) p.remove();
      paragraphs.clear();
      for (const [node, text] of savedText) if (node.textContent !== text) node.textContent = text;
      for (const [node, attrs] of savedAttrs) {
        for (const [name, value] of attrs) {
          if (value === null) node.removeAttribute(name);
          else node.setAttribute(name, value);
        }
      }
      savedText.clear();
      savedAttrs.clear();
      nodes.clear();
    },
  };
});
runtime.boot({
  slug: "open-differential",
  descriptor: {"title":"Bộ vi sai giúp hai bánh xe quay khác tốc độ thế nào?","controls":{"groups":[{"key":"experiment","label":"Thí nghiệm (vỏ vi sai được áp tốc độ)","controls":[{"type":"segmented","key":"scenario","label":"Tình huống","options":[{"value":"straight","label":"Đi thẳng"},{"value":"corner","label":"Vào cua"},{"value":"stuck","label":"Bàn thử: một trục bị giữ"}]},{"type":"range","key":"carrier-rpm","label":"Tốc độ vỏ vi sai áp đặt (cả ba tình huống)","min":6,"max":30,"step":6,"unit":"RPM"}]},{"key":"corner","label":"Vào cua (chỉ tác động khi chọn Vào cua)","controls":[{"type":"segmented","key":"turn-side","label":"Hướng cua (chỉ tác động khi chọn Vào cua)","options":[{"value":"left","label":"Cua trái"},{"value":"right","label":"Cua phải"}]},{"type":"range","key":"turn-radius","label":"Bán kính tới trung điểm cầu sau (chỉ tác động khi chọn Vào cua)","min":2,"max":10,"step":1,"unit":"m"}]},{"key":"grip","label":"Độ bám (chỉ tác động ở bàn thử một trục bị giữ)","controls":[{"type":"segmented","key":"low-grip-side","label":"Bánh ít bám (chỉ tác động ở bàn thử; bánh còn lại bị giữ đứng yên)","options":[{"value":"left","label":"Bánh trái"},{"value":"right","label":"Bánh phải"}]},{"type":"range","key":"low-grip-mu","label":"Hệ số bám của bánh ít bám (chỉ tác động ở bàn thử; chỉ đổi trần mô-men, không đổi tốc độ)","min":0,"max":0.2,"step":0.02,"unit":"µ"}]},{"key":"view","label":"Cách trình bày (không đổi vật lý)","controls":[{"type":"segmented","key":"reference-frame","label":"Hệ quy chiếu hiển thị (chỉ là cách nhìn, đổi được cả khi đang chạy)","options":[{"value":"world","label":"Nhìn từ thân xe"},{"value":"carrier","label":"Đứng trên vỏ vi sai"}]}]}],"presets":[{"key":"straight","label":"Đi thẳng 12 RPM"},{"key":"left-corner","label":"Cua trái, bán kính 3 m"},{"key":"right-corner","label":"Cua phải, bán kính 3 m"},{"key":"low-grip-left","label":"Bàn thử: bánh trái ít bám, trục phải bị giữ"},{"key":"low-grip-right","label":"Bàn thử: bánh phải ít bám, trục trái bị giữ"}],"challenges":[{"key":"straight","label":"Hoàn tất trọn 8 s đi thẳng: hai trục bằng tốc độ vỏ, bánh răng hành tinh không tự quay."},{"key":"corner","label":"Hoàn tất trọn 8 s vào cua: bánh vòng ngoài nhanh hơn, tổng hai tốc độ vẫn bằng hai lần tốc độ vỏ."},{"key":"stuck","label":"Hoàn tất trọn 8 s ở bàn thử có một trục bị giữ đứng yên."},{"key":"both-grip-sides","label":"Hoàn tất bàn thử với bánh ít bám ở bên trái và ở bên phải (hai lượt riêng)."}]}},
  data: {"schemaVersion":1,"stepUnavailableByPhase":{"idle":"Chưa bắt đầu thí nghiệm. Nhấn Chạy rồi Dừng để tiến từng bước.","done":"Đã kết thúc thí nghiệm. Nhấn Chạy để bắt đầu lượt mới."},"parameters":{"wheelRadiusM":0.3,"trackWidthM":1.5,"normalLoadN":3000,"highGripMu":0.8,"sideTeeth":24,"spiderTeeth":12,"durationSeconds":8,"stepSeconds":0.1},"defaults":{"scenario":"corner","carrier-rpm":12,"turn-side":"left","turn-radius":3,"low-grip-side":"left","low-grip-mu":0.06,"reference-frame":"world"},"controls":{"groups":[{"key":"experiment","label":"Thí nghiệm (vỏ vi sai được áp tốc độ)","controls":[{"type":"segmented","key":"scenario","label":"Tình huống","options":[{"value":"straight","label":"Đi thẳng"},{"value":"corner","label":"Vào cua"},{"value":"stuck","label":"Bàn thử: một trục bị giữ"}]},{"type":"range","key":"carrier-rpm","label":"Tốc độ vỏ vi sai áp đặt (cả ba tình huống)","min":6,"max":30,"step":6,"unit":"RPM"}]},{"key":"corner","label":"Vào cua (chỉ tác động khi chọn Vào cua)","controls":[{"type":"segmented","key":"turn-side","label":"Hướng cua (chỉ tác động khi chọn Vào cua)","options":[{"value":"left","label":"Cua trái"},{"value":"right","label":"Cua phải"}]},{"type":"range","key":"turn-radius","label":"Bán kính tới trung điểm cầu sau (chỉ tác động khi chọn Vào cua)","min":2,"max":10,"step":1,"unit":"m"}]},{"key":"grip","label":"Độ bám (chỉ tác động ở bàn thử một trục bị giữ)","controls":[{"type":"segmented","key":"low-grip-side","label":"Bánh ít bám (chỉ tác động ở bàn thử; bánh còn lại bị giữ đứng yên)","options":[{"value":"left","label":"Bánh trái"},{"value":"right","label":"Bánh phải"}]},{"type":"range","key":"low-grip-mu","label":"Hệ số bám của bánh ít bám (chỉ tác động ở bàn thử; chỉ đổi trần mô-men, không đổi tốc độ)","min":0,"max":0.2,"step":0.02,"unit":"µ"}]},{"key":"view","label":"Cách trình bày (không đổi vật lý)","controls":[{"type":"segmented","key":"reference-frame","label":"Hệ quy chiếu hiển thị (chỉ là cách nhìn, đổi được cả khi đang chạy)","options":[{"value":"world","label":"Nhìn từ thân xe"},{"value":"carrier","label":"Đứng trên vỏ vi sai"}]}]}],"presets":[{"key":"straight","label":"Đi thẳng 12 RPM","values":{"scenario":"straight","carrier-rpm":12,"turn-side":"left","turn-radius":3,"low-grip-side":"left","low-grip-mu":0.06}},{"key":"left-corner","label":"Cua trái, bán kính 3 m","values":{"scenario":"corner","carrier-rpm":12,"turn-side":"left","turn-radius":3,"low-grip-side":"left","low-grip-mu":0.06}},{"key":"right-corner","label":"Cua phải, bán kính 3 m","values":{"scenario":"corner","carrier-rpm":12,"turn-side":"right","turn-radius":3,"low-grip-side":"left","low-grip-mu":0.06}},{"key":"low-grip-left","label":"Bàn thử: bánh trái ít bám, trục phải bị giữ","values":{"scenario":"stuck","carrier-rpm":12,"turn-side":"left","turn-radius":3,"low-grip-side":"left","low-grip-mu":0.06}},{"key":"low-grip-right","label":"Bàn thử: bánh phải ít bám, trục trái bị giữ","values":{"scenario":"stuck","carrier-rpm":12,"turn-side":"left","turn-radius":3,"low-grip-side":"right","low-grip-mu":0.06}}],"challenges":[{"key":"straight","label":"Hoàn tất trọn 8 s đi thẳng: hai trục bằng tốc độ vỏ, bánh răng hành tinh không tự quay."},{"key":"corner","label":"Hoàn tất trọn 8 s vào cua: bánh vòng ngoài nhanh hơn, tổng hai tốc độ vẫn bằng hai lần tốc độ vỏ."},{"key":"stuck","label":"Hoàn tất trọn 8 s ở bàn thử có một trục bị giữ đứng yên."},{"key":"both-grip-sides","label":"Hoàn tất bàn thử với bánh ít bám ở bên trái và ở bên phải (hai lượt riêng)."}]},"text":{"boundary":{"straight":"Vỏ vi sai được áp tốc độ; hai bánh lăn không trượt trên đường thẳng. Đây là động học, không phải mô hình lốp hay động cơ.","corner":"Vỏ vi sai được áp tốc độ; hai bánh cầu sau lăn không trượt trên hai cung tròn đồng tâm. Không mô phỏng hệ lái, bánh trước hay lực bên của lốp.","stuck":"Trục bên bám bị giữ đứng yên bởi điều kiện thí nghiệm bên ngoài. Vi sai không khóa bánh này; theo giả thiết lý tưởng mô-men hai phía bằng nhau, trần bị giới hạn bởi bánh ít bám."},"zeroGripNote":"Tốc độ là động học được áp đặt; không khối lượng, bỏ qua khởi động. Trần mô-men 0 Nm, không suy ra công suất hay năng lượng."},"scene":{"width":440,"height":660,"fontSize":15,"charEm":0.6,"margin":10,"description":"Sơ đồ nguyên lý tách lớp của bộ vi sai mở đối xứng, không theo tỷ lệ và không phải bản vẽ răng thật. Phía trên: cầu sau nhìn từ sau xe với bánh trái, bán trục và bánh răng bán trục 24 răng, vỏ vi sai và một bánh răng hành tinh (spider) 12 răng đại diện ở phía trên; spider đối diện được lược bỏ. Trục riêng dương của spider hướng từ spider vào tâm vỏ. Giữa: ba mặt số cùng nhìn từ bên phải xe, chiều kim đồng hồ là chiều lăn tiến, cho bánh trái, vỏ vi sai mang spider đi quỹ đạo quanh trục cầu, và bánh phải; một mặt số riêng cho spider tự quay quanh chốt, nhìn dọc trục riêng từ ngoài vào tâm. Dưới: thước tốc độ so với thân xe, vỏ luôn nằm giữa hai bánh; thanh trần bám là giới hạn, không phải mô-men thực, và không dự đoán xe tự do sẽ chạy hay đứng.","band":{"x0":10,"x1":430,"ruleY":176,"firstBaseline":196,"linePitch":20,"lines":2},"dialHeadingY":240,"dialNoteY":260,"dials":{"left":{"x":66,"y":316,"r":36},"carrier":{"x":220,"y":316,"r":36},"right":{"x":374,"y":316,"r":36}},"dialTextY":374,"orbitTextY":394,"spiderOrbitRadius":30,"spiderDial":{"x":220,"y":440,"r":20},"spiderTextY":[434,454],"ruler":{"x0":56,"x1":384,"y":540,"maxRpm":60,"headingY":484,"equationY":504,"labelY":528,"carrierLabelY":566,"gap":6},"capacity":{"x0":56,"x1":330,"headingY":588,"leftY":598,"rightY":618,"height":12,"maxNm":720,"valueX":338,"commonTop":592,"commonBottom":634,"limitY":652}}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
