/**
 * hero-scene.js
 *
 * A glowing, slowly rotating wireframe "recon globe" rendered behind the hero
 * headline on the landing page. Terminal / CRT surveillance aesthetic: phosphor
 * green lat/long lines, scattered surveillance markers, amber recon arcs, a
 * continuous radar sweep, data packets traveling along the arcs, pulsing
 * contacts, faint orbiting particles, and a soft glow halo — all additive so it
 * reads as a live tracking console. Sits off to the right/center-right so the
 * left-aligned hero text stays clean and readable.
 *
 * Hard constraints honored:
 *   - Loads Three.js straight from CDN as an ES module (no build step).
 *   - Transparent renderer so the site bg + CRT overlays show through.
 *   - Pixel-ratio capped at min(dpr, 2). Single rAF loop.
 *   - Subtle, damped mouse parallax (disabled on coarse/touch pointers).
 *   - Pauses the rAF loop when offscreen (IntersectionObserver) or when the
 *     tab is hidden (visibilitychange).
 *   - Respects prefers-reduced-motion: renders a single static frame only,
 *     with NO sweep / pulse / packet animation and no rAF loop.
 *   - Time-based animation (delta/clock) so pauses never cause a visual jump.
 *   - Fails silently if WebGL is unavailable or the import throws.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- Design tokens (match the site's terminal/CRT palette) -----------------
const PHOSPHOR_GREEN = 0x5fdd8f; // oklch(82% 0.15 150)
const AMBER = 0xd9a94a; // oklch(80% 0.13 75)

// --- Tunable constants -----------------------------------------------------
const GLOBE_RADIUS = 1.72; // slightly larger than before for more presence
const SPHERE_SEGMENTS = 32; // modest geometry for the wireframe sphere
const MARKER_COUNT = 120; // surveillance points scattered on the surface
const PARTICLE_COUNT = 90; // faint orbiting motes around the globe
const ARC_COUNT = 6; // recon connection arcs between markers
const PULSE_NODE_COUNT = 16; // subset of contacts that pulse (twinkle)
const PACKET_COUNT = 6; // data packets in transit (one per arc, max)

const ARC_SAMPLES = 40; // points sampled per arc path (also packet path res)

const ROTATION_SPEED = 0.035; // radians/sec base spin (slow)
const SWEEP_SPEED = 0.9; // radians/sec for the radar sweep (continuous)
const PARALLAX_STRENGTH = 0.18; // how far the camera target drifts with mouse
const PARALLAX_EASE = 0.045; // lerp factor toward the parallax target
const MAX_PIXEL_RATIO = 2;

// Globe pushed to the right and slightly down so it clears the headline.
// Pulled in a touch from the old 2.1 so its bright mass sits center-right,
// but still well clear of the left-aligned headline.
const GLOBE_OFFSET_X = 1.95;
const GLOBE_OFFSET_Y = -0.3;

/**
 * Generate a point on a unit sphere from a random sample, returned as a
 * THREE.Vector3 scaled to `radius` (uniform spherical distribution).
 */
function pointOnSphere(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta)
  );
}

/**
 * Build a small, soft, radial "glow dot" texture once and reuse it for the
 * pulsing contacts and the back glow halo. Returns a THREE.CanvasTexture.
 */
function makeGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build the radar sweep: a flat fan of triangles in the equatorial plane whose
 * opacity fades from a bright leading edge to a transparent trailing edge, like
 * a sonar/radar wedge. Additive blending makes the leading edge glow. The whole
 * mesh is spun continuously in the animation loop.
 */
function buildRadarSweep(radius) {
  const wedgeSegments = 36; // resolution of the trailing fade
  const wedgeArc = Math.PI * 0.55; // angular width of the visible wedge
  // Center vertex + one vertex per segment edge along the arc.
  const vertexCount = wedgeSegments + 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3); // store fade in alpha-ish

  // Center.
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;

  const cg = ((PHOSPHOR_GREEN >> 16) & 255) / 255;
  const cgG = ((PHOSPHOR_GREEN >> 8) & 255) / 255;
  const cgB = (PHOSPHOR_GREEN & 255) / 255;

  // Leading edge is at angle 0; trailing edge fades toward -wedgeArc.
  for (let i = 0; i <= wedgeSegments; i++) {
    const t = i / wedgeSegments; // 0 at leading edge, 1 at trailing edge
    const angle = -t * wedgeArc;
    const idx = (i + 1) * 3;
    positions[idx] = Math.cos(angle) * radius;
    positions[idx + 1] = 0;
    positions[idx + 2] = Math.sin(angle) * radius;
    // Fade the trailing edge by darkening the vertex color (additive => dimmer).
    const fade = Math.pow(1 - t, 1.6);
    colors[idx] = cg * fade;
    colors[idx + 1] = cgG * fade;
    colors[idx + 2] = cgB * fade;
  }
  // Center vertex carries the brightest tint (near the leading edge it's hot).
  colors[0] = cg * 0.65;
  colors[1] = cgG * 0.65;
  colors[2] = cgB * 0.65;

  // Triangle fan indices.
  const indices = [];
  for (let i = 1; i <= wedgeSegments; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, disposables: [geo, mat] };
}

/**
 * Build the wireframe globe group: lat/long sphere lines, structural rings,
 * markers, arcs, pulsing contacts, the radar sweep, and a soft glow halo.
 * Also returns animation handles the loop needs to drive (sweep, packets,
 * pulse nodes) and the disposable resources it owns.
 */
function buildGlobe(glowTexture) {
  const group = new THREE.Group();
  const disposables = [];

  // 1) Wireframe sphere (latitude / longitude lines) — brighter than before.
  const sphereGeo = new THREE.SphereGeometry(
    GLOBE_RADIUS,
    SPHERE_SEGMENTS,
    SPHERE_SEGMENTS
  );
  const wireGeo = new THREE.WireframeGeometry(sphereGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.22, // up from 0.12 — lat/long grid now clearly present
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  group.add(wireframe);
  disposables.push(sphereGeo, wireGeo, wireMat);

  // 2) Structural rings (equator + 2 meridians) — clearly visible now.
  const ringMat = new THREE.LineBasicMaterial({
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.45, // up from 0.22
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(ringMat);
  const ringSegments = 64;
  for (let r = 0; r < 3; r++) {
    const positions = new Float32Array((ringSegments + 1) * 3);
    for (let i = 0; i <= ringSegments; i++) {
      const a = (i / ringSegments) * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * GLOBE_RADIUS;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(a) * GLOBE_RADIUS;
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const ring = new THREE.Line(ringGeo, ringMat);
    // Tilt each ring to a different plane (equator + 2 meridians).
    if (r === 1) ring.rotation.x = Math.PI / 2;
    if (r === 2) ring.rotation.z = Math.PI / 2;
    group.add(ring);
    disposables.push(ringGeo);
  }

  // 3) Surveillance markers (small glowing points on the surface).
  const markerPositions = new Float32Array(MARKER_COUNT * 3);
  const surfacePoints = [];
  for (let i = 0; i < MARKER_COUNT; i++) {
    const p = pointOnSphere(GLOBE_RADIUS * 1.005);
    surfacePoints.push(p);
    markerPositions[i * 3] = p.x;
    markerPositions[i * 3 + 1] = p.y;
    markerPositions[i * 3 + 2] = p.z;
  }
  const markerGeo = new THREE.BufferGeometry();
  markerGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(markerPositions, 3)
  );
  const markerMat = new THREE.PointsMaterial({
    color: PHOSPHOR_GREEN,
    size: 0.038,
    transparent: true,
    opacity: 0.8, // up from 0.55 — contacts read clearly
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const markers = new THREE.Points(markerGeo, markerMat);
  group.add(markers);
  disposables.push(markerGeo, markerMat);

  // 4) Pulsing contacts: a subset of surface points rendered as soft additive
  //    sprites. PointsMaterial can't pulse points individually without a custom
  //    shader, so we use a handful of lightweight Sprites — each gets its own
  //    phase so the globe twinkles like live, active contacts. 16 sprites is
  //    trivial for 60fps.
  const pulseNodes = [];
  const pulseMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(pulseMat);
  for (let i = 0; i < PULSE_NODE_COUNT; i++) {
    const src = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
    if (!src) continue;
    const sprite = new THREE.Sprite(pulseMat);
    sprite.position.copy(src).multiplyScalar(1.01);
    sprite.scale.setScalar(0.12);
    group.add(sprite);
    pulseNodes.push({
      sprite,
      phase: Math.random() * Math.PI * 2,
      speed: 1.4 + Math.random() * 1.4, // staggered pulse rates
      baseScale: 0.1 + Math.random() * 0.06,
    });
  }

  // 5) Recon arcs: amber lines connecting random marker pairs, bowed outward
  //    from the surface to read as flight/comms paths. We keep each arc's
  //    sampled path so data packets can travel along it.
  const arcMat = new THREE.LineBasicMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.4, // up from 0.28
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(arcMat);
  const arcPaths = []; // array of Vector3[] for packet travel
  for (let i = 0; i < ARC_COUNT; i++) {
    const a = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
    const b = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
    if (!a || !b || a === b) continue;
    // Midpoint pushed outward to create an arc.
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(GLOBE_RADIUS * 1.45);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(ARC_SAMPLES);
    arcPaths.push(pts);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const arc = new THREE.Line(arcGeo, arcMat);
    group.add(arc);
    disposables.push(arcGeo);
  }

  // 6) Data packets: bright dots that travel ALONG the arcs (packets in
  //    transit). Each gets a staggered start and a slightly different speed so
  //    the console feels busy. Phosphor + amber mix.
  const packets = [];
  const packetCount = Math.min(PACKET_COUNT, arcPaths.length);
  const packetMatGreen = new THREE.SpriteMaterial({
    map: glowTexture,
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const packetMatAmber = new THREE.SpriteMaterial({
    map: glowTexture,
    color: AMBER,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(packetMatGreen, packetMatAmber);
  for (let i = 0; i < packetCount; i++) {
    const sprite = new THREE.Sprite(i % 2 === 0 ? packetMatGreen : packetMatAmber);
    sprite.scale.setScalar(0.11);
    group.add(sprite);
    packets.push({
      sprite,
      path: arcPaths[i],
      t: Math.random(), // staggered start position along the arc
      speed: 0.25 + Math.random() * 0.22, // fraction of arc per second
    });
  }

  // 7) Radar sweep in the equatorial plane.
  const { mesh: sweep, disposables: sweepDisposables } =
    buildRadarSweep(GLOBE_RADIUS * 0.98);
  group.add(sweep);
  disposables.push(...sweepDisposables);

  // 8) Soft glow halo behind the globe so it reads as a glowing CRT object.
  //    Kept subtle so it never washes out the page.
  const haloMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // The halo must NOT spin with the globe, so it is returned for the caller to
  // add directly into scene space (position set there). Scale only here.
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(GLOBE_RADIUS * 4.1);
  disposables.push(haloMat);

  // Slight default tilt so it reads as a globe, not a flat ring stack.
  group.rotation.x = 0.42;

  return {
    group,
    halo,
    sweep,
    packets,
    pulseNodes,
    disposables,
  };
}

/**
 * Build a faint cloud of orbiting particles around the globe.
 */
function buildParticles() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Shell between 1.7x and 2.4x radius.
    const r = GLOBE_RADIUS * (1.7 + Math.random() * 0.7);
    const p = pointOnSphere(r);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: PHOSPHOR_GREEN,
    size: 0.022,
    transparent: true,
    opacity: 0.4, // up from 0.3
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  return { points, disposables: [geo, mat] };
}

/**
 * Sample a position along an arc path (array of Vector3) at parameter t in
 * [0, 1], writing the result into `out`. Linear interpolation between the two
 * nearest sampled points is plenty smooth at ARC_SAMPLES resolution.
 */
function sampleArc(path, t, out) {
  const n = path.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const frac = f - i;
  const a = path[i];
  const b = path[i + 1];
  out.set(
    a.x + (b.x - a.x) * frac,
    a.y + (b.y - a.y) * frac,
    a.z + (b.z - a.z) * frac
  );
  return out;
}

/**
 * Entry point. Wraps everything in try/catch so any failure (no WebGL,
 * CDN import problem, etc.) leaves the CRT background untouched.
 */
function initHeroScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const banner = document.getElementById('banner');
  if (!banner) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Coarse pointers (touch) get no parallax — it feels wrong and wastes work.
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch (err) {
    // WebGL unavailable — bail quietly, CRT bg still looks good.
    return;
  }

  renderer.setClearColor(0x000000, 0); // fully transparent
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42,
    1, // real aspect set in resize()
    0.1,
    100
  );
  camera.position.set(0, 0, 6.2);

  // Shared soft glow texture for sprites (pulse nodes, packets, halo).
  const glowTexture = makeGlowTexture();

  // Build content.
  const {
    group: globe,
    halo,
    sweep,
    packets,
    pulseNodes,
    disposables: globeDisposables,
  } = buildGlobe(glowTexture);
  const { points: particles, disposables: particleDisposables } =
    buildParticles();

  // Offset the whole instrument to the right so it clears the headline.
  globe.position.set(GLOBE_OFFSET_X, GLOBE_OFFSET_Y, 0);
  particles.position.set(GLOBE_OFFSET_X, GLOBE_OFFSET_Y, 0);

  // Halo lives in scene space (does NOT spin with the globe), positioned at the
  // same offset and slightly behind so it reads as the globe's own glow.
  halo.position.set(GLOBE_OFFSET_X, GLOBE_OFFSET_Y, -GLOBE_RADIUS * 0.6);

  scene.add(halo); // behind everything
  scene.add(globe);
  scene.add(particles);

  const allDisposables = [
    ...globeDisposables,
    ...particleDisposables,
    glowTexture,
  ];

  // --- Resize handling -----------------------------------------------------
  function resize() {
    const w = banner.clientWidth || window.innerWidth;
    const h = banner.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  // --- Parallax target (damped) -------------------------------------------
  const parallaxTarget = { x: 0, y: 0 };
  const parallaxCurrent = { x: 0, y: 0 };

  function onPointerMove(event) {
    // Normalize to [-1, 1] relative to viewport center.
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;
    parallaxTarget.x = nx * PARALLAX_STRENGTH;
    parallaxTarget.y = -ny * PARALLAX_STRENGTH;
  }

  // --- Animation loop ------------------------------------------------------
  let rafId = null;
  let lastTime = performance.now();
  let isVisible = true;
  let elapsed = 0; // accumulated animation time (drives pulse phases)

  // Scratch vector reused for packet sampling (no per-frame allocations).
  const scratch = new THREE.Vector3();

  function renderFrame() {
    renderer.render(scene, camera);
  }

  /**
   * Advance all time-based animation by `delta` seconds. Split out so the
   * static (reduced-motion) path can position everything to a pleasing pose
   * without ever starting a loop.
   */
  function updateScene(delta) {
    elapsed += delta;

    // Slow base rotation of the globe + counter-drift of particles.
    globe.rotation.y += ROTATION_SPEED * delta;
    particles.rotation.y -= ROTATION_SPEED * 0.6 * delta;

    // Radar sweep: continuous spin in the equatorial plane.
    sweep.rotation.y += SWEEP_SPEED * delta;

    // Pulsing contacts: each twinkles in scale + opacity on its own phase.
    for (const node of pulseNodes) {
      const s = Math.sin(elapsed * node.speed + node.phase);
      const pulse = 0.5 + 0.5 * s; // 0..1
      node.sprite.scale.setScalar(node.baseScale * (0.7 + 0.9 * pulse));
    }

    // Data packets: travel along their arc paths, looping with stagger.
    for (const pkt of packets) {
      pkt.t += pkt.speed * delta;
      if (pkt.t > 1) pkt.t -= 1;
      sampleArc(pkt.path, pkt.t, scratch);
      pkt.sprite.position.copy(scratch);
    }
  }

  function animate(now) {
    rafId = requestAnimationFrame(animate);

    const delta = Math.min((now - lastTime) / 1000, 0.05); // clamp big gaps
    lastTime = now;

    updateScene(delta);

    // Damped parallax: ease camera toward the target offset.
    parallaxCurrent.x += (parallaxTarget.x - parallaxCurrent.x) * PARALLAX_EASE;
    parallaxCurrent.y += (parallaxTarget.y - parallaxCurrent.y) * PARALLAX_EASE;
    camera.position.x = parallaxCurrent.x;
    camera.position.y = parallaxCurrent.y;
    camera.lookAt(GLOBE_OFFSET_X * 0.5, GLOBE_OFFSET_Y * 0.5, 0);

    renderFrame();
  }

  function startLoop() {
    if (rafId !== null) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(animate);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // --- Reduced motion: single static frame, no loop, no listeners ----------
  if (prefersReducedMotion) {
    // Pose the dynamic elements once so the still frame looks intentional:
    // sweep at a nice angle, packets distributed along their arcs, contacts
    // at a healthy mid-pulse. No animation is ever scheduled.
    sweep.rotation.y = -0.6;
    for (const pkt of packets) {
      sampleArc(pkt.path, pkt.t, scratch);
      pkt.sprite.position.copy(scratch);
    }
    for (const node of pulseNodes) {
      node.sprite.scale.setScalar(node.baseScale * 1.05);
    }
    camera.lookAt(GLOBE_OFFSET_X * 0.5, GLOBE_OFFSET_Y * 0.5, 0);
    renderFrame();
    // Still keep the frame correct on resize (cheap, no animation).
    window.addEventListener('resize', () => {
      resize();
      renderFrame();
    });
    return;
  }

  // --- Pause when offscreen ------------------------------------------------
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
          if (isVisible && !document.hidden) startLoop();
          else stopLoop();
        }
      },
      { threshold: 0 }
    );
    observer.observe(banner);
  }

  // --- Pause when the tab is hidden ---------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (isVisible) startLoop();
  });

  // --- Wire up listeners ---------------------------------------------------
  window.addEventListener('resize', resize, { passive: true });
  if (!isCoarsePointer) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  // Kick off.
  startLoop();
}

// Run after DOM is ready. Module scripts are deferred by default, so the
// #banner / #hero-canvas elements already exist, but guard anyway.
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroScene, { once: true });
  } else {
    initHeroScene();
  }
} catch (err) {
  // Fail silently — the CRT background stands on its own.
}
