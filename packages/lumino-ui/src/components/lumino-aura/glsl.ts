import { BRAND_GLSL } from "../../backgrounds/gl.js";

/** Brand-gradient aurora curtains over the ground, with the mark glowing as a rim of light low on the right. */
export const AURA = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float t = uTime * 0.05;

  // Curtains: fbm bands that lean along the brand's 139deg, brighter at the edges of the box.
  vec2 q = vec2(p.x * 0.9 + p.y * 0.6, p.y - p.x * 0.3);
  float warp = fbm(q * 1.4 + vec2(t, -t * 0.7));
  float band = fbm(vec2(q.x * 2.2 + warp * 1.6, q.y * 0.6 - t * 1.3));
  float edge = smoothstep(0.15, 0.95, length((vUv - 0.5) * vec2(1.1, 1.3)));
  float light = pow(band, 2.2) * (0.25 + 1.2 * edge);
  vec3 col = palette(fract(0.15 + band * 0.9 + vUv.x * 0.25)) * light;

  // The mark: a big rim of light low on the right, partly off the box.
  float s = 0.62;
  vec2 m = (p - vec2(aspect - 0.3, 0.26)) / s + 0.5;
  float d = markSD(m);
  float rim = exp(-abs(d) * 160.0) * 1.1 + exp(-max(d, 0.0) * 14.0) * 0.18;
  float inside = 1.0 - smoothstep(-0.002, 0.002, d);
  vec3 glass = palette(0.1 + m.y * 0.8) * (0.08 + 0.25 * fbm(m * 6.0 + t * 2.0));
  float sweep = smoothstep(0.08, 0.0, abs(fract(t * 0.8) * 2.4 - 0.7 - m.x - m.y * 0.4));
  col += palette(0.12 + m.y * 0.6) * rim + glass * inside + vec3(1.0, 0.9, 0.85) * sweep * inside * 0.35;

  col = tonemap(col * 1.25);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
