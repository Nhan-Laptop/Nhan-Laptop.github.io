import * as THREE from "three";
import { createUniverseData } from "./formations.js";

const VERTEX_SHADER = `
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec3 aColorFrom;
attribute vec3 aColorTo;
attribute float aScale;
attribute float aSeed;

uniform float uMorph;
uniform float uTime;
uniform float uScatter;

varying vec3 vColor;
varying float vDepthFade;

float easeInOut(float t) {
    return t * t * (3.0 - 2.0 * t);
}

void main() {
    float morph = easeInOut(clamp(uMorph, 0.0, 1.0));
    vec3 center = mix(aFrom, aTo, morph);
    float energy = 1.0 - abs(morph * 2.0 - 1.0);
    vec3 direction = normalize(center + vec3(0.001, 0.003, 0.002));
    float wave = sin(uTime * 0.74 + aSeed * 6.283185) * energy * uScatter;
    float pulse = 1.0 + sin(uTime * 0.82 + aSeed * 8.5) * 0.055;

    center += direction * wave;

    vec3 localPosition = position * aScale * pulse;
    vec4 viewPosition = modelViewMatrix * vec4(center + localPosition, 1.0);

    vColor = mix(aColorFrom, aColorTo, morph);
    vDepthFade = 1.0 - smoothstep(6.0, 28.0, -viewPosition.z);

    gl_Position = projectionMatrix * viewPosition;
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uOpacity;

varying vec3 vColor;
varying float vDepthFade;

void main() {
    float alpha = uOpacity * (0.34 + vDepthFade * 0.66);
    vec3 color = vColor * (0.72 + vDepthFade * 0.42);

    gl_FragColor = vec4(color, alpha);
}
`;

const CAMERA_STATES = [
    { position: [0, 1.0, 12.5], target: [0, 0.0, 0], fov: 42 },
    { position: [3.7, 1.2, 10.2], target: [0.4, 0.1, 0], fov: 40 },
    { position: [-2.8, 2.7, 10.4], target: [0, 0.2, 0], fov: 39 },
    { position: [4.1, 0.8, 8.2], target: [0.2, 0.0, 0], fov: 45 },
    { position: [-3.8, 1.7, 10.4], target: [0, 0.2, 0], fov: 43 },
    { position: [0.4, 1.0, 8.8], target: [0, 0.0, -1.2], fov: 47 },
    { position: [3.4, 1.0, 8.6], target: [0.2, -0.7, 0], fov: 42 },
    { position: [0.5, 1.1, 9.8], target: [0, 0.0, 0], fov: 38 },
];

function chooseCount(mode) {
    const width = window.innerWidth;

    if (mode === "category") {
        if (width < 640) return 460;
        if (width < 1024) return 760;
        return 1100;
    }

    if (width < 640) return 820;
    if (width < 1024) return 1400;
    return 2400;
}

function createInstancedGeometry(count, data) {
    const source = new THREE.BoxGeometry(1, 1, 1);
    const geometry = new THREE.InstancedBufferGeometry();

    geometry.setIndex(source.index.clone());
    geometry.setAttribute("position", source.getAttribute("position").clone());
    geometry.setAttribute("aFrom", new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aTo", new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aColorFrom", new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aColorTo", new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(data.scales, 1));
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(data.seeds, 1));
    geometry.instanceCount = count;
    source.dispose();

    return geometry;
}

function markSegmentAttributes(geometry, data, index) {
    const nextIndex = Math.min(index + 1, data.positions.length - 1);
    const aFrom = geometry.getAttribute("aFrom");
    const aTo = geometry.getAttribute("aTo");
    const aColorFrom = geometry.getAttribute("aColorFrom");
    const aColorTo = geometry.getAttribute("aColorTo");

    aFrom.array.set(data.positions[index]);
    aTo.array.set(data.positions[nextIndex]);
    aColorFrom.array.set(data.colors[index]);
    aColorTo.array.set(data.colors[nextIndex]);

    aFrom.needsUpdate = true;
    aTo.needsUpdate = true;
    aColorFrom.needsUpdate = true;
    aColorTo.needsUpdate = true;
}

function createOrbitLine(radiusX, radiusY, color, rotation) {
    const points = [];

    for (let i = 0; i <= 160; i += 1) {
        const t = (i / 160) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(t) * radiusX, Math.sin(t) * radiusY, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);

    line.rotation.set(rotation[0], rotation[1], rotation[2]);
    return line;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smooth(t) {
    return t * t * (3 - 2 * t);
}

function applyCamera(camera, progress) {
    const maxSegment = CAMERA_STATES.length - 1;
    const total = Math.min(progress, 0.9999) * maxSegment;
    const index = Math.min(Math.floor(total), maxSegment - 1);
    const t = smooth(total - index);
    const from = CAMERA_STATES[index];
    const to = CAMERA_STATES[index + 1];
    const target = new THREE.Vector3(
        lerp(from.target[0], to.target[0], t),
        lerp(from.target[1], to.target[1], t),
        lerp(from.target[2], to.target[2], t)
    );

    camera.position.set(
        lerp(from.position[0], to.position[0], t),
        lerp(from.position[1], to.position[1], t),
        lerp(from.position[2], to.position[2], t)
    );
    camera.fov = lerp(from.fov, to.fov, t);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
}

export function createUniverseRenderer({ mode }) {
    const shell = document.createElement("div");
    const canvas = document.createElement("canvas");
    const count = chooseCount(mode);
    const data = createUniverseData(count, mode);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
    });
    const geometry = createInstancedGeometry(count, data);
    const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uMorph: { value: mode === "category" ? 0.45 : 0 },
            uTime: { value: 0 },
            uOpacity: { value: mode === "category" ? 0.42 : 0.58 },
            uScatter: { value: mode === "category" ? 0.12 : 0.22 },
        },
    });
    const mesh = new THREE.Mesh(geometry, material);
    const orbitGroup = new THREE.Group();
    const clock = new THREE.Clock();
    let animationFrame = 0;
    let currentSegment = mode === "category" ? 4 : 0;
    let currentProgress = mode === "category" ? 0.62 : 0;

    shell.className = "universe-canvas-shell";
    shell.setAttribute("aria-hidden", "true");
    canvas.className = "universe-canvas";
    shell.appendChild(canvas);
    document.body.prepend(shell);

    renderer.setClearColor(0x000000, 0);
    markSegmentAttributes(geometry, data, currentSegment);
    mesh.frustumCulled = false;
    mesh.rotation.z = mode === "category" ? -0.12 : 0;
    scene.add(mesh);

    orbitGroup.add(createOrbitLine(4.2, 1.15, 0x76d5ff, [0.42, 0.0, -0.16]));
    orbitGroup.add(createOrbitLine(5.4, 1.38, 0xf2c26b, [-0.26, 0.24, 0.22]));
    orbitGroup.add(createOrbitLine(3.5, 0.96, 0x9a7dff, [0.72, -0.32, 0.1]));
    orbitGroup.add(createOrbitLine(6.2, 1.65, 0x5ca8ff, [-0.12, 0.52, -0.34]));
    scene.add(orbitGroup);

    function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.1 : 1.45);

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function setProgress(progress) {
        currentProgress = Math.max(0, Math.min(progress, 1));
        const maxSegment = data.positions.length - 1;
        const total = Math.min(currentProgress, 0.9999) * maxSegment;
        const segment = Math.min(Math.floor(total), maxSegment - 1);
        const morph = total - segment;

        if (segment !== currentSegment) {
            currentSegment = segment;
            markSegmentAttributes(geometry, data, currentSegment);
        }

        material.uniforms.uMorph.value = morph;
        applyCamera(camera, currentProgress);
    }

    function render() {
        const elapsed = clock.getElapsedTime();
        const homeEnergy = mode === "home" ? currentProgress : 0.48;

        material.uniforms.uTime.value = elapsed;
        mesh.rotation.y = elapsed * (mode === "category" ? 0.035 : 0.022) + homeEnergy * 0.68;
        mesh.rotation.x = Math.sin(elapsed * 0.13) * 0.05 + homeEnergy * 0.12;
        orbitGroup.rotation.y = elapsed * 0.045 + homeEnergy * 0.55;
        orbitGroup.rotation.x = Math.sin(elapsed * 0.08) * 0.09;
        orbitGroup.visible = mode === "home" || currentSegment < 6;

        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
    }

    resize();
    setProgress(currentProgress);
    render();
    window.addEventListener("resize", resize);

    return {
        setProgress,
        destroy() {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener("resize", resize);
            shell.remove();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        },
    };
}
