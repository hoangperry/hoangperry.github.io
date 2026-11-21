/* How Things Work · euv-lithography · generated playground bundle (classic script). Do not edit. */
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
  'use strict';
  const p = { ...data.parameters };
  const defaults = { ...data.defaults };
  const ranges = new Map(data.controls.groups.flatMap(({ controls }) => controls.map((control) => [control.key, control])));
  const recipes = new Map(Object.entries(data.recipes).map(([key, overrides]) => [key, { ...overrides }]));
  const challengeKeys = data.controls.challenges.map(({ key }) => key);
  const freeze = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  };
  const tau = 2 * Math.PI;
  const sinc = (x) => x === 0 ? 1 : Math.sin(x) / x;
  const h = p.slitHalfFraction;
  const xNm = Object.freeze(Array.from({ length: 1 + 2 * p.sampleHalfWidthNm / p.sampleStepNm },
    (_, index) => index * p.sampleStepNm - p.sampleHalfWidthNm));
  let controls = { ...defaults };
  let phase = 'idle', time = 0, announcement = '', cached, opticalCache, scanCache;
  const earned = new Set();

  function optics() {
    if (opticalCache) return opticalCache;
    const pitchNm = controls.pitch;
    const defocusNm = controls.focus;
    const firstOrderSin = p.wavelengthNm / pitchNm;
    const passesFirst = firstOrderSin <= p.na;
    const a = passesFirst ? 2 / Math.PI : 0;
    const relativePhase = -Math.PI * p.wavelengthNm * defocusNm / pitchNm ** 2;
    // E = 1/2 + a cos(kx) exp(iφ); I is the sum of DC and two real cosine terms.
    const fundamental = passesFirst ? a * Math.cos(relativePhase) : 0;
    const pairImag = passesFirst && relativePhase !== 0 ? a * Math.sin(relativePhase) : 0;
    const secondHarmonic = a * a / 2;
    const dc = 1 / 4 + secondHarmonic;
    const k = tau / pitchNm;
    const intensity = xNm.map((x) => Math.max(0, dc + fundamental * Math.cos(k * x) + secondHarmonic * Math.cos(2 * k * x)));
    // Continuous extrema of I as a quadratic in cos(kx), independent of the plot sampling grid.
    const max = dc + Math.abs(fundamental) + secondHarmonic;
    const vertex = secondHarmonic ? Math.max(-1, Math.min(1, -fundamental / (4 * secondHarmonic))) : 0;
    const min = Math.max(0, dc + fundamental * vertex + secondHarmonic * (2 * vertex ** 2 - 1));
    opticalCache = freeze({ pitchNm, maskPitchNm: pitchNm * p.reduction, defocusNm,
      admittedOrders: passesFirst ? [-1, 0, 1] : [0], fundamental, secondHarmonic, dc,
      contrast: (max - min) / (max + min), intensity, xNm,
      pupil: { firstOrderSin, na: p.na, phaseRad: passesFirst ? relativePhase || 0 : null,
        pairReal: fundamental, pairImag,
        centerIntensity: (0.5 + fundamental) ** 2 + pairImag ** 2,
        halfPitchIntensity: (0.5 - fundamental) ** 2 + pairImag ** 2 },
    });
    return opticalCache;
  }

  function atSite(fieldFraction, center, image) {
    const start = fieldFraction - h;
    const end = fieldFraction + h;
    const developed = center >= end - 1e-12;
    const stop = developed ? end : Math.max(start, center);
    const width = stop - start;
    const exposure = developed ? 1 : width / (2 * h);
    const driftPerFieldNm = controls.sync * p.fieldMm; // mm × ppm = nm
    const shift = driftPerFieldNm * (start + stop) / 2;
    const overlayNm = driftPerFieldNm * fieldFraction || 0;
    const k = tau / image.pitchNm;
    const blur = k * driftPerFieldNm * width / 2;
    const a = image.fundamental * sinc(blur);
    const b = image.secondHarmonic * sinc(2 * blur);
    const scale = controls.dose * exposure;
    // Average cosines over the actual dwell interval, then divide by a full nominal dwell.
    const dose = xNm.map((x) => {
      const angle = k * (x - shift);
      return scale * Math.max(0, image.dc + a * Math.cos(angle) + b * Math.cos(2 * angle));
    });
    return { fieldFraction, fieldMm: p.fieldMm * fieldFraction, overlayNm,
      drift: width > 0 ? { fromNm: driftPerFieldNm * start || 0, toNm: driftPerFieldNm * stop || 0 } : null,
      exposure, developed, dose, removed: dose.map((value) => developed && value >= p.threshold) };
  }

  function scanState() {
    if (scanCache) return scanCache;
    const progress = time / p.duration;
    const center = -h + (1 + 2 * h) * progress;
    const ratio = -p.reduction * (1 + controls.sync * 1e-6);
    const waferMm = center * p.fieldMm;
    const scan = { center, progress, waferMm, reticleMm: ratio * waferMm, ratio,
      sourceFrame: Math.floor(progress * 16 + 1e-12) % 4 };
    scanCache = freeze({ scan, sites: [0, 0.5, 1].map((fraction) => atSite(fraction, center, optics())) });
    return scanCache;
  }

  function nearestGrooveDistance(removed) {
    // The same sample cells are drawn in the section. Ignore grooves cut off by the plot boundaries.
    let nearest = Infinity;
    for (let i = 0; i < removed.length;) {
      if (!removed[i]) { i += 1; continue; }
      const start = i;
      while (removed[i]) i += 1;
      if (start === 0 || i === removed.length) continue;
      const left = (xNm[start - 1] + xNm[start]) / 2;
      const right = (xNm[i - 1] + xNm[i]) / 2;
      if (left <= 0 && right >= 0) return 0;
      nearest = Math.min(nearest, Math.abs((left + right) / 2));
    }
    return nearest;
  }

  function step(dt) {
    time = Math.min(p.duration, time + Math.min(dt, p.stepSeconds));
    scanCache = cached = null;
    if (p.duration - time > 1e-10) return true;
    time = p.duration;
    phase = 'done';
    const { sites } = scanState();
    const hasPattern = (site) => site.removed.some(Boolean) && site.removed.some((value) => !value);
    if (controls.sync === 0 && sites.every((site) => site.removed[xNm.length >> 1] && hasPattern(site))) earned.add('printed');
    if (sites.every((site) => !site.removed.some(Boolean))) earned.add('lost');
    const distance = nearestGrooveDistance(sites[2].removed);
    if (Number.isFinite(distance) && distance >= 8) earned.add('shifted');
    announcement = 'Đã phơi đủ cả ba vị trí. So sánh mẫu dự kiến sau hiện với dấu lớp cũ.';
    return true;
  }

  function clearScan() {
    time = 0;
    phase = 'idle';
    opticalCache = scanCache = cached = null;
  }

  function reset() {
    controls = { ...defaults };
    earned.clear();
    clearScan();
    announcement = '';
    return true;
  }

  function command(input) {
    if (!input || typeof input !== 'object') return false;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'run') {
      if (phase === 'running') return false;
      if (phase === 'done') clearScan();
      phase = 'running';
      announcement = '';
    } else if (key === 'pause') {
      if (phase !== 'running') return false;
      phase = 'paused';
      announcement = '';
    } else if (key === 'step') {
      if (phase === 'running' || phase === 'done') return false;
      phase = 'paused';
      announcement = '';
      return step(p.stepSeconds);
    } else if (key === 'preset') {
      if (!recipes.has(value)) return false;
      // The presets put the reader where the result of the experiment is visible.
      controls = { ...defaults, ...recipes.get(value), site: controls.site, view: 'wafer' };
      clearScan();
      announcement = 'Đã chuẩn bị wafer mới; liều tích lũy về 0.';
    } else {
      const control = ranges.get(key);
      if (!control) return false;
      if (control.type === 'segmented') {
        if (!control.options.some((option) => value === option.value) || controls[key] === value) return false;
        controls[key] = value;
        announcement = '';
      } else {
        const { min, max, step: interval } = control;
        if (!Number.isFinite(value) || value < min || value > max) return false;
        const index = (value - min) / interval;
        if (Math.abs(index - Math.round(index)) > 1e-8) return false;
        const rounded = Number((min + Math.round(index) * interval).toFixed(8));
        if (controls[key] === rounded) return false;
        controls[key] = rounded;
        clearScan();
        announcement = 'Đổi thông số phơi: bắt đầu lại trên wafer chưa nhận liều.';
      }
    }
    cached = null;
    return true;
  }

  function advance(dt) {
    if (phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return false;
    return step(dt);
  }

  function snapshot() {
    if (cached) return cached;
    const image = optics();
    const { scan, sites } = scanState();
    const format = (value, digits) => (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits).replace('.', ',').replace('-', '−');
    const projectedOffsets = sites.map((site) => `${format(site.overlayNm, 2)} nm`).join(' / ');
    const status = {
      idle: 'Sẵn sàng; wafer chưa nhận liều.', running: 'Đang quét khe qua trường phơi.',
      paused: 'Đã tạm dừng; giữ nguyên liều đã tích.', done: 'Đã xong lượt quét; xem cản quang sau hiện.',
    }[phase];
    cached = freeze({ time, duration: p.duration, phase, running: phase === 'running', status, announcement,
      controls: { ...controls }, scan, optics: image, sites, threshold: p.threshold,
      readout: [
        { key: 'progress', label: 'Thời gian lượt trình diễn', text: `${format(time, 2)} / ${p.duration} s` },
        { key: 'orders', label: 'Bậc qua khẩu độ', text: image.admittedOrders.length === 3 ? '−1, 0, +1' : '0 (không còn ảnh vạch)' },
        { key: 'fundamental', label: 'Điều biến theo chu kỳ vạch', text: `${format(image.fundamental, 3)} (tương đối, có dấu)` },
        { key: 'ratio', label: 'Tốc độ mặt nạ / wafer', text: `${format(scan.ratio, 7)} : 1` },
        { key: 'overlay', label: 'Dịch dự kiến ở đầu / giữa / cuối trường', text: projectedOffsets },
        { key: 'exposure', label: 'Phần liều đã nhận theo khe (thời phần)', text: sites.map(({ exposure }) => `${Math.round(100 * exposure)}%`).join(' / ') },
      ], challenges: challengeKeys.map((key) => ({ key, done: earned.has(key) })),
    });
    return cached;
  }
  return { command, advance, snapshot, reset };
});
var mountRenderer = (function mountRenderer(root, data) {
  'use strict';
  const scope = root.closest('.htw-machine');
  const svg = Array.from(root.querySelectorAll('[data-machine-id="euv-svg"]')).find((node) => node.closest('.htw-machine') === scope);
  if (!svg) throw new Error('euv-lithography renderer: missing euv-svg');

  const bind = (attr) => new Map(Array.from(svg.querySelectorAll(`[${attr}]`), (node) => [node.getAttribute(attr), node]));
  const panels = bind('data-euv-panel');
  const marks = bind('data-euv-bind');
  const labels = bind('data-euv-text');
  const orders = bind('data-euv-order');
  const detailOrders = bind('data-euv-detail-order');
  const sourcePoses = bind('data-euv-source-pose');
  const sourceSteps = bind('data-euv-source-step');
  const siteRows = bind('data-euv-site');
  const fieldSites = bind('data-euv-field-site');
  const description = svg.querySelector('desc');
  const originals = new Map();
  const originalText = new Map();
  let disposed = false;

  const focusPanels = new Map([
    ['all', 'machine'], ['machine', 'machine'], ['limits', 'machine'],
    ['source', 'source'], ['mirrors', 'mirrors'], ['reticle', 'mirrors'], ['scan', 'scan'],
    ['optics', 'optics'], ['resist', 'sites'], ['overlay', 'sites'],
    ['pupil', 'pupil'], ['section', 'section'],
  ]);
  const viewGroups = { machine: ['machine'], module: ['source', 'mirrors', 'scan'], wafer: ['optics', 'sites'], pupil: ['pupil'], section: ['section'] };
  const panelOffsets = { machine: 0, source: 0, mirrors: 350, scan: 700, optics: 0, sites: 350, pupil: 0, section: 0 };
  const descriptions = {
    machine: description.textContent,
    source: 'Buồng chân không có vòi thiếc, đường laser kích và gương gom. Bốn khung cho thấy giọt, đĩa thiếc, plasma rồi phản xạ EUV.',
    mirrors: 'Đường EUV gấp qua gương chiếu sáng, mặt nạ có vạch hấp thụ, rồi đến gương chiếu. Hình phóng to cho thấy các lớp molypden và silic xen nhau.',
    scan: 'Trong hệ máy, mặt nạ và wafer chạy ngược chiều qua hai vị trí khe cố định. Nhìn từ wafer, tâm khe đi từ phải sang trái qua ba dấu 0, 16,5 và 33 milimét.',
    optics: 'Khẩu độ chọn bậc nhiễu xạ. Đồ thị cường độ ảnh trên wafer và mặt nạ quy về cùng trục nanomét. Thước cường độ cố định từ 0 đến 1,3.',
    sites: 'Ba đồ thị cùng thang liều từ 0 đến 2. Đường đứt là ngưỡng hiện, thập là dấu lớp cũ và hình thoi là tâm phơi dự kiến. Vạch chéo chỉ vùng mô hình dự đoán sẽ bị rửa trôi khi hiện.',
    pupil: 'Cửa khẩu độ giữa hai mốc −0,33 và +0,33. Các bậc bị chặn có vạch gạch. Bên dưới, cộng véctơ từ bậc 0 và hai bậc bên tại tâm vạch.',
    section: 'Đồ thị liều thẳng hàng với cản quang, lớp dưới và đế. Lát cắt cho biết rãnh dự kiến sau khi hiện ở công đoạn riêng. Nét đứt đứng là dấu cũ.',
  };
  const sourcePhases = [
    'Giọt thiếc rời vòi.', 'Xung sơ bộ dàn giọt thành đĩa.',
    'Xung chính tạo plasma phát EUV.', 'Gương gom EUV về tiêu điểm trung gian.',
  ];
  const fieldLeft = 61, fieldWidth = 336;
  const halfSlit = data?.parameters?.slitHalfFraction ?? .08;
  const plotLeft = 65, plotRight = 420, plotWidth = plotRight - plotLeft;
  const halfSpan = 96;
  const intensityBottom = 252, intensityHeight = 109, intensityMax = 1.3;
  const doseBottom = 49, doseHeight = 30, doseMax = 2; // 1.5× maximum control × 1.292 peak < 2
  const xAt = (value) => plotLeft + (value + halfSpan) / (2 * halfSpan) * plotWidth;
  const coord = (value) => Number(value.toFixed(3));
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const viet = (value, digits = 2, signed = false) => {
    const rounded = Math.abs(value) < .5 * 10 ** -digits ? 0 : value;
    return `${rounded < 0 ? '−' : rounded > 0 && signed ? '+' : ''}${Math.abs(rounded).toFixed(digits).replace('.', ',')}`;
  };

  function attr(node, key, value) {
    const old = node.getAttribute(key);
    const next = String(value);
    if (old === next) return;
    let saved = originals.get(node);
    if (!saved) { saved = new Map(); originals.set(node, saved); }
    if (!saved.has(key)) saved.set(key, old);
    node.setAttribute(key, next);
  }
  function write(node, value) {
    if (node.textContent === value) return;
    if (!originalText.has(node)) originalText.set(node, node.textContent);
    node.textContent = value;
  }
  const label = (key, value) => write(labels.get(key), value);
  const mark = (key, property, value) => attr(marks.get(key), property, value);
  const show = (node, visible) => attr(node, 'display', visible ? 'inline' : 'none');
  const translateStage = (key, center, travel) => mark(key, 'transform', `translate(${((center - .5) * travel).toFixed(3)} 0)`);

  function selectView(s, view) {
    const focus = focusPanels.has(view.focus) ? view.focus : 'all';
    const reader = (view.mode ?? root.getAttribute('data-mode')) !== 'explore';
    const activePanel = focusPanels.get(focus);
    const readingView = viewGroups[activePanel] ? activePanel : ['optics', 'sites'].includes(activePanel) ? 'wafer' : 'module';
    const zoom = reader ? readingView : s.controls.view;
    const visible = reader ? [activePanel] : viewGroups[zoom];
    attr(svg, 'data-euv-view', zoom);
    attr(svg, 'data-euv-focus', focus);
    attr(svg, 'data-euv-detail', visible.length === 1 ? visible[0] : 'all');
    attr(svg, 'viewBox', `0 ${reader ? panelOffsets[activePanel] : 0} 440 ${visible.length * 350}`);
    for (const [key, node] of panels) show(node, visible.includes(key));
    write(description, visible.map((key) => descriptions[key]).join(' '));
    return visible;
  }

  function paintScan(scan, activePanel) {
    if (activePanel === 'machine') {
      translateStage('machine-reticle', scan.center, 15 * scan.ratio / 4);
      translateStage('machine-wafer', scan.center, 15);
      return;
    }
    translateStage('scan-reticle', scan.center, 132 * scan.ratio / 4);
    translateStage('scan-wafer', scan.center, 132);
    // The field coordinate increases in scan order, opposite to wafer motion in the lab frame.
    const center = fieldLeft + fieldWidth * (1 - scan.center);
    const start = clamp(center - fieldWidth * halfSlit, fieldLeft, fieldLeft + fieldWidth);
    const end = clamp(center + fieldWidth * halfSlit, fieldLeft, fieldLeft + fieldWidth);
    mark('field-scanned', 'x', coord(end));
    mark('field-scanned', 'width', coord(fieldLeft + fieldWidth - end));
    mark('field-slit', 'x', coord(start));
    mark('field-slit', 'width', coord(end - start));
    mark('slit-cursor', 'transform', `translate(${coord(center)} 0)`);
    label('reticle-mm', `${viet(scan.reticleMm, 1, true)} mm`);
    label('wafer-mm', `${viet(scan.waferMm, 1, true)} mm`);
    label('ratio', `Tỷ lệ ${viet(scan.ratio, 7)}`);
    label('scan-progress', `Tiến độ lượt: ${Math.round(scan.progress * 100)}%`);
  }

  function trace(xs, values, bottom, height, max) {
    let d = '';
    for (let i = 0; i < xs.length; i += 1) {
      d += `${i === 0 ? 'M' : 'L'}${coord(xAt(xs[i]))} ${coord(bottom - values[i] / max * height)}`;
    }
    return d;
  }
  function maskBars(pitch) {
    // x on the lower graph is wafer distance. Show mask pitch projected down by 4×, not at native reticle scale.
    let d = '';
    for (let i = Math.floor(-halfSpan / pitch); i <= Math.ceil(halfSpan / pitch); i += 1) {
      const lo = clamp(i * pitch - pitch / 4, -halfSpan, halfSpan);
      const hi = clamp(i * pitch + pitch / 4, -halfSpan, halfSpan);
      if (hi > lo) d += `M${coord(xAt(lo))} 105H${coord(xAt(hi))}V123H${coord(xAt(lo))}Z`;
    }
    return d;
  }
  function paintOptics(o) {
    const intensity = trace(o.xNm, o.intensity, intensityBottom, intensityHeight, intensityMax);
    mark('intensity', 'd', intensity);
    mark('intensity-area', 'd', `${intensity}L${plotRight} ${intensityBottom}H${plotLeft}Z`);
    mark('mask-bars', 'd', maskBars(o.pitchNm));
    label('mask-pitch', `Mặt nạ ${viet(o.maskPitchNm, 0)} nm`);
    label('wafer-pitch', `Wafer ${viet(o.pitchNm, 0)} nm`);
    label('contrast', `Michelson ${viet(o.contrast * 100, 1)}%`);
    label('defocus', `z = ${viet(o.defocusNm, 0, true)} nm`);
    label('harmonics', `I₁ ${viet(o.fundamental, 3, true)}  ·  I₂ ${viet(o.secondHarmonic, 3, true)}`);
  }

  // Boolean samples are cells around sample coordinates, with half-width cells at the two plotted endpoints.
  // Join consecutive cells without adding interpolated threshold crossings or reading ahead of development.
  function sampleBands(xs, samples, selected, top, bottom) {
    let d = '';
    let i = 0;
    while (i < xs.length) {
      if (samples[i] !== selected) { i += 1; continue; }
      const lo = i === 0 ? xs[0] : (xs[i - 1] + xs[i]) / 2;
      do { i += 1; } while (i < xs.length && samples[i] === selected);
      const hi = i === xs.length ? xs[i - 1] : (xs[i - 1] + xs[i]) / 2;
      const left = coord(xAt(lo)), right = coord(xAt(hi));
      d += `M${left} ${top}H${right}V${bottom}H${left}Z`;
    }
    return d;
  }
  function paintSites(s) {
    label('threshold', `Ngưỡng ${viet(s.threshold)}`);
    const threshold = coord(doseBottom - s.threshold / doseMax * doseHeight);
    s.sites.forEach((site, i) => {
      const { exposure, overlayNm, developed } = site;
      const percent = Math.floor(exposure * 100);
      const status = developed ? (site.removed.some(Boolean) ? 'Dự kiến có rãnh' : 'Dự kiến không mở')
        : exposure > 0 ? `Đang phơi ${percent === 0 ? '<1' : percent}%` : 'Chưa phơi';
      label(`site-${i}-phase`, status);
      label(`site-${i}-overlay`, `Δ = ${viet(overlayNm, 2, true)} nm`);
      mark(`dose-${i}`, 'd', trace(s.optics.xNm, site.dose, doseBottom, doseHeight, doseMax));
      mark(`threshold-${i}`, 'd', `M${plotLeft} ${threshold}H${plotRight}`);
      mark(`shift-${i}`, 'transform', `translate(${coord(xAt(overlayNm))} 0)`);
      show(marks.get(`undeveloped-${i}`), !developed);
      show(marks.get(`remaining-${i}`), developed);
      show(marks.get(`removed-${i}`), developed);
      mark(`removed-${i}`, 'd', developed ? sampleBands(s.optics.xNm, site.removed, true, 52, 59) : '');
    });
  }

  function paintPupil(image) {
    const { firstOrderSin, na, phaseRad, pairReal, pairImag, centerIntensity, halfPitchIntensity } = image.pupil;
    for (const [key, node] of detailOrders) {
      const order = Number(key);
      attr(node, 'data-euv-admitted', image.admittedOrders.includes(order));
      attr(node, 'transform', `translate(${coord(220 + order * firstOrderSin * 450)} 0)`);
    }
    label('pupil-first', `|sin θ₁| = ${viet(firstOrderSin, 3)}`);
    label('pupil-admitted', phaseRad === null ? '±1 bị chặn' : '±1 lọt qua');
    label('pupil-phase', phaseRad === null ? '— (bị chặn)' : `${viet(phaseRad * 180 / Math.PI, 1, true)}°`);
    label('pupil-center', `I(0) = ${viet(centerIntensity, 3)}`);
    label('pupil-half', `I(p/2) = ${viet(halfPitchIntensity, 3)}`);
    const x = coord(159 + pairReal * 86), y = coord(254 - pairImag * 86);
    mark('pupil-tip', 'cx', x);
    mark('pupil-tip', 'cy', y);
    mark('pupil-result', 'd', `M116 254L${x} ${y}`);
    mark('pupil-vector', 'd', phaseRad === null ? '' : `M159 254L${x} ${y}`);
    attr(panels.get('pupil'), 'data-euv-pupil-limit', na);
  }

  function paintSection(snapshot, site) {
    const { xNm } = snapshot.optics;
    const thresholdY = coord(168 - snapshot.threshold * 43);
    label('section-location', `Dấu tại ${viet(site.fieldMm, site.fieldMm % 1 ? 1 : 0)} mm`);
    label('section-state', site.developed ? (site.removed.some(Boolean) ? 'Có rãnh sau hiện' : 'Không mở sau hiện')
      : site.exposure > 0 ? 'Đang phơi' : 'Chưa phơi');
    label('section-drift', site.drift === null ? 'Chưa có đoạn dịch ảnh đã phơi.'
      : `Dịch ảnh: ${viet(site.drift.fromNm, 2, true)} → ${viet(site.drift.toNm, 2, true)} nm`);
    mark('section-dose', 'd', trace(xNm, site.dose, 168, 86, 2));
    mark('section-threshold', 'd', `M${plotLeft} ${thresholdY}H${plotRight}`);
    mark('section-shift', 'transform', `translate(${coord(xAt(site.overlayNm))} 0)`);
    mark('section-resist', 'd', sampleBands(xNm, site.removed, false, 222, 246));
    attr(panels.get('section'), 'data-euv-section-site', site.fieldMm);
    attr(panels.get('section'), 'data-euv-section-developed', site.developed);
  }

  // Immutable rows keep stable references on view changes; avoid rebuilding invisible paths every frame.
  let lastOptics = null, lastSites = null, lastThreshold = null, lastPupil = null, lastSection = null;
  return {
    render(s, view = {}) {
      if (disposed) return;
      const visible = selectView(s, view);
      for (const [key, value] of [
        ['phase', s.phase], ['time', s.time], ['duration', s.duration], ['source-frame', s.scan.sourceFrame],
        ['scan-center', s.scan.center], ['scan-progress', s.scan.progress], ['wafer-mm', s.scan.waferMm],
        ['reticle-mm', s.scan.reticleMm], ['scan-ratio', s.scan.ratio], ['pitch-nm', s.optics.pitchNm],
        ['mask-pitch-nm', s.optics.maskPitchNm], ['admitted-orders', s.optics.admittedOrders.join(',')],
        ['contrast', s.optics.contrast], ['fundamental', s.optics.fundamental], ['defocus-nm', s.optics.defocusNm],
        ['second-harmonic', s.optics.secondHarmonic], ['threshold', s.threshold],
      ]) attr(svg, `data-euv-${key}`, value);
      for (const [key, node] of orders) attr(node, 'data-euv-admitted', s.optics.admittedOrders.includes(Number(key)));
      const sourceFrame = view.reducedMotion && s.phase === 'running' ? 2 : s.scan.sourceFrame;
      for (const [key, node] of sourcePoses) show(node, Number(key) === sourceFrame);
      show(marks.get('source-laser'), sourceFrame === 1 || sourceFrame === 2);
      for (const [key, node] of sourceSteps) attr(node, 'data-euv-active', Number(key) === sourceFrame);
      label('source-phase', sourcePhases[sourceFrame]);
      s.sites.forEach((site, i) => {
        const row = siteRows.get(String(i)), marker = fieldSites.get(String(i));
        for (const node of [row, marker]) {
          attr(node, 'data-euv-exposure', site.exposure);
          attr(node, 'data-euv-developed', site.developed);
          attr(node, 'data-euv-status', site.developed ? 'developed' : site.exposure > 0 ? 'exposing' : 'unexposed');
        }
        attr(row, 'data-euv-overlay-nm', site.overlayNm);
      });
      if (visible.includes('machine')) paintScan(s.scan, 'machine');
      if (visible.includes('scan')) paintScan(s.scan, 'scan');
      if (visible.includes('optics') && lastOptics !== s.optics) {
        paintOptics(s.optics);
        lastOptics = s.optics;
      }
      if (visible.includes('sites') && (lastSites !== s.sites || lastThreshold !== s.threshold)) {
        paintSites(s);
        lastSites = s.sites;
        lastThreshold = s.threshold;
      }
      if (visible.includes('pupil') && lastPupil !== s.optics) {
        paintPupil(s.optics);
        lastPupil = s.optics;
      }
      if (visible.includes('section')) {
        const site = s.sites[s.controls.site === 'start' ? 0 : s.controls.site === 'middle' ? 1 : 2];
        if (lastSection !== site) {
          paintSection(s, site);
          lastSection = site;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [node, values] of originals) for (const [key, value] of values) {
        if (value === null) node.removeAttribute(key);
        else node.setAttribute(key, value);
      }
      for (const [node, value] of originalText) node.textContent = value;
      originals.clear();
      originalText.clear();
      lastOptics = lastSites = lastPupil = lastSection = null;
    },
  };
});
runtime.boot({
  slug: "euv-lithography",
  descriptor: {"title":"Bên trong máy quang khắc EUV: từ giọt thiếc đến một lớp mạch","controls":{"groups":[{"key":"scale","label":"Mức quan sát","controls":[{"type":"segmented","key":"view","label":"Bản cắt và cận cảnh","options":[{"value":"machine","label":"Toàn máy"},{"value":"module","label":"Các cụm"},{"value":"wafer","label":"Mẫu trên wafer"},{"value":"pupil","label":"Soi khẩu độ"},{"value":"section","label":"Soi cản quang"}]},{"type":"segmented","key":"site","label":"Điểm soi cản quang","options":[{"value":"start","label":"Đầu · 0 mm"},{"value":"middle","label":"Giữa · 16,5 mm"},{"value":"end","label":"Cuối · 33 mm"}]}]},{"key":"imaging","label":"Ảnh trên wafer","controls":[{"type":"range","key":"pitch","label":"Chu kỳ vạch tại wafer","min":32,"max":76,"step":1,"unit":"nm"},{"type":"range","key":"focus","label":"Lệch tiêu","min":-250,"max":250,"step":1,"unit":"nm"}]},{"key":"exposure","label":"Quét và phơi","controls":[{"type":"range","key":"sync","label":"Sai lệch tỷ lệ tốc độ","min":-1,"max":1,"step":0.05,"unit":"ppm"},{"type":"range","key":"dose","label":"Hệ số liều","min":0.25,"max":1.5,"step":0.05,"unit":"×"}]}],"presets":[{"key":"baseline","label":"Đúng tiêu, đúng nhịp"},{"key":"blocked","label":"Pitch dưới ngưỡng"},{"key":"defocus","label":"Lệch tiêu"},{"key":"sync-error","label":"Lệch đồng bộ"},{"key":"under-dose","label":"Thiếu liều"}],"challenges":[{"key":"printed","label":"Mở vạch đúng chỗ ở cả ba dấu"},{"key":"lost","label":"Hoàn tất lượt mà không mở vạch nào"},{"key":"shifted","label":"Cuối trường: dấu cũ còn phủ, tâm rãnh gần nhất cách ít nhất 8 nm"}]}},
  data: {"stepUnavailableByPhase":{"done":"Đã phơi xong. Nhấn Chạy để bắt đầu lượt quét mới."},"parameters":{"wavelengthNm":13.5,"na":0.33,"reduction":4,"fieldMm":33,"slitHalfFraction":0.08,"duration":8,"stepSeconds":0.1,"threshold":0.75,"sampleHalfWidthNm":96,"sampleStepNm":2},"defaults":{"view":"machine","site":"end","pitch":48,"focus":0,"sync":0,"dose":1},"recipes":{"baseline":{},"blocked":{"pitch":36},"defocus":{"focus":85},"sync-error":{"sync":0.5},"under-dose":{"dose":0.4}},"controls":{"groups":[{"key":"scale","label":"Mức quan sát","controls":[{"type":"segmented","key":"view","label":"Bản cắt và cận cảnh","options":[{"value":"machine","label":"Toàn máy"},{"value":"module","label":"Các cụm"},{"value":"wafer","label":"Mẫu trên wafer"},{"value":"pupil","label":"Soi khẩu độ"},{"value":"section","label":"Soi cản quang"}]},{"type":"segmented","key":"site","label":"Điểm soi cản quang","options":[{"value":"start","label":"Đầu · 0 mm"},{"value":"middle","label":"Giữa · 16,5 mm"},{"value":"end","label":"Cuối · 33 mm"}]}]},{"key":"imaging","label":"Ảnh trên wafer","controls":[{"type":"range","key":"pitch","label":"Chu kỳ vạch tại wafer","min":32,"max":76,"step":1,"unit":"nm"},{"type":"range","key":"focus","label":"Lệch tiêu","min":-250,"max":250,"step":1,"unit":"nm"}]},{"key":"exposure","label":"Quét và phơi","controls":[{"type":"range","key":"sync","label":"Sai lệch tỷ lệ tốc độ","min":-1,"max":1,"step":0.05,"unit":"ppm"},{"type":"range","key":"dose","label":"Hệ số liều","min":0.25,"max":1.5,"step":0.05,"unit":"×"}]}],"presets":[{"key":"baseline","label":"Đúng tiêu, đúng nhịp"},{"key":"blocked","label":"Pitch dưới ngưỡng"},{"key":"defocus","label":"Lệch tiêu"},{"key":"sync-error","label":"Lệch đồng bộ"},{"key":"under-dose","label":"Thiếu liều"}],"challenges":[{"key":"printed","label":"Mở vạch đúng chỗ ở cả ba dấu"},{"key":"lost","label":"Hoàn tất lượt mà không mở vạch nào"},{"key":"shifted","label":"Cuối trường: dấu cũ còn phủ, tâm rãnh gần nhất cách ít nhất 8 nm"}]}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
