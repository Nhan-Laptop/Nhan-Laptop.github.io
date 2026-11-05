import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { generateDust, generateNebulae, generateSky, generateStars, PITCH, R0, rng, type PointCloud } from './model';
import {
  CORE_FRAG, CORE_VERT, DUST_FRAG, DUST_VERT, FAR_GALAXY_FRAG, FAR_GALAXY_VERT,
  GLOW_FRAG, GLOW_VERT, NEBULA_FRAG, STAR_FRAG, STAR_VERT,
} from './shaders';

/** A camera pose orbiting `target`. Angles in radians; `shift` slides the galaxy sideways (fraction of width). */
export interface Pose {
  target: [number, number, number];
  dist: number;
  azimuth: number;
  elevation: number;
  shift?: number;
  fov?: number;
}

export type Quality = 'high' | 'medium' | 'low';

export interface GalaxyOptions {
  poses: Pose[];
  quality?: Quality | 'auto';
  reducedMotion?: boolean;
  /** Allow dragging to orbit and wheel to zoom. */
  interactive?: boolean;
  zoom?: boolean;
  spin?: number; // rad/s of galactic rotation
  onFrame?: (engine: GalaxyEngine) => void;
  /** Keep the last frame readable (poster capture). */
  preserveDrawingBuffer?: boolean;
}

const TIERS: Record<Quality, { stars: number; dust: number; nebulae: number; sky: number; bloom: boolean; dpr: number }> = {
  high: { stars: 280_000, dust: 40_000, nebulae: 260, sky: 9000, bloom: true, dpr: 1.75 },
  medium: { stars: 160_000, dust: 24_000, nebulae: 190, sky: 6000, bloom: true, dpr: 1.5 },
  low: { stars: 85_000, dust: 13_000, nebulae: 130, sky: 4000, bloom: false, dpr: 1.25 },
};

export function pickQuality(): Quality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4;
  if (coarse || small) return memory >= 6 && cores >= 6 ? 'medium' : 'low';
  return cores >= 6 ? 'high' : 'medium';
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class GalaxyEngine {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly galaxy = new THREE.Group();
  readonly camera: THREE.PerspectiveCamera;
  readonly quality: Quality;
  private renderer: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private materials: THREE.ShaderMaterial[] = [];
  private pointMaterials: THREE.ShaderMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private poses: Pose[];
  private opts: GalaxyOptions;
  private clock = new THREE.Timer();
  private raf = 0;
  private running = false;
  private time = 0;
  private fade = 0;

  /** Continuous index into `poses` (e.g. 1.5 = halfway between pose 1 and 2). */
  progress = 0;
  private shown = 0;
  private drag = { az: 0, el: 0, vaz: 0, vel: 0, active: false, x: 0, y: 0, zoom: 1, zoomTarget: 1 };
  private pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  private frameTimes: number[] = [];
  private focusLocal: THREE.Vector3 | null = null;
  private focusDist = 30;
  private focusAmt = 0;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, opts: GalaxyOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.poses = opts.poses;
    this.quality = opts.quality && opts.quality !== 'auto' ? opts.quality : pickQuality();
    const tier = TIERS[this.quality];
    this.dpr = Math.min(devicePixelRatio || 1, tier.dpr);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x010206, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 3000);
    this.scene.add(this.galaxy);
    this.galaxy.rotation.y = 0.6;

    this.build(tier);
    if (tier.bloom) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.38, 0.3);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
    this.bind();
    this.applyPose(0, true);
  }

  /* ------------------------------------------------------------- scene */

  private pointsFrom(cloud: PointCloud, vert: string, frag: string, blending: THREE.Blending, maxSize: number, extra: Record<string, THREE.IUniform> = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cloud.positions.subarray(0, cloud.count * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(cloud.colors.subarray(0, cloud.count * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(cloud.sizes.subarray(0, cloud.count), 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(cloud.brightness.subarray(0, cloud.count), 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(cloud.seeds.subarray(0, cloud.count), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending,
      uniforms: {
        uScale: { value: 1 },
        uPixelRatio: { value: this.dpr },
        uMaxSize: { value: maxSize },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uTwinkle: { value: this.opts.reducedMotion ? 0 : 1 },
        uNear: { value: 2.2 },
        ...extra,
      },
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    this.disposables.push(g, m);
    this.pointMaterials.push(m);
    return p;
  }

  private build(tier: (typeof TIERS)[Quality]) {
    // Order matters: everything is blended without depth.
    const sky = this.pointsFrom(generateSky(tier.sky), STAR_VERT, STAR_FRAG, THREE.AdditiveBlending, 3);
    sky.renderOrder = 0;
    this.scene.add(sky);
    this.addFarGalaxies();

    // Diffuse disk light: stacked planes give the disk a little thickness from the side.
    const glowGeo = new THREE.PlaneGeometry(130, 130, 1, 1);
    this.disposables.push(glowGeo);
    const layers = [-0.7, -0.35, 0, 0.35, 0.7];
    layers.forEach((y, i) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uIntensity: { value: 0 }, uB: { value: PITCH }, uR0: { value: R0 } },
      });
      (m as any).userData.weight = Math.exp(-(y * y) / 0.25) / 3.1;
      const mesh = new THREE.Mesh(glowGeo, m);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = y;
      mesh.renderOrder = 1 + i * 0.01;
      mesh.frustumCulled = false;
      this.galaxy.add(mesh);
      this.materials.push(m);
      this.disposables.push(m);
    });

    const stars = this.pointsFrom(generateStars(tier.stars), STAR_VERT, STAR_FRAG, THREE.AdditiveBlending, 7);
    stars.renderOrder = 2;
    this.galaxy.add(stars);

    const nebulae = this.pointsFrom(generateNebulae(tier.nebulae), STAR_VERT, NEBULA_FRAG, THREE.AdditiveBlending, 160);
    (nebulae.material as THREE.ShaderMaterial).uniforms.uTwinkle.value = 0;
    (nebulae.material as THREE.ShaderMaterial).uniforms.uNear.value = 9;
    nebulae.renderOrder = 3;
    this.galaxy.add(nebulae);

    const coreGeo = new THREE.PlaneGeometry(2, 2);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uIntensity: { value: 0 } },
    });
    (coreMat as any).userData.weight = 1;
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.scale.setScalar(9);
    core.renderOrder = 4;
    core.frustumCulled = false;
    this.galaxy.add(core);
    this.materials.push(coreMat);
    this.disposables.push(coreGeo, coreMat);

    const dust = this.pointsFrom(generateDust(tier.dust), DUST_VERT, DUST_FRAG, THREE.NormalBlending, 200);
    dust.renderOrder = 5;
    this.galaxy.add(dust);
  }

  private addFarGalaxies() {
    const R = rng(99);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(geo);
    for (let i = 0; i < 26; i++) {
      const u = R.next() * 2 - 1;
      const phi = R.next() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 620;
      const hue = R.next();
      const m = new THREE.ShaderMaterial({
        vertexShader: FAR_GALAXY_VERT,
        fragmentShader: FAR_GALAXY_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color().setRGB(hue < 0.5 ? 1 : 0.75, hue < 0.5 ? 0.85 : 0.82, hue < 0.5 ? 0.7 : 1) } },
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(r * s * Math.cos(phi), r * u, r * s * Math.sin(phi));
      mesh.rotation.set(R.next() * 6.28, R.next() * 6.28, R.next() * 6.28);
      mesh.scale.setScalar(2.5 + R.next() * 5);
      mesh.renderOrder = 0;
      this.scene.add(mesh);
      this.disposables.push(m);
    }
  }

  /* ------------------------------------------------------------- input */

  private onResize = () => this.resize();
  private onVisibility = () => (document.hidden ? this.stop() : this.start());
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / innerHeight) * 2 - 1;
    if (!this.drag.active) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.drag.vaz = -dx * 0.005;
    this.drag.vel = dy * 0.004;
    this.drag.az += this.drag.vaz;
    this.drag.el = Math.max(-0.9, Math.min(0.9, this.drag.el + this.drag.vel));
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.drag.active = true;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };
  private onPointerUp = () => {
    this.drag.active = false;
    this.canvas.style.cursor = '';
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.drag.zoomTarget = Math.max(0.18, Math.min(2.2, this.drag.zoomTarget * Math.exp(e.deltaY * 0.0012)));
  };

  private bind() {
    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    addEventListener('pointermove', this.onPointerMove, { passive: true });
    if (this.opts.interactive) {
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      addEventListener('pointerup', this.onPointerUp);
      addEventListener('pointercancel', this.onPointerUp);
      this.canvas.style.touchAction = this.opts.zoom ? 'none' : 'pan-y';
    }
    if (this.opts.zoom) this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Zoom by a factor (pinch / buttons on the universe page). */
  zoomBy(f: number) {
    this.drag.zoomTarget = Math.max(0.18, Math.min(2.2, this.drag.zoomTarget * f));
  }

  /** Glide the camera to a galaxy-local point (or back out with null). */
  focus(local: THREE.Vector3 | null, dist = 26) {
    if (local) {
      this.focusLocal = local.clone();
      this.focusDist = dist;
    }
    this.focusWanted = local ? 1 : 0;
  }
  private focusWanted = 0;

  resetView() {
    this.drag.az = this.drag.el = this.drag.vaz = this.drag.vel = 0;
    this.drag.zoomTarget = 1;
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloom?.setSize(Math.round((w * this.dpr) / 2), Math.round((h * this.dpr) / 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateScale();
  }

  private updateScale() {
    const h = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    for (const m of this.pointMaterials) {
      m.uniforms.uScale.value = scale;
      m.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
  }

  /* ------------------------------------------------------------- camera */

  private applyPose(p: number, instant = false) {
    const n = this.poses.length;
    const clamped = Math.max(0, Math.min(n - 1, p));
    const i = Math.min(n - 2, Math.floor(clamped));
    const t = n === 1 ? 0 : smooth(clamped - i);
    const a = this.poses[Math.max(0, i)];
    const b = this.poses[Math.min(n - 1, i + 1)];

    const zoom = this.drag.zoom;
    const target = new THREE.Vector3(lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t));
    // Interpolate distance in log space so long dollies feel even.
    let dist = Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t));
    if (this.focusAmt > 0.0001 && this.focusLocal) {
      const f = this.focusLocal.clone().applyMatrix4(this.galaxy.matrixWorld);
      const e = smooth(this.focusAmt);
      target.lerp(f, e);
      dist = Math.exp(lerp(Math.log(dist), Math.log(this.focusDist), e));
    }
    dist *= zoom;
    const az = lerpAngle(a.azimuth, b.azimuth, t) + this.drag.az + this.pointer.sx * 0.05;
    const el = Math.max(-1.45, Math.min(1.5, lerp(a.elevation, b.elevation, t) + this.drag.el - this.pointer.sy * 0.03));
    const fov = lerp(a.fov ?? 50, b.fov ?? 50, t);
    const shift = lerp(a.shift ?? 0, b.shift ?? 0, t);

    this.camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(target);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.updateScale();
    }
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    // Wide screens slide the galaxy sideways; narrow ones push it below the text instead.
    const narrow = w < 820;
    const sx = narrow ? 0 : shift;
    const sy = narrow ? Math.abs(shift) * 1.1 : 0;
    if (Math.abs(sx) > 0.001 || sy > 0.001) this.camera.setViewOffset(w, h, -sx * w, -sy * h, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (instant) this.shown = p;
  }

  /* ------------------------------------------------------------- loop */

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.update();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Render a single frame (used for reduced motion and poster capture). */
  renderOnce() {
    this.frame(1 / 60);
  }

  private frame(fixedDt?: number) {
    if (fixedDt === undefined) this.clock.update();
    const dt = Math.min(0.05, fixedDt ?? this.clock.getDelta());
    const reduced = !!this.opts.reducedMotion;
    this.time += dt;
    this.fade = Math.min(1, this.fade + dt / (reduced ? 0.01 : 1.8));
    const fadeIn = smooth(this.fade);

    if (!reduced) this.galaxy.rotation.y += dt * (this.opts.spin ?? 0.012);

    // Damped follow of scroll progress, drag inertia and pointer parallax.
    const k = 1 - Math.exp(-dt * (reduced ? 60 : 2.6));
    this.shown += (this.progress - this.shown) * k;
    if (!this.drag.active) {
      this.drag.vaz *= Math.exp(-dt * 3);
      this.drag.vel *= Math.exp(-dt * 3);
      this.drag.az += this.drag.vaz * dt * 20;
      this.drag.el = Math.max(-0.9, Math.min(0.9, this.drag.el + this.drag.vel * dt * 20));
    }
    this.drag.zoom += (this.drag.zoomTarget - this.drag.zoom) * (1 - Math.exp(-dt * 5));
    this.focusAmt += (this.focusWanted - this.focusAmt) * (1 - Math.exp(-dt * (reduced ? 60 : 2.2)));
    const pk = 1 - Math.exp(-dt * 1.5);
    this.pointer.sx += ((reduced ? 0 : this.pointer.x) - this.pointer.sx) * pk;
    this.pointer.sy += ((reduced ? 0 : this.pointer.y) - this.pointer.sy) * pk;
    this.applyPose(this.shown);

    // Diffuse light dims as we get close (resolved stars take over) and is boosted edge-on.
    const dist = this.camera.position.distanceTo(new THREE.Vector3());
    const near = THREE.MathUtils.smoothstep(dist, 6, 40);
    // Auto-exposure: the bulge is very bright up close.
    this.renderer.toneMappingExposure = 0.5 + 0.48 * THREE.MathUtils.smoothstep(dist, 8, 70);
    for (const m of this.materials) {
      const base = m.fragmentShader === CORE_FRAG ? 1.0 : 0.95;
      m.uniforms.uIntensity.value = base * (m as any).userData.weight * fadeIn * (0.45 + 0.55 * near);
    }
    for (const m of this.pointMaterials) {
      m.uniforms.uTime.value = this.time;
      m.uniforms.uFade.value = fadeIn;
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    this.opts.onFrame?.(this);
    this.adapt(dt);
  }

  /** If frames are slow, lower the pixel ratio rather than stutter. */
  private adapt(dt: number) {
    if (this.time < 1.5) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 38 && this.dpr > 0.85) {
      this.dpr = Math.max(0.75, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.resize();
    }
  }

  /** Screen position (CSS px) of a point given in galaxy-local coordinates. */
  project(local: THREE.Vector3, out = new THREE.Vector3()) {
    out.copy(local).applyMatrix4(this.galaxy.matrixWorld);
    const toCam = out.clone().sub(this.camera.position);
    const facing = toCam.dot(this.camera.getWorldDirection(new THREE.Vector3())) > 0;
    const depth = toCam.length();
    out.project(this.camera);
    return {
      x: (out.x * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (-out.y * 0.5 + 0.5) * this.canvas.clientHeight,
      visible: facing && Math.abs(out.x) < 1.1 && Math.abs(out.y) < 1.1,
      depth,
    };
  }

  dispose() {
    this.stop();
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    removeEventListener('pointermove', this.onPointerMove);
    removeEventListener('pointerup', this.onPointerUp);
    removeEventListener('pointercancel', this.onPointerUp);
    this.disposables.forEach((d) => d.dispose());
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
