// The homepage sky, drawn with three.js. One particle cloud travels between a galaxy and
// planetary scenes. Star motion lives in the vertex shader and planet surfaces are baked once,
// so scrolling only changes uniforms and React never re-renders per frame.
//
// The memorable part is the decode wake: wherever the pointer passes, stars resolve into hex
// digits and then fade back. A small texture holds a rough fluid (velocity in RG, trace in B) that
// carries itself along each frame, so one lookup pushes the stars, curls the smoke, reveals a
// planet's grid and bends the finished image. The advection follows PavelDoGreat's
// WebGL-Fluid-Simulation (MIT) but skips the pressure solve: this only has to look alive.

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ColorManagement,
  CustomBlending,
  DoubleSide,
  HalfFloatType,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SCENES, STRIDE, buildField, buildFormations, buildMeta } from './formations.js';

const FOCAL = 1.7;
const HAZE_SCALE = 0.25; // The haze is huge and blurry: quarter resolution costs 1/16 of the fill.
const SLOW_FRAME_MS = 1000 / 28;
const TEXTURES = { giant: 0, ocean: 1, lava: 2, rock: 3 };
// Sunlight for every scene that has no star of its own.
const SUN = new Vector3(-0.66, 0.34, 0.67).normalize();

// How the wake behaves.
// Long enough for a stroke to read as a path, short enough that rubbing the sky never buries the
// headline: at 1.15 a stroke is still legible a second later and gone by about four.
const WAKE_HALF_LIFE = 1.15; // seconds until a trace is half as bright
const WAKE_RADIUS = 0.11; // as a share of viewport height
const FLOW_HALF_LIFE = 0.45; // seconds until the fluid has lost half its speed
const PUSH = 0.075; // how far the flow carries stars, as clip space per unit of speed
const REFRACT = 0.008; // how far the flow bends the finished image
const GLYPH_PX = 20; // CSS pixels: large enough to read as a digit
const COMET_START = 1.2; // seconds after load
const COMET_SECONDS = 2.1;

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const cometEase = (flight) => flight * flight * (3 - 2 * flight);
const cometPath = (t) => [0.04 + t * 0.92, 0.63 + 0.09 * Math.sin(t * Math.PI * 1.7 + 0.4)];

/** Where the opening comet is across the viewport, from 0 to 1, so the headline can decode behind it. */
export function cometX(seconds) {
  const flight = Math.min(Math.max((seconds - COMET_START) / COMET_SECONDS, 0), 1);
  return cometPath(cometEase(flight))[0] + (flight >= 1 ? 1 : flight <= 0 ? -1 : 0);
}

const WAKE_GLSL = `
uniform sampler2D uTrail;
uniform float uTraceGain, uGlyphPx, uTime, uPush, uWakeAspect, uDigitFloor;
varying float vTrace;
varying float vGlyph;
const vec3 HALPHA = vec3(1.0, 0.42, 0.6);

// Reads the fluid at this star's place on screen. The flow carries the star off and lets it drift
// back as the fluid slows. Digits roll while the trace is fresh, then settle.
void applyWake(inout vec4 clip, float phase, inout vec3 color, inout float alpha, inout float size) {
  vec2 uv = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
  vec4 fluid = texture2D(uTrail, uv);
  clip.xy += fluid.xy * vec2(1.0 / uWakeAspect, 1.0) * uPush * (0.55 + phase * 0.9) * clip.w;
  float trace = fluid.b * uTraceGain;
  float touched = smoothstep(0.1, 0.45, trace);
  // Only some stars become digits. If all did, a ring or a galaxy core would burn out to white.
  float on = touched * step(uDigitFloor, fract(phase * 97.0));
  vTrace = on;
  color = mix(color, HALPHA * 1.15, touched * 0.35);
  float roll = floor(uTime * 9.0 * smoothstep(0.55, 1.0, trace));
  vGlyph = mod(floor(phase * 1600.0) + roll, 16.0);
  color = mix(color, mix(HALPHA * 1.5, vec3(1.5, 1.35, 1.42), smoothstep(0.7, 1.0, trace)), on);
  alpha = mix(alpha, 0.9, on);
  size = mix(size, uGlyphPx, on);
}
`;

const FIELD_VERTEX = `
attribute vec4 aField;     // x, y, depth, size
attribute vec2 aFieldMeta; // phase, alpha
uniform float uScroll, uAspect, uDpr;
uniform vec2 uPointer;
varying vec4 vColor;
${WAKE_GLSL}
void main() {
  float depth = aField.z;
  vec2 pos = aField.xy;
  // Stars start as low as y = -3.2, so the 1.3 maximum never exposes empty sky.
  pos.y += uScroll * (0.12 + depth * depth * 1.18);
  pos += uPointer * depth * 0.03;
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
  float phase = aFieldMeta.x;
  float twinkle = 0.62 + 0.38 * sin(uTime * (0.5 + phase * 1.9) + phase * 40.0);
  vec3 color = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.95, 0.88), phase);
  float alpha = aFieldMeta.y * twinkle;
  float size = aField.w * (1.0 + depth) * uDpr;
  applyWake(gl_Position, phase, color, alpha, size);
  gl_PointSize = size;
  vColor = vec4(color, alpha);
}
`;

const STAR_VERTEX = `
attribute vec4 aA0, aA1, aB0, aB1; // a h theta size | rgb alpha
uniform float uBloom, uMorph, uPx, uFlash, uMinSize, uMaxSize, uTiltA, uTiltB;
uniform vec4 uOrbitA, uOrbitB;
uniform vec2 uSolid;  // radius and opacity of the body at the origin
uniform vec3 uLight;
varying vec4 vColor;
${WAKE_GLSL}

// Density wave: every orbit is an ellipse turned a little further than the one inside it.
// Stars linger near each ellipse's long axis, which is where the arms appear, so stars keep
// moving but the arms hold their shape and never wind up.
vec3 place(vec3 q, vec4 orbit, float tilt, vec3 color, out float gain) {
  float a = q.x;
  float m = q.z + uTime * orbit.z * step(a, 5.8) / (a + 0.35);
  float e = m - orbit.w * sin(2.0 * m);
  float x = a * cos(e);
  float z = a * (1.0 - orbit.x) * sin(e);
  float c = cos(a * orbit.y), s = sin(a * orbit.y);
  vec3 p = vec3(c * x - s * z, q.y, s * x + c * z);
  float ct = cos(tilt), st = sin(tilt);
  p = vec3(ct * p.x - st * p.y, st * p.x + ct * p.y, p.z);

  // Stars brighten in the arm, dim in the dust lane on its inner edge, and hydrogen only
  // glows while it crosses the arm.
  float wave = cos(2.0 * m);
  float arm = 0.4 + 1.25 * pow(0.5 + 0.5 * wave, 2.0);
  float dust = 1.0 - 0.6 * smoothstep(0.78, 1.0, cos(2.0 * m + 0.62));
  float hydrogen = step(1.5, color.r / (color.g + 0.01));
  float shaped = arm * dust * mix(1.0, arm, hydrogen);
  gain = mix(1.0, mix(1.0, shaped, smoothstep(0.45, 1.25, a)), orbit.w / 0.34);
  return p;
}

void main() {
  float phase = position.x; // position carries per-star data: phase, delay
  float delay = position.y;
  float stagger = 0.45;
  float t = clamp(uMorph * (1.0 + stagger) - delay * stagger, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);

  float gainA, gainB;
  vec3 pa = place(aA0.xyz, uOrbitA, uTiltA, aA1.rgb, gainA);
  vec3 pb = place(aB0.xyz, uOrbitB, uTiltB, aB1.rgb, gainB);
  vec3 pos = mix(pa, pb, t);

  // Travelling stars sweep around the centre rather than cutting straight across.
  float flight = sin(t * 3.14159);
  float swirl = flight * (phase - 0.5) * 1.9;
  float cs = cos(swirl), ss = sin(swirl);
  pos = vec3(cs * pos.x - ss * pos.z, pos.y, ss * pos.x + cs * pos.z);

  // Opening: everything starts in one small knot, then unfolds.
  float b = clamp((uBloom - delay * 0.9) / 2.3, 0.0, 1.0);
  b = 1.0 - pow(1.0 - b, 4.0);
  pos *= mix(0.02, 1.0, b);

  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  if (gl_Position.w < 0.08) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vTrace = 0.0;
    vGlyph = 0.0;
    return;
  }

  float alpha = mix(aA1.a * gainA, aB1.a * gainB, t) + flight * uFlash;

  // The body at the origin shadows the stars past it. The depth buffer handles hiding them.
  if (uSolid.x > 0.0) {
    float toward = dot(pos, uLight);
    if (toward < 0.0) {
      float axis = length(pos - uLight * toward);
      alpha *= mix(1.0, 0.05 + 0.95 * smoothstep(uSolid.x * 0.94, uSolid.x * 1.06, axis), uSolid.y);
    }
  }

  float twinkle = 0.7 + 0.3 * sin(uTime * (0.5 + phase * 1.9) + phase * 40.0);
  float size = clamp(mix(aA0.w, aB0.w, t) * uPx / gl_Position.w, uMinSize, uMaxSize);
  vec3 color = mix(aA1.rgb, aB1.rgb, t);
  alpha *= twinkle;
  // Shell stars are unlit on purpose: a wake must not relight them over the solid planet.
  if (alpha > 0.002) applyWake(gl_Position, phase, color, alpha, size);
  else { vTrace = 0.0; vGlyph = 0.0; }
  gl_PointSize = size;
  vColor = vec4(color, alpha);
}
`;

const POINT_FRAGMENT = `
uniform sampler2D uGlyphs;
varying vec4 vColor;
varying float vTrace;
varying float vGlyph;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float shape = exp(-dot(d, d) * 16.0);
  if (vTrace > 0.001) {
    vec2 cell = vec2(mod(vGlyph, 4.0), floor(vGlyph / 4.0));
    float ink = texture2D(uGlyphs, (cell + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / 4.0).r;
    shape = mix(shape, ink, vTrace);
  }
  gl_FragColor = vec4(vColor.rgb * vColor.a * shape, 0.0);
}
`;

const SCREEN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// The gas layer, plus the faint hydrogen smoke a wake leaves hanging behind its digits.
const HAZE_FRAGMENT = `
uniform sampler2D uHaze, uTrail;
uniform float uTraceGain;
varying vec2 vUv;
void main() {
  float trace = texture2D(uTrail, vUv).b * uTraceGain;
  vec3 smoke = vec3(1.0, 0.3, 0.5) * trace * sqrt(trace) * 0.11;
  gl_FragColor = vec4(texture2D(uHaze, vUv).rgb + smoke, 0.0);
}
`;

// One step of the fluid. Each texel looks back along its own velocity for what arrives here, then
// loses a little speed and trace. The pointer and the comet stamp speed and trace along their last
// segment, and a held press pulls everything into a spiral around it.
const TRAIL_FRAGMENT = `
uniform sampler2D uPrev;
uniform vec2 uFrom, uTo, uPenFlow, uCometFrom, uCometTo, uCometFlow, uWellAt;
uniform float uDt, uDecay, uDrag, uStamp, uComet, uWell, uRadius, uAspect, uTime;
varying vec2 vUv;

float stroke(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(p - a - ab * h) / uRadius;
  return exp(-d * d);
}

void main() {
  vec2 scale = vec2(uAspect, 1.0);
  vec2 here = texture2D(uPrev, vUv).xy;
  vec4 arriving = texture2D(uPrev, vUv - here * uDt / scale);
  vec2 p = vUv * scale;
  vec2 flow = arriving.xy * uDrag;
  float trace = arriving.b * uDecay;

  // A cheap stand-in for vorticity, enough to curl the smoke rather than let it smear.
  vec2 q = p * 7.0;
  flow += vec2(sin(q.y + uTime * 1.3 + sin(q.x * 0.6)), cos(q.x - uTime * 1.1 + sin(q.y * 0.7))) * trace * uDt * 0.35;

  float pen = uStamp * stroke(p, uFrom * scale, uTo * scale);
  flow = mix(flow, uPenFlow, pen);
  trace = max(trace, pen);
  float comet = uComet * stroke(p, uCometFrom * scale, uCometTo * scale);
  flow = mix(flow, uCometFlow, comet);
  trace = max(trace, comet);

  if (uWell != 0.0) {
    vec2 to = uWellAt * scale - p;
    float near = exp(-dot(to, to) / 0.1);
    vec2 inward = to / sqrt(dot(to, to) + 1e-4);
    flow += (inward * 1.6 * uWell + vec2(-inward.y, inward.x) * 2.2 * abs(uWell)) * near * uDt;
    trace = max(trace, near * min(abs(uWell), 1.0) * 0.85);
  }
  gl_FragColor = vec4(flow, trace, 1.0);
}
`;

// Rendered once per surface at startup: noise is too expensive to run per pixel per frame,
// but looking it up in a texture is nearly free.
const BAKE_FRAGMENT = `
uniform float uKind;
varying vec2 vUv;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 7; i++) {
    sum += amp * noise(p);
    p = p * 2.03 + 11.7;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  // Sampling noise on the sphere itself leaves no seam where the map wraps.
  float lon = vUv.x * 6.28318;
  float lat = (vUv.y - 0.5) * 3.14159;
  vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 col;
  float extra = 0.0;
  if (uKind < 0.5) {
    float w = fbm(p * 3.0) - 0.5;
    float y = p.y + w * 0.075;
    float bands = 0.5 + 0.5 * sin(y * 21.0 + 1.3 * sin(y * 7.0));
    float streak = fbm(vec3(p.x * 2.2, y * 24.0, p.z * 2.2));
    col = mix(vec3(0.66, 0.47, 0.3), vec3(0.95, 0.86, 0.68), bands);
    col = mix(col, vec3(0.45, 0.26, 0.16), smoothstep(0.42, 0.68, streak) * 0.72);
    float storm = length(vec2((lon - 2.1) * 1.1, (p.y + 0.34) * 3.1));
    col = mix(col, vec3(0.74, 0.28, 0.16), smoothstep(0.34, 0.16, storm) * 0.9);
  } else if (uKind < 1.5) {
    vec3 q = p + 0.4 * (vec3(fbm(p * 2.0 + 1.0), fbm(p * 2.0 + 7.0), fbm(p * 2.0 + 13.0)) - 0.5);
    float h = fbm(q * 2.5);
    float land = smoothstep(0.515, 0.535, h);
    vec3 sea = mix(vec3(0.015, 0.07, 0.22), vec3(0.04, 0.3, 0.44), smoothstep(0.38, 0.515, h));
    vec3 ground = mix(vec3(0.13, 0.3, 0.12), vec3(0.55, 0.45, 0.28), smoothstep(0.54, 0.66, h));
    col = mix(sea, ground, land);
    col = mix(col, vec3(0.92, 0.95, 0.98), smoothstep(0.8, 0.88, abs(p.y) + (h - 0.5) * 0.3));
    float cloud = smoothstep(0.55, 0.74, fbm(q * vec3(3.0, 7.0, 3.0) + 4.0));
    col = mix(col, vec3(0.9, 0.92, 0.95), cloud * 0.85);
    extra = (1.0 - land) * (1.0 - cloud);
  } else if (uKind < 2.5) {
    float f = fbm(p * 3.0);
    float ridge = 1.0 - abs(2.0 * fbm(p * 5.5 + f * 2.2) - 1.0);
    col = mix(vec3(0.045, 0.032, 0.032), vec3(0.17, 0.11, 0.085), f);
    extra = pow(ridge, 14.0) * smoothstep(0.38, 0.62, fbm(p * 1.6 + 5.0));
  } else {
    float f = fbm(p * 5.0);
    col = vec3(0.47, 0.45, 0.43) * (0.52 + f * 0.95);
    col *= 1.0 - 0.42 * smoothstep(0.47, 0.6, fbm(p * 1.7 + 3.0));
  }
  gl_FragColor = vec4(col, extra);
}
`;

const BODY_VERTEX = `
varying vec3 vLocal;
varying vec3 vWorld;
varying vec4 vClip;
void main() {
  vLocal = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
  vClip = gl_Position;
}
`;

const BODY_FRAGMENT = `
uniform vec3 uBodyLight, uAtmo;
uniform vec2 uRing;
uniform float uVis, uMode, uSpin, uTilt, uTraceGain;
uniform sampler2D uTex, uTrail;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec4 vClip;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 n = normalize(vLocal);
  float ct = cos(uTilt), st = sin(uTilt);
  vec3 q = vec3(ct * n.x + st * n.y, -st * n.x + ct * n.y, n.z);
  vec2 uv = vec2(atan(q.z, q.x) / 6.28318 + 0.5 + uSpin, asin(clamp(q.y, -1.0, 1.0)) / 3.14159 + 0.5);
  vec4 tex = texture2D(uTex, uv);
  float ndl = dot(n, uBodyLight);
  float lit = smoothstep(-0.06, 0.82, ndl);
  vec3 col;
  if (uMode > 2.5) {
    float limb = pow(max(dot(n, -rd), 0.0), 0.45);
    col = mix(vec3(1.0, 0.52, 0.16), vec3(1.0, 0.95, 0.76), limb + tex.a * 0.22) * 1.5;
  } else {
    // Rings cast a band of shadow across the planet they circle.
    if (uRing.y > 0.0) {
      vec3 lq = vec3(ct * uBodyLight.x + st * uBodyLight.y, -st * uBodyLight.x + ct * uBodyLight.y, uBodyLight.z);
      float cross = -q.y / lq.y;
      if (cross > 0.0) {
        float r = length((q + lq * cross).xz);
        lit *= 1.0 - 0.68 * smoothstep(uRing.x - 0.03, uRing.x + 0.03, r) * smoothstep(uRing.y + 0.03, uRing.y - 0.03, r);
      }
    }
    col = tex.rgb * (0.012 + lit * 1.02);
    if (uMode > 1.5) {
      col += vec3(1.0, 0.34, 0.07) * tex.a * (1.7 - lit * 0.7); // Lava runs hot enough to bloom.
    } else if (uMode > 0.5) {
      col += vec3(0.95, 0.97, 1.0) * pow(max(dot(n, normalize(uBodyLight - rd)), 0.0), 70.0) * tex.a * lit * 0.85;
    }
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.2);
    col += uAtmo * rim * (0.03 + lit) * 0.95;
  }
  // A wake exposes the atlas grid under the surface, turning with the planet.
  float trace = texture2D(uTrail, vClip.xy / vClip.w * 0.5 + 0.5).b * uTraceGain;
  if (trace > 0.02) {
    vec2 grid = uv * vec2(36.0, 18.0);
    vec2 width = fwidth(grid);
    width.x = min(width.x, fwidth(fract(grid.x + 0.5))); // The map's seam must not read as a thick line.
    vec2 lines = abs(fract(grid - 0.5) - 0.5) / max(width, vec2(1e-4));
    col += vec3(1.0, 0.42, 0.6) * 1.6 * (1.0 - min(min(lines.x, lines.y), 1.0)) * smoothstep(0.1, 0.6, trace);
  }
  gl_FragColor = vec4(col * uVis, uVis);
}
`;

// A camera-facing sheet through the planet's centre. The planet's own depth hides the middle,
// leaving only the light that spills past its limb.
const GLOW_VERTEX = `
uniform vec3 uCenter, uRight, uUp;
uniform float uExtent;
varying vec3 vWorld;
void main() {
  vWorld = uCenter + (uRight * position.x + uUp * position.y) * uExtent;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const GLOW_FRAGMENT = `
uniform vec3 uCenter, uBodyLight, uAtmo;
uniform float uR, uVis, uMode, uExtentRadii;
varying vec3 vWorld;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 oc = cameraPosition - uCenter;
  float b = dot(oc, rd);
  float miss = sqrt(max(dot(oc, oc) - b * b, 0.0)) / uR;
  vec3 side = normalize(oc - rd * b);
  float above = max(miss - 1.0, 0.0);
  vec3 glow;
  if (uMode > 2.5) {
    glow = uAtmo * (0.95 * exp(-above * 3.2) + 0.2 * exp(-above * 0.75));
  } else {
    glow = uAtmo * 0.85 * exp(-above * 15.0) * smoothstep(-0.32, 0.55, dot(side, uBodyLight));
  }
  glow *= smoothstep(uExtentRadii, uExtentRadii * 0.72, miss);
  gl_FragColor = vec4(glow * uVis, 0.0);
}
`;

const RING_VERTEX = `
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// Thin bands with a real gap, darkened where the planet's shadow falls across them.
const RING_FRAGMENT = `
uniform vec2 uRing, uGap;
uniform vec3 uBodyLight;
uniform float uVis, uR;
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  float r = length(vLocal.xy);
  float t = (r - uRing.x) / (uRing.y - uRing.x);
  float bands = 0.55 + 0.25 * sin(r * 61.0) + 0.14 * sin(r * 137.0 + 1.7) + 0.06 * sin(r * 311.0);
  float edges = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.92, t);
  float gap = smoothstep(uGap.y * 0.7, uGap.y, abs(r - uGap.x));
  float toward = dot(vWorld, uBodyLight);
  float axis = length(vWorld - uBodyLight * toward);
  float shadow = toward < 0.0 ? mix(0.06, 1.0, smoothstep(uR * 0.96, uR * 1.04, axis)) : 1.0;
  vec3 tint = mix(vec3(0.62, 0.5, 0.36), vec3(0.98, 0.87, 0.68), bands);
  float alpha = bands * edges * gap * 0.62 * uVis;
  gl_FragColor = vec4(tint * (0.08 + 0.86 * shadow) * alpha, alpha);
}
`;

// The last step: the fluid bends the image and splits its colour, fast scrolling stretches the sky
// out from the centre, then a soft shoulder on highlights, a vignette, and grain that hides banding.
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uTrail: { value: null },
    uRefract: { value: 0 },
    uWarp: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse, uTrail;
    uniform float uTime, uRefract, uWarp;
    varying vec2 vUv;
    float grain(vec2 p) {
      return fract(sin(dot(p + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec2 flow = texture2D(uTrail, vUv).xy * uRefract;
      vec2 c = vUv - 0.5;
      vec2 at = vUv - flow;
      vec3 col;
      if (uWarp > 0.002) {
        // Eight taps only while the sky is moving fast; a still page pays for three.
        col = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          vec2 reach = c * uWarp * float(i) / 7.0;
          col += vec3(
            texture2D(tDiffuse, at - reach * 1.1).r,
            texture2D(tDiffuse, at - reach).g,
            texture2D(tDiffuse, at - reach * 0.9).b);
        }
        col /= 8.0;
      } else {
        col = vec3(texture2D(tDiffuse, vUv - flow * 1.15).r, texture2D(tDiffuse, at).g, texture2D(tDiffuse, vUv - flow * 0.85).b);
      }
      col = 1.0 - exp(-col * 1.22);
      col *= 1.0 - dot(c, c) * 0.42;
      col += (grain(gl_FragCoord.xy) - 0.5) * 0.016;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** Sixteen hex digits on one texture, in the same mono face the site uses for code. */
async function glyphAtlas() {
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 4;
  canvas.height = cell * 4;
  const font = `500 ${cell * 0.74}px "IBM Plex Mono", ui-monospace, monospace`;
  try {
    await document.fonts.load(font, '0123456789abcdef');
  } catch {
    // The monospace fallback still reads as hex.
  }
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  '0123456789abcdef'.split('').forEach((digit, index) => {
    // Written top down here. The fragment shader flips, so index 0 is the first cell it reads.
    const x = (index % 4) * cell + cell / 2;
    const y = (3 - Math.floor(index / 4)) * cell + cell / 2;
    context.fillText(digit, x, y);
  });
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const premultiplied = { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor };
const additive = { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor };

/**
 * Starts the sky on a canvas. getView() returns { scene, scroll, rest }: a fractional scene
 * index, page progress from 0 to 1, and whether the reader has passed the journey.
 * Returns a stop function, or null when WebGL is unavailable so the caller can show the CSS fallback.
 */
export function startSky(canvas, { getView, isPaused, reducedMotion, onLost }) {
  // Scene values are mixed directly in display space, as the sky has always been drawn.
  ColorManagement.enabled = false;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  // The wake and the post-processing both render to half-float textures, which some older Safari
  // versions cannot do. The CSS sky is a better answer there than a black or broken one.
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
    renderer.dispose();
    return null;
  }
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 1);

  const narrow = () => window.innerWidth < 720;
  const count = narrow() ? 15000 : 42000;
  const bakeSize = narrow() ? 1024 : 2048;

  const camera = new PerspectiveCamera((2 * Math.atan(1 / FOCAL) * 180) / Math.PI, 1, 0.05, 400);
  const quadGeometry = new PlaneGeometry(2, 2);
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Off-screen work: baked surfaces, the haze layer and the wake's memory.
  const flat = (material) => {
    const scene = new Scene();
    const mesh = new Mesh(quadGeometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return scene;
  };

  const bakeMaterial = new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: BAKE_FRAGMENT,
    uniforms: { uKind: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  });
  const bakeScene = flat(bakeMaterial);
  const surfaces = Object.values(TEXTURES).map((kind) => {
    const target = new WebGLRenderTarget(bakeSize, bakeSize / 2, { depthBuffer: false });
    target.texture.wrapS = RepeatWrapping;
    target.texture.minFilter = LinearFilter;
    target.texture.magFilter = LinearFilter;
    bakeMaterial.uniforms.uKind.value = kind;
    renderer.setRenderTarget(target);
    renderer.render(bakeScene, flatCamera);
    return target;
  });
  renderer.setRenderTarget(null);

  const trailOptions = { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
  let trailA = new WebGLRenderTarget(320, 180, trailOptions);
  let trailB = new WebGLRenderTarget(320, 180, trailOptions);
  const trailMaterial = new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: TRAIL_FRAGMENT,
    uniforms: {
      uPrev: { value: null },
      uFrom: { value: new Vector2() },
      uTo: { value: new Vector2() },
      uPenFlow: { value: new Vector2() },
      uCometFrom: { value: new Vector2() },
      uCometTo: { value: new Vector2() },
      uCometFlow: { value: new Vector2() },
      uWellAt: { value: new Vector2() },
      uDt: { value: 0 },
      uDecay: { value: 1 },
      uDrag: { value: 1 },
      uStamp: { value: 0 },
      uComet: { value: 0 },
      uWell: { value: 0 },
      uTime: { value: 0 },
      uRadius: { value: WAKE_RADIUS },
      uAspect: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const trailScene = flat(trailMaterial);

  const hazeTarget = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false });

  // Uniforms shared by reference, so changing one value reaches every material that reads it.
  const atlas = { value: null };
  const shared = {
    uTime: { value: 0 },
    uBloom: { value: 0 },
    uMorph: { value: 0 },
    uTiltA: { value: 0 },
    uTiltB: { value: 0 },
    uOrbitA: { value: [0, 0, 0, 0] },
    uOrbitB: { value: [0, 0, 0, 0] },
    uSolid: { value: new Vector2() },
    uLight: { value: SUN },
    uTrail: { value: trailA.texture },
    uGlyphs: atlas,
    uGlyphPx: { value: GLYPH_PX },
    uPush: { value: 0 },
    uWakeAspect: { value: 1 },
    uDigitFloor: { value: narrow() ? 0.72 : 0.9 },
  };
  const wake = { value: 0 };

  const { formations, hazeCount } = buildFormations(count);
  const formationAttributes = formations.map((data) => {
    const buffer = new InterleavedBuffer(data, STRIDE);
    return [new InterleavedBufferAttribute(buffer, 4, 0), new InterleavedBufferAttribute(buffer, 4, 4)];
  });

  const meta = buildMeta(count);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = meta[i * 2];
    positions[i * 3 + 1] = meta[i * 2 + 1];
  }
  const cloudGeometry = () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return geometry;
  };

  const starMaterial = (uniforms) =>
    new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      uniforms: { ...shared, ...uniforms },
      transparent: true,
      depthWrite: false,
      ...additive,
    });

  // Haze: the first share of the cloud, huge and soft, drawn off-screen at quarter resolution.
  const hazeGeometry = cloudGeometry();
  hazeGeometry.setDrawRange(0, hazeCount);
  const hazeUniforms = {
    uPx: { value: 1 },
    uFlash: { value: 0 },
    uMinSize: { value: 1 },
    uMaxSize: { value: 64 },
    uTraceGain: { value: 0 },
  };
  const hazeMaterial = starMaterial(hazeUniforms);
  hazeMaterial.depthTest = false;
  const hazeScene = new Scene();
  const hazePoints = new Points(hazeGeometry, hazeMaterial);
  hazePoints.frustumCulled = false;
  hazeScene.add(hazePoints);

  // The main scene, in draw order.
  const scene = new Scene();

  const backdrop = new Mesh(
    quadGeometry,
    new ShaderMaterial({
      vertexShader: SCREEN_VERTEX,
      fragmentShader: HAZE_FRAGMENT,
      uniforms: { uHaze: { value: hazeTarget.texture }, uTrail: shared.uTrail, uTraceGain: wake },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      ...additive,
    }),
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -2;
  scene.add(backdrop);

  const fieldCount = narrow() ? 2400 : 5200;
  const fieldData = buildField(fieldCount);
  const fieldBuffer = new InterleavedBuffer(fieldData, 6);
  const fieldGeometry = new BufferGeometry();
  fieldGeometry.setAttribute('position', new BufferAttribute(new Float32Array(fieldCount * 3), 3));
  fieldGeometry.setAttribute('aField', new InterleavedBufferAttribute(fieldBuffer, 4, 0));
  fieldGeometry.setAttribute('aFieldMeta', new InterleavedBufferAttribute(fieldBuffer, 2, 4));
  const fieldUniforms = {
    uTime: shared.uTime,
    uTrail: shared.uTrail,
    uGlyphs: atlas,
    uGlyphPx: shared.uGlyphPx,
    uPush: shared.uPush,
    uWakeAspect: shared.uWakeAspect,
    uDigitFloor: { value: 0 }, // The background field is sparse enough for every star to turn.
    uTraceGain: wake,
    uScroll: { value: 0 },
    uAspect: { value: 1 },
    uDpr: { value: 1 },
    uPointer: { value: new Vector2() },
  };
  const field = new Points(
    fieldGeometry,
    new ShaderMaterial({
      vertexShader: FIELD_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      uniforms: fieldUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      ...additive,
    }),
  );
  field.frustumCulled = false;
  field.renderOrder = -1;
  scene.add(field);

  const sphereGeometry = new SphereGeometry(1, 96, 64);
  const camRight = { value: new Vector3() };
  const camUp = { value: new Vector3() };

  const bodies = [];
  SCENES.forEach((sceneData, sceneIndex) => {
    sceneData.bodies.forEach((item) => {
      const light = { value: SUN.clone() };
      const vis = { value: 0 };
      const atmo = { value: new Vector3(...item.atmo) };
      const center = { value: new Vector3() };
      const surface = new Mesh(
        sphereGeometry,
        new ShaderMaterial({
          vertexShader: BODY_VERTEX,
          fragmentShader: BODY_FRAGMENT,
          uniforms: {
            uBodyLight: light,
            uAtmo: atmo,
            uRing: { value: new Vector2(...(item.ring || [0, 0])) },
            uVis: vis,
            uMode: { value: item.mode },
            uSpin: { value: 0 },
            uTilt: { value: item.tilt || 0 },
            uTex: { value: surfaces[TEXTURES[item.tex]].texture },
            uTrail: shared.uTrail,
            uTraceGain: wake,
          },
          transparent: true,
          ...premultiplied,
        }),
      );
      surface.scale.setScalar(item.r);
      surface.frustumCulled = false;
      scene.add(surface);

      const extentRadii = item.sun ? 6 : 1.75;
      const glow = new Mesh(
        quadGeometry,
        new ShaderMaterial({
          vertexShader: GLOW_VERTEX,
          fragmentShader: GLOW_FRAGMENT,
          uniforms: {
            uCenter: center,
            uRight: camRight,
            uUp: camUp,
            uExtent: { value: item.r * extentRadii },
            uExtentRadii: { value: extentRadii },
            uBodyLight: light,
            uAtmo: atmo,
            uR: { value: item.r },
            uVis: vis,
            uMode: { value: item.mode },
          },
          transparent: true,
          depthWrite: false,
          ...additive,
        }),
      );
      glow.frustumCulled = false;
      glow.renderOrder = 3;
      scene.add(glow);

      let ring = null;
      if (item.ring) {
        const lane = sceneData.build.lanes[0];
        const gap = lane[6] || [0, 0];
        ring = new Mesh(
          new RingGeometry(item.ring[0], item.ring[1], 256, 1),
          new ShaderMaterial({
            vertexShader: RING_VERTEX,
            fragmentShader: RING_FRAGMENT,
            uniforms: {
              uRing: { value: new Vector2(...item.ring) },
              uGap: { value: new Vector2(...gap) },
              uBodyLight: light,
              uVis: vis,
              uR: { value: item.r },
            },
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            ...premultiplied,
          }),
        );
        // RingGeometry lies flat in XY. Turn it into the planet's equator, then lean it.
        ring.rotation.order = 'ZXY';
        ring.rotation.x = -Math.PI / 2;
        ring.rotation.z = item.tilt || 0;
        ring.frustumCulled = false;
        ring.renderOrder = 2;
        scene.add(ring);
      }

      bodies.push({ sceneIndex, item, surface, glow, ring, light, vis, center });
    });
  });

  const starGeometry = cloudGeometry();
  starGeometry.setDrawRange(hazeCount, count - hazeCount);
  const starUniforms = {
    uPx: { value: 1 },
    uFlash: { value: 0.3 },
    uMinSize: { value: 1 },
    uMaxSize: { value: 16 },
    uTraceGain: wake,
  };
  const stars = new Points(starGeometry, starMaterial(starUniforms));
  stars.frustumCulled = false;
  stars.renderOrder = 5;
  scene.add(stars);

  const formationOf = (sceneData) => {
    if (sceneData.formation !== undefined) return sceneData.formation;
    const index = SCENES.indexOf(sceneData);
    return SCENES.slice(0, index + 1).filter((item) => item.formation === undefined).length - 1;
  };

  // Swapping which layouts the cloud travels between costs almost nothing.
  let loadedPair = '';
  const loadPair = (from, to) => {
    const key = `${formationOf(from)}:${formationOf(to)}`;
    if (key === loadedPair) return;
    loadedPair = key;
    const a = formationAttributes[formationOf(from)];
    const b = formationAttributes[formationOf(to)];
    for (const geometry of [hazeGeometry, starGeometry]) {
      geometry.setAttribute('aA0', a[0]);
      geometry.setAttribute('aA1', a[1]);
      geometry.setAttribute('aB0', b[0]);
      geometry.setAttribute('aB1', b[1]);
    }
  };

  // Post-processing, multisampled so planet limbs and rings stay clean.
  const composerTarget = new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(4, 4), 0.42, 0.72, 0.86);
  composer.addPass(bloom);
  const grade = new ShaderPass(GRADE_SHADER);
  grade.uniforms.uTrail = shared.uTrail;
  composer.addPass(grade);

  // Quality steps down at most three times on machines that cannot keep up.
  let dprLimit = narrow() ? 1.5 : 1.75;
  let dpr = 1;
  let aspect = 1;
  let tall = false;
  let drawHeight = 1;

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
    aspect = width / height;
    tall = aspect < 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const pixelWidth = Math.round(width * dpr);
    drawHeight = Math.round(height * dpr);
    composer.setSize(pixelWidth, drawHeight);
    hazeTarget.setSize(Math.ceil(pixelWidth * HAZE_SCALE), Math.ceil(drawHeight * HAZE_SCALE));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    fieldUniforms.uAspect.value = aspect;
    fieldUniforms.uDpr.value = dpr;
    trailMaterial.uniforms.uAspect.value = aspect;
    shared.uWakeAspect.value = aspect;
    shared.uGlyphPx.value = GLYPH_PX * dpr;
    hazeUniforms.uPx.value = ((drawHeight * 10) / 720) * HAZE_SCALE;
    hazeUniforms.uMaxSize.value = Math.min(renderer.capabilities.maxPointSize ?? 64, 130 * dpr * HAZE_SCALE * 2);
    starUniforms.uPx.value = (drawHeight * 10) / 720;
    starUniforms.uMinSize.value = 1.05 * dpr;
    starUniforms.uMaxSize.value = 16 * dpr;
  };

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  // Where the wake is being drawn, in 0-1 screen coordinates with y up.
  const pen = { x: 0, y: 0, lastX: 0, lastY: 0, down: false, moved: false };
  let cometAt = 0;
  // A held press winds the well up to 1. Letting go flips it into a short outward burst.
  const well = { value: 0, held: false };

  const movePen = (clientX, clientY) => {
    pointer.targetX = clientX / window.innerWidth - 0.5;
    pointer.targetY = 0.5 - clientY / window.innerHeight;
    const x = clientX / window.innerWidth;
    const y = 1 - clientY / window.innerHeight;
    if (!pen.down) {
      pen.lastX = x;
      pen.lastY = y;
      pen.down = true;
    }
    pen.x = x;
    pen.y = y;
    pen.moved = true;
  };
  const onPointer = (event) => movePen(event.clientX, event.clientY);
  // A scrolling finger cancels its pointer events, but touchmove keeps reporting it.
  const onTouch = (event) => movePen(event.touches[0].clientX, event.touches[0].clientY);
  const onLift = () => {
    pen.down = false;
  };
  const onPress = (event) => {
    if (event.pointerType === 'touch' || event.button !== 0 || event.target.closest?.('a, button, input, textarea, select')) return;
    movePen(event.clientX, event.clientY);
    well.held = true;
  };
  const onRelease = () => {
    if (!well.held) return;
    well.held = false;
    well.value = -1.5 * Math.max(well.value, 0.25);
  };

  const flowOf = (target, dx, dy, step) => {
    const speed = Math.hypot(dx * aspect, dy) / Math.max(step, 1 / 240);
    const limit = Math.min(speed, 2.6) / Math.max(speed, 1e-5);
    target.set((dx * aspect * limit) / Math.max(step, 1 / 240), (dy * limit) / Math.max(step, 1 / 240));
  };

  const stepWake = (step, wakeOn, seconds) => {
    const u = trailMaterial.uniforms;
    u.uStamp.value = pen.moved && wakeOn ? 1 : 0;
    u.uFrom.value.set(pen.lastX, pen.lastY);
    u.uTo.value.set(pen.x, pen.y);
    flowOf(u.uPenFlow.value, pen.x - pen.lastX, pen.y - pen.lastY, step);

    // One comet crosses the opening view to show what the sky does. From where it last was, so a
    // slow machine draws one long stroke rather than separate dabs.
    const flight = (seconds - COMET_START) / COMET_SECONDS;
    u.uComet.value = flight > 0 && flight < 1 ? 1 : 0;
    if (u.uComet.value) {
      const eased = cometEase(flight);
      const [fromX, fromY] = cometPath(cometAt);
      const [toX, toY] = cometPath(eased);
      u.uCometFrom.value.set(fromX, fromY);
      u.uCometTo.value.set(toX, toY);
      flowOf(u.uCometFlow.value, toX - fromX, toY - fromY, step);
      cometAt = eased;
    }

    if (well.held) well.value += (1 - well.value) * (1 - Math.exp(-step * 2.4));
    else well.value *= Math.exp(-step * 7);
    if (!well.held && Math.abs(well.value) < 0.01) well.value = 0;
    u.uWell.value = wakeOn ? well.value : 0;
    u.uWellAt.value.set(pen.x, pen.y);

    u.uPrev.value = trailA.texture;
    u.uDt.value = step;
    u.uTime.value = seconds;
    u.uDecay.value = 0.5 ** (step / WAKE_HALF_LIFE);
    u.uDrag.value = 0.5 ** (step / FLOW_HALF_LIFE);
    renderer.setRenderTarget(trailB);
    renderer.render(trailScene, flatCamera);
    renderer.setRenderTarget(null);
    [trailA, trailB] = [trailB, trailA];
    shared.uTrail.value = trailA.texture;
    pen.lastX = pen.x;
    pen.lastY = pen.y;
    pen.moved = false;
  };

  const setCamera = (from, to, mix) => {
    const lens = (sceneData) => {
      const c = sceneData.camera;
      return {
        yaw: c.yaw,
        pitch: c.pitch,
        dist: c.dist * (tall ? c.tallDist : 1),
        offset: tall ? c.tall : c.wide,
      };
    };
    const a = lens(from);
    const b = lens(to);
    const yaw = lerp(a.yaw, b.yaw, mix) + shared.uTime.value * 0.006 + pointer.x * 0.09;
    const pitch = lerp(a.pitch, b.pitch, mix) - pointer.y * 0.05;
    const dist = lerp(a.dist, b.dist, mix);
    camera.position.set(Math.cos(pitch) * Math.sin(yaw) * dist, Math.sin(pitch) * dist, Math.cos(pitch) * Math.cos(yaw) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // A lens shift, which keeps the subject beside the copy without changing the perspective.
    const elements = camera.projectionMatrix.elements;
    elements[8] = -lerp(a.offset[0], b.offset[0], mix);
    elements[9] = -lerp(a.offset[1], b.offset[1], mix);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    camRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
  };

  const toSun = new Vector3();
  const placeBodies = (low, high, fromVis, toVis, seconds) => {
    for (const body of bodies) {
      const vis = body.sceneIndex === low ? fromVis : body.sceneIndex === high ? toVis : 0;
      const shown = vis > 0.001;
      body.surface.visible = shown;
      body.glow.visible = shown;
      if (body.ring) body.ring.visible = shown;
      if (!shown) continue;
      body.vis.value = vis;
      const { item } = body;
      const center = body.center.value;
      center.set(0, 0, 0);
      if (item.orbit) {
        const [a, speed, start] = item.orbit;
        const angle = start + seconds * speed;
        const dip = item.planeTilt || 0;
        center.set(Math.cos(angle) * a, Math.sin(angle) * a * Math.sin(dip), Math.sin(angle) * a * Math.cos(dip));
        // Orbiting planets are lit by the star they circle.
        toSun.copy(center).negate().normalize();
        body.light.value.copy(toSun);
      }
      body.surface.position.copy(center);
      body.surface.material.uniforms.uSpin.value = seconds * item.spin;
      // Hold depth only once a planet is solid, so stars can show through while it forms.
      body.surface.material.depthWrite = vis > 0.6;
      body.surface.renderOrder = 1 + 1 / (1 + camera.position.distanceTo(center));
      if (body.ring) body.ring.position.copy(center);
    }
  };

  const draw = (seconds, bloomTime, sceneValue, scroll) => {
    const low = Math.min(Math.floor(sceneValue), SCENES.length - 1);
    const high = Math.min(low + 1, SCENES.length - 1);
    const from = SCENES[low];
    const to = SCENES[high];
    const morph = smooth(0.1, 0.9, sceneValue - low);
    const fromVis = 1 - smooth(0, 0.42, morph);
    const toVis = smooth(0.58, 1, morph);

    shared.uTime.value = seconds;
    shared.uBloom.value = bloomTime;
    shared.uMorph.value = morph;
    shared.uTiltA.value = from.tilt;
    shared.uTiltB.value = to.tilt;
    shared.uOrbitA.value = from.orbit;
    shared.uOrbitB.value = to.orbit;
    const [solidRadius, solidVis] = morph < 0.5 ? [from.radius, fromVis] : [to.radius, toVis];
    shared.uSolid.value.set(solidRadius, solidVis);
    fieldUniforms.uScroll.value = scroll;
    fieldUniforms.uPointer.value.set(pointer.x, pointer.y);
    grade.uniforms.uTime.value = seconds % 10;

    loadPair(from, to);
    setCamera(from, to, morph);
    placeBodies(low, high, fromVis, toVis, seconds);

    renderer.setRenderTarget(hazeTarget);
    renderer.clear();
    renderer.render(hazeScene, camera);
    renderer.setRenderTarget(null);
    composer.render();
  };

  let frame = 0;
  let previous = 0;
  let slowFrames = 0;
  let sampled = 0;
  let pausedFor = 0;
  let odd = false;
  let stopped = false;
  let warpGain = 1;
  const started = performance.now();
  const shown = { ...getView() };

  const governQuality = (elapsed) => {
    // A long gap means the tab was throttled or hidden, not that it is slow.
    if (elapsed > 1500 || document.visibilityState !== 'visible') return;
    sampled += 1;
    if (elapsed > SLOW_FRAME_MS) slowFrames += 1;
    if (sampled < 40) return;
    if (slowFrames > 24) {
      if (dprLimit > 1) {
        dprLimit = 1;
        resize();
      } else if (bloom.enabled) {
        bloom.enabled = false;
        warpGain = 0;
      } else {
        const drawn = Math.max(6000, Math.floor(starGeometry.drawRange.count * 0.55));
        starGeometry.setDrawRange(hazeCount, drawn);
      }
    }
    sampled = 0;
    slowFrames = 0;
  };

  const tick = (now) => {
    if (stopped) return;
    const seconds = (now - started - pausedFor) / 1000;
    if (isPaused()) {
      if (previous) pausedFor += now - previous;
      previous = now;
      frame = requestAnimationFrame(tick);
      return;
    }
    if (previous && seconds > 3.5) governQuality(now - previous);
    const step = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    const wanted = getView();
    // Behind the posts the sky is dim and still, so half the frames are enough.
    odd = !odd;
    if (wanted.rest && odd) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const ease = 1 - Math.exp(-step * 4.5);
    // The further the sky lags the scrollbar, the harder it is being thrown: a fast scroll or a
    // jump from the rail stretches the stars, and they settle as the sky catches up.
    const lag = Math.abs(wanted.scene - shown.scene);
    const warpWanted = smooth(0.03, 0.9, lag) * 0.3 * wake.value * warpGain;
    grade.uniforms.uWarp.value += (warpWanted - grade.uniforms.uWarp.value) * Math.min(step * 9, 1);
    shown.scene += (wanted.scene - shown.scene) * ease;
    shown.scroll += (wanted.scroll - shown.scroll) * ease;
    pointer.x += (pointer.targetX - pointer.x) * 0.04;
    pointer.y += (pointer.targetY - pointer.y) * 0.04;
    // The wake stays off behind the posts: digits must never compete with reading.
    const wakeOn = !wanted.rest;
    wake.value += ((wakeOn ? 1 : 0) - wake.value) * ease;
    shared.uPush.value = PUSH * wake.value;
    grade.uniforms.uRefract.value = REFRACT * wake.value;
    stepWake(step, wakeOn, seconds);
    draw(seconds, seconds, shown.scene, shown.scroll);
    frame = requestAnimationFrame(tick);
  };

  // Without motion, each scene appears whole and nothing travels between them.
  const drawStill = () => {
    const view = getView();
    draw(0, 10, Math.round(view.scene), view.scroll);
    frame = 0;
  };
  const onStillScroll = () => {
    if (!frame) frame = requestAnimationFrame(drawStill);
  };

  let sizedWidth = window.innerWidth;
  let sizedHeight = window.innerHeight;
  const onResize = () => {
    // A phone's address bar changes the height mid-scroll. Rebuilding every render target for that
    // would stutter, and the canvas stretching by a few percent cannot be seen.
    const barOnly =
      window.innerWidth === sizedWidth &&
      Math.abs(window.innerHeight - sizedHeight) < 200 &&
      window.matchMedia('(pointer: coarse)').matches;
    if (barOnly) return;
    sizedWidth = window.innerWidth;
    sizedHeight = window.innerHeight;
    resize();
    if (reducedMotion) drawStill();
  };
  const onContextLost = (event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    onLost();
  };

  resize();
  window.addEventListener('resize', onResize);
  canvas.addEventListener('webglcontextlost', onContextLost);
  if (reducedMotion) {
    drawStill();
    window.addEventListener('scroll', onStillScroll, { passive: true });
  } else {
    glyphAtlas().then((texture) => {
      if (stopped) texture.dispose();
      else atlas.value = texture;
    });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPress, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('blur', onRelease);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onLift, { passive: true });
    frame = requestAnimationFrame(tick);
  }

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onStillScroll);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onPress);
    window.removeEventListener('pointerup', onRelease);
    window.removeEventListener('pointercancel', onRelease);
    window.removeEventListener('blur', onRelease);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('touchend', onLift);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    atlas.value?.dispose();
    [...surfaces, trailA, trailB, hazeTarget].forEach((target) => target.dispose());
    composer.dispose();
    scene.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    hazeGeometry.dispose();
    hazeMaterial.dispose();
    bakeMaterial.dispose();
    trailMaterial.dispose();
    renderer.dispose();
  };
}
