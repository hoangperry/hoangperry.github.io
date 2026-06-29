/* electronics-hero.js — animated PCB / schematic hero for the electronics world.
 *
 * Renders a printed-circuit-board scene into <canvas id="pcb-canvas">:
 *   - a network of pads / vias connected by orthogonal copper traces
 *   - bright SIGNAL PULSES (packets) travelling along the traces
 *   - a couple of IC outlines with pin rows + a reference designator
 *   - copper-gold traces, silkscreen-white labels, hot-signal accent
 * It idles with a calm, continuous flow of signals so it feels alive
 * but never busy, and sits behind the readable hero text.
 *
 * Engineering guards (match aviation-hero.js):
 *   - pixel-ratio capped at min(dpr, 2)
 *   - one rAF loop; paused when offscreen (IntersectionObserver) and
 *     when document.hidden
 *   - prefers-reduced-motion => a single static frame, no loop
 *   - try/catch fail-silent, no leaked globals (IIFE)
 *   - debounced resize via requestAnimationFrame
 *
 * Loaded only by _pages/electronics.html via a <script> tag (not globally).
 */
(function () {
  "use strict";

  try {
    var canvas = document.getElementById("pcb-canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- PCB palette: read theme custom properties, with safe fallbacks ---
    var cs = window.getComputedStyle(document.documentElement);
    function tok(name, fallback) {
      var v = cs.getPropertyValue(name);
      return v && v.trim() ? v.trim() : fallback;
    }
    var COL = {
      board: tok("--bg", "oklch(20% 0.055 158)"),
      boardLine: tok("--line-soft", "oklch(31% 0.05 155)"),
      trace: tok("--trace", "oklch(82% 0.135 82)"),
      traceDim: tok("--phosphor-dim", "oklch(71% 0.115 80)"),
      pad: tok("--pad", "oklch(90% 0.06 95)"),
      signal: tok("--signal", "oklch(88% 0.16 88)"),
      silk: tok("--silk", "oklch(94% 0.008 150)")
    };

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0; // CSS px
    var H = 0;

    // --- the routed network (built once, scaled per-resize) ---------------
    // Nodes are placed on a normalised 0..1 grid; traces are L-shaped (one
    // elbow) so they look orthogonally routed. Signals ride the traces.
    var NODES = [
      { x: 0.08, y: 0.30 },
      { x: 0.08, y: 0.74 },
      { x: 0.30, y: 0.18 },
      { x: 0.30, y: 0.52 },
      { x: 0.30, y: 0.86 },
      { x: 0.54, y: 0.30 },
      { x: 0.54, y: 0.64 },
      { x: 0.74, y: 0.20 },
      { x: 0.74, y: 0.78 },
      { x: 0.92, y: 0.42 },
      { x: 0.92, y: 0.66 }
    ];
    // each trace: from node a to node b, elbow at corner ('h' = horizontal
    // first then vertical, 'v' = vertical first then horizontal)
    var TRACES = [
      { a: 0, b: 3, bend: "h" },
      { a: 1, b: 4, bend: "h" },
      { a: 2, b: 5, bend: "v" },
      { a: 3, b: 5, bend: "h" },
      { a: 3, b: 6, bend: "h" },
      { a: 4, b: 6, bend: "h" },
      { a: 5, b: 7, bend: "v" },
      { a: 6, b: 8, bend: "v" },
      { a: 7, b: 9, bend: "h" },
      { a: 8, b: 10, bend: "h" },
      { a: 5, b: 6, bend: "v" }
    ];
    // IC outlines (normalised): position + size + pin counts + designator
    var ICS = [
      { x: 0.44, y: 0.40, w: 0.16, h: 0.22, pins: 4, ref: "U1" },
      { x: 0.66, y: 0.46, w: 0.12, h: 0.18, pins: 3, ref: "U2" }
    ];

    // signals: which trace, current 0..1 progress, speed, phase offset
    var SIGNALS = [];
    function buildSignals() {
      SIGNALS = [];
      for (var i = 0; i < TRACES.length; i++) {
        // not every trace carries a packet at once — calmer board
        if (i % 2 === 0 || i % 3 === 0) {
          SIGNALS.push({
            trace: i,
            t: Math.random(),
            speed: 0.11 + Math.random() * 0.12,
            dir: Math.random() < 0.5 ? 1 : -1
          });
        }
      }
    }
    buildSignals();

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(160, rect.width || 480);
      H = Math.max(120, rect.height || 300);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // map normalised node -> CSS px, with an inset margin
    function px(n) {
      var m = Math.min(W, H) * 0.06;
      return {
        x: m + n.x * (W - 2 * m),
        y: m + n.y * (H - 2 * m)
      };
    }

    // elbow corner point for an L-shaped trace
    function corner(p1, p2, bend) {
      return bend === "h" ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
    }

    // position along an L-shaped trace at progress f (0..1), split evenly
    // between the two legs by their pixel length
    function alongTrace(p1, p2, c, f) {
      var l1 = Math.abs(c.x - p1.x) + Math.abs(c.y - p1.y);
      var l2 = Math.abs(p2.x - c.x) + Math.abs(p2.y - c.y);
      var total = l1 + l2 || 1;
      var d = f * total;
      if (d <= l1) {
        var k = l1 ? d / l1 : 0;
        return { x: p1.x + (c.x - p1.x) * k, y: p1.y + (c.y - p1.y) * k };
      }
      var k2 = l2 ? (d - l1) / l2 : 0;
      return { x: c.x + (p2.x - c.x) * k2, y: c.y + (p2.y - c.y) * k2 };
    }

    // --- drawing ----------------------------------------------------------
    function clear() {
      ctx.clearRect(0, 0, W, H);
    }

    function drawTraces() {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = COL.traceDim;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1.4, Math.min(W, H) * 0.006);
      for (var i = 0; i < TRACES.length; i++) {
        var tr = TRACES[i];
        var p1 = px(NODES[tr.a]);
        var p2 = px(NODES[tr.b]);
        var c = corner(p1, p2, tr.bend);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function drawPads(tPulse) {
      var r = Math.max(3, Math.min(W, H) * 0.013);
      for (var i = 0; i < NODES.length; i++) {
        var p = px(NODES[i]);
        // copper annular ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = COL.trace;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        // drilled via centre
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = COL.board;
        ctx.globalAlpha = 1;
        ctx.fill();
        // a few pads breathe with a soft glow
        if (i % 3 === 0) {
          var glow = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(tPulse + i));
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2);
          ctx.fillStyle = COL.signal;
          ctx.globalAlpha = glow * 0.25;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawICs() {
      var m = Math.min(W, H) * 0.06;
      function sx(nx) { return m + nx * (W - 2 * m); }
      function sy(ny) { return m + ny * (H - 2 * m); }
      ctx.font =
        Math.max(9, Math.min(W, H) * 0.04).toFixed(0) +
        "px 'Sometype Mono', monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (var i = 0; i < ICS.length; i++) {
        var ic = ICS[i];
        var x = sx(ic.x);
        var y = sy(ic.y);
        var w = ic.w * (W - 2 * m);
        var h = ic.h * (H - 2 * m);
        // chip body
        ctx.fillStyle = COL.boardLine;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = COL.silk;
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(x, y, w, h);
        ctx.globalAlpha = 1;
        // pin-1 notch
        ctx.beginPath();
        ctx.arc(x + w * 0.16, y + h * 0.16, Math.max(1.4, w * 0.05), 0, Math.PI * 2);
        ctx.fillStyle = COL.silk;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
        // pin rows (left + right)
        ctx.strokeStyle = COL.trace;
        ctx.lineWidth = Math.max(1.6, w * 0.06);
        var pinLen = w * 0.22;
        for (var p = 0; p < ic.pins; p++) {
          var py = y + h * ((p + 1) / (ic.pins + 1));
          ctx.beginPath();
          ctx.moveTo(x, py);
          ctx.lineTo(x - pinLen, py);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + w, py);
          ctx.lineTo(x + w + pinLen, py);
          ctx.stroke();
        }
        // silkscreen reference designator
        ctx.fillStyle = COL.silk;
        ctx.globalAlpha = 0.82;
        ctx.fillText(ic.ref, x + w / 2, y + h / 2);
        ctx.globalAlpha = 1;
      }
    }

    function drawSignals() {
      var r = Math.max(2.5, Math.min(W, H) * 0.011);
      for (var i = 0; i < SIGNALS.length; i++) {
        var s = SIGNALS[i];
        var tr = TRACES[s.trace];
        var p1 = px(NODES[tr.a]);
        var p2 = px(NODES[tr.b]);
        var c = corner(p1, p2, tr.bend);
        var f = s.dir > 0 ? s.t : 1 - s.t;
        var pt = alongTrace(p1, p2, c, f);
        // bright head
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = COL.signal;
        ctx.fill();
        // soft halo
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = COL.signal;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;
        // short trailing comet along the trace
        var trail = alongTrace(p1, p2, c, Math.max(0, Math.min(1, f - s.dir * 0.06)));
        ctx.strokeStyle = COL.signal;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = r * 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(trail.x, trail.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    function frame(t) {
      clear();
      drawTraces();
      drawICs();
      drawPads(t);
      drawSignals();
    }

    // --- motion loop ------------------------------------------------------
    var rafId = 0;
    var running = false;
    var visible = true;
    var t0 = null;
    var last = 0;

    function loop(ts) {
      if (!running) return;
      if (t0 === null) {
        t0 = ts;
        last = ts;
      }
      var dt = Math.min(0.05, (ts - last) / 1000); // clamp big gaps
      last = ts;
      var t = (ts - t0) / 1000;
      // advance signals, wrap at the ends
      for (var i = 0; i < SIGNALS.length; i++) {
        var s = SIGNALS[i];
        s.t += s.speed * dt;
        if (s.t > 1) s.t -= 1;
      }
      frame(t);
      rafId = window.requestAnimationFrame(loop);
    }

    function start() {
      if (running || reduceMotion) return;
      if (document.hidden || !visible) return;
      running = true;
      t0 = null;
      rafId = window.requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function staticFrame() {
      // single calm frame for reduced motion: signals fixed mid-trace
      resize();
      for (var i = 0; i < SIGNALS.length; i++) SIGNALS[i].t = 0.5;
      frame(0);
    }

    // --- wire up ----------------------------------------------------------
    resize();

    if (reduceMotion) {
      staticFrame();
    } else {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(
          function (entries) {
            visible = entries[0] && entries[0].isIntersecting;
            if (visible) start();
            else stop();
          },
          { threshold: 0.05 }
        );
        io.observe(canvas);
      } else {
        visible = true;
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
        else start();
      });
      start();
    }

    // responsive: re-measure on resize (debounced via rAF)
    var resizePending = false;
    window.addEventListener("resize", function () {
      if (resizePending) return;
      resizePending = true;
      window.requestAnimationFrame(function () {
        resizePending = false;
        resize();
        if (reduceMotion) staticFrame();
      });
    });
  } catch (e) {
    /* fail silent — the hero is decorative */
  }
})();
