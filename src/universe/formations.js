import { STAR_COLORS } from "./palette.js";

function seededRandom(seed) {
    return () => {
        let value = seed += 0x6d2b79f5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

// One stable galaxy, not a sequence of unrelated particle formations.
export function createStarData(count, galaxy = false) {
    const random = seededRandom(galaxy ? 41721 : 29117);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const brightness = new Float32Array(count);
    const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), 0.0001))) * Math.cos(random() * Math.PI * 2);

    for (let i = 0; i < count; i += 1) {
        let radius = 0;
        if (galaxy) {
            const core = random() < 0.22;
            radius = core ? Math.pow(random(), 0.65) * 1.05 : 0.55 + Math.pow(random(), 0.8) * 4.5;
            const arm = i % 3;
            const angle = core ? random() * Math.PI * 2 : arm * Math.PI * 2 / 3 + radius * 1.22 + gaussian() * 0.18;
            const spread = core ? 0.12 : 0.12 + radius * 0.055;
            positions[i * 3] = Math.cos(angle) * radius + gaussian() * spread;
            positions[i * 3 + 1] = Math.sin(angle) * radius + gaussian() * spread;
            positions[i * 3 + 2] = gaussian() * (core ? 0.24 : 0.07);
        } else {
            positions[i * 3] = (random() - 0.5) * 30;
            positions[i * 3 + 1] = (random() - 0.5) * 18;
            positions[i * 3 + 2] = (random() - 0.5) * 3;
        }

        const palette = galaxy && radius < 1.2 ? STAR_COLORS.warm : STAR_COLORS.cool;
        const color = palette[Math.floor(random() * palette.length)];
        colors.set(color, i * 3);
        const standout = random() > 0.985;
        sizes[i] = galaxy ? 1.1 + random() * 1.6 : 1.2 + Math.pow(random(), 3) * 3.1;
        if (standout) sizes[i] += 2;
        seeds[i] = random() * Math.PI * 2;
        brightness[i] = galaxy ? 0.13 + random() * 0.38 : 0.22 + random() * 0.55;
    }
    return { positions, colors, sizes, seeds, brightness };
}
