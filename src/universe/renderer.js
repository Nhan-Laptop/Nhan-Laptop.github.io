import * as THREE from "three";
import { createStarData } from "./formations.js";

const STAR_VERTEX = `
attribute float aSize;
attribute float aSeed;
attribute float aBrightness;
uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
    vColor = color;
    // Slow, low-amplitude scintillation, not blinking or flashing.
    vAlpha = aBrightness * uOpacity * (0.88 + 0.12 * sin(uTime * 0.45 + aSeed));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
}`;
const STAR_FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;
void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float halo = exp(-4.5 * d * d) * (1.0 - smoothstep(0.75, 1.0, d));
    gl_FragColor = vec4(vColor, halo * vAlpha);
}`;
const HAZE_VERTEX = `
varying vec2 vPosition;
void main() {
    vPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HAZE_FRAGMENT = `
varying vec2 vPosition;
uniform float uOpacity;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), u.x),
               mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), u.x), u.y);
}
float cloud(vec2 p) {
    return noise(p) * 0.57 + noise(p * 2.1) * 0.28 + noise(p * 4.3) * 0.15;
}
void main() {
    vec2 p = vPosition;
    float r = length(p);
    float theta = atan(p.y, p.x);
    float n = cloud(p * 2.0);
    float arms = pow(0.5 + 0.5 * cos(3.0 * (theta - r * 1.22)), 5.0);
    float disk = exp(-r * 0.65) * (1.0 - smoothstep(3.5, 5.6, r));
    float core = exp(-r * r * 1.4);
    float dust = smoothstep(0.2, 0.8, n);
    vec3 outer = mix(vec3(0.20, 0.28, 0.52), vec3(0.42, 0.32, 0.52), n);
    vec3 light = outer * disk * (0.22 + arms * dust * 1.7);
    light += vec3(0.73, 0.58, 0.42) * core * 0.3;
    gl_FragColor = vec4(light, uOpacity * (1.0 - smoothstep(4.8, 6.0, r)));
}`;

export function createUniverseRenderer({ showcase = false, mode = "home" } = {}) {
    const mobile = window.innerWidth < 760;
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    const count = mobile || lowPower ? 4800 : 12000;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 50);
    camera.position.z = 20;
    const canvas = document.createElement("canvas");
    canvas.className = "universe-canvas";
    const shell = document.createElement("div");
    shell.className = "universe-canvas-shell";
    shell.setAttribute("aria-hidden", "true");
    shell.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    const resources = [];
    const materials = [];
    const galaxy = new THREE.Group();
    const disk = new THREE.Group();
    galaxy.add(disk);
    scene.add(galaxy);
    const intensity = showcase ? 1 : mode === "category" ? 0.42 : 0.58;

    function stars(amount, inGalaxy) {
        const data = createStarData(amount, inGalaxy);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(data.sizes, 1));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(data.seeds, 1));
        geometry.setAttribute("aBrightness", new THREE.BufferAttribute(data.brightness, 1));
        const material = new THREE.ShaderMaterial({
            vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT,
            vertexColors: true, transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uOpacity: { value: inGalaxy ? intensity : 0.75 } },
        });
        resources.push(geometry, material);
        materials.push(material);
        return new THREE.Points(geometry, material);
    }

    const field = stars(mobile ? 420 : 1000, false);
    scene.add(field);
    disk.add(stars(count, true));
    const hazeGeometry = new THREE.PlaneGeometry(12, 12);
    const hazeMaterial = new THREE.ShaderMaterial({
        vertexShader: HAZE_VERTEX, fragmentShader: HAZE_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: intensity * 0.7 } },
    });
    resources.push(hazeGeometry, hazeMaterial);
    const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
    haze.position.z = -0.5;
    disk.add(haze);
    // Tilt the disk as a whole; stars and diffuse arms stay aligned.
    galaxy.rotation.set(0.82, -0.2, -0.38);

    let elapsed = 0;
    let progress = 0;
    let targetProgress = 0;
    let frame = 0;
    let paused = true;
    let destroyed = false;
    let lastTime = 0;
    let aspect = 1;
    const pointer = { x: 0, y: 0 };
    const currentPointer = { x: 0, y: 0 };
    const interval = 1000 / (showcase && !mobile && !lowPower ? 45 : 30);

    function draw() {
        const scale = aspect < 1 ? 0.78 : showcase ? 1.12 : 1.25;
        galaxy.scale.setScalar(scale);
        galaxy.position.set(showcase ? 0 : aspect < 1 ? 1.1 : aspect * 2.2, showcase ? 0 : 0.7, 0);
        galaxy.position.x += currentPointer.x * 0.12;
        galaxy.position.y += currentPointer.y * 0.08 - progress * 0.6;
        disk.rotation.z = elapsed * 0.012 + progress * 0.12;
        field.position.x = currentPointer.x * 0.04;
        field.position.y = currentPointer.y * 0.03 - progress * 0.14;
        for (const material of materials) material.uniforms.uTime.value = elapsed;
        renderer.render(scene, camera);
    }

    function tick(time) {
        if (destroyed || paused) return;
        frame = requestAnimationFrame(tick);
        if (time - lastTime < interval) return;
        const delta = Math.min((time - lastTime) / 1000, 0.08);
        lastTime = time;
        elapsed += delta;
        const blend = 1 - Math.exp(-delta * 2);
        progress += (targetProgress - progress) * blend;
        currentPointer.x += (pointer.x - currentPointer.x) * blend;
        currentPointer.y += (pointer.y - currentPointer.y) * blend;
        draw();
    }

    function setPaused(value) {
        if (destroyed || value === paused) return;
        paused = value;
        cancelAnimationFrame(frame);
        if (!paused) {
            lastTime = performance.now();
            frame = requestAnimationFrame(tick);
        }
    }

    function resize() {
        const width = document.documentElement.clientWidth;
        const height = window.innerHeight;
        aspect = width / Math.max(height, 1);
        camera.left = -6 * aspect;
        camera.right = 6 * aspect;
        camera.updateProjectionMatrix();
        const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        materials.forEach(material => { material.uniforms.uPixelRatio.value = ratio; });
        draw();
    }
    function movePointer(event) {
        pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
        pointer.y = 0.5 - event.clientY / Math.max(window.innerHeight, 1);
    }
    function contextLost(event) {
        event.preventDefault();
        setPaused(true);
        shell.style.display = "none";
    }
    function contextRestored() {
        shell.style.display = "";
        resize();
        // The runtime owns the user's pause preference.
        window.dispatchEvent(new Event("universe-restored"));
    }
    document.body.prepend(shell);
    resize();
    window.addEventListener("resize", resize);
    if (window.matchMedia("(pointer: fine)").matches) window.addEventListener("pointermove", movePointer, { passive: true });
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);

    return {
        setPaused,
        setProgress(value) { targetProgress = Math.max(0, Math.min(value, 1)); },
        destroy() {
            setPaused(true);
            destroyed = true;
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", movePointer);
            canvas.removeEventListener("webglcontextlost", contextLost);
            canvas.removeEventListener("webglcontextrestored", contextRestored);
            resources.forEach(resource => resource.dispose());
            renderer.dispose();
            shell.remove();
        },
    };
}
