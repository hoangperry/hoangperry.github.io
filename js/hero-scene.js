/**
 * hero-scene.js
 *
 * A faint, slowly rotating wireframe "recon globe" rendered behind the hero
 * headline on the landing page. Terminal / CRT aesthetic: phosphor-green
 * lat/long lines, scattered surveillance markers, faint orbiting particles,
 * additive glow. Sits off to the right so the hero text stays readable.
 *
 * Hard constraints honored:
 *   - Loads Three.js straight from CDN as an ES module (no build step).
 *   - Transparent renderer so the site bg + CRT overlays show through.
 *   - Subtle, damped mouse parallax (disabled on coarse/touch pointers).
 *   - Pauses the rAF loop when offscreen (IntersectionObserver) or when the
 *     tab is hidden (visibilitychange).
 *   - Respects prefers-reduced-motion: renders a single static frame only.
 *   - Fails silently if WebGL is unavailable or the import throws.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- Design tokens (match the site's terminal/CRT palette) -----------------
const PHOSPHOR_GREEN = 0x5fdd8f; // oklch(82% 0.15 150)
const AMBER = 0xd9a94a; // oklch(80% 0.13 75)

// --- Tunable constants -----------------------------------------------------
const GLOBE_RADIUS = 1.6;
const SPHERE_SEGMENTS = 32; // modest geometry for the wireframe sphere
const MARKER_COUNT = 120; // surveillance points scattered on the surface
const PARTICLE_COUNT = 90; // faint orbiting motes around the globe
const ARC_COUNT = 5; // recon connection arcs between markers

const ROTATION_SPEED = 0.035; // radians/sec base spin (slow)
const PARALLAX_STRENGTH = 0.18; // how far the camera target drifts with mouse
const PARALLAX_EASE = 0.045; // lerp factor toward the parallax target
const MAX_PIXEL_RATIO = 2;

// Globe pushed to the right and slightly down so it clears the headline.
const GLOBE_OFFSET_X = 2.1;
const GLOBE_OFFSET_Y = -0.35;

/**
 * Generate a point on a unit sphere from a deterministic-ish random,
 * returned as a THREE.Vector3 scaled to `radius`.
 */
function pointOnSphere(radius) {
  // Uniform spherical distribution.
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
 * Build the wireframe globe group: lat/long sphere lines, markers, arcs.
 * Returns the THREE.Group plus the disposable resources it owns.
 */
function buildGlobe() {
  const group = new THREE.Group();
  const disposables = [];

  // 1) Wireframe sphere (latitude / longitude lines).
  const sphereGeo = new THREE.SphereGeometry(
    GLOBE_RADIUS,
    SPHERE_SEGMENTS,
    SPHERE_SEGMENTS
  );
  const wireGeo = new THREE.WireframeGeometry(sphereGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.12, // very faint so the headline dominates
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  group.add(wireframe);
  disposables.push(sphereGeo, wireGeo, wireMat);

  // 2) A second, brighter "equator + meridian" pair for structure.
  const ringMat = new THREE.LineBasicMaterial({
    color: PHOSPHOR_GREEN,
    transparent: true,
    opacity: 0.22,
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
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const markers = new THREE.Points(markerGeo, markerMat);
  group.add(markers);
  disposables.push(markerGeo, markerMat);

  // 4) Recon arcs: faint amber lines connecting random marker pairs,
  //    bowed outward from the surface to read as flight/comms paths.
  const arcMat = new THREE.LineBasicMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(arcMat);
  for (let i = 0; i < ARC_COUNT; i++) {
    const a = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
    const b = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
    if (!a || !b) continue;
    // Midpoint pushed outward to create an arc.
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(GLOBE_RADIUS * 1.45);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(28);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const arc = new THREE.Line(arcGeo, arcMat);
    group.add(arc);
    disposables.push(arcGeo);
  }

  // Slight default tilt so it reads as a globe, not a flat ring stack.
  group.rotation.x = 0.42;

  return { group, disposables };
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
    size: 0.02,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  return { points, disposables: [geo, mat] };
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

  // Build content.
  const { group: globe, disposables: globeDisposables } = buildGlobe();
  const { points: particles, disposables: particleDisposables } =
    buildParticles();

  // Offset the whole instrument to the right so it clears the headline.
  globe.position.set(GLOBE_OFFSET_X, GLOBE_OFFSET_Y, 0);
  particles.position.set(GLOBE_OFFSET_X, GLOBE_OFFSET_Y, 0);

  scene.add(globe);
  scene.add(particles);

  const allDisposables = [...globeDisposables, ...particleDisposables];

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

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function animate(now) {
    rafId = requestAnimationFrame(animate);

    const delta = Math.min((now - lastTime) / 1000, 0.05); // clamp big gaps
    lastTime = now;

    // Slow base rotation of the globe + counter-drift of particles.
    globe.rotation.y += ROTATION_SPEED * delta;
    particles.rotation.y -= ROTATION_SPEED * 0.6 * delta;

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
