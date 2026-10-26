import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * The lumino.io dotted globe low on the screen, turning slowly, with the brandmark
 * rising behind its limb like a sun: it lights a crescent of dots and the air
 * around the limb, with a few short soft rays.
 */
export const GLOBE_DAWN = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uGlobe;   // centre x, y and radius, in units of the height
uniform vec3 uSun;     // the mark's centre x, y and side when risen
uniform float uRise;   // 0 below the limb, 1 risen
uniform float uDots;   // dot rows from pole to pole
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
#define PI 3.14159265

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
// Land: three octaves of 3D noise on the sphere, so there is no seam.
float land(vec3 n) { return noise3(n * 1.7) * 0.55 + noise3(n * 3.9 + 7.0) * 0.3 + noise3(n * 9.0 + 3.0) * 0.15; }

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float px = 1.0 / uResolution.y;
  vec2 c = uGlobe.xy;
  float R = uGlobe.z;
  vec2 rel = p - c;
  float r = length(rel);
  float dl = r - R;

  // The mark: risen along the limb's normal, upright.
  vec2 up = normalize(uSun.xy - c);
  float side = uSun.z;
  vec2 sun = uSun.xy - up * side * 0.42 * (1.0 - uRise) + vec2(0.0, sin(uTime * 0.4) * 0.003);
  vec2 m = (p - sun) / side + 0.5;
  float d = markSD(m) * side;
  float toSun = length(p - (sun + vec2(0.0, side * 0.04)));

  // Sky: the ground colour, a few stars, warm air around the risen mark.
  vec3 col = vec3(0.067, 0.063, 0.075);
  vec2 sc = floor(p * 140.0);
  float sh = hash12(sc);
  vec2 so = hash22(sc) - 0.5;
  float star = smoothstep(0.985, 1.0, sh) * smoothstep(1.6 * px * 140.0, 0.0, length(fract(p * 140.0) - 0.5 - so * 0.6));
  col += vec3(0.75, 0.75, 0.9) * star * (0.4 + 0.6 * sin(uTime * 1.3 + sh * 40.0)) * smoothstep(0.0, 0.3, dl);
  float glow = uRise * (0.6 + 0.4 * uRise);
  col += palette(0.45) * exp(-toSun * 2.2) * 0.16 * glow;
  col += palette(0.3) * exp(-toSun * 6.0) * 0.3 * glow;
  col += palette(0.22) * exp(-toSun * 14.0) * 0.4 * glow;
  col += palette(0.62) * exp(-max(dl, 0.0) * 2.5) * 0.10;

  // Short soft rays from behind the mark, only above the limb.
  float ang = atan(p.y - sun.y, p.x - sun.x);
  float ray = pow(vnoise(vec2(ang * 7.0, uTime * 0.15)) * 0.6 + vnoise(vec2(ang * 17.0, -uTime * 0.1)) * 0.4, 3.0);
  col += palette(0.2) * ray * exp(-toSun * 7.0) * smoothstep(0.0, 0.03, dl) * 0.3 * glow;

  // Air: a thin rim around the limb, brightest under the mark.
  float facing = max(dot(rel / max(r, 1e-4), up), 0.0);
  float lit = pow(facing, 10.0) * (0.35 + 0.65 * uRise);
  float air = exp(-abs(dl) * mix(60.0, 26.0, lit)) * (0.12 + 1.3 * lit);
  col += mix(palette(0.8), palette(0.24), lit) * air * smoothstep(-0.004, 0.0, dl);

  // The mark: a glass sun, hidden where the globe covers it.
  float above = smoothstep(-px, px, dl);
  float aa = px * 1.2;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float rim = exp(-abs(d) / (px * 2.2));
  // Glass tubes: the mark's strokes glow white-hot along their middle and cool to
  // peach and coral at the walls, with a thin lavender rim and a slow sheen.
  float depth = clamp(-d / (side * 0.016), 0.0, 1.0);
  vec3 wall = mix(palette(0.04), palette(0.3), smoothstep(0.78, 0.2, m.y));
  vec3 glass = mix(wall * 1.25, vec3(1.0, 0.93, 0.86) * 1.9, pow(depth, 1.6));
  glass *= 0.9 + 0.2 * fbm(m * 5.0 + vec2(uTime * 0.06, 0.0));
  float sweep = smoothstep(0.05, 0.0, abs(fract(uTime * 0.07) * 3.0 - 1.0 - m.x * 0.8 - m.y * 0.5));
  vec3 markCol = glass * inside + mix(palette(0.95), palette(0.1), 0.5) * rim * 0.5 + vec3(1.0) * sweep * inside * 0.5;
  // The SDF flattens past its spread, so the halo fades out before it gets there.
  float halo = exp(-max(d, 0.0) / (side * 0.03)) * smoothstep(0.1, 0.05, d / side);
  markCol += mix(palette(0.28), palette(0.06), halo) * halo * 0.55 * (1.0 - inside);
  markCol += palette(0.2) * exp(-toSun / (side * 0.3)) * 0.22;
  col += markCol * above * uRise;

  // The globe: a dark body with a dot on every lattice point, land brighter than sea.
  if (dl < 0.0) {
    vec3 n = vec3(rel / R, 0.0);
    n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));
    vec3 L = normalize(vec3(up, -1.1));
    float sunLit = max(dot(n, L) + 0.12, 0.0);
    sunLit = pow(sunLit * 1.6, 2.2) * (0.4 + 0.6 * uRise) * pow(max(dot(normalize(n.xy), up), 0.0), 3.0);
    float fres = pow(1.0 - n.z, 2.5);
    vec3 w = rotY(uTime * 0.025 + uPointer.x * 0.15) * rotX(0.35) * n;

    float step = PI / uDots;
    float lat = asin(clamp(w.y, -1.0, 1.0));
    float lon = atan(w.z, w.x);
    float row = floor(lat / step + 0.5);
    float latc = row * step;
    float count = max(1.0, floor(2.0 * PI * cos(latc) / step));
    float lonStep = 2.0 * PI / count;
    float lonc = (floor(lon / lonStep + 0.5)) * lonStep;
    vec3 dotC = vec3(cos(latc) * cos(lonc), sin(latc), cos(latc) * sin(lonc));
    float dist = length(w - dotC);
    float isLand = smoothstep(0.5, 0.53, land(dotC));
    float rad = step * mix(0.17, 0.3, isLand);
    float fw = max(fwidth(dist), 1e-5);
    float dotMask = smoothstep(rad + fw, rad - fw, dist);

    vec3 body = mix(vec3(0.035, 0.032, 0.05), palette(0.66) * 0.18, fres) + palette(0.1) * sunLit * 0.12;
    vec3 dotCol = mix(mix(palette(0.7), palette(0.84), w.y * 0.5 + 0.5), mix(palette(0.26), palette(0.05), sunLit * 0.5), clamp(sunLit * 1.4, 0.0, 1.0));
    float bright = mix(0.18, 0.9, isLand) * (0.55 + 1.2 * sunLit + 0.5 * fres);
    vec3 g = body + dotCol * dotMask * bright;
    g += mix(palette(0.72), palette(0.24), lit) * fres * (0.15 + 0.7 * lit);
    float a = smoothstep(0.0, -px * 1.5, dl);
    col = mix(col, g, a);
  }

  // Keep the middle calm for content.
  vec2 mid = (vUv - 0.5) * vec2(aspect, 1.0);
  col *= mix(0.6, 1.0, smoothstep(0.1, 0.42, length(mid * vec2(0.8, 1.1))));

  col = tonemap(col * 1.2);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
