// Where every star sits in each scene. One particle cloud travels between these
// layouts, so a galaxy's arms can physically fall inward and become a planet.
//
// Positions are polar (a, height, theta) because the vertex shader moves each
// star along its orbit: see place() in sky.js.

export const STRIDE = 8; // a height theta size | r g b alpha
export const HAZE_SHARE = 0.07;

const COLORS = {
  blueWhite: [0.79, 0.85, 1.0],
  white: [0.96, 0.97, 1.0],
  core: [1.0, 0.84, 0.66],
  hydrogen: [1.0, 0.42, 0.6],
  oxygen: [0.37, 0.87, 0.8],
  periwinkle: [0.55, 0.58, 1.0],
};

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tools(seed) {
  const rand = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-6)) * Math.cos(6.2832 * rand());
  return { rand, gauss };
}

// Keeps the angle uniform on a sphere's surface while storing it as an orbit.
function shellPoint({ rand }, radius) {
  const y = (rand() * 2 - 1) * radius;
  return [Math.sqrt(Math.max(radius * radius - y * y, 0)), y, rand() * 6.2832];
}

function buildGalaxy(data, count, hazeCount) {
  const { rand, gauss } = tools(20260728);
  for (let i = 0; i < count; i += 1) {
    const bulge = rand() < 0.16;
    let a = bulge ? Math.abs(gauss()) * 0.55 : Math.min(0.35 - Math.log(1 - rand() * 0.985) * 1.75, 5.6);
    a += i < hazeCount ? 0.55 + rand() * 0.5 : 0.04;
    const thickness = bulge ? 0.3 : 0.045 + 0.05 * Math.exp(-a);
    const h = gauss() * thickness;
    const theta = rand() * 6.2832;
    let size;
    let alpha;
    let color;
    if (i < hazeCount) {
      const inner = Math.exp(-a * 0.8);
      size = 58 + rand() * 62;
      alpha = 0.0125 - 0.005 * inner;
      const pick = rand();
      if (pick < 0.12) color = COLORS.hydrogen;
      else if (pick < 0.18) color = COLORS.oxygen;
      else color = rand() < inner * 1.3 ? COLORS.core : COLORS.periwinkle;
    } else {
      size = 0.85 + Math.pow(rand(), 6) * 2.6;
      alpha = (0.42 + rand() * 0.58) * (bulge ? 0.3 : 0.85);
      const pick = rand();
      if (pick < 0.02) {
        color = COLORS.hydrogen;
        size *= 1.5;
      } else if (a < 1.2 && rand() < Math.exp(-a * 1.1) * 1.4) color = COLORS.core;
      else color = pick < 0.6 ? COLORS.blueWhite : COLORS.white;
    }
    data.set([a, h, theta, size, ...color, alpha], i * STRIDE);
  }
}

function nebula(data, i, t, tints, yaw) {
  const { rand, gauss } = t;
  const cloud = Math.floor(rand() * 3);
  const color = tints[cloud % tints.length];
  // Faces the scene's camera, so the cloud always sits behind the subject.
  const behind = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  const lit = rand() < 0.5;
  data.set(
    [
      8 + rand() * 7,
      (cloud - 1) * 1.7 + gauss() * 1.25,
      behind + (cloud - 1) * 0.62 + gauss() * 0.3,
      120 + rand() * 120,
      ...color,
      lit ? 0.022 + rand() * 0.026 : 0,
    ],
    i * STRIDE,
  );
}

// `lanes` is [[inner, outer, weight, color, alpha, thickness]]: rings, belts, orbits.
function buildSystem(data, count, hazeCount, { seed, radius, shell, lanes, tints }, yaw) {
  const t = tools(seed);
  const { rand, gauss } = t;
  const total = lanes.reduce((sum, lane) => sum + lane[2], 0);
  for (let i = 0; i < count; i += 1) {
    if (i < hazeCount) {
      nebula(data, i, t, tints, yaw);
      continue;
    }
    if (rand() < shell) {
      // Arrives on the surface and fades out as the solid body takes over.
      const [a, h, theta] = shellPoint(t, radius * 1.01);
      data.set([a, h, theta, 0.9 + rand() * 1.2, ...tints[0], 0], i * STRIDE);
      continue;
    }
    let pick = rand() * total;
    let lane = lanes[0];
    for (const candidate of lanes) {
      lane = candidate;
      pick -= candidate[2];
      if (pick <= 0) break;
    }
    const [inner, outer, , color, alpha, thickness, gap] = lane;
    let a = inner + rand() * (outer - inner);
    // Redraw inside a gap, the way the Cassini Division empties Saturn's rings.
    if (gap && Math.abs(a - gap[0]) < gap[1]) a = inner + rand() * (outer - inner) * 0.72;
    data.set(
      [
        a,
        gauss() * thickness,
        rand() * 6.2832,
        0.72 + Math.pow(rand(), 7) * 0.8,
        color[0] * (0.82 + rand() * 0.18),
        color[1] * (0.82 + rand() * 0.18),
        color[2] * (0.82 + rand() * 0.18),
        alpha * (0.55 + rand() * 0.45),
      ],
      i * STRIDE,
    );
  }
}

const ICE = [0.86, 0.76, 0.6];
const GOLD = [0.95, 0.78, 0.48];
const EMBER = [1.0, 0.5, 0.24];
const DUST = COLORS.white;

// orbit = [eccentricity, spiral twist, orbital speed, arm crowding]
export const SCENES = [
  {
    name: 'galaxy',
    orbit: [0.3, 0.96, 0.34, 0.34],
    tilt: 0,
    radius: 0,
    camera: { yaw: 0.5, pitch: 0.36, dist: 6.8, wide: [0, -0.84], tall: [0, -0.8], tallDist: 1.3 },
    bodies: [],
  },
  {
    name: 'giant',
    orbit: [0, 0, 0.5, 0],
    tilt: 0.42,
    radius: 1,
    build: {
      seed: 11,
      radius: 1,
      shell: 0.26,
      tints: [[0.9, 0.72, 0.5], [0.42, 0.42, 0.72], [0.62, 0.32, 0.46]],
      lanes: [
        [1.32, 2.28, 10, ICE, 0.82, 0.006, [1.92, 0.055]],
        [2.5, 7, 0.5, DUST, 0.55, 0.9],
      ],
    },
    camera: { yaw: 6.1, pitch: 0.5, dist: 6.4, wide: [0.4, -0.02], tall: [0, 0.36], tallDist: 1.45 },
    bodies: [{ tex: 'giant', r: 1, tilt: 0.42, spin: 0.018, ring: [1.32, 2.28], atmo: [0.9, 0.72, 0.5], mode: 0 }],
  },
  {
    name: 'system',
    orbit: [0, 0, 0.12, 0],
    tilt: 0.05,
    radius: 0.42,
    build: {
      seed: 23,
      radius: 0.42,
      shell: 0.24,
      tints: [[1.0, 0.72, 0.42], [0.3, 0.42, 0.78], [0.72, 0.3, 0.5]],
      lanes: [
        [1.02, 1.03, 1.1, COLORS.periwinkle, 0.5, 0.002],
        [1.56, 1.57, 1.6, COLORS.periwinkle, 0.5, 0.002],
        [2.14, 2.15, 2.2, COLORS.periwinkle, 0.5, 0.002],
        [2.5, 3.0, 9, GOLD, 0.72, 0.035],
        [3.5, 3.51, 3.4, COLORS.periwinkle, 0.5, 0.002],
        [4.5, 4.51, 4.4, COLORS.periwinkle, 0.5, 0.002],
        [5, 9, 1, DUST, 0.5, 0.8],
      ],
    },
    camera: { yaw: 0.2, pitch: 0.56, dist: 8.4, wide: [0.36, 0.02], tall: [0, 0.34], tallDist: 1.5 },
    bodies: [
      { tex: 'lava', r: 0.42, spin: 0.02, atmo: [1.0, 0.68, 0.3], mode: 3, sun: true },
      { tex: 'rock', r: 0.1, spin: 0.05, atmo: [0.5, 0.48, 0.45], mode: 0, orbit: [1.02, 0.62, 0.4] },
      { tex: 'ocean', r: 0.16, spin: 0.06, atmo: [0.35, 0.65, 1.0], mode: 1, orbit: [1.56, 0.36, 3.1] },
      { tex: 'lava', r: 0.13, spin: 0.04, atmo: [1.0, 0.42, 0.2], mode: 2, orbit: [2.14, 0.24, 5.0] },
      { tex: 'giant', r: 0.36, tilt: 0.3, spin: 0.08, atmo: [0.9, 0.72, 0.5], mode: 0, orbit: [3.5, 0.1, 1.2] },
      { tex: 'ocean', r: 0.25, spin: 0.05, atmo: [0.45, 0.7, 1.0], mode: 1, orbit: [4.5, 0.065, 4.2] },
    ],
  },
  {
    name: 'forge',
    orbit: [0.06, 0, 0.42, 0],
    tilt: -0.28,
    radius: 1,
    build: {
      seed: 37,
      radius: 1,
      shell: 0.55,
      tints: [[1.0, 0.42, 0.22], [0.62, 0.2, 0.3], [0.3, 0.16, 0.42]],
      lanes: [
        [1.5, 2.7, 8, EMBER, 0.72, 0.09],
        [2.8, 7, 0.6, DUST, 0.5, 0.9],
      ],
    },
    camera: { yaw: 4.2, pitch: 0.22, dist: 5.6, wide: [0.42, 0.02], tall: [0, 0.36], tallDist: 1.4 },
    bodies: [{ tex: 'lava', r: 1, tilt: -0.28, spin: 0.012, atmo: [1.0, 0.36, 0.14], mode: 2 }],
  },
  {
    name: 'home',
    orbit: [0, 0, 0.3, 0],
    tilt: 0.2,
    radius: 1,
    build: {
      seed: 53,
      radius: 1,
      shell: 0.72,
      tints: [[0.3, 0.52, 1.0], [0.2, 0.72, 0.72], [0.5, 0.32, 0.8]],
      lanes: [
        [2.24, 2.25, 1, COLORS.blueWhite, 0.2, 0.002],
        [2.6, 8, 2, DUST, 0.6, 1.1],
      ],
    },
    camera: { yaw: 6.45, pitch: 0.14, dist: 4.1, wide: [0.44, -0.04], tall: [0, 0.32], tallDist: 1.45 },
    bodies: [
      { tex: 'ocean', r: 1, tilt: 0.2, spin: 0.02, atmo: [0.32, 0.6, 1.0], mode: 1 },
      { tex: 'rock', r: 0.26, spin: 0.01, atmo: [0.4, 0.4, 0.42], mode: 0, orbit: [2.25, 0.05, 0.75], planeTilt: 0.2 },
    ],
  },
  {
    // Back out to the whole galaxy, seen from above, to close the page.
    name: 'galaxy-far',
    formation: 0,
    orbit: [0.3, 0.96, 0.34, 0.34],
    tilt: 0,
    radius: 0,
    camera: { yaw: 7.2, pitch: 1.12, dist: 11.5, wide: [0, 0.22], tall: [0, 0.24], tallDist: 1.5 },
    bodies: [],
  },
];

/** Returns one Float32Array per distinct formation, plus the shared hazeCount. */
export function buildFormations(count) {
  const hazeCount = Math.floor(count * HAZE_SHARE);
  const formations = SCENES.filter((scene) => scene.formation === undefined).map((scene) => {
    const data = new Float32Array(count * STRIDE);
    if (scene.build) buildSystem(data, count, hazeCount, scene.build, scene.camera.yaw);
    else buildGalaxy(data, count, hazeCount);
    return data;
  });
  return { formations, hazeCount };
}

/** Per-particle stagger: phase, delay. */
export function buildMeta(count) {
  const { rand } = tools(4242);
  const meta = new Float32Array(count * 2);
  for (let i = 0; i < count * 2; i += 1) meta[i] = rand();
  return meta;
}

/** Distant stars that stay screen-fixed: x y depth size phase alpha. */
export function buildField(count) {
  const { rand } = tools(90210);
  const field = new Float32Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    field.set(
      [
        (rand() - 0.5) * 5,
        -3.2 + rand() * 5.2,
        rand() * rand(),
        0.9 + Math.pow(rand(), 7) * 2.2,
        rand(),
        0.18 + rand() * 0.55,
      ],
      i * 6,
    );
  }
  return field;
}
