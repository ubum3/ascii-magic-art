import { BRAND_GLSL } from "../../backgrounds/gl.js";
import { EDGES, STARS } from "./constellation.js";

/**
 * Slow domain-warped nebula in wine, plum and indigo with peach light on its
 * edges, a sparse twinkling starfield, and the brandmark as a constellation:
 * stars that drift together, glowing glass lines drawn between them, the mark's
 * strokes filling with faint glass light, then dissolving to form somewhere else.
 */
export const NEBULA_CONSTELLATION = (spread: string) => `#version 300 es
precision highp float;
${spread}
#define STARS ${STARS.length}
#define LINES ${EDGES.length}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uStars[STARS];   // x, y, brightness
uniform vec4 uLines[LINES];   // x0, y0, x1, y1
uniform float uLineAlpha[LINES];
uniform vec3 uMarkAt;         // the mark's centre and size (per mark height)
uniform float uSquare;        // the SDF square's side, in mark heights
uniform float uFill;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float px = 1.0 / uResolution.y;
  float t = uTime * 0.02;

  // Nebula: two layers of warped fbm, lit warm along the edges of the dense parts.
  vec2 q = p * 1.3;
  vec2 w1 = vec2(fbm(q + vec2(t, -t * 0.6)), fbm(q + vec2(5.2, 1.3) - t * 0.4));
  vec2 w2 = vec2(fbm(q + w1 * 1.8 + vec2(1.7, 9.2)), fbm(q + w1 * 1.8 + vec2(8.3, 2.8) + t * 0.5));
  float n = fbm(q + w2 * 2.0);
  float dense = smoothstep(0.48, 0.9, n);
  float edge = smoothstep(0.5, 0.62, n) * (1.0 - smoothstep(0.62, 0.85, n));
  vec3 col = vec3(0.067, 0.063, 0.075);
  col += mix(palette(0.66), palette(0.42), w2.x) * pow(dense, 1.5) * 0.3;
  col += mix(palette(0.34), palette(0.08), w1.y) * edge * pow(w2.y, 2.0) * 0.5;
  col += palette(0.85) * pow(max(w1.x - 0.5, 0.0), 2.0) * 0.3;

  // Background stars: sparse, twinkling, dimmed where the nebula is thick.
  vec2 sc = floor(p * 90.0);
  float sh = hash12(sc);
  vec2 so = hash22(sc) * 0.6 + 0.2;
  float tw = 0.6 + 0.4 * sin(uTime * (0.8 + sh * 2.0) + sh * 60.0);
  float sd = length(fract(p * 90.0) - so) / 90.0;
  col += mix(vec3(0.8, 0.82, 1.0), palette(0.05), sh * 40.0 - floor(sh * 40.0)) * step(0.975, sh) * exp(-pow(sd / (px * 1.3), 2.0)) * tw * (1.0 - dense * 0.6);

  // The mark's strokes as glass, filling in while the constellation holds.
  float S = uMarkAt.z * uSquare;
  vec2 m = (p - uMarkAt.xy) / S + 0.5;
  if (uFill > 0.001 && all(greaterThan(m, vec2(-0.1))) && all(lessThan(m, vec2(1.1)))) {
    float d = markSD(m) * S;
    float inside = 1.0 - smoothstep(-px, px, d);
    float depth = clamp(-d / (S * 0.015), 0.0, 1.0);
    vec3 glass = mix(palette(0.15 + (1.0 - m.y) * 0.45), palette(0.9), 0.25) * (0.25 + 0.35 * depth);
    float sheen = smoothstep(0.05, 0.0, abs(fract(uTime * 0.09) * 2.6 - 0.8 - m.x * 0.6 - m.y * 0.6));
    col += (glass + vec3(1.0, 0.95, 0.92) * sheen * 0.35) * inside * uFill;
    col += palette(0.95) * exp(-abs(d) / (px * 1.5)) * 0.35 * uFill;
    col += palette(0.2) * exp(-max(d, 0.0) / (S * 0.04)) * 0.12 * uFill * (1.0 - inside);
  }

  // The lines: a thin hot core in a soft glow, warm at the top of the mark and cool at its base.
  for (int i = 0; i < LINES; i++) {
    if (uLineAlpha[i] <= 0.0) continue;
    vec4 l = uLines[i];
    float d = segment(p, l.xy, l.zw);
    float tone = clamp((uMarkAt.y + uMarkAt.z * 0.5 - (l.y + l.w) * 0.5) / uMarkAt.z, 0.0, 1.0);
    vec3 c = mix(palette(0.04), palette(0.88), tone);
    float pulse = 0.75 + 0.25 * sin(uTime * 2.0 - float(i) * 0.7);
    col += (vec3(1.0, 0.96, 0.93) * exp(-pow(d / (px * 0.9), 2.0)) * 0.65 + c * exp(-d / (px * 5.0)) * 0.8 + c * exp(-d / (px * 22.0)) * 0.18) * uLineAlpha[i] * pulse;
  }

  // The constellation's stars: a bright point with soft four-way spikes.
  for (int i = 0; i < STARS; i++) {
    vec3 s = uStars[i];
    vec2 v = p - s.xy;
    float r = length(v) / px;
    float spikes = exp(-abs(v.x) / px * 1.2) * exp(-abs(v.y) / px * 0.08) + exp(-abs(v.y) / px * 1.2) * exp(-abs(v.x) / px * 0.08);
    float tw2 = 0.8 + 0.2 * sin(uTime * 3.0 + float(i) * 1.7);
    col += (vec3(1.0, 0.95, 0.92) * exp(-r * r * 0.18) * 1.4 + mix(palette(0.08), palette(0.9), float(i % 3) * 0.4) * (exp(-r * 0.22) * 0.35 + spikes * 0.22)) * s.z * tw2;
  }

  // Keep the middle calm for content.
  vec2 mid = (vUv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.55, 1.0, smoothstep(0.1, 0.45, length(mid * vec2(0.8, 1.1))));

  col = tonemap(col * 1.15);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
