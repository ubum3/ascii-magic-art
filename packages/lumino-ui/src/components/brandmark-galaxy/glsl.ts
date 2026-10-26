import { BRAND_GLSL } from "../../backgrounds/gl.js";

// Shared by both passes: the galaxy's place and shape, and its arms.
const GALAXY = `
uniform vec3 uGalaxy;  // centre x, y and radius, in units of the height
uniform vec2 uShape;   // cos of the tilt, and the major axis's angle
uniform float uTime;
#define PI 3.14159265
// The spiral: two arms, logarithmic, turning slowly as one.
const float ARM_R0 = 0.07;
const float ARM_WIND = 2.3;
float armAngle(float r) { return log(max(r, 0.004) / ARM_R0) * ARM_WIND + uTime * 0.035; }
// Galaxy plane (x along the major axis, y towards us) to the screen, and back.
vec2 toScreen(vec2 q) {
  float c = cos(uShape.y), s = sin(uShape.y);
  vec2 v = vec2(q.x, q.y * uShape.x) * uGalaxy.z;
  return uGalaxy.xy + vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
vec2 toPlane(vec2 p) {
  float c = cos(uShape.y), s = sin(uShape.y);
  vec2 v = (p - uGalaxy.xy) / uGalaxy.z;
  v = vec2(c * v.x + s * v.y, -s * v.x + c * v.y);
  return vec2(v.x, v.y / uShape.x);
}
`;

/** The glow under the stars: core light, arm light and dust lanes, a faint halo. */
export const GALAXY_GLOW = `#version 300 es
precision highp float;
#define MARK_SPREAD 0.1
uniform sampler2D uPalette;
uniform sampler2D uMark; // unused: BRAND_GLSL's markSD wants it
uniform vec2 uResolution;
uniform float uMarkSide;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
${GALAXY}
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 q = toPlane(p);
  float r = length(q);
  float th = atan(q.y, q.x);
  float arm = pow(0.5 + 0.5 * cos(2.0 * (th - armAngle(r))), 2.5);
  float lane = pow(0.5 + 0.5 * cos(2.0 * (th - armAngle(r)) - 0.9), 6.0);
  float dust = fbm(q * 5.0 + vec2(uTime * 0.01, 0.0));

  vec3 col = vec3(0.067, 0.063, 0.075);
  vec3 tint = palette(clamp(0.05 + r * 0.85, 0.0, 1.0));
  col += tint * (arm * 0.8 + 0.2) * exp(-r * 1.8) * 0.5 * (0.5 + 0.7 * dust);
  col *= 1.0 - lane * smoothstep(0.08, 0.3, r) * smoothstep(1.0, 0.4, r) * 0.6 * dust;
  col += palette(0.12) * exp(-r * 7.0) * 0.45 + palette(0.3) * exp(-r * 3.0) * 0.12;
  col += palette(0.85) * exp(-length(p - uGalaxy.xy) / uGalaxy.z * 1.6) * 0.06;

  // Stars far behind.
  vec2 sc = floor(p * 120.0);
  float sh = hash12(sc);
  col += vec3(0.7, 0.72, 0.9) * step(0.992, sh) * smoothstep(0.35, 0.0, length(fract(p * 120.0) - 0.5)) * 0.5;

  vec2 mid = (vUv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.5, 1.0, smoothstep(0.1, 0.45, length(mid * vec2(0.8, 1.1))));
  outColor = vec4(col + (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0, 1.0);
}`;

/**
 * The stars, one point each, placed from gl_VertexID (no buffers):
 *   [0, uMarkN)                    the nucleus: points inside the mark, upright, twinkling
 *   [uMarkN, uMarkN + uStreamN)    streamers: born on the mark, they unwind along an arm
 *   the rest                       the disk: stars along the arms and between them
 */
export const GALAXY_STARS_VS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uPalette;
uniform highp sampler2D uPoints;   // the mark's fill samples, RG32F, 0 to 1, y down
uniform vec2 uResolution;
uniform float uMarkSide;
uniform float uPointScale;          // device pixels per CSS pixel
uniform int uMarkN;
uniform int uStreamN;
out vec3 vColor;
out float vSharp;
${GALAXY}
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(inout uint s) { s = pcg(s); return float(s) / 4294967295.0; }
vec3 palette(float t) { return texture(uPalette, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb; }

vec2 markPoint(int i) {
  int w = textureSize(uPoints, 0).x;
  vec2 pt = texelFetch(uPoints, ivec2(i % w, i / w), 0).rg;
  return uGalaxy.xy + (pt - 0.5) * vec2(1.0, -1.0) * uMarkSide;
}
vec2 armPoint(float r, float arm, float spread) {
  float th = arm * PI + armAngle(r) + spread;
  return toScreen(vec2(cos(th), sin(th)) * r);
}

void main() {
  int id = gl_VertexID;
  uint s = uint(id) * 9781u + 17u;
  float a = rnd(s), b = rnd(s), c = rnd(s), d = rnd(s);
  vec2 pos;
  float size, bright;
  vec3 col;
  float sharp = 1.0;

  if (id < uMarkN) {
    pos = markPoint(id);
    float y = (pos.y - uGalaxy.y) / uMarkSide + 0.5;
    col = mix(palette(0.32), mix(palette(0.02), vec3(1.0, 0.95, 0.9), 0.4), smoothstep(0.15, 0.85, y));
    bright = 0.55 + 0.45 * sin(uTime * (1.0 + 2.0 * a) + b * 40.0);
    size = 1.6 + 1.6 * c;
  } else if (id < uMarkN + uStreamN) {
    // Leave the mark, swing out along an arm, fade at the rim.
    float phase = fract(uTime * (0.025 + 0.02 * a) + b);
    vec2 from = markPoint(int(c * float(uMarkN)));
    float r = mix(0.1, 1.0, pow(phase, 0.8));
    float arm = step(0.5, d);
    vec2 to = armPoint(r, arm, (rnd(s) - 0.5) * mix(0.15, 0.6, r));
    pos = mix(from, to, smoothstep(0.0, 0.35, phase));
    col = palette(0.05 + r * 0.8);
    bright = smoothstep(0.0, 0.05, phase) * smoothstep(1.0, 0.6, phase) * 1.2;
    size = 1.4 + 1.6 * rnd(s);
  } else {
    float r = min(1.15, -log(1.0 - a * 0.97) * 0.36 + 0.06);
    float onArm = step(0.28, b);
    float jitter = (c + rnd(s) + rnd(s) - 1.5) * mix(2.6, mix(0.25, 0.75, r), onArm);
    pos = armPoint(r, step(0.5, d), jitter);
    col = mix(palette(0.05 + r * 0.9), vec3(0.9, 0.9, 1.0), step(0.97, rnd(s)) * 0.6);
    bright = mix(0.5, 1.6, onArm) * smoothstep(1.15, 0.55, r) * smoothstep(0.06, 0.2, r) * (0.7 + 0.3 * sin(uTime * 1.5 + a * 60.0));
    size = 1.3 + 2.6 * pow(rnd(s), 4.0);
    sharp = 1.4;
  }

  // Calm in the middle, where content sits.
  float aspect = uResolution.x / uResolution.y;
  vec2 mid = (pos - vec2(aspect * 0.5, 0.5)) * vec2(0.8, 1.1);
  bright *= mix(0.3, 1.0, smoothstep(0.1, 0.45, length(mid)));

  vColor = col * bright;
  vSharp = sharp;
  gl_PointSize = size * uPointScale;
  gl_Position = vec4(pos.x / aspect * 2.0 - 1.0, pos.y * 2.0 - 1.0, 0.0, 1.0);
}`;

export const GALAXY_STARS_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vSharp;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 3.5 * vSharp) * (1.0 - smoothstep(0.85, 1.0, r));
  outColor = vec4(vColor * a, 0.0);
}`;
