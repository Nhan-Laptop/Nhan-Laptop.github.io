/* GLSL for the galaxy. All colour work happens in linear HDR; OutputPass tone-maps. */

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aSeed;
uniform float uScale;      // drawing-buffer height / (2 tan(fov/2))
uniform float uPixelRatio;
uniform float uMaxSize;
uniform float uTime;
uniform float uFade;
uniform float uTwinkle;
uniform float uNear;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 0.001);
  float px = aSize * uScale / dist;
  float alpha = aBright;
  float minPx = 1.35 * uPixelRatio;
  // Energy-conserving sub-pixel stars: shrink brightness, not size, so nothing shimmers.
  if (px < minPx) { alpha *= px / minPx; px = minPx; }
  px = min(px, uMaxSize * uPixelRatio);
  alpha *= smoothstep(uNear * 0.12, uNear, dist);              // fade sprites brushing the lens
  alpha *= 1.0 - uTwinkle * 0.22 * (0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 60.0));
  vColor = color;
  vAlpha = alpha * uFade;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = px;
}`;

export const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 14.0);
  float halo = exp(-r2 * 3.5) * 0.16;
  gl_FragColor = vec4(vColor, (core + halo) * vAlpha);
}`;

export const NEBULA_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float soft = exp(-r2 * 3.2) * (1.0 - r2);
  // cheap wisps: two offset lobes per sprite
  float lobe = exp(-dot(p - vec2(0.25, -0.1), p - vec2(0.25, -0.1)) * 6.0);
  gl_FragColor = vec4(vColor, (soft * 0.75 + lobe * 0.35) * vAlpha);
}`;

export const DUST_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 2.6) * (1.0 - r2);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

/** Dust uses its own vertex shader: no sub-pixel trick, larger clamp, fades when near. */
export const DUST_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aSeed;
uniform float uScale;
uniform float uPixelRatio;
uniform float uMaxSize;
uniform float uFade;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 0.001);
  float px = aSize * uScale / dist;
  float alpha = aBright * smoothstep(2.5, 14.0, dist);
  if (px < 2.0 * uPixelRatio) { alpha *= px / (2.0 * uPixelRatio); px = 2.0 * uPixelRatio; }
  px = min(px, uMaxSize * uPixelRatio);
  vColor = color;
  vAlpha = alpha * uFade;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = px;
}`;

/** Unresolved starlight + dust lanes painted on a few stacked disk planes. */
export const GLOW_VERT = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const GLOW_FRAG = /* glsl */ `
precision highp float;
varying vec2 vPos;
uniform float uIntensity;
uniform float uB;
uniform float uR0;
#define PI 3.14159265
#define TAU 6.2831853
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float ridged(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++){ float n = 1.0 - abs(noise(p) * 2.0 - 1.0); v += a * n * n; p = m * p; a *= 0.5; }
  return v;
}
float arm(float r, float th, float base, float w){
  float s = base + log(max(r, uR0 * 0.6) / uR0) / uB;
  float d = mod(th - s + PI, TAU) - PI;
  float x = d * r;
  return exp(-x * x / (w * w));
}
float arms(float r, float th, float w){
  return arm(r, th, 0.0, w) + arm(r, th, PI, w) + 0.5 * arm(r, th, PI * 0.5, w * 0.8) + 0.5 * arm(r, th, PI * 1.5, w * 0.8);
}
void main(){
  vec2 p = vPos;
  // swirl the noise domain along the spiral so texture follows the arms
  float r = length(p);
  float th = atan(p.y, p.x);
  float sw = th - log(max(r, 1.0) / uR0) / uB;
  vec2 q = vec2(cos(sw), sin(sw)) * r;
  float n = fbm(q * 0.16 + 3.1);
  float fine = fbm(q * 0.55 - 7.0);

  float w = 1.5 + 0.07 * r;
  float a = arms(r, th, w) * smoothstep(uR0 * 0.75, uR0 * 1.35, r);
  float disk = exp(-r / 12.5);
  float bar = exp(-(p.x * p.x) / 30.0 - (p.y * p.y) / 3.2);
  float bulge = exp(-r * r / 9.0);

  vec3 armCol  = vec3(0.56, 0.68, 1.0);
  vec3 diskCol = vec3(1.0, 0.85, 0.68);
  vec3 coreCol = vec3(1.0, 0.76, 0.48);

  vec3 col = diskCol * disk * (0.16 + 0.22 * n)
           + armCol * a * disk * (0.6 + 1.6 * fine) * 1.25
           + coreCol * (bar * 0.55 + bulge * 1.05);

  // Dust: inner edge of each arm, broken up by ridged noise; plus the two bar lanes.
  float lane = arms(r + 1.2 + 0.04 * r, th, w * 0.42) * smoothstep(uR0 * 0.8, uR0 * 1.7, r);
  lane *= 0.35 + 1.1 * ridged(q * 0.32 + 1.7);
  float side = p.x >= 0.0 ? 1.0 : -1.0;
  float barLane = 0.55 * exp(-pow((p.y - side * (1.25 + abs(p.x) * 0.05)) / 0.55, 2.0)) * smoothstep(0.8, 2.4, abs(p.x)) * exp(-p.x * p.x / 70.0);
  float dust = clamp(lane * 0.95 + barLane * 0.9 + (fine - 0.5) * 0.25, 0.0, 1.0);
  col *= 1.0 - dust * 0.8;

  float edge = 1.0 - smoothstep(38.0, 60.0, r);
  gl_FragColor = vec4(col * uIntensity * edge, 1.0);
}`;

/** A camera-facing glow for the bulge — the brightest, most bloomed part of the image. */
export const CORE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  mv.xy += position.xy * scale;
  gl_Position = projectionMatrix * mv;
}`;

export const CORE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uIntensity;
void main(){
  float r = length(vUv);
  float g = exp(-r * r * 10.0) * 0.9 + exp(-r * 5.0) * 0.16;
  vec3 col = mix(vec3(1.0, 0.66, 0.38), vec3(1.0, 0.93, 0.82), exp(-r * r * 30.0));
  gl_FragColor = vec4(col * g * uIntensity, 1.0) * (1.0 - smoothstep(0.8, 1.0, r));
}`;

/** Background galaxies: tiny inclined discs on random planes. */
export const FAR_GALAXY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = exp(-r * r * 6.0) * 0.9 + exp(-r * r * 60.0) * 1.2;
  gl_FragColor = vec4(uColor, a * (1.0 - smoothstep(0.85, 1.0, r)) * 0.6);
}`;
export const FAR_GALAXY_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
