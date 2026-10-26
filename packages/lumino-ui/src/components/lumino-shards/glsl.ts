import { BRAND_GLSL } from "../../backgrounds/gl.js";

// Space for both passes: centred on the box, y up, the box's height is 1 (x runs -aspect/2 to aspect/2).

/** Uniforms and helpers both passes share: BRAND_GLSL, and the backdrop the shards refract. */
const COMMON = (spread: string) => `
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform float uAspect;
uniform float uTime;
uniform vec2 uCard;
${BRAND_GLSL}
float fbm3(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s / 0.875; }

// 0 on the card (uCard: its half size), rising to 1 well away from it.
float away(vec2 p) {
  vec2 q = abs(p) - uCard;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return smoothstep(-0.05, 0.3, d);
}

const vec3 GROUND = vec3(0.0667, 0.0627, 0.0745);

// Near-black ground with soft nebula light in the brand gradient at the edges (warm low
// right, cool high left) and a calm, dark middle.
vec3 backdrop(vec2 p) {
  float hx = uAspect * 0.5;
  vec2 q = p / vec2(hx, 0.5);
  float t = uTime * 0.035;
  float n = fbm3(p * 2.3 + vec2(t, -t * 0.7));
  float m = fbm3(p * 4.1 - vec2(t * 1.3, n * 0.8));
  float edge = smoothstep(0.3, 1.35, length(q * vec2(0.92, 1.0)) + (n - 0.5) * 0.5);
  float hue = 0.5 + 0.42 * dot(q, vec2(-0.55, 0.83)) + (m - 0.5) * 0.35;
  float cloud = edge * edge * (0.1 + 1.2 * n * n * m);
  vec3 col = GROUND + palette(clamp(hue, 0.02, 0.98)) * cloud * 0.5;
  // A warm glow off the bottom right and a cool one off the top left.
  col += palette(0.14) * 0.16 * exp(-dot(q - vec2(1.15, -1.15), q - vec2(1.15, -1.15)) * 1.6);
  col += palette(0.82) * 0.1 * exp(-dot(q - vec2(-1.15, 1.15), q - vec2(-1.15, 1.15)) * 1.6);
  return mix(GROUND, col, mix(0.15, 1.0, away(p)));
}
`;

/** The backdrop as a fullscreen pass. */
export const BACKDROP_FS = (spread: string) => `#version 300 es
precision highp float;
${COMMON(spread)}
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 col = tonemap(backdrop(p) * 1.1);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

/**
 * The shards. Everything moves here, from per-shard attributes and the time:
 * a cycle of `uCycle` seconds that bursts the assembled mark (cycle start),
 * orbits the card, pulls back into the mark (from GATHER on) and holds it.
 */
export const SHARDS_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aLocal;
layout(location = 1) in vec2 aHome;
layout(location = 2) in vec3 aBary;
layout(location = 3) in vec4 aRand;
uniform float uAspect;
uniform float uTime;
uniform float uCycle;
uniform vec2 uCard;
uniform float uMarkSize;
uniform float uMarkAlpha;
uniform vec3 uPointer;
out vec3 vBary;
out vec3 vNormal;
out vec2 vP;
out float vAlpha;
out float vHue;
out float vSeed;
out vec2 vMark;
out float vA;

#define TAU 6.2831853
#define BURST 0.09
#define GATHER 0.6
#define GATHER_LEN 0.14
#define GROW 1.15

float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

mat3 rotation(vec3 axis, float a) {
  float s = sin(a), c = cos(a), k = 1.0 - c;
  vec3 u = axis;
  return mat3(
    c + u.x * u.x * k, u.y * u.x * k + u.z * s, u.z * u.x * k - u.y * s,
    u.x * u.y * k - u.z * s, c + u.y * u.y * k, u.z * u.y * k + u.x * s,
    u.x * u.z * k + u.y * s, u.y * u.z * k - u.x * s, c + u.z * u.z * k);
}

void main() {
  float id = aRand.x * 97.0 + aRand.y * 13.0 + aRand.z * 7.0;
  float c = fract(uTime / uCycle);

  // How assembled the shard is (1 in the mark, 0 in orbit): it bursts out from the
  // middle of the mark first, and gathers from the base up, each a little late.
  float db = length(aHome - vec2(0.5, 0.45)) * 0.07 + aRand.w * 0.015;
  float xb = clamp((c - db) / BURST, 0.0, 1.0);
  float out1 = 1.0 - pow(1.0 - xb, 3.0);
  float g0 = GATHER + aHome.y * 0.08 + aRand.z * 0.04;
  float xg = clamp((c - g0) / GATHER_LEN, 0.0, 1.0);
  float gather = xg * xg * xg * (xg * (xg * 6.0 - 15.0) + 10.0);
  float A = c < 0.4 ? 1.0 - out1 : gather;

  // The orbit: a loose band round the card, between a rounded ellipse just clear of
  // it and the edges of the box. On phones the band's sides tuck behind the card.
  float hx = uAspect * 0.5;
  vec2 ain = vec2(uCard.x * 1.1 + 0.05, uCard.y + 0.035);
  ain.x = min(ain.x, hx * 0.9);
  vec2 aout = vec2(min(hx + 0.03, ain.x + 0.55), 0.53);
  aout = max(aout, ain + 0.05);
  float rho = pow(h1(id + 1.0), 1.25);
  vec2 ab = mix(ain, aout, rho);
  float theta = aRand.x * TAU + uTime * (0.045 + 0.035 * h1(id + 2.0)) * (1.0 + 0.4 * (1.0 - rho));
  // On tall boxes the shards hurry past the sides (behind the card) and linger above and below it.
  float kx = clamp((1.2 - uAspect) * 0.95, 0.0, 0.8);
  theta += kx * 0.5 * sin(2.0 * theta);
  float cs = cos(theta), sn = sin(theta);
  vec2 orbit = ab * vec2(sign(cs) * pow(abs(cs), 0.62), sign(sn) * pow(abs(sn), 0.62));
  orbit += 0.012 * vec2(sin(uTime * 0.4 + id), cos(uTime * 0.33 + id * 1.7));

  vec2 home = (aHome - 0.5) * uMarkSize;
  vec2 P = mix(orbit, home, A);
  // Arc the flight a little: bulge outward and swirl round the middle.
  float fly = A * (1.0 - A) * 4.0;
  P += normalize(orbit + 1e-4) * fly * 0.06;
  float sw = fly * (h1(id + 3.0) > 0.5 ? 0.35 : -0.35);
  P = mat2(cos(sw), sin(sw), -sin(sw), cos(sw)) * P;

  // The pointer gently pushes shards in orbit aside.
  vec2 d = P - uPointer.xy;
  P += normalize(d + 1e-4) * uPointer.z * (1.0 - A) * 0.05 * exp(-dot(d, d) / 0.018);

  // Spin: whole turns about the shard's own axis from the burst to the moment it is
  // back in the mark, so it lands flat; fast out of the burst, slowing as it lands.
  float k = (2.0 + floor(h1(id + 4.0) * 3.0)) * (h1(id + 5.0) > 0.5 ? 1.0 : -1.0);
  float xs = clamp((c - db) / (g0 + GATHER_LEN - db), 0.0, 1.0);
  float angle = TAU * k * (1.0 - pow(1.0 - xs, 2.2));
  vec3 axis = normalize(vec3(h1(id + 6.0) - 0.5, h1(id + 7.0) - 0.5, (h1(id + 8.0) - 0.5) * 0.5) + 1e-4);
  mat3 R = rotation(axis, angle);

  // Shards grow in orbit, a few a lot. Drawn a touch big (GROW) so the edges can be
  // antialiased from the barycentrics.
  float size = mix(1.4 + 2.3 * pow(h1(id + 9.0), 2.0), 1.0, A);
  vec3 v = R * vec3(aLocal * uMarkSize * size * GROW, 0.0);
  v.xy /= 1.0 - v.z * 1.5;
  vec2 pos = P + v.xy;

  vBary = aBary * GROW + (1.0 - GROW) / 3.0;
  vNormal = R * vec3(0.0, 0.0, 1.0);
  vP = pos;
  vAlpha = mix(1.0, uMarkAlpha, A);
  // Hue follows the brand's diagonal: warm low right, cool high left.
  vHue = clamp(0.5 + 0.55 * dot(pos / vec2(hx, 0.5), vec2(-0.55, 0.83)) * 0.8 + (h1(id + 10.0) - 0.5) * 0.4, 0.03, 0.97);
  vSeed = h1(id + 11.0);
  vMark = aHome + aLocal * GROW;
  vA = A;
  gl_Position = vec4(pos.x / hx, pos.y * 2.0, 0.0, 1.0);
}`;

/** Glass: the backdrop refracted through the shard's tilt, brightened and tinted, with a fresnel rim on its edges and a glint. */
export const SHARDS_FS = (spread: string) => `#version 300 es
precision highp float;
${COMMON(spread)}
in vec3 vBary;
in vec3 vNormal;
in vec2 vP;
in float vAlpha;
in float vHue;
in float vSeed;
in vec2 vMark;
in float vA;
out vec4 outColor;
void main() {
  float e = min(vBary.x, min(vBary.y, vBary.z));
  float w = fwidth(e);
  float cover = clamp(e / max(w, 1e-5) + 0.5, 0.0, 1.0);
  if (cover <= 0.0) discard;

  vec3 n = normalize(vNormal);
  float back = step(n.z, 0.0);
  n *= mix(1.0, -1.0, back);
  // A faint bevel: tip the normal toward the nearest edges so the face isn't flat.
  vec3 b = vBary - 1.0 / 3.0;
  n = normalize(n + vec3(b.x - b.y, b.z - 0.5 * (b.x + b.y), 0.0) * 0.35);
  float fres = pow(1.0 - n.z, 1.6);

  vec3 tint = palette(vHue);
  // Thick glass: the backdrop seen through it is shifted by the tilt and magnified
  // across the face, then brightened and tinted.
  vec3 seen = backdrop(vP + n.xy * 0.3 + (vBary.xy - 0.333) * 0.12 + vec2(vSeed - 0.5) * 0.05);
  vec3 body = seen * 2.4 * mix(vec3(1.0), tint * 1.7, 0.5) + tint * 0.035;
  // A caustic streak across the face that slides as the shard turns.
  float u = dot(vBary, vec3(0.9, -0.4, -0.5)) + n.x * 2.0 + n.y * 1.3 + vSeed;
  float streak = smoothstep(0.12, 0.0, abs(fract(u) - 0.5) - 0.02) * 0.5;

  // Edges: a crisp line of light and a softer glow inside it.
  float px = e / max(w, 1e-5);
  // In the mark the seams between shards go quieter, so the mark reads whole.
  float seam = 1.0 - 0.6 * smoothstep(0.55, 1.0, vA);
  float line = exp(-max(px, 0.0) * 0.8) * seam;
  float glow = exp(-max(e, 0.0) * 16.0) * seam;
  vec3 rimCol = mix(tint, vec3(1.0, 0.95, 0.92), 0.5);

  vec3 L = normalize(vec3(-0.45, 0.6, 0.8) - vec3(vP, 0.0) * 0.4);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  float sheen = pow(max(dot(n, normalize(vec3(0.5, -0.3, 0.8))), 0.0), 20.0);

  vec3 col = body * (0.35 + 0.8 * fres)
    + rimCol * (line * (0.7 + 1.1 * fres) + glow * (0.22 + 0.6 * fres))
    + mix(tint, vec3(1.0), 0.5) * streak * (0.25 + fres)
    + vec3(1.0, 0.96, 0.92) * spec * 2.2
    + tint * sheen * 0.3;
  col *= mix(1.0, 0.75, back);

  // Back in the mark: trimmed to its outline, lit along it in the brand gradient.
  float dm = markSD(vMark);
  float aw = fwidth(dm) * 0.75 + 1e-5;
  float home = smoothstep(0.55, 1.0, vA);
  float clip = mix(1.0, smoothstep(aw, -aw, dm), home);
  float outline = exp(-max(-dm, 0.0) / (aw * 2.5)) + exp(-max(-dm, 0.0) * 60.0) * 0.4;
  vec3 markTint = palette(clamp(0.5 + 0.9 * dot(vMark - 0.5, vec2(-0.55, 0.83)), 0.05, 0.95));
  col = mix(col, col * 0.6 + markTint * 0.22, home);
  col = tonemap(col);
  float a = clamp(0.18 + 0.4 * fres + line * 0.6 + streak * 0.3 + spec + home * 0.15, 0.0, 1.0);
  // Edge-on shards are thinner than a pixel: let them fade instead of breaking up.
  float k = cover * clip * mix(0.35, 1.0, smoothstep(0.04, 0.3, abs(vNormal.z)));
  // The mark's outline glows through its faintness, so the assembled mark reads clearly.
  vec3 rim = tonemap(mix(markTint * 1.6, vec3(1.0, 0.95, 0.92), 0.3) * outline) * home * 0.55 * (1.0 - vAlpha * 0.5);
  outColor = vec4((col * vAlpha + rim) * k, a * vAlpha * k);
}`;
