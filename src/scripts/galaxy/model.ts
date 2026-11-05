/**
 * Procedural barred spiral galaxy, loosely modelled on the Milky Way:
 * a peanut bulge and bar, two major + two minor logarithmic arms (pitch ≈ 13°),
 * an exponential disk that flares with radius, a sparse halo with globular clusters,
 * HII regions on the arms' leading edges and dust lanes on their inner edges.
 *
 * Disk lies in the XZ plane, Y is "up". One unit ≈ 1,000 light years (radius ≈ 55).
 */

export const ARMS = [
  { base: 0, weight: 1, width: 1 }, // major
  { base: Math.PI, weight: 1, width: 1 }, // major
  { base: Math.PI * 0.5, weight: 0.5, width: 0.8 }, // minor
  { base: Math.PI * 1.5, weight: 0.5, width: 0.8 }, // minor
];
export const PITCH = Math.tan((13 * Math.PI) / 180); // b in θ = ln(r/r0)/b
export const R0 = 8.5; // arms start at the bar's ends
export const R_MAX = 56;
export const DISK_SCALE = 13;

export function armAngle(arm: number, r: number): number {
  return ARMS[arm].base + Math.log(Math.max(r, R0 * 0.6) / R0) / PITCH;
}

/** Local position on an arm at radius r, with an optional sideways offset (kly). */
export function armPoint(arm: number, r: number, side = 0, y = 0): [number, number, number] {
  const th = armAngle(arm, r);
  // Unit normal of a log spiral (pointing outward-ish): rotate the tangent by 90°.
  const tx = -Math.sin(th) + PITCH * Math.cos(th);
  const tz = Math.cos(th) + PITCH * Math.sin(th);
  const len = Math.hypot(tx, tz);
  const nx = tz / len;
  const nz = -tx / len;
  return [r * Math.cos(th) + nx * side, y, r * Math.sin(th) + nz * side];
}

/* ---------------------------------------------------------------- random */

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0;
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}

/* ---------------------------------------------------------------- colour */

/** Black-body colour (linear RGB, max component = 1) for a temperature in kelvin. */
export function kelvinToRgb(k: number): [number, number, number] {
  const t = k / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = [r, g, b].map((v) => Math.pow(Math.min(255, Math.max(0, v)) / 255, 2.2));
  const m = Math.max(c[0], c[1], c[2]) || 1;
  return [c[0] / m, c[1] / m, c[2] / m];
}

/* ---------------------------------------------------------------- buffers */

export interface PointCloud {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  brightness: Float32Array;
  seeds: Float32Array;
  count: number;
}

function cloud(n: number): PointCloud {
  return {
    positions: new Float32Array(n * 3),
    colors: new Float32Array(n * 3),
    sizes: new Float32Array(n),
    brightness: new Float32Array(n),
    seeds: new Float32Array(n),
    count: 0,
  };
}

function push(c: PointCloud, x: number, y: number, z: number, rgb: [number, number, number], size: number, bright: number, seed: number) {
  const i = c.count++;
  c.positions[i * 3] = x;
  c.positions[i * 3 + 1] = y;
  c.positions[i * 3 + 2] = z;
  c.colors[i * 3] = rgb[0];
  c.colors[i * 3 + 1] = rgb[1];
  c.colors[i * 3 + 2] = rgb[2];
  c.sizes[i] = size;
  c.brightness[i] = bright;
  c.seeds[i] = seed;
}

const BAR_ANGLE = 0; // the bar lies along local X, arms start at its ends.

export function generateStars(count: number, seed = 7): PointCloud {
  const R = rng(seed);
  const c = cloud(count);
  const temp = (lo: number, hi: number) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * R.next());
  const lum = (k = 6) => 0.12 + 0.88 * Math.pow(R.next(), k);

  const nBulge = Math.floor(count * 0.13);
  const nBar = Math.floor(count * 0.07);
  const nArms = Math.floor(count * 0.38);
  const nHalo = Math.floor(count * 0.035);
  const nDisk = count - nBulge - nBar - nArms - nHalo;

  // Bulge: old, warm, dense — r ∝ r² e^{-r/a}, flattened.
  for (let i = 0; i < nBulge; i++) {
    const r = 1.35 * -Math.log(R.next() * R.next() * R.next() + 1e-9);
    const u = R.next() * 2 - 1;
    const phi = R.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    push(c, r * s * Math.cos(phi), r * u * 0.62, r * s * Math.sin(phi), kelvinToRgb(temp(3000, 5400)), 0.15 + R.next() * 0.09, lum(5) * 0.75, R.next());
  }
  // Bar: elongated triaxial Gaussian.
  for (let i = 0; i < nBar; i++) {
    const x = R.gauss() * 4.6;
    const y = R.gauss() * 0.9;
    const z = R.gauss() * 1.55;
    const ca = Math.cos(BAR_ANGLE);
    const sa = Math.sin(BAR_ANGLE);
    push(c, x * ca - z * sa, y, x * sa + z * ca, kelvinToRgb(temp(3200, 6000)), 0.16 + R.next() * 0.1, lum(5), R.next());
  }

  // OB associations: knots of young stars along the arms.
  const knots: [number, number, number][] = [];
  for (let k = 0; k < 420; k++) {
    const arm = R.next() < 0.7 ? Math.floor(R.next() * 2) : 2 + Math.floor(R.next() * 2);
    const r = R0 + 2 + -Math.log(R.next() + 1e-9) * 13;
    if (r > R_MAX - 4) continue;
    knots.push(armPoint(arm, r, R.gauss() * (0.6 + 0.03 * r), R.gauss() * 0.15));
  }

  // Arms: young, blue-white; thin; clumpy.
  for (let i = 0; i < nArms; i++) {
    let x: number, y: number, z: number;
    if (R.next() < 0.28 && knots.length) {
      const k = knots[Math.floor(R.next() * knots.length)];
      const s = 0.25 + R.next() * 0.7;
      x = k[0] + R.gauss() * s;
      y = k[1] + R.gauss() * s * 0.35;
      z = k[2] + R.gauss() * s;
    } else {
      const pick = R.next();
      const arm = pick < 0.34 ? 0 : pick < 0.68 ? 1 : pick < 0.84 ? 2 : 3;
      let r = R0 + -Math.log(R.next() + 1e-9) * 15;
      if (r > R_MAX) r = R0 + R.next() * (R_MAX - R0);
      const w = (1.05 + 0.07 * r) * ARMS[arm].width;
      [x, y, z] = armPoint(arm, r, R.gauss() * w, R.gauss() * (0.22 + 0.006 * r));
    }
    const hot = R.next() < 0.55;
    const k = hot ? temp(7500, 30000) : temp(3800, 7500);
    push(c, x, y, z, kelvinToRgb(k), 0.13 + R.next() * 0.12, lum(hot ? 5 : 7) * (hot ? 1.45 : 1), R.next());
  }

  // Disk: exponential, flaring; a third of it hugs the arms.
  for (let i = 0; i < nDisk; i++) {
    let r = DISK_SCALE * -Math.log(R.next() * R.next() + 1e-9) + 1.5;
    while (r > R_MAX + 8) r = DISK_SCALE * -Math.log(R.next() * R.next() + 1e-9) + 1.5;
    let th = R.next() * Math.PI * 2;
    if (R.next() < 0.33 && r > R0) {
      const arm = Math.floor(R.next() * 4);
      th = armAngle(arm, r) + R.gauss() * 0.35;
    }
    const h = 0.32 * (1 + r / 28);
    push(c, r * Math.cos(th), R.gauss() * h, r * Math.sin(th), kelvinToRgb(temp(2900, 6800)), 0.12 + R.next() * 0.1, lum(8) * 0.9, R.next());
  }

  // Halo + globular clusters.
  const nGlobular = Math.floor(nHalo * 0.45);
  const clusters: [number, number, number][] = [];
  for (let g = 0; g < 70; g++) {
    const r = 10 + Math.pow(R.next(), 0.7) * 55;
    const u = R.next() * 2 - 1;
    const phi = R.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    clusters.push([r * s * Math.cos(phi), r * u * 0.8, r * s * Math.sin(phi)]);
  }
  for (let i = 0; i < nHalo; i++) {
    let x: number, y: number, z: number;
    if (i < nGlobular) {
      const g = clusters[i % clusters.length];
      const s = 0.12 + Math.abs(R.gauss()) * 0.18;
      x = g[0] + R.gauss() * s;
      y = g[1] + R.gauss() * s;
      z = g[2] + R.gauss() * s;
    } else {
      const r = 6 + Math.pow(R.next(), 0.6) * 80;
      const u = R.next() * 2 - 1;
      const phi = R.next() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = r * s * Math.cos(phi);
      y = r * u * 0.7;
      z = r * s * Math.sin(phi);
    }
    push(c, x, y, z, kelvinToRgb(temp(3200, 5600)), 0.14, lum(6) * 0.8, R.next());
  }
  return c;
}

/** HII regions: soft pink-red clouds of ionised hydrogen just outside the arm centre. */
export function generateNebulae(clumps: number, seed = 11): PointCloud {
  const R = rng(seed);
  const c = cloud(clumps * 9);
  for (let k = 0; k < clumps; k++) {
    const arm = R.next() < 0.75 ? Math.floor(R.next() * 2) : 2 + Math.floor(R.next() * 2);
    const r = R0 + 3 + R.next() * 40;
    const [cx, cy, cz] = armPoint(arm, r, 0.3 + R.gauss() * (1.0 + 0.03 * r), R.gauss() * 0.12);
    const parts = 3 + Math.floor(R.next() * 6);
    const scale = 0.4 + R.next() * 0.8;
    for (let p = 0; p < parts; p++) {
      const hue = R.next();
      const rgb: [number, number, number] = hue < 0.8 ? [1, 0.3 + R.next() * 0.1, 0.42 + R.next() * 0.12] : [0.55, 0.72, 1];
      push(c, cx + R.gauss() * scale, cy + R.gauss() * scale * 0.25, cz + R.gauss() * scale, rgb, 0.8 + R.next() * 1.6 * scale, 0.05 + R.next() * 0.11, R.next());
    }
  }
  return c;
}

/**
 * Dust: filaments that follow each arm's inner edge, feathery spurs between arms,
 * and the two straight lanes on the bar's leading edges.
 */
export function generateDust(count: number, seed = 23): PointCloud {
  const R = rng(seed);
  const c = cloud(count);
  const put = (x: number, y: number, z: number, size: number, a: number) => {
    if (c.count >= count) return;
    const tone = 0.6 + R.next() * 0.4;
    push(c, x, y, z, [0.022 * tone, 0.015 * tone, 0.011 * tone], size, a, R.next());
  };

  const lanes = Math.floor(count * 0.7);
  while (c.count < lanes) {
    // Walk along an arm's inner edge with a wandering offset — gives long filaments.
    const pick = R.next();
    const arm = pick < 0.36 ? 0 : pick < 0.72 ? 1 : pick < 0.86 ? 2 : 3;
    let r = R0 + 1 + R.next() * 40;
    let side = -(0.75 + 0.028 * r) + R.gauss() * 0.35;
    const steps = 12 + Math.floor(R.next() * 30);
    const strength = 0.16 + R.next() * 0.3;
    for (let s = 0; s < steps; s++) {
      r += 0.25 + R.next() * 0.4;
      side += R.gauss() * 0.22;
      if (r > R_MAX - 8) break;
      if (R.next() < 0.18) continue; // gaps break the lane into patches
      const [x, y, z] = armPoint(arm, r, side, R.gauss() * 0.09);
      put(x, y, z, 0.45 + R.next() * 1.1, strength * (0.3 + R.next() * 0.9));
    }
  }
  // Spurs: short dark feathers leaving the arms at ~40°.
  const spurs = count;
  while (c.count < spurs) {
    const arm = Math.floor(R.next() * 4);
    const r0 = R0 + 4 + R.next() * 36;
    const [sx, , sz] = armPoint(arm, r0, -0.6);
    const ang = Math.atan2(sz, sx) + (R.next() < 0.5 ? 0.9 : 2.2);
    const steps = 6 + Math.floor(R.next() * 10);
    let x = sx;
    let z = sz;
    for (let s = 0; s < steps; s++) {
      x += Math.cos(ang) * 0.45 + R.gauss() * 0.12;
      z += Math.sin(ang) * 0.45 + R.gauss() * 0.12;
      put(x, R.gauss() * 0.08, z, 0.4 + R.next() * 0.8, 0.1 + R.next() * 0.16);
    }
  }
  return c;
}

/** Distant field stars on a sphere around everything. */
export function generateSky(count: number, seed = 5): PointCloud {
  const R = rng(seed);
  const c = cloud(count);
  for (let i = 0; i < count; i++) {
    const u = R.next() * 2 - 1;
    const phi = R.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 700;
    const k = Math.exp(Math.log(2800) + (Math.log(16000) - Math.log(2800)) * R.next());
    push(c, r * s * Math.cos(phi), r * u, r * s * Math.sin(phi), kelvinToRgb(k), 0.6 + Math.pow(R.next(), 8) * 2.4, 0.25 + Math.pow(R.next(), 5) * 0.9, R.next());
  }
  return c;
}
