/* Universe map: posts as labelled stars on the galaxy's arms. */
import * as THREE from 'three';
import { GalaxyEngine, webglAvailable } from './galaxy/engine';
import { armPoint, rng } from './galaxy/model';

type Star = { id: string; t: string; h: string; c: string; d: string; s: string; g: string[]; m: number };
const raw = JSON.parse(document.querySelector('[data-stars]')?.textContent || '{"posts":[],"colors":{}}');
const posts: Star[] = raw.posts;
const colors: Record<string, string> = raw.colors;
const ARM: Record<string, number> = { learning: 0, writeup: 1, project: 2, life: 3 };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('[data-galaxy]')!;
const layer = document.querySelector<HTMLElement>('[data-markers]')!;
const card = document.querySelector<HTMLElement>('[data-card]')!;
const list = document.querySelector<HTMLElement>('[data-list]')!;
const listToggle = document.querySelector<HTMLButtonElement>('[data-list-toggle]')!;

/* Lay each topic along its own arm, oldest nearest the core. */
const byCat = new Map<string, Star[]>();
for (const p of posts) byCat.set(p.c, [...(byCat.get(p.c) || []), p]);
const positions = new Map<string, THREE.Vector3>();
for (const [cat, items] of byCat) {
  const sorted = [...items].sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
  const R = rng(cat.length * 97 + 3);
  sorted.forEach((p, i) => {
    const r = 13 + (sorted.length === 1 ? 0.5 : i / (sorted.length - 1)) * 33;
    const [x, y, z] = armPoint(ARM[cat] ?? 0, r, (R.next() - 0.5) * 3, (R.next() - 0.5) * 0.6);
    positions.set(p.id, new THREE.Vector3(x, y, z));
  });
}

/* Markers */
const markers = posts.map((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'star-marker';
  b.style.setProperty('--c', colors[p.c] || '#fff');
  b.setAttribute('aria-label', p.t);
  const label = document.createElement('span');
  label.className = 'star-label';
  label.textContent = p.t;
  b.append(label);
  b.addEventListener('click', () => select(p));
  layer.append(b);
  return { p, b, pos: positions.get(p.id)! };
});

const hidden = new Set<string>();
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.filter!;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    on ? hidden.delete(k) : hidden.add(k);
  });
});

let engine: GalaxyEngine | null = null;
let current: Star | null = null;

function select(p: Star | null) {
  current = p;
  markers.forEach((m) => m.b.toggleAttribute('data-selected', m.p === p));
  if (!p) {
    card.hidden = true;
    engine?.focus(null);
    return;
  }
  const cat = card.querySelector<HTMLElement>('[data-card-cat]')!;
  cat.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'dot size-1.5';
  dot.style.color = colors[p.c];
  cat.append(dot, document.createTextNode(p.c));
  cat.style.color = colors[p.c];
  card.querySelector('[data-card-title]')!.textContent = p.t;
  card.querySelector('[data-card-summary]')!.textContent = p.s;
  card.querySelector('[data-card-meta]')!.textContent = `${p.d} · ${p.m} min${p.g.length ? ' · #' + p.g.slice(0, 3).join(' #') : ''}`;
  card.querySelector<HTMLAnchorElement>('[data-card-link]')!.href = p.h;
  card.hidden = false;
  engine?.focus(positions.get(p.id)!, 24);
}
card.querySelector('[data-card-close]')?.addEventListener('click', () => select(null));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current && !list.offsetParent) select(null);
});

function setList(open: boolean) {
  list.style.display = open ? 'block' : '';
  listToggle.setAttribute('aria-expanded', String(open));
  if (open) list.querySelector<HTMLElement>('a')?.focus();
}
listToggle.addEventListener('click', () => setList(listToggle.getAttribute('aria-expanded') !== 'true'));
document.querySelector('[data-list-close]')?.addEventListener('click', () => {
  setList(false);
  listToggle.focus();
});

if (!webglAvailable()) {
  setList(true);
} else {
  const tmp = new THREE.Vector3();
  engine = new GalaxyEngine(canvas, {
    poses: [{ target: [0, 0, 0], dist: 105, azimuth: 0.3, elevation: 0.95 }],
    reducedMotion: reduced,
    interactive: true,
    zoom: true,
    spin: 0.004,
    onFrame: (e) => {
      for (const m of markers) {
        const s = e.project(m.pos, tmp);
        const show = s.visible && !hidden.has(m.p.c);
        m.b.style.display = show ? '' : 'none';
        if (!show) continue;
        const near = Math.max(0, Math.min(1, 1 - (s.depth - 20) / 140));
        m.b.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) scale(${0.75 + near * 0.5})`;
        m.b.style.zIndex = String(1000 - Math.round(s.depth));
      }
    },
  });
  canvas.style.opacity = '1';
  engine.start();
  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const z = b.dataset.zoom;
      if (z === 'in') engine!.zoomBy(0.75);
      else if (z === 'out') engine!.zoomBy(1.33);
      else {
        engine!.resetView();
        select(null);
      }
    }),
  );
  // Deep link: /universe.html#ctf/writeup-x
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const target = posts.find((p) => p.id === fromHash);
  if (target) setTimeout(() => select(target), 600);
}
