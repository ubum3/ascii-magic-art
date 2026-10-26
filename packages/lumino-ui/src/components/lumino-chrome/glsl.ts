import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * A liquid-chrome sea: a height field of warped waves, still near the middle, with the
 * mark as a raised bevelled relief that sends ripples off its blades. Shaded as a
 * mirror that reflects a studio of brand-gradient light strips.
 */
export const CHROME = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uPlace;
uniform float uCalm;
uniform vec2 uCard;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

#define BEVEL 0.05
#define RISE 0.032
float aspect;
float t;

// The mark's distance from the smoothed float field (same units as markSD).
float fieldSD(vec2 p) {
  vec2 q = clamp(p, 0.0, 1.0);
  return texture(uField, q).r + length(p - q);
}

// The calm pool around the card in the middle (uCard: its half size): 0 there, 1 well away.
float calm(vec2 p) {
  // A box rounded by most of its size, so the pool has no corners or creases to reflect.
  float r = min(uCard.x, uCard.y) * 0.9;
  vec2 q = abs(p - vec2(aspect * 0.5, 0.5)) - uCard + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return smoothstep(-0.12, 0.42, d);
}

// The sea's height at p: warped waves, stiller in the middle.
float waves(vec2 p) {
  vec2 q = p * 1.9;
  q += 0.4 * vec2(sin(q.y * 1.3 + t * 0.7), cos(q.x * 1.1 - t * 0.55));
  q += 0.2 * vec2(sin(q.y * 2.7 - t * 0.9), cos(q.x * 2.3 + t * 0.8));
  float w = sin(q.x * 1.7 + t * 0.6) * 0.5 + sin(q.y * 2.3 - t * 0.45 + q.x) * 0.35 + sin((q.x + q.y) * 3.3 + t * 1.1) * 0.15;
  return w * 0.085 * mix(uCalm, 1.0, calm(p));
}

// The relief's slope against the mark's distance d, in mark units: the mark is
// inflated like liquid metal, rising over BEVEL to a rounded crown (the thin blades
// become tubes), and outside it ripples fade out well inside the SDF's reach.
float reliefSlope(float d) {
  float b = clamp(-d / BEVEL, 0.0, 1.0);
  float crown = d < 0.0 ? -2.0 * (1.0 - b) / BEVEL * RISE : 0.0;
  float o = max(d, 0.0);
  float fade = smoothstep(0.0, 0.015, o) * smoothstep(0.11, 0.03, o);
  float rip = cos(o * 70.0 - t * 3.2) * 70.0 * fade * 0.0035;
  return crown + rip;
}

// The studio the chrome reflects: a dim room, with brand-gradient light strips that
// only flat-facing metal misses, so still metal reads dark and curves catch light.
vec3 env(vec3 r, vec2 p) {
  vec2 uv = r.xy * 2.2 + p * 0.25;
  float tilt = smoothstep(0.02, 0.4, length(r.xy));
  float strip = sin(uv.y * 6.0 + uv.x * 2.2 + t * 0.35);
  float strip2 = sin(uv.x * 4.4 - uv.y * 1.6 - t * 0.25);
  float k = (smoothstep(0.62, 0.8, strip) * 1.25 + smoothstep(0.82, 0.94, strip2) * 1.2 + pow(0.5 + 0.5 * strip, 3.0) * 0.2) * tilt;
  float hot = smoothstep(0.965, 0.995, strip) * tilt;
  vec3 tint = palette(fract(0.02 + uv.x * 0.22 + uv.y * 0.3 + p.x * 0.12));
  return palette(fract(0.55 + p.y * 0.1 - p.x * 0.05)) * 0.05 + tint * k + vec3(1.0, 0.94, 0.9) * hot * 1.2;
}

void main() {
  aspect = uResolution.x / uResolution.y;
  t = uTime * 0.6;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float e = 1.5 / uResolution.y;

  // Waves by finite differences; the relief from the SDF's gradient (sampled a few
  // texels apart so the 8-bit field doesn't band) and its analytic slope.
  float h0 = waves(p);
  vec2 gw = vec2(waves(p + vec2(e, 0.0)) - h0, waves(p + vec2(0.0, e)) - h0) / e;
  vec2 m = (p - uPlace.xy) / uPlace.z + 0.5;
  float d = fieldSD(m);
  float k = 0.004;
  vec2 gd = vec2(fieldSD(m + vec2(k, 0.0)) - fieldSD(m - vec2(k, 0.0)), fieldSD(m + vec2(0.0, k)) - fieldSD(m - vec2(0.0, k))) / (2.0 * k);
  vec2 g = gw + gd * reliefSlope(d);
  vec3 n = normalize(vec3(-g, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  r.xy += (uPointer - 0.5) * 0.12;

  vec3 col = env(r, p);
  float fres = pow(1.0 - n.z, 1.5);
  col += palette(0.18 + vUv.y * 0.5) * fres * 0.6;
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  col += vec3(1.0, 0.92, 0.86) * pow(max(dot(r, L), 0.0), 80.0) * 1.4;

  // The mark's top: a glassy wash of the brand gradient with a slow light sweep.
  float top = 1.0 - smoothstep(-0.01, 0.0, d);
  float sweep = smoothstep(0.1, 0.0, abs(fract(uTime * 0.07) * 2.6 - 0.8 - m.x - m.y * 0.5));
  col = mix(col, col * 0.85 + palette(0.08 + (1.0 - m.y) * 0.75) * 0.16 + vec3(1.0, 0.9, 0.85) * sweep * 0.3, top);
  // A thin glow where the bevel meets the sea.
  col += palette(0.15 + m.y * 0.4) * exp(-abs(d) * 160.0) * 0.45;

  float c = calm(p);
  col *= mix(0.4, 1.0, c);
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.25, length(vUv - 0.5) * 1.6);
  col = tonemap(col * 1.15);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
