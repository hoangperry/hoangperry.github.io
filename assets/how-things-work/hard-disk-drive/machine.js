/* How Things Work · hard-disk-drive · generated playground bundle (classic script). Do not edit. */
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
  const config = JSON.parse(JSON.stringify(data));
  const { constants: C, geometry: G, timing: T, defaults, controls: descriptors } = config;
  const tau = 2 * Math.PI;
  const sectorAngleRadians = tau / C.sectorsPerTrack;
  const keys = Object.keys(defaults);
  const presets = Object.fromEntries(descriptors.presets.map((item) => [item.key, item.values]));
  const challengeKeys = descriptors.challenges.map((item) => item.key);
  const clean = (value) => value === 0 ? 0 : value;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  let controls, request, elapsedMs, correction, running, readCount, observedRpms, done, announcement, cached;

  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
    return value;
  }

  function headPose(track) {
    const radius = G.outerRadius - track * (G.outerRadius - G.innerRadius) / (C.trackCount - 1);
    const dx = G.spindle.x - G.pivot.x;
    const dy = G.spindle.y - G.pivot.y;
    const distance = Math.hypot(dx, dy);
    const cosine = (distance ** 2 + G.armLength ** 2 - radius ** 2) / (2 * distance * G.armLength);
    const armAngleRadians = Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, cosine)));
    const x = G.pivot.x + G.armLength * Math.cos(armAngleRadians);
    const y = G.pivot.y + G.armLength * Math.sin(armAngleRadians);
    return { radius, x: clean(x), y: clean(y), armAngleRadians: clean(armAngleRadians),
      headAngleRadians: clean(Math.atan2(y - G.spindle.y, x - G.spindle.x)) };
  }

  function wrap(angle) {
    const result = ((angle % tau) + tau) % tau;
    return result < C.wrapEpsilonRadians || result > tau - C.wrapEpsilonRadians ? 0 : result;
  }

  const busy = () => request !== null && elapsedMs < request.totalMs;

  function load(values, clearHistory = false) {
    controls = { ...values };
    request = null;
    elapsedMs = 0;
    correction = 0;
    running = false;
    if (clearHistory) {
      readCount = 0;
      observedRpms = [];
      done = Object.fromEntries(challengeKeys.map((key) => [key, false]));
    }
    announcement = null;
    cached = null;
  }
  function reset() { load(defaults, true); }

  function start() {
    const startHeadTrack = controls['head-track'];
    const targetTrack = controls['target-track'];
    const targetSector = controls['target-sector'];
    const rpm = controls.rpm;
    const distance = Math.abs(targetTrack - startHeadTrack);
    const seekMoveMs = distance === 0 ? 0 : T.seekBaseMs + T.seekPerTrackMs * distance;
    const settleMs = distance === 0 ? 0 : T.settleMs;
    const seekMs = seekMoveMs + settleMs;
    const periodMs = 60000 / rpm;
    const omegaRadiansPerMs = tau / periodMs;
    const startAngleRadians = controls['start-angle'] * Math.PI / 180;
    const arrivalAngle = startAngleRadians + omegaRadiansPerMs * seekMs;
    // Clockwise SVG: sector j occupies theta-(j+1)*delta through theta-j*delta.
    const waitMs = wrap(headPose(targetTrack).headAngleRadians - arrivalAngle + targetSector * sectorAngleRadians) / omegaRadiansPerMs;
    const transferMs = periodMs / C.sectorsPerTrack;
    request = { startHeadTrack, targetTrack, targetSector, rpm, startAngleRadians,
      periodMs, omegaRadiansPerMs, seekMoveMs, settleMs, seekMs, waitMs, transferMs,
      totalMs: seekMs + waitMs + transferMs };
    elapsedMs = 0;
    correction = 0;
    running = true;
    announcement = null;
    cached = null;
  }

  function complete() {
    running = false;
    controls['head-track'] = request.targetTrack;
    readCount += 1;
    if (!observedRpms.includes(request.rpm)) observedRpms.push(request.rpm);
    const distance = Math.abs(request.targetTrack - request.startHeadTrack);
    if (distance === 0) done['same-track'] = true;
    if (distance >= 3) done['cross-track'] = true;
    if (request.waitMs >= 0.8 * request.periodMs) done['almost-full-turn'] = true;
    if (observedRpms.length >= 2) done['two-rpms'] = true;
    announcement = 'Đã đọc xong ô sector phóng đại. Hình dừng để xem kết quả; motor thật không vì thế ngừng quay.';
  }

  function move(milliseconds) {
    const remaining = request.totalMs - elapsedMs;
    if (milliseconds >= remaining) {
      elapsedMs = request.totalMs;
      correction = 0;
      complete();
    } else {
      const delta = milliseconds - correction;
      const next = elapsedMs + delta;
      correction = (next - elapsedMs) - delta;
      elapsedMs = Math.min(request.totalMs, next);
      if (elapsedMs === request.totalMs) complete();
      else announcement = null;
    }
    cached = null;
  }

  function advance(dtSeconds) {
    if (!running || !busy() || typeof dtSeconds !== 'number' || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    // Cap before multiplication so even a finite, very large input cannot overflow.
    const remaining = request.totalMs - elapsedMs;
    move(dtSeconds >= remaining / T.simulationMsPerSecond ? remaining : dtSeconds * T.simulationMsPerSecond);
  }

  function physicalValue(key, raw) {
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(value)) return null;
    if (key === 'rpm') return C.rpms.includes(value) ? value : null;
    if (key === 'start-angle') return value >= 0 && value <= 359 ? clean(value) : null;
    const max = key === 'target-sector' ? C.sectorsPerTrack - 1 : C.trackCount - 1;
    return Number.isInteger(value) && value >= 0 && value <= max ? clean(value) : null;
  }

  function command(input) {
    if (!input || typeof input !== 'object') return;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'preset') {
      if (typeof value === 'string' && has(presets, value)) load(presets[value]);
      return;
    }
    if (key === 'run') {
      if (!busy()) return start();
      if (running) return;
      running = true;
    } else if (key === 'request') {
      if (!busy()) start();
      return;
    } else if (key === 'pause') {
      if (!running) return;
      running = false;
    } else if (key === 'toggle-running') {
      if (!busy()) return;
      running = !running;
    } else if (key === 'step') {
      if (running || !busy()) return;
      move(Math.min(T.stepMs, request.totalMs - elapsedMs));
      return;
    } else if (keys.includes(key)) {
      if (busy()) return;
      const next = physicalValue(key, value);
      if (next === null) return;
      load({ ...controls, [key]: next });
      return;
    } else return;
    announcement = null;
    cached = null;
  }

  function phaseState() {
    if (!request) return { phase: 'idle', phaseElapsedMs: 0, phaseDurationMs: 0, phaseProgress: 0 };
    if (!busy()) return { phase: 'done', phaseElapsedMs: 0, phaseDurationMs: 0, phaseProgress: 1 };
    let startMs = 0;
    for (const [phase, duration] of [['seek', request.seekMoveMs], ['settle', request.settleMs], ['wait', request.waitMs], ['transfer', request.transferMs]]) {
      if (duration > 0 && elapsedMs < startMs + duration) {
        return { phase, phaseElapsedMs: clean(elapsedMs - startMs), phaseDurationMs: duration,
          phaseProgress: clean((elapsedMs - startMs) / duration) };
      }
      startMs += duration;
    }
    return { phase: 'done', phaseElapsedMs: 0, phaseDurationMs: 0, phaseProgress: 1 };
  }

  function snapshot() {
    if (cached) return cached;
    const state = phaseState();
    let headTrack = controls['head-track'];
    if (request) {
      const u = request.seekMoveMs === 0 ? 1 : Math.min(1, elapsedMs / request.seekMoveMs);
      const q = u ** 3 * (10 + u * (-15 + 6 * u));
      headTrack = u === 1 ? request.targetTrack : request.startHeadTrack + (request.targetTrack - request.startHeadTrack) * q;
    }
    const periodMs = request ? request.periodMs : 60000 / controls.rpm;
    const angleRadians = request ? request.startAngleRadians + request.omegaRadiansPerMs * elapsedMs : controls['start-angle'] * Math.PI / 180;
    const phaseLabels = { idle: 'Sẵn sàng cho một thí nghiệm độc lập.', seek: 'Đầu đọc đang tìm track; platter vẫn quay.', settle: 'Đang chờ ổn định tại track đích.', wait: 'Đúng track; đang chờ biên vào của sector.', transfer: 'Đang đọc ô sector phóng đại.', done: 'Đã đọc xong; hình dừng để xem kết quả.' };
    const number = (value) => value.toFixed(3).replace('.', ',');
    const readout = [
      { key: 'seek', label: 'Tìm track + ổn định', text: `${number(request ? request.seekMs : 0)} ms` },
      { key: 'wait', label: 'Chờ sector', text: `${number(request ? request.waitMs : 0)} ms` },
      { key: 'transfer', label: 'Đọc ô phóng đại', text: `${number(request ? request.transferMs : 0)} ms` },
      { key: 'total', label: 'Tổng yêu cầu', text: `${number(request ? request.totalMs : 0)} ms` },
      { key: 'period', label: 'Chu kỳ quay', text: `${number(periodMs)} ms/vòng` },
      { key: 'elapsed', label: 'Đã chạy trong mô hình', text: `${number(elapsedMs)} ms` },
    ];
    cached = freeze({
      time: clean(elapsedMs / 1000), timeMs: clean(elapsedMs), running, busy: busy(), ...state,
      controls: { ...controls }, status: phaseLabels[state.phase], readout, announcement,
      challenges: challengeKeys.map((key) => ({ key, done: done[key] })),
      headTrack: clean(headTrack), headPose: headPose(headTrack), targetPose: headPose(controls['target-track']),
      targetTrack: controls['target-track'], targetSector: controls['target-sector'], rpm: controls.rpm,
      angleRadians: clean(angleRadians), periodMs, sectorAngleRadians,
      transferProgress: state.phase === 'done' ? 1 : state.phase === 'transfer' ? state.phaseProgress : 0,
      request: request ? { ...request, elapsedMs, progress: elapsedMs / request.totalMs, completed: !busy() } : null,
      readCount, observedRpms: [...observedRpms],
    });
    return cached;
  }
  reset();
  return Object.freeze({ snapshot, advance, command, reset });
});
var mountRenderer = (function mountRenderer(root, data) {
  'use strict';
  const S = data.scene;
  const G = data.geometry;
  const K = data.constants;
  if (!S || !G || !K) throw new Error('hdd renderer: missing scene, geometry or constants data');
  const svg = root.querySelector('[data-machine-id="hdd-svg"]');
  if (!svg) throw new Error('hdd renderer: missing hdd-svg');
  const phases = ['seek', 'settle', 'wait', 'transfer', 'done'];
  const known = ['idle', ...phases];
  const focusKeys = ['all', 'platter', 'head', 'seek', 'wait', 'read', 'servo', 'limits'];
  function part(id) {
    const node = svg.querySelector(`[data-machine-id="${id}"]`);
    if (!node) throw new Error(`hdd renderer: missing ${id}`);
    return node;
  }
  const el = {
    platter: part('hdd-platter'),
    cell: part('hdd-target-cell'),
    read: part('hdd-read-cell'),
    edge: part('hdd-entry-edge'),
    arm: part('hdd-arm'),
    target: part('hdd-target-marker'),
    cursor: part('hdd-time-cursor'),
    labels: [],
    phases: phases.map((key) => part(`hdd-phase-${key}`)),
    segments: ['seek', 'settle', 'wait', 'transfer'].map((key) => part(`hdd-time-${key}`)),
  };
  for (let k = 0; k < K.sectorsPerTrack; k++) el.labels.push(part(`hdd-sector-${k}`));

  // Physical request inputs of THIS instance only (never presets, reset or transport). The runtime keeps its own
  // enable/disable bookkeeping; this renderer only re-disables controls the runtime had enabled, and remembers which.
  const physical = Object.keys(data.defaults);
  const owner = (node) => (node && node.closest ? node.closest('.htw-machine') : null);
  const scope = owner(root);
  const inputs = Array.from(root.querySelectorAll('[data-playground-key]'))
    .filter((node) => physical.includes(node.getAttribute('data-playground-key')) && owner(node) === scope);
  const locked = new Set();

  const saved = new Map();
  const cache = new Map();
  let disposed = false;
  function set(node, name, value) {
    const valueText = String(value);
    let values = cache.get(node);
    if (!values) { values = new Map(); cache.set(node, values); }
    if (values.get(name) === valueText) return;
    if (!values.has(name)) {
      let authored = saved.get(node);
      if (!authored) { authored = new Map(); saved.set(node, authored); }
      authored.set(name, node.getAttribute(name));
    }
    values.set(name, valueText);
    if (node.getAttribute(name) !== valueText) node.setAttribute(name, valueText);
  }
  function lock(busy) {
    if (busy) {
      for (const node of inputs) if (!node.disabled) { node.disabled = true; locked.add(node); }
    } else {
      for (const node of locked) node.disabled = false;
      locked.clear();
    }
  }

  const num = (n) => String(Number(n.toFixed(3)));
  const deg = (radians) => num((((radians * 180 / Math.PI) % 360) + 360) % 360);
  const at = (C, r, a) => `${num(C.x + r * Math.cos(a))} ${num(C.y + r * Math.sin(a))}`;
  function cellPath(C, r0, r1, a0, a1) {
    if (!(a1 > a0)) return '';
    return `M${at(C, r1, a0)}A${num(r1)} ${num(r1)} 0 0 1 ${at(C, r1, a1)}L${at(C, r0, a1)}A${num(r0)} ${num(r0)} 0 0 0 ${at(C, r0, a0)}Z`;
  }
  // Same expression as sectorLabelRadius in the scene: annotation-only radial slide that keeps labels off the pivot.
  function sectorLabelRadius(C, P, a) {
    const dx = P.x - C.x;
    const dy = P.y - C.y;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    const disc = along * along - (dx * dx + dy * dy) + S.pivotClearance * S.pivotClearance;
    return disc > 0 ? Math.max(S.labelRadius, along + Math.sqrt(disc)) : S.labelRadius;
  }
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  function check(snapshot) {
    const fields = [['angleRadians', snapshot.angleRadians], ['sectorAngleRadians', snapshot.sectorAngleRadians], ['transferProgress', snapshot.transferProgress]];
    for (const name of ['headPose', 'targetPose']) {
      const pose = snapshot[name];
      if (!pose || typeof pose !== 'object') throw new Error(`hdd renderer: missing ${name}`);
      for (const key of ['radius', 'x', 'y', 'armAngleRadians']) fields.push([`${name}.${key}`, pose[key]]);
    }
    for (const [name, value] of fields) if (!finite(value)) throw new Error(`hdd renderer: nonfinite ${name}`);
    if (snapshot.transferProgress < 0 || snapshot.transferProgress > 1) throw new Error('hdd renderer: transferProgress outside 0…1');
    if (!known.includes(snapshot.phase)) throw new Error(`hdd renderer: unknown phase ${snapshot.phase}`);
    if (!Number.isInteger(snapshot.targetSector) || snapshot.targetSector < 0 || snapshot.targetSector >= K.sectorsPerTrack) throw new Error('hdd renderer: invalid targetSector');
    const request = snapshot.request;
    if (request && !(finite(request.totalMs) && request.totalMs > 0 && finite(request.progress))) throw new Error('hdd renderer: invalid request timing');
  }

  return {
    render(snapshot, view = {}) {
      if (disposed) return;
      check(snapshot); // fail closed before any write
      const C = G.spindle;
      const P = G.pivot;
      const delta = snapshot.sectorAngleRadians;
      const half = (G.outerRadius - G.innerRadius) / (K.trackCount - 1) / 2;
      const r = snapshot.targetPose.radius;
      const j = snapshot.targetSector;
      const theta = snapshot.angleRadians;
      // Sector j spans theta-(j+1)delta…theta-j*delta; its entering (leading) edge is theta-j*delta.
      const lead = -j * delta;
      set(svg, 'data-hdd-phase', snapshot.phase);
      set(svg, 'data-hdd-focus', focusKeys.includes(view.focus) ? view.focus : 'all');
      set(svg, 'data-hdd-reduced-motion', view.reducedMotion ? 'true' : 'false');
      set(svg, 'data-hdd-busy', snapshot.busy ? 'true' : 'false');
      set(el.platter, 'transform', `rotate(${deg(theta)} ${C.x} ${C.y})`);
      for (let k = 0; k < el.labels.length; k++) {
        const a = theta - (k + 0.5) * delta;
        const radius = sectorLabelRadius(C, P, a);
        set(el.labels[k], 'x', num(C.x + radius * Math.cos(a)));
        set(el.labels[k], 'y', num(C.y + radius * Math.sin(a) + S.labelBaseline));
        set(el.labels[k], 'data-target', String(k === j));
      }
      // One track × one sector band, never the whole wedge; the read part grows only from the model's progress.
      set(el.cell, 'd', cellPath(C, r - half, r + half, lead - delta, lead));
      set(el.edge, 'd', `M${at(C, r - half - S.edgeOverhang, lead)}L${at(C, r + half + S.edgeOverhang, lead)}`);
      set(el.read, 'd', cellPath(C, r - half, r + half, lead - snapshot.transferProgress * delta, lead));
      // Rigid arm + coil group about the fixed pivot; the tip lands on headPose by the model's arm angle.
      set(el.arm, 'transform', `translate(${P.x} ${P.y}) rotate(${num(snapshot.headPose.armAngleRadians * 180 / Math.PI)})`);
      set(el.target, 'cx', num(snapshot.targetPose.x));
      set(el.target, 'cy', num(snapshot.targetPose.y));
      phases.forEach((key, index) => set(el.phases[index], 'data-active', String(snapshot.phase === key)));
      const T = S.timeline;
      const request = snapshot.request;
      const durations = request ? [request.seekMoveMs, request.settleMs, request.waitMs, request.transferMs] : [0, 0, 0, 0];
      let x = T.x;
      el.segments.forEach((node, index) => {
        const width = request ? T.width * durations[index] / request.totalMs : 0;
        set(node, 'x', num(x));
        set(node, 'width', num(width));
        x += width;
      });
      set(el.cursor, 'x', num(T.x + T.width * (request ? request.progress : 0) - 1));
      set(el.cursor, 'data-hidden', String(!request));
      lock(snapshot.busy === true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // A failed runtime has already disabled its controls; never re-enable them from here.
      if (root.getAttribute('data-machine-runtime') !== 'failed') lock(false);
      locked.clear();
      for (const [node, attrs] of saved) {
        for (const [name, value] of attrs) {
          if (value === null) node.removeAttribute(name);
          else node.setAttribute(name, value);
        }
      }
      saved.clear();
      cache.clear();
    },
  };
});
runtime.boot({
  slug: "hard-disk-drive",
  descriptor: {"title":"Ổ cứng HDD tìm và đọc một sector bằng cách nào?","controls":{"groups":[{"key":"request","label":"Yêu cầu đọc độc lập","controls":[{"type":"range","key":"head-track","label":"Track đầu đọc trước yêu cầu (0 ở ngoài)","min":0,"max":7,"step":1,"unit":"track"},{"type":"range","key":"target-track","label":"Track cần đọc","min":0,"max":7,"step":1,"unit":"track"},{"type":"range","key":"target-sector","label":"Ô sector cần đọc","min":0,"max":11,"step":1,"unit":"ô"}]},{"key":"spindle","label":"Platter và pha đầu","controls":[{"type":"segmented","key":"rpm","label":"Tốc độ quay","options":[{"value":5400,"label":"5400 RPM"},{"value":7200,"label":"7200 RPM"},{"value":10000,"label":"10000 RPM"}]},{"type":"range","key":"start-angle","label":"Góc đầu mỗi thí nghiệm","min":0,"max":359,"step":1,"unit":"°"}]}],"presets":[{"key":"same-track","label":"Cùng track: chỉ chờ và đọc"},{"key":"far-seek","label":"Tìm từ track ngoài vào trong"},{"key":"just-missed","label":"Vừa lỡ biên vào: chờ gần một vòng"},{"key":"fast-spindle","label":"Đổi chu kỳ quay: 10000 RPM"}],"challenges":[{"key":"same-track","label":"Hoàn tất một lần đọc cùng track."},{"key":"cross-track","label":"Hoàn tất một lần đọc cách ít nhất 3 track."},{"key":"almost-full-turn","label":"Hoàn tất lần đọc có thời gian chờ ít nhất 0,8 vòng."},{"key":"two-rpms","label":"Hoàn tất yêu cầu ở hai RPM khác nhau; so chu kỳ quay, không suy tổng I/O luôn nhanh hơn."}]}},
  data: {"version":1,"stepUnavailableByPhase":{"idle":"Chưa có yêu cầu đọc. Nhấn Chạy rồi Dừng để tiến từng bước.","done":"Đã đọc xong. Nhấn Chạy để mở yêu cầu đọc mới."},"constants":{"trackCount":8,"sectorsPerTrack":12,"rpms":[5400,7200,10000],"wrapEpsilonRadians":1e-9},"geometry":{"spindle":{"x":158,"y":168},"pivot":{"x":272,"y":212},"armLength":138,"outerRadius":110,"innerRadius":48},"timing":{"seekBaseMs":0.8,"seekPerTrackMs":0.65,"settleMs":0.5,"simulationMsPerSecond":10,"stepMs":0.25},"defaults":{"head-track":0,"target-track":5,"target-sector":3,"rpm":7200,"start-angle":0},"controls":{"groups":[{"key":"request","label":"Yêu cầu đọc độc lập","controls":[{"type":"range","key":"head-track","label":"Track đầu đọc trước yêu cầu (0 ở ngoài)","min":0,"max":7,"step":1,"unit":"track"},{"type":"range","key":"target-track","label":"Track cần đọc","min":0,"max":7,"step":1,"unit":"track"},{"type":"range","key":"target-sector","label":"Ô sector cần đọc","min":0,"max":11,"step":1,"unit":"ô"}]},{"key":"spindle","label":"Platter và pha đầu","controls":[{"type":"segmented","key":"rpm","label":"Tốc độ quay","options":[{"value":5400,"label":"5400 RPM"},{"value":7200,"label":"7200 RPM"},{"value":10000,"label":"10000 RPM"}]},{"type":"range","key":"start-angle","label":"Góc đầu mỗi thí nghiệm","min":0,"max":359,"step":1,"unit":"°"}]}],"presets":[{"key":"same-track","label":"Cùng track: chỉ chờ và đọc","values":{"head-track":3,"target-track":3,"target-sector":7,"rpm":7200,"start-angle":0}},{"key":"far-seek","label":"Tìm từ track ngoài vào trong","values":{"head-track":0,"target-track":7,"target-sector":3,"rpm":7200,"start-angle":0}},{"key":"just-missed","label":"Vừa lỡ biên vào: chờ gần một vòng","values":{"head-track":3,"target-track":3,"target-sector":7,"rpm":7200,"start-angle":150}},{"key":"fast-spindle","label":"Đổi chu kỳ quay: 10000 RPM","values":{"head-track":0,"target-track":5,"target-sector":3,"rpm":10000,"start-angle":0}}],"challenges":[{"key":"same-track","label":"Hoàn tất một lần đọc cùng track."},{"key":"cross-track","label":"Hoàn tất một lần đọc cách ít nhất 3 track."},{"key":"almost-full-turn","label":"Hoàn tất lần đọc có thời gian chờ ít nhất 0,8 vòng."},{"key":"two-rpms","label":"Hoàn tất yêu cầu ở hai RPM khác nhau; so chu kỳ quay, không suy tổng I/O luôn nhanh hơn."}]},"scene":{"width":420,"height":356,"platterRadius":116,"hubRadius":26,"arrowRadius":35,"labelRadius":128,"labelBaseline":5.5,"pivotClearance":20,"edgeOverhang":3,"timeline":{"x":306,"y":150,"width":104,"height":8}}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
