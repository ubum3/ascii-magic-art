import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * A glass orb floating over a dark, warm nebula. Through it the nebula is seen
 * inverted and magnified, and the brandmark is caught inside as a slowly turning
 * plane of refracted light, its edges split into R, G and B by dispersion. The
 * rim is a thin-film iridescence in brand colours, with a specular highlight the
 * pointer nudges, and the orb focuses a soft caustic pool of light beside it.
 */
export const ORB = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uOrb;
uniform vec2 uCard;
uniform float uTurn;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

#define MARK_SIDE 1.3
float aspect;
float t;

// Three octaves: the nebula is soft, and it is sampled twice under the orb's rim.
float fbm3(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return s / 0.875;
}

// The mark's distance from the smoothed float field, in mark-square units.
float fieldSD(vec2 p) {
  vec2 q = clamp(p, 0.0, 1.0);
  return texture(uField, q).r + length(p - q);
}

// 0 in the calm pool around the card, 1 well away from it.
float calm(vec2 p) {
  float r = min(uCard.x, uCard.y) * 0.9;
  vec2 q = abs(p - vec2(aspect * 0.5, 0.5)) - uCard + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return smoothstep(-0.1, 0.38, d);
}

// The warm nebula and the light the orb sits in.
vec3 nebula(vec2 p, vec3 orb) {
  vec2 q = p * 1.5;
  q += 0.5 * vec2(sin(q.y * 1.4 + t * 0.07), cos(q.x * 1.2 - t * 0.06));
  float n = fbm3(q + vec2(t * 0.025, -t * 0.018));
  // Wisps with dark gaps: only the upper part of the noise lights up.
  float lit = pow(smoothstep(0.36, 0.95, n), 1.8);
  // Warm near the orb and low down, cooler up and away on the left.
  float far = smoothstep(0.35, 1.3, length(p - orb.xy));
  float hue = mix(0.04 + (1.0 - n) * 0.4, 0.78 + n * 0.2, far);
  vec3 c = palette(clamp(hue, 0.0, 1.0)) * (lit * mix(0.8, 0.5, far) + n * n * 0.04);
  // A warm light behind and above the orb (the orb shows it inverted), and a cool
  // one opposite, so the glass has something to bend.
  vec2 a = (p - orb.xy - vec2(-0.5, 0.65) * orb.z) / orb.z;
  vec2 b = (p - orb.xy - vec2(0.75, -0.55) * orb.z) / orb.z;
  c += palette(0.14) * exp(-dot(a, a) * 1.4) * (0.08 + 0.2 * lit);
  c += palette(0.84) * exp(-dot(b, b) * 1.2) * 0.07;
  return c * mix(0.2, 1.0, calm(p));
}

// The thin-film colour: brand peach, coral, blue and lavender, cycled by film thickness.
vec3 film(float x) {
  x = fract(x);
  vec3 a = palette(0.04), b = palette(0.3), c = palette(0.83), d = palette(0.95);
  vec4 w = max(vec4(0.0), cos(6.2832 * (x - vec4(0.0, 0.25, 0.5, 0.75))));
  return (a * w.x + b * w.y + c * w.z + d * w.w) / (w.x + w.y + w.z + w.w + 1e-3);
}

// Where a ray from the orb's front surface, bent by eta, crosses the mark's plane:
// the mark's distance there (in mark units), or 1 for a miss.
float markRay(vec3 P, vec3 n, float eta, vec3 N, vec3 U, vec3 V, out vec2 uv) {
  vec3 d = refract(vec3(0.0, 0.0, -1.0), n, eta);
  float den = dot(d, N);
  uv = vec2(0.5);
  if (abs(den) < 1e-3) return 1.0;
  float k = -dot(P, N) / den;
  vec3 H = P + d * k;
  if (k < 0.0 || dot(H, H) > 1.0) return 1.0;
  uv = vec2(dot(H, U), dot(H, V)) / MARK_SIDE + 0.5;
  return fieldSD(uv);
}

void main() {
  aspect = uResolution.x / uResolution.y;
  t = uTime;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 ptr = uPointer - 0.5;

  // The orb bobs and breathes a little.
  vec3 orb = uOrb;
  orb.y += orb.z * 0.03 * sin(t * 0.45);
  orb.z *= 1.0 + 0.012 * sin(t * 0.31 + 1.0);

  vec2 s = (p - orb.xy) / orb.z;
  float rho = length(s);
  float px = 1.0 / (orb.z * uResolution.y);
  float cover = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0, rho);

  // The light: from the upper left, nudged by the pointer.
  vec3 L = normalize(vec3(-0.55 + ptr.x * 0.5, 0.6 + ptr.y * 0.5, 0.6));

  vec3 col = vec3(0.0);
  if (cover < 1.0) {
    col = nebula(p, orb);
    // The caustic pool: light the orb focuses onto the ground below it, on the far side from the light.
    vec2 f = (s - vec2(-L.x * 0.9, -1.32)) * vec2(1.0, 2.6);
    float pool = exp(-dot(f, f) * 1.6);
    float core = exp(-dot(f * vec2(1.6, 1.0), f * vec2(1.6, 1.0)) * 9.0);
    float rip = 0.75 + 0.25 * sin(f.x * 9.0 + sin(f.y * 7.0 + t * 0.6) * 1.5 + t * 0.4);
    col += (palette(0.1) * pool * 0.16 * rip + vec3(1.0, 0.82, 0.7) * core * 0.18) * (1.0 - cover);
    // A soft halo just outside the glass.
    float halo = exp(-max(rho - 1.0, 0.0) * 7.0) * step(1.0, rho);
    col += film(0.55 + 0.12 * (s.y - s.x) / max(rho, 1e-3) + t * 0.02) * halo * 0.08;
    // The orb's shadow side darkens the ground a touch.
    col *= 1.0 - 0.25 * exp(-max(rho - 1.0, 0.0) * 4.0) * step(1.0, rho);
  }
  if (cover > 0.0) {
    float r2 = min(dot(s, s), 1.0);
    float z = sqrt(1.0 - r2);
    vec3 n = vec3(s, z);
    vec3 P = n;

    // The nebula behind, inverted and magnified like a ball lens, darker toward the edge.
    vec2 bp = orb.xy - s * orb.z * (0.5 + 0.75 * r2);
    vec3 seen = nebula(bp, orb);
    vec3 inner = seen * seen * 3.2 / (1.0 + seen * 2.2) * (1.2 + 0.5 * z) * mix(vec3(0.8, 0.85, 1.05), vec3(1.0), z) + palette(0.6) * 0.03;
    inner *= 0.35 + 0.65 * smoothstep(0.0, 0.45, z);

    // The mark: a plane through the centre, turning slowly about the vertical and tipping a little.
    float yaw = uTurn * (0.9 * sin(t * 0.17) + 0.15 * sin(t * 0.43));
    float pitch = 0.14 * sin(t * 0.23 + 0.8) - 0.1;
    float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    vec3 U = vec3(cy, 0.0, -sy);
    vec3 V = vec3(-sy * sp, cp, -cy * sp);
    vec3 N = cross(U, V);
    vec2 uvR, uvG, uvB;
    float dR = markRay(P, n, 1.0 / 1.40, N, U, V, uvR);
    float dG = markRay(P, n, 1.0 / 1.47, N, U, V, uvG);
    float dB = markRay(P, n, 1.0 / 1.55, N, U, V, uvB);
    vec3 d3 = vec3(dR, dG, dB);
    // Bright light edges with a softer glow, one per colour channel.
    vec3 fill = 1.0 - smoothstep(-0.006, 0.004, d3);
    // A caustic network rippling across the mark's face.
    vec2 cu = uvG * 9.0;
    float net = 0.5 + 0.5 * sin(cu.x * 1.3 + sin(cu.y * 1.7 + t * 0.5) * 1.8 + t * 0.3) * sin(cu.y * 1.1 - sin(cu.x * 1.4 - t * 0.4) * 1.6);
    net = pow(net, 4.0);
    vec3 tint = mix(palette(0.08), palette(0.9), smoothstep(0.15, 0.85, uvG.y));
    float face = abs(dot(N, vec3(0.0, 0.0, 1.0)));
    vec3 core = exp(-abs(d3) * 170.0), glow = exp(-abs(d3) * 26.0);
    vec3 markCol = (core * 1.9 * mix(tint, vec3(1.0), 0.3) + glow * tint * 0.75 + fill * tint * (0.06 + 0.5 * net)) * (0.55 + 0.45 * face);
    inner += markCol * smoothstep(0.0, 0.25, z);

    // The ball focuses the light into a bright crescent on the far side, inside the glass.
    vec2 fo = s + L.xy * 0.78;
    inner += mix(palette(0.08), vec3(1.0, 0.9, 0.8), 0.4) * exp(-dot(fo, fo) * 14.0) * 0.55;

    // Thin-film rim: fresnel times a hue that cycles with the film's thickness.
    float fres = 0.04 + 0.96 * pow(1.0 - z, 5.0);
    float thick = 0.3 + 1.3 * z + 0.12 * sin(dot(s, vec2(2.6, 1.5)) + t * 0.25) + 0.08 * sin(s.x * 5.0 - s.y * 4.0 + t * 0.4);
    vec3 rim = film(thick) * fres * 2.2;
    // A crescent of window light reflected along the upper-left rim.
    float side = max(dot(s / max(rho, 1e-3), normalize(L.xy)), 0.0);
    float crescent = smoothstep(0.8, 0.9, rho) * smoothstep(0.985, 0.93, rho) * pow(side, 5.0);
    // Specular: a sharp sun, a broad soft one and a dim kick light low on the right.
    vec3 rv = reflect(vec3(0.0, 0.0, -1.0), n);
    // The key light's highlight: an oval stretched along the rim, with a hot core.
    vec2 ld = normalize(L.xy);
    vec2 hs = s - ld * 0.6;
    vec2 he = vec2(dot(hs, vec2(-ld.y, ld.x)) / 0.2, dot(hs, ld) / 0.085);
    float spec = smoothstep(1.0, 0.15, length(he)) * 0.9 + pow(max(dot(rv, L), 0.0), 400.0) * 2.0 + pow(max(dot(rv, L), 0.0), 14.0) * 0.08;
    vec3 K = normalize(vec3(0.75, -0.45, 0.5));
    spec += pow(max(dot(rv, K), 0.0), 60.0) * 0.35;
    vec3 glass = inner * (1.0 - fres) + rim + vec3(1.0, 0.95, 0.92) * (spec + crescent * 0.8);
    // A fine bright line where the glass meets the air.
    glass += film(0.6 + 0.2 * (s.y - s.x) / max(rho, 1e-3)) * exp(-(1.0 - rho) / (2.0 * px + 0.004)) * 0.5;
    col = mix(col, glass, cover);
  }

  col *= 1.0 - 0.35 * smoothstep(0.6, 1.25, length(vUv - 0.5) * 1.6);
  col = tonemap(col * 1.2);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
