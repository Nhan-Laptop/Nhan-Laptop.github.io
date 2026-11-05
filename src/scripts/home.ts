/* Homepage: scroll-driven flight through the galaxy. */
import Lenis from 'lenis';
import type { Pose } from './galaxy/engine';

// One camera pose per chapter (data-chapter sections, in order).
const POSES: Pose[] = [
  { target: [0, 0, 0], dist: 112, azimuth: 0.35, elevation: 0.62, shift: 0.22 }, // hello — the whole spiral
  { target: [0, 0, 0], dist: 84, azimuth: 1.1, elevation: 1.05, shift: -0.22 }, // latest — tilt toward face-on
  { target: [14, 0, 9], dist: 40, azimuth: 1.7, elevation: 0.42, shift: 0.2 }, // building — close to an arm
  { target: [0, 0, 0], dist: 30, azimuth: 2.35, elevation: 0.0, shift: 0 }, // writeups — inside the disk, the band
  { target: [0, 0, 0], dist: 22, azimuth: 3.1, elevation: 0.36, shift: -0.18 }, // learning — the bulge
  { target: [0, 0, 0], dist: 175, azimuth: 3.7, elevation: 1.28, shift: 0 }, // now — far out
];

const posterMode = new URLSearchParams(location.search).has('poster'); // scripts/render-poster.cjs
const reduced = posterMode || matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('[data-galaxy]');
const poster = document.querySelector<HTMLImageElement>('[data-poster]');
const sections = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
const rail = [...document.querySelectorAll<HTMLElement>('[data-rail]')];
const hudChapter = document.querySelector<HTMLElement>('[data-hud-chapter]');
const hudLabel = document.querySelector<HTMLElement>('[data-hud-label]');
const hudDistance = document.querySelector<HTMLElement>('[data-hud-distance]');
const hudHint = document.querySelector<HTMLElement>('[data-hud-hint]');
const labels = rail.map((r) => r.getAttribute('aria-label') || '');

/** Chapter i holds its pose for most of its height, then eases into i+1 near the end. */
function scrollProgress(): number {
  const mid = innerHeight * 0.55;
  let p = 0;
  for (let i = 0; i < sections.length; i++) {
    const r = sections[i].getBoundingClientRect();
    if (r.top <= mid) {
      const f = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      const t = Math.min(1, Math.max(0, (f - 0.55) / 0.45));
      p = i + (i < sections.length - 1 ? t : 0);
    }
  }
  return p;
}

let lastChapter = -1;
function updateChrome(p: number) {
  const i = Math.min(sections.length - 1, Math.round(p));
  if (i !== lastChapter) {
    lastChapter = i;
    rail.forEach((r, k) => r.toggleAttribute('data-active', k === i));
    if (hudChapter) hudChapter.textContent = String(i + 1).padStart(2, '0');
    if (hudLabel) hudLabel.textContent = labels[i] || '';
    if (hudHint) hudHint.style.opacity = i === 0 ? '1' : '0';
  }
}

async function boot() {
  if (!canvas) return;
  const { GalaxyEngine, webglAvailable } = await import('./galaxy/engine');
  if (!webglAvailable()) return; // the poster stays
  let engine: InstanceType<typeof GalaxyEngine>;
  try {
    engine = new GalaxyEngine(canvas, {
      poses: POSES,
      quality: posterMode ? 'high' : 'auto',
      preserveDrawingBuffer: posterMode,
      reducedMotion: reduced,
      interactive: true,
      spin: 0.012,
      onFrame: (e) => {
        if (hudDistance) {
          const ly = Math.round(e.camera.position.length() * 1000 / 100) * 100;
          hudDistance.textContent = ly.toLocaleString('en-US');
        }
      },
    });
  } catch (err) {
    console.warn('Galaxy unavailable, keeping the poster.', err);
    return;
  }
  engine.progress = posterMode ? Number(new URLSearchParams(location.search).get('pose') || 0) : scrollProgress();
  engine.renderOnce();
  if (posterMode) {
    for (let i = 0; i < 4; i++) engine.renderOnce();
    canvas.style.transition = 'none';
    canvas.style.opacity = '1';
    (window as any).__posterReady = true;
    return;
  }
  canvas.style.opacity = '1';
  if (poster) setTimeout(() => (poster.style.opacity = '0'), 400);

  if (reduced) {
    // No continuous animation: redraw only when the reader scrolls to a new chapter.
    let raf = 0;
    addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          engine.progress = scrollProgress();
          engine.renderOnce();
        });
      },
      { passive: true },
    );
    addEventListener('resize', () => engine.renderOnce());
    return;
  }

  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? engine.start() : engine.stop()));
  io.observe(canvas);
  engine.start();
  const tick = () => {
    engine.progress = scrollProgress();
    requestAnimationFrame(tick);
  };
  tick();
}

// Smooth, weighted scrolling makes the camera flight feel continuous.
if (!reduced) {
  const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: 0 } });
  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

const chrome = () => updateChrome(scrollProgress());
addEventListener('scroll', chrome, { passive: true });
chrome();

// Wait for first paint so the hero text animates in before the GPU work starts.
if ('requestIdleCallback' in window) (window as any).requestIdleCallback(boot, { timeout: 900 });
else setTimeout(boot, 200);
