import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * LuminoChrome's brandmark on its own: the mark inflated like liquid metal, its top
 * moving with the same slow waves, shaded as a mirror of brand-gradient light strips.
 * Transparent around it, with a soft glow off the edge. Premultiplied alpha.
 */
export const GLASS_MARK = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uRipple;
uniform float uTilt;
uniform float uGlow;
uniform float uRings;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

#define BEVEL 0.05
#define RISE 0.032
float t;

// The mark's distance from the smoothed float field (same units as markSD).
float fieldSD(vec2 p) {
  vec2 q = clamp(p, 0.0, 1.0);
  return texture(uField, q).r + length(p - q);
}

// LuminoChrome's waves, at full strength (the mark sits away from its calm pool).
float waves(vec2 p) {
  vec2 q = p * 1.9;
  q += 0.4 * vec2(sin(q.y * 1.3 + t * 0.7), cos(q.x * 1.1 - t * 0.55));
  q += 0.2 * vec2(sin(q.y * 2.7 - t * 0.9), cos(q.x * 2.3 + t * 0.8));
  float w = sin(q.x * 1.7 + t * 0.6) * 0.5 + sin(q.y * 2.3 - t * 0.45 + q.x) * 0.35 + sin((q.x + q.y) * 3.3 + t * 1.1) * 0.15;
  return w * 0.085 * uRipple;
}

// The relief's slope against the mark's distance d, as in LuminoChrome: inflated to a
// rounded crown inside, and ripples outside (scaled by uRings) that close the gaps
// between its parallel strokes and ring it, fading out by 0.11.
float reliefSlope(float d) {
  float b = clamp(-d / BEVEL, 0.0, 1.0);
  float crown = d < 0.0 ? -2.0 * (1.0 - b) / BEVEL * RISE : 0.0;
  float o = max(d, 0.0);
  float fade = smoothstep(0.0, 0.015, o) * smoothstep(0.11, 0.03, o);
  float rip = cos(o * 70.0 - t * 3.2) * 70.0 * fade * 0.0035 * uRings;
  return crown + rip;
}

// The studio the chrome reflects, as in LuminoChrome.
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
  t = uTime * 0.6;
  // The mark's square, centred and contained in the box.
  float aspect = uResolution.x / uResolution.y;
  vec2 m = (vUv - 0.5) * vec2(max(aspect, 1.0), max(1.0 / aspect, 1.0)) + 0.5;
  // Wave space: the mark at about the size LuminoChrome draws it, so the motion matches.
  vec2 p = m * 0.6 + vec2(1.1, 0.12);

  float d = fieldSD(m);
  float e = 0.002;
  float h0 = waves(p);
  vec2 gw = vec2(waves(p + vec2(e, 0.0)) - h0, waves(p + vec2(0.0, e)) - h0) / e;
  float k = 0.004;
  vec2 gd = vec2(fieldSD(m + vec2(k, 0.0)) - fieldSD(m - vec2(k, 0.0)), fieldSD(m + vec2(0.0, k)) - fieldSD(m - vec2(0.0, k))) / (2.0 * k);
  vec2 g = gw + gd * reliefSlope(d);
  vec3 n = normalize(vec3(-g, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  r.xy += (clamp(uPointer, -0.5, 1.5) - 0.5) * 0.2 * uTilt;

  vec3 col = env(r, p);
  float fres = pow(1.0 - n.z, 1.5);
  col += palette(0.18 + m.y * 0.5) * fres * 0.6;
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  col += vec3(1.0, 0.92, 0.86) * pow(max(dot(r, L), 0.0), 80.0) * 1.4;

  // The top: a glassy wash of the brand gradient with a slow light sweep.
  float sweep = smoothstep(0.1, 0.0, abs(fract(uTime * 0.07) * 2.6 - 0.8 - m.x - m.y * 0.5));
  col = col * 0.85 + palette(0.08 + (1.0 - m.y) * 0.75) * 0.16 + vec3(1.0, 0.9, 0.85) * sweep * 0.3;
  col += palette(0.15 + m.y * 0.4) * exp(-abs(d) * 160.0) * 0.45;
  col = tonemap(col * 1.15);

  // Coverage: the mark itself (antialiased on the SDF), widening with uRings to the
  // rippled metal around it, which fades out where the ripples do. Then a soft glow.
  float aa = max(fwidth(d), 1e-4);
  float edge = mix(0.0, 0.085, uRings);
  float cov = 1.0 - smoothstep(edge - aa - 0.02 * uRings, edge + aa, d);
  float halo = exp(-max(d - edge, 0.0) * mix(110.0, 60.0, uRings)) * 0.5 * uGlow * (1.0 - cov);
  // Gone well before the box's edge, so the box never shows.
  vec2 box = abs(m - 0.5);
  halo *= smoothstep(0.5, 0.36, max(box.x, box.y)) * smoothstep(0.1, 0.0, max(d - edge, 0.0) - 0.05);
  vec3 rgb = col * cov + palette(0.15 + m.y * 0.4) * halo;
  float a = cov + halo;
  rgb += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * a;
  outColor = vec4(rgb, a);
}`;
