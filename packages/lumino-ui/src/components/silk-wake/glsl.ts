import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * Silk ribbons drifting along the brand's 139deg, parting around an invisible brandmark.
 * The flow is a stream function: a uniform drift times a factor that goes to zero on
 * the mark's outline, so every streamline bends around the strokes and the mark shows
 * as the gap the silk leaves, with a faint rim of light where the flow hugs it. Each
 * ribbon twists as it goes (narrowing and moving its sheen), with fine threads inside.
 */
export const SILK = (spread: string, ribbons: number) => `#version 300 es
precision highp float;
${spread}
#define RIBBONS ${ribbons}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uMarkAt;   // centre x, y and SDF square side, in p units
uniform vec2 uPointer;  // in p units
uniform float uStir;    // 0 to 1: the pointer pushes the silk aside
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

const vec2 FLOW = vec2(0.656, -0.755);   // 139deg: top left to bottom right
const vec2 ACROSS = vec2(0.755, 0.656);

vec2 toMark(vec2 p) { return (p - uMarkAt.xy) / uMarkAt.z + 0.5; }

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float px = 1.0 / uResolution.y;
  float t = uTime;

  vec2 m = toMark(p);
  float d = markSD(m) * uMarkAt.z;            // p units, negative inside
  vec2 rel = p - uMarkAt.xy;
  float along = dot(rel, FLOW), across = dot(rel, ACROSS);

  // Zero on the outline, one far off: the streamlines have to go round.
  float hold = 1.0 - exp(-max(d, 0.0) / (0.075 * uMarkAt.z));
  // The pointer is a soft second obstacle.
  float pd = length(p - uPointer);
  hold *= 1.0 - uStir * exp(-pd * pd / 0.006) * 0.85;
  // Downstream of the mark the silk ripples in its wake.
  float wake = smoothstep(-0.05, 0.35, along) * exp(-abs(across) / (0.25 * uMarkAt.z)) * smoothstep(1.2, 0.2, along);

  // Where the silk squeezes past the strokes it thins to nothing, leaving a clean gap.
  float clear = smoothstep(0.1, 0.5, hold);
  vec3 col = vec3(0.0);
  float cover = 0.0;
  for (int i = 0; i < RIBBONS; i++) {
    float fi = float(i), k = fi - float(RIBBONS - 1) * 0.5;
    float seed = hash12(vec2(fi, 9.1));
    // Each ribbon meanders on its own, more so in the wake.
    float s = across
      + 0.05 * sin(along * (2.1 + seed * 1.7) - t * (0.25 + seed * 0.2) + seed * 6.28)
      + 0.03 * (vnoise(vec2(along * 3.0 - t * 0.3, fi * 3.1)) - 0.5)
      + wake * 0.035 * sin(along * 16.0 - t * 1.6 + fi);
    float psi = s * hold;
    float centre = k * 0.05 * uMarkAt.z + 0.012 * sin(t * 0.2 + fi * 2.3);
    // The ribbon twists: it narrows edge-on and its sheen slides across it.
    float tw = along * (2.4 + seed * 2.0) - t * (0.35 + seed * 0.25) + seed * 11.0;
    float w = (0.022 + 0.03 * seed) * uMarkAt.z * (0.25 + 0.75 * abs(cos(tw)));
    float x = (psi - centre) / w;
    // A faint veil of light around each ribbon, then the ribbon itself.
    col += palette(fract(0.04 + seed * 0.85 + along * 0.12)) * exp(-x * x * 0.08) * 0.018;
    if (abs(x) > 1.6) continue;
    float edge = 1.0 - smoothstep(0.85, 1.0, abs(x));
    float sheen = exp(-pow(x - 0.7 * sin(tw), 2.0) * 9.0);
    float body = sqrt(max(1.0 - x * x, 0.0));
    float threads = pow(0.5 + 0.5 * cos(x * 34.0 + seed * 40.0), 8.0);
    vec3 c = palette(fract(0.04 + seed * 0.85 + along * 0.12 + across * 0.1));
    vec3 lit = c * (0.06 + 0.22 * body + 0.14 * threads * body) + mix(c, vec3(1.0, 0.92, 0.88), 0.3) * sheen * (0.5 + 0.7 * abs(cos(tw)));
    // Glassy: each ribbon is translucent, so where they cross they add up.
    col += lit * edge * (1.0 - cover * 0.4) * clear;
    cover = max(cover, edge * 0.7);
  }

  // A rim of light where the flow hugs the strokes, and dark glass inside them.
  float rim = exp(-abs(d) / (1.4 * px)) * 0.55 + exp(-max(d, 0.0) / (0.025 * uMarkAt.z)) * 0.1;
  vec3 rimCol = palette(0.06 + clamp(1.0 - m.y + m.x * 0.2, 0.0, 1.0) * 0.75);
  col = col * smoothstep(-px, px, d) + rimCol * rim;
  col += rimCol * (1.0 - smoothstep(-px, px, d)) * 0.035;

  // Calm the middle for content, and lay a faint nebula under everything.
  vec2 c0 = (vUv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.35, 1.0, smoothstep(0.12, 0.55, length(c0 * vec2(0.8, 1.1))));
  col += palette(0.35 + vUv.x * 0.4) * pow(fbm(vUv * 2.0 + t * 0.01), 3.0) * 0.1;

  col = tonemap(col * 1.1 + vec3(0.045, 0.04, 0.05));
  col += (hash12(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
