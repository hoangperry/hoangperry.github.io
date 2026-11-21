/* How Things Work · barometric-altimeter · generated playground bundle (classic script). Do not edit. */
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
  const { constants: C, ranges, defaults, trajectory, controls: descriptors } = config;
  const A = C.T0 / C.L;
  const n = C.g0 / (C.Rd * C.L);
  const k = 1 / n;
  const pressureAt = (h, pw) => pw * (1 - h / A) ** n;
  const minPressure = pressureAt(ranges.altitude.max, ranges.basePressure.min);
  const maxPressure = pressureAt(ranges.altitude.min, ranges.basePressure.max);
  const challengeKeys = descriptors.challenges.map((item) => item.key);
  const labels = Object.fromEntries(descriptors.challenges.map((item) => [item.key, item.label]));
  const presets = Object.fromEntries(descriptors.presets.map((item) => [item.key, item.values]));
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clean = (number) => number === 0 ? 0 : number;
  const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
  let controls, time, running, done, baselines, announcement, cached;
  let originAltitude, segmentTime, segmentCorrection, timeCorrection;

  function physics() {
    const { altitude: h, basePressure: pw, settingPressure: ps } = controls;
    const p = pressureAt(h, pw);
    const indicated = A * (1 - (p / ps) ** k);
    const referenceFactor = (C.P0 / ps) ** k;
    return {
      altitudeM: clean(h), targetAltitudeM: clean(controls.targetAltitude),
      basePressureHpa: pw, settingPressureHpa: ps, ambientPressureHpa: p,
      indicatedAltitudeM: clean(indicated), altitudeErrorM: clean(indicated - h),
      pressureAltitudeM: clean(A * (1 - (p / C.P0) ** k)),
      referenceFactor, referenceOffsetM: clean(A * (1 - referenceFactor)),
      capsuleExpansion: clean((maxPressure - p) / (maxPressure - minPressure)),
      dialFraction: (indicated + 600) / 4200,
    };
  }

  // Baselines persist across native range input events, but not a change of a held physical variable.
  function observe(changedKey = null) {
    const state = physics();
    const held = {
      'correct-reference': ['altitudeM', 'basePressureHpa'],
      'weather-change': ['altitudeM', 'settingPressureHpa'],
      'setting-only': ['altitudeM', 'basePressureHpa'],
      'correct-after-weather': ['altitudeM', 'basePressureHpa'],
    };
    for (const key of challengeKeys) {
      if (baselines[key] && held[key].some((field) => state[field] !== baselines[key][field])) baselines[key] = null;
    }
    const sameCapsule = (base) => state.ambientPressureHpa === base.ambientPressureHpa && state.capsuleExpansion === base.capsuleExpansion;
    const messages = [];
    function complete(key, controlKey, condition) {
      const base = baselines[key];
      if (!done[key] && changedKey === controlKey && base && condition(base)) {
        done[key] = true;
        messages.push(`Hoàn tất: ${labels[key]}`);
      }
    }
    complete('correct-reference', 'settingPressure', (base) => sameCapsule(base) && near(state.settingPressureHpa, state.basePressureHpa, 0.05) && Math.abs(state.altitudeErrorM) <= 1);
    complete('weather-change', 'basePressure', (base) => near(state.basePressureHpa, 990, 0.25) && state.ambientPressureHpa < base.ambientPressureHpa && state.capsuleExpansion > base.capsuleExpansion && state.indicatedAltitudeM - base.indicatedAltitudeM >= 150);
    complete('setting-only', 'settingPressure', (base) => near(state.settingPressureHpa, 1030, 0.25) && sameCapsule(base) && state.indicatedAltitudeM - base.indicatedAltitudeM >= 130);
    complete('correct-after-weather', 'settingPressure', (base) => done['weather-change'] && near(state.settingPressureHpa, 990, 0.05) && sameCapsule(base) && Math.abs(state.altitudeErrorM) <= 1);
    const at1000 = near(state.altitudeM, 1000);
    const standardBase = near(state.basePressureHpa, C.P0);
    const standardSetting = near(state.settingPressureHpa, C.P0);
    const arm = (key, condition) => { if (!baselines[key] && condition) baselines[key] = state; };
    arm('correct-reference', at1000 && standardBase && near(state.settingPressureHpa, 1000));
    arm('weather-change', at1000 && standardBase && standardSetting);
    arm('setting-only', at1000 && standardBase && standardSetting);
    arm('correct-after-weather', done['weather-change'] && at1000 && near(state.basePressureHpa, 990, 0.25) && standardSetting);
    return messages.length ? messages.join(' ') : null;
  }

  function anchor() {
    originAltitude = controls.altitude;
    segmentTime = 0;
    segmentCorrection = 0;
  }
  function load(values, clearChallenges) {
    controls = { ...values };
    time = 0;
    timeCorrection = 0;
    running = false;
    if (clearChallenges) done = Object.fromEntries(challengeKeys.map((key) => [key, false]));
    baselines = Object.fromEntries(challengeKeys.map((key) => [key, null]));
    anchor();
    observe(); // Loading may arm an observation, never complete a challenge.
    announcement = null;
    cached = null;
  }
  function reset() { load(defaults, true); }

  function move(dt) {
    const distance = controls.targetAltitude - originAltitude;
    const duration = Math.abs(distance) / trajectory.speedMps;
    const remaining = duration - segmentTime;
    if (remaining <= 0) return;
    const actual = Math.min(dt, remaining);
    // Compensated elapsed times keep long and finely partitioned trajectories equivalent.
    const segmentDelta = actual - segmentCorrection;
    const nextSegment = segmentTime + segmentDelta;
    segmentCorrection = (nextSegment - segmentTime) - segmentDelta;
    segmentTime = nextSegment;
    const delta = actual - timeCorrection;
    const nextTime = time + delta;
    timeCorrection = (nextTime - time) - delta;
    time = nextTime;
    const arrived = actual === remaining || segmentTime >= duration;
    if (arrived) {
      segmentTime = duration;
      controls.altitude = controls.targetAltitude;
      running = false;
    } else controls.altitude = clean(originAltitude + Math.sign(distance) * trajectory.speedMps * segmentTime);
    announcement = observe();
    cached = null;
  }

  function advance(dt) {
    if (!running || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
    move(dt);
  }
  function rangeValue(key, raw) {
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(value)) return null;
    const range = ranges[key];
    const bounded = Math.min(range.max, Math.max(range.min, value));
    return clean(Math.min(range.max, Math.max(range.min, range.min + Math.round((bounded - range.min) / range.step) * range.step)));
  }
  function command(input) {
    if (!input || typeof input !== 'object') return;
    const { key, value } = input;
    if (key === 'reset') return reset();
    if (key === 'preset') {
      if (typeof value === 'string' && has(presets, value)) load(presets[value], false);
      return;
    }
    if (key === 'run') {
      if (running || controls.altitude === controls.targetAltitude) return;
      running = true;
    } else if (key === 'pause') {
      if (!running) return;
      running = false;
    } else if (key === 'step') {
      if (running || controls.altitude === controls.targetAltitude) return;
      move(trajectory.stepSeconds);
      return;
    } else if (has(ranges, key)) {
      const next = rangeValue(key, value);
      if (next === null) return;
      controls[key] = next;
      if (key === 'altitude' || key === 'targetAltitude') {
        running = false;
        anchor();
      }
      announcement = observe(key);
      cached = null;
      return;
    } else return;
    announcement = null;
    cached = null;
  }

  // Vietnamese display formatting only. Numeric snapshot values retain full precision, including tiny errors.
  function format(number, digits = 0, signed = false) {
    const rounded = Math.round(Math.abs(number) * 10 ** digits) / 10 ** digits;
    const parts = rounded.toFixed(digits).split('.');
    const prefix = rounded === 0 ? '' : number < 0 ? '−' : signed ? '+' : '';
    return prefix + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (parts[1] ? `,${parts[1]}` : '');
  }
  function snapshot() {
    if (cached) return cached;
    const state = physics();
    const atTarget = controls.altitude === controls.targetAltitude;
    const status = atTarget
      ? 'Đã tới đích; đổi đích hoặc độ cao để thử quỹ đạo khác.'
      : `Đích ${format(controls.targetAltitude)} m; chuyển độ cao mô hình với tốc độ 5 m/s.`;
    const readout = [
      { key: 'ambientPressure', label: 'Áp suất tại đồng hồ', text: `${format(state.ambientPressureHpa, 1)} hPa` },
      { key: 'altitude', label: 'Độ cao mô hình (đối chiếu)', text: `${format(state.altitudeM)} m` },
      { key: 'indicatedAltitude', label: 'Số chỉ trên mặt số', text: `${format(state.indicatedAltitudeM)} m` },
      { key: 'altitudeError', label: 'Sai lệch số chỉ H − h (đối chiếu)', text: `${format(state.altitudeErrorM, 0, true)} m` },
      { key: 'time', label: 'Thời gian chuyển độ cao', text: `${format(time, 1)} s` },
    ].map((item) => Object.freeze(item));
    cached = Object.freeze({
      time: clean(time), running, controls: Object.freeze({ ...controls }), status,
      stepUnavailableReason: atTarget ? status : null,
      readout: Object.freeze(readout), announcement,
      challenges: Object.freeze(challengeKeys.map((key) => Object.freeze({ key, done: done[key] }))),
      ...state,
    });
    return cached;
  }
  reset();
  return Object.freeze({ snapshot, advance, command, reset });
});
var mountRenderer = (function mountRenderer(root, data) {
  'use strict';
  const G = data.scene;
  const ids = ['am-svg', 'am-capsule', 'am-corrugation', 'am-stem', 'am-input-pin', 'am-lever', 'am-cam', 'am-sector', 'am-pinion-needle', 'am-knob', 'am-notes'];
  const el = {};
  for (const id of ids) {
    const node = root.querySelector(`[data-machine-id="${id}"]`);
    if (!node) throw new Error(`altimeter renderer: missing ${id}`);
    el[id] = node;
  }
  const view = el['am-svg'];
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
  const num = (n) => String(Number(n.toFixed(5)));
  const transform = (x, y, angle) => `translate(${x} ${y}) rotate(${num(angle)})`;
  const focusKeys = ['all', 'pressure', 'capsule', 'linkage', 'dial', 'setting', 'weather', 'limits'];

  function layout(width) {
    if (disposed) return;
    const wide = width >= G.breakpoint;
    set(view, 'viewBox', `0 0 ${wide ? G.wideWidth : G.compactWidth} ${wide ? G.wideHeight : G.compactHeight}`);
    set(view, 'data-am-layout', wide ? 'wide' : 'compact');
    set(el['am-notes'], 'transform', `translate(${wide ? G.notes.wideX : G.notes.compactX} ${wide ? G.notes.wideY : G.notes.compactY})`);
  }
  // Observe the same movable view's containing block, not a viewport breakpoint: reader and explore can have
  // different column widths. Recomposition changes notes only; it cannot change the model or mechanical geometry.
  const host = view.parentElement;
  const win = root.ownerDocument && root.ownerDocument.defaultView;
  const Observer = win && win.ResizeObserver;
  const observer = Observer ? new Observer((entries) => {
    const entry = entries.find((item) => item.target === host);
    if (entry) layout(entry.contentRect.width);
  }) : null;
  if (host && host.getBoundingClientRect) layout(host.getBoundingClientRect().width);
  if (observer && host) observer.observe(host);

  return {
    render(snapshot, options = {}) {
      if (disposed) return;
      // Fail closed on invalid model geometry instead of clamping and hiding a science/API regression.
      const fields = ['capsuleExpansion', 'dialFraction', 'settingPressureHpa', 'referenceFactor', 'referenceOffsetM'];
      for (const field of fields) {
        if (!Number.isFinite(snapshot[field])) throw new Error(`altimeter renderer: nonfinite ${field}`);
      }
      if (snapshot.capsuleExpansion < 0 || snapshot.capsuleExpansion > 1) throw new Error('altimeter renderer: capsuleExpansion outside 0…1');
      set(view, 'data-am-focus', focusKeys.includes(options.focus) ? options.focus : 'all');
      set(view, 'data-am-reduced-motion', options.reducedMotion ? 'true' : 'false');
      const c = G.capsule;
      const top = c.baseY - c.minThickness - c.travel * snapshot.capsuleExpansion;
      const bottom = c.baseY;
      const x = c.x;
      const right = x + c.width;
      set(el['am-capsule'], 'd', `M${x + 4} ${num(top)}H${right - 4}Q${right} ${num(top)} ${right} ${num(top + 4)}V${bottom - 4}Q${right} ${bottom} ${right - 4} ${bottom}H${x + 4}Q${x} ${bottom} ${x} ${bottom - 4}V${num(top + 4)}Q${x} ${num(top)} ${x + 4} ${num(top)}Z`);
      const y1 = top + (bottom - top) / 3;
      const y2 = top + 2 * (bottom - top) / 3;
      set(el['am-corrugation'], 'd', `M${x + 3} ${num(y1)}Q${c.anchorX} ${num(y1 - 2)} ${right - 3} ${num(y1)}M${x + 3} ${num(y2)}Q${c.anchorX} ${num(y2 + 2)} ${right - 3} ${num(y2)}`);
      const py = top - c.stem;
      set(el['am-stem'], 'd', `M${c.anchorX} ${num(top)}V${num(py)}H${c.pinX}`);
      set(el['am-input-pin'], 'cy', num(py));
      const leverAngle = Math.atan2(py - G.lever.y, c.pinX - G.lever.x) * 180 / Math.PI;
      set(el['am-lever'], 'transform', transform(G.lever.x, G.lever.y, leverAngle));
      // Cam outline is an openly stylized transfer stage, NOT an encoded ISA formula or a circular gear ratio.
      // Capsule drives its input; Ps adjusts the stage. Output H is already derived by the model.
      const camAngle = leverAngle + 115 + (snapshot.settingPressureHpa - 1013.25) * 0.5;
      set(el['am-cam'], 'transform', transform(G.sector.x, G.sector.y, camAngle));
      const theta = G.dial.startDeg + G.dial.sweepDeg * snapshot.dialFraction;
      const sectorAngle = -theta * G.pinion.radius / G.sector.radius;
      set(el['am-sector'], 'transform', transform(G.sector.x, G.sector.y, sectorAngle));
      // One group is the rigid pinion shaft AND needle. Ps cannot produce a disconnected pointer angle.
      set(el['am-pinion-needle'], 'transform', transform(G.pinion.x, G.pinion.y, theta));
      set(el['am-knob'], 'transform', `rotate(${num((snapshot.settingPressureHpa - 1013.25) * 4)} 52 433)`);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (observer) observer.disconnect();
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
  slug: "barometric-altimeter",
  descriptor: {"title":"Đồng hồ đo độ cao quay kim bằng cách nào?","controls":{"groups":[{"key":"atmosphere","label":"Khí quyển mô hình","controls":[{"type":"range","key":"altitude","label":"Độ cao mô hình","min":0,"max":3000,"step":1,"unit":"m"},{"type":"range","key":"basePressure","label":"Áp suất gốc mô hình","min":980,"max":1040,"step":0.25,"unit":"hPa"}]},{"key":"instrument","label":"Đồng hồ và chuyển động","controls":[{"type":"range","key":"settingPressure","label":"Áp suất chuẩn đang đặt","min":980,"max":1040,"step":0.25,"unit":"hPa"},{"type":"range","key":"targetAltitude","label":"Đích khi chạy","min":0,"max":3000,"step":1,"unit":"m"}]}],"presets":[{"key":"default","label":"Mặc định: hai áp suất bằng nhau"},{"key":"wrong-setting","label":"Đặt chuẩn thấp: kim chỉ thấp"},{"key":"low-pressure","label":"Áp suất gốc thấp: kim chỉ cao"},{"key":"high-setting","label":"Đặt chuẩn cao: hộp màng không đổi"},{"key":"below-zero","label":"Số chỉ âm: kim không quay vòng"}],"challenges":[{"key":"correct-reference","label":"Từ Đặt chuẩn thấp, chỉnh chuẩn về 1013,25 hPa; hộp màng giữ nguyên, sai lệch ≤ 1 m."},{"key":"weather-change","label":"Từ Mặc định, giữ độ cao và chuẩn; hạ áp suất gốc tới 990 hPa, quan sát hộp màng giãn và số chỉ tăng ≥ 150 m."},{"key":"setting-only","label":"Từ Mặc định, giữ độ cao và áp suất gốc; tăng chuẩn tới 1030 hPa, số chỉ tăng ≥ 130 m nhưng hộp màng giữ nguyên."},{"key":"correct-after-weather","label":"Sau thử thách áp suất gốc thấp, giữ độ cao và áp suất gốc 990 hPa; chỉnh chuẩn về 990 hPa để sai lệch ≤ 1 m."}]}},
  data: {"version":1,"constants":{"T0":288.15,"L":0.0065,"g0":9.80665,"Rd":287.05,"P0":1013.25},"ranges":{"altitude":{"min":0,"max":3000,"step":1},"targetAltitude":{"min":0,"max":3000,"step":1},"basePressure":{"min":980,"max":1040,"step":0.25},"settingPressure":{"min":980,"max":1040,"step":0.25}},"defaults":{"altitude":1000,"targetAltitude":1500,"basePressure":1013.25,"settingPressure":1013.25},"trajectory":{"speedMps":5,"stepSeconds":20},"controls":{"groups":[{"key":"atmosphere","label":"Khí quyển mô hình","controls":[{"type":"range","key":"altitude","label":"Độ cao mô hình","min":0,"max":3000,"step":1,"unit":"m"},{"type":"range","key":"basePressure","label":"Áp suất gốc mô hình","min":980,"max":1040,"step":0.25,"unit":"hPa"}]},{"key":"instrument","label":"Đồng hồ và chuyển động","controls":[{"type":"range","key":"settingPressure","label":"Áp suất chuẩn đang đặt","min":980,"max":1040,"step":0.25,"unit":"hPa"},{"type":"range","key":"targetAltitude","label":"Đích khi chạy","min":0,"max":3000,"step":1,"unit":"m"}]}],"presets":[{"key":"default","label":"Mặc định: hai áp suất bằng nhau","values":{"altitude":1000,"targetAltitude":1500,"basePressure":1013.25,"settingPressure":1013.25}},{"key":"wrong-setting","label":"Đặt chuẩn thấp: kim chỉ thấp","values":{"altitude":1000,"targetAltitude":1500,"basePressure":1013.25,"settingPressure":1000}},{"key":"low-pressure","label":"Áp suất gốc thấp: kim chỉ cao","values":{"altitude":1000,"targetAltitude":1500,"basePressure":990,"settingPressure":1013.25}},{"key":"high-setting","label":"Đặt chuẩn cao: hộp màng không đổi","values":{"altitude":1000,"targetAltitude":1500,"basePressure":1013.25,"settingPressure":1030}},{"key":"below-zero","label":"Số chỉ âm: kim không quay vòng","values":{"altitude":0,"targetAltitude":500,"basePressure":1040,"settingPressure":980}}],"challenges":[{"key":"correct-reference","label":"Từ Đặt chuẩn thấp, chỉnh chuẩn về 1013,25 hPa; hộp màng giữ nguyên, sai lệch ≤ 1 m."},{"key":"weather-change","label":"Từ Mặc định, giữ độ cao và chuẩn; hạ áp suất gốc tới 990 hPa, quan sát hộp màng giãn và số chỉ tăng ≥ 150 m."},{"key":"setting-only","label":"Từ Mặc định, giữ độ cao và áp suất gốc; tăng chuẩn tới 1030 hPa, số chỉ tăng ≥ 130 m nhưng hộp màng giữ nguyên."},{"key":"correct-after-weather","label":"Sau thử thách áp suất gốc thấp, giữ độ cao và áp suất gốc 990 hPa; chỉnh chuẩn về 990 hPa để sai lệch ≤ 1 m."}]},"scene":{"compactWidth":340,"compactHeight":842,"wideWidth":700,"wideHeight":570,"breakpoint":640,"capsule":{"x":36,"width":88,"baseY":220,"minThickness":12,"travel":30,"anchorX":80,"pinX":130,"stem":12},"lever":{"x":152,"y":335,"length":180,"slotStart":132,"slotEnd":176},"sector":{"x":152,"y":335,"radius":36,"equivalentTeeth":36},"pinion":{"x":200,"y":335,"radius":12,"teeth":12},"dial":{"x":200,"y":335,"radius":109,"tickRadius":96,"labelRadius":112,"min":-600,"max":3600,"startDeg":-135,"sweepDeg":270},"notes":{"compactX":0,"compactY":546,"wideX":365,"wideY":62}}},
  createModel: createModel,
  mountRenderer: mountRenderer
}, document);
})();
