/* How Things Work · iso-raw · generated playground bundle (classic script). Do not edit. */
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
    const fixed = Math.abs(value).toFixed(decimals);
    const sign = value < 0 && Number(fixed) !== 0 ? '−' : '';
    let number = fixed.replace('.', ',');
    if (Math.abs(value) < 1e21) { // toFixed uses scientific notation beyond this point.
      const comma = number.indexOf(',');
      for (let i = (comma < 0 ? number.length : comma) - 3; i > 0; i -= 3) {
        number = number.slice(0, i) + '.' + number.slice(i);
      }
    }
    return sign + number;
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
  const { fullWell, adcBits } = data.parameters;
  const adcMax = 2 ** adcBits - 1;
  const [exposureRange, gainChoice] = data.controls.groups[0].controls;
  const gains = new Set(gainChoice.options.map(({ value }) => value));
  const presets = new Map(Object.entries(data.presets).map(([key, controls]) => [key, Object.freeze({ ...controls })]));
  const defaultControls = presets.get('same-charge');
  const challenges = Object.freeze([]);
  const stages = [
    { key: 'charge', at: 0, label: 'Tích điện trong giếng' },
    { key: 'analog', at: 1, label: 'Khuếch đại analog' },
    { key: 'adc', at: 2, label: 'Số hóa ADC' },
  ];
  const lastStage = stages.length - 1;
  const phaseLabels = {
    idle: 'Đang xem mẫu tĩnh.', running: 'Đang soi thứ tự đọc mẫu.',
    paused: 'Đã dừng.', done: 'Đã soi hết chuỗi đọc mẫu.',
  };
  const integer = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const percent = (ratio) => `${String(Math.round(ratio * 1000) / 10).replace('.', ',')}%`;
  const row = (key, label, text) => Object.freeze({ key, label, text });

  let controls = defaultControls;
  let sample, labels, readout, cached;
  let time = 0, compensation = 0, phase = 'idle', stageIndex = 0, announcement = null;

  function project() {
    const { exposure, gain } = controls;
    const electrons = Math.min(exposure, fullWell);
    const sensorSignal = electrons / fullWell;
    // Compare and quantize using the integer numerator of g·s to keep ties exact.
    const amplified = gain * electrons;
    const adcInput = amplified / fullWell;
    const wellFull = electrons === fullWell;
    const adcOverrange = amplified > fullWell;
    const atFullScale = amplified === fullWell;
    const code = Math.round(adcMax * Math.min(amplified, fullWell) / fullWell);
    sample = Object.freeze({
      electrons, sensorSignal, adcInput, code, bits: code.toString(2).padStart(adcBits, '0'),
      wellFull, adcOverrange, atFullScale,
    });

    const generated = `${integer(exposure)} e⁻`;
    const charge = `${integer(electrons)} e⁻`;
    const beforeGain = percent(sensorSignal);
    const analog = percent(adcInput);
    const gainLabel = `${gain}×`;
    const raw = `RAW ${code}`;
    const adcState = adcOverrange ? 'ADC quá dải' : atFullScale ? 'ADC đúng biên' : 'ADC trong dải';
    const wellState = wellFull ? 'Giếng đầy' : 'Giếng chưa đầy';
    const summary = `${charge} · ${analog} dải · ${raw} · ${adcState} · ${wellState}`;
    labels = Object.freeze({
      generated, charge, beforeGain, analog, gain: gainLabel, raw, adcState, wellState,
      summary,
      description: `Chấm sáng chỉ thứ tự đọc, không biểu diễn thời gian xử lý. Gain ${gainLabel} khuếch đại điện áp, không tăng điện tích. ${summary}.`,
    });
    readout = Object.freeze([
      row('generated', 'Electron sinh ra', generated),
      row('charge', 'Electron giữ trong giếng', charge),
      row('wellState', 'Giới hạn lưu điện tích', wellState),
      row('sensorSignal', 'Điện áp trước gain', `${beforeGain} dải ADC`),
      row('adcInput', 'Điện áp sau gain', `${analog} dải ADC`),
      row('code', `Mã RAW · ${adcBits} bit`, String(code)),
      row('adcState', 'Giới hạn số hóa', adcState),
    ]);
    cached = null;
  }

  function snapshot() {
    if (!cached) {
      const stage = stages[stageIndex];
      cached = Object.freeze({
        phase, time, stage: stage.key, running: phase === 'running', controls, sample, labels,
        status: `${phaseLabels[phase]} Khâu ${stageIndex + 1}/3: ${stage.label.toLowerCase()}.`,
        announcement, readout, challenges,
      });
    }
    return cached;
  }

  function rewind() {
    time = 0;
    compensation = 0;
    stageIndex = 0;
    announcement = null;
    cached = null;
  }

  function select(nextControls) {
    controls = nextControls;
    phase = 'idle';
    rewind();
    project();
    return true;
  }

  function reset() {
    return select(defaultControls);
  }

  function move(next) {
    time = Math.min(next, stages[lastStage].at);
    let crossed = '';
    // Treat values within a few ulps as the same milestone, regardless of frame partition.
    while (stageIndex < lastStage && time + 4 * Number.EPSILON >= stages[stageIndex + 1].at) {
      stageIndex++;
      crossed += `${stages[stageIndex].label}. `;
    }
    if (crossed) announcement = crossed.trim();
    if (stageIndex === lastStage) {
      time = stages[lastStage].at;
      phase = 'done';
    }
    cached = null;
    return true;
  }

  function command(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'preset') {
      const preset = presets.get(value);
      return preset ? select(preset) : false;
    }
    if (key === 'exposure' || key === 'gain') {
      if (key === 'exposure') {
        const { min, max, step } = exposureRange;
        if (!Number.isFinite(value) || value < min || value > max || (value - min) % step !== 0) return false;
      } else if (!gains.has(value)) return false;
      if (controls[key] === value) return false;
      controls = Object.freeze({ ...controls, [key]: value || 0 });
      announcement = null;
      project();
      return true;
    }
    if (key === 'step') {
      if (phase === 'running' || phase === 'done') return false;
      phase = 'paused';
      compensation = 0;
      return move(stages[stageIndex + 1].at);
    }
    if (key === 'run') {
      if (phase === 'running') return false;
      if (phase === 'done') rewind();
      phase = 'running';
    } else if (key === 'pause') {
      if (phase !== 'running') return false;
      phase = 'paused';
    } else return false;
    announcement = null;
    cached = null;
    return true;
  }

  function advance(dt) {
    if (phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return false;
    // Reduced motion does not alter these teaching milestones or their physical sample.
    const delta = dt - compensation;
    const next = time + delta;
    compensation = (next - time) - delta;
    return next > time && move(next);
  }

  project();
  return { command, advance, snapshot, reset };
});
var mountRenderer = (function mountRenderer(root, data) {
    const renderer = (function mountRenderer(root) {
  const svg = root.querySelector('[data-machine-id="iso-raw-svg"]');
  if (!svg) throw new Error('Cannot find the ISO signal plate');
  const mirror = root.querySelector('[data-camera-reading]');
  const values = new Map(Array.from(svg.querySelectorAll('[data-iso-value]'), (node) => [node.getAttribute('data-iso-value'), node]));
  const marks = new Map(Array.from(svg.querySelectorAll('[data-iso-mark]'), (node) => [node.getAttribute('data-iso-mark'), node]));
  const bitCells = attr => Array.from(svg.querySelectorAll(`[${attr}]`), node => [node, Number(node.getAttribute(attr))]);
  const bits = bitCells('data-iso-bit');
  const board = svg.querySelector('.iso-board-motion');
  const boardBits = bitCells('data-iso-board-bit');
  const boardSample = marks.get('board-sample');
  const boardChargeWidth = Number(marks.get('board-charge-fill')?.getAttribute('data-iso-full-width'));
  const boardAdcWidth = Number(marks.get('board-gain-fill')?.getAttribute('data-iso-full-width'));
  const routeData = boardSample?.getAttribute('data-iso-journey');
  let journey = null;
  if (routeData) {
    try {
      const parsed = JSON.parse(routeData);
      const validLeg = points => Array.isArray(points) && points.length > 0 && points.every(
        point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
      );
      if (Array.isArray(parsed) && parsed.length === 2 && parsed.every(validLeg)) {
        journey = parsed.map((points) => {
          let length = 0;
          const segments = points.slice(1).map(([x, y], i) => {
            const [x0, y0] = points[i];
            const dx = x - x0, dy = y - y0;
            const start = length;
            const span = Math.hypot(dx, dy);
            length += span;
            return { x0, y0, dx, dy, start, span, end: length };
          });
          return { points, segments, length };
        });
      }
    } catch { journey = null; }
  }
  const stageTime = { charge: 0, analog: 1, adc: 2 };
  const wellTrack = marks.get('well-track');
  const wellHeight = Number(wellTrack?.getAttribute('height'));
  const wellBase = Number(wellTrack?.getAttribute('y')) + wellHeight;
  const inRangeWidth = Number(marks.get('adc-track')?.getAttribute('width'));
  const attrs = new Map();
  const texts = new Map();
  let drawnSample, drawnTime;

  function setAttr(node, key, value) {
    if (!node) return;
    const next = String(value);
    const prior = node.getAttribute(key);
    if (prior === next) return;
    if (!attrs.has(node)) attrs.set(node, new Map());
    const originals = attrs.get(node);
    if (!originals.has(key)) originals.set(key, prior);
    node.setAttribute(key, next);
  }

  function setText(node, value) {
    if (!node || node.textContent === value) return;
    if (!texts.has(node)) texts.set(node, node.textContent);
    node.textContent = value;
  }

  function moveSample(time) {
    if (!journey || time === drawnTime) return;
    drawnTime = time;
    // Each second is a teaching beat between package stops, not an electrical delay.
    const leg = time < 1 ? 0 : 1;
    const { points, segments, length } = journey[leg];
    const progress = time - leg;
    let [x, y] = progress >= 1 ? points.at(-1) : points[0];
    if (progress > 0 && progress < 1 && length > 0) {
      const distance = progress * length;
      const segment = segments.find(({ end }) => end >= distance);
      if (segment && segment.span > 0) {
        const fraction = (distance - segment.start) / segment.span;
        x = segment.x0 + segment.dx * fraction;
        y = segment.y0 + segment.dy * fraction;
      }
    }
    setAttr(boardSample, 'transform', `translate(${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10})`);
  }

  return {
    render({ stage, time, sample, labels }, { focus = 'all', reducedMotion = false } = {}) {
      setAttr(svg, 'data-camera-stage', stage);
      setAttr(svg, 'data-iso-highlight', root.getAttribute('data-mode') === 'reader' && focus !== 'all' ? focus : stage);
      moveSample(reducedMotion ? stageTime[stage] : time);
      if (sample === drawnSample) return;
      drawnSample = sample;
      setAttr(svg, 'data-iso-well-full', sample.wellFull);
      setAttr(svg, 'data-iso-overrange', sample.adcOverrange);
      if (wellHeight > 0) {
        const fillHeight = sample.sensorSignal * wellHeight;
        setAttr(marks.get('charge-fill'), 'height', fillHeight);
        setAttr(marks.get('charge-fill'), 'y', wellBase - fillHeight);
      }
      if (inRangeWidth > 0) {
        setAttr(marks.get('range-fill'), 'width', Math.min(1, sample.adcInput) * inRangeWidth);
        setAttr(marks.get('over-fill'), 'width', Math.max(0, sample.adcInput - 1) * inRangeWidth);
      }
      for (const key of ['charge', 'gain', 'raw', 'adcState', 'wellState']) setText(values.get(key), labels[key]);
      setText(values.get('generated'), `Sinh ra ${labels.generated}`);
      setText(values.get('analog'), `${labels.beforeGain} → ${labels.analog} dải ADC`);
      setText(values.get('description'), labels.description);
      bits.forEach(([node, index]) => {
        setText(node, sample.bits[index]);
        setAttr(node, 'data-iso-bit-value', sample.bits[index]);
      });
      if (board) {
        const adcState = sample.adcOverrange ? 'overrange' : sample.atFullScale ? 'full-scale' : 'in-range';
        setAttr(board, 'data-iso-board-adc', adcState);
        if (boardChargeWidth > 0) setAttr(marks.get('board-charge-fill'), 'width', sample.sensorSignal * boardChargeWidth);
        if (boardAdcWidth > 0) {
          setAttr(marks.get('board-gain-fill'), 'width', Math.min(1, sample.adcInput) * boardAdcWidth);
          setAttr(marks.get('board-gain-over'), 'width', Math.max(0, sample.adcInput - 1) * boardAdcWidth);
        }
        setText(values.get('board-charge'), labels.charge);
        setText(values.get('board-gain'), `${labels.gain} · ${labels.analog}`);
        setText(values.get('board-raw'), labels.raw);
        setText(values.get('board-adc-state'), labels.adcState);
        boardBits.forEach(([node, index]) => setAttr(node, 'data-iso-bit-value', sample.bits[index]));
      }
      if (mirror) setText(mirror, labels.summary);
    },
    dispose() {
      for (const [node, originals] of attrs) for (const [key, prior] of originals) {
        if (prior === null) node.removeAttribute(key);
        else node.setAttribute(key, prior);
      }
      for (const [node, prior] of texts) node.textContent = prior;
    },
  };
})(root, data);
    const dock = root.querySelector('[data-camera-transport]');
    const transport = root.querySelector('[data-machine-console-panel] .htw-machine-controls');
    const run = transport?.querySelector('[data-machine-run]');
    if (!dock || !run) return renderer;
    const home = transport.parentNode;
    const next = transport.nextSibling;
    dock.prepend(transport);
    return {
      render: renderer.render,
      focusExplore() {
        run.focus({ preventScroll: true });
        dock.scrollIntoView({ block: 'center', behavior: 'instant' });
      },
      dispose() {
        try { renderer.dispose(); }
        finally {
          home.insertBefore(transport, next);
        }
      },
    };
  });
runtime.boot({
  slug: "iso-raw",
  descriptor: {"title":"Tăng ISO có làm cảm biến thu thêm ánh sáng không?","controls":{"groups":[{"key":"signal","label":"Phơi sáng và khuếch đại","controls":[{"type":"range","key":"exposure","label":"Mức phơi · Electron sinh ra","min":0,"max":25000,"step":500,"unit":"e⁻"},{"type":"toggle3","key":"gain","label":"Gain analog","options":[{"value":1,"label":"1×"},{"value":2,"label":"2×"},{"value":4,"label":"4×"}]}]}],"presets":[{"key":"same-charge","label":"5.000 e⁻ · Gain 1×"},{"key":"exact-full-scale","label":"Đúng biên ADC · Giếng chưa đầy"},{"key":"clipped-not-full","label":"Quá dải ADC · Giếng chưa đầy"},{"key":"full-well","label":"Giếng đầy · ADC đúng biên"}],"challenges":[]}},
  data: {"parameters":{"fullWell":20000,"adcBits":12},"stepUnavailableByPhase":{"done":"Đã ở khâu cuối (số hóa ADC); bấm Chạy để xem lại từ đầu hoặc Đặt lại."},"presets":{"same-charge":{"exposure":5000,"gain":1},"exact-full-scale":{"exposure":5000,"gain":4},"clipped-not-full":{"exposure":7500,"gain":4},"full-well":{"exposure":20000,"gain":1}},"controls":{"groups":[{"key":"signal","label":"Phơi sáng và khuếch đại","controls":[{"type":"range","key":"exposure","label":"Mức phơi · Electron sinh ra","min":0,"max":25000,"step":500,"unit":"e⁻"},{"type":"toggle3","key":"gain","label":"Gain analog","options":[{"value":1,"label":"1×"},{"value":2,"label":"2×"},{"value":4,"label":"4×"}]}]}],"presets":[{"key":"same-charge","label":"5.000 e⁻ · Gain 1×"},{"key":"exact-full-scale","label":"Đúng biên ADC · Giếng chưa đầy"},{"key":"clipped-not-full","label":"Quá dải ADC · Giếng chưa đầy"},{"key":"full-well","label":"Giếng đầy · ADC đúng biên"}],"challenges":[]}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
