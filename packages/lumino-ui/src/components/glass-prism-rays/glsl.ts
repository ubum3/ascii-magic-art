import { BRAND_GLSL } from "../../backgrounds/gl.js";

const HEAD = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uCenter;
uniform float uScale;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}`;

/**
 * Pass 1, at a quarter of the size: what shines. A hot backlight behind the mark leaks
 * around it and through the gaps between its shapes, and the glass itself glows in the
 * brand gradient. Angular noise around the mark turns into shafts once it is smeared.
 */
export const EMIT = (spread: string) => `${HEAD(spread)}
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 m = (p - uCenter) / uScale + 0.5;
  float d = markSD(m);
  float inside = 1.0 - smoothstep(-0.004, 0.004, d);
  float t = uTime;

  float r = length((m - vec2(0.5, 0.5)) * vec2(1.0, 1.15));
  float back = exp(-r * r * 12.0) * 1.3 + exp(-r * 4.5) * 0.35;
  vec2 dir = normalize(p - uCenter + 1e-5);
  // Thin beams: angular noise survives the radial blur unsmeared, so sharp noise makes sharp shafts.
  float broad = smoothstep(0.25, 0.75, vnoise(dir * 3.0 + vec2(t * 0.08, -t * 0.05)));
  float thin = pow(vnoise(dir * 14.0 + vec2(-t * 0.1, t * 0.07)), 3.0) * 2.5 + pow(vnoise(dir * 31.0 + t * 0.05), 4.0) * 2.0;
  float shafts = broad * (0.15 + thin);
  // Most of the light fans down and out to the sides; little goes straight down or up.
  float fan = 0.06 + smoothstep(0.0, 0.8, abs(dir.x)) * smoothstep(0.6, -0.4, dir.y);

  // Split like a prism: warm to the left, cool to the right, white at the core.
  float band = vnoise(dir * 7.0 + 2.0);
  vec3 tint = mix(palette(0.02 + 0.2 * band), palette(0.8 + 0.12 * band), smoothstep(-0.35, 0.35, dir.x));
  vec3 leak = mix(vec3(1.0, 0.9, 0.84), tint * 1.5, smoothstep(0.05, 0.28, r)) * back * (1.0 - inside) * fan;
  vec3 glass = palette(0.04 + m.x * 0.86) * (0.35 + 0.65 * fbm(m * 5.0 + vec2(t * 0.05, -t * 0.08))) * (0.6 + back);
  vec3 e = leak * shafts + glass * inside * 0.7;
  e *= smoothstep(0.85, 0.4, r);
  outColor = vec4(e * 0.5, 1.0);
}`;

/**
 * Pass 2: the light shafts (a radial blur of pass 1 toward the mark, a little longer for
 * red than blue so the edges split like a prism), a faint nebula, and the sharp glass
 * mark on top with its rim, inner light and a slow specular sweep.
 */
export const RAYS = (spread: string) => `${HEAD(spread)}
uniform sampler2D uEmit;
uniform float uIntensity;
uniform float uLength;
uniform float uCalm;
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float t = uTime;
  vec2 cUv = vec2(uCenter.x / aspect, uCenter.y);
  vec2 delta = (vUv - cUv) * uLength;

  const int N = 22;
  float jitter = hash12(gl_FragCoord.xy + fract(t) * 37.0);
  vec3 acc = vec3(0.0);
  float w = 1.0, wsum = 0.0;
  for (int i = 0; i < N; i++) {
    float k = (float(i) + jitter) / float(N);
    acc.r += texture(uEmit, vUv - delta * k).r * w;
    acc.g += texture(uEmit, vUv - delta * k * 0.93).g * w;
    acc.b += texture(uEmit, vUv - delta * k * 0.86).b * w;
    wsum += w;
    w *= 0.965;
  }
  vec3 rays = acc / wsum * 3.2;
  float dist = length(p - uCenter);
  rays *= mix(vec3(1.1, 0.95, 0.88), vec3(0.75, 0.82, 1.2), smoothstep(0.1, 0.9, dist));
  rays *= 1.0 / (1.0 + dist * dist * 0.5);

  // Keep the middle (where a card sits) calm.
  vec2 c = (vUv - vec2(0.5, 0.47)) * vec2(1.9, 1.7);
  rays *= 1.0 - uCalm * exp(-dot(c, c) * 2.2);

  vec3 col = rays * uIntensity;
  float neb = fbm(p * 1.3 + vec2(t * 0.015, -t * 0.01));
  col += palette(0.5 + 0.35 * neb) * pow(neb, 3.0) * 0.18;

  // The glass mark.
  vec2 m = (p - uCenter) / uScale + 0.5;
  float d = markSD(m);
  float inside = 1.0 - smoothstep(-0.0015, 0.0015, d);
  vec3 lit = texture(uEmit, vUv).rgb * 2.0;
  vec3 body = palette(0.05 + m.x * 0.85) * 0.22 + lit * 0.55;
  float inner = exp(min(d, 0.0) * 55.0) * inside;
  float rim = exp(-abs(d) * 260.0);
  float sweep = smoothstep(0.06, 0.0, abs(fract(t * 0.07) * 2.6 - 0.8 - m.x * 0.8 - (1.0 - m.y) * 0.6));
  col = mix(col, body + palette(0.1 + m.y * 0.7) * inner * 0.6 + vec3(1.0, 0.95, 0.9) * sweep * 0.5, inside * 0.85);
  col += vec3(1.0, 0.9, 0.85) * rim * 0.75;

  col = tonemap(col * 1.15);
  col += (hash12(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
