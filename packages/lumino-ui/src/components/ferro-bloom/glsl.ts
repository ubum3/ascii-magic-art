import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * Black ferrofluid seen from above. The brandmark is a magnet under it: its distance
 * field sets how tall a hex lattice of spikes grows, so the mark stands up out of the
 * liquid as glossy cones. The slopes reflect the brand gradient (warm from the top
 * left, cool from the bottom right); flat liquid stays near black.
 */
export const FERRO = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uMarkAt;   // centre x, y and SDF square side, in p units
uniform vec3 uPointer;  // x, y in p units, strength 0 to 1
uniform float uSpike;   // spike height
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

// Nearest hex cell: xy the offset from its centre, zw its id (centre = id * vec2(1, sqrt 3)).
vec4 hexCell(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 0.8660254)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
}

float swell(vec2 p) { return vnoise(p) * 0.65 + vnoise(p * 2.1 + 7.3) * 0.35; }

vec2 toMark(vec2 p) { return (p - uMarkAt.xy) / uMarkAt.z + 0.5; }

// The magnet's pull at p: 1 on the strokes, falling off over a short distance outside.
float pull(vec2 p) {
  float d = markSD(toMark(p));
  // Tallest down the middle of each stroke, falling off fast outside it.
  return exp(-max(d, 0.0) * 140.0) * (0.6 + 0.4 * smoothstep(0.0, 0.022, -d));
}

// Liquid height at p (in cell units), and the pull there in .y.
vec2 height(vec2 p, float cell) {
  vec4 h = hexCell(p / cell);
  vec2 centre = h.zw * vec2(1.0, 1.7320508) * cell;
  float rnd = hash12(h.zw);
  float f = pull(centre);
  // A slow wave of strength rolls down from the tip, and every spike breathes on its own.
  vec2 tip = uMarkAt.xy + vec2(0.0, 0.3) * uMarkAt.z;
  f *= 0.78 + 0.22 * sin(uTime * 1.1 - length(centre - tip) / uMarkAt.z * 9.0);
  f *= 0.85 + 0.15 * sin(uTime * (0.8 + rnd) + rnd * 6.2832);
  f += uPointer.z * exp(-dot(centre - uPointer.xy, centre - uPointer.xy) / (0.012 * uMarkAt.z)) * 0.7;
  f = smoothstep(0.08, 1.0, f);
  // Spikes lean a little, each its own way.
  vec2 lean = vec2(sin(uTime * 0.7 + rnd * 9.0), cos(uTime * 0.6 + rnd * 7.0)) * 0.08;
  float r = length(h.xy - lean * (1.0 - length(h.xy) * 2.0)) * 2.3;
  float spike = pow(max(1.0 - r, 0.0), 1.5) * f * uSpike * (0.8 + 0.4 * rnd);
  // The liquid rises in a soft ridge over the strokes before it spikes.
  float ridge = pull(p) * 0.6;
  // Slow rings spread out over the pool from the magnet.
  float dm = max(markSD(toMark(p)), 0.0);
  float rings = sin(dm * 60.0 - uTime * 1.4) * exp(-dm * 6.0) * smoothstep(0.0, 0.03, dm) * 0.07;
  return vec2(spike + ridge + rings, f);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float px = 1.0 / uResolution.y;
  float cell = 0.021 * uMarkAt.z;

  vec2 h0 = height(p, cell);
  float hx = height(p + vec2(px, 0.0), cell).x, hy = height(p + vec2(0.0, px), cell).x;
  // A slow, broad swell over the whole pool, so the flat liquid still bends the light.
  vec2 sp = p * 1.3 + vec2(uTime * 0.025, -uTime * 0.018);
  float sw = swell(sp);
  vec2 g = vec2(hx - h0.x, hy - h0.x) * cell / px + (vec2(swell(sp + vec2(0.02, 0.0)), swell(sp + vec2(0.0, 0.02))) - sw) * 1.6;
  vec3 n = normalize(vec3(-g, 1.0));
  // Seen from a little low on the screen, so flat liquid mirrors a dark sky and slopes catch its horizon.
  vec3 r = reflect(normalize(vec3(0.0, 0.42, -1.0)), n);

  // The sky: the brand gradient around the horizon at 139deg (warm up top left, cool down
  // bottom right), brighter as it nears the horizon, with two soft light strips for highlights.
  vec2 axis = vec2(0.656, -0.755);
  // Each slope takes the gradient colour of the way it faces, brighter the steeper it is.
  float tilt = length(n.xy);
  float along = dot(n.xy / max(tilt, 1e-4), axis);
  float horizon = pow(1.0 - clamp(r.z, 0.0, 1.0), 3.0);
  vec3 env = palette(0.5 + along * 0.5) * (0.02 + 0.25 * tilt + 2.2 * smoothstep(0.55, 0.97, tilt) + 0.6 * horizon) * (0.55 + 0.6 * abs(along));
  float strip = smoothstep(0.93, 0.99, dot(normalize(r.xy + 1e-5), normalize(vec2(-0.7, 0.72)))) * smoothstep(0.75, 0.35, r.z);
  float strip2 = smoothstep(0.9, 0.98, dot(normalize(r.xy + 1e-5), normalize(vec2(0.75, -0.6)))) * smoothstep(0.7, 0.3, r.z);
  float fres = 0.04 + 0.96 * pow(1.0 - max(n.z, 0.0), 3.0);

  vec2 m = toMark(p);
  float d = markSD(m);
  // Light from the magnet glows through the thin liquid between the spikes.
  float under = exp(-max(d, 0.0) * 70.0) * (0.3 + 0.7 * h0.y) * smoothstep(0.6, 0.05, length(g));
  vec3 glow = palette(0.06 + clamp(1.0 - m.y, 0.0, 1.0) * 0.5) * under * 0.45;
  // The spikes' light pools on the flat liquid around them.
  glow += palette(0.1 + clamp(m.x, 0.0, 1.0) * 0.8) * exp(-max(d, 0.0) * 9.0) * 0.07;

  // Far off, a faint warm nebula under the surface, kept to the edges.
  float edge = smoothstep(0.3, 1.0, length((vUv - 0.5) * vec2(1.2, 1.4)));
  vec3 neb = palette(0.15 + 0.55 * vUv.x - 0.25 * vUv.y + 0.15 * sw) * smoothstep(0.3, 0.9, sw) * 0.12 * edge;

  vec3 col = vec3(0.035, 0.032, 0.04);
  // Across the mark the light runs through the brand gradient, peach at the tip to lavender at the feet.
  env *= mix(vec3(1.0), palette(0.05 + clamp(0.95 - m.y + m.x * 0.35, 0.0, 1.0) * 0.85) * 1.7, 0.55 * exp(-max(d, 0.0) * 20.0));
  col += env * (0.35 + 1.0 * fres) + vec3(1.0, 0.85, 0.76) * strip * 1.1 + vec3(0.65, 0.68, 1.0) * strip2 * 0.8;
  col += glow + neb;
  col = tonemap(col * 1.15);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
