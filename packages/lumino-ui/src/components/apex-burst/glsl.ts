import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * React Bits' PrismaticBurst (MIT) ray march, ported from the user's PrismaticBurst
 * (lumino-services packages/ui) and cut down: no bloom chain, pulses or intro, 36
 * steps instead of 44, brand palette always on. The burst starts in the brandmark's
 * heart (where the blades part over the base) and the mark stands in its way: each
 * pixel looks back toward the heart through the SDF, so the shapes cast soft dark
 * wedges and the light only gets out through the slot and the gaps.
 */
export const BURST = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform float uPhase;
uniform float uIntensity;
uniform mat3 uOrient;
uniform vec2 uHeart;
uniform vec2 uHeartMark;
uniform float uScale;
uniform float uCalm;
uniform float uRays;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

float hash21(vec2 p) {
  p = floor(p);
  return fract(52.9829189 * fract(dot(p, vec2(0.065, 0.005))));
}

float layeredNoise(vec2 fragPx) {
  vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
  vec2 q = mat2(0.8, -0.5, 0.5, 0.8) * p;
  return 0.4 * hash21(q) + 0.25 * hash21(q * 2.0 + 17.0) + 0.2 * hash21(q * 4.0 + 47.0) + 0.15 * hash21(q * 8.0 + 113.0);
}

vec3 burst(vec2 frag, vec2 origin) {
  float t = uPhase;
  vec2 centered = 2.0 * (frag - origin);
  vec3 dir = normalize(vec3(centered, uResolution.y));
  float n = layeredNoise(frag);
  float marchT = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 36; ++i) {
    vec3 P = marchT * dir;
    P.z -= 2.0;
    float rad = length(P);
    vec3 Pl = uOrient * (P * (10.0 / max(rad, 1e-6)));
    float stepLen = min(rad - 0.3, n * 0.05) + 0.1;
    float ray = smoothstep(0.5, 0.7, sin(Pl.x + cos(Pl.y) * cos(Pl.z)) * sin(Pl.z + sin(Pl.y) * cos(Pl.x + t)));
    float comb = pow(0.5 + 0.5 * cos(uRays * atan(Pl.y, Pl.x)), 3.0);
    ray *= smoothstep(0.15, 0.95, comb);
    float saw = fract(marchT * 0.25);
    vec3 spectral = 2.0 * mix(palette(saw * saw * (3.0 - 2.0 * saw)), vec3(1.0, 0.88, 0.82), 0.22);
    col += (0.05 / (0.4 + stepLen)) * smoothstep(5.0, 0.0, rad) * spectral * ray;
    marchT += stepLen;
  }
  return col;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 frag = gl_FragCoord.xy;
  vec2 origin = vec2(uHeart.x / aspect, uHeart.y) * uResolution;
  vec2 m = (p - vec2(uHeart.x, uHeart.y)) / uScale + uHeartMark;
  float d = markSD(m);

  // Soft shadow: walk from the heart toward this pixel through the mark.
  vec2 toP = m - uHeartMark;
  float len = length(toP);
  vec2 dirM = toP / max(len, 1e-5);
  float reach = min(len, 0.55);
  float lit = 1.0;
  for (int i = 1; i <= 20; i++) {
    float s = reach * float(i) / 20.0;
    float sd = markSD(uHeartMark + dirM * s);
    lit = min(lit, clamp(0.5 + sd * 9.0 / max(s, 0.02), 0.0, 1.0));
  }

  vec3 col = burst(frag, origin) * uIntensity;
  float r = length(p - uHeart);
  // The glass shapes don't stop the light, they dim and tint it: dark wedges, bright gaps.
  col *= mix(0.2, 1.0, lit) * smoothstep(0.0, 0.08, r);
  col *= 1.0 / (1.0 + r * r * 0.5);
  vec2 c = (vUv - vec2(0.5, 0.45)) * vec2(1.8, 1.6);
  col *= 1.0 - uCalm * exp(-dot(c, c) * 2.0);

  // A warm core in the slot, and a faint ground glow so the shadows read as shapes.
  col += vec3(1.0, 0.85, 0.75) * exp(-r * 38.0) * 0.9 * lit;
  float neb = fbm(p * 1.1 + vec2(uTime * 0.012, 0.0));
  col += palette(0.55 + 0.3 * neb) * pow(neb, 3.0) * 0.14;

  // The mark: dark glass, its edges lit from the heart.
  float inside = 1.0 - smoothstep(-0.0015, 0.0015, d);
  vec2 e = vec2(0.004, 0.0);
  vec2 grad = normalize(vec2(markSD(m + e.xy) - markSD(m - e.xy), markSD(m + e.yx) - markSD(m - e.yx)) + 1e-6);
  float facing = clamp(dot(grad, -dirM), 0.0, 1.0);
  float rim = exp(-abs(d) * 240.0) * (0.25 + 1.4 * facing * exp(-len * 2.5));
  vec3 glass = palette(0.08 + (1.0 - m.y) * 0.5 + m.x * 0.3) * (0.08 + 0.3 * exp(min(d, 0.0) * 40.0) * facing);
  col = mix(col, glass, inside * 0.9);
  col += palette(0.05 + len * 0.6) * rim * 1.2 + vec3(1.0, 0.92, 0.86) * rim * facing * 0.4;

  col = tonemap(col * 1.1);
  col += (hash12(frag + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
