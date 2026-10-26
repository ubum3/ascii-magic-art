import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * The brandmark as a black hole: a dark glass horizon with a photon ring along its
 * outline, a thin accretion disk orbiting it (warm where it comes towards you, cool
 * where it goes away), and space lensed to the mark's shape. The lensing pulls the
 * far side of the disk up and around the mark, and bends the stars and dust.
 *
 * Two SDFs of the mark: uMark (sharp, for the outline) and uField (a wide spread,
 * for the lensing, so the bending reaches well past the mark).
 */
export const ACCRETION_LENS = (spread: string, fieldSpread: number) => `#version 300 es
precision highp float;
${spread}
#define FIELD_SPREAD ${fieldSpread.toFixed(6)}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uHole;     // the mark's centre x, y and side, in units of the height
uniform float uMass;    // lensing strength (Einstein radius squared, in mark squares)
uniform float uTilt;    // cos of the disk's inclination: 0 edge-on, 1 face-on
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
#define TAU 6.2831853

float fieldSD(vec2 p) {
  vec2 q = clamp(p, 0.0, 1.0);
  return -(texture(uField, q).r - 0.5) * 2.0 * FIELD_SPREAD + length(p - q);
}

// The mark's middle, in its square: the blades meet above it and the base sits below.
const vec2 CORE = vec2(0.5, 0.5);
const float R_IN = 0.44;
const float R_OUT = 0.92;

// The disk at a point of the mark square: emission (rgb) and coverage (a).
vec4 disk(vec2 q, float t) {
  vec2 dp = q - CORE;
  vec2 plane = vec2(dp.x, dp.y / uTilt);
  float r = length(plane);
  if (r < R_IN * 0.85 || r > R_OUT * 1.15) return vec4(0.0);
  float band = smoothstep(R_IN * 0.9, R_IN * 1.08, r) * smoothstep(R_OUT * 1.1, R_OUT * 0.55, r);
  float phi = atan(plane.y, plane.x) - t * 0.9 / pow(r / R_IN, 1.5);
  vec2 ring = vec2(cos(phi), sin(phi));
  float gas = fbm(ring * 2.2 + vec2(r * 11.0, r * 3.0));
  float lanes = 0.45 + 0.75 * fbm(vec2(r * 26.0, gas * 2.5 + 7.0));
  float heat = 1.0 - smoothstep(R_IN, R_OUT, r);
  // Doppler: the side coming towards us (+x) is brighter and warmer.
  float toward = plane.x / max(r, 1e-4);
  float boost = 1.0 + 0.75 * toward;
  vec3 warm = mix(palette(0.38), mix(palette(0.28), palette(0.05), heat * heat), heat);
  vec3 cool = mix(palette(0.55), mix(palette(0.78), palette(0.9), heat), heat);
  vec3 c = mix(cool, warm, smoothstep(-0.7, 0.7, toward));
  float e = band * (0.15 + 1.0 * gas * lanes) * (0.3 + 0.9 * heat * heat) * boost;
  return vec4(c * e, band);
}

vec3 sky(vec2 q, float t) {
  // Dust: faint domain-warped fbm, so the lensing has something to bend.
  vec2 w = q * 1.3 + vec2(fbm(q * 1.1 + t * 0.01), fbm(q * 1.1 + 4.0));
  float dust = fbm(w * 1.4);
  vec3 c = mix(palette(0.45), palette(0.72), smoothstep(0.3, 0.8, dust)) * pow(dust, 3.0) * 0.3;
  // Stars, two layers.
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 26.0 : 60.0;
    vec2 cell = floor(q * sc);
    float h = hash12(cell + float(i) * 17.0);
    vec2 o = hash22(cell + float(i) * 31.0) * 0.7 + 0.15;
    float dd = length(fract(q * sc) - o);
    float on = step(i == 0 ? 0.93 : 0.9, h);
    c += mix(palette(0.95), vec3(1.0, 0.9, 0.85), hash12(cell + 3.0)) * on * exp(-dd * dd * (i == 0 ? 900.0 : 2400.0)) * (i == 0 ? 1.2 : 0.7) * (0.75 + 0.25 * sin(t * 2.0 + h * 50.0));
  }
  return c;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float S = uHole.z;
  vec2 m = (p - uHole.xy) / S + 0.5;
  float px = 1.0 / (uResolution.y * S);
  float t = uTime;

  // Lensing: pull each ray towards the mark, harder the closer it passes.
  float e = 0.035;
  float fx1 = fieldSD(m + vec2(e, 0.0)), fx0 = fieldSD(m - vec2(e, 0.0));
  float fy1 = fieldSD(m + vec2(0.0, e)), fy0 = fieldSD(m - vec2(0.0, e));
  // The four taps averaged: a smoother distance than one 8-bit sample, for the halos.
  float f = mix(fieldSD(m), (fx1 + fx0 + fy1 + fy0) * 0.25, 0.75);
  vec2 g = vec2(fx1 - fx0, fy1 - fy0) / (2.0 * e);
  vec2 out_ = normalize(g + normalize(m - CORE + 1e-5) * 0.25);
  float rr = max(f, 0.0) + 0.08;
  vec2 src = m - out_ * (uMass / rr);

  // Behind: the sky and the far half of the disk, both lensed.
  vec3 col = vec3(0.067, 0.063, 0.075) + sky(src * 0.9 + 3.0, t);
  vec4 back = disk(src, t);
  float far = smoothstep(-0.02, 0.02, src.y - CORE.y);
  col += back.rgb * far * 1.1;

  // The far side of the disk, lensed into a halo that follows the mark's outline over the top.
  float arcBand = exp(-pow((f - 0.06) / 0.03, 2.0));
  float arcAng = atan(m.y - CORE.y, m.x - CORE.x);
  float arcGas = fbm(vec2(arcAng * 3.0 - t * 0.5, f * 20.0));
  float over = 0.3 + 0.7 * smoothstep(-0.3, 0.25, m.y - CORE.y);
  col += mix(palette(0.32), palette(0.08), arcGas) * arcBand * over * (0.2 + 1.0 * arcGas * arcGas) * 0.9;
  col += mix(palette(0.15), vec3(1.0, 0.92, 0.88), 0.4) * exp(-pow((f - 0.03) / 0.012, 2.0)) * over * 0.55;
  col += palette(0.82) * exp(-pow((f - 0.12) / 0.03, 2.0)) * over * (0.06 + 0.12 * arcGas);

  // A soft glow of the disk's light around the whole hole.
  float r0 = length((m - CORE) * vec2(1.0, 1.6));
  col += palette(0.2) * exp(-r0 * 2.6) * 0.16 + palette(0.8) * exp(-r0 * 1.2) * 0.07;

  // The horizon: the mark as dark glass, a photon ring hugging its outline.
  float d = markSD(m);
  float inside = 1.0 - smoothstep(-px * 1.2, px * 1.2, d);
  vec3 horizon = vec3(0.02, 0.018, 0.03) + palette(0.7) * 0.05 * smoothstep(0.2, 0.9, m.y);
  float sheen = smoothstep(0.04, 0.0, abs(fract(t * 0.05) * 2.6 - 0.8 - m.x * 0.7 - m.y * 0.6));
  horizon += vec3(0.9, 0.85, 1.0) * sheen * 0.12;
  col = mix(col, horizon, inside);
  float ring = exp(-abs(d) / (px * 1.8));
  float ringWide = exp(-max(d, 0.0) / 0.012);
  float flicker = 0.85 + 0.15 * vnoise(vec2(atan(m.y - CORE.y, m.x - CORE.x) * 4.0, t * 0.6));
  col += mix(palette(0.92), vec3(1.0, 0.9, 0.85), 0.4) * ring * 1.1 * flicker;
  col += palette(0.12) * ringWide * 0.35 * flicker * (1.0 - inside);

  // In front: the near half of the disk, unlensed, over the mark.
  vec4 front = disk(m, t);
  float near = smoothstep(0.02, -0.02, m.y - CORE.y);
  col = mix(col, col * 0.35, front.a * near * 0.6) + front.rgb * near * 1.1;

  // Keep the middle calm for content.
  vec2 mid = (vUv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.55, 1.0, smoothstep(0.1, 0.45, length(mid * vec2(0.8, 1.1))));

  col = tonemap(col * 1.15);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
