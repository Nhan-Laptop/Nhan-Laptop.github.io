import { FORMATION_PALETTES } from "./palette.js";

const TAU = Math.PI * 2;

function mulberry32(seed) {
    return function random() {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createPoints(count, mode) {
    const random = mulberry32(mode === "category" ? 12043 : 7949);
    const points = [];

    for (let i = 0; i < count; i += 1) {
        points.push({
            index: i,
            u: (i + 0.5) / count,
            a: random(),
            b: random(),
            c: random(),
            d: random(),
            group: i % 7,
        });
    }

    return points;
}

function writePosition(target, i, x, y, z) {
    const offset = i * 3;
    target[offset] = x;
    target[offset + 1] = y;
    target[offset + 2] = z;
}

function writeColor(target, i, palette, point, brightness = 1) {
    const source = palette[point.group % palette.length];
    const offset = i * 3;
    const jitter = 0.84 + point.d * 0.24;

    target[offset] = Math.min(source[0] * brightness * jitter, 1);
    target[offset + 1] = Math.min(source[1] * brightness * jitter, 1);
    target[offset + 2] = Math.min(source[2] * brightness * jitter, 1);
}

function buildCompactCloud(points, target) {
    points.forEach((point, i) => {
        const theta = point.a * TAU;
        const phi = Math.acos(2 * point.b - 1);
        const radius = 0.65 + Math.pow(point.c, 2.4) * 2.25;
        const flatten = 0.72 + point.d * 0.38;

        writePosition(
            target,
            i,
            Math.cos(theta) * Math.sin(phi) * radius * 1.28,
            Math.cos(phi) * radius * flatten,
            Math.sin(theta) * Math.sin(phi) * radius * 0.88
        );
    });
}

function buildRibbons(points, target) {
    points.forEach((point, i) => {
        const lane = (point.group % 5) - 2;
        const t = (point.u * 1.72 + lane * 0.07) % 1;
        const wave = Math.sin(t * TAU * 2.3 + lane * 0.9);
        const twist = Math.cos(t * TAU * 1.6 + point.a * 0.8);

        writePosition(
            target,
            i,
            (t - 0.5) * 13.8 + (point.a - 0.5) * 0.18,
            wave * 1.05 + lane * 0.48 + (point.b - 0.5) * 0.24,
            twist * 2.15 + lane * 0.28 + (point.c - 0.5) * 0.36
        );
    });
}

function buildLayeredBlock(points, target) {
    const columns = 38;
    const rows = 24;

    points.forEach((point, i) => {
        const ix = i % columns;
        const iz = Math.floor(i / columns) % rows;
        const layer = Math.floor(i / (columns * rows)) % 7;
        const ridge = Math.sin(ix * 0.34) * 0.18 + Math.cos(iz * 0.42) * 0.16;

        writePosition(
            target,
            i,
            (ix - columns / 2) * 0.22 + (point.a - 0.5) * 0.08,
            (layer - 3) * 0.22 + ridge + point.b * 0.28,
            (iz - rows / 2) * 0.22 + (point.c - 0.5) * 0.08
        );
    });
}

function buildComputeSwarm(points, target) {
    points.forEach((point, i) => {
        const theta = point.a * TAU;
        const phi = Math.acos(2 * point.b - 1);
        const radius = 1.1 + Math.pow(point.c, 1.55) * 5.2;
        const spiral = point.u * TAU * 3.4;

        writePosition(
            target,
            i,
            Math.cos(theta + spiral * 0.12) * Math.sin(phi) * radius * 1.32,
            Math.cos(phi) * radius * 0.86 + Math.sin(spiral) * 0.38,
            Math.sin(theta + spiral * 0.18) * Math.sin(phi) * radius * 1.02
        );
    });
}

function buildClusters(points, target) {
    const centers = [
        [0, 0, 0],
        [-3.8, 1.2, -0.8],
        [3.6, 1.0, 0.7],
        [-2.6, -1.9, 1.2],
        [2.8, -1.7, -1.1],
        [0.7, 2.8, 0.4],
        [-0.5, -2.7, -0.5],
    ];

    points.forEach((point, i) => {
        const center = centers[point.group % centers.length];
        const theta = point.a * TAU;
        const phi = Math.acos(2 * point.b - 1);
        const radius = 0.22 + Math.pow(point.c, 1.8) * (point.group === 0 ? 1.45 : 1.02);

        writePosition(
            target,
            i,
            center[0] + Math.cos(theta) * Math.sin(phi) * radius,
            center[1] + Math.cos(phi) * radius,
            center[2] + Math.sin(theta) * Math.sin(phi) * radius
        );
    });
}

function buildSparseField(points, target) {
    points.forEach((point, i) => {
        const depthBias = Math.pow(point.c, 1.4);

        writePosition(
            target,
            i,
            (point.a - 0.5) * 18,
            (point.b - 0.5) * 7.2,
            -8.4 + depthBias * 13.2
        );
    });
}

function buildTerrain(points, target) {
    const side = Math.ceil(Math.sqrt(points.length));

    points.forEach((point, i) => {
        const ix = i % side;
        const iz = Math.floor(i / side);
        const x = (ix / side - 0.5) * 12;
        const z = (iz / side - 0.5) * 8.2;
        const distance = Math.sqrt(x * x * 0.85 + z * z * 1.2);
        const noise = 0.54 + 0.46 * Math.sin(ix * 0.57 + iz * 0.23 + point.a * TAU);
        const mound = Math.exp(-(distance * distance) / 8.2);
        const ridge = Math.max(0, Math.sin((x + z) * 0.9 + point.b * 2.4));

        writePosition(
            target,
            i,
            x + (point.a - 0.5) * 0.08,
            mound * noise * 2.35 + ridge * 0.18 - 1.85,
            z + (point.c - 0.5) * 0.08
        );
    });
}

function buildDiamond(points, target) {
    points.forEach((point, i) => {
        const y = (point.a - 0.5) * 4.2;
        const radiusLimit = Math.max(0.05, 2.35 * (1 - Math.abs(y) / 2.35));
        const theta = point.b * TAU;
        const radius = Math.sqrt(point.c) * radiusLimit;

        writePosition(
            target,
            i,
            Math.cos(theta) * radius,
            y,
            Math.sin(theta) * radius
        );
    });
}

export function createUniverseData(count, mode) {
    const points = createPoints(count, mode);
    const positions = Array.from({ length: 8 }, () => new Float32Array(count * 3));
    const colors = Array.from({ length: 8 }, () => new Float32Array(count * 3));
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);

    buildCompactCloud(points, positions[0]);
    buildRibbons(points, positions[1]);
    buildLayeredBlock(points, positions[2]);
    buildComputeSwarm(points, positions[3]);
    buildClusters(points, positions[4]);
    buildSparseField(points, positions[5]);
    buildTerrain(points, positions[6]);
    buildDiamond(points, positions[7]);

    points.forEach((point, i) => {
        scales[i] = (mode === "category" ? 0.07 : 0.058) + Math.pow(point.d, 2) * 0.07;
        seeds[i] = point.a * 100 + point.b * 17 + point.group;

        colors.forEach((target, sceneIndex) => {
            writeColor(target, i, FORMATION_PALETTES[sceneIndex], point, sceneIndex === 7 ? 1.08 : 1);
        });
    });

    return {
        positions,
        colors,
        scales,
        seeds,
    };
}
