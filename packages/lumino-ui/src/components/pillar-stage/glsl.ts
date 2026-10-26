import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * The brandmark drawn across the whole box: its two blades as tall light pillars that
 * rise from the bottom corners and lean in to meet at the apex over the content, and
 * its base as a glowing horizon arc below. Distances are analytic (no texture), and
 * the light inside the pillars is fbm flowing up toward the apex.
 */
export const PILLARS = `#version 300 es
precision highp float;
#define MARK_SPREAD 0.1
uniform sampler2D uPalette;
uniform sampler2D uMark; // unused: BRAND_GLSL's markSD wants it
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uIntensity;
uniform vec2 uApex;
uniform vec2 uFootL;
uniform vec2 uFootR;
uniform float uWidth;
uniform float uBow;
uniform vec3 uArc;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

// One pillar from its foot to the apex: x is the signed offset across it (as a share of
// its half-width, -1 to 1 inside), y how far up (0 foot, 1 apex), z the distance outside.
vec3 pillar(vec2 p, vec2 foot, float side) {
  vec2 ba = uApex - foot;
  float h = clamp(dot(p - foot, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 n = normalize(vec2(-ba.y, ba.x)) * side;
  vec2 axis = foot + ba * h - n * uBow * sin(3.14159 * h);
  float across = dot(p - axis, n);
  float half_ = uWidth * pow(1.0 - h, 0.9) * 0.5 + 0.0015;
  return vec3(across / half_, h, max(abs(across) - half_, 0.0));
}

vec3 pillarLight(vec3 q, float side, float t) {
  float h = q.y;
  float inside = smoothstep(1.05, 0.9, abs(q.x));
  float flow = fbm(vec2(q.x * 1.6 + side * 3.0, h * 5.0 - t * 0.35));
  float streak = smoothstep(0.35, 0.9, fbm(vec2(q.x * 3.5 - side, h * 2.0 - t * 0.6)));
  float core = exp(-q.x * q.x * 3.0);
  float tint = side < 0.0 ? mix(0.02, 0.36, h) : mix(0.9, 0.62, h);
  vec3 c = palette(tint + (flow - 0.5) * 0.1);
  float body = inside * (0.18 + 0.55 * flow * flow + 0.6 * streak * core) * (0.55 + 0.45 * smoothstep(0.0, 0.3, h));
  float edge = exp(-abs(abs(q.x) - 1.0) * 18.0) * smoothstep(1.4, 0.9, abs(q.x)) * 0.35;
  float halo = exp(-q.z * 9.0) * 0.22 + exp(-q.z * 40.0) * 0.25;
  return c * (body + halo) + mix(c, vec3(1.0), 0.6) * edge;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float t = uTime;
  vec2 tilt = (uPointer - 0.5) * vec2(0.025, 0.015);

  vec3 col = vec3(0.0);
  float neb = fbm(p * 1.2 + vec2(0.0, -t * 0.01));
  col += palette(0.5 + 0.3 * neb) * pow(neb, 3.0) * 0.16;

  vec3 L = pillar(p + tilt, uFootL, -1.0);
  vec3 R = pillar(p + tilt, uFootR, 1.0);
  col += pillarLight(L, -1.0, t) * uIntensity;
  col += pillarLight(R, 1.0, t) * uIntensity;

  // The base: a horizon arc under the content, brand gradient left to right.
  vec2 ac = p + tilt * 0.5 - uArc.xy;
  float ar = length(ac) - uArc.z;
  float along = clamp(vUv.x, 0.0, 1.0);
  float thick = 0.006 + 0.01 * (1.0 - abs(along - 0.5) * 2.0);
  float band = exp(-max(abs(ar) - thick, 0.0) * 55.0);
  float shimmer = 0.65 + 0.35 * fbm(vec2(atan(ac.x, ac.y) * 9.0 - t * 0.2, ar * 30.0));
  vec3 arcCol = palette(0.06 + along * 0.82);
  col += arcCol * band * shimmer * 0.75 * uIntensity;
  col += mix(arcCol, vec3(1.0), 0.5) * exp(-abs(ar) * 600.0) * 0.6 * uIntensity;
  float below = smoothstep(0.0, -0.25, ar);
  col += palette(0.2 + along * 0.6) * below * 0.08 * (0.6 + 0.4 * neb);

  // The apex: a small star where the pillars meet.
  vec2 a = p - uApex - tilt;
  float star = exp(-length(a) * 26.0) * 0.9 + exp(-abs(a.x) * 160.0) * exp(-abs(a.y) * 7.0) * 0.35 + exp(-abs(a.y) * 160.0) * exp(-abs(a.x) * 9.0) * 0.25;
  col += vec3(1.0, 0.9, 0.85) * star * (0.85 + 0.15 * sin(t * 1.3)) * uIntensity;

  // Dust drifting up through the light.
  vec2 g = p * vec2(70.0, 40.0) + vec2(0.0, -t * 2.0);
  vec2 cell = floor(g);
  float sparkle = step(0.988, hash12(cell)) * smoothstep(0.28, 0.0, length(fract(g) - 0.5 - (hash22(cell) - 0.5) * 0.6));
  float near = exp(-min(L.z, R.z) * 12.0);
  col += vec3(1.0, 0.92, 0.88) * sparkle * near * (0.5 + 0.5 * sin(t * 3.0 + hash12(cell) * 40.0));

  col = tonemap(col * 1.2);
  col += (hash12(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
