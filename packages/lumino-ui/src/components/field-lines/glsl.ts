import { BRAND_GLSL } from "../../backgrounds/gl.js";

/** How many poles the shader takes (the mark's seven plus the pointer's two). */
export const MAX_POLES = 9;

/**
 * Magnetic field lines around the brandmark. In 2D the field of point poles has an
 * exact stream function, the sum of each pole's strength times its angle, so the
 * lines are just its contours: no particles, no simulation. Pulses of light run along
 * them (from north to south, along the potential), they glow where they crowd near a
 * pole, and they fade out with the field's strength so the middle stays calm.
 * FILINGS swaps the lines for ASCII iron filings: - / | \ by the field's direction.
 */
export const FIELD = (spread: string, filings: boolean) => `#version 300 es
precision highp float;
${spread}
${filings ? "#define FILINGS" : ""}
#define MAX_POLES ${MAX_POLES}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uMarkAt;            // centre x, y and SDF square side, in p units
uniform vec3 uPoles[MAX_POLES];  // x, y in p units, line count (+ out, - in)
uniform float uLines;            // lines per unit pole
uniform float uCell;             // FILINGS: cell size in pixels
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

const float TAU = 6.2831853;

// The stream function (in lines), the potential, and the field at p.
void field(vec2 p, out float psi, out float phi, out vec2 e) {
  psi = 0.0; phi = 0.0; e = vec2(0.0);
  for (int i = 0; i < MAX_POLES; i++) {
    vec3 q = uPoles[i];
    if (q.z == 0.0) continue;
    vec2 d = p - q.xy;
    float r2 = dot(d, d) + 1e-6;
    psi += q.z * atan(d.y, d.x) / TAU;
    phi += q.z * log(r2) * 0.5;
    e += q.z * d / r2;
  }
}

vec2 toMark(vec2 p) { return (p - uMarkAt.xy) / uMarkAt.z + 0.5; }

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float px = 1.0 / uResolution.y;

  float d = markSD(toMark(p)) * uMarkAt.z;
  float psi, phi; vec2 e;
#ifdef FILINGS
  // One glyph per cell, read from the field at the cell's centre.
  vec2 cellPx = vec2(uCell * 0.6, uCell);
  vec2 cid = floor(gl_FragCoord.xy / cellPx);
  vec2 local = (gl_FragCoord.xy - (cid + 0.5) * cellPx) / cellPx.y;
  p = (cid + 0.5) * cellPx / uResolution.y;
  field(p, psi, phi, e);
#else
  field(p, psi, phi, e);
#endif
  float strength = length(e);
  // Light falls off with the field: bright near the mark, gone well before the middle.
  float lit = smoothstep(3.0, 5.4, log(strength * 14.0 / uLines + 1e-4));
  // The colour runs with the potential: peach at the north poles, lavender at the south.
  float hue = 0.5 + 0.48 * tanh(phi * 0.06 + 0.1);
  vec3 tint = palette(hue);

  // The lines drift round slowly, and a pulse runs along each, its own phase per line.
  float s = psi + uTime * 0.03;
  float id = floor(s + 0.5);
  float pulse = fract(phi * 0.045 - uTime * 0.22 + hash12(vec2(id, 3.7)));
  pulse = pow(pulse, 18.0) * 3.0;

  vec3 col = vec3(0.0);
#ifdef FILINGS
  // Quantise the field's direction to - / | \\ and draw that stroke in the cell.
  float ang = atan(e.y, e.x);
  float k = mod(floor(ang / (3.14159265 / 4.0) + 0.5), 4.0);
  vec2 dir = vec2(cos(k * 3.14159265 / 4.0), sin(k * 3.14159265 / 4.0));
  float along = dot(local, dir), across = abs(local.x * dir.y - local.y * dir.x);
  float glyph = smoothstep(0.075, 0.03, across) * smoothstep(0.42, 0.36, abs(along));
  // Weak cells show a dot, as filings that never lined up.
  float dotg = smoothstep(0.09, 0.05, length(local));
  float g = mix(dotg * 0.5, glyph, smoothstep(0.1, 0.4, lit));
  col = tint * g * (0.12 + 1.1 * lit) * (0.8 + pulse * 0.6);
#else
  // The stream function's slope is the field's strength over TAU: exact, unlike fwidth, which
  // spikes where atan wraps (a whole line further on, so the contours themselves don't jump).
  float w = strength / TAU * px;
  float f = abs(fract(s + 0.5) - 0.5);
  // A line one pixel wide, softening to a haze where the lines crowd together.
  float line = smoothstep(w * 1.3, w * 0.2, f) * smoothstep(0.45, 0.12, w);
  float haze = smoothstep(0.1, 0.6, w);
  col = tint * (line * (0.35 + 1.4 * lit) * lit * (0.75 + pulse) + haze * 0.55 * lit);
  // A soft glow along each line, wider than the line itself.
  col += tint * smoothstep(w * 6.0, 0.0, f) * lit * 0.12 * (1.0 - haze);
#endif

  // The magnet itself: dark glass with a rim of light, sitting over the lines.
  float inside = 1.0 - smoothstep(-px, px, d);
  vec2 m = toMark(p);
  vec3 rimCol = palette(0.06 + clamp(1.0 - m.y, 0.0, 1.0) * 0.6);
  col *= 1.0 - inside * 0.85;
  col += rimCol * (exp(-abs(d) / (2.0 * px)) * 0.9 + exp(-max(d, 0.0) * 40.0) * 0.18);
  col += rimCol * inside * (0.1 + 0.25 * smoothstep(0.0, -0.02 * uMarkAt.z, d));

  // A faint nebula behind it all.
  col += palette(0.3 + vUv.x * 0.5) * pow(fbm(vUv * 2.5 + uTime * 0.01), 3.0) * 0.12;

  col = tonemap(col * 1.2 + vec3(0.045, 0.04, 0.05));
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
