// One WebGL particle cloud that travels between a galaxy and planetary scenes.
// Star motion lives in the vertex shader and planet surfaces are baked once, so
// scrolling only changes uniforms and React never re-renders per frame.

import { SCENES, STRIDE, buildField, buildFormations, buildMeta } from './formations.js';

// How far a star at this depth rises as the page scrolls.
// depth: 0 = far, 1 = nearest. scroll: 0 = page top, 1 = page bottom.
// Returns a shift in clip space, where the viewport is 2.0 tall. Stars start as
// low as y = -3.2, so the 1.3 maximum never exposes empty sky. The squared depth
// keeps most stars slow so they read as distant behind the moving planets.
const PARALLAX = `
float parallax(float depth, float scroll) {
  return scroll * (0.12 + depth * depth * 1.18);
}
`;

const FIELD_VERTEX = `
attribute vec4 aField;  // x, y, depth, size
attribute vec2 aFieldMeta; // phase, alpha
uniform float uTime, uScroll, uAspect, uDpr;
uniform vec2 uPointer;
varying vec4 vColor;
${PARALLAX}
void main() {
  float depth = aField.z;
  vec2 pos = aField.xy;
  pos.y += parallax(depth, uScroll);
  pos += uPointer * depth * 0.03;
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
  float phase = aFieldMeta.x;
  float twinkle = 0.62 + 0.38 * sin(uTime * (0.5 + phase * 1.9) + phase * 40.0);
  gl_PointSize = aField.w * (1.0 + depth) * uDpr;
  vColor = vec4(mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.95, 0.88), phase), aFieldMeta.y * twinkle);
}
`;

const CAMERA_GLSL = `
uniform vec3 uCam, uRight, uUp, uFwd;
uniform vec2 uProj, uOffset;
vec4 project(vec3 world) {
  vec3 v = world - uCam;
  float w = dot(v, uFwd);
  return vec4(dot(v, uRight) * uProj.x + uOffset.x * w, dot(v, uUp) * uProj.y + uOffset.y * w, 0.0, w);
}
`;

const STAR_VERTEX = `
attribute vec4 aA0, aA1, aB0, aB1; // a h theta size | rgb alpha
attribute vec2 aMeta;              // phase, delay
uniform float uTime, uBloom, uMorph, uPx, uFlash, uMinSize, uMaxSize, uTiltA, uTiltB;
uniform vec4 uOrbitA, uOrbitB;
uniform vec2 uSolid;  // radius and opacity of the body at the origin
uniform vec3 uLight;
varying vec4 vColor;
${CAMERA_GLSL}

// Density wave: every orbit is an ellipse turned a little further than the one
// inside it. Stars also linger near each ellipse's long axis, which is where the
// arms appear. Stars keep moving but the arms hold their shape and never wind up.
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

  // Stars brighten in the arm, dim in the dust lane on its inner edge, and
  // hydrogen only glows while it crosses the arm.
  float wave = cos(2.0 * m);
  float arm = 0.4 + 1.25 * pow(0.5 + 0.5 * wave, 2.0);
  float dust = 1.0 - 0.6 * smoothstep(0.78, 1.0, cos(2.0 * m + 0.62));
  float hydrogen = step(1.5, color.r / (color.g + 0.01));
  float shaped = arm * dust * mix(1.0, arm, hydrogen);
  gain = mix(1.0, mix(1.0, shaped, smoothstep(0.45, 1.25, a)), orbit.w / 0.34);
  return p;
}

void main() {
  float phase = aMeta.x;
  float stagger = 0.45;
  float t = clamp(uMorph * (1.0 + stagger) - aMeta.y * stagger, 0.0, 1.0);
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
  float b = clamp((uBloom - aMeta.y * 0.9) / 2.3, 0.0, 1.0);
  b = 1.0 - pow(1.0 - b, 4.0);
  pos *= mix(0.02, 1.0, b);

  gl_Position = project(pos);
  if (gl_Position.w < 0.08) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    return;
  }

  float alpha = mix(aA1.a * gainA, aB1.a * gainB, t) + flight * uFlash;

  // The body at the origin hides what is behind it and shadows what is past it.
  if (uSolid.x > 0.0) {
    vec3 ray = pos - uCam;
    float along = -dot(uCam, ray) / dot(ray, ray);
    if (along > 0.0 && along < 1.0) {
      float miss = length(uCam + ray * along);
      alpha *= mix(1.0, smoothstep(uSolid.x * 0.985, uSolid.x * 1.02, miss), uSolid.y);
    }
    float toward = dot(pos, uLight);
    if (toward < 0.0) {
      float axis = length(pos - uLight * toward);
      alpha *= mix(1.0, 0.05 + 0.95 * smoothstep(uSolid.x * 0.94, uSolid.x * 1.06, axis), uSolid.y);
    }
  }

  float twinkle = 0.7 + 0.3 * sin(uTime * (0.5 + phase * 1.9) + phase * 40.0);
  float size = mix(aA0.w, aB0.w, t) * uPx / gl_Position.w;
  gl_PointSize = clamp(size, uMinSize, uMaxSize);
  vColor = vec4(mix(aA1.rgb, aB1.rgb, t), alpha * twinkle);
}
`;

const POINT_FRAGMENT = `
precision mediump float;
varying vec4 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float glow = exp(-dot(d, d) * 16.0);
  gl_FragColor = vec4(vColor.rgb * vColor.a * glow, 0.0);
}
`;

const QUAD_VERTEX = `
attribute vec2 aQuad;
varying vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

const QUAD_FRAGMENT = `
precision mediump float;
uniform sampler2D uHaze;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uHaze, vUv).rgb, 0.0);
}
`;

const HIGHP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

// Rendered once per surface at startup: noise is too expensive to run per pixel
// per frame, but looking it up in a texture is nearly free.
const BAKE_FRAGMENT = `${HIGHP}
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
  for (int i = 0; i < 6; i++) {
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
attribute vec2 aQuad;
uniform vec3 uCenter;
uniform float uExtent;
varying vec3 vWorld;
${CAMERA_GLSL}
void main() {
  vWorld = uCenter + (uRight * aQuad.x + uUp * aQuad.y) * uExtent;
  gl_Position = project(vWorld);
}
`;

const BODY_FRAGMENT = `${HIGHP}
uniform vec3 uCam, uCenter, uLight, uAtmo;
uniform vec2 uRing;
uniform float uR, uVis, uMode, uSpin, uTilt, uExtentRadii, uPixelRadius;
uniform sampler2D uTex;
varying vec3 vWorld;
void main() {
  vec3 rd = normalize(vWorld - uCam);
  vec3 oc = uCam - uCenter;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + uR * uR;
  float miss = sqrt(max(dot(oc, oc) - b * b, 0.0)) / uR;
  float edge = max(0.9 / uPixelRadius, 0.002);
  float surface = smoothstep(1.0, 1.0 - edge, miss);

  vec3 side = normalize(oc - rd * b);
  float above = max(miss - 1.0, 0.0);
  vec3 glow;
  if (uMode > 2.5) {
    glow = uAtmo * (0.95 * exp(-above * 3.2) + 0.2 * exp(-above * 0.75));
  } else {
    glow = uAtmo * 0.85 * exp(-above * 15.0) * smoothstep(-0.32, 0.55, dot(side, uLight));
  }
  glow *= smoothstep(uExtentRadii, uExtentRadii * 0.72, miss);

  vec3 col = vec3(0.0);
  if (h > 0.0) {
    vec3 n = (oc + rd * (-b - sqrt(h))) / uR;
    float ct = cos(uTilt), st = sin(uTilt);
    vec3 q = vec3(ct * n.x + st * n.y, -st * n.x + ct * n.y, n.z);
    vec2 uv = vec2(atan(q.z, q.x) / 6.28318 + 0.5 + uSpin, asin(clamp(q.y, -1.0, 1.0)) / 3.14159 + 0.5);
    vec4 tex = texture2D(uTex, uv);
    float ndl = dot(n, uLight);
    float lit = smoothstep(-0.06, 0.82, ndl);

    if (uMode > 2.5) {
      float limb = pow(max(dot(n, -rd), 0.0), 0.45);
      col = mix(vec3(1.0, 0.52, 0.16), vec3(1.0, 0.95, 0.76), limb + tex.a * 0.22);
    } else {
      // Rings cast a band of shadow across the planet they circle.
      if (uRing.y > 0.0) {
        vec3 lq = vec3(ct * uLight.x + st * uLight.y, -st * uLight.x + ct * uLight.y, uLight.z);
        float cross = -q.y / lq.y;
        if (cross > 0.0) {
          float r = length((q + lq * cross).xz);
          lit *= 1.0 - 0.68 * smoothstep(uRing.x - 0.03, uRing.x + 0.03, r) * smoothstep(uRing.y + 0.03, uRing.y - 0.03, r);
        }
      }
      col = tex.rgb * (0.012 + lit * 1.02);
      if (uMode > 1.5) {
        col += vec3(1.0, 0.34, 0.07) * tex.a * (1.25 - lit * 0.55);
      } else if (uMode > 0.5) {
        col += vec3(0.95, 0.97, 1.0) * pow(max(dot(n, normalize(uLight - rd)), 0.0), 70.0) * tex.a * lit * 0.85;
      }
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.2);
      col += uAtmo * rim * (0.03 + lit) * 0.95;
    }
  }
  gl_FragColor = vec4((col * surface + glow * (1.0 - surface)) * uVis, surface * uVis);
}
`;

// The haze is huge and blurry: at quarter resolution it costs 1/16 of the fill
// and upscales without visible loss.
const HAZE_SCALE = 0.25;
const SLOW_FRAME_MS = 1000 / 28;
const TEXTURES = { giant: 0, ocean: 1, lava: 2, rock: 3 };
// Sunlight for every scene that has no star of its own.
const SUN = (() => {
  const v = [-0.66, 0.34, 0.67];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed to compile');
  }
  return shader;
}

function makeProgram(gl, vertex, fragment, uniformNames) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Shader program failed to link');
  }
  const u = {};
  for (const name of uniformNames) u[name] = gl.getUniformLocation(program, name);
  return { program, u };
}

/**
 * Starts the sky on a canvas. getView() returns { scene, scroll }: a fractional
 * scene index and page progress from 0 to 1. Returns a stop function, or null
 * when WebGL is unavailable so the caller can show the CSS fallback.
 */
export function startSky(canvas, { getView, isPaused, reducedMotion, onLost }) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const narrow = () => window.innerWidth < 720;
  const count = narrow() ? 15000 : 42000;
  const bakeSize = narrow() ? 512 : 1024;

  const stars = makeProgram(gl, STAR_VERTEX, POINT_FRAGMENT, [
    'uCam', 'uRight', 'uUp', 'uFwd', 'uProj', 'uOffset', 'uTime', 'uBloom', 'uMorph', 'uPx', 'uFlash',
    'uMinSize', 'uMaxSize', 'uTiltA', 'uTiltB', 'uOrbitA', 'uOrbitB', 'uSolid', 'uLight',
  ]);
  const field = makeProgram(gl, FIELD_VERTEX, POINT_FRAGMENT, ['uTime', 'uScroll', 'uAspect', 'uDpr', 'uPointer']);
  const quad = makeProgram(gl, QUAD_VERTEX, QUAD_FRAGMENT, []);
  const bake = makeProgram(gl, QUAD_VERTEX, BAKE_FRAGMENT, ['uKind']);
  const body = makeProgram(gl, BODY_VERTEX, BODY_FRAGMENT, [
    'uCam', 'uRight', 'uUp', 'uFwd', 'uProj', 'uOffset', 'uCenter', 'uExtent', 'uLight', 'uAtmo', 'uRing',
    'uR', 'uVis', 'uMode', 'uSpin', 'uTilt', 'uExtentRadii', 'uPixelRadius',
  ]);

  const makeBuffer = (data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  };
  const { formations, hazeCount } = buildFormations(count);
  const formationBuffers = formations.map(makeBuffer);
  const metaBuffer = makeBuffer(buildMeta(count));
  const fieldCount = narrow() ? 1600 : 3400;
  const fieldBuffer = makeBuffer(buildField(fieldCount));
  const quadBuffer = makeBuffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
  const billboardBuffer = makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

  const pointer2 = (program, name, buffer, size, stride, offset) => {
    const location = gl.getAttribLocation(program.program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
  };

  const texture = (wrapS) => {
    const made = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, made);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return made;
  };

  // Bake each planet surface into a texture that wraps around the longitude.
  const target = gl.createFramebuffer();
  gl.disable(gl.BLEND);
  const surfaces = Object.values(TEXTURES).map((kind) => {
    const made = texture(gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bakeSize, bakeSize / 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, made, 0);
    gl.viewport(0, 0, bakeSize, bakeSize / 2);
    gl.useProgram(bake.program);
    gl.uniform1f(bake.u.uKind, kind);
    pointer2(bake, 'aQuad', quadBuffer, 2, 2, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return made;
  });

  const hazeTexture = texture(gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.enable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);

  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const onPointer = (event) => {
    pointer.targetX = event.clientX / window.innerWidth - 0.5;
    pointer.targetY = 0.5 - event.clientY / window.innerHeight;
  };

  // Quality steps down at most twice on machines that cannot keep up.
  let dprLimit = narrow() ? 1.5 : 1.75;
  let starsDrawn = count - hazeCount;
  let dpr = 1;
  let aspect = 1;
  let tall = false;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    aspect = window.innerWidth / window.innerHeight;
    tall = aspect < 1;

    gl.bindTexture(gl.TEXTURE_2D, hazeTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      Math.ceil(canvas.width * HAZE_SCALE), Math.ceil(canvas.height * HAZE_SCALE),
      0, gl.RGBA, gl.UNSIGNED_BYTE, null,
    );
  };

  const camera = (from, to, mix, seconds) => {
    const lens = (scene) => {
      const c = scene.camera;
      return {
        yaw: c.yaw,
        pitch: c.pitch,
        dist: c.dist * (tall ? c.tallDist : 1),
        offset: tall ? c.tall : c.wide,
      };
    };
    const a = lens(from);
    const b = lens(to);
    const yaw = lerp(a.yaw, b.yaw, mix) + seconds * 0.006 + pointer.x * 0.09;
    const pitch = lerp(a.pitch, b.pitch, mix) - pointer.y * 0.05;
    const dist = lerp(a.dist, b.dist, mix);
    const cam = [
      Math.cos(pitch) * Math.sin(yaw) * dist,
      Math.sin(pitch) * dist,
      Math.cos(pitch) * Math.cos(yaw) * dist,
    ];
    const fwd = cam.map((v) => -v / dist);
    const rightLength = Math.hypot(fwd[2], fwd[0]) || 1;
    const right = [-fwd[2] / rightLength, 0, fwd[0] / rightLength];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    return {
      cam, fwd, right, up,
      offset: [lerp(a.offset[0], b.offset[0], mix), lerp(a.offset[1], b.offset[1], mix)],
    };
  };

  const setCamera = (program, view) => {
    gl.uniform3fv(program.u.uCam, view.cam);
    gl.uniform3fv(program.u.uRight, view.right);
    gl.uniform3fv(program.u.uUp, view.up);
    gl.uniform3fv(program.u.uFwd, view.fwd);
    gl.uniform2f(program.u.uProj, FOCAL / aspect, FOCAL);
    gl.uniform2fv(program.u.uOffset, view.offset);
  };

  // Positions planets on their orbits and fades them with the morph.
  const placeBodies = (scene, vis, seconds, view) => {
    const placed = [];
    if (vis <= 0.001) return placed;
    for (const item of scene.bodies) {
      let center = [0, 0, 0];
      if (item.orbit) {
        const [a, speed, start] = item.orbit;
        const angle = start + seconds * speed;
        const dip = item.planeTilt || 0;
        const y = Math.sin(angle) * a * Math.sin(dip);
        center = [Math.cos(angle) * a, y, Math.sin(angle) * a * Math.cos(dip)];
      }
      const away = center.map((v, i) => v - view.cam[i]);
      placed.push({ item, center, vis, depth: Math.hypot(...away) });
    }
    return placed.sort((p, q) => q.depth - p.depth);
  };

  const drawBody = ({ item, center, vis, depth }, sunCenter, seconds) => {
    let light = SUN;
    if (sunCenter) {
      const to = sunCenter.map((v, i) => v - center[i]);
      const length = Math.hypot(...to) || 1;
      light = to.map((v) => v / length);
    }
    const extentRadii = item.sun ? 6 : 1.75;
    gl.uniform3fv(body.u.uCenter, center);
    gl.uniform1f(body.u.uExtent, item.r * extentRadii);
    gl.uniform1f(body.u.uExtentRadii, extentRadii);
    gl.uniform3fv(body.u.uLight, light);
    gl.uniform3fv(body.u.uAtmo, item.atmo);
    gl.uniform2fv(body.u.uRing, item.ring || [0, 0]);
    gl.uniform1f(body.u.uR, item.r);
    gl.uniform1f(body.u.uVis, vis);
    gl.uniform1f(body.u.uMode, item.mode);
    gl.uniform1f(body.u.uSpin, seconds * item.spin);
    gl.uniform1f(body.u.uTilt, item.tilt || 0);
    gl.uniform1f(body.u.uPixelRadius, (item.r / depth) * FOCAL * canvas.height * 0.5);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, surfaces[TEXTURES[item.tex]]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const formationOf = (scene) => {
    const index = SCENES.indexOf(scene);
    if (scene.formation !== undefined) return scene.formation;
    return SCENES.slice(0, index + 1).filter((item) => item.formation === undefined).length - 1;
  };

  const draw = (seconds, bloom, sceneValue, scroll) => {
    const low = Math.min(Math.floor(sceneValue), SCENES.length - 1);
    const high = Math.min(low + 1, SCENES.length - 1);
    const from = SCENES[low];
    const to = SCENES[high];
    const morph = smooth(0.1, 0.9, sceneValue - low);
    const view = camera(from, to, morph, seconds);

    const hazePx = (height) => (height * 10) / 720;
    const px = hazePx(canvas.height);
    const fromVis = 1 - smooth(0, 0.42, morph);
    const toVis = smooth(0.58, 1, morph);
    const solid = morph < 0.5 ? [from.radius, fromVis] : [to.radius, toVis];

    const useStars = () => {
      gl.useProgram(stars.program);
      const a = formationBuffers[formationOf(from)];
      const b = formationBuffers[formationOf(to)];
      pointer2(stars, 'aA0', a, 4, STRIDE, 0);
      pointer2(stars, 'aA1', a, 4, STRIDE, 4);
      pointer2(stars, 'aB0', b, 4, STRIDE, 0);
      pointer2(stars, 'aB1', b, 4, STRIDE, 4);
      pointer2(stars, 'aMeta', metaBuffer, 2, 2, 0);
      setCamera(stars, view);
      gl.uniform1f(stars.u.uTime, seconds);
      gl.uniform1f(stars.u.uBloom, bloom);
      gl.uniform1f(stars.u.uMorph, morph);
      gl.uniform4fv(stars.u.uOrbitA, from.orbit);
      gl.uniform4fv(stars.u.uOrbitB, to.orbit);
      gl.uniform1f(stars.u.uTiltA, from.tilt);
      gl.uniform1f(stars.u.uTiltB, to.tilt);
      gl.uniform2fv(stars.u.uSolid, solid);
      gl.uniform3fv(stars.u.uLight, SUN);
    };

    // Haze, at quarter resolution.
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hazeTexture, 0);
    const hazeWidth = Math.ceil(canvas.width * HAZE_SCALE);
    const hazeHeight = Math.ceil(canvas.height * HAZE_SCALE);
    gl.viewport(0, 0, hazeWidth, hazeHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    useStars();
    gl.uniform1f(stars.u.uPx, px * HAZE_SCALE);
    gl.uniform1f(stars.u.uFlash, 0);
    gl.uniform1f(stars.u.uMinSize, 1);
    gl.uniform1f(stars.u.uMaxSize, Math.min(maxPoint, 130 * dpr * HAZE_SCALE * 2));
    gl.drawArrays(gl.POINTS, 0, hazeCount);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Distant stars.
    gl.useProgram(field.program);
    pointer2(field, 'aField', fieldBuffer, 4, 6, 0);
    pointer2(field, 'aFieldMeta', fieldBuffer, 2, 6, 4);
    gl.uniform1f(field.u.uTime, seconds);
    gl.uniform1f(field.u.uScroll, scroll);
    gl.uniform1f(field.u.uAspect, aspect);
    gl.uniform1f(field.u.uDpr, dpr);
    gl.uniform2f(field.u.uPointer, pointer.x, pointer.y);
    gl.drawArrays(gl.POINTS, 0, fieldCount);

    gl.useProgram(quad.program);
    pointer2(quad, 'aQuad', quadBuffer, 2, 2, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hazeTexture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Solid bodies, far to near.
    const placed = [...placeBodies(from, fromVis, seconds, view), ...placeBodies(to, toVis, seconds, view)];
    if (placed.length) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(body.program);
      pointer2(body, 'aQuad', billboardBuffer, 2, 2, 0);
      setCamera(body, view);
      for (const entry of placed.sort((p, q) => q.depth - p.depth)) {
        const owner = entry.item.orbit ? [0, 0, 0] : null;
        drawBody(entry, owner, seconds);
      }
      gl.blendFunc(gl.ONE, gl.ONE);
    }

    // Sharp stars on top.
    useStars();
    gl.uniform1f(stars.u.uPx, px);
    gl.uniform1f(stars.u.uFlash, 0.3);
    gl.uniform1f(stars.u.uMinSize, 1.05 * dpr);
    gl.uniform1f(stars.u.uMaxSize, Math.min(maxPoint, 16 * dpr));
    gl.drawArrays(gl.POINTS, hazeCount, starsDrawn);
  };

  let frame = 0;
  let previous = 0;
  let slowFrames = 0;
  let sampled = 0;
  let pausedFor = 0;
  let odd = false;
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
      } else {
        starsDrawn = Math.max(6000, Math.floor(starsDrawn * 0.55));
      }
    }
    sampled = 0;
    slowFrames = 0;
  };

  const tick = (now) => {
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
    shown.scene += (wanted.scene - shown.scene) * ease;
    shown.scroll += (wanted.scroll - shown.scroll) * ease;
    pointer.x += (pointer.targetX - pointer.x) * 0.04;
    pointer.y += (pointer.targetY - pointer.y) * 0.04;
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

  const onResize = () => {
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
    window.addEventListener('pointermove', onPointer, { passive: true });
    frame = requestAnimationFrame(tick);
  }

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onStillScroll);
    window.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    [...formationBuffers, metaBuffer, fieldBuffer, quadBuffer, billboardBuffer].forEach((b) => gl.deleteBuffer(b));
    [...surfaces, hazeTexture].forEach((t) => gl.deleteTexture(t));
    gl.deleteFramebuffer(target);
  };
}

const FOCAL = 1.7;
