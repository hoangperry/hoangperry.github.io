/* aviation-hero.js — Attitude Indicator (PFD) hero for the aviation world.
 *
 * Renders a glass-cockpit artificial horizon into <canvas id="adi-canvas">:
 *   - sky/ground split with a pitch ladder
 *   - roll/bank arc with a sky pointer
 *   - a fixed aircraft reference symbol
 *   - flanking airspeed + altitude tapes and a heading tape (EFIS style)
 * It idles with a slow, calm pitch/roll drift so it feels alive but never busy.
 *
 * Engineering guards:
 *   - pixel-ratio capped at min(dpr, 2)
 *   - one rAF loop; paused when offscreen (IntersectionObserver) and when
 *     document.hidden
 *   - prefers-reduced-motion => a single static level frame, no loop
 *   - try/catch fail-silent, no leaked globals (IIFE)
 *
 * Loaded only by _pages/aviation.html via a <script> tag (not globally).
 */
(function () {
  "use strict";

  try {
    var canvas = document.getElementById("adi-canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- EFIS palette: read theme custom properties, with safe fallbacks ---
    var cs = window.getComputedStyle(document.documentElement);
    function tok(name, fallback) {
      var v = cs.getPropertyValue(name);
      return v && v.trim() ? v.trim() : fallback;
    }
    var COL = {
      sky: tok("--efis-sky", "oklch(62% 0.13 235)"),
      ground: tok("--efis-ground", "oklch(48% 0.09 65)"),
      cyan: tok("--phosphor", "oklch(83% 0.145 210)"),
      amber: tok("--amber", "oklch(84% 0.155 80)"),
      course: tok("--course", "oklch(72% 0.2 330)"),
      line: "oklch(98% 0.01 220)",
      glassRim: "oklch(10% 0.02 255 / 0.55)"
    };

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var size = 0; // CSS px (square)

    function resize() {
      var rect = canvas.getBoundingClientRect();
      size = Math.max(120, Math.min(rect.width, rect.height) || rect.width || 320);
      canvas.width = Math.round(size * DPR);
      canvas.height = Math.round(size * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // --- drawing helpers -------------------------------------------------
    function clear() {
      ctx.clearRect(0, 0, size, size);
    }

    // The instrument is a circle of radius R centred in the canvas.
    function drawADI(pitchDeg, rollDeg) {
      var cx = size / 2;
      var cy = size / 2;
      var R = size * 0.42; // instrument radius
      var pxPerDeg = R / 28; // pitch scale

      ctx.save();
      // clip to the round instrument face
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // rotate+translate the horizon ball for roll and pitch
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-rollDeg * Math.PI) / 180);
      ctx.translate(0, pitchDeg * pxPerDeg);

      // sky + ground (drawn large to cover under rotation)
      var span = R * 3;
      ctx.fillStyle = COL.sky;
      ctx.fillRect(-span, -span, span * 2, span);
      ctx.fillStyle = COL.ground;
      ctx.fillRect(-span, 0, span * 2, span);

      // horizon line
      ctx.strokeStyle = COL.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-span, 0);
      ctx.lineTo(span, 0);
      ctx.stroke();

      // pitch ladder: rungs every 10deg, +/- 30
      ctx.lineWidth = 1.5;
      ctx.font = (R * 0.1).toFixed(0) + "px 'Chakra Petch', monospace";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COL.line;
      for (var d = -30; d <= 30; d += 10) {
        if (d === 0) continue;
        var y = -d * pxPerDeg;
        var halfW = R * 0.26;
        ctx.beginPath();
        ctx.moveTo(-halfW, y);
        ctx.lineTo(halfW, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(String(Math.abs(d)), -halfW - 6, y);
        ctx.textAlign = "left";
        ctx.fillText(String(Math.abs(d)), halfW + 6, y);
      }
      ctx.restore(); // end horizon-ball transform

      ctx.restore(); // end clip

      // --- roll arc + tick marks (fixed to the bezel) ---
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = COL.line;
      ctx.fillStyle = COL.line;
      ctx.lineWidth = 1.5;
      var marks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
      for (var i = 0; i < marks.length; i++) {
        var a = ((marks[i] - 90) * Math.PI) / 180; // 0deg at top
        var inner = marks[i] % 30 === 0 ? R * 0.86 : R * 0.91;
        var outer = R * 0.97;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
      // roll pointer (rotates with bank), at the top
      ctx.rotate((-rollDeg * Math.PI) / 180);
      ctx.fillStyle = COL.cyan;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.84);
      ctx.lineTo(-R * 0.05, -R * 0.74);
      ctx.lineTo(R * 0.05, -R * 0.74);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- fixed aircraft reference symbol ---
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = COL.amber;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      var w = R * 0.42;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.lineTo(-w * 0.32, 0);
      ctx.lineTo(-w * 0.32, R * 0.07);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.32, 0);
      ctx.lineTo(w * 0.32, R * 0.07);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = COL.amber;
      ctx.fill();
      ctx.restore();

      // --- bezel ring + soft glass rim ---
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.cyan;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Flanking tapes (airspeed left, altitude right) + heading strip bottom.
    function drawTapes(speed, alt, hdg) {
      var cx = size / 2;
      var cy = size / 2;
      var R = size * 0.42;
      ctx.save();
      ctx.font = (size * 0.034).toFixed(0) + "px 'Chakra Petch', monospace";
      ctx.textBaseline = "middle";

      // airspeed box (left of the ball)
      ctx.fillStyle = COL.glassRim;
      var bw = size * 0.13;
      var bh = size * 0.07;
      var lx = cx - R - bw * 0.55;
      ctx.fillRect(lx, cy - bh / 2, bw, bh);
      ctx.strokeStyle = COL.cyan;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx, cy - bh / 2, bw, bh);
      ctx.fillStyle = COL.cyan;
      ctx.textAlign = "center";
      ctx.fillText(String(Math.round(speed)), lx + bw / 2, cy);

      // altitude box (right of the ball)
      var rx = cx + R - bw * 0.45;
      ctx.fillStyle = COL.glassRim;
      ctx.fillRect(rx, cy - bh / 2, bw, bh);
      ctx.strokeStyle = COL.cyan;
      ctx.strokeRect(rx, cy - bh / 2, bw, bh);
      ctx.fillStyle = COL.cyan;
      ctx.fillText(String(Math.round(alt)), rx + bw / 2, cy);

      // tape labels
      ctx.font = (size * 0.025).toFixed(0) + "px 'Chakra Petch', monospace";
      ctx.fillStyle = COL.line;
      ctx.globalAlpha = 0.75;
      ctx.fillText("KT", lx + bw / 2, cy - bh * 0.85);
      ctx.fillText("FT", rx + bw / 2, cy - bh * 0.85);
      ctx.globalAlpha = 1;

      // heading readout (bottom centre)
      ctx.font = (size * 0.036).toFixed(0) + "px 'Chakra Petch', monospace";
      var hy = cy + R + size * 0.06;
      var hb = size * 0.16;
      ctx.fillStyle = COL.glassRim;
      ctx.fillRect(cx - hb / 2, hy - bh / 2, hb, bh);
      ctx.strokeStyle = COL.cyan;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - hb / 2, hy - bh / 2, hb, bh);
      var h = ((Math.round(hdg) % 360) + 360) % 360;
      var hstr = ("00" + h).slice(-3);
      ctx.fillStyle = COL.cyan;
      ctx.fillText(hstr + "°", cx, hy);
      ctx.restore();
    }

    function frame(pitch, roll, speed, alt, hdg) {
      clear();
      drawADI(pitch, roll);
      // tapes only when there's room (full-size hero)
      if (size > 220) drawTapes(speed, alt, hdg);
    }

    // --- motion loop -----------------------------------------------------
    var rafId = 0;
    var running = false;
    var visible = true;
    var t0 = null;

    function loop(ts) {
      if (!running) return;
      if (t0 === null) t0 = ts;
      var t = (ts - t0) / 1000; // seconds
      // gentle, slow oscillation — calm idle
      var pitch = Math.sin(t * 0.32) * 4 + Math.sin(t * 0.11) * 1.5;
      var roll = Math.sin(t * 0.24 + 1.1) * 7;
      var speed = 250 + Math.sin(t * 0.18) * 6;
      var alt = 34000 + Math.sin(t * 0.13) * 120;
      var hdg = 270 + Math.sin(t * 0.2) * 8;
      frame(pitch, roll, speed, alt, hdg);
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
      // single level frame for reduced motion (heading 270, level)
      resize();
      frame(0, 0, 250, 34000, 270);
    }

    // --- wire up ---------------------------------------------------------
    resize();

    if (reduceMotion) {
      staticFrame();
    } else {
      // pause when offscreen
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
      // pause when tab hidden
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
